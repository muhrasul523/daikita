import React, { useMemo, useState } from 'react';
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
  FileCheck2,
  MessageCircle,
  Search,
  Send,
  X,
  XCircle,
} from 'lucide-react';
import {
  LembagaConfig,
  StatusPenyaluran,
  StatusVerifikasi,
  TransaksiDonasi,
} from '../types';
import {
  buildReceiptWaLink,
  formatBulanLabel,
  formatRupiah,
  formatWADisplay,
  getCurrentYearMonth,
} from '../utils/formatters';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

interface TabVerifikasiProps {
  config: LembagaConfig;
  transaksiList: TransaksiDonasi[];
  isLoading: boolean;
  onVerifikasi: (idTransaksi: string, status: StatusVerifikasi) => Promise<boolean>;
  onUpdateStatusPenyaluran: (
    idTransaksi: string,
    statusPenyaluran: StatusPenyaluran
  ) => Promise<boolean>;
}

type TrxSortField =
  | 'waktu'
  | 'nominal'
  | 'bulan'
  | 'nama'
  | 'statusVerifikasi'
  | 'statusPenyaluran';

const SALUR_FILTER_OPTIONS: SearchableOption[] = [
  { value: 'Semua', label: 'Penyaluran: Semua', keywords: 'semua' },
  { value: 'Sudah Disalurkan', label: 'Sudah Disalurkan', keywords: 'sudah disalurkan' },
  { value: 'Belum Disalurkan', label: 'Belum Disalurkan', keywords: 'belum disalurkan' },
];

const SORT_OPTIONS: SearchableOption[] = [
  { value: 'waktu', label: 'Urut: Waktu Input', keywords: 'waktu tanggal input' },
  { value: 'nama', label: 'Urut: Nama Donatur', keywords: 'nama donatur' },
  { value: 'nominal', label: 'Urut: Nominal', keywords: 'nominal rupiah' },
  { value: 'bulan', label: 'Urut: Bulan Amanah', keywords: 'bulan periode' },
  { value: 'statusVerifikasi', label: 'Urut: Status Verifikasi', keywords: 'status verifikasi' },
  { value: 'statusPenyaluran', label: 'Urut: Status Penyaluran', keywords: 'status penyaluran' },
];

export const TabVerifikasi: React.FC<TabVerifikasiProps> = ({
  config,
  transaksiList,
  isLoading,
  onVerifikasi,
  onUpdateStatusPenyaluran,
}) => {
  const [filterMonthMode, setFilterMonthMode] = useState<'semua' | 'bulan'>('semua');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [filterStatus, setFilterStatus] = useState<'Pending' | 'Valid' | 'Ditolak' | 'Semua'>(
    'Pending'
  );
  const [filterSalur, setFilterSalur] = useState<'Semua' | StatusPenyaluran>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<TrxSortField>('waktu');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingSalurId, setProcessingSalurId] = useState<string | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [recentlyValidated, setRecentlyValidated] = useState<TransaksiDonasi | null>(null);
  const [previewModalTrx, setPreviewModalTrx] = useState<TransaksiDonasi | null>(null);

  const monthScopedTransaksi = useMemo(() => {
    if (filterMonthMode === 'bulan' && /^\d{4}-\d{2}$/.test(selectedMonth)) {
      return transaksiList.filter((t) => t.bulanTagihan === selectedMonth);
    }
    return transaksiList;
  }, [transaksiList, filterMonthMode, selectedMonth]);

  const counts = useMemo(() => {
    return {
      Pending: monthScopedTransaksi.filter((t) => t.statusVerifikasi === 'Pending').length,
      Valid: monthScopedTransaksi.filter((t) => t.statusVerifikasi === 'Valid').length,
      Ditolak: monthScopedTransaksi.filter((t) => t.statusVerifikasi === 'Ditolak').length,
      Semua: monthScopedTransaksi.length,
    };
  }, [monthScopedTransaksi]);

  const filteredTransaksi = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = monthScopedTransaksi.filter((t) => {
      if (filterStatus !== 'Semua' && t.statusVerifikasi !== filterStatus) return false;
      if (filterSalur !== 'Semua' && t.statusPenyaluran !== filterSalur) return false;
      if (!q) return true;
      return (
        t.namaDonatur.toLowerCase().includes(q) ||
        t.idTransaksi.toLowerCase().includes(q) ||
        t.noWa.toLowerCase().includes(q) ||
        t.bulanTagihan.toLowerCase().includes(q) ||
        t.bankTujuan.toLowerCase().includes(q) ||
        (t.keterangan || '').toLowerCase().includes(q) ||
        t.diinputOleh.toLowerCase().includes(q)
      );
    });

    const verifRank: Record<StatusVerifikasi, number> = {
      Pending: 1,
      Valid: 2,
      Ditolak: 3,
    };

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'waktu':
          cmp = a.waktuInput.localeCompare(b.waktuInput);
          break;
        case 'nominal':
          cmp = a.nominalTransfer - b.nominalTransfer;
          break;
        case 'bulan':
          cmp = a.bulanTagihan.localeCompare(b.bulanTagihan);
          break;
        case 'nama':
          cmp = a.namaDonatur.localeCompare(b.namaDonatur, 'id');
          break;
        case 'statusVerifikasi':
          cmp = verifRank[a.statusVerifikasi] - verifRank[b.statusVerifikasi];
          break;
        case 'statusPenyaluran':
          cmp = a.statusPenyaluran.localeCompare(b.statusPenyaluran, 'id');
          break;
      }
      if (cmp === 0) {
        return a.idTransaksi.localeCompare(b.idTransaksi);
      }
      return cmp * dir;
    });
  }, [monthScopedTransaksi, filterStatus, filterSalur, searchQuery, sortField, sortDir]);

  const handleSortHeader = (field: TrxSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'nominal' || field === 'waktu' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (active: boolean) => {
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-60 shrink-0" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 shrink-0" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 shrink-0" />
    );
  };

  const handleAction = async (trx: TransaksiDonasi, status: StatusVerifikasi) => {
    setProcessingId(trx.idTransaksi);
    const ok = await onVerifikasi(trx.idTransaksi, status);
    setProcessingId(null);
    setConfirmRejectId(null);
    if (ok && status === 'Valid') {
      setRecentlyValidated({ ...trx, statusVerifikasi: 'Valid' });
    }
  };

  const handleToggleSalur = async (trx: TransaksiDonasi) => {
    const next: StatusPenyaluran =
      trx.statusPenyaluran === 'Sudah Disalurkan' ? 'Belum Disalurkan' : 'Sudah Disalurkan';
    setProcessingSalurId(trx.idTransaksi);
    await onUpdateStatusPenyaluran(trx.idTransaksi, next);
    setProcessingSalurId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Verifikasi &amp; Penyaluran Pengurus
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            Periksa bukti transfer, validasi atau tolak konfirmasi, tandai status penyaluran, lalu
            kirim kuitansi resmi via WhatsApp.
          </p>
        </div>
      </div>

      {recentlyValidated && (
        <div className="glass-surface rounded-3xl p-5 border-emerald-200/90 dark:border-emerald-800/80 bg-gradient-to-r from-emerald-50/90 via-teal-50/75 to-white/90 dark:from-emerald-950/60 dark:via-teal-950/45 dark:to-slate-900/75 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100 safe-wrap">
                Transaksi {recentlyValidated.idTransaksi} Tervalidasi
              </p>
              <p className="text-xs text-emerald-900/85 dark:text-emerald-200/90 mt-0.5 safe-wrap">
                Donasi dari <strong>{recentlyValidated.namaDonatur}</strong> sebesar{' '}
                <strong className="tabular-nums">
                  {formatRupiah(recentlyValidated.nominalTransfer)}
                </strong>{' '}
                ({formatBulanLabel(recentlyValidated.bulanTagihan)}) siap dikirimkan kuitansi &amp;
                ucapan terima kasih.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={buildReceiptWaLink(recentlyValidated, config)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span>Kirim Kuitansi / Ucapan via WA</span>
            </a>
            <button
              type="button"
              onClick={() => setRecentlyValidated(null)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 cursor-pointer"
              aria-label="Tutup notifikasi kuitansi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <section className="glass-surface rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100/85 dark:bg-slate-800/80 p-1.5 w-full lg:w-fit">
              {(['Pending', 'Valid', 'Ditolak', 'Semua'] as const).map((tab) => {
                const active = filterStatus === tab;
                const label =
                  tab === 'Pending'
                    ? 'Menunggu Verifikasi'
                    : tab === 'Valid'
                    ? 'Tervalidasi'
                    : tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterStatus(tab)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {label} <span className="tabular-nums opacity-75">({counts[tab]})</span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full lg:w-72 shrink-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari ID, nama donatur, bank..."
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Periode Bulan */}
            <div className="inline-flex items-center gap-1 rounded-2xl bg-slate-100/85 dark:bg-slate-800/80 p-1">
              <button
                type="button"
                onClick={() => setFilterMonthMode('semua')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  filterMonthMode === 'semua'
                    ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Semua Bulan
              </button>
              <button
                type="button"
                onClick={() => setFilterMonthMode('bulan')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  filterMonthMode === 'bulan'
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
                aria-label="Filter transaksi berdasarkan bulan"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setFilterMonthMode('bulan');
                }}
                className={`rounded-xl border px-3 pl-9 py-1.5 text-xs font-semibold tabular-nums focus:border-emerald-500 focus:outline-none ${
                  filterMonthMode === 'bulan'
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100'
                    : 'border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 text-slate-600 dark:text-slate-300'
                }`}
              />
            </div>

            <div className="w-full sm:w-48">
              <SearchableSelect
                ariaLabel="Filter status penyaluran transaksi"
                options={SALUR_FILTER_OPTIONS}
                value={filterSalur}
                onChange={(val) => setFilterSalur((val || 'Semua') as 'Semua' | StatusPenyaluran)}
                compact
                searchPlaceholder="Filter penyaluran..."
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-56">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  ariaLabel="Urutkan transaksi"
                  options={SORT_OPTIONS}
                  value={sortField}
                  onChange={(val) => setSortField((val || 'waktu') as TrxSortField)}
                  compact
                  searchPlaceholder="Urutkan berdasarkan..."
                />
              </div>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                title={sortDir === 'asc' ? 'Urutan Naik' : 'Urutan Turun'}
                aria-label="Ubah arah urutan transaksi"
              >
                {sortDir === 'asc' ? (
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
                className="h-16 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 animate-pulse"
              />
            ))}
          </div>
        ) : filteredTransaksi.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
              <FileCheck2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {filterStatus === 'Pending'
                ? 'Tidak Ada Antrean Verifikasi'
                : 'Belum Ada Transaksi di Pilihan Ini'}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              {filterStatus === 'Pending'
                ? 'Semua konfirmasi pembayaran yang masuk sudah diperiksa.'
                : 'Konfirmasi pembayaran baru yang dikirim melalui halaman Konfirmasi akan tampil di sini.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto clean-scroll">
            <table className="w-full min-w-[960px] text-left border-collapse">
              <thead>
                <tr className="bg-emerald-800 dark:bg-emerald-950 text-white dark:text-emerald-100 text-[11px] font-semibold">
                  <th className="py-3.5 pl-5 pr-3 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('waktu')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Transaksi &amp; Periode</span>
                      {renderSortIcon(sortField === 'waktu')}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('nama')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Donatur &amp; Catatan</span>
                      {renderSortIcon(sortField === 'nama')}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('nominal')}
                      className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                    >
                      <span>Nominal</span>
                      {renderSortIcon(sortField === 'nominal')}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('statusVerifikasi')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Verifikasi &amp; Bukti</span>
                      {renderSortIcon(sortField === 'statusVerifikasi')}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('statusPenyaluran')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Penyaluran</span>
                      {renderSortIcon(sortField === 'statusPenyaluran')}
                    </button>
                  </th>
                  <th className="py-3.5 pl-4 pr-5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-sm">
                {filteredTransaksi.map((trx, index) => {
                  const isBusy = processingId === trx.idTransaksi;
                  const isBusySalur = processingSalurId === trx.idTransaksi;
                  const isConfirmingReject = confirmRejectId === trx.idTransaksi;
                  const hasExternalUrl =
                    trx.linkBuktiDrive.startsWith('http://') ||
                    trx.linkBuktiDrive.startsWith('https://');
                  const hasLocalDataUrl = trx.linkBuktiDrive.startsWith('data:');

                  return (
                    <tr
                      key={trx.idTransaksi}
                      className="odd:bg-white/90 even:bg-emerald-50/55 dark:odd:bg-slate-900/75 dark:even:bg-slate-800/65 hover:bg-teal-50/80 dark:hover:bg-emerald-950/45 transition-colors align-top"
                    >
                      <td className="py-4 pl-5 pr-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                        {index + 1}
                      </td>

                      <td className="py-4 px-4 min-w-0 max-w-[200px]">
                        <p className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {trx.idTransaksi}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-teal-800 dark:text-teal-300">
                          {formatBulanLabel(trx.bulanTagihan)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {trx.waktuInput}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                          Input: {trx.diinputOleh || 'Donatur (Mandiri)'}
                        </p>
                      </td>

                      <td className="py-4 px-4 min-w-0 max-w-[230px]">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 safe-wrap">
                          {trx.namaDonatur}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                          {formatWADisplay(trx.noWa)}
                        </p>
                        {trx.bankTujuan && trx.bankTujuan !== '-' && (
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                            {trx.bankTujuan}
                          </p>
                        )}
                        {trx.keterangan && (
                          <p className="mt-1 text-[11px] text-teal-800 dark:text-teal-300 bg-teal-50/70 dark:bg-teal-950/40 rounded-lg px-2 py-1 safe-wrap">
                            Ket: {trx.keterangan}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <p className="font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                          {formatRupiah(trx.nominalTransfer)}
                        </p>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap space-y-1.5">
                        <div>
                          {trx.statusVerifikasi === 'Pending' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span>Pending</span>
                            </span>
                          )}
                          {trx.statusVerifikasi === 'Valid' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span>Valid</span>
                            </span>
                          )}
                          {trx.statusVerifikasi === 'Ditolak' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                              <XCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>Ditolak</span>
                            </span>
                          )}
                        </div>

                        {hasExternalUrl && (
                          <a
                            href={trx.linkBuktiDrive}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span>Lihat Bukti Transfer</span>
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
                        {!hasExternalUrl && !hasLocalDataUrl && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            Tanpa bukti upload
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {trx.statusVerifikasi !== 'Valid' ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            Belum Disalurkan
                          </span>
                        ) : (
                          <div className="space-y-1.5">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                                trx.statusPenyaluran === 'Sudah Disalurkan'
                                  ? 'text-sky-700 dark:text-sky-400'
                                  : 'text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              <Send className="h-3.5 w-3.5 shrink-0" />
                              <span>{trx.statusPenyaluran}</span>
                            </span>
                            <div>
                              <button
                                type="button"
                                disabled={isBusySalur}
                                onClick={() => void handleToggleSalur(trx)}
                                className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 hover:underline disabled:opacity-50 cursor-pointer"
                              >
                                {isBusySalur
                                  ? 'Menyimpan...'
                                  : trx.statusPenyaluran === 'Sudah Disalurkan'
                                  ? 'Ubah ke Belum Disalurkan'
                                  : 'Tandai Sudah Disalurkan'}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-4 pl-4 pr-5 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          {trx.statusVerifikasi === 'Pending' && !isConfirmingReject && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAction(trx, 'Valid')}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>{isBusy ? 'Memproses...' : 'Validasi'}</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => setConfirmRejectId(trx.idTransaksi)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/50 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <XCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>Tolak</span>
                              </button>
                            </>
                          )}

                          {trx.statusVerifikasi === 'Pending' && isConfirmingReject && (
                            <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/70 px-3 py-1.5">
                              <span className="text-xs font-semibold text-rose-800 dark:text-rose-200 whitespace-nowrap">
                                Tolak?
                              </span>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAction(trx, 'Ditolak')}
                                className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 whitespace-nowrap cursor-pointer"
                              >
                                Ya
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRejectId(null)}
                                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white whitespace-nowrap cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          )}

                          {trx.statusVerifikasi === 'Valid' && (
                            <a
                              href={buildReceiptWaLink(trx, config)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:opacity-95 transition-opacity whitespace-nowrap"
                            >
                              <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>Kirim Kuitansi WA</span>
                            </a>
                          )}

                          {trx.statusVerifikasi === 'Ditolak' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAction(trx, 'Valid')}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300 dark:hover:border-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <span>Ubah ke Valid</span>
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
