import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, CheckCircle2, ChevronRight, Clock, FileText, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGoogleLogin } from '@react-oauth/google';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { FileUpload } from '../../components/ui/FileUpload';
import type { UploadedFile } from '../../components/ui/FileUpload';
import { useAuthStore } from '../../store/authStore';
import { useUserStore } from '../../store/userStore';
import type { AgentApplication } from '../../store/userStore';
import { authApi, authGoogleApi, agentApplicationsApi } from '../../lib/api';
import type { User } from '../../types';
import { DISTRICTS } from '../../lib/utils';

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

// ─── Application schema (for agent/property_manager) ─────────────────────────
const applicationSchema = z.object({
  nationalId: z.string().min(10, 'National ID required'),
  experience: z.string().min(20, 'Please describe your experience (min 20 characters)'),
  districts: z.array(z.string()).min(1, 'Select at least one district'),
  motivation: z.string().min(30, 'Please explain your motivation (min 30 characters)'),
});

type ApplicationData = z.infer<typeof applicationSchema>;

// ─── Component ────────────────────────────────────────────────────────────────
export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();
  const { addUser, submitAgentApplication } = useUserStore();

  const [showPassword, setShowPassword]     = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [loading, setLoading]               = useState(false);
  const [googleLoading, setGoogleLoading]   = useState(false);
  const [isInvited, setIsInvited]           = useState(false);
  const [invitedRole, setInvitedRole]       = useState<string>('tenant');

  // Application flow state (for agent/property_manager)
  const [showApplicationFlow, setShowApplicationFlow] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{
    googleId: string; email: string; firstName: string; lastName: string; avatar?: string; role: string;
  } | null>(null);
  const [nationalIdFiles, setNationalIdFiles] = useState<UploadedFile[]>([]);
  const [additionalDocs, setAdditionalDocs] = useState<UploadedFile[]>([]);
  const [appDistricts, setAppDistricts] = useState<string[]>([]);
  const [appLoading, setAppLoading] = useState(false);
  /** Phone for Google sign-up (required on application step; not provided by Google OAuth). */
  const [googleApplicationPhone, setGoogleApplicationPhone] = useState('');

  const {
    register: registerApp,
    handleSubmit: handleAppSubmit,
    setValue: setAppValue,
    formState: { errors: appErrors },
  } = useForm<ApplicationData>({ resolver: zodResolver(applicationSchema) });

  // Google role-selection modal state
  const [showRoleModal, setShowRoleModal]   = useState(false);
  const [googleRole, setGoogleRole]         = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'tenant' },
  });

  const watchedRole = watch('role');

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
      if (inviteRole)      setValue('role', inviteRole as 'tenant' | 'landlord' | 'property_manager' | 'agent' | 'vendor');
      if (inviteEmail)     setValue('email', inviteEmail);
      if (inviteFirstName) setValue('firstName', inviteFirstName);
      if (inviteLastName)  setValue('lastName', inviteLastName);
      setInvitedRole(inviteRole || 'tenant');
    }

    // Pre-fill email when redirected from login "no account found" prompt
    if (!inviteToken && inviteEmail) {
      setValue('email', inviteEmail);
    }

    // Redirected from login after Google sign-in — open role modal immediately
    if (fromGoogle === '1') {
      if (inviteEmail)     setValue('email', inviteEmail || '');
      if (inviteFirstName) setValue('firstName', inviteFirstName || '');
      if (inviteLastName)  setValue('lastName', inviteLastName || '');
      setShowRoleModal(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const requiresApplication = (role: string) => ['agent', 'property_manager', 'landlord'].includes(role);

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
        const googleData = {
          googleId: googleUser.sub,
          email: googleUser.email,
          firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || 'User',
          lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '',
          avatar: googleUser.picture,
          role: selectedRole,
        };

        if (requiresApplication(selectedRole)) {
          // Show application flow
          setPendingGoogleUser(googleData);
          setShowRoleModal(false);
          setShowApplicationFlow(true);
          setGoogleLoading(false);
          return;
        }

        // Register via backend — Render DB is the only source of truth
        try {
          const backendRes = await authGoogleApi.loginOrRegister(googleData);
          const { user, token } = backendRes.data.data;
          setAuth(user as Parameters<typeof setAuth>[0], token);
          addUser(user as Parameters<typeof setAuth>[0]);
        } catch (gErr: unknown) {
          const ax = gErr as { response?: { status?: number; data?: { message?: string } } };
          toast.error(ax.response?.data?.message || 'Google sign-up failed. Please check your connection and try again.');
          setGoogleLoading(false);
          setShowRoleModal(false);
          return;
        }

        const roleLabel = ROLE_OPTIONS.find(r => r.value === selectedRole)?.label ?? selectedRole;
        toast.success(`Welcome to ITAB, ${googleData.firstName}! Signed up as ${roleLabel} 🎉`);
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
    if (requiresApplication(data.role)) {
      try {
        const check = await authApi.checkEmail(data.email);
        const exists = (check.data as { data?: { exists?: boolean } }).data?.exists;
        if (exists) {
          toast.error('This email already has an account. Sign in or use a different email address.');
          return;
        }
      } catch {
        // Offline: continue; duplicate will surface when registering after the application step.
      }
      setPendingFormData(data);
      setShowApplicationFlow(true);
      return;
    }

    setLoading(true);
    try {
      // Try backend first
      try {
        const res = await authApi.register({
          firstName: data.firstName, lastName: data.lastName,
          email: data.email, phone: data.phone,
          password: data.password, role: data.role,
        });
        const { user: backendUser, token } = (res.data as { data: { user: User; token: string } }).data;
        setAuth(backendUser, token);
        addUser(backendUser);
      } catch (err: unknown) {
        const ax = err as { response?: { status?: number; data?: { message?: string } } };
        if (ax.response?.status === 409) {
          toast.error(ax.response.data?.message || 'This email is already registered. Sign in instead.');
          setLoading(false);
          return;
        }
        toast.error(ax.response?.data?.message || 'Registration failed. Check your connection and try again.');
        setLoading(false);
        return;
      }

      const roleLabel = ROLE_OPTIONS.find(r => r.value === data.role)?.label ?? data.role;
      toast.success(`Welcome to ITAB, ${data.firstName}! Registered as ${roleLabel} 🎉`);
      navigate('/dashboard');
    } catch {
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Application submit (landlord / agent / property manager) ─────────────
  const onApplicationSubmit = async (appData: ApplicationData) => {
    if (nationalIdFiles.length === 0) {
      toast.error('Please upload your National ID photo');
      return;
    }
    if (pendingGoogleUser) {
      const ph = googleApplicationPhone.trim();
      if (ph.length < 10) {
        toast.error('Enter a valid phone number (required for this account type).');
        return;
      }
    }

    const docPayload = {
      nationalIdNumber: appData.nationalId,
      nationalIdDoc: nationalIdFiles[0]?.dataUrl,
      additionalDocs: additionalDocs.map(f => ({
        name: f.file?.name || 'document',
        dataUrl: f.dataUrl,
        type: f.file?.type || 'image',
      })),
      experience: appData.experience,
      districts: appData.districts,
      motivation: appData.motivation,
    };

    setAppLoading(true);
    try {
      if (pendingFormData) {
        const reg = await authApi.register({
          firstName: pendingFormData.firstName,
          lastName: pendingFormData.lastName,
          email: pendingFormData.email,
          phone: pendingFormData.phone,
          password: pendingFormData.password,
          role: pendingFormData.role,
          kycSubmitted: true,
        });
        const { user: created, token } = (reg.data as { data: { user: User; token: string } }).data;
        setAuth(created, token);
        addUser(created);

        const appRes = await agentApplicationsApi.submit({
          userId: created.id,
          firstName: pendingFormData.firstName,
          lastName: pendingFormData.lastName,
          email: pendingFormData.email,
          phone: pendingFormData.phone,
          role: pendingFormData.role,
          ...docPayload,
        });
        const saved = appRes.data.data as AgentApplication;
        submitAgentApplication(saved);
      } else if (pendingGoogleUser) {
        const phone = googleApplicationPhone.trim();
        const gRes = await authGoogleApi.loginOrRegister({
          googleId: pendingGoogleUser.googleId,
          email: pendingGoogleUser.email,
          firstName: pendingGoogleUser.firstName,
          lastName: pendingGoogleUser.lastName,
          avatar: pendingGoogleUser.avatar,
          role: pendingGoogleUser.role,
          phone,
          intent: 'register',
          kycSubmitted: true,
        });
        const { user: created, token } = (gRes.data as { data: { user: User; token: string } }).data;
        setAuth(created, token);
        addUser(created);

        const appRes = await agentApplicationsApi.submit({
          userId: created.id,
          firstName: pendingGoogleUser.firstName,
          lastName: pendingGoogleUser.lastName,
          email: pendingGoogleUser.email,
          phone,
          role: pendingGoogleUser.role,
          ...docPayload,
        });
        const savedG = appRes.data.data as AgentApplication;
        submitAgentApplication(savedG);
      }

      setApplicationSubmitted(true);
      toast.success('Application submitted. An admin will review your documents.');
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { message?: string; code?: string } } };
      if (ax.response?.status === 409) {
        toast.error(ax.response.data?.message || 'This email already has an account. Sign in instead.');
      } else {
        toast.error(ax.response?.data?.message || 'Could not submit. Check your connection and try again.');
      }
    } finally {
      setAppLoading(false);
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

          {/* Application Submitted Screen */}
          {applicationSubmitted ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card-lg border border-slate-100 dark:border-slate-700 p-8 text-center">
              <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock size={36} className="text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Application Under Review</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                Your application has been submitted. Our team will review your documents and get back to you within 2–3 business days.
              </p>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl mb-6 text-left">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">What happens next?</p>
                <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1.5 list-disc list-inside">
                  <li>Admin reviews your National ID and submitted documents</li>
                  {(pendingFormData?.role === 'landlord' || pendingGoogleUser?.role === 'landlord') ? (
                    <li>Once approved, you can log in and start listing your properties</li>
                  ) : (
                    <li>Once approved, you can log in and access your full dashboard</li>
                  )}
                  <li>You will be notified by email when a decision is made</li>
                  <li>If rejected, you will receive a reason and can reapply</li>
                </ul>
              </div>
              <Button className="w-full" onClick={() => navigate('/login')}>Back to Login</Button>
            </div>
          ) : showApplicationFlow ? (
            /* Application Flow */
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card-lg border border-slate-100 dark:border-slate-700 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                  <FileText size={20} className="text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Verification Required</h2>
                  <p className="text-xs text-slate-500">
                    {(() => {
                      const role = pendingFormData?.role || pendingGoogleUser?.role || '';
                      if (role === 'landlord') return 'Landlord accounts require property ownership verification';
                      if (role === 'agent') return 'Agent accounts require identity verification and admin approval';
                      return 'Property Manager accounts require identity verification and admin approval';
                    })()}
                  </p>
                </div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl mb-6">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  To protect our platform and users, this account type requires document verification. You will not be able to access the dashboard until your documents are reviewed and approved by our admin team.
                </p>
              </div>
              <form onSubmit={handleAppSubmit(onApplicationSubmit)} className="space-y-5">
                {pendingGoogleUser && (
                  <Input
                    label="Phone number *"
                    type="tel"
                    placeholder="+256 700 000 000"
                    value={googleApplicationPhone}
                    onChange={e => setGoogleApplicationPhone(e.target.value)}
                    hint="Required for verification; Google does not share your phone number."
                  />
                )}
                <Input
                  label="National ID Number *"
                  placeholder="e.g. CM90100012345ABCD"
                  error={appErrors.nationalId?.message}
                  {...registerApp('nationalId')}
                />
                <FileUpload
                  label="National ID Document *"
                  accept="image/*,application/pdf,.pdf"
                  multiple={false}
                  maxFiles={1}
                  value={nationalIdFiles}
                  onChange={setNationalIdFiles}
                  hint="Upload a clear photo or scan of your National ID — JPG, PNG, or PDF accepted"
                  showCamera
                />

                {/* Additional supporting documents */}
                <div>
                  <FileUpload
                    label="Additional Documents (optional)"
                    accept="image/*,application/pdf,.pdf,.doc,.docx"
                    multiple
                    maxFiles={5}
                    maxSizeMB={10}
                    value={additionalDocs}
                    onChange={setAdditionalDocs}
                    hint={
                      (pendingFormData?.role === 'landlord' || pendingGoogleUser?.role === 'landlord')
                        ? 'Upload any supporting documents: title deed, agreement of sale, utility bills, or other proof of property ownership (images or PDF)'
                        : 'Upload any supporting documents: professional certificates, reference letters, business registration, or other relevant documents (images or PDF)'
                    }
                    showCamera={false}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      ...(pendingFormData?.role === 'landlord' || pendingGoogleUser?.role === 'landlord'
                        ? ['Title Deed', 'Agreement of Sale', 'Utility Bill', 'Land Certificate']
                        : ['Business Certificate', 'Professional Certificate', 'Reference Letter', 'Work ID']),
                    ].map(doc => (
                      <span key={doc} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                        {doc}
                      </span>
                    ))}
                  </div>
                </div>

                <Textarea
                  label={
                    (pendingFormData?.role === 'landlord' || pendingGoogleUser?.role === 'landlord')
                      ? 'Tell us about your property/properties *'
                      : 'Experience *'
                  }
                  placeholder={
                    (pendingFormData?.role === 'landlord' || pendingGoogleUser?.role === 'landlord')
                      ? 'Describe the property or properties you own (location, type, number of units)...'
                      : 'Describe your experience in real estate, property management, or related fields...'
                  }
                  rows={3}
                  error={appErrors.experience?.message}
                  {...registerApp('experience')}
                />
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {(pendingFormData?.role === 'landlord' || pendingGoogleUser?.role === 'landlord')
                      ? 'District(s) where your property is located *'
                      : 'Districts you operate in *'}
                  </label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {DISTRICTS.map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          const next = appDistricts.includes(d)
                            ? appDistricts.filter(x => x !== d)
                            : [...appDistricts, d];
                          setAppDistricts(next);
                          setAppValue('districts', next, { shouldValidate: true });
                        }}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          appDistricts.includes(d)
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <MapPin size={10} />
                        {d}
                      </button>
                    ))}
                  </div>
                  {appErrors.districts && (
                    <p className="mt-1 text-xs text-red-500">{appErrors.districts.message}</p>
                  )}
                  {appDistricts.length > 0 && (
                    <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                      ✓ {appDistricts.length} district{appDistricts.length > 1 ? 's' : ''} selected: {appDistricts.join(', ')}
                    </p>
                  )}
                </div>
                <Textarea
                  label={
                    (pendingFormData?.role === 'landlord' || pendingGoogleUser?.role === 'landlord')
                      ? 'Why are you joining ITAB? *'
                      : 'Why do you want to join ITAB? *'
                  }
                  placeholder={
                    (pendingFormData?.role === 'landlord' || pendingGoogleUser?.role === 'landlord')
                      ? 'Tell us why you want to list your property on ITAB and what you expect from the platform...'
                      : 'Tell us your motivation and what you hope to achieve on the platform...'
                  }
                  rows={3}
                  error={appErrors.motivation?.message}
                  {...registerApp('motivation')}
                />
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setShowApplicationFlow(false);
                      setPendingFormData(null);
                      setPendingGoogleUser(null);
                      setGoogleApplicationPhone('');
                    }}
                  >
                    Back
                  </Button>
                  <Button type="submit" loading={appLoading} className="flex-1">
                    Submit Application
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <>
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

              {/* Application required notice */}
              {requiresApplication(watchedRole) && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    ⚠️ <strong>Verification required:</strong>{' '}
                    {watchedRole === 'landlord'
                      ? 'Landlord accounts require identity verification and admin approval before you can list properties.'
                      : watchedRole === 'agent'
                        ? 'Agent accounts require identity verification and admin approval before you can access the platform.'
                        : 'Property Manager accounts require identity verification and admin approval before you can access the platform.'}
                  </p>
                </div>
              )}

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
                {requiresApplication(watchedRole) ? 'Continue to Application' : 'Create account'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold">Sign in</Link>
              </p>
            </div>
          </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Google Role Selection Modal */}
      <Modal
        open={showRoleModal}
        onClose={() => { setShowRoleModal(false); setGoogleRole(''); }}
        title="Choose your role"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowRoleModal(false); setGoogleRole(''); }}>
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
                  {requiresApplication(role.value) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      ⚠️ Requires document verification & admin approval
                    </p>
                  )}
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
