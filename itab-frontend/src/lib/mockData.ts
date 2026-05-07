import type { Property, User, Inspection, Payment, RentBalance, TenantNotice, MaintenanceRequest, Payout, Notification, DashboardStats, Vendor, VendorJob } from '../types';

// ─── Mock Users ───────────────────────────────────────────────────────────────
export const mockUsers: User[] = [
  { id: 'u1', email: 'admin@itab.ug', phone: '0700000001', firstName: 'Admin', lastName: 'ITAB', role: 'admin', isVerified: true, isSuspended: false, kycStatus: 'approved', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u2', email: 'manager@itab.ug', phone: '0700000002', firstName: 'Sarah', lastName: 'Nakato', role: 'property_manager', isVerified: true, isSuspended: false, kycStatus: 'approved', createdAt: '2024-01-05T00:00:00Z', updatedAt: '2024-01-05T00:00:00Z' },
  { id: 'u3', email: 'landlord@itab.ug', phone: '0700000003', firstName: 'John', lastName: 'Ssemakula', role: 'landlord', isVerified: true, isSuspended: false, kycStatus: 'approved', createdAt: '2024-01-10T00:00:00Z', updatedAt: '2024-01-10T00:00:00Z' },
  { id: 'u4', email: 'tenant@itab.ug', phone: '0700000004', firstName: 'Grace', lastName: 'Apio', role: 'tenant', isVerified: true, isSuspended: false, kycStatus: 'approved', createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z' },
  { id: 'u5', email: 'agent@itab.ug', phone: '0700000005', firstName: 'David', lastName: 'Ochieng', role: 'agent', isVerified: true, isSuspended: false, kycStatus: 'approved', createdAt: '2024-02-15T00:00:00Z', updatedAt: '2024-02-15T00:00:00Z' },
  { id: 'u6', email: 'vendor@itab.ug', phone: '0772100001', firstName: 'Peter', lastName: 'Mugisha', role: 'vendor', isVerified: true, isSuspended: false, kycStatus: 'approved', createdAt: '2023-06-01T00:00:00Z', updatedAt: '2023-06-01T00:00:00Z' },
];

// ─── Mock Properties ──────────────────────────────────────────────────────────
export const mockProperties: Property[] = [
  {
    id: 'p1', title: '3-Bedroom Apartment in Kololo', description: 'Spacious modern apartment with stunning city views, fully furnished with high-end finishes. Located in the heart of Kololo with easy access to major amenities.',
    type: 'apartment', status: 'published', address: 'Plot 12, Kololo Hill Drive', district: 'Kampala',
    latitude: 0.3476, longitude: 32.5825, bedrooms: 3, bathrooms: 2, squareFootage: 180,
    rentPrice: 2500000, deposit: 5000000, availableFrom: '2024-03-01',
    photos: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'],
    amenities: ['wifi', 'furnished', 'parking', 'security', 'backup_power', 'water_tank'],
    managementFeePercent: 10, itabFeePercent: 2, isFeatured: true,
    managerId: 'u2', managerName: 'Sarah Nakato', landlordId: 'u3', landlordName: 'John Ssemakula',
    viewCount: 245, createdAt: '2024-01-15T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'p2', title: '2-Bedroom House in Ntinda', description: 'Cozy family home in a quiet neighborhood. Tiled throughout with a beautiful garden and perimeter wall for security.',
    type: 'house', status: 'published', address: 'Plot 45, Ntinda Road', district: 'Kampala',
    latitude: 0.3601, longitude: 32.6108, bedrooms: 2, bathrooms: 1, squareFootage: 120,
    rentPrice: 1200000, deposit: 2400000, availableFrom: '2024-03-15',
    photos: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800'],
    amenities: ['tiled', 'kitchen', 'perimeter_wall', 'parking', 'water_tank'],
    managementFeePercent: 8, itabFeePercent: 2, isFeatured: false,
    managerId: 'u2', managerName: 'Sarah Nakato', landlordId: 'u3', landlordName: 'John Ssemakula',
    viewCount: 189, createdAt: '2024-01-20T00:00:00Z', updatedAt: '2024-02-05T00:00:00Z',
  },
  {
    id: 'p3', title: 'Studio Apartment in Bukoto', description: 'Modern studio perfect for young professionals. Walking distance to Bukoto market and public transport.',
    type: 'apartment', status: 'published', address: 'Plot 8, Bukoto Street', district: 'Kampala',
    latitude: 0.3512, longitude: 32.5967, bedrooms: 1, bathrooms: 1, squareFootage: 45,
    rentPrice: 650000, deposit: 1300000, availableFrom: '2024-02-20',
    photos: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800'],
    amenities: ['wifi', 'tiled', 'kitchen', 'security'],
    managementFeePercent: 10, itabFeePercent: 2, isFeatured: false,
    managerId: 'u2', managerName: 'Sarah Nakato', landlordId: 'u3', landlordName: 'John Ssemakula',
    viewCount: 312, createdAt: '2024-01-25T00:00:00Z', updatedAt: '2024-02-10T00:00:00Z',
  },
  {
    id: 'p4', title: '4-Bedroom Villa in Muyenga', description: 'Luxurious villa with private pool, gym, and panoramic lake views. Perfect for executives and diplomats.',
    type: 'house', status: 'published', address: 'Plot 3, Tank Hill Road, Muyenga', district: 'Kampala',
    latitude: 0.2987, longitude: 32.5876, bedrooms: 4, bathrooms: 3, squareFootage: 350,
    rentPrice: 8000000, deposit: 16000000, availableFrom: '2024-04-01',
    photos: ['https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800'],
    amenities: ['wifi', 'furnished', 'parking', 'gym', 'pool', 'security', 'backup_power', 'water_tank', 'cctv', 'garden'],
    managementFeePercent: 12, itabFeePercent: 2, isFeatured: true,
    managerId: 'u2', managerName: 'Sarah Nakato', landlordId: 'u3', landlordName: 'John Ssemakula',
    viewCount: 567, createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-15T00:00:00Z',
  },
  {
    id: 'p5', title: 'Commercial Space in Nakasero', description: 'Prime commercial space in Nakasero CBD. Ideal for offices, retail, or restaurant. Ground floor with high foot traffic.',
    type: 'commercial', status: 'published', address: 'Plot 22, Nakasero Road', district: 'Kampala',
    latitude: 0.3190, longitude: 32.5773, bedrooms: 0, bathrooms: 2, squareFootage: 200,
    rentPrice: 5000000, deposit: 10000000, availableFrom: '2024-03-01',
    photos: ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800'],
    amenities: ['wifi', 'parking', 'security', 'backup_power', 'cctv'],
    managementFeePercent: 10, itabFeePercent: 2, isFeatured: false,
    managerId: 'u2', managerName: 'Sarah Nakato', landlordId: 'u3', landlordName: 'John Ssemakula',
    viewCount: 134, createdAt: '2024-02-05T00:00:00Z', updatedAt: '2024-02-20T00:00:00Z',
  },
  {
    id: 'p6', title: '1-Bedroom Apartment in Entebbe', description: 'Peaceful apartment near Entebbe International Airport. Great for frequent travelers and expats.',
    type: 'apartment', status: 'rented', address: 'Plot 15, Entebbe Road', district: 'Entebbe',
    latitude: 0.0512, longitude: 32.4637, bedrooms: 1, bathrooms: 1, squareFootage: 65,
    rentPrice: 900000, deposit: 1800000, availableFrom: '2024-05-01',
    photos: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800'],
    amenities: ['wifi', 'tiled', 'kitchen', 'parking', 'security'],
    managementFeePercent: 10, itabFeePercent: 2, isFeatured: false,
    managerId: 'u2', managerName: 'Sarah Nakato', landlordId: 'u3', landlordName: 'John Ssemakula',
    tenantId: 'u4', leaseStart: '2024-02-01', leaseEnd: '2025-01-31',
    viewCount: 98, createdAt: '2024-01-30T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z',
  },
];

// ─── Mock Inspections ─────────────────────────────────────────────────────────
export const mockInspections: Inspection[] = [
  {
    id: 'i1', propertyId: 'p1', propertyTitle: '3-Bedroom Apartment in Kololo', propertyAddress: 'Plot 12, Kololo Hill Drive',
    tenantId: 'u4', tenantName: 'Grace Apio', managerId: 'u2',
    scheduledDate: '2024-03-10', scheduledTime: '10:00',
    status: 'confirmed', feeAmount: 100000, feePaid: true, paymentMethod: 'mtn_momo', paymentRef: 'MTN-2024-001',
    creditApplied: false, noShowCount: 0, rescheduleCount: 0,
    createdAt: '2024-03-05T00:00:00Z',
  },
  {
    id: 'i2', propertyId: 'p2', propertyTitle: '2-Bedroom House in Ntinda', propertyAddress: 'Plot 45, Ntinda Road',
    tenantId: 'u4', tenantName: 'Grace Apio', managerId: 'u2',
    scheduledDate: '2024-03-15', scheduledTime: '14:00',
    status: 'pending', feeAmount: 100000, feePaid: false,
    creditApplied: false, noShowCount: 0, rescheduleCount: 0,
    createdAt: '2024-03-08T00:00:00Z',
  },
  // Completed inspection where tenant declined the lease — property stays available
  {
    id: 'i3', propertyId: 'p3', propertyTitle: 'Studio Apartment in Bukoto', propertyAddress: 'Plot 8, Bukoto Street',
    tenantId: 'u4', tenantName: 'Grace Apio', managerId: 'u2',
    scheduledDate: '2024-02-20', scheduledTime: '11:00',
    status: 'completed', feeAmount: 100000, feePaid: true, paymentMethod: 'airtel_money', paymentRef: 'AIR-2024-005',
    creditApplied: false, noShowCount: 0, rescheduleCount: 0,
    leaseDeclined: true,
    leaseDeclinedReason: 'The space was too small for my needs.',
    leaseDeclinedAt: '2024-02-21T09:00:00Z',
    createdAt: '2024-02-15T00:00:00Z',
  },
];

// ─── Mock Payments ────────────────────────────────────────────────────────────
export const mockPayments: Payment[] = [
  {
    id: 'pay1', type: 'inspection_fee', amount: 100000, currency: 'UGX', status: 'completed',
    method: 'mtn_momo', reference: 'MTN-2024-001', propertyId: 'p1', propertyTitle: '3-Bedroom Apartment in Kololo',
    tenantId: 'u4', tenantName: 'Grace Apio', paidAt: '2024-03-05T10:30:00Z', createdAt: '2024-03-05T10:00:00Z',
  },
  // First rent — paid in full with inspection credit applied
  {
    id: 'pay2', type: 'rent', amount: 800000, currency: 'UGX', status: 'completed',
    method: 'mtn_momo', reference: 'MTN-2024-002', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    tenantId: 'u4', tenantName: 'Grace Apio', inspectionCreditApplied: 100000,
    rentPeriod: '2024-02', isPartial: false,
    paidAt: '2024-02-01T09:00:00Z', createdAt: '2024-02-01T08:00:00Z',
  },
  // March rent — paid in two partial payments
  {
    id: 'pay3', type: 'rent_partial', amount: 500000, currency: 'UGX', status: 'completed',
    method: 'mtn_momo', reference: 'MTN-2024-003', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    tenantId: 'u4', tenantName: 'Grace Apio',
    rentPeriod: '2024-03', isPartial: true,
    paidAt: '2024-03-01T09:00:00Z', createdAt: '2024-03-01T08:00:00Z',
  },
  {
    id: 'pay4', type: 'rent_partial', amount: 400000, currency: 'UGX', status: 'completed',
    method: 'airtel_money', reference: 'AIR-2024-001', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    tenantId: 'u4', tenantName: 'Grace Apio',
    rentPeriod: '2024-03', isPartial: true,
    paidAt: '2024-03-15T09:00:00Z', createdAt: '2024-03-15T08:00:00Z',
  },
  // April rent — partially paid, balance outstanding
  {
    id: 'pay5', type: 'rent_partial', amount: 300000, currency: 'UGX', status: 'completed',
    method: 'mtn_momo', reference: 'MTN-2024-004', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    tenantId: 'u4', tenantName: 'Grace Apio',
    rentPeriod: '2024-04', isPartial: true,
    paidAt: '2024-04-01T09:00:00Z', createdAt: '2024-04-01T08:00:00Z',
  },
  // Declined inspection fee (no credit — tenant didn't take the property)
  {
    id: 'pay6', type: 'inspection_fee', amount: 100000, currency: 'UGX', status: 'completed',
    method: 'airtel_money', reference: 'AIR-2024-005', propertyId: 'p3', propertyTitle: 'Studio Apartment in Bukoto',
    tenantId: 'u4', tenantName: 'Grace Apio', paidAt: '2024-02-15T10:30:00Z', createdAt: '2024-02-15T10:00:00Z',
  },
];

// ─── Mock Rent Balances ───────────────────────────────────────────────────────
export const mockRentBalances: RentBalance[] = [
  {
    id: 'rb1',
    propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    tenantId: 'u4',
    rentPeriod: '2024-02',
    totalDue: 900000, totalPaid: 900000, balance: 0,
    inspectionCredit: 100000,
    isFullyPaid: true,
    dueDate: '2024-02-01',
    payments: [mockPayments[1]],
    lateFeeApplied: 0,
    createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-01T09:00:00Z',
  },
  {
    id: 'rb2',
    propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    tenantId: 'u4',
    rentPeriod: '2024-03',
    totalDue: 900000, totalPaid: 900000, balance: 0,
    inspectionCredit: 0,
    isFullyPaid: true,
    dueDate: '2024-03-01',
    payments: [mockPayments[2], mockPayments[3]],
    lateFeeApplied: 0,
    createdAt: '2024-03-01T00:00:00Z', updatedAt: '2024-03-15T09:00:00Z',
  },
  {
    id: 'rb3',
    propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    tenantId: 'u4',
    rentPeriod: '2024-04',
    totalDue: 900000, totalPaid: 300000, balance: 600000,
    inspectionCredit: 0,
    isFullyPaid: false,
    dueDate: '2024-04-01',
    payments: [mockPayments[4]],
    lateFeeApplied: 0,
    createdAt: '2024-04-01T00:00:00Z', updatedAt: '2024-04-01T09:00:00Z',
  },
];

// ─── Mock Maintenance ─────────────────────────────────────────────────────────
export const mockMaintenance: MaintenanceRequest[] = [
  {
    id: 'm1', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    tenantId: 'u4', tenantName: 'Grace Apio',
    title: 'Leaking tap in bathroom', description: 'The bathroom tap has been leaking for 3 days. Water is wasting and the floor is wet.',
    priority: 'normal', status: 'in_progress', photos: [],
    vendorId: 'v1', vendorName: 'Peter Plumbing Services',
    estimatedCost: 50000, createdAt: '2024-03-01T00:00:00Z', updatedAt: '2024-03-02T00:00:00Z',
  },
  {
    id: 'm2', propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    tenantId: 'u4', tenantName: 'Grace Apio',
    title: 'Power outage in bedroom', description: 'The bedroom socket is not working. Checked the breaker but it seems fine.',
    priority: 'urgent', status: 'submitted', photos: [],
    createdAt: '2024-03-05T00:00:00Z', updatedAt: '2024-03-05T00:00:00Z',
  },
];

// ─── Mock Payouts ─────────────────────────────────────────────────────────────
export const mockPayouts: Payout[] = [
  {
    id: 'po1', landlordId: 'u3', landlordName: 'John Ssemakula',
    propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    grossRent: 900000, managementFee: 90000, itabFee: 18000, netAmount: 792000,
    status: 'completed', method: 'mtn_momo', reference: 'PAYOUT-2024-001',
    scheduledDate: '2024-03-05', processedAt: '2024-03-05T10:00:00Z', retryCount: 0,
  },
];

// ─── Mock Notifications ───────────────────────────────────────────────────────
export const mockNotifications: Notification[] = [
  { id: 'n1', type: 'inspection', title: 'Inspection Confirmed', body: 'Your inspection for 3-Bedroom Apartment in Kololo is confirmed for March 10 at 10:00 AM.', isRead: false, actionUrl: '/inspections/i1', createdAt: '2024-03-05T10:00:00Z' },
  { id: 'n2', type: 'payment', title: 'Rent Payment Received', body: 'UGX 900,000 rent payment received for Entebbe apartment.', isRead: false, actionUrl: '/payments/pay3', createdAt: '2024-03-01T09:00:00Z' },
  { id: 'n3', type: 'maintenance', title: 'Maintenance Update', body: 'Your leaking tap request has been assigned to Peter Plumbing Services.', isRead: true, actionUrl: '/maintenance/m1', createdAt: '2024-03-02T00:00:00Z' },
  { id: 'n4', type: 'payout', title: 'Payout Processed', body: 'UGX 792,000 has been sent to your MTN MoMo account.', isRead: true, actionUrl: '/payouts/po1', createdAt: '2024-03-05T10:00:00Z' },
];

// ─── Mock Tenant Notices ──────────────────────────────────────────────────────
export const mockTenantNotices: TenantNotice[] = [
  {
    id: 'tn1',
    propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    tenantId: 'u4', tenantName: 'Grace Apio',
    issuedBy: 'Sarah Nakato', issuedByRole: 'property_manager',
    type: 'rent_arrears',
    subject: 'Overdue Rent — April 2024',
    body: 'Dear Grace,\n\nThis is a formal notice that your rent for April 2024 is partially outstanding. As of today, you have paid UGX 300,000 of the UGX 900,000 due, leaving a balance of UGX 600,000.\n\nPlease settle the outstanding balance by April 15, 2024 to avoid a late fee of 5% being applied.\n\nIf you are experiencing financial difficulties, please contact us immediately to discuss a payment arrangement.\n\nRegards,\nSarah Nakato\nProperty Manager, ITAB Property Services',
    effectiveDate: '2024-04-15',
    responseDeadline: '2024-04-15',
    status: 'unread',
    requiresAcknowledgement: true,
    createdAt: '2024-04-08T09:00:00Z',
  },
  {
    id: 'tn2',
    propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    tenantId: 'u4', tenantName: 'Grace Apio',
    issuedBy: 'John Ssemakula', issuedByRole: 'landlord',
    type: 'lease_renewal',
    subject: 'Lease Renewal Offer — January 2025',
    body: 'Dear Grace,\n\nYour current lease for the 1-Bedroom Apartment in Entebbe expires on January 31, 2025. We are pleased to offer you a lease renewal under the following terms:\n\n• New Monthly Rent: UGX 950,000 (5.6% increase)\n• New Lease Term: February 1, 2025 – January 31, 2026\n• Security Deposit: No additional deposit required\n\nPlease respond by December 31, 2024 to confirm whether you wish to renew. If we do not hear from you, we will assume you are vacating and will begin advertising the property.\n\nThank you for being a valued tenant.\n\nJohn Ssemakula\nProperty Owner',
    effectiveDate: '2025-02-01',
    responseDeadline: '2024-12-31',
    status: 'read',
    requiresAcknowledgement: true,
    createdAt: '2024-11-01T10:00:00Z',
    readAt: '2024-11-02T08:30:00Z',
  },
  {
    id: 'tn3',
    propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    tenantId: 'u4', tenantName: 'Grace Apio',
    issuedBy: 'Sarah Nakato', issuedByRole: 'property_manager',
    type: 'maintenance_notice',
    subject: 'Scheduled Maintenance — Water System',
    body: 'Dear Grace,\n\nPlease be informed that we will be carrying out maintenance on the building\'s water system on Saturday, April 13, 2024 from 8:00 AM to 2:00 PM.\n\nDuring this time, water supply to your unit will be temporarily interrupted. We recommend storing water in advance.\n\nWe apologize for any inconvenience and appreciate your understanding.\n\nSarah Nakato\nProperty Manager',
    effectiveDate: '2024-04-13',
    status: 'acknowledged',
    requiresAcknowledgement: false,
    createdAt: '2024-04-10T14:00:00Z',
    readAt: '2024-04-10T16:00:00Z',
    acknowledgedAt: '2024-04-10T16:05:00Z',
  },
  {
    id: 'tn4',
    propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    tenantId: 'u4', tenantName: 'Grace Apio',
    issuedBy: 'Sarah Nakato', issuedByRole: 'property_manager',
    type: 'inspection_notice',
    subject: 'Annual Property Inspection — May 2024',
    body: 'Dear Grace,\n\nAs part of our property management responsibilities, we conduct an annual inspection of all units. Your inspection is scheduled for:\n\nDate: May 10, 2024\nTime: 10:00 AM – 11:00 AM\n\nPlease ensure the property is accessible at this time. The inspection will cover general condition, fixtures, and any maintenance needs.\n\nIf this time is inconvenient, please contact us at least 48 hours in advance to reschedule.\n\nSarah Nakato\nProperty Manager',
    effectiveDate: '2024-05-10',
    status: 'unread',
    requiresAcknowledgement: true,
    createdAt: '2024-04-25T09:00:00Z',
  },
];

// ─── Mock Dashboard Stats ─────────────────────────────────────────────────────
export const mockDashboardStats: DashboardStats = {
  totalProperties: 6,
  vacantProperties: 4,
  occupiedProperties: 2,
  totalTenants: 1,
  pendingMaintenance: 2,
  monthlyRevenue: 3400000,
  pendingPayouts: 1,
  inspectionFeeRevenue: 100000,
  conversionRate: 35,
};

// ─── Mock Vendors ─────────────────────────────────────────────────────────────
export const mockVendors: Vendor[] = [
  {
    id: 'v1', userId: 'u6', firstName: 'Peter', lastName: 'Mugisha', email: 'vendor@itab.ug', phone: '0772100001',
    category: 'plumber', skills: ['Pipe fitting', 'Drain unblocking', 'Tap repair', 'Water heater installation'],
    bio: 'Licensed plumber with 8 years experience in residential and commercial properties across Kampala.',
    district: 'Kampala', address: 'Ntinda, Kampala',
    rating: 4.7, totalRatings: 23, totalJobs: 31, completedJobs: 28,
    isActive: true, isVerified: true, isSuspended: false,
    dailyRate: 80000, hourlyRate: 15000,
    availability: 'available',
    joinedAt: '2023-06-01T00:00:00Z', lastActiveAt: '2024-04-01T00:00:00Z',
  },
  {
    id: 'v2', firstName: 'James', lastName: 'Okello', email: 'james@electric.ug', phone: '0772100002',
    category: 'electrician', skills: ['Wiring', 'Solar installation', 'Generator repair', 'CCTV installation', 'Inverter setup'],
    bio: 'Certified electrician specializing in solar systems and smart home installations.',
    district: 'Kampala', address: 'Bukoto, Kampala',
    rating: 4.9, totalRatings: 41, totalJobs: 55, completedJobs: 52,
    isActive: true, isVerified: true, isSuspended: false,
    dailyRate: 100000, hourlyRate: 20000,
    availability: 'available',
    joinedAt: '2023-03-15T00:00:00Z', lastActiveAt: '2024-04-05T00:00:00Z',
  },
  {
    id: 'v3', firstName: 'Mary', lastName: 'Namukasa', email: 'mary@cleanpro.ug', phone: '0772100003',
    category: 'cleaner', skills: ['Deep cleaning', 'Carpet cleaning', 'Post-construction cleaning', 'Regular housekeeping'],
    bio: 'Professional cleaning service with a team of 5. We bring our own equipment and supplies.',
    district: 'Kampala', address: 'Kololo, Kampala',
    rating: 4.5, totalRatings: 18, totalJobs: 24, completedJobs: 22,
    isActive: true, isVerified: true, isSuspended: false,
    dailyRate: 60000, hourlyRate: 10000,
    availability: 'busy',
    joinedAt: '2023-08-20T00:00:00Z', lastActiveAt: '2024-04-03T00:00:00Z',
  },
  {
    id: 'v4', firstName: 'Robert', lastName: 'Ssebunya', email: 'robert@mason.ug', phone: '0772100004',
    category: 'mason', skills: ['Tiling', 'Plastering', 'Bricklaying', 'Waterproofing', 'Concrete work'],
    bio: 'Experienced mason with expertise in tiling and waterproofing. Quality work guaranteed.',
    district: 'Wakiso', address: 'Entebbe Road, Wakiso',
    rating: 4.3, totalRatings: 12, totalJobs: 15, completedJobs: 13,
    isActive: true, isVerified: false, isSuspended: false,
    dailyRate: 90000, hourlyRate: 18000,
    availability: 'available',
    joinedAt: '2023-11-10T00:00:00Z', lastActiveAt: '2024-03-28T00:00:00Z',
  },
  {
    id: 'v5', firstName: 'Agnes', lastName: 'Atim', email: 'agnes@garden.ug', phone: '0772100005',
    category: 'gardener', skills: ['Lawn mowing', 'Tree trimming', 'Garden design', 'Compound cutting', 'Flower planting'],
    bio: 'Passionate gardener offering regular maintenance and one-time garden makeovers.',
    district: 'Kampala', address: 'Muyenga, Kampala',
    rating: 4.6, totalRatings: 9, totalJobs: 11, completedJobs: 10,
    isActive: true, isVerified: true, isSuspended: false,
    dailyRate: 50000, hourlyRate: 8000,
    availability: 'available',
    joinedAt: '2024-01-05T00:00:00Z', lastActiveAt: '2024-04-04T00:00:00Z',
  },
  {
    id: 'v6', firstName: 'Hassan', lastName: 'Kiggundu', email: 'hassan@painter.ug', phone: '0772100006',
    category: 'painter', skills: ['Interior painting', 'Exterior painting', 'Texture painting', 'Waterproofing paint'],
    bio: 'Professional painter with 10 years experience. We use quality paints and finish on time.',
    district: 'Kampala', address: 'Nakawa, Kampala',
    rating: 4.4, totalRatings: 16, totalJobs: 20, completedJobs: 18,
    isActive: true, isVerified: true, isSuspended: false,
    dailyRate: 70000, hourlyRate: 12000,
    availability: 'available',
    joinedAt: '2023-05-12T00:00:00Z', lastActiveAt: '2024-04-02T00:00:00Z',
  },
];

// ─── Mock Vendor Jobs ─────────────────────────────────────────────────────────
export const mockVendorJobs: VendorJob[] = [
  {
    id: 'j1', vendorId: 'v1', vendorName: 'Peter Mugisha',
    maintenanceRequestId: 'm1', propertyTitle: '1-Bedroom Apartment in Entebbe', propertyAddress: 'Plot 15, Entebbe Road',
    title: 'Fix leaking tap in bathroom', description: 'Bathroom tap has been leaking for 3 days.',
    status: 'in_progress', scheduledDate: '2024-03-03',
    estimatedCost: 50000, managerNotes: 'Please fix by end of week.',
    photos: [], createdAt: '2024-03-02T00:00:00Z', updatedAt: '2024-03-03T00:00:00Z',
  },
  {
    id: 'j2', vendorId: 'v2', vendorName: 'James Okello',
    maintenanceRequestId: 'm2', propertyTitle: '1-Bedroom Apartment in Entebbe', propertyAddress: 'Plot 15, Entebbe Road',
    title: 'Fix bedroom socket', description: 'Bedroom socket not working.',
    status: 'assigned', scheduledDate: '2024-03-07',
    estimatedCost: 30000, managerNotes: 'Urgent — tenant working from home.',
    photos: [], createdAt: '2024-03-05T00:00:00Z', updatedAt: '2024-03-05T00:00:00Z',
  },
];
