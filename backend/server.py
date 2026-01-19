from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'financial_db')]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-super-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Create the main app
app = FastAPI(title="Financial API", description="API para gerenciamento de finanças pessoais", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== ENUMS ==============
class TransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER = "transfer"

# ============== MODELS ==============

# User Models
class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=3)

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    total_balance: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None
    is_active: bool = True

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    total_balance: float
    created_at: datetime
    is_active: bool

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Category Models
class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None
    budget_limit: Optional[float] = Field(None, ge=0)

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None
    budget_limit: Optional[float] = Field(None, ge=0)

class Category(CategoryBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Transaction Models
class TransactionBase(BaseModel):
    amount: float = Field(..., gt=0)
    description: str = Field(..., min_length=1)
    type: TransactionType
    category_id: Optional[str] = None
    transaction_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notes: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    description: Optional[str] = Field(None, min_length=1)
    type: Optional[TransactionType] = None
    category_id: Optional[str] = None
    transaction_date: Optional[datetime] = None
    notes: Optional[str] = None

class Transaction(TransactionBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class TransactionWithCategory(Transaction):
    category_name: Optional[str] = None

# Report Models
class FinancialSummary(BaseModel):
    total_income: float
    total_expense: float
    net_balance: float
    transaction_count: int
    month: int
    year: int

class CategoryExpense(BaseModel):
    category_id: Optional[str]
    category_name: str
    total_amount: float
    transaction_count: int
    percentage: float

class ExpenseByCategory(BaseModel):
    expenses: List[CategoryExpense]
    total_expense: float

# Pagination
class PaginatedResponse(BaseModel):
    items: List
    total: int
    page: int
    page_size: int
    total_pages: int

# ============== HELPER FUNCTIONS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode = {
        "sub": user_id,
        "email": email,
        "exp": expire
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id, "is_active": True}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_datetime(obj):
    """Convert datetime objects to ISO format strings for MongoDB"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj

def deserialize_datetime(obj, fields):
    """Convert ISO format strings back to datetime objects"""
    for field in fields:
        if field in obj and isinstance(obj[field], str):
            try:
                obj[field] = datetime.fromisoformat(obj[field])
            except:
                pass
    return obj

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """Register a new user"""
    # Check if email already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        full_name=user_data.full_name
    )
    
    # Store user with hashed password
    user_dict = user.model_dump()
    user_dict['password_hash'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    logger.info(f"New user registered: {user.email}")
    
    # Generate token
    token = create_access_token(user.id, user.email)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            total_balance=user.total_balance,
            created_at=user.created_at,
            is_active=user.is_active
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login and get JWT token"""
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    if not user or not verify_password(credentials.password, user.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.get('is_active', True):
        raise HTTPException(status_code=401, detail="User account is deactivated")
    
    # Update last login
    await db.users.update_one(
        {"id": user['id']},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"User logged in: {user['email']}")
    
    # Generate token
    token = create_access_token(user['id'], user['email'])
    
    # Parse created_at
    created_at = user['created_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user['id'],
            email=user['email'],
            full_name=user['full_name'],
            total_balance=user.get('total_balance', 0.0),
            created_at=created_at,
            is_active=user.get('is_active', True)
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    created_at = current_user['created_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    return UserResponse(
        id=current_user['id'],
        email=current_user['email'],
        full_name=current_user['full_name'],
        total_balance=current_user.get('total_balance', 0.0),
        created_at=created_at,
        is_active=current_user.get('is_active', True)
    )

# ============== CATEGORY ROUTES ==============

@api_router.get("/categories", response_model=List[Category])
async def get_categories(
    is_active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get all categories for the current user"""
    query = {"user_id": current_user['id']}
    if is_active is not None:
        query["is_active"] = is_active
    else:
        query["is_active"] = True
    
    skip = (page - 1) * page_size
    categories = await db.categories.find(query, {"_id": 0}).skip(skip).limit(page_size).to_list(page_size)
    
    # Deserialize datetimes
    for cat in categories:
        deserialize_datetime(cat, ['created_at'])
    
    return categories

@api_router.post("/categories", response_model=Category, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new category"""
    category = Category(
        **category_data.model_dump(),
        user_id=current_user['id']
    )
    
    cat_dict = category.model_dump()
    cat_dict['created_at'] = cat_dict['created_at'].isoformat()
    
    await db.categories.insert_one(cat_dict)
    logger.info(f"Category created: {category.name} for user {current_user['id']}")
    
    return category

@api_router.put("/categories/{category_id}", response_model=Category)
async def update_category(
    category_id: str,
    category_data: CategoryUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a category"""
    category = await db.categories.find_one(
        {"id": category_id, "user_id": current_user['id'], "is_active": True},
        {"_id": 0}
    )
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_data = {k: v for k, v in category_data.model_dump().items() if v is not None}
    
    if update_data:
        await db.categories.update_one(
            {"id": category_id},
            {"$set": update_data}
        )
        category.update(update_data)
    
    deserialize_datetime(category, ['created_at'])
    return Category(**category)

@api_router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Soft delete a category"""
    result = await db.categories.update_one(
        {"id": category_id, "user_id": current_user['id'], "is_active": True},
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    logger.info(f"Category deleted: {category_id}")

# ============== TRANSACTION ROUTES ==============

@api_router.get("/transactions", response_model=List[TransactionWithCategory])
async def get_transactions(
    category_id: Optional[str] = None,
    transaction_type: Optional[TransactionType] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get all transactions with filters"""
    query = {"user_id": current_user['id'], "is_active": True}
    
    if category_id:
        query["category_id"] = category_id
    if transaction_type:
        query["type"] = transaction_type.value
    if start_date:
        query["transaction_date"] = {"$gte": start_date.isoformat()}
    if end_date:
        if "transaction_date" in query:
            query["transaction_date"]["$lte"] = end_date.isoformat()
        else:
            query["transaction_date"] = {"$lte": end_date.isoformat()}
    
    skip = (page - 1) * page_size
    transactions = await db.transactions.find(query, {"_id": 0}).sort("transaction_date", -1).skip(skip).limit(page_size).to_list(page_size)
    
    # Get category names
    category_ids = list(set(t.get('category_id') for t in transactions if t.get('category_id')))
    categories = {}
    if category_ids:
        cats = await db.categories.find({"id": {"$in": category_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
        categories = {c['id']: c['name'] for c in cats}
    
    # Add category names and deserialize
    result = []
    for t in transactions:
        deserialize_datetime(t, ['created_at', 'transaction_date'])
        t['category_name'] = categories.get(t.get('category_id'))
        result.append(TransactionWithCategory(**t))
    
    return result

@api_router.post("/transactions", response_model=Transaction, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction_data: TransactionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new transaction"""
    # Validate category if provided
    if transaction_data.category_id:
        category = await db.categories.find_one({
            "id": transaction_data.category_id,
            "user_id": current_user['id'],
            "is_active": True
        })
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")
    
    transaction = Transaction(
        **transaction_data.model_dump(),
        user_id=current_user['id']
    )
    
    trans_dict = transaction.model_dump()
    trans_dict['created_at'] = trans_dict['created_at'].isoformat()
    trans_dict['transaction_date'] = trans_dict['transaction_date'].isoformat()
    
    await db.transactions.insert_one(trans_dict)
    
    # Update user balance
    balance_change = transaction.amount if transaction.type == TransactionType.INCOME else -transaction.amount
    if transaction.type == TransactionType.TRANSFER:
        balance_change = 0
    
    await db.users.update_one(
        {"id": current_user['id']},
        {"$inc": {"total_balance": balance_change}}
    )
    
    logger.info(f"Transaction created: {transaction.description} - {transaction.amount}")
    
    return transaction

@api_router.put("/transactions/{transaction_id}", response_model=Transaction)
async def update_transaction(
    transaction_id: str,
    transaction_data: TransactionUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a transaction"""
    transaction = await db.transactions.find_one(
        {"id": transaction_id, "user_id": current_user['id'], "is_active": True},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Calculate balance adjustment
    old_amount = transaction['amount']
    old_type = transaction['type']
    
    update_data = {k: v for k, v in transaction_data.model_dump().items() if v is not None}
    
    if 'transaction_date' in update_data and update_data['transaction_date']:
        update_data['transaction_date'] = update_data['transaction_date'].isoformat()
    
    if update_data:
        await db.transactions.update_one(
            {"id": transaction_id},
            {"$set": update_data}
        )
        transaction.update(update_data)
    
    # Adjust balance if amount or type changed
    new_amount = transaction['amount']
    new_type = transaction['type']
    
    old_balance_effect = old_amount if old_type == 'income' else (-old_amount if old_type == 'expense' else 0)
    new_balance_effect = new_amount if new_type == 'income' else (-new_amount if new_type == 'expense' else 0)
    balance_adjustment = new_balance_effect - old_balance_effect
    
    if balance_adjustment != 0:
        await db.users.update_one(
            {"id": current_user['id']},
            {"$inc": {"total_balance": balance_adjustment}}
        )
    
    deserialize_datetime(transaction, ['created_at', 'transaction_date'])
    return Transaction(**transaction)

@api_router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a transaction (soft delete)"""
    transaction = await db.transactions.find_one(
        {"id": transaction_id, "user_id": current_user['id'], "is_active": True},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Reverse the balance effect
    amount = transaction['amount']
    trans_type = transaction['type']
    balance_reversal = -amount if trans_type == 'income' else (amount if trans_type == 'expense' else 0)
    
    await db.transactions.update_one(
        {"id": transaction_id},
        {"$set": {"is_active": False}}
    )
    
    if balance_reversal != 0:
        await db.users.update_one(
            {"id": current_user['id']},
            {"$inc": {"total_balance": balance_reversal}}
        )
    
    logger.info(f"Transaction deleted: {transaction_id}")

# ============== REPORT ROUTES ==============

@api_router.get("/reports/summary", response_model=FinancialSummary)
async def get_financial_summary(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    current_user: dict = Depends(get_current_user)
):
    """Get financial summary for a specific month/year"""
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year
    
    # Calculate date range
    start_date = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
    if target_month == 12:
        end_date = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
    
    # Get all transactions for the period
    transactions = await db.transactions.find({
        "user_id": current_user['id'],
        "is_active": True,
        "transaction_date": {
            "$gte": start_date.isoformat(),
            "$lt": end_date.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    total_income = sum(t['amount'] for t in transactions if t['type'] == 'income')
    total_expense = sum(t['amount'] for t in transactions if t['type'] == 'expense')
    
    return FinancialSummary(
        total_income=total_income,
        total_expense=total_expense,
        net_balance=total_income - total_expense,
        transaction_count=len(transactions),
        month=target_month,
        year=target_year
    )

@api_router.get("/reports/by-category", response_model=ExpenseByCategory)
async def get_expenses_by_category(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    current_user: dict = Depends(get_current_user)
):
    """Get expenses grouped by category"""
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year
    
    # Calculate date range
    start_date = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
    if target_month == 12:
        end_date = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
    
    # Get expense transactions
    transactions = await db.transactions.find({
        "user_id": current_user['id'],
        "is_active": True,
        "type": "expense",
        "transaction_date": {
            "$gte": start_date.isoformat(),
            "$lt": end_date.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    # Get categories
    categories = await db.categories.find(
        {"user_id": current_user['id']},
        {"_id": 0, "id": 1, "name": 1}
    ).to_list(1000)
    category_map = {c['id']: c['name'] for c in categories}
    
    # Group by category
    category_totals = {}
    for t in transactions:
        cat_id = t.get('category_id')
        if cat_id not in category_totals:
            category_totals[cat_id] = {'amount': 0, 'count': 0}
        category_totals[cat_id]['amount'] += t['amount']
        category_totals[cat_id]['count'] += 1
    
    total_expense = sum(ct['amount'] for ct in category_totals.values())
    
    expenses = []
    for cat_id, data in category_totals.items():
        expenses.append(CategoryExpense(
            category_id=cat_id,
            category_name=category_map.get(cat_id, "Sem categoria" if cat_id else "Sem categoria"),
            total_amount=data['amount'],
            transaction_count=data['count'],
            percentage=(data['amount'] / total_expense * 100) if total_expense > 0 else 0
        ))
    
    # Sort by amount descending
    expenses.sort(key=lambda x: x.total_amount, reverse=True)
    
    return ExpenseByCategory(expenses=expenses, total_expense=total_expense)

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "Financial API is running", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
