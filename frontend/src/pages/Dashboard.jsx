import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { reportsApi, transactionsApi } from '../lib/api';
import { TrendingUp, TrendingDown, Wallet, ArrowUpDown, Plus, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

const Dashboard = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const dateLocale = language === 'pt' ? ptBR : enUS;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: language === 'pt' ? 'BRL' : 'USD'
    }).format(value || 0);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, transactionsData] = await Promise.all([
          reportsApi.getSummary(),
          transactionsApi.getAll({ page_size: 5 })
        ]);
        setSummary(summaryData);
        setRecentTransactions(transactionsData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
          <p className="text-muted-foreground">
            {language === 'pt' ? 'Olá' : 'Hello'}, {user?.full_name?.split(' ')[0]}!
          </p>
        </div>
        <Button onClick={() => navigate('/transactions')} data-testid="new-transaction-btn">
          <Plus className="mr-2 h-4 w-4" /> {t('newTransaction')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="total-balance-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalBalance')}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(user?.total_balance || 0) >= 0 ? 'text-income' : 'text-expense'}`}>
              {formatCurrency(user?.total_balance)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="monthly-income-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('monthlyIncome')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-income" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-income">
              {formatCurrency(summary?.total_income)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="monthly-expenses-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('monthlyExpenses')}</CardTitle>
            <TrendingDown className="h-4 w-4 text-expense" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-expense">
              {formatCurrency(summary?.total_expense)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="net-balance-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('netBalance')}</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(summary?.net_balance || 0) >= 0 ? 'text-income' : 'text-expense'}`}>
              {formatCurrency(summary?.net_balance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card data-testid="recent-transactions-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('recentTransactions')}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')} data-testid="view-all-btn">
            {t('viewAll')} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8" data-testid="no-transactions">
              {t('noTransactions')}
            </p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  data-testid={`transaction-${transaction.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-background">
                      {getTypeIcon(transaction.type)}
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {transaction.category_name || t('noCategory')} • {format(new Date(transaction.transaction_date), 'PPp', { locale: dateLocale })}
                      </p>
                    </div>
                  </div>
                  <div className={`font-semibold ${transaction.type === 'income' ? 'text-income' : transaction.type === 'expense' ? 'text-expense' : 'text-transfer'}`}>
                    {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}
                    {formatCurrency(transaction.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
