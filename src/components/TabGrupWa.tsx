import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Upload,
  UserCheck,
  UserX,
  Users,
  Webhook,
} from 'lucide-react';
import {
  Donatur,
  LembagaConfig,
  MinatGrupWa,
  PageSizeOption,
  SendBroadcastSinglePayload,
  StatusGrupWa,
  SyncGroupMembersResult,
} from '../types';
import {
  buildGroupInviteMessage,
  buildWaMeUrl,
  extractPhoneNumbersFromText,
  formatWADisplay,
  normalizeMinatGrup,
  normalizeStatusGrup,
} from '../utils/formatters';
import { PaginationBar, slicePaginated } from './PaginationBar';

interface TabGrupWaProps {
  config: LembagaConfig;
  donaturList: Donatur[];
  isLoading: boolean;
  connectionStatus: 'connected' | 'local' | 'error';
  gasUrl?: string;
  onUpdateStatusGrup: (
    idDonatur: string,
    statusGrupWa: StatusGrupWa,
    minatGrupWa?: MinatGrupWa
  ) => Promise<boolean>;
  onBulkUpdateStatusGrup: (ids: string[], statusGrupWa: StatusGrupWa) => Promise<boolean>;
  onSyncGroupMembers: (options?: {
    memberPhones?: string[];
    markOthersNotJoined?: boolean;
  }) => Promise<{ ok: boolean; message: string; result?: SyncGroupMembersResult }>;
  onSendBroadcastSingle: (
    payload: SendBroadcastSinglePayload
  ) => Promise<{ ok: boolean; detail: string }>;
  onOpenSettings?: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

type GroupFilterKey =
  | 'semua'
  | 'minat_belum'
  | 'sudah_gabung'
  | 'minat_ya'
  | 'tidak_minat';

type GroupSortField = 'nama' | 'daftar' | 'minat' | 'status';

export const TabGrupWa: React.FC<TabGrupWaProps> = ({
  config,
  donaturList,
  isLoading,
  connectionStatus,
  gasUrl,
  onUpdateStatusGrup,
  onBulkUpdateStatusGrup,
  onSyncGroupMembers,
  onSendBroadcastSingle,
  onOpenSettings,
  onNotify,
}) => {
  const [groupFilter, setGroupFilter] = useState<GroupFilterKey>('minat_belum');
  const [genderFilter, setGenderFilter] = useState<'Semua' | 'Laki-laki' | 'Perempuan'>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [sortField, setSortField] = useState<GroupSortField>('daftar');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sendingWaId, setSendingWaId] = useState<string | null>(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // State Deteksi Otomatis Anggota Grup WA
  const [isSyncingApi, setIsSyncingApi] = useState(false);
  const [showScrabPanel, setShowScrabPanel] = useState(false);
  const [showWebhookTip, setShowWebhookTip] = useState(false);
  const [scrabText, setScrabText] = useState('');
  const [markOthersNotJoined, setMarkOthersNotJoined] = useState(false);
  const [isSyncingScrab, setIsSyncingScrab] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [lastSyncBanner, setLastSyncBanner] = useState<{
    ok: boolean;
    message: string;
    result?: SyncGroupMembersResult;
  } | null>(null);

  const extractedScrabPhones = useMemo(
    () => extractPhoneNumbersFromText(scrabText),
    [scrabText]
  );

  const normalizedDonors = useMemo(
    () =>
      donaturList.map((d) => ({
        ...d,
        minatGrupWa: normalizeMinatGrup(d.minatGrupWa),
        statusGrupWa: normalizeStatusGrup(d.statusGrupWa),
      })),
    [donaturList]
  );

  const metrics = useMemo(() => {
    const total = normalizedDonors.length;
    const minatYa = normalizedDonors.filter((d) => d.minatGrupWa === 'Ya').length;
    const sudahGabung = normalizedDonors.filter(
      (d) => d.statusGrupWa === 'Sudah Bergabung'
    ).length;
    const minatBelum = normalizedDonors.filter(
      (d) => d.minatGrupWa === 'Ya' && d.statusGrupWa !== 'Sudah Bergabung'
    ).length;
    const tidakMinat = normalizedDonors.filter((d) => d.minatGrupWa === 'Tidak').length;
    return { total, minatYa, sudahGabung, minatBelum, tidakMinat };
  }, [normalizedDonors]);

  const filteredDonors = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    const list = normalizedDonors.filter((d) => {
      if (groupFilter === 'minat_belum') {
        if (!(d.minatGrupWa === 'Ya' && d.statusGrupWa !== 'Sudah Bergabung')) return false;
      } else if (groupFilter === 'sudah_gabung') {
        if (d.statusGrupWa !== 'Sudah Bergabung') return false;
      } else if (groupFilter === 'minat_ya') {
        if (d.minatGrupWa !== 'Ya') return false;
      } else if (groupFilter === 'tidak_minat') {
        if (d.minatGrupWa !== 'Tidak') return false;
      }

      if (genderFilter !== 'Semua' && d.jenisKelamin !== genderFilter) return false;

      if (!q) return true;
      return (
        d.namaLengkap.toLowerCase().includes(q) ||
        d.idDonatur.toLowerCase().includes(q) ||
        d.noWa.toLowerCase().includes(q) ||
        (d.domisili || '').toLowerCase().includes(q)
      );
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'nama':
          cmp = a.namaLengkap.localeCompare(b.namaLengkap, 'id');
          break;
        case 'daftar':
          cmp = (a.tanggalDaftar || '').localeCompare(b.tanggalDaftar || '');
          break;
        case 'minat':
          cmp = (a.minatGrupWa || 'Ya').localeCompare(b.minatGrupWa || 'Ya', 'id');
          break;
        case 'status':
          cmp = (a.statusGrupWa || 'Belum Bergabung').localeCompare(
            b.statusGrupWa || 'Belum Bergabung',
            'id'
          );
          break;
      }
      if (cmp === 0) return a.namaLengkap.localeCompare(b.namaLengkap, 'id');
      return cmp * dir;
    });
  }, [
    normalizedDonors,
    groupFilter,
    genderFilter,
    deferredSearchQuery,
    sortField,
    sortDir,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [groupFilter, genderFilter, deferredSearchQuery, sortField, sortDir, pageSize]);

  const paginatedDonors = useMemo(
    () => slicePaginated(filteredDonors, currentPage, pageSize),
    [filteredDonors, currentPage, pageSize]
  );

  const allFilteredSelected =
    filteredDonors.length > 0 && filteredDonors.every((d) => selectedIds.includes(d.idDonatur));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const visibleSet = new Set(filteredDonors.map((d) => d.idDonatur));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filteredDonors.map((d) => d.idDonatur)]);
      setSelectedIds(Array.from(merged));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSort = (field: GroupSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'daftar' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (field: GroupSortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-60 shrink-0" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 shrink-0" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 shrink-0" />
    );
  };

  const handleCopyGroupLink = async () => {
    if (!config.waGroupLink) {
      onNotify('info', 'Tautan Grup WA belum diatur', 'Silakan isi link grup di menu Pengaturan.');
      return;
    }
    try {
      await navigator.clipboard.writeText(config.waGroupLink);
      setCopiedLink(true);
      onNotify('success', 'Link Grup WA disalin', config.waGroupLink);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      onNotify('error', 'Gagal menyalin link grup.');
    }
  };

  const handleToggleRowStatus = async (d: Donatur) => {
    const nextStatus: StatusGrupWa =
      normalizeStatusGrup(d.statusGrupWa) === 'Sudah Bergabung'
        ? 'Belum Bergabung'
        : 'Sudah Bergabung';
    setUpdatingId(d.idDonatur);
    await onUpdateStatusGrup(d.idDonatur, nextStatus);
    setUpdatingId(null);
  };

  const handleToggleRowMinat = async (d: Donatur) => {
    const nextMinat: MinatGrupWa = normalizeMinatGrup(d.minatGrupWa) === 'Ya' ? 'Tidak' : 'Ya';
    setUpdatingId(d.idDonatur);
    await onUpdateStatusGrup(d.idDonatur, normalizeStatusGrup(d.statusGrupWa), nextMinat);
    setUpdatingId(null);
  };

  const handleBulkAction = async (status: StatusGrupWa) => {
    if (selectedIds.length === 0) return;
    setIsBulkSaving(true);
    const ok = await onBulkUpdateStatusGrup(selectedIds, status);
    setIsBulkSaving(false);
    if (ok) {
      setSelectedIds([]);
    }
  };

  const handleCopyInvite = async (d: Donatur) => {
    const text = buildGroupInviteMessage(d, config);
    try {
      await navigator.clipboard.writeText(text);
      onNotify('success', `Teks undangan untuk ${d.namaLengkap} disalin`);
    } catch {
      onNotify('error', 'Gagal menyalin pesan undangan.');
    }
  };

  const handleSendAutoInvite = async (d: Donatur) => {
    if (!config.waGroupLink) {
      onNotify(
        'error',
        'Link Grup WA belum diisi',
        'Atur tautan Grup WA Donatur terlebih dahulu di menu Pengaturan → WA & Email.'
      );
      return;
    }
    const text = buildGroupInviteMessage(d, config);
    setSendingWaId(d.idDonatur);
    const res = await onSendBroadcastSingle({
      idDonatur: d.idDonatur,
      namaDonatur: d.namaLengkap,
      noWa: d.noWa,
      messageText: text,
      jenisPesan: 'Undangan Grup WA',
    });
    setSendingWaId(null);
    if (res.ok) {
      onNotify('success', `Undangan WA terkirim ke ${d.namaLengkap}`, res.detail);
    } else {
      onNotify('error', `Gagal kirim WA ke ${d.namaLengkap}`, res.detail);
    }
  };

  const handleAutoSyncApi = async () => {
    setIsSyncingApi(true);
    setLastSyncBanner(null);
    const res = await onSyncGroupMembers({ markOthersNotJoined });
    setIsSyncingApi(false);
    setLastSyncBanner(res);
    if (!res.ok) {
      setShowScrabPanel(true);
    }
  };

  const handleScrabFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setScrabText(content);
      const count = extractPhoneNumbersFromText(content).length;
      onNotify(
        count > 0 ? 'success' : 'info',
        count > 0
          ? `${count} nomor WA terbaca dari ${file.name}`
          : `Tidak ditemukan nomor WA valid di ${file.name}`
      );
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSyncFromScrab = async () => {
    if (extractedScrabPhones.length === 0) {
      onNotify(
        'error',
        'Belum ada nomor WA valid',
        'Tempel hasil Scrab Nomor dari ReChat atau unggah file .txt/.csv terlebih dahulu.'
      );
      return;
    }
    setIsSyncingScrab(true);
    setLastSyncBanner(null);
    const res = await onSyncGroupMembers({
      memberPhones: extractedScrabPhones,
      markOthersNotJoined,
    });
    setIsSyncingScrab(false);
    setLastSyncBanner(res);
    if (res.ok) {
      setScrabText('');
    }
  };

  const handleCopyWebhookUrl = async () => {
    if (!gasUrl) return;
    try {
      await navigator.clipboard.writeText(gasUrl);
      setCopiedWebhookUrl(true);
      onNotify('success', 'URL Webhook disalin', 'Tempelkan di ReChat → Integrasi → Webhook.');
      setTimeout(() => setCopiedWebhookUrl(false), 2000);
    } catch {
      onNotify('error', 'Gagal menyalin URL Webhook.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Pantauan Grup WhatsApp Donatur
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 safe-wrap">
            Deteksi otomatis donatur yang sudah bergabung ke grup WhatsApp melalui sinkronisasi
            ReChat, webhook grup, atau cocokkan hasil Scrab Nomor secara instan.
          </p>
        </div>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white/90 dark:bg-slate-800/90 px-4 py-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Settings2 className="h-4 w-4 shrink-0" />
            <span>Atur Link &amp; Info Grup</span>
          </button>
        )}
      </div>

      {/* Info Grup WA Aktif */}
      <section className="glass-surface rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 safe-wrap">
              {config.waGroupName || 'Grup Donatur DAIKITA — Dakwah Pelosok'}
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 safe-wrap">
              {config.waGroupLink ? (
                <span className="font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
                  {config.waGroupLink}
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  {onOpenSettings
                    ? 'Link undangan grup WhatsApp belum diatur. Klik "Atur Link & Info Grup" untuk mengisi tautan grup resmi.'
                    : 'Link undangan grup WhatsApp belum diatur oleh Super Admin.'}
                </span>
              )}
            </p>
            {config.waGroupId && (
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono safe-wrap">
                ID Grup: {config.waGroupId}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void handleCopyGroupLink()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300 transition-colors whitespace-nowrap cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 shrink-0" />
                <span>Salin Link Grup</span>
              </>
            )}
          </button>
          {config.waGroupLink && (
            <a
              href={config.waGroupLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span>Buka Grup WA</span>
            </a>
          )}
        </div>
      </section>

      {/* Panel Deteksi Otomatis Anggota Grup WA */}
      <section className="glass-surface rounded-3xl p-5 sm:p-6 space-y-4 border border-emerald-200/80 dark:border-emerald-800/70">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Deteksi Otomatis Anggota Grup WhatsApp
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 safe-wrap">
                Tidak perlu menandai satu per satu. Sistem mendeteksi anggota grup secara otomatis
                melalui API ReChat, Webhook Real-Time, atau pencocokan massal dari fitur{' '}
                <strong>Kontak → Scrab Nomor</strong> ReChat.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSyncingApi || connectionStatus !== 'connected'}
              onClick={() => void handleAutoSyncApi()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isSyncingApi ? 'animate-spin' : ''}`} />
              <span>{isSyncingApi ? 'Mendeteksi...' : 'Deteksi Otomatis via API'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowScrabPanel((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                showScrabPanel
                  ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-300'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
              <span>Cocokkan Scrab Nomor</span>
            </button>

            <button
              type="button"
              onClick={() => setShowWebhookTip((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                showWebhookTip
                  ? 'border-sky-400 bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-sky-300'
              }`}
            >
              <Webhook className="h-3.5 w-3.5 shrink-0" />
              <span>Webhook Real-Time</span>
            </button>
          </div>
        </div>

        {lastSyncBanner && (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs space-y-1 safe-wrap ${
              lastSyncBanner.ok
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/45 text-emerald-900 dark:text-emerald-100'
                : 'border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/45 text-amber-900 dark:text-amber-100'
            }`}
          >
            <p className="font-bold">{lastSyncBanner.message}</p>
            {lastSyncBanner.result && (
              <p className="text-[11px] opacity-90 tabular-nums">
                Terbaca di grup: <strong>{lastSyncBanner.result.totalExtracted}</strong> nomor ·
                Cocok dengan donatur: <strong>{lastSyncBanner.result.matchedDonors}</strong> ·
                Baru ditandai bergabung: <strong>{lastSyncBanner.result.newlyJoined}</strong>
                {lastSyncBanner.result.newlyNotJoined > 0
                  ? ` · Ditandai belum gabung: ${lastSyncBanner.result.newlyNotJoined}`
                  : ''}
              </p>
            )}
          </div>
        )}

        {showScrabPanel && (
          <div className="rounded-2xl border border-teal-200/80 dark:border-teal-800/70 bg-teal-50/45 dark:bg-teal-950/30 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-teal-950 dark:text-teal-100">
                  Pencocokan Instan dari ReChat → Kontak → Scrab Nomor
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 safe-wrap">
                  Salin seluruh daftar nomor anggota grup dari menu <strong>Scrab Nomor</strong> di
                  ReChat (format bebas: dipisah baris, koma, CSV, atau teks mentah) lalu tempel di
                  bawah atau unggah file `.txt`/`.csv`.
                </p>
              </div>
              <label className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-200 hover:bg-teal-50 cursor-pointer shrink-0">
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span>Unggah .txt / .csv</span>
                <input
                  type="file"
                  accept=".txt,.csv,text/plain,text/csv"
                  onChange={handleScrabFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              rows={4}
              value={scrabText}
              onChange={(e) => setScrabText(e.target.value)}
              placeholder={'Tempel daftar nomor anggota grup di sini, contoh:\n6281234567890\n085211223344, +62 813-9988-7766'}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-teal-900 dark:text-teal-200 tabular-nums">
                  Nomor WA valid terdeteksi: <strong>{extractedScrabPhones.length}</strong> nomor
                </p>
                <label className="inline-flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markOthersNotJoined}
                    onChange={(e) => setMarkOthersNotJoined(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span>
                    Tandai donatur yang tidak ada dalam daftar sebagai &ldquo;Belum Bergabung&rdquo;
                  </span>
                </label>
              </div>

              <button
                type="button"
                disabled={isSyncingScrab || extractedScrabPhones.length === 0}
                onClick={() => void handleSyncFromScrab()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {isSyncingScrab
                    ? 'Mencocokkan...'
                    : `Cocokkan & Perbarui (${extractedScrabPhones.length})`}
                </span>
              </button>
            </div>
          </div>
        )}

        {showWebhookTip && (
          <div className="rounded-2xl border border-sky-200/80 dark:border-sky-800/70 bg-sky-50/45 dark:bg-sky-950/30 p-4 space-y-2.5 text-xs">
            <p className="font-bold text-sky-950 dark:text-sky-100">
              Deteksi Real-Time Otomatis via Webhook ReChat
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
              Pastikan <strong>ID Grup WA Donatur</strong> sudah diisi di menu Pengaturan (format{' '}
              <code className="font-mono">120363...@g.us</code>), lalu daftarkan URL layanan di
              bawah ini ke menu <strong>ReChat → Integrasi → Webhook</strong> (centang{' '}
              <em>Pesan masuk</em>). Setiap donatur yang bergabung atau mengirim pesan di grup akan
              otomatis ditandai <strong>Sudah Bergabung</strong> tanpa klik manual.
            </p>
            {gasUrl && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <code className="flex-1 rounded-xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-mono text-sky-900 dark:text-sky-200 break-all">
                  {gasUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyWebhookUrl()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedWebhookUrl ? (
                    <>
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 shrink-0" />
                      <span>Salin URL Webhook</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 5 Kartu Ringkasan KPI */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="glass-surface rounded-2xl p-4 min-w-0">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Donatur</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {metrics.total}
          </p>
        </div>
        <div className="glass-surface rounded-2xl p-4 min-w-0">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Minat Gabung (Ya)
          </p>
          <p className="mt-1.5 text-2xl font-bold text-teal-700 dark:text-teal-300 tabular-nums">
            {metrics.minatYa}
          </p>
        </div>
        <div className="glass-surface rounded-2xl p-4 min-w-0">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Sudah Bergabung
          </p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
            {metrics.sudahGabung}
          </p>
        </div>
        <div className="glass-surface rounded-2xl p-4 min-w-0 border border-amber-200/80 dark:border-amber-800/60">
          <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
            Minat · Belum Gabung
          </p>
          <p className="mt-1.5 text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">
            {metrics.minatBelum}
          </p>
        </div>
        <div className="glass-surface rounded-2xl p-4 min-w-0 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Tidak Minat (Japri)
          </p>
          <p className="mt-1.5 text-2xl font-bold text-slate-600 dark:text-slate-300 tabular-nums">
            {metrics.tidakMinat}
          </p>
        </div>
      </section>

      {/* Tabel Donatur & Filter Grup WA */}
      <section className="glass-surface rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100/85 dark:bg-slate-800/80 p-1.5 w-full xl:w-fit">
              {(
                [
                  { key: 'minat_belum', label: `Minat Belum Gabung (${metrics.minatBelum})` },
                  { key: 'sudah_gabung', label: `Sudah Bergabung (${metrics.sudahGabung})` },
                  { key: 'minat_ya', label: `Semua Minat (${metrics.minatYa})` },
                  { key: 'tidak_minat', label: `Tidak Minat (${metrics.tidakMinat})` },
                  { key: 'semua', label: `Semua (${metrics.total})` },
                ] as const
              ).map((tab) => {
                const active = groupFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setGroupFilter(tab.key)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full xl:w-72 shrink-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, ID, nomor WA..."
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div
                role="radiogroup"
                aria-label="Filter gender"
                className="inline-flex items-center gap-1 rounded-xl bg-slate-100/85 dark:bg-slate-800/80 p-1"
              >
                {(['Semua', 'Laki-laki', 'Perempuan'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenderFilter(g)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      genderFilter === g
                        ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {g === 'Semua' ? 'Semua Gender' : g}
                  </button>
                ))}
              </div>

            </div>

            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/75 dark:bg-emerald-950/50 px-3.5 py-2">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 tabular-nums">
                  {selectedIds.length} dipilih
                </span>
                <button
                  type="button"
                  disabled={isBulkSaving}
                  onClick={() => void handleBulkAction('Sudah Bergabung')}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  <UserCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>Tandai Sudah Bergabung</span>
                </button>
                <button
                  type="button"
                  disabled={isBulkSaving}
                  onClick={() => void handleBulkAction('Belum Bergabung')}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  <UserX className="h-3.5 w-3.5 shrink-0" />
                  <span>Tandai Belum Bergabung</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 animate-pulse"
              />
            ))}
          </div>
        ) : filteredDonors.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Tidak Ada Donatur di Kategori Ini
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Ubah filter di atas untuk melihat daftar donatur lainnya.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto clean-scroll">
            <table className="w-full min-w-[820px] text-left border-collapse">
              <thead>
                <tr className="bg-emerald-800 dark:bg-emerald-950 text-white dark:text-emerald-100 text-[11px] font-semibold">
                  <th className="py-3.5 pl-5 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      aria-label="Pilih semua donatur tampil"
                      className="rounded accent-emerald-400 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort('nama')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Donatur &amp; Kontak</span>
                      {renderSortIcon('nama')}
                    </button>
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('daftar')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Tgl Terdaftar</span>
                      {renderSortIcon('daftar')}
                    </button>
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('minat')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Minat Grup WA</span>
                      {renderSortIcon('minat')}
                    </button>
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('status')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Status Bergabung</span>
                      {renderSortIcon('status')}
                    </button>
                  </th>
                  <th className="py-3.5 pl-3 pr-5 text-right">Tindakan &amp; Undangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-sm">
                {paginatedDonors.items.map((d) => {
                  const isChecked = selectedIds.includes(d.idDonatur);
                  const isBusy = updatingId === d.idDonatur;
                  const isSending = sendingWaId === d.idDonatur;
                  const joined = d.statusGrupWa === 'Sudah Bergabung';
                  const inviteMsg = buildGroupInviteMessage(d, config);
                  const waMeHref = buildWaMeUrl(d.noWa, inviteMsg);

                  return (
                    <tr
                      key={d.idDonatur}
                      className="odd:bg-white/90 even:bg-emerald-50/45 dark:odd:bg-slate-900/75 dark:even:bg-slate-800/60 hover:bg-teal-50/80 dark:hover:bg-emerald-950/45 transition-colors align-top"
                    >
                      <td className="py-4 pl-5 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(d.idDonatur)}
                          aria-label={`Pilih ${d.namaLengkap}`}
                          className="rounded accent-emerald-600 cursor-pointer"
                        />
                      </td>
                      <td className="py-4 px-3 min-w-0 max-w-[230px]">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 safe-wrap">
                          {d.namaLengkap}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                          {formatWADisplay(d.noWa)}
                          {d.jenisKelamin ? ` · ${d.jenisKelamin}` : ''}
                        </p>
                        <p className="mt-0.5 text-[11px] font-mono text-slate-400 dark:text-slate-500">
                          {d.idDonatur}
                          {d.domisili ? ` · ${d.domisili}` : ''}
                        </p>
                      </td>
                      <td className="py-4 px-3 whitespace-nowrap text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                        {d.tanggalDaftar ? d.tanggalDaftar.split(',')[0] : '-'}
                      </td>
                      <td className="py-4 px-3 whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`text-xs font-semibold ${
                              d.minatGrupWa === 'Ya'
                                ? 'text-teal-700 dark:text-teal-300'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {d.minatGrupWa === 'Ya' ? 'Ya (Bersedia)' : 'Tidak (Japri)'}
                          </span>
                          <div>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleToggleRowMinat(d)}
                              className="text-[11px] font-medium text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline cursor-pointer"
                            >
                              Ubah ke {d.minatGrupWa === 'Ya' ? 'Tidak' : 'Ya'}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-3 whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                              joined
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {joined ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <Users className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span>{d.statusGrupWa}</span>
                          </span>
                          <div>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleToggleRowStatus(d)}
                              className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 hover:underline disabled:opacity-50 cursor-pointer"
                            >
                              {isBusy
                                ? 'Menyimpan...'
                                : joined
                                ? 'Tandai Belum Bergabung'
                                : 'Tandai Sudah Bergabung'}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pl-3 pr-5 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleCopyInvite(d)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300 whitespace-nowrap cursor-pointer"
                            title="Salin teks undangan grup WA"
                          >
                            <Copy className="h-3.5 w-3.5 shrink-0" />
                            <span>Salin</span>
                          </button>
                          <a
                            href={waMeHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/85 dark:bg-emerald-950/60 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 whitespace-nowrap"
                            title="Buka wa.me di tab baru dengan teks undangan"
                          >
                            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>wa.me</span>
                          </a>
                          {connectionStatus === 'connected' && (
                            <button
                              type="button"
                              disabled={isSending}
                              onClick={() => void handleSendAutoInvite(d)}
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                              title="Kirim undangan otomatis via WhatsApp Broadcast"
                            >
                              <Send className="h-3.5 w-3.5 shrink-0" />
                              <span>{isSending ? 'Mengirim...' : 'Kirim WA'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && filteredDonors.length > 0 && (
          <PaginationBar
            totalItems={filteredDonors.length}
            currentPage={paginatedDonors.safePage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setCurrentPage(1);
            }}
            itemLabel="donatur"
          />
        )}
      </section>
    </div>
  );
};
