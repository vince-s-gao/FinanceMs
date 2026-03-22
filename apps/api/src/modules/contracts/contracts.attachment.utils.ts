import * as path from "path";
import { normalizeText } from "../../common/utils/tabular.utils";

const ATTACHMENT_MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function attachmentNameScore(value: string): number {
  const cjkCount = (value.match(/[\u4e00-\u9fff]/g) || []).length;
  const replacementCount = (value.match(/\uFFFD/g) || []).length;
  const mojibakeHintCount = (value.match(/[ÃÂ]/g) || []).length;
  return cjkCount * 3 - replacementCount * 4 - mojibakeHintCount * 2;
}

export function resolveContractAttachmentMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return ATTACHMENT_MIME_BY_EXT[ext] || "application/octet-stream";
}

export function normalizeContractAttachmentName(
  value?: string | null,
): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const decoded = Buffer.from(raw, "latin1").toString("utf8").trim();
  if (!decoded) return raw;

  return attachmentNameScore(decoded) > attachmentNameScore(raw)
    ? decoded.normalize("NFC")
    : raw;
}

export function normalizeContractNo(value?: string): string {
  return normalizeText(value || "");
}

export function normalizeContractNoKey(value?: string): string {
  return normalizeContractNo(value).toUpperCase();
}
