import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  FolderUp,
  Loader2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export interface PreviewBlock {
  id: string;
  node: React.ReactNode;
}

interface PaginatedPaperPreviewProps {
  blocks: PreviewBlock[];
  pageMarginsInches: number;
  paperColor?: string;
  documentTitle: string;
  onExportDocx: () => Promise<void> | void;
  onExportPdf: () => void;
  isExportingDocx?: boolean;
  onExportDrive?: () => Promise<void> | void;
  isExportingDrive?: boolean;
  driveWebViewLink?: string;
  driveSyncStatus?: 'synced' | 'pending_auth' | 'error';
  onPageCountChange?: (count: number) => void;
}

const PAGE_WIDTH_PX = 816; // 8.5in * 96dpi
const PAGE_HEIGHT_PX = 1056; // 11in * 96dpi

export function PaginatedPaperPreview({
  blocks,
  pageMarginsInches,
  paperColor = '#FFFFFF',
  documentTitle,
  onExportDocx,
  onExportPdf,
  isExportingDocx = false,
  onExportDrive,
  isExportingDrive = false,
  driveWebViewLink,
  driveSyncStatus,
  onPageCountChange,
}: PaginatedPaperPreviewProps) {
  const [zoom, setZoom] = useState<number>(0.68);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('all');
  const [pages, setPages] = useState<number[][]>([blocks.map((_, i) => i)]);
  const measureRefs = useRef<Array<HTMLDivElement | null>>([]);

  const marginPx = Math.round(pageMarginsInches * 96);
  const contentWidthPx = PAGE_WIDTH_PX - marginPx * 2;
  const maxContentHeightPx = PAGE_HEIGHT_PX - marginPx * 2 - 22;

  useLayoutEffect(() => {
    const computePages = () => {
      if (blocks.length === 0) {
        setPages([[]]);
        onPageCountChange?.(1);
        return;
      }

      const nextPages: number[][] = [];
      let current: number[] = [];
      let usedHeight = 0;

      blocks.forEach((_, idx) => {
        const el = measureRefs.current[idx];
        const height = el ? el.getBoundingClientRect().height : 0;

        if (current.length > 0 && usedHeight + height > maxContentHeightPx) {
          nextPages.push(current);
          current = [idx];
          usedHeight = height;
        } else {
          current.push(idx);
          usedHeight += height;
        }
      });

      if (current.length > 0) {
        nextPages.push(current);
      }

      setPages(nextPages);
      onPageCountChange?.(Math.max(1, nextPages.length));
      setCurrentPage((prev) => Math.min(prev, nextPages.length));
    };

    computePages();
    const raf = requestAnimationFrame(computePages);
    return () => cancelAnimationFrame(raf);
  }, [blocks, maxContentHeightPx, onPageCountChange]);

  const totalPages = Math.max(1, pages.length);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const displayedPageIndices =
    viewMode === 'single' ? [safeCurrentPage - 1] : pages.map((_, idx) => idx);

  return (
    <div className="flex flex-col h-full bg-slate-100 border-l border-slate-200 select-none">
      {/* Preview Toolbar */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Pages
            </button>
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'single' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Single Page
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-600 font-mono-tabular">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => {
                setViewMode('single');
                setCurrentPage((p) => Math.max(1, p - 1));
              }}
              aria-label="Previous page"
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 whitespace-nowrap">
              Page {safeCurrentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => {
                setViewMode('single');
                setCurrentPage((p) => Math.min(totalPages, p + 1));
              }}
              aria-label="Next page"
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Zoom & Export Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 border border-slate-200 rounded-md px-1 py-0.5 bg-white">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.45, Number((z - 0.1).toFixed(2))))}
              aria-label="Zoom out"
              className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono-tabular text-slate-700 w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.2, Number((z + 0.1).toFixed(2))))}
              aria-label="Zoom in"
              className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            disabled={isExportingDocx}
            onClick={onExportDocx}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            {isExportingDocx ? 'Exporting...' : 'DOCX'}
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          {onExportDrive && (
            <button
              type="button"
              disabled={isExportingDrive}
              onClick={onExportDrive}
              title="Save a copy to your Google Drive Career Engine DOC folder"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {isExportingDrive ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FolderUp className="w-3.5 h-3.5 text-emerald-700" />
              )}
              {isExportingDrive
                ? 'Saving...'
                : driveSyncStatus === 'pending_auth'
                  ? 'Retry Drive'
                  : 'Drive'}
            </button>
          )}
          {driveWebViewLink && (
            <a
              href={driveWebViewLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Open last exported file in Google Drive"
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden xl:inline">In Drive</span>
            </a>
          )}
        </div>
      </div>

      {/* Hidden Measurement Container */}
      <div
        aria-hidden="true"
        className="fixed -left-[9999px] top-0 pointer-events-none opacity-0"
        style={{ width: `${contentWidthPx}px` }}
      >
        {blocks.map((block, idx) => (
          <div
            key={`measure-${block.id}`}
            ref={(el) => {
              measureRefs.current[idx] = el;
            }}
          >
            {block.node}
          </div>
        ))}
      </div>

      {/* Rendered Page Viewport */}
      <div className="flex-1 overflow-auto p-6 flex flex-col items-center gap-6 select-text">
        <div className="sr-only">Live preview for {documentTitle}</div>
        {displayedPageIndices.map((pageIdx) => {
          const blockIndices = pages[pageIdx] || [];
          const scaledWidth = PAGE_WIDTH_PX * zoom;
          const scaledHeight = PAGE_HEIGHT_PX * zoom;

          return (
            <div
              key={`page-${pageIdx}`}
              style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}
              className="shrink-0 relative"
            >
              <div
                style={{
                  width: `${PAGE_WIDTH_PX}px`,
                  height: `${PAGE_HEIGHT_PX}px`,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  padding: `${marginPx}px`,
                  backgroundColor: paperColor,
                }}
                className="shadow-sm border border-slate-200/90 overflow-hidden flex flex-col justify-between box-border"
              >
                <div className="w-full">
                  {blockIndices.map((bIdx) => {
                    const block = blocks[bIdx];
                    if (!block) return null;
                    return <React.Fragment key={block.id}>{block.node}</React.Fragment>;
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="pt-2 text-right text-[10px] font-mono-tabular text-stone-400">
                    Page {pageIdx + 1} of {totalPages}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
