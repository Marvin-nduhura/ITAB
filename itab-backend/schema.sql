-- ═══════════════════════════════════════════════════════════════════════════════
-- ITAB Database Schema
-- Run this ONCE to create all tables on Render PostgreSQL
-- ═══════════════════════════════════════════════════════════════════════════════

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  phone               TEXT,
  password_hash       TEXT,
  google_id           TEXT,
  avatar              TEXT,
  role                TEXT NOT NULL DEFAULT 'tenant',
  kyc_status          TEXT NOT NULL DEFAULT 'pending',
  is_verified         BOOLEAN NOT NULL DEFAULT false,
  is_suspended        BOOLEAN NOT NULL DEFAULT false,
  suspended_reason    TEXT,
  suspended_at        TIMESTAMPTZ,
  approval_status     TEXT DEFAULT 'pending',
  permissions         JSONB,
  restricted_districts JSONB,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Properties
CREATE TABLE IF NOT EXISTS properties (
  id                    TEXT PRIMARY KEY,
  title                 TEXT NOT NULL,
  description           TEXT,
  type                  TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'draft',
  address               TEXT NOT NULL,
  district              TEXT NOT NULL,
  latitude              NUMERIC(10,7) DEFAULT 0.3476,
  longitude             NUMERIC(10,7) DEFAULT 32.5825,
  bedrooms              INTEGER DEFAULT 0,
  bathrooms             INTEGER DEFAULT 0,
  square_footage        INTEGER,
  rent_price            BIGINT NOT NULL,
  deposit               BIGINT,
  available_from        DATE,
  photos                JSONB DEFAULT '[]',
  amenities             JSONB DEFAULT '[]',
  management_fee_percent NUMERIC(5,2) DEFAULT 10,
  itab_fee_percent      NUMERIC(5,2) DEFAULT 2,
  is_featured           BOOLEAN DEFAULT false,
  tour_url              TEXT,
  manager_id            TEXT REFERENCES users(id) ON DELETE SET NULL,
  manager_name          TEXT,
  landlord_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  landlord_name         TEXT,
  tenant_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
  lease_start           DATE,
  lease_end             DATE,
  view_count            INTEGER DEFAULT 0,
  created_by_id         TEXT,
  created_by_name       TEXT,
  created_by_role       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Possible duplicate listings (same / very close map pin)
CREATE TABLE IF NOT EXISTS property_location_conflicts (
  id                    TEXT PRIMARY KEY,
  property_ids          JSONB NOT NULL DEFAULT '[]',
  latitude              NUMERIC(10,7),
  longitude             NUMERIC(10,7),
  min_distance_meters   NUMERIC(10,2),
  reason                TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',
  reviewed_by           TEXT,
  reviewed_at           TIMESTAMPTZ,
  admin_notes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inspections
CREATE TABLE IF NOT EXISTS inspections (
  id                    TEXT PRIMARY KEY,
  property_id           TEXT REFERENCES properties(id) ON DELETE CASCADE,
  property_title        TEXT,
  property_address      TEXT,
  tenant_id             TEXT REFERENCES users(id) ON DELETE CASCADE,
  tenant_name           TEXT,
  manager_id            TEXT REFERENCES users(id) ON DELETE SET NULL,
  scheduled_date        DATE,
  scheduled_time        TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',
  fee_amount            BIGINT DEFAULT 100000,
  fee_paid              BOOLEAN DEFAULT false,
  payment_method        TEXT,
  payment_ref           TEXT,
  credit_applied        BOOLEAN DEFAULT false,
  qr_code               TEXT,
  notes                 TEXT,
  no_show_count         INTEGER DEFAULT 0,
  reschedule_count      INTEGER DEFAULT 0,
  lease_declined        BOOLEAN DEFAULT false,
  lease_declined_reason TEXT,
  lease_declined_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id                        TEXT PRIMARY KEY,
  type                      TEXT NOT NULL,
  amount                    BIGINT NOT NULL,
  currency                  TEXT DEFAULT 'UGX',
  status                    TEXT NOT NULL DEFAULT 'pending',
  method                    TEXT,
  reference                 TEXT,
  property_id               TEXT,
  property_title            TEXT,
  tenant_id                 TEXT REFERENCES users(id) ON DELETE SET NULL,
  tenant_name               TEXT,
  landlord_id               TEXT REFERENCES users(id) ON DELETE SET NULL,
  inspection_credit_applied BIGINT DEFAULT 0,
  rent_period               TEXT,
  is_partial                BOOLEAN DEFAULT false,
  receipt_url               TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at                   TIMESTAMPTZ
);

-- Platform Transactions (full audit trail)
CREATE TABLE IF NOT EXISTS transactions (
  id                        TEXT PRIMARY KEY,
  type                      TEXT NOT NULL,
  sender_id                 TEXT,
  sender_name               TEXT,
  sender_role               TEXT,
  sender_method             TEXT,
  sender_phone              TEXT,
  receiver_id               TEXT,
  receiver_name             TEXT,
  receiver_role             TEXT,
  receiver_method           TEXT,
  receiver_phone            TEXT,
  receiver_bank_details     JSONB,
  amount                    BIGINT NOT NULL,
  currency                  TEXT DEFAULT 'UGX',
  reference                 TEXT,
  status                    TEXT DEFAULT 'completed',
  property_id               TEXT,
  property_title            TEXT,
  job_id                    TEXT,
  contract_id               TEXT,
  description               TEXT,
  inspection_credit_applied BIGINT DEFAULT 0,
  rent_period               TEXT,
  is_partial                BOOLEAN DEFAULT false,
  receipt_url               TEXT,
  failure_reason            TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at              TIMESTAMPTZ
);

-- Maintenance Requests
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id             TEXT PRIMARY KEY,
  property_id    TEXT REFERENCES properties(id) ON DELETE CASCADE,
  property_title TEXT,
  tenant_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  tenant_name    TEXT,
  title          TEXT NOT NULL,
  description    TEXT,
  priority       TEXT DEFAULT 'normal',
  status         TEXT DEFAULT 'submitted',
  photos         JSONB DEFAULT '[]',
  vendor_id      TEXT,
  vendor_name    TEXT,
  estimated_cost BIGINT,
  actual_cost    BIGINT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

-- Payouts
CREATE TABLE IF NOT EXISTS payouts (
  id             TEXT PRIMARY KEY,
  landlord_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  landlord_name  TEXT,
  property_id    TEXT REFERENCES properties(id) ON DELETE SET NULL,
  property_title TEXT,
  gross_rent     BIGINT,
  management_fee BIGINT,
  itab_fee       BIGINT,
  net_amount     BIGINT,
  status         TEXT DEFAULT 'pending',
  method         TEXT,
  reference      TEXT,
  scheduled_date DATE,
  processed_at   TIMESTAMPTZ,
  retry_count    INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id             TEXT PRIMARY KEY,
  participants   JSONB DEFAULT '[]',
  property_id    TEXT,
  property_title TEXT,
  unread_count   INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  sender_name     TEXT,
  sender_avatar   TEXT,
  content         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT,
  title      TEXT,
  body       TEXT,
  is_read    BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id             TEXT PRIMARY KEY,
  user_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT,
  phone          TEXT,
  avatar         TEXT,
  category       TEXT,
  skills         JSONB DEFAULT '[]',
  bio            TEXT,
  district       TEXT,
  address        TEXT,
  rating         NUMERIC(3,1) DEFAULT 0,
  total_ratings  INTEGER DEFAULT 0,
  total_jobs     INTEGER DEFAULT 0,
  completed_jobs INTEGER DEFAULT 0,
  is_active      BOOLEAN DEFAULT true,
  is_verified    BOOLEAN DEFAULT false,
  is_suspended   BOOLEAN DEFAULT false,
  daily_rate     BIGINT,
  hourly_rate    BIGINT,
  availability   TEXT DEFAULT 'available',
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

-- Vendor Ratings
CREATE TABLE IF NOT EXISTS vendor_ratings (
  id            TEXT PRIMARY KEY,
  vendor_id     TEXT REFERENCES vendors(id) ON DELETE CASCADE,
  job_id        TEXT,
  rated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  rated_by_name TEXT,
  rating        INTEGER,
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vendor Jobs
CREATE TABLE IF NOT EXISTS vendor_jobs (
  id                    TEXT PRIMARY KEY,
  vendor_id             TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_name           TEXT,
  maintenance_request_id TEXT,
  property_title        TEXT,
  property_address      TEXT,
  title                 TEXT,
  description           TEXT,
  status                TEXT DEFAULT 'assigned',
  scheduled_date        DATE,
  completed_date        TIMESTAMPTZ,
  estimated_cost        BIGINT,
  actual_cost           BIGINT,
  manager_notes         TEXT,
  vendor_notes          TEXT,
  rating                INTEGER,
  rating_comment        TEXT,
  photos                JSONB DEFAULT '[]',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vendor Contracts
CREATE TABLE IF NOT EXISTS vendor_contracts (
  id               TEXT PRIMARY KEY,
  vendor_id        TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_name      TEXT,
  property_id      TEXT REFERENCES properties(id) ON DELETE SET NULL,
  property_title   TEXT,
  manager_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  type             TEXT,
  description      TEXT,
  amount           BIGINT,
  currency         TEXT DEFAULT 'UGX',
  start_date       DATE,
  end_date         DATE,
  status           TEXT DEFAULT 'active',
  payment_method   TEXT,
  next_payment_date DATE,
  total_paid       BIGINT DEFAULT 0,
  payments_count   INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  owner_name  TEXT,
  owner_role  TEXT,
  name        TEXT NOT NULL,
  category    TEXT,
  status      TEXT DEFAULT 'pending',
  file_url    TEXT,
  file_type   TEXT,
  file_size   BIGINT,
  expires_at  TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tenant Notices
CREATE TABLE IF NOT EXISTS tenant_notices (
  id                      TEXT PRIMARY KEY,
  property_id             TEXT REFERENCES properties(id) ON DELETE CASCADE,
  property_title          TEXT,
  tenant_id               TEXT REFERENCES users(id) ON DELETE CASCADE,
  tenant_name             TEXT,
  issued_by               TEXT,
  issued_by_role          TEXT,
  type                    TEXT,
  subject                 TEXT,
  body                    TEXT,
  effective_date          DATE,
  response_deadline       DATE,
  status                  TEXT DEFAULT 'unread',
  requires_acknowledgement BOOLEAN DEFAULT false,
  attachment_url          TEXT,
  tenant_response         TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at                 TIMESTAMPTZ,
  acknowledged_at         TIMESTAMPTZ
);

-- Disputes
CREATE TABLE IF NOT EXISTS disputes (
  id               TEXT PRIMARY KEY,
  type             TEXT,
  status           TEXT DEFAULT 'open',
  raised_by_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  raised_by_name   TEXT,
  raised_by_role   TEXT,
  against_id       TEXT,
  against_name     TEXT,
  against_role     TEXT,
  property_id      TEXT,
  property_title   TEXT,
  transaction_id   TEXT,
  subject          TEXT,
  description      TEXT,
  evidence         TEXT,
  amount           BIGINT,
  resolution       TEXT,
  resolved_by_id   TEXT,
  resolved_by_name TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id                TEXT PRIMARY KEY,
  action            TEXT NOT NULL,
  performed_by      TEXT,
  performed_by_name TEXT,
  performed_by_role TEXT,
  target_id         TEXT,
  target_name       TEXT,
  description       TEXT,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  target_roles JSONB DEFAULT '[]',
  sent_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  sent_by_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Applications
CREATE TABLE IF NOT EXISTS agent_applications (
  id                TEXT PRIMARY KEY,
  user_id           TEXT,
  first_name        TEXT,
  last_name         TEXT,
  email             TEXT,
  phone             TEXT,
  role              TEXT DEFAULT 'agent',
  national_id_number TEXT,
  national_id_doc   TEXT,
  additional_docs   JSONB DEFAULT '[]',
  experience        TEXT,
  districts         JSONB DEFAULT '[]',
  motivation        TEXT,
  status            TEXT DEFAULT 'pending',
  admin_note        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ
);

-- Payment Preferences
CREATE TABLE IF NOT EXISTS payment_preferences (
  user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_method    TEXT,
  mtn_phone           TEXT,
  airtel_phone        TEXT,
  bank_name           TEXT,
  bank_account_number TEXT,
  bank_account_name   TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global fee & company payout configuration (single row, Render DB source of truth)
CREATE TABLE IF NOT EXISTS platform_settings (
  id                 TEXT PRIMARY KEY,
  fee_config           JSONB NOT NULL DEFAULT '{}',
  company_accounts     JSONB NOT NULL DEFAULT '{}',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_district ON properties(district);
CREATE INDEX IF NOT EXISTS idx_properties_manager ON properties(manager_id);
CREATE INDEX IF NOT EXISTS idx_inspections_tenant ON inspections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inspections_manager ON inspections(manager_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tenant ON maintenance_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_property ON maintenance_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_notices_tenant ON tenant_notices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_disputes_raised_by ON disputes(raised_by_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_vendor_jobs_vendor ON vendor_jobs(vendor_id);

-- Property Units (for apartments and commercial buildings with multiple rentable units)
CREATE TABLE IF NOT EXISTS property_units (
  id                TEXT PRIMARY KEY,
  property_id       TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_name         TEXT NOT NULL,            -- e.g. "Unit A", "Floor 2", "Shop 3"
  description       TEXT,
  floor_number      INTEGER,
  bedrooms          INTEGER DEFAULT 0,
  bathrooms         INTEGER DEFAULT 0,
  square_footage    INTEGER,
  rent_price        BIGINT NOT NULL,
  deposit           BIGINT,
  photos            JSONB DEFAULT '[]',
  amenities         JSONB DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'available', -- available | rented | under_maintenance
  tenant_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  tenant_name       TEXT,
  lease_start       DATE,
  lease_end         DATE,
  available_from    DATE,
  is_featured       BOOLEAN DEFAULT false,
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_units_property ON property_units(property_id);
CREATE INDEX IF NOT EXISTS idx_property_units_tenant   ON property_units(tenant_id);
