import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  keywords?: string;
  metaRight?: string;
}

interface SearchableSelectProps {
  id?: string;
  ariaLabel?: string;
  options: SearchableOption[];
  value: string;
  onChange: (value: string, option?: SearchableOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowClear?: boolean;
  disabled?: boolean;
  compact?: boolean;
  maxResults?: number;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  ariaLabel,
  options,
  value,
  onChange,
  placeholder = 'Pilih salah satu...',
  searchPlaceholder = 'Ketik untuk mencari...',
  emptyText = 'Pilihan tidak ditemukan.',
  allowClear = false,
  disabled = false,
  compact = false,
  maxResults = 80,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, maxResults);
    const terms = q.split(/\s+/).filter(Boolean);
    return options
      .filter((opt) => {
        const haystack = `${opt.label} ${opt.sublabel || ''} ${opt.keywords || ''} ${opt.value}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      })
      .slice(0, maxResults);
  }, [options, query, maxResults]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 20);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSelect = (opt: SearchableOption) => {
    onChange(opt.value, opt);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', undefined);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!disabled) setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setQuery('');
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) =>
        filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : 0
      );
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) =>
        filteredOptions.length > 0
          ? (prev - 1 + filteredOptions.length) % filteredOptions.length
          : 0
      );
      return;
    }

    if (e.key === 'Enter' && filteredOptions[highlightIndex]) {
      e.preventDefault();
      handleSelect(filteredOptions[highlightIndex]);
    }
  };

  return (
    <div ref={containerRef} className="relative min-w-0 w-full" onKeyDown={handleKeyDown}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border text-left transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
        } ${
          disabled
            ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
            : isOpen
            ? 'border-emerald-500 bg-white dark:bg-slate-900'
            : 'border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer'
        }`}
      >
        <span
          className={`truncate min-w-0 flex-1 ${
            selectedOption
              ? 'text-slate-900 dark:text-slate-100 font-medium'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <span className="flex items-center gap-1 shrink-0">
          {allowClear && selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              aria-label="Hapus pilihan"
              className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
            }`}
          />
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute z-40 mt-1.5 w-full min-w-[240px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
          role="listbox"
        >
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 pl-8 pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Kosongkan pencarian"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {filteredOptions.length === 0 ? (
            <div className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400 text-center safe-wrap">
              {emptyText}
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto divide-y divide-slate-100/80 dark:divide-slate-800/80 clean-scroll">
              {filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightIndex;
                return (
                  <li key={`${opt.value}-${idx}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      onClick={() => handleSelect(opt)}
                      className={`w-full px-3.5 py-2.5 text-left transition-colors flex items-center justify-between gap-2.5 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100'
                          : isHighlighted
                          ? 'bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100'
                          : 'text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold safe-wrap">{opt.label}</p>
                        {opt.sublabel && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
                            {opt.sublabel}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {opt.metaRight && (
                          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                            {opt.metaRight}
                          </span>
                        )}
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
