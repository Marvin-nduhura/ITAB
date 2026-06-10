/**
 * Effective permissions per user — mirrors itab-frontend/src/lib/defaultPermissions.ts.
 * Keep in sync when role defaults change. Used for server-side enforcement (per-user overrides in DB).
 */

function clonePermissions(p) {
  return JSON.parse(JSON.stringify(p));
}

function none() {
  return {
    properties: {
      viewProperties: false, viewPropertyDetails: false, addProperty: false, editProperty: false, deleteProperty: false,
      publishProperty: false, submitForVetting: false, featureProperty: false, uploadPropertyPhotos: false,
      viewPropertyMap: false, shareProperty: false, addToFavorites: false, claimUnassignedProperty: false, assignPropertyToManager: false,
    },
    inspections: {
      viewInspections: false, bookInspection: false, payInspectionFee: false, confirmInspection: false, cancelInspection: false,
      rescheduleInspection: false, markInspectionNoShow: false, markInspectionCompleted: false, declineLeaseAfterInspection: false,
      downloadInspectionReceipt: false, viewInspectionQRCode: false,
    },
    payments: {
      viewOwnPayments: false, viewAllPayments: false, payRentFull: false, payRentPartial: false, payRentAdvance: false,
      downloadReceipt: false, exportPaymentsCSV: false, viewDepositStatus: false, viewRentBalance: false,
    },
    payouts: {
      viewOwnPayouts: false, viewAllPayouts: false, processPayout: false, retryFailedPayout: false,
      downloadPayoutStatement: false, exportPayoutReport: false,
    },
    maintenance: {
      viewOwnMaintenance: false, viewAllMaintenance: false, submitMaintenanceRequest: false, uploadMaintenancePhotos: false,
      assignVendorToJob: false, markMaintenanceInProgress: false, markMaintenanceCompleted: false, cancelMaintenanceRequest: false,
      revertMaintenanceStatus: false, reopenMaintenanceRequest: false, rateVendorAfterJob: false, viewVendorContactInfo: false,
    },
    messages: { viewMessages: false, sendMessage: false, deleteMessage: false, searchConversations: false },
    notices: { viewNotices: false, sendNotice: false, acknowledgeNotice: false, disputeNotice: false, deleteNotice: false },
    documents: {
      viewOwnDocuments: false, viewAllDocuments: false, uploadDocument: false, downloadDocument: false, deleteDocument: false,
      approveKYCDocument: false, rejectKYCDocument: false, requestDocumentChanges: false,
    },
    vendors: {
      viewVendors: false, addVendor: false, editVendor: false, suspendVendor: false, verifyVendor: false,
      viewVendorRatings: false, viewVendorJobHistory: false,
    },
    contracts: {
      viewContracts: false, createContract: false, editContract: false, pauseContract: false, cancelContract: false, processContractPayment: false,
    },
    transactions: {
      viewOwnTransactions: false, viewAllTransactions: false, retryFailedTransaction: false, refundTransaction: false, exportTransactionsCSV: false,
    },
    userManagement: {
      viewUsers: false, inviteUser: false, suspendUser: false, banUser: false, unsuspendUser: false, changeUserRole: false,
      editUserPermissions: false, setDistrictRestrictions: false, approveUserApplication: false, rejectUserApplication: false,
      approveKYC: false, rejectKYC: false, addAdminNotes: false,
    },
    analytics: {
      viewBasicAnalytics: false, viewPlatformRevenue: false, viewTransactionVolume: false, viewUserStats: false,
      viewDisputeStats: false, viewTopProperties: false,
    },
    admin: {
      viewVettingQueue: false, approveProperty: false, rejectProperty: false, viewUnassignedProperties: false, configureFees: false,
      configureCompanyAccounts: false, viewDisputes: false, resolveDispute: false, dismissDispute: false, sendAnnouncement: false,
      viewAuditLogs: false, viewAgentApplications: false, approveAgentApplication: false, rejectAgentApplication: false,
      exportAuditLogs: false, manageApiKeys: false,
    },
    settings: {
      editProfile: false, changePassword: false, setPaymentMethod: false, manageNotificationPreferences: false, changeTheme: false,
    },
    disputes: { raiseDispute: false, viewOwnDisputes: false, viewAllDisputes: false, resolveDispute: false, dismissDispute: false },
  };
}

function adminPerms() {
  const p = none();
  for (const s of Object.keys(p)) {
    for (const k of Object.keys(p[s])) p[s][k] = true;
  }
  return p;
}

function managerPerms() {
  const p = none();
  p.properties = { viewProperties: true, viewPropertyDetails: true, addProperty: true, editProperty: true, deleteProperty: false, publishProperty: true, submitForVetting: true, featureProperty: true, uploadPropertyPhotos: true, viewPropertyMap: true, shareProperty: true, addToFavorites: false, claimUnassignedProperty: false, assignPropertyToManager: false };
  p.inspections = { viewInspections: true, bookInspection: false, payInspectionFee: false, confirmInspection: true, cancelInspection: true, rescheduleInspection: true, markInspectionNoShow: true, markInspectionCompleted: true, declineLeaseAfterInspection: false, downloadInspectionReceipt: true, viewInspectionQRCode: true };
  p.payments = { viewOwnPayments: true, viewAllPayments: true, payRentFull: false, payRentPartial: false, payRentAdvance: false, downloadReceipt: true, exportPaymentsCSV: true, viewDepositStatus: true, viewRentBalance: true };
  p.payouts = { viewOwnPayouts: true, viewAllPayouts: true, processPayout: true, retryFailedPayout: true, downloadPayoutStatement: true, exportPayoutReport: true };
  p.maintenance = { viewOwnMaintenance: true, viewAllMaintenance: true, submitMaintenanceRequest: true, uploadMaintenancePhotos: true, assignVendorToJob: true, markMaintenanceInProgress: true, markMaintenanceCompleted: true, cancelMaintenanceRequest: true, revertMaintenanceStatus: true, reopenMaintenanceRequest: true, rateVendorAfterJob: false, viewVendorContactInfo: true };
  p.messages = { viewMessages: true, sendMessage: true, deleteMessage: false, searchConversations: true };
  p.notices = { viewNotices: true, sendNotice: true, acknowledgeNotice: false, disputeNotice: false, deleteNotice: true };
  p.documents = { viewOwnDocuments: true, viewAllDocuments: false, uploadDocument: true, downloadDocument: true, deleteDocument: false, approveKYCDocument: false, rejectKYCDocument: false, requestDocumentChanges: false };
  p.vendors = { viewVendors: true, addVendor: false, editVendor: false, suspendVendor: false, verifyVendor: false, viewVendorRatings: true, viewVendorJobHistory: true };
  p.contracts = { viewContracts: true, createContract: true, editContract: true, pauseContract: true, cancelContract: true, processContractPayment: true };
  p.transactions = { viewOwnTransactions: true, viewAllTransactions: false, retryFailedTransaction: false, refundTransaction: false, exportTransactionsCSV: true };
  p.userManagement = { viewUsers: false, inviteUser: false, suspendUser: false, banUser: false, unsuspendUser: false, changeUserRole: false, editUserPermissions: false, setDistrictRestrictions: false, approveUserApplication: false, rejectUserApplication: false, approveKYC: false, rejectKYC: false, addAdminNotes: false };
  p.analytics = { viewBasicAnalytics: true, viewPlatformRevenue: false, viewTransactionVolume: false, viewUserStats: false, viewDisputeStats: false, viewTopProperties: true };
  p.admin = { viewVettingQueue: true, approveProperty: true, rejectProperty: true, viewUnassignedProperties: false, configureFees: false, configureCompanyAccounts: false, viewDisputes: false, resolveDispute: false, dismissDispute: false, sendAnnouncement: false, viewAuditLogs: false, viewAgentApplications: false, approveAgentApplication: false, rejectAgentApplication: false, exportAuditLogs: false, manageApiKeys: false };
  p.settings = { editProfile: true, changePassword: true, setPaymentMethod: true, manageNotificationPreferences: true, changeTheme: true };
  p.disputes = { raiseDispute: true, viewOwnDisputes: true, viewAllDisputes: false, resolveDispute: false, dismissDispute: false };
  return p;
}

function landlordPerms() {
  const p = none();
  p.properties = { viewProperties: true, viewPropertyDetails: true, addProperty: true, editProperty: true, deleteProperty: false, publishProperty: false, submitForVetting: true, featureProperty: false, uploadPropertyPhotos: true, viewPropertyMap: true, shareProperty: true, addToFavorites: false, claimUnassignedProperty: false, assignPropertyToManager: false };
  p.inspections = { viewInspections: true, bookInspection: false, payInspectionFee: false, confirmInspection: false, cancelInspection: false, rescheduleInspection: false, markInspectionNoShow: false, markInspectionCompleted: false, declineLeaseAfterInspection: false, downloadInspectionReceipt: false, viewInspectionQRCode: false };
  p.payments = { viewOwnPayments: true, viewAllPayments: false, payRentFull: false, payRentPartial: false, payRentAdvance: false, downloadReceipt: true, exportPaymentsCSV: false, viewDepositStatus: true, viewRentBalance: false };
  p.payouts = { viewOwnPayouts: true, viewAllPayouts: false, processPayout: false, retryFailedPayout: false, downloadPayoutStatement: true, exportPayoutReport: false };
  p.maintenance = { viewOwnMaintenance: true, viewAllMaintenance: true, submitMaintenanceRequest: true, uploadMaintenancePhotos: true, assignVendorToJob: true, markMaintenanceInProgress: true, markMaintenanceCompleted: true, cancelMaintenanceRequest: true, revertMaintenanceStatus: true, reopenMaintenanceRequest: true, rateVendorAfterJob: false, viewVendorContactInfo: true };
  p.messages = { viewMessages: true, sendMessage: true, deleteMessage: false, searchConversations: true };
  p.notices = { viewNotices: true, sendNotice: true, acknowledgeNotice: false, disputeNotice: false, deleteNotice: false };
  p.documents = { viewOwnDocuments: true, viewAllDocuments: false, uploadDocument: true, downloadDocument: true, deleteDocument: false, approveKYCDocument: false, rejectKYCDocument: false, requestDocumentChanges: false };
  p.vendors = { viewVendors: true, addVendor: false, editVendor: false, suspendVendor: false, verifyVendor: false, viewVendorRatings: true, viewVendorJobHistory: false };
  p.contracts = { viewContracts: false, createContract: false, editContract: false, pauseContract: false, cancelContract: false, processContractPayment: false };
  p.transactions = { viewOwnTransactions: true, viewAllTransactions: false, retryFailedTransaction: false, refundTransaction: false, exportTransactionsCSV: false };
  p.analytics = { viewBasicAnalytics: true, viewPlatformRevenue: false, viewTransactionVolume: false, viewUserStats: false, viewDisputeStats: false, viewTopProperties: false };
  p.settings = { editProfile: true, changePassword: true, setPaymentMethod: true, manageNotificationPreferences: true, changeTheme: true };
  p.disputes = { raiseDispute: true, viewOwnDisputes: true, viewAllDisputes: false, resolveDispute: false, dismissDispute: false };
  return p;
}

function tenantPerms() {
  const p = none();
  p.properties = { viewProperties: true, viewPropertyDetails: true, addProperty: false, editProperty: false, deleteProperty: false, publishProperty: false, submitForVetting: false, featureProperty: false, uploadPropertyPhotos: false, viewPropertyMap: true, shareProperty: true, addToFavorites: true, claimUnassignedProperty: false, assignPropertyToManager: false };
  p.inspections = { viewInspections: true, bookInspection: true, payInspectionFee: true, confirmInspection: false, cancelInspection: false, rescheduleInspection: false, markInspectionNoShow: false, markInspectionCompleted: false, declineLeaseAfterInspection: true, downloadInspectionReceipt: true, viewInspectionQRCode: true };
  p.payments = { viewOwnPayments: true, viewAllPayments: false, payRentFull: true, payRentPartial: true, payRentAdvance: true, downloadReceipt: true, exportPaymentsCSV: false, viewDepositStatus: true, viewRentBalance: true };
  p.payouts = { viewOwnPayouts: false, viewAllPayouts: false, processPayout: false, retryFailedPayout: false, downloadPayoutStatement: false, exportPayoutReport: false };
  p.maintenance = { viewOwnMaintenance: true, viewAllMaintenance: false, submitMaintenanceRequest: true, uploadMaintenancePhotos: true, assignVendorToJob: false, markMaintenanceInProgress: false, markMaintenanceCompleted: false, cancelMaintenanceRequest: false, revertMaintenanceStatus: false, reopenMaintenanceRequest: false, rateVendorAfterJob: true, viewVendorContactInfo: false };
  p.messages = { viewMessages: true, sendMessage: true, deleteMessage: false, searchConversations: true };
  p.notices = { viewNotices: true, sendNotice: false, acknowledgeNotice: true, disputeNotice: true, deleteNotice: false };
  p.documents = { viewOwnDocuments: true, viewAllDocuments: false, uploadDocument: true, downloadDocument: true, deleteDocument: false, approveKYCDocument: false, rejectKYCDocument: false, requestDocumentChanges: false };
  p.transactions = { viewOwnTransactions: true, viewAllTransactions: false, retryFailedTransaction: false, refundTransaction: false, exportTransactionsCSV: false };
  p.settings = { editProfile: true, changePassword: true, setPaymentMethod: true, manageNotificationPreferences: true, changeTheme: true };
  p.disputes = { raiseDispute: true, viewOwnDisputes: true, viewAllDisputes: false, resolveDispute: false, dismissDispute: false };
  return p;
}

function agentPerms() {
  const p = none();
  p.properties = { viewProperties: true, viewPropertyDetails: true, addProperty: true, editProperty: true, deleteProperty: false, publishProperty: false, submitForVetting: true, featureProperty: false, uploadPropertyPhotos: true, viewPropertyMap: true, shareProperty: true, addToFavorites: true, claimUnassignedProperty: true, assignPropertyToManager: false };
  p.inspections = { viewInspections: true, bookInspection: false, payInspectionFee: false, confirmInspection: true, cancelInspection: true, rescheduleInspection: true, markInspectionNoShow: true, markInspectionCompleted: true, declineLeaseAfterInspection: false, downloadInspectionReceipt: true, viewInspectionQRCode: true };
  p.payments = { viewOwnPayments: false, viewAllPayments: false, payRentFull: false, payRentPartial: false, payRentAdvance: false, downloadReceipt: false, exportPaymentsCSV: false, viewDepositStatus: false, viewRentBalance: false };
  p.messages = { viewMessages: true, sendMessage: true, deleteMessage: false, searchConversations: true };
  p.documents = { viewOwnDocuments: true, viewAllDocuments: false, uploadDocument: true, downloadDocument: true, deleteDocument: false, approveKYCDocument: false, rejectKYCDocument: false, requestDocumentChanges: false };
  p.transactions = { viewOwnTransactions: true, viewAllTransactions: false, retryFailedTransaction: false, refundTransaction: false, exportTransactionsCSV: false };
  p.settings = { editProfile: true, changePassword: true, setPaymentMethod: true, manageNotificationPreferences: true, changeTheme: true };
  p.disputes = { raiseDispute: true, viewOwnDisputes: true, viewAllDisputes: false, resolveDispute: false, dismissDispute: false };
  return p;
}

function vendorPerms() {
  const p = none();
  p.properties = { ...none().properties, viewProperties: true, viewPropertyDetails: true, viewPropertyMap: true };
  p.maintenance = { viewOwnMaintenance: true, viewAllMaintenance: false, submitMaintenanceRequest: false, uploadMaintenancePhotos: true, assignVendorToJob: false, markMaintenanceInProgress: true, markMaintenanceCompleted: true, cancelMaintenanceRequest: false, revertMaintenanceStatus: false, reopenMaintenanceRequest: false, rateVendorAfterJob: false, viewVendorContactInfo: true };
  p.messages = { viewMessages: true, sendMessage: true, deleteMessage: false, searchConversations: true };
  p.documents = { viewOwnDocuments: true, viewAllDocuments: false, uploadDocument: true, downloadDocument: true, deleteDocument: false, approveKYCDocument: false, rejectKYCDocument: false, requestDocumentChanges: false };
  p.vendors = { viewVendors: true, addVendor: false, editVendor: false, suspendVendor: false, verifyVendor: false, viewVendorRatings: true, viewVendorJobHistory: true };
  p.transactions = { viewOwnTransactions: true, viewAllTransactions: false, retryFailedTransaction: false, refundTransaction: false, exportTransactionsCSV: false };
  p.contracts = { viewContracts: true, createContract: false, editContract: false, pauseContract: false, cancelContract: false, processContractPayment: false };
  p.settings = { editProfile: true, changePassword: true, setPaymentMethod: true, manageNotificationPreferences: true, changeTheme: true };
  p.disputes = { raiseDispute: true, viewOwnDisputes: true, viewAllDisputes: false, resolveDispute: false, dismissDispute: false };
  return p;
}

const DEFAULT_PERMISSIONS = {
  admin: adminPerms(),
  property_manager: managerPerms(),
  landlord: landlordPerms(),
  tenant: tenantPerms(),
  agent: agentPerms(),
  vendor: vendorPerms(),
  guest: none(),
};

function parseStoredPermissions(raw) {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      if (typeof p === 'object' && p !== null && !Array.isArray(p)) return p;
    } catch {
      return undefined;
    }
    return undefined;
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return undefined;
}

function getPendingVerificationPermissions() {
  const p = none();
  p.properties = {
    ...p.properties,
    viewProperties: true,
    viewPropertyDetails: true,
    viewPropertyMap: true,
    shareProperty: true,
    addToFavorites: true,
  };
  p.messages = { viewMessages: true, sendMessage: true, deleteMessage: false, searchConversations: true };
  p.documents = {
    ...p.documents,
    viewOwnDocuments: true,
    uploadDocument: true,
    downloadDocument: true,
  };
  p.notices = {
    ...p.notices,
    viewNotices: true,
    sendNotice: false,
    acknowledgeNotice: false,
    disputeNotice: false,
    deleteNotice: false,
  };
  p.settings = {
    ...p.settings,
    editProfile: false,
    changePassword: false,
    setPaymentMethod: false,
    manageNotificationPreferences: false,
    changeTheme: true,
  };
  return p;
}

function resolvePermissions(role, overrides) {
  const base = clonePermissions(DEFAULT_PERMISSIONS[role] || none());
  const ov = parseStoredPermissions(overrides);
  if (!ov) return base;
  const merged = { ...base };
  for (const section of Object.keys(ov)) {
    if (merged[section] && ov[section] && typeof ov[section] === 'object') {
      merged[section] = { ...merged[section], ...ov[section] };
    }
  }
  const baseKeys = Object.keys(base);
  for (const section of baseKeys) {
    const b = base[section];
    const m = merged[section];
    if (!b || !m) continue;
    for (const k of Object.keys(b)) {
      if (!(k in m) || typeof m[k] !== 'boolean') m[k] = b[k];
    }
  }
  return merged;
}

const VETTING_ROLES = new Set(['landlord', 'agent', 'property_manager']);

function isAwaitingApproval(row) {
  if (!row || row.role === 'admin') return false;
  const s = row.approval_status;
  if (VETTING_ROLES.has(row.role)) return s !== 'approved';
  return s === 'pending';
}

function getEffectivePermissions(row) {
  // Admin always gets the full all-true permission set — never penalised by a stale/partial DB override.
  if (row && row.role === 'admin') return adminPerms();
  if (isAwaitingApproval(row)) return getPendingVerificationPermissions();
  return resolvePermissions(row.role, row.permissions);
}

function hasPermission(perms, section, key) {
  const sec = perms && perms[section];
  return !!(sec && sec[key]);
}

module.exports = {
  getEffectivePermissions,
  hasPermission,
  resolvePermissions,
  parseStoredPermissions,
  isAwaitingApproval,
  none,
  DEFAULT_PERMISSIONS,
};
