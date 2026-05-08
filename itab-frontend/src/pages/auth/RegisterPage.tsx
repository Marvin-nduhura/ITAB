import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, CheckCircle2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGoogleLogin } from '@react-oauth/google';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';
import type { UserRole } from '../../types';

// ─── Role options (shared between form and Google modal) ─────────────────────
const ROLE_OPTIONS = [
  { value: 'tenant',           label: 'Tenant',                  desc: 'Looking for property to rent',       icon: '🏠' },
  { value: 'landlord',         label: 'Landlord',                desc: 'I own property',                     icon: '🏢' },
  { value: 'property_manager', label: 'Property Manager',        desc: 'I manage properties for landlords',  icon: '👔' },
  { value: 'agent',            label: 'Agent',                   desc: 'I list properties for clients',      icon: '🤝' },
  { value: 'vendor',           label: 'Vendor / Service Provider', desc: 'I provide maintenance services',   icon: '🔧' },
];

// ─── Zod schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  firstName: z.string().min(2, 'First name required'),
  lastName:  z.string().min(2, 'Last name required'),
  email:     z.string().email('Enter a valid email'),
  phone:     z.string().min(10, 'Enter a valid phone number'),
  role:      z.enum(['tenant', 'landlord', 'property_manager', 'agent', 'vendor']),
  password:  z.string().min(8, 'Password must be at least 8 characters'),
  confirm:   z.string(),
  terms:     z.boolean().refine(v => v, 'You must accept the terms'),
}).refine(d => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});

type FormData = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────
export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();

  const [showPassword, setShowPassword]     = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [loading, setLoading]               = useState(false);
  const [googleLoading, setGoogleLoading]   = useState(false);
  const [isInvited, setIsInvited]           = useState(false);
  const [invitedRole, setInvitedRole]       = useState<string>('tenant');

  // Google role-selection modal state
  const [showRoleModal, setShowRoleModal]   = useState(false);
  const [googleRole, setGoogleRole]         = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'tenant' },
  });

  // ── Read invite URL params on mount ────────────────────────────────────────
  useEffect(() => {
    const inviteRole      = searchParams.get('role');
    const inviteEmail     = searchParams.get('email');
    const inviteFirstName = searchParams.get('firstName');
    const inviteLastName  = searchParams.get('lastName');
    const inviteToken     = searchParams.get('invite');
    const fromGoogle      = searchParams.get('google');

    if (inviteToken) {
      setIsInvited(true);
      if (inviteRole)      setValue('role', inviteRole as any);
      if (inviteEmail)     setValue('email', inviteEmail);
      if (inviteFirstName) setValue('firstName', inviteFirstName);
      if (inviteLastName)  setValue('lastName', inviteLastName);
      setInvitedRole(inviteRole || 'tenant');
    }

    // Redirected from login after Google sign-in — open role modal immediately
    if (fromGoogle === '1') {
      if (inviteEmail)     setValue('email', inviteEmail || '');
      if (inviteFirstName) setValue('firstName', inviteFirstName || '');
      if (inviteLastName)  setValue('lastName', inviteLastName || '');
      setShowRoleModal(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Google OAuth (called AFTER role is selected in modal) ──────────────────
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const googleUser = await res.json();

        const selectedRole = googleRole || 'tenant';
        const roleLabel = ROLE_OPTIONS.find(r => r.value === selectedRole)?.label ?? selectedRole;

        const newUser = {
          id:         `u_${Date.now()}`,
          email:      googleUser.email,
          firstName:  googleUser.given_name  || googleUser.name?.split(' ')[0] || 'User',
          lastName:   googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '',
          avatar:     googleUser.picture,
          role:       selectedRole as UserRole,
          isVerified: true,
          isSuspended: false,
          kycStatus:  'pending' as const,
          createdAt:  new Date().toISOString(),
          updatedAt:  new Date().toISOString(),
        };

        setAuth(newUser, `google_token_${newUser.id}`);
        toast.success(`Welcome to ITAB, ${newUser.firstName}! Signed up as ${roleLabel} 🎉`);
        navigate('/dashboard');
      } catch {
        toast.error('Google sign-up failed. Please try again.');
      } finally {
        setGoogleLoading(false);
        setShowRoleModal(false);
      }
    },
    onError: () => {
      toast.error('Google sign-up was cancelled or failed.');
      setGoogleLoading(false);
    },
  });

  // ── Regular form submit ────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 800));

      const newUser = {
        id:          `u_${Date.now()}`,
        email:       data.email,
        phone:       data.phone,
        firstName:   data.firstName,
        lastName:    data.lastName,
        role:        data.role as UserRole,
        isVerified:  false,
        isSuspended: false,
        kycStatus:   'pending' as const,
        createdAt:   new Date().toISOString(),
        updatedAt:   new Date().toISOString(),
      };

      setAuth(newUser, `mock_token_${newUser.id}`);
      const roleLabel = ROLE_OPTIONS.find(r => r.value === data.role)?.label ?? data.role;
      toast.success(`Welcome to ITAB, ${newUser.firstName}! Registered as ${roleLabel} 🎉`);
      navigate('/dashboard');
    } catch {
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const invitedRoleLabel = ROLE_OPTIONS.find(r => r.value === invitedRole)?.label ?? invitedRole;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <img src="/logo.png" alt="ITAB" className="h-16 w-auto object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">ITAB Property Services</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Uganda's premier property platform</p>
          </div>

          {/* Invite banner */}
          <AnimatePresence>
            {isInvited && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-xl px-4 py-3"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-800 dark:text-emerald-300">
                  You've been invited to join ITAB Property Services as a{' '}
                  <span className="font-semibold">{invitedRoleLabel}</span>. Your details have been pre-filled.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card-lg border border-slate-100 dark:border-slate-700 p-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">Create your account</h2>

            {/* Google sign-up */}
            <button
              type="button"
              onClick={() => { setGoogleRole(''); setShowRoleModal(true); }}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 mb-6"
            >
              {googleLoading ? (
                <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </button>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs text-slate-400 bg-white dark:bg-slate-800 px-2">
                or register with email
              </div>
            </div>

            {/* Registration form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First name"
                  placeholder="John"
                  error={errors.firstName?.message}
                  {...register('firstName')}
                />
                <Input
                  label="Last name"
                  placeholder="Doe"
                  error={errors.lastName?.message}
                  {...register('lastName')}
                />
              </div>

              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                error={errors.email?.message}
                {...register('email')}
              />

              <Input
                label="Phone number"
                type="tel"
                placeholder="+256 700 000 000"
                error={errors.phone?.message}
                {...register('phone')}
              />

              <Select
                label="I am a..."
                error={errors.role?.message}
                options={ROLE_OPTIONS.map(r => ({ value: r.value, label: `${r.icon}  ${r.label} — ${r.desc}` }))}
                {...register('role')}
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                error={errors.password?.message}
                iconRight={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="hover:text-slate-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                {...register('password')}
              />

              <Input
                label="Confirm password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat your password"
                error={errors.confirm?.message}
                iconRight={
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="hover:text-slate-600">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                {...register('confirm')}
              />

              {/* Terms */}
              <div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    {...register('terms')}
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    I agree to the{' '}
                    <Link to="/terms" className="text-primary-600 hover:text-primary-700 font-medium">Terms of Service</Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-primary-600 hover:text-primary-700 font-medium">Privacy Policy</Link>
                  </span>
                </label>
                {errors.terms && (
                  <p className="mt-1.5 text-xs text-red-500">{errors.terms.message}</p>
                )}
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full"
                size="lg"
                iconRight={!loading ? <ChevronRight size={16} /> : undefined}
              >
                Create account
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold">Sign in</Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Google Role Selection Modal ─────────────────────────────────────── */}
      <Modal
        open={showRoleModal}
        onClose={() => { setShowRoleModal(false); setGoogleRole(''); }}
        title="Choose your role"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => { setShowRoleModal(false); setGoogleRole(''); }}
            >
              Cancel
            </Button>
            <Button
              disabled={!googleRole}
              loading={googleLoading}
              onClick={() => googleLogin()}
              iconRight={!googleLoading ? <ChevronRight size={16} /> : undefined}
            >
              Continue with Google
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2 mb-4">
            How will you use ITAB Property Services?
          </p>
          {ROLE_OPTIONS.map(role => {
            const isSelected = googleRole === role.value;
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => setGoogleRole(role.value)}
                className={[
                  'w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition-all duration-150',
                  isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50',
                ].join(' ')}
              >
                <span className="text-2xl flex-shrink-0" aria-hidden="true">{role.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-slate-800 dark:text-slate-200'}`}>
                    {role.label}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{role.desc}</p>
                </div>
                {isSelected && (
                  <CheckCircle2 className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
