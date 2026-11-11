/**
 * CodeMyFace V4 — Three-Tier Architecture & Centralized Settings
 *
 * Implements the 3-Tier Image-to-Code Recreation System:
 * - Tier 1 (High Quality): Closest photographic copy, largest, high SSIM, dedicated skin/hair levels.
 * - Tier 2 (Medium Quality): 40–60% of Tier 1 gzipped bytes, safe compound path merging.
 * - Tier 3 (Low Quality): 10–20% of Tier 1 gzipped bytes, saliency-weighted simplification, 10–12 colors.
 * - Target Size Mode: Adaptive binary search on parameters to meet a specific byte budget within +/-10%.
 */

import { optimizeSvgForExport, optimizeSvgAutoSelect } from './sizeOptimizer/exportOptimizer';
import { optimizeSvgDocument } from './svgOptimizer';
import { minifySvgDocument } from './sizeOptimizer/svgMinifier';
import type { NormalizedLandmark } from '../../services/faceDetection/types';

export type QualitySetting = 'high' | 'medium' | 'low';
export type QualityTier = QualitySetting | 'tier1' | 'tier2' | 'tier3';

export interface QualityConfig {
  id: QualitySetting;
  name: string;
  label: string;
  description: string;
  targetColors: number;
  skinColors: number;
  hairColors: number;
  pathOmitBase: number;
  ltres: number;
  qtres: number;
  underlayColors: number;
  underlayBlur: number;
  mergeCompoundPaths: boolean;
  precision: number;
  relativeCommands: boolean;
  saliencyWeighting: boolean;
  blurradius: number;
  blurdelta: number;
}

export type TierConfig = QualityConfig;

export const RECREATION_QUALITY_CONFIGS: Record<QualitySetting, QualityConfig> = {
  high: {
    id: 'high',
    name: 'High',
    label: 'High Quality',
    description: 'Closest photographic copy: dedicated 24 skin and 20 hair tones, fine contours intact.',
    targetColors: 48,
    skinColors: 24,
    hairColors: 20,
    pathOmitBase: 8,
    ltres: 1.0,
    qtres: 1.0,
    underlayColors: 10,
    underlayBlur: 3,
    mergeCompoundPaths: false,
    precision: 1,
    relativeCommands: true,
    saliencyWeighting: false,
    blurradius: 1,
    blurdelta: 16,
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    label: 'Medium Quality',
    description: 'Balanced recreation: dedicated 18 skin and 15 hair tones, 12 path omit, optimal detail balance.',
    targetColors: 32,
    skinColors: 18,
    hairColors: 15,
    pathOmitBase: 12,
    ltres: 0.9,
    qtres: 0.9,
    underlayColors: 10,
    underlayBlur: 3,
    mergeCompoundPaths: true,
    precision: 1,
    relativeCommands: true,
    saliencyWeighting: false,
    blurradius: 1,
    blurdelta: 16,
  },
  low: {
    id: 'low',
    name: 'Low',
    label: 'Low Quality',
    description: 'Balanced vector recreation: tuned from former Medium, preserved contours, safe compound merging.',
    targetColors: 24,
    skinColors: 14,
    hairColors: 12,
    pathOmitBase: 20, // tuned from 24 to preserve sharper contours without blur
    ltres: 1.0,
    qtres: 1.0,
    underlayColors: 8,
    underlayBlur: 3,
    mergeCompoundPaths: true,
    precision: 1,
    relativeCommands: true,
    saliencyWeighting: false,
    blurradius: 1,
    blurdelta: 16,
  },
};

export const TIER_CONFIGS: Record<string, QualityConfig> = {
  high: RECREATION_QUALITY_CONFIGS.high,
  medium: RECREATION_QUALITY_CONFIGS.medium,
  low: RECREATION_QUALITY_CONFIGS.low,
  tier1: RECREATION_QUALITY_CONFIGS.high,
  tier2: RECREATION_QUALITY_CONFIGS.medium,
  tier3: RECREATION_QUALITY_CONFIGS.low,
};

export interface PaintingQualityConfig {
  id: QualitySetting;
  name: string;
  label: string;
  description: string;
  targetColors: number;
  pathOmitBase: number;
  mergeCompoundPaths: boolean;
  precision: number;
  relativeCommands: boolean;
  saliencyWeighting: boolean;
  lashDetail: 'multi-pass' | 'single-pass';
  creaseLine: boolean;
  limbalGradient: boolean;
  dualCatchlight: boolean;
  softSkinFilter: boolean;
  softSkinRadius: number;
}

export type PaintingTierConfig = PaintingQualityConfig;

export const PAINTING_QUALITY_CONFIGS: Record<QualitySetting, PaintingQualityConfig> = {
  high: {
    id: 'high',
    name: 'High',
    label: 'High Quality',
    description: 'Detailed digital portrait: expressive anatomical planes, multi-pass lashes, limbal ring gradient, catchlight, soft skin filter.',
    targetColors: 48,
    pathOmitBase: 8,
    mergeCompoundPaths: false,
    precision: 1,
    relativeCommands: true,
    saliencyWeighting: false,
    lashDetail: 'multi-pass',
    creaseLine: true,
    limbalGradient: true,
    dualCatchlight: true,
    softSkinFilter: true,
    softSkinRadius: 1.2,
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    label: 'Medium Quality',
    description: 'Balanced digital portrait: harmonious planar modeling, 36 colors, single-pass lashes, soft skin filter.',
    targetColors: 36,
    pathOmitBase: 14,
    mergeCompoundPaths: true,
    precision: 1,
    relativeCommands: true,
    saliencyWeighting: false,
    lashDetail: 'single-pass',
    creaseLine: false,
    limbalGradient: true,
    dualCatchlight: false,
    softSkinFilter: true,
    softSkinRadius: 1.0,
  },
  low: {
    id: 'low',
    name: 'Low',
    label: 'Low Quality',
    description: 'Balanced painterly brushwork: single-pass lashes, primary catchlight, safe path merging (tuned from former Medium).',
    targetColors: 24,
    pathOmitBase: 20,
    mergeCompoundPaths: true,
    precision: 1,
    relativeCommands: true,
    saliencyWeighting: false,
    lashDetail: 'single-pass',
    creaseLine: false,
    limbalGradient: true,
    dualCatchlight: false,
    softSkinFilter: true,
    softSkinRadius: 0.8,
  },
};

export const PAINTING_TIER_CONFIGS: Record<string, PaintingQualityConfig> = {
  high: PAINTING_QUALITY_CONFIGS.high,
  medium: PAINTING_QUALITY_CONFIGS.medium,
  low: PAINTING_QUALITY_CONFIGS.low,
  tier1: PAINTING_QUALITY_CONFIGS.high,
  tier2: PAINTING_QUALITY_CONFIGS.medium,
  tier3: PAINTING_QUALITY_CONFIGS.low,
};

export interface QualityExecutionResult {
  quality: QualitySetting;
  svgString: string;
  rawBytes: number;
  gzipBytes: number;
  pathCount: number;
  nodeCount: number;
  ssim: number;
  psnr: number;
  colorError: number;
  skinColorError?: number;
  executionTimeMs: number;
  isFallback?: boolean;
}

export interface AllQualitiesResult {
  high: QualityExecutionResult;
  medium?: QualityExecutionResult;
  low: QualityExecutionResult;
  selectedQuality: QualitySetting;
  // Compatibility aliases
  tier1: QualityExecutionResult;
  tier2: QualityExecutionResult;
  tier3: QualityExecutionResult;
  selectedTier: string;
}

export type TierExecutionResult = QualityExecutionResult;
export type AllTiersResult = AllQualitiesResult;

/**
 * Safely merges existing and incoming tier results so that genuine (non-fallback)
 * results are permanently preserved across quality switches and background synthesis.
 */
export function mergeTiersData(
  existing?: AllQualitiesResult | null,
  incoming?: AllQualitiesResult | null
): AllQualitiesResult | undefined {
  if (!existing) return incoming || undefined;
  if (!incoming) return existing;

  const pickTier = (key: 'high' | 'medium' | 'low'): QualityExecutionResult | undefined => {
    const inc = incoming[key];
    const ext = existing[key];
    // If incoming is genuine (not a fallback and has SVG), use incoming
    if (inc && !inc.isFallback && inc.svgString) return inc;
    // Otherwise, if existing is genuine, preserve existing!
    if (ext && !ext.isFallback && ext.svgString) return ext;
    // If neither is genuine, return whichever exists
    return inc || ext;
  };

  const high = pickTier('high') || existing.high || incoming.high;
  const medium = pickTier('medium') || existing.medium || incoming.medium;
  const low = pickTier('low') || existing.low || incoming.low;

  const selectedQuality = incoming.selectedQuality || existing.selectedQuality || 'high';

  return {
    high,
    medium,
    low,
    selectedQuality,
    tier1: high,
    tier2: medium || low,
    tier3: low,
    selectedTier: incoming.selectedTier || existing.selectedTier || selectedQuality,
  };
}

/**
 * Computes PSNR (Peak Signal-to-Noise Ratio) between two identical-size RGBA buffers.
 */
export function computePSNR(
  dataA: Uint8ClampedArray | Uint8Array,
  dataB: Uint8ClampedArray | Uint8Array,
  totalPixels: number
): number {
  let mse = 0;
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const dr = dataA[idx] - dataB[idx];
    const dg = dataA[idx + 1] - dataB[idx + 1];
    const db = dataA[idx + 2] - dataB[idx + 2];
    mse += (dr * dr + dg * dg + db * db) / 3;
  }
  mse /= totalPixels;
  if (mse <= 0.0001) return 99.9; // Identical
  return Math.round((10 * Math.log10((255 * 255) / mse)) * 10) / 10;
}

/**
 * Fast estimation or exact calculation of gzipped bytes.
 */
export function estimateGzipBytes(str: string): number {
  try {
    // @ts-ignore
    const zlib = typeof require !== 'undefined' ? require('zlib') : null;
    if (zlib?.gzipSync) {
      const buf = typeof (globalThis as any).Buffer !== 'undefined'
        ? (globalThis as any).Buffer.from(str, 'utf8')
        : new TextEncoder().encode(str);
      return zlib.gzipSync(buf).length;
    }
  } catch (_e) {}
  const raw = new TextEncoder().encode(str).length;
  return Math.round(raw * 0.28);
}

/**
 * Applies saliency weighting to an SVG document.
 * Protects fine facial features from omission while simplifying background micro-paths.
 */
export function applySaliencyWeighting(
  svgString: string,
  landmarks?: NormalizedLandmark[],
  width?: number,
  height?: number,
  minBgAreaPx: number = 64
): string {
  if (!landmarks || landmarks.length === 0 || !width || !height) {
    return svgString;
  }

  // Calculate face bounding box with generous padding
  let minX = 1.0, maxX = 0.0, minY = 1.0, maxY = 0.0;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  }

  const faceBox = {
    x0: Math.max(0, (minX - 0.1) * width),
    x1: Math.min(width, (maxX + 0.1) * width),
    y0: Math.max(0, (minY - 0.15) * height),
    y1: Math.min(height, (maxY + 0.15) * height),
  };

  return svgString.replace(/<path\b([^>]*)\/?>/gi, (match) => {
    // Preserve underlay paths and base rectangle
    if (match.includes('v4-underlay-path') || match.includes('v4-base-rect')) {
      return match;
    }

    const dMatch = match.match(/\bd="([^"]*)"/i);
    if (!dMatch) return match;

    const d = dMatch[1];
    const nums = d.match(/[-+]?\d*\.?\d+/g);
    if (!nums || nums.length < 4) return match;

    let pMinX = Infinity, pMaxX = -Infinity, pMinY = Infinity, pMaxY = -Infinity;
    for (let i = 0; i < nums.length - 1; i += 2) {
      const x = parseFloat(nums[i]);
      const y = parseFloat(nums[i + 1]);
      if (!isNaN(x) && !isNaN(y)) {
        if (x < pMinX) pMinX = x;
        if (x > pMaxX) pMaxX = x;
        if (y < pMinY) pMinY = y;
        if (y > pMaxY) pMaxY = y;
      }
    }

    const boxW = Math.max(0, pMaxX - pMinX);
    const boxH = Math.max(0, pMaxY - pMinY);
    const area = boxW * boxH;

    // Check if path overlaps face bounding box
    const overlapsFace =
      pMaxX >= faceBox.x0 &&
      pMinX <= faceBox.x1 &&
      pMaxY >= faceBox.y0 &&
      pMinY <= faceBox.y1;

    if (!overlapsFace && area < minBgAreaPx) {
      // Omit small background noise path
      return '';
    }

    return match;
  });
}

/**
 * Optimizes SVG export tailored to a specific tier config.
 */
export function optimizeSvgForTier(
  svgString: string,
  tier: QualitySetting | string,
  context?: {
    landmarks?: NormalizedLandmark[];
    width?: number;
    height?: number;
  }
): { svg: string; rawBytes: number; gzipBytes: number; pathCount: number } {
  let processedSvg = svgString;

  if (tier === 'low' || tier === 'tier2' || tier === 'tier3') {
    // Tier 3: Apply saliency weighting first to drop non-facial micro-shapes
    processedSvg = applySaliencyWeighting(
      processedSvg,
      context?.landmarks,
      context?.width,
      context?.height,
      64
    );

    processedSvg = optimizeSvgForExport(processedSvg, {
      mergeCompoundPaths: true,
      relativeCommands: true,
      precision: 0,
      shortHex: true,
      stripWhitespace: true,
      removeRedundantStrokes: true,
    });
  } else if (tier === 'tier2') {
    // Tier 2: Safe compound path merging + 1 decimal precision
    processedSvg = optimizeSvgForExport(processedSvg, {
      mergeCompoundPaths: true,
      relativeCommands: true,
      precision: 1,
      shortHex: true,
      stripWhitespace: true,
      removeRedundantStrokes: true,
    });
  } else {
    // Tier 1: Auto-select relative vs absolute for smallest lossless compression
    const auto = optimizeSvgAutoSelect(processedSvg, {
      mergeCompoundPaths: false,
      shortHex: true,
      stripWhitespace: true,
      removeRedundantStrokes: true,
    });
    processedSvg = auto.svg;
  }

  const rawBytes = new TextEncoder().encode(processedSvg).length;
  const gzipBytes = estimateGzipBytes(processedSvg);
  const pathMatches = processedSvg.match(/<path\b[^>]*\/?>/gi) || [];

  return {
    svg: processedSvg,
    rawBytes,
    gzipBytes,
    pathCount: pathMatches.length,
  };
}

/**
 * Optimizes Painting SVG export tailored to a specific tier config.
 * Preserves anatomical features, clips, and filter definitions while optimizing geometry.
 */
export function optimizePaintingSvgForTier(
  svgString: string,
  tier: QualitySetting | string,
  context?: {
    landmarks?: NormalizedLandmark[];
    width?: number;
    height?: number;
  }
): { svg: string; rawBytes: number; gzipBytes: number; pathCount: number } {
  let processedSvg = svgString;

  if (tier === 'low' || tier === 'tier2' || tier === 'tier3') {
    // Tier 3: Apply saliency weighting first to drop non-facial micro-shapes in base vector
    processedSvg = applySaliencyWeighting(
      processedSvg,
      context?.landmarks,
      context?.width,
      context?.height,
      64
    );

    // Merge compound paths in base vector leaf groups
    processedSvg = optimizeSvgDocument(processedSvg);

    // Minify with integer coordinates
    processedSvg = minifySvgDocument(processedSvg, {
      preset: 'compact',
      relativeCommands: true,
      scale2xViewBox: false,
      simplifyTolerancePx: 0.3,
    });
  } else if (tier === 'tier2') {
    // Tier 2: Safe compound path merging in base vector leaf groups
    processedSvg = optimizeSvgDocument(processedSvg);

    // Minify with balanced settings (precision 1)
    processedSvg = minifySvgDocument(processedSvg, {
      preset: 'balanced',
      relativeCommands: true,
      scale2xViewBox: false,
      simplifyTolerancePx: 0.15,
    });
  } else {
    // Tier 1: Keep unmerged paths in base vector, lossless color and coordinate minification
    processedSvg = minifySvgDocument(processedSvg, {
      preset: 'max',
      relativeCommands: true,
      scale2xViewBox: false,
      simplifyTolerancePx: 0,
    });
  }

  // Strip extraneous whitespace between tags
  processedSvg = processedSvg
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const rawBytes = new TextEncoder().encode(processedSvg).length;
  const gzipBytes = estimateGzipBytes(processedSvg);
  const pathMatches = processedSvg.match(/<path\b[^>]*\/?>/gi) || [];

  return {
    svg: processedSvg,
    rawBytes,
    gzipBytes,
    pathCount: pathMatches.length,
  };
}

export interface TargetSizeResult {
  targetGzipBytes: number;
  actualGzipBytes: number;
  actualRawBytes: number;
  svgString: string;
  pathCount: number;
  params: {
    precision: number;
    mergeCompoundPaths: boolean;
    saliencyMinArea: number;
  };
  iterations: number;
  withinTolerance: boolean;
}

/**
 * Binary search over tier parameters to hit a user-specified byte budget within +/-10%.
 */
export function binarySearchTargetSize(
  baseSvg: string,
  targetGzipBytes: number,
  context?: {
    landmarks?: NormalizedLandmark[];
    width?: number;
    height?: number;
  }
): TargetSizeResult {
  const tolerance = targetGzipBytes * 0.10;
  const minTarget = targetGzipBytes - tolerance;
  const maxTarget = targetGzipBytes + tolerance;

  let bestSvg = baseSvg;
  let bestGzip = estimateGzipBytes(baseSvg);
  let bestParams = { precision: 1, mergeCompoundPaths: false, saliencyMinArea: 0 };
  let bestDiff = Math.abs(bestGzip - targetGzipBytes);

  // Parameter space exploration (fast discrete step evaluations)
  const candidateParams = [
    { precision: 1, mergeCompoundPaths: false, saliencyMinArea: 0 },
    { precision: 1, mergeCompoundPaths: true, saliencyMinArea: 0 },
    { precision: 1, mergeCompoundPaths: true, saliencyMinArea: 32 },
    { precision: 0, mergeCompoundPaths: true, saliencyMinArea: 48 },
    { precision: 0, mergeCompoundPaths: true, saliencyMinArea: 96 },
    { precision: 0, mergeCompoundPaths: true, saliencyMinArea: 160 },
  ];

  let iterations = 0;
  for (const p of candidateParams) {
    iterations++;
    let candidateSvg = baseSvg;
    if (p.saliencyMinArea > 0 && context?.landmarks && context.width && context.height) {
      candidateSvg = applySaliencyWeighting(
        candidateSvg,
        context.landmarks,
        context.width,
        context.height,
        p.saliencyMinArea
      );
    }

    candidateSvg = optimizeSvgForExport(candidateSvg, {
      mergeCompoundPaths: p.mergeCompoundPaths,
      relativeCommands: true,
      precision: p.precision,
      shortHex: true,
      stripWhitespace: true,
      removeRedundantStrokes: true,
    });

    const gz = estimateGzipBytes(candidateSvg);
    const diff = Math.abs(gz - targetGzipBytes);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestGzip = gz;
      bestSvg = candidateSvg;
      bestParams = p;
    }

    if (gz >= minTarget && gz <= maxTarget) {
      break;
    }
  }

  const rawBytes = new TextEncoder().encode(bestSvg).length;
  const pathCount = (bestSvg.match(/<path\b[^>]*\/?>/gi) || []).length;

  return {
    targetGzipBytes,
    actualGzipBytes: bestGzip,
    actualRawBytes: rawBytes,
    svgString: bestSvg,
    pathCount,
    params: bestParams,
    iterations,
    withinTolerance: bestGzip >= minTarget && bestGzip <= maxTarget,
  };
}
