import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Maximize2,
  Monitor,
  Moon,
  RefreshCw,
  Settings2,
  Sun,
  X,
} from 'lucide-react';
import {
  APP_BRAND_NAME,
  APP_TAGLINE,
  DEFAULT_CONFIG,
  DEFAULT_PANITIA,
  DEFAULT_SCREEN_WIDTH_PCT,
  STORAGE_KEYS,
} from './config';
import {
  AppDataState,
  Donatur,
  RegisterDonaturPayload,
  StatusAktif,
  StatusPenyaluran,
  StatusVerifikasi,
  SubmitPembayaranPayload,
  TabKey,
  ThemeMode,
  ToastMessage,
  TransaksiDonasi,
} from './types';
import {
  fetchInitialData,
  getSavedGasUrl,
  registerDonatur,
  saveGasUrl,
  submitPembayaran,
  updateStatusDonatur,
  updateStatusPenyaluran,
  verifikasiTransaksi,
} from './services/api';
import { ConnectionModal } from './components/ConnectionModal';
import { TabPendaftaran } from './components/TabPendaftaran';
import { TabKonfirmasi } from './components/TabKonfirmasi';
import { TabDashboard } from './components/TabDashboard';
import { TabVerifikasi } from './components/TabVerifikasi';

function readReferralFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && ref.trim()) return ref.trim();
  } catch {
    // Ignore malformed query string
  }
  return null;
}

function getSavedTheme(): ThemeMode {
  try {
    const val = window.localStorage.getItem(STORAGE_KEYS.THEME_PREF);
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val;
    }
  } catch {
    // Ignore storage errors
  }
  return 'system';
}

function getSavedScreenWidth(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.SCREEN_WIDTH);
    if (raw) {
      const num = Number(raw);
      if (Number.isFinite(num) && num >= 60 && num <= 100) {
        return Math.round(num);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_SCREEN_WIDTH_PCT;
}

const NAV_TABS: { key: TabKey; label: string }[] = [
  { key: 'pendaftaran', label: 'Pendaftaran' },
  { key: 'konfirmasi', label: 'Konfirmasi' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'verifikasi', label: 'Verifikasi' },
];

const WIDTH_PRESETS = [75, 85, 95, 100];

export default function App() {
  const [referralCode] = useState<string | null>(() => readReferralFromUrl());
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    readReferralFromUrl() ? 'pendaftaran' : 'dashboard'
  );

  // Theme (system | light | dark) & customizable screen width (default 95%)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getSavedTheme());
  const [screenWidthPct, setScreenWidthPct] = useState<number>(() => getSavedScreenWidth());
  const [showDisplayControls, setShowDisplayControls] = useState<boolean>(false);

  const [gasUrl, setGasUrl] = useState<string>(() => getSavedGasUrl());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'local' | 'error'>(() =>
    getSavedGasUrl() ? 'connected' : 'local'
  );
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [preselectedDonatur, setPreselectedDonatur] = useState<Donatur | null>(null);

  const [data, setData] = useState<AppDataState>({
    config: DEFAULT_CONFIG,
    donatur: [],
    transaksi: [],
    panitia: DEFAULT_PANITIA,
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Sinkronisasi tema gelap / terang mengikuti preferensi perangkat secara real-time
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark =
        themeMode === 'dark' || (themeMode === 'system' && mediaQuery.matches);
      root.classList.toggle('dark', isDark);
    };

    applyTheme();

    try {
      window.localStorage.setItem(STORAGE_KEYS.THEME_PREF, themeMode);
    } catch {
      // Ignore storage errors
    }

    const handleSystemChange = () => {
      if (themeMode === 'system') applyTheme();
    };
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [themeMode]);

  // Simpan preferensi lebar layar
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.SCREEN_WIDTH, String(screenWidthPct));
    } catch {
      // Ignore storage errors
    }
  }, [screenWidthPct]);

  const notify = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, type, title, description }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadData = useCallback(
    async (targetUrl: string, showSuccessToast = false) => {
      setIsLoading(true);
      setConnectionError(null);
      const res = await fetchInitialData(targetUrl);
      setIsLoading(false);

      if (res.status === 'success' && res.data) {
        setData(res.data);
        setConnectionStatus(targetUrl.trim() ? 'connected' : 'local');
        if (showSuccessToast) {
          notify(
            'success',
            targetUrl.trim() ? 'Data disinkronkan dari Google Sheets' : 'Mode Uji Lokal aktif'
          );
        }
      } else {
        setConnectionStatus('error');
        setConnectionError(res.message);
        notify('error', 'Gagal memuat data', res.message);
      }
    },
    [notify]
  );

  useEffect(() => {
    void loadData(gasUrl, false);
  }, [gasUrl, loadData]);

  const handleSaveGasUrl = async (newUrl: string) => {
    saveGasUrl(newUrl);
    setGasUrl(newUrl);
    await loadData(newUrl, true);
  };

  const handleRegisterDonatur = async (
    payload: RegisterDonaturPayload
  ): Promise<{
    ok: boolean;
    message: string;
    donatur?: Donatur;
    existingDonatur?: Partial<Donatur>;
  }> => {
    const res = await registerDonatur(gasUrl, payload);
    if (res.status === 'success' && res.data?.donatur) {
      const created = res.data.donatur;
      setData((prev) => ({
        ...prev,
        donatur: [...prev.donatur, created],
      }));
      notify('success', 'Donatur terdaftar', `${created.namaLengkap} (${created.idDonatur})`);
      return { ok: true, message: res.message, donatur: created };
    }
    notify('error', 'Pendaftaran ditolak', res.message);
    return {
      ok: false,
      message: res.message,
      existingDonatur: res.data?.existingDonatur,
    };
  };

  const handleSubmitPembayaran = async (
    payload: SubmitPembayaranPayload
  ): Promise<{
    ok: boolean;
    message: string;
    transaksi?: TransaksiDonasi;
    savedFileName?: string;
  }> => {
    const res = await submitPembayaran(gasUrl, payload);
    if (res.status === 'success' && res.data?.transaksi) {
      const created = res.data.transaksi;
      setData((prev) => ({
        ...prev,
        transaksi: [...prev.transaksi, created],
      }));
      notify('success', 'Konfirmasi terkirim', `ID ${created.idTransaksi} menunggu verifikasi.`);
      return {
        ok: true,
        message: res.message,
        transaksi: created,
        savedFileName: res.data.savedFileName,
      };
    }
    notify('error', 'Gagal mengirim konfirmasi', res.message);
    return { ok: false, message: res.message };
  };

  const handleVerifikasiTransaksi = async (
    idTransaksi: string,
    status: StatusVerifikasi
  ): Promise<boolean> => {
    const res = await verifikasiTransaksi(gasUrl, idTransaksi, status);
    if (res.status === 'success') {
      setData((prev) => ({
        ...prev,
        transaksi: prev.transaksi.map((t) =>
          t.idTransaksi === idTransaksi
            ? {
                ...t,
                statusVerifikasi: status,
                statusPenyaluran:
                  status === 'Ditolak' ? 'Belum Disalurkan' : t.statusPenyaluran,
              }
            : t
        ),
      }));
      notify('success', `Transaksi ${status}`, res.message);
      return true;
    }
    notify('error', 'Gagal memperbarui verifikasi', res.message);
    return false;
  };

  const handleUpdateStatusPenyaluran = async (
    idTransaksi: string,
    statusPenyaluran: StatusPenyaluran
  ): Promise<boolean> => {
    const res = await updateStatusPenyaluran(gasUrl, idTransaksi, statusPenyaluran);
    if (res.status === 'success') {
      setData((prev) => ({
        ...prev,
        transaksi: prev.transaksi.map((t) =>
          t.idTransaksi === idTransaksi ? { ...t, statusPenyaluran } : t
        ),
      }));
      notify('success', statusPenyaluran, res.message);
      return true;
    }
    notify('error', 'Gagal memperbarui penyaluran', res.message);
    return false;
  };

  const handleUpdateStatusDonatur = async (idDonatur: string, status: StatusAktif) => {
    const res = await updateStatusDonatur(gasUrl, idDonatur, status);
    if (res.status === 'success') {
      setData((prev) => ({
        ...prev,
        donatur: prev.donatur.map((d) =>
          d.idDonatur === idDonatur ? { ...d, statusAktif: status } : d
        ),
      }));
      notify('success', `Status donatur: ${status}`, res.message);
    } else {
      notify('error', 'Gagal mengubah status', res.message);
    }
  };

  const pendingCount = useMemo(
    () => data.transaksi.filter((t) => t.statusVerifikasi === 'Pending').length,
    [data.transaksi]
  );

  const handleGoToKonfirmasi = useCallback((donatur: Donatur) => {
    setPreselectedDonatur(donatur);
    setActiveTab('konfirmasi');
  }, []);

  const handleClearPreselected = useCallback(() => {
    setPreselectedDonatur(null);
  }, []);

  // Lebar dinamis default 95% dengan proteksi layar sempit mobile minimal 320px / 100%
  const containerWidthStyle = useMemo<React.CSSProperties>(
    () => ({
      width: `min(100%, max(320px, ${screenWidthPct}%))`,
    }),
    [screenWidthPct]
  );

  return (
    <div className="min-h-screen flex flex-col text-slate-900 dark:text-slate-100">
      {/* 3-Zone Apple-Inspired Frosted Glass Top Bar */}
      <header className="glass-topbar sticky top-0 z-30">
        <div
          style={containerWidthStyle}
          className="mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-4 md:gap-8 transition-[width] duration-200"
        >
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-600 text-white shadow-sm shrink-0"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 3L4 8v8l8 5 8-5V8l-8-5z" strokeLinejoin="round" />
                <path d="M12 8v8M8 12h8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              {APP_BRAND_NAME}
            </span>
          </button>

          {/* Zone 2: Desktop Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Navigasi Utama">
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative py-2 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-emerald-800 dark:text-emerald-300'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>
                    {tab.label}
                    {tab.key === 'verifikasi' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                  </span>
                  {isActive && (
                    <span className="absolute inset-x-0 -bottom-[17px] h-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Utility Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Settings2 className="h-3.5 w-3.5 shrink-0" />
              <span>Koneksi GAS</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container (Lebar Default 95%, Dapat Diatur Pengguna) */}
      <main
        style={containerWidthStyle}
        className="flex-1 mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-5 transition-[width] duration-200 min-w-0"
      >
        {/* Mobile Tab Switcher */}
        <div
          className="md:hidden grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-2xl glass-surface p-1.5"
          role="tablist"
          aria-label="Navigasi Mobile"
        >
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
                {tab.key === 'verifikasi' && pendingCount > 0 ? ` (${pendingCount})` : ''}
              </button>
            );
          })}
        </div>

        {/* Workspace Brand Tagline, Connection Status & Display Controls Bar */}
        <div className="glass-surface rounded-2xl px-4 sm:px-5 py-3.5 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              {connectionStatus === 'connected' ? (
                <Cloud className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
              ) : connectionStatus === 'error' ? (
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <CloudOff className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 safe-wrap">
                  {APP_BRAND_NAME} — {APP_TAGLINE}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
                  <span
                    className={
                      connectionStatus === 'connected'
                        ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                        : connectionStatus === 'error'
                        ? 'font-semibold text-rose-700 dark:text-rose-400'
                        : 'font-semibold text-sky-700 dark:text-sky-400'
                    }
                  >
                    {connectionStatus === 'connected'
                      ? 'Terhubung Google Sheets & Drive'
                      : connectionStatus === 'error'
                      ? 'Koneksi Google Apps Script Gagal'
                      : 'Mode Uji Lokal (Belum Terhubung ke GAS)'}
                  </span>
                  {connectionError ? ` · ${connectionError}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Theme Mode Switcher (Sistem / Terang / Gelap) */}
              <div
                className="inline-flex items-center rounded-xl bg-slate-100/90 dark:bg-slate-800/90 p-1"
                role="group"
                aria-label="Pilihan Tema Tampilan"
              >
                <button
                  type="button"
                  onClick={() => setThemeMode('system')}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    themeMode === 'system'
                      ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Ikuti tema perangkat"
                >
                  <Monitor className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Perangkat</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    themeMode === 'light'
                      ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Tema Terang"
                >
                  <Sun className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Terang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    themeMode === 'dark'
                      ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Tema Gelap"
                >
                  <Moon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Gelap</span>
                </button>
              </div>

              {/* Screen Width Toggle Button */}
              <button
                type="button"
                onClick={() => setShowDisplayControls((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors whitespace-nowrap cursor-pointer ${
                  showDisplayControls
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
                }`}
                title="Atur persentase lebar layar"
              >
                <Maximize2 className="h-3.5 w-3.5 shrink-0" />
                <span>Lebar {screenWidthPct}%</span>
              </button>

              {connectionStatus !== 'connected' && (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Hubungkan GAS
                </button>
              )}

              <button
                type="button"
                onClick={() => void loadData(gasUrl, true)}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Memuat...' : 'Sinkronkan'}</span>
              </button>
            </div>
          </div>

          {/* Expandable Screen Width Adjuster (60% - 100%, Default 95%) */}
          {showDisplayControls && (
            <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <label
                  htmlFor="screen-width-slider"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                >
                  Lebar Tampilan ({screenWidthPct}%)
                </label>
                <input
                  id="screen-width-slider"
                  type="range"
                  min={60}
                  max={100}
                  step={1}
                  value={screenWidthPct}
                  onChange={(e) => setScreenWidthPct(Number(e.target.value))}
                  className="w-full max-w-xs accent-emerald-600 cursor-pointer"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {WIDTH_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setScreenWidthPct(pct)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors whitespace-nowrap cursor-pointer ${
                      screenWidthPct === pct
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active Tab View */}
        {activeTab === 'pendaftaran' && (
          <TabPendaftaran
            config={data.config}
            panitia={data.panitia}
            referralCode={referralCode}
            onSubmitDonatur={handleRegisterDonatur}
            onGoToKonfirmasi={handleGoToKonfirmasi}
          />
        )}

        {activeTab === 'konfirmasi' && (
          <TabKonfirmasi
            config={data.config}
            donaturList={data.donatur}
            panitia={data.panitia}
            preselectedDonatur={preselectedDonatur}
            onClearPreselected={handleClearPreselected}
            onSubmitPembayaran={handleSubmitPembayaran}
            onNotify={notify}
          />
        )}

        {activeTab === 'dashboard' && (
          <TabDashboard
            config={data.config}
            donaturList={data.donatur}
            transaksiList={data.transaksi}
            panitiaList={data.panitia}
            isLoading={isLoading}
            onUpdateStatusDonatur={handleUpdateStatusDonatur}
            onUpdateStatusPenyaluran={handleUpdateStatusPenyaluran}
            onGoToPendaftaran={() => setActiveTab('pendaftaran')}
            onNotify={notify}
          />
        )}

        {activeTab === 'verifikasi' && (
          <TabVerifikasi
            config={data.config}
            transaksiList={data.transaksi}
            isLoading={isLoading}
            onVerifikasi={handleVerifikasiTransaksi}
            onUpdateStatusPenyaluran={handleUpdateStatusPenyaluran}
          />
        )}
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="mt-10 border-t border-slate-200/70 dark:border-slate-800 bg-white/45 dark:bg-slate-950/45">
        <div
          style={containerWidthStyle}
          className="mx-auto px-3 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"
        >
          <p className="safe-wrap text-center sm:text-left">
            <strong className="text-slate-700 dark:text-slate-200">{APP_BRAND_NAME}</strong> · {APP_TAGLINE}
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 hover:underline whitespace-nowrap cursor-pointer"
          >
            Pengaturan Google Apps Script &amp; Referral
          </button>
        </div>
      </footer>

      {/* Connection, Code.gs Copy & Referral Settings Modal */}
      <ConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        gasUrl={gasUrl}
        connectionStatus={connectionStatus}
        panitia={data.panitia}
        onSaveUrl={handleSaveGasUrl}
        onNotify={notify}
      />

      {/* Non-blocking Toast Notifications */}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)]"
          aria-live="polite"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`glass-surface rounded-2xl p-4 shadow-lg flex items-start gap-3 border ${
                toast.type === 'success'
                  ? 'border-emerald-200/90 dark:border-emerald-800'
                  : toast.type === 'error'
                  ? 'border-rose-200/90 dark:border-rose-800'
                  : 'border-sky-200/90 dark:border-sky-800'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 safe-wrap">
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300 safe-wrap">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 cursor-pointer"
                aria-label="Tutup notifikasi"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
