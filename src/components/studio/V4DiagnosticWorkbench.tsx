import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Upload } from 'lucide-react';
import { runV4Pipeline } from '../../engine/v4/v4Pipeline';
import { V4PipelineResult, V4ExperimentOptions, WorkbenchStatus } from '../../engine/v4/types';
import { QualitySetting, AllQualitiesResult } from '../../engine/v4/tiers';
import { computeSvgSizeStats, SvgSizeStats } from '../../utils/svgDiagnostics';
import { faceDetectionService, NormalizedLandmark } from '../../services/faceDetection';
import { SegmentationService } from '../../services/segmentation/segmentationService';
import { V4CodeEditor } from './v4/V4CodeEditor';
import { V4ResultPane } from './v4/V4ResultPane';
import { TerminalLog, FinalSummaryData } from './v4/V4Terminal';
import { V4ExportModal } from './v4/V4ExportModal';
import { V4Toast, ToastItem } from './v4/V4Toast';
import V4PipelineWorker from '../../workers/v4PipelineWorker.ts?worker';
import { computeSSIM } from '../../engine/v4/export/ssim';
import { countSpecks } from '../../engine/v4/export/speckCounter';
import { renderSvgToImageData } from '../../engine/v4/export/imageComparison';
import { extractVividPhotoAccent } from '../../lib/colorAccent';
import { detectBlackBars } from '../../utils/blackBarTrimmer';
import { PaintingLayer, extractPaintingLayers, optimizeSvgDocument } from '../../engine/v4/svgOptimizer';
import { minifySvgDocument } from '../../engine/v4/sizeOptimizer/svgMinifier';
import flags from '../../flags';
import '../../styles/v4workbench.css';


export interface V4DiagnosticWorkbenchProps {
  onBackToStudio: () => void;
  initialImageUrl?: string;
  initialFileName?: string;
}

export const V4DiagnosticWorkbench: React.FC<V4DiagnosticWorkbenchProps> = ({
  onBackToStudio,
  initialImageUrl,
  initialFileName,
}) => {
  // Check query parameters
  const searchStr = typeof window !== 'undefined' ? window.location.search + window.location.hash : '';
  const startEmpty = searchStr.includes('empty=1');
  const startDrag = searchStr.includes('drag=1');

  // Input & pipeline state
  const [currentImgUrl, setCurrentImgUrl] = useState<string>(initialImageUrl || "");
  const [currentFileName, setCurrentFileName] = useState<string>(() => {
    if (startEmpty) return '';
    if (initialFileName) return initialFileName;
    if (initialImageUrl) {
      const parts = initialImageUrl.split('/');
      const last = parts[parts.length - 1];
      return last ? last.split('?')[0] : 'photo.jpg';
    }
    return "photo.jpg";
  });

  // Two-Mode and Three-Quality Architecture State
  const [selectedQuality, setSelectedQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [tiersData, setTiersData] = useState<AllQualitiesResult | null>(null);
  const [sizeStats, setSizeStats] = useState<SvgSizeStats | null>(null);

  // Sync filename when prop changes
  useEffect(() => {
    if (initialFileName) {
      setCurrentFileName(initialFileName);
    } else if (initialImageUrl) {
      const parts = initialImageUrl.split('/');
      const last = parts[parts.length - 1];
      if (last) setCurrentFileName(last.split('?')[0]);
    }
  }, [initialFileName, initialImageUrl]);
  const [photoAccent, setPhotoAccent] = useState<string>('#FF4F2E');
  const [workbenchMode, setWorkbenchMode] = useState<'painting' | 'recreation'>('painting');
  // If no image loaded, redirect to normal upload view
  useEffect(() => {
    if (!currentImgUrl && !startDrag) {
      onBackToStudio();
    }
  }, [currentImgUrl, startDrag, onBackToStudio]);

  // Step 2: Unified state machine: idle -> analyzing -> painting -> done (or skipped / cancelled / error)
  const [workbenchStatus, setWorkbenchStatus] = useState<WorkbenchStatus>(
    startEmpty ? 'idle' : 'analyzing'
  );
  const isGenerating = workbenchStatus === 'analyzing' || workbenchStatus === 'painting';
  const isPaintingActive = workbenchStatus === 'painting';
  const [generationStage, setGenerationStage] = useState<string>('Ready');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [, setErrorMsg] = useState<string | null>(null);

  // SVGs & sandboxed blob URL
  const [originalSvg, setOriginalSvg] = useState<string>('');
  const [currentSvg, setCurrentSvg] = useState<string>('');
  const [svgBlobUrl, setSvgBlobUrl] = useState<string>('');
  const [lastGoodBlobUrl, setLastGoodBlobUrl] = useState<string>('');
  const [diffBlobUrl, setDiffBlobUrl] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number }>({ width: 600, height: 800 });

  // Terminal & metrics state
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [summaryData, setSummaryData] = useState<FinalSummaryData | null>(null);
  const [colorMetrics, setColorMetrics] = useState<{
    skin?: { hex: string; r: number; g: number; b: number };
    hair?: { hex: string; r: number; g: number; b: number };
    lips?: { hex: string; r: number; g: number; b: number };
    bg?: { hex: string; r: number; g: number; b: number };
  }>({});

  // Layout & modal state
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'code' | 'result' | 'terminal'>('result');
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(startDrag);
  const [debugMagentaBase] = useState<boolean>(() => flags.debugMagentaBase);
  const debugMagentaBaseRef = useRef<boolean>(flags.debugMagentaBase);
  debugMagentaBaseRef.current = debugMagentaBase;

  // Resizable pane widths (Default 45% code / 55% result)
  const [leftPanePercent, setLeftPanePercent] = useState<number>(45);
  const [editorTab, setEditorTab] = useState<'svg' | 'html' | 'jsx' | 'diagnostics'>('diagnostics');
  const [isDraggingCol, setIsDraggingCol] = useState<boolean>(false);

  // Unified SVG size stats computation for caption and status bar
  useEffect(() => {
    let isCancelled = false;
    if (!currentSvg) {
      setSizeStats(null);
      return;
    }
    computeSvgSizeStats(currentSvg).then((stats) => {
      if (!isCancelled) {
        setSizeStats(stats);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [currentSvg]);

  // Step 1 - 5: Painting Layers & Landmarks
  const [paintingLayers, setPaintingLayers] = useState<PaintingLayer[]>([]);
  const [detectedLandmarks, setDetectedLandmarks] = useState<NormalizedLandmark[]>([]);

  // Step 3: Floating Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    setToasts((prev) => {
      const existing = prev.find((t) => t.message === message && t.type === type);
      if (existing) {
        return prev.map((t) => (t.id === existing.id ? { ...t, count: (t.count || 1) + 1 } : t));
      }
      const id = Math.random().toString(36).substring(2, 9);
      const next = [...prev, { id, message, type, count: 1 }];
      return next.slice(-4);
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    
  }, [debugMagentaBase]);

  const accentRgb = React.useMemo(() => {
    const clean = photoAccent.replace('#', '');
    if (clean.length === 6) {
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    }
    return '255, 79, 46';
  }, [photoAccent]);

  // Global shortcut 'L' to toggle collapsible terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.cm-editor'))
      ) {
        return;
      }

      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setEditorTab((prev) => (prev === 'diagnostics' ? 'html' : 'diagnostics'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // References & Run Isolation
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const currentRunIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const skipRequestedRunIdRef = useRef<number | null>(null);

  // Helper: Append real terminal log (isolated by run ID)
  const addLog = useCallback(
    (msg: string, type: 'info' | 'success' | 'warn' | 'error' | 'summary' = 'info', forRunId?: number) => {
      if (forRunId !== undefined && forRunId !== currentRunIdRef.current) return;
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: time,
          message: msg,
          type,
        },
      ]);
    },
    []
  );

  const watchdogTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastProgressTimeRef = useRef<number>(Date.now());
  const statusRef = useRef<WorkbenchStatus>(workbenchStatus);
  statusRef.current = workbenchStatus;

  // Window exposure for debugging & Playwright assertions
  useEffect(() => {
    (window as any).__v4 = {
      status: workbenchStatus,
      stage: generationStage,
      hasSvg: Boolean(currentSvg),
      svgLen: currentSvg ? currentSvg.length : 0,
    };
  }, [workbenchStatus, generationStage, currentSvg]);

  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearInterval(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    
  }, []);

  const transitionToStatus = useCallback(
    (nextStatus: WorkbenchStatus, reason?: string) => {
      setWorkbenchStatus(nextStatus);
      statusRef.current = nextStatus;

      if (nextStatus === 'analyzing' || nextStatus === 'painting') {
        setEditorTab('diagnostics');
      } else if (nextStatus === 'done' || nextStatus === 'skipped') {
        setEditorTab('html');
      }

      const isTerminal =
        nextStatus === 'done' ||
        nextStatus === 'skipped' ||
        nextStatus === 'cancelled' ||
        nextStatus === 'error';

      if (isTerminal) {
        clearWatchdog();
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
        
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        if (reason) {
          setGenerationStage(reason);
        }
      } else if (nextStatus === 'painting') {
        // Start 8-second watchdog timer in painting state
        clearWatchdog();
        lastProgressTimeRef.current = Date.now();
        
        watchdogTimerRef.current = setInterval(() => {
          if (statusRef.current === 'painting') {
            const elapsed = Date.now() - lastProgressTimeRef.current;
            if (elapsed >= 8000) {
              console.warn('[Watchdog] Painting stalled for > 8s with no progress. Transitioning to done.');
              addLog(
                '[Watchdog] Painting watchdog triggered: no progress for > 8s. Forcing completion.',
                'warn'
              );
              transitionToStatus('done', 'Watchdog timeout');
            }
          } else {
            clearWatchdog();
          }
        }, 1000);
      } else if (nextStatus === 'analyzing') {
        clearWatchdog();
      }
    },
    [clearWatchdog, addLog]
  );

  // Helper: Cancel active run immediately
  const cancelCurrentRun = useCallback(
    (reason = 'Cancelled') => {
      currentRunIdRef.current++;
      transitionToStatus('cancelled', reason);
      setProgressPercent(0);
    },
    [transitionToStatus]
  );

  // Manage SVG Blob URL securely (sandboxing scripts)
  useEffect(() => {
    if (!currentSvg) return;
    try {
      
      const blob = new Blob([currentSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setSvgBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setLastGoodBlobUrl(url);
    } catch (e) {
      console.error('Failed to create Blob URL from SVG:', e);
    }
  }, [currentSvg]);

  // Helper: Sample average color around landmarks
  const sampleColorAround = (
    ctx: CanvasRenderingContext2D,
    landmarks: NormalizedLandmark[],
    indices: number[],
    w: number,
    h: number
  ) => {
    if (!landmarks || landmarks.length === 0) return undefined;
    let rSum = 0,
      gSum = 0,
      bSum = 0,
      count = 0;
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
  };

  // Helper: Terminate Web Worker safely
  const handleCancelGeneration = useCallback(() => {
    cancelCurrentRun('Cancelled by user');
    addLog('[V4 Pipeline] Generation cancelled by user.', 'warn', currentRunIdRef.current);
  }, [cancelCurrentRun, addLog]);

  // Main Pipeline Executor
  const processImage = useCallback(
    async (
      imgUrl: string,
      preset: 'low' | 'medium' | 'high' | 'max' = 'max',
      _fileNameHint?: string,
      overrideMode?: 'painting' | 'recreation',
      overrideQuality?: QualitySetting
    ) => {
      const runId = ++currentRunIdRef.current;
      skipRequestedRunIdRef.current = null;

      // Clean up previous async work and worker
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }

      transitionToStatus('analyzing');
      setErrorMsg(null);
      setProgressPercent(10);
      setGenerationStage('Loading photo asset...');
      const t0 = performance.now();

      addLog(
        `[V4 Pipeline] Initializing generation on photo with preset: ${preset.toUpperCase()}...`,
        'info',
        runId
      );

      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imgUrl;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image asset for V4 reconstruction'));
        });

        if (runId !== currentRunIdRef.current || abortController.signal.aborted) return;

        const w = img.naturalWidth || img.width || 600;
        const h = img.naturalHeight || img.height || 800;
        setImageDims({ width: w, height: h });
        addLog(`Photo decoded: ${w}×${h} pixels.`, 'info', runId);
        addLog('[Stage] Studying photo tone and structure...', 'info', runId);
        addLog('[Stage] Sketching charcoal structural contours...', 'info', runId);

        // Canvas for sampling and ImageData extraction
        const photoCanvas = document.createElement('canvas');
        photoCanvas.width = w;
        photoCanvas.height = h;
        const pCtx = photoCanvas.getContext('2d', { willReadFrequently: true });
        if (!pCtx) throw new Error('Could not allocate 2D canvas context for photo processing');
        pCtx.drawImage(img, 0, 0, w, h);
        const photoImageData = pCtx.getImageData(0, 0, w, h);

        // Step 4: Auto-trim uniform near-black letterbox (top/bottom) and pillarbox (left/right) bars
        let effectiveCanvas: HTMLCanvasElement = photoCanvas;
        let effectiveCtx: CanvasRenderingContext2D = pCtx;
        let effectiveW = w;
        let effectiveH = h;
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
            cCtx.drawImage(
              photoCanvas,
              cropBounds.left,
              cropBounds.top,
              effectiveW,
              effectiveH,
              0,
              0,
              effectiveW,
              effectiveH
            );
            effectiveCanvas = croppedCanvas;
            effectiveCtx = cCtx;
            effectiveImageData = cCtx.getImageData(0, 0, effectiveW, effectiveH);
            setImageDims({ width: effectiveW, height: effectiveH });
            addLog(
              `[Auto-Trim] Removed letterbox/pillarbox black bars (Top: ${cropBounds.top}px, Bottom: ${h - 1 - cropBounds.bottom}px, Left: ${cropBounds.left}px, Right: ${w - 1 - cropBounds.right}px). Content trimmed to ${effectiveW}×${effectiveH}px.`,
              'info',
              runId
            );
          }
        }

        if (runId !== currentRunIdRef.current || abortController.signal.aborted) return;

        // Extract vivid photo accent (only if contrast against ink #14110F is >= 4.5:1, otherwise vermilion)
        const accentRes = extractVividPhotoAccent(effectiveImageData);
        setPhotoAccent(accentRes.accentHex);
        if (accentRes.isVividExtracted) {
          addLog(
            `[Atelier Theme] Vivid photo accent extracted: ${accentRes.accentHex} (Contrast against ink: ${accentRes.contrast}:1)`,
            'info',
            runId
          );
        } else {
          addLog(
            `[Atelier Theme] Vermilion fallback accent maintained: #FF4F2E (Contrast against ink: ${accentRes.contrast}:1)`,
            'info',
            runId
          );
        }

        // 1. Initialize Vision Services
        setProgressPercent(25);
        setGenerationStage('Initializing MediaPipe 478 Face Mesh...');
        await faceDetectionService.initialize();
        const segService = SegmentationService.getInstance();
        await segService.initialize();

        if (runId !== currentRunIdRef.current || abortController.signal.aborted) return;

        // 2. Anatomical Detection
        setProgressPercent(45);
        setGenerationStage('Detecting facial landmarks & geometry...');
        const detection = await faceDetectionService.detect(effectiveCanvas);

        if (runId !== currentRunIdRef.current || abortController.signal.aborted) return;

        const primaryLandmarks = detection?.landmarks || [];
        setDetectedLandmarks(primaryLandmarks);
        const allFaces = detection?.allFaces || [];
        const faceCount = detection?.faceCount || (primaryLandmarks.length > 0 ? 1 : 0);
        const allFacesLandmarks =
          allFaces.length > 0
            ? allFaces.map((f) => f.landmarks)
            : primaryLandmarks.length > 0
            ? [primaryLandmarks]
            : [];

        

        if (primaryLandmarks.length === 0) {
          showToast('No face found, painting anyway', 'warn');
          addLog(`[Vision] No face found, ${workbenchMode === 'recreation' ? 'recreating' : 'painting'} anyway.`, 'warn', runId);
        } else {
          addLog(
            `Landmarks detected: ${primaryLandmarks.length} points (${faceCount} face${
              faceCount === 1 ? '' : 's'
            }).`,
            'success',
            runId
          );
        }

        // Sample real biometric colors
        if (primaryLandmarks.length >= 33) {
          const skin = sampleColorAround(
            effectiveCtx,
            primaryLandmarks,
            [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 117, 118, 50, 346, 347, 280, 152],
            effectiveW,
            effectiveH
          );
          const lips = sampleColorAround(
            effectiveCtx,
            primaryLandmarks,
            [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
            effectiveW,
            effectiveH
          );
          const hair = sampleColorAround(effectiveCtx, primaryLandmarks, [10, 67, 297, 109, 338], effectiveW, effectiveH);
          const bgData = effectiveCtx.getImageData(5, 5, 1, 1).data;
          const bgHex =
            '#' +
            [bgData[0], bgData[1], bgData[2]]
              .map((x) => x.toString(16).padStart(2, '0'))
              .join('')
              .toUpperCase();

          setColorMetrics({
            skin,
            lips,
            hair,
            bg: { hex: bgHex, r: bgData[0], g: bgData[1], b: bgData[2] },
          });

          if (skin) addLog(`Biometric Skin: ${skin.hex} (RGB ${skin.r}, ${skin.g}, ${skin.b})`, 'info', runId);
          if (lips) addLog(`Biometric Lips: ${lips.hex} (RGB ${lips.r}, ${lips.g}, ${lips.b})`, 'info', runId);
          if (hair) addLog(`Biometric Hair: ${hair.hex} (RGB ${hair.r}, ${hair.g}, ${hair.b})`, 'info', runId);
        }

        if (runId !== currentRunIdRef.current || abortController.signal.aborted) return;

        // 3. Semantic Segmentation
        setProgressPercent(60);
        setGenerationStage('Segmenting semantic regions (hair, clothes, skin)...');
        const categoryMask = await segService.segmentCategoryMask(effectiveCanvas);

        if (runId !== currentRunIdRef.current || abortController.signal.aborted) return;

        addLog(
          `Semantic mask computed (${categoryMask ? 'High-density GPU mask' : 'Fallback heuristic'}).`,
          'info',
          runId
        );

        // 4. Faithful V4 Vector Synthesis Engine
        const hasGlasses = imgUrl.includes('beach') || imgUrl.includes('glasses');
        const colorDesc =
          preset === 'low'
            ? '16 colors'
            : preset === 'medium'
            ? '32 colors'
            : preset === 'max'
            ? '64+ colors'
            : '48 colors';

        const activeMode = overrideMode || workbenchMode;
        const activeQuality = overrideQuality || selectedQuality;

        const pipelineOptions: V4ExperimentOptions = {
          mode: activeMode,
          quality: (activeQuality === 'low' ? 'low' : 'high'),
          selectedTier: (activeQuality === 'low' ? 'low' : 'high'),
          detailPreset: activeQuality === 'high' ? 'max' : 'medium',
          detectedFaceCount: faceCount,
          allFacesLandmarks,
          hasGlasses,
          debugMagentaBase: debugMagentaBaseRef.current,
        };

        setProgressPercent(65);
        setGenerationStage(`Spawning Web Worker for tracing (${colorDesc})...`);

        let pipelineResult: V4PipelineResult;

        if (typeof Worker !== 'undefined') {
          try {
            pipelineResult = await new Promise<V4PipelineResult>((resolve, reject) => {
              const worker = new V4PipelineWorker();
              workerRef.current = worker;
              

              worker.onmessage = (e: MessageEvent) => {
                if (runId !== currentRunIdRef.current || abortController.signal.aborted) return;
                lastProgressTimeRef.current = Date.now();
                const data = e.data;
                if (data.type === 'STAGE') {
                  setProgressPercent(data.percent || 70);
                  setGenerationStage(data.stage);
                  addLog(`[${data.stage}] ${data.message || data.stage}`, 'info', runId);
                } else if (data.type === 'UNDERPAINTING_READY') {
                  
                  if (data.layers && data.layers.length > 0) {
                    setPaintingLayers(data.layers);
                  }
                  addLog(`[Underpainting] ${data.message || 'Underpainting ready in < 1s'}`, 'info', runId);
                } else if (data.type === 'PROGRESS') {
                  setProgressPercent(data.percent);
                  setGenerationStage(data.stage);
                  addLog(`[Worker] ${data.stage}`, 'info', runId);
                } else if (data.type === 'SUCCESS') {
                  if (data.layers && data.layers.length > 0) {
                    setPaintingLayers(data.layers);
                  }
                  worker.terminate();
                  workerRef.current = null;
                  
                  resolve(data.result);
                } else if (data.type === 'ERROR') {
                  worker.terminate();
                  workerRef.current = null;
                  
                  reject(new Error(data.error));
                }
              };

              worker.onerror = (err) => {
                worker.terminate();
                workerRef.current = null;
                
                reject(err);
              };

              worker.postMessage({
                type: 'RUN_V4',
                imageData: effectiveImageData,
                width: effectiveW,
                height: effectiveH,
                landmarks: primaryLandmarks,
                categoryMask,
                options: pipelineOptions,
              });
            });
          } catch (workerErr: any) {
            if (runId !== currentRunIdRef.current || abortController.signal.aborted) return;
            addLog(
              `[V4 Worker Notice] Falling back to orchestrator execution: ${workerErr?.message || 'worker dispatch'}`,
              'warn',
              runId
            );
            pipelineResult = await runV4Pipeline({
              image: effectiveCanvas,
              landmarks: primaryLandmarks,
              categoryMask,
              options: pipelineOptions,
            });
            const optSvg = optimizeSvgDocument(pipelineResult.candidates['candidate-c'].svgString);
            pipelineResult.candidates['candidate-c'].svgString = optSvg;
            setPaintingLayers(extractPaintingLayers(optSvg));
            if (skipRequestedRunIdRef.current !== runId) {
              transitionToStatus('painting');
            }
          }
        } else {
          pipelineResult = await runV4Pipeline({
            image: effectiveCanvas,
            landmarks: primaryLandmarks,
            categoryMask,
            options: pipelineOptions,
          });
          const mergedSvg = optimizeSvgDocument(pipelineResult.candidates['candidate-c'].svgString);
          setPaintingLayers(extractPaintingLayers(mergedSvg));
          const optSvg = flags.sizeOptimizer
            ? minifySvgDocument(mergedSvg, { preset: 'balanced' })
            : mergedSvg;
          pipelineResult.candidates['candidate-c'].svgString = optSvg;
          if (skipRequestedRunIdRef.current !== runId) {
            transitionToStatus('painting');
          }
        }

        if (pipelineResult.tiers) {
          setTiersData(pipelineResult.tiers);
        }
        const isRecreation = activeMode !== 'painting';
        const svgOutput = isRecreation
          ? pipelineResult.candidates['candidate-a'].svgString
          : pipelineResult.candidates['candidate-c'].svgString;

        if (runId !== currentRunIdRef.current || abortController.signal.aborted) return;
        const totalDuration = Math.round(performance.now() - t0);

        setOriginalSvg(svgOutput);
        setCurrentSvg(svgOutput);

        if (skipRequestedRunIdRef.current === runId) {
          transitionToStatus('skipped', 'User skipped animation');
        } else {
          lastProgressTimeRef.current = Date.now();
          transitionToStatus('painting');
        }

        setProgressPercent(90);
        setGenerationStage('Measuring color error, SSIM & difference heatmap...');

        // Measure Quality and Build Difference Map
        let ssim = 0;
        let colorErr = 0;
        let specks = 0;

        try {
          const svgImgData = await renderSvgToImageData(svgOutput, effectiveW, effectiveH);
          if (runId !== currentRunIdRef.current || abortController.signal.aborted) return;

          if (svgImgData) {
            // Downsample for sub-second SSIM and speck evaluation
            const evalW = 360;
            const evalH = Math.round(effectiveH * (360 / effectiveW));

            const evalCanvasA = document.createElement('canvas');
            evalCanvasA.width = evalW;
            evalCanvasA.height = evalH;
            const ctxA = evalCanvasA.getContext('2d')!;
            ctxA.drawImage(effectiveCanvas, 0, 0, evalW, evalH);
            const dataA = ctxA.getImageData(0, 0, evalW, evalH);

            const evalCanvasB = document.createElement('canvas');
            evalCanvasB.width = evalW;
            evalCanvasB.height = evalH;
            const ctxB = evalCanvasB.getContext('2d')!;
            const tempSvgCanvas = document.createElement('canvas');
            tempSvgCanvas.width = effectiveW;
            tempSvgCanvas.height = effectiveH;
            tempSvgCanvas.getContext('2d')!.putImageData(svgImgData, 0, 0);
            ctxB.drawImage(tempSvgCanvas, 0, 0, evalW, evalH);
            const dataB = ctxB.getImageData(0, 0, evalW, evalH);

            ssim = Math.round(computeSSIM(dataA, dataB) * 1000) / 1000;
            specks = countSpecks(dataB).speckCount;

            // Fast sampled color error
            let sum = 0;
            let sampleCount = 0;
            for (let i = 0; i < effectiveW * effectiveH; i += 4) {
              const idx = i * 4;
              const dr = effectiveImageData.data[idx] - svgImgData.data[idx];
              const dg = effectiveImageData.data[idx + 1] - svgImgData.data[idx + 1];
              const db = effectiveImageData.data[idx + 2] - svgImgData.data[idx + 2];
              sum += Math.sqrt(dr * dr + dg * dg + db * db);
              sampleCount++;
            }
            colorErr = Math.round((sum / sampleCount) * 10) / 10;

            if (runId !== currentRunIdRef.current || abortController.signal.aborted) return;

            // Generate Photographic Difference Heatmap
            const diffW = Math.min(600, w);
            const diffH = Math.round(h * (diffW / w));
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
              diffCanvas.toBlob((blob) => {
                if (runId !== currentRunIdRef.current) return;
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  setDiffBlobUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return url;
                  });
                }
              });
            }
          }
        } catch (e) {
          console.warn('Metrics evaluation skipped:', e);
        }

        if (runId !== currentRunIdRef.current || abortController.signal.aborted) return;

        // Calculate Gzip size for final summary block
        const rawBytes = new TextEncoder().encode(svgOutput).length;
        const paths = (svgOutput.match(/<path/g) || []).length;
        let gzipBytes = Math.round(rawBytes * 0.35);
        try {
          if (typeof CompressionStream !== 'undefined') {
            const stream = new Blob([svgOutput]).stream().pipeThrough(new CompressionStream('gzip'));
            const res = new Response(stream);
            const buf = await res.arrayBuffer();
            gzipBytes = buf.byteLength;
          }
        } catch (e) {}

        const finalSummary: FinalSummaryData = {
          paths,
          sizeBytes: rawBytes,
          gzipBytes,
          durationMs: totalDuration,
          colorError: colorErr,
          ssim,
          speckCount: specks,
        };

        setSummaryData(finalSummary);
        setProgressPercent(100);
        setGenerationStage('Completed');
        addLog(
          `[V4 Pipeline Completed] ${paths.toLocaleString()} paths | ${(rawBytes / 1024).toFixed(
            1
          )} KB | ${totalDuration}ms | SSIM: ${ssim} | Color Err: ${colorErr}`,
          'success',
          runId
        );
        showToast(
          `Vector synthesis complete: ${paths.toLocaleString()} paths generated`,
          'success'
        );
        if (skipRequestedRunIdRef.current === runId) {
          transitionToStatus('skipped', 'User skipped animation');
        } else {
          transitionToStatus('done');
        }
      } catch (err: any) {
        if (runId !== currentRunIdRef.current) return;
        console.error('V4 processing error:', err);
        const errMsg = err?.message || 'Error executing V4 pipeline';
        setErrorMsg(errMsg);
        addLog(`[Pipeline Error] ${errMsg}`, 'error', runId);
        showToast(`Generation error: ${errMsg}`, 'error');
        transitionToStatus('error', errMsg);
      } finally {
        if (
          runId === currentRunIdRef.current &&
          statusRef.current !== 'done' &&
          statusRef.current !== 'skipped'
        ) {
          transitionToStatus('done');
        }
      }
    },
    [addLog, transitionToStatus]
  );

  const handleTriggerGenerate = useCallback(() => {
    if (!currentImgUrl || isGenerating) return;
    const bq: QualitySetting = selectedQuality === 'medium' ? 'high' : selectedQuality;
    processImage(currentImgUrl, 'max', currentFileName, workbenchMode, bq);
  }, [currentImgUrl, isGenerating, selectedQuality, currentFileName, workbenchMode, processImage]);

  // Handle Quality Selection: Low vs Medium vs High
  const handleQualitySelect = useCallback(
    (q: 'low' | 'medium' | 'high') => {
      setSelectedQuality(q);
      if (!tiersData) return;

      const targetData =
        q === 'low'
          ? (tiersData.low || tiersData.tier3 || tiersData.tier2)
          : q === 'medium'
          ? ((tiersData as any).medium || tiersData.tier2 || tiersData.high || tiersData.tier1)
          : (tiersData.high || tiersData.tier1);
      const targetSvg = targetData?.svgString;

      if (targetSvg) {
        setCurrentSvg(targetSvg);
        setOriginalSvg(targetSvg);
        const blob = new Blob([targetSvg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        setSvgBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setLastGoodBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setPaintingLayers(extractPaintingLayers(targetSvg));
      }
    },
    [tiersData]
  );

  const handleModeSelect = useCallback(
    (newMode: 'painting' | 'recreation') => {
      setWorkbenchMode(newMode);
      if (currentImgUrl) {
        const backendQuality: QualitySetting = selectedQuality === 'medium' ? 'high' : selectedQuality;
        processImage(currentImgUrl, 'max', currentFileName, newMode, backendQuality);
      }
    },
    [currentImgUrl, currentFileName, selectedQuality, processImage]
  );

  const handleModeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextMode = workbenchMode === 'painting' ? 'recreation' : 'painting';
      handleModeSelect(nextMode);
    }
  };

  const qualitiesList: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
  const handleQualityKeyDown = (e: React.KeyboardEvent) => {
    const curIdx = qualitiesList.indexOf(selectedQuality);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = qualitiesList[(curIdx + 1) % qualitiesList.length];
      handleQualitySelect(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = qualitiesList[(curIdx - 1 + qualitiesList.length) % qualitiesList.length];
      handleQualitySelect(prev);
    }
  };

  // Unified photo selection handler (Step 1: Immediately show new photo, clear old results/state, cancel old run)
  const handlePhotoSelection = useCallback(
    (url: string, name: string) => {
      cancelCurrentRun('Switching photo');
      // IMMEDIATELY show the new photo and clear old results/state
      setCurrentImgUrl(url);
      setCurrentFileName(name);
      setOriginalSvg('');
      setCurrentSvg('');
      setSvgBlobUrl('');
      setLastGoodBlobUrl('');
      setDiffBlobUrl(null);
      setPaintingLayers([]);
      setDetectedLandmarks([]);
      setSummaryData(null);
      setColorMetrics({});
      setLogs([]);
      setErrorMsg(null);

      processImage(url, 'max', name);
    },
    [cancelCurrentRun, processImage]
  );

  // Auto-run on mount (Strict mode safe)
  useEffect(() => {
    if (currentImgUrl) {
      processImage(currentImgUrl, 'max', currentFileName);
    }
    return () => {
      cancelCurrentRun('Unmounted');
    };
  }, []);

  // Handle Drag-and-drop file upload
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (!file.type.startsWith('image/')) {
          showToast('Unsupported file type. Please upload a JPEG, PNG, or WebP photo.', 'error');
          return;
        }
        if (file.size > 25 * 1024 * 1024) {
          showToast('File is too large (max 25 MB). Please choose a smaller image.', 'error');
          return;
        }
        const url = URL.createObjectURL(file);
        handlePhotoSelection(url, file.name);
      }
    },
    [handlePhotoSelection, showToast]
  );

  // Handle native file input change
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (!file.type.startsWith('image/')) {
          showToast('Unsupported file type. Please upload a JPEG, PNG, or WebP photo.', 'error');
          return;
        }
        if (file.size > 25 * 1024 * 1024) {
          showToast('File is too large (max 25 MB). Please choose a smaller image.', 'error');
          return;
        }
        const url = URL.createObjectURL(file);
        handlePhotoSelection(url, file.name);
      }
    },
    [handlePhotoSelection, showToast]
  );

  
  // Draggable Vertical Divider
  const handleColMouseDown = () => setIsDraggingCol(true);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingCol && workspaceRef.current) {
        const rect = workspaceRef.current.getBoundingClientRect();
        const newPercent = Math.max(30, Math.min(70, ((e.clientX - rect.left) / rect.width) * 100));
        setLeftPanePercent(newPercent);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingCol(false);
    };

    if (isDraggingCol) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingCol]);

  return (
    <div
      className="v4-app-container"
      style={{
        ['--accent' as any]: photoAccent,
        ['--accent-rgb' as any]: accentRgb,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleDrop}
    >
      {/* Hidden File Picker */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleFileInput}
      />

      {/* Global Drag-and-Drop Overlay */}
      {isDraggingFile && (
        <div className="v4-drag-overlay">
          <div className="v4-drag-overlay__title">Drop a photograph</div>
          <div className="v4-drag-overlay__subtitle">{workbenchMode === 'recreation' ? "We'll recreate it in code" : "We'll paint it in code"}</div>
        </div>
      )}

      {/* 56px Atelier Header: Logo left, segmented controls, actions right */}
      <header className="v4-header">
        <div className="v4-header__left">
          <button
            className="v4-btn"
            onClick={onBackToStudio}
            title="Back to photo upload"
            style={{ padding: '0 8px', height: '32px' }}
          >
            <ArrowLeft size={14} />
          </button>

          <div className="v4-wordmark" onClick={onBackToStudio} title="CodeMyPicture">
            <span className="v4-wordmark__code">Code</span>
            <span className="v4-wordmark__my">My</span>
            <span className="v4-wordmark__picture">Picture</span>
          </div>
        </div>

        <div className="v4-header__center">
          {/* Mode Segmented Control: Exact copy | Painting */}
          <div
            className="v4-segmented-control"
            role="tablist"
            aria-label="Mode"
            onKeyDown={handleModeKeyDown}
          >
            <button
              type="button"
              role="tab"
              aria-selected={workbenchMode === 'recreation'}
              className={`v4-segmented-control__item ${workbenchMode === 'recreation' ? 'is-active' : ''}`}
              onClick={() => handleModeSelect('recreation')}
              title="Exact vector recreation"
              tabIndex={0}
            >
              Exact copy
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workbenchMode === 'painting'}
              className={`v4-segmented-control__item ${workbenchMode === 'painting' ? 'is-active' : ''}`}
              onClick={() => handleModeSelect('painting')}
              title="Stylized painting reconstruction"
              tabIndex={0}
            >
              Painting
            </button>
          </div>

          {/* Quality Segmented Control: Low | Medium | High */}
          <div
            className="v4-segmented-control"
            role="tablist"
            aria-label="Quality"
            onKeyDown={handleQualityKeyDown}
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedQuality === 'low'}
              className={`v4-segmented-control__item ${selectedQuality === 'low' ? 'is-active' : ''}`}
              onClick={() => handleQualitySelect('low')}
              title="Low quality / fast small payload"
              tabIndex={0}
            >
              Low
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedQuality === 'medium'}
              className={`v4-segmented-control__item ${selectedQuality === 'medium' ? 'is-active' : ''}`}
              onClick={() => handleQualitySelect('medium')}
              title="Medium quality balanced preset"
              tabIndex={0}
            >
              Medium
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedQuality === 'high'}
              className={`v4-segmented-control__item ${selectedQuality === 'high' ? 'is-active' : ''}`}
              onClick={() => handleQualitySelect('high')}
              title="High quality maximum fidelity"
              tabIndex={0}
            >
              High
            </button>
          </div>
        </div>

        <div className="v4-header__right v4-header__right--desktop">
          {/* Upload photo button: outlined secondary */}
          <button
            className="v4-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload photo (or drag-and-drop anywhere)"
            style={{ height: '32px' }}
          >
            <Upload size={14} className="v4-btn--upload-icon" style={{ display: 'none' }} />
            <span className="v4-btn--upload-text">Upload photo</span>
          </button>

          {/* Use this code (formerly Export & Embed) */}
          <button
            className="v4-btn"
            onClick={() => setIsExportOpen(true)}
            disabled={!currentSvg}
            title="Export code and raster formats"
            style={{ height: '32px' }}
          >
            <span>Use this code</span>
          </button>

          {/* Exactly one solid vermilion button on screen: "Generate" */}
          <button
            className="v4-btn v4-btn--generate"
            onClick={() => {
              const bq: QualitySetting = selectedQuality === 'medium' ? 'high' : selectedQuality;
              processImage(currentImgUrl, 'max', currentFileName, workbenchMode, bq);
            }}
            disabled={isGenerating || !currentImgUrl}
            title={isGenerating ? generationStage : 'Generate vector artwork'}
          >
            <span>{isGenerating ? 'Generating...' : 'Generate'}</span>
          </button>
        </div>

        {/* Mobile Row 2 for native selects (< 768px) */}
        <div className="v4-mobile-row-selects" style={{ display: 'none' }}>
          <select
            className="v4-select"
            value={workbenchMode}
            onChange={(e) => handleModeSelect(e.target.value as 'painting' | 'recreation')}
            aria-label="Mode"
          >
            <option value="recreation">Exact copy</option>
            <option value="painting">Painting</option>
          </select>
          <select
            className="v4-select"
            value={selectedQuality}
            onChange={(e) => handleQualitySelect(e.target.value as 'low' | 'medium' | 'high')}
            aria-label="Quality"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </header>

      {/* Mobile Tabs Bar (< 768px) */}
      <div className="v4-mobile-tabs-bar">
        <button
          className={`v4-mobile-tab-btn ${activeMobileTab === 'code' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('code')}
        >
          <span>Code</span>
        </button>
        <button
          className={`v4-mobile-tab-btn ${activeMobileTab === 'result' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('result')}
        >
          <span>Result</span>
        </button>
      </div>

      {/* 2. TWO-PANE WORKSPACE: LEFT = CODE PANEL, RIGHT = RESULT PANEL */}
      <main className="v4-workspace" ref={workspaceRef}>
        {/* LEFT PANE: CODE EDITOR (FULL HEIGHT) */}
        <section
          className={`v4-left-pane ${activeMobileTab !== 'code' ? 'mobile-hidden' : ''}`}
          style={{ width: `${leftPanePercent}%` }}
        >
          <V4CodeEditor
            originalSvg={originalSvg}
            currentSvg={currentSvg}
            onSvgChange={(newSvg) => setCurrentSvg(newSvg)}
            width={imageDims.width}
            height={imageDims.height}
            status={workbenchStatus}
            isStreaming={isGenerating || isPaintingActive}
            onToast={showToast}
            mode={workbenchMode}
            quality={selectedQuality}
            durationMs={summaryData?.durationMs}
            colorMetrics={colorMetrics}
            activeTab={editorTab}
            onTabChange={setEditorTab}
            logs={logs}
            onClearLogs={() => setLogs([])}
            progressPercent={progressPercent}
            generationStage={generationStage}
            onCancel={handleCancelGeneration}
            onGenerate={handleTriggerGenerate}
            sizeStats={sizeStats}
          />
        </section>

        {/* Draggable Vertical Divider between Panes (Double-click resets to 45/55) */}
        <div
          className={`v4-pane-divider ${isDraggingCol ? 'is-dragging' : ''}`}
          onMouseDown={handleColMouseDown}
          onDoubleClick={() => setLeftPanePercent(45)}
          title="Drag to resize panes (Double-click to reset 45% / 55%)"
        />

        {/* RIGHT PANE: RESULT / IMAGE VIEWPORT */}
        <section
          className={`v4-right-pane ${activeMobileTab !== 'result' ? 'mobile-hidden' : ''}`}
          ref={rightPaneRef}
          style={{ width: `calc(${100 - leftPanePercent}% - 5px)` }}
        >
          <V4ResultPane
            currentImgUrl={currentImgUrl}
            fileName={currentFileName}
            mode={workbenchMode}
            quality={selectedQuality}
            svgBlobUrl={svgBlobUrl}
            lastGoodBlobUrl={lastGoodBlobUrl}
            diffBlobUrl={diffBlobUrl}
            status={workbenchStatus}
            isGenerating={isGenerating}
            generationStage={generationStage}
            progressPercent={progressPercent}
            width={imageDims.width}
            height={imageDims.height}
            sizeStats={sizeStats}
            isDraggingFile={isDraggingFile}
            onDropAreaClick={() => fileInputRef.current?.click()}
            onGenerate={handleTriggerGenerate}
            accentColor={photoAccent}
            layers={paintingLayers}
            landmarks={detectedLandmarks}
          />
        </section>
      </main>

      {/* Mobile Sticky Generate Button (< 768px) */}
      <div className="v4-mobile-sticky-generate-bar">
        <button
          className="v4-btn v4-btn--generate"
          onClick={() => {
            const bq: QualitySetting = selectedQuality === 'medium' ? 'high' : selectedQuality;
            processImage(currentImgUrl, 'max', currentFileName, workbenchMode, bq);
          }}
          disabled={isGenerating || !currentImgUrl}
          title={isGenerating ? generationStage : 'Generate vector artwork'}
        >
          <span>{isGenerating ? 'Generating...' : 'Generate'}</span>
        </button>
      </div>

      {/* 3. EXPORT & EMBED MODAL */}
      <V4ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        svgContent={currentSvg}
        width={imageDims.width}
        height={imageDims.height}
      />

      {/* 4. FLOATING TOAST NOTIFICATIONS */}
      <V4Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
export default V4DiagnosticWorkbench;
