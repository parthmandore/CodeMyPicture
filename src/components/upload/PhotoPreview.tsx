import React, { useState, useEffect, useRef } from 'react';
import {
  Trash2,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ValidatedImage } from '../../types/upload';
import { formatBytes, formatDimensions, formatAspectRatio } from '../../utils/formatters';
import { FaceDetectionResult } from '../../services/faceDetection/types';
import { useFaceDetection } from '../../services/faceDetection';
import {
  extractFullImageGeometry,
  FullImageGeometryData,
} from '../../services/geometry/imageGeometryService';
import {
  GeometryOverlay,
  GeometryOverlayControls,
  GeometryOverlayMode,
} from '../studio/v4/GeometryOverlay';
import { PreviewSkeleton } from '../common/Skeletons';
import { useToast } from '../common/ToastContext';

export interface PhotoPreviewProps {
  image: ValidatedImage;
  onReplace: () => void;
  onRemove: () => void;
  onContinue: (detectionResult?: FaceDetectionResult, img?: HTMLImageElement) => void;
  isGenerating?: boolean;
}

export const PhotoPreview: React.FC<PhotoPreviewProps> = ({
  image,
  onReplace,
  onRemove,
  onContinue,
  isGenerating = false,
}) => {
  const [overlayMode, setOverlayMode] = useState<GeometryOverlayMode>('geometry');
  const [detectionResult, setDetectionResult] = useState<FaceDetectionResult | null>(null);
  const [geometryData, setGeometryData] = useState<FullImageGeometryData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const toast = useToast();

  const { detect, isReady, initialize, state: engineState, errorMessage: engineError } = useFaceDetection(true);

  useEffect(() => {
    if (engineError) {
      toast.error(`WASM Engine: ${engineError}`);
    }
  }, [engineError, toast]);

  // Run face landmark detection when image or engine is ready
  useEffect(() => {
    let isCancelled = false;

    async function runDetection() {
      if (!imgRef.current) return;
      setIsAnalyzing(true);

      try {
        if (!isReady && engineState === 'uninitialized') {
          await initialize();
        }

        if (imgRef.current && imgRef.current.complete) {
          const result = await detect(imgRef.current);
          if (!isCancelled) {
            setDetectionResult(result);
            // Compute full-image geometry integrating landmarks if detected
            const geo = extractFullImageGeometry(
              imgRef.current,
              image.width,
              image.height,
              result?.landmarks || []
            );
            setGeometryData(geo);
          }
        }
      } catch (err) {
        console.error('Detection execution error:', err);
      } finally {
        if (!isCancelled) {
          setIsAnalyzing(false);
        }
      }
    }

    if (imgRef.current && imgRef.current.complete) {
      runDetection();
    }

    return () => {
      isCancelled = true;
    };
  }, [image.objectUrl, image.width, image.height, isReady, engineState, detect, initialize]);

  const handleImageLoad = async () => {
    setImageLoaded(true);
    if (imgRef.current) {
      setIsAnalyzing(true);
      try {
        const result = await detect(imgRef.current);
        setDetectionResult(result);
        const geo = extractFullImageGeometry(
          imgRef.current,
          image.width,
          image.height,
          result?.landmarks || []
        );
        setGeometryData(geo);
      } catch (err) {
        console.error('Detection load error:', err);
        // Fallback geometry even if face detection fails
        const geo = extractFullImageGeometry(imgRef.current, image.width, image.height, []);
        setGeometryData(geo);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleContinueClick = () => {
    onContinue(detectionResult || undefined, imgRef.current || undefined);
  };

  const hasFace = Boolean(detectionResult?.detected && detectionResult.faceCount > 0);

  return (
    <div className="preview-container-atelier">
      {/* Top Technical Metadata Toolbar */}
      <div className="preview-toolbar-atelier">
        <div className="preview-toolbar-atelier__meta mono">
          <span className="meta-chip meta-chip--format">{image.mimeType.replace('image/', '').toUpperCase()}</span>
          <span className="meta-chip">{formatBytes(image.sizeBytes)}</span>
          <span className="meta-chip">{formatDimensions(image.width, image.height)}</span>
          <span className="meta-chip">{formatAspectRatio(image.width, image.height)}</span>
        </div>

        <div className="preview-toolbar-atelier__actions">
          <button
            type="button"
            className="v4-btn"
            onClick={onReplace}
            title="Select a different photograph"
            disabled={isGenerating}
          >
            <RefreshCw size={12} style={{ marginRight: '5px' }} />
            <span>Replace</span>
          </button>

          <button
            type="button"
            className="v4-btn v4-btn--danger"
            onClick={onRemove}
            title="Remove current photograph"
            disabled={isGenerating}
          >
            <Trash2 size={12} style={{ marginRight: '5px' }} />
            <span>Remove</span>
          </button>
        </div>
      </div>

      {/* Main Preview Viewport */}
      <div className="preview-card-atelier">
        <div className="preview-stage-atelier" style={{ position: 'relative' }}>
          {!imageLoaded && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PreviewSkeleton width={image.width} height={image.height} message="Calibrating image buffer & scene geometry…" />
            </div>
          )}

          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxWidth: '100%',
              maxHeight: '100%',
              opacity: imageLoaded ? 1 : 0,
              transition: 'opacity 180ms ease-out',
            }}
          >
            <img
              ref={imgRef}
              src={image.objectUrl}
              alt="Source photograph ready for vector reconstruction"
              className="preview-image-atelier"
              onLoad={handleImageLoad}
            />

            {/* Full-Image Geometry, Edge Contours, and Optional Facial Landmarks Overlays */}
            <GeometryOverlay
              width={image.width}
              height={image.height}
              mode={overlayMode}
              geometryData={geometryData}
              landmarks={detectionResult?.landmarks}
            />
          </div>

          {/* Visualization Controls (Full Geometry, Contours, Landmarks, None) */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              zIndex: 30,
            }}
          >
            <GeometryOverlayControls
              activeMode={overlayMode}
              onModeChange={setOverlayMode}
              hasLandmarks={hasFace}
              hasSvgPaths={false}
            />
          </div>

          {/* Analyzing HUD Badge */}
          {isAnalyzing && (
            <div className="preview-analyzing-hud mono">
              <div className="analyzing-hud-spinner" aria-hidden="true" />
              <span>Analyzing full composition geometry & contours…</span>
            </div>
          )}
        </div>

        {/* Technical Calibration Specs Card */}
        <div className="calibration-card-atelier">
          <div className="calibration-card__header mono">
            <span className="calibration-dot" aria-hidden="true" />
            <span>GEOMETRIC & BIOMETRIC CALIBRATION SUMMARY</span>
          </div>

          <div className="calibration-card__body">
            <div className="calibration-card__status-row">
              <span className="calibration-status-icon">
                {hasFace ? (
                  <CheckCircle2 size={15} style={{ color: 'var(--moss)' }} />
                ) : isAnalyzing ? (
                  <Cpu size={15} style={{ color: 'var(--amber)' }} />
                ) : (
                  <CheckCircle2 size={15} style={{ color: 'var(--moss)' }} />
                )}
              </span>

              <div>
                <h3 className="calibration-heading">
                  {hasFace
                    ? 'BIOMETRIC & SCENE GEOMETRY CALIBRATED'
                    : isAnalyzing
                    ? 'ANALYZING FULL COMPOSITION GEOMETRY…'
                    : 'FULL-IMAGE SCENE GEOMETRY CALIBRATED'}
                </h3>
                <p className="calibration-subtext">
                  {hasFace
                    ? `Mapped ${geometryData?.edgeContours?.length || 'full'} scene contours and ${detectionResult?.landmarks?.length || 478} biometric landmarks across hair, facial structure, clothing, and background.`
                    : isAnalyzing
                    ? 'Processing scene contours, luminance gradients, and structural boundary meshes in local WebAssembly memory…'
                    : `Extracted ${geometryData?.edgeContours?.length || 'scene'} continuous edge contours across clothing, body, and background scene elements.`}
                </p>
              </div>
            </div>

            {detectionResult?.latencyMs !== undefined && (
              <span className="calibration-latency-tag">
                WASM: {detectionResult.latencyMs} ms
              </span>
            )}
          </div>

          {engineError && (
            <div className="calibration-error-box">
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{engineError}</span>
              <button
                type="button"
                className="v4-btn v4-btn--sm"
                onClick={() => initialize()}
                style={{ fontSize: '11px', padding: '3px 8px', marginLeft: '8px' }}
                title="Retry MediaPipe Face Landmarker initialization"
              >
                Retry
              </button>
            </div>
          )}

          {/* Action Row */}
          <div className="calibration-card__actions">
            <div className="calibration-card__hint">
              <Sparkles size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span>Ready for synthesis. Choose Painting or Recreation inside the Workbench.</span>
            </div>

            <button
              type="button"
              className="v4-btn v4-btn--accent preview-continue-btn"
              onClick={handleContinueClick}
              disabled={isGenerating}
              title="Launch the CodeMyPicture Studio Workbench"
            >
              <Layers size={13} style={{ marginRight: '6px' }} />
              <span>{isGenerating ? 'Synthesizing…' : 'Open in Studio Workbench'}</span>
              <ArrowRight size={13} style={{ marginLeft: '6px' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoPreview;
