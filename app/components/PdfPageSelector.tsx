'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument } from 'pdf-lib';

type Props = {
  onExtract: (newFile: File) => void;
  initialFile?: File | null;
  className?: string;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val.toFixed(val >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export default function PdfPageSelector({ onExtract, initialFile = null, className }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Critical: configure pdf.js worker for Next.js so rendering doesn't block main thread.
  useEffect(() => {
    // react-pdf recommends bundling the worker via URL(import.meta.url).
    // This is safe in Next.js client components.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  }, []);

  const fileUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const reset = () => {
    setNumPages(null);
    setSelected(new Set());
    setError(null);
  };

  const acceptFile = (f: File) => {
    setError(null);
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    setFile(f);
    reset();
  };

  useEffect(() => {
    if (initialFile) acceptFile(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  const toggle = (pageNum: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
      return next;
    });
  };

  const selectAll = () => {
    if (!numPages) return;
    const s = new Set<number>();
    for (let i = 1; i <= numPages; i++) s.add(i);
    setSelected(s);
  };

  const clearSelection = () => setSelected(new Set());

  const handleConfirmExtraction = async () => {
    if (!file || !numPages) return;
    if (selected.size === 0) {
      setError('Select at least one page to continue.');
      return;
    }

    setIsExtracting(true);
    setError(null);
    try {
      const srcBytes = await file.arrayBuffer();
      const srcPdf = await PDFDocument.load(srcBytes);
      const outPdf = await PDFDocument.create();

      const indices = Array.from(selected)
        .filter((n) => n >= 1 && n <= numPages)
        .sort((a, b) => a - b)
        .map((n) => n - 1);

      const pages = await outPdf.copyPages(srcPdf, indices);
      for (const p of pages) outPdf.addPage(p);

      const outBytes = await outPdf.save();
      const baseName = file.name.replace(/\.pdf$/i, '');
      const outName =
        indices.length === numPages ? `${baseName}.pdf` : `${baseName}-selected-pages.pdf`;

      // Convert to a real ArrayBuffer for strict DOM typings (BlobPart does not accept SharedArrayBuffer).
      const outArrayBuffer: ArrayBuffer =
        outBytes.buffer instanceof ArrayBuffer
          ? outBytes.buffer.slice(outBytes.byteOffset, outBytes.byteOffset + outBytes.byteLength)
          : new Uint8Array(outBytes).buffer;
      const outBlob = new Blob([outArrayBuffer], { type: 'application/pdf' });
      const newFile = new File([outBlob], outName, { type: 'application/pdf' });
      onExtract(newFile);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to extract pages.';
      setError(msg);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className={className}>
      <div className="brand-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              PDF page selector
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 sm:max-w-xl">
              Upload a PDF, pick pages, then confirm to extract a new PDF.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Choose file
            </button>
            {file ? (
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  reset();
                }}
                className="inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium bg-white/0 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 border brand-border transition-colors"
              >
                Reset
              </button>
            ) : (
              <div className="hidden sm:block" />
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) acceptFile(f);
            // allow selecting the same file again
            e.currentTarget.value = '';
          }}
        />

        {!file ? (
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) acceptFile(f);
            }}
            className={`mt-4 rounded-xl border-2 border-dashed p-6 sm:p-10 text-center transition-colors ${
              isDragging
                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
                : 'border-gray-300 dark:border-white/15 hover:border-indigo-400/70 dark:hover:border-indigo-400/40'
            }`}
          >
            <div className="mx-auto max-w-sm space-y-2">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Drag & drop a PDF here
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Or click <span className="font-medium">Choose file</span>.
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {file.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatBytes(file.size)}
                  {numPages ? (
                    <span>
                      {' '}
                      · {numPages} page{numPages === 1 ? '' : 's'}
                    </span>
                  ) : null}
                  <span>
                    {' '}
                    · selected {selected.size}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={!numPages}
                  className="inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium bg-white/0 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 border brand-border transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={selected.size === 0}
                  className="inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium bg-white/0 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 border brand-border transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExtraction}
                  disabled={isExtracting || selected.size === 0}
                  className="col-span-2 inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                >
                  {isExtracting ? 'Extracting…' : 'Confirm'}
                </button>
              </div>
            </div>

            {error ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 text-red-800 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200 px-3 py-2 text-sm">
                {error}
              </div>
            ) : null}

            <div className="mt-4">
              <Document
                file={fileUrl ?? undefined}
                loading={
                  <div className="text-sm text-gray-500 dark:text-gray-400 py-6">
                    Loading PDF…
                  </div>
                }
                error={
                  <div className="text-sm text-red-600 dark:text-red-200 py-6">
                    Failed to load PDF.
                  </div>
                }
                onLoadSuccess={(info: { numPages: number }) => {
                  setNumPages(info.numPages);
                }}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Array.from({ length: numPages ?? 0 }, (_, idx) => {
                    const pageNum = idx + 1;
                    const isSelected = selected.has(pageNum);
                    return (
                      <button
                        key={`page-${pageNum}`}
                        type="button"
                        onClick={() => toggle(pageNum)}
                        className={`group relative rounded-xl overflow-hidden border transition-colors ${
                          isSelected
                            ? 'border-indigo-400 ring-2 ring-indigo-500/40'
                            : 'border-gray-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-400/30'
                        }`}
                        aria-pressed={isSelected}
                        title={`Page ${pageNum}`}
                      >
                        <div className="absolute top-2 left-2 z-10">
                          <div
                            className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-black/40 text-white/80 opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            {isSelected ? '✓' : pageNum}
                          </div>
                        </div>

                        <div className="bg-black/5 dark:bg-white/5">
                          <Page
                            pageNumber={pageNum}
                            width={150}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            loading={
                              <div className="h-[200px] flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                                …
                              </div>
                            }
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Document>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

