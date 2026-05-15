/**
 * Role-Based Access Control utilities.
 * Every data filter and permission check goes through here.
 * Individual user permissions (set by admin) override role defaults.
 */
import type { User, UserRole, Property, Payment, MaintenanceRequest, Inspection, Payout } from '../types';
import type { FullUserPermissions } from '../types/permissions';
import { resolvePermissions, getPendingVerificationPermissions, parseStoredPermissions } from './defaultPermissions';

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

const VETTING_ROLES: UserRole[] = ['landlord', 'agent', 'property_manager'];

/**
 * True when the user must not use the platform as their full role yet.
 * - Landlord / agent / property_manager: restricted until approval_status is exactly `approved`
 *   (covers pending, rejected, or missing status from older rows).
 * - Any other role: restricted only if explicitly `pending`.
 * Admin is never restricted.
 */
export function isAwaitingApproval(user: User | null): boolean {
  if (!user || user.role === 'admin') return false;
  const s = user.approvalStatus;
  if (VETTING_ROLES.includes(user.role)) {
    return s !== 'approved';
  }
  return s === 'pending';
}

// ─── Effective permissions ────────────────────────────────────────────────────
/** Merge role defaults with any individual overrides the admin has set. */
export function getPermissions(user: User | null): FullUserPermissions {
  if (!user) return resolvePermissions('guest');
  if (isAwaitingApproval(user)) return getPendingVerificationPermissions();
  return resolvePermissions(user.role, parseStoredPermissions(user.permissions));
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
/**
 * When `user.restrictedDistricts` is non-empty (set by admin), the user may only
 * see rows whose property `district` matches one entry (case-insensitive, trimmed).
 */
export function userMaySeeDistrict(user: User | null, district: string | undefined | null): boolean {
  const list = user?.restrictedDistricts;
  if (!list?.length) return true;
  const d = (district ?? '').trim().toLowerCase();
  if (!d) return false;
  return list.some(a => String(a ?? '').trim().toLowerCase() === d);
}

/** Filter items with `propertyId` using districts from the full property list (typically the global store). */
export function filterLinkedEntitiesByDistrict<T extends { propertyId?: string }>(
  items: T[],
  user: User | null,
  allProperties: Property[]
): T[] {
  if (!user?.restrictedDistricts?.length || !allProperties.length) return items;
  const byId = new Map(allProperties.map(p => [p.id, p]));
  return items.filter(item => {
    if (!item.propertyId) return false;
    return userMaySeeDistrict(user, byId.get(item.propertyId)?.district);
  });
}

/**
 * Property visibility rules:
 * - draft / pending_vetting / rejected → ONLY visible to the creator (createdById) and admin.
 * - published / rented / under_maintenance → visible per role rules below.
 * - Admin-assigned district restrictions apply after role rules (all signed-in roles).
 */
export function filterPropertiesForUser(properties: Property[], user: User | null): Property[] {
  if (!user) {
    return properties.filter(p => p.status === 'published');
  }

  let visible: Property[];
  if (isAwaitingApproval(user)) {
    visible = properties.filter(p =>
      p.status === 'published' || p.status === 'rented' || p.status === 'under_maintenance'
    );
  } else if (user.role === 'admin') {
    visible = properties;
  } else {
    visible = properties.filter(p => {
      const isPublicStatus = p.status === 'published' || p.status === 'rented' || p.status === 'under_maintenance';
      const isCreator =
        p.createdById === user.id ||
        p.landlordId === user.id ||
        (p.managerId === user.id && (user.role === 'agent' || user.role === 'property_manager'));

      if (!isPublicStatus) {
        return isCreator;
      }

      switch (user.role) {
        case 'property_manager':
          return isPublicStatus || p.managerId === user.id;
        case 'landlord':
          return p.landlordId === user.id || isPublicStatus;
        case 'tenant':
          return p.status === 'published' || p.tenantId === user.id;
        case 'agent':
          return p.managerId === user.id || p.status === 'published';
        case 'vendor':
          return p.status === 'published';
        default:
          return p.status === 'published';
      }
    });
  }

  return visible.filter(p => userMaySeeDistrict(user, p.district));
}

export function filterPaymentsForUser(
  payments: Payment[],
  user: User | null,
  allProperties?: Property[]
): Payment[] {
  if (!user) return [];
  if (isAwaitingApproval(user)) return [];
  let rows: Payment[];
  switch (user.role) {
    case 'admin':            rows = payments; break;
    case 'property_manager': rows = payments.filter(p => !!p.propertyId); break;
    case 'landlord':         rows = payments.filter(p => p.landlordId === user.id); break;
    case 'tenant':           rows = payments.filter(p => p.tenantId === user.id); break;
    default:                 rows = [];
  }
  return allProperties?.length ? filterLinkedEntitiesByDistrict(rows, user, allProperties) : rows;
}

export function filterMaintenanceForUser(
  requests: MaintenanceRequest[],
  user: User | null,
  allProperties?: Property[]
): MaintenanceRequest[] {
  if (!user) return [];
  if (isAwaitingApproval(user)) return [];
  let rows: MaintenanceRequest[];
  switch (user.role) {
    case 'admin':            rows = requests; break;
    case 'property_manager': rows = requests; break;
    case 'landlord':         rows = requests; break;
    case 'tenant':           rows = requests.filter(r => r.tenantId === user.id); break;
    case 'vendor':           rows = requests.filter(r => r.vendorId === user.id); break;
    default:                 rows = [];
  }
  return allProperties?.length ? filterLinkedEntitiesByDistrict(rows, user, allProperties) : rows;
}

export function filterInspectionsForUser(
  inspections: Inspection[],
  user: User | null,
  allProperties?: Property[]
): Inspection[] {
  if (!user) return [];
  if (isAwaitingApproval(user)) return [];
  let rows: Inspection[];
  switch (user.role) {
    case 'admin':            rows = inspections; break;
    case 'property_manager': rows = inspections.filter(i => i.managerId === user.id); break;
    case 'tenant':           rows = inspections.filter(i => i.tenantId === user.id); break;
    case 'agent':            rows = inspections.filter(i => i.managerId === user.id); break;
    default:                 rows = [];
  }
  return allProperties?.length ? filterLinkedEntitiesByDistrict(rows, user, allProperties) : rows;
}

export function filterPayoutsForUser(
  payouts: Payout[],
  user: User | null,
  allProperties?: Property[]
): Payout[] {
  if (!user) return [];
  if (isAwaitingApproval(user)) return [];
  let rows: Payout[];
  switch (user.role) {
    case 'admin':            rows = payouts; break;
    case 'property_manager': rows = payouts; break;
    case 'landlord':         rows = payouts.filter(p => p.landlordId === user.id); break;
    default:                 rows = [];
  }
  return allProperties?.length ? filterLinkedEntitiesByDistrict(rows, user, allProperties) : rows;
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
    if (is(u, 'agent'))            return p.createdById === u.id || p.managerId === u.id || (!p.managerId && p.id.startsWith('p_'));
    return false;
  },
  deleteProperty:  (u: User | null, p?: Property) => canDo.editProperty(u, p),
  publishProperty: (u: User | null) => perm(u, 'properties', 'publishProperty'),
  vetProperty:     (u: User | null) => perm(u, 'admin', 'approveProperty') || perm(u, 'admin', 'rejectProperty'),
  featureProperty: (u: User | null) => perm(u, 'properties', 'featureProperty'),
  assignPropertyManager: (u: User | null) => perm(u, 'properties', 'assignPropertyToManager'),

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
  '/admin/property-conflicts': ['admin'],
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

/** Pathnames allowed while account is pending admin approval (matches canAccessRoute keys + subpaths). */
export function canAccessPathnameWhilePending(pathname: string): boolean {
  return [
    /^\/dashboard$/,
    /^\/search$/,
    /^\/properties(\/.*)?$/,
    /^\/messages$/,
    /^\/documents$/,
    /^\/notifications$/,
    /^\/settings(\/.*)?$/,
  ].some(re => re.test(pathname));
}

/**
 * Check if a user can access a route — checks both role AND individual permissions.
 * Admin can grant a user access to routes their role normally can't reach,
 * or revoke access to routes their role normally can.
 */
export function canAccessRoute(user: User | null, path: string): boolean {
  if (!user) return false;

  if (isAwaitingApproval(user)) {
    const pendingRoutes = new Set([
      '/dashboard',
      '/search',
      '/properties',
      '/messages',
      '/documents',
      '/notifications',
      '/settings',
    ]);
    return pendingRoutes.has(path);
  }

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
