import { NormalizedLandmark } from '../faceDetection/types';
import { QualitySetting, AllQualitiesResult } from '../../engine/v4/tiers';
import { PaintingLayer } from '../../engine/v4/svgOptimizer';
import { TerminalLog, FinalSummaryData } from '../../components/studio/v4/V4Terminal';

export type GenerationStageId =
  | 'ingestion'
  | 'calibration'
  | 'analysis'
  | 'synthesis'
  | 'optimization'
  | 'finalization';

export interface StageDefinition {
  id: GenerationStageId;
  index: string; // '01', '02', etc.
  name: string;
  description: string;
  weightPercent: number;
}

export const GENERATION_STAGES: StageDefinition[] = [
  {
    id: 'ingestion',
    index: '01',
    name: 'IMAGE INGESTION',
    description: 'Validating format, decoding bitmap, and establishing viewport coordinates',
    weightPercent: 10,
  },
  {
    id: 'calibration',
    index: '02',
    name: 'CALIBRATION & BIOMETRICS',
    description: 'Analyzing color histogram, vivid accent, and detecting MediaPipe 478 landmarks',
    weightPercent: 25,
  },
  {
    id: 'analysis',
    index: '03',
    name: 'SEMANTIC SEGMENTATION',
    description: 'Extracting hair, skin, and apparel masks to guide vector layering',
    weightPercent: 20,
  },
  {
    id: 'synthesis',
    index: '04',
    name: 'VECTOR SYNTHESIS',
    description: 'Executing multi-scale path tracing and organic planar modeling',
    weightPercent: 30,
  },
  {
    id: 'optimization',
    index: '05',
    name: 'PATH OPTIMIZATION',
    description: 'Consolidating duplicate color paths and minifying SVG curve precision',
    weightPercent: 10,
  },
  {
    id: 'finalization',
    index: '06',
    name: 'FINALIZATION & METRICS',
    description: 'Computing SSIM fidelity, photographic difference heatmap, and Gzip budgets',
    weightPercent: 5,
  },
];

export type GenerationStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface BiometricColorSample {
  hex: string;
  r: number;
  g: number;
  b: number;
}

export interface BiometricColorMetrics {
  skin?: BiometricColorSample;
  lips?: BiometricColorSample;
  hair?: BiometricColorSample;
  bg?: BiometricColorSample;
}

export interface ModeResult {
  mode: 'painting' | 'recreation';
  quality: QualitySetting;
  svgOutput: string;
  svgBlobUrl: string;
  diffBlobUrl: string | null;
  summaryData: FinalSummaryData | null;
  paintingLayers: PaintingLayer[];
  tiersData: AllQualitiesResult | null;
  durationMs: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
  error?: string;
}

export interface GenerationJob {
  id: string;
  sourceUrl: string;
  fileName: string;
  mode: 'painting' | 'recreation';
  quality: QualitySetting;
  status: GenerationStatus;
  stageId: GenerationStageId;
  stageIndex: string;
  stageName: string;
  stageDetail: string;
  progressPercent: number; // strictly 0..100 based on actual events
  startTime: number;
  elapsedMs: number;
  estimatedRemainingSeconds: number | null; // Phase 2: Honest 13s ETA
  etaStatus: 'countdown' | 'finalizing' | 'completed';
  imageDimensions: { width: number; height: number };
  detectedLandmarks: NormalizedLandmark[];
  colorMetrics: BiometricColorMetrics;
  photoAccent: string;
  paintingLayers: PaintingLayer[];
  svgOutput: string;
  svgBlobUrl: string;
  diffBlobUrl: string | null;
  tiersData: AllQualitiesResult | null;
  summaryData: FinalSummaryData | null;
  logs: TerminalLog[];
  error: string | null;

  // Phase 4: Automatic dual-mode results cache
  results: {
    painting: ModeResult | null;
    recreation: ModeResult | null;
  };
  backgroundModeStatus: 'idle' | 'running' | 'completed' | 'failed';
}
