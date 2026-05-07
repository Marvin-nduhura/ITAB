import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Mail, ArrowLeft, CheckCircle2, KeyRound, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { mockUsers } from '../../lib/mockData';

type Step = 'email' | 'otp' | 'reset' | 'done';

export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    const userExists = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);

    if (!userExists) {
      // Don't reveal whether email exists — security best practice
      toast.success('If that email is registered, you will receive a reset code shortly.');
      setStep('otp');
      return;
    }

    // In production: send real OTP via SMS/email
    // For demo: show OTP in toast
    toast.success(`OTP sent! (Demo code: ${generatedOtp})`, { duration: 10000 });
    setStep('otp');
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);

    if (otp !== generatedOtp) {
      toast.error('Invalid code. Please check and try again.');
      return;
    }
    setStep('reset');
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    setStep('done');
    toast.success('Password reset successfully!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl shadow-glow mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">ITAB Property Services</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Uganda's premier property platform</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card-lg border border-slate-100 dark:border-slate-700 p-8">
            <AnimatePresence mode="wait">
              {/* ── Step 1: Enter email ── */}
              {step === 'email' && (
                <motion.div key="email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Forgot your password?</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Enter your email address and we'll send you a reset code.
                    </p>
                  </div>

                  <Input
                    label="Email address"
                    type="email"
                    placeholder="you@example.com"
                    icon={<Mail size={16} />}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                  />

                  <Button className="w-full" size="lg" loading={loading} onClick={handleSendOtp}>
                    Send Reset Code
                  </Button>

                  <div className="text-center">
                    <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-600 transition-colors">
                      <ArrowLeft size={14} /> Back to sign in
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Enter OTP ── */}
              {step === 'otp' && (
                <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Enter reset code</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      We sent a 6-digit code to <span className="font-semibold text-slate-700 dark:text-slate-300">{email}</span>
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      📱 In production, the code is sent via SMS and email. For this demo, check the toast notification for the code.
                    </p>
                  </div>

                  <Input
                    label="6-digit code"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                    className="text-center text-2xl tracking-widest font-mono"
                  />

                  <Button className="w-full" size="lg" loading={loading} onClick={handleVerifyOtp}>
                    Verify Code
                  </Button>

                  <div className="flex items-center justify-between text-sm">
                    <button onClick={() => setStep('email')} className="text-slate-500 hover:text-primary-600 flex items-center gap-1.5 transition-colors">
                      <ArrowLeft size={14} /> Change email
                    </button>
                    <button
                      onClick={() => {
                        toast.success(`New code sent! (Demo: ${generatedOtp})`, { duration: 10000 });
                      }}
                      className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
                    >
                      Resend code
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 3: New password ── */}
              {step === 'reset' && (
                <motion.div key="reset" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Set new password</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Choose a strong password for your account.
                    </p>
                  </div>

                  <Input
                    label="New password"
                    type={showNew ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    icon={<KeyRound size={16} />}
                    iconRight={
                      <button type="button" onClick={() => setShowNew(!showNew)} className="hover:text-slate-600">
                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />

                  <Input
                    label="Confirm new password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repeat your password"
                    iconRight={
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="hover:text-slate-600">
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    error={confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : undefined}
                  />

                  {/* Password strength */}
                  {newPassword && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1">
                        {[
                          newPassword.length >= 8,
                          /[A-Z]/.test(newPassword),
                          /[0-9]/.test(newPassword),
                          /[^A-Za-z0-9]/.test(newPassword),
                        ].map((met, i) => (
                          <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${met ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-600'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-slate-400">
                        {[
                          newPassword.length >= 8,
                          /[A-Z]/.test(newPassword),
                          /[0-9]/.test(newPassword),
                          /[^A-Za-z0-9]/.test(newPassword),
                        ].filter(Boolean).length < 2 ? 'Weak' :
                        [
                          newPassword.length >= 8,
                          /[A-Z]/.test(newPassword),
                          /[0-9]/.test(newPassword),
                          /[^A-Za-z0-9]/.test(newPassword),
                        ].filter(Boolean).length < 4 ? 'Good' : 'Strong'} password
                      </p>
                    </div>
                  )}

                  <Button className="w-full" size="lg" loading={loading} onClick={handleResetPassword}>
                    Reset Password
                  </Button>
                </motion.div>
              )}

              {/* ── Step 4: Done ── */}
              {step === 'done' && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5 py-4">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} className="text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Password reset!</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Your password has been updated successfully. You can now sign in with your new password.
                    </p>
                  </div>
                  <Link to="/login">
                    <Button className="w-full" size="lg">
                      Sign in now
                    </Button>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
