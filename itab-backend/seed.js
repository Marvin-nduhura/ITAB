/**
 * ITAB Seed Script
 * Seeds all mock data into Render PostgreSQL using proper UUIDs.
 * Safe to re-run — uses ON CONFLICT DO NOTHING / DO UPDATE.
 * Run: node seed.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function q(text, params) {
  const c = await pool.connect();
  try { return await c.query(text, params); }
  finally { c.release(); }
}

// ── Fixed UUIDs (consistent across re-runs) ───────────────────────────────────
const U = {
  admin:    '00000000-0000-0000-0000-000000000001',
  manager:  '00000000-0000-0000-0000-000000000002',
  landlord: '00000000-0000-0000-0000-000000000003',
  tenant:   '00000000-0000-0000-0000-000000000004',
  agent:    '00000000-0000-0000-0000-000000000005',
  vendor:   '00000000-0000-0000-0000-000000000006',
};
const P = {
  p1: '10000000-0000-0000-0000-000000000001',
  p2: '10000000-0000-0000-0000-000000000002',
  p3: '10000000-0000-0000-0000-000000000003',
  p4: '10000000-0000-0000-0000-000000000004',
  p5: '10000000-0000-0000-0000-000000000005',
  p6: '10000000-0000-0000-0000-000000000006',
};
// UUIDs for tables that have uuid id columns (inspections, payments, payouts, maintenance)
const I = {
  i1: '20000000-0000-0000-0000-000000000001',
  i2: '20000000-0000-0000-0000-000000000002',
  i3: '20000000-0000-0000-0000-000000000003',
};
const PAY = {
  pay1: '30000000-0000-0000-0000-000000000001',
  pay2: '30000000-0000-0000-0000-000000000002',
  pay3: '30000000-0000-0000-0000-000000000003',
  pay4: '30000000-0000-0000-0000-000000000004',
  pay5: '30000000-0000-0000-0000-000000000005',
  pay6: '30000000-0000-0000-0000-000000000006',
};
const M = {
  m1: '40000000-0000-0000-0000-000000000001',
  m2: '40000000-0000-0000-0000-000000000002',
};
const PO = {
  po1: '50000000-0000-0000-0000-000000000001',
};


// ── 1. Users ──────────────────────────────────────────────────────────────────
async function seedUsers() {
  console.log('👤 Seeding users...');
  const pw = await bcrypt.hash('password123', 12);
  const rows = [
    [U.admin,    'Admin',  'ITAB',      'admin@itab.ug',    '0700000001', 'admin',            '2024-01-01T00:00:00Z'],
    [U.manager,  'Sarah',  'Nakato',    'manager@itab.ug',  '0700000002', 'property_manager', '2024-01-05T00:00:00Z'],
    [U.landlord, 'John',   'Ssemakula', 'landlord@itab.ug', '0700000003', 'landlord',         '2024-01-10T00:00:00Z'],
    [U.tenant,   'Grace',  'Apio',      'tenant@itab.ug',   '0700000004', 'tenant',           '2024-02-01T00:00:00Z'],
    [U.agent,    'David',  'Ochieng',   'agent@itab.ug',    '0700000005', 'agent',            '2024-02-15T00:00:00Z'],
    [U.vendor,   'Peter',  'Mugisha',   'vendor@itab.ug',   '0772100001', 'vendor',           '2023-06-01T00:00:00Z'],
  ];
  for (const [id, fn, ln, email, phone, role, ts] of rows) {
    await q(
      `INSERT INTO users (id,first_name,last_name,email,phone,password_hash,role,kyc_status,is_verified,is_suspended,approval_status,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'approved',true,false,'approved',$8,$8)
       ON CONFLICT (email) DO UPDATE SET
         first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
         role=EXCLUDED.role, kyc_status='approved', is_verified=true, is_suspended=false,
         approval_status='approved', password_hash=EXCLUDED.password_hash`,
      [id, fn, ln, email, phone, pw, role, ts]
    );
  }
  console.log(`  ✅ ${rows.length} users seeded.`);
}

// ── 2. Properties ─────────────────────────────────────────────────────────────
async function seedProperties() {
  console.log('🏠 Seeding properties...');
  const props = [
    {
      id: P.p1, title: '3-Bedroom Apartment in Kololo',
      desc: 'Spacious modern apartment with stunning city views, fully furnished with high-end finishes.',
      type: 'apartment', status: 'published', addr: 'Plot 12, Kololo Hill Drive', dist: 'Kampala',
      lat: 0.3476, lng: 32.5825, bed: 3, bath: 2, sqft: 180, rent: 2500000, dep: 5000000, avail: '2024-03-01',
      photos: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800','https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'],
      amenities: ['wifi','furnished','parking','security','backup_power','water_tank'],
      mgmtFee: 10, itabFee: 2, featured: true,
      mgr: U.manager, mgrName: 'Sarah Nakato', lld: U.landlord, lldName: 'John Ssemakula',
      ten: null, ls: null, le: null, views: 245, created: '2024-01-15T00:00:00Z', updated: '2024-02-01T00:00:00Z',
    },
    {
      id: P.p2, title: '2-Bedroom House in Ntinda',
      desc: 'Cozy family home in a quiet neighborhood. Tiled throughout with a beautiful garden.',
      type: 'house', status: 'published', addr: 'Plot 45, Ntinda Road', dist: 'Kampala',
      lat: 0.3601, lng: 32.6108, bed: 2, bath: 1, sqft: 120, rent: 1200000, dep: 2400000, avail: '2024-03-15',
      photos: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800'],
      amenities: ['tiled','kitchen','perimeter_wall','parking','water_tank'],
      mgmtFee: 8, itabFee: 2, featured: false,
      mgr: U.manager, mgrName: 'Sarah Nakato', lld: U.landlord, lldName: 'John Ssemakula',
      ten: null, ls: null, le: null, views: 189, created: '2024-01-20T00:00:00Z', updated: '2024-02-05T00:00:00Z',
    },
    {
      id: P.p3, title: 'Studio Apartment in Bukoto',
      desc: 'Modern studio perfect for young professionals. Walking distance to Bukoto market.',
      type: 'apartment', status: 'published', addr: 'Plot 8, Bukoto Street', dist: 'Kampala',
      lat: 0.3512, lng: 32.5967, bed: 1, bath: 1, sqft: 45, rent: 650000, dep: 1300000, avail: '2024-02-20',
      photos: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'],
      amenities: ['wifi','tiled','kitchen','security'],
      mgmtFee: 10, itabFee: 2, featured: false,
      mgr: U.manager, mgrName: 'Sarah Nakato', lld: U.landlord, lldName: 'John Ssemakula',
      ten: null, ls: null, le: null, views: 312, created: '2024-01-25T00:00:00Z', updated: '2024-02-10T00:00:00Z',
    },
    {
      id: P.p4, title: '4-Bedroom Villa in Muyenga',
      desc: 'Luxurious villa with private pool, gym, and panoramic lake views.',
      type: 'house', status: 'published', addr: 'Plot 3, Tank Hill Road, Muyenga', dist: 'Kampala',
      lat: 0.2987, lng: 32.5876, bed: 4, bath: 3, sqft: 350, rent: 8000000, dep: 16000000, avail: '2024-04-01',
      photos: ['https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800'],
      amenities: ['wifi','furnished','parking','gym','pool','security','backup_power','water_tank','cctv','garden'],
      mgmtFee: 12, itabFee: 2, featured: true,
      mgr: U.manager, mgrName: 'Sarah Nakato', lld: U.landlord, lldName: 'John Ssemakula',
      ten: null, ls: null, le: null, views: 567, created: '2024-02-01T00:00:00Z', updated: '2024-02-15T00:00:00Z',
    },
    {
      id: P.p5, title: 'Commercial Space in Nakasero',
      desc: 'Prime commercial space in Nakasero CBD. Ideal for offices, retail, or restaurant.',
      type: 'commercial', status: 'published', addr: 'Plot 22, Nakasero Road', dist: 'Kampala',
      lat: 0.3190, lng: 32.5773, bed: 0, bath: 2, sqft: 200, rent: 5000000, dep: 10000000, avail: '2024-03-01',
      photos: ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800'],
      amenities: ['wifi','parking','security','backup_power','cctv'],
      mgmtFee: 10, itabFee: 2, featured: false,
      mgr: U.manager, mgrName: 'Sarah Nakato', lld: U.landlord, lldName: 'John Ssemakula',
      ten: null, ls: null, le: null, views: 134, created: '2024-02-05T00:00:00Z', updated: '2024-02-20T00:00:00Z',
    },
    {
      id: P.p6, title: '1-Bedroom Apartment in Entebbe',
      desc: 'Peaceful apartment near Entebbe International Airport. Great for frequent travelers.',
      type: 'apartment', status: 'rented', addr: 'Plot 15, Entebbe Road', dist: 'Entebbe',
      lat: 0.0512, lng: 32.4637, bed: 1, bath: 1, sqft: 65, rent: 900000, dep: 1800000, avail: '2024-05-01',
      photos: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800'],
      amenities: ['wifi','tiled','kitchen','parking','security'],
      mgmtFee: 10, itabFee: 2, featured: false,
      mgr: U.manager, mgrName: 'Sarah Nakato', lld: U.landlord, lldName: 'John Ssemakula',
      ten: U.tenant, ls: '2024-02-01', le: '2025-01-31', views: 98, created: '2024-01-30T00:00:00Z', updated: '2024-02-01T00:00:00Z',
    },
  ];
  for (const p of props) {
    await q(
      `INSERT INTO properties (id,title,description,type,status,address,district,latitude,longitude,
       bedrooms,bathrooms,square_footage,rent_price,deposit,available_from,photos,amenities,
       management_fee_percent,itab_fee_percent,is_featured,manager_id,manager_name,
       landlord_id,landlord_name,tenant_id,lease_start,lease_end,view_count,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
       ON CONFLICT (id) DO NOTHING`,
      [p.id,p.title,p.desc,p.type,p.status,p.addr,p.dist,p.lat,p.lng,
       p.bed,p.bath,p.sqft,p.rent,p.dep,p.avail,
       JSON.stringify(p.photos),JSON.stringify(p.amenities),
       p.mgmtFee,p.itabFee,p.featured,p.mgr,p.mgrName,p.lld,p.lldName,
       p.ten,p.ls,p.le,p.views,p.created,p.updated]
    );
  }
  console.log(`  ✅ ${props.length} properties seeded.`);
}


// ── 3. Inspections ────────────────────────────────────────────────────────────
async function seedInspections() {
  console.log('🔍 Seeding inspections...');
  const rows = [
    [I.i1, P.p1, '3-Bedroom Apartment in Kololo', 'Plot 12, Kololo Hill Drive',
     U.tenant, 'Grace Apio', U.manager, '2024-03-10', '10:00',
     'confirmed', 100000, true, 'mtn_momo', 'MTN-2024-001', false, 0, 0,
     false, null, null, '2024-03-05T00:00:00Z'],
    [I.i2, P.p2, '2-Bedroom House in Ntinda', 'Plot 45, Ntinda Road',
     U.tenant, 'Grace Apio', U.manager, '2024-03-15', '14:00',
     'pending', 100000, false, null, null, false, 0, 0,
     false, null, null, '2024-03-08T00:00:00Z'],
    [I.i3, P.p3, 'Studio Apartment in Bukoto', 'Plot 8, Bukoto Street',
     U.tenant, 'Grace Apio', U.manager, '2024-02-20', '11:00',
     'completed', 100000, true, 'airtel_money', 'AIR-2024-005', false, 0, 0,
     true, 'The space was too small for my needs.', '2024-02-21T09:00:00Z', '2024-02-15T00:00:00Z'],
  ];
  for (const r of rows) {
    await q(
      `INSERT INTO inspections (id,property_id,property_title,property_address,tenant_id,tenant_name,
       manager_id,scheduled_date,scheduled_time,status,fee_amount,fee_paid,payment_method,payment_ref,
       credit_applied,no_show_count,reschedule_count,lease_declined,lease_declined_reason,
       lease_declined_at,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       ON CONFLICT (id) DO NOTHING`,
      r
    );
  }
  console.log(`  ✅ ${rows.length} inspections seeded.`);
}

// ── 4. Payments ───────────────────────────────────────────────────────────────
async function seedPayments() {
  console.log('💳 Seeding payments...');
  const rows = [
    [PAY.pay1,'inspection_fee',100000,'UGX','completed','mtn_momo','MTN-2024-001',P.p1,'3-Bedroom Apartment in Kololo',U.tenant,'Grace Apio',null,0,null,false,'2024-03-05T10:00:00Z','2024-03-05T10:30:00Z'],
    [PAY.pay2,'rent',800000,'UGX','completed','mtn_momo','MTN-2024-002',P.p6,'1-Bedroom Apartment in Entebbe',U.tenant,'Grace Apio',null,100000,'2024-02',false,'2024-02-01T08:00:00Z','2024-02-01T09:00:00Z'],
    [PAY.pay3,'rent_partial',500000,'UGX','completed','mtn_momo','MTN-2024-003',P.p6,'1-Bedroom Apartment in Entebbe',U.tenant,'Grace Apio',null,0,'2024-03',true,'2024-03-01T08:00:00Z','2024-03-01T09:00:00Z'],
    [PAY.pay4,'rent_partial',400000,'UGX','completed','airtel_money','AIR-2024-001',P.p6,'1-Bedroom Apartment in Entebbe',U.tenant,'Grace Apio',null,0,'2024-03',true,'2024-03-15T08:00:00Z','2024-03-15T09:00:00Z'],
    [PAY.pay5,'rent_partial',300000,'UGX','completed','mtn_momo','MTN-2024-004',P.p6,'1-Bedroom Apartment in Entebbe',U.tenant,'Grace Apio',null,0,'2024-04',true,'2024-04-01T08:00:00Z','2024-04-01T09:00:00Z'],
    [PAY.pay6,'inspection_fee',100000,'UGX','completed','airtel_money','AIR-2024-005',P.p3,'Studio Apartment in Bukoto',U.tenant,'Grace Apio',null,0,null,false,'2024-02-15T10:00:00Z','2024-02-15T10:30:00Z'],
  ];
  for (const r of rows) {
    await q(
      `INSERT INTO payments (id,type,amount,currency,status,method,reference,property_id,property_title,
       tenant_id,tenant_name,landlord_id,inspection_credit_applied,rent_period,is_partial,created_at,paid_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING`,
      r
    );
  }
  console.log(`  ✅ ${rows.length} payments seeded.`);
}

// ── 5. Transactions ───────────────────────────────────────────────────────────
async function seedTransactions() {
  console.log('💰 Seeding transactions...');
  const rows = [
    ['tx_insp1a','inspection_fee',U.tenant,'Grace Apio','tenant','mtn_momo','0700000004','escrow','ITAB Escrow','platform','escrow',100000,'UGX','MTN-2024-001','completed',P.p1,'3-Bedroom Apartment in Kololo','Inspection fee for 3-Bedroom Apartment in Kololo',0,null,'2024-03-05T10:00:00Z','2024-03-05T10:00:00Z'],
    ['tx_insp1b','platform_fee','escrow','ITAB Escrow','platform','escrow',null,'itab_platform','ITAB Property Services','platform','escrow',50000,'UGX','MTN-2024-001-FEE','completed',P.p1,'3-Bedroom Apartment in Kololo','ITAB share of inspection fee',0,null,'2024-03-05T10:00:00Z','2024-03-05T10:00:00Z'],
    ['tx_insp1c','management_fee_payout','escrow','ITAB Escrow','platform','escrow',null,U.manager,'Sarah Nakato','property_manager','mtn_momo',50000,'UGX','MTN-2024-001-MGR','completed',P.p1,'3-Bedroom Apartment in Kololo','Manager share of inspection fee',0,null,'2024-03-05T10:00:00Z','2024-03-05T10:00:00Z'],
    ['tx_rent2a','rent_payment',U.tenant,'Grace Apio','tenant','mtn_momo','0700000004','escrow','ITAB Escrow','platform','escrow',800000,'UGX','MTN-2024-002','completed',P.p6,'1-Bedroom Apartment in Entebbe','Rent payment Feb 2024',100000,'2024-02','2024-02-01T08:00:00Z','2024-02-01T09:00:00Z'],
    ['tx_rent2b','platform_fee','escrow','ITAB Escrow','platform','escrow',null,'itab_platform','ITAB Property Services','platform','escrow',18000,'UGX','MTN-2024-002-FEE','completed',P.p6,'1-Bedroom Apartment in Entebbe','Platform fee 2% on rent',0,'2024-02','2024-02-01T09:00:00Z','2024-02-01T09:00:00Z'],
    ['tx_rent2c','management_fee_payout','escrow','ITAB Escrow','platform','escrow',null,U.manager,'Sarah Nakato','property_manager','mtn_momo',90000,'UGX','MTN-2024-002-MGR','completed',P.p6,'1-Bedroom Apartment in Entebbe','Management fee 10%',0,'2024-02','2024-02-01T09:00:00Z','2024-02-01T09:00:00Z'],
    ['tx_rent2d','landlord_payout','escrow','ITAB Escrow','platform','escrow',null,U.landlord,'John Ssemakula','landlord','mtn_momo',692000,'UGX','MTN-2024-002-LLD','completed',P.p6,'1-Bedroom Apartment in Entebbe','Net rent payout Feb 2024',100000,'2024-02','2024-02-01T09:00:00Z','2024-02-01T09:00:00Z'],
    ['tx_insp6a','inspection_fee',U.tenant,'Grace Apio','tenant','airtel_money','0700000004','escrow','ITAB Escrow','platform','escrow',100000,'UGX','AIR-2024-005','completed',P.p3,'Studio Apartment in Bukoto','Inspection fee Studio Bukoto',0,null,'2024-02-15T10:00:00Z','2024-02-15T10:00:00Z'],
    ['tx_insp6b','platform_fee','escrow','ITAB Escrow','platform','escrow',null,'itab_platform','ITAB Property Services','platform','escrow',50000,'UGX','AIR-2024-005-FEE','completed',P.p3,'Studio Apartment in Bukoto','ITAB share inspection fee',0,null,'2024-02-15T10:00:00Z','2024-02-15T10:00:00Z'],
    ['tx_insp6c','management_fee_payout','escrow','ITAB Escrow','platform','escrow',null,U.manager,'Sarah Nakato','property_manager','mtn_momo',50000,'UGX','AIR-2024-005-MGR','completed',P.p3,'Studio Apartment in Bukoto','Manager share inspection fee',0,null,'2024-02-15T10:00:00Z','2024-02-15T10:00:00Z'],
  ];
  for (const r of rows) {
    await q(
      `INSERT INTO transactions (id,type,sender_id,sender_name,sender_role,sender_method,sender_phone,
       receiver_id,receiver_name,receiver_role,receiver_method,amount,currency,reference,status,
       property_id,property_title,description,inspection_credit_applied,rent_period,created_at,processed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       ON CONFLICT (id) DO NOTHING`,
      r
    );
  }
  console.log(`  ✅ ${rows.length} transactions seeded.`);
}

// ── 6. Maintenance ────────────────────────────────────────────────────────────
async function seedMaintenance() {
  console.log('🔧 Seeding maintenance...');
  const rows = [
    [M.m1,P.p6,'1-Bedroom Apartment in Entebbe',U.tenant,'Grace Apio',
     'Leaking tap in bathroom','The bathroom tap has been leaking for 3 days.',
     'normal','in_progress','[]',null,'Peter Plumbing Services',50000,null,
     '2024-03-01T00:00:00Z','2024-03-02T00:00:00Z',null],
    [M.m2,P.p6,'1-Bedroom Apartment in Entebbe',U.tenant,'Grace Apio',
     'Power outage in bedroom','The bedroom socket is not working.',
     'urgent','submitted','[]',null,null,null,null,
     '2024-03-05T00:00:00Z','2024-03-05T00:00:00Z',null],
  ];
  for (const r of rows) {
    await q(
      `INSERT INTO maintenance_requests (id,property_id,property_title,tenant_id,tenant_name,
       title,description,priority,status,photos,vendor_id,vendor_name,estimated_cost,actual_cost,
       created_at,updated_at,completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING`,
      r
    );
  }
  console.log(`  ✅ ${rows.length} maintenance requests seeded.`);
}

// ── 7. Payouts ────────────────────────────────────────────────────────────────
async function seedPayouts() {
  console.log('💸 Seeding payouts...');
  await q(
    `INSERT INTO payouts (id,landlord_id,landlord_name,property_id,property_title,
     gross_rent,management_fee,itab_fee,net_amount,status,method,reference,
     scheduled_date,processed_at,retry_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (id) DO NOTHING`,
    [PO.po1,U.landlord,'John Ssemakula',P.p6,'1-Bedroom Apartment in Entebbe',
     900000,90000,18000,792000,'completed','mtn_momo','PAYOUT-2024-001',
     '2024-03-05','2024-03-05T10:00:00Z',0]
  );
  console.log('  ✅ 1 payout seeded.');
}


// ── 8. Vendors ────────────────────────────────────────────────────────────────
async function seedVendors() {
  console.log('🛠️  Seeding vendors...');
  const rows = [
    ['v1',U.vendor,'Peter','Mugisha','vendor@itab.ug','0772100001','plumber',
     ['Pipe fitting','Drain unblocking','Tap repair','Water heater installation'],
     'Licensed plumber with 8 years experience.','Kampala','Ntinda, Kampala',
     4.7,23,31,28,true,true,false,80000,15000,'available','2023-06-01T00:00:00Z','2024-04-01T00:00:00Z'],
    ['v2',null,'James','Okello','james@electric.ug','0772100002','electrician',
     ['Wiring','Solar installation','Generator repair','CCTV installation'],
     'Certified electrician specializing in solar systems.','Kampala','Bukoto, Kampala',
     4.9,41,55,52,true,true,false,100000,20000,'available','2023-03-15T00:00:00Z','2024-04-05T00:00:00Z'],
    ['v3',null,'Mary','Namukasa','mary@cleanpro.ug','0772100003','cleaner',
     ['Deep cleaning','Carpet cleaning','Post-construction cleaning'],
     'Professional cleaning service with a team of 5.','Kampala','Kololo, Kampala',
     4.5,18,24,22,true,true,false,60000,10000,'busy','2023-08-20T00:00:00Z','2024-04-03T00:00:00Z'],
    ['v4',null,'Robert','Ssebunya','robert@mason.ug','0772100004','mason',
     ['Tiling','Plastering','Bricklaying','Waterproofing'],
     'Experienced mason with expertise in tiling.','Wakiso','Entebbe Road, Wakiso',
     4.3,12,15,13,true,false,false,90000,18000,'available','2023-11-10T00:00:00Z','2024-03-28T00:00:00Z'],
    ['v5',null,'Agnes','Atim','agnes@garden.ug','0772100005','gardener',
     ['Lawn mowing','Tree trimming','Garden design'],
     'Passionate gardener offering regular maintenance.','Kampala','Muyenga, Kampala',
     4.6,9,11,10,true,true,false,50000,8000,'available','2024-01-05T00:00:00Z','2024-04-04T00:00:00Z'],
    ['v6',null,'Hassan','Kiggundu','hassan@painter.ug','0772100006','painter',
     ['Interior painting','Exterior painting','Texture painting'],
     'Professional painter with 10 years experience.','Kampala','Nakawa, Kampala',
     4.4,16,20,18,true,true,false,70000,12000,'available','2023-05-12T00:00:00Z','2024-04-02T00:00:00Z'],
  ];
  for (const r of rows) {
    const [id,userId,fn,ln,email,phone,cat,skills,bio,dist,addr,rating,totalRatings,totalJobs,completedJobs,isActive,isVerified,isSuspended,dailyRate,hourlyRate,avail,joinedAt,lastActiveAt] = r;
    await q(
      `INSERT INTO vendors (id,user_id,first_name,last_name,email,phone,category,skills,bio,district,address,
       rating,total_ratings,total_jobs,completed_jobs,is_active,is_verified,is_suspended,
       daily_rate,hourly_rate,availability,joined_at,last_active_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       ON CONFLICT (id) DO NOTHING`,
      [id,userId,fn,ln,email,phone,cat,JSON.stringify(skills),bio,dist,addr,
       rating,totalRatings,totalJobs,completedJobs,isActive,isVerified,isSuspended,
       dailyRate,hourlyRate,avail,joinedAt,lastActiveAt]
    );
  }
  console.log(`  ✅ ${rows.length} vendors seeded.`);
}

// ── 9. Vendor Jobs ────────────────────────────────────────────────────────────
async function seedVendorJobs() {
  console.log('👷 Seeding vendor jobs...');
  const rows = [
    ['j1','v1','Peter Mugisha',M.m1,'1-Bedroom Apartment in Entebbe','Plot 15, Entebbe Road',
     'Fix leaking tap in bathroom','Bathroom tap has been leaking for 3 days.',
     'in_progress','2024-03-03',null,50000,null,'Please fix by end of week.',null,null,null,'[]',
     '2024-03-02T00:00:00Z','2024-03-03T00:00:00Z'],
    ['j2','v2','James Okello',M.m2,'1-Bedroom Apartment in Entebbe','Plot 15, Entebbe Road',
     'Fix bedroom socket','Bedroom socket not working.',
     'assigned','2024-03-07',null,30000,null,'Urgent — tenant working from home.',null,null,null,'[]',
     '2024-03-05T00:00:00Z','2024-03-05T00:00:00Z'],
  ];
  for (const r of rows) {
    await q(
      `INSERT INTO vendor_jobs (id,vendor_id,vendor_name,maintenance_request_id,property_title,property_address,
       title,description,status,scheduled_date,completed_date,estimated_cost,actual_cost,
       manager_notes,vendor_notes,rating,rating_comment,photos,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (id) DO NOTHING`,
      r
    );
  }
  console.log(`  ✅ ${rows.length} vendor jobs seeded.`);
}

// ── 10. Documents ─────────────────────────────────────────────────────────────
async function seedDocuments() {
  console.log('📄 Seeding documents...');
  const rows = [
    ['doc1',U.tenant,'Grace Apio','tenant','National ID (Front)','kyc','approved','','image/jpeg',245000,null,'Admin ITAB','2024-01-16T09:00:00Z','ID verified — clear and valid.','2024-01-15T10:00:00Z'],
    ['doc2',U.tenant,'Grace Apio','tenant','National ID (Back)','kyc','approved','','image/jpeg',198000,null,'Admin ITAB','2024-01-16T09:05:00Z',null,'2024-01-15T10:05:00Z'],
    ['doc3',U.tenant,'Grace Apio','tenant','Tenancy Agreement — Entebbe Apartment','lease','approved','','application/pdf',512000,'2025-01-31T00:00:00Z','Admin ITAB','2024-02-02T10:00:00Z',null,'2024-02-01T09:00:00Z'],
    ['doc4',U.tenant,'Grace Apio','tenant','Proof of Income','kyc','pending','','application/pdf',320000,null,null,null,null,'2024-04-01T14:00:00Z'],
    ['doc5',U.landlord,'John Ssemakula','landlord','Land Title — Entebbe Plot','ownership','pending','','application/pdf',890000,null,null,null,null,'2024-03-10T11:00:00Z'],
    ['doc6',U.landlord,'John Ssemakula','landlord','National ID','kyc','approved','','image/jpeg',210000,null,'Admin ITAB','2024-01-21T09:00:00Z',null,'2024-01-20T08:00:00Z'],
    ['doc7',U.manager,'Sarah Nakato','property_manager','Professional Certificate','kyc','pending','','application/pdf',450000,null,null,null,null,'2024-04-05T09:30:00Z'],
    ['doc8',U.vendor,'Peter Mugisha','vendor','Plumbing License','kyc','rejected','','application/pdf',380000,null,'Admin ITAB','2024-03-16T10:00:00Z','Document is blurry and unreadable. Please upload a clearer scan.','2024-03-15T14:00:00Z'],
  ];
  for (const r of rows) {
    await q(
      `INSERT INTO documents (id,owner_id,owner_name,owner_role,name,category,status,file_url,file_type,
       file_size,expires_at,reviewed_by,reviewed_at,admin_notes,uploaded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      r
    );
  }
  console.log(`  ✅ ${rows.length} documents seeded.`);
}

// ── 11. Tenant Notices ────────────────────────────────────────────────────────
async function seedNotices() {
  console.log('📋 Seeding notices...');
  const rows = [
    ['tn1',P.p6,'1-Bedroom Apartment in Entebbe',U.tenant,'Grace Apio',
     'Sarah Nakato','property_manager','rent_arrears','Overdue Rent — April 2024',
     'Dear Grace,\n\nThis is a formal notice that your rent for April 2024 is partially outstanding. As of today, you have paid UGX 300,000 of the UGX 900,000 due, leaving a balance of UGX 600,000.\n\nPlease settle the outstanding balance by April 15, 2024 to avoid a late fee.\n\nRegards,\nSarah Nakato',
     '2024-04-15','2024-04-15','unread',true,null,null,'2024-04-08T09:00:00Z',null,null],
    ['tn2',P.p6,'1-Bedroom Apartment in Entebbe',U.tenant,'Grace Apio',
     'John Ssemakula','landlord','lease_renewal','Lease Renewal Offer — January 2025',
     'Dear Grace,\n\nYour current lease expires on January 31, 2025. We are pleased to offer you a renewal:\n\n• New Monthly Rent: UGX 950,000\n• New Lease Term: February 1, 2025 – January 31, 2026\n\nPlease respond by December 31, 2024.\n\nJohn Ssemakula',
     '2025-02-01','2024-12-31','read',true,null,null,'2024-11-01T10:00:00Z','2024-11-02T08:30:00Z',null],
    ['tn3',P.p6,'1-Bedroom Apartment in Entebbe',U.tenant,'Grace Apio',
     'Sarah Nakato','property_manager','maintenance_notice','Scheduled Maintenance — Water System',
     'Dear Grace,\n\nWe will be carrying out maintenance on the water system on Saturday, April 13, 2024 from 8:00 AM to 2:00 PM. Water supply will be temporarily interrupted.\n\nSarah Nakato',
     '2024-04-13',null,'acknowledged',false,null,null,'2024-04-10T14:00:00Z','2024-04-10T16:00:00Z','2024-04-10T16:05:00Z'],
    ['tn4',P.p6,'1-Bedroom Apartment in Entebbe',U.tenant,'Grace Apio',
     'Sarah Nakato','property_manager','inspection_notice','Annual Property Inspection — May 2024',
     'Dear Grace,\n\nYour annual inspection is scheduled for May 10, 2024 at 10:00 AM. Please ensure the property is accessible.\n\nSarah Nakato',
     '2024-05-10',null,'unread',true,null,null,'2024-04-25T09:00:00Z',null,null],
  ];
  for (const r of rows) {
    await q(
      `INSERT INTO tenant_notices (id,property_id,property_title,tenant_id,tenant_name,
       issued_by,issued_by_role,type,subject,body,effective_date,response_deadline,
       status,requires_acknowledgement,attachment_url,tenant_response,
       created_at,read_at,acknowledged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (id) DO NOTHING`,
      r
    );
  }
  console.log(`  ✅ ${rows.length} notices seeded.`);
}


// ── 12. Disputes ──────────────────────────────────────────────────────────────
async function seedDisputes() {
  console.log('⚖️  Seeding disputes...');
  const now = new Date();
  const ago = d => new Date(now - d * 86400000).toISOString();
  const rows = [
    ['d1','management_fee','open',
     U.landlord,'John Ssemakula','landlord',U.manager,'Sarah Nakato','property_manager',
     P.p6,'1-Bedroom Apartment in Entebbe',null,
     'Management fee charged incorrectly',
     'The management fee deducted was 15% but the agreed rate was 10%. I have been overcharged for the last 3 months.',
     null,270000,null,null,null,ago(9),ago(9),null],
    ['d2','payout_amount','under_review',
     U.landlord,'John Ssemakula','landlord',U.manager,'Sarah Nakato','property_manager',
     P.p1,'3-Bedroom Apartment in Kololo',null,
     'Payout not received for March',
     'I have not received my payout for March 2024. The tenant paid on March 1st but I have not received anything.',
     null,2250000,null,null,null,ago(5),ago(4),null],
    ['d3','property_condition','resolved',
     U.tenant,'Grace Apio','tenant',U.manager,'Sarah Nakato','property_manager',
     P.p6,'1-Bedroom Apartment in Entebbe',null,
     'Property not as described — no backup power',
     'The property listing said it had backup power but there is no generator or solar system installed.',
     null,null,
     'Manager agreed to install a solar backup system within 30 days. Tenant accepted resolution.',
     U.admin,'Admin ITAB',ago(20),ago(10),ago(10)],
  ];
  for (const r of rows) {
    await q(
      `INSERT INTO disputes (id,type,status,raised_by_id,raised_by_name,raised_by_role,
       against_id,against_name,against_role,property_id,property_title,transaction_id,
       subject,description,evidence,amount,resolution,resolved_by_id,resolved_by_name,
       created_at,updated_at,resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       ON CONFLICT (id) DO NOTHING`,
      r
    );
  }
  console.log(`  ✅ ${rows.length} disputes seeded.`);
}

// ── 13. Notifications ─────────────────────────────────────────────────────────
async function seedNotifications() {
  console.log('🔔 Seeding notifications...');
  const rows = [
    ['n1',U.tenant,'inspection','Inspection Confirmed','Your inspection for 3-Bedroom Apartment in Kololo is confirmed for March 10 at 10:00 AM.',false,'/inspections/i1','2024-03-05T10:00:00Z'],
    ['n2',U.tenant,'payment','Rent Payment Received','UGX 900,000 rent payment received for Entebbe apartment.',false,'/payments/pay3','2024-03-01T09:00:00Z'],
    ['n3',U.tenant,'maintenance','Maintenance Update','Your leaking tap request has been assigned to Peter Plumbing Services.',true,'/maintenance/m1','2024-03-02T00:00:00Z'],
    ['n4',U.tenant,'payout','Payout Processed','UGX 792,000 has been sent to your MTN MoMo account.',true,'/payouts/po1','2024-03-05T10:00:00Z'],
    ['n5',U.landlord,'payout','Payout Processed','UGX 792,000 net rent payout for 1-Bedroom Apartment in Entebbe has been sent.',true,'/payouts/po1','2024-03-05T10:00:00Z'],
    ['n6',U.manager,'inspection','New Inspection Booked','Grace Apio has booked an inspection for 3-Bedroom Apartment in Kololo.',true,'/inspections/i1','2024-03-05T09:00:00Z'],
  ];
  for (const r of rows) {
    await q(
      `INSERT INTO notifications (id,user_id,type,title,body,is_read,action_url,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      r
    );
  }
  console.log(`  ✅ ${rows.length} notifications seeded.`);
}

// ── 14. Announcements ─────────────────────────────────────────────────────────
async function seedAnnouncements() {
  console.log('📢 Seeding announcements...');
  await q(
    `INSERT INTO announcements (id,title,body,target_roles,sent_by,sent_by_name,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO NOTHING`,
    ['ann1','Welcome to ITAB Platform',
     'We are excited to launch the new ITAB property management platform. All features are now live. Please explore and let us know your feedback.',
     '[]',U.admin,'Admin ITAB','2024-01-01T08:00:00Z']
  );
  console.log('  ✅ 1 announcement seeded.');
}

// ── 15. Agent Applications ────────────────────────────────────────────────────
async function seedAgentApplications() {
  console.log('📝 Seeding agent applications...');
  const rows = [
    ['app1',null,'Moses','Kato','moses.kato@gmail.com','0772345678','agent',null,
     '3 years working as a real estate broker in Kampala',
     ['Kampala','Wakiso'],'I want to help landlords find quality tenants','pending',null,
     '2024-03-01T00:00:00Z',null],
    ['app2',null,'Fatuma','Nabirye','fatuma.n@gmail.com','0752987654','property_manager',null,
     '5 years in property sales and rentals',
     ['Kampala','Entebbe','Mukono'],'Looking to expand my client base using a digital platform.','pending',null,
     '2024-03-10T00:00:00Z',null],
  ];
  for (const r of rows) {
    const [id,userId,fn,ln,email,phone,role,natId,exp,districts,motivation,status,adminNote,createdAt,reviewedAt] = r;
    await q(
      `INSERT INTO agent_applications (id,user_id,first_name,last_name,email,phone,role,
       national_id_number,national_id_doc,additional_docs,experience,districts,motivation,status,admin_note,created_at,reviewed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING`,
      [id,userId,fn,ln,email,phone,role,natId,null,'[]',exp,JSON.stringify(districts),motivation,status,adminNote,createdAt,reviewedAt]
    );
  }
  console.log(`  ✅ ${rows.length} agent applications seeded.`);
}

// ── 16. Audit Logs ────────────────────────────────────────────────────────────
async function seedAuditLogs() {
  console.log('📊 Seeding audit logs...');
  const rows = [
    ['al1','user_registered',U.tenant,'Grace Apio','tenant',U.tenant,'Grace Apio','New tenant account registered',null,'2024-02-01T00:00:00Z'],
    ['al2','property_published',U.manager,'Sarah Nakato','property_manager',P.p1,'3-Bedroom Apartment in Kololo','Property published','{"district":"Kampala","rentPrice":2500000}','2024-01-15T00:00:00Z'],
    ['al3','inspection_booked',U.tenant,'Grace Apio','tenant',I.i1,'Inspection i1','Inspection booked for 3-Bedroom Apartment in Kololo','{"scheduledDate":"2024-03-10"}','2024-03-05T00:00:00Z'],
    ['al4','payment_completed',U.tenant,'Grace Apio','tenant',PAY.pay1,'Payment pay1','Inspection fee payment completed via MTN MoMo','{"amount":100000,"reference":"MTN-2024-001"}','2024-03-05T10:30:00Z'],
    ['al5','lease_signed',U.tenant,'Grace Apio','tenant',P.p6,'1-Bedroom Apartment in Entebbe','Lease agreement signed','{"leaseStart":"2024-02-01","leaseEnd":"2025-01-31"}','2024-02-01T00:00:00Z'],
    ['al6','maintenance_submitted',U.tenant,'Grace Apio','tenant',M.m1,'Leaking tap in bathroom','Maintenance request submitted','{"priority":"normal"}','2024-03-01T00:00:00Z'],
    ['al7','payout_processed',U.manager,'Sarah Nakato','property_manager',PO.po1,'Payout po1','Landlord payout processed via MTN MoMo','{"amount":792000}','2024-03-05T10:00:00Z'],
    ['al8','document_approved',U.admin,'Admin ITAB','admin','doc1','National ID (Front)','KYC document approved for Grace Apio','{"category":"kyc"}','2024-01-16T09:00:00Z'],
  ];
  for (const r of rows) {
    await q(
      `INSERT INTO audit_logs (id,action,performed_by,performed_by_name,performed_by_role,
       target_id,target_name,description,metadata,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      r
    );
  }
  console.log(`  ✅ ${rows.length} audit logs seeded.`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ITAB Seed Script — Render PostgreSQL');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set. Add it to .env');
    process.exit(1);
  }

  try {
    await seedUsers();
    await seedProperties();
    await seedInspections();
    await seedPayments();
    await seedTransactions();
    await seedMaintenance();
    await seedPayouts();
    await seedVendors();
    await seedVendorJobs();
    await seedDocuments();
    await seedNotices();
    await seedDisputes();
    await seedNotifications();
    await seedAnnouncements();
    await seedAgentApplications();
    await seedAuditLogs();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅ All seed data inserted successfully!');
    console.log('  🔑 All user passwords: password123');
    console.log('  📧 Demo accounts:');
    console.log('     admin@itab.ug | manager@itab.ug | landlord@itab.ug');
    console.log('     tenant@itab.ug | agent@itab.ug | vendor@itab.ug');
    console.log('═══════════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
