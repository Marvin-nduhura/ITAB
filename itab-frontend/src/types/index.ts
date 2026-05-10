// ─── User & Auth ────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'property_manager' | 'landlord' | 'tenant' | 'agent' | 'vendor' | 'guest';

export interface User {
  id: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  isVerified: boolean;
  isSuspended: boolean;
  suspendedReason?: string;
  suspendedAt?: string;
  kycStatus: 'pending' | 'submitted' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ─── Property ────────────────────────────────────────────────────────────────
export type PropertyType = 'apartment' | 'house' | 'commercial' | 'land';
export type PropertyStatus = 'draft' | 'pending_vetting' | 'published' | 'rented' | 'under_maintenance' | 'rejected';

export interface Property {
  id: string;
  title: string;
  description: string;
  type: PropertyType;
  status: PropertyStatus;
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  squareFootage?: number;
  rentPrice: number;
  deposit: number;
  availableFrom: string;
  photos: string[];
  amenities: string[];
  managementFeePercent: number;
  itabFeePercent: number;
  isFeatured: boolean;
  tourUrl?: string;           // YouTube URL for virtual tour
  managerId?: string;
  managerName?: string;
  landlordId?: string;
  landlordName?: string;
  tenantId?: string;
  leaseStart?: string;
  leaseEnd?: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyFilter {
  search?: string;
  type?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  district?: string;
  amenities?: string[];
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'largest' | 'nearest';
}

// ─── Inspection ──────────────────────────────────────────────────────────────
export type InspectionStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type PaymentMethod = 'mtn_momo' | 'airtel_money' | 'card' | 'cash';

export interface Inspection {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyAddress: string;
  tenantId: string;
  tenantName: string;
  managerId: string;
  scheduledDate: string;
  scheduledTime: string;
  status: InspectionStatus;
  feeAmount: number;
  feePaid: boolean;
  paymentMethod?: PaymentMethod;
  paymentRef?: string;
  creditApplied: boolean;
  qrCode?: string;
  notes?: string;
  noShowCount: number;
  rescheduleCount: number;
  // Lease outcome — set after inspection is completed
  leaseDeclined?: boolean;    // tenant inspected but chose not to take the property
  leaseDeclinedReason?: string;
  leaseDeclinedAt?: string;
  createdAt: string;
}

// ─── Payment ─────────────────────────────────────────────────────────────────
export type PaymentType = 'inspection_fee' | 'rent' | 'rent_partial' | 'deposit' | 'late_fee';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  type: PaymentType;
  amount: number;           // amount paid in this transaction
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  reference: string;
  propertyId: string;
  propertyTitle: string;
  tenantId?: string;
  tenantName?: string;
  landlordId?: string;
  inspectionCreditApplied?: number;
  // Partial rent fields
  rentPeriod?: string;      // e.g. "March 2024"
  isPartial?: boolean;
  receiptUrl?: string;
  createdAt: string;
  paidAt?: string;
}

// ─── Rent Balance (tracks partial payments per month) ────────────────────────
export interface RentBalance {
  id: string;
  propertyId: string;
  propertyTitle: string;
  tenantId: string;
  rentPeriod: string;       // "YYYY-MM"
  totalDue: number;         // full rent for the month
  totalPaid: number;        // sum of all partial payments so far
  balance: number;          // totalDue - totalPaid
  inspectionCredit: number; // credit applied (first month only)
  isFullyPaid: boolean;
  dueDate: string;
  payments: Payment[];      // all partial payments for this period
  lateFeeApplied: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Maintenance ─────────────────────────────────────────────────────────────
export type MaintenancePriority = 'urgent' | 'normal' | 'low';
export type MaintenanceStatus = 'submitted' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export interface MaintenanceRequest {
  id: string;
  propertyId: string;
  propertyTitle: string;
  tenantId: string;
  tenantName: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  photos: string[];
  vendorId?: string;
  vendorName?: string;
  estimatedCost?: number;
  actualCost?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ─── Payout ──────────────────────────────────────────────────────────────────
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Payout {
  id: string;
  landlordId: string;
  landlordName: string;
  propertyId: string;
  propertyTitle: string;
  grossRent: number;
  managementFee: number;
  itabFee: number;
  netAmount: number;
  status: PayoutStatus;
  method: PaymentMethod;
  reference?: string;
  scheduledDate: string;
  processedAt?: string;
  retryCount: number;
}

// ─── Message ─────────────────────────────────────────────────────────────────
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participants: { id: string; name: string; avatar?: string; role: UserRole }[];
  propertyId?: string;
  propertyTitle?: string;
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

// ─── Notification ────────────────────────────────────────────────────────────
export type NotificationType = 'payment' | 'inspection' | 'maintenance' | 'payout' | 'message' | 'system' | 'alert';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────
export interface DashboardStats {
  totalProperties: number;
  vacantProperties: number;
  occupiedProperties: number;
  totalTenants: number;
  pendingMaintenance: number;
  monthlyRevenue: number;
  pendingPayouts: number;
  inspectionFeeRevenue: number;
  conversionRate: number;
}

// ─── Vendor (full account with skills, jobs, ratings) ────────────────────────
export type VendorCategory = 'plumber' | 'electrician' | 'cleaner' | 'mason' | 'gardener' | 'garbage_collector' | 'security' | 'painter' | 'carpenter' | 'welder' | 'other';

export interface Vendor {
  id: string;
  userId?: string;          // linked user account (role: 'vendor')
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar?: string;
  category: VendorCategory;
  skills: string[];         // e.g. ['pipe fitting', 'drain unblocking', 'tap repair']
  bio?: string;
  district: string;
  address?: string;
  rating: number;           // 0–5 average
  totalRatings: number;
  totalJobs: number;
  completedJobs: number;
  isActive: boolean;
  isVerified: boolean;
  isSuspended: boolean;
  dailyRate?: number;       // UGX per day
  hourlyRate?: number;      // UGX per hour
  availability: 'available' | 'busy' | 'unavailable';
  joinedAt: string;
  lastActiveAt?: string;
}

export interface VendorJob {
  id: string;
  vendorId: string;
  vendorName: string;
  maintenanceRequestId: string;
  propertyTitle: string;
  propertyAddress: string;
  title: string;
  description: string;
  status: 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  scheduledDate?: string;
  completedDate?: string;
  estimatedCost?: number;
  actualCost?: number;
  managerNotes?: string;
  vendorNotes?: string;
  rating?: number;
  ratingComment?: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VendorRating {
  id: string;
  vendorId: string;
  jobId: string;
  ratedBy: string;
  ratedByName: string;
  rating: number;           // 1–5
  comment: string;
  createdAt: string;
}

// ─── Tenant Notice (eviction, warnings, announcements from manager/landlord) ──
export type NoticeType =
  | 'eviction'          // formal eviction notice
  | 'rent_arrears'      // overdue rent warning
  | 'lease_renewal'     // lease renewal offer
  | 'lease_termination' // landlord ending the lease
  | 'inspection_notice' // scheduled property inspection
  | 'maintenance_notice'// planned maintenance work
  | 'rent_increase'     // rent increase notification
  | 'general';          // general communication

export type NoticeStatus = 'unread' | 'read' | 'acknowledged' | 'disputed';

export interface TenantNotice {
  id: string;
  propertyId: string;
  propertyTitle: string;
  tenantId: string;
  tenantName: string;
  issuedBy: string;         // manager or landlord name
  issuedByRole: 'property_manager' | 'landlord' | 'admin';
  type: NoticeType;
  subject: string;
  body: string;
  effectiveDate?: string;   // e.g. eviction date, rent increase date
  responseDeadline?: string;
  status: NoticeStatus;
  requiresAcknowledgement: boolean;
  attachmentUrl?: string;
  tenantResponse?: string;
  createdAt: string;
  readAt?: string;
  acknowledgedAt?: string;
}

// ─── Payment method preference (per user/vendor) ─────────────────────────────
export interface PaymentPreference {
  userId: string;           // user or vendor ID
  userType: 'user' | 'vendor';
  preferredMethod: PaymentMethod | 'bank';
  mtnPhone?: string;
  airtelPhone?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  updatedAt: string;
}

// ─── Platform transaction (full audit trail: sender → receiver) ───────────────
export type TransactionType =
  | 'rent_payment'          // tenant → escrow
  | 'inspection_fee'        // tenant → escrow
  | 'deposit_payment'       // tenant → escrow
  | 'landlord_payout'       // escrow → landlord (net rent)
  | 'management_fee_payout' // escrow → property manager
  | 'platform_fee'          // escrow → ITAB (on every transaction)
  | 'vendor_payment'        // escrow/manager → vendor (job completion)
  | 'vendor_contract'       // recurring contract payment → vendor
  | 'late_fee'              // tenant → escrow
  | 'refund';               // escrow → tenant

export interface PlatformTransaction {
  id: string;
  type: TransactionType;
  // Sender
  senderId: string;
  senderName: string;
  senderRole: UserRole | 'platform';
  senderMethod: PaymentMethod | 'bank' | 'escrow';
  senderPhone?: string;
  // Receiver
  receiverId: string;
  receiverName: string;
  receiverRole: UserRole | 'platform';
  receiverMethod: PaymentMethod | 'bank' | 'escrow';
  receiverPhone?: string;
  receiverBankDetails?: { bankName: string; accountNumber: string; accountName: string };
  // Transaction details
  amount: number;
  currency: string;
  reference: string;
  status: PaymentStatus;
  propertyId?: string;
  propertyTitle?: string;
  jobId?: string;           // for vendor payments
  contractId?: string;      // for contract payments
  description: string;
  inspectionCreditApplied?: number;
  rentPeriod?: string;
  isPartial?: boolean;
  receiptUrl?: string;
  createdAt: string;
  processedAt?: string;
  failureReason?: string;
}

// ─── Vendor contract (retainer / recurring) ───────────────────────────────────
export type ContractType = 'monthly_retainer' | 'per_job' | 'annual';
export type ContractStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface VendorContract {
  id: string;
  vendorId: string;
  vendorName: string;
  propertyId: string;
  propertyTitle: string;
  managerId: string;
  type: ContractType;
  description: string;
  amount: number;           // per period or per job
  currency: string;
  startDate: string;
  endDate?: string;
  status: ContractStatus;
  paymentMethod: PaymentMethod | 'bank';
  nextPaymentDate?: string;
  totalPaid: number;
  paymentsCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Multi-month advance payment ─────────────────────────────────────────────
export interface AdvancePayment {
  id: string;
  propertyId: string;
  propertyTitle: string;
  tenantId: string;
  monthsCount: number;
  monthsCovered: string[];
  totalAmount: number;
  discountApplied: number;
  method: PaymentMethod;
  reference: string;
  status: PaymentStatus;
  createdAt: string;
  paidAt?: string;
}
export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entity: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
}

// ─── API Response ────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

// ─── Dispute ─────────────────────────────────────────────────────────────────
export type DisputeType =
  | 'management_fee'
  | 'payout_amount'
  | 'property_condition'
  | 'lease_terms'
  | 'payment_dispute'
  | 'harassment'
  | 'fraud'
  | 'other';

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';

export interface Dispute {
  id: string;
  type: DisputeType;
  status: DisputeStatus;
  raisedById: string;
  raisedByName: string;
  raisedByRole: string;
  againstId?: string;
  againstName?: string;
  againstRole?: string;
  propertyId?: string;
  propertyTitle?: string;
  transactionId?: string;
  subject: string;
  description: string;
  evidence?: string;        // description of evidence
  amount?: number;
  resolution?: string;
  resolvedById?: string;
  resolvedByName?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}
