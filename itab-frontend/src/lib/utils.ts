import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Currency ────────────────────────────────────────────────────────────────
export function formatCurrency(amount: number, currency = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-UG').format(n);
}

// ─── Date ────────────────────────────────────────────────────────────────────
export function formatDate(date: string | Date, fmt = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt);
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

// ─── Status helpers ──────────────────────────────────────────────────────────
export const propertyStatusConfig: Record<string, { label: string; color: string }> = {
  draft:             { label: 'Draft',            color: 'badge-gray'   },
  pending_vetting:   { label: 'Pending Vetting',  color: 'badge-yellow' },
  published:         { label: 'Published',        color: 'badge-green'  },
  rented:            { label: 'Rented',           color: 'badge-blue'   },
  under_maintenance: { label: 'Maintenance',      color: 'badge-red'    },
  rejected:          { label: 'Rejected',         color: 'badge-red'    },
};

export const inspectionStatusConfig: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: 'badge-yellow' },
  confirmed: { label: 'Confirmed', color: 'badge-blue'   },
  completed: { label: 'Completed', color: 'badge-green'  },
  cancelled: { label: 'Cancelled', color: 'badge-gray'   },
  no_show:   { label: 'No Show',   color: 'badge-red'    },
};

export const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Pending',    color: 'badge-yellow' },
  processing: { label: 'Processing', color: 'badge-blue'   },
  completed:  { label: 'Completed',  color: 'badge-green'  },
  failed:     { label: 'Failed',     color: 'badge-red'    },
  refunded:   { label: 'Refunded',   color: 'badge-purple' },
};

export const maintenanceStatusConfig: Record<string, { label: string; color: string }> = {
  submitted:   { label: 'Submitted',   color: 'badge-yellow' },
  assigned:    { label: 'Assigned',    color: 'badge-blue'   },
  in_progress: { label: 'In Progress', color: 'badge-purple' },
  completed:   { label: 'Completed',   color: 'badge-green'  },
  cancelled:   { label: 'Cancelled',   color: 'badge-gray'   },
};

// ─── Amenity icons ───────────────────────────────────────────────────────────
export const amenityIcons: Record<string, string> = {
  wifi:          '📶',
  tiled:         '🏠',
  kitchen:       '🍳',
  perimeter_wall:'🧱',
  parking:       '🚗',
  furnished:     '🛋️',
  gym:           '💪',
  pool:          '🏊',
  security:      '🔒',
  backup_power:  '⚡',
  water_tank:    '💧',
  garden:        '🌿',
  balcony:       '🏗️',
  cctv:          '📹',
};

export const amenityList = Object.keys(amenityIcons);

// ─── Role helpers ────────────────────────────────────────────────────────────
export const roleLabels: Record<string, string> = {
  admin:            'Admin',
  property_manager: 'Property Manager',
  landlord:         'Landlord',
  tenant:           'Tenant',
  agent:            'Agent',
  vendor:           'Vendor',
  guest:            'Guest',
};

export const roleColors: Record<string, string> = {
  admin:            'badge-red',
  property_manager: 'badge-purple',
  landlord:         'badge-blue',
  tenant:           'badge-green',
  agent:            'badge-yellow',
  guest:            'badge-gray',
};

// ─── Misc ────────────────────────────────────────────────────────────────────
export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function truncate(str: string, len = 80): string {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const INSPECTION_FEE = 100_000;
export const DISTRICTS = [
  'Kampala', 'Wakiso', 'Mukono', 'Entebbe', 'Jinja', 'Mbarara',
  'Gulu', 'Lira', 'Mbale', 'Masaka', 'Fort Portal', 'Arua',
];
