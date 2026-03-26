import { createHash } from "crypto";
import { Request } from "express";

function safeHeader(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value.join(",") : value;
}

export function buildDeviceFingerprint(req: Request): string {
  const source = [
    safeHeader(req.headers["user-agent"]),
    safeHeader(req.headers["accept-language"]),
    safeHeader(req.headers["accept"]),
    safeHeader(req.headers["sec-ch-ua"]),
    safeHeader(req.headers["sec-ch-ua-platform"]),
    safeHeader(req.headers["sec-ch-ua-mobile"]),
  ].join("|");

  return createHash("sha256").update(source).digest("hex");
}
