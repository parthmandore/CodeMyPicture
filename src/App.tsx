import React, { useState, useEffect } from 'react';
import { ValidatedImage } from './types/upload';
import { FaceDetectionResult } from './services/faceDetection/types';
import { useFaceDetection } from './services/faceDetection';
import { SegmentationService } from './services/segmentation/segmentationService';
import { Header } from './components/layout/Header';
import { StepIndicator } from './components/studio/StepIndicator';
import { UploadWorkflow } from './components/upload/UploadWorkflow';
import { Footer } from './components/layout/Footer';
import { V4DiagnosticWorkbench } from './components/studio/V4DiagnosticWorkbench';
import { NotFoundPage } from './components/common/NotFoundPage';
import { ToastProvider } from './components/common/ToastContext';
import { safeRevokeObjectURL } from './utils/imageLoader';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/v4workbench.css';

export const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<'upload' | 'studio' | 'not-found'>('upload');
  const [currentImage, setCurrentImage] = useState<ValidatedImage | null>(null);

  // Initialize MediaPipe engines eagerly in background
  const { state: engineState, initialize: initEngine } = useFaceDetection(true);

  // Path & hash routing detection
  useEffect(() => {
    const checkRoute = () => {
      const pathname = window.location.pathname;
      const isRootPath = pathname === '/' || pathname === '' || pathname.endsWith('index.html');

      if (!isRootPath) {
        setCurrentView('not-found');
        return;
      }

      if (
        window.location.hash.includes('v4') ||
        window.location.hash.includes('studio') ||
        window.location.search.includes('view=v4') ||
        window.location.search.includes('v4=1')
      ) {
        if (currentImage) {
          setCurrentView('studio');
        } else {
          setCurrentView('upload');
        }
      } else {
        if (currentView === 'not-found') {
          setCurrentView('upload');
        }
      }
    };

    checkRoute();
    window.addEventListener('hashchange', checkRoute);
    window.addEventListener('popstate', checkRoute);
    return () => {
      window.removeEventListener('hashchange', checkRoute);
      window.removeEventListener('popstate', checkRoute);
    };
  }, [currentImage, currentView]);

  useEffect(() => {
    SegmentationService.getInstance().initialize().catch((err) => {
      console.warn('Failed to eagerly initialize SegmentationService:', err);
    });
  }, []);

  // Clean up object URL when app unmounts
  useEffect(() => {
    return () => {
      if (currentImage?.objectUrl) {
        safeRevokeObjectURL(currentImage.objectUrl);
      }
    };
  }, [currentImage]);

  const handleImageChange = (newImage: ValidatedImage | null) => {
    if (currentImage?.objectUrl) {
      safeRevokeObjectURL(currentImage.objectUrl);
    }
    setCurrentImage(newImage);
  };

  const handleContinueToStudio = (
    _detectionResult?: FaceDetectionResult,
    _imgElement?: HTMLImageElement
  ) => {
    setCurrentView('studio');
  };

  const handleViewChange = (view: 'upload' | 'studio') => {
    if (view === 'studio' && !currentImage) {
      setCurrentView('upload');
      return;
    }
    setCurrentView(view);
  };

  if (currentView === 'not-found') {
    return (
      <NotFoundPage
        onReturnHome={() => {
          window.history.pushState(null, '', '/');
          setCurrentView('upload');
        }}
      />
    );
  }

  return (
    <div className="codemypicture-app codemyface-app">
      {currentView === 'upload' && (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Header
            currentView={currentView}
            onViewChange={handleViewChange}
            hasValidImage={Boolean(currentImage)}
            engineState={engineState}
            onInitEngine={initEngine}
          />
          <StepIndicator
            hasImage={Boolean(currentImage)}
            portraitGenerated={false}
            currentView={currentView}
          />
          <main className="studio-main-content" style={{ flex: 1 }}>
            <div className="studio-page-container">
              <UploadWorkflow
                currentImage={currentImage}
                onImageChange={handleImageChange}
                onContinue={handleContinueToStudio}
                isGenerating={false}
              />
            </div>
          </main>
          <Footer />
        </div>
      )}

      {currentView === 'studio' && (
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
          <V4DiagnosticWorkbench
            onBackToStudio={() => {
              setCurrentImage(null);
              setCurrentView('upload');
            }}
            initialImageUrl={currentImage?.objectUrl}
            initialFileName={currentImage?.file?.name}
          />
        </main>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
