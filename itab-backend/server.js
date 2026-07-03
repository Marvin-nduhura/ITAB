const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const { getEffectivePermissions, hasPermission } = require('./lib/userPermissions');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'itab_dev_secret_change_in_production';

// ─── Database ─────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.FRONTEND_URL,
      'https://itabproperties.com',
      'https://www.itabproperties.com',
      'https://itab-frontend.onrender.com',
      'http://localhost:5173',
      'http://localhost:4173',
    ].filter(Boolean);
    if (allowed.includes(origin)) return callback(null, true);
    // Allow any *.onrender.com subdomain (for preview deployments)
    if (origin.endsWith('.onrender.com')) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// Block mutating API calls until admin approves the account (except messages, document upload, self-delete).
// Landlord / agent / property_manager: not approved = only browse + messages + documents (matches frontend RBAC).
const VETTING_ROLES_DB = ['landlord', 'agent', 'property_manager'];
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();
  let uid;
  try {
    uid = jwt.verify(token, JWT_SECRET).id;
  } catch {
    return next();
  }
  const allow =
    req.path.startsWith('/api/messages')
    || (req.method === 'POST' && req.path === '/api/documents')
    || (req.method === 'DELETE' && req.path === '/api/auth/account')
    || (req.method === 'POST' && req.path === '/api/agent-applications')
    || (req.method === 'GET'  && req.path === '/api/agent-applications/my');
  if (allow) return next();
  try {
    const r = await pool.query(
      'SELECT approval_status, role FROM users WHERE id = $1',
      [uid]
    );
    if (!r.rows.length) return next();
    const { approval_status, role } = r.rows[0];
    const notApprovedVetting =
      VETTING_ROLES_DB.includes(role) && approval_status !== 'approved';
    const pendingOther = approval_status === 'pending' && role !== 'admin';
    if (!notApprovedVetting && !pendingOther) return next();
    return res.status(403).json({
      message:
        'Your account is not approved for full access yet. You can browse listings, use Messages, and upload Documents for verification. Profile and other changes unlock after admin approval.',
      code: 'ACCOUNT_PENDING_APPROVAL',
    });
  } catch {
    return next();
  }
});

// ─── Auth middleware ──────────────────────────────────────────────────────────
/** Verifies JWT, loads fresh role + per-user permission matrix from DB (same source as admin overrides). */
async function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
  try {
    const result = await pool.query(
      `SELECT id, role, approval_status, permissions, is_suspended, first_name, last_name
       FROM users WHERE id = $1`,
      [decoded.id]
    );
    if (!result.rows.length) return res.status(401).json({ message: 'User not found' });
    const row = result.rows[0];
    if (row.is_suspended) {
      return res.status(403).json({ message: 'Account suspended', code: 'ACCOUNT_SUSPENDED' });
    }
    const displayName = [row.first_name, row.last_name].filter(Boolean).join(' ') || 'User';
    req.user = { id: row.id, role: row.role, name: displayName };
    req.dbUserForPerms = row;
    req.effectivePermissions = getEffectivePermissions(row);
    next();
  } catch (err) {
    console.error('auth:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}

function requirePerm(section, key) {
  return (req, res, next) => {
    // Admins always have full access regardless of what may be stored in their permissions column.
    if (req.user?.role === 'admin') return next();
    if (!req.effectivePermissions) {
      return res.status(500).json({ message: 'Permissions not available' });
    }
    if (!hasPermission(req.effectivePermissions, section, key)) {
      return res.status(403).json({
        message: 'You do not have permission for this action.',
        code: 'PERMISSION_DENIED',
        section,
        key,
      });
    }
    next();
  };
}

function requireAnyPerm(pairs) {
  return (req, res, next) => {
    // Admins always have full access regardless of what may be stored in their permissions column.
    if (req.user?.role === 'admin') return next();
    if (!req.effectivePermissions) {
      return res.status(500).json({ message: 'Permissions not available' });
    }
    const ok = pairs.some(([s, k]) => hasPermission(req.effectivePermissions, s, k));
    if (!ok) {
      return res.status(403).json({
        message: 'You do not have permission for this action.',
        code: 'PERMISSION_DENIED',
      });
    }
    next();
  };
}

function requireViewUsersOrSelf(req, res, next) {
  if (!req.effectivePermissions) {
    return res.status(500).json({ message: 'Permissions not available' });
  }
  if (req.params.id === req.user.id) return next();
  if (!hasPermission(req.effectivePermissions, 'userManagement', 'viewUsers')) {
    return res.status(403).json({
      message: 'You do not have permission to view this user.',
      code: 'PERMISSION_DENIED',
    });
  }
  next();
}

function requirePaymentPrefsRead(req, res, next) {
  if (req.params.userId === req.user.id) {
    return requirePerm('settings', 'setPaymentMethod')(req, res, next);
  }
  return requirePerm('userManagement', 'viewUsers')(req, res, next);
}

const MAINT_PUT_ANY = requireAnyPerm([
  ['maintenance', 'assignVendorToJob'],
  ['maintenance', 'markMaintenanceInProgress'],
  ['maintenance', 'markMaintenanceCompleted'],
  ['maintenance', 'cancelMaintenanceRequest'],
  ['maintenance', 'revertMaintenanceStatus'],
  ['maintenance', 'reopenMaintenanceRequest'],
]);

const ADMIN_USER_WRITE = requireAnyPerm([
  ['userManagement', 'changeUserRole'],
  ['userManagement', 'approveKYC'],
  ['userManagement', 'rejectKYC'],
  ['userManagement', 'approveUserApplication'],
  ['userManagement', 'rejectUserApplication'],
  ['userManagement', 'addAdminNotes'],
  ['userManagement', 'editUserPermissions'],
]);

const RESOLVE_DISPUTE_ANY = requireAnyPerm([
  ['disputes', 'resolveDispute'],
  ['admin', 'resolveDispute'],
]);

const DISMISS_DISPUTE_ANY = requireAnyPerm([
  ['disputes', 'dismissDispute'],
  ['admin', 'dismissDispute'],
]);

function parseDbJson(val, fallback = null) {
  if (val == null || val === '') return fallback;
  if (typeof val === 'object' && val !== null && !Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** Load admin-configured district allow-list for this user (empty = no restriction). */
async function fetchRestrictedDistrictsForUser(userId) {
  const r = await pool.query('SELECT restricted_districts FROM users WHERE id = $1', [userId]);
  if (!r.rows.length) return [];
  const rd = parseDbJson(r.rows[0].restricted_districts, []);
  return Array.isArray(rd) ? rd.map((x) => String(x)) : [];
}

function districtPassRestrictedList(restrictedList, district) {
  if (!restrictedList || restrictedList.length === 0) return true;
  const d = String(district ?? '').trim().toLowerCase();
  if (!d) return false;
  return restrictedList.some((x) => String(x).trim().toLowerCase() === d);
}

async function assertDistrictAllowedForUser(userId, district, res) {
  const list = await fetchRestrictedDistrictsForUser(userId);
  if (!districtPassRestrictedList(list, district)) {
    res.status(403).json({
      message:
        'Your account is restricted from this district. Contact an administrator if you need access.',
    });
    return false;
  }
  return true;
}

// ─── Format helpers ───────────────────────────────────────────────────────────
function formatUser(u) {
  if (!u) return null;
  const permissionsRaw = parseDbJson(u.permissions, null);
  const permissions =
    permissionsRaw && typeof permissionsRaw === 'object' && !Array.isArray(permissionsRaw)
      ? permissionsRaw
      : null;
  // restricted_districts is text[] — pg driver returns it as a native JS array
  const rd = Array.isArray(u.restricted_districts) ? u.restricted_districts
           : (u.restricted_districts ? parseDbJson(u.restricted_districts, []) : []);
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    firstName: u.first_name,
    lastName: u.last_name,
    role: u.role,
    avatar: u.avatar,
    isVerified: u.is_verified,
    isSuspended: u.is_suspended,
    suspendedReason: u.suspended_reason,
    suspendedAt: u.suspended_at,
    kycStatus: u.kyc_status,
    permissions,
    restrictedDistricts: Array.isArray(rd) ? rd : [],
    approvalStatus: u.approval_status,
    googleId: u.google_id,
    notes: u.notes,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  };
}

const PUBLIC_PROPERTY_STATUSES = ['published', 'rented', 'under_maintenance'];
const DRAFT_LIKE_STATUSES = ['draft', 'pending_vetting', 'rejected'];
const DUPE_RADIUS_METERS = 50;
const COORD_ROUND_DECIMALS = 5;

function roundCoord(n, decimals = COORD_ROUND_DECIMALS) {
  const x = parseFloat(n);
  if (!Number.isFinite(x)) return null;
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Optional JWT — sets req.user or leaves null (for public property browse). */
async function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    req.user = null;
    req.dbUserForPerms = null;
    req.effectivePermissions = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      `SELECT id, role, approval_status, permissions, is_suspended, first_name, last_name, restricted_districts
       FROM users WHERE id = $1`,
      [decoded.id]
    );
    if (!result.rows.length || result.rows[0].is_suspended) {
      req.user = null;
      return next();
    }
    const row = result.rows[0];
    const displayName = [row.first_name, row.last_name].filter(Boolean).join(' ') || 'User';
    req.user = { id: row.id, role: row.role, name: displayName };
    req.dbUserForPerms = row;
    req.effectivePermissions = getEffectivePermissions(row);
    next();
  } catch {
    req.user = null;
    next();
  }
}

function propertyCreatorId(p) {
  return p.created_by_id || p.manager_id || p.landlord_id || null;
}

function userMaySeeDistrict(req, district) {
  const list = req.dbUserForPerms?.restricted_districts;
  if (!list || (Array.isArray(list) && list.length === 0)) return true;
  const districts = Array.isArray(list) ? list : parseDbJson(list, []) || [];
  const d = String(district ?? '').trim().toLowerCase();
  if (!d) return false;
  return districts.some((a) => String(a ?? '').trim().toLowerCase() === d);
}

/** Mirrors frontend filterPropertiesForUser — enforce on API responses. */
function canUserViewProperty(user, p) {
  const status = p.status;
  const isPublic = PUBLIC_PROPERTY_STATUSES.includes(status);
  const creatorId = propertyCreatorId(p);

  if (!user) {
    return status === 'published';
  }
  if (user.role === 'admin') return true;

  const isCreator =
    (p.created_by_id && p.created_by_id === user.id) ||
    p.landlord_id === user.id ||
    (p.manager_id === user.id && ['agent', 'property_manager'].includes(user.role));

  if (DRAFT_LIKE_STATUSES.includes(status)) {
    return isCreator;
  }

  if (!isPublic) return isCreator;

  switch (user.role) {
    case 'property_manager':
      return isPublic || p.manager_id === user.id;
    case 'landlord':
      return p.landlord_id === user.id || isPublic;
    case 'tenant':
      return status === 'published' || p.tenant_id === user.id;
    case 'agent':
      return p.manager_id === user.id || status === 'published';
    case 'vendor':
      return status === 'published';
    default:
      return status === 'published';
  }
}

function formatProperty(p) {
  if (!p) return null;
  const createdById = p.created_by_id || p.manager_id || p.landlord_id || null;
  const createdByName = p.created_by_name || p.manager_name || p.landlord_name || null;
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    type: p.type,
    status: p.status,
    address: p.address,
    district: p.district,
    latitude: parseFloat(p.latitude) || 0,
    longitude: parseFloat(p.longitude) || 0,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    squareFootage: p.square_footage,
    rentPrice: p.rent_price,
    deposit: p.deposit,
    availableFrom: p.available_from,
    photos: p.photos || [],
    amenities: p.amenities || [],
    managementFeePercent: p.management_fee_percent,
    itabFeePercent: p.itab_fee_percent,
    isFeatured: p.is_featured,
    tourUrl: p.tour_url,
    managerId: p.manager_id,
    managerName: p.manager_name,
    landlordId: p.landlord_id,
    landlordName: p.landlord_name,
    tenantId: p.tenant_id,
    leaseStart: p.lease_start,
    leaseEnd: p.lease_end,
    viewCount: p.view_count || 0,
    createdById,
    createdByName,
    createdByRole: p.created_by_role || null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

function formatPropertyConflict(row) {
  if (!row) return null;
  let ids = row.property_ids;
  if (typeof ids === 'string') {
    try { ids = JSON.parse(ids); } catch { ids = []; }
  }
  return {
    id: row.id,
    propertyIds: ids || [],
    latitude: parseFloat(row.latitude) || 0,
    longitude: parseFloat(row.longitude) || 0,
    minDistanceMeters: parseFloat(row.min_distance_meters) || 0,
    reason: row.reason,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveManagerFields(managerId, managerName) {
  if (!managerId) return { managerId: null, managerName: managerName || null };
  if (managerName) return { managerId, managerName };
  const r = await pool.query(
    'SELECT first_name, last_name FROM users WHERE id = $1 AND role = $2',
    [managerId, 'property_manager']
  );
  if (!r.rows.length) return { managerId, managerName: managerName || null };
  const u = r.rows[0];
  return { managerId, managerName: `${u.first_name || ''} ${u.last_name || ''}`.trim() };
}

async function scanPropertyLocationConflicts(propertyId) {
  try {
    const cur = await pool.query('SELECT * FROM properties WHERE id = $1', [propertyId]);
    if (!cur.rows.length) return;
    const p = cur.rows[0];
    const lat = parseFloat(p.latitude);
    const lng = parseFloat(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const others = await pool.query(
      `SELECT id, latitude, longitude, title, status FROM properties
       WHERE id != $1 AND status != 'rejected'`,
      [propertyId]
    );

    const rLat = roundCoord(lat);
    const rLng = roundCoord(lng);
    const matches = [];
    let minDist = null;
    let reason = 'proximity';

    for (const o of others.rows) {
      const oLat = parseFloat(o.latitude);
      const oLng = parseFloat(o.longitude);
      if (!Number.isFinite(oLat) || !Number.isFinite(oLng)) continue;
      const exact = roundCoord(oLat) === rLat && roundCoord(oLng) === rLng;
      const dist = haversineMeters(lat, lng, oLat, oLng);
      if (exact || dist < DUPE_RADIUS_METERS) {
        matches.push(o.id);
        if (minDist === null || dist < minDist) minDist = exact ? 0 : dist;
        if (exact) reason = 'exact_pin';
      }
    }
    if (!matches.length) return;

    const allIds = [propertyId, ...matches].sort();
    const existing = await pool.query(
      `SELECT * FROM property_location_conflicts
       WHERE status = 'pending' AND property_ids @> $1::jsonb`,
      [JSON.stringify([propertyId])]
    );

    let conflictId;
    if (existing.rows.length) {
      conflictId = existing.rows[0].id;
      const prevIds = parseDbJson(existing.rows[0].property_ids, []);
      const merged = [...new Set([...prevIds, ...allIds])];
      await pool.query(
        `UPDATE property_location_conflicts SET
           property_ids = $1::jsonb, latitude = $2, longitude = $3,
           min_distance_meters = $4, reason = $5, updated_at = NOW()
         WHERE id = $6`,
        [JSON.stringify(merged), lat, lng, minDist ?? 0, reason, conflictId]
      );
    } else {
      conflictId = uuidv4();
      await pool.query(
        `INSERT INTO property_location_conflicts
         (id, property_ids, latitude, longitude, min_distance_meters, reason, status)
         VALUES ($1, $2::jsonb, $3, $4, $5, $6, 'pending')`,
        [conflictId, JSON.stringify(allIds), lat, lng, minDist ?? 0, reason]
      );
    }

    const admins = await pool.query(`SELECT id FROM users WHERE role = 'admin' AND is_suspended = false`);
    for (const a of admins.rows) {
      await pool.query(
        `INSERT INTO notifications (id, user_id, type, title, body, is_read, action_url)
         VALUES ($1, $2, 'property_duplicate', $3, $4, false, '/admin/property-conflicts')`,
        [
          uuidv4(),
          a.id,
          'Possible duplicate property location',
          `${allIds.length} listings share the same or very close map pin. Review in Location Conflicts.`,
        ]
      ).catch(() => {});
    }
  } catch (e) {
    console.error('scanPropertyLocationConflicts:', e.message);
  }
}

function formatInspection(i) {
  if (!i) return null;
  return {
    id: i.id,
    propertyId: i.property_id,
    propertyTitle: i.property_title,
    propertyAddress: i.property_address,
    tenantId: i.tenant_id,
    tenantName: i.tenant_name,
    managerId: i.manager_id,
    scheduledDate: i.scheduled_date,
    scheduledTime: i.scheduled_time,
    status: i.status,
    feeAmount: i.fee_amount,
    feePaid: i.fee_paid,
    paymentMethod: i.payment_method,
    paymentRef: i.payment_ref,
    creditApplied: i.credit_applied,
    qrCode: i.qr_code,
    notes: i.notes,
    noShowCount: i.no_show_count,
    rescheduleCount: i.reschedule_count,
    leaseDeclined: i.lease_declined,
    leaseDeclinedReason: i.lease_declined_reason,
    leaseDeclinedAt: i.lease_declined_at,
    createdAt: i.created_at,
  };
}

function formatPayment(p) {
  if (!p) return null;
  return {
    id: p.id,
    type: p.type,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    method: p.method,
    reference: p.reference,
    propertyId: p.property_id,
    propertyTitle: p.property_title,
    tenantId: p.tenant_id,
    tenantName: p.tenant_name,
    landlordId: p.landlord_id,
    inspectionCreditApplied: p.inspection_credit_applied,
    rentPeriod: p.rent_period,
    isPartial: p.is_partial,
    receiptUrl: p.receipt_url,
    createdAt: p.created_at,
    paidAt: p.paid_at,
  };
}

function formatTransaction(t) {
  if (!t) return null;
  return {
    id: t.id,
    type: t.type,
    senderId: t.sender_id,
    senderName: t.sender_name,
    senderRole: t.sender_role,
    senderMethod: t.sender_method,
    senderPhone: t.sender_phone,
    receiverId: t.receiver_id,
    receiverName: t.receiver_name,
    receiverRole: t.receiver_role,
    receiverMethod: t.receiver_method,
    receiverPhone: t.receiver_phone,
    receiverBankDetails: t.receiver_bank_details,
    amount: t.amount,
    currency: t.currency,
    reference: t.reference,
    status: t.status,
    propertyId: t.property_id,
    propertyTitle: t.property_title,
    jobId: t.job_id,
    contractId: t.contract_id,
    description: t.description,
    inspectionCreditApplied: t.inspection_credit_applied,
    rentPeriod: t.rent_period,
    isPartial: t.is_partial,
    receiptUrl: t.receipt_url,
    createdAt: t.created_at,
    processedAt: t.processed_at,
    failureReason: t.failure_reason,
  };
}

function formatMaintenance(m) {
  if (!m) return null;
  return {
    id: m.id,
    propertyId: m.property_id,
    propertyTitle: m.property_title,
    tenantId: m.tenant_id,
    tenantName: m.tenant_name,
    title: m.title,
    description: m.description,
    priority: m.priority,
    status: m.status,
    photos: m.photos || [],
    vendorId: m.vendor_id,
    vendorName: m.vendor_name,
    estimatedCost: m.estimated_cost,
    actualCost: m.actual_cost,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    completedAt: m.completed_at,
  };
}

function formatPayout(p) {
  if (!p) return null;
  return {
    id: p.id,
    landlordId: p.landlord_id,
    landlordName: p.landlord_name,
    propertyId: p.property_id,
    propertyTitle: p.property_title,
    grossRent: p.gross_rent,
    managementFee: p.management_fee,
    itabFee: p.itab_fee,
    netAmount: p.net_amount,
    status: p.status,
    method: p.method,
    reference: p.reference,
    scheduledDate: p.scheduled_date,
    processedAt: p.processed_at,
    retryCount: p.retry_count,
  };
}

function formatMessage(m) {
  if (!m) return null;
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    senderName: m.sender_name,
    senderAvatar: m.sender_avatar,
    content: m.content,
    isRead: m.is_read,
    createdAt: m.created_at,
  };
}

function formatConversation(c) {
  if (!c) return null;
  return {
    id: c.id,
    participants: c.participants || [],
    propertyId: c.property_id,
    propertyTitle: c.property_title,
    lastMessage: c.last_message,
    unreadCount: c.unread_count || 0,
    updatedAt: c.updated_at,
  };
}

function formatNotification(n) {
  if (!n) return null;
  return {
    id: n.id,
    userId: n.user_id,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: n.is_read,
    actionUrl: n.action_url,
    createdAt: n.created_at,
  };
}

function formatVendor(v) {
  if (!v) return null;
  return {
    id: v.id,
    userId: v.user_id,
    firstName: v.first_name,
    lastName: v.last_name,
    email: v.email,
    phone: v.phone,
    avatar: v.avatar,
    category: v.category,
    skills: v.skills || [],
    bio: v.bio,
    district: v.district,
    address: v.address,
    rating: parseFloat(v.rating) || 0,
    totalRatings: v.total_ratings || 0,
    totalJobs: v.total_jobs || 0,
    completedJobs: v.completed_jobs || 0,
    isActive: v.is_active,
    isVerified: v.is_verified,
    isSuspended: v.is_suspended,
    dailyRate: v.daily_rate,
    hourlyRate: v.hourly_rate,
    availability: v.availability,
    joinedAt: v.joined_at,
    lastActiveAt: v.last_active_at,
  };
}

function formatVendorJob(j) {
  if (!j) return null;
  return {
    id: j.id,
    vendorId: j.vendor_id,
    vendorName: j.vendor_name,
    maintenanceRequestId: j.maintenance_request_id,
    propertyTitle: j.property_title,
    propertyAddress: j.property_address,
    title: j.title,
    description: j.description,
    status: j.status,
    scheduledDate: j.scheduled_date,
    completedDate: j.completed_date,
    estimatedCost: j.estimated_cost,
    actualCost: j.actual_cost,
    managerNotes: j.manager_notes,
    vendorNotes: j.vendor_notes,
    rating: j.rating,
    ratingComment: j.rating_comment,
    photos: j.photos || [],
    createdAt: j.created_at,
    updatedAt: j.updated_at,
  };
}

function formatDocument(d) {
  if (!d) return null;
  return {
    id: d.id,
    ownerId: d.owner_id,
    ownerName: d.owner_name,
    ownerRole: d.owner_role,
    name: d.name,
    category: d.category,
    status: d.status,
    fileUrl: d.file_url,
    fileType: d.file_type,
    fileSize: d.file_size,
    uploadedAt: d.uploaded_at,
    expiresAt: d.expires_at,
    reviewedBy: d.reviewed_by,
    reviewedAt: d.reviewed_at,
    adminNotes: d.admin_notes,
  };
}

function formatNotice(n) {
  if (!n) return null;
  return {
    id: n.id,
    propertyId: n.property_id,
    propertyTitle: n.property_title,
    tenantId: n.tenant_id,
    tenantName: n.tenant_name,
    issuedBy: n.issued_by,
    issuedByRole: n.issued_by_role,
    type: n.type,
    subject: n.subject,
    body: n.body,
    effectiveDate: n.effective_date,
    responseDeadline: n.response_deadline,
    status: n.status,
    requiresAcknowledgement: n.requires_acknowledgement,
    attachmentUrl: n.attachment_url,
    tenantResponse: n.tenant_response,
    createdAt: n.created_at,
    readAt: n.read_at,
    acknowledgedAt: n.acknowledged_at,
  };
}

function formatDispute(d) {
  if (!d) return null;
  return {
    id: d.id,
    type: d.type,
    status: d.status,
    raisedById: d.raised_by_id,
    raisedByName: d.raised_by_name,
    raisedByRole: d.raised_by_role,
    againstId: d.against_id,
    againstName: d.against_name,
    againstRole: d.against_role,
    propertyId: d.property_id,
    propertyTitle: d.property_title,
    transactionId: d.transaction_id,
    subject: d.subject,
    description: d.description,
    evidence: d.evidence,
    amount: d.amount,
    resolution: d.resolution,
    resolvedById: d.resolved_by_id,
    resolvedByName: d.resolved_by_name,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    resolvedAt: d.resolved_at,
  };
}

function formatAuditLog(a) {
  if (!a) return null;
  return {
    id: a.id,
    action: a.action,
    performedBy: a.performed_by,
    performedByName: a.performed_by_name,
    performedByRole: a.performed_by_role,
    targetId: a.target_id,
    targetName: a.target_name,
    description: a.description,
    metadata: a.metadata,
    createdAt: a.created_at,
  };
}

function formatAnnouncement(a) {
  if (!a) return null;
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    targetRoles: a.target_roles || [],
    sentBy: a.sent_by,
    sentByName: a.sent_by_name,
    createdAt: a.created_at,
  };
}

function formatContract(c) {
  if (!c) return null;
  return {
    id: c.id,
    vendorId: c.vendor_id,
    vendorName: c.vendor_name,
    propertyId: c.property_id,
    propertyTitle: c.property_title,
    managerId: c.manager_id,
    type: c.type,
    description: c.description,
    amount: c.amount,
    currency: c.currency,
    startDate: c.start_date,
    endDate: c.end_date,
    status: c.status,
    paymentMethod: c.payment_method,
    nextPaymentDate: c.next_payment_date,
    totalPaid: c.total_paid,
    paymentsCount: c.payments_count,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function formatAgentApplication(a) {
  if (!a) return null;
  let districts = a.districts || [];
  if (typeof districts === 'string') {
    try { districts = JSON.parse(districts); } catch { districts = []; }
  }
  let additionalDocs = a.additional_docs || [];
  if (typeof additionalDocs === 'string') {
    try { additionalDocs = JSON.parse(additionalDocs); } catch { additionalDocs = []; }
  }
  return {
    id: a.id,
    userId: a.user_id,
    firstName: a.first_name,
    lastName: a.last_name,
    email: a.email,
    phone: a.phone,
    role: a.role,
    nationalIdNumber: a.national_id_number,
    nationalIdDoc: a.national_id_doc || undefined,
    additionalDocs,
    experience: a.experience,
    districts,
    motivation: a.motivation,
    status: a.status,
    adminNote: a.admin_note,
    createdAt: a.created_at,
    reviewedAt: a.reviewed_at,
  };
}

function rolesNeedingVetting(role) {
  return ['landlord', 'agent', 'property_manager'].includes(role);
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));


// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/auth/check-email', async (req, res) => {
  try {
    const email = (req.query.email || '').trim();
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const existing = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
    res.json({ data: { exists: existing.rows.length > 0 } });
  } catch (err) {
    console.error('check-email error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, role, kycSubmitted } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'All fields required' });
    }
    const existing = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        message: 'An account with this email already exists. Sign in instead.',
        code: 'EMAIL_EXISTS',
      });
    }

    const hash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const allowedRoles = ['tenant', 'landlord', 'agent', 'vendor', 'property_manager'];
    const assignedRole = allowedRoles.includes(role) ? role : 'tenant';
    const vetting = rolesNeedingVetting(assignedRole);
    const kycFromBody = !!kycSubmitted;
    const kycStatus = vetting && kycFromBody ? 'submitted' : vetting ? 'pending' : 'pending';
    const approvalStatus = vetting ? 'pending' : 'approved';
    const isVerified = !vetting;

    const result = await pool.query(
      `INSERT INTO users (id, first_name, last_name, email, phone, password_hash, role, kyc_status, is_verified, is_suspended, approval_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10) RETURNING *`,
      [id, firstName, lastName, email, phone || null, hash, assignedRole, kycStatus, isVerified, approvalStatus]
    );
    const user = formatUser(result.rows[0]);
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

    // Notify admins when a vetting-required role registers
    if (vetting) {
      const roleLabel = assignedRole === 'landlord' ? 'Landlord' : assignedRole === 'property_manager' ? 'Property Manager' : 'Agent';
      const admins = await pool.query(`SELECT id FROM users WHERE role = 'admin' AND is_suspended = false`);
      for (const a of admins.rows) {
        await pool.query(
          `INSERT INTO notifications (id, user_id, type, title, body, is_read, action_url)
           VALUES ($1, $2, 'kyc_review', $3, $4, false, '/admin/vetting')`,
          [
            uuidv4(),
            a.id,
            `New ${roleLabel} Registration`,
            `${firstName} ${lastName} registered as a ${roleLabel} and is awaiting approval.`,
          ]
        ).catch(() => {});
      }
    }

    res.status(201).json({ data: { user, token } });
    // Audit log: user registered (fire-and-forget)
    pool.query(
      `INSERT INTO audit_logs (id,action,performed_by,performed_by_name,performed_by_role,target_name,description)
       VALUES ($1,'user_registered',$2,$3,$4,$5,$6)`,
      [uuidv4(), id, `${firstName} ${lastName}`, assignedRole, `${firstName} ${lastName}`,
       `New ${assignedRole} account registered`]
    ).catch(() => {});
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
    if (user.is_suspended) {
      return res.status(403).json({
        message: 'Account suspended',
        reason: user.suspended_reason || 'Contact support@itab.ug',
        code: 'ACCOUNT_SUSPENDED',
      });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    // Log login
    await pool.query(
      `INSERT INTO audit_logs (id, action, performed_by, performed_by_name, performed_by_role, description)
       VALUES ($1,'login',$2,$3,$4,'User logged in')`,
      [uuidv4(), user.id, `${user.first_name} ${user.last_name}`, user.role]
    ).catch(() => {});
    res.json({ data: { user: formatUser(user), token } });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/auth/profile', auth, requirePerm('settings', 'editProfile'), async (req, res) => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;
    const result = await pool.query(
      `UPDATE users SET first_name=COALESCE($1,first_name), last_name=COALESCE($2,last_name),
       phone=COALESCE($3,phone), avatar=COALESCE($4,avatar), updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [firstName, lastName, phone, avatar, req.user.id]
    );
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  // Token-based password reset. Store a reset token in DB, return it for now.
  // In production, send the token via email instead of returning it.
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const userRes = await pool.query('SELECT id FROM users WHERE lower(email) = $1', [email]);
    if (!userRes.rows.length) {
      // Don't reveal whether email exists
      return res.json({ data: { message: 'If that email exists, a reset link has been sent.' } });
    }

    const resetToken = uuidv4();
    const expires    = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token in notes field temporarily (in production use a dedicated table)
    await pool.query(
      `UPDATE users SET notes = $1 WHERE id = $2`,
      [`reset:${resetToken}:${expires.toISOString()}`, userRes.rows[0].id]
    );

    // In production: send email with link https://itabproperties.com/reset-password?token=...
    // For now: log it (Render logs are visible in dashboard)
    console.log(`[Password Reset] token=${resetToken} for ${email} expires=${expires.toISOString()}`);

    res.json({ data: { message: 'If that email exists, a reset link has been sent.' } });
  } catch (err) {
    console.error('forgot-password:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token and password are required' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });

    // Find user with this reset token
    const result = await pool.query(
      `SELECT id, notes FROM users WHERE notes LIKE $1`,
      [`reset:${token}:%`]
    );
    if (!result.rows.length) return res.status(400).json({ message: 'Invalid or expired reset token' });

    const user = result.rows[0];
    // Parse expiry from notes field
    const parts = user.notes.split(':');
    const expires = new Date(parts[2]);
    if (new Date() > expires) {
      return res.status(400).json({ message: 'Reset token has expired. Please request a new one.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `UPDATE users SET password_hash = $1, notes = NULL, updated_at = NOW() WHERE id = $2`,
      [hash, user.id]
    );

    res.json({ data: { message: 'Password updated successfully. You can now log in.' } });
  } catch (err) {
    console.error('reset-password:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Google OAuth
app.post('/api/auth/google', async (req, res) => {
  try {
    const {
      googleId, email, firstName, lastName, avatar, role, phone, intent, kycSubmitted,
    } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    let result = await pool.query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
    let user;
    let requiresApproval = false;

    if (result.rows.length > 0) {
      if (intent === 'register') {
        return res.status(409).json({
          message: 'An account with this email already exists. Sign in with Google or use email login.',
          code: 'EMAIL_EXISTS',
        });
      }
      user = result.rows[0];
      if (!user.google_id) {
        await pool.query('UPDATE users SET google_id=$1, updated_at=NOW() WHERE id=$2', [googleId, user.id]);
        user.google_id = googleId;
      }
      if (phone && String(phone).trim()) {
        const phoneUp = await pool.query(
          'UPDATE users SET phone=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
          [String(phone).trim(), user.id]
        );
        user = phoneUp.rows[0];
      }
    } else {
      // No account found — if this is a sign-in attempt (not explicit register), reject so
      // the frontend can redirect the user to the registration page.
      if (intent !== 'register') {
        return res.status(404).json({
          message: 'No account found for this Google account. Please sign up first.',
          code: 'ACCOUNT_NOT_FOUND',
          email,
          firstName,
          lastName,
        });
      }

      const id = uuidv4();
      const allowedRoles = ['tenant', 'landlord', 'agent', 'vendor', 'property_manager'];
      const assignedRole = allowedRoles.includes(role) ? role : 'tenant';
      requiresApproval = rolesNeedingVetting(assignedRole);
      const vetting = requiresApproval;
      const kycStatus = vetting && kycSubmitted ? 'submitted' : vetting ? 'pending' : 'pending';
      const approvalStatus = vetting ? 'pending' : 'approved';
      const isVerified = !vetting;
      const insertResult = await pool.query(
        `INSERT INTO users (id, first_name, last_name, email, phone, google_id, avatar, role, kyc_status, is_verified, is_suspended, approval_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11) RETURNING *`,
        [id, firstName, lastName, email, phone ? String(phone).trim() || null : null, googleId, avatar, assignedRole, kycStatus, isVerified, approvalStatus]
      );
      user = insertResult.rows[0];

      // Notify admins when a vetting-required role registers via Google
      if (vetting) {
        const roleLabel = assignedRole === 'landlord' ? 'Landlord' : assignedRole === 'property_manager' ? 'Property Manager' : 'Agent';
        const admins = await pool.query(`SELECT id FROM users WHERE role = 'admin' AND is_suspended = false`);
        for (const a of admins.rows) {
          await pool.query(
            `INSERT INTO notifications (id, user_id, type, title, body, is_read, action_url)
             VALUES ($1, $2, 'kyc_review', $3, $4, false, '/admin/vetting')`,
            [
              uuidv4(),
              a.id,
              `New ${roleLabel} Registration (Google)`,
              `${firstName} ${lastName} registered via Google as a ${roleLabel} and is awaiting approval.`,
            ]
          ).catch(() => {});
        }
      }
    }

    if (user.is_suspended) {
      return res.status(403).json({ message: 'Account suspended', code: 'ACCOUNT_SUSPENDED' });
    }

    requiresApproval = user.approval_status === 'pending';

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ data: { user: formatUser(user), token, requiresApproval } });
  } catch (err) {
    console.error('google auth error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// USERS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/users', auth, requireRole('admin'), requirePerm('userManagement', 'viewUsers'), async (req, res) => {
  try {
    const { role, search } = req.query;
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    let i = 1;
    if (role) { query += ` AND role = $${i}`; params.push(role); i++; }
    if (search) { query += ` AND (first_name ILIKE $${i} OR last_name ILIKE $${i} OR email ILIKE $${i})`; params.push(`%${search}%`); i++; }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatUser) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users/pending', auth, requireRole('admin'), requireAnyPerm([['userManagement', 'viewUsers'], ['userManagement', 'approveUserApplication']]), async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE approval_status='pending' ORDER BY created_at DESC");
    res.json({ data: result.rows.map(formatUser) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users/:id', auth, requireViewUsersOrSelf, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/users/:id', auth, requireRole('admin'), ADMIN_USER_WRITE, async (req, res) => {
  try {
    const {
      firstName, lastName, phone, role, notes, kycStatus, approvalStatus,
    } = req.body;
    const allowedKyc = ['pending', 'submitted', 'approved', 'rejected'];
    const kycVal = allowedKyc.includes(kycStatus) ? kycStatus : null;
    const apprVal = ['pending', 'approved', 'rejected'].includes(approvalStatus) ? approvalStatus : null;
    const result = await pool.query(
      `UPDATE users SET
         first_name=COALESCE($1,first_name),
         last_name=COALESCE($2,last_name),
         phone=COALESCE($3,phone),
         role=COALESCE($4,role),
         notes=COALESCE($5,notes),
         kyc_status=COALESCE($6,kyc_status),
         approval_status=COALESCE($7,approval_status),
         is_verified=CASE WHEN $6::text IS NOT NULL AND $6::text = 'approved' THEN true WHEN $6::text IS NOT NULL AND $6::text = 'rejected' THEN false ELSE is_verified END,
         updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [firstName, lastName, phone, role, notes, kycVal, apprVal, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/users/:id/suspend', auth, requireRole('admin'), requirePerm('userManagement', 'suspendUser'), async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await pool.query(
      `UPDATE users SET is_suspended=true, suspended_reason=$1, suspended_at=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *`,
      [reason || 'Suspended by admin', req.params.id]
    );
    await pool.query(
      `INSERT INTO audit_logs (id,action,performed_by,performed_by_name,performed_by_role,target_id,description)
       VALUES ($1,'user_suspended',$2,$3,$4,$5,$6)`,
      [uuidv4(), req.user.id, req.user.name || 'Admin', req.user.role, req.params.id, `Suspended. Reason: ${reason}`]
    ).catch(() => {});
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/users/:id/unsuspend', auth, requireRole('admin'), requirePerm('userManagement', 'unsuspendUser'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users SET is_suspended=false, suspended_reason=NULL, suspended_at=NULL, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/users/:id/approve', auth, requireRole('admin'), requirePerm('userManagement', 'approveUserApplication'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users SET approval_status='approved', kyc_status='approved', is_verified=true, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/users/:id/reject-approval', auth, requireRole('admin'), requirePerm('userManagement', 'rejectUserApplication'), async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await pool.query(
      `UPDATE users SET approval_status='rejected', notes=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [reason, req.params.id]
    );
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/users/:id/permissions', auth, requireRole('admin'), requirePerm('userManagement', 'editUserPermissions'), async (req, res) => {
  try {
    const { permissions } = req.body;
    const result = await pool.query(
      `UPDATE users SET permissions=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [JSON.stringify(permissions), req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset a user's permissions to role defaults (NULL = use defaults, no overrides)
app.delete('/api/users/:id/permissions', auth, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users SET permissions=NULL, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/users/:id/districts', auth, requireRole('admin'), requirePerm('userManagement', 'setDistrictRestrictions'), async (req, res) => {
  try {
    const { districts } = req.body;
    if (!Array.isArray(districts)) {
      return res.status(400).json({ message: 'districts must be an array' });
    }
    // restricted_districts is text[] — pass as a native PG array, not JSONB
    const result = await pool.query(
      `UPDATE users SET restricted_districts=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [districts, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    console.error('districts PATCH:', err.message);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

app.patch('/api/users/:id/role', auth, requireRole('admin'), requirePerm('userManagement', 'changeUserRole'), async (req, res) => {
  try {
    const { role } = req.body;
    const result = await pool.query(
      `UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [role, req.params.id]
    );
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/auth/account', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.json({ data: { deleted: true } });
  } catch (err) {
    console.error('delete account error:', err);
    res.status(500).json({ message: err.message || 'Could not delete account. Try again or contact support.' });
  }
});

app.delete('/api/users/:id', auth, requireRole('admin'), requirePerm('userManagement', 'banUser'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own admin account from this screen. Use Settings if self-delete is enabled.' });
    }
    const del = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (del.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ data: { deleted: true } });
  } catch (err) {
    console.error('admin delete user error:', err);
    res.status(500).json({ message: err.message || 'Could not delete user' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTIES ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/properties', optionalAuth, async (req, res) => {
  try {
    const { search, type, status, district, minPrice, maxPrice, bedrooms } = req.query;
    let query = 'SELECT * FROM properties WHERE 1=1';
    const params = [];
    let i = 1;
    if (search) { query += ` AND (title ILIKE $${i} OR address ILIKE $${i} OR district ILIKE $${i})`; params.push(`%${search}%`); i++; }
    if (type) { query += ` AND type = $${i}`; params.push(type); i++; }
    if (status) { query += ` AND status = $${i}`; params.push(status); i++; }
    if (district) { query += ` AND district = $${i}`; params.push(district); i++; }
    if (minPrice) { query += ` AND rent_price >= $${i}`; params.push(Number(minPrice)); i++; }
    if (maxPrice) { query += ` AND rent_price <= $${i}`; params.push(Number(maxPrice)); i++; }
    if (bedrooms) { query += ` AND bedrooms >= $${i}`; params.push(Number(bedrooms)); i++; }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    const rows = result.rows
      .filter((row) => canUserViewProperty(req.user, row))
      .filter((row) => userMaySeeDistrict(req, row.district));
    res.json({ data: rows.map(formatProperty) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/properties/:id', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM properties WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Property not found' });
    const row = result.rows[0];
    if (!canUserViewProperty(req.user, row)) {
      return res.status(404).json({ message: 'Property not found' });
    }
    if (!userMaySeeDistrict(req, row.district)) {
      return res.status(404).json({ message: 'Property not found' });
    }
    if (req.user && PUBLIC_PROPERTY_STATUSES.includes(row.status)) {
      await pool.query('UPDATE properties SET view_count = view_count + 1 WHERE id = $1', [req.params.id]).catch(() => {});
    }
    res.json({ data: formatProperty(row) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/properties', auth, requireRole('admin', 'property_manager', 'agent', 'landlord'), requirePerm('properties', 'addProperty'), async (req, res) => {
  try {
    const {
      title, description, type, address, district, latitude, longitude,
      bedrooms, bathrooms, squareFootage, rentPrice, deposit, availableFrom,
      amenities, managementFeePercent, itabFeePercent, photos, tourUrl,
      landlordId, landlordName, managerId: bodyManagerId, managerName: bodyManagerName,
      status: bodyStatus,
    } = req.body;
    if (!(await assertDistrictAllowedForUser(req.user.id, district, res))) return;

    const role = req.user.role;
    let managerId = null;
    let managerName = null;
    let landlordIdVal = landlordId || null;
    let landlordNameVal = landlordName || null;

    if (role === 'property_manager') {
      managerId = req.user.id;
      managerName = req.user.name;
    } else if (role === 'agent') {
      managerId = req.user.id;
      managerName = req.user.name;
    } else if (role === 'landlord') {
      landlordIdVal = req.user.id;
      landlordNameVal = req.user.name;
    } else if (role === 'admin') {
      if (bodyManagerId) {
        const resolved = await resolveManagerFields(bodyManagerId, bodyManagerName);
        managerId = resolved.managerId;
        managerName = resolved.managerName;
      }
    }

    const initialStatus =
      bodyStatus && ['draft', 'pending_vetting', 'published'].includes(bodyStatus)
        ? bodyStatus
        : role === 'property_manager'
          ? 'published'
          : 'draft';

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO properties (id, title, description, type, status, address, district, latitude, longitude,
       bedrooms, bathrooms, square_footage, rent_price, deposit, available_from, amenities, photos,
       management_fee_percent, itab_fee_percent, manager_id, manager_name, landlord_id, landlord_name,
       created_by_id, created_by_name, created_by_role, tour_url, is_featured, view_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,false,0) RETURNING *`,
      [
        id, title, description, type, initialStatus, address, district,
        latitude || 0.3476, longitude || 32.5825,
        bedrooms || 0, bathrooms || 0, squareFootage || null,
        rentPrice, deposit, availableFrom,
        JSON.stringify(amenities || []),
        JSON.stringify(photos || []),
        managementFeePercent || 10, itabFeePercent || 2,
        managerId, managerName,
        landlordIdVal, landlordNameVal,
        req.user.id, req.user.name, role,
        tourUrl || null,
      ]
    );
    await scanPropertyLocationConflicts(id);
    // Audit log: property created
    pool.query(
      `INSERT INTO audit_logs (id,action,performed_by,performed_by_name,performed_by_role,target_id,target_name,description)
       VALUES ($1,'property_created',$2,$3,$4,$5,$6,$7)`,
      [uuidv4(), req.user.id, req.user.name, req.user.role, id, title, `Property "${title}" created in ${district}`]
    ).catch(() => {});
    res.status(201).json({ data: formatProperty(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/properties/:id', auth, requirePerm('properties', 'editProperty'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM properties WHERE id=$1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Property not found' });
    if (!canUserViewProperty(req.user, existing.rows[0])) {
      return res.status(403).json({ message: 'Not allowed to edit this property' });
    }
    const {
      title, description, type, address, district, latitude, longitude,
      bedrooms, bathrooms, squareFootage, rentPrice, deposit, availableFrom,
      amenities, photos, status, managementFeePercent, itabFeePercent,
      isFeatured, tourUrl, landlordId, landlordName, tenantId, leaseStart, leaseEnd,
      managerId: bodyManagerId, managerName: bodyManagerName,
    } = req.body;
    const effDistrict =
      district !== undefined && district !== null && district !== ''
        ? district
        : existing.rows[0].district;
    if (!(await assertDistrictAllowedForUser(req.user.id, effDistrict, res))) return;

    let managerId = existing.rows[0].manager_id;
    let managerName = existing.rows[0].manager_name;
    if (
      bodyManagerId !== undefined &&
      req.user.role === 'admin' &&
      hasPermission(req.effectivePermissions, 'properties', 'assignPropertyToManager')
    ) {
      if (bodyManagerId === null || bodyManagerId === '') {
        managerId = null;
        managerName = null;
      } else {
        const resolved = await resolveManagerFields(bodyManagerId, bodyManagerName);
        managerId = resolved.managerId;
        managerName = resolved.managerName;
      }
    }

    const result = await pool.query(
      `UPDATE properties SET
        title=COALESCE($1,title), description=COALESCE($2,description), type=COALESCE($3,type),
        address=COALESCE($4,address), district=COALESCE($5,district),
        latitude=COALESCE($6,latitude), longitude=COALESCE($7,longitude),
        bedrooms=COALESCE($8,bedrooms), bathrooms=COALESCE($9,bathrooms),
        square_footage=COALESCE($10,square_footage), rent_price=COALESCE($11,rent_price),
        deposit=COALESCE($12,deposit), available_from=COALESCE($13,available_from),
        amenities=COALESCE($14,amenities), photos=COALESCE($15,photos),
        status=COALESCE($16,status), management_fee_percent=COALESCE($17,management_fee_percent),
        itab_fee_percent=COALESCE($18,itab_fee_percent), is_featured=COALESCE($19,is_featured),
        tour_url=COALESCE($20,tour_url), landlord_id=COALESCE($21,landlord_id),
        landlord_name=COALESCE($22,landlord_name), tenant_id=COALESCE($23,tenant_id),
        lease_start=COALESCE($24,lease_start), lease_end=COALESCE($25,lease_end),
        manager_id=$26, manager_name=$27,
        updated_at=NOW()
       WHERE id=$28 RETURNING *`,
      [
        title, description, type, address, district, latitude, longitude,
        bedrooms, bathrooms, squareFootage, rentPrice, deposit, availableFrom,
        amenities ? JSON.stringify(amenities) : null,
        photos ? JSON.stringify(photos) : null,
        status, managementFeePercent, itabFeePercent, isFeatured, tourUrl,
        landlordId, landlordName, tenantId, leaseStart, leaseEnd,
        managerId, managerName,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Property not found' });
    await scanPropertyLocationConflicts(req.params.id);
    res.json({ data: formatProperty(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/properties/:id/manager', auth, requireRole('admin'), requirePerm('properties', 'assignPropertyToManager'), async (req, res) => {
  try {
    const { managerId, managerName } = req.body;
    const existing = await pool.query('SELECT * FROM properties WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Property not found' });

    let nextManagerId = null;
    let nextManagerName = null;
    if (managerId) {
      const resolved = await resolveManagerFields(managerId, managerName);
      nextManagerId = resolved.managerId;
      nextManagerName = resolved.managerName;
    }

    const result = await pool.query(
      `UPDATE properties SET manager_id=$1, manager_name=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
      [nextManagerId, nextManagerName, req.params.id]
    );
    res.json({ data: formatProperty(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/property-conflicts', auth, requireRole('admin'), async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const result = await pool.query(
      `SELECT * FROM property_location_conflicts
       WHERE ($1 = 'all' OR status = $1)
       ORDER BY created_at DESC`,
      [status]
    );
    res.json({ data: result.rows.map(formatPropertyConflict) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/property-conflicts/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    if (!['confirmed_duplicate', 'not_duplicate'].includes(status)) {
      return res.status(400).json({ message: 'status must be confirmed_duplicate or not_duplicate' });
    }
    const result = await pool.query(
      `UPDATE property_location_conflicts SET
         status=$1, admin_notes=COALESCE($2, admin_notes),
         reviewed_by=$3, reviewed_at=NOW(), updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [status, adminNotes || null, req.user.id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Conflict not found' });
    res.json({ data: formatPropertyConflict(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/properties/:id', auth, requireRole('admin', 'property_manager'), requirePerm('properties', 'deleteProperty'), async (req, res) => {
  try {
    await pool.query('DELETE FROM properties WHERE id = $1', [req.params.id]);
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/properties/:id/feature', auth, requireRole('admin', 'property_manager'), requirePerm('properties', 'featureProperty'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE properties SET is_featured = NOT is_featured, updated_at=NOW() WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    res.json({ data: formatProperty(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/properties/:id/photos', auth, requirePerm('properties', 'uploadPropertyPhotos'), async (req, res) => {
  try {
    const { photoUrls } = req.body; // array of URLs (base64 or CDN)
    const prop = await pool.query('SELECT photos FROM properties WHERE id=$1', [req.params.id]);
    if (prop.rows.length === 0) return res.status(404).json({ message: 'Property not found' });
    const existing = prop.rows[0].photos || [];
    const merged = [...existing, ...(photoUrls || [])];
    const result = await pool.query(
      'UPDATE properties SET photos=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [JSON.stringify(merged), req.params.id]
    );
    res.json({ data: formatProperty(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INSPECTIONS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/inspections', auth, requirePerm('inspections', 'viewInspections'), async (req, res) => {
  try {
    let query = 'SELECT * FROM inspections WHERE 1=1';
    const params = [];
    let i = 1;
    if (req.user.role === 'tenant') { query += ` AND tenant_id = $${i}`; params.push(req.user.id); i++; }
    else if (req.user.role === 'property_manager' || req.user.role === 'agent') { query += ` AND manager_id = $${i}`; params.push(req.user.id); i++; }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatInspection) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/inspections/:id', auth, requirePerm('inspections', 'viewInspections'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inspections WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ data: formatInspection(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/inspections', auth, requireRole('tenant'), requirePerm('inspections', 'bookInspection'), async (req, res) => {
  try {
    const { propertyId, scheduledDate, scheduledTime } = req.body;
    const prop = await pool.query('SELECT * FROM properties WHERE id = $1', [propertyId]);
    if (prop.rows.length === 0) return res.status(404).json({ message: 'Property not found' });
    if (!(await assertDistrictAllowedForUser(req.user.id, prop.rows[0].district, res))) return;
    const tenantResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const tenant = tenantResult.rows[0];
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO inspections (id, property_id, property_title, property_address, tenant_id, tenant_name,
       manager_id, scheduled_date, scheduled_time, status, fee_amount, fee_paid, credit_applied, no_show_count, reschedule_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',100000,false,false,0,0) RETURNING *`,
      [id, propertyId, prop.rows[0].title, prop.rows[0].address, req.user.id,
       `${tenant.first_name} ${tenant.last_name}`, prop.rows[0].manager_id, scheduledDate, scheduledTime]
    );
    // Audit log: inspection booked
    pool.query(
      `INSERT INTO audit_logs (id,action,performed_by,performed_by_name,performed_by_role,target_name,description)
       VALUES ($1,'inspection_booked',$2,$3,$4,$5,$6)`,
      [uuidv4(), req.user.id, `${tenant.first_name} ${tenant.last_name}`, req.user.role,
       prop.rows[0].title, `Inspection booked for "${prop.rows[0].title}" on ${scheduledDate}`]
    ).catch(() => {});
    res.status(201).json({ data: formatInspection(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/inspections/:id/confirm', auth, requirePerm('inspections', 'confirmInspection'), async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE inspections SET status='confirmed', updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    res.json({ data: formatInspection(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/inspections/:id/cancel', auth, requirePerm('inspections', 'cancelInspection'), async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE inspections SET status='cancelled', updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    res.json({ data: formatInspection(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/inspections/:id/reschedule', auth, requirePerm('inspections', 'rescheduleInspection'), async (req, res) => {
  try {
    const { scheduledDate, scheduledTime } = req.body;
    const result = await pool.query(
      `UPDATE inspections SET scheduled_date=$1, scheduled_time=$2,
       reschedule_count=reschedule_count+1, status='pending', updated_at=NOW() WHERE id=$3 RETURNING *`,
      [scheduledDate, scheduledTime, req.params.id]
    );
    res.json({ data: formatInspection(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/inspections/:id/no-show', auth, requirePerm('inspections', 'markInspectionNoShow'), async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE inspections SET status='no_show', no_show_count=no_show_count+1, updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    res.json({ data: formatInspection(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/inspections/:id/pay', auth, requirePerm('inspections', 'payInspectionFee'), async (req, res) => {
  try {
    const { method, reference, status } = req.body;
    const payStatus = status || 'pending'; // pending until mobile money callback confirms
    const result = await pool.query(
      `UPDATE inspections SET
         fee_paid = CASE WHEN $1 = 'completed' THEN true ELSE fee_paid END,
         payment_method = $2,
         payment_ref = $3,
         updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [payStatus, method, reference, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Inspection not found' });

    // Also insert/upsert a payments record for the fee
    const insp = result.rows[0];
    await pool.query(
      `INSERT INTO payments (id, type, amount, currency, status, method, reference, property_id, property_title, tenant_id, tenant_name, created_at)
       VALUES ($1,'inspection_fee',$2,'UGX',$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        uuidv4(), insp.fee_amount || 100000, payStatus, method, reference,
        insp.property_id, insp.property_title, insp.tenant_id, insp.tenant_name,
      ]
    ).catch(() => {});

    res.json({ data: formatInspection(result.rows[0]) });
  } catch (err) {
    console.error('inspection pay:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/payments', auth, requireAnyPerm([['payments', 'viewOwnPayments'], ['payments', 'viewAllPayments']]), async (req, res) => {
  try {
    let query = 'SELECT * FROM payments WHERE 1=1';
    const params = [];
    let i = 1;
    if (!hasPermission(req.effectivePermissions, 'payments', 'viewAllPayments')) {
      if (req.user.role === 'tenant') { query += ` AND tenant_id = $${i}`; params.push(req.user.id); i++; }
      else if (req.user.role === 'landlord') { query += ` AND landlord_id = $${i}`; params.push(req.user.id); i++; }
      else {
        query += ` AND (tenant_id = $${i} OR landlord_id = $${i})`;
        params.push(req.user.id); i++;
      }
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatPayment) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/payments/:id', auth, requireAnyPerm([['payments', 'viewOwnPayments'], ['payments', 'viewAllPayments']]), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM payments WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    const row = result.rows[0];
    if (!hasPermission(req.effectivePermissions, 'payments', 'viewAllPayments')) {
      const ok = row.tenant_id === req.user.id || row.landlord_id === req.user.id;
      if (!ok) return res.status(403).json({ message: 'Forbidden', code: 'PERMISSION_DENIED' });
    }
    res.json({ data: formatPayment(row) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/payments/rent', auth, requireRole('tenant'), requireAnyPerm([['payments', 'payRentFull'], ['payments', 'payRentPartial'], ['payments', 'payRentAdvance']]), async (req, res) => {
  try {
    const { propertyId, propertyTitle, amount, method, reference, rentPeriod, isPartial, inspectionCreditApplied, landlordId, status } = req.body;
    const id = uuidv4();
    const tenantResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const tenant = tenantResult.rows[0];
    // Use provided status (pending for mobile money — callback will update to completed)
    const payStatus = status || 'completed';
    const result = await pool.query(
      `INSERT INTO payments (id, type, amount, currency, status, method, reference, property_id, property_title,
       tenant_id, tenant_name, landlord_id, inspection_credit_applied, rent_period, is_partial, paid_at)
       VALUES ($1,$2,$3,'UGX',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CASE WHEN $4='completed' THEN NOW() ELSE NULL END) RETURNING *`,
      [id, isPartial ? 'rent_partial' : 'rent', amount, payStatus, method, reference || `PAY-${Date.now()}`,
       propertyId, propertyTitle, req.user.id, `${tenant.first_name} ${tenant.last_name}`,
       landlordId || null, inspectionCreditApplied || 0, rentPeriod || null, isPartial || false]
    );
    res.status(201).json({ data: formatPayment(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── MTN MoMo helpers ─────────────────────────────────────────────────────────
const MTN_BASE = process.env.MTN_ENVIRONMENT === 'production'
  ? 'https://proxy.momoapi.mtn.com'
  : 'https://sandbox.momodeveloper.mtn.com';

/** Get an OAuth2 access token from MTN MoMo */
async function getMtnToken() {
  const key    = process.env.MTN_API_USER;
  const secret = process.env.MTN_API_KEY;
  const subKey = process.env.MTN_SUBSCRIPTION_KEY;
  if (!key || !secret || !subKey) return null; // credentials not set yet

  const creds  = Buffer.from(`${key}:${secret}`).toString('base64');
  const resp   = await fetch(`${MTN_BASE}/collection/token/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Ocp-Apim-Subscription-Key': subKey,
    },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.access_token || null;
}

app.post('/api/payments/mtn/initiate', auth, requireAnyPerm([
  ['payments', 'payRentFull'], ['payments', 'payRentPartial'],
  ['payments', 'payRentAdvance'], ['inspections', 'payInspectionFee'],
]), async (req, res) => {
  try {
    const { phone, amount, reference: clientRef } = req.body;
    const reference  = clientRef || `MTN-${Date.now()}`;
    const subKey     = process.env.MTN_SUBSCRIPTION_KEY;
    const mtnEnv     = process.env.MTN_ENVIRONMENT || 'sandbox';

    // ── Real MTN MoMo request-to-pay ──────────────────────────────────────
    if (subKey && subKey !== 'your_mtn_subscription_key') {
      const token = await getMtnToken();
      if (!token) {
        console.error('[MTN] Could not get access token');
        return res.status(502).json({ message: 'MTN payment gateway error — check credentials' });
      }

      // Normalize phone: strip leading 0 and prepend Uganda country code 256
      const normalizedPhone = phone.replace(/^0/, '256').replace(/\s+/g, '');

      const payload = {
        amount: String(amount || 0),
        currency: 'UGX',
        externalId: reference,
        payer: { partyIdType: 'MSISDN', partyId: normalizedPhone },
        payerMessage: 'ITAB Property Payment',
        payeeNote: `Payment ref: ${reference}`,
      };

      const mtnResp = await fetch(`${MTN_BASE}/collection/v1_0/requesttopay`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Reference-Id': reference,
          'X-Target-Environment': mtnEnv,
          'Ocp-Apim-Subscription-Key': subKey,
          'Content-Type': 'application/json',
          // Callback URL — MTN will POST here when transaction completes
          'X-Callback-Url': 'https://itabproperties.com/api/payments/mtn/callback',
        },
        body: JSON.stringify(payload),
      });

      if (mtnResp.status === 202) {
        // 202 Accepted — USSD prompt is being sent to the user's phone
        console.log(`[MTN] Request-to-pay initiated: ref=${reference} phone=${normalizedPhone}`);
        return res.json({ data: { reference, status: 'pending', message: `MTN MoMo PIN prompt sent to ${phone}. Enter your PIN to complete payment.` } });
      }

      const errBody = await mtnResp.text();
      console.error(`[MTN] Request-to-pay failed: ${mtnResp.status} — ${errBody}`);
      return res.status(502).json({ message: `MTN payment failed: ${mtnResp.status}` });
    }

    // ── Sandbox / no credentials: simulate callback after 5s ─────────────
    console.log(`[MTN SANDBOX] Simulated USSD prompt to ${phone} ref=${reference}`);

    // Auto-fire the callback after 5 seconds to simulate user entering PIN
    setTimeout(async () => {
      try {
        await pool.query(
          `UPDATE payments SET status='completed', paid_at=NOW() WHERE reference=$1`,
          [reference]
        );
        await pool.query(
          `UPDATE transactions SET status='completed', processed_at=NOW() WHERE reference=$1`,
          [reference]
        );
        await pool.query(
          `UPDATE inspections SET fee_paid=true, updated_at=NOW() WHERE payment_ref=$1`,
          [reference]
        );
        console.log(`[MTN SANDBOX] Auto-confirmed payment ref=${reference}`);
      } catch (e) { /* non-fatal */ }
    }, 5000);

    res.json({ data: { reference, status: 'pending', message: `MTN MoMo PIN prompt sent to ${phone}. Enter your PIN to complete payment.` } });

  } catch (err) {
    console.error('[MTN initiate]', err);
    res.status(500).json({ message: 'MTN payment gateway error' });
  }
});

// ─── Airtel Money helpers ─────────────────────────────────────────────────────
const AIRTEL_BASE = process.env.AIRTEL_ENVIRONMENT === 'production'
  ? 'https://openapi.airtel.africa'
  : 'https://openapiuat.airtel.africa';

/** Get an OAuth2 access token from Airtel Africa */
async function getAirtelToken() {
  const clientId     = process.env.AIRTEL_CLIENT_ID;
  const clientSecret = process.env.AIRTEL_CLIENT_SECRET;
  if (!clientId || clientId === 'your_airtel_client_id') return null;

  const resp = await fetch(`${AIRTEL_BASE}/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.access_token || null;
}

app.post('/api/payments/airtel/initiate', auth, requireAnyPerm([
  ['payments', 'payRentFull'], ['payments', 'payRentPartial'],
  ['payments', 'payRentAdvance'], ['inspections', 'payInspectionFee'],
]), async (req, res) => {
  try {
    const { phone, amount, reference: clientRef } = req.body;
    const reference    = clientRef || `AIR-${Date.now()}`;
    const clientId     = process.env.AIRTEL_CLIENT_ID;

    // ── Real Airtel Money collection ───────────────────────────────────────
    if (clientId && clientId !== 'your_airtel_client_id') {
      const token = await getAirtelToken();
      if (!token) {
        console.error('[Airtel] Could not get access token');
        return res.status(502).json({ message: 'Airtel payment gateway error — check credentials' });
      }

      // Normalize phone: strip leading 0 and prepend 256 (Uganda)
      const normalizedPhone = phone.replace(/^0/, '256').replace(/\s+/g, '');

      const payload = {
        reference,
        subscriber: {
          country: 'UG',
          currency: 'UGX',
          msisdn: normalizedPhone,
        },
        transaction: {
          amount: String(amount || 0),
          country: 'UG',
          currency: 'UGX',
          id: reference,
        },
      };

      const airtelResp = await fetch(`${AIRTEL_BASE}/merchant/v1/payments/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Country': 'UG',
          'X-Currency': 'UGX',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const airtelData = await airtelResp.json().catch(() => ({}));

      if (airtelResp.ok || airtelResp.status === 200) {
        console.log(`[Airtel] Payment initiated: ref=${reference} phone=${normalizedPhone}`);

        // Store a pending payment record so callback can update it
        if (amount) {
          pool.query(
            `INSERT INTO payments (id, type, amount, currency, status, method, reference, created_at)
             VALUES ($1,'airtel_initiate',$2,'UGX','pending','airtel_money',$3,NOW())
             ON CONFLICT DO NOTHING`,
            [uuidv4(), amount, reference]
          ).catch(() => {});
        }

        return res.json({ data: { reference, status: 'pending', message: `Airtel Money PIN prompt sent to ${phone}. Enter your PIN to complete payment.` } });
      }

      console.error(`[Airtel] Collection failed: ${airtelResp.status} — ${JSON.stringify(airtelData)}`);
      return res.status(502).json({ message: `Airtel payment failed: ${airtelData?.status?.message || airtelResp.status}` });
    }

    // ── Sandbox / no credentials: simulate callback after 5s ─────────────
    if (amount) {
      pool.query(
        `INSERT INTO payments (id, type, amount, currency, status, method, reference, created_at)
         VALUES ($1,'airtel_initiate',$2,'UGX','pending','airtel_money',$3,NOW())
         ON CONFLICT DO NOTHING`,
        [uuidv4(), amount, reference]
      ).catch(() => {});
    }

    console.log(`[Airtel SANDBOX] Simulated PIN prompt to ${phone} ref=${reference}`);

    // Auto-fire the callback after 5 seconds to simulate user entering PIN
    setTimeout(async () => {
      try {
        await pool.query(
          `UPDATE payments SET status='completed', paid_at=NOW() WHERE reference=$1`,
          [reference]
        );
        await pool.query(
          `UPDATE transactions SET status='completed', processed_at=NOW() WHERE reference=$1`,
          [reference]
        );
        await pool.query(
          `UPDATE inspections SET fee_paid=true, updated_at=NOW() WHERE payment_ref=$1`,
          [reference]
        );
        console.log(`[Airtel SANDBOX] Auto-confirmed payment ref=${reference}`);
      } catch (e) { /* non-fatal */ }
    }, 5000);

    res.json({ data: { reference, status: 'pending', message: `Airtel Money PIN prompt sent to ${phone}. Enter your PIN to complete payment.` } });

  } catch (err) {
    console.error('[Airtel initiate]', err);
    res.status(500).json({ message: 'Airtel payment gateway error' });
  }
});

// ─── Airtel Money Callback (no auth — Airtel calls this directly) ─────────────
// Give Airtel this URL: https://itabproperties.com/api/payments/airtel/callback
app.post('/api/payments/airtel/callback', async (req, res) => {
  try {
    const body = req.body || {};

    // Airtel Uganda callback payload structure:
    // { transaction: { id, message, status_code, airtel_money_id }, status: { code, message, result_code } }
    const transaction = body.transaction || body.data?.transaction || {};
    const statusObj   = body.status || body.data?.status || {};

    const reference   = transaction.id || transaction.airtel_money_id || body.reference || null;
    const statusCode  = statusObj.code || statusObj.result_code || transaction.status_code || '';
    const isSuccess   = statusCode === 'TS' || statusCode === 'SUCCESS' || statusCode === '200' || statusCode === 'S';
    const isFailed    = statusCode === 'TF' || statusCode === 'FAILED' || statusCode === 'TS-F';

    console.log(`[Airtel Callback] ref=${reference} status=${statusCode} success=${isSuccess}`);

    if (reference) {
      const newStatus = isSuccess ? 'completed' : isFailed ? 'failed' : 'pending';

      // Update payments table
      await pool.query(
        `UPDATE payments
            SET status = $1, paid_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE paid_at END
          WHERE reference = $2`,
        [newStatus, reference]
      );

      // Update transactions table (sender is tenant, so reference is on the tx)
      await pool.query(
        `UPDATE transactions
            SET status = $1, processed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE processed_at END
          WHERE reference = $2`,
        [newStatus, reference]
      );

      // Update inspection fee_paid if this reference matches an inspection payment
      if (isSuccess) {
        await pool.query(
          `UPDATE inspections SET fee_paid = true, updated_at = NOW() WHERE payment_ref = $1`,
          [reference]
        );
      }

      // Write audit log
      pool.query(
        `INSERT INTO audit_logs (id, action, performed_by, performed_by_name, description, metadata)
         VALUES ($1, 'airtel_callback', 'airtel_gateway', 'Airtel Money Gateway',
                 $2, $3::jsonb)`,
        [
          uuidv4(),
          `Airtel callback: ref=${reference} status=${newStatus}`,
          JSON.stringify({ reference, statusCode, isSuccess, body }),
        ]
      ).catch(() => {});
    }

    // Always respond 200 to Airtel — they retry if they get anything else
    res.status(200).json({ status: 'OK', reference, processed: true });
  } catch (err) {
    console.error('[Airtel Callback] Error:', err);
    // Still 200 — we don't want Airtel to keep retrying due to our internal errors
    res.status(200).json({ status: 'ERROR', message: 'Internal error logged', processed: false });
  }
});

// ─── MTN MoMo Callback (no auth — MTN calls this directly) ───────────────────
// Give MTN this URL: https://itabproperties.com/api/payments/mtn/callback
app.post('/api/payments/mtn/callback', async (req, res) => {
  try {
    const body = req.body || {};

    // MTN MoMo callback payload: { financialTransactionId, externalId, status, reason }
    const reference  = body.externalId || body.financialTransactionId || body.reference || null;
    const mtnStatus  = (body.status || '').toUpperCase();
    const isSuccess  = mtnStatus === 'SUCCESSFUL' || mtnStatus === 'SUCCESS';
    const isFailed   = mtnStatus === 'FAILED';

    console.log(`[MTN Callback] ref=${reference} status=${mtnStatus} success=${isSuccess}`);

    if (reference) {
      const newStatus = isSuccess ? 'completed' : isFailed ? 'failed' : 'pending';

      await pool.query(
        `UPDATE payments
            SET status = $1, paid_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE paid_at END
          WHERE reference = $2`,
        [newStatus, reference]
      );

      await pool.query(
        `UPDATE transactions
            SET status = $1, processed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE processed_at END
          WHERE reference = $2`,
        [newStatus, reference]
      );

      if (isSuccess) {
        await pool.query(
          `UPDATE inspections SET fee_paid = true, updated_at = NOW() WHERE payment_ref = $1`,
          [reference]
        );
      }

      pool.query(
        `INSERT INTO audit_logs (id, action, performed_by, performed_by_name, description, metadata)
         VALUES ($1, 'mtn_callback', 'mtn_gateway', 'MTN MoMo Gateway', $2, $3::jsonb)`,
        [
          uuidv4(),
          `MTN callback: ref=${reference} status=${newStatus}`,
          JSON.stringify({ reference, mtnStatus, isSuccess, body }),
        ]
      ).catch(() => {});
    }

    res.status(200).json({ status: 'OK', reference, processed: true });
  } catch (err) {
    console.error('[MTN Callback] Error:', err);
    res.status(200).json({ status: 'ERROR', message: 'Internal error logged', processed: false });
  }
});

app.get('/api/payments/status/:ref', auth, requireAnyPerm([['payments', 'viewOwnPayments'], ['payments', 'viewAllPayments'], ['payments', 'payRentFull'], ['payments', 'payRentPartial'], ['payments', 'payRentAdvance']]), async (req, res) => {
  try {
    const ref = req.params.ref;
    // Check payments table first
    const pmtResult = await pool.query('SELECT status FROM payments WHERE reference = $1 LIMIT 1', [ref]);
    if (pmtResult.rows.length) {
      return res.json({ data: { reference: ref, status: pmtResult.rows[0].status } });
    }
    // Fallback to transactions table
    const txResult = await pool.query('SELECT status FROM transactions WHERE reference = $1 LIMIT 1', [ref]);
    if (txResult.rows.length) {
      return res.json({ data: { reference: ref, status: txResult.rows[0].status } });
    }
    res.json({ data: { reference: ref, status: 'pending' } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/payments/:id/receipt', auth, requirePerm('payments', 'downloadReceipt'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM payments WHERE id=$1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Payment not found' });
    const p = result.rows[0];

    // Verify ownership
    if (!hasPermission(req.effectivePermissions, 'payments', 'viewAllPayments')) {
      if (p.tenant_id !== req.user.id && p.landlord_id !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden', code: 'PERMISSION_DENIED' });
      }
    }

    // Build a structured receipt object (frontend uses this to render a printable receipt)
    const receipt = {
      receiptNumber: `RCP-${p.id.slice(0, 8).toUpperCase()}`,
      issuedAt: new Date().toISOString(),
      paymentId: p.id,
      type: p.type,
      status: p.status,
      amount: p.amount,
      currency: p.currency || 'UGX',
      method: p.method,
      reference: p.reference,
      propertyTitle: p.property_title,
      tenantName: p.tenant_name,
      rentPeriod: p.rent_period,
      isPartial: p.is_partial,
      inspectionCreditApplied: p.inspection_credit_applied,
      paidAt: p.paid_at,
      createdAt: p.created_at,
      issuedBy: 'ITAB Property Services',
      note: p.type === 'inspection_fee'
        ? 'Inspection fee is non-refundable. It will be credited toward your first month\'s rent if you sign a lease.'
        : p.is_partial
          ? 'This is a partial payment. Remaining balance must be settled by the due date.'
          : 'Thank you for your payment.',
    };

    res.json({ data: { receipt, receiptUrl: null } });
  } catch (err) {
    console.error('receipt:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/transactions', auth, requireAnyPerm([['transactions', 'viewOwnTransactions'], ['transactions', 'viewAllTransactions']]), async (req, res) => {
  try {
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];
    let i = 1;
    if (!hasPermission(req.effectivePermissions, 'transactions', 'viewAllTransactions')) {
      query += ` AND (sender_id = $${i} OR receiver_id = $${i})`;
      params.push(req.user.id); i++;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatTransaction) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/transactions', auth, requireAnyPerm([['transactions', 'viewOwnTransactions'], ['transactions', 'viewAllTransactions']]), async (req, res) => {
  try {
    const tx = req.body;
    const id = tx.id || uuidv4();
    const result = await pool.query(
      `INSERT INTO transactions (id, type, sender_id, sender_name, sender_role, sender_method, sender_phone,
       receiver_id, receiver_name, receiver_role, receiver_method, receiver_phone, receiver_bank_details,
       amount, currency, reference, status, property_id, property_title, job_id, contract_id,
       description, inspection_credit_applied, rent_period, is_partial, created_at, processed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,
       COALESCE($26,NOW()), COALESCE($27,NOW()))
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, processed_at=EXCLUDED.processed_at
       RETURNING *`,
      [
        id, tx.type, tx.senderId, tx.senderName, tx.senderRole, tx.senderMethod, tx.senderPhone || null,
        tx.receiverId, tx.receiverName, tx.receiverRole, tx.receiverMethod, tx.receiverPhone || null,
        tx.receiverBankDetails ? JSON.stringify(tx.receiverBankDetails) : null,
        tx.amount, tx.currency || 'UGX', tx.reference, tx.status || 'completed',
        tx.propertyId || null, tx.propertyTitle || null, tx.jobId || null, tx.contractId || null,
        tx.description, tx.inspectionCreditApplied || 0, tx.rentPeriod || null, tx.isPartial || false,
        tx.createdAt || null, tx.processedAt || null,
      ]
    );
    res.status(201).json({ data: formatTransaction(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/transactions/:id/retry', auth, requireRole('admin', 'property_manager'), requirePerm('transactions', 'retryFailedTransaction'), async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE transactions SET status='completed', processed_at=NOW(), failure_reason=NULL WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    res.json({ data: formatTransaction(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/transactions/:id/refund', auth, requireRole('admin'), requirePerm('transactions', 'refundTransaction'), async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE transactions SET status='refunded', updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    res.json({ data: formatTransaction(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAINTENANCE ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/maintenance', auth, requireAnyPerm([['maintenance', 'viewOwnMaintenance'], ['maintenance', 'viewAllMaintenance']]), async (req, res) => {
  try {
    let query = 'SELECT * FROM maintenance_requests WHERE 1=1';
    const params = [];
    let i = 1;
    if (req.user.role === 'tenant') { query += ` AND tenant_id = $${i}`; params.push(req.user.id); i++; }
    else if (req.user.role === 'vendor') { query += ` AND vendor_id = $${i}`; params.push(req.user.id); i++; }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatMaintenance) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/maintenance/:id', auth, requireAnyPerm([['maintenance', 'viewOwnMaintenance'], ['maintenance', 'viewAllMaintenance']]), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM maintenance_requests WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ data: formatMaintenance(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/maintenance', auth, requireRole('tenant', 'property_manager', 'landlord'), requirePerm('maintenance', 'submitMaintenanceRequest'), async (req, res) => {
  try {
    const { propertyId, propertyTitle, title, description, priority, photos } = req.body;
    const prop = await pool.query('SELECT district FROM properties WHERE id = $1', [propertyId]);
    if (prop.rows.length === 0) return res.status(404).json({ message: 'Property not found' });
    if (!(await assertDistrictAllowedForUser(req.user.id, prop.rows[0].district, res))) return;
    const tenantResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const tenant = tenantResult.rows[0];
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO maintenance_requests (id, property_id, property_title, tenant_id, tenant_name,
       title, description, priority, status, photos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'submitted',$9) RETURNING *`,
      [id, propertyId, propertyTitle, req.user.id, `${tenant.first_name} ${tenant.last_name}`,
       title, description, priority || 'normal', JSON.stringify(photos || [])]
    );
    // Audit log: maintenance request submitted
    pool.query(
      `INSERT INTO audit_logs (id,action,performed_by,performed_by_name,performed_by_role,target_name,description)
       VALUES ($1,'maintenance_submitted',$2,$3,$4,$5,$6)`,
      [uuidv4(), req.user.id, `${tenant.first_name} ${tenant.last_name}`, req.user.role,
       propertyTitle || 'Property', `Maintenance request "${title}" submitted for ${propertyTitle}`]
    ).catch(() => {});
    res.status(201).json({ data: formatMaintenance(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/maintenance/:id', auth, MAINT_PUT_ANY, async (req, res) => {
  try {
    const { status, vendorId, vendorName, estimatedCost, actualCost } = req.body;
    const result = await pool.query(
      `UPDATE maintenance_requests SET
       status=COALESCE($1,status), vendor_id=COALESCE($2,vendor_id), vendor_name=COALESCE($3,vendor_name),
       estimated_cost=COALESCE($4,estimated_cost), actual_cost=COALESCE($5,actual_cost),
       completed_at=CASE WHEN $1='completed' THEN NOW() ELSE completed_at END,
       updated_at=NOW() WHERE id=$6 RETURNING *`,
      [status, vendorId, vendorName, estimatedCost, actualCost, req.params.id]
    );
    res.json({ data: formatMaintenance(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/maintenance/:id/assign', auth, requireRole('admin', 'property_manager', 'landlord'), requirePerm('maintenance', 'assignVendorToJob'), async (req, res) => {
  try {
    const { vendorId } = req.body;
    const vendor = await pool.query('SELECT * FROM vendors WHERE id=$1', [vendorId]);
    const vendorName = vendor.rows.length > 0 ? `${vendor.rows[0].first_name} ${vendor.rows[0].last_name}` : vendorId;
    const result = await pool.query(
      "UPDATE maintenance_requests SET vendor_id=$1, vendor_name=$2, status='assigned', updated_at=NOW() WHERE id=$3 RETURNING *",
      [vendorId, vendorName, req.params.id]
    );
    res.json({ data: formatMaintenance(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/maintenance/:id/complete', auth, requirePerm('maintenance', 'markMaintenanceCompleted'), async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE maintenance_requests SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    res.json({ data: formatMaintenance(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUTS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/payouts', auth, requireAnyPerm([['payouts', 'viewOwnPayouts'], ['payouts', 'viewAllPayouts']]), async (req, res) => {
  try {
    let query = 'SELECT * FROM payouts WHERE 1=1';
    const params = [];
    let i = 1;
    if (!hasPermission(req.effectivePermissions, 'payouts', 'viewAllPayouts')) {
      query += ` AND landlord_id = $${i}`;
      params.push(req.user.id); i++;
    }
    query += ' ORDER BY scheduled_date DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatPayout) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/payouts/:id/process', auth, requireRole('admin', 'property_manager'), requirePerm('payouts', 'processPayout'), async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE payouts SET status='completed', processed_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    const p = result.rows[0];
    // Audit log: payout processed
    pool.query(
      `INSERT INTO audit_logs (id,action,performed_by,performed_by_name,performed_by_role,target_name,description)
       VALUES ($1,'payout_processed',$2,$3,$4,$5,$6)`,
      [uuidv4(), req.user.id, req.user.name, req.user.role,
       p?.landlord_name || 'Landlord', `Payout of ${p?.net_amount || 0} UGX processed for ${p?.property_title || 'property'}`]
    ).catch(() => {});
    res.json({ data: formatPayout(p) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/payouts/:id/retry', auth, requireRole('admin', 'property_manager'), requirePerm('payouts', 'retryFailedPayout'), async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE payouts SET status='processing', retry_count=retry_count+1 WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    res.json({ data: formatPayout(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGES ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/messages/conversations', auth, requirePerm('messages', 'viewMessages'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, 
        (SELECT row_to_json(m) FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.is_read=false AND m.sender_id != $1) as unread_count
       FROM conversations c
       WHERE c.participants @> $2::jsonb
       ORDER BY c.updated_at DESC`,
      [req.user.id, JSON.stringify([{ id: req.user.id }])]
    );
    res.json({ data: result.rows.map(formatConversation) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/messages/:convId', auth, requirePerm('messages', 'viewMessages'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM messages WHERE conversation_id=$1 ORDER BY created_at ASC',
      [req.params.convId]
    );
    // Mark as read
    await pool.query(
      'UPDATE messages SET is_read=true WHERE conversation_id=$1 AND sender_id != $2',
      [req.params.convId, req.user.id]
    ).catch(() => {});
    res.json({ data: result.rows.map(formatMessage) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/messages/conversations', auth, requirePerm('messages', 'sendMessage'), async (req, res) => {
  try {
    const { participantIds, participantDetails, propertyId, propertyTitle } = req.body;
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO conversations (id, participants, property_id, property_title, unread_count)
       VALUES ($1,$2,$3,$4,0) RETURNING *`,
      [id, JSON.stringify(participantDetails || participantIds), propertyId || null, propertyTitle || null]
    );
    res.status(201).json({ data: formatConversation(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/messages/:convId', auth, requirePerm('messages', 'sendMessage'), async (req, res) => {
  try {
    const { content } = req.body;
    const senderResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const sender = senderResult.rows[0];
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO messages (id, conversation_id, sender_id, sender_name, sender_avatar, content, is_read)
       VALUES ($1,$2,$3,$4,$5,$6,false) RETURNING *`,
      [id, req.params.convId, req.user.id, `${sender.first_name} ${sender.last_name}`, sender.avatar || null, content]
    );
    // Update conversation updated_at
    await pool.query('UPDATE conversations SET updated_at=NOW() WHERE id=$1', [req.params.convId]).catch(() => {});
    res.status(201).json({ data: formatMessage(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/notifications', auth, requirePerm('settings', 'manageNotificationPreferences'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json({ data: result.rows.map(formatNotification) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/notifications/:id/read', auth, requirePerm('settings', 'manageNotificationPreferences'), async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/notifications/read-all', auth, requirePerm('settings', 'manageNotificationPreferences'), async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=true WHERE user_id=$1', [req.user.id]);
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/notifications', auth, requirePerm('notices', 'sendNotice'), async (req, res) => {
  try {
    const { userId, type, title, body, actionUrl } = req.body;
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO notifications (id, user_id, type, title, body, is_read, action_url)
       VALUES ($1,$2,$3,$4,$5,false,$6) RETURNING *`,
      [id, userId || req.user.id, type, title, body, actionUrl || null]
    );
    res.status(201).json({ data: formatNotification(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// VENDORS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/vendors', auth, requirePerm('vendors', 'viewVendors'), async (req, res) => {
  try {
    const { category, district } = req.query;
    let query = 'SELECT * FROM vendors WHERE 1=1';
    const params = [];
    let i = 1;
    if (category) { query += ` AND category = $${i}`; params.push(category); i++; }
    if (district) { query += ` AND district = $${i}`; params.push(district); i++; }
    query += ' ORDER BY rating DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatVendor) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/vendors/:id', auth, requirePerm('vendors', 'viewVendors'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vendors WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ data: formatVendor(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/vendors', auth, requireRole('admin', 'property_manager'), requirePerm('vendors', 'addVendor'), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, category, skills, bio, district, address, dailyRate, hourlyRate } = req.body;
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO vendors (id, first_name, last_name, email, phone, category, skills, bio, district, address,
       daily_rate, hourly_rate, rating, total_ratings, total_jobs, completed_jobs, is_active, is_verified, is_suspended, availability)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,0,0,0,true,false,false,'available') RETURNING *`,
      [id, firstName, lastName, email, phone, category, JSON.stringify(skills || []), bio || null, district, address || null, dailyRate || null, hourlyRate || null]
    );
    res.status(201).json({ data: formatVendor(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/vendors/:id', auth, async (req, res) => {
  // Allow admin/property_manager with editVendor perm, OR the vendor updating their OWN record
  const isAdminOrManager = ['admin', 'property_manager'].includes(req.user.role);
  const isOwnVendorRecord = req.user.role === 'vendor'; // will verify ownership below

  if (!isAdminOrManager && !isOwnVendorRecord) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  if (isAdminOrManager && !hasPermission(req.effectivePermissions, 'vendors', 'editVendor') && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You do not have permission to edit vendor profiles.' });
  }

  try {
    // If vendor role, verify they own this vendor record
    if (isOwnVendorRecord) {
      const ownership = await pool.query('SELECT id FROM vendors WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
      if (!ownership.rows.length) {
        return res.status(403).json({ message: 'You can only update your own vendor profile.' });
      }
    }

    const { firstName, lastName, phone, category, skills, bio, district, address, dailyRate, hourlyRate, availability, isActive } = req.body;
    const result = await pool.query(
      `UPDATE vendors SET first_name=COALESCE($1,first_name), last_name=COALESCE($2,last_name),
       phone=COALESCE($3,phone), category=COALESCE($4,category), skills=COALESCE($5,skills),
       bio=COALESCE($6,bio), district=COALESCE($7,district), address=COALESCE($8,address),
       daily_rate=COALESCE($9,daily_rate), hourly_rate=COALESCE($10,hourly_rate),
       availability=COALESCE($11,availability), is_active=COALESCE($12,is_active)
       WHERE id=$13 RETURNING *`,
      [firstName, lastName, phone, category, skills ? JSON.stringify(skills) : null,
       bio, district, address, dailyRate, hourlyRate, availability, isActive, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Vendor not found' });
    res.json({ data: formatVendor(result.rows[0]) });
  } catch (err) {
    console.error('vendors PUT:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/vendors/:id/rate', auth, requirePerm('maintenance', 'rateVendorAfterJob'), async (req, res) => {
  try {
    const { rating, jobId, comment, ratedByName } = req.body;
    const id = uuidv4();
    await pool.query(
      `INSERT INTO vendor_ratings (id, vendor_id, job_id, rated_by, rated_by_name, rating, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, req.params.id, jobId || null, req.user.id, ratedByName || 'User', rating, comment || '']
    ).catch(() => {});
    // Recalculate average
    const avgResult = await pool.query('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM vendor_ratings WHERE vendor_id=$1', [req.params.id]);
    const avg = parseFloat(avgResult.rows[0].avg) || rating;
    const cnt = parseInt(avgResult.rows[0].cnt) || 1;
    const result = await pool.query(
      'UPDATE vendors SET rating=$1, total_ratings=$2 WHERE id=$3 RETURNING *',
      [Math.round(avg * 10) / 10, cnt, req.params.id]
    );
    res.json({ data: formatVendor(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Vendor jobs
app.get('/api/vendor-jobs', auth, requireAnyPerm([['maintenance', 'viewOwnMaintenance'], ['maintenance', 'viewAllMaintenance']]), async (req, res) => {
  try {
    let query = 'SELECT * FROM vendor_jobs WHERE 1=1';
    const params = [];
    let i = 1;
    if (req.user.role === 'vendor') {
      // Look up this user's vendor record ID, then filter jobs by that vendor_id
      const vendorRow = await pool.query('SELECT id FROM vendors WHERE user_id = $1 LIMIT 1', [req.user.id]);
      if (vendorRow.rows.length > 0) {
        query += ` AND vendor_id = $${i}`;
        params.push(vendorRow.rows[0].id);
        i++;
      } else {
        // Vendor user has no vendor record yet — return empty list
        return res.json({ data: [] });
      }
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatVendorJob) });
  } catch (err) {
    console.error('vendor-jobs GET:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/vendor-jobs', auth, requireRole('admin', 'property_manager', 'landlord'), requirePerm('maintenance', 'assignVendorToJob'), async (req, res) => {
  try {
    const { vendorId, vendorName, maintenanceRequestId, propertyTitle, propertyAddress, title, description, scheduledDate, estimatedCost, managerNotes } = req.body;
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO vendor_jobs (id, vendor_id, vendor_name, maintenance_request_id, property_title, property_address,
       title, description, status, scheduled_date, estimated_cost, manager_notes, photos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'assigned',$9,$10,$11,'[]') RETURNING *`,
      [id, vendorId, vendorName, maintenanceRequestId || null, propertyTitle, propertyAddress || '',
       title, description, scheduledDate || null, estimatedCost || null, managerNotes || null]
    );
    res.status(201).json({ data: formatVendorJob(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/vendor-jobs/:id', auth, requireAnyPerm([['maintenance', 'rateVendorAfterJob'], ['maintenance', 'markMaintenanceCompleted'], ['maintenance', 'markMaintenanceInProgress']]), async (req, res) => {
  try {
    const { status, actualCost, vendorNotes, rating, ratingComment } = req.body;
    const result = await pool.query(
      `UPDATE vendor_jobs SET status=COALESCE($1,status), actual_cost=COALESCE($2,actual_cost),
       vendor_notes=COALESCE($3,vendor_notes), rating=COALESCE($4,rating),
       rating_comment=COALESCE($5,rating_comment),
       completed_date=CASE WHEN $1='completed' THEN NOW() ELSE completed_date END,
       updated_at=NOW() WHERE id=$6 RETURNING *`,
      [status, actualCost, vendorNotes, rating, ratingComment, req.params.id]
    );
    res.json({ data: formatVendorJob(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR CONTRACTS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/contracts', auth, requirePerm('contracts', 'viewContracts'), async (req, res) => {
  try {
    let query = 'SELECT * FROM vendor_contracts WHERE 1=1';
    const params = [];
    let i = 1;
    if (req.user.role === 'vendor') { query += ` AND vendor_id = $${i}`; params.push(req.user.id); i++; }
    else if (req.user.role === 'property_manager') { query += ` AND manager_id = $${i}`; params.push(req.user.id); i++; }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatContract) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/contracts', auth, requireRole('admin', 'property_manager'), requirePerm('contracts', 'createContract'), async (req, res) => {
  try {
    const { vendorId, vendorName, propertyId, propertyTitle, type, description, amount, currency, startDate, endDate, paymentMethod, nextPaymentDate } = req.body;
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO vendor_contracts (id, vendor_id, vendor_name, property_id, property_title, manager_id,
       type, description, amount, currency, start_date, end_date, status, payment_method, next_payment_date, total_paid, payments_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',$13,$14,0,0) RETURNING *`,
      [id, vendorId, vendorName, propertyId, propertyTitle, req.user.id, type, description, amount, currency || 'UGX', startDate, endDate || null, paymentMethod, nextPaymentDate || null]
    );
    res.status(201).json({ data: formatContract(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/contracts/:id', auth, requirePerm('contracts', 'editContract'), async (req, res) => {
  try {
    const { status, nextPaymentDate } = req.body;
    const result = await pool.query(
      'UPDATE vendor_contracts SET status=COALESCE($1,status), next_payment_date=COALESCE($2,next_payment_date), updated_at=NOW() WHERE id=$3 RETURNING *',
      [status, nextPaymentDate, req.params.id]
    );
    res.json({ data: formatContract(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENTS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/documents', auth, requireAnyPerm([['documents', 'viewOwnDocuments'], ['documents', 'viewAllDocuments']]), async (req, res) => {
  try {
    let query = 'SELECT * FROM documents WHERE 1=1';
    const params = [];
    let i = 1;
    // Admin can filter by owner_id via query param
    if (req.query.ownerId && hasPermission(req.effectivePermissions, 'documents', 'viewAllDocuments')) {
      query += ` AND owner_id = $${i}`;
      params.push(req.query.ownerId); i++;
    } else if (!hasPermission(req.effectivePermissions, 'documents', 'viewAllDocuments')) {
      query += ` AND owner_id = $${i}`;
      params.push(req.user.id); i++;
    }
    query += ' ORDER BY uploaded_at DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatDocument) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/documents', auth, requirePerm('documents', 'uploadDocument'), async (req, res) => {
  try {
    const { name, category, fileUrl, fileType, fileSize, expiresAt, ownerName, ownerRole } = req.body;
    const id = uuidv4();
    const userResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = userResult.rows[0];
    const result = await pool.query(
      `INSERT INTO documents (id, owner_id, owner_name, owner_role, name, category, status, file_url, file_type, file_size, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10) RETURNING *`,
      [id, req.user.id, ownerName || `${user.first_name} ${user.last_name}`,
       ownerRole || user.role, name, category, fileUrl || '', fileType || 'application/octet-stream',
       fileSize || 0, expiresAt || null]
    );

    // Notify all admins about the new document pending review
    const uploaderName = ownerName || `${user.first_name} ${user.last_name}`;
    const admins = await pool.query(`SELECT id FROM users WHERE role = 'admin' AND is_suspended = false`);
    for (const a of admins.rows) {
      await pool.query(
        `INSERT INTO notifications (id, user_id, type, title, body, is_read, action_url)
         VALUES ($1, $2, 'document_review', $3, $4, false, '/documents')`,
        [
          uuidv4(),
          a.id,
          'New Document Uploaded',
          `${uploaderName} uploaded "${name}" (${category}) for review.`,
        ]
      ).catch(() => {});
    }

    res.status(201).json({ data: formatDocument(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/documents/:id/approve', auth, requireRole('admin'), requirePerm('documents', 'approveKYCDocument'), async (req, res) => {
  try {
    const { notes } = req.body;
    const adminResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const admin = adminResult.rows[0];
    const result = await pool.query(
      `UPDATE documents SET status='approved', reviewed_by=$1, reviewed_at=NOW(), admin_notes=$2 WHERE id=$3 RETURNING *`,
      [`${admin.first_name} ${admin.last_name}`, notes || 'Document verified and approved.', req.params.id]
    );
    res.json({ data: formatDocument(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/documents/:id/reject', auth, requireRole('admin'), requirePerm('documents', 'rejectKYCDocument'), async (req, res) => {
  try {
    const { notes } = req.body;
    const adminResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const admin = adminResult.rows[0];
    const result = await pool.query(
      `UPDATE documents SET status='rejected', reviewed_by=$1, reviewed_at=NOW(), admin_notes=$2 WHERE id=$3 RETURNING *`,
      [`${admin.first_name} ${admin.last_name}`, notes, req.params.id]
    );
    res.json({ data: formatDocument(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/documents/:id', auth, requirePerm('documents', 'deleteDocument'), async (req, res) => {
  try {
    await pool.query('DELETE FROM documents WHERE id=$1 AND (owner_id=$2 OR $3=true)',
      [req.params.id, req.user.id, req.user.role === 'admin']);
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTICES ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/notices', auth, requirePerm('notices', 'viewNotices'), async (req, res) => {
  try {
    let query = 'SELECT * FROM tenant_notices WHERE 1=1';
    const params = [];
    let i = 1;
    if (req.user.role === 'tenant') { query += ` AND tenant_id = $${i}`; params.push(req.user.id); i++; }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatNotice) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/notices', auth, requireRole('admin', 'property_manager', 'landlord'), requirePerm('notices', 'sendNotice'), async (req, res) => {
  try {
    const { propertyId, propertyTitle, tenantId, tenantName, type, subject, body, effectiveDate, responseDeadline, requiresAcknowledgement, attachmentUrl } = req.body;
    const senderResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const sender = senderResult.rows[0];
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO tenant_notices (id, property_id, property_title, tenant_id, tenant_name,
       issued_by, issued_by_role, type, subject, body, effective_date, response_deadline,
       status, requires_acknowledgement, attachment_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'unread',$13,$14) RETURNING *`,
      [id, propertyId, propertyTitle, tenantId, tenantName,
       `${sender.first_name} ${sender.last_name}`, sender.role,
       type, subject, body, effectiveDate || null, responseDeadline || null,
       requiresAcknowledgement || false, attachmentUrl || null]
    );
    res.status(201).json({ data: formatNotice(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/notices/:id/acknowledge', auth, requireRole('tenant'), requirePerm('notices', 'acknowledgeNotice'), async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE tenant_notices SET status='acknowledged', acknowledged_at=NOW() WHERE id=$1 AND tenant_id=$2 RETURNING *",
      [req.params.id, req.user.id]
    );
    res.json({ data: formatNotice(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/notices/:id/read', auth, requirePerm('notices', 'viewNotices'), async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE tenant_notices SET status=CASE WHEN status='unread' THEN 'read' ELSE status END, read_at=COALESCE(read_at,NOW()) WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    res.json({ data: formatNotice(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DISPUTES ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/disputes', auth, requireAnyPerm([['disputes', 'viewOwnDisputes'], ['disputes', 'viewAllDisputes']]), async (req, res) => {
  try {
    let query = 'SELECT * FROM disputes WHERE 1=1';
    const params = [];
    let i = 1;
    const canViewAll = hasPermission(req.effectivePermissions, 'disputes', 'viewAllDisputes');
    if (!canViewAll) {
      query += ` AND (raised_by_id = $${i} OR against_id = $${i})`;
      params.push(req.user.id); i++;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatDispute) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/disputes', auth, requirePerm('disputes', 'raiseDispute'), async (req, res) => {
  try {
    const { type, againstId, againstName, againstRole, propertyId, propertyTitle, transactionId, subject, description, evidence, amount } = req.body;
    const userResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = userResult.rows[0];
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO disputes (id, type, status, raised_by_id, raised_by_name, raised_by_role,
       against_id, against_name, against_role, property_id, property_title, transaction_id,
       subject, description, evidence, amount)
       VALUES ($1,$2,'open',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [id, type, req.user.id, `${user.first_name} ${user.last_name}`, user.role,
       againstId || null, againstName || null, againstRole || null,
       propertyId || null, propertyTitle || null, transactionId || null,
       subject, description, evidence || null, amount || null]
    );
    res.status(201).json({ data: formatDispute(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/disputes/:id/resolve', auth, requireRole('admin'), RESOLVE_DISPUTE_ANY, async (req, res) => {
  try {
    const { resolution } = req.body;
    const adminResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const admin = adminResult.rows[0];
    const result = await pool.query(
      `UPDATE disputes SET status='resolved', resolution=$1, resolved_by_id=$2, resolved_by_name=$3,
       resolved_at=NOW(), updated_at=NOW() WHERE id=$4 RETURNING *`,
      [resolution, req.user.id, `${admin.first_name} ${admin.last_name}`, req.params.id]
    );
    res.json({ data: formatDispute(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/disputes/:id/dismiss', auth, requireRole('admin'), DISMISS_DISPUTE_ANY, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE disputes SET status='dismissed', updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    res.json({ data: formatDispute(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/analytics/dashboard', auth, requirePerm('analytics', 'viewBasicAnalytics'), async (req, res) => {
  try {
    const [props, tenants, maintenance, payments, payouts, inspFees] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total,
        COUNT(CASE WHEN status='published' THEN 1 END) as vacant,
        COUNT(CASE WHEN status='rented' THEN 1 END) as occupied
        FROM properties`),
      pool.query("SELECT COUNT(*) FROM users WHERE role='tenant'"),
      pool.query("SELECT COUNT(*) FROM maintenance_requests WHERE status NOT IN ('completed','cancelled')"),
      pool.query("SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE status='completed' AND created_at >= date_trunc('month', NOW())"),
      pool.query("SELECT COUNT(*) FROM payouts WHERE status='pending'"),
      pool.query("SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE type='inspection_fee' AND status='completed' AND created_at >= date_trunc('month', NOW())"),
    ]);
    const totalProps = parseInt(props.rows[0].total);
    const occupied = parseInt(props.rows[0].occupied);
    const conversionRate = totalProps > 0 ? Math.round((occupied / totalProps) * 100) : 0;
    res.json({
      data: {
        totalProperties: totalProps,
        vacantProperties: parseInt(props.rows[0].vacant),
        occupiedProperties: occupied,
        totalTenants: parseInt(tenants.rows[0].count),
        pendingMaintenance: parseInt(maintenance.rows[0].count),
        monthlyRevenue: parseInt(payments.rows[0].total),
        pendingPayouts: parseInt(payouts.rows[0].count),
        inspectionFeeRevenue: parseInt(inspFees.rows[0].total),
        conversionRate,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/analytics/revenue', auth, requireRole('admin', 'property_manager'), requireAnyPerm([['analytics', 'viewPlatformRevenue'], ['analytics', 'viewBasicAnalytics']]), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT date_trunc('month', created_at) as month, SUM(amount) as total
       FROM payments WHERE status='completed'
       GROUP BY month ORDER BY month DESC LIMIT 12`
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/analytics/occupancy', auth, requirePerm('analytics', 'viewBasicAnalytics'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT district, COUNT(*) as total,
       COUNT(CASE WHEN status='rented' THEN 1 END) as occupied
       FROM properties GROUP BY district`
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// New: per-month inspection stats
app.get('/api/analytics/inspections', auth, requirePerm('analytics', 'viewBasicAnalytics'), async (req, res) => {
  try {
    const [monthly, statuses] = await Promise.all([
      pool.query(`
        SELECT date_trunc('month', created_at) as month, COUNT(*) as total,
               COUNT(CASE WHEN fee_paid THEN 1 END) as paid
        FROM inspections
        GROUP BY month ORDER BY month DESC LIMIT 12
      `),
      pool.query(`
        SELECT status, COUNT(*) as count FROM inspections GROUP BY status
      `),
    ]);
    res.json({ data: { monthly: monthly.rows, statuses: statuses.rows } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// New: maintenance breakdown
app.get('/api/analytics/maintenance', auth, requirePerm('analytics', 'viewBasicAnalytics'), async (req, res) => {
  try {
    const [byStatus, byPriority, avgResolution] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) as count FROM maintenance_requests GROUP BY status`),
      pool.query(`SELECT priority, COUNT(*) as count FROM maintenance_requests GROUP BY priority`),
      pool.query(`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/86400),1) as avg_days
        FROM maintenance_requests WHERE status='completed' AND completed_at IS NOT NULL
      `),
    ]);
    res.json({
      data: {
        byStatus: byStatus.rows,
        byPriority: byPriority.rows,
        avgResolutionDays: parseFloat(avgResolution.rows[0]?.avg_days) || 0,
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// New: user registration growth (last 12 months)
app.get('/api/analytics/users', auth, requireRole('admin'), requirePerm('analytics', 'viewBasicAnalytics'), async (req, res) => {
  try {
    const [growth, byRole, kycStats] = await Promise.all([
      pool.query(`
        SELECT date_trunc('month', created_at) as month, COUNT(*) as count
        FROM users GROUP BY month ORDER BY month DESC LIMIT 12
      `),
      pool.query(`SELECT role, COUNT(*) as count FROM users GROUP BY role`),
      pool.query(`
        SELECT kyc_status, COUNT(*) as count FROM users GROUP BY kyc_status
      `),
    ]);
    res.json({ data: { growth: growth.rows, byRole: byRole.rows, kycStats: kycStats.rows } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// New: revenue breakdown by payment type
app.get('/api/analytics/revenue-breakdown', auth, requireRole('admin', 'property_manager'), requireAnyPerm([['analytics', 'viewPlatformRevenue'], ['analytics', 'viewBasicAnalytics']]), async (req, res) => {
  try {
    const [byType, monthly, topProperties] = await Promise.all([
      pool.query(`
        SELECT type, COALESCE(SUM(amount),0) as total, COUNT(*) as count
        FROM payments WHERE status='completed'
        GROUP BY type
      `),
      pool.query(`
        SELECT date_trunc('month', created_at) as month,
               COALESCE(SUM(amount),0) as total,
               COALESCE(SUM(CASE WHEN type='rent' THEN amount ELSE 0 END),0) as rent,
               COALESCE(SUM(CASE WHEN type='inspection_fee' THEN amount ELSE 0 END),0) as inspection
        FROM payments WHERE status='completed'
        GROUP BY month ORDER BY month DESC LIMIT 12
      `),
      pool.query(`
        SELECT property_title, COALESCE(SUM(amount),0) as total
        FROM payments WHERE status='completed' AND property_title IS NOT NULL
        GROUP BY property_title ORDER BY total DESC LIMIT 5
      `),
    ]);
    res.json({ data: { byType: byType.rows, monthly: monthly.rows, topProperties: topProperties.rows } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/audit-logs', auth, requireRole('admin'), requirePerm('admin', 'viewAuditLogs'), async (req, res) => {
  try {
    const { from, to, action, limit = 500, offset = 0 } = req.query;
    const conditions = [];
    const params = [];
    if (from) { params.push(from); conditions.push(`created_at >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`created_at <= $${params.length}::date + interval '1 day'`); }
    if (action) { params.push(action); conditions.push(`action = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(Math.min(parseInt(limit) || 500, 1000));
    params.push(parseInt(offset) || 0);
    const result = await pool.query(
      `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM audit_logs ${where}`,
      params.slice(0, params.length - 2)
    );
    res.json({ data: result.rows.map(formatAuditLog), total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error('audit-logs GET:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/audit-logs', auth, requireAnyPerm([['admin', 'viewAuditLogs'], ['admin', 'exportAuditLogs']]), async (req, res) => {
  try {
    const { action, performedByName, performedByRole, targetId, targetName, description, metadata } = req.body;
    const id = uuidv4();
    await pool.query(
      `INSERT INTO audit_logs (id, action, performed_by, performed_by_name, performed_by_role, target_id, target_name, description, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, action, req.user.id, performedByName, performedByRole, targetId || null, targetName || null, description, metadata ? JSON.stringify(metadata) : null]
    );
    res.status(201).json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/announcements', auth, requireAnyPerm([['admin', 'sendAnnouncement'], ['notices', 'viewNotices']]), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM announcements WHERE target_roles @> $1::jsonb OR target_roles = '[]'::jsonb ORDER BY created_at DESC LIMIT 20`,
      [JSON.stringify([req.user.role])]
    );
    res.json({ data: result.rows.map(formatAnnouncement) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/announcements', auth, requireRole('admin'), requirePerm('admin', 'sendAnnouncement'), async (req, res) => {
  try {
    const { title, body, targetRoles } = req.body;
    const senderResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const sender = senderResult.rows[0];
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO announcements (id, title, body, target_roles, sent_by, sent_by_name)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, title, body, JSON.stringify(targetRoles || []), req.user.id, `${sender.first_name} ${sender.last_name}`]
    );
    res.status(201).json({ data: formatAnnouncement(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT APPLICATIONS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/agent-applications', auth, requireRole('admin'), requirePerm('admin', 'viewAgentApplications'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM agent_applications ORDER BY created_at DESC');
    res.json({ data: result.rows.map(formatAgentApplication) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Authenticated user fetches their own application (for pending/rejected status display)
app.get('/api/agent-applications/my', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM agent_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    if (!result.rows.length) return res.json({ data: null });
    res.json({ data: formatAgentApplication(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/agent-applications', async (req, res) => {
  try {
    const {
      userId, firstName, lastName, email, phone, role, nationalIdNumber,
      nationalIdDoc, additionalDocs, experience, districts, motivation,
    } = req.body;
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO agent_applications (id, user_id, first_name, last_name, email, phone, role,
       national_id_number, national_id_doc, additional_docs, experience, districts, motivation, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13,'pending') RETURNING *`,
      [id, userId || null, firstName, lastName, email, phone || null, role || 'agent',
       nationalIdNumber || null, nationalIdDoc || null,
       JSON.stringify(Array.isArray(additionalDocs) ? additionalDocs : []),
       experience, JSON.stringify(districts || []), motivation]
    );

    // ── Also save each document into the documents table so admin can see
    //    them on the Documents page and approve/reject them individually.
    const applicantName = `${firstName} ${lastName}`.trim();
    const ownerRole = role || 'agent';
    const ownerId = userId || null;

    /**
     * Detect MIME type from a base64 data URL.
     * Falls back to 'application/octet-stream' for unknown types.
     */
    function detectMimeFromDataUrl(dataUrl) {
      if (!dataUrl || typeof dataUrl !== 'string') return 'application/octet-stream';
      const match = dataUrl.match(/^data:([^;]+);base64,/);
      return match ? match[1] : 'application/octet-stream';
    }

    /**
     * Estimate file size in bytes from a base64 data URL.
     * base64 encodes 3 bytes as 4 chars; strip the header first.
     */
    function estimateSizeFromDataUrl(dataUrl) {
      if (!dataUrl || typeof dataUrl !== 'string') return 0;
      const base64Part = dataUrl.split(',')[1] || '';
      return Math.round((base64Part.length * 3) / 4);
    }

    if (nationalIdDoc && ownerId) {
      const mimeType = detectMimeFromDataUrl(nationalIdDoc);
      const fileSize = estimateSizeFromDataUrl(nationalIdDoc);
      await pool.query(
        `INSERT INTO documents (id, owner_id, owner_name, owner_role, name, category, status,
         file_url, file_type, file_size, uploaded_at)
         VALUES ($1,$2,$3,$4,$5,'kyc','pending',$6,$7,$8,NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          uuidv4(),
          ownerId,
          applicantName,
          ownerRole,
          `National ID — ${applicantName}`,
          nationalIdDoc,
          mimeType,
          fileSize,
        ]
      ).catch(e => console.error('doc insert (national_id):', e.message));
    }

    if (Array.isArray(additionalDocs) && ownerId) {
      for (const doc of additionalDocs) {
        if (!doc || !doc.dataUrl) continue;
        const mimeType = doc.type || detectMimeFromDataUrl(doc.dataUrl);
        const fileSize = estimateSizeFromDataUrl(doc.dataUrl);
        await pool.query(
          `INSERT INTO documents (id, owner_id, owner_name, owner_role, name, category, status,
           file_url, file_type, file_size, uploaded_at)
           VALUES ($1,$2,$3,$4,$5,'kyc','pending',$6,$7,$8,NOW())
           ON CONFLICT (id) DO NOTHING`,
          [
            uuidv4(),
            ownerId,
            applicantName,
            ownerRole,
            doc.name || 'Supporting Document',
            doc.dataUrl,
            mimeType,
            fileSize,
          ]
        ).catch(e => console.error('doc insert (additional):', e.message));
      }
    }

    // Notify all admins about the new application requiring review
    const roleLabel = role === 'landlord' ? 'Landlord' : role === 'property_manager' ? 'Property Manager' : 'Agent';
    const admins = await pool.query(`SELECT id FROM users WHERE role = 'admin' AND is_suspended = false`);
    for (const a of admins.rows) {
      await pool.query(
        `INSERT INTO notifications (id, user_id, type, title, body, is_read, action_url)
         VALUES ($1, $2, 'kyc_review', $3, $4, false, '/admin/agents')`,
        [
          uuidv4(),
          a.id,
          `New ${roleLabel} Application`,
          `${applicantName} has submitted a ${roleLabel} application with documents for review. Check Applications and Documents pages.`,
        ]
      ).catch(() => {});
    }

    res.status(201).json({ data: formatAgentApplication(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/agent-applications/:id/approve', auth, requireRole('admin'), requirePerm('admin', 'approveAgentApplication'), async (req, res) => {
  try {
    const adminNote = req.body.adminNote ?? req.body.note ?? '';
    const appRow = await pool.query('SELECT user_id, role FROM agent_applications WHERE id=$1', [req.params.id]);
    const result = await pool.query(
      "UPDATE agent_applications SET status='approved', admin_note=$1, reviewed_at=NOW() WHERE id=$2 RETURNING *",
      [adminNote, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Application not found' });
    const uid = appRow.rows[0]?.user_id;
    if (uid) {
      await pool.query(
        `UPDATE users SET approval_status='approved', kyc_status='approved', is_verified=true, updated_at=NOW() WHERE id=$1`,
        [uid]
      ).catch(() => {});
      // Notify the applicant of approval
      const roleLabel = appRow.rows[0]?.role === 'landlord' ? 'Landlord'
        : appRow.rows[0]?.role === 'property_manager' ? 'Property Manager' : 'Agent';
      await pool.query(
        `INSERT INTO notifications (id, user_id, type, title, body, is_read, action_url)
         VALUES ($1, $2, 'kyc_approved', $3, $4, false, '/dashboard')`,
        [
          uuidv4(),
          uid,
          `${roleLabel} Application Approved!`,
          `Congratulations! Your ${roleLabel} application has been approved. You now have full access to the platform.`,
        ]
      ).catch(() => {});
    }
    res.json({ data: formatAgentApplication(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/agent-applications/:id/reject', auth, requireRole('admin'), requirePerm('admin', 'rejectAgentApplication'), async (req, res) => {
  try {
    const adminNote = req.body.adminNote ?? req.body.note ?? '';
    const appRow = await pool.query('SELECT user_id, first_name, last_name, role FROM agent_applications WHERE id=$1', [req.params.id]);
    const result = await pool.query(
      "UPDATE agent_applications SET status='rejected', admin_note=$1, reviewed_at=NOW() WHERE id=$2 RETURNING *",
      [adminNote, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Application not found' });
    const uid = appRow.rows[0]?.user_id;
    if (uid) {
      await pool.query(
        `UPDATE users SET approval_status='rejected', kyc_status='rejected', updated_at=NOW() WHERE id=$1`,
        [uid]
      ).catch(() => {});
      // Notify the applicant with the rejection reason
      const roleLabel = appRow.rows[0]?.role === 'landlord' ? 'Landlord'
        : appRow.rows[0]?.role === 'property_manager' ? 'Property Manager' : 'Agent';
      await pool.query(
        `INSERT INTO notifications (id, user_id, type, title, body, is_read, action_url)
         VALUES ($1, $2, 'kyc_rejected', $3, $4, false, '/documents')`,
        [
          uuidv4(),
          uid,
          `${roleLabel} Application Rejected`,
          adminNote
            ? `Your application was rejected. Reason: ${adminNote}. Please go to Documents to upload corrected files and resubmit.`
            : `Your application was rejected. Please go to Documents to upload corrected files and resubmit.`,
        ]
      ).catch(() => {});
    }
    res.json({ data: formatAgentApplication(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin replaces/adds documents on an application (e.g. after rejection, user re-submits via admin)
app.patch('/api/agent-applications/:id/docs', auth, requireRole('admin'), async (req, res) => {
  try {
    const { nationalIdDoc, additionalDocs } = req.body;
    const updates = [];
    const params = [];
    let i = 1;
    if (nationalIdDoc !== undefined) {
      updates.push(`national_id_doc = $${i}`); params.push(nationalIdDoc); i++;
    }
    if (additionalDocs !== undefined) {
      updates.push(`additional_docs = $${i}::jsonb`);
      params.push(JSON.stringify(Array.isArray(additionalDocs) ? additionalDocs : []));
      i++;
    }
    if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });
    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE agent_applications SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Application not found' });
    res.json({ data: formatAgentApplication(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM SETTINGS (fees & company accounts — Render DB)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/platform-settings', auth, requireRole('admin'), requirePerm('admin', 'configureFees'), async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT fee_config, company_accounts, updated_at FROM platform_settings WHERE id = $1',
      ['global']
    );
    if (!r.rows.length) {
      return res.json({ data: { feeConfig: {}, companyAccounts: {}, updatedAt: null } });
    }
    const row = r.rows[0];
    res.json({
      data: {
        feeConfig: parseDbJson(row.fee_config, {}) || {},
        companyAccounts: parseDbJson(row.company_accounts, {}) || {},
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/platform-settings', auth, requireRole('admin'), requirePerm('admin', 'configureFees'), async (req, res) => {
  try {
    const { feeConfig, companyAccounts } = req.body;
    const cur = await pool.query(
      'SELECT fee_config, company_accounts FROM platform_settings WHERE id = $1',
      ['global']
    );
    const prevF = cur.rows[0] ? parseDbJson(cur.rows[0].fee_config, {}) || {} : {};
    const prevC = cur.rows[0] ? parseDbJson(cur.rows[0].company_accounts, {}) || {} : {};
    const mergedF =
      feeConfig != null && typeof feeConfig === 'object' && !Array.isArray(feeConfig)
        ? { ...prevF, ...feeConfig }
        : prevF;
    const mergedC =
      companyAccounts != null && typeof companyAccounts === 'object' && !Array.isArray(companyAccounts)
        ? { ...prevC, ...companyAccounts }
        : prevC;

    const ins = await pool.query(
      `INSERT INTO platform_settings (id, fee_config, company_accounts, updated_at)
       VALUES ('global', $1::jsonb, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET
         fee_config = EXCLUDED.fee_config,
         company_accounts = EXCLUDED.company_accounts,
         updated_at = NOW()
       RETURNING fee_config, company_accounts, updated_at`,
      [JSON.stringify(mergedF), JSON.stringify(mergedC)]
    );
    const row = ins.rows[0];
    await pool.query(
      `INSERT INTO audit_logs (id, action, performed_by, performed_by_name, performed_by_role, description, metadata)
       VALUES ($1,'fee_config_updated',$2,$3,$4,$5,$6)`,
      [
        uuidv4(),
        req.user.id,
        req.user.name || 'Admin',
        req.user.role,
        'Platform fee / company account settings updated in platform_settings',
        JSON.stringify({ feeKeys: Object.keys(mergedF), accountKeys: Object.keys(mergedC) }),
      ]
    ).catch(() => {});
    res.json({
      data: {
        feeConfig: parseDbJson(row.fee_config, {}) || {},
        companyAccounts: parseDbJson(row.company_accounts, {}) || {},
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT PREFERENCES ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/payment-preferences/:userId', auth, requirePaymentPrefsRead, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM payment_preferences WHERE user_id=$1', [req.params.userId]);
    res.json({ data: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/payment-preferences', auth, requirePerm('settings', 'setPaymentMethod'), async (req, res) => {
  try {
    const { preferredMethod, mtnPhone, airtelPhone, bankName, bankAccountNumber, bankAccountName } = req.body;
    const result = await pool.query(
      `INSERT INTO payment_preferences (user_id, preferred_method, mtn_phone, airtel_phone, bank_name, bank_account_number, bank_account_name, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         preferred_method=EXCLUDED.preferred_method, mtn_phone=EXCLUDED.mtn_phone,
         airtel_phone=EXCLUDED.airtel_phone, bank_name=EXCLUDED.bank_name,
         bank_account_number=EXCLUDED.bank_account_number, bank_account_name=EXCLUDED.bank_account_name,
         updated_at=NOW()
       RETURNING *`,
      [req.user.id, preferredMethod, mtnPhone || null, airtelPhone || null, bankName || null, bankAccountNumber || null, bankAccountName || null]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * On startup, clear any stored `permissions` override on admin accounts.
 * Admin role always gets the full all-true defaults — stale overrides in the DB
 * (written by older code before new permission keys were added) would otherwise
 * block admin access to new features like agent-applications, documents, etc.
 */
async function clearAdminStoredPermissions() {
  try {
    const result = await pool.query(
      `UPDATE users SET permissions = NULL WHERE role = 'admin' AND permissions IS NOT NULL`
    );
    if (result.rowCount > 0) {
      console.log(`✅ Cleared stale permissions overrides for ${result.rowCount} admin account(s).`);
    }
  } catch (err) {
    console.error('⚠️  Could not clear admin permissions (non-fatal):', err.message);
  }
}

/**
 * On startup, ensure every pending vetting-role user has an application record.
 * This is a safety net for cases where the POST /api/agent-applications failed
 * during registration (e.g. due to a missing DB column), leaving users pending
 * with no visible application in the admin panel.
 */
async function backfillMissingApplications() {
  try {
    const missing = await pool.query(`
      SELECT u.id::text AS id, u.first_name, u.last_name, u.email, u.phone, u.role
      FROM users u
      WHERE u.role IN ('landlord', 'agent', 'property_manager')
        AND u.approval_status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM agent_applications a WHERE a.user_id = u.id::text
        )
    `);
    if (missing.rows.length > 0) {
      console.log(`🔄 Backfilling ${missing.rows.length} missing application record(s)...`);
      for (const u of missing.rows) {
        const appId = uuidv4();
        await pool.query(
          `INSERT INTO agent_applications
           (id, user_id, first_name, last_name, email, phone, role,
            national_id_number, national_id_doc, additional_docs,
            experience, districts, motivation, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13,'pending')`,
          [
            appId, u.id, u.first_name, u.last_name, u.email,
            u.phone || null, u.role, null, null,
            JSON.stringify([]),
            'Registered via platform — documents pending review.',
            JSON.stringify([]),
            'Applied for account approval during registration.',
          ]
        );
        console.log(`  ✅ Created application for ${u.first_name} ${u.last_name} (${u.role})`);
      }
    }
  } catch (err) {
    console.error('⚠️  Backfill applications (non-fatal):', err.message);
  }
}

app.listen(PORT, async () => {
  console.log(`ITAB backend running on port ${PORT}`);
  await clearAdminStoredPermissions();
  await backfillMissingApplications();
});

module.exports = app;
