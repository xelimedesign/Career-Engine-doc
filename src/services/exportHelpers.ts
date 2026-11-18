import { DocumentFontFamily } from '../types/career';

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function sanitizeFilename(raw: string, fallback: string): string {
  const cleaned = raw
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, '_');
  return cleaned || fallback;
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function mapDocxFont(family: DocumentFontFamily): string {
  switch (family) {
    case 'serif':
      return 'Georgia';
    case 'editorial':
      return 'Garamond';
    case 'mono':
      return 'Consolas';
    case 'sans':
    default:
      return 'Calibri';
  }
}

export function mapPdfFont(family: DocumentFontFamily): 'helvetica' | 'times' | 'courier' {
  switch (family) {
    case 'serif':
    case 'editorial':
      return 'times';
    case 'mono':
      return 'courier';
    case 'sans':
    default:
      return 'helvetica';
  }
}

export function mapCssFont(family: DocumentFontFamily): string {
  switch (family) {
    case 'serif':
      return '"Source Serif 4", Georgia, serif';
    case 'editorial':
      return '"Fraunces", "Source Serif 4", Georgia, serif';
    case 'mono':
      return '"JetBrains Mono", ui-monospace, monospace';
    case 'sans':
    default:
      return '"Plus Jakarta Sans", "DM Sans", -apple-system, sans-serif';
  }
}

export function hexToDocxColor(hex: string): string {
  return hex.replace('#', '').toUpperCase() || '1C1917';
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [28, 25, 23];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [
    Number.isNaN(r) ? 28 : r,
    Number.isNaN(g) ? 25 : g,
    Number.isNaN(b) ? 23 : b,
  ];
}
