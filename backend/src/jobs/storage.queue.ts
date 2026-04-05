import { createQueue } from "../config/queue.js";

// ──────────────────────────────────────────────
//  Storage Queue (R2 + Cloudinary processing)
// ──────────────────────────────────────────────

export const storageQueue = createQueue("storage");

export interface ImageProcessJob {
  fileKey: string;
  bucket: string;
  transforms: { width?: number; height?: number; format?: string };
}

export interface FileCleanupJob {
  keys: string[];
  bucket: string;
}

export interface CloudinaryUploadJob {
  localPath: string;
  folder: string;
  resourceType: "image" | "video" | "raw";
}

export async function enqueueImageProcess(data: ImageProcessJob): Promise<void> {
  await storageQueue.add("image-process", data, { priority: 3 });
}

export async function enqueueFileCleanup(data: FileCleanupJob): Promise<void> {
  await storageQueue.add("file-cleanup", data, { priority: 10 });
}

export async function enqueueCloudinaryUpload(data: CloudinaryUploadJob): Promise<void> {
  await storageQueue.add("cloudinary-upload", data, { priority: 2 });
}
