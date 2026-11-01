/**
 * CodeMyFace V4 — Standalone HTML Export Utility
 *
 * Generates a completely self-contained, valid HTML5 document containing
 * the generated V4 vector portrait.
 *
 * Requirements:
 * - 100% self-contained: zero external network dependencies, no CDNs, no remote fonts.
 * - Zero reliance on Vite development server, React, or browser routes.
 * - Valid HTML5 structure with responsive CSS card container.
 * - Exact complete inline SVG with zero truncation.
 * - Works immediately when double-clicked locally as a file:// URI.
 */

export interface StandaloneHtmlOptions {
  title?: string;
  theme?: 'dark' | 'light';
  includeMetadata?: boolean;
}

export function generateStandaloneHtml(
  svgString: string,
  options: StandaloneHtmlOptions = {}
): string {
  const title = options.title || 'CodeMyFace V4 Digital Painting';
  const isDark = options.theme !== 'light';
  const bgColor = isDark ? '#0b0f19' : '#f8fafc';
  const cardBg = isDark ? '#111827' : '#ffffff';
  const cardBorder = isDark ? '#1f2937' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const titleColor = isDark ? '#f1f5f9' : '#0f172a';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    /* CodeMyFace Standalone Portrait Styles — 100% Offline & Self-Contained */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: ${bgColor};
      color: ${textColor};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow-x: hidden;
    }
    .portrait-card {
      background: ${cardBg};
      border: 1px solid ${cardBorder};
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      padding: 24px;
      max-width: 95vw;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: transform 0.2s ease;
    }
    .header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid ${cardBorder};
    }
    .title {
      font-size: 14px;
      font-weight: 600;
      color: ${titleColor};
      letter-spacing: 0.02em;
    }
    .badge {
      font-size: 11px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      padding: 3px 8px;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .portrait-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      max-width: 100%;
      max-height: 75vh;
      border-radius: 8px;
      overflow: hidden;
      background: transparent;
    }
    .portrait-wrapper svg {
      max-width: 100%;
      max-height: 75vh;
      width: auto;
      height: auto;
      border-radius: 6px;
      display: block;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }
    .footer {
      width: 100%;
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: ${textColor};
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
  </style>
</head>
<body>
  <main class="portrait-card">
    <div class="header">
      <h1 class="title">${escapeHtml(title)}</h1>
      <span class="badge">V4 Digital Painting</span>
    </div>

    <div class="portrait-wrapper">
      ${svgString}
    </div>

    <div class="footer">
      <span>Standalone Vector Export · 100% Offline</span>
      <span>CodeMyFace V4</span>
    </div>
  </main>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
