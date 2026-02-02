/** Convertit les anciennes URLs /uploads/ vers /api/uploads/ */
export function normalizeUploadUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/uploads/")) {
    return url.replace("/uploads/", "/api/uploads/");
  }
  return url;
}
