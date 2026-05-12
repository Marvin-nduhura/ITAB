import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGoogleLogin } from '@react-oauth/google';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { useUserStore } from '../../store/userStore';
import { authApi, authGoogleApi } from '../../lib/api';
import { mockUsers } from '../../lib/mockData';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type FormData = z.infer<typeof schema>;

// Demo credentials
const DEMO_ACCOUNTS = [
  { role: 'Admin',            email: 'admin@itab.ug',   password: 'password123' },
  { role: 'Property Manager', email: 'manager@itab.ug', password: 'password123' },
  { role: 'Landlord',         email: 'landlord@itab.ug',password: 'password123' },
  { role: 'Tenant',           email: 'tenant@itab.ug',  password: 'password123' },
  { role: 'Agent',            email: 'agent@itab.ug',   password: 'password123' },
  { role: 'Vendor',           email: 'vendor@itab.ug',  password: 'password123' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { isSuspended } = useUserStore();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Google OAuth handler
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        // Fetch user info from Google
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const googleUser = await res.json();

        // Try backend first
        try {
          const backendRes = await authGoogleApi.loginOrRegister({
            googleId: googleUser.sub,
            email: googleUser.email,
            firstName: googleUser.given_name || '',
            lastName: googleUser.family_name || '',
            avatar: googleUser.picture,
          });
          const { user, token, requiresApproval } = backendRes.data.data;
          if (requiresApproval) {
            toast('Your account is pending approval. Please wait for admin review.', { icon: '⏳', duration: 6000 });
            return;
          }
          const typedUser = user as Parameters<typeof setAuth>[0];
          const suspensionCheck = isSuspended(typedUser.email);
          if (suspensionCheck.suspended) {
            toast.error(`Account suspended: ${suspensionCheck.reason || 'Contact support@itab.ug'}`, { duration: 8000, icon: '🚫' });
            return;
          }
          setAuth(typedUser, token);
          toast.success(`Welcome back, ${typedUser.firstName}! 👋`);
          navigate('/dashboard');
          return;
        } catch {
          // Backend unavailable — fall back to mock data
        }

        // Check if user exists in mock data
        const existingUser = mockUsers.find(u => u.email === googleUser.email);
        if (existingUser) {
          const suspensionCheck = isSuspended(existingUser.email);
          if (suspensionCheck.suspended) {
            toast.error(`Account suspended: ${suspensionCheck.reason || 'Contact support@itab.ug'}`, { duration: 8000, icon: '🚫' });
            return;
          }
          setAuth(existingUser, `google_token_${existingUser.id}`);
          toast.success(`Welcome back, ${existingUser.firstName}! 👋`);
          navigate('/dashboard');
        } else {
          // New Google user — redirect to register page so they can pick their role
          navigate(`/register?google=1&email=${encodeURIComponent(googleUser.email)}&firstName=${encodeURIComponent(googleUser.given_name || '')}&lastName=${encodeURIComponent(googleUser.family_name || '')}`);
          toast(`New to ITAB? Please choose your role to complete sign-up.`, { icon: '👋', duration: 5000 });
        }
      } catch {
        toast.error('Google sign-in failed. Please try again.');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error('Google sign-in was cancelled or failed.');
      setGoogleLoading(false);
    },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      // Try backend first
      try {
        const res = await authApi.login({ email: data.email, password: data.password });
        const { user, token } = (res.data as { data: { user: Parameters<typeof setAuth>[0]; token: string } }).data;
        const suspensionCheck = isSuspended(user.email);
        if (suspensionCheck.suspended) {
          toast.error(
            `Your account has been suspended.\n${suspensionCheck.reason ? `Reason: ${suspensionCheck.reason}` : 'Please contact support at support@itab.ug'}`,
            { duration: 8000, icon: '🚫' }
          );
          setLoading(false);
          return;
        }
        setAuth(user, token);
        toast.success(`Welcome back, ${user.firstName}!`);
        navigate('/dashboard');
        return;
      } catch (backendErr: unknown) {
        const err = backendErr as { response?: { status?: number; data?: { code?: string; reason?: string } } };
        if (err.response?.status === 403 && err.response?.data?.code === 'ACCOUNT_SUSPENDED') {
          toast.error(
            `Your account has been suspended.\n${err.response.data.reason ? `Reason: ${err.response.data.reason}` : 'Please contact support at support@itab.ug'}`,
            { duration: 8000, icon: '🚫' }
          );
          setLoading(false);
          return;
        }
        if (err.response?.status === 401) {
          // Backend says invalid credentials — don't fall back to mock
          toast.error('Invalid email or password');
          setLoading(false);
          return;
        }
        // Backend unavailable — fall back to mock
      }

      // Mock fallback
      await new Promise(r => setTimeout(r, 800));
      const user = mockUsers.find(u => u.email === data.email);
      if (!user) throw new Error('Invalid credentials');

      const suspensionCheck = isSuspended(data.email);
      if (suspensionCheck.suspended) {
        toast.error(
          `Your account has been suspended.\n${suspensionCheck.reason ? `Reason: ${suspensionCheck.reason}` : 'Please contact support at support@itab.ug'}`,
          { duration: 8000, icon: '🚫' }
        );
        setLoading(false);
        return;
      }

      setAuth(user, `mock_token_${user.id}`);
      toast.success(`Welcome back, ${user.firstName}!`);
      navigate('/dashboard');
    } catch {
      toast.error('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <img src="/logo.png" alt="ITAB" className="h-16 w-auto object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">ITAB Property Services</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Uganda's premier property platform</p>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card-lg border border-slate-100 dark:border-slate-700 p-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">Sign in to your account</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                icon={<Mail size={16} />}
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                icon={<Lock size={16} />}
                iconRight={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="hover:text-slate-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                error={errors.password?.message}
                {...register('password')}
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input type="checkbox" className="rounded border-slate-300" />
                  Remember me
                </label>
                <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Forgot password?</Link>
              </div>

              <Button type="submit" loading={loading} className="w-full" size="lg">Sign in</Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-slate-500">Don't have an account? <Link to="/register" className="text-primary-600 hover:text-primary-700 font-semibold">Sign up</Link></p>
            </div>

            {/* Social login */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700" /></div>
                <div className="relative flex justify-center text-xs text-slate-400 bg-white dark:bg-slate-800 px-2">or continue with</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => googleLogin()}
                  disabled={googleLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  {googleLoading ? (
                    <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  )}
                  Google
                </button>
                <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <svg className="w-4 h-4" fill="#1877F2" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </button>
              </div>
            </div>
          </div>

          {/* Demo accounts */}
          <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Demo Accounts (click to fill)</p>
            <div className="grid grid-cols-1 gap-1.5">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  onClick={() => { setValue('email', acc.email); setValue('password', acc.password); }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{acc.role}</span>
                  <span className="text-xs text-slate-400">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
