import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  LogIn,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { APP_BRAND_NAME, DEFAULT_ADMIN_AKSES } from '../config';
import { LembagaConfig, ThemeMode } from '../types';
import {
  formatWADisplay,
  getDriveThumbnailFallback,
  normalizeDriveImageUrl,
  validateAndNormalizeWA,
} from '../utils/formatters';

interface AdminLoginProps {
  config: LembagaConfig;
  isLocalMode: boolean;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onLogin: (noWa: string) => Promise<{ ok: boolean; message: string }>;
  onGoToPublic: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  config,
  isLocalMode,
  themeMode,
  onToggleTheme,
  onLogin,
  onGoToPublic,
}) => {
  const [noWa, setNoWa] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logoImgFailed, setLogoImgFailed] = useState(false);
  const [logoFallbackTried, setLogoFallbackTried] = useState(false);

  const resolvedLogoSrc = useMemo(() => {
    if (!config.logoUrl) return '';
    if (logoFallbackTried) return getDriveThumbnailFallback(config.logoUrl);
    return normalizeDriveImageUrl(config.logoUrl);
  }, [config.logoUrl, logoFallbackTried]);

  const waValidation = useMemo(() => validateAndNormalizeWA(noWa), [noWa]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!waValidation.valid) {
      setErrorMsg(waValidation.error);
      return;
    }

    setIsSubmitting(true);
    const res = await onLogin(waValidation.normalized);
    setIsSubmitting(false);

    if (!res.ok) {
      setErrorMsg(res.message || 'Gagal login. Pastikan nomor Anda terdaftar sebagai Admin.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900 dark:text-slate-100">
      <header className="glass-topbar">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
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
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-600 text-white shadow-sm shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {config.namaLembaga || APP_BRAND_NAME} · Portal Pengurus
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Admin &amp; Super Admin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onGoToPublic}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              <span>Halaman Donatur</span>
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
              aria-label="Ubah tema"
            >
              {themeMode === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <section className="glass-surface w-full max-w-md rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-600 text-white shadow-md">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Masuk Admin &amp; Super Admin
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
              Masukkan nomor HP / WhatsApp yang telah didaftarkan sebagai pengelola{' '}
              <strong>{config.namaLembaga}</strong>.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-login-wa"
                className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Nomor HP / WhatsApp Terdaftar
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <input
                  id="admin-login-wa"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={noWa}
                  onChange={(e) => {
                    setNoWa(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="081234567890"
                  className="w-full min-h-[50px] rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 pl-11 pr-4 py-3 text-base font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                />
              </div>
              {noWa.trim() !== '' && (
                <p
                  className={`mt-1.5 text-xs font-medium safe-wrap ${
                    waValidation.valid
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {waValidation.valid
                    ? `Nomor terformat: ${formatWADisplay(waValidation.normalized)}`
                    : waValidation.error}
                </p>
              )}
            </div>

            {errorMsg && (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/50 p-3.5 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed safe-wrap">{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-6 py-3 text-sm font-bold text-white shadow-[0_10px_24px_-8px_rgba(5,150,105,0.5)] hover:opacity-95 disabled:opacity-55 transition-all cursor-pointer"
            >
              <LogIn className="h-4 w-4 shrink-0" />
              <span>{isSubmitting ? 'Memverifikasi Akses...' : 'Masuk ke Portal Admin'}</span>
            </button>
          </form>

          {isLocalMode && (
            <div className="rounded-2xl border border-sky-200 dark:border-sky-800/70 bg-sky-50/75 dark:bg-sky-950/40 p-3.5 text-xs text-sky-900 dark:text-sky-200 space-y-1">
              <p className="font-bold">Mode Lokal Aktif (Uji Coba)</p>
              <p className="safe-wrap">
                Super Admin: <strong className="font-mono">{DEFAULT_ADMIN_AKSES[0].noWa}</strong> ·
                Admin: <strong className="font-mono">{DEFAULT_ADMIN_AKSES[1].noWa}</strong>
              </p>
            </div>
          )}

          <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 leading-relaxed safe-wrap">
            Nomor HP yang terdaftar sebagai Admin atau Super Admin tetap dapat digunakan sebagai
            donatur di halaman utama secara terpisah.
          </p>
        </section>
      </main>
    </div>
  );
};
