import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Globe, Loader2 } from 'lucide-react';

const Register = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await register(email, password, fullName);
      navigate('/');
    } catch (err) {
      if (err.response?.status === 400) {
        setError(t('emailExists'));
      } else {
        setError(t('errorOccurred'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4">
      <div className="absolute top-4 right-4">
        <Button variant="ghost" size="icon" onClick={toggleLanguage} data-testid="register-language-toggle">
          <Globe className="h-5 w-5" />
        </Button>
      </div>
      
      <Card className="w-full max-w-md" data-testid="register-card">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-xl">F</span>
          </div>
          <CardTitle className="text-2xl">{t('registerTitle')}</CardTitle>
          <CardDescription>{t('registerSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md" data-testid="register-error">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('fullName')}</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="João Silva"
                required
                minLength={3}
                data-testid="register-fullname"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                data-testid="register-email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                data-testid="register-password"
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading} data-testid="register-submit">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('loading')}</>
              ) : (
                t('register')
              )}
            </Button>
          </form>
          
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('hasAccount')}{' '}
            <Link to="/login" className="text-primary hover:underline" data-testid="login-link">
              {t('login')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
