import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { categoriesApi } from '../lib/api';
import { Plus, Pencil, Trash2, Loader2, Tags, Wallet } from 'lucide-react';

const ICONS = [
  '🏠', '🚗', '🍔', '💰', '💳', '🎮', '🎓', '✈️', '🏥', '🛒', 
  '🎁', '💻', '📱', '🎉', '🏃', '☕', '🍽️', '🎬', '🎵', '👕'
];

const Categories = () => {
  const { t, language } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '💰',
    budget_limit: ''
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: language === 'pt' ? 'BRL' : 'USD'
    }).format(value || 0);
  };

  const fetchCategories = async () => {
    try {
      const data = await categoriesApi.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
        icon: category.icon || '💰',
        budget_limit: category.budget_limit?.toString() || ''
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        description: '',
        icon: '💰',
        budget_limit: ''
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        icon: formData.icon,
        budget_limit: formData.budget_limit ? parseFloat(formData.budget_limit) : null
      };

      if (editingCategory) {
        await categoriesApi.update(editingCategory.id, payload);
      } else {
        await categoriesApi.create(payload);
      }

      setDialogOpen(false);
      await fetchCategories();
    } catch (error) {
      console.error('Error saving category:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await categoriesApi.delete(deletingId);
      setDeleteDialogOpen(false);
      setDeletingId(null);
      await fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
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
    <div className="space-y-6" data-testid="categories-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('categories')}</h1>
        <Button onClick={() => handleOpenDialog()} data-testid="add-category-btn">
          <Plus className="mr-2 h-4 w-4" /> {t('newCategory')}
        </Button>
      </div>

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Tags className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="no-categories">{t('noCategories')}</p>
              <Button className="mt-4" onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" /> {t('newCategory')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="categories-grid">
          {categories.map((category) => (
            <Card key={category.id} className="hover:shadow-md transition-shadow" data-testid={`category-${category.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.icon || '💰'}</span>
                    <div>
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                      {category.description && (
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(category)} data-testid={`edit-cat-${category.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setDeletingId(category.id); setDeleteDialogOpen(true); }} data-testid={`delete-cat-${category.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  <span>
                    {t('budgetLimit')}: {category.budget_limit ? formatCurrency(category.budget_limit) : t('noBudget')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="category-dialog">
          <DialogHeader>
            <DialogTitle>{editingCategory ? t('editCategory') : t('newCategory')}</DialogTitle>
            <DialogDescription>
              {editingCategory ? t('editCategory') : t('newCategory')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('categoryName')}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder={t('categoryName')}
                data-testid="category-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('description')} {t('optional')}</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder={t('description')}
                data-testid="category-description"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('icon')}</Label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-md">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, icon }))}
                    className={`p-2 rounded-md text-xl hover:bg-accent transition-colors
                      ${formData.icon === icon ? 'bg-primary/20 ring-2 ring-primary' : ''}`}
                    data-testid={`icon-${icon}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('budgetLimit')} {t('optional')}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.budget_limit}
                onChange={(e) => setFormData(f => ({ ...f, budget_limit: e.target.value }))}
                placeholder="0.00"
                data-testid="category-budget"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !formData.name} data-testid="save-category">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-category-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="confirm-delete-category">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Categories;
