import React, { useState, useRef, useCallback } from 'react';
import { ValidatedImage, UploadError } from '../../types/upload';
import { validateImageFile } from '../../utils/imageValidator';
import { loadImageFromFile, safeRevokeObjectURL } from '../../utils/imageLoader';
import { Dropzone } from './Dropzone';
import { PhotoPreview } from './PhotoPreview';
import { ErrorAlert } from '../common/ErrorAlert';
import { useToast } from '../common/ToastContext';
import { FaceDetectionResult } from '../../services/faceDetection/types';
import { ModeComparisonSection } from '../landing/ModeComparisonSection';
import { WorkflowSection } from '../landing/WorkflowSection';
import { TechnicalFeaturesSection } from '../landing/TechnicalFeaturesSection';
import { LocalPrivacySection } from '../landing/LocalPrivacySection';
import { ExportFormatsSection } from '../landing/ExportFormatsSection';
import { DiagnosticsInfoSection } from '../landing/DiagnosticsInfoSection';

export interface UploadWorkflowProps {
  currentImage: ValidatedImage | null;
  onImageChange: (image: ValidatedImage | null) => void;
  onContinue: (detectionResult?: FaceDetectionResult, img?: HTMLImageElement) => void;
  isGenerating?: boolean;
}

export const UploadWorkflow: React.FC<UploadWorkflowProps> = ({
  currentImage,
  onImageChange,
  onContinue,
  isGenerating = false,
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const processFile = useCallback(
    async (file: File) => {
      setIsValidating(true);
      setError(null);

      try {
        // Step 1: Pre-decoding validation (file existence, size limit, MIME, magic bytes)
        const validationResult = await validateImageFile(file);

        if (!validationResult.valid) {
          setError(validationResult.error);
          toast.error(validationResult.error.message);
          setIsValidating(false);
          return;
        }

        // Step 2: In-browser bitmap decoding and dimension check
        const loadResult = await loadImageFromFile(file, validationResult.mimeType);

        if (!loadResult.success) {
          setError(loadResult.error);
          toast.error(loadResult.error.message);
          setIsValidating(false);
          return;
        }

        // Step 3: Success — cleanly revoke old object URL if any, and set new image
        if (currentImage?.objectUrl) {
          safeRevokeObjectURL(currentImage.objectUrl);
        }

        onImageChange(loadResult.image);
        toast.success(`Photo loaded: ${file.name} (${loadResult.image.width} × ${loadResult.image.height} px)`);
      } catch (err) {
        console.error('Unhandled upload processing error:', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setError({
          code: 'SYSTEM_ERROR',
          message: 'An unexpected error occurred while processing the image file.',
          details: errMsg,
          timestamp: Date.now(),
        });
        toast.error(`Upload error: ${errMsg}`);
      } finally {
        setIsValidating(false);
      }
    },
    [currentImage, onImageChange, toast]
  );

  const handleRemovePhoto = useCallback(() => {
    if (currentImage?.objectUrl) {
      safeRevokeObjectURL(currentImage.objectUrl);
    }
    onImageChange(null);
    setError(null);
    toast.info('Photograph removed');
  }, [currentImage, onImageChange, toast]);

  const handleTriggerReplace = useCallback(() => {
    replaceFileInputRef.current?.click();
  }, []);

  const handleReplaceInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
      e.target.value = '';
    },
    [processFile]
  );

  return (
    <div className="upload-workflow-section">
      {/* Hidden file input for Replace Action */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleReplaceInputChange}
        className="sr-only"
        aria-hidden="true"
      />

      {/* 1. Hero Header matching Studio Workbench Visual Language */}
      {!currentImage && (
        <div className="studio-hero">
          <div className="studio-hero__badge mono">
            <span className="studio-hero__badge-dot" />
            <span>SYSTEM // VECTOR RECONSTRUCTION & CREATIVE CODING STUDIO</span>
          </div>

          <h1 className="studio-hero__title">
            Reconstruct photographs into{' '}
            <em className="studio-hero__title-accent">pure vector code</em>.
          </h1>

          <p className="studio-hero__subtitle">
            CodeMyPicture transforms portrait and scene photographs into genuine, editable SVG code directly inside your
            browser. Choose expressive digital painting brushwork or crisp photographic reconstruction — executed entirely in local device memory without server uploads.
          </p>

          <div className="studio-hero__disclaimer mono">
            <span>[ NOTE: Synthesizes scalable mathematical vector geometry; does not claim pixel-perfect raster replication or identical reproduction ]</span>
          </div>
        </div>
      )}

      {/* Error alert banner */}
      {error && (
        <div className="workflow-alert-wrapper">
          <ErrorAlert error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* 2. Prominent Photo-Upload Call to Action */}
      {!currentImage ? (
        <Dropzone
          onFileSelected={processFile}
          isValidating={isValidating}
        />
      ) : (
        <PhotoPreview
          image={currentImage}
          onReplace={handleTriggerReplace}
          onRemove={handleRemovePhoto}
          onContinue={onContinue}
          isGenerating={isGenerating}
        />
      )}

      {/* 3. Detailed Technical Information Sections (Shown on Landing Page when no photo is active) */}
      {!currentImage && (
        <>
          {/* Section 1: Painting vs Recreation Comparison & Quality Tiers */}
          <ModeComparisonSection />

          {/* Section 2: Five-Stage Reconstruction Workflow */}
          <WorkflowSection />

          {/* Section 3: Engine Architecture & Vector Geometry */}
          <TechnicalFeaturesSection />

          {/* Section 4: Verified Client-Side Privacy */}
          <LocalPrivacySection />

          {/* Section 5: Available Export Formats */}
          <ExportFormatsSection />

          {/* Section 6: Studio Diagnostics & Technical Telemetry */}
          <DiagnosticsInfoSection />
        </>
      )}
    </div>
  );
};

export default UploadWorkflow;
