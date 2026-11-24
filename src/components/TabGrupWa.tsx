import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageCircle,
  Search,
  Send,
  Settings2,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import {
  Donatur,
  LembagaConfig,
  MinatGrupWa,
  Panitia,
  SendBroadcastSinglePayload,
  StatusGrupWa,
} from '../types';
import {
  buildGroupInviteMessage,
  buildWaMeUrl,
  formatWADisplay,
  normalizeMinatGrup,
  normalizeStatusGrup,
} from '../utils/formatters';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

interface TabGrupWaProps {
  config: LembagaConfig;
  donaturList: Donatur[];
  panitiaList: Panitia[];
  isLoading: boolean;
  connectionStatus: 'connected' | 'local' | 'error';
  onUpdateStatusGrup: (
    idDonatur: string,
    statusGrupWa: StatusGrupWa,
    minatGrupWa?: MinatGrupWa
  ) => Promise<boolean>;
  onBulkUpdateStatusGrup: (ids: string[], statusGrupWa: StatusGrupWa) => Promise<boolean>;
  onSendBroadcastSingle: (
    payload: SendBroadcastSinglePayload
  ) => Promise<{ ok: boolean; detail: string }>;
  onOpenSettings: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

type GroupFilterKey =
  | 'semua'
  | 'minat_belum'
  | 'sudah_gabung'
  | 'minat_ya'
  | 'tidak_minat';

type GroupSortField = 'nama' | 'daftar' | 'minat' | 'status' | 'perantara';

export const TabGrupWa: React.FC<TabGrupWaProps> = ({
  config,
  donaturList,
  panitiaList,
  isLoading,
  connectionStatus,
  onUpdateStatusGrup,
  onBulkUpdateStatusGrup,
  onSendBroadcastSingle,
  onOpenSettings,
  onNotify,
}) => {
  const [groupFilter, setGroupFilter] = useState<GroupFilterKey>('minat_belum');
  const [genderFilter, setGenderFilter] = useState<'Semua' | 'Laki-laki' | 'Perempuan'>('Semua');
  const [perantaraFilter, setPerantaraFilter] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<GroupSortField>('daftar');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sendingWaId, setSendingWaId] = useState<string | null>(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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

  const perantaraOptions = useMemo<SearchableOption[]>(() => {
    const set = new Set<string>();
    panitiaList.forEach((p) => set.add(p.namaPanitia));
    normalizedDonors.forEach((d) => {
      if (d.namaPerantara) set.add(d.namaPerantara);
    });
    return [
      { value: 'Semua', label: 'Perantara: Semua', keywords: 'semua' },
      ...Array.from(set).map((name) => ({
        value: name,
        label: name,
        keywords: name,
      })),
    ];
  }, [panitiaList, normalizedDonors]);

  const filteredDonors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
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
      if (perantaraFilter !== 'Semua' && d.namaPerantara !== perantaraFilter) return false;

      if (!q) return true;
      return (
        d.namaLengkap.toLowerCase().includes(q) ||
        d.idDonatur.toLowerCase().includes(q) ||
        d.noWa.toLowerCase().includes(q) ||
        (d.domisili || '').toLowerCase().includes(q) ||
        (d.namaPerantara || '').toLowerCase().includes(q)
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
        case 'perantara':
          cmp = (a.namaPerantara || '').localeCompare(b.namaPerantara || '', 'id');
          break;
      }
      if (cmp === 0) return a.namaLengkap.localeCompare(b.namaLengkap, 'id');
      return cmp * dir;
    });
  }, [
    normalizedDonors,
    groupFilter,
    genderFilter,
    perantaraFilter,
    searchQuery,
    sortField,
    sortDir,
  ]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Pantauan Grup WhatsApp Donatur
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 safe-wrap">
            Pantau donatur yang berminat bergabung ke grup WhatsApp, tandai yang sudah bergabung,
            dan kirimkan undangan grup secara cepat.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white/90 dark:bg-slate-800/90 px-4 py-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Settings2 className="h-4 w-4 shrink-0" />
          <span>Atur Link &amp; Info Grup</span>
        </button>
      </div>

      {/* Info Grup WA Aktif */}
      <section className="glass-surface rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 safe-wrap">
              {config.waGroupName || 'Grup Donatur DAIKITA — Kafalah Dai'}
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 safe-wrap">
              {config.waGroupLink ? (
                <span className="font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
                  {config.waGroupLink}
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  Link undangan grup WhatsApp belum diatur. Klik &ldquo;Atur Link &amp; Info Grup&rdquo;
                  untuk mengisi tautan grup resmi.
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

              <div className="w-56">
                <SearchableSelect
                  ariaLabel="Filter perantara"
                  options={perantaraOptions}
                  value={perantaraFilter}
                  onChange={(val) => setPerantaraFilter(val || 'Semua')}
                  compact
                />
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
            <table className="w-full min-w-[960px] text-left border-collapse">
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
                  <th className="py-3.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort('perantara')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Perantara</span>
                      {renderSortIcon('perantara')}
                    </button>
                  </th>
                  <th className="py-3.5 pl-3 pr-5 text-right">Tindakan &amp; Undangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-sm">
                {filteredDonors.map((d) => {
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
                      <td className="py-4 px-3 min-w-0 max-w-[180px] text-xs text-slate-600 dark:text-slate-300 safe-wrap">
                        {d.namaPerantara || 'Langsung'}
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
      </section>
    </div>
  );
};
