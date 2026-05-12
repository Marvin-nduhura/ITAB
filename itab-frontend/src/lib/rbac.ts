/**
 * Role-Based Access Control utilities.
 * Every data filter and permission check goes through here.
 * Individual user permissions (set by admin) override role defaults.
 */
import type { User, UserRole, Property, Payment, MaintenanceRequest, Inspection, Payout } from '../types';
import type { FullUserPermissions } from '../types/permissions';
import { resolvePermissions } from './defaultPermissions';

// ─── Role constants ───────────────────────────────────────────────────────────
export const ROLES = {
  ADMIN:   'admin'            as UserRole,
  MANAGER: 'property_manager' as UserRole,
  LANDLORD:'landlord'         as UserRole,
  TENANT:  'tenant'           as UserRole,
  AGENT:   'agent'            as UserRole,
  VENDOR:  'vendor'           as UserRole,
};

export function is(user: User | null, ...roles: UserRole[]): boolean {
  return !!user && roles.includes(user.role);
}

export function isAdmin(user: User | null)   { return is(user, ROLES.ADMIN); }
export function isManager(user: User | null) { return is(user, ROLES.MANAGER); }
export function isLandlord(user: User | null){ return is(user, ROLES.LANDLORD); }
export function isTenant(user: User | null)  { return is(user, ROLES.TENANT); }
export function isAgent(user: User | null)   { return is(user, ROLES.AGENT); }
export function isVendor(user: User | null)  { return is(user, ROLES.VENDOR); }

// ─── Effective permissions ────────────────────────────────────────────────────
/** Merge role defaults with any individual overrides the admin has set. */
export function getPermissions(user: User | null): FullUserPermissions {
  if (!user) return resolvePermissions('guest');
  return resolvePermissions(user.role, user.permissions);
}

/** Check a single permission. Usage: perm(user, 'properties', 'addProperty') */
export function perm(
  user: User | null,
  section: keyof FullUserPermissions,
  key: string
): boolean {
  if (!user) return false;
  const perms = getPermissions(user);
  const s = perms[section] as unknown as Record<string, boolean> | undefined;
  return s?.[key] ?? false;
}

// ─── Data filters ─────────────────────────────────────────────────────────────
export function filterPropertiesForUser(properties: Property[], user: User | null): Property[] {
  if (!user) return properties.filter(p => p.status === 'published');
  switch (user.role) {
    case 'admin':            return properties;
    case 'property_manager': return properties.filter(p => p.managerId === user.id || !p.managerId);
    case 'landlord':         return properties.filter(p => p.landlordId === user.id);
    case 'tenant':           return properties.filter(p => p.status === 'published' || p.tenantId === user.id);
    case 'agent':            return properties.filter(p => p.managerId === user.id || p.status === 'published' || (!p.managerId && p.id.startsWith('p_')));
    case 'vendor':           return properties.filter(p => p.status === 'published');
    default:                 return properties.filter(p => p.status === 'published');
  }
}

export function filterPaymentsForUser(payments: Payment[], user: User | null): Payment[] {
  if (!user) return [];
  switch (user.role) {
    case 'admin':            return payments;
    case 'property_manager': return payments.filter(p => p.propertyId && true);
    case 'landlord':         return payments.filter(p => p.landlordId === user.id);
    case 'tenant':           return payments.filter(p => p.tenantId === user.id);
    default:                 return [];
  }
}

export function filterMaintenanceForUser(requests: MaintenanceRequest[], user: User | null): MaintenanceRequest[] {
  if (!user) return [];
  switch (user.role) {
    case 'admin':            return requests;
    case 'property_manager': return requests;
    case 'landlord':         return requests;
    case 'tenant':           return requests.filter(r => r.tenantId === user.id);
    case 'vendor':           return requests.filter(r => r.vendorId === user.id);
    default:                 return [];
  }
}

export function filterInspectionsForUser(inspections: Inspection[], user: User | null): Inspection[] {
  if (!user) return [];
  switch (user.role) {
    case 'admin':            return inspections;
    case 'property_manager': return inspections.filter(i => i.managerId === user.id);
    case 'tenant':           return inspections.filter(i => i.tenantId === user.id);
    case 'agent':            return inspections.filter(i => i.managerId === user.id);
    default:                 return [];
  }
}

export function filterPayoutsForUser(payouts: Payout[], user: User | null): Payout[] {
  if (!user) return [];
  switch (user.role) {
    case 'admin':            return payouts;
    case 'property_manager': return payouts;
    case 'landlord':         return payouts.filter(p => p.landlordId === user.id);
    default:                 return [];
  }
}

// ─── canDo helpers — backed by full permission system ─────────────────────────
export const canDo = {
  // Properties
  addProperty:     (u: User | null) => perm(u, 'properties', 'addProperty'),
  editProperty:    (u: User | null, p?: Property) => {
    if (!u || !perm(u, 'properties', 'editProperty')) return false;
    if (!p || is(u, 'admin')) return true;
    if (is(u, 'property_manager')) return p.managerId === u.id || !p.managerId;
    if (is(u, 'landlord'))         return p.landlordId === u.id;
    if (is(u, 'agent'))            return p.managerId === u.id || (!p.managerId && p.id.startsWith('p_'));
    return false;
  },
  deleteProperty:  (u: User | null, p?: Property) => canDo.editProperty(u, p),
  publishProperty: (u: User | null) => perm(u, 'properties', 'publishProperty'),
  vetProperty:     (u: User | null) => perm(u, 'admin', 'approveProperty') || perm(u, 'admin', 'rejectProperty'),
  featureProperty: (u: User | null) => perm(u, 'properties', 'featureProperty'),

  // Users
  manageUsers:     (u: User | null) => perm(u, 'userManagement', 'viewUsers'),
  suspendUser:     (u: User | null) => perm(u, 'userManagement', 'suspendUser'),
  banUser:         (u: User | null) => perm(u, 'userManagement', 'banUser'),
  inviteUser:      (u: User | null) => perm(u, 'userManagement', 'inviteUser'),

  // Payments
  viewAllPayments: (u: User | null) => perm(u, 'payments', 'viewAllPayments'),
  payRent:         (u: User | null) => perm(u, 'payments', 'payRentFull') || perm(u, 'payments', 'payRentPartial'),
  downloadReceipt: (u: User | null) => perm(u, 'payments', 'downloadReceipt'),

  // Payouts
  processPayouts:  (u: User | null) => perm(u, 'payouts', 'processPayout'),
  viewAllPayouts:  (u: User | null) => perm(u, 'payouts', 'viewAllPayouts'),

  // Maintenance
  submitMaintenance:  (u: User | null) => perm(u, 'maintenance', 'submitMaintenanceRequest'),
  manageMaintenance:  (u: User | null) => perm(u, 'maintenance', 'assignVendorToJob') || perm(u, 'maintenance', 'markMaintenanceCompleted'),
  assignVendors:      (u: User | null) => perm(u, 'maintenance', 'assignVendorToJob'),
  viewAllMaintenance: (u: User | null) => perm(u, 'maintenance', 'viewAllMaintenance'),

  // Vendors
  manageVendors:   (u: User | null) => perm(u, 'vendors', 'addVendor') || perm(u, 'vendors', 'editVendor'),
  viewVendors:     (u: User | null) => perm(u, 'vendors', 'viewVendors'),

  // Contracts
  createContracts: (u: User | null) => perm(u, 'contracts', 'createContract'),

  // Analytics
  viewAnalytics:       (u: User | null) => perm(u, 'analytics', 'viewBasicAnalytics'),
  viewPlatformRevenue: (u: User | null) => perm(u, 'analytics', 'viewPlatformRevenue'),

  // Notices
  sendNotices:     (u: User | null) => perm(u, 'notices', 'sendNotice'),

  // Inspections
  bookInspection:    (u: User | null) => perm(u, 'inspections', 'bookInspection'),
  confirmInspection: (u: User | null) => perm(u, 'inspections', 'confirmInspection'),
  cancelInspection:  (u: User | null) => perm(u, 'inspections', 'cancelInspection'),

  // Transactions
  retryTransaction:    (u: User | null) => perm(u, 'transactions', 'retryFailedTransaction'),
  refundTransaction:   (u: User | null) => perm(u, 'transactions', 'refundTransaction'),
  viewAllTransactions: (u: User | null) => perm(u, 'transactions', 'viewAllTransactions'),

  // Disputes
  raiseDispute:   (u: User | null) => perm(u, 'disputes', 'raiseDispute'),
  resolveDispute: (u: User | null) => perm(u, 'disputes', 'resolveDispute'),

  // Admin
  configureFees:    (u: User | null) => perm(u, 'admin', 'configureFees'),
  sendAnnouncement: (u: User | null) => perm(u, 'admin', 'sendAnnouncement'),
  viewAuditLogs:    (u: User | null) => perm(u, 'admin', 'viewAuditLogs'),
  viewVettingQueue: (u: User | null) => perm(u, 'admin', 'viewVettingQueue'),
  viewUnassigned:   (u: User | null) => perm(u, 'admin', 'viewUnassignedProperties'),

  // Documents
  uploadDocument:   (u: User | null) => perm(u, 'documents', 'uploadDocument'),
  downloadDocument: (u: User | null) => perm(u, 'documents', 'downloadDocument'),

  // Messages
  sendMessage: (u: User | null) => perm(u, 'messages', 'sendMessage'),

  // Settings
  editProfile: (u: User | null) => perm(u, 'settings', 'editProfile'),

  // Vendor jobs
  viewOwnJobs: (u: User | null) => is(u, 'vendor'),
};

// ─── Route roles ──────────────────────────────────────────────────────────────
export const routeRoles: Record<string, UserRole[]> = {
  '/dashboard':           ['admin', 'property_manager', 'landlord', 'tenant', 'agent', 'vendor'],
  '/properties':          ['admin', 'property_manager', 'landlord', 'tenant', 'agent'],
  '/search':              ['admin', 'property_manager', 'landlord', 'tenant', 'agent', 'vendor'],
  '/inspections':         ['admin', 'property_manager', 'tenant', 'agent'],
  '/payments':            ['admin', 'property_manager', 'landlord', 'tenant'],
  '/maintenance':         ['admin', 'property_manager', 'landlord', 'tenant', 'vendor'],
  '/payouts':             ['admin', 'property_manager', 'landlord'],
  '/messages':            ['admin', 'property_manager', 'landlord', 'tenant', 'agent', 'vendor'],
  '/analytics':           ['admin', 'property_manager'],
  '/users':               ['admin'],
  '/vendors':             ['admin', 'property_manager'],
  '/contracts':           ['admin', 'property_manager'],
  '/transactions':        ['admin', 'property_manager', 'landlord', 'tenant', 'vendor'],
  '/notices':             ['admin', 'property_manager', 'landlord', 'tenant'],
  '/documents':           ['admin', 'property_manager', 'landlord', 'tenant', 'agent', 'vendor'],
  '/admin/fees':          ['admin'],
  '/admin/disputes':      ['admin'],
  '/admin/announcements': ['admin'],
  '/admin/unassigned':    ['admin'],
  '/admin/vetting':       ['admin', 'property_manager'],
  '/admin/audit':         ['admin'],
  '/admin/agents':        ['admin'],
  '/disputes':            ['admin', 'property_manager', 'landlord', 'tenant', 'agent', 'vendor'],
  '/landlord':            ['landlord'],
  '/tenant':              ['tenant'],
  '/agent':               ['agent'],
  '/vendor':              ['vendor'],
  '/vendor/profile':      ['vendor'],
  '/tools':               ['admin', 'property_manager', 'landlord', 'tenant', 'agent', 'vendor'],
  '/settings':            ['admin', 'property_manager', 'landlord', 'tenant', 'agent', 'vendor'],
  '/notifications':       ['admin', 'property_manager', 'landlord', 'tenant', 'agent', 'vendor'],
};

/**
 * Check if a user can access a route — checks both role AND individual permissions.
 * Admin can grant a user access to routes their role normally can't reach,
 * or revoke access to routes their role normally can.
 */
export function canAccessRoute(user: User | null, path: string): boolean {
  if (!user) return false;
  const allowed = routeRoles[path];
  if (!allowed) return true;
  if (!allowed.includes(user.role)) return false;

  const permMap: Record<string, () => boolean> = {
    '/analytics':           () => canDo.viewAnalytics(user),
    '/users':               () => canDo.manageUsers(user),
    '/vendors':             () => canDo.viewVendors(user),
    '/contracts':           () => canDo.createContracts(user),
    '/admin/fees':          () => canDo.configureFees(user),
    '/admin/announcements': () => canDo.sendAnnouncement(user),
    '/admin/audit':         () => canDo.viewAuditLogs(user),
    '/admin/vetting':       () => canDo.viewVettingQueue(user),
    '/admin/unassigned':    () => canDo.viewUnassigned(user),
  };

  const check = permMap[path];
  return check ? check() : true;
}
