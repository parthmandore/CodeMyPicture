/**
 * CodeMyFace — Face & Hair Segmentation Service
 *
 * Runs client-side local segmentation using MediaPipe ImageSegmenter
 * with the official Google selfie_multiclass_256x256 model:
 *
 * Semantic Classes:
 * 0: Background
 * 1: Hair
 * 2: Body-skin
 * 3: Face-skin
 * 4: Clothes
 * 5: Others
 *
 * Pure browser execution via WebAssembly / WebGL with zero server roundtrips.
 * Gracefully falls back to landmark-guided boundary analysis if model assets
 * cannot be loaded.
 */
import {
  FilesetResolver,
  ImageSegmenter,
} from '@mediapipe/tasks-vision';
import { Vec2 } from '../../types/portrait';
import { FacialFeatures } from '../../types/portrait';
import { extractHairGeometryFromMask, extractRadialMaskContour } from './contourExtractor';

export interface HairSegmentationResult {
  hasHairSegmentation: boolean;
  provenance: 'segmentation-mask-derived' | 'fallback';
  hairContourPoints?: Vec2[];
  silhouettePoints?: Vec2[];
  backHairPoints?: Vec2[];
  hairlinePoints?: Vec2[];
  hairDetectedConfidence?: number;
  maskWidth?: number;
  maskHeight?: number;
  rawMask?: Uint8Array;
  metrics?: {
    hairPixelCount: number;
    totalPixels: number;
    hairRatio: number;
    hasLongHair: boolean;
    hasLongHairLeft: boolean;
    hasLongHairRight: boolean;
    leftMaxY: number;
    rightMaxY: number;
    apexY: number;
    isAsymmetric: boolean;
    parting: 'middle' | 'side' | 'open' | 'bangs';
    clothesPixelCountAroundNeck: number;
  };
}

// Prioritize local same-origin assets for performance and offline reliability
const DEFAULT_WASM_PATH = '/wasm';
const DEFAULT_SEGMENTER_MODEL_PATH = '/selfie_multiclass_256x256.tflite';

const CDN_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm';
const CDN_SEGMENTER_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';

export class SegmentationService {
  private static instance: SegmentationService | null = null;
  private segmenter: ImageSegmenter | null = null;
  private initPromise: Promise<boolean> | null = null;
  private isAvailable: boolean = false;

  private constructor() {}

  public static getInstance(): SegmentationService {
    if (!SegmentationService.instance) {
      SegmentationService.instance = new SegmentationService();
    }
    return SegmentationService.instance;
  }

  public async initialize(
    wasmPath: string = DEFAULT_WASM_PATH,
    modelPath: string = DEFAULT_SEGMENTER_MODEL_PATH
  ): Promise<boolean> {
    if (this.segmenter && this.isAvailable) return true;
    if (this.initPromise) return this.initPromise;

    const tryCreateSegmenter = async (wPath: string, mPath: string): Promise<ImageSegmenter | null> => {
      try {
        const vision = await FilesetResolver.forVisionTasks(wPath);
        return await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: mPath,
            delegate: 'GPU',
          },
          runningMode: 'IMAGE',
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
      } catch (gpuErr) {
        try {
          const vision = await FilesetResolver.forVisionTasks(wPath);
          return await ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: mPath,
              delegate: 'CPU',
            },
            runningMode: 'IMAGE',
            outputCategoryMask: true,
            outputConfidenceMasks: false,
          });
        } catch {
          return null;
        }
      }
    };

    this.initPromise = (async () => {
      let segmenter = await tryCreateSegmenter(wasmPath, modelPath);
      if (!segmenter && wasmPath === DEFAULT_WASM_PATH) {
        // Fallback to CDN
        segmenter = await tryCreateSegmenter(CDN_WASM_PATH, CDN_SEGMENTER_MODEL_PATH);
      }
      if (segmenter) {
        this.segmenter = segmenter;
        this.isAvailable = true;
        return true;
      }
      console.warn(
        'ImageSegmenter unavailable (network or environment restriction). Using landmark-guided heuristic fallback.'
      );
      this.isAvailable = false;
      this.segmenter = null;
      return false;
    })();

    return this.initPromise;
  }

  /**
   * Retrieves the raw multi-class semantic category mask
   * Classes: 0: Background, 1: Hair, 2: Body-skin, 3: Face-skin, 4: Clothes, 5: Others
   */
  public async segmentCategoryMask(
    source: HTMLImageElement | HTMLCanvasElement
  ): Promise<{ rawMask: Uint8Array; maskWidth: number; maskHeight: number } | null> {
    if (!this.segmenter || !this.isAvailable) {
      return null;
    }
    try {
      const segmentationResult = this.segmenter.segment(source);
      const categoryMask = segmentationResult.categoryMask;
      if (!categoryMask) return null;
      const maskWidth = categoryMask.width;
      const maskHeight = categoryMask.height;
      const rawMask = new Uint8Array(categoryMask.getAsUint8Array());
      categoryMask.close();
      return { rawMask, maskWidth, maskHeight };
    } catch (err) {
      console.warn('Category mask segmentation error:', err);
      return null;
    }
  }

  /**
   * Performs local hair boundary segmentation
   *
   * @param source HTMLImageElement to segment
   * @param headCenter Normalized head center point [0, 1]
   * @param features Optional full facial features for high-precision anatomical extraction
   */
  public async segmentHair(
    source: HTMLImageElement,
    headCenter: Vec2,
    features?: FacialFeatures
  ): Promise<HairSegmentationResult> {
    if (!this.segmenter || !this.isAvailable) {
      return { hasHairSegmentation: false, provenance: 'fallback' };
    }

    try {
      const segmentationResult = this.segmenter.segment(source);
      const categoryMask = segmentationResult.categoryMask;

      if (!categoryMask) {
        return { hasHairSegmentation: false, provenance: 'fallback' };
      }

      const maskWidth = categoryMask.width;
      const maskHeight = categoryMask.height;
      const maskData = new Uint8Array(categoryMask.getAsUint8Array());
      categoryMask.close();

      // If full FacialFeatures is available, perform full mask geometry extraction
      if (features) {
        const maskGeometry = extractHairGeometryFromMask(
          maskData,
          maskWidth,
          maskHeight,
          features
        );

        return {
          hasHairSegmentation: maskGeometry.hasHair,
          provenance: maskGeometry.provenance,
          hairContourPoints: maskGeometry.silhouettePoints,
          silhouettePoints: maskGeometry.silhouettePoints,
          backHairPoints: maskGeometry.backHairPoints,
          hairlinePoints: maskGeometry.hairlinePoints,
          hairDetectedConfidence: maskGeometry.confidence,
          maskWidth,
          maskHeight,
          rawMask: maskData,
          metrics: maskGeometry.metrics,
        };
      }

      // Fallback for calls without features (e.g. headless tests)
      let hairPixelCount = 0;
      for (let i = 0; i < maskData.length; i++) {
        if (maskData[i] === 1) hairPixelCount++;
      }
      const hairRatio = hairPixelCount / maskData.length;
      if (hairRatio < 0.005) {
        return {
          hasHairSegmentation: false,
          provenance: 'fallback',
          hairDetectedConfidence: 0,
        };
      }

      const contourPoints = extractRadialMaskContour(
        maskData,
        maskWidth,
        maskHeight,
        headCenter,
        1,
        36,
        0.60
      );

      return {
        hasHairSegmentation: contourPoints.length >= 6,
        provenance: 'segmentation-mask-derived',
        hairContourPoints: contourPoints.length >= 6 ? contourPoints : undefined,
        silhouettePoints: contourPoints.length >= 6 ? contourPoints : undefined,
        hairDetectedConfidence: Math.min(1, hairRatio * 10),
        maskWidth,
        maskHeight,
        rawMask: maskData,
      };
    } catch (err) {
      console.warn('Hair segmentation inference error:', err);
      return { hasHairSegmentation: false, provenance: 'fallback' };
    }
  }
}
