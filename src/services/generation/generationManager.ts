import {
  GenerationJob,
  GenerationStageId,
  GENERATION_STAGES,
  BiometricColorMetrics,
  BiometricColorSample,
  ModeResult,
} from './types';
import { QualitySetting } from '../../engine/v4/tiers';
import { V4ExperimentOptions, V4PipelineResult } from '../../engine/v4/types';
import { runV4Pipeline } from '../../engine/v4/v4Pipeline';
import { detectBlackBars } from '../../utils/blackBarTrimmer';
import { extractVividPhotoAccent } from '../../lib/colorAccent';
import { faceDetectionService, NormalizedLandmark } from '../faceDetection';
import { SegmentationService } from '../segmentation/segmentationService';
import {
  optimizeSvgDocument,
  extractPaintingLayers,
  PaintingLayer,
} from '../../engine/v4/svgOptimizer';
import { minifySvgDocument } from '../../engine/v4/sizeOptimizer/svgMinifier';
import { renderSvgToImageData } from '../../engine/v4/export/imageComparison';
import { computeSSIM } from '../../engine/v4/export/ssim';
import { countSpecks } from '../../engine/v4/export/speckCounter';
import { TerminalLog, FinalSummaryData } from '../../components/studio/v4/V4Terminal';
import V4PipelineWorker from '../../workers/v4PipelineWorker.ts?worker';
import flags from '../../flags';
import analytics from '../analytics';

export type JobSubscriber = (job: GenerationJob) => void;

interface PreprocessedPhotoData {
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
}

class GenerationManager {
  private static instance: GenerationManager | null = null;
  private currentJob: GenerationJob | null = null;
  private subscribers: Set<JobSubscriber> = new Set();
  private primaryWorker: Worker | null = null;
  private backgroundWorker: Worker | null = null;
  private abortController: AbortController | null = null;
  private activeJobId: string = '';
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastProgressTimestamp: number = 0;
  private cachedPreprocessedData: PreprocessedPhotoData | null = null;
  private cachedPreprocessedUrl: string = '';
  private completedModesCache: Map<string, { painting?: ModeResult; recreation?: ModeResult }> = new Map();
  private sessionResults: { painting?: ModeResult; recreation?: ModeResult } = {};
  private backgroundMode: 'painting' | 'recreation' | null = null;

  private constructor() {}

  public static getInstance(): GenerationManager {
    if (!GenerationManager.instance) {
      GenerationManager.instance = new GenerationManager();
    }
    return GenerationManager.instance;
  }

  public getJob(): GenerationJob | null {
    return this.currentJob;
  }

  public subscribe(subscriber: JobSubscriber): () => void {
    this.subscribers.add(subscriber);
    if (this.currentJob) {
      subscriber(this.currentJob);
    }
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  private notify() {
    if (!this.currentJob) return;
    const snapshot = { ...this.currentJob };
    this.subscribers.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (err) {
        console.error('[GenerationManager] Subscriber error:', err);
      }
    });
  }

  public addLog(
    message: string,
    type: 'info' | 'success' | 'warn' | 'error' | 'summary' = 'info'
  ) {
    if (!this.currentJob) return;
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0] || now.toLocaleTimeString();
    const logItem: TerminalLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp,
      message,
      type,
    };
    // Keep last 250 log entries to prevent memory bloat
    const updatedLogs = [...this.currentJob.logs, logItem].slice(-250);
    this.currentJob = {
      ...this.currentJob,
      logs: updatedLogs,
    };
    this.notify();
  }

  public clearLogs() {
    if (!this.currentJob) return;
    this.currentJob = {
      ...this.currentJob,
      logs: [],
    };
    this.notify();
  }

  private setStage(
    stageId: GenerationStageId,
    stageDetail: string,
    progressPercent: number
  ) {
    if (!this.currentJob) return;
    const stageDef = GENERATION_STAGES.find((s) => s.id === stageId) || GENERATION_STAGES[0];
    this.lastProgressTimestamp = Date.now();
    this.currentJob = {
      ...this.currentJob,
      stageId,
      stageIndex: stageDef.index,
      stageName: stageDef.name,
      stageDetail,
      progressPercent: Math.min(99, Math.max(this.currentJob.progressPercent, progressPercent)),
      elapsedMs: Date.now() - this.currentJob.startTime,
    };
    this.notify();
  }



  private sampleColorAround(
    ctx: CanvasRenderingContext2D,
    landmarks: NormalizedLandmark[],
    indices: number[],
    w: number,
    h: number
  ): BiometricColorSample | undefined {
    if (!landmarks || landmarks.length === 0) return undefined;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;
    for (const idx of indices) {
      const pt = landmarks[idx];
      if (!pt) continue;
      const px = Math.min(w - 1, Math.max(0, Math.round(pt.x * w)));
      const py = Math.min(h - 1, Math.max(0, Math.round(pt.y * h)));
      const p = ctx.getImageData(px, py, 1, 1).data;
      rSum += p[0];
      gSum += p[1];
      bSum += p[2];
      count++;
    }
    if (count === 0) return undefined;
    const r = Math.round(rSum / count);
    const g = Math.round(gSum / count);
    const b = Math.round(bSum / count);
    const hex = '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    return { hex, r, g, b };
  }

  private startElapsedTimer() {
    // Disabled 100ms interval timer: eliminated 10 unnecessary React re-renders/second
  }

  private stopElapsedTimer() {
    // No-op
  }

  private startWatchdog() {
    this.stopWatchdog();
    this.lastProgressTimestamp = Date.now();
    this.watchdogTimer = setInterval(() => {
      if (!this.currentJob || this.currentJob.status !== 'running') {
        this.stopWatchdog();
        return;
      }
      const stallDuration = Date.now() - this.lastProgressTimestamp;
      if (stallDuration > 25000) {
        console.warn('[GenerationWatchdog] Pipeline inactive for > 25s. Forcing completion or error handling.');
        this.addLog('[Watchdog] Inactivity detected. Enforcing completion.', 'warn');
        this.stopWatchdog();
      }
    }, 2000);
  }

  private stopWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  public cancelActiveJob(reason: string = 'User cancelled generation') {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.primaryWorker) {
      this.primaryWorker.terminate();
      this.primaryWorker = null;
    }
    if (this.backgroundWorker) {
      this.backgroundWorker.terminate();
      this.backgroundWorker = null;
    }
    this.stopElapsedTimer();
    this.stopWatchdog();

    if (this.currentJob && this.currentJob.status === 'running') {
      this.currentJob = {
        ...this.currentJob,
        status: 'cancelled',
        stageDetail: reason,
        elapsedMs: Date.now() - this.currentJob.startTime,
        etaStatus: 'completed',
        estimatedRemainingSeconds: 0,
      };
      this.addLog(`[Pipeline] Generation cancelled: ${reason}`, 'warn');
      this.notify();
    }
  }

  /**
   * Phase 4: Main Job Execution with Sequential Dual-Mode Synthesis
   * Generates primary requested mode first (with full UI updates and 13s ETA).
   * Upon completion, automatically starts the secondary mode in background.
   */
  public async startJob(
    imageUrl: string,
    fileName: string,
    mode: 'painting' | 'recreation' = 'painting',
    quality: QualitySetting = 'high',
    predetectedLandmarks?: NormalizedLandmark[]
  ): Promise<GenerationJob> {
    // Check if mode is already in sessionResults or completedModesCache for instant zero-latency retrieval
    const cachedEntry = this.completedModesCache.get(imageUrl) || this.sessionResults;
    const cachedResult = cachedEntry?.[mode] || this.sessionResults[mode];
    if (cachedResult && cachedResult.status === 'completed') {
      const blob = new Blob([cachedResult.svgOutput], { type: 'image/svg+xml;charset=utf-8' });
      const freshBlobUrl = URL.createObjectURL(blob);
      cachedResult.svgBlobUrl = freshBlobUrl;

      const completedJob: GenerationJob = {
        id: `cached_${Date.now()}`,
        sourceUrl: imageUrl,
        fileName,
        mode,
        quality,
        status: 'completed',
        stageId: 'finalization',
        stageIndex: '06',
        stageName: 'COMPLETED',
        stageDetail: `Retrieved pre-generated ${mode.toUpperCase()} artwork from memory.`,
        progressPercent: 100,
        startTime: Date.now(),
        elapsedMs: cachedResult.durationMs,
        estimatedRemainingSeconds: 0,
        etaStatus: 'completed',
        imageDimensions: this.cachedPreprocessedData
          ? { width: this.cachedPreprocessedData.effectiveW, height: this.cachedPreprocessedData.effectiveH }
          : { width: 800, height: 600 },
        detectedLandmarks: this.cachedPreprocessedData?.primaryLandmarks || predetectedLandmarks || [],
        colorMetrics: this.cachedPreprocessedData?.colorMetrics || {},
        photoAccent: this.cachedPreprocessedData?.photoAccent || '#FF4F2E',
        paintingLayers: cachedResult.paintingLayers,
        svgOutput: cachedResult.svgOutput,
        svgBlobUrl: freshBlobUrl,
        diffBlobUrl: cachedResult.diffBlobUrl,
        tiersData: cachedResult.tiersData,
        summaryData: cachedResult.summaryData,
        logs: this.currentJob?.logs || [],
        error: null,
        results: {
          painting: cachedEntry?.painting || null,
          recreation: cachedEntry?.recreation || null,
        },
        backgroundModeStatus: 'idle',
      };

      this.currentJob = completedJob;
      this.addLog(`[Mode Cache] Retrieved instant pre-generated ${mode.toUpperCase()} result (<5ms).`, 'success');
      this.notify();
      return completedJob;
    }

    const isSameImage = Boolean(this.currentJob && this.currentJob.sourceUrl === imageUrl);
    const existingResults = isSameImage && this.currentJob
      ? { ...this.currentJob.results }
      : { painting: null, recreation: null };

    // Cancel any previous job safely
    this.cancelActiveJob('Starting new generation job');

    // Revoke previous blob URLs only if loading a different photograph
    if (!isSameImage && this.currentJob) {
      if (this.currentJob.results.painting?.svgBlobUrl) URL.revokeObjectURL(this.currentJob.results.painting.svgBlobUrl);
      if (this.currentJob.results.painting?.diffBlobUrl) URL.revokeObjectURL(this.currentJob.results.painting.diffBlobUrl);
      if (this.currentJob.results.recreation?.svgBlobUrl) URL.revokeObjectURL(this.currentJob.results.recreation.svgBlobUrl);
      if (this.currentJob.results.recreation?.diffBlobUrl) URL.revokeObjectURL(this.currentJob.results.recreation.diffBlobUrl);
      if (this.currentJob.svgBlobUrl) URL.revokeObjectURL(this.currentJob.svgBlobUrl);
      if (this.currentJob.diffBlobUrl) URL.revokeObjectURL(this.currentJob.diffBlobUrl);
      this.cachedPreprocessedData = null;
      this.cachedPreprocessedUrl = '';
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.activeJobId = jobId;

    const abortController = new AbortController();
    this.abortController = abortController;

    const initialJob: GenerationJob = {
      id: jobId,
      sourceUrl: imageUrl,
      fileName,
      mode,
      quality,
      status: 'running',
      stageId: 'ingestion',
      stageIndex: '01',
      stageName: 'IMAGE INGESTION',
      stageDetail: 'Loading source photograph and establishing viewport...',
      progressPercent: 5,
      startTime: Date.now(),
      elapsedMs: 0,
      estimatedRemainingSeconds: 0,
      etaStatus: 'completed',
      imageDimensions: this.cachedPreprocessedData
        ? { width: this.cachedPreprocessedData.effectiveW, height: this.cachedPreprocessedData.effectiveH }
        : { width: 800, height: 600 },
      detectedLandmarks: this.cachedPreprocessedData?.primaryLandmarks || predetectedLandmarks || [],
      colorMetrics: this.cachedPreprocessedData?.colorMetrics || {},
      photoAccent: this.cachedPreprocessedData?.photoAccent || '#FF4F2E',
      paintingLayers: [],
      svgOutput: '',
      svgBlobUrl: '',
      diffBlobUrl: null,
      tiersData: null,
      summaryData: null,
      logs: [],
      error: null,
      results: existingResults,
      backgroundModeStatus: 'idle',
    };

    this.currentJob = initialJob;
    this.notify();
    this.startElapsedTimer();
    this.startWatchdog();

    this.addLog(`[Pipeline] Initiating ${mode.toUpperCase()} synthesis (${quality.toUpperCase()} quality)...`, 'info');
    analytics.trackEvent('reconstruction_started', {
      mode,
      quality,
      job_id: jobId,
    });

    try {
      // =========================================================================
      // COMMON PREPROCESSING (Reused across mode & quality switches)
      // =========================================================================
      let preprocessed: PreprocessedPhotoData;

      if (this.cachedPreprocessedData && this.cachedPreprocessedUrl === imageUrl) {
        preprocessed = this.cachedPreprocessedData;
        this.addLog(`[Pipeline] Reusing cached composition calibration & segmentation for ${mode.toUpperCase()} synthesis.`, 'info');
      } else {
        this.setStage('ingestion', 'Decoding source photograph bitmap...', 10);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image asset for vector synthesis'));
        });

        if (this.activeJobId !== jobId || abortController.signal.aborted) {
          return this.currentJob;
        }

        const rawW = img.naturalWidth || img.width || 800;
        const rawH = img.naturalHeight || img.height || 600;
        this.addLog(`[Ingestion] Image bitmap decoded: ${rawW}×${rawH} px.`, 'info');

        // Create primary working canvas
        const photoCanvas = document.createElement('canvas');
        photoCanvas.width = rawW;
        photoCanvas.height = rawH;
        const pCtx = photoCanvas.getContext('2d', { willReadFrequently: true });
        if (!pCtx) throw new Error('Could not allocate 2D context for image processing');
        pCtx.drawImage(img, 0, 0, rawW, rawH);
        const photoImageData = pCtx.getImageData(0, 0, rawW, rawH);

        // Auto-trim letterbox / pillarbox black bars
        let effectiveCanvas: HTMLCanvasElement = photoCanvas;
        let effectiveCtx: CanvasRenderingContext2D = pCtx;
        let effectiveW = rawW;
        let effectiveH = rawH;
        let effectiveImageData = photoImageData;

        const cropBounds = detectBlackBars(photoImageData);
        if (cropBounds.trimmed) {
          effectiveW = cropBounds.width;
          effectiveH = cropBounds.height;
          const croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = effectiveW;
          croppedCanvas.height = effectiveH;
          const cCtx = croppedCanvas.getContext('2d', { willReadFrequently: true });
          if (cCtx) {
            cCtx.drawImage(photoCanvas, cropBounds.left, cropBounds.top, effectiveW, effectiveH, 0, 0, effectiveW, effectiveH);
            effectiveCanvas = croppedCanvas;
            effectiveCtx = cCtx;
            effectiveImageData = cCtx.getImageData(0, 0, effectiveW, effectiveH);
            this.addLog(`[Auto-Trim] Trimmed black bars -> canvas adjusted to ${effectiveW}×${effectiveH} px.`, 'info');
          }
        }

        if (this.activeJobId !== jobId || abortController.signal.aborted) {
          return this.currentJob;
        }

        this.currentJob = {
          ...this.currentJob,
          imageDimensions: { width: effectiveW, height: effectiveH },
        };
        this.notify();

        // Stage 02: Calibration & Biometrics
        this.setStage('calibration', 'Extracting photo color palette and detecting landmarks...', 20);
        const accentRes = extractVividPhotoAccent(effectiveImageData);
        this.currentJob = {
          ...this.currentJob,
          photoAccent: accentRes.accentHex,
        };
        this.addLog(`[Atelier] Color accent established: ${accentRes.accentHex} (Contrast: ${accentRes.contrast}:1)`, 'info');

        // Face landmarks: use predetectedLandmarks if provided, else run detector once
        let primaryLandmarks: NormalizedLandmark[] = predetectedLandmarks || [];
        let allFacesLandmarks: NormalizedLandmark[][] = primaryLandmarks.length > 0 ? [primaryLandmarks] : [];
        let faceCount = primaryLandmarks.length > 0 ? 1 : 0;

        if (primaryLandmarks.length === 0) {
          this.setStage('calibration', 'Initializing MediaPipe Face Mesh & segmentation...', 28);
          await faceDetectionService.initialize();
          const detection = await faceDetectionService.detect(effectiveCanvas);
          if (this.activeJobId !== jobId || abortController.signal.aborted) {
            return this.currentJob;
          }

          primaryLandmarks = detection?.landmarks || [];
          const allFaces = detection?.allFaces || [];
          faceCount = detection?.faceCount || (primaryLandmarks.length > 0 ? 1 : 0);
          allFacesLandmarks =
            allFaces.length > 0
              ? allFaces.map((f) => f.landmarks)
              : primaryLandmarks.length > 0
              ? [primaryLandmarks]
              : [];
        }

        this.currentJob = {
          ...this.currentJob,
          detectedLandmarks: primaryLandmarks,
        };
        this.notify();

        if (primaryLandmarks.length > 0) {
          this.addLog(`[Biometrics] Detected ${primaryLandmarks.length} landmark coordinates (${faceCount} face${faceCount === 1 ? '' : 's'}).`, 'success');
        } else {
          this.addLog('[Biometrics] Scene photograph: full-composition planar mode engaged.', 'info');
        }

        // Biometric color sampling
        const colorMetrics: BiometricColorMetrics = {};
        if (primaryLandmarks.length >= 33) {
          colorMetrics.skin = this.sampleColorAround(effectiveCtx, primaryLandmarks, [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 117, 118, 50, 346, 347, 280, 152], effectiveW, effectiveH);
          colorMetrics.lips = this.sampleColorAround(effectiveCtx, primaryLandmarks, [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291], effectiveW, effectiveH);
          colorMetrics.hair = this.sampleColorAround(effectiveCtx, primaryLandmarks, [10, 67, 297, 109, 338], effectiveW, effectiveH);
          const bgPixel = effectiveCtx.getImageData(5, 5, 1, 1).data;
          colorMetrics.bg = {
            hex: '#' + [bgPixel[0], bgPixel[1], bgPixel[2]].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase(),
            r: bgPixel[0],
            g: bgPixel[1],
            b: bgPixel[2],
          };
          this.currentJob = {
            ...this.currentJob,
            colorMetrics,
          };
          this.notify();
        }

        // Stage 03: Semantic Segmentation
        this.setStage('analysis', 'Computing semantic boundary mask for subject separation...', 45);
        const segService = SegmentationService.getInstance();
        await segService.initialize();
        const categoryMask = await segService.segmentCategoryMask(effectiveCanvas);
        if (this.activeJobId !== jobId || abortController.signal.aborted) {
          return this.currentJob;
        }
        this.addLog(`[Analysis] Semantic region mask computed (${categoryMask ? 'Neural category mask' : 'Heuristic boundary'}).`, 'info');

        preprocessed = {
          effectiveCanvas,
          effectiveImageData,
          effectiveW,
          effectiveH,
          photoAccent: accentRes.accentHex,
          primaryLandmarks,
          allFacesLandmarks,
          faceCount,
          colorMetrics,
          categoryMask,
        };
        this.cachedPreprocessedData = preprocessed;
        this.cachedPreprocessedUrl = imageUrl;
      }

      // =========================================================================
      // STAGE 04 & 05: VECTOR SYNTHESIS (Foreground Web Worker)
      // =========================================================================
      this.setStage('synthesis', `Executing ${mode.toUpperCase()} vector synthesis...`, 55);

      const primaryResult = await this.executeSynthesisPipeline({
        mode,
        quality,
        jobId,
        abortController,
        isBackground: false,
        preprocessed,
      });

      if (this.activeJobId !== jobId || abortController.signal.aborted) {
        return this.currentJob;
      }

      const totalDuration = Date.now() - initialJob.startTime;

      // Store primary mode result
      const primaryModeResult: ModeResult = {
        mode,
        quality,
        svgOutput: primaryResult.svgOutput,
        svgBlobUrl: primaryResult.svgBlobUrl,
        diffBlobUrl: primaryResult.diffBlobUrl,
        summaryData: primaryResult.summaryData,
        paintingLayers: primaryResult.paintingLayers,
        tiersData: primaryResult.tiersData,
        durationMs: totalDuration,
        status: 'completed',
      };

      // Store in permanent completedModesCache and sessionResults for instant zero-latency retrieval
      this.sessionResults[mode] = primaryModeResult;
      const cacheMapEntry = this.completedModesCache.get(imageUrl) || {};
      cacheMapEntry[mode] = primaryModeResult;
      this.completedModesCache.set(imageUrl, { ...this.sessionResults, ...cacheMapEntry });

      this.currentJob = {
        ...this.currentJob,
        status: 'completed',
        stageId: 'finalization',
        stageIndex: '06',
        stageName: 'COMPLETED',
        stageDetail: `Vector synthesis complete: ${primaryResult.summaryData?.paths.toLocaleString() || '1,000+'} paths in ${(totalDuration / 1000).toFixed(1)}s.`,
        progressPercent: 100,
        elapsedMs: totalDuration,
        estimatedRemainingSeconds: 0,
        etaStatus: 'completed',
        svgOutput: primaryResult.svgOutput,
        svgBlobUrl: primaryResult.svgBlobUrl,
        diffBlobUrl: primaryResult.diffBlobUrl,
        tiersData: primaryResult.tiersData,
        summaryData: primaryResult.summaryData,
        paintingLayers: primaryResult.paintingLayers,
        results: {
          ...this.currentJob.results,
          painting: cacheMapEntry.painting || this.currentJob.results.painting,
          recreation: cacheMapEntry.recreation || this.currentJob.results.recreation,
        },
      };

      this.stopElapsedTimer();
      this.stopWatchdog();
      this.addLog(
        `[V4 Pipeline Completed] ${primaryResult.summaryData?.paths.toLocaleString()} paths | ${(primaryResult.summaryData?.sizeBytes! / 1024).toFixed(1)} KB | ${(totalDuration / 1000).toFixed(1)}s | SSIM: ${primaryResult.summaryData?.ssim}`,
        'success'
      );
      this.notify();

      analytics.trackEvent('reconstruction_completed', {
        mode,
        quality,
        duration_ms: totalDuration,
        path_count: primaryResult.summaryData?.paths || 0,
        size_kb: Math.round((primaryResult.summaryData?.sizeBytes || 0) / 1024),
      });

      // Automatically synthesize secondary mode in background so mode switching is instant
      const secondaryMode = mode === 'painting' ? 'recreation' : 'painting';
      if (!cacheMapEntry[secondaryMode]) {
        this.triggerBackgroundSecondMode(secondaryMode, quality, jobId, abortController);
      }

      return this.currentJob;
    } catch (err: any) {
      if (this.activeJobId !== jobId) return this.currentJob!;
      this.stopElapsedTimer();
      this.stopWatchdog();
      const errMsg = err?.message || 'Error executing vector synthesis';
      this.addLog(`[Pipeline Error] ${errMsg}`, 'error');
      analytics.trackEvent('reconstruction_failed', { mode, quality });

      if (this.currentJob) {
        this.currentJob = {
          ...this.currentJob,
          status: 'failed',
          stageDetail: errMsg,
          error: errMsg,
          elapsedMs: Date.now() - this.currentJob.startTime,
          estimatedRemainingSeconds: 0,
          etaStatus: 'completed',
        };
        this.notify();
      }
      throw err;
    }
  }

  /**
   * Helper that executes the vector tracing worker and computes final metrics
   */
  private async executeSynthesisPipeline({
    mode,
    quality,
    jobId,
    abortController,
    isBackground,
    preprocessed,
  }: {
    mode: 'painting' | 'recreation';
    quality: QualitySetting;
    jobId: string;
    abortController: AbortController;
    isBackground: boolean;
    preprocessed: PreprocessedPhotoData;
  }): Promise<{
    svgOutput: string;
    svgBlobUrl: string;
    diffBlobUrl: string | null;
    summaryData: FinalSummaryData;
    paintingLayers: PaintingLayer[];
    tiersData: any;
  }> {
    const pipelineOptions: V4ExperimentOptions = {
      mode,
      quality,
      selectedTier: quality,
      detailPreset: quality === 'high' ? 'max' : 'medium',
      detectedFaceCount: preprocessed.faceCount,
      allFacesLandmarks: preprocessed.allFacesLandmarks,
      hasGlasses: false,
      debugMagentaBase: flags.debugMagentaBase,
    };

    let pipelineResult: V4PipelineResult;
    let paintingLayers: PaintingLayer[] = [];

    if (typeof Worker !== 'undefined') {
      try {
        pipelineResult = await new Promise<V4PipelineResult>((resolve, reject) => {
          const worker = new V4PipelineWorker();
          if (isBackground) {
            this.backgroundWorker = worker;
          } else {
            this.primaryWorker = worker;
          }

          worker.onmessage = (e: MessageEvent) => {
            if (this.activeJobId !== jobId || abortController.signal.aborted) return;
            const data = e.data;

            if (!isBackground) {
              this.lastProgressTimestamp = Date.now();
              if (data.type === 'STAGE') {
                const stagePct = 55 + Math.round((data.percent || 70) * 0.35);
                this.setStage('synthesis', data.message || data.stage, stagePct);
                this.addLog(`[Synthesis] ${data.message || data.stage}`, 'info');
              } else if (data.type === 'UNDERPAINTING_READY') {
                if (data.layers && data.layers.length > 0 && this.currentJob) {
                  this.currentJob = {
                    ...this.currentJob,
                    paintingLayers: data.layers,
                  };
                  this.notify();
                }
                this.addLog(`[Synthesis] Rapid underpainting foundation ready in ${data.timeMs || '<1s'} ms.`, 'success');
              } else if (data.type === 'PROGRESS') {
                const progressPct = 55 + Math.round((data.percent || 50) * 0.35);
                this.setStage('synthesis', data.stage, progressPct);
              }
            }

            if (data.type === 'SUCCESS') {
              if (data.layers && data.layers.length > 0) {
                paintingLayers = data.layers;
              }
              worker.terminate();
              if (isBackground) this.backgroundWorker = null;
              else this.primaryWorker = null;
              resolve(data.result);
            } else if (data.type === 'ERROR') {
              worker.terminate();
              if (isBackground) this.backgroundWorker = null;
              else this.primaryWorker = null;
              reject(new Error(data.error));
            }
          };

          worker.onerror = (err) => {
            worker.terminate();
            if (isBackground) this.backgroundWorker = null;
            else this.primaryWorker = null;
            reject(err);
          };

          worker.postMessage({
            type: 'RUN_V4',
            imageData: preprocessed.effectiveImageData,
            width: preprocessed.effectiveW,
            height: preprocessed.effectiveH,
            landmarks: preprocessed.primaryLandmarks,
            categoryMask: preprocessed.categoryMask,
            options: pipelineOptions,
          });
        });
      } catch (workerErr: any) {
        if (this.activeJobId !== jobId || abortController.signal.aborted) {
          throw new Error('Aborted');
        }
        if (!isBackground) {
          this.addLog(`[Worker Fallback] Main thread dispatch: ${workerErr?.message || 'worker fallback'}`, 'warn');
        }
        pipelineResult = await runV4Pipeline({
          image: preprocessed.effectiveCanvas,
          landmarks: preprocessed.primaryLandmarks,
          categoryMask: preprocessed.categoryMask,
          options: pipelineOptions,
        });
        const opt = optimizeSvgDocument(pipelineResult.candidates['candidate-c'].svgString);
        pipelineResult.candidates['candidate-c'].svgString = opt;
        paintingLayers = extractPaintingLayers(opt);
      }
    } else {
      pipelineResult = await runV4Pipeline({
        image: preprocessed.effectiveCanvas,
        landmarks: preprocessed.primaryLandmarks,
        categoryMask: preprocessed.categoryMask,
        options: pipelineOptions,
      });
      const opt = optimizeSvgDocument(pipelineResult.candidates['candidate-c'].svgString);
      pipelineResult.candidates['candidate-c'].svgString = opt;
      paintingLayers = extractPaintingLayers(opt);
    }

    if (this.activeJobId !== jobId || abortController.signal.aborted) {
      throw new Error('Aborted');
    }

    // Optimization & Minification
    if (!isBackground) {
      this.setStage('optimization', 'Simplifying curves, consolidating path nodes, and minifying SVG...', 92);
    }

    const isRecreation = mode === 'recreation';
    let svgOutput = isRecreation
      ? pipelineResult.candidates['candidate-a'].svgString
      : pipelineResult.candidates['candidate-c'].svgString;

    if (flags.sizeOptimizer) {
      svgOutput = minifySvgDocument(svgOutput, { preset: 'balanced', relativeCommands: true });
    }

    const paths = (svgOutput.match(/<path/g) || []).length;
    const rawBytes = new TextEncoder().encode(svgOutput).length;

    // Create Blob URL
    const svgBlob = new Blob([svgOutput], { type: 'image/svg+xml;charset=utf-8' });
    const svgBlobUrl = URL.createObjectURL(svgBlob);

    // Finalization & SSIM
    if (!isBackground) {
      this.setStage('finalization', 'Evaluating SSIM visual fidelity and generating heatmap...', 96);
    }

    let ssim = 0;
    let colorErr = 0;
    let specks = 0;
    let diffBlobUrl: string | null = null;

    try {
      const svgImgData = await renderSvgToImageData(svgOutput, preprocessed.effectiveW, preprocessed.effectiveH);
      if (svgImgData) {
        const evalW = 360;
        const evalH = Math.round(preprocessed.effectiveH * (360 / preprocessed.effectiveW));

        const evalCanvasA = document.createElement('canvas');
        evalCanvasA.width = evalW;
        evalCanvasA.height = evalH;
        const ctxA = evalCanvasA.getContext('2d')!;
        ctxA.drawImage(preprocessed.effectiveCanvas, 0, 0, evalW, evalH);
        const dataA = ctxA.getImageData(0, 0, evalW, evalH);

        const evalCanvasB = document.createElement('canvas');
        evalCanvasB.width = evalW;
        evalCanvasB.height = evalH;
        const ctxB = evalCanvasB.getContext('2d')!;
        const tempSvgCanvas = document.createElement('canvas');
        tempSvgCanvas.width = preprocessed.effectiveW;
        tempSvgCanvas.height = preprocessed.effectiveH;
        tempSvgCanvas.getContext('2d')!.putImageData(svgImgData, 0, 0);
        ctxB.drawImage(tempSvgCanvas, 0, 0, evalW, evalH);
        const dataB = ctxB.getImageData(0, 0, evalW, evalH);

        ssim = Math.round(computeSSIM(dataA, dataB) * 1000) / 1000;
        specks = countSpecks(dataB).speckCount;

        let sum = 0;
        let sampleCount = 0;
        for (let i = 0; i < preprocessed.effectiveW * preprocessed.effectiveH; i += 4) {
          const idx = i * 4;
          const dr = preprocessed.effectiveImageData.data[idx] - svgImgData.data[idx];
          const dg = preprocessed.effectiveImageData.data[idx + 1] - svgImgData.data[idx + 1];
          const db = preprocessed.effectiveImageData.data[idx + 2] - svgImgData.data[idx + 2];
          sum += Math.sqrt(dr * dr + dg * dg + db * db);
          sampleCount++;
        }
        colorErr = Math.round((sum / sampleCount) * 10) / 10;

        // Difference heatmap
        const diffW = Math.min(600, preprocessed.effectiveW);
        const diffH = Math.round(preprocessed.effectiveH * (diffW / preprocessed.effectiveW));
        const diffCanvas = document.createElement('canvas');
        diffCanvas.width = diffW;
        diffCanvas.height = diffH;
        const dCtx = diffCanvas.getContext('2d');
        if (dCtx) {
          const diffEvalCanvas = document.createElement('canvas');
          diffEvalCanvas.width = evalW;
          diffEvalCanvas.height = evalH;
          const deCtx = diffEvalCanvas.getContext('2d')!;
          const diffRaw = deCtx.createImageData(evalW, evalH);
          for (let i = 0; i < evalW * evalH * 4; i += 4) {
            const dr = Math.abs(dataA.data[i] - dataB.data[i]);
            const dg = Math.abs(dataA.data[i + 1] - dataB.data[i + 1]);
            const db = Math.abs(dataA.data[i + 2] - dataB.data[i + 2]);
            diffRaw.data[i] = Math.min(255, Math.round(dr * 2.2));
            diffRaw.data[i + 1] = Math.min(255, Math.round(dg * 2.2));
            diffRaw.data[i + 2] = Math.min(255, Math.round(db * 2.2));
            diffRaw.data[i + 3] = 255;
          }
          deCtx.putImageData(diffRaw, 0, 0);
          dCtx.drawImage(diffEvalCanvas, 0, 0, diffW, diffH);
          diffBlobUrl = await new Promise<string | null>((resolve) => {
            diffCanvas.toBlob((blob) => {
              resolve(blob ? URL.createObjectURL(blob) : null);
            });
          });
        }
      }
    } catch (_metricsErr) {}

    let gzipBytes = Math.round(rawBytes * 0.35);
    try {
      if (typeof CompressionStream !== 'undefined') {
        const stream = new Blob([svgOutput]).stream().pipeThrough(new CompressionStream('gzip'));
        const res = new Response(stream);
        const buf = await res.arrayBuffer();
        gzipBytes = buf.byteLength;
      }
    } catch (_e) {}

    const summaryData: FinalSummaryData = {
      paths,
      sizeBytes: rawBytes,
      gzipBytes,
      durationMs: 0,
      colorError: colorErr,
      ssim,
      speckCount: specks,
    };

    return {
      svgOutput,
      svgBlobUrl,
      diffBlobUrl,
      summaryData,
      paintingLayers,
      tiersData: pipelineResult.tiers || null,
    };
  }

  /**
   * Phase 4: Automatically runs the secondary mode silently in the background
   */
  public async triggerBackgroundSecondMode(
    mode: 'painting' | 'recreation',
    quality: QualitySetting,
    jobId: string,
    abortController: AbortController
  ) {
    if (!this.cachedPreprocessedData || this.activeJobId !== jobId || abortController.signal.aborted) {
      return;
    }
    this.backgroundMode = mode;

    if (this.currentJob) {
      this.currentJob = {
        ...this.currentJob,
        backgroundModeStatus: 'running',
      };
      this.notify();
    }

    const t0 = performance.now();

    try {
      const result = await this.executeSynthesisPipeline({
        mode,
        quality,
        jobId,
        abortController,
        isBackground: true,
        preprocessed: this.cachedPreprocessedData,
      });

      if (this.activeJobId !== jobId || abortController.signal.aborted) return;

      const durationMs = Math.round(performance.now() - t0);
      result.summaryData.durationMs = durationMs;

      const modeResult: ModeResult = {
        mode,
        quality,
        svgOutput: result.svgOutput,
        svgBlobUrl: result.svgBlobUrl,
        diffBlobUrl: result.diffBlobUrl,
        summaryData: result.summaryData,
        paintingLayers: result.paintingLayers,
        tiersData: result.tiersData,
        durationMs,
        status: 'completed',
      };

      this.sessionResults[mode] = modeResult;
      const targetImgUrl = this.currentJob?.sourceUrl || '';
      if (targetImgUrl) {
        const bgCache = this.completedModesCache.get(targetImgUrl) || {};
        bgCache[mode] = modeResult;
        this.completedModesCache.set(targetImgUrl, { ...this.sessionResults, ...bgCache });
      }
      this.backgroundMode = null;

      if (this.currentJob) {
        const isUserOnThisMode = this.currentJob.mode === mode;
        this.currentJob = {
          ...this.currentJob,
          backgroundModeStatus: 'completed',
          status: isUserOnThisMode ? 'completed' : this.currentJob.status,
          svgOutput: isUserOnThisMode ? modeResult.svgOutput : this.currentJob.svgOutput,
          svgBlobUrl: isUserOnThisMode ? modeResult.svgBlobUrl : this.currentJob.svgBlobUrl,
          diffBlobUrl: isUserOnThisMode ? modeResult.diffBlobUrl : this.currentJob.diffBlobUrl,
          summaryData: isUserOnThisMode ? modeResult.summaryData : this.currentJob.summaryData,
          paintingLayers: isUserOnThisMode ? modeResult.paintingLayers : this.currentJob.paintingLayers,
          tiersData: isUserOnThisMode ? modeResult.tiersData : this.currentJob.tiersData,
          results: {
            ...this.currentJob.results,
            [mode]: modeResult,
          },
        };
        this.notify();
      }
    } catch (err: any) {
      if (this.activeJobId !== jobId || abortController.signal.aborted) return;
      console.warn(`[BackgroundMode] Background synthesis for ${mode} failed:`, err);
      if (this.currentJob) {
        this.currentJob = {
          ...this.currentJob,
          backgroundModeStatus: 'failed',
          results: {
            ...this.currentJob.results,
            [mode]: {
              mode,
              quality,
              svgOutput: '',
              svgBlobUrl: '',
              diffBlobUrl: null,
              summaryData: null,
              paintingLayers: [],
              tiersData: null,
              durationMs: 0,
              status: 'failed',
              error: err?.message || String(err),
            },
          },
        };
        this.notify();
      }
    }
  }

  /**
   * Phase 5: Instant mode switching when pre-generated result is ready
   */
  public switchMode(newMode: 'painting' | 'recreation'): boolean {
    if (!this.currentJob) return false;
    const imageUrl = this.currentJob.sourceUrl;
    const cachedEntry = this.completedModesCache.get(imageUrl) || this.sessionResults;
    const targetResult = this.sessionResults[newMode] || cachedEntry?.[newMode] || this.currentJob.results[newMode];

    if (targetResult && targetResult.status === 'completed') {
      // Re-create guaranteed fresh, non-revoked Blob URL
      const blob = new Blob([targetResult.svgOutput], { type: 'image/svg+xml;charset=utf-8' });
      const freshBlobUrl = URL.createObjectURL(blob);
      targetResult.svgBlobUrl = freshBlobUrl;

      this.currentJob = {
        ...this.currentJob,
        mode: newMode,
        svgOutput: targetResult.svgOutput,
        svgBlobUrl: freshBlobUrl,
        diffBlobUrl: targetResult.diffBlobUrl,
        summaryData: targetResult.summaryData,
        paintingLayers: targetResult.paintingLayers,
        tiersData: targetResult.tiersData,
        status: 'completed',
        results: {
          painting: this.sessionResults.painting || cachedEntry?.painting || this.currentJob.results.painting,
          recreation: this.sessionResults.recreation || cachedEntry?.recreation || this.currentJob.results.recreation,
        },
      };
      this.addLog(`[Mode Switch] Displaying instant pre-generated ${newMode.toUpperCase()} result (<5ms).`, 'success');
      this.notify();
      return true;
    }

    // If secondary mode is already crunching in background worker, promote to active view without cancelling
    if (this.backgroundMode === newMode && this.backgroundWorker) {
      this.addLog(`[Mode Switch] Promoting in-progress background ${newMode.toUpperCase()} synthesis to active view.`, 'info');
      this.currentJob = {
        ...this.currentJob,
        mode: newMode,
        status: 'running',
        stageDetail: `Synthesizing ${newMode === 'painting' ? 'Painting' : 'Exact Copy'} vector contours...`,
      };
      this.notify();
      return false;
    }

    // If result is not yet available and not running in background, start foreground job
    this.startJob(
      this.currentJob.sourceUrl,
      this.currentJob.fileName,
      newMode,
      this.currentJob.quality
    ).catch(console.error);
    return false;
  }

  public switchTier(quality: QualitySetting) {
    if (!this.currentJob) return;
    const activeMode = this.currentJob.mode;
    const currentModeResult = this.currentJob.results[activeMode];
    const tiers = currentModeResult?.tiersData || this.currentJob.tiersData;
    if (!tiers) return;

    const targetData = quality === 'low' ? tiers.low : tiers.high;
    if (!targetData) return;

    const blob = new Blob([targetData.svgString], { type: 'image/svg+xml;charset=utf-8' });
    const newBlobUrl = URL.createObjectURL(blob);

    this.currentJob = {
      ...this.currentJob,
      quality,
      svgOutput: targetData.svgString,
      svgBlobUrl: newBlobUrl,
      paintingLayers: extractPaintingLayers(targetData.svgString),
    };
    this.addLog(`[Quality Switch] Switched active quality to ${quality.toUpperCase()}`, 'info');
    this.notify();
  }
}

export const generationManager = GenerationManager.getInstance();
