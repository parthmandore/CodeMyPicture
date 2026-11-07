import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ValidatedImage } from './types/upload';
import { FaceDetectionResult } from './services/faceDetection/types';
import { useFaceDetection } from './services/faceDetection';
import { SegmentationService } from './services/segmentation/segmentationService';
import { Header } from './components/layout/Header';
import { StepIndicator } from './components/studio/StepIndicator';
import { UploadWorkflow } from './components/upload/UploadWorkflow';
import { Footer } from './components/layout/Footer';
import { StudioInitSkeleton } from './components/common/Skeletons';
import { ToastProvider } from './components/common/ToastContext';
import { PrivacyModal } from './components/common/PrivacyModal';
import { ConsentBanner } from './components/common/ConsentBanner';
import { safeRevokeObjectURL } from './utils/imageLoader';
import analytics from './services/analytics';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/v4workbench.css';

// Lazy-load heavy Studio Workbench and 404 route for optimal initial bundle splitting
const V4DiagnosticWorkbench = lazy(() =>
  import('./components/studio/V4DiagnosticWorkbench').then((m) => ({ default: m.V4DiagnosticWorkbench }))
);
const NotFoundPage = lazy(() =>
  import('./components/common/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);

export const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<'upload' | 'studio' | 'not-found'>('upload');
  const [currentImage, setCurrentImage] = useState<ValidatedImage | null>(null);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

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

  // Track page views upon view navigation
  useEffect(() => {
    const pagePath = currentView === 'studio' ? '/#studio' : currentView === 'not-found' ? '/404' : '/';
    const pageTitle =
      currentView === 'studio'
        ? 'Studio Workbench — CodeMyPicture'
        : currentView === 'not-found'
        ? '404 Not Found — CodeMyPicture'
        : 'CodeMyPicture — In-Browser Vector Reconstruction';
    analytics.trackPageView(pagePath, pageTitle);
  }, [currentView]);

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
      <Suspense fallback={<div className="studio-fallback-loader mono" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--ink)', color: 'var(--paper-dim)', fontSize: '12px' }}>ROUTING EXCEPTION // INITIALIZING...</div>}>
        <NotFoundPage
          onReturnHome={() => {
            window.history.pushState(null, '', '/');
            setCurrentView('upload');
          }}
        />
      </Suspense>
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
            onOpenPrivacy={() => setIsPrivacyOpen(true)}
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
                onOpenPrivacy={() => setIsPrivacyOpen(true)}
              />
            </div>
          </main>
          <Footer onOpenPrivacy={() => setIsPrivacyOpen(true)} />
        </div>
      )}

      {currentView === 'studio' && (
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
          <Suspense fallback={<StudioInitSkeleton />}>
            <V4DiagnosticWorkbench
              onBackToStudio={() => {
                setCurrentView('upload');
              }}
              initialImageUrl={currentImage?.objectUrl}
              initialFileName={currentImage?.file?.name}
            />
          </Suspense>
        </main>
      )}

      {/* Global Privacy Architecture & Preferences Modal */}
      <PrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />

      {/* Subtle Analytics Consent Banner (Only shown if VITE_GA_MEASUREMENT_ID is configured) */}
      <ConsentBanner onOpenPreferences={() => setIsPrivacyOpen(true)} />
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
