import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Search, Calendar, CreditCard, Wrench,
  Users, BarChart3, MessageSquare, Bell, Settings, LogOut, X,
  Home, DollarSign, FileText, Star, Briefcase,
  Megaphone, Scale, Percent, UserCheck, Wallet, Calculator, ClipboardCheck, FolderOpen, Building2, Shield,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { Avatar } from '../ui/Avatar';
import { cn } from '../../lib/utils';
import { canAccessRoute, isAwaitingApproval } from '../../lib/rbac';
import type { UserRole } from '../../types';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  roles: UserRole[];
  badge?: number;
}

const navItems: NavItem[] = [
  // ── Common ──────────────────────────────────────────────────────────
  { to: '/dashboard',     icon: <LayoutDashboard size={18} />, label: 'Dashboard',           roles: ['admin', 'property_manager', 'landlord', 'tenant', 'agent', 'vendor'] },
  { to: '/properties',    icon: <Building2 size={18} />,       label: 'Properties',          roles: ['admin', 'property_manager', 'landlord', 'tenant', 'agent'] },
  { to: '/search',        icon: <Search size={18} />,          label: 'Search',              roles: ['admin', 'property_manager', 'landlord', 'tenant', 'agent'] },
  { to: '/messages',      icon: <MessageSquare size={18} />,   label: 'Messages',            roles: ['admin', 'property_manager', 'landlord', 'tenant', 'agent', 'vendor'] },

  // ── Admin ────────────────────────────────────────────────────────────
  // "Users & KYC" = manage all users, suspend/unsuspend, approve KYC
  { to: '/users',              icon: <Users size={18} />,           label: 'Users & KYC',          roles: ['admin'] },
  { to: '/admin/vetting',      icon: <ClipboardCheck size={18} />,  label: 'Vetting Queue',        roles: ['admin'] },
  { to: '/admin/fees',         icon: <Percent size={18} />,         label: 'Fee Configuration',    roles: ['admin'] },
  { to: '/admin/unassigned',   icon: <UserCheck size={18} />,       label: 'Unassigned Properties',roles: ['admin'] },
  { to: '/admin/disputes',     icon: <Scale size={18} />,           label: 'Disputes',             roles: ['admin'] },
  { to: '/admin/announcements',icon: <Megaphone size={18} />,       label: 'Announcements',        roles: ['admin'] },
  { to: '/admin/agents',       icon: <Briefcase size={18} />,       label: 'Agent Applications',   roles: ['admin'] },
  { to: '/admin/audit',        icon: <Shield size={18} />,          label: 'Audit Logs',           roles: ['admin'] },
  { to: '/vendors',            icon: <Briefcase size={18} />,       label: 'Vendors',              roles: ['admin'] },
  { to: '/analytics',          icon: <BarChart3 size={18} />,       label: 'Analytics',            roles: ['admin'] },

  // ── Property Manager ─────────────────────────────────────────────────
  { to: '/admin/vetting',  icon: <ClipboardCheck size={18} />,  label: 'Vetting Queue',       roles: ['property_manager'] },
  { to: '/inspections',    icon: <Calendar size={18} />,        label: 'Inspections',         roles: ['property_manager'] },
  { to: '/payments',       icon: <CreditCard size={18} />,      label: 'Payments',            roles: ['property_manager'] },
  { to: '/maintenance',    icon: <Wrench size={18} />,          label: 'Maintenance',         roles: ['property_manager'] },
  { to: '/payouts',        icon: <DollarSign size={18} />,      label: 'Payouts',             roles: ['property_manager'] },
  { to: '/leases',         icon: <FileText size={18} />,        label: 'Leases',              roles: ['property_manager'] },
  { to: '/vendors',        icon: <Briefcase size={18} />,       label: 'Vendors',             roles: ['property_manager'] },
  { to: '/analytics',      icon: <BarChart3 size={18} />,       label: 'Analytics',           roles: ['property_manager'] },

  // ── Landlord ─────────────────────────────────────────────────────────
  { to: '/landlord',      icon: <Wallet size={18} />,          label: 'My Income',           roles: ['landlord'] },
  { to: '/payouts',       icon: <DollarSign size={18} />,      label: 'Payouts',             roles: ['landlord'] },
  { to: '/leases',        icon: <FileText size={18} />,        label: 'Leases',              roles: ['landlord'] },

  // ── Tenant ───────────────────────────────────────────────────────────
  { to: '/tenant',        icon: <Home size={18} />,            label: 'My Portal',           roles: ['tenant'] },
  { to: '/inspections',   icon: <Calendar size={18} />,        label: 'Inspections',         roles: ['tenant'] },
  { to: '/payments',      icon: <CreditCard size={18} />,      label: 'Payments',            roles: ['tenant'] },
  { to: '/maintenance',   icon: <Wrench size={18} />,          label: 'Maintenance',         roles: ['tenant'] },
  { to: '/notices',       icon: <Bell size={18} />,            label: 'Notices',             roles: ['tenant'] },
  { to: '/favorites',     icon: <Star size={18} />,            label: 'Favorites',           roles: ['tenant'] },
  { to: '/tools',         icon: <Calculator size={18} />,      label: 'Property Tools',      roles: ['tenant'] },

  // ── Agent ────────────────────────────────────────────────────────────
  { to: '/agent',         icon: <Briefcase size={18} />,       label: 'Agent Portal',        roles: ['agent'] },
  { to: '/inspections',   icon: <Calendar size={18} />,        label: 'Inspections',         roles: ['agent'] },

  // ── Vendor ───────────────────────────────────────────────────────────
  { to: '/vendor',        icon: <Wrench size={18} />,          label: 'My Jobs',             roles: ['vendor'] },
  { to: '/vendor/profile',icon: <Briefcase size={18} />,       label: 'My Profile',          roles: ['vendor'] },
  { to: '/transactions',  icon: <CreditCard size={18} />,      label: 'My Earnings',         roles: ['vendor'] },

  // ── Transactions (all roles) ──────────────────────────────────────────
  { to: '/transactions',  icon: <CreditCard size={18} />,      label: 'Transactions',        roles: ['admin', 'property_manager', 'landlord', 'tenant'] },
  { to: '/contracts',     icon: <FileText size={18} />,        label: 'Vendor Contracts',    roles: ['admin', 'property_manager'] },

  // ── Notices (manager + landlord) ─────────────────────────────────────
  { to: '/notices',       icon: <Bell size={18} />,            label: 'Notices',             roles: ['property_manager', 'landlord'] },

  // ── Documents (all roles) ─────────────────────────────────────────────
  { to: '/documents',     icon: <FolderOpen size={18} />,      label: 'Documents',           roles: ['admin', 'property_manager', 'landlord', 'tenant', 'agent', 'vendor'] },

  // ── Disputes (all roles can raise) ────────────────────────────────────
  { to: '/disputes',      icon: <Scale size={18} />,           label: 'My Disputes',         roles: ['property_manager', 'landlord', 'tenant', 'agent', 'vendor'] },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();

  const PENDING_NAV = new Set(['/dashboard', '/search', '/properties', '/messages', '/documents', '/notifications', '/settings']);

  // Filter nav items: must match role AND pass permission check if one is defined
  const filtered = navItems.filter(item => {
    if (!user) return false;
    if (isAwaitingApproval(user) && !PENDING_NAV.has(item.to)) return false;
    if (!item.roles.includes(user.role)) return false;
    // Additional permission checks for sensitive items
    if (item.to === '/analytics') return canAccessRoute(user, '/analytics');
    if (item.to === '/users') return canAccessRoute(user, '/users');
    if (item.to === '/vendors' || item.to === '/admin/vetting') return canAccessRoute(user, item.to);
    if (item.to === '/admin/fees') return canAccessRoute(user, '/admin/fees');
    if (item.to === '/admin/audit') return canAccessRoute(user, '/admin/audit');
    if (item.to === '/admin/announcements') return canAccessRoute(user, '/admin/announcements');
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="ITAB" className="h-9 w-auto object-contain" />
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight">ITAB</p>
            <p className="text-xs text-slate-400 leading-tight">Property Services</p>
          </div>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <X size={18} className="text-slate-500" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {filtered.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge ? (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{item.badge}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-3 space-y-0.5">
        <NavLink to="/notifications" onClick={() => setSidebarOpen(false)}
          className={({ isActive }) => cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
            isActive ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                     : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}>
          <Bell size={18} /><span>Notifications</span>
        </NavLink>
        <NavLink to="/settings" onClick={() => setSidebarOpen(false)}
          className={({ isActive }) => cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
            isActive ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                     : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}>
          <Settings size={18} /><span>Settings</span>
        </NavLink>

        {/* User */}
        <div className="flex items-center gap-3 px-3 py-2.5 mt-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <Avatar name={user ? `${user.firstName} ${user.lastName}` : 'User'} src={user?.avatar} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-slate-400 capitalize truncate">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 z-50 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
