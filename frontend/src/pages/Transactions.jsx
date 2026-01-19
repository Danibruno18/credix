import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { transactionsApi, categoriesApi } from '../lib/api';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, ArrowUpDown, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

const Transactions = () => {
  const { t, language } = useLanguage();
  const { fetchUser } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ type: '', category_id: '' });
  
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'expense',
    category_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const dateLocale = language === 'pt' ? ptBR : enUS;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: language === 'pt' ? 'BRL' : 'USD'
    }).format(value || 0);
  };

  const fetchTransactions = async () => {
    try {
      const params = {};
      if (filters.type) params.transaction_type = filters.type;
      if (filters.category_id) params.category_id = filters.category_id;
      const data = await transactionsApi.getAll(params);
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await categoriesApi.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchTransactions(), fetchCategories()]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchTransactions();
    }
  }, [filters]);

  const handleOpenDialog = (transaction = null) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setFormData({
        description: transaction.description,
        amount: transaction.amount.toString(),
        type: transaction.type,
        category_id: transaction.category_id || '',
        transaction_date: transaction.transaction_date.split('T')[0],
        notes: transaction.notes || ''
      });
    } else {
      setEditingTransaction(null);
      setFormData({
        description: '',
        amount: '',
        type: 'expense',
        category_id: '',
        transaction_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        category_id: formData.category_id || null,
        transaction_date: new Date(formData.transaction_date + 'T12:00:00Z').toISOString()
      };

      if (editingTransaction) {
        await transactionsApi.update(editingTransaction.id, payload);
      } else {
        await transactionsApi.create(payload);
      }

      setDialogOpen(false);
      await fetchTransactions();
      await fetchUser();
    } catch (error) {
      console.error('Error saving transaction:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await transactionsApi.delete(deletingId);
      setDeleteDialogOpen(false);
      setDeletingId(null);
      await fetchTransactions();
      await fetchUser();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'income': return <TrendingUp className="h-4 w-4 text-income" />;
      case 'expense': return <TrendingDown className="h-4 w-4 text-expense" />;
      default: return <ArrowUpDown className="h-4 w-4 text-transfer" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'income': return t('income');
      case 'expense': return t('expense');
      default: return t('transfer');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="transactions-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('transactions')}</h1>
        <Button onClick={() => handleOpenDialog()} data-testid="add-transaction-btn">
          <Plus className="mr-2 h-4 w-4" /> {t('newTransaction')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="w-40">
              <Select value={filters.type} onValueChange={(v) => setFilters(f => ({ ...f, type: v }))}>
                <SelectTrigger data-testid="filter-type">
                  <SelectValue placeholder={t('type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('type')}</SelectItem>
                  <SelectItem value="income">{t('income')}</SelectItem>
                  <SelectItem value="expense">{t('expense')}</SelectItem>
                  <SelectItem value="transfer">{t('transfer')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={filters.category_id} onValueChange={(v) => setFilters(f => ({ ...f, category_id: v }))}>
                <SelectTrigger data-testid="filter-category">
                  <SelectValue placeholder={t('category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('category')}</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(filters.type || filters.category_id) && (
              <Button variant="ghost" onClick={() => setFilters({ type: '', category_id: '' })} data-testid="clear-filters">
                {t('clearFilters')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card data-testid="transactions-list">
        <CardContent className="pt-6">
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8" data-testid="no-transactions">
              {t('noTransactions')}
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  data-testid={`transaction-item-${transaction.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-muted">
                      {getTypeIcon(transaction.type)}
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-2 py-0.5 rounded-full bg-muted">
                          {getTypeLabel(transaction.type)}
                        </span>
                        <span>{transaction.category_name || t('noCategory')}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(transaction.transaction_date), 'PP', { locale: dateLocale })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-semibold text-lg ${transaction.type === 'income' ? 'text-income' : transaction.type === 'expense' ? 'text-expense' : 'text-transfer'}`}>
                      {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}
                      {formatCurrency(transaction.amount)}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(transaction)} data-testid={`edit-${transaction.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeletingId(transaction.id); setDeleteDialogOpen(true); }} data-testid={`delete-${transaction.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="transaction-dialog">
          <DialogHeader>
            <DialogTitle>{editingTransaction ? t('editTransaction') : t('newTransaction')}</DialogTitle>
            <DialogDescription>
              {editingTransaction ? t('editTransaction') : t('newTransaction')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('description')}</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder={t('description')}
                data-testid="transaction-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('amount')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  data-testid="transaction-amount"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('type')}</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData(f => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="transaction-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">{t('income')}</SelectItem>
                    <SelectItem value="expense">{t('expense')}</SelectItem>
                    <SelectItem value="transfer">{t('transfer')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('category')} {t('optional')}</Label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData(f => ({ ...f, category_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger data-testid="transaction-category">
                    <SelectValue placeholder={t('selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('noCategory')}</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('date')}</Label>
                <Input
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData(f => ({ ...f, transaction_date: e.target.value }))}
                  data-testid="transaction-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('notes')} {t('optional')}</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                placeholder={t('notes')}
                data-testid="transaction-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !formData.description || !formData.amount} data-testid="save-transaction">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="confirm-delete">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Transactions;
