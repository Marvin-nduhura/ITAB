const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

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
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ─── Auth middleware ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
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

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, role } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'All fields required' });
    }
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const result = await pool.query(
      'INSERT INTO users (id, first_name, last_name, email, phone, password_hash, role, kyc_status, is_verified) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [id, firstName, lastName, email, phone, hash, role || 'tenant', 'pending', false]
    );
    const user = formatUser(result.rows[0]);
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ data: { user, token } });
  } catch (err) {
    console.error(err);
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
    // Check suspension
    if (user.is_suspended) {
      return res.status(403).json({
        message: 'Account suspended',
        reason: user.suspended_reason || 'Contact support@itab.ug',
        code: 'ACCOUNT_SUSPENDED',
      });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ data: { user: formatUser(user), token } });
  } catch (err) {
    console.error(err);
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

// ─── Properties Routes ────────────────────────────────────────────────────────
app.get('/api/properties', async (req, res) => {
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
    res.json({ data: result.rows.map(formatProperty) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/properties/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM properties WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Property not found' });
    // Increment view count
    await pool.query('UPDATE properties SET view_count = view_count + 1 WHERE id = $1', [req.params.id]);
    res.json({ data: formatProperty(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/properties', auth, requireRole('admin', 'property_manager', 'agent', 'landlord'), async (req, res) => {
  try {
    const { title, description, type, address, district, latitude, longitude, bedrooms, bathrooms, squareFootage, rentPrice, deposit, availableFrom, amenities, managementFeePercent, itabFeePercent } = req.body;
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO properties (id, title, description, type, status, address, district, latitude, longitude, bedrooms, bathrooms, square_footage, rent_price, deposit, available_from, amenities, management_fee_percent, itab_fee_percent, manager_id, view_count)
       VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,0) RETURNING *`,
      [id, title, description, type, address, district, latitude || 0.3476, longitude || 32.5825, bedrooms || 0, bathrooms || 0, squareFootage, rentPrice, deposit, availableFrom, JSON.stringify(amenities || []), managementFeePercent || 10, itabFeePercent || 2, req.user.id]
    );
    res.status(201).json({ data: formatProperty(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/properties/:id', auth, async (req, res) => {
  try {
    const { title, description, rentPrice, status, amenities } = req.body;
    const result = await pool.query(
      'UPDATE properties SET title=$1, description=$2, rent_price=$3, status=$4, amenities=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
      [title, description, rentPrice, status, JSON.stringify(amenities), req.params.id]
    );
    res.json({ data: formatProperty(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Inspections Routes ───────────────────────────────────────────────────────
app.get('/api/inspections', auth, async (req, res) => {
  try {
    let query = 'SELECT * FROM inspections WHERE 1=1';
    const params = [];
    if (req.user.role === 'tenant') { query += ' AND tenant_id = $1'; params.push(req.user.id); }
    else if (req.user.role === 'property_manager') { query += ' AND manager_id = $1'; params.push(req.user.id); }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatInspection) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/inspections', auth, requireRole('tenant'), async (req, res) => {
  try {
    const { propertyId, scheduledDate, scheduledTime } = req.body;
    const prop = await pool.query('SELECT * FROM properties WHERE id = $1', [propertyId]);
    if (prop.rows.length === 0) return res.status(404).json({ message: 'Property not found' });
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO inspections (id, property_id, property_title, property_address, tenant_id, manager_id, scheduled_date, scheduled_time, status, fee_amount, fee_paid, credit_applied, no_show_count, reschedule_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',100000,false,false,0,0) RETURNING *`,
      [id, propertyId, prop.rows[0].title, prop.rows[0].address, req.user.id, prop.rows[0].manager_id, scheduledDate, scheduledTime]
    );
    res.status(201).json({ data: formatInspection(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Payments Routes ──────────────────────────────────────────────────────────
app.get('/api/payments', auth, async (req, res) => {
  try {
    let query = 'SELECT * FROM payments WHERE 1=1';
    const params = [];
    if (req.user.role === 'tenant') { query += ' AND tenant_id = $1'; params.push(req.user.id); }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows.map(formatPayment) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// MTN MoMo initiate (sandbox)
app.post('/api/payments/mtn/initiate', auth, async (req, res) => {
  try {
    const { amount, phone, type, propertyId } = req.body;
    // In production: call MTN MoMo Collections API
    // POST https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay
    const reference = `MTN-${Date.now()}`;
    res.json({ data: { reference, status: 'pending', message: 'USSD prompt sent to ' + phone } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Airtel Money initiate (sandbox)
app.post('/api/payments/airtel/initiate', auth, async (req, res) => {
  try {
    const { amount, phone, type, propertyId } = req.body;
    // In production: call Airtel Money API
    // POST https://openapi.airtel.africa/merchant/v1/payments/
    const reference = `AIR-${Date.now()}`;
    res.json({ data: { reference, status: 'pending', message: 'Payment request sent to ' + phone } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Analytics ────────────────────────────────────────────────────────────────
app.get('/api/analytics/dashboard', auth, async (req, res) => {
  try {
    const [props, tenants, maintenance, payments] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN status=\'published\' THEN 1 END) as vacant, COUNT(CASE WHEN status=\'rented\' THEN 1 END) as occupied FROM properties'),
      pool.query('SELECT COUNT(*) FROM users WHERE role=\'tenant\''),
      pool.query('SELECT COUNT(*) FROM maintenance_requests WHERE status NOT IN (\'completed\',\'cancelled\')'),
      pool.query('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE status=\'completed\' AND created_at >= date_trunc(\'month\', NOW())'),
    ]);
    res.json({
      data: {
        totalProperties: parseInt(props.rows[0].total),
        vacantProperties: parseInt(props.rows[0].vacant),
        occupiedProperties: parseInt(props.rows[0].occupied),
        totalTenants: parseInt(tenants.rows[0].count),
        pendingMaintenance: parseInt(maintenance.rows[0].count),
        monthlyRevenue: parseInt(payments.rows[0].total),
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────
app.post('/api/auth/google', async (req, res) => {
  try {
    const { googleId, email, firstName, lastName, avatar, role } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Check if user already exists by email
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      // Update google_id if not set
      if (!user.google_id && googleId) {
        await pool.query('UPDATE users SET google_id=$1, updated_at=NOW() WHERE id=$2', [googleId, user.id]);
        user.google_id = googleId;
      }
      if (user.is_suspended) {
        return res.status(403).json({ message: 'Account suspended', reason: user.suspended_reason, code: 'ACCOUNT_SUSPENDED' });
      }
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ data: { user: formatUser(user), token, requiresApproval: false } });
    }

    // New user
    const selectedRole = role || 'tenant';
    const requiresApproval = ['agent', 'property_manager'].includes(selectedRole);
    const approvalStatus = requiresApproval ? 'pending' : 'approved';
    const kycStatus = requiresApproval ? 'pending' : 'pending';
    const isVerified = !requiresApproval;

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO users (id, first_name, last_name, email, role, avatar, google_id, kyc_status, is_verified, approval_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, firstName || email.split('@')[0], lastName || '', email, selectedRole, avatar || null, googleId || null, kycStatus, isVerified, approvalStatus]
    );
    const newUser = formatUser(result.rows[0]);
    const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ data: { user: newUser, token, requiresApproval } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Users (Admin) ────────────────────────────────────────────────────────────
app.get('/api/users', auth, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json({ data: result.rows.map(formatUser) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users/pending', auth, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE approval_status='pending' ORDER BY created_at DESC");
    res.json({ data: result.rows.map(formatUser) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/users/:id/permissions', auth, requireRole('admin'), async (req, res) => {
  try {
    const { permissions } = req.body;
    await pool.query('UPDATE users SET permissions=$1, updated_at=NOW() WHERE id=$2', [JSON.stringify(permissions || {}), req.params.id]);
    const result = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/users/:id/districts', auth, requireRole('admin'), async (req, res) => {
  try {
    const { districts } = req.body;
    await pool.query('UPDATE users SET restricted_districts=$1, updated_at=NOW() WHERE id=$2', [districts || [], req.params.id]);
    const result = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/users/:id/role', auth, requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ message: 'Role is required' });
    await pool.query('UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2', [role, req.params.id]);
    const result = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/users/:id/approve', auth, requireRole('admin'), async (req, res) => {
  try {
    await pool.query(
      "UPDATE users SET kyc_status='approved', is_verified=true, approval_status='approved', updated_at=NOW() WHERE id=$1",
      [req.params.id]
    );
    const result = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/users/:id/reject-approval', auth, requireRole('admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    await pool.query(
      "UPDATE users SET approval_status='rejected', notes=$1, updated_at=NOW() WHERE id=$2",
      [reason || null, req.params.id]
    );
    const result = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    res.json({ data: formatUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/users/:id/suspend', auth, requireRole('admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    await pool.query(
      'UPDATE users SET is_suspended=true, suspended_reason=$1, suspended_at=NOW(), is_active=false WHERE id=$2',
      [reason || null, req.params.id]
    );
    res.json({ data: { message: 'User suspended' } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/users/:id/unsuspend', auth, requireRole('admin'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET is_suspended=false, suspended_reason=NULL, suspended_at=NULL, is_active=true WHERE id=$1',
      [req.params.id]
    );
    res.json({ data: { message: 'User unsuspended' } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Formatters ───────────────────────────────────────────────────────────────
function formatUser(u) {
  return {
    id: u.id, email: u.email, phone: u.phone,
    firstName: u.first_name, lastName: u.last_name,
    role: u.role, avatar: u.avatar,
    isVerified: u.is_verified,
    isSuspended: u.is_suspended || false,
    suspendedReason: u.suspended_reason || undefined,
    kycStatus: u.kyc_status,
    permissions: u.permissions || {},
    restrictedDistricts: u.restricted_districts || [],
    approvalStatus: u.approval_status || 'approved',
    kycDocuments: u.kyc_documents || [],
    googleId: u.google_id || undefined,
    notes: u.notes || undefined,
    createdAt: u.created_at, updatedAt: u.updated_at,
  };
}

function formatProperty(p) {
  return { id: p.id, title: p.title, description: p.description, type: p.type, status: p.status, address: p.address, district: p.district, latitude: parseFloat(p.latitude) || 0.3476, longitude: parseFloat(p.longitude) || 32.5825, bedrooms: p.bedrooms, bathrooms: p.bathrooms, squareFootage: p.square_footage, rentPrice: parseInt(p.rent_price), deposit: parseInt(p.deposit), availableFrom: p.available_from, photos: p.photos || [], amenities: p.amenities || [], managementFeePercent: p.management_fee_percent, itabFeePercent: p.itab_fee_percent, isFeatured: p.is_featured, managerId: p.manager_id, landlordId: p.landlord_id, viewCount: p.view_count, createdAt: p.created_at, updatedAt: p.updated_at };
}

function formatInspection(i) {
  return { id: i.id, propertyId: i.property_id, propertyTitle: i.property_title, propertyAddress: i.property_address, tenantId: i.tenant_id, managerId: i.manager_id, scheduledDate: i.scheduled_date, scheduledTime: i.scheduled_time, status: i.status, feeAmount: parseInt(i.fee_amount), feePaid: i.fee_paid, paymentMethod: i.payment_method, paymentRef: i.payment_ref, creditApplied: i.credit_applied, noShowCount: i.no_show_count, rescheduleCount: i.reschedule_count, createdAt: i.created_at };
}

function formatPayment(p) {
  return { id: p.id, type: p.type, amount: parseInt(p.amount), currency: p.currency || 'UGX', status: p.status, method: p.method, reference: p.reference, propertyId: p.property_id, propertyTitle: p.property_title, tenantId: p.tenant_id, inspectionCreditApplied: p.inspection_credit_applied, createdAt: p.created_at, paidAt: p.paid_at };
}

// ─── DB Init ──────────────────────────────────────────────────────────────────
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY, first_name VARCHAR(100), last_name VARCHAR(100),
        email VARCHAR(255) UNIQUE NOT NULL, phone VARCHAR(20), password_hash VARCHAR(255),
        role VARCHAR(50) DEFAULT 'tenant', avatar TEXT, is_verified BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true, is_suspended BOOLEAN DEFAULT false,
        suspended_reason TEXT, suspended_at TIMESTAMPTZ,
        kyc_status VARCHAR(50) DEFAULT 'pending',
        permissions JSONB DEFAULT '{}',
        restricted_districts TEXT[] DEFAULT '{}',
        approval_status VARCHAR(50) DEFAULT 'approved',
        kyc_documents JSONB DEFAULT '[]',
        google_id VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS properties (
        id UUID PRIMARY KEY, title VARCHAR(255), description TEXT, type VARCHAR(50),
        status VARCHAR(50) DEFAULT 'draft', address TEXT, district VARCHAR(100),
        latitude DECIMAL(10,7), longitude DECIMAL(10,7), bedrooms INT DEFAULT 0,
        bathrooms INT DEFAULT 0, square_footage INT, rent_price BIGINT, deposit BIGINT,
        available_from DATE, photos JSONB DEFAULT '[]', amenities JSONB DEFAULT '[]',
        management_fee_percent DECIMAL(5,2) DEFAULT 10, itab_fee_percent DECIMAL(5,2) DEFAULT 2,
        is_featured BOOLEAN DEFAULT false, manager_id UUID, landlord_id UUID, tenant_id UUID,
        view_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS inspections (
        id UUID PRIMARY KEY, property_id UUID, property_title VARCHAR(255), property_address TEXT,
        tenant_id UUID, manager_id UUID, scheduled_date DATE, scheduled_time VARCHAR(10),
        status VARCHAR(50) DEFAULT 'pending', fee_amount BIGINT DEFAULT 100000,
        fee_paid BOOLEAN DEFAULT false, payment_method VARCHAR(50), payment_ref VARCHAR(100),
        credit_applied BOOLEAN DEFAULT false, no_show_count INT DEFAULT 0,
        reschedule_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY, type VARCHAR(50), amount BIGINT, currency VARCHAR(10) DEFAULT 'UGX',
        status VARCHAR(50) DEFAULT 'pending', method VARCHAR(50), reference VARCHAR(100),
        property_id UUID, property_title VARCHAR(255), tenant_id UUID, landlord_id UUID,
        inspection_credit_applied BIGINT DEFAULT 0, receipt_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(), paid_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS maintenance_requests (
        id UUID PRIMARY KEY, property_id UUID, property_title VARCHAR(255),
        tenant_id UUID, tenant_name VARCHAR(200), title VARCHAR(255), description TEXT,
        priority VARCHAR(50) DEFAULT 'normal', status VARCHAR(50) DEFAULT 'submitted',
        photos JSONB DEFAULT '[]', vendor_id UUID, estimated_cost BIGINT, actual_cost BIGINT,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS payouts (
        id UUID PRIMARY KEY, landlord_id UUID, property_id UUID, gross_rent BIGINT,
        management_fee BIGINT, itab_fee BIGINT, net_amount BIGINT,
        status VARCHAR(50) DEFAULT 'pending', method VARCHAR(50), reference VARCHAR(100),
        scheduled_date DATE, processed_at TIMESTAMPTZ, retry_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Add new columns to existing tables if they don't exist
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS restricted_districts TEXT[] DEFAULT '{}';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'approved';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_documents JSONB DEFAULT '[]';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;
    `);
    console.log('✅ Database tables initialized');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🚀 ITAB Backend running on port ${PORT}`);
  if (process.env.DATABASE_URL) await initDB();
  else console.log('⚠️  No DATABASE_URL set – running without database (mock mode)');
});
