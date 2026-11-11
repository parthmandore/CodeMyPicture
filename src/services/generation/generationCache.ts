/**
 * CodeMyPicture V4 — Intelligent Cache & Key Management
 *
 * Provides content-aware stable identity keys, intermediate preprocessed data caching,
 * and an LRU cache with automatic Blob URL revocation and memory bounds.
 */

import { ModeResult } from './types';
import { QualitySetting } from '../../engine/v4/tiers';
import { NormalizedLandmark } from '../faceDetection/types';
import { BiometricColorMetrics } from './types';

export interface PreprocessedPhotoData {
  effectiveCanvas: HTMLCanvasElement;
  effectiveImageData: ImageData;
  effectiveW: number;
  effectiveH: number;
  photoAccent: string;
  primaryLandmarks: NormalizedLandmark[];
  allFacesLandmarks: NormalizedLandmark[][];
  faceCount: number;
  colorMetrics: BiometricColorMetrics;
  categoryMask: { rawMask: Uint8Array; maskWidth: number; maskHeight: number } | null;
  imageKey: string;
  timestamp: number;
}

export function computeImageKey(
  source: { file?: File; url?: string; fileName?: string; width?: number; height?: number }
): string {
  const f = source.file;
  if (f && f.name && f.size) {
    return `img_${f.name}_${f.size}_${f.lastModified}_${source.width || 0}x${source.height || 0}`;
  }
  const name = source.fileName || (source.url?.split('/').pop()?.split('?')[0] || 'photo.jpg');
  return `url_${name}_${source.width || 0}x${source.height || 0}_${source.url || ''}`;
}

export function computeCacheKey(
  imageKey: string,
  mode: 'painting' | 'recreation',
  quality: QualitySetting,
  version: string = 'v4.2'
): string {
  return `${imageKey}::${mode}::${quality}::${version}`;
}

export class GenerationLRUCache {
  private maxEntries: number;
  private cache: Map<string, ModeResult> = new Map();

  constructor(maxEntries: number = 16) {
    this.maxEntries = maxEntries;
  }

  public get(key: string): ModeResult | undefined {
    const item = this.cache.get(key);
    if (item) {
      // Refresh position (LRU)
      this.cache.delete(key);
      this.cache.set(key, item);
    }
    return item;
  }

  public set(key: string, value: ModeResult): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const oldestVal = this.cache.get(oldestKey);
        if (oldestVal?.svgBlobUrl) {
          try {
            URL.revokeObjectURL(oldestVal.svgBlobUrl);
          } catch (_e) {}
        }
        if (oldestVal?.diffBlobUrl) {
          try {
            URL.revokeObjectURL(oldestVal.diffBlobUrl);
          } catch (_e) {}
        }
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }

  public has(key: string): boolean {
    return this.cache.has(key);
  }

  public clear(): void {
    for (const val of this.cache.values()) {
      if (val.svgBlobUrl) {
        try {
          URL.revokeObjectURL(val.svgBlobUrl);
        } catch (_e) {}
      }
      if (val.diffBlobUrl) {
        try {
          URL.revokeObjectURL(val.diffBlobUrl);
        } catch (_e) {}
      }
    }
    this.cache.clear();
  }
}
