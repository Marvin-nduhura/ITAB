/**
 * ITAB Migration Script
 * Migrates the existing Render PostgreSQL database to the new schema.
 * - Adds missing columns to existing tables
 * - Creates new tables (without FK constraints to users since users.id is uuid)
 * - Safe to re-run
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run(sql, label) {
  try {
    await pool.query(sql);
    if (label) console.log(`  ✅ ${label}`);
  } catch (e) {
    if (e.message.includes('already exists') || e.message.includes('duplicate column')) {
      if (label) console.log(`  ⏭  ${label} (already exists)`);
    } else {
      console.error(`  ❌ ${label}: ${e.message}`);
    }
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ITAB Migration — Render PostgreSQL');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── 1. Patch existing users table ─────────────────────────────────────────
  console.log('👤 Patching users table...');
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ`, 'users.suspended_at');
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending'`, 'users.approval_status');
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB`, 'users.permissions');
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS restricted_districts JSONB`, 'users.restricted_districts');
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT`, 'users.google_id');
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT`, 'users.notes');
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`, 'users.avatar');
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_documents JSONB`, 'users.kyc_documents');

  // ── 2. Patch existing properties table ────────────────────────────────────
  console.log('🏠 Patching properties table...');
  await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'`, 'properties.photos');
  await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false`, 'properties.is_featured');
  await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS tour_url TEXT`, 'properties.tour_url');
  await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS manager_name TEXT`, 'properties.manager_name');
  await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS landlord_id TEXT`, 'properties.landlord_id');
  await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS landlord_name TEXT`, 'properties.landlord_name');
  await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS tenant_id TEXT`, 'properties.tenant_id');
  await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS lease_start DATE`, 'properties.lease_start');
  await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS lease_end DATE`, 'properties.lease_end');
  await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`, 'properties.updated_at');
  await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS created_by_id TEXT`, 'properties.created_by_id');
  await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS created_by_name TEXT`, 'properties.created_by_name');
  await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS created_by_role TEXT`, 'properties.created_by_role');
  await run(
    `UPDATE properties SET created_by_id = COALESCE(created_by_id, manager_id, landlord_id),
     created_by_name = COALESCE(created_by_name, manager_name, landlord_name)
     WHERE created_by_id IS NULL AND (manager_id IS NOT NULL OR landlord_id IS NOT NULL)`,
    'properties.created_by backfill'
  );

  // ── 3. Patch existing inspections table ───────────────────────────────────
  console.log('🔍 Patching inspections table...');
  await run(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS tenant_name TEXT`, 'inspections.tenant_name');
  await run(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS payment_method TEXT`, 'inspections.payment_method');
  await run(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS payment_ref TEXT`, 'inspections.payment_ref');
  await run(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS qr_code TEXT`, 'inspections.qr_code');
  await run(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS notes TEXT`, 'inspections.notes');
  await run(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS lease_declined BOOLEAN DEFAULT false`, 'inspections.lease_declined');
  await run(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS lease_declined_reason TEXT`, 'inspections.lease_declined_reason');
  await run(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS lease_declined_at TIMESTAMPTZ`, 'inspections.lease_declined_at');
  await run(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`, 'inspections.updated_at');

  // ── 4. Patch existing payments table ──────────────────────────────────────
  console.log('💳 Patching payments table...');
  await run(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_name TEXT`, 'payments.tenant_name');
  await run(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS landlord_id TEXT`, 'payments.landlord_id');
  await run(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS inspection_credit_applied BIGINT DEFAULT 0`, 'payments.inspection_credit_applied');
  await run(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS rent_period TEXT`, 'payments.rent_period');
  await run(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_partial BOOLEAN DEFAULT false`, 'payments.is_partial');
  await run(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url TEXT`, 'payments.receipt_url');
  await run(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`, 'payments.paid_at');

  // ── 5. Patch existing maintenance_requests table ──────────────────────────
  console.log('🔧 Patching maintenance_requests table...');
  await run(`ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS tenant_name TEXT`, 'maintenance.tenant_name');
  await run(`ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS vendor_name TEXT`, 'maintenance.vendor_name');
  await run(`ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`, 'maintenance.completed_at');

  // ── 6. Patch existing payouts table ───────────────────────────────────────
  console.log('💸 Patching payouts table...');
  await run(`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS landlord_name TEXT`, 'payouts.landlord_name');
  await run(`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS property_title TEXT`, 'payouts.property_title');
  await run(`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS gross_rent BIGINT`, 'payouts.gross_rent');
  await run(`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS management_fee BIGINT`, 'payouts.management_fee');
  await run(`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS itab_fee BIGINT`, 'payouts.itab_fee');
  await run(`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS net_amount BIGINT`, 'payouts.net_amount');
  await run(`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS method TEXT`, 'payouts.method');
  await run(`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS reference TEXT`, 'payouts.reference');
  await run(`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS scheduled_date DATE`, 'payouts.scheduled_date');
  await run(`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ`, 'payouts.processed_at');
  await run(`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0`, 'payouts.retry_count');
  await run(`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`, 'payouts.created_at');

  // ── 7. Create new tables (no FK to users — users.id is uuid, new tables use TEXT) ──
  console.log('📦 Creating new tables...');

  await run(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    sender_id TEXT, sender_name TEXT, sender_role TEXT, sender_method TEXT, sender_phone TEXT,
    receiver_id TEXT, receiver_name TEXT, receiver_role TEXT, receiver_method TEXT, receiver_phone TEXT,
    receiver_bank_details JSONB,
    amount BIGINT NOT NULL, currency TEXT DEFAULT 'UGX', reference TEXT,
    status TEXT DEFAULT 'completed',
    property_id TEXT, property_title TEXT, job_id TEXT, contract_id TEXT,
    description TEXT, inspection_credit_applied BIGINT DEFAULT 0,
    rent_period TEXT, is_partial BOOLEAN DEFAULT false,
    receipt_url TEXT, failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), processed_at TIMESTAMPTZ
  )`, 'transactions table');

  await run(`CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    participants JSONB DEFAULT '[]',
    property_id TEXT, property_title TEXT,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, 'conversations table');

  await run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT, sender_name TEXT, sender_avatar TEXT,
    content TEXT NOT NULL, is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, 'messages table');

  await run(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT, type TEXT, title TEXT, body TEXT,
    is_read BOOLEAN DEFAULT false, action_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, 'notifications table');

  await run(`CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    user_id TEXT, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
    email TEXT, phone TEXT, avatar TEXT, category TEXT,
    skills JSONB DEFAULT '[]', bio TEXT, district TEXT, address TEXT,
    rating NUMERIC(3,1) DEFAULT 0, total_ratings INTEGER DEFAULT 0,
    total_jobs INTEGER DEFAULT 0, completed_jobs INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true, is_verified BOOLEAN DEFAULT false,
    is_suspended BOOLEAN DEFAULT false,
    daily_rate BIGINT, hourly_rate BIGINT,
    availability TEXT DEFAULT 'available',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_active_at TIMESTAMPTZ
  )`, 'vendors table');

  await run(`CREATE TABLE IF NOT EXISTS vendor_ratings (
    id TEXT PRIMARY KEY,
    vendor_id TEXT REFERENCES vendors(id) ON DELETE CASCADE,
    job_id TEXT, rated_by TEXT, rated_by_name TEXT,
    rating INTEGER, comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, 'vendor_ratings table');

  await run(`CREATE TABLE IF NOT EXISTS vendor_jobs (
    id TEXT PRIMARY KEY,
    vendor_id TEXT REFERENCES vendors(id) ON DELETE SET NULL,
    vendor_name TEXT, maintenance_request_id TEXT,
    property_title TEXT, property_address TEXT,
    title TEXT, description TEXT, status TEXT DEFAULT 'assigned',
    scheduled_date DATE, completed_date TIMESTAMPTZ,
    estimated_cost BIGINT, actual_cost BIGINT,
    manager_notes TEXT, vendor_notes TEXT,
    rating INTEGER, rating_comment TEXT,
    photos JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, 'vendor_jobs table');

  await run(`CREATE TABLE IF NOT EXISTS vendor_contracts (
    id TEXT PRIMARY KEY,
    vendor_id TEXT REFERENCES vendors(id) ON DELETE SET NULL,
    vendor_name TEXT, property_id TEXT, property_title TEXT,
    manager_id TEXT, type TEXT, description TEXT,
    amount BIGINT, currency TEXT DEFAULT 'UGX',
    start_date DATE, end_date DATE, status TEXT DEFAULT 'active',
    payment_method TEXT, next_payment_date DATE,
    total_paid BIGINT DEFAULT 0, payments_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, 'vendor_contracts table');

  await run(`CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    owner_id TEXT, owner_name TEXT, owner_role TEXT,
    name TEXT NOT NULL, category TEXT, status TEXT DEFAULT 'pending',
    file_url TEXT, file_type TEXT, file_size BIGINT,
    expires_at TIMESTAMPTZ, reviewed_by TEXT, reviewed_at TIMESTAMPTZ,
    admin_notes TEXT, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, 'documents table');

  await run(`CREATE TABLE IF NOT EXISTS tenant_notices (
    id TEXT PRIMARY KEY,
    property_id TEXT, property_title TEXT,
    tenant_id TEXT, tenant_name TEXT,
    issued_by TEXT, issued_by_role TEXT,
    type TEXT, subject TEXT, body TEXT,
    effective_date DATE, response_deadline DATE,
    status TEXT DEFAULT 'unread',
    requires_acknowledgement BOOLEAN DEFAULT false,
    attachment_url TEXT, tenant_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ, acknowledged_at TIMESTAMPTZ
  )`, 'tenant_notices table');

  await run(`CREATE TABLE IF NOT EXISTS disputes (
    id TEXT PRIMARY KEY,
    type TEXT, status TEXT DEFAULT 'open',
    raised_by_id TEXT, raised_by_name TEXT, raised_by_role TEXT,
    against_id TEXT, against_name TEXT, against_role TEXT,
    property_id TEXT, property_title TEXT, transaction_id TEXT,
    subject TEXT, description TEXT, evidence TEXT, amount BIGINT,
    resolution TEXT, resolved_by_id TEXT, resolved_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
  )`, 'disputes table');

  await run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    performed_by TEXT, performed_by_name TEXT, performed_by_role TEXT,
    target_id TEXT, target_name TEXT, description TEXT, metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, 'audit_logs table');

  await run(`CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL, body TEXT NOT NULL,
    target_roles JSONB DEFAULT '[]',
    sent_by TEXT, sent_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, 'announcements table');

  await run(`CREATE TABLE IF NOT EXISTS agent_applications (
    id TEXT PRIMARY KEY,
    user_id TEXT, first_name TEXT, last_name TEXT,
    email TEXT, phone TEXT, role TEXT DEFAULT 'agent',
    national_id_number TEXT, national_id_doc TEXT, additional_docs JSONB DEFAULT '[]'::jsonb,
    experience TEXT,
    districts JSONB DEFAULT '[]', motivation TEXT,
    status TEXT DEFAULT 'pending', admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reviewed_at TIMESTAMPTZ
  )`, 'agent_applications table');

  await run(`CREATE TABLE IF NOT EXISTS payment_preferences (
    user_id TEXT PRIMARY KEY,
    preferred_method TEXT, mtn_phone TEXT, airtel_phone TEXT,
    bank_name TEXT, bank_account_number TEXT, bank_account_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, 'payment_preferences table');

  await run(`CREATE TABLE IF NOT EXISTS platform_settings (
    id TEXT PRIMARY KEY,
    fee_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    company_accounts JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, 'platform_settings table');
  await run(`INSERT INTO platform_settings (id, fee_config, company_accounts) VALUES ('global', '{}'::jsonb, '{}'::jsonb) ON CONFLICT (id) DO NOTHING`, 'platform_settings seed');

  await run(`CREATE TABLE IF NOT EXISTS property_location_conflicts (
    id TEXT PRIMARY KEY,
    property_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    min_distance_meters NUMERIC(10,2),
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, 'property_location_conflicts table');

  console.log('📝 Patching agent_applications...');
  await run(`ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS national_id_doc TEXT`, 'agent_applications.national_id_doc');
  await run(`ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS additional_docs JSONB DEFAULT '[]'::jsonb`, 'agent_applications.additional_docs');

  // ── 8. Indexes ─────────────────────────────────────────────────────────────
  console.log('📇 Creating indexes...');
  const indexes = [
    [`CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender_id)`, 'idx_transactions_sender'],
    [`CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON transactions(receiver_id)`, 'idx_transactions_receiver'],
    [`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`, 'idx_notifications_user'],
    [`CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id)`, 'idx_messages_conv'],
    [`CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id)`, 'idx_documents_owner'],
    [`CREATE INDEX IF NOT EXISTS idx_notices_tenant ON tenant_notices(tenant_id)`, 'idx_notices_tenant'],
    [`CREATE INDEX IF NOT EXISTS idx_disputes_raised_by ON disputes(raised_by_id)`, 'idx_disputes_raised_by'],
    [`CREATE INDEX IF NOT EXISTS idx_vendor_jobs_vendor ON vendor_jobs(vendor_id)`, 'idx_vendor_jobs_vendor'],
  ];
  for (const [sql, label] of indexes) await run(sql, label);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ✅ Migration complete!');
  console.log('═══════════════════════════════════════════════════════\n');
  await pool.end();
}

main().catch(async e => {
  console.error('❌ Migration failed:', e.message);
  await pool.end();
  process.exit(1);
});
