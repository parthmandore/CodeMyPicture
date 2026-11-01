/**
 * CodeMyFace V4 — SVG Document Validator
 *
 * Validates that generated vector portraits:
 * 1. Are complete, non-truncated SVG documents with valid root and closing tags.
 * 2. Contain responsive viewBox attributes for independent opening.
 * 3. Contain zero embedded raster photographs (no <image> or base64 data URIs).
 * 4. Contain authentic vector paths and shapes.
 */

export interface SvgValidationResult {
  isValid: boolean;
  isComplete: boolean;
  hasViewBox: boolean;
  hasRasterBitmaps: boolean;
  pathCount: number;
  fileSizeBytes: number;
  errors: string[];
}

export function validateSvgDocument(svgString: string): SvgValidationResult {
  const errors: string[] = [];

  if (!svgString || typeof svgString !== 'string') {
    return {
      isValid: false,
      isComplete: false,
      hasViewBox: false,
      hasRasterBitmaps: false,
      pathCount: 0,
      fileSizeBytes: 0,
      errors: ['SVG content is empty or invalid type'],
    };
  }

  const trimmed = svgString.trim();
  const startsWithSvg = trimmed.includes('<svg');
  const endsWithSvg = trimmed.endsWith('</svg>');
  const hasViewBox = /viewBox=["'][^"']+["']/i.test(trimmed);
  const hasRasterBitmaps = /data:image\/(?:png|jpeg|jpg|webp);base64/i.test(trimmed) || /<image\b/i.test(trimmed);

  if (!startsWithSvg) {
    errors.push('Missing opening <svg> root element');
  }
  if (!endsWithSvg) {
    errors.push('Missing closing </svg> element (document truncated or incomplete)');
  }
  if (!hasViewBox) {
    errors.push('Missing viewBox attribute for standalone scaling');
  }
  if (hasRasterBitmaps) {
    errors.push('Forbidden embedded raster photograph or bitmap (<image>) detected in SVG markup');
  }

  const pathMatches = trimmed.match(/<path\b/gi);
  const pathCount = pathMatches ? pathMatches.length : 0;
  if (pathCount === 0) {
    errors.push('No vector <path> elements found in document');
  }

  const byteLength = new TextEncoder().encode(trimmed).length;

  return {
    isValid: errors.length === 0,
    isComplete: startsWithSvg && endsWithSvg,
    hasViewBox,
    hasRasterBitmaps,
    pathCount,
    fileSizeBytes: byteLength,
    errors,
  };
}
