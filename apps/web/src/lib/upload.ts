export interface UploadFileMeta {
  uid: string;
  name: string;
  size: number;
  blob: Blob | null;
}

export function resolveUploadFileMeta(file: unknown): UploadFileMeta {
  if (typeof file === "string") {
    return {
      uid: `${Date.now()}`,
      name: file,
      size: 0,
      blob: null,
    };
  }

  const value = file as Record<string, unknown>;
  const uid =
    typeof value.uid === "string" || typeof value.uid === "number"
      ? String(value.uid)
      : `${Date.now()}`;
  const name = typeof value.name === "string" ? value.name : "upload-file";
  const size = typeof value.size === "number" ? Number(value.size) : 0;

  return {
    uid,
    name,
    size: Number.isFinite(size) ? size : 0,
    blob: file instanceof Blob ? file : null,
  };
}
