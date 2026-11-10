/**
 * CodeMyPicture — Privacy-Conscious Product Analytics Service
 *
 * Implements Google Analytics 4 (GA4) with strict client-side privacy guardrails:
 * 1. Zero Transmission of User Imagery:
 *    - Never transmits uploaded photos, image pixels, SVG vectors, or personal file names.
 *    - All metadata is strictly sanitized (format, dimensions, execution duration, path counts).
 * 2. Strict Consent Enforcement:
 *    - Respects ePrivacy / GDPR consent choices.
 *    - Default consent mode: analytics_storage = 'denied'.
 *    - Google Tag script is ONLY injected if consent is explicitly granted and VITE_GA_MEASUREMENT_ID is configured.
 * 3. Event Deduplication:
 *    - Eliminates duplicate page views and rapid duplicate event triggers.
 * 4. Graceful Fallback:
 *    - When unconfigured, safely operates in silent diagnostic mode without network errors.
 */

export type AnalyticsEventName =
  | 'page_view'
  | 'upload_started'
  | 'upload_completed'
  | 'image_validation_failed'
  | 'reconstruction_started'
  | 'reconstruction_completed'
  | 'reconstruction_failed'
  | 'painting_mode_selected'
  | 'recreation_mode_selected'
  | 'high_quality_selected'
  | 'low_quality_selected'
  | 'svg_exported'
  | 'png_exported'
  | 'html_exported'
  | 'contact_form_submitted';

export interface AnalyticsEventParams {
  [key: string]: string | number | boolean | undefined;
}

export type ConsentStatus = 'granted' | 'denied' | 'unset';

const CONSENT_STORAGE_KEY = 'codemypicture_consent_analytics';

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

class AnalyticsService {
  private static instance: AnalyticsService | null = null;
  private measurementId: string | null = null;
  private isGtagLoaded: boolean = false;
  private lastPageViewPath: string | null = null;
  private recentEvents: Map<string, number> = new Map();

  private constructor() {
    this.measurementId = (import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim() || null;
    this.initConsentMode();
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Retrieves the current analytics measurement ID (if configured)
   */
  public getMeasurementId(): string | null {
    return this.measurementId;
  }

  /**
   * Checks whether analytics is configured with a valid measurement ID
   */
  public isConfigured(): boolean {
    return Boolean(this.measurementId && this.measurementId.startsWith('G-'));
  }

  /**
   * Retrieves current user consent choice ('granted' | 'denied' | 'unset')
   */
  public getConsent(): ConsentStatus {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = localStorage.getItem(CONSENT_STORAGE_KEY);
        if (val === 'granted' || val === 'denied') {
          return val;
        }
      }
    } catch {
      // localStorage restricted
    }
    return 'unset';
  }

  /**
   * Updates user consent preference and initializes GA4 if granted
   */
  public setConsent(status: 'granted' | 'denied'): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(CONSENT_STORAGE_KEY, status);
      }
    } catch {
      // Ignore localStorage errors
    }

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: status,
      });
    }

    if (status === 'granted' && this.isConfigured() && !this.isGtagLoaded) {
      this.loadGoogleTagScript();
    }
  }

  /**
   * Initializes default Google consent mode (denied by default)
   */
  private initConsentMode(): void {
    if (typeof window === 'undefined') return;

    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function () {
        window.dataLayer?.push(arguments);
      };
    }

    const currentConsent = this.getConsent();

    // Default to denied unless explicitly granted
    window.gtag('consent', 'default', {
      analytics_storage: currentConsent === 'granted' ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });

    if (currentConsent === 'granted' && this.isConfigured()) {
      this.loadGoogleTagScript();
    }
  }

  /**
   * Dynamically injects Google Tag script when configured and consent is granted
   */
  private loadGoogleTagScript(): void {
    if (this.isGtagLoaded || !this.measurementId || typeof document === 'undefined') {
      return;
    }

    try {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(this.measurementId)}`;
      document.head.appendChild(script);

      window.gtag?.('js', new Date());
      window.gtag?.('config', this.measurementId, {
        send_page_view: false, // We control page_view manually to avoid duplicates
        anonymize_ip: true,
      });

      this.isGtagLoaded = true;
      console.log(`[Analytics] Google Analytics 4 initialized (${this.measurementId})`);
    } catch (err) {
      console.warn('[Analytics] Failed to inject Google Tag script:', err);
    }
  }

  /**
   * Strictly sanitizes event parameters to guarantee zero PII or image data leakage
   */
  private sanitizeParams(params: AnalyticsEventParams = {}): AnalyticsEventParams {
    const sanitized: AnalyticsEventParams = {};

    for (const [key, value] of Object.entries(params)) {
      const lowerKey = key.toLowerCase();

      // Explicitly reject prohibited parameter names
      if (
        lowerKey.includes('name') ||
        lowerKey.includes('file') ||
        lowerKey.includes('svg') ||
        lowerKey.includes('image') ||
        lowerKey.includes('pixel') ||
        lowerKey.includes('email') ||
        lowerKey.includes('message') ||
        lowerKey.includes('data') ||
        lowerKey.includes('content')
      ) {
        continue;
      }

      // Allow safe primitives
      if (typeof value === 'string') {
        sanitized[key] = value.slice(0, 80);
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        sanitized[key] = value;
      } else if (typeof value === 'boolean') {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Tracks a product or conversion event
   */
  public trackEvent(name: AnalyticsEventName, rawParams: AnalyticsEventParams = {}): void {
    const consent = this.getConsent();

    // 1. Consent check: Do not send events if consent is not granted
    if (consent !== 'granted') {
      if (import.meta.env.DEV) {
        console.debug(`[Analytics Standby: Consent ${consent}] Event: ${name}`, rawParams);
      }
      return;
    }

    // 2. Configuration check: Do not claim event was sent if unconfigured
    if (!this.isConfigured() || !window.gtag) {
      if (import.meta.env.DEV) {
        console.debug(`[Analytics Standby: Unconfigured ID] Event: ${name}`, rawParams);
      }
      return;
    }

    // 3. Deduplication check (within 1 second window)
    const now = Date.now();
    const eventKey = `${name}_${JSON.stringify(rawParams)}`;
    const lastTime = this.recentEvents.get(eventKey) || 0;
    if (now - lastTime < 1000) {
      return; // Deduplicated
    }
    this.recentEvents.set(eventKey, now);

    // Clean up old entries in recentEvents
    if (this.recentEvents.size > 50) {
      for (const [k, t] of this.recentEvents.entries()) {
        if (now - t > 5000) this.recentEvents.delete(k);
      }
    }

    // 4. Sanitize parameters
    const safeParams = this.sanitizeParams(rawParams);

    // 5. Dispatch via gtag
    try {
      window.gtag('event', name, safeParams);
    } catch (err) {
      console.warn(`[Analytics] Error dispatching event ${name}:`, err);
    }
  }

  /**
   * Tracks a page view with automatic duplicate suppression
   */
  public trackPageView(path: string, title?: string): void {
    if (this.lastPageViewPath === path) {
      return; // Deduplicate identical consecutive page view
    }
    this.lastPageViewPath = path;

    if (this.getConsent() !== 'granted' || !this.isConfigured() || !window.gtag) {
      return;
    }

    try {
      window.gtag('event', 'page_view', {
        page_path: path,
        page_title: title || document.title,
      });
    } catch (err) {
      console.warn('[Analytics] Error tracking page_view:', err);
    }
  }
}

export const analytics = AnalyticsService.getInstance();
export default analytics;
