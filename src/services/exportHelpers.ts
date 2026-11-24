import { jsPDF } from 'jspdf';
import { CompanyResearch, DocumentFontFamily } from '../types/career';

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

export function buildCompanyReportText(research: CompanyResearch): string {
  const lines = [
    `COMPANY INTELLIGENCE REPORT: ${research.companyName}`,
    `Official Website: ${research.companyWebsite || 'Not specified'}`,
    `Researched: ${new Date(research.researchDate).toLocaleString()}`,
    `Overall Confidence: ${research.overallConfidence.toUpperCase()}`,
    '',
    '1. COMPANY OVERVIEW',
    research.report.companyOverview,
    '',
    '2. SERVICES AND SPECIALTIES',
    research.report.servicesAndSpecialties,
    '',
    '3. INDUSTRY',
    research.report.industry,
    '',
    '4. PROJECTS AND PORTFOLIO',
    research.report.projectsAndPortfolio,
    '',
    '5. TECHNOLOGY',
    research.report.technology,
    '',
    '6. MISSION AND VALUES',
    research.report.missionAndValues,
    '',
    '7. RECENT DEVELOPMENTS',
    research.report.recentDevelopments,
    '',
    '8. EMPLOYEE EXPECTATIONS',
    research.report.employeeExpectations,
    '',
    '9. RELEVANT COMPANY INFORMATION',
    research.report.relevantCompanyInformation,
    '',
    '10. APPLICATION RECOMMENDATIONS (AI INTERPRETATION)',
    ...research.report.applicationRecommendations.map((r, i) => `${i + 1}. ${r}`),
    '',
    'SOURCES',
    ...research.sources.map((s) => `- ${s.title} (${s.sourceType}): ${s.url}`),
  ];
  return lines.join('\n');
}

export function buildCompanyReportTextBlob(research: CompanyResearch): Blob {
  return new Blob([buildCompanyReportText(research)], { type: 'text/plain;charset=utf-8' });
}

export function buildCompanyReportPdfBlob(research: CompanyResearch): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 54;
  const maxWidth = 612 - margin * 2;
  const pageHeight = 792;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(`Company Intelligence: ${research.companyName}`, margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Website: ${research.companyWebsite || 'Not specified'}  ·  Confidence: ${research.overallConfidence.toUpperCase()}`,
    margin,
    y
  );
  y += 16;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, 612 - margin, y);
  y += 18;

  const sections: Array<[string, string]> = [
    ['1. Company Overview', research.report.companyOverview],
    ['2. Services and Specialties', research.report.servicesAndSpecialties],
    ['3. Industry', research.report.industry],
    ['4. Projects and Portfolio', research.report.projectsAndPortfolio],
    ['5. Technology', research.report.technology],
    ['6. Mission and Values', research.report.missionAndValues],
    ['7. Recent Developments', research.report.recentDevelopments],
    ['8. Employee Expectations', research.report.employeeExpectations],
    ['9. Relevant Company Information', research.report.relevantCompanyInformation],
    [
      '10. Application Recommendations',
      research.report.applicationRecommendations.map((r, i) => `${i + 1}. ${r}`).join('\n'),
    ],
    [
      'Sources',
      research.sources.map((s) => `• ${s.title} (${s.sourceType}): ${s.url}`).join('\n'),
    ],
  ];

  sections.forEach(([heading, body]) => {
    if (!body?.trim()) return;
    ensureSpace(34);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(heading, margin, y);
    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(body, maxWidth) as string[];
    lines.forEach((line) => {
      ensureSpace(14);
      doc.text(line, margin, y);
      y += 13.5;
    });
    y += 8;
  });

  return doc.output('blob');
}
