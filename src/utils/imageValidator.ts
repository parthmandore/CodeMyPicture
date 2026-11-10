import { UploadError, UploadErrorCode } from '../types/upload';
import { formatBytes } from './formatters';

export const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type SupportedMimeType = typeof SUPPORTED_MIME_TYPES[number];

export interface ValidationConfig {
  maxSizeBytes?: number;
  allowedMimeTypes?: readonly string[];
  checkMagicBytes?: boolean;
}

export function createUploadError(
  code: UploadErrorCode,
  message: string,
  details?: string
): UploadError {
  return {
    code,
    message,
    details,
    timestamp: Date.now(),
  };
}

/**
 * Validates a file against size, MIME type, and binary header (magic bytes)
 */
export async function validateImageFile(
  file: File,
  config: ValidationConfig = {}
): Promise<{ valid: true; mimeType: SupportedMimeType } | { valid: false; error: UploadError }> {
  const maxBytes = config.maxSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
  const allowedMimes = config.allowedMimeTypes ?? SUPPORTED_MIME_TYPES;

  // 1. Check for empty file
  if (!file || file.size === 0) {
    return {
      valid: false,
      error: createUploadError(
        'EMPTY_FILE',
        'Selected file is empty (0 bytes).',
        'Please select a valid photographic image with actual content.'
      ),
    };
  }

  // 2. Check file size
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: createUploadError(
        'FILE_TOO_LARGE',
        `File exceeds maximum upload size of ${formatBytes(maxBytes)}.`,
        `The selected file is ${formatBytes(file.size)}. Please compress or crop your photo to under ${formatBytes(maxBytes)}.`
      ),
    };
  }

  // 3. Check declared MIME type
  const normalizedMime = file.type.toLowerCase().trim();
  const isDeclaredMimeSupported = allowedMimes.includes(normalizedMime as SupportedMimeType);

  // If MIME is missing or empty, attempt extension-based heuristic check
  let detectedMime: SupportedMimeType | null = isDeclaredMimeSupported ? (normalizedMime as SupportedMimeType) : null;

  if (!detectedMime) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      detectedMime = 'image/jpeg';
    } else if (name.endsWith('.png')) {
      detectedMime = 'image/png';
    } else if (name.endsWith('.webp')) {
      detectedMime = 'image/webp';
    }
  }

  if (!detectedMime || !allowedMimes.includes(detectedMime)) {
    return {
      valid: false,
      error: createUploadError(
        'UNSUPPORTED_TYPE',
        `Unsupported file format: ${file.type || 'unknown format'}`,
        'CodeMyPicture supports standard portrait images in JPEG, PNG, or WebP formats only.'
      ),
    };
  }

  // 4. Binary header / magic bytes verification
  if (config.checkMagicBytes !== false) {
    try {
      const headerBytes = await readHeaderBytes(file, 16);
      const headerValid = verifyImageHeader(headerBytes, detectedMime);

      if (!headerValid) {
        return {
          valid: false,
          error: createUploadError(
            'CORRUPT_IMAGE',
            'File contents do not match a valid image format.',
            'The file header appears corrupted or has an incorrect file extension.'
          ),
        };
      }
    } catch {
      return {
        valid: false,
        error: createUploadError(
          'READ_ERROR',
          'Failed to read image file binary data.',
          'Your browser could not access this file. Please check file permissions or re-select it.'
        ),
      };
    }
  }

  return {
    valid: true,
    mimeType: detectedMime,
  };
}

/**
 * Reads the first N bytes of a file slice into a Uint8Array
 */
async function readHeaderBytes(file: File, length: number): Promise<Uint8Array> {
  const slice = file.slice(0, length);
  const arrayBuffer = await slice.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Checks magic byte signatures for JPEG, PNG, and WebP
 */
function verifyImageHeader(bytes: Uint8Array, expectedMime: SupportedMimeType): boolean {
  if (bytes.length < 4) return false;

  // JPEG: FF D8 FF
  if (expectedMime === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (expectedMime === 'image/png') {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }

  // WebP: RIFF (bytes 0-3) ... WEBP (bytes 8-11)
  if (expectedMime === 'image/webp') {
    if (bytes.length < 12) return false;
    const isRiff =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46; // 'RIFF'
    const isWebp =
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50; // 'WEBP'
    return isRiff && isWebp;
  }

  return false;
}
