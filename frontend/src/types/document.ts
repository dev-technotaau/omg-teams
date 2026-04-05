// ──────────────────────────────────────────────
//  Document Types
// ──────────────────────────────────────────────

export interface DocumentType {
  id: string;
  name: string;
  code: string;
  isRequired: boolean;
}

export interface EmployeeDocument {
  id: string;
  documentTypeId: string;
  fileUrl: string | null;
  fileName: string | null;
  status: string;
  rejectionReason: string | null;
  version: number;
  uploadedAt: string | null;
  documentType: DocumentType;
}
