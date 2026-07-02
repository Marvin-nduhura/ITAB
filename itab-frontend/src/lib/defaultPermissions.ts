import type { FullUserPermissions } from '../types/permissions';

/** Deep clone so we never mutate shared DEFAULT_PERMISSIONS objects. */
function clonePermissions(p: FullUserPermissions): FullUserPermissions {
  return JSON.parse(JSON.stringify(p)) as FullUserPermissions;
}

// ─── Helper: all false ────────────────────────────────────────────────────────
function none(): FullUserPermissions {
  return {
    properties:     { viewProperties: false, viewPropertyDetails: false, addProperty: false, editProperty: false, deleteProperty: false, publishProperty: false, submitForVetting: false, featureProperty: false, uploadPropertyPhotos: false, viewPropertyMap: false, shareProperty: false, addToFavorites: false, claimUnassignedProperty: false, assignPropertyToManager: false },
    inspections:    { viewInspections: false, bookInspection: false, payInspectionFee: false, confirmInspection: false, cancelInspection: false, rescheduleInspection: false, markInspectionNoShow: false, markInspectionCompleted: false, declineLeaseAfterInspection: false, downloadInspectionReceipt: false, viewInspectionQRCode: false },
    payments:       { viewOwnPayments: false, viewAllPayments: false, payRentFull: false, payRentPartial: false, payRentAdvance: false, downloadReceipt: false, exportPaymentsCSV: false, viewDepositStatus: false, viewRentBalance: false },
    payouts:        { viewOwnPayouts: false, viewAllPayouts: false, processPayout: false, retryFailedPayout: false, downloadPayoutStatement: false, exportPayoutReport: false },
    maintenance:    { viewOwnMaintenance: false, viewAllMaintenance: false, submitMaintenanceRequest: false, uploadMaintenancePhotos: false, assignVendorToJob: false, markMaintenanceInProgress: false, markMaintenanceCompleted: false, cancelMaintenanceRequest: false, revertMaintenanceStatus: false, reopenMaintenanceRequest: false, rateVendorAfterJob: false, viewVendorContactInfo: false },
    messages:       { viewMessages: false, sendMessage: false, deleteMessage: false, searchConversations: false },
    notices:        { viewNotices: false, sendNotice: false, acknowledgeNotice: false, disputeNotice: false, deleteNotice: false },
    documents:      { viewOwnDocuments: false, viewAllDocuments: false, uploadDocument: false, downloadDocument: false, deleteDocument: false, approveKYCDocument: false, rejectKYCDocument: false, requestDocumentChanges: false },
    vendors:        { viewVendors: false, addVendor: false, editVendor: false, suspendVendor: false, verifyVendor: false, viewVendorRatings: false, viewVendorJobHistory: false },
    contracts:      { viewContracts: false, createContract: false, editContract: false, pauseContract: false, cancelContract: false, processContractPayment: false },
    transactions:   { viewOwnTransactions: false, viewAllTransactions: false, retryFailedTransaction: false, refundTransaction: false, exportTransactionsCSV: false },
    userManagement: { viewUsers: false, inviteUser: false, suspendUser: false, banUser: false, unsuspendUser: false, changeUserRole: false, editUserPermissions: false, setDistrictRestrictions: false, approveUserApplication: false, rejectUserApplication: false, approveKYC: false, rejectKYC: false, addAdminNotes: false },
    analytics:      { viewBasicAnalytics: false, viewPlatformRevenue: false, viewTransactionVolume: false, viewUserStats: false, viewDisputeStats: false, viewTopProperties: false },
    admin:          { viewVettingQueue: false, approveProperty: false, rejectProperty: false, viewUnassignedProperties: false, configureFees: false, configureCompanyAccounts: false, viewDisputes: false, resolveDispute: false, dismissDispute: false, sendAnnouncement: false, viewAuditLogs: false, viewAgentApplications: false, approveAgentApplication: false, rejectAgentApplication: false, exportAuditLogs: false, manageApiKeys: false },
    settings:       { editProfile: false, changePassword: false, setPaymentMethod: false, manageNotificationPreferences: false, changeTheme: false },
    disputes:       { raiseDispute: false, viewOwnDisputes: false, viewAllDisputes: false, resolveDispute: false, dismissDispute: false },
  };
}

// ─── Admin — everything ───────────────────────────────────────────────────────
function adminPerms(): FullUserPermissions {
  const p = none() as unknown as Record<string, Record<string, boolean>>;
  Object.keys(p).forEach(section => {
    Object.keys(p[section]).forEach(key => { p[section][key] = true; });
  });
  return p as unknown as FullUserPermissions;
}

// ─── Property Manager ─────────────────────────────────────────────────────────
function managerPerms(): FullUserPermissions {
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

// ─── Landlord ─────────────────────────────────────────────────────────────────
function landlordPerms(): FullUserPermissions {
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

// ─── Tenant ───────────────────────────────────────────────────────────────────
function tenantPerms(): FullUserPermissions {
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

// ─── Agent ────────────────────────────────────────────────────────────────────
function agentPerms(): FullUserPermissions {
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

// ─── Vendor ───────────────────────────────────────────────────────────────────
function vendorPerms(): FullUserPermissions {
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

// ─── Exported defaults map ────────────────────────────────────────────────────
export const DEFAULT_PERMISSIONS: Record<string, FullUserPermissions> = {
  admin:            adminPerms(),
  property_manager: managerPerms(),
  landlord:         landlordPerms(),
  tenant:           tenantPerms(),
  agent:            agentPerms(),
  vendor:           vendorPerms(),
  guest:            none(),
};

/**
 * Merge role defaults with any individual overrides stored on the user.
 * Individual overrides take precedence over role defaults.
 */
/** Normalize permissions from API (JSON string, object, or null). */
export function parseStoredPermissions(raw: unknown): Partial<FullUserPermissions> | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      if (typeof p === 'object' && p !== null && !Array.isArray(p)) return p as Partial<FullUserPermissions>;
    } catch {
      return undefined;
    }
    return undefined;
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Partial<FullUserPermissions>;
  return undefined;
}

/**
 * Landlord / agent / property_manager while approval_status is pending:
 * browse listings read-only, use Messages + Documents only (for admin verification).
 * No profile edits, payments, inspections, notices, etc.
 */
export function getPendingVerificationPermissions(): FullUserPermissions {
  const p = none();
  // Read-only listing browse (like a tenant viewing the market)
  p.properties = {
    ...p.properties,
    viewProperties: true,
    viewPropertyDetails: true,
    viewPropertyMap: true,
    shareProperty: true,
    addToFavorites: true,
  };
  p.messages = {
    viewMessages: true,
    sendMessage: true,
    deleteMessage: false,
    searchConversations: true,
  };
  p.documents = {
    ...p.documents,
    viewOwnDocuments: true,
    uploadDocument: true,
    downloadDocument: true,
  };
  // Optional: read notices only (no send / acknowledge) — verification is via messages + documents
  p.notices = {
    ...p.notices,
    viewNotices: true,
    sendNotice: false,
    acknowledgeNotice: false,
    disputeNotice: false,
    deleteNotice: false,
  };
  // Theme only — no profile / password / payment edits until approved
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

export function resolvePermissions(
  role: string,
  overrides?: Partial<FullUserPermissions> | string | null
): FullUserPermissions {
  const base = clonePermissions(DEFAULT_PERMISSIONS[role] ?? none());
  const ov = parseStoredPermissions(overrides ?? undefined);
  if (!ov) return base;

  const merged = { ...base } as unknown as Record<string, Record<string, boolean>>;
  const ovRec = ov as unknown as Record<string, Record<string, boolean>>;

  Object.keys(ovRec).forEach(section => {
    if (merged[section] && ovRec[section] && typeof ovRec[section] === 'object') {
      merged[section] = { ...merged[section], ...ovRec[section] };
    }
  });

  const out = merged as unknown as FullUserPermissions;
  (Object.keys(base) as (keyof FullUserPermissions)[]).forEach((section) => {
    const b = base[section] as unknown as Record<string, boolean>;
    const m = out[section] as unknown as Record<string, boolean>;
    if (!b || !m) return;
    Object.keys(b).forEach((k) => {
      if (!(k in m) || typeof m[k] !== 'boolean') m[k] = b[k];
    });
  });

  return out;
}
