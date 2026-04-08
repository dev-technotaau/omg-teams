"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { Upload, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { uploadKycDocument } from "@/services/upload.service";
import { PageHeader, Card, Badge, Button, Modal, FileUpload, Progress } from "@/components/ui";
import { DOCUMENT_STATUS_BADGE } from "@/constants/statuses";
import type { EmployeeDocument as EmployeeDoc, DocumentType as DocType } from "@/types/document";

const statusIcon = (status: string) => {
  switch (status) {
    case "VERIFIED":
      return <CheckCircle size={16} className="text-success-500" />;
    case "REJECTED":
      return <XCircle size={16} className="text-error-500" />;
    case "PENDING":
      return <Clock size={16} className="text-warning-500" />;
    default:
      return <Upload size={16} className="text-text-muted" />;
  }
};

export default function MyDocumentsPage() {
  const qc = useQueryClient();
  const [uploadTarget, setUploadTarget] = useState<DocType | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  const docsQuery = useQuery({
    queryKey: qk.documents.list({ scope: "my" }),
    queryFn: async () => {
      const r = await api.get<{ documents: EmployeeDoc[] }>("/documents/my");
      return r.data.documents;
    },
  });
  const typesQuery = useQuery({
    queryKey: [...qk.documents.all(), "types"] as const,
    queryFn: async () => {
      const r = await api.get<{ types: DocType[] }>("/documents/types");
      return r.data.types;
    },
    staleTime: 60 * 60 * 1000,
  });
  const documents = docsQuery.data ?? [];
  const docTypes = typesQuery.data ?? [];
  const isLoading = docsQuery.isLoading || typesQuery.isLoading;

  const fetchData = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.documents.lists() }),
    [qc],
  );

  const verified = documents.filter((d) => d.status === "VERIFIED").length;
  const total = docTypes.filter((t) => t.isRequired).length;
  const progress = total > 0 ? Math.round((verified / total) * 100) : 0;

  const getDocForType = (typeId: string) => documents.find((d) => d.documentTypeId === typeId);

  const handleUpload = async () => {
    if (!uploadTarget || uploadFiles.length === 0) return;
    try {
      // Step 1: Upload file to Cloudinary via /uploads/document
      const file = uploadFiles[0];
      const result = await uploadKycDocument(file);

      // Step 2: Create document record with the returned metadata
      await api.post("/documents/upload", {
        documentTypeId: uploadTarget.id,
        fileUrl: result.url,
        fileName: result.originalName ?? file.name,
        fileSize: result.size ?? file.size,
        mimeType: result.mimeType ?? file.type,
        storageKey: result.storageKey,
      });

      toast.success("Document uploaded");
      setUploadTarget(null);
      setUploadFiles([]);
      void fetchData();
    } catch {
      toast.error("Failed to upload document");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-bg-muted h-20 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Documents" />

      {/* KYC Progress */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-text-secondary text-sm font-medium">KYC Completion</span>
          <span className="text-text-primary text-sm font-bold">{progress}%</span>
        </div>
        <Progress value={progress} max={100} variant={progress === 100 ? "success" : "primary"} />
        <p className="text-text-muted mt-2 text-xs">
          {verified} of {total} required documents verified
        </p>
      </Card>

      {/* Document Cards */}
      <div className="space-y-3">
        {docTypes.map((type) => {
          const doc = getDocForType(type.id);
          const status = doc?.status ?? "NOT_UPLOADED";

          return (
            <Card key={type.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusIcon(status)}
                <div>
                  <p className="text-text-primary font-medium">{type.name}</p>
                  <p className="text-text-muted text-xs">
                    {doc?.fileName ? `${doc.fileName} (v${doc.version})` : "Not uploaded"}
                    {doc?.rejectionReason && (
                      <span className="text-error-500"> &mdash; {doc.rejectionReason}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={DOCUMENT_STATUS_BADGE[status] ?? "default"}>
                  {status.replace("_", " ")}
                </Badge>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setUploadTarget(type);
                    setUploadFiles([]);
                  }}
                >
                  {doc ? "Re-upload" : "Upload"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Upload Modal */}
      <Modal
        open={!!uploadTarget}
        onClose={() => {
          setUploadTarget(null);
          setUploadFiles([]);
        }}
        title={`Upload ${uploadTarget?.name ?? "Document"}`}
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setUploadTarget(null);
                setUploadFiles([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleUpload()} disabled={uploadFiles.length === 0}>
              Upload
            </Button>
          </>
        }
      >
        {uploadFiles.length > 0 ? (
          <div className="space-y-3">
            <div className="border-border-default bg-bg-surface flex items-center gap-3 rounded-lg border p-4">
              <CheckCircle size={20} className="text-success-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-text-primary truncate text-sm font-medium">
                  {uploadFiles[0]?.name}
                </p>
                <p className="text-text-muted text-xs">
                  {uploadFiles[0] ? `${(uploadFiles[0].size / 1024).toFixed(1)} KB` : ""}
                </p>
              </div>
              <Button variant="outline" size="xs" onClick={() => setUploadFiles([])}>
                Change File
              </Button>
            </div>
          </div>
        ) : (
          <FileUpload
            accept=".pdf,.jpg,.jpeg,.png"
            maxSize={5 * 1024 * 1024}
            label="Drop your file here or click to browse"
            description="PDF, JPG, or PNG up to 5MB"
            value={uploadFiles}
            onUpload={setUploadFiles}
          />
        )}
      </Modal>
    </div>
  );
}
