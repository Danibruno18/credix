import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { reportsApi } from '../lib/api';
import { TrendingUp, TrendingDown, ArrowUpDown, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const Reports = () => {
  const { t, language } = useLanguage();
  const [summary, setSummary] = useState(null);
  const [categoryExpenses, setCategoryExpenses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = t('months');
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const COLORS = ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#4ade80', '#86efac', '#bbf7d0'];

  const formatCurrency = (value) => {
    return new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: language === 'pt' ? 'BRL' : 'USD'
    }).format(value || 0);
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [summaryData, categoryData] = await Promise.all([
        reportsApi.getSummary(selectedMonth, selectedYear),
        reportsApi.getByCategory(selectedMonth, selectedYear)
      ]);
      setSummary(summaryData);
      setCategoryExpenses(categoryData);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedMonth, selectedYear]);

  const pieChartData = categoryExpenses?.expenses?.map((exp, index) => ({
    name: exp.category_name,
    value: exp.total_amount,
    color: COLORS[index % COLORS.length]
  })) || [];

  const barChartData = [
    { name: t('income'), value: summary?.total_income || 0, fill: '#22c55e' },
    { name: t('expense'), value: summary?.total_expense || 0, fill: '#ef4444' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reports-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">{t('reports')}</h1>
        <div className="flex gap-3">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-36" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={index} value={(index + 1).toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-28" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="report-income-card">
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

        <Card data-testid="report-expense-card">
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

        <Card data-testid="report-balance-card">
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

        <Card data-testid="report-count-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('transactionCount')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.transaction_count || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Income vs Expense Bar Chart */}
        <Card data-testid="bar-chart-card">
          <CardHeader>
            <CardTitle>{t('financialSummary')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis type="category" dataKey="name" width={80} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expenses by Category Pie Chart */}
        <Card data-testid="pie-chart-card">
          <CardHeader>
            <CardTitle>{t('expensesByCategory')}</CardTitle>
          </CardHeader>
          <CardContent>
            {pieChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                {t('noTransactions')}
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Details Table */}
      {categoryExpenses?.expenses?.length > 0 && (
        <Card data-testid="category-details-card">
          <CardHeader>
            <CardTitle>{t('expensesByCategory')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">{t('category')}</th>
                    <th className="text-right py-3 px-4 font-medium">{t('amount')}</th>
                    <th className="text-right py-3 px-4 font-medium">{t('transactionCount')}</th>
                    <th className="text-right py-3 px-4 font-medium">{t('percentage')}</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryExpenses.expenses.map((exp, index) => (
                    <tr key={index} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4">{exp.category_name}</td>
                      <td className="py-3 px-4 text-right font-medium text-expense">
                        {formatCurrency(exp.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-right">{exp.transaction_count}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-1 rounded-full bg-muted text-sm">
                          {exp.percentage.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50">
                    <td className="py-3 px-4 font-semibold">{t('totalExpenses')}</td>
                    <td className="py-3 px-4 text-right font-semibold text-expense">
                      {formatCurrency(categoryExpenses.total_expense)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {categoryExpenses.expenses.reduce((acc, e) => acc + e.transaction_count, 0)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;
