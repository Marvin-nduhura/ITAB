// ═══════════════════════════════════════════════════════════════════════════════
// ITAB Seed Script — seeds ALL mock data into Render PostgreSQL
// Usage: node seed.js
// Safe to re-run: uses ON CONFLICT DO NOTHING
// ═══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

// ─── Run schema.sql first ─────────────────────────────────────────────────────
async function runSchema() {
  console.log('📐 Running schema.sql...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await query(sql);
  console.log('✅ Schema applied.');
}

// ─── Seed Users ───────────────────────────────────────────────────────────────
async function seedUsers() {
  console.log('👤 Seeding users...');
  const password = await bcrypt.hash('password123', 12);

  const users = [
    { id: 'u1', firstName: 'Admin', lastName: 'ITAB', email: 'admin@itab.ug', phone: '0700000001', role: 'admin', kycStatus: 'approved', approvalStatus: 'approved', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'u2', firstName: 'Sarah', lastName: 'Nakato', email: 'manager@itab.ug', phone: '0700000002', role: 'property_manager', kycStatus: 'approved', approvalStatus: 'approved', createdAt: '2024-01-05T00:00:00Z' },
    { id: 'u3', firstName: 'John', lastName: 'Ssemakula', email: 'landlord@itab.ug', phone: '0700000003', role: 'landlord', kycStatus: 'approved', approvalStatus: 'approved', createdAt: '2024-01-10T00:00:00Z' },
    { id: 'u4', firstName: 'Grace', lastName: 'Apio', email: 'tenant@itab.ug', phone: '0700000004', role: 'tenant', kycStatus: 'approved', approvalStatus: 'approved', createdAt: '2024-02-01T00:00:00Z' },
    { id: 'u5', firstName: 'David', lastName: 'Ochieng', email: 'agent@itab.ug', phone: '0700000005', role: 'agent', kycStatus: 'approved', approvalStatus: 'approved', createdAt: '2024-02-15T00:00:00Z' },
    { id: 'u6', firstName: 'Peter', lastName: 'Mugisha', email: 'vendor@itab.ug', phone: '0772100001', role: 'vendor', kycStatus: 'approved', approvalStatus: 'approved', createdAt: '2023-06-01T00:00:00Z' },
  ];

  for (const u of users) {
    await query(
      `INSERT INTO users (id, first_name, last_name, email, phone, password_hash, role, kyc_status, is_verified, is_suspended, approval_status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,false,$9,$10,$10)
       ON CONFLICT (id) DO NOTHING`,
      [u.id, u.firstName, u.lastName, u.email, u.phone, password, u.role, u.kycStatus, u.approvalStatus, u.createdAt]
    );
  }
  console.log(`  ✅ ${users.length} users seeded.`);
}

// ─── Seed Properties ──────────────────────────────────────────────────────────
async function seedProperties() {
  console.log('🏠 Seeding properties...');

  const properties = [
    {
      id: 'p1', title: '3-Bedroom Apartment in Kololo',
      description: 'Spacious modern apartment with stunning city views, fully furnished with high-end finishes. Located in the heart of Kololo with easy access to major amenities.',
      type: 'apartment', status: 'published', address: 'Plot 12, Kololo Hill Drive', district: 'Kampala',
      latitude: 0.3476, longitude: 32.5825, bedrooms: 3, bathrooms: 2, squareFootage: 180,
      rentPrice: 2500000, deposit: 5000000, availableFrom: '2024-03-01',
      photos: JSON.stringify(['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800','https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800','https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800']),
      amenities: JSON.stringify(['wifi','furnished','parking','security','backup_power','water_tank']),
      managementFeePercent: 10, itabFeePercent: 2, isFeatured: true,
      managerId: 'u2', managerName: 'Sarah Nakato', landlordId: 'u3', landlordName: 'John Ssemakula',
      tenantId: null, leaseStart: null, leaseEnd: null,
      viewCount: 245, createdAt: '2024-01-15T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z',
    },
    {
      id: 'p2', title: '2-Bedroom House in Ntinda',
      description: 'Cozy family home in a quiet neighborhood. Tiled throughout with a beautiful garden and perimeter wall for security.',
      type: 'house', status: 'published', address: 'Plot 45, Ntinda Road', district: 'Kampala',
      latitude: 0.3601, longitude: 32.6108, bedrooms: 2, bathrooms: 1, squareFootage: 120,
      rentPrice: 1200000, deposit: 2400000, availableFrom: '2024-03-15',
      photos: JSON.stringify(['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800','https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800']),
      amenities: JSON.stringify(['tiled','kitchen','perimeter_wall','parking','water_tank']),
      managementFeePercent: 8, itabFeePercent: 2, isFeatured: false,
      managerId: 'u2', managerName: 'Sarah Nakato', landlordId: 'u3', landlordName: 'John Ssemakula',
      tenantId: null, leaseStart: null, leaseEnd: null,
      viewCount: 189, createdAt: '2024-01-20T00:00:00Z', updatedAt: '2024-02-05T00:00:00Z',
    },
    {
      id: 'p3', title: 'Studio Apartment in Bukoto',
      description: 'Modern studio perfect for young professionals. Walking distance to Bukoto market and public transport.',
      type: 'apartment', status: 'published', address: 'Plot 8, Bukoto Street', district: 'Kampala',
      latitude: 0.3512, longitude: 32.5967, bedrooms: 1, bathrooms: 1, squareFootage: 45,
      rentPrice: 650000, deposit: 1300000, availableFrom: '2024-02-20',
      photos: JSON.stringify(['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800','https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800']),
      amenities: JSON.stringify(['wifi','tiled','kitchen','security']),
      managementFeePercent: 10, itabFeePercent: 2, isFeatured: false,
      managerId: 'u2', managerName: 'Sarah Nakato', landlordId: 'u3', landlordName: 'John Ssemakula',
      tenantId: null, leaseStart: null, leaseEnd: null,
      viewCount: 312, createdAt: '2024-01-25T00:00:00Z', updatedAt: '2024-02-10T00:00:00Z',
    },
    {
      id: 'p4', title: '4-Bedroom Villa in Muyenga',
      description: 'Luxurious villa with private pool, gym, and panoramic lake views. Perfect for executives and diplomats.',
      type: 'house', status: 'published', address: 'Plot 3, Tank Hill Road, Muyenga', district: 'Kampala',
      latitude: 0.2987, longitude: 32.5876, bedrooms: 4, bathrooms: 3, squareFootage: 350,
      rentPrice: 8000000, deposit: 16000000, availableFrom: '2024-04-01',
      photos: JSON.stringify(['https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800','https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800','https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800']),
      amenities: JSON.stringify(['wifi','furnished','parking','gym','pool','security','backup_power','water_tank','cctv','garden']),
      managementFeePercent: 12, itabFeePercent: 2, isFeatured: true,
      managerId: 'u2', managerName: 'Sarah Nakato', landlordId: 'u3', landlordName: 'John Ssemakula',
      tenantId: null, leaseStart: null, leaseEnd: null,
      viewCount: 567, createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-15T00:00:00Z',
    },
    {
      id: 'p5', title: 'Commercial Space in Nakasero',
      description: 'Prime commercial space in Nakasero CBD. Ideal for offices, retail, or restaurant. Ground floor with high foot traffic.',
      type: 'commercial', status: 'published', address: 'Plot 22, Nakasero Road', district: 'Kampala',
      latitude: 0.3190, longitude: 32.5773, bedrooms: 0, bathrooms: 2, squareFootage: 200,
      rentPrice: 5000000, deposit: 10000000, availableFrom: '2024-03-01',
      photos: JSON.stringify(['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800','https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800']),
      amenities: JSON.stringify(['wifi','parking','security','backup_power','cctv']),
      managementFeePercent: 10, itabFeePercent: 2, isFeatured: false,
      managerId: 'u2', managerName: 'Sarah Nakato', landlordId: 'u3', landlordName: 'John Ssemakula',
      tenantId: null, leaseStart: null, leaseEnd: null,
      viewCount: 134, createdAt: '2024-02-05T00:00:00Z', updatedAt: '2024-02-20T00:00:00Z',
    },
    {
      id: 'p6', title: '1-Bedroom Apartment in Entebbe',
      description: 'Peaceful apartment near Entebbe International Airport. Great for frequent travelers and expats.',
      type: 'apartment', status: 'rented', address: 'Plot 15, Entebbe Road', district: 'Entebbe',
      latitude: 0.0512, longitude: 32.4637, bedrooms: 1, bathrooms: 1, squareFootage: 65,
      rentPrice: 900000, deposit: 1800000, availableFrom: '2024-05-01',
      photos: JSON.stringify(['https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800']),
      amenities: JSON.stringify(['wifi','tiled','kitchen','parking','security']),
      managementFeePercent: 10, itabFeePercent: 2, isFeatured: false,
      managerId: 'u2', managerName: 'Sarah Nakato', landlordId: 'u3', landlordName: 'John Ssemakula',
      tenantId: 'u4', leaseStart: '2024-02-01', leaseEnd: '2025-01-31',
      viewCount: 98, createdAt: '2024-01-30T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z',
    },
  ];

  for (const p of properties) {
    await query(
      `INSERT INTO properties (id,title,description,type,status,address,district,latitude,longitude,bedrooms,bathrooms,square_footage,rent_price,deposit,available_from,photos,amenities,management_fee_percent,itab_fee_percent,is_featured,manager_id,manager_name,landlord_id,landlord_name,tenant_id,lease_start,lease_end,view_count,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
       ON CONFLICT (id) DO NOTHING`,
      [p.id,p.title,p.description,p.type,p.status,p.address,p.district,p.latitude,p.longitude,p.bedrooms,p.bathrooms,p.squareFootage,p.rentPrice,p.deposit,p.availableFrom,p.photos,p.amenities,p.managementFeePercent,p.itabFeePercent,p.isFeatured,p.managerId,p.managerName,p.landlordId,p.landlordName,p.tenantId,p.leaseStart,p.leaseEnd,p.viewCount,p.createdAt,p.updatedAt]
    );
  }
  console.log(`  ✅ ${properties.length} properties seeded.`);
}

// ─── Seed Inspections ─────────────────────────────────────────────────────────
async function seedInspections() {
  console.log('🔍 Seeding inspections...');

  const inspections = [
    {
      id: 'i1', propertyId: 'p1', propertyTitle: '3-Bedroom Apartment in Kololo', propertyAddress: 'Plot 12, Kololo Hill Drive',
      tenantId: 'u4', tenantName: 'Grace Apio', managerId: 'u2',
      scheduledDate: '2024-03-10', scheduledTime: '10:00',
      status: 'confirmed', feeAmount: 100000, feePaid: true, paymentMethod: 'mtn_momo', paymentRef: 'MTN-2024-001',
      creditApplied: false, noShowCount: 0, rescheduleCount: 0,
      leaseDeclined: false, leaseDeclinedReason: null, leaseDeclinedAt: null,
      createdAt: '2024-03-05T00:00:00Z',
    },
    {
      id: 'i2', propertyId: 'p2', propertyTitle: '2-Bedroom House in Ntinda', propertyAddress: 'Plot 45, Ntinda Road',
      tenantId: 'u4', tenantName: 'Grace Apio', managerId: 'u2',
      scheduledDate: '2024-03-15', scheduledTime: '14:00',
      status: 'pending', feeAmount: 100000, feePaid: false, paymentMethod: null, paymentRef: null,
      creditApplied: false, noShowCount: 0, rescheduleCount: 0,
      leaseDeclined: false, leaseDeclinedReason: null, leaseDeclinedAt: null,
      createdAt: '2024-03-08T00:00:00Z',
    },
    {
      id: 'i3', propertyId: 'p3', propertyTitle: 'Studio Apartment in Bukoto', propertyAddress: 'Plot 8, Bukoto Street',
      tenantId: 'u4', tenantName: 'Grace Apio', managerId: 'u2',
      scheduledDate: '2024-02-20', scheduledTime: '11:00',
      status: 'completed', feeAmount: 100000, feePaid: true, paymentMethod: 'airtel_money', paymentRef: 'AIR-2024-005',
      creditApplied: false, noShowCount: 0, rescheduleCount: 0,
      leaseDeclined: true, leaseDeclinedReason: 'The space was too small for my needs.', leaseDeclinedAt: '2024-02-21T09:00:00Z',
      createdAt: '2024-02-15T00:00:00Z',
    },
  ];

  for (const i of inspections) {
    await query(
      `INSERT INTO inspections (id,property_id,property_title,property_address,tenant_id,tenant_name,manager_id,scheduled_date,scheduled_time,status,fee_amount,fee_paid,payment_method,payment_ref,credit_applied,no_show_count,reschedule_count,lease_declined,lease_declined_reason,lease_declined_at,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       ON CONFLICT (id) DO NOTHING`,
      [i.id,i.propertyId,i.propertyTitle,i.propertyAddress,i.tenantId,i.tenantName,i.managerId,i.scheduledDate,i.scheduledTime,i.status,i.feeAmount,i.feePaid,i.paymentMethod,i.paymentRef,i.creditApplied,i.noShowCount,i.rescheduleCount,i.leaseDeclined,i.leaseDeclinedReason,i.leaseDeclinedAt,i.createdAt]
    );
  }
  console.log(`  ✅ ${inspections.length} inspections seeded.`);
}

// ─── Seed Payments ────────────────────────────────────────────────────────────
async function seedPayments() {
  console.log('💳 Seeding payments...');

  const payments = [
    { id: 'pay1', type: 'inspection_fee', amount: 100000, currency: 'UGX', status: 'completed', method: 'mtn_momo', reference: 'MTN-2024-001', propertyId: 'p1', propertyTitle: '3-Bedroom Apartment in Kololo', tenantId: 'u4', tenantName: 'Grace Apio', landlordId: null, inspectionCreditApplied: 0, rentPeriod: null, isPartial: false, createdAt: '2024-03-05T10:00:00Z', paidAt: '2024-03-05T10:30:00Z' },
    { id: 'pay2', type: 'rent', amount: 800000, currency: 'UGX', status: 'completed', method: 'mtn_momo', reference: 'MTN-2024-002', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe', tenantId: 'u4', tenantName: 'Grace Apio', landlordId: null, inspectionCreditApplied: 100000, rentPeriod: '2024-02', isPartial: false, createdAt: '2024-02-01T08:00:00Z', paidAt: '2024-02-01T09:00:00Z' },
    { id: 'pay3', type: 'rent_partial', amount: 500000, currency: 'UGX', status: 'completed', method: 'mtn_momo', reference: 'MTN-2024-003', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe', tenantId: 'u4', tenantName: 'Grace Apio', landlordId: null, inspectionCreditApplied: 0, rentPeriod: '2024-03', isPartial: true, createdAt: '2024-03-01T08:00:00Z', paidAt: '2024-03-01T09:00:00Z' },
    { id: 'pay4', type: 'rent_partial', amount: 400000, currency: 'UGX', status: 'completed', method: 'airtel_money', reference: 'AIR-2024-001', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe', tenantId: 'u4', tenantName: 'Grace Apio', landlordId: null, inspectionCreditApplied: 0, rentPeriod: '2024-03', isPartial: true, createdAt: '2024-03-15T08:00:00Z', paidAt: '2024-03-15T09:00:00Z' },
    { id: 'pay5', type: 'rent_partial', amount: 300000, currency: 'UGX', status: 'completed', method: 'mtn_momo', reference: 'MTN-2024-004', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe', tenantId: 'u4', tenantName: 'Grace Apio', landlordId: null, inspectionCreditApplied: 0, rentPeriod: '2024-04', isPartial: true, createdAt: '2024-04-01T08:00:00Z', paidAt: '2024-04-01T09:00:00Z' },
    { id: 'pay6', type: 'inspection_fee', amount: 100000, currency: 'UGX', status: 'completed', method: 'airtel_money', reference: 'AIR-2024-005', propertyId: 'p3', propertyTitle: 'Studio Apartment in Bukoto', tenantId: 'u4', tenantName: 'Grace Apio', landlordId: null, inspectionCreditApplied: 0, rentPeriod: null, isPartial: false, createdAt: '2024-02-15T10:00:00Z', paidAt: '2024-02-15T10:30:00Z' },
  ];

  for (const p of payments) {
    await query(
      `INSERT INTO payments (id,type,amount,currency,status,method,reference,property_id,property_title,tenant_id,tenant_name,landlord_id,inspection_credit_applied,rent_period,is_partial,created_at,paid_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING`,
      [p.id,p.type,p.amount,p.currency,p.status,p.method,p.reference,p.propertyId,p.propertyTitle,p.tenantId,p.tenantName,p.landlordId,p.inspectionCreditApplied,p.rentPeriod,p.isPartial,p.createdAt,p.paidAt]
    );
  }
  console.log(`  ✅ ${payments.length} payments seeded.`);
}

// ─── Seed Transactions ────────────────────────────────────────────────────────
async function seedTransactions() {
  console.log('💰 Seeding platform transactions...');

  // Mirrors the paymentStore mock logic: each payment generates split transactions
  const transactions = [
    // pay1: inspection fee for p1 — tenant → escrow → ITAB + manager
    { id: 'tx_insp1a', type: 'inspection_fee', senderId: 'u4', senderName: 'Grace Apio', senderRole: 'tenant', senderMethod: 'mtn_momo', senderPhone: '0700000004', receiverId: 'escrow', receiverName: 'ITAB Escrow', receiverRole: 'platform', receiverMethod: 'escrow', amount: 100000, currency: 'UGX', reference: 'MTN-2024-001', status: 'completed', propertyId: 'p1', propertyTitle: '3-Bedroom Apartment in Kololo', description: 'Inspection fee for 3-Bedroom Apartment in Kololo (non-refundable)', createdAt: '2024-03-05T10:00:00Z', processedAt: '2024-03-05T10:00:00Z' },
    { id: 'tx_insp1b', type: 'platform_fee', senderId: 'escrow', senderName: 'ITAB Escrow', senderRole: 'platform', senderMethod: 'escrow', receiverId: 'itab_platform', receiverName: 'ITAB Property Services', receiverRole: 'platform', receiverMethod: 'escrow', amount: 50000, currency: 'UGX', reference: 'MTN-2024-001-FEE', status: 'completed', propertyId: 'p1', propertyTitle: '3-Bedroom Apartment in Kololo', description: 'ITAB share of inspection fee for 3-Bedroom Apartment in Kololo', createdAt: '2024-03-05T10:00:00Z', processedAt: '2024-03-05T10:00:00Z' },
    { id: 'tx_insp1c', type: 'management_fee_payout', senderId: 'escrow', senderName: 'ITAB Escrow', senderRole: 'platform', senderMethod: 'escrow', receiverId: 'u2', receiverName: 'Sarah Nakato', receiverRole: 'property_manager', receiverMethod: 'mtn_momo', amount: 50000, currency: 'UGX', reference: 'MTN-2024-001-MGR', status: 'completed', propertyId: 'p1', propertyTitle: '3-Bedroom Apartment in Kololo', description: 'Manager share of inspection fee for 3-Bedroom Apartment in Kololo', createdAt: '2024-03-05T10:00:00Z', processedAt: '2024-03-05T10:00:00Z' },
    // pay2: first rent for p6 (800000 paid, 100000 inspection credit applied, gross=900000)
    { id: 'tx_rent2a', type: 'rent_payment', senderId: 'u4', senderName: 'Grace Apio', senderRole: 'tenant', senderMethod: 'mtn_momo', senderPhone: '0700000004', receiverId: 'escrow', receiverName: 'ITAB Escrow', receiverRole: 'platform', receiverMethod: 'escrow', amount: 800000, currency: 'UGX', reference: 'MTN-2024-002', status: 'completed', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe', description: 'Rent payment for 1-Bedroom Apartment in Entebbe (2024-02)', rentPeriod: '2024-02', inspectionCreditApplied: 100000, createdAt: '2024-02-01T08:00:00Z', processedAt: '2024-02-01T09:00:00Z' },
    { id: 'tx_rent2b', type: 'platform_fee', senderId: 'escrow', senderName: 'ITAB Escrow', senderRole: 'platform', senderMethod: 'escrow', receiverId: 'itab_platform', receiverName: 'ITAB Property Services', receiverRole: 'platform', receiverMethod: 'escrow', amount: 18000, currency: 'UGX', reference: 'MTN-2024-002-FEE', status: 'completed', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe', description: 'Platform fee (2%) on rent for 1-Bedroom Apartment in Entebbe', createdAt: '2024-02-01T09:00:00Z', processedAt: '2024-02-01T09:00:00Z' },
    { id: 'tx_rent2c', type: 'management_fee_payout', senderId: 'escrow', senderName: 'ITAB Escrow', senderRole: 'platform', senderMethod: 'escrow', receiverId: 'u2', receiverName: 'Sarah Nakato', receiverRole: 'property_manager', receiverMethod: 'mtn_momo', amount: 90000, currency: 'UGX', reference: 'MTN-2024-002-MGR', status: 'completed', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe', description: 'Management fee (10%) for 1-Bedroom Apartment in Entebbe', createdAt: '2024-02-01T09:00:00Z', processedAt: '2024-02-01T09:00:00Z' },
    { id: 'tx_rent2d', type: 'landlord_payout', senderId: 'escrow', senderName: 'ITAB Escrow', senderRole: 'platform', senderMethod: 'escrow', receiverId: 'u3', receiverName: 'John Ssemakula', receiverRole: 'landlord', receiverMethod: 'mtn_momo', amount: 692000, currency: 'UGX', reference: 'MTN-2024-002-LLD', status: 'completed', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe', description: 'Net rent payout for 1-Bedroom Apartment in Entebbe (incl. 100,000 inspection credit deducted)', createdAt: '2024-02-01T09:00:00Z', processedAt: '2024-02-01T09:00:00Z' },
    // pay6: inspection fee for p3 (declined)
    { id: 'tx_insp6a', type: 'inspection_fee', senderId: 'u4', senderName: 'Grace Apio', senderRole: 'tenant', senderMethod: 'airtel_money', senderPhone: '0700000004', receiverId: 'escrow', receiverName: 'ITAB Escrow', receiverRole: 'platform', receiverMethod: 'escrow', amount: 100000, currency: 'UGX', reference: 'AIR-2024-005', status: 'completed', propertyId: 'p3', propertyTitle: 'Studio Apartment in Bukoto', description: 'Inspection fee for Studio Apartment in Bukoto (non-refundable)', createdAt: '2024-02-15T10:00:00Z', processedAt: '2024-02-15T10:00:00Z' },
    { id: 'tx_insp6b', type: 'platform_fee', senderId: 'escrow', senderName: 'ITAB Escrow', senderRole: 'platform', senderMethod: 'escrow', receiverId: 'itab_platform', receiverName: 'ITAB Property Services', receiverRole: 'platform', receiverMethod: 'escrow', amount: 50000, currency: 'UGX', reference: 'AIR-2024-005-FEE', status: 'completed', propertyId: 'p3', propertyTitle: 'Studio Apartment in Bukoto', description: 'ITAB share of inspection fee for Studio Apartment in Bukoto', createdAt: '2024-02-15T10:00:00Z', processedAt: '2024-02-15T10:00:00Z' },
    { id: 'tx_insp6c', type: 'management_fee_payout', senderId: 'escrow', senderName: 'ITAB Escrow', senderRole: 'platform', senderMethod: 'escrow', receiverId: 'u2', receiverName: 'Sarah Nakato', receiverRole: 'property_manager', receiverMethod: 'mtn_momo', amount: 50000, currency: 'UGX', reference: 'AIR-2024-005-MGR', status: 'completed', propertyId: 'p3', propertyTitle: 'Studio Apartment in Bukoto', description: 'Manager share of inspection fee for Studio Apartment in Bukoto', createdAt: '2024-02-15T10:00:00Z', processedAt: '2024-02-15T10:00:00Z' },
  ];

  for (const t of transactions) {
    await query(
      `INSERT INTO transactions (id,type,sender_id,sender_name,sender_role,sender_method,sender_phone,receiver_id,receiver_name,receiver_role,receiver_method,amount,currency,reference,status,property_id,property_title,description,inspection_credit_applied,rent_period,created_at,processed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       ON CONFLICT (id) DO NOTHING`,
      [t.id,t.type,t.senderId,t.senderName,t.senderRole,t.senderMethod,t.senderPhone||null,t.receiverId,t.receiverName,t.receiverRole,t.receiverMethod,t.amount,t.currency,t.reference,t.status,t.propertyId||null,t.propertyTitle||null,t.description,t.inspectionCreditApplied||0,t.rentPeriod||null,t.createdAt,t.processedAt||null]
    );
  }
  console.log(`  ✅ ${transactions.length} transactions seeded.`);
}

// ─── Seed Maintenance ─────────────────────────────────────────────────────────
async function seedMaintenance() {
  console.log('🔧 Seeding maintenance requests...');

  const requests = [
    {
      id: 'm1', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
      tenantId: 'u4', tenantName: 'Grace Apio',
      title: 'Leaking tap in bathroom',
      description: 'The bathroom tap has been leaking for 3 days. Water is wasting and the floor is wet.',
      priority: 'normal', status: 'in_progress', photos: '[]',
      vendorId: 'v1', vendorName: 'Peter Plumbing Services', estimatedCost: 50000, actualCost: null,
      createdAt: '2024-03-01T00:00:00Z', updatedAt: '2024-03-02T00:00:00Z', completedAt: null,
    },
    {
      id: 'm2', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
      tenantId: 'u4', tenantName: 'Grace Apio',
      title: 'Power outage in bedroom',
      description: 'The bedroom socket is not working. Checked the breaker but it seems fine.',
      priority: 'urgent', status: 'submitted', photos: '[]',
      vendorId: null, vendorName: null, estimatedCost: null, actualCost: null,
      createdAt: '2024-03-05T00:00:00Z', updatedAt: '2024-03-05T00:00:00Z', completedAt: null,
    },
  ];

  for (const m of requests) {
    await query(
      `INSERT INTO maintenance_requests (id,property_id,property_title,tenant_id,tenant_name,title,description,priority,status,photos,vendor_id,vendor_name,estimated_cost,actual_cost,created_at,updated_at,completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING`,
      [m.id,m.propertyId,m.propertyTitle,m.tenantId,m.tenantName,m.title,m.description,m.priority,m.status,m.photos,m.vendorId,m.vendorName,m.estimatedCost,m.actualCost,m.createdAt,m.updatedAt,m.completedAt]
    );
  }
  console.log(`  ✅ ${requests.length} maintenance requests seeded.`);
}

// ─── Seed Payouts ─────────────────────────────────────────────────────────────
async function seedPayouts() {
  console.log('💸 Seeding payouts...');

  const payouts = [
    {
      id: 'po1', landlordId: 'u3', landlordName: 'John Ssemakula',
      propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
      grossRent: 900000, managementFee: 90000, itabFee: 18000, netAmount: 792000,
      status: 'completed', method: 'mtn_momo', reference: 'PAYOUT-2024-001',
      scheduledDate: '2024-03-05', processedAt: '2024-03-05T10:00:00Z', retryCount: 0,
    },
  ];

  for (const p of payouts) {
    await query(
      `INSERT INTO payouts (id,landlord_id,landlord_name,property_id,property_title,gross_rent,management_fee,itab_fee,net_amount,status,method,reference,scheduled_date,processed_at,retry_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      [p.id,p.landlordId,p.landlordName,p.propertyId,p.propertyTitle,p.grossRent,p.managementFee,p.itabFee,p.netAmount,p.status,p.method,p.reference,p.scheduledDate,p.processedAt,p.retryCount]
    );
  }
  console.log(`  ✅ ${payouts.length} payouts seeded.`);
}

// ─── Seed Vendors ─────────────────────────────────────────────────────────────
async function seedVendors() {
  console.log('🛠️  Seeding vendors...');

  const vendors = [
    { id: 'v1', userId: 'u6', firstName: 'Peter', lastName: 'Mugisha', email: 'vendor@itab.ug', phone: '0772100001', category: 'plumber', skills: JSON.stringify(['Pipe fitting','Drain unblocking','Tap repair','Water heater installation']), bio: 'Licensed plumber with 8 years experience in residential and commercial properties across Kampala.', district: 'Kampala', address: 'Ntinda, Kampala', rating: 4.7, totalRatings: 23, totalJobs: 31, completedJobs: 28, isActive: true, isVerified: true, isSuspended: false, dailyRate: 80000, hourlyRate: 15000, availability: 'available', joinedAt: '2023-06-01T00:00:00Z', lastActiveAt: '2024-04-01T00:00:00Z' },
    { id: 'v2', userId: null, firstName: 'James', lastName: 'Okello', email: 'james@electric.ug', phone: '0772100002', category: 'electrician', skills: JSON.stringify(['Wiring','Solar installation','Generator repair','CCTV installation','Inverter setup']), bio: 'Certified electrician specializing in solar systems and smart home installations.', district: 'Kampala', address: 'Bukoto, Kampala', rating: 4.9, totalRatings: 41, totalJobs: 55, completedJobs: 52, isActive: true, isVerified: true, isSuspended: false, dailyRate: 100000, hourlyRate: 20000, availability: 'available', joinedAt: '2023-03-15T00:00:00Z', lastActiveAt: '2024-04-05T00:00:00Z' },
    { id: 'v3', userId: null, firstName: 'Mary', lastName: 'Namukasa', email: 'mary@cleanpro.ug', phone: '0772100003', category: 'cleaner', skills: JSON.stringify(['Deep cleaning','Carpet cleaning','Post-construction cleaning','Regular housekeeping']), bio: 'Professional cleaning service with a team of 5. We bring our own equipment and supplies.', district: 'Kampala', address: 'Kololo, Kampala', rating: 4.5, totalRatings: 18, totalJobs: 24, completedJobs: 22, isActive: true, isVerified: true, isSuspended: false, dailyRate: 60000, hourlyRate: 10000, availability: 'busy', joinedAt: '2023-08-20T00:00:00Z', lastActiveAt: '2024-04-03T00:00:00Z' },
    { id: 'v4', userId: null, firstName: 'Robert', lastName: 'Ssebunya', email: 'robert@mason.ug', phone: '0772100004', category: 'mason', skills: JSON.stringify(['Tiling','Plastering','Bricklaying','Waterproofing','Concrete work']), bio: 'Experienced mason with expertise in tiling and waterproofing. Quality work guaranteed.', district: 'Wakiso', address: 'Entebbe Road, Wakiso', rating: 4.3, totalRatings: 12, totalJobs: 15, completedJobs: 13, isActive: true, isVerified: false, isSuspended: false, dailyRate: 90000, hourlyRate: 18000, availability: 'available', joinedAt: '2023-11-10T00:00:00Z', lastActiveAt: '2024-03-28T00:00:00Z' },
    { id: 'v5', userId: null, firstName: 'Agnes', lastName: 'Atim', email: 'agnes@garden.ug', phone: '0772100005', category: 'gardener', skills: JSON.stringify(['Lawn mowing','Tree trimming','Garden design','Compound cutting','Flower planting']), bio: 'Passionate gardener offering regular maintenance and one-time garden makeovers.', district: 'Kampala', address: 'Muyenga, Kampala', rating: 4.6, totalRatings: 9, totalJobs: 11, completedJobs: 10, isActive: true, isVerified: true, isSuspended: false, dailyRate: 50000, hourlyRate: 8000, availability: 'available', joinedAt: '2024-01-05T00:00:00Z', lastActiveAt: '2024-04-04T00:00:00Z' },
    { id: 'v6', userId: null, firstName: 'Hassan', lastName: 'Kiggundu', email: 'hassan@painter.ug', phone: '0772100006', category: 'painter', skills: JSON.stringify(['Interior painting','Exterior painting','Texture painting','Waterproofing paint']), bio: 'Professional painter with 10 years experience. We use quality paints and finish on time.', district: 'Kampala', address: 'Nakawa, Kampala', rating: 4.4, totalRatings: 16, totalJobs: 20, completedJobs: 18, isActive: true, isVerified: true, isSuspended: false, dailyRate: 70000, hourlyRate: 12000, availability: 'available', joinedAt: '2023-05-12T00:00:00Z', lastActiveAt: '2024-04-02T00:00:00Z' },
  ];

  for (const v of vendors) {
    await query(
      `INSERT INTO vendors (id,user_id,first_name,last_name,email,phone,category,skills,bio,district,address,rating,total_ratings,total_jobs,completed_jobs,is_active,is_verified,is_suspended,daily_rate,hourly_rate,availability,joined_at,last_active_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       ON CONFLICT (id) DO NOTHING`,
      [v.id,v.userId,v.firstName,v.lastName,v.email,v.phone,v.category,v.skills,v.bio,v.district,v.address,v.rating,v.totalRatings,v.totalJobs,v.completedJobs,v.isActive,v.isVerified,v.isSuspended,v.dailyRate,v.hourlyRate,v.availability,v.joinedAt,v.lastActiveAt]
    );
  }
  console.log(`  ✅ ${vendors.length} vendors seeded.`);
}

// ─── Seed Vendor Jobs ─────────────────────────────────────────────────────────
async function seedVendorJobs() {
  console.log('👷 Seeding vendor jobs...');

  const jobs = [
    {
      id: 'j1', vendorId: 'v1', vendorName: 'Peter Mugisha', maintenanceRequestId: 'm1',
      propertyTitle: '1-Bedroom Apartment in Entebbe', propertyAddress: 'Plot 15, Entebbe Road',
      title: 'Fix leaking tap in bathroom', description: 'Bathroom tap has been leaking for 3 days.',
      status: 'in_progress', scheduledDate: '2024-03-03', completedDate: null,
      estimatedCost: 50000, actualCost: null, managerNotes: 'Please fix by end of week.', vendorNotes: null,
      rating: null, ratingComment: null, photos: '[]',
      createdAt: '2024-03-02T00:00:00Z', updatedAt: '2024-03-03T00:00:00Z',
    },
    {
      id: 'j2', vendorId: 'v2', vendorName: 'James Okello', maintenanceRequestId: 'm2',
      propertyTitle: '1-Bedroom Apartment in Entebbe', propertyAddress: 'Plot 15, Entebbe Road',
      title: 'Fix bedroom socket', description: 'Bedroom socket not working.',
      status: 'assigned', scheduledDate: '2024-03-07', completedDate: null,
      estimatedCost: 30000, actualCost: null, managerNotes: 'Urgent — tenant working from home.', vendorNotes: null,
      rating: null, ratingComment: null, photos: '[]',
      createdAt: '2024-03-05T00:00:00Z', updatedAt: '2024-03-05T00:00:00Z',
    },
  ];

  for (const j of jobs) {
    await query(
      `INSERT INTO vendor_jobs (id,vendor_id,vendor_name,maintenance_request_id,property_title,property_address,title,description,status,scheduled_date,completed_date,estimated_cost,actual_cost,manager_notes,vendor_notes,rating,rating_comment,photos,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (id) DO NOTHING`,
      [j.id,j.vendorId,j.vendorName,j.maintenanceRequestId,j.propertyTitle,j.propertyAddress,j.title,j.description,j.status,j.scheduledDate,j.completedDate,j.estimatedCost,j.actualCost,j.managerNotes,j.vendorNotes,j.rating,j.ratingComment,j.photos,j.createdAt,j.updatedAt]
    );
  }
  console.log(`  ✅ ${jobs.length} vendor jobs seeded.`);
}

// ─── Seed Documents ───────────────────────────────────────────────────────────
async function seedDocuments() {
  console.log('📄 Seeding documents...');

  const docs = [
    { id: 'doc1', ownerId: 'u4', ownerName: 'Grace Apio', ownerRole: 'tenant', name: 'National ID (Front)', category: 'kyc', status: 'approved', fileUrl: '', fileType: 'image/jpeg', fileSize: 245000, expiresAt: null, reviewedBy: 'Admin ITAB', reviewedAt: '2024-01-16T09:00:00Z', adminNotes: 'ID verified — clear and valid.', uploadedAt: '2024-01-15T10:00:00Z' },
    { id: 'doc2', ownerId: 'u4', ownerName: 'Grace Apio', ownerRole: 'tenant', name: 'National ID (Back)', category: 'kyc', status: 'approved', fileUrl: '', fileType: 'image/jpeg', fileSize: 198000, expiresAt: null, reviewedBy: 'Admin ITAB', reviewedAt: '2024-01-16T09:05:00Z', adminNotes: null, uploadedAt: '2024-01-15T10:05:00Z' },
    { id: 'doc3', ownerId: 'u4', ownerName: 'Grace Apio', ownerRole: 'tenant', name: 'Tenancy Agreement — Entebbe Apartment', category: 'lease', status: 'approved', fileUrl: '', fileType: 'application/pdf', fileSize: 512000, expiresAt: '2025-01-31T00:00:00Z', reviewedBy: 'Admin ITAB', reviewedAt: '2024-02-02T10:00:00Z', adminNotes: null, uploadedAt: '2024-02-01T09:00:00Z' },
    { id: 'doc4', ownerId: 'u4', ownerName: 'Grace Apio', ownerRole: 'tenant', name: 'Proof of Income', category: 'kyc', status: 'pending', fileUrl: '', fileType: 'application/pdf', fileSize: 320000, expiresAt: null, reviewedBy: null, reviewedAt: null, adminNotes: null, uploadedAt: '2024-04-01T14:00:00Z' },
    { id: 'doc5', ownerId: 'u3', ownerName: 'John Ssemakula', ownerRole: 'landlord', name: 'Land Title — Entebbe Plot', category: 'ownership', status: 'pending', fileUrl: '', fileType: 'application/pdf', fileSize: 890000, expiresAt: null, reviewedBy: null, reviewedAt: null, adminNotes: null, uploadedAt: '2024-03-10T11:00:00Z' },
    { id: 'doc6', ownerId: 'u3', ownerName: 'John Ssemakula', ownerRole: 'landlord', name: 'National ID', category: 'kyc', status: 'approved', fileUrl: '', fileType: 'image/jpeg', fileSize: 210000, expiresAt: null, reviewedBy: 'Admin ITAB', reviewedAt: '2024-01-21T09:00:00Z', adminNotes: null, uploadedAt: '2024-01-20T08:00:00Z' },
    { id: 'doc7', ownerId: 'u2', ownerName: 'Sarah Nakato', ownerRole: 'property_manager', name: 'Professional Certificate', category: 'kyc', status: 'pending', fileUrl: '', fileType: 'application/pdf', fileSize: 450000, expiresAt: null, reviewedBy: null, reviewedAt: null, adminNotes: null, uploadedAt: '2024-04-05T09:30:00Z' },
    { id: 'doc8', ownerId: 'u6', ownerName: 'Peter Mugisha', ownerRole: 'vendor', name: 'Plumbing License', category: 'kyc', status: 'rejected', fileUrl: '', fileType: 'application/pdf', fileSize: 380000, expiresAt: null, reviewedBy: 'Admin ITAB', reviewedAt: '2024-03-16T10:00:00Z', adminNotes: 'Document is blurry and unreadable. Please upload a clearer scan.', uploadedAt: '2024-03-15T14:00:00Z' },
  ];

  for (const d of docs) {
    await query(
      `INSERT INTO documents (id,owner_id,owner_name,owner_role,name,category,status,file_url,file_type,file_size,expires_at,reviewed_by,reviewed_at,admin_notes,uploaded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      [d.id,d.ownerId,d.ownerName,d.ownerRole,d.name,d.category,d.status,d.fileUrl,d.fileType,d.fileSize,d.expiresAt,d.reviewedBy,d.reviewedAt,d.adminNotes,d.uploadedAt]
    );
  }
  console.log(`  ✅ ${docs.length} documents seeded.`);
}

// ─── Seed Tenant Notices ──────────────────────────────────────────────────────
async function seedNotices() {
  console.log('📋 Seeding tenant notices...');

  const notices = [
    {
      id: 'tn1', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
      tenantId: 'u4', tenantName: 'Grace Apio',
      issuedBy: 'Sarah Nakato', issuedByRole: 'property_manager',
      type: 'rent_arrears', subject: 'Overdue Rent — April 2024',
      body: 'Dear Grace,\n\nThis is a formal notice that your rent for April 2024 is partially outstanding. As of today, you have paid UGX 300,000 of the UGX 900,000 due, leaving a balance of UGX 600,000.\n\nPlease settle the outstanding balance by April 15, 2024 to avoid a late fee of 5% being applied.\n\nIf you are experiencing financial difficulties, please contact us immediately to discuss a payment arrangement.\n\nRegards,\nSarah Nakato\nProperty Manager, ITAB Property Services',
      effectiveDate: '2024-04-15', responseDeadline: '2024-04-15',
      status: 'unread', requiresAcknowledgement: true,
      attachmentUrl: null, tenantResponse: null,
      createdAt: '2024-04-08T09:00:00Z', readAt: null, acknowledgedAt: null,
    },
    {
      id: 'tn2', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
      tenantId: 'u4', tenantName: 'Grace Apio',
      issuedBy: 'John Ssemakula', issuedByRole: 'landlord',
      type: 'lease_renewal', subject: 'Lease Renewal Offer — January 2025',
      body: 'Dear Grace,\n\nYour current lease for the 1-Bedroom Apartment in Entebbe expires on January 31, 2025. We are pleased to offer you a lease renewal under the following terms:\n\n• New Monthly Rent: UGX 950,000 (5.6% increase)\n• New Lease Term: February 1, 2025 – January 31, 2026\n• Security Deposit: No additional deposit required\n\nPlease respond by December 31, 2024 to confirm whether you wish to renew.\n\nThank you for being a valued tenant.\n\nJohn Ssemakula\nProperty Owner',
      effectiveDate: '2025-02-01', responseDeadline: '2024-12-31',
      status: 'read', requiresAcknowledgement: true,
      attachmentUrl: null, tenantResponse: null,
      createdAt: '2024-11-01T10:00:00Z', readAt: '2024-11-02T08:30:00Z', acknowledgedAt: null,
    },
    {
      id: 'tn3', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
      tenantId: 'u4', tenantName: 'Grace Apio',
      issuedBy: 'Sarah Nakato', issuedByRole: 'property_manager',
      type: 'maintenance_notice', subject: 'Scheduled Maintenance — Water System',
      body: "Dear Grace,\n\nPlease be informed that we will be carrying out maintenance on the building's water system on Saturday, April 13, 2024 from 8:00 AM to 2:00 PM.\n\nDuring this time, water supply to your unit will be temporarily interrupted. We recommend storing water in advance.\n\nWe apologize for any inconvenience and appreciate your understanding.\n\nSarah Nakato\nProperty Manager",
      effectiveDate: '2024-04-13', responseDeadline: null,
      status: 'acknowledged', requiresAcknowledgement: false,
      attachmentUrl: null, tenantResponse: null,
      createdAt: '2024-04-10T14:00:00Z', readAt: '2024-04-10T16:00:00Z', acknowledgedAt: '2024-04-10T16:05:00Z',
    },
    {
      id: 'tn4', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
      tenantId: 'u4', tenantName: 'Grace Apio',
      issuedBy: 'Sarah Nakato', issuedByRole: 'property_manager',
      type: 'inspection_notice', subject: 'Annual Property Inspection — May 2024',
      body: 'Dear Grace,\n\nAs part of our property management responsibilities, we conduct an annual inspection of all units. Your inspection is scheduled for:\n\nDate: May 10, 2024\nTime: 10:00 AM – 11:00 AM\n\nPlease ensure the property is accessible at this time. The inspection will cover general condition, fixtures, and any maintenance needs.\n\nIf this time is inconvenient, please contact us at least 48 hours in advance to reschedule.\n\nSarah Nakato\nProperty Manager',
      effectiveDate: '2024-05-10', responseDeadline: null,
      status: 'unread', requiresAcknowledgement: true,
      attachmentUrl: null, tenantResponse: null,
      createdAt: '2024-04-25T09:00:00Z', readAt: null, acknowledgedAt: null,
    },
  ];

  for (const n of notices) {
    await query(
      `INSERT INTO tenant_notices (id,property_id,property_title,tenant_id,tenant_name,issued_by,issued_by_role,type,subject,body,effective_date,response_deadline,status,requires_acknowledgement,attachment_url,tenant_response,created_at,read_at,acknowledged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (id) DO NOTHING`,
      [n.id,n.propertyId,n.propertyTitle,n.tenantId,n.tenantName,n.issuedBy,n.issuedByRole,n.type,n.subject,n.body,n.effectiveDate,n.responseDeadline,n.status,n.requiresAcknowledgement,n.attachmentUrl,n.tenantResponse,n.createdAt,n.readAt,n.acknowledgedAt]
    );
  }
  console.log(`  ✅ ${notices.length} tenant notices seeded.`);
}

// ─── Seed Disputes ────────────────────────────────────────────────────────────
async function seedDisputes() {
  console.log('⚖️  Seeding disputes...');

  const now = new Date();
  const daysAgo = (d) => new Date(now - d * 86400000).toISOString();

  const disputes = [
    {
      id: 'd1', type: 'management_fee', status: 'open',
      raisedById: 'u3', raisedByName: 'John Ssemakula', raisedByRole: 'landlord',
      againstId: 'u2', againstName: 'Sarah Nakato', againstRole: 'property_manager',
      propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
      transactionId: null, subject: 'Management fee charged incorrectly',
      description: 'The management fee deducted was 15% but the agreed rate was 10%. I have been overcharged for the last 3 months.',
      evidence: null, amount: 270000, resolution: null, resolvedById: null, resolvedByName: null,
      createdAt: daysAgo(9), updatedAt: daysAgo(9), resolvedAt: null,
    },
    {
      id: 'd2', type: 'payout_amount', status: 'under_review',
      raisedById: 'u3', raisedByName: 'John Ssemakula', raisedByRole: 'landlord',
      againstId: 'u2', againstName: 'Sarah Nakato', againstRole: 'property_manager',
      propertyId: 'p1', propertyTitle: '3-Bedroom Apartment in Kololo',
      transactionId: null, subject: 'Payout not received for March',
      description: 'I have not received my payout for March 2024. The tenant paid on March 1st but I have not received anything.',
      evidence: null, amount: 2250000, resolution: null, resolvedById: null, resolvedByName: null,
      createdAt: daysAgo(5), updatedAt: daysAgo(4), resolvedAt: null,
    },
    {
      id: 'd3', type: 'property_condition', status: 'resolved',
      raisedById: 'u4', raisedByName: 'Grace Apio', raisedByRole: 'tenant',
      againstId: 'u2', againstName: 'Sarah Nakato', againstRole: 'property_manager',
      propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
      transactionId: null, subject: 'Property not as described — no backup power',
      description: 'The property listing said it had backup power but there is no generator or solar system installed.',
      evidence: null, amount: null,
      resolution: 'Manager agreed to install a solar backup system within 30 days. Tenant accepted resolution.',
      resolvedById: 'u1', resolvedByName: 'Admin ITAB',
      createdAt: daysAgo(20), updatedAt: daysAgo(10), resolvedAt: daysAgo(10),
    },
  ];

  for (const d of disputes) {
    await query(
      `INSERT INTO disputes (id,type,status,raised_by_id,raised_by_name,raised_by_role,against_id,against_name,against_role,property_id,property_title,transaction_id,subject,description,evidence,amount,resolution,resolved_by_id,resolved_by_name,created_at,updated_at,resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       ON CONFLICT (id) DO NOTHING`,
      [d.id,d.type,d.status,d.raisedById,d.raisedByName,d.raisedByRole,d.againstId,d.againstName,d.againstRole,d.propertyId,d.propertyTitle,d.transactionId,d.subject,d.description,d.evidence,d.amount,d.resolution,d.resolvedById,d.resolvedByName,d.createdAt,d.updatedAt,d.resolvedAt]
    );
  }
  console.log(`  ✅ ${disputes.length} disputes seeded.`);
}

// ─── Seed Notifications ───────────────────────────────────────────────────────
async function seedNotifications() {
  console.log('�� Seeding notifications...');

  const notifications = [
    { id: 'n1', userId: 'u4', type: 'inspection', title: 'Inspection Confirmed', body: 'Your inspection for 3-Bedroom Apartment in Kololo is confirmed for March 10 at 10:00 AM.', isRead: false, actionUrl: '/inspections/i1', createdAt: '2024-03-05T10:00:00Z' },
    { id: 'n2', userId: 'u4', type: 'payment', title: 'Rent Payment Received', body: 'UGX 900,000 rent payment received for Entebbe apartment.', isRead: false, actionUrl: '/payments/pay3', createdAt: '2024-03-01T09:00:00Z' },
    { id: 'n3', userId: 'u4', type: 'maintenance', title: 'Maintenance Update', body: 'Your leaking tap request has been assigned to Peter Plumbing Services.', isRead: true, actionUrl: '/maintenance/m1', createdAt: '2024-03-02T00:00:00Z' },
    { id: 'n4', userId: 'u4', type: 'payout', title: 'Payout Processed', body: 'UGX 792,000 has been sent to your MTN MoMo account.', isRead: true, actionUrl: '/payouts/po1', createdAt: '2024-03-05T10:00:00Z' },
  ];

  for (const n of notifications) {
    await query(
      `INSERT INTO notifications (id,user_id,type,title,body,is_read,action_url,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [n.id,n.userId,n.type,n.title,n.body,n.isRead,n.actionUrl,n.createdAt]
    );
  }
  console.log(`  ✅ ${notifications.length} notifications seeded.`);
}

// ─── Seed Announcements ───────────────────────────────────────────────────────
async function seedAnnouncements() {
  console.log('📢 Seeding announcements...');

  const announcements = [
    {
      id: 'ann1',
      title: 'Welcome to ITAB Platform',
      body: 'We are excited to launch the new ITAB property management platform. All features are now live. Please explore and let us know your feedback.',
      targetRoles: '[]',
      sentBy: 'u1',
      sentByName: 'Admin ITAB',
      createdAt: '2024-01-01T08:00:00Z',
    },
  ];

  for (const a of announcements) {
    await query(
      `INSERT INTO announcements (id,title,body,target_roles,sent_by,sent_by_name,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [a.id,a.title,a.body,a.targetRoles,a.sentBy,a.sentByName,a.createdAt]
    );
  }
  console.log(`  ✅ ${announcements.length} announcements seeded.`);
}

// ─── Seed Agent Applications ──────────────────────────────────────────────────
async function seedAgentApplications() {
  console.log('📝 Seeding agent applications...');

  const applications = [
    {
      id: 'app1', userId: 'u_app1', firstName: 'Moses', lastName: 'Kato',
      email: 'moses.kato@gmail.com', phone: '0772345678', role: 'agent',
      nationalIdNumber: null,
      experience: '3 years working as a real estate broker in Kampala',
      districts: JSON.stringify(['Kampala', 'Wakiso']),
      motivation: 'I want to help landlords find quality tenants',
      status: 'pending', adminNote: null,
      createdAt: '2024-03-01T00:00:00Z', reviewedAt: null,
    },
    {
      id: 'app2', userId: 'u_app2', firstName: 'Fatuma', lastName: 'Nabirye',
      email: 'fatuma.n@gmail.com', phone: '0752987654', role: 'property_manager',
      nationalIdNumber: null,
      experience: '5 years in property sales and rentals',
      districts: JSON.stringify(['Kampala', 'Entebbe', 'Mukono']),
      motivation: 'Looking to expand my client base using a digital platform.',
      status: 'pending', adminNote: null,
      createdAt: '2024-03-10T00:00:00Z', reviewedAt: null,
    },
  ];

  for (const a of applications) {
    await query(
      `INSERT INTO agent_applications (id,user_id,first_name,last_name,email,phone,role,national_id_number,experience,districts,motivation,status,admin_note,created_at,reviewed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      [a.id,a.userId,a.firstName,a.lastName,a.email,a.phone,a.role,a.nationalIdNumber,a.experience,a.districts,a.motivation,a.status,a.adminNote,a.createdAt,a.reviewedAt]
    );
  }
  console.log(`  ✅ ${applications.length} agent applications seeded.`);
}

// ─── Seed Audit Logs ──────────────────────────────────────────────────────────
async function seedAuditLogs() {
  console.log('📊 Seeding audit logs...');

  const logs = [
    { id: 'al1', action: 'user_registered', performedBy: 'u4', performedByName: 'Grace Apio', performedByRole: 'tenant', targetId: 'u4', targetName: 'Grace Apio', description: 'New tenant account registered', metadata: JSON.stringify({ email: 'tenant@itab.ug' }), createdAt: '2024-02-01T00:00:00Z' },
    { id: 'al2', action: 'property_published', performedBy: 'u2', performedByName: 'Sarah Nakato', performedByRole: 'property_manager', targetId: 'p1', targetName: '3-Bedroom Apartment in Kololo', description: 'Property published and made available for inspection', metadata: JSON.stringify({ district: 'Kampala', rentPrice: 2500000 }), createdAt: '2024-01-15T00:00:00Z' },
    { id: 'al3', action: 'inspection_booked', performedBy: 'u4', performedByName: 'Grace Apio', performedByRole: 'tenant', targetId: 'i1', targetName: 'Inspection i1', description: 'Inspection booked for 3-Bedroom Apartment in Kololo', metadata: JSON.stringify({ propertyId: 'p1', scheduledDate: '2024-03-10' }), createdAt: '2024-03-05T00:00:00Z' },
    { id: 'al4', action: 'payment_completed', performedBy: 'u4', performedByName: 'Grace Apio', performedByRole: 'tenant', targetId: 'pay1', targetName: 'Payment pay1', description: 'Inspection fee payment completed via MTN MoMo', metadata: JSON.stringify({ amount: 100000, reference: 'MTN-2024-001' }), createdAt: '2024-03-05T10:30:00Z' },
    { id: 'al5', action: 'lease_signed', performedBy: 'u4', performedByName: 'Grace Apio', performedByRole: 'tenant', targetId: 'p6', targetName: '1-Bedroom Apartment in Entebbe', description: 'Lease agreement signed for 1-Bedroom Apartment in Entebbe', metadata: JSON.stringify({ leaseStart: '2024-02-01', leaseEnd: '2025-01-31' }), createdAt: '2024-02-01T00:00:00Z' },
    { id: 'al6', action: 'maintenance_submitted', performedBy: 'u4', performedByName: 'Grace Apio', performedByRole: 'tenant', targetId: 'm1', targetName: 'Leaking tap in bathroom', description: 'Maintenance request submitted for leaking tap', metadata: JSON.stringify({ priority: 'normal', propertyId: 'p6' }), createdAt: '2024-03-01T00:00:00Z' },
    { id: 'al7', action: 'payout_processed', performedBy: 'u2', performedByName: 'Sarah Nakato', performedByRole: 'property_manager', targetId: 'po1', targetName: 'Payout po1', description: 'Landlord payout processed via MTN MoMo', metadata: JSON.stringify({ amount: 792000, landlordId: 'u3' }), createdAt: '2024-03-05T10:00:00Z' },
    { id: 'al8', action: 'document_approved', performedBy: 'u1', performedByName: 'Admin ITAB', performedByRole: 'admin', targetId: 'doc1', targetName: 'National ID (Front)', description: 'KYC document approved for Grace Apio', metadata: JSON.stringify({ ownerId: 'u4', category: 'kyc' }), createdAt: '2024-01-16T09:00:00Z' },
  ];

  for (const l of logs) {
    await query(
      `INSERT INTO audit_logs (id,action,performed_by,performed_by_name,performed_by_role,target_id,target_name,description,metadata,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [l.id,l.action,l.performedBy,l.performedByName,l.performedByRole,l.targetId,l.targetName,l.description,l.metadata,l.createdAt]
    );
  }
  console.log(`  ✅ ${logs.length} audit logs seeded.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ITAB Seed Script — Render PostgreSQL');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Add it to your .env file.');
    process.exit(1);
  }

  try {
    await runSchema();
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

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  ✅ All seed data inserted successfully!');
    console.log('  🔑 All user passwords: password123');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
