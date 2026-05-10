/**
 * Unified payment store — every transaction has a sender and a receiver.
 * All money flows through the platform escrow before being distributed.
 *
 * Flow:
 *   Tenant pays rent → escrow
 *   Escrow splits:
 *     → ITAB platform fee (2%)
 *     → Property Manager fee (10%)
 *     → Landlord net payout (88%)
 *
 *   Manager pays vendor → vendor receives via their preferred method
 *   Vendor contract → recurring payment to vendor
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PlatformTransaction, PaymentPreference, VendorContract,
  PaymentMethod, TransactionType, UserRole,
} from '../types';
import { generateId, formatCurrency } from '../lib/utils';

// ITAB platform account
const ITAB_ACCOUNT = {
  id: 'itab_platform',
  name: 'ITAB Property Services',
  role: 'platform' as const,
};

interface PaymentStore {
  transactions: PlatformTransaction[];
  preferences: PaymentPreference[];
  contracts: VendorContract[];

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
    vendorId: string; vendorName: string;
    jobId: string; propertyTitle: string;
    amount: number; description: string;
    managerId: string; managerName: string;
    paymentMethod: PaymentMethod | 'bank';
    receiverPhone?: string;
  }) => PlatformTransaction;

  // Contracts
  createContract: (contract: Omit<VendorContract, 'id' | 'totalPaid' | 'paymentsCount' | 'createdAt' | 'updatedAt'>) => VendorContract;
  updateContract: (id: string, updates: Partial<VendorContract>) => void;
  cancelContract: (id: string) => void;
  processContractPayment: (contractId: string) => PlatformTransaction | null;

  // Queries
  getTransactionsByUser: (userId: string) => PlatformTransaction[];
  getTransactionsByProperty: (propertyId: string) => PlatformTransaction[];
  getTransactionsByVendor: (vendorId: string) => PlatformTransaction[];
  getPlatformRevenue: () => number;
  getContractsByVendor: (vendorId: string) => VendorContract[];
  getContractsByProperty: (propertyId: string) => VendorContract[];

  // Admin actions
  retryTransaction: (id: string) => void;
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
    senderId: sender.id,
    senderName: sender.name,
    senderRole: sender.role,
    senderMethod: sender.method,
    senderPhone: sender.phone,
    receiverId: receiver.id,
    receiverName: receiver.name,
    receiverRole: receiver.role,
    receiverMethod: receiver.method,
    receiverPhone: receiver.phone,
    receiverBankDetails: receiver.bankDetails,
    amount,
    currency: 'UGX',
    reference: makeRef('TX'),
    status: 'completed',
    description,
    createdAt: new Date().toISOString(),
    processedAt: new Date().toISOString(),
    ...extras,
  };
}

export const usePaymentStore = create<PaymentStore>()(
  persist(
    (set, get) => ({
      transactions: [],
      preferences: [],
      contracts: [],

      // ── Preferences ────────────────────────────────────────────────
      setPreference: (pref) => {
        set(s => ({
          preferences: [
            ...s.preferences.filter(p => p.userId !== pref.userId),
            { ...pref, updatedAt: new Date().toISOString() },
          ],
        }));
      },

      getPreference: (userId) => get().preferences.find(p => p.userId === userId),

      // ── Pay Rent ───────────────────────────────────────────────────
      // Tenant → Escrow → split to: ITAB fee + Manager fee + Landlord net
      payRent: (params) => {
        const {
          tenantId, tenantName, tenantPhone, method,
          propertyId, propertyTitle, amount,
          landlordId, landlordName, managerId, managerName,
          managementFeePercent, itabFeePercent,
          inspectionCredit = 0, rentPeriod, isPartial,
        } = params;

        const grossAmount = amount;
        const itabFee = Math.round(grossAmount * itabFeePercent / 100);
        const mgmtFee = Math.round(grossAmount * managementFeePercent / 100);
        const landlordNet = grossAmount - itabFee - mgmtFee - inspectionCredit;

        const ref = makeRef('RENT');

        // Get receiver preferences
        const landlordPref = get().preferences.find(p => p.userId === landlordId);
        const managerPref = get().preferences.find(p => p.userId === managerId);

        const landlordMethod = landlordPref?.preferredMethod || 'mtn_momo';
        const managerMethod = managerPref?.preferredMethod || 'mtn_momo';

        const txs: PlatformTransaction[] = [];

        // 1. Tenant → Escrow (full rent)
        txs.push(makeTx(
          'rent_payment',
          { id: tenantId, name: tenantName, role: 'tenant', method, phone: tenantPhone },
          { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
          grossAmount,
          `Rent payment for ${propertyTitle}${rentPeriod ? ` (${rentPeriod})` : ''}`,
          { propertyId, propertyTitle, rentPeriod, isPartial, inspectionCreditApplied: inspectionCredit, reference: ref }
        ));

        // 2. Escrow → ITAB platform fee
        txs.push(makeTx(
          'platform_fee',
          { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
          { id: ITAB_ACCOUNT.id, name: ITAB_ACCOUNT.name, role: 'platform', method: 'escrow' },
          itabFee,
          `Platform fee (${itabFeePercent}%) on rent for ${propertyTitle}`,
          { propertyId, propertyTitle }
        ));

        // 3. Escrow → Property Manager (management fee)
        txs.push(makeTx(
          'management_fee_payout',
          { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
          { id: managerId, name: managerName, role: 'property_manager', method: managerMethod as PaymentMethod, phone: managerPref?.mtnPhone || managerPref?.airtelPhone },
          mgmtFee,
          `Management fee (${managementFeePercent}%) for ${propertyTitle}`,
          { propertyId, propertyTitle }
        ));

        // 4. Escrow → Landlord (net payout)
        if (landlordNet > 0) {
          txs.push(makeTx(
            'landlord_payout',
            { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
            {
              id: landlordId, name: landlordName, role: 'landlord',
              method: landlordMethod as PaymentMethod,
              phone: landlordPref?.mtnPhone || landlordPref?.airtelPhone,
              bankDetails: landlordMethod === 'bank' ? {
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
        return { transactions: txs, reference: ref };
      },

      // ── Pay Inspection Fee ─────────────────────────────────────────
      // Tenant → Escrow → ITAB (non-refundable, credited to first rent)
      payInspectionFee: (params) => {
        const { tenantId, tenantName, tenantPhone, method, propertyId, propertyTitle, amount, managerId, managerName } = params;

        // Inspection fee: 50% to manager, 50% to ITAB
        const managerShare = Math.round(amount * 0.5);
        const itabShare = amount - managerShare;

        const ref = makeRef('INSP');

        const tx1 = makeTx(
          'inspection_fee',
          { id: tenantId, name: tenantName, role: 'tenant', method, phone: tenantPhone },
          { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
          amount,
          `Inspection fee for ${propertyTitle} (non-refundable)`,
          { propertyId, propertyTitle, reference: ref }
        );

        const tx2 = makeTx(
          'platform_fee',
          { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
          { id: ITAB_ACCOUNT.id, name: ITAB_ACCOUNT.name, role: 'platform', method: 'escrow' },
          itabShare,
          `ITAB share of inspection fee for ${propertyTitle}`,
          { propertyId, propertyTitle }
        );

        const managerPref = get().preferences.find(p => p.userId === managerId);
        const tx3 = makeTx(
          'management_fee_payout',
          { id: 'escrow', name: 'ITAB Escrow', role: 'platform', method: 'escrow' },
          { id: managerId, name: managerName, role: 'property_manager', method: (managerPref?.preferredMethod || 'mtn_momo') as PaymentMethod, phone: managerPref?.mtnPhone || managerPref?.airtelPhone },
          managerShare,
          `Manager share of inspection fee for ${propertyTitle}`,
          { propertyId, propertyTitle }
        );

        set(s => ({ transactions: [tx1, tx2, tx3, ...s.transactions] }));
        return tx1;
      },

      // ── Pay Vendor ─────────────────────────────────────────────────
      // Manager/Escrow → Vendor (job completion payment)
      payVendor: (params) => {
        const { vendorId, vendorName, jobId, propertyTitle, amount, description, managerId, managerName, paymentMethod, receiverPhone } = params;

        const vendorPref = get().preferences.find(p => p.userId === vendorId);
        const effectiveMethod = vendorPref?.preferredMethod || paymentMethod;

        const tx = makeTx(
          'vendor_payment',
          { id: managerId, name: managerName, role: 'property_manager', method: 'escrow' },
          {
            id: vendorId, name: vendorName, role: 'vendor',
            method: effectiveMethod as PaymentMethod,
            phone: vendorPref?.mtnPhone || vendorPref?.airtelPhone || receiverPhone,
            bankDetails: effectiveMethod === 'bank' ? {
              bankName: vendorPref?.bankName || '',
              accountNumber: vendorPref?.bankAccountNumber || '',
              accountName: vendorPref?.bankAccountName || '',
            } : undefined,
          },
          amount,
          description,
          { jobId, propertyTitle }
        );

        set(s => ({ transactions: [tx, ...s.transactions] }));
        return tx;
      },

      // ── Contracts ──────────────────────────────────────────────────
      createContract: (data) => {
        const contract: VendorContract = {
          ...data,
          id: `c_${generateId()}`,
          totalPaid: 0,
          paymentsCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set(s => ({ contracts: [contract, ...s.contracts] }));
        return contract;
      },

      updateContract: (id, updates) => {
        set(s => ({
          contracts: s.contracts.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c),
        }));
      },

      cancelContract: (id) => {
        set(s => ({
          contracts: s.contracts.map(c => c.id === id ? { ...c, status: 'cancelled', updatedAt: new Date().toISOString() } : c),
        }));
      },

      processContractPayment: (contractId) => {
        const contract = get().contracts.find(c => c.id === contractId);
        if (!contract || contract.status !== 'active') return null;

        const vendorPref = get().preferences.find(p => p.userId === contract.vendorId);
        const effectiveMethod = vendorPref?.preferredMethod || contract.paymentMethod;

        const tx = makeTx(
          'vendor_contract',
          { id: contract.managerId, name: 'Property Manager', role: 'property_manager', method: 'escrow' },
          {
            id: contract.vendorId, name: contract.vendorName, role: 'vendor',
            method: effectiveMethod as PaymentMethod,
            phone: vendorPref?.mtnPhone || vendorPref?.airtelPhone,
            bankDetails: effectiveMethod === 'bank' ? {
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
            ...c,
            totalPaid: c.totalPaid + contract.amount,
            paymentsCount: c.paymentsCount + 1,
            updatedAt: new Date().toISOString(),
          } : c),
        }));

        return tx;
      },

      // ── Queries ────────────────────────────────────────────────────
      getTransactionsByUser: (userId) =>
        get().transactions.filter(t => t.senderId === userId || t.receiverId === userId),

      getTransactionsByProperty: (propertyId) =>
        get().transactions.filter(t => t.propertyId === propertyId),

      getTransactionsByVendor: (vendorId) =>
        get().transactions.filter(t => t.senderId === vendorId || t.receiverId === vendorId),

      getPlatformRevenue: () =>
        get().transactions
          .filter(t => t.type === 'platform_fee' && t.receiverId === ITAB_ACCOUNT.id && t.status === 'completed')
          .reduce((s, t) => s + t.amount, 0),

      getContractsByVendor: (vendorId) =>
        get().contracts.filter(c => c.vendorId === vendorId),

      getContractsByProperty: (propertyId) =>
        get().contracts.filter(c => c.propertyId === propertyId),

      retryTransaction: (id) => {
        set(s => ({
          transactions: s.transactions.map(t =>
            t.id === id && t.status === 'failed'
              ? { ...t, status: 'completed', processedAt: new Date().toISOString(), failureReason: undefined }
              : t
          ),
        }));
      },

      refundTransaction: (id) => {
        const tx = get().transactions.find(t => t.id === id);
        if (!tx) return;
        const refundTx = makeTx(
          'refund',
          { id: tx.receiverId, name: tx.receiverName, role: tx.receiverRole, method: tx.receiverMethod },
          { id: tx.senderId, name: tx.senderName, role: tx.senderRole, method: tx.senderMethod, phone: tx.senderPhone },
          tx.amount,
          `Refund for transaction ${tx.reference}`,
          { propertyId: tx.propertyId, propertyTitle: tx.propertyTitle }
        );
        set(s => ({
          transactions: [refundTx, ...s.transactions.map(t =>
            t.id === id ? { ...t, status: 'refunded' as const } : t
          )],
        }));
      },
    }),
    {
      name: 'itab_payments',
      partialize: (s) => ({
        transactions: s.transactions,
        preferences: s.preferences,
        contracts: s.contracts,
      }),
    }
  )
);
