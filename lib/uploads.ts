import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PROOF_SIZE = 10 * 1024 * 1024;

const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const PROOF_MIME_TYPES = [...IMAGE_MIME_TYPES, "application/pdf"];

type UploadOptions = {
  label: string;
  allowedTypes: string[];
  maxSize: number;
  defaultName: string;
};

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} Mo`;
  }
  return `${Math.round(bytes / 1024)} Ko`;
}

function validateFile(file: File, { label, allowedTypes, maxSize }: UploadOptions) {
  if (!file.type || !allowedTypes.includes(file.type)) {
    throw new Error(`${label}: type de fichier non autorisé.`);
  }
  if (file.size > maxSize) {
    throw new Error(`${label}: fichier trop volumineux (max ${formatSize(maxSize)}).`);
  }
}

export async function storeUpload(file: File, options: UploadOptions) {
  validateFile(file, options);
  await mkdir(UPLOAD_DIR, { recursive: true });
  const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, "_") : options.defaultName;
  const filename = `${randomUUID()}-${safeName}`;
  const filePath = path.join(UPLOAD_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);
  return `/api/uploads/${filename}`;
}

/** Convertit les anciennes URLs /uploads/ vers /api/uploads/ */
export function normalizeUploadUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/uploads/")) {
    return url.replace("/uploads/", "/api/uploads/");
  }
  return url;
}

export const UploadPresets = {
  logo: {
    label: "Logo",
    allowedTypes: IMAGE_MIME_TYPES,
    maxSize: MAX_IMAGE_SIZE,
    defaultName: "logo",
  },
  template: {
    label: "Template",
    allowedTypes: IMAGE_MIME_TYPES,
    maxSize: MAX_IMAGE_SIZE,
    defaultName: "template",
  },
  photo: {
    label: "Photo",
    allowedTypes: IMAGE_MIME_TYPES,
    maxSize: MAX_IMAGE_SIZE,
    defaultName: "photo",
  },
  proof: {
    label: "Preuve",
    allowedTypes: PROOF_MIME_TYPES,
    maxSize: MAX_PROOF_SIZE,
    defaultName: "preuve",
  },
};
