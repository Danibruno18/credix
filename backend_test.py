#!/usr/bin/env python3
import requests
import sys
import json
from datetime import datetime

class FinancialAPITester:
    def __init__(self, base_url="https://pdf-creator-50.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.category_id = None
        self.transaction_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.text else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_register(self):
        """Test user registration"""
        test_data = {
            "email": f"test_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "test123",
            "full_name": "Test User"
        }
        success, response = self.run_test("User Registration", "POST", "auth/register", 201, test_data)
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_login(self):
        """Test user login with test credentials"""
        login_data = {
            "email": "test@example.com",
            "password": "test123"
        }
        success, response = self.run_test("User Login", "POST", "auth/login", 200, login_data)
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_get_me(self):
        """Test get current user info"""
        return self.run_test("Get Current User", "GET", "auth/me", 200)

    def test_create_category(self):
        """Test category creation"""
        category_data = {
            "name": "Test Category",
            "description": "Test category for API testing",
            "icon": "💰",
            "budget_limit": 1000.0
        }
        success, response = self.run_test("Create Category", "POST", "categories", 201, category_data)
        if success and 'id' in response:
            self.category_id = response['id']
            print(f"   Category ID: {self.category_id}")
            return True
        return False

    def test_get_categories(self):
        """Test get categories"""
        return self.run_test("Get Categories", "GET", "categories", 200)

    def test_update_category(self):
        """Test category update"""
        if not self.category_id:
            print("❌ No category ID available for update test")
            return False
        
        update_data = {
            "name": "Updated Test Category",
            "description": "Updated description",
            "budget_limit": 1500.0
        }
        return self.run_test("Update Category", "PUT", f"categories/{self.category_id}", 200, update_data)

    def test_create_transaction(self):
        """Test transaction creation"""
        transaction_data = {
            "amount": 100.50,
            "description": "Test Income Transaction",
            "type": "income",
            "category_id": self.category_id,
            "notes": "Test transaction for API testing"
        }
        success, response = self.run_test("Create Transaction", "POST", "transactions", 201, transaction_data)
        if success and 'id' in response:
            self.transaction_id = response['id']
            print(f"   Transaction ID: {self.transaction_id}")
            return True
        return False

    def test_create_expense_transaction(self):
        """Test expense transaction creation"""
        transaction_data = {
            "amount": 50.25,
            "description": "Test Expense Transaction",
            "type": "expense",
            "category_id": self.category_id,
            "notes": "Test expense for API testing"
        }
        success, response = self.run_test("Create Expense Transaction", "POST", "transactions", 201, transaction_data)
        return success

    def test_get_transactions(self):
        """Test get transactions"""
        return self.run_test("Get Transactions", "GET", "transactions", 200)

    def test_get_transactions_with_filters(self):
        """Test get transactions with filters"""
        return self.run_test("Get Transactions (Income Filter)", "GET", "transactions?transaction_type=income", 200)

    def test_update_transaction(self):
        """Test transaction update"""
        if not self.transaction_id:
            print("❌ No transaction ID available for update test")
            return False
        
        update_data = {
            "amount": 150.75,
            "description": "Updated Test Transaction",
            "notes": "Updated notes"
        }
        return self.run_test("Update Transaction", "PUT", f"transactions/{self.transaction_id}", 200, update_data)

    def test_get_financial_summary(self):
        """Test financial summary report"""
        return self.run_test("Get Financial Summary", "GET", "reports/summary", 200)

    def test_get_expenses_by_category(self):
        """Test expenses by category report"""
        return self.run_test("Get Expenses by Category", "GET", "reports/by-category", 200)

    def test_delete_transaction(self):
        """Test transaction deletion"""
        if not self.transaction_id:
            print("❌ No transaction ID available for delete test")
            return False
        
        return self.run_test("Delete Transaction", "DELETE", f"transactions/{self.transaction_id}", 204)

    def test_delete_category(self):
        """Test category deletion"""
        if not self.category_id:
            print("❌ No category ID available for delete test")
            return False
        
        return self.run_test("Delete Category", "DELETE", f"categories/{self.category_id}", 204)

def main():
    print("🚀 Starting Financial API Tests")
    print("=" * 50)
    
    tester = FinancialAPITester()
    
    # Test sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("User Registration", tester.test_register),
        ("Get Current User", tester.test_get_me),
        ("Create Category", tester.test_create_category),
        ("Get Categories", tester.test_get_categories),
        ("Update Category", tester.test_update_category),
        ("Create Income Transaction", tester.test_create_transaction),
        ("Create Expense Transaction", tester.test_create_expense_transaction),
        ("Get Transactions", tester.test_get_transactions),
        ("Get Transactions with Filters", tester.test_get_transactions_with_filters),
        ("Update Transaction", tester.test_update_transaction),
        ("Get Financial Summary", tester.test_get_financial_summary),
        ("Get Expenses by Category", tester.test_get_expenses_by_category),
        ("Delete Transaction", tester.test_delete_transaction),
        ("Delete Category", tester.test_delete_category),
    ]
    
    # Also test login with existing credentials
    print("\n🔄 Testing login with existing test credentials...")
    if tester.test_login():
        print("✅ Login with test@example.com successful")
        # Run a few more tests with existing user
        tester.test_get_me()
        tester.test_get_categories()
        tester.test_get_transactions()
    else:
        print("❌ Login with test@example.com failed - will use registered user")
    
    # Run all tests
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("🎉 Backend API tests mostly successful!")
        return 0
    else:
        print("⚠️  Backend API has significant issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())