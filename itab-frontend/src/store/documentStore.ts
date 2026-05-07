/**
 * Document store — shared state for all user documents.
 * Admin can see ALL documents and approve/reject them.
 * Each user sees only their own documents.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../lib/utils';

export type DocCategory = 'kyc' | 'lease' | 'ownership' | 'other';
export type DocStatus   = 'pending' | 'approved' | 'rejected' | 'expired';

export interface Document {
  id: string;
  ownerId: string;          // user who uploaded it
  ownerName: string;
  ownerRole: string;
  name: string;
  category: DocCategory;
  status: DocStatus;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  expiresAt?: string;
  // Admin review fields
  reviewedBy?: string;      // admin name
  reviewedAt?: string;
  adminNotes?: string;      // reason for rejection or approval note
}

interface DocumentStore {
  documents: Document[];
  addDocument: (doc: Omit<Document, 'id' | 'uploadedAt' | 'status'>) => Document;
  approveDocument: (id: string, adminName: string, notes?: string) => void;
  rejectDocument:  (id: string, adminName: string, notes: string)  => void;
  deleteDocument:  (id: string) => void;
  getDocsByOwner:  (ownerId: string) => Document[];
  getPendingDocs:  () => Document[];
}

// ─── Seed data — documents from multiple users ────────────────────────────────
const SEED_DOCS: Document[] = [
  {
    id: 'doc1', ownerId: 'u4', ownerName: 'Grace Apio', ownerRole: 'tenant',
    name: 'National ID (Front)', category: 'kyc', status: 'approved',
    fileUrl: '', fileType: 'image/jpeg', fileSize: 245000,
    uploadedAt: '2024-01-15T10:00:00Z',
    reviewedBy: 'Admin ITAB', reviewedAt: '2024-01-16T09:00:00Z',
    adminNotes: 'ID verified — clear and valid.',
  },
  {
    id: 'doc2', ownerId: 'u4', ownerName: 'Grace Apio', ownerRole: 'tenant',
    name: 'National ID (Back)', category: 'kyc', status: 'approved',
    fileUrl: '', fileType: 'image/jpeg', fileSize: 198000,
    uploadedAt: '2024-01-15T10:05:00Z',
    reviewedBy: 'Admin ITAB', reviewedAt: '2024-01-16T09:05:00Z',
  },
  {
    id: 'doc3', ownerId: 'u4', ownerName: 'Grace Apio', ownerRole: 'tenant',
    name: 'Tenancy Agreement — Entebbe Apartment', category: 'lease', status: 'approved',
    fileUrl: '', fileType: 'application/pdf', fileSize: 512000,
    uploadedAt: '2024-02-01T09:00:00Z',
    expiresAt: '2025-01-31T00:00:00Z',
    reviewedBy: 'Admin ITAB', reviewedAt: '2024-02-02T10:00:00Z',
  },
  {
    id: 'doc4', ownerId: 'u4', ownerName: 'Grace Apio', ownerRole: 'tenant',
    name: 'Proof of Income', category: 'kyc', status: 'pending',
    fileUrl: '', fileType: 'application/pdf', fileSize: 320000,
    uploadedAt: '2024-04-01T14:00:00Z',
  },
  {
    id: 'doc5', ownerId: 'u3', ownerName: 'John Ssemakula', ownerRole: 'landlord',
    name: 'Land Title — Entebbe Plot', category: 'ownership', status: 'pending',
    fileUrl: '', fileType: 'application/pdf', fileSize: 890000,
    uploadedAt: '2024-03-10T11:00:00Z',
  },
  {
    id: 'doc6', ownerId: 'u3', ownerName: 'John Ssemakula', ownerRole: 'landlord',
    name: 'National ID', category: 'kyc', status: 'approved',
    fileUrl: '', fileType: 'image/jpeg', fileSize: 210000,
    uploadedAt: '2024-01-20T08:00:00Z',
    reviewedBy: 'Admin ITAB', reviewedAt: '2024-01-21T09:00:00Z',
  },
  {
    id: 'doc7', ownerId: 'u2', ownerName: 'Sarah Nakato', ownerRole: 'property_manager',
    name: 'Professional Certificate', category: 'kyc', status: 'pending',
    fileUrl: '', fileType: 'application/pdf', fileSize: 450000,
    uploadedAt: '2024-04-05T09:30:00Z',
  },
  {
    id: 'doc8', ownerId: 'u6', ownerName: 'Peter Mugisha', ownerRole: 'vendor',
    name: 'Plumbing License', category: 'kyc', status: 'rejected',
    fileUrl: '', fileType: 'application/pdf', fileSize: 380000,
    uploadedAt: '2024-03-15T14:00:00Z',
    reviewedBy: 'Admin ITAB', reviewedAt: '2024-03-16T10:00:00Z',
    adminNotes: 'Document is blurry and unreadable. Please upload a clearer scan.',
  },
];

export const useDocumentStore = create<DocumentStore>()(
  persist(
    (set, get) => ({
      documents: SEED_DOCS,

      addDocument: (data) => {
        const doc: Document = {
          ...data,
          id: `doc_${generateId()}`,
          status: 'pending',
          uploadedAt: new Date().toISOString(),
        };
        set(s => ({ documents: [doc, ...s.documents] }));
        return doc;
      },

      approveDocument: (id, adminName, notes) => {
        set(s => ({
          documents: s.documents.map(d =>
            d.id === id
              ? {
                  ...d,
                  status: 'approved' as const,
                  reviewedBy: adminName,
                  reviewedAt: new Date().toISOString(),
                  adminNotes: notes || 'Document verified and approved.',
                }
              : d
          ),
        }));
      },

      rejectDocument: (id, adminName, notes) => {
        set(s => ({
          documents: s.documents.map(d =>
            d.id === id
              ? {
                  ...d,
                  status: 'rejected' as const,
                  reviewedBy: adminName,
                  reviewedAt: new Date().toISOString(),
                  adminNotes: notes,
                }
              : d
          ),
        }));
      },

      deleteDocument: (id) => {
        set(s => ({ documents: s.documents.filter(d => d.id !== id) }));
      },

      getDocsByOwner: (ownerId) =>
        get().documents.filter(d => d.ownerId === ownerId),

      getPendingDocs: () =>
        get().documents.filter(d => d.status === 'pending'),
    }),
    {
      name: 'itab_documents',
      partialize: (s) => ({ documents: s.documents }),
      merge: (persisted: unknown, current) => {
        const p = persisted as Partial<DocumentStore>;
        const saved = p.documents || [];
        // Keep seed docs that haven't been overridden, plus any user-added ones
        return {
          ...current,
          documents: [
            ...saved.filter((d: Document) => d.id.startsWith('doc_')), // user-added
            ...SEED_DOCS.map(seed => {
              const override = saved.find((d: Document) => d.id === seed.id);
              return override ? { ...seed, ...override } : seed;
            }),
          ],
        };
      },
    }
  )
);
