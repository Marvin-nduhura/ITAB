/**
 * Payment store — Render DB is the ONLY source of truth.
 * No localStorage persistence. Every write goes to the backend immediately.
 * Local state is optimistic cache only, reset on each session from backend.
 */
import { create } from 'zustand';
import type {
  PlatformTransaction, PaymentPreference, VendorContract,
  PaymentMethod, TransactionType, UserRole,
} from '../types';
import { generateId, formatCurrency } from '../lib/utils';
import { api, contractsApi, paymentPreferencesApi } from '../lib/api';
import { apiCall, apiSend } from '../lib/apiCall';

const ITAB_ACCOUNT = { id: 'itab_platform', name: 'ITAB Property Services', role: 'platform' as const };

interface PaymentStore {
  transactions: PlatformTransaction[];
  preferences:  PaymentPreference[];
  contracts:    VendorContract[];

  // Sync setters — called by useBackendSync
  setTransactions: (txs: PlatformTransaction[]) => void;
  setContracts:    (contracts: VendorContract[]) => void;

  // Preferences
  setPreference: (pref: Omit<PaymentPreference, 'updatedAt'>) => void;
  getPreference: (userId: string) => PaymentPreference | undefined;

  // Core payment flows
  payRent: (params: {
    tenantId: string; tenantName: string; tenantPhone: string; method: PaymentMethod;
    propertyId: string; propertyTitle: string; amount: number;
    landlordId: string; landlordName: string;
    managerId: string; managerName: string;
    managementFeePercent: number; itabFeePercent: number;
    inspectionCredit?: number; rentPeriod?: string; isPartial?: boolean;
  }) => { transactions: PlatformTransaction[]; reference: string };

  payInspectionFee: (params: {
    tenantId: string; tenantName: string; tenantPhone: string; method: PaymentMethod;
    propertyId: string; propertyTitle: string; amount: number;
    managerId: string; managerName: string;
  }) => PlatformTransaction;

  payVendor: (params: {
    vendorId: string; vendorName: string; jobId: string; propertyTitle: string;
    amount: number; description: string; managerId: string; managerName: string;
    paymentMethod: PaymentMethod | 'bank'; receiverPhone?: string;
  }) => PlatformTransaction;

  // Contracts
  createContract:        (c: Omit<VendorContract, 'id' | 'totalPaid' | 'paymentsCount' | 'createdAt' | 'updatedAt'>) => VendorContract;
  updateContract:        (id: string, updates: Partial<VendorContract>) => void;
  cancelContract:        (id: string) => void;
  processContractPayment:(contractId: string) => PlatformTransaction | null;

  // Queries
  getTransactionsByUser:    (userId: string) => PlatformTransaction[];
  getTransactionsByProperty:(propertyId: string) => PlatformTransaction[];
  getTransactionsByVendor:  (vendorId: string) => PlatformTransaction[];
  getPlatformRevenue:       () => number;
  getContractsByVendor:     (vendorId: string) => VendorContract[];
  getContractsByProperty:   (propertyId: string) => VendorContract[];

  // Admin actions
  retryTransaction:  (id: string) => void;
  refundTransaction: (id: string) => void;
}

function makeRef(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function makeTx(
  type: TransactionType,
  sender: { id: string; name: string; role: UserRole | 'platform'; method: PaymentMethod | 'bank' | 'escrow'; phone?: string },
  receiver: { id: string; name: string; role: UserRole | 'platform'; method: PaymentMethod | 'bank' | 'escrow'; phone?: string; bankDetails?: { bankName: string; accountNumber: string; accountName: string } },
  amount: number,
  description: string,
  extras: Partial<PlatformTransaction> = {}
): PlatformTransaction {
  return {
    id: `tx_${generateId()}`,
    type,
    senderId: sender.id, senderName: sender.name, senderRole: sender.role,
    senderMethod: sender.method, senderPhone: sender.phone,
    receiverId: receiver.id, receiverName: receiver.name, receiverRole: receiver.role,
    receiverMethod: receiver.method, receiverPhone: receiver.phone,
    receiverBankDetails: receiver.bankDetails,
    amount, currency: 'UGX',
    reference: makeRef('TX'),
    status: 'completed',
    description,
    createdAt: new Date().toISOString(),
    processedAt: new Date().toISOString(),
    ...extras,
  };
}

/** Persist a transaction to the Render DB (fire-and-forget) */
function persistTx(tx: PlatformTransaction): void {
  apiSend(() => api.post('/transactions', tx));
}

export const usePaymentStore = create<PaymentStore>()(
  (set, get) => ({
    transactions: [],
    preferences:  [],
    contracts:    [],

    // ── Sync setters ──────────────────────────────────────────────────────
    setTransactions: (txs) => set({ transactions: txs }),
    setContracts:    (contracts) => set({ contracts }),

    // ── Preferences ───────────────────────────────────────────────────────
    setPreference: (pref) => {
      const updated = { ...pref, updatedAt: new Date().toISOString() };
      set(s => ({
        preferences: [
          ...s.preferences.filter(p => p.userId !== pref.userId),
          updated,
        ],
      }));
      // Persist to backend
      apiSend(() => paymentPreferencesApi.save(updated));
    },

    getPreference: (userId) => get().preferences.find(p => p.userId === userId),

    // ── Pay Rent ──────────────────────────────────────────────────────────
    payRent: (params) => {
      const {
        tenantId, tenantName, tenantPhone, method,
        propertyId, propertyTitle, amount,
        landlordId, landlordName, managerId, managerName,
        managementFeePercent, itabFeePercent,
        inspectionCredit = 0, rentPeriod, isPartial,
      } = params;

      const itabFee    = Math.round(amount * itabFeePercent / 100);
      const mgmtFee    = Math.round(amount * managementFeePercent / 100);
      const landlordNet = amount - itabFee - mgmtFee - inspectionCredit;
      const ref = makeRef('RENT');

      const landlordPref = get().preferences.find(p => p.userId === landlordId);
      const managerPref  = get().preferences.find(p => p.userId === managerId);
      const landlordMethod = (landlordPref?.preferredMethod || 'mtn_momo') as PaymentMethod | 'bank';
      const managerMethod  = (managerPref?.preferredMethod  || 'mtn_momo') as PaymentMethod;

      const txs: PlatformTransaction[] = [];

      txs.push(makeTx('rent_payment',
        { id: tenantId, name: tenantName, role: 'tenant', method, phone: tenantPhone },
        { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
        amount,
        `Rent payment for ${propertyTitle}${rentPeriod ? ` (${rentPeriod})` : ''}`,
        { propertyId, propertyTitle, rentPeriod, isPartial, inspectionCreditApplied: inspectionCredit, reference: ref }
      ));

      txs.push(makeTx('platform_fee',
        { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
        { id: ITAB_ACCOUNT.id, name: ITAB_ACCOUNT.name, role: 'platform', method: 'escrow' },
        itabFee, `Platform fee (${itabFeePercent}%) on rent for ${propertyTitle}`,
        { propertyId, propertyTitle }
      ));

      txs.push(makeTx('management_fee_payout',
        { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
        { id: managerId, name: managerName, role: 'property_manager', method: managerMethod, phone: managerPref?.mtnPhone || managerPref?.airtelPhone },
        mgmtFee, `Management fee (${managementFeePercent}%) for ${propertyTitle}`,
        { propertyId, propertyTitle }
      ));

      if (landlordNet > 0) {
        txs.push(makeTx('landlord_payout',
          { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
          {
            id: landlordId, name: landlordName, role: 'landlord',
            method: (landlordMethod === 'bank' ? 'mtn_momo' : landlordMethod) as PaymentMethod,
            phone: landlordPref?.mtnPhone || landlordPref?.airtelPhone,
            bankDetails: (landlordMethod as string) === 'bank' ? {
              bankName: landlordPref?.bankName || '',
              accountNumber: landlordPref?.bankAccountNumber || '',
              accountName: landlordPref?.bankAccountName || '',
            } : undefined,
          },
          landlordNet,
          `Net rent payout for ${propertyTitle}${inspectionCredit > 0 ? ` (incl. ${formatCurrency(inspectionCredit)} inspection credit deducted)` : ''}`,
          { propertyId, propertyTitle }
        ));
      }

      set(s => ({ transactions: [...txs, ...s.transactions] }));
      txs.forEach(persistTx);
      return { transactions: txs, reference: ref };
    },

    // ── Pay Inspection Fee ────────────────────────────────────────────────
    payInspectionFee: (params) => {
      const { tenantId, tenantName, tenantPhone, method, propertyId, propertyTitle, amount, managerId, managerName } = params;
      const managerShare = Math.round(amount * 0.5);
      const itabShare    = amount - managerShare;
      const ref = makeRef('INSP');
      const managerPref = get().preferences.find(p => p.userId === managerId);

      const tx1 = makeTx('inspection_fee',
        { id: tenantId, name: tenantName, role: 'tenant', method, phone: tenantPhone },
        { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
        amount, `Inspection fee for ${propertyTitle} (non-refundable)`,
        { propertyId, propertyTitle, reference: ref }
      );
      const tx2 = makeTx('platform_fee',
        { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
        { id: ITAB_ACCOUNT.id, name: ITAB_ACCOUNT.name, role: 'platform', method: 'escrow' },
        itabShare, `ITAB share of inspection fee for ${propertyTitle}`,
        { propertyId, propertyTitle }
      );
      const tx3 = makeTx('management_fee_payout',
        { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
        { id: managerId, name: managerName, role: 'property_manager', method: (managerPref?.preferredMethod || 'mtn_momo') as PaymentMethod, phone: managerPref?.mtnPhone || managerPref?.airtelPhone },
        managerShare, `Manager share of inspection fee for ${propertyTitle}`,
        { propertyId, propertyTitle }
      );

      set(s => ({ transactions: [tx1, tx2, tx3, ...s.transactions] }));
      [tx1, tx2, tx3].forEach(persistTx);
      return tx1;
    },

    // ── Pay Vendor ────────────────────────────────────────────────────────
    payVendor: (params) => {
      const { vendorId, vendorName, jobId, propertyTitle, amount, description, managerId, managerName, paymentMethod, receiverPhone } = params;
      const vendorPref = get().preferences.find(p => p.userId === vendorId);
      const effectiveMethod = (vendorPref?.preferredMethod || paymentMethod) as PaymentMethod | 'bank';

      const tx = makeTx('vendor_payment',
        { id: managerId, name: managerName, role: 'property_manager', method: 'escrow' },
        {
          id: vendorId, name: vendorName, role: 'vendor',
          method: ((effectiveMethod as string) === 'bank' ? 'mtn_momo' : effectiveMethod) as PaymentMethod,
          phone: vendorPref?.mtnPhone || vendorPref?.airtelPhone || receiverPhone,
          bankDetails: (effectiveMethod as string) === 'bank' ? {
            bankName: vendorPref?.bankName || '',
            accountNumber: vendorPref?.bankAccountNumber || '',
            accountName: vendorPref?.bankAccountName || '',
          } : undefined,
        },
        amount, description, { jobId, propertyTitle }
      );

      set(s => ({ transactions: [tx, ...s.transactions] }));
      persistTx(tx);
      return tx;
    },

    // ── Contracts ─────────────────────────────────────────────────────────
    createContract: (data) => {
      const contract: VendorContract = {
        ...data, id: `c_${generateId()}`,
        totalPaid: 0, paymentsCount: 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      set(s => ({ contracts: [contract, ...s.contracts] }));
      apiCall<VendorContract>('contract', 'create',
        () => contractsApi.create(contract) as Promise<{ data: { data: VendorContract } }>,
        contract as unknown as Record<string, unknown>
      );
      return contract;
    },

    updateContract: (id, updates) => {
      set(s => ({ contracts: s.contracts.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c) }));
      apiSend(() => contractsApi.update(id, updates));
    },

    cancelContract: (id) => {
      set(s => ({ contracts: s.contracts.map(c => c.id === id ? { ...c, status: 'cancelled', updatedAt: new Date().toISOString() } : c) }));
      apiSend(() => contractsApi.update(id, { status: 'cancelled' }));
    },

    processContractPayment: (contractId) => {
      const contract = get().contracts.find(c => c.id === contractId);
      if (!contract || contract.status !== 'active') return null;

      const vendorPref = get().preferences.find(p => p.userId === contract.vendorId);
      const effectiveMethod = (vendorPref?.preferredMethod || contract.paymentMethod) as PaymentMethod | 'bank';

      const tx = makeTx('vendor_contract',
        { id: contract.managerId, name: 'Property Manager', role: 'property_manager', method: 'escrow' },
        {
          id: contract.vendorId, name: contract.vendorName, role: 'vendor',
          method: ((effectiveMethod as string) === 'bank' ? 'mtn_momo' : effectiveMethod) as PaymentMethod,
          phone: vendorPref?.mtnPhone || vendorPref?.airtelPhone,
          bankDetails: (effectiveMethod as string) === 'bank' ? {
            bankName: vendorPref?.bankName || '',
            accountNumber: vendorPref?.bankAccountNumber || '',
            accountName: vendorPref?.bankAccountName || '',
          } : undefined,
        },
        contract.amount,
        `Contract payment: ${contract.description} for ${contract.propertyTitle}`,
        { contractId, propertyTitle: contract.propertyTitle }
      );

      set(s => ({
        transactions: [tx, ...s.transactions],
        contracts: s.contracts.map(c => c.id === contractId ? {
          ...c, totalPaid: c.totalPaid + contract.amount,
          paymentsCount: c.paymentsCount + 1, updatedAt: new Date().toISOString(),
        } : c),
      }));
      persistTx(tx);
      apiSend(() => contractsApi.update(contractId, { totalPaid: contract.totalPaid + contract.amount, paymentsCount: contract.paymentsCount + 1 }));
      return tx;
    },

    // ── Queries ───────────────────────────────────────────────────────────
    getTransactionsByUser:    (userId)     => get().transactions.filter(t => t.senderId === userId || t.receiverId === userId),
    getTransactionsByProperty:(propertyId) => get().transactions.filter(t => t.propertyId === propertyId),
    getTransactionsByVendor:  (vendorId)   => get().transactions.filter(t => t.senderId === vendorId || t.receiverId === vendorId),
    getPlatformRevenue: () => get().transactions.filter(t => t.type === 'platform_fee' && t.receiverId === ITAB_ACCOUNT.id && t.status === 'completed').reduce((s, t) => s + t.amount, 0),
    getContractsByVendor:     (vendorId)   => get().contracts.filter(c => c.vendorId === vendorId),
    getContractsByProperty:   (propertyId) => get().contracts.filter(c => c.propertyId === propertyId),

    // ── Admin actions ─────────────────────────────────────────────────────
    retryTransaction: (id) => {
      set(s => ({
        transactions: s.transactions.map(t =>
          t.id === id && t.status === 'failed'
            ? { ...t, status: 'completed', processedAt: new Date().toISOString(), failureReason: undefined }
            : t
        ),
      }));
      apiSend(() => api.patch(`/transactions/${id}/retry`));
    },

    refundTransaction: (id) => {
      const tx = get().transactions.find(t => t.id === id);
      if (!tx) return;
      const refundTx = makeTx('refund',
        { id: tx.receiverId, name: tx.receiverName, role: tx.receiverRole, method: tx.receiverMethod },
        { id: tx.senderId, name: tx.senderName, role: tx.senderRole, method: tx.senderMethod, phone: tx.senderPhone },
        tx.amount, `Refund for transaction ${tx.reference}`,
        { propertyId: tx.propertyId, propertyTitle: tx.propertyTitle }
      );
      set(s => ({
        transactions: [refundTx, ...s.transactions.map(t => t.id === id ? { ...t, status: 'refunded' as const } : t)],
      }));
      persistTx(refundTx);
      apiSend(() => api.patch(`/transactions/${id}/refund`));
    },
  })
);
