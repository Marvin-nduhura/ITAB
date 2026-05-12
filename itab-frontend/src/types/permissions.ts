/**
 * Comprehensive permission system covering every action in ITAB.
 * Each permission maps to a specific CRUD operation on a specific resource.
 * Admin can override any permission for any individual user.
 */

// ─── Properties ───────────────────────────────────────────────────────────────
export interface PropertyPermissions {
  viewProperties: boolean;          // see the properties list
  viewPropertyDetails: boolean;     // open a property detail page
  addProperty: boolean;             // create a new property listing
  editProperty: boolean;            // edit an existing property
  deleteProperty: boolean;          // delete / archive a property
  publishProperty: boolean;         // change status to published
  submitForVetting: boolean;        // submit draft for admin/manager review
  featureProperty: boolean;         // mark a property as featured
  uploadPropertyPhotos: boolean;    // upload photos to a property
  viewPropertyMap: boolean;         // see the map/location tab
  shareProperty: boolean;           // share a property link
  addToFavorites: boolean;          // save a property to favourites
  claimUnassignedProperty: boolean; // agent claims from unassigned pool
  assignPropertyToManager: boolean; // admin assigns property to a manager
}

// ─── Inspections ──────────────────────────────────────────────────────────────
export interface InspectionPermissions {
  viewInspections: boolean;         // see the inspections list
  bookInspection: boolean;          // tenant books an inspection
  payInspectionFee: boolean;        // pay the inspection fee
  confirmInspection: boolean;       // manager confirms a booking
  cancelInspection: boolean;        // cancel an inspection
  rescheduleInspection: boolean;    // reschedule an inspection
  markInspectionNoShow: boolean;    // mark tenant as no-show
  markInspectionCompleted: boolean; // mark inspection as done
  declineLeaseAfterInspection: boolean; // tenant declines the property
  downloadInspectionReceipt: boolean;   // download receipt
  viewInspectionQRCode: boolean;    // view QR code for entry
}

// ─── Payments & Rent ──────────────────────────────────────────────────────────
export interface PaymentPermissions {
  viewOwnPayments: boolean;         // see own payment history
  viewAllPayments: boolean;         // admin/manager sees all payments
  payRentFull: boolean;             // pay full month rent
  payRentPartial: boolean;          // pay partial rent
  payRentAdvance: boolean;          // pay multiple months in advance
  downloadReceipt: boolean;         // download payment receipt
  exportPaymentsCSV: boolean;       // export payments to CSV
  viewDepositStatus: boolean;       // see security deposit info
  viewRentBalance: boolean;         // see rent balance tracker
}

// ─── Payouts ──────────────────────────────────────────────────────────────────
export interface PayoutPermissions {
  viewOwnPayouts: boolean;          // landlord sees their payouts
  viewAllPayouts: boolean;          // admin/manager sees all payouts
  processPayout: boolean;           // trigger a payout
  retryFailedPayout: boolean;       // retry a failed payout
  downloadPayoutStatement: boolean; // download financial statement
  exportPayoutReport: boolean;      // export payout CSV
}

// ─── Maintenance ──────────────────────────────────────────────────────────────
export interface MaintenancePermissions {
  viewOwnMaintenance: boolean;      // tenant sees their own requests
  viewAllMaintenance: boolean;      // manager/admin sees all requests
  submitMaintenanceRequest: boolean;// create a new request
  uploadMaintenancePhotos: boolean; // attach photos to a request
  assignVendorToJob: boolean;       // assign a vendor
  markMaintenanceInProgress: boolean;
  markMaintenanceCompleted: boolean;
  cancelMaintenanceRequest: boolean;
  revertMaintenanceStatus: boolean; // undo a status change
  reopenMaintenanceRequest: boolean;
  rateVendorAfterJob: boolean;      // leave a star rating
  viewVendorContactInfo: boolean;   // see vendor phone number
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export interface MessagePermissions {
  viewMessages: boolean;
  sendMessage: boolean;
  deleteMessage: boolean;
  searchConversations: boolean;
}

// ─── Notices ──────────────────────────────────────────────────────────────────
export interface NoticePermissions {
  viewNotices: boolean;             // see notices sent to you
  sendNotice: boolean;              // send a notice to a tenant
  acknowledgeNotice: boolean;       // tenant acknowledges a notice
  disputeNotice: boolean;           // tenant disputes a notice
  deleteNotice: boolean;            // delete a sent notice
}

// ─── Documents ────────────────────────────────────────────────────────────────
export interface DocumentPermissions {
  viewOwnDocuments: boolean;
  viewAllDocuments: boolean;        // admin sees all
  uploadDocument: boolean;
  downloadDocument: boolean;
  deleteDocument: boolean;
  approveKYCDocument: boolean;      // admin approves KYC
  rejectKYCDocument: boolean;
  requestDocumentChanges: boolean;
}

// ─── Vendors ──────────────────────────────────────────────────────────────────
export interface VendorPermissions {
  viewVendors: boolean;
  addVendor: boolean;
  editVendor: boolean;
  suspendVendor: boolean;
  verifyVendor: boolean;
  viewVendorRatings: boolean;
  viewVendorJobHistory: boolean;
}

// ─── Vendor Contracts ─────────────────────────────────────────────────────────
export interface ContractPermissions {
  viewContracts: boolean;
  createContract: boolean;
  editContract: boolean;
  pauseContract: boolean;
  cancelContract: boolean;
  processContractPayment: boolean;
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export interface TransactionPermissions {
  viewOwnTransactions: boolean;
  viewAllTransactions: boolean;
  retryFailedTransaction: boolean;
  refundTransaction: boolean;
  exportTransactionsCSV: boolean;
}

// ─── Users (Admin) ────────────────────────────────────────────────────────────
export interface UserManagementPermissions {
  viewUsers: boolean;
  inviteUser: boolean;
  suspendUser: boolean;
  banUser: boolean;
  unsuspendUser: boolean;
  changeUserRole: boolean;
  editUserPermissions: boolean;
  setDistrictRestrictions: boolean;
  approveUserApplication: boolean;
  rejectUserApplication: boolean;
  approveKYC: boolean;
  rejectKYC: boolean;
  addAdminNotes: boolean;
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface AnalyticsPermissions {
  viewBasicAnalytics: boolean;      // occupancy, conversion, inspection revenue
  viewPlatformRevenue: boolean;     // admin-only platform fee revenue
  viewTransactionVolume: boolean;
  viewUserStats: boolean;
  viewDisputeStats: boolean;
  viewTopProperties: boolean;
}

// ─── Admin Functions ──────────────────────────────────────────────────────────
export interface AdminPermissions {
  viewVettingQueue: boolean;
  approveProperty: boolean;
  rejectProperty: boolean;
  viewUnassignedProperties: boolean;
  configureFees: boolean;
  configureCompanyAccounts: boolean;
  viewDisputes: boolean;
  resolveDispute: boolean;
  dismissDispute: boolean;
  sendAnnouncement: boolean;
  viewAuditLogs: boolean;
  viewAgentApplications: boolean;
  approveAgentApplication: boolean;
  rejectAgentApplication: boolean;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export interface SettingsPermissions {
  editProfile: boolean;
  changePassword: boolean;
  setPaymentMethod: boolean;
  manageNotificationPreferences: boolean;
  changeTheme: boolean;
}

// ─── Disputes ─────────────────────────────────────────────────────────────────
export interface DisputePermissions {
  raiseDispute: boolean;
  viewOwnDisputes: boolean;
  viewAllDisputes: boolean;
  resolveDispute: boolean;
  dismissDispute: boolean;
}

// ─── Full permissions object ──────────────────────────────────────────────────
export interface FullUserPermissions {
  properties: PropertyPermissions;
  inspections: InspectionPermissions;
  payments: PaymentPermissions;
  payouts: PayoutPermissions;
  maintenance: MaintenancePermissions;
  messages: MessagePermissions;
  notices: NoticePermissions;
  documents: DocumentPermissions;
  vendors: VendorPermissions;
  contracts: ContractPermissions;
  transactions: TransactionPermissions;
  userManagement: UserManagementPermissions;
  analytics: AnalyticsPermissions;
  admin: AdminPermissions;
  settings: SettingsPermissions;
  disputes: DisputePermissions;
}

// ─── Human-readable labels for the admin UI ───────────────────────────────────
export const PERMISSION_LABELS: Record<string, Record<string, string>> = {
  properties: {
    viewProperties:           'View properties list',
    viewPropertyDetails:      'View property details',
    addProperty:              'Add new property',
    editProperty:             'Edit property',
    deleteProperty:           'Delete property',
    publishProperty:          'Publish / unpublish property',
    submitForVetting:         'Submit property for vetting',
    featureProperty:          'Mark property as featured',
    uploadPropertyPhotos:     'Upload property photos',
    viewPropertyMap:          'View property on map',
    shareProperty:            'Share property link',
    addToFavorites:           'Save to favourites',
    claimUnassignedProperty:  'Claim unassigned property',
    assignPropertyToManager:  'Assign property to manager',
  },
  inspections: {
    viewInspections:              'View inspections',
    bookInspection:               'Book an inspection',
    payInspectionFee:             'Pay inspection fee',
    confirmInspection:            'Confirm inspection booking',
    cancelInspection:             'Cancel inspection',
    rescheduleInspection:         'Reschedule inspection',
    markInspectionNoShow:         'Mark tenant as no-show',
    markInspectionCompleted:      'Mark inspection as completed',
    declineLeaseAfterInspection:  'Decline lease after inspection',
    downloadInspectionReceipt:    'Download inspection receipt',
    viewInspectionQRCode:         'View inspection QR code',
  },
  payments: {
    viewOwnPayments:    'View own payment history',
    viewAllPayments:    'View all payments (platform-wide)',
    payRentFull:        'Pay full rent',
    payRentPartial:     'Pay partial rent',
    payRentAdvance:     'Pay rent in advance',
    downloadReceipt:    'Download payment receipt',
    exportPaymentsCSV:  'Export payments to CSV',
    viewDepositStatus:  'View security deposit status',
    viewRentBalance:    'View rent balance tracker',
  },
  payouts: {
    viewOwnPayouts:          'View own payouts',
    viewAllPayouts:          'View all payouts (platform-wide)',
    processPayout:           'Process a payout',
    retryFailedPayout:       'Retry failed payout',
    downloadPayoutStatement: 'Download payout statement',
    exportPayoutReport:      'Export payout report CSV',
  },
  maintenance: {
    viewOwnMaintenance:          'View own maintenance requests',
    viewAllMaintenance:          'View all maintenance requests',
    submitMaintenanceRequest:    'Submit maintenance request',
    uploadMaintenancePhotos:     'Upload photos for maintenance',
    assignVendorToJob:           'Assign vendor to job',
    markMaintenanceInProgress:   'Mark job as in progress',
    markMaintenanceCompleted:    'Mark job as completed',
    cancelMaintenanceRequest:    'Cancel maintenance request',
    revertMaintenanceStatus:     'Revert maintenance status',
    reopenMaintenanceRequest:    'Reopen cancelled request',
    rateVendorAfterJob:          'Rate vendor after job',
    viewVendorContactInfo:       'View vendor contact info',
  },
  messages: {
    viewMessages:         'View messages',
    sendMessage:          'Send messages',
    deleteMessage:        'Delete messages',
    searchConversations:  'Search conversations',
  },
  notices: {
    viewNotices:        'View notices',
    sendNotice:         'Send notice to tenant',
    acknowledgeNotice:  'Acknowledge a notice',
    disputeNotice:      'Dispute a notice',
    deleteNotice:       'Delete a notice',
  },
  documents: {
    viewOwnDocuments:       'View own documents',
    viewAllDocuments:       'View all documents (admin)',
    uploadDocument:         'Upload document',
    downloadDocument:       'Download document',
    deleteDocument:         'Delete document',
    approveKYCDocument:     'Approve KYC document',
    rejectKYCDocument:      'Reject KYC document',
    requestDocumentChanges: 'Request document changes',
  },
  vendors: {
    viewVendors:          'View vendor list',
    addVendor:            'Add new vendor',
    editVendor:           'Edit vendor profile',
    suspendVendor:        'Suspend vendor',
    verifyVendor:         'Verify vendor',
    viewVendorRatings:    'View vendor ratings',
    viewVendorJobHistory: 'View vendor job history',
  },
  contracts: {
    viewContracts:           'View vendor contracts',
    createContract:          'Create vendor contract',
    editContract:            'Edit vendor contract',
    pauseContract:           'Pause contract',
    cancelContract:          'Cancel contract',
    processContractPayment:  'Process contract payment',
  },
  transactions: {
    viewOwnTransactions:    'View own transactions',
    viewAllTransactions:    'View all transactions (platform-wide)',
    retryFailedTransaction: 'Retry failed transaction',
    refundTransaction:      'Refund transaction',
    exportTransactionsCSV:  'Export transactions to CSV',
  },
  userManagement: {
    viewUsers:               'View all users',
    inviteUser:              'Invite new user',
    suspendUser:             'Suspend user account',
    banUser:                 'Permanently ban user',
    unsuspendUser:           'Reactivate suspended user',
    changeUserRole:          'Change user role',
    editUserPermissions:     'Edit user permissions',
    setDistrictRestrictions: 'Set district restrictions',
    approveUserApplication:  'Approve user application',
    rejectUserApplication:   'Reject user application',
    approveKYC:              'Approve KYC',
    rejectKYC:               'Reject KYC',
    addAdminNotes:           'Add admin notes to user',
  },
  analytics: {
    viewBasicAnalytics:     'View basic analytics (occupancy, conversion)',
    viewPlatformRevenue:    'View platform revenue',
    viewTransactionVolume:  'View transaction volume',
    viewUserStats:          'View user statistics',
    viewDisputeStats:       'View dispute statistics',
    viewTopProperties:      'View top properties by views',
  },
  admin: {
    viewVettingQueue:         'View property vetting queue',
    approveProperty:          'Approve property listing',
    rejectProperty:           'Reject property listing',
    viewUnassignedProperties: 'View unassigned properties',
    configureFees:            'Configure platform fees',
    configureCompanyAccounts: 'Configure company accounts',
    viewDisputes:             'View disputes',
    resolveDispute:           'Resolve dispute',
    dismissDispute:           'Dismiss dispute',
    sendAnnouncement:         'Send platform announcement',
    viewAuditLogs:            'View audit logs',
    viewAgentApplications:    'View agent/landlord applications',
    approveAgentApplication:  'Approve agent/landlord application',
    rejectAgentApplication:   'Reject agent/landlord application',
  },
  settings: {
    editProfile:                    'Edit own profile',
    changePassword:                 'Change password',
    setPaymentMethod:               'Set payment method',
    manageNotificationPreferences:  'Manage notification preferences',
    changeTheme:                    'Change app theme',
  },
  disputes: {
    raiseDispute:     'Raise a dispute',
    viewOwnDisputes:  'View own disputes',
    viewAllDisputes:  'View all disputes (admin)',
    resolveDispute:   'Resolve dispute',
    dismissDispute:   'Dismiss dispute',
  },
};

// ─── Section display names ────────────────────────────────────────────────────
export const PERMISSION_SECTIONS: Record<keyof FullUserPermissions, { label: string; icon: string }> = {
  properties:     { label: 'Properties',        icon: '🏠' },
  inspections:    { label: 'Inspections',       icon: '📋' },
  payments:       { label: 'Payments & Rent',   icon: '💳' },
  payouts:        { label: 'Payouts',           icon: '💰' },
  maintenance:    { label: 'Maintenance',       icon: '🔧' },
  messages:       { label: 'Messages',          icon: '💬' },
  notices:        { label: 'Notices',           icon: '📢' },
  documents:      { label: 'Documents',         icon: '📄' },
  vendors:        { label: 'Vendors',           icon: '👷' },
  contracts:      { label: 'Vendor Contracts',  icon: '📝' },
  transactions:   { label: 'Transactions',      icon: '🔄' },
  userManagement: { label: 'User Management',   icon: '👥' },
  analytics:      { label: 'Analytics',         icon: '📊' },
  admin:          { label: 'Admin Functions',   icon: '⚙️' },
  settings:       { label: 'Settings',          icon: '🔩' },
  disputes:       { label: 'Disputes',          icon: '⚖️' },
};
