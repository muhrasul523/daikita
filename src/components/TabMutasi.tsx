import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  ArrowUpAZ,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  ReceiptText,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import {
  JenisDonatur,
  PageSizeOption,
  StatusVerifikasi,
  TransaksiDonasi,
} from '../types';
import {
  formatBulanLabel,
  formatRupiah,
  formatTanggalIndo,
  formatWADisplay,
  getCurrentYearMonth,
  sanitizeExternalUrl,
} from '../utils/formatters';
import { PaginationBar, slicePaginated } from './PaginationBar';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

interface TabMutasiProps {
  transaksiList: TransaksiDonasi[];
  isLoading: boolean;
}

type MutasiSortField =
  | 'tanggalTransfer'
  | 'waktuInput'
  | 'bulanTagihan'
  | 'namaDonatur'
  | 'nominalKomitmen'
  | 'donasiLainnya'
  | 'nominalTransfer'
  | 'statusVerifikasi';

type KategoriDanaFilter = 'Semua' | 'Komitmen' | 'Lainnya' | 'Umum';

const MUTASI_JENIS_OPTIONS: SearchableOption[] = [
  { value: 'Semua', label: 'Sumber: Semua Donatur', keywords: 'semua' },
  { value: 'Rutin', label: 'Donatur Tetap', keywords: 'tetap rutin terdaftar' },
  { value: 'Umum', label: 'Donatur Insidentil', keywords: 'insidentil umum non terdaftar hamba allah' },
];

const MUTASI_KATEGORI_OPTIONS: SearchableOption[] = [
  { value: 'Semua', label: 'Kategori Dana: Semua', keywords: 'semua' },
  { value: 'Lainnya', label: 'Ada Donasi Umum (Kelebihan)', keywords: 'donasi umum lainnya kelebihan lebih' },
  { value: 'Komitmen', label: 'Komitmen Tetap Saja', keywords: 'komitmen tetap rutin' },
  { value: 'Umum', label: 'Khusus Donatur Insidentil', keywords: 'insidentil umum non terdaftar' },
];

const MUTASI_SORT_OPTIONS: SearchableOption[] = [
  { value: 'tanggalTransfer', label: 'Urut: Tgl Transfer', keywords: 'tanggal transfer' },
  { value: 'waktuInput', label: 'Urut: Waktu Input', keywords: 'waktu input' },
  { value: 'bulanTagihan', label: 'Urut: Periode Bulan', keywords: 'bulan periode' },
  { value: 'namaDonatur', label: 'Urut: Nama Donatur', keywords: 'nama donatur' },
  { value: 'nominalTransfer', label: 'Urut: Total Transfer', keywords: 'total nominal transfer' },
  { value: 'donasiLainnya', label: 'Urut: Donasi Umum', keywords: 'donasi umum lainnya kelebihan' },
  { value: 'statusVerifikasi', label: 'Urut: Status Verifikasi', keywords: 'status verifikasi' },
];

export const TabMutasi: React.FC<TabMutasiProps> = ({ transaksiList, isLoading }) => {
  const [periodMode, setPeriodMode] = useState<'semua' | 'bulan'>('semua');
  const [mutasiMonth, setMutasiMonth] = useState(getCurrentYearMonth());
  const [statusVerifFilter, setStatusVerifFilter] = useState<'Semua' | StatusVerifikasi>('Semua');
  const [jenisFilter, setJenisFilter] = useState<'Semua' | JenisDonatur>('Semua');
  const [kategoriFilter, setKategoriFilter] = useState<KategoriDanaFilter>('Semua');
  const [mutasiSearch, setMutasiSearch] = useState('');
  const deferredMutasiSearch = useDeferredValue(mutasiSearch);
  const [mutasiSortField, setMutasiSortField] = useState<MutasiSortField>('tanggalTransfer');
  const [mutasiSortDir, setMutasiSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);
  const [previewModalTrx, setPreviewModalTrx] = useState<TransaksiDonasi | null>(null);

  const periodScopedTransaksi = useMemo(() => {
    if (periodMode === 'bulan' && /^\d{4}-\d{2}$/.test(mutasiMonth)) {
      return transaksiList.filter((t) => t.bulanTagihan === mutasiMonth);
    }
    return transaksiList;
  }, [transaksiList, periodMode, mutasiMonth]);

  const statusCounts = useMemo(
    () => ({
      Semua: periodScopedTransaksi.length,
      Valid: periodScopedTransaksi.filter((t) => t.statusVerifikasi === 'Valid').length,
      Pending: periodScopedTransaksi.filter((t) => t.statusVerifikasi === 'Pending').length,
      Ditolak: periodScopedTransaksi.filter((t) => t.statusVerifikasi === 'Ditolak').length,
    }),
    [periodScopedTransaksi]
  );

  const filteredMutasi = useMemo(() => {
    const q = deferredMutasiSearch.trim().toLowerCase();
    const filtered = periodScopedTransaksi.filter((t) => {
      const isUmum = t.jenisDonatur === 'Umum' || t.idDonatur === 'UMUM';
      const jenis: JenisDonatur = isUmum ? 'Umum' : 'Rutin';

      if (statusVerifFilter !== 'Semua' && t.statusVerifikasi !== statusVerifFilter) return false;
      if (jenisFilter !== 'Semua' && jenis !== jenisFilter) return false;

      if (kategoriFilter === 'Lainnya' && (isUmum || (t.donasiLainnya || 0) <= 0)) return false;
      if (kategoriFilter === 'Komitmen' && isUmum) return false;
      if (kategoriFilter === 'Umum' && !isUmum) return false;

      if (!q) return true;
      return (
        t.namaDonatur.toLowerCase().includes(q) ||
        t.idTransaksi.toLowerCase().includes(q) ||
        t.idDonatur.toLowerCase().includes(q) ||
        t.noWa.toLowerCase().includes(q) ||
        t.bulanTagihan.toLowerCase().includes(q) ||
        (t.keterangan || '').toLowerCase().includes(q) ||
        t.diinputOleh.toLowerCase().includes(q)
      );
    });

    const verifRank: Record<StatusVerifikasi, number> = {
      Valid: 1,
      Pending: 2,
      Ditolak: 3,
    };

    const dir = mutasiSortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (mutasiSortField) {
        case 'tanggalTransfer':
          cmp = (a.tanggalTransfer || a.waktuInput).localeCompare(
            b.tanggalTransfer || b.waktuInput
          );
          break;
        case 'waktuInput':
          cmp = a.waktuInput.localeCompare(b.waktuInput);
          break;
        case 'bulanTagihan':
          cmp = a.bulanTagihan.localeCompare(b.bulanTagihan);
          break;
        case 'namaDonatur':
          cmp = a.namaDonatur.localeCompare(b.namaDonatur, 'id');
          break;
        case 'nominalKomitmen':
          cmp = (a.nominalKomitmen || 0) - (b.nominalKomitmen || 0);
          break;
        case 'donasiLainnya':
          cmp = (a.donasiLainnya || 0) - (b.donasiLainnya || 0);
          break;
        case 'nominalTransfer':
          cmp = a.nominalTransfer - b.nominalTransfer;
          break;
        case 'statusVerifikasi':
          cmp = verifRank[a.statusVerifikasi] - verifRank[b.statusVerifikasi];
          break;
      }
      if (cmp === 0) return b.waktuInput.localeCompare(a.waktuInput);
      return cmp * dir;
    });
  }, [
    periodScopedTransaksi,
    statusVerifFilter,
    jenisFilter,
    kategoriFilter,
    deferredMutasiSearch,
    mutasiSortField,
    mutasiSortDir,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    periodMode,
    mutasiMonth,
    statusVerifFilter,
    jenisFilter,
    kategoriFilter,
    deferredMutasiSearch,
    mutasiSortField,
    mutasiSortDir,
    pageSize,
  ]);

  const paginatedMutasi = useMemo(
    () => slicePaginated(filteredMutasi, currentPage, pageSize),
    [filteredMutasi, currentPage, pageSize]
  );

  const mutasiTotals = useMemo(() => {
    let totalTransferRp = 0;
    let totalKomitmenRp = 0;
    let totalLainnyaRp = 0;
    let totalUmumRp = 0;
    let lainnyaCount = 0;
    let umumCount = 0;
    let validCount = 0;

    filteredMutasi.forEach((t) => {
      const isUmum = t.jenisDonatur === 'Umum' || t.idDonatur === 'UMUM';
      totalTransferRp += t.nominalTransfer;
      if (t.statusVerifikasi === 'Valid') validCount += 1;

      if (isUmum) {
        totalUmumRp += t.nominalTransfer;
        umumCount += 1;
      } else {
        const extra = Math.max(0, t.donasiLainnya || 0);
        const base =
          t.nominalKomitmen > 0 ? t.nominalKomitmen : Math.max(0, t.nominalTransfer - extra);
        totalKomitmenRp += base;
        totalLainnyaRp += extra;
        if (extra > 0) lainnyaCount += 1;
      }
    });

    return {
      totalTransferRp,
      totalKomitmenRp,
      totalLainnyaRp,
      totalUmumRp,
      lainnyaCount,
      umumCount,
      validCount,
      count: filteredMutasi.length,
    };
  }, [filteredMutasi]);

  const handleMutasiSort = (field: MutasiSortField) => {
    if (mutasiSortField === field) {
      setMutasiSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setMutasiSortField(field);
      setMutasiSortDir(
        field === 'namaDonatur' || field === 'statusVerifikasi' ? 'asc' : 'desc'
      );
    }
  };

  const renderSortIcon = (active: boolean, dir: 'asc' | 'desc') => {
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-60 shrink-0" />;
    return dir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 shrink-0" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 shrink-0" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Mutasi Dana Masuk
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 safe-wrap">
          Daftar seluruh dana masuk dari donatur tetap, donasi umum (kelebihan komitmen), dan
          donatur insidentil dengan filter periode bulan atau keseluruhan.
        </p>
      </div>

      {/* 4 Summary Cards Berdasarkan Filter Aktif */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-surface rounded-3xl p-5 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Dana Masuk (Sesuai Filter)
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-800 dark:text-emerald-300 tabular-nums safe-wrap">
            {formatRupiah(mutasiTotals.totalTransferRp)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
            {mutasiTotals.count} transaksi ({mutasiTotals.validCount} valid) ·{' '}
            {periodMode === 'bulan' ? formatBulanLabel(mutasiMonth) : 'Seluruh Periode'}
          </p>
        </div>

        <div className="glass-surface rounded-3xl p-5 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Donasi Komitmen Tetap
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-teal-800 dark:text-teal-300 tabular-nums safe-wrap">
            {formatRupiah(mutasiTotals.totalKomitmenRp)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
            Porsi komitmen bulanan donatur tetap terdaftar
          </p>
        </div>

        <div className="glass-surface rounded-3xl p-5 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Donasi Umum (Kelebihan)
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-sky-800 dark:text-sky-300 tabular-nums safe-wrap">
            {formatRupiah(mutasiTotals.totalLainnyaRp)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
            {mutasiTotals.lainnyaCount} transaksi melebihi nominal komitmen
          </p>
        </div>

        <div className="glass-surface rounded-3xl p-5 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Donatur Insidentil (Non-Tetap)
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-indigo-700 dark:text-indigo-300 tabular-nums safe-wrap">
            {formatRupiah(mutasiTotals.totalUmumRp)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
            {mutasiTotals.umumCount} transaksi dari donatur insidentil (non-terdaftar)
          </p>
        </div>
      </section>

      {/* Filter & Tabel Mutasi */}
      <section className="glass-surface rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-2xl bg-slate-100/85 dark:bg-slate-800/80 p-1">
                <button
                  type="button"
                  onClick={() => setPeriodMode('semua')}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    periodMode === 'semua'
                      ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Keseluruhan
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodMode('bulan')}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    periodMode === 'bulan'
                      ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Per Bulan
                </button>
              </div>

              <div className="relative flex items-center">
                <Calendar className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                <input
                  type="month"
                  aria-label="Filter mutasi berdasarkan bulan"
                  value={mutasiMonth}
                  onChange={(e) => {
                    setMutasiMonth(e.target.value);
                    setPeriodMode('bulan');
                  }}
                  className={`rounded-xl border px-3 pl-9 py-1.5 text-xs font-semibold tabular-nums focus:border-emerald-500 focus:outline-none ${
                    periodMode === 'bulan'
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100'
                      : 'border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 text-slate-600 dark:text-slate-300'
                  }`}
                />
              </div>
            </div>

            <div className="relative w-full lg:w-80 shrink-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={mutasiSearch}
                onChange={(e) => setMutasiSearch(e.target.value)}
                placeholder="Cari nama, ID transaksi, WA, keterangan..."
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100/85 dark:bg-slate-800/80 p-1.5 w-full xl:w-fit">
            {(['Semua', 'Valid', 'Pending', 'Ditolak'] as const).map((st) => {
              const active = statusVerifFilter === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusVerifFilter(st)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {st === 'Pending' ? 'Menunggu Verifikasi' : st}{' '}
                  <span className="tabular-nums opacity-75">({statusCounts[st]})</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <SearchableSelect
              ariaLabel="Filter jenis donatur"
              options={MUTASI_JENIS_OPTIONS}
              value={jenisFilter}
              onChange={(v) => setJenisFilter((v || 'Semua') as 'Semua' | JenisDonatur)}
              compact
              searchPlaceholder="Filter sumber donatur..."
            />

            <SearchableSelect
              ariaLabel="Filter kategori dana"
              options={MUTASI_KATEGORI_OPTIONS}
              value={kategoriFilter}
              onChange={(v) => setKategoriFilter((v || 'Semua') as KategoriDanaFilter)}
              compact
              searchPlaceholder="Filter kategori dana..."
            />

            <div className="flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  ariaLabel="Urutkan mutasi dana"
                  options={MUTASI_SORT_OPTIONS}
                  value={mutasiSortField}
                  onChange={(v) => setMutasiSortField((v || 'tanggalTransfer') as MutasiSortField)}
                  compact
                  searchPlaceholder="Urutkan berdasarkan..."
                />
              </div>
              <button
                type="button"
                onClick={() => setMutasiSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                title={mutasiSortDir === 'asc' ? 'Urutan Naik' : 'Urutan Turun'}
                aria-label="Ubah arah urutan mutasi"
              >
                {mutasiSortDir === 'asc' ? (
                  <ArrowUpAZ className="h-4 w-4" />
                ) : (
                  <ArrowDownAZ className="h-4 w-4" />
                )}
              </button>
            </div>
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
        ) : filteredMutasi.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <ReceiptText className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Belum Ada Data Mutasi Dana Masuk
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Tidak ada transaksi yang cocok dengan filter saat ini. Coba ubah periode atau pilihan
              filter di atas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto clean-scroll">
            <table className="w-full min-w-[940px] text-left border-collapse">
              <thead>
                <tr className="bg-emerald-800 dark:bg-emerald-950 text-white dark:text-emerald-100 text-[11px] font-semibold">
                  <th className="py-3.5 pl-5 pr-3 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleMutasiSort('tanggalTransfer')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Tgl Transfer &amp; Periode</span>
                      {renderSortIcon(mutasiSortField === 'tanggalTransfer', mutasiSortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleMutasiSort('namaDonatur')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Donatur &amp; Keterangan</span>
                      {renderSortIcon(mutasiSortField === 'namaDonatur', mutasiSortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleMutasiSort('nominalKomitmen')}
                      className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                    >
                      <span>Komitmen</span>
                      {renderSortIcon(mutasiSortField === 'nominalKomitmen', mutasiSortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleMutasiSort('donasiLainnya')}
                      className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                    >
                      <span>Donasi Umum</span>
                      {renderSortIcon(mutasiSortField === 'donasiLainnya', mutasiSortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleMutasiSort('nominalTransfer')}
                      className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                    >
                      <span>Total Masuk</span>
                      {renderSortIcon(mutasiSortField === 'nominalTransfer', mutasiSortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 pl-4 pr-5">
                    <button
                      type="button"
                      onClick={() => handleMutasiSort('statusVerifikasi')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Status &amp; Bukti</span>
                      {renderSortIcon(mutasiSortField === 'statusVerifikasi', mutasiSortDir)}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-sm">
                {paginatedMutasi.items.map((trx, index) => {
                  const isUmum = trx.jenisDonatur === 'Umum' || trx.idDonatur === 'UMUM';
                  const hasWa = Boolean(trx.noWa && trx.noWa !== '-');
                  const externalUrl = sanitizeExternalUrl(trx.linkBuktiDrive);
                  const hasLocalDataUrl = trx.linkBuktiDrive.startsWith('data:');

                  const extraRp = isUmum ? 0 : Math.max(0, trx.donasiLainnya || 0);
                  const komitmenRp = isUmum
                    ? 0
                    : trx.nominalKomitmen > 0
                    ? trx.nominalKomitmen
                    : Math.max(0, trx.nominalTransfer - extraRp);

                  return (
                    <tr
                      key={trx.idTransaksi}
                      className="odd:bg-white/90 even:bg-emerald-50/55 dark:odd:bg-slate-900/75 dark:even:bg-slate-800/65 hover:bg-teal-50/80 dark:hover:bg-emerald-950/45 transition-colors align-top"
                    >
                      <td className="py-3.5 pl-5 pr-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                        {paginatedMutasi.startIndex + index + 1}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {trx.tanggalTransfer
                            ? formatTanggalIndo(trx.tanggalTransfer)
                            : trx.waktuInput.split(',')[0]}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-teal-700 dark:text-teal-300">
                          {formatBulanLabel(trx.bulanTagihan)}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                          {trx.idTransaksi}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 min-w-0 max-w-[260px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 safe-wrap">
                            {trx.namaDonatur}
                          </p>
                          <span
                            className={`text-[10px] font-bold ${
                              isUmum
                                ? 'text-sky-700 dark:text-sky-300'
                                : 'text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            · {isUmum ? 'Donatur Insidentil' : 'Donatur Tetap'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 tabular-nums safe-wrap">
                          {hasWa ? formatWADisplay(trx.noWa) : 'Tanpa nomor WA'}
                          {!isUmum && trx.idDonatur && trx.idDonatur !== '-'
                            ? ` · ${trx.idDonatur}`
                            : ''}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                          Oleh: {trx.diinputOleh || 'Donatur (Mandiri)'}
                        </p>
                        {trx.keterangan && (
                          <p className="mt-1 text-[11px] text-teal-800 dark:text-teal-300 bg-teal-50/70 dark:bg-teal-950/40 rounded-lg px-2 py-1 safe-wrap">
                            Ket: {trx.keterangan}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap tabular-nums">
                        {isUmum ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {formatRupiah(komitmenRp)}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap tabular-nums">
                        {isUmum ? (
                          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                            Insidentil
                          </span>
                        ) : extraRp > 0 ? (
                          <span className="text-xs font-bold text-sky-700 dark:text-sky-300">
                            +{formatRupiah(extraRp)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">Rp 0</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap tabular-nums">
                        <p className="font-bold text-emerald-800 dark:text-emerald-300">
                          {formatRupiah(trx.nominalTransfer)}
                        </p>
                      </td>

                      <td className="py-3.5 pl-4 pr-5 whitespace-nowrap space-y-1.5">
                        <div>
                          {trx.statusVerifikasi === 'Valid' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span>Valid</span>
                            </span>
                          )}
                          {trx.statusVerifikasi === 'Pending' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span>Pending</span>
                            </span>
                          )}
                          {trx.statusVerifikasi === 'Ditolak' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                              <XCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>Ditolak</span>
                            </span>
                          )}
                        </div>

                        {externalUrl && (
                          <a
                            href={externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span>Lihat Bukti</span>
                          </a>
                        )}
                        {hasLocalDataUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewModalTrx(trx)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5 shrink-0" />
                            <span>Lihat Pratinjau</span>
                          </button>
                        )}
                        {!externalUrl && !hasLocalDataUrl && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            Tanpa bukti
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && filteredMutasi.length > 0 && (
          <PaginationBar
            totalItems={filteredMutasi.length}
            currentPage={paginatedMutasi.safePage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setCurrentPage(1);
            }}
            itemLabel="mutasi"
          />
        )}
      </section>

      {/* Modal Pratinjau Bukti Lokal */}
      {previewModalTrx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="glass-surface w-full max-w-xl rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200/70 dark:border-slate-700/70">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  Bukti Transfer — {previewModalTrx.namaDonatur}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {previewModalTrx.idTransaksi} · {formatRupiah(previewModalTrx.nominalTransfer)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalTrx(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                aria-label="Tutup pratinjau"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-50/70 dark:bg-slate-950/60">
              {previewModalTrx.linkBuktiDrive.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewModalTrx.linkBuktiDrive}
                  title="Pratinjau PDF Bukti Transfer"
                  className="w-full h-[60vh] rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
                />
              ) : (
                <img
                  src={previewModalTrx.linkBuktiDrive}
                  alt={`Bukti transfer ${previewModalTrx.namaDonatur}`}
                  className="max-h-[65vh] w-auto rounded-xl object-contain shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
