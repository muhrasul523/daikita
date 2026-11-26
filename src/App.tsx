import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudOff,
  ExternalLink,
  LogOut,
  Maximize2,
  Monitor,
  Moon,
  RefreshCw,
  Settings2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import {
  APP_BRAND_NAME,
  APP_PROGRAM_FOCUS,
  DEFAULT_CONFIG,
  DEFAULT_SCREEN_WIDTH_PCT,
  STORAGE_KEYS,
} from './config';
import {
  AdminSession,
  AdminTabKey,
  AppDataState,
  Donatur,
  DonorLookupResult,
  MinatGrupWa,
  NotifDeliveryResult,
  PublicPageKey,
  RegisterDonaturPayload,
  SaveAdminAksesPayload,
  SavePengaturanPayload,
  ScheduleBroadcastItemPayload,
  SendBroadcastSinglePayload,
  StatusAktif,
  StatusGrupWa,
  StatusVerifikasi,
  SubmitPembayaranPayload,
  SyncGroupMembersResult,
  TestNotificationPayload,
  ThemeMode,
  ToastMessage,
  TransaksiDonasi,
  UpdateDonaturMandiriPayload,
} from './types';
import {
  bulkUpdateStatusGrupDonatur,
  cancelScheduledMessage,
  deleteAdminAkses,
  fetchAdminData,
  fetchPublicConfig,
  getCachedPublicConfig,
  getSavedGasUrl,
  loginAdminByWa,
  lookupDonaturByWa,
  processScheduledQueue,
  registerDonatur,
  saveAdminAkses,
  saveGasUrl,
  savePengaturan,
  scheduleWaBroadcast,
  sendBroadcastSingle,
  sendTestNotification,
  submitPembayaran,
  syncGroupMembers,
  updateDonaturMandiri,
  updateStatusDonatur,
  updateStatusGrupDonatur,
  verifikasiTransaksi,
} from './services/api';
import { getDriveThumbnailFallback, normalizeDriveImageUrl } from './utils/formatters';
import { AdminLogin } from './components/AdminLogin';
import { ConnectionModal } from './components/ConnectionModal';
import { PublicPortal } from './components/PublicPortal';
import { TabAdminAkses } from './components/TabAdminAkses';
import { TabBroadcast } from './components/TabBroadcast';
import { TabDashboard } from './components/TabDashboard';
import { TabDonatur } from './components/TabDonatur';
import { TabGrupWa } from './components/TabGrupWa';
import { TabKonfirmasi } from './components/TabKonfirmasi';
import { TabMutasi } from './components/TabMutasi';
import { TabVerifikasi } from './components/TabVerifikasi';

type RouteState =
  | { mode: 'public'; page: PublicPageKey }
  | { mode: 'admin' };

function parseRouteFromLocation(): RouteState {
  try {
    const rawHash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
    const hashPath = rawHash.split('?')[0].replace(/\/+$/, '');
    const params = new URLSearchParams(window.location.search);
    const modeParam = (params.get('mode') || '').toLowerCase();
    const pageParam = (params.get('page') || '').toLowerCase();
    const pathname = (window.location.pathname || '').toLowerCase().replace(/\/+$/, '');

    if (
      hashPath === '/admin' ||
      hashPath.startsWith('/admin/') ||
      hashPath === 'admin' ||
      modeParam === 'admin' ||
      pathname.endsWith('/admin')
    ) {
      return { mode: 'admin' };
    }

    if (
      hashPath === '/bayar' ||
      hashPath.startsWith('/bayar/') ||
      hashPath === 'bayar' ||
      hashPath === '/konfirmasi' ||
      hashPath.startsWith('/konfirmasi/') ||
      hashPath === 'konfirmasi' ||
      pageParam === 'bayar' ||
      pageParam === 'konfirmasi' ||
      pathname.endsWith('/bayar') ||
      pathname.endsWith('/konfirmasi')
    ) {
      return { mode: 'public', page: 'bayar' };
    }
  } catch {
    // Fallback to public registration page
  }
  return { mode: 'public', page: 'daftar' };
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

const ADMIN_NAV_TABS: { key: AdminTabKey; label: string; superAdminOnly?: boolean }[] = [
  { key: 'donatur', label: 'Donatur' },
  { key: 'konfirmasi', label: 'Konfirmasi' },
  { key: 'verifikasi', label: 'Verifikasi' },
  { key: 'mutasi', label: 'Mutasi' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'grup_wa', label: 'Grup WA' },
  { key: 'broadcast', label: 'Broadcast' },
  { key: 'akses_admin', label: 'Akses Admin', superAdminOnly: true },
];

const WIDTH_PRESETS = [75, 85, 95, 100];

export default function App() {
  const [route, setRoute] = useState<RouteState>(() => parseRouteFromLocation());

  // Sesi admin disimpan HANYA di memory React (tidak di localStorage)
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTabKey>('dashboard');

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getSavedTheme());
  const [screenWidthPct, setScreenWidthPct] = useState<number>(() => getSavedScreenWidth());
  const [showUtilityBar, setShowUtilityBar] = useState<boolean>(false);
  const [showDisplayControls, setShowDisplayControls] = useState<boolean>(false);

  const [gasUrl, setGasUrl] = useState<string>(() => getSavedGasUrl());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'local' | 'error'>(() =>
    getSavedGasUrl() ? 'connected' : 'local'
  );
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [preselectedDonatur, setPreselectedDonatur] = useState<Donatur | null>(null);
  const [preselectedMonth, setPreselectedMonth] = useState<string | null>(null);

  const [data, setData] = useState<AppDataState>(() => ({
    config: getCachedPublicConfig()?.config || DEFAULT_CONFIG,
    donatur: [],
    transaksi: [],
    panitia: [],
    antreanPesan: [],
    adminAkses: [],
  }));

  const [logoImgFailed, setLogoImgFailed] = useState(false);
  const [logoFallbackTried, setLogoFallbackTried] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isSuperAdmin = adminSession?.admin.role === 'Super Admin';
  const adminToken = adminSession?.token || '';

  const visibleAdminTabs = useMemo(
    () => ADMIN_NAV_TABS.filter((tab) => !tab.superAdminOnly || isSuperAdmin),
    [isSuperAdmin]
  );

  // Sinkronkan route saat hash atau history berubah
  useEffect(() => {
    const syncRoute = () => {
      setRoute(parseRouteFromLocation());
    };
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  // Jika bukan Super Admin dan sedang di tab khusus Super Admin, alihkan ke dashboard
  useEffect(() => {
    if (!isSuperAdmin && activeTab === 'akses_admin') {
      setActiveTab('dashboard');
    }
    if (!isSuperAdmin && isModalOpen) {
      setIsModalOpen(false);
    }
  }, [isSuperAdmin, activeTab, isModalOpen]);

  const navigateToPublic = useCallback((nextPage: PublicPageKey) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      url.searchParams.delete('page');
      url.hash = nextPage === 'bayar' ? '#/bayar' : '#/daftar';
      window.history.pushState(null, '', url.toString());
    } catch {
      window.location.hash = nextPage === 'bayar' ? '#/bayar' : '#/daftar';
    }
    setRoute({ mode: 'public', page: nextPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const resolvedLogoSrc = useMemo(() => {
    if (!data.config.logoUrl) return '';
    if (logoFallbackTried) return getDriveThumbnailFallback(data.config.logoUrl);
    return normalizeDriveImageUrl(data.config.logoUrl);
  }, [data.config.logoUrl, logoFallbackTried]);

  useEffect(() => {
    setLogoImgFailed(false);
    setLogoFallbackTried(false);
  }, [data.config.logoUrl]);

  // Sinkronkan title & favicon browser dengan logo lembaga serta halaman aktif
  useEffect(() => {
    const baseName = data.config.namaLembaga || APP_BRAND_NAME;
    if (route.mode === 'admin') {
      document.title = `Panel Admin · ${baseName}`;
    } else if (route.page === 'bayar') {
      document.title = `Penyaluran Donasi · ${baseName}`;
    } else {
      document.title = `Pendaftaran Donatur Tetap · ${baseName}`;
    }

    const targetHref = resolvedLogoSrc && !logoImgFailed ? resolvedLogoSrc : './favicon.png';

    document
      .querySelectorAll<HTMLLinkElement>("link[rel='icon'][type='image/svg+xml']")
      .forEach((el) => el.remove());

    (['icon', 'shortcut icon', 'apple-touch-icon'] as const).forEach((relName) => {
      let el = document.querySelector<HTMLLinkElement>(`link[rel='${relName}']`);
      if (!el) {
        el = document.createElement('link');
        el.rel = relName;
        document.head.appendChild(el);
      }
      if (resolvedLogoSrc && !logoImgFailed) {
        el.removeAttribute('type');
      } else {
        el.type = 'image/png';
      }
      el.href = targetHref;
    });
  }, [data.config.namaLembaga, resolvedLogoSrc, logoImgFailed, route]);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark = themeMode === 'dark' || (themeMode === 'system' && mediaQuery.matches);
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

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.SCREEN_WIDTH, String(screenWidthPct));
    } catch {
      // Ignore storage errors
    }
  }, [screenWidthPct]);

  const handleToggleQuickTheme = useCallback(() => {
    setThemeMode((prev) => {
      const currentlyDark =
        prev === 'dark' ||
        (prev === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      return currentlyDark ? 'light' : 'dark';
    });
  }, []);

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

  const clearAdminSession = useCallback(
    (expiredMessage?: string) => {
      setAdminSession(null);
      setIsModalOpen(false);
      setPreselectedDonatur(null);
      setPreselectedMonth(null);
      setData((prev) => ({
        ...prev,
        donatur: [],
        transaksi: [],
        antreanPesan: [],
        adminAkses: [],
      }));
      if (expiredMessage) {
        notify('error', 'Sesi Admin Berakhir', expiredMessage);
      }
    },
    [notify]
  );

  // Muat konfigurasi publik aman (tanpa data donatur/mutasi) saat startup
  const loadPublicBootstrap = useCallback(async (targetUrl: string) => {
    const res = await fetchPublicConfig(targetUrl);
    if (res.status === 'success' && res.data) {
      setData((prev) => ({
        ...prev,
        config: res.data!.config,
      }));
      setConnectionStatus(targetUrl.trim() ? 'connected' : 'local');
      setConnectionError(null);
    } else {
      setConnectionStatus('error');
      setConnectionError(res.message);
    }
  }, []);

  useEffect(() => {
    void loadPublicBootstrap(gasUrl);
  }, [gasUrl, loadPublicBootstrap]);

  // Muat seluruh data operasional Admin (memerlukan token sesi valid)
  const loadAdminWorkspaceData = useCallback(
    async (targetUrl: string, token: string, showSuccessToast = false) => {
      if (!token) return false;
      setIsLoadingAdmin(true);
      setConnectionError(null);
      const res = await fetchAdminData(targetUrl, token);
      setIsLoadingAdmin(false);

      if (res.status === 'success' && res.data) {
        setData(res.data);
        setConnectionStatus(targetUrl.trim() ? 'connected' : 'local');
        if (showSuccessToast) {
          notify(
            'success',
            targetUrl.trim() ? 'Data berhasil disinkronkan' : 'Mode Lokal aktif'
          );
        }
        return true;
      }

      if (res.code === 'AUTH_REQUIRED') {
        clearAdminSession(res.message || 'Silakan login kembali dengan nomor WA terdaftar.');
        return false;
      }

      setConnectionStatus('error');
      setConnectionError(res.message);
      notify('error', 'Gagal memuat data admin', res.message);
      return false;
    },
    [clearAdminSession, notify]
  );

  // === AUTH HANDLERS ===
  const handleAdminLogin = async (noWa: string): Promise<{ ok: boolean; message: string }> => {
    const res = await loginAdminByWa(gasUrl, noWa);
    if (res.status === 'success' && res.data?.token && res.data?.admin) {
      const session = res.data;
      setAdminSession(session);
      setActiveTab('dashboard');
      notify(
        'success',
        `Selamat datang, ${session.admin.nama}`,
        `Masuk sebagai ${session.admin.role}`
      );
      await loadAdminWorkspaceData(gasUrl, session.token, false);
      return { ok: true, message: res.message };
    }
    return { ok: false, message: res.message || 'Nomor WA tidak memiliki akses admin.' };
  };

  const handleAdminLogout = () => {
    clearAdminSession();
    notify('info', 'Keluar dari Panel Admin', 'Sesi Anda telah ditutup dengan aman.');
  };

  // === PUBLIC PORTAL HANDLERS ===
  const handlePublicLookupWa = async (
    noWa: string,
    options?: { forceRefresh?: boolean }
  ): Promise<{ ok: boolean; message: string; result?: DonorLookupResult }> => {
    const res = await lookupDonaturByWa(gasUrl, noWa, options);
    if (res.status === 'success' && res.data) {
      return { ok: true, message: res.message, result: res.data };
    }
    return { ok: false, message: res.message || 'Gagal memeriksa nomor WhatsApp.' };
  };

  const handleRegisterDonatur = async (
    payload: RegisterDonaturPayload
  ): Promise<{
    ok: boolean;
    message: string;
    donatur?: Donatur;
    existingDonatur?: Partial<Donatur>;
    notifStatus?: NotifDeliveryResult;
  }> => {
    const res = await registerDonatur(gasUrl, payload);
    if (res.status === 'success' && res.data?.donatur) {
      const created = res.data.donatur;
      const notifStatus = res.data.notifStatus;
      if (adminSession) {
        setData((prev) => ({
          ...prev,
          donatur: [...prev.donatur, created],
        }));
      }
      const waLabel = notifStatus?.wa.ok ? 'WA terkirim' : 'WA belum terkirim';
      const emailLabel = notifStatus?.email.ok
        ? 'Email terkirim'
        : created.email
        ? 'Email gagal'
        : 'Tanpa email';
      notify(
        'success',
        `Donatur terdaftar (${created.namaLengkap})`,
        `${created.idDonatur} · ${waLabel} · ${emailLabel}`
      );
      return { ok: true, message: res.message, donatur: created, notifStatus };
    }
    notify('error', 'Pendaftaran belum dapat diproses', res.message);
    return {
      ok: false,
      message: res.message,
      existingDonatur: res.data?.existingDonatur,
    };
  };

  const handleUpdateDonaturMandiri = async (
    payload: UpdateDonaturMandiriPayload
  ): Promise<{ ok: boolean; message: string; donatur?: Donatur }> => {
    const res = await updateDonaturMandiri(gasUrl, payload);
    if (res.status === 'success' && res.data?.donatur) {
      const updated = res.data.donatur;
      if (adminSession) {
        setData((prev) => ({
          ...prev,
          donatur: prev.donatur.map((d) =>
            d.idDonatur === updated.idDonatur ? updated : d
          ),
        }));
      }
      notify('success', 'Data donatur diperbarui', res.message);
      return { ok: true, message: res.message, donatur: updated };
    }
    notify('error', 'Gagal memperbarui data', res.message);
    return { ok: false, message: res.message };
  };

  const handleSubmitPembayaran = async (
    payload: SubmitPembayaranPayload
  ): Promise<{
    ok: boolean;
    message: string;
    transaksi?: TransaksiDonasi;
    transaksiList?: TransaksiDonasi[];
    savedFileName?: string;
  }> => {
    const tokenToSend = adminSession ? adminToken : undefined;
    const res = await submitPembayaran(gasUrl, payload, tokenToSend);
    if (res.code === 'AUTH_REQUIRED' && adminSession) {
      clearAdminSession(res.message);
      return { ok: false, message: res.message };
    }

    const createdList =
      res.data?.transaksiList && res.data.transaksiList.length > 0
        ? res.data.transaksiList
        : res.data?.transaksi
        ? [res.data.transaksi]
        : [];
    if (res.status === 'success' && createdList.length > 0) {
      if (adminSession) {
        setData((prev) => ({
          ...prev,
          transaksi: [...prev.transaksi, ...createdList],
        }));
      }
      const first = createdList[0];
      notify(
        'success',
        createdList.length > 1
          ? `Konfirmasi ${createdList.length} bulan terkirim`
          : 'Konfirmasi terkirim',
        createdList.length > 1
          ? `${createdList.length} periode atas nama ${first.namaDonatur} menunggu verifikasi.`
          : `ID ${first.idTransaksi} menunggu verifikasi.`
      );
      return {
        ok: true,
        message: res.message,
        transaksi: first,
        transaksiList: createdList,
        savedFileName: res.data?.savedFileName,
      };
    }
    notify('error', 'Gagal mengirim konfirmasi', res.message);
    return { ok: false, message: res.message };
  };

  // === ADMIN & SUPER ADMIN HANDLERS ===
  const handleSaveGasUrl = async (newUrl: string) => {
    saveGasUrl(newUrl);
    setGasUrl(newUrl);
    await loadPublicBootstrap(newUrl);
    if (adminSession) {
      await loadAdminWorkspaceData(newUrl, adminSession.token, true);
    }
  };

  const handleSavePengaturan = async (payload: SavePengaturanPayload): Promise<boolean> => {
    const res = await savePengaturan(gasUrl, payload, adminToken);
    if (res.code === 'AUTH_REQUIRED') {
      clearAdminSession(res.message);
      return false;
    }
    if (res.status === 'success' && res.data?.config) {
      setData((prev) => ({
        ...prev,
        config: res.data!.config,
      }));
      notify('success', 'Pengaturan tersimpan', res.message);
      return true;
    }
    notify('error', 'Gagal menyimpan pengaturan', res.message);
    return false;
  };

  const handleSaveAdminAkses = async (payload: SaveAdminAksesPayload): Promise<boolean> => {
    const res = await saveAdminAkses(gasUrl, payload, adminToken);
    if (res.code === 'AUTH_REQUIRED') {
      clearAdminSession(res.message);
      return false;
    }
    if (res.status === 'success' && res.data?.adminAkses) {
      setData((prev) => ({
        ...prev,
        adminAkses: res.data!.adminAkses,
      }));
      notify('success', 'Akses admin diperbarui', res.message);
      return true;
    }
    notify('error', 'Gagal menyimpan akses admin', res.message);
    return false;
  };

  const handleDeleteAdminAkses = async (noWa: string): Promise<boolean> => {
    const res = await deleteAdminAkses(gasUrl, noWa, adminToken);
    if (res.code === 'AUTH_REQUIRED') {
      clearAdminSession(res.message);
      return false;
    }
    if (res.status === 'success' && res.data?.adminAkses) {
      setData((prev) => ({
        ...prev,
        adminAkses: res.data!.adminAkses,
      }));
      notify('success', 'Akses admin dihapus', res.message);
      return true;
    }
    notify('error', 'Gagal menghapus akses admin', res.message);
    return false;
  };

  const handleTestNotification = async (
    payload: TestNotificationPayload
  ): Promise<{ ok: boolean; message: string; notifStatus?: NotifDeliveryResult }> => {
    const res = await sendTestNotification(gasUrl, payload, adminToken);
    if (res.code === 'AUTH_REQUIRED') {
      clearAdminSession(res.message);
      return { ok: false, message: res.message };
    }
    if (res.status === 'success' && res.data?.notifStatus) {
      notify('success', 'Pengujian selesai', res.message);
      return { ok: true, message: res.message, notifStatus: res.data.notifStatus };
    }
    return { ok: false, message: res.message };
  };

  const handleVerifikasiTransaksi = async (
    idTransaksi: string,
    status: StatusVerifikasi
  ): Promise<boolean> => {
    const res = await verifikasiTransaksi(gasUrl, idTransaksi, status, adminToken);
    if (res.code === 'AUTH_REQUIRED') {
      clearAdminSession(res.message);
      return false;
    }
    if (res.status === 'success') {
      setData((prev) => ({
        ...prev,
        transaksi: prev.transaksi.map((t) =>
          t.idTransaksi === idTransaksi
            ? {
                ...t,
                statusVerifikasi: status,
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

  const handleUpdateStatusDonatur = async (idDonatur: string, status: StatusAktif) => {
    const res = await updateStatusDonatur(gasUrl, idDonatur, status, adminToken);
    if (res.code === 'AUTH_REQUIRED') {
      clearAdminSession(res.message);
      return;
    }
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

  const handleUpdateStatusGrup = async (
    idDonatur: string,
    statusGrupWa: StatusGrupWa,
    minatGrupWa?: MinatGrupWa
  ): Promise<boolean> => {
    const res = await updateStatusGrupDonatur(
      gasUrl,
      idDonatur,
      statusGrupWa,
      minatGrupWa,
      adminToken
    );
    if (res.code === 'AUTH_REQUIRED') {
      clearAdminSession(res.message);
      return false;
    }
    if (res.status === 'success') {
      setData((prev) => ({
        ...prev,
        donatur: prev.donatur.map((d) =>
          d.idDonatur === idDonatur
            ? { ...d, statusGrupWa, minatGrupWa: minatGrupWa || d.minatGrupWa }
            : d
        ),
      }));
      notify('success', 'Status Grup WA diperbarui', res.message);
      return true;
    }
    notify('error', 'Gagal memperbarui status Grup WA', res.message);
    return false;
  };

  const handleBulkUpdateStatusGrup = async (
    ids: string[],
    statusGrupWa: StatusGrupWa
  ): Promise<boolean> => {
    const res = await bulkUpdateStatusGrupDonatur(gasUrl, ids, statusGrupWa, adminToken);
    if (res.code === 'AUTH_REQUIRED') {
      clearAdminSession(res.message);
      return false;
    }
    if (res.status === 'success') {
      const idSet = new Set(ids);
      setData((prev) => ({
        ...prev,
        donatur: prev.donatur.map((d) =>
          idSet.has(d.idDonatur) ? { ...d, statusGrupWa } : d
        ),
      }));
      notify('success', 'Pembaruan massal berhasil', res.message);
      return true;
    }
    notify('error', 'Gagal memperbarui status grup massal', res.message);
    return false;
  };

  const handleSyncGroupMembers = async (options?: {
    memberPhones?: string[];
    markOthersNotJoined?: boolean;
  }): Promise<{ ok: boolean; message: string; result?: SyncGroupMembersResult }> => {
    const res = await syncGroupMembers(gasUrl, adminToken, options);
    if (res.code === 'AUTH_REQUIRED') {
      clearAdminSession(res.message);
      return { ok: false, message: res.message };
    }
    if (res.status === 'success' && res.data) {
      const joinedSet = new Set(res.data.updatedJoinedIds || []);
      const notJoinedSet = new Set(res.data.updatedNotJoinedIds || []);
      if (joinedSet.size > 0 || notJoinedSet.size > 0) {
        setData((prev) => ({
          ...prev,
          donatur: prev.donatur.map((d) => {
            if (joinedSet.has(d.idDonatur)) {
              return { ...d, statusGrupWa: 'Sudah Bergabung' };
            }
            if (notJoinedSet.has(d.idDonatur)) {
              return { ...d, statusGrupWa: 'Belum Bergabung' };
            }
            return d;
          }),
        }));
      }
      notify('success', 'Sinkronisasi Grup WA selesai', res.message);
      return { ok: true, message: res.message, result: res.data };
    }
    notify('info', 'Sinkronisasi otomatis belum selesai', res.message);
    return { ok: false, message: res.message, result: res.data };
  };

  const handleSendBroadcastSingle = async (
    payload: SendBroadcastSinglePayload
  ): Promise<{ ok: boolean; detail: string; emailDetail?: string }> => {
    const res = await sendBroadcastSingle(gasUrl, payload, adminToken);
    if (res.code === 'AUTH_REQUIRED') {
      clearAdminSession(res.message);
      return { ok: false, detail: res.message };
    }
    if (res.status === 'success' && res.data) {
      return {
        ok: Boolean(res.data.ok),
        detail: res.data.detail || res.message,
        emailDetail: res.data.emailDetail,
      };
    }
    return { ok: false, detail: res.message };
  };

  const handleScheduleBroadcast = async (
    items: ScheduleBroadcastItemPayload[]
  ): Promise<boolean> => {
    const res = await scheduleWaBroadcast(gasUrl, items, adminToken);
    if (res.code === 'AUTH_REQUIRED') {
      clearAdminSession(res.message);
      return false;
    }
    if (res.status === 'success') {
      if (res.data?.antreanPesan) {
        setData((prev) => ({
          ...prev,
          antreanPesan: res.data!.antreanPesan,
        }));
      }
      notify('success', 'Broadcast terjadwal disimpan', res.message);
      return true;
    }
    notify('error', 'Gagal menjadwalkan broadcast', res.message);
    return false;
  };

  const handleProcessQueue = async (): Promise<boolean> => {
    const res = await processScheduledQueue(gasUrl, adminToken);
    if (res.code === 'AUTH_REQUIRED') {
      clearAdminSession(res.message);
      return false;
    }
    if (res.status === 'success') {
      if (res.data?.antreanPesan) {
        setData((prev) => ({
          ...prev,
          antreanPesan: res.data!.antreanPesan,
        }));
      }
      notify('success', 'Antrean diproses', res.message);
      return true;
    }
    notify('error', 'Gagal memproses antrean', res.message);
    return false;
  };

  const handleCancelScheduled = async (idAntrean: string): Promise<boolean> => {
    const res = await cancelScheduledMessage(gasUrl, idAntrean, adminToken);
    if (res.code === 'AUTH_REQUIRED') {
      clearAdminSession(res.message);
      return false;
    }
    if (res.status === 'success') {
      setData((prev) => ({
        ...prev,
        antreanPesan: res.data?.antreanPesan
          ? res.data.antreanPesan
          : (prev.antreanPesan || []).map((item) =>
              item.idAntrean === idAntrean ? { ...item, status: 'Dibatalkan' } : item
            ),
      }));
      notify('success', 'Antrean dibatalkan', res.message);
      return true;
    }
    notify('error', 'Gagal membatalkan antrean', res.message);
    return false;
  };

  const pendingCount = useMemo(
    () => data.transaksi.filter((t) => t.statusVerifikasi === 'Pending').length,
    [data.transaksi]
  );

  const handleGoToKonfirmasi = useCallback((donatur: Donatur, targetMonth?: string) => {
    setPreselectedDonatur(donatur);
    setPreselectedMonth(targetMonth || null);
    setActiveTab('konfirmasi');
  }, []);

  const handleClearPreselected = useCallback(() => {
    setPreselectedDonatur(null);
    setPreselectedMonth(null);
  }, []);

  const containerWidthStyle = useMemo<React.CSSProperties>(
    () => ({
      width: `min(100%, max(320px, ${screenWidthPct}%))`,
    }),
    [screenWidthPct]
  );

  // Toast Overlay dibagikan ke seluruh mode (Publik, Login Admin, Panel Admin)
  const toastOverlay =
    toasts.length > 0 ? (
      <div
        className={`fixed right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] ${
          route.mode === 'public' ? 'bottom-20 md:bottom-4' : 'bottom-4'
        }`}
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
              <AlertCircle
                className={`h-4 w-4 shrink-0 mt-0.5 ${
                  toast.type === 'error'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-sky-600 dark:text-sky-400'
                }`}
              />
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
    ) : null;

  // === ROUTE 1: PORTAL PUBLIK DONATUR (https://daikita.duwd.web.id/ & #/bayar) ===
  if (route.mode === 'public') {
    return (
      <>
        <PublicPortal
          page={route.page}
          onChangePage={navigateToPublic}
          config={data.config}
          themeMode={themeMode}
          onToggleTheme={handleToggleQuickTheme}
          onLookupWa={handlePublicLookupWa}
          onSubmitDonatur={handleRegisterDonatur}
          onUpdateDonaturMandiri={handleUpdateDonaturMandiri}
          onSubmitPembayaran={handleSubmitPembayaran}
          onNotify={notify}
        />
        {toastOverlay}
      </>
    );
  }

  // === ROUTE 2: LOGIN ADMIN & SUPER ADMIN (https://daikita.duwd.web.id/#/admin) ===
  if (!adminSession) {
    return (
      <>
        <AdminLogin
          config={data.config}
          isLocalMode={!gasUrl.trim()}
          themeMode={themeMode}
          onToggleTheme={handleToggleQuickTheme}
          onLogin={handleAdminLogin}
          onGoToPublic={() => navigateToPublic('daftar')}
        />
        {toastOverlay}
      </>
    );
  }

  // === ROUTE 3: WORKSPACE ADMIN & SUPER ADMIN ===
  return (
    <div className="min-h-screen flex flex-col text-slate-900 dark:text-slate-100">
      {/* 3-Zone Top Bar */}
      <header className="glass-topbar sticky top-0 z-30">
        <div
          style={containerWidthStyle}
          className="mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3 md:gap-6 transition-[width] duration-200"
        >
          {/* Zone 1: Brand Logo & Role */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
          >
            {resolvedLogoSrc && !logoImgFailed ? (
              <img
                src={resolvedLogoSrc}
                alt={`Logo ${data.config.namaLembaga}`}
                referrerPolicy="no-referrer"
                onError={() => {
                  if (!logoFallbackTried && data.config.logoUrl) {
                    setLogoFallbackTried(true);
                  } else {
                    setLogoImgFailed(true);
                  }
                }}
                className="h-8 w-8 rounded-xl object-contain bg-white/90 p-0.5 shadow-sm shrink-0"
              />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-600 text-white shadow-sm shrink-0"
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
              <span className="block text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                {APP_BRAND_NAME}
              </span>
              <span className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 leading-tight">
                {adminSession.admin.role}
              </span>
            </div>
          </button>

          {/* Zone 2: Desktop Single-Line Navigation Links (No Scrollbar Overflow) */}
          <nav
            className="hidden xl:flex items-center gap-4 2xl:gap-6 h-full"
            aria-label="Navigasi Admin"
          >
            {visibleAdminTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative h-16 inline-flex items-center text-xs 2xl:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Compact Display Toggle, Super Admin Settings & Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowUtilityBar((v) => !v)}
              aria-expanded={showUtilityBar}
              className={`relative inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showUtilityBar
                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200'
                  : 'border-slate-200/90 dark:border-slate-700 bg-white/85 dark:bg-slate-800/85 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
              }`}
              title={
                isSuperAdmin
                  ? 'Atur tema, lebar tampilan, dan sinkronisasi'
                  : 'Atur tema dan lebar tampilan'
              }
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Tampilan</span>
              {isSuperAdmin && connectionStatus !== 'connected' && (
                <span
                  className={`h-2 w-2 rounded-full ${
                    connectionStatus === 'error' ? 'bg-rose-500' : 'bg-sky-500'
                  }`}
                  aria-hidden="true"
                />
              )}
            </button>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Settings2 className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Pengaturan</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAdminLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/80 dark:bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Keluar dari sesi admin"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main
        style={containerWidthStyle}
        className="flex-1 mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-5 transition-[width] duration-200 min-w-0"
      >
        {/* Mobile & Tablet Navigation (below xl) */}
        <div
          className="xl:hidden grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-2xl glass-surface p-1.5"
          role="tablist"
          aria-label="Navigasi Admin Mobile"
        >
          {visibleAdminTabs.map((tab) => {
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

        {/* Utility Bar (Hidden by default, toggled via Tampilan; sync controls strictly Super Admin only) */}
        {showUtilityBar && (
          <div className="glass-surface rounded-2xl px-4 sm:px-5 py-3.5 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                {isSuperAdmin &&
                  (connectionStatus === 'connected' ? (
                    <Cloud className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                  ) : connectionStatus === 'error' ? (
                    <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
                  ) : (
                    <CloudOff className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5 sm:mt-0" />
                  ))}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 safe-wrap">
                      {adminSession.admin.nama}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-200">
                      {isSuperAdmin ? (
                        <ShieldCheck className="h-3 w-3 shrink-0" />
                      ) : (
                        <Shield className="h-3 w-3 shrink-0" />
                      )}
                      {adminSession.admin.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
                    {isSuperAdmin ? (
                      <>
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
                            ? `Sinkronisasi Aktif · Program ${APP_PROGRAM_FOCUS}`
                            : connectionStatus === 'error'
                            ? 'Koneksi Layanan Gagal'
                            : `Mode Lokal (Offline) · Program ${APP_PROGRAM_FOCUS}`}
                        </span>
                        {connectionError ? ` · ${connectionError}` : ''}
                      </>
                    ) : (
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        Program {APP_PROGRAM_FOCUS}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
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

                <button
                  type="button"
                  onClick={() => navigateToPublic('daftar')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span>Portal Donatur</span>
                </button>

                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => void loadAdminWorkspaceData(gasUrl, adminToken, true)}
                    disabled={isLoadingAdmin}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 shrink-0 ${isLoadingAdmin ? 'animate-spin' : ''}`}
                    />
                    <span>{isLoadingAdmin ? 'Memuat...' : 'Sinkronkan'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowUtilityBar(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  title="Sembunyikan bilah tampilan"
                  aria-label="Sembunyikan bilah tampilan"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

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
        )}

        {/* Active Admin Tab View */}
        {activeTab === 'donatur' && (
          <TabDonatur
            config={data.config}
            donaturList={data.donatur}
            transaksiList={data.transaksi}
            adminName={adminSession.admin.nama}
            isLoading={isLoadingAdmin}
            onUpdateStatusDonatur={handleUpdateStatusDonatur}
            onSubmitDonatur={handleRegisterDonatur}
            onGoToKonfirmasiBulan={handleGoToKonfirmasi}
            onNotify={notify}
          />
        )}

        {activeTab === 'konfirmasi' && (
          <TabKonfirmasi
            config={data.config}
            donaturList={data.donatur}
            transaksiList={data.transaksi}
            adminName={adminSession.admin.nama}
            preselectedDonatur={preselectedDonatur}
            preselectedMonth={preselectedMonth}
            onClearPreselected={handleClearPreselected}
            onSubmitPembayaran={handleSubmitPembayaran}
            onGoToPendaftaran={() => setActiveTab('donatur')}
            onNotify={notify}
          />
        )}

        {activeTab === 'verifikasi' && (
          <TabVerifikasi
            config={data.config}
            transaksiList={data.transaksi}
            isLoading={isLoadingAdmin}
            onVerifikasi={handleVerifikasiTransaksi}
          />
        )}

        {activeTab === 'mutasi' && (
          <TabMutasi transaksiList={data.transaksi} isLoading={isLoadingAdmin} />
        )}

        {activeTab === 'dashboard' && (
          <TabDashboard
            config={data.config}
            donaturList={data.donatur}
            transaksiList={data.transaksi}
            isLoading={isLoadingAdmin}
            onOpenMutasi={(view) => {
              setActiveTab(view === 'donatur' ? 'donatur' : 'mutasi');
            }}
          />
        )}

        {activeTab === 'grup_wa' && (
          <TabGrupWa
            config={data.config}
            donaturList={data.donatur}
            isLoading={isLoadingAdmin}
            connectionStatus={connectionStatus}
            gasUrl={gasUrl}
            onUpdateStatusGrup={handleUpdateStatusGrup}
            onBulkUpdateStatusGrup={handleBulkUpdateStatusGrup}
            onSyncGroupMembers={handleSyncGroupMembers}
            onSendBroadcastSingle={handleSendBroadcastSingle}
            onOpenSettings={isSuperAdmin ? () => setIsModalOpen(true) : undefined}
            onNotify={notify}
          />
        )}

        {activeTab === 'broadcast' && (
          <TabBroadcast
            config={data.config}
            donaturList={data.donatur}
            transaksiList={data.transaksi}
            antreanPesan={data.antreanPesan || []}
            connectionStatus={connectionStatus}
            onSendBroadcastSingle={handleSendBroadcastSingle}
            onScheduleBroadcast={handleScheduleBroadcast}
            onProcessQueue={handleProcessQueue}
            onCancelScheduled={handleCancelScheduled}
            onNotify={notify}
          />
        )}

        {activeTab === 'akses_admin' && isSuperAdmin && (
          <TabAdminAkses
            adminAksesList={data.adminAkses || []}
            currentAdminWa={adminSession.admin.noWa}
            onSaveAdminAkses={handleSaveAdminAkses}
            onDeleteAdminAkses={handleDeleteAdminAkses}
            onNotify={notify}
          />
        )}
      </main>

      <footer className="mt-10 border-t border-slate-200/70 dark:border-slate-800 bg-white/45 dark:bg-slate-950/45">
        <div
          style={containerWidthStyle}
          className="mx-auto px-3 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"
        >
          <p className="safe-wrap text-center sm:text-left">
            <strong className="text-slate-700 dark:text-slate-200">
              {data.config.namaLembaga}
            </strong>{' '}
            · Panel {adminSession.admin.role} ({adminSession.admin.nama})
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => navigateToPublic('daftar')}
              className="font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline whitespace-nowrap cursor-pointer"
            >
              Buka Portal Donatur
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 hover:underline whitespace-nowrap cursor-pointer"
              >
                Pengaturan Lembaga, Rekening, QRIS &amp; Notifikasi
              </button>
            )}
          </div>
        </div>
      </footer>

      {isSuperAdmin && (
        <ConnectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          gasUrl={gasUrl}
          connectionStatus={connectionStatus}
          config={data.config}
          onSaveUrl={handleSaveGasUrl}
          onSavePengaturan={handleSavePengaturan}
          onTestNotification={handleTestNotification}
          onNotify={notify}
        />
      )}

      {toastOverlay}
    </div>
  );
}
