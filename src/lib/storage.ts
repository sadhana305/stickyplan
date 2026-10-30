import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

/**
 * Server-side file storage for My Study Library.
 * Files live outside the repo under <project>/storage/library/<userId>/<docId><ext>
 * and are only ever served through an auth-scoped API route.
 */
const STORAGE_ROOT = process.env.SP_STORAGE_DIR ?? path.join(process.cwd(), "storage", "library");

export function safeExt(ext: string): string {
  const cleaned = (ext || "").toLowerCase().replace(/[^a-z0-9.]/g, "");
  return cleaned.startsWith(".") ? cleaned.slice(0, 8) : cleaned ? `.${cleaned.slice(0, 7)}` : "";
}

export function extFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot === -1 || dot === name.length - 1) return "";
  return safeExt(name.slice(dot));
}

export function docFilePath(userId: string, docId: string, ext: string): string {
  return path.join(STORAGE_ROOT, userId, `${docId}${safeExt(ext)}`);
}

export async function saveDocFile(userId: string, docId: string, ext: string, data: Buffer): Promise<string> {
  const filePath = docFilePath(userId, docId, ext);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
  return filePath;
}

export async function readDocFile(userId: string, docId: string, ext: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(docFilePath(userId, docId, ext));
  } catch {
    return null;
  }
}

export async function deleteDocFile(userId: string, docId: string, ext: string): Promise<void> {
  try {
    await fs.unlink(docFilePath(userId, docId, ext));
  } catch {
    /* already gone */
  }
}

export function randomId(): string {
  return crypto.randomBytes(12).toString("hex");
}
