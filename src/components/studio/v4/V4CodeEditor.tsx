import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { xml } from '@codemirror/lang-xml';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { WidgetType, MatchDecorator, ViewPlugin, Decoration } from '@codemirror/view';
import { WorkbenchStatus } from '../../../engine/v4/types';
import { cleanSvgDocument } from '../../../engine/v4/sizeOptimizer/svgCleaner';
import { TechnicalDiagnosticsPanel } from './TechnicalDiagnosticsPanel';
import { computeSvgDiagnostics, calculateGenuineGzipSize, SvgSizeStats } from '../../../utils/svgDiagnostics';
import { EditorSkeleton } from '../../common/Skeletons';
import { EmptySvgState } from '../../common/EmptyStates';

export type EditorTabFormat = 'svg' | 'html' | 'jsx' | 'diagnostics';

export interface V4CodeEditorProps {
  originalSvg: string;
  currentSvg: string;
  onSvgChange: (newSvg: string) => void;
  width?: number;
  height?: number;
  onXmlError?: (error: { line?: number; message?: string } | null) => void;
  onOpenTimeMeasured?: (durationMs: number) => void;
  status?: WorkbenchStatus;
  isStreaming?: boolean;
  targetScrollLayerId?: string | null;
  onToast?: (message: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
  mode?: 'recreation' | 'painting';
  quality?: 'high' | 'low' | 'medium';
  durationMs?: number;
  colorMetrics?: {
    skin?: { hex: string; r: number; g: number; b: number };
    hair?: { hex: string; r: number; g: number; b: number };
    lips?: { hex: string; r: number; g: number; b: number };
    bg?: { hex: string; r: number; g: number; b: number };
  };
  activeTab?: EditorTabFormat;
  onTabChange?: (tab: EditorTabFormat) => void;
  logs?: any[];
  onClearLogs?: () => void;
  progressPercent?: number;
  generationStage?: string;
  onCancel?: () => void;
  onGenerate?: () => void;
  sizeStats?: SvgSizeStats | null;
}

// 1. Atelier Syntax Highlighting:
// tags: paper (#ECE5D6), attributes: paper-dim (#A59C8C), strings: paper, numbers: moss (#9DB48A)
export const atelierHighlightStyle = HighlightStyle.define([
  { tag: tags.tagName, color: '#ECE5D6' },
  { tag: tags.attributeName, color: '#A59C8C' },
  { tag: tags.string, color: '#ECE5D6' },
  { tag: tags.number, color: '#9DB48A' },
  { tag: tags.comment, color: '#3A332D' },
  { tag: tags.angleBracket, color: '#A59C8C' },
  { tag: tags.punctuation, color: '#A59C8C' },
  { tag: tags.keyword, color: '#ECE5D6' },
  { tag: tags.definition(tags.variableName), color: '#ECE5D6' },
  { tag: tags.variableName, color: '#ECE5D6' },
  { tag: tags.propertyName, color: '#A59C8C' },
]);

// 2. Dimmed Path Data Widget for d="..."
const pathDataMatcher = new MatchDecorator({
  regexp: /\bd="[^"]*"/g,
  decoration: Decoration.mark({ class: 'cm-path-data' }),
});

export const pathDataPlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = pathDataMatcher.createDeco(view);
    }
    update(update: any) {
      this.decorations = pathDataMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);

// 3. Color Swatch Widget inserted before every hex/rgb color
class ColorSwatchWidget extends WidgetType {
  constructor(readonly color: string) {
    super();
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-color-swatch';
    span.style.backgroundColor = this.color;
    return span;
  }
  ignoreEvent() {
    return false;
  }
}

const colorMatcher = new MatchDecorator({
  regexp: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|rgb\([^)]+\)|rgba\([^)]+\)/g,
  decorate: (add, from, _to, match) => {
    add(
      from,
      from,
      Decoration.widget({
        widget: new ColorSwatchWidget(match[0]),
        side: -1,
      })
    );
  },
});

export const colorSwatchPlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = colorMatcher.createDeco(view);
    }
    update(update: any) {
      this.decorations = colorMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);

// 3. Atelier Editor Theme
export const atelierEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--ink-2) !important',
    color: 'var(--paper) !important',
    fontSize: '13px',
  },
  '.cm-scroller': {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace !important",
    lineHeight: '1.6',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--ink) !important',
    borderRight: '1px solid var(--line) !important',
    color: 'var(--paper-dim) !important',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--ink-3) !important',
    color: 'var(--paper) !important',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--ink-3) !important',
    borderLeft: '2px solid var(--accent) !important',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(255, 79, 46, 0.22) !important',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--accent) !important',
  },
});

// Helper: Pretty print SVG (ensures one <path ... /> per line)
export function prettyPrintSvg(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/>\s*</g, '>\n<')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// Helper: Minify SVG (strips intra-tag whitespace)
export function minifySvg(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\r?\n\s*/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

// Helper: Generate embeddable HTML page
export function generateEmbedHtml(svg: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeMyFace Atelier Portrait</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #14110F;
      padding: 24px;
    }
    .portrait-frame {
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #3A332D;
      border-radius: 2px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
      background: #1C1815;
    }
    svg {
      width: 100%;
      height: 100%;
      max-height: 85vh;
      object-fit: contain;
      display: block;
    }
  </style>
</head>
<body>
  <div class="portrait-frame">
    ${svg}
  </div>
</body>
</html>`;
}

// Helper: Generate React JSX component
export function generateReactJsx(svg: string): string {
  let jsxSvg = svg
    .replace(/xmlns:xlink=/g, 'xmlnsXlink=')
    .replace(/xml:space=/g, 'xmlSpace=')
    .replace(/fill-rule=/g, 'fillRule=')
    .replace(/clip-rule=/g, 'clipRule=')
    .replace(/stroke-width=/g, 'strokeWidth=')
    .replace(/stroke-linecap=/g, 'strokeLinecap=')
    .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
    .replace(/stop-color=/g, 'stopColor=')
    .replace(/stop-opacity=/g, 'stopOpacity=')
    .replace(/shape-rendering=/g, 'shapeRendering=');

  return `import React from 'react';

export interface PortraitProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Portrait: React.FC<PortraitProps> = ({ className = '', style = {} }) => {
  return (
    <div className={\`portrait-container \${className}\`} style={style}>
      ${jsxSvg}
    </div>
  );
};

export default Portrait;`;
}

// Helper: XML Syntax Validator
export function validateSvgXml(xmlString: string): { isValid: boolean; line?: number; message?: string } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'image/svg+xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      const errorText = parserError.textContent || 'XML Parsing Error';
      const lineMatch = errorText.match(/line\s+(\d+)/i) || errorText.match(/:(\d+):/);
      const line = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
      return { isValid: false, line, message: errorText.split('\n')[0] };
    }
    return { isValid: true };
  } catch (e: any) {
    return { isValid: false, message: e.message || 'XML parsing exception' };
  }
}

// Helper: Native Gzip Size calculation
export async function calculateGzipSize(str: string): Promise<number> {
  try {
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
      const res = new Response(stream);
      const buf = await res.arrayBuffer();
      return buf.byteLength;
    }
  } catch (e) {}
  return Math.round(new TextEncoder().encode(str).length * 0.35);
}

export const V4CodeEditor: React.FC<V4CodeEditorProps> = ({
  originalSvg,
  currentSvg,
  onSvgChange,
  width = 600,
  height = 800,
  onXmlError,
  onOpenTimeMeasured,
  status,
  isStreaming = false,
  targetScrollLayerId = null,
  onToast,
  mode = 'painting',
  quality = 'high',
  durationMs,
  colorMetrics,
  activeTab: controlledActiveTab,
  onTabChange,
  logs = [],
  onClearLogs,
  progressPercent = 0,
  generationStage = '',
  onCancel,
  onGenerate,
  sizeStats,
}) => {
  const [internalTab, setInternalTab] = useState<EditorTabFormat>('svg');
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalTab;

  const handleTabSelect = useCallback(
    (tab: EditorTabFormat) => {
      setInternalTab(tab);
      onTabChange?.(tab);
    },
    [onTabChange]
  );

  // When synthesis finishes, automatically shift active tab to embed.html
  const prevStatusRef = useRef<WorkbenchStatus | undefined>(status);
  useEffect(() => {
    if (
      (prevStatusRef.current === 'analyzing' || prevStatusRef.current === 'painting') &&
      status === 'done'
    ) {
      handleTabSelect('html');
    }
    prevStatusRef.current = status;
  }, [status, handleTabSelect]);

  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [isMinified, setIsMinified] = useState<boolean>(false);
  const [isWordWrap, setIsWordWrap] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<number>(13);
  const [copied, setCopied] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState<boolean>(false);
  const [viewMenuOpen, setViewMenuOpen] = useState<boolean>(false);
  const downloadDropdownRef = useRef<HTMLDivElement | null>(null);
  const viewMenuRef = useRef<HTMLDivElement | null>(null);

  // Esc closes menus and click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDownloadDropdownOpen(false);
        setViewMenuOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(e.target as Node)) {
        setDownloadDropdownOpen(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setViewMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [includeCommentsAndIds, setIncludeCommentsAndIds] = useState<boolean>(false);
  const [xmlError, setXmlError] = useState<{ line?: number; message?: string } | null>(null);

  // Status metrics
  const [lineCount, setLineCount] = useState<number>(0);
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);
  const [gzipSizeBytes, setGzipSizeBytes] = useState<number>(0);
  const [, setPathCount] = useState<number>(0);

  const diagnostics = useMemo(() => {
    return computeSvgDiagnostics({
      svgString: currentSvg,
      width,
      height,
      durationMs,
      mode,
      quality,
      status,
      colorMetrics,
    });
  }, [currentSvg, width, height, durationMs, mode, quality, status, colorMetrics]);

  useEffect(() => {
    if (!currentSvg) return;
    let isCancelled = false;
    calculateGenuineGzipSize(currentSvg).then((gz) => {
      if (!isCancelled && gz > 0) {
        setGzipSizeBytes(gz);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [currentSvg]);

  // Large file handling
  const [loadFullFile, setLoadFullFile] = useState<boolean>(false);
  const [isTruncatedPreview, setIsTruncatedPreview] = useState<boolean>(false);

  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const debounceTimerRef = useRef<any>(null);

  // Compartments
  const editableCompartment = useRef(new Compartment());
  const wrapCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());
  const langCompartment = useRef(new Compartment());

  const fullCode = useMemo(() => {
    let raw = currentSvg;
    if (!includeCommentsAndIds) {
      raw = cleanSvgDocument(raw, { includeCommentsAndIds: false });
    }
    if (activeTab === 'svg') {
      return isMinified ? minifySvg(raw) : prettyPrintSvg(raw);
    } else if (activeTab === 'html') {
      const formatted = isMinified ? minifySvg(raw) : prettyPrintSvg(raw);
      return generateEmbedHtml(formatted);
    } else {
      const formatted = isMinified ? minifySvg(raw) : prettyPrintSvg(raw);
      return generateReactJsx(formatted);
    }
  }, [currentSvg, activeTab, isMinified, includeCommentsAndIds]);

  useEffect(() => {
    const lines = fullCode ? fullCode.split('\n').length : 0;
    // When viewing SVG tab, measure canonical currentSvg so size matches log and pipeline exactly
    const targetCode = activeTab === 'svg' ? (currentSvg || fullCode) : fullCode;
    const bytes = new TextEncoder().encode(targetCode).length;
    const paths = (fullCode.match(/<path/g) || []).length;

    setLineCount(lines);
    setFileSizeBytes(bytes);
    setPathCount(paths);

    calculateGzipSize(targetCode).then((gz) => setGzipSizeBytes(gz));
  }, [fullCode, currentSvg, activeTab]);

  const displayCode = useMemo(() => {
    if (!fullCode) return '';
    const lines = fullCode.split('\n');
    if (lines.length > 2000 && !loadFullFile) {
      setIsTruncatedPreview(true);
      return lines.slice(0, 2000).join('\n');
    }
    setIsTruncatedPreview(false);
    return fullCode;
  }, [fullCode, loadFullFile]);

  const getLanguageExtension = useCallback((tab: EditorTabFormat) => {
    if (tab === 'svg') return xml();
    if (tab === 'html') return html();
    return javascript({ jsx: true });
  }, []);

  useEffect(() => {
    if (!editorContainerRef.current) return;

    const t0 = performance.now();

    if (editorViewRef.current) {
      editorViewRef.current.destroy();
      editorViewRef.current = null;
    }

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && isEditable && activeTab === 'svg') {
        const newCode = update.state.doc.toString();

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          const validation = validateSvgXml(newCode);
          if (validation.isValid) {
            setXmlError(null);
            onXmlError?.(null);
            onSvgChange(newCode);
          } else {
            const err = { line: validation.line, message: validation.message };
            setXmlError(err);
            onXmlError?.(err);
          }
        }, 400);
      }
    });

    const startState = EditorState.create({
      doc: displayCode,
      extensions: [
        basicSetup,
        atelierThemeExtension(fontSize),
        syntaxHighlighting(atelierHighlightStyle),
        pathDataPlugin,
        colorSwatchPlugin,
        langCompartment.current.of(getLanguageExtension(activeTab)),
        editableCompartment.current.of(EditorView.editable.of(isEditable && activeTab === 'svg')),
        wrapCompartment.current.of(isWordWrap ? EditorView.lineWrapping : []),
        themeCompartment.current.of([]),
        updateListener,
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorContainerRef.current,
    });

    editorViewRef.current = view;

    const tOpen = performance.now() - t0;
    onOpenTimeMeasured?.(Math.round(tOpen * 10) / 10);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      view.destroy();
    };
  }, [activeTab, displayCode, loadFullFile]);

  function atelierThemeExtension(sz: number) {
    return EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: 'var(--ink-2) !important',
        color: 'var(--paper) !important',
        fontSize: `${sz}px`,
      },
      '.cm-scroller': {
        fontFamily: "'JetBrains Mono', ui-monospace, monospace !important",
        lineHeight: '1.6',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--ink) !important',
        borderRight: '1px solid var(--line) !important',
        color: 'var(--paper-dim) !important',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--ink-3) !important',
        color: 'var(--paper) !important',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--ink-3) !important',
        borderLeft: '2px solid var(--accent) !important',
      },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: 'rgba(255, 79, 46, 0.22) !important',
      },
      '.cm-cursor': {
        borderLeftColor: 'var(--accent) !important',
      },
      '.cm-path-data': {
        color: 'var(--paper-dim) !important',
        opacity: '0.55',
      },
    });
  }

  useEffect(() => {
    if (!editorViewRef.current) return;
    editorViewRef.current.dispatch({
      effects: editableCompartment.current.reconfigure(
        EditorView.editable.of(isEditable && activeTab === 'svg')
      ),
    });
  }, [isEditable, activeTab]);

  useEffect(() => {
    if (!editorViewRef.current) return;
    editorViewRef.current.dispatch({
      effects: wrapCompartment.current.reconfigure(isWordWrap ? EditorView.lineWrapping : []),
    });
  }, [isWordWrap]);

  useEffect(() => {
    if (!editorViewRef.current) return;
    editorViewRef.current.dispatch({
      effects: themeCompartment.current.reconfigure(
        EditorView.theme({
          '&': { fontSize: `${fontSize}px` },
        })
      ),
    });
  }, [fontSize]);

  // Step 4: Scroll editor to isolated <g id="layer-N"> when clicked from palette chip
  useEffect(() => {
    if (!targetScrollLayerId || !editorViewRef.current) return;
    const view = editorViewRef.current;
    const docStr = view.state.doc.toString();
    const searchTarget = `id="${targetScrollLayerId}"`;
    const idx = docStr.indexOf(searchTarget);
    if (idx !== -1) {
      view.dispatch({
        selection: { anchor: idx, head: idx + searchTarget.length },
        scrollIntoView: true,
      });
    }
  }, [targetScrollLayerId]);

  // Step 2 & 3: Jump back to line 1 and reset scrollTop to 0 when streaming finishes or status reaches done/skipped
  const prevStreamingRef = useRef<boolean>(isStreaming);
  useEffect(() => {
    const isTerminal = status === 'done' || status === 'skipped';
    if ((prevStreamingRef.current && !isStreaming) || isTerminal) {
      if (editorViewRef.current) {
        editorViewRef.current.dispatch({
          selection: { anchor: 0 },
          scrollIntoView: true,
        });
        if (editorViewRef.current.scrollDOM) {
          editorViewRef.current.scrollDOM.scrollTop = 0;
        }
      }
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, status]);

  const handleCopy = useCallback(async () => {
    if (!fullCode) return;
    setCopyError(null);
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error('Clipboard API unavailable in this browser environment');
      }
      const baseSvg = cleanSvgDocument(currentSvg, { includeCommentsAndIds });
      const codeToCopy = (activeTab === 'svg' && !isMinified) ? baseSvg : fullCode;
      await navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      const rawMb = (fileSizeBytes / (1024 * 1024)).toFixed(1);
      const gzMb = (gzipSizeBytes / (1024 * 1024)).toFixed(1);
      const sizeMsg =
        fileSizeBytes >= 1024 * 1024
          ? `${rawMb} MB (about ${gzMb} MB gzip)`
          : `${(fileSizeBytes / 1024).toFixed(1)} KB (about ${(gzipSizeBytes / 1024).toFixed(1)} KB gzip)`;
      onToast?.(`Copied. ${sizeMsg}`, 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      console.warn('Clipboard write failed:', err);
      setCopyError('Copy failed (payload too large or permission denied). Use Download instead.');
      onToast?.('Copy failed. Use Download instead.', 'error');
    }
  }, [fullCode, fileSizeBytes, gzipSizeBytes, onToast]);

  const handleDownload = useCallback(
    (format: 'svg' | 'html' | 'jsx' | 'png') => {
      setDownloadDropdownOpen(false);

      if (format === 'png') {
        const blob = new Blob([currentSvg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((pngBlob) => {
              if (pngBlob) {
                const pngUrl = URL.createObjectURL(pngBlob);
                const a = document.createElement('a');
                a.href = pngUrl;
                a.download = 'portrait.png';
                a.click();
                URL.revokeObjectURL(pngUrl);
              }
            }, 'image/png');
          }
          URL.revokeObjectURL(url);
        };
        img.src = url;
        return;
      }

      let content = (format === 'svg' && !isMinified)
        ? cleanSvgDocument(currentSvg, { includeCommentsAndIds })
        : fullCode;
      let filename = 'portrait.svg';
      let mime = 'image/svg+xml';

      if (format === 'html') {
        content = generateEmbedHtml(prettyPrintSvg(currentSvg));
        filename = 'embed.html';
        mime = 'text/html';
      } else if (format === 'jsx') {
        content = generateReactJsx(prettyPrintSvg(currentSvg));
        filename = 'Portrait.jsx';
        mime = 'text/javascript';
      }

      const blob = new Blob([content], { type: `${mime};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [currentSvg, fullCode, width, height]
  );

  const handleResetToGenerated = useCallback(() => {
    setXmlError(null);
    onXmlError?.(null);
    onSvgChange(originalSvg);
  }, [originalSvg, onSvgChange, onXmlError]);

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '-';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="v4-editor-wrap">
      {/* 1. Format Tabs Bar */}
      <div className="v4-editor-tabs-bar">
        <button
          className={`v4-editor-tab ${activeTab === 'svg' ? 'is-active' : ''}`}
          onClick={() => handleTabSelect('svg')}
        >
          <span>portrait.svg</span>
        </button>

        <button
          className={`v4-editor-tab ${activeTab === 'html' ? 'is-active' : ''}`}
          onClick={() => handleTabSelect('html')}
        >
          <span>embed.html</span>
        </button>

        <button
          className={`v4-editor-tab ${activeTab === 'jsx' ? 'is-active' : ''}`}
          onClick={() => handleTabSelect('jsx')}
        >
          <span>Portrait.jsx</span>
        </button>

        <button
          className={`v4-editor-tab ${activeTab === 'diagnostics' ? 'is-active' : ''}`}
          onClick={() => handleTabSelect('diagnostics')}
          title="Technical reconstruction diagnostics & metrics"
        >
          <span>Diagnostics</span>
        </button>
      </div>

      {/* 2. Editor Toolbar (Tidy Atelier layout: Left has Copy/Download/Reset, Right has single View menu) */}
      <div className="v4-editor-toolbar">
        <div className="v4-editor-toolbar__group">
          <button className="v4-btn" onClick={handleCopy} title="Copy code to clipboard">
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Download Dropdown */}
          <div style={{ position: 'relative' }} ref={downloadDropdownRef}>
            <button
              className="v4-btn"
              onClick={() => {
                setDownloadDropdownOpen(!downloadDropdownOpen);
                setViewMenuOpen(false);
              }}
              title="Download file"
            >
              <span>Download</span>
              <ChevronDown size={12} />
            </button>

            {downloadDropdownOpen && (
              <div
                className="atelier-dropdown-menu"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: 'var(--ink)',
                  border: '1px solid var(--line)',
                  borderRadius: '2px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '4px',
                  minWidth: '140px',
                }}
              >
                <button
                  className="v4-btn v4-btn--ghost"
                  style={{ justifyContent: 'flex-start', height: '26px' }}
                  onClick={() => handleDownload('svg')}
                >
                  <span>portrait.svg</span>
                </button>
                <button
                  className="v4-btn v4-btn--ghost"
                  style={{ justifyContent: 'flex-start', height: '26px' }}
                  onClick={() => handleDownload('html')}
                >
                  <span>embed.html</span>
                </button>
                <button
                  className="v4-btn v4-btn--ghost"
                  style={{ justifyContent: 'flex-start', height: '26px' }}
                  onClick={() => handleDownload('jsx')}
                >
                  <span>Portrait.jsx</span>
                </button>
                <button
                  className="v4-btn v4-btn--ghost"
                  style={{ justifyContent: 'flex-start', height: '26px' }}
                  onClick={() => handleDownload('png')}
                >
                  <span>portrait.png</span>
                </button>
              </div>
            )}
          </div>

          {currentSvg !== originalSvg && (
            <button
              className="v4-btn"
              onClick={handleResetToGenerated}
              title="Reset code back to pipeline generated output"
            >
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right Group: [Wrap] button and [View v] menu */}
        <div className="v4-editor-toolbar__group">
          <button
            className={`v4-btn ${isWordWrap ? 'is-active' : ''}`}
            onClick={() => setIsWordWrap(!isWordWrap)}
            title="Toggle word wrap"
            style={{
              backgroundColor: isWordWrap ? 'var(--paper)' : 'transparent',
              color: isWordWrap ? 'var(--ink)' : 'var(--paper)',
            }}
          >
            <span>Wrap</span>
          </button>

          <div style={{ position: 'relative' }} ref={viewMenuRef}>
            <button
              className="v4-btn"
              onClick={() => {
                setViewMenuOpen(!viewMenuOpen);
                setDownloadDropdownOpen(false);
              }}
              title="View settings (Wrap, Formatting, Text size, Read-only)"
            >
              <span>View</span>
              <ChevronDown size={12} />
            </button>

            {viewMenuOpen && (
              <div
                className="atelier-dropdown-menu atelier-view-menu"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: 'var(--ink-2)',
                  border: '1px solid var(--line)',
                  borderRadius: '2px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '6px',
                  minWidth: '200px',
                  gap: '4px',
                }}
              >
                <button
                  className="atelier-menu-item"
                  onClick={() => setIsWordWrap(!isWordWrap)}
                >
                  <span>Wrap lines</span>
                  <span className="atelier-menu-check">{isWordWrap ? '✓' : ''}</span>
                </button>

                <button
                  className="atelier-menu-item"
                  onClick={() => setIsMinified(!isMinified)}
                >
                  <span>{isMinified ? 'Minified SVG' : 'Formatted SVG'}</span>
                  <span className="atelier-menu-check">{isMinified ? '✓' : ''}</span>
                </button>

                <div className="atelier-menu-divider" />

                <div className="atelier-menu-row">
                  <span style={{ color: 'var(--paper-dim)', fontSize: '13px' }}>Text size</span>
                  <div className="v4-segmented-group v4-segmented-group--sm">
                    {[13, 15, 18].map((size) => (
                      <button
                        key={size}
                        className={`v4-segmented-item ${fontSize === size ? 'is-active' : ''}`}
                        onClick={() => setFontSize(size)}
                        style={{ padding: '0 8px', height: '22px' }}
                      >
                        <span>{size}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="atelier-menu-divider" />

                <button
                  className="atelier-menu-item"
                  onClick={() => setIsEditable(!isEditable)}
                >
                  <span>{isEditable ? 'Editing active' : 'Read-only'}</span>
                  <span className="atelier-menu-check">{isEditable ? '✓' : ''}</span>
                </button>

                <div className="atelier-menu-divider" />

                <button
                  className="atelier-menu-item"
                  onClick={() => setIncludeCommentsAndIds(!includeCommentsAndIds)}
                >
                  <span>Include comments & ids</span>
                  <span className="atelier-menu-check">{includeCommentsAndIds ? '✓' : ''}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2b. Copy Failure Notification (offer Download) */}
      {copyError && (
        <div
          style={{
            backgroundColor: 'var(--ink)',
            borderBottom: '1px solid var(--vermilion)',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--vermilion)',
            fontSize: '12px',
            gap: '8px',
          }}
        >
          <span>{copyError}</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="v4-btn v4-btn--accent"
              style={{ height: '22px', padding: '0 8px', fontSize: '11px' }}
              onClick={() => {
                handleDownload('svg');
                setCopyError(null);
              }}
            >
              Download SVG
            </button>
            <button
              className="v4-btn v4-btn--ghost"
              style={{ height: '22px', padding: '0 6px', fontSize: '11px' }}
              onClick={() => setCopyError(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 3. XML Error Notification Banner */}
      {xmlError && (
        <div className="v4-xml-error-banner">
          <div>
            <span>
              XML syntax error {xmlError.line ? `(line ${xmlError.line})` : ''}: {xmlError.message}
            </span>
          </div>
          <button
            className="v4-btn"
            style={{ height: '24px', padding: '0 8px', fontSize: '12px' }}
            onClick={handleResetToGenerated}
          >
            Reset
          </button>
        </div>
      )}

      {/* 4. Large File Truncation Notice Banner */}
      {isTruncatedPreview && (
        <div className="v4-large-file-banner">
          <span>
            Fast preview: Showing first 2,000 of {lineCount.toLocaleString()} lines.
          </span>
          <button
            className="v4-btn"
            style={{ height: '24px', padding: '0 8px', fontSize: '12px' }}
            onClick={() => setLoadFullFile(true)}
          >
            Load all {lineCount.toLocaleString()} lines ({formatFileSize(fileSizeBytes)})
          </button>
        </div>
      )}

      {/* 5. CodeMirror 6 Host or Technical Diagnostics */}
      {activeTab === 'diagnostics' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <TechnicalDiagnosticsPanel
            diagnostics={diagnostics}
            logs={logs}
            onClearLogs={onClearLogs}
            isGenerating={isStreaming || status === 'analyzing' || status === 'painting'}
            progressPercent={progressPercent}
            generationStage={generationStage}
            onCancel={onCancel}
            onGenerate={onGenerate}
            mode={mode}
            onCopyTelemetry={() => {
              onToast?.('Telemetry JSON copied to clipboard', 'success');
            }}
          />
        </div>
      ) : isStreaming && !currentSvg ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <EditorSkeleton />
        </div>
      ) : !currentSvg ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <EmptySvgState onGenerate={onGenerate || (() => {})} isGenerating={isStreaming} context="editor" />
        </div>
      ) : (
        <div className="v4-cm-host" ref={editorContainerRef} />
      )}

      {/* 6. Status Bar (Single mono row at bottom, same numbers as the caption) */}
      <div className="v4-editor-status-bar mono">
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <span className="v4-editor-status-bar__item">
            {lineCount > 0 ? `${lineCount.toLocaleString()} lines` : '- lines'}
          </span>
          <span className="v4-editor-status-bar__item">
            {sizeStats ? `${sizeStats.pathCount.toLocaleString()} paths` : diagnostics.pathCount > 0 ? `${diagnostics.pathCount.toLocaleString()} paths` : '- paths'}
          </span>
          <span className="v4-editor-status-bar__item">
            {sizeStats ? `${sizeStats.shapeCount.toLocaleString()} shapes` : diagnostics.shapeCount > 0 ? `${diagnostics.shapeCount.toLocaleString()} shapes` : '- shapes'}
          </span>
          <span className="v4-editor-status-bar__item">
            {sizeStats ? `${sizeStats.fillCount} fills` : diagnostics.distinctFillColors > 0 ? `${diagnostics.distinctFillColors} fills` : '- fills'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <span className="v4-editor-status-bar__item">
            {sizeStats ? sizeStats.formattedRaw : formatFileSize(fileSizeBytes)}
          </span>
          <span className="v4-editor-status-bar__item">
            {sizeStats ? `gzip ${sizeStats.formattedGzip}` : fileSizeBytes > 0 ? `gzip ${formatFileSize(gzipSizeBytes)}` : 'gzip -'}
          </span>
        </div>
      </div>
    </div>
  );
};
