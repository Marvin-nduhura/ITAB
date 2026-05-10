/**
 * Role-Based Access Control utilities.
 * Every data filter and permission check goes through here.
 */
import type { User, UserRole, Property, Payment, MaintenanceRequest, Inspection, Payout } from '../types';

// ─── Role permission sets ─────────────────────────────────────────────────────
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

// ─── Property filters ─────────────────────────────────────────────────────────
export function filterPropertiesForUser(properties: Property[], user: User | null): Property[] {
  if (!user) return properties.filter(p => p.status === 'published');
  switch (user.role) {
    case 'admin':
      return properties; // admin sees all
    case 'property_manager':
      return properties.filter(p => p.managerId === user.id || !p.managerId);
    case 'landlord':
      return properties.filter(p => p.landlordId === user.id);
    case 'tenant':
      // Tenants see published + their own rented property
      return properties.filter(p => p.status === 'published' || p.tenantId === user.id);
    case 'agent':
      // Agents see their own listings + published
      return properties.filter(p => p.managerId === user.id || p.status === 'published' || (!p.managerId && p.id.startsWith('p_')));
    case 'vendor':
      return properties.filter(p => p.status === 'published');
    default:
      return properties.filter(p => p.status === 'published');
  }
}

// ─── Payment filters ──────────────────────────────────────────────────────────
export function filterPaymentsForUser(payments: Payment[], user: User | null): Payment[] {
  if (!user) return [];
  switch (user.role) {
    case 'admin':
      return payments;
    case 'property_manager':
      // Manager sees payments for their managed properties
      return payments.filter(p => p.propertyId && true); // in real app: filter by managerId
    case 'landlord':
      return payments.filter(p => p.landlordId === user.id);
    case 'tenant':
      return payments.filter(p => p.tenantId === user.id);
    default:
      return [];
  }
}

// ─── Maintenance filters ──────────────────────────────────────────────────────
export function filterMaintenanceForUser(requests: MaintenanceRequest[], user: User | null): MaintenanceRequest[] {
  if (!user) return [];
  switch (user.role) {
    case 'admin':
      return requests;
    case 'property_manager':
      return requests; // manager sees all for their properties
    case 'landlord':
      return requests; // landlord sees all maintenance on their properties
    case 'tenant':
      return requests.filter(r => r.tenantId === user.id);
    case 'vendor':
      return requests.filter(r => r.vendorId === user.id);
    default:
      return [];
  }
}

// ─── Inspection filters ───────────────────────────────────────────────────────
export function filterInspectionsForUser(inspections: Inspection[], user: User | null): Inspection[] {
  if (!user) return [];
  switch (user.role) {
    case 'admin':
      return inspections;
    case 'property_manager':
      return inspections.filter(i => i.managerId === user.id);
    case 'tenant':
      return inspections.filter(i => i.tenantId === user.id);
    case 'agent':
      return inspections.filter(i => i.managerId === user.id);
    default:
      return [];
  }
}

// ─── Payout filters ───────────────────────────────────────────────────────────
export function filterPayoutsForUser(payouts: Payout[], user: User | null): Payout[] {
  if (!user) return [];
  switch (user.role) {
    case 'admin':
      return payouts;
    case 'property_manager':
      return payouts; // manager sees payouts they processed
    case 'landlord':
      return payouts.filter(p => p.landlordId === user.id);
    default:
      return [];
  }
}

// ─── UI permission helpers ────────────────────────────────────────────────────
export const canDo = {
  addProperty:     (u: User | null) => is(u, 'admin', 'property_manager', 'agent', 'landlord'),
  editProperty:    (u: User | null, p: Property) =>
    is(u, 'admin') ||
    (is(u, 'property_manager') && (p.managerId === u?.id || !p.managerId)) ||
    (is(u, 'landlord') && p.landlordId === u?.id) ||
    (is(u, 'agent') && (p.managerId === u?.id || (!p.managerId && p.id.startsWith('p_')))),
  deleteProperty:  (u: User | null, p: Property) => canDo.editProperty(u, p),
  publishProperty: (u: User | null) => is(u, 'admin', 'property_manager'),
  vetProperty:     (u: User | null) => is(u, 'admin', 'property_manager'),
  manageUsers:     (u: User | null) => is(u, 'admin'),
  suspendUser:     (u: User | null) => is(u, 'admin'),
  viewAllPayments: (u: User | null) => is(u, 'admin', 'property_manager'),
  processPayouts:  (u: User | null) => is(u, 'admin', 'property_manager'),
  assignVendors:   (u: User | null) => is(u, 'admin', 'property_manager', 'landlord'),
  viewAnalytics:   (u: User | null) => is(u, 'admin', 'property_manager'),
  sendNotices:     (u: User | null) => is(u, 'admin', 'property_manager', 'landlord'),
  manageVendors:   (u: User | null) => is(u, 'admin', 'property_manager'),
  createContracts: (u: User | null) => is(u, 'admin', 'property_manager'),
  bookInspection:  (u: User | null) => is(u, 'tenant'),
  payRent:         (u: User | null) => is(u, 'tenant'),
  submitMaintenance:(u: User | null) => is(u, 'admin', 'property_manager', 'landlord', 'tenant'),
  manageMaintenance:(u: User | null) => is(u, 'admin', 'property_manager', 'landlord'),
  viewOwnJobs:     (u: User | null) => is(u, 'vendor'),
};

// ─── Route guard helper ───────────────────────────────────────────────────────
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
