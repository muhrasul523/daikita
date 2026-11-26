import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PageSizeOption } from '../types';

export const PAGE_SIZE_OPTIONS: { value: PageSizeOption; label: string }[] = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 500, label: '500' },
  { value: 'all', label: 'Semua' },
];

interface PaginationBarProps {
  currentPage: number;
  pageSize: PageSizeOption;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSizeOption) => void;
  itemLabel?: string;
  compact?: boolean;
}

export function slicePaginated<T>(
  items: T[],
  currentPage: number,
  pageSize: PageSizeOption
): {
  items: T[];
  pageItems: T[];
  safePage: number;
  totalPages: number;
  startIndex: number;
} {
  const total = items.length;
  if (pageSize === 'all' || total === 0) {
    return {
      items,
      pageItems: items,
      safePage: 1,
      totalPages: 1,
      startIndex: 0,
    };
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const sliced = items.slice(startIndex, startIndex + pageSize);
  return {
    items: sliced,
    pageItems: sliced,
    safePage,
    totalPages,
    startIndex,
  };
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'data',
  compact = false,
}) => {
  const numericSize = pageSize === 'all' ? Math.max(totalItems, 1) : pageSize;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / numericSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startNum = totalItems === 0 ? 0 : (safePage - 1) * numericSize + 1;
  const endNum =
    totalItems === 0
      ? 0
      : pageSize === 'all'
      ? totalItems
      : Math.min(safePage * numericSize, totalItems);

  const pageNumbers: (number | 'ellipsis')[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (safePage > 3) pageNumbers.push('ellipsis');
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let i = start; i <= end; i++) pageNumbers.push(i);
    if (safePage < totalPages - 2) pageNumbers.push('ellipsis');
    pageNumbers.push(totalPages);
  }

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800/80 ${
        compact ? 'px-3.5 py-2.5' : 'px-4 sm:px-5 py-3.5'
      } bg-slate-50/60 dark:bg-slate-900/50`}
    >
      {/* Info Rentang & Pilih Jumlah Tampil */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
        <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums safe-wrap">
          Menampilkan{' '}
          <strong className="text-slate-900 dark:text-slate-100">
            {startNum.toLocaleString('id-ID')}–{endNum.toLocaleString('id-ID')}
          </strong>{' '}
          dari{' '}
          <strong className="text-slate-900 dark:text-slate-100">
            {totalItems.toLocaleString('id-ID')}
          </strong>{' '}
          {itemLabel}
        </p>

        <div className="inline-flex items-center gap-1.5 shrink-0">
          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Tampilkan:
          </label>
          <select
            value={String(pageSize)}
            onChange={(e) => {
              const raw = e.target.value;
              const next: PageSizeOption =
                raw === 'all' ? 'all' : (Number(raw) as PageSizeOption);
              onPageSizeChange(next);
            }}
            aria-label="Jumlah data per halaman"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigasi Halaman */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safePage <= 1}
            title="Halaman Pertama"
            aria-label="Halaman Pertama"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            title="Halaman Sebelumnya"
            aria-label="Halaman Sebelumnya"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {pageNumbers.map((item, idx) =>
            item === 'ellipsis' ? (
              <span
                key={`el-${idx}`}
                className="px-1.5 text-xs font-semibold text-slate-400 select-none"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={`inline-flex h-8 min-w-[32px] px-2 items-center justify-center rounded-xl text-xs font-bold tabular-nums transition-all cursor-pointer ${
                  item === safePage
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {item}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            title="Halaman Berikutnya"
            aria-label="Halaman Berikutnya"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safePage >= totalPages}
            title="Halaman Terakhir"
            aria-label="Halaman Terakhir"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
