import "server-only";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { getEnv } from "../env";

/**
 * Storage-Abstraktion für Produktdateien.
 *
 * Dateien liegen ausserhalb des öffentlichen Web-Roots und werden ausschliesslich
 * über die API mit Berechtigungsprüfung ausgeliefert. Der Storage-Key ist
 * zufällig, damit sich Pfade nicht erraten lassen.
 */
export interface FileStorage {
  put(input: { buffer: Buffer; filename: string; productId: string }): Promise<StoredFile>;
  createStream(key: string): Promise<NodeJS.ReadableStream>;
  size(key: string): Promise<number | null>;
  remove(key: string): Promise<void>;
}

export type StoredFile = {
  key: string;
  sizeBytes: number;
  checksum: string;
};

export function sanitizeFilename(filename: string): string {
  return (
    path
      .basename(filename)
      .replace(/[^A-Za-z0-9._-]/g, "_")
      .replace(/_{2,}/g, "_")
      .slice(0, 120) || "datei"
  );
}

class LocalFileStorage implements FileStorage {
  private root(): string {
    return path.resolve(/*turbopackIgnore: true*/ process.cwd(), getEnv().STORAGE_LOCAL_PATH);
  }

  /** Verhindert Path-Traversal: der aufgelöste Pfad muss im Storage-Root liegen. */
  private resolve(key: string): string {
    const full = path.resolve(this.root(), key);
    const root = this.root();
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new Error("Ungültiger Storage-Key.");
    }
    return full;
  }

  async put(input: { buffer: Buffer; filename: string; productId: string }): Promise<StoredFile> {
    const safeName = sanitizeFilename(input.filename);
    const key = path.posix.join("products", input.productId, `${randomUUID()}-${safeName}`);
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.buffer);
    return {
      key,
      sizeBytes: input.buffer.byteLength,
      checksum: createHash("sha256").update(input.buffer).digest("hex"),
    };
  }

  async createStream(key: string): Promise<NodeJS.ReadableStream> {
    const target = this.resolve(key);
    if (!existsSync(target)) throw new Error("Datei nicht gefunden.");
    return createReadStream(target);
  }

  async size(key: string): Promise<number | null> {
    try {
      const info = await stat(this.resolve(key));
      return info.size;
    } catch {
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch {
      // Bereits entfernt – kein Fehler.
    }
  }
}

let storage: FileStorage | null = null;

export function getStorage(): FileStorage {
  if (!storage) storage = new LocalFileStorage();
  return storage;
}

/** Erlaubte Dateitypen für den Upload im Adminbereich. */
export const ALLOWED_UPLOADS: Record<string, { kind: string; extensions: string[] }> = {
  "audio/mpeg": { kind: "MP3", extensions: [".mp3"] },
  "audio/wav": { kind: "WAV", extensions: [".wav"] },
  "audio/x-wav": { kind: "WAV", extensions: [".wav"] },
  "audio/midi": { kind: "MIDI", extensions: [".mid", ".midi"] },
  "audio/x-midi": { kind: "MIDI", extensions: [".mid", ".midi"] },
  "application/zip": { kind: "ZIP", extensions: [".zip"] },
  "application/x-zip-compressed": { kind: "ZIP", extensions: [".zip"] },
  "application/pdf": { kind: "PDF", extensions: [".pdf"] },
  "application/octet-stream": {
    kind: "PRESET",
    extensions: [".fxp", ".fxb", ".nmsv", ".vital", ".serumpreset", ".adg", ".flp", ".als", ".mid"],
  },
};

export type UploadValidation =
  | { ok: true; kind: string }
  | { ok: false; reason: string };

/** Prüft MIME-Typ, Dateiendung und Grösse vor dem Speichern. */
export function validateUpload(input: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  maxBytes: number;
}): UploadValidation {
  if (input.sizeBytes <= 0) return { ok: false, reason: "Datei ist leer." };
  if (input.sizeBytes > input.maxBytes) {
    return { ok: false, reason: `Datei überschreitet das Limit von ${input.maxBytes} Bytes.` };
  }

  const allowed = ALLOWED_UPLOADS[input.mimeType];
  const extension = path.extname(sanitizeFilename(input.filename)).toLowerCase();

  if (!allowed) return { ok: false, reason: `MIME-Typ ${input.mimeType} ist nicht erlaubt.` };
  if (!allowed.extensions.includes(extension)) {
    return { ok: false, reason: `Dateiendung ${extension || "(keine)"} passt nicht zum MIME-Typ.` };
  }

  return { ok: true, kind: allowed.kind };
}
