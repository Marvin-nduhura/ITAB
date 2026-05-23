/**
 * Document store — Render DB is the ONLY source of truth.
 * No localStorage persistence. All writes go to the Render backend.
 * Local state is the in-memory cache; reset on each session from backend.
 */
import { create } from 'zustand';
import { generateId } from '../lib/utils';
import { documentsApi } from '../lib/api';
import { apiCall, apiSend } from '../lib/apiCall';

export type DocCategory = 'kyc' | 'lease' | 'ownership' | 'other';
export type DocStatus   = 'pending' | 'approved' | 'rejected' | 'expired';

export interface Document {
  id: string;
  ownerId: string;
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
  reviewedBy?: string;
  reviewedAt?: string;
  adminNotes?: string;
}

interface DocumentStore {
  documents: Document[];

  // Sync setter — called by useBackendSync
  setDocuments: (docs: Document[]) => void;

  // CRUD
  addDocument:     (doc: Omit<Document, 'id' | 'uploadedAt' | 'status'>) => Promise<Document>;
  approveDocument: (id: string, adminName: string, notes?: string) => Promise<void>;
  rejectDocument:  (id: string, adminName: string, notes: string)  => Promise<void>;
  deleteDocument:  (id: string) => Promise<void>;

  // Queries
  getDocsByOwner: (ownerId: string) => Document[];
  getPendingDocs: () => Document[];
}

export const useDocumentStore = create<DocumentStore>()(
  (set, get) => ({
    documents: [],

    setDocuments: (docs) => set({ documents: docs }),

    addDocument: async (data) => {
      const doc: Document = {
        ...data,
        id: `doc_${generateId()}`,
        status: 'pending',
        uploadedAt: new Date().toISOString(),
      };
      // Optimistic
      set(s => ({ documents: [doc, ...s.documents] }));

      const saved = await apiCall<Document>(
        'document', 'create',
        () => documentsApi.upload(doc) as Promise<{ data: { data: Document } }>,
        doc as unknown as Record<string, unknown>
      );
      if (saved && saved.id !== doc.id) {
        set(s => ({ documents: s.documents.map(d => d.id === doc.id ? { ...d, ...saved } : d) }));
        return saved;
      }
      return doc;
    },

    approveDocument: async (id, adminName, notes) => {
      set(s => ({
        documents: s.documents.map(d =>
          d.id === id ? { ...d, status: 'approved' as const, reviewedBy: adminName, reviewedAt: new Date().toISOString(), adminNotes: notes || 'Document verified and approved.' } : d
        ),
      }));
      await apiSend(() => documentsApi.approve(id, notes));
    },

    rejectDocument: async (id, adminName, notes) => {
      set(s => ({
        documents: s.documents.map(d =>
          d.id === id ? { ...d, status: 'rejected' as const, reviewedBy: adminName, reviewedAt: new Date().toISOString(), adminNotes: notes } : d
        ),
      }));
      await apiSend(() => documentsApi.reject(id, notes));
    },

    deleteDocument: async (id) => {
      set(s => ({ documents: s.documents.filter(d => d.id !== id) }));
      await apiCall('document', 'delete', () => documentsApi.delete(id) as Promise<{ data: { data: unknown } }>, { id });
    },

    getDocsByOwner: (ownerId) => get().documents.filter(d => d.ownerId === ownerId),
    getPendingDocs: () => get().documents.filter(d => d.status === 'pending'),
  })
);
