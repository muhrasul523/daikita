import React, { useMemo, useState } from 'react';
import { Moon, ReceiptText, Sun, UserPlus } from 'lucide-react';
import { APP_BRAND_NAME } from '../config';
import {
  Donatur,
  DonorLookupResult,
  LembagaConfig,
  NotifDeliveryResult,
  PublicPageKey,
  RegisterDonaturPayload,
  SubmitPembayaranPayload,
  ThemeMode,
  TransaksiDonasi,
  UpdateDonaturMandiriPayload,
} from '../types';
import { getDriveThumbnailFallback, normalizeDriveImageUrl } from '../utils/formatters';
import { PublicPendaftaran } from './PublicPendaftaran';
import { PublicPembayaran } from './PublicPembayaran';

interface PublicPortalProps {
  page: PublicPageKey;
  onChangePage: (next: PublicPageKey) => void;
  config: LembagaConfig;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onLookupWa: (noWa: string) => Promise<{
    ok: boolean;
    message: string;
    result?: DonorLookupResult;
  }>;
  onSubmitDonatur: (
    payload: RegisterDonaturPayload
  ) => Promise<{
    ok: boolean;
    message: string;
    donatur?: Donatur;
    existingDonatur?: Partial<Donatur>;
    notifStatus?: NotifDeliveryResult;
  }>;
  onUpdateDonaturMandiri: (
    payload: UpdateDonaturMandiriPayload
  ) => Promise<{
    ok: boolean;
    message: string;
    donatur?: Donatur;
  }>;
  onSubmitPembayaran: (
    payload: SubmitPembayaranPayload
  ) => Promise<{
    ok: boolean;
    message: string;
    transaksi?: TransaksiDonasi;
    transaksiList?: TransaksiDonasi[];
    savedFileName?: string;
  }>;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

export const PublicPortal: React.FC<PublicPortalProps> = ({
  page,
  onChangePage,
  config,
  themeMode,
  onToggleTheme,
  onLookupWa,
  onSubmitDonatur,
  onUpdateDonaturMandiri,
  onSubmitPembayaran,
  onNotify,
}) => {
  const [logoImgFailed, setLogoImgFailed] = useState(false);
  const [logoFallbackTried, setLogoFallbackTried] = useState(false);

  const [prefillDaftarWa, setPrefillDaftarWa] = useState<string>('');
  const [prefillBayar, setPrefillBayar] = useState<{
    donatur?: Donatur;
    transaksi?: TransaksiDonasi[];
    wa?: string;
  } | null>(null);

  const resolvedLogoSrc = useMemo(() => {
    if (!config.logoUrl) return '';
    if (logoFallbackTried) return getDriveThumbnailFallback(config.logoUrl);
    return normalizeDriveImageUrl(config.logoUrl);
  }, [config.logoUrl, logoFallbackTried]);

  const handleSwitchToBayar = (prefill?: {
    donatur?: Donatur;
    transaksi?: TransaksiDonasi[];
    wa?: string;
  }) => {
    setPrefillBayar(prefill || null);
    onChangePage('bayar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSwitchToDaftar = (prefillWa?: string) => {
    setPrefillDaftarWa(prefillWa || '');
    onChangePage('daftar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900 dark:text-slate-100 pb-20 md:pb-0">
      {/* Compact Public Top Header */}
      <header className="glass-topbar sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => onChangePage('daftar')}
            className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
          >
            {resolvedLogoSrc && !logoImgFailed ? (
              <img
                src={resolvedLogoSrc}
                alt={`Logo ${config.namaLembaga}`}
                referrerPolicy="no-referrer"
                onError={() => {
                  if (!logoFallbackTried && config.logoUrl) {
                    setLogoFallbackTried(true);
                  } else {
                    setLogoImgFailed(true);
                  }
                }}
                className="h-9 w-9 rounded-xl object-contain bg-white/95 p-0.5 shadow-sm shrink-0"
              />
            ) : (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-600 text-white shadow-sm shrink-0"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M12 3L4 8v8l8 5 8-5V8l-8-5z" strokeLinejoin="round" />
                  <path d="M12 8v8M8 12h8" strokeLinecap="round" />
                </svg>
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {APP_BRAND_NAME}
              </p>
              <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {config.namaLembaga}
              </p>
            </div>
          </button>

          {/* Desktop 2-Page Switcher */}
          <nav
            className="hidden md:inline-flex items-center gap-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 p-1"
            aria-label="Navigasi Donatur"
          >
            <button
              type="button"
              onClick={() => onChangePage('daftar')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                page === 'daftar'
                  ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5 shrink-0" />
              <span>Pendaftaran Donatur Tetap</span>
            </button>
            <button
              type="button"
              onClick={() => onChangePage('bayar')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                page === 'bayar'
                  ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ReceiptText className="h-3.5 w-3.5 shrink-0" />
              <span>Penyaluran Donasi</span>
            </button>
          </nav>

          {/* Subtle Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/85 dark:bg-slate-800/85 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title={themeMode === 'dark' ? 'Beralih ke Tema Terang' : 'Beralih ke Tema Gelap'}
            aria-label="Ubah tema tampilan"
          >
            {themeMode === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-600" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8 min-w-0">
        {page === 'daftar' ? (
          <PublicPendaftaran
            config={config}
            initialWa={prefillDaftarWa}
            onClearInitialWa={() => setPrefillDaftarWa('')}
            onLookupWa={onLookupWa}
            onSubmitDonatur={onSubmitDonatur}
            onUpdateDonaturMandiri={onUpdateDonaturMandiri}
            onSwitchToBayar={handleSwitchToBayar}
            onNotify={onNotify}
          />
        ) : (
          <PublicPembayaran
            config={config}
            initialPrefill={prefillBayar}
            onClearPrefill={() => setPrefillBayar(null)}
            onLookupWa={onLookupWa}
            onSubmitPembayaran={onSubmitPembayaran}
            onSwitchToDaftar={handleSwitchToDaftar}
            onNotify={onNotify}
          />
        )}
      </main>

      {/* Clean Public Footer */}
      <footer className="mt-8 border-t border-slate-200/70 dark:border-slate-800 bg-white/45 dark:bg-slate-950/45">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-center text-xs text-slate-500 dark:text-slate-400 safe-wrap">
          <strong className="text-slate-700 dark:text-slate-200">{config.namaLembaga}</strong> ·{' '}
          {config.tagline}
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar (Thumb-Zone Ergonomics) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 px-3 py-1.5"
        aria-label="Navigasi Bawah Mobile"
      >
        <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => onChangePage('daftar')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1.5 transition-all cursor-pointer ${
              page === 'daftar'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <UserPlus className="h-5 w-5 shrink-0" />
            <span className="text-[11px] font-bold tracking-tight">Daftar Tetap</span>
          </button>
          <button
            type="button"
            onClick={() => onChangePage('bayar')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1.5 transition-all cursor-pointer ${
              page === 'bayar'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <ReceiptText className="h-5 w-5 shrink-0" />
            <span className="text-[11px] font-bold tracking-tight">Salur &amp; Riwayat</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
