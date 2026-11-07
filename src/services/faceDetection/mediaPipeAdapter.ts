import {
  FilesetResolver,
  FaceLandmarker,
} from '@mediapipe/tasks-vision';
import {
  DetectedFace,
  FaceDetectionConfig,
  FaceDetectionResult,
  FaceDetectionState,
  IFaceDetectionService,
  NormalizedLandmark,
} from './types';

// Configuration endpoints for MediaPipe Face Landmarker
// Local same-origin endpoints prioritized for performance, HTTP/2 multiplexing, and zero third-party latency
const DEFAULT_WASM_PATH = '/wasm';
const DEFAULT_MODEL_PATH = '/face_landmarker.task';

const CDN_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm';
const CDN_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

import { HeadPose } from '../../types/portrait';

/**
 * Safely computes head pose Euler angles (pitch, yaw, roll in degrees)
 * from a 4x4 column-major transformation matrix or geometric landmarks fallback.
 */
export function computePoseAngles(
  matrix?: number[],
  landmarks?: NormalizedLandmark[]
): HeadPose {
  if (matrix && matrix.length >= 16) {
    const r02 = matrix[8];
    const r10 = matrix[1], r11 = matrix[5], r12 = matrix[9];
    const r22 = matrix[10];

    if (Number.isFinite(r12) && Number.isFinite(r02) && Number.isFinite(r22) && Number.isFinite(r10) && Number.isFinite(r11)) {
      const pitch = Math.asin(Math.max(-1, Math.min(1, -r12))) * (180 / Math.PI);
      const yaw = Math.atan2(r02, r22) * (180 / Math.PI);
      const roll = Math.atan2(r10, r11) * (180 / Math.PI);
      return {
        pitch: Math.round(pitch * 10) / 10,
        yaw: Math.round(yaw * 10) / 10,
        roll: Math.round(roll * 10) / 10,
        source: 'transformation-matrix',
      };
    }
  }

  // Fallback to geometric landmark estimation
  if (landmarks && landmarks.length >= 33) {
    const leftEye = landmarks[33] || { x: 0.38, y: 0.38, z: 0 };
    const rightEye = landmarks[263] || (landmarks.length > 8 ? landmarks[8] : { x: 0.62, y: 0.38, z: 0 });
    const noseTip = (landmarks.length > 4 ? landmarks[4] : null) || { x: 0.50, y: 0.52, z: 0 };
    const chin = (landmarks.length > 152 ? landmarks[152] : null) || { x: 0.50, y: 0.82, z: 0 };
    const forehead = (landmarks.length > 10 ? landmarks[10] : null) || { x: 0.50, y: 0.22, z: 0 };

    const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const eyeDist = Math.max(0.01, Math.abs(rightEye.x - leftEye.x));
    const yawRatio = (noseTip.x - eyeMidX) / eyeDist;
    const yaw = Math.max(-45, Math.min(45, yawRatio * 90));

    const eyeMidY = (leftEye.y + rightEye.y) / 2;
    const faceH = Math.max(0.01, chin.y - forehead.y);
    const noseYRatio = (noseTip.y - eyeMidY) / faceH;
    const pitch = Math.max(-40, Math.min(40, (0.35 - noseYRatio) * 120));

    return {
      pitch: Math.round(pitch * 10) / 10,
      yaw: Math.round(yaw * 10) / 10,
      roll: Math.round(roll * 10) / 10,
      source: 'geometric-landmark-estimate',
    };
  }

  return { pitch: 0, yaw: 0, roll: 0, source: 'geometric-landmark-estimate' };
}

export class MediaPipeFaceDetectionAdapter implements IFaceDetectionService {
  private state: FaceDetectionState = 'uninitialized';
  private errorMessage: string | null = null;
  private landmarker: FaceLandmarker | null = null;
  private listeners: Set<(state: FaceDetectionState, error: string | null) => void> = new Set();
  private initPromise: Promise<boolean> | null = null;

  public getState(): FaceDetectionState {
    return this.state;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public subscribe(
    listener: (state: FaceDetectionState, error: string | null) => void
  ): () => void {
    this.listeners.add(listener);
    // Notify immediately of current state
    listener(this.state, this.errorMessage);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(state: FaceDetectionState, error: string | null = null): void {
    this.state = state;
    this.errorMessage = error;
    this.listeners.forEach((listener) => {
      try {
        listener(this.state, this.errorMessage);
      } catch (err) {
        console.error('Error in face detection state listener:', err);
      }
    });
  }

  public async initialize(config: FaceDetectionConfig = {}): Promise<boolean> {
    // If already initialized, return immediately
    if (this.state === 'ready' && this.landmarker) {
      return true;
    }

    // If an initialization is in flight, reuse it
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize(config);
    try {
      const success = await this.initPromise;
      return success;
    } finally {
      this.initPromise = null;
    }
  }

  private async doInitialize(config: FaceDetectionConfig): Promise<boolean> {
    this.setState('initializing', null);

    const wasmPath = config.wasmPath || DEFAULT_WASM_PATH;
    const modelAssetPath = config.modelAssetPath || DEFAULT_MODEL_PATH;
    const preferredDelegate = config.delegate || 'GPU';
    const maxFaces = config.maxFaces || 4;

    const tryInitWithPaths = async (wasm: string, model: string): Promise<FaceLandmarker> => {
      const vision = await FilesetResolver.forVisionTasks(wasm);
      let landmarkerInstance: FaceLandmarker | null = null;
      let lastErr: unknown = null;

      try {
        landmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: model,
            delegate: preferredDelegate,
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'IMAGE',
          numFaces: maxFaces,
        });
      } catch (gpuError) {
        lastErr = gpuError;
        if (preferredDelegate === 'GPU') {
          try {
            landmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: model,
                delegate: 'CPU',
              },
              outputFaceBlendshapes: true,
              outputFacialTransformationMatrixes: true,
              runningMode: 'IMAGE',
              numFaces: maxFaces,
            });
          } catch (cpuError) {
            lastErr = cpuError;
          }
        }
      }

      if (!landmarkerInstance) {
        throw lastErr || new Error('Failed to create FaceLandmarker instance');
      }
      return landmarkerInstance;
    };

    try {
      try {
        this.landmarker = await tryInitWithPaths(wasmPath, modelAssetPath);
      } catch (localErr) {
        if (!config.wasmPath && !config.modelAssetPath) {
          console.warn('Local WASM/Model load failed, attempting CDN fallback:', localErr);
          this.landmarker = await tryInitWithPaths(CDN_WASM_PATH, CDN_MODEL_PATH);
        } else {
          throw localErr;
        }
      }

      this.setState('ready', null);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.landmarker = null;
      this.setState(
        'error',
        `Failed to initialize MediaPipe Face Landmarker: ${msg}. Check network connectivity to model and WASM assets.`
      );
      return false;
    }
  }

  public async detect(
    source: HTMLImageElement | ImageBitmap | HTMLCanvasElement
  ): Promise<FaceDetectionResult> {
    if (this.state !== 'ready' || !this.landmarker) {
      // If currently initializing, await in-flight initialization
      if (this.initPromise) {
        const initialized = await this.initPromise;
        if (!initialized || !this.landmarker) {
          return {
            detected: false,
            faceCount: 0,
            errorMessage: this.errorMessage || 'Face detection engine failed to initialize.',
            timestamp: Date.now(),
          };
        }
      } else if (this.state === 'uninitialized') {
        const initialized = await this.initialize();
        if (!initialized || !this.landmarker) {
          return {
            detected: false,
            faceCount: 0,
            errorMessage: this.errorMessage || 'Face detection engine is not initialized.',
            timestamp: Date.now(),
          };
        }
      } else {
        return {
          detected: false,
          faceCount: 0,
          errorMessage: this.errorMessage || 'Face detection engine is not ready.',
          timestamp: Date.now(),
        };
      }
    }

    const previousState = this.state;
    this.setState('detecting', null);
    const startTime = performance.now();

    try {
      const detectionResult = this.landmarker.detect(source);
      const latencyMs = Math.round(performance.now() - startTime);

      const rawLandmarks = detectionResult.faceLandmarks;
      const rawBlendshapes = detectionResult.faceBlendshapes;
      const rawMatrices = detectionResult.facialTransformationMatrixes;
      if (!rawLandmarks || rawLandmarks.length === 0) {
        this.setState(previousState, null);
        return {
          detected: false,
          faceCount: 0,
          latencyMs,
          timestamp: Date.now(),
        };
      }

      const detectedFaces: (DetectedFace & { score: number })[] = rawLandmarks.map((facePts, idx) => {
        const lms: NormalizedLandmark[] = facePts.map((pt) => ({
          x: pt.x,
          y: pt.y,
          z: pt.z,
        }));

        let blendshapes: Record<string, number> | undefined;
        if (rawBlendshapes && rawBlendshapes[idx]?.categories) {
          blendshapes = {};
          for (const cat of rawBlendshapes[idx].categories) {
            blendshapes[cat.categoryName] = Math.round(cat.score * 1000) / 1000;
          }
        }

        let matrixData: number[] | undefined;
        if (rawMatrices && rawMatrices[idx]?.data) {
          matrixData = Array.from(rawMatrices[idx].data);
        }

        const pose = computePoseAngles(matrixData, lms);

        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (const pt of lms) {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }

        const margin = 0.04;
        const bMinX = Math.max(0, minX - margin);
        const bMinY = Math.max(0, minY - margin);
        const bMaxX = Math.min(1, maxX + margin);
        const bMaxY = Math.min(1, maxY + margin);
        const width = bMaxX - bMinX;
        const height = bMaxY - bMinY;
        const area = width * height;
        const centerX = bMinX + width / 2;
        const centerY = bMinY + height / 2;
        const centerDistance = Math.hypot(centerX - 0.5, centerY - 0.5);

        // Deterministic score: large foreground faces near center score highest
        const score = area * 10 - centerDistance;

        return {
          index: idx,
          landmarks: lms,
          boundingBox: {
            xMin: bMinX,
            yMin: bMinY,
            width,
            height,
          },
          area,
          centerDistance,
          blendshapes,
          facialTransformationMatrix: matrixData,
          pose,
          score,
        };
      });

      // Sort deterministically
      detectedFaces.sort((a, b) => b.score - a.score);
      const selectedFace = detectedFaces[0];

      const selectionMessage =
        rawLandmarks.length > 1
          ? `Detected ${rawLandmarks.length} faces. Selected primary foreground face #${selectedFace.index + 1} (${Math.round(selectedFace.area * 100)}% of frame).`
          : undefined;

      this.setState('ready', null);

      return {
        detected: true,
        faceCount: rawLandmarks.length,
        selectedFaceIndex: selectedFace.index,
        selectionMessage,
        allFaces: detectedFaces.map(({ index, landmarks, boundingBox, area, centerDistance, blendshapes, facialTransformationMatrix, pose }) => ({
          index,
          landmarks,
          boundingBox,
          area,
          centerDistance,
          blendshapes,
          facialTransformationMatrix,
          pose,
        })),
        landmarks: selectedFace.landmarks,
        boundingBox: selectedFace.boundingBox,
        blendshapes: selectedFace.blendshapes,
        facialTransformationMatrix: selectedFace.facialTransformationMatrix,
        pose: selectedFace.pose,
        latencyMs,
        timestamp: Date.now(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setState('ready', null);
      return {
        detected: false,
        faceCount: 0,
        errorMessage: `Face landmark inference failed: ${msg}`,
        timestamp: Date.now(),
      };
    }
  }

  public dispose(): void {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        // Ignored during shutdown
      }
      this.landmarker = null;
    }
    this.setState('uninitialized', null);
  }
}
