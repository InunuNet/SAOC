// Magic-byte detection for vendor uploads. Pure, no I/O: the declared MIME type is the caller's
// claim, the leading bytes are the file's own.

export type SniffedFileType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]; // RIFF at 0
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]; // WEBP at 8
const WEBP_TAG_OFFSET = 8;

export const FILE_CONTENT_MISMATCH_ERROR = 'File content does not match the declared type.';

// 16 base64 characters decode to 12 bytes: enough for every signature above (WebP needs 12).
const SNIFF_BASE64_CHARS = 16;

/** The first bytes of a base64 payload, decoded without decoding the whole file again. */
export function leadingBytes(fileBase64: string): Uint8Array {
  return Buffer.from(fileBase64.slice(0, SNIFF_BASE64_CHARS), 'base64');
}

function hasBytesAt(bytes: Uint8Array, magic: number[], offset: number): boolean {
  if (bytes.length < offset + magic.length) return false;
  return magic.every((byte, index) => bytes[offset + index] === byte);
}

export function sniffFileType(bytes: Uint8Array): SniffedFileType | null {
  if (hasBytesAt(bytes, PDF_MAGIC, 0)) return 'application/pdf';
  if (hasBytesAt(bytes, JPEG_MAGIC, 0)) return 'image/jpeg';
  if (hasBytesAt(bytes, PNG_MAGIC, 0)) return 'image/png';
  if (hasBytesAt(bytes, RIFF_MAGIC, 0) && hasBytesAt(bytes, WEBP_MAGIC, WEBP_TAG_OFFSET)) {
    return 'image/webp';
  }
  return null;
}

export function matchesDeclaredMime(bytes: Uint8Array, mime: string): boolean {
  const sniffed = sniffFileType(bytes);
  return sniffed !== null && sniffed === mime;
}
