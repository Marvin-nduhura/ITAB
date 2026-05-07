import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Shield, Moon, Sun, Monitor, Save, Download, CreditCard } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../store/authStore';
import { useUIStore, applyTheme } from '../store/uiStore';
import { InstallButton } from '../components/pwa/InstallPrompt';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { FileUpload, type UploadedFile } from '../components/ui/FileUpload';
import { PaymentPreferences } from '../components/payment/PaymentPreferences';
import toast from 'react-hot-toast';

export function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const { theme, setTheme } = useUIStore();
  const { isInstalled, canInstall, platform } = usePWAInstall();
  const [tab, setTab] = useState<'profile' | 'notifications' | 'security' | 'appearance' | 'payments' | 'install'>('profile');
  const [loading, setLoading] = useState(false);
  const [avatarFiles, setAvatarFiles] = useState<UploadedFile[]>([]);
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const handleSave = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    updateUser(form);
    setLoading(false);
    toast.success('Profile updated!');
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    { id: 'security', label: 'Security', icon: <Shield size={16} /> },
    { id: 'appearance', label: 'Appearance', icon: <Sun size={16} /> },
    { id: 'payments', label: 'Payment Method', icon: <CreditCard size={16} /> },
    { id: 'install', label: 'Install App', icon: <Download size={16} /> },
  ] as const;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account preferences</p>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.id ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {tab === 'profile' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-6 space-y-5">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Profile Information</h2>
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center text-primary-600 text-2xl font-bold overflow-hidden">
                {avatarFiles[0]
                  ? <img src={avatarFiles[0].dataUrl} alt="Avatar" className="w-full h-full object-cover" />
                  : <>{user?.firstName?.[0]}{user?.lastName?.[0]}</>}
              </div>
              <div className="flex-1">
                <FileUpload
                  accept="image/*"
                  multiple={false}
                  maxFiles={1}
                  maxSizeMB={5}
                  value={avatarFiles}
                  onChange={files => { setAvatarFiles(files); if (files[0]) updateUser({ avatar: files[0].dataUrl }); }}
                  showCamera
                  showPreview={false}
                  compact
                  hint="JPG, PNG up to 5MB · Take a selfie or upload from gallery"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              <Input label="Last Name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
            <Input label="Email Address" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Phone Number" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
              <div className={`w-2.5 h-2.5 rounded-full ${user?.kycStatus === 'approved' ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">KYC Status: <span className="capitalize">{user?.kycStatus}</span></p>
                <p className="text-xs text-slate-400">Identity verification status</p>
              </div>
            </div>
            <Button loading={loading} onClick={handleSave} icon={<Save size={15} />}>Save Changes</Button>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-6 space-y-4">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Notification Preferences</h2>
            {[
              { label: 'Rent reminders', desc: 'Get notified before rent is due', defaultOn: true },
              { label: 'Inspection updates', desc: 'Confirmation and reminders for inspections', defaultOn: true },
              { label: 'Maintenance updates', desc: 'Status changes on your maintenance requests', defaultOn: true },
              { label: 'Payment receipts', desc: 'Receive receipts after each payment', defaultOn: true },
              { label: 'New property alerts', desc: 'Notify when matching properties are listed', defaultOn: false },
              { label: 'Marketing emails', desc: 'Tips, guides, and platform updates', defaultOn: false },
            ].map(n => (
              <div key={n.label} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{n.label}</p>
                  <p className="text-xs text-slate-400">{n.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked={n.defaultOn} className="sr-only peer" onChange={() => toast.success('Preference saved')} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
                </label>
              </div>
            ))}
          </div>
        )}

        {tab === 'security' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-6 space-y-5">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Security</h2>
            <div className="space-y-4">
              <Input label="Current Password" type="password" placeholder="••••••••" />
              <Input label="New Password" type="password" placeholder="Min. 8 characters" />
              <Input label="Confirm New Password" type="password" placeholder="Repeat new password" />
              <Button onClick={() => toast.success('Password updated!')}>Update Password</Button>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Two-Factor Authentication</h3>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">SMS Authentication</p>
                  <p className="text-xs text-slate-400">Receive a code via SMS when signing in</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => toast.success('2FA enabled!')}>Enable</Button>
              </div>
            </div>
          </div>
        )}

        {tab === 'appearance' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-6 space-y-5">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Appearance</h2>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Theme</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light', label: 'Light', icon: <Sun size={20} />, desc: 'Clean and bright' },
                  { value: 'dark', label: 'Dark', icon: <Moon size={20} />, desc: 'Easy on the eyes' },
                  { value: 'system', label: 'System', icon: <Monitor size={20} />, desc: 'Follows your device' },
                ].map(t => (
                  <button key={t.value} onClick={() => { setTheme(t.value as 'light' | 'dark' | 'system'); applyTheme(t.value as 'light' | 'dark' | 'system'); toast.success(`${t.label} theme applied`); }}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${theme === t.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}>
                    <div className={`mx-auto mb-2 ${theme === t.value ? 'text-primary-600' : 'text-slate-400'}`}>{t.icon}</div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'payments' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-6">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Payment Method</h2>
            <p className="text-sm text-slate-500 mb-5">Set how you want to receive payments from ITAB. This applies to rent payouts, vendor payments, and any money sent to you.</p>
            <PaymentPreferences
              userId={user?.id || ''}
              userType={user?.role === 'vendor' ? 'vendor' : 'user'}
              label="How do you want to receive money?"
            />
          </div>
        )}

        {tab === 'install' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-6 space-y-6">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Install App</h2>

            {/* Status */}
            <div className={`flex items-center gap-3 p-4 rounded-2xl border ${isInstalled ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800'}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isInstalled ? 'bg-green-100 dark:bg-green-900/40' : 'bg-primary-100 dark:bg-primary-900/40'}`}>
                {isInstalled ? <span className="text-2xl">✅</span> : <Download size={22} className="text-primary-600" />}
              </div>
              <div>
                <p className={`font-semibold text-sm ${isInstalled ? 'text-green-800 dark:text-green-300' : 'text-primary-800 dark:text-primary-300'}`}>
                  {isInstalled ? 'App is installed!' : 'Install ITAB on your device'}
                </p>
                <p className={`text-xs mt-0.5 ${isInstalled ? 'text-green-600 dark:text-green-400' : 'text-primary-600 dark:text-primary-400'}`}>
                  {isInstalled
                    ? 'You\'re running ITAB as an installed app'
                    : `Available for ${platform === 'ios' ? 'iPhone/iPad' : platform === 'android' ? 'Android' : 'Windows, macOS & Linux'}`}
                </p>
              </div>
              {!isInstalled && canInstall && <InstallButton className="ml-auto" />}
            </div>

            {/* Benefits */}
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Why install?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: '⚡', title: 'Instant launch', desc: 'Opens in under 1 second, no browser needed' },
                  { icon: '📴', title: 'Works offline', desc: 'Browse properties even without internet' },
                  { icon: '🔔', title: 'Push notifications', desc: 'Get rent reminders and inspection alerts' },
                  { icon: '📱', title: 'Native experience', desc: 'Full screen, no browser bars' },
                  { icon: '🔒', title: 'Secure', desc: 'HTTPS encrypted, no app store required' },
                  { icon: '💾', title: 'Lightweight', desc: 'Under 5MB, no Play Store or App Store' },
                ].map(b => (
                  <div key={b.title} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                    <span className="text-xl flex-shrink-0">{b.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{b.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform-specific instructions */}
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Installation guide</p>
              <div className="space-y-3">
                {[
                  {
                    platform: '🤖 Android (Chrome)',
                    steps: ['Open ITAB in Chrome', 'Tap the ⋮ menu (top right)', 'Tap "Add to Home screen" or "Install app"', 'Tap "Install" to confirm'],
                  },
                  {
                    platform: '🍎 iPhone / iPad (Safari)',
                    steps: ['Open ITAB in Safari', 'Tap the Share button (□↑)', 'Scroll down and tap "Add to Home Screen"', 'Tap "Add" in the top right'],
                  },
                  {
                    platform: '🖥️ Windows / macOS / Linux (Chrome or Edge)',
                    steps: ['Open ITAB in Chrome or Edge', 'Click the install icon (⊕) in the address bar', 'Or go to ⋮ menu → "Install ITAB"', 'Click "Install" to confirm'],
                  },
                ].map(g => (
                  <details key={g.platform} className="group rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                    <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors list-none">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{g.platform}</span>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <div className="px-4 pb-4 pt-1">
                      <ol className="space-y-1.5">
                        {g.steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                            <span className="w-5 h-5 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
