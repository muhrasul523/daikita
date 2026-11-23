import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  MessageCircle,
  PlusCircle,
  UserCheck,
  X,
} from 'lucide-react';
import { Donatur, LembagaConfig, TransaksiDonasi } from '../types';
import {
  buildReminderWaLink,
  extractYearMonthFromDateStr,
  formatBulanLabel,
  formatRupiah,
  formatWADisplay,
  getCurrentYearMonth,
  normalizeWA,
} from '../utils/formatters';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

interface DonorHistorySectionProps {
  config: LembagaConfig;
  donaturList: Donatur[];
  transaksiList: TransaksiDonasi[];
  selectedDonaturId: string;
  onSelectDonaturId: (id: string) => void;
  selectedYear: number;
  onSelectYear: (year: number) => void;
  onGoToKonfirmasiBulan: (donatur: Donatur, targetMonth: string) => void;
  sectionRef?: React.RefObject<HTMLElement | null>;
}

type MonthRowStatus = 'Lunas' | 'Menunggu Verifikasi' | 'Belum Bayar' | 'Sebelum Terdaftar';
type HistorySortField = 'bulan' | 'status' | 'komitmen' | 'nominal' | 'bukti';

interface DonorMonthRow {
  ym: string;
  label: string;
  status: MonthRowStatus;
  komitmenRp: number;
  nominalValidRp: number;
  nominalPendingRp: number;
  nominalDisplayRp: number;
  transactions: TransaksiDonasi[];
  latestProofUrl: string;
  keteranganList: string[];
  diinputOleh: string;
}

export const DonorHistorySection: React.FC<DonorHistorySectionProps> = ({
  config,
  donaturList,
  transaksiList,
  selectedDonaturId,
  onSelectDonaturId,
  selectedYear,
  onSelectYear,
  onGoToKonfirmasiBulan,
  sectionRef,
}) => {
  const [sortField, setSortField] = useState<HistorySortField>('bulan');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [previewTrx, setPreviewTrx] = useState<TransaksiDonasi | null>(null);

  useEffect(() => {
    if (!selectedDonaturId && donaturList.length > 0) {
      onSelectDonaturId(donaturList[0].idDonatur);
    }
  }, [donaturList, selectedDonaturId, onSelectDonaturId]);

  const donorOptions = useMemo<SearchableOption[]>(
    () =>
      donaturList.map((d) => ({
        value: d.idDonatur,
        label: d.namaLengkap,
        sublabel: `${d.idDonatur} · ${formatWADisplay(d.noWa)}${d.domisili ? ` · ${d.domisili}` : ''}`,
        metaRight: formatRupiah(d.nominalKomitmen),
        keywords: `${d.namaLengkap} ${d.idDonatur} ${d.noWa} ${d.noWa.replace(/^62/, '0')} ${d.domisili || ''}`,
      })),
    [donaturList]
  );

  const selectedDonatur = useMemo(
    () => donaturList.find((d) => d.idDonatur === selectedDonaturId) || null,
    [donaturList, selectedDonaturId]
  );

  const donorAllTransactions = useMemo(() => {
    if (!selectedDonatur) return [];
    const donorWa = normalizeWA(selectedDonatur.noWa) || selectedDonatur.noWa;
    return transaksiList.filter((t) => {
      const idMatch =
        selectedDonatur.idDonatur &&
        t.idDonatur &&
        t.idDonatur !== '-' &&
        t.idDonatur === selectedDonatur.idDonatur;
      const waMatch = donorWa && (normalizeWA(t.noWa) || t.noWa) === donorWa;
      return idMatch || waMatch;
    });
  }, [selectedDonatur, transaksiList]);

  const regYm = useMemo(
    () => (selectedDonatur ? extractYearMonthFromDateStr(selectedDonatur.tanggalDaftar) : ''),
    [selectedDonatur]
  );

  const currentYm = getCurrentYearMonth();

  const donorYearRows = useMemo<DonorMonthRow[]>(() => {
    if (!selectedDonatur) return [];
    const rows: DonorMonthRow[] = [];

    for (let m = 1; m <= 12; m++) {
      const ym = `${selectedYear}-${String(m).padStart(2, '0')}`;
      const monthTrx = donorAllTransactions.filter((t) => t.bulanTagihan === ym);
      const validTrx = monthTrx.filter((t) => t.statusVerifikasi === 'Valid');
      const pendingTrx = monthTrx.filter((t) => t.statusVerifikasi === 'Pending');

      const nominalValidRp = validTrx.reduce((s, t) => s + t.nominalTransfer, 0);
      const nominalPendingRp = pendingTrx.reduce((s, t) => s + t.nominalTransfer, 0);

      let status: MonthRowStatus = 'Belum Bayar';
      if (validTrx.length > 0) {
        status = 'Lunas';
      } else if (pendingTrx.length > 0) {
        status = 'Menunggu Verifikasi';
      } else if (regYm && ym < regYm) {
        status = 'Sebelum Terdaftar';
      } else if (ym > currentYm) {
        // Bulan ke depan yang belum dibayar tetap ditandai Belum Bayar agar jelas
        status = 'Belum Bayar';
      }

      const trxWithProof = [...monthTrx]
        .reverse()
        .find((t) => Boolean(t.linkBuktiDrive && t.linkBuktiDrive.trim() !== ''));

      const keteranganList = Array.from(
        new Set(monthTrx.map((t) => (t.keterangan || '').trim()).filter(Boolean))
      );

      const diinputList = Array.from(
        new Set(monthTrx.map((t) => (t.diinputOleh || '').trim()).filter(Boolean))
      );

      rows.push({
        ym,
        label: formatBulanLabel(ym),
        status,
        komitmenRp: selectedDonatur.nominalKomitmen,
        nominalValidRp,
        nominalPendingRp,
        nominalDisplayRp: nominalValidRp > 0 ? nominalValidRp : nominalPendingRp,
        transactions: monthTrx,
        latestProofUrl: trxWithProof?.linkBuktiDrive || '',
        keteranganList,
        diinputOleh: diinputList.join(', '),
      });
    }

    const statusRank: Record<MonthRowStatus, number> = {
      Lunas: 1,
      'Menunggu Verifikasi': 2,
      'Belum Bayar': 3,
      'Sebelum Terdaftar': 4,
    };

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'bulan':
          cmp = a.ym.localeCompare(b.ym);
          break;
        case 'status':
          cmp = statusRank[a.status] - statusRank[b.status];
          break;
        case 'komitmen':
          cmp = a.komitmenRp - b.komitmenRp;
          break;
        case 'nominal':
          cmp = a.nominalDisplayRp - b.nominalDisplayRp;
          break;
        case 'bukti':
          cmp = (a.latestProofUrl ? 1 : 0) - (b.latestProofUrl ? 1 : 0);
          break;
      }
      if (cmp === 0) return a.ym.localeCompare(b.ym);
      return cmp * dir;
    });
  }, [selectedDonatur, selectedYear, donorAllTransactions, regYm, currentYm, sortField, sortDir]);

  const donorTotals = useMemo(() => {
    const validAll = donorAllTransactions.filter((t) => t.statusVerifikasi === 'Valid');
    const pendingAll = donorAllTransactions.filter((t) => t.statusVerifikasi === 'Pending');
    const lunasMonths = new Set(validAll.map((t) => t.bulanTagihan)).size;
    const unpaidThisYear = donorYearRows.filter(
      (r) => r.status === 'Belum Bayar' && r.ym <= currentYm
    ).length;

    return {
      totalValidRp: validAll.reduce((s, t) => s + t.nominalTransfer, 0),
      totalPendingRp: pendingAll.reduce((s, t) => s + t.nominalTransfer, 0),
      lunasMonths,
      unpaidThisYear,
    };
  }, [donorAllTransactions, donorYearRows, currentYm]);

  const toggleSort = (field: HistorySortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const renderSortIcon = (field: HistorySortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-60 shrink-0" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 shrink-0" />
    ) : (
      <ArrowDown className="h-3 w-3 shrink-0" />
    );
  };

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      id="cek-riwayat-donatur"
      className="glass-surface rounded-3xl overflow-hidden"
    >
      <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>Cek Riwayat Pembayaran Per Donatur</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 safe-wrap">
              Periksa bulan mana saja yang sudah dibayar dan belum dibayar oleh masing-masing
              donatur, nominal transfer, keterangan, serta bukti transfernya.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="w-full sm:w-72">
              <SearchableSelect
                ariaLabel="Pilih donatur untuk melihat riwayat pembayaran"
                options={donorOptions}
                value={selectedDonaturId}
                onChange={(val) => onSelectDonaturId(val)}
                placeholder="Pilih nama donatur..."
                searchPlaceholder="Ketik nama, ID, WA, atau domisili..."
                emptyText="Donatur tidak ditemukan."
              />
            </div>

            <div className="inline-flex items-center rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 p-1">
              <button
                type="button"
                onClick={() => onSelectYear(selectedYear - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Tahun sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {selectedYear}
              </span>
              <button
                type="button"
                onClick={() => onSelectYear(selectedYear + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Tahun berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {selectedDonatur && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/60 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-6 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 safe-wrap">
                  {selectedDonatur.namaLengkap}
                </p>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {selectedDonatur.idDonatur}
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  · {selectedDonatur.statusAktif}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 safe-wrap tabular-nums">
                {formatWADisplay(selectedDonatur.noWa)}
                {selectedDonatur.jenisKelamin ? ` · ${selectedDonatur.jenisKelamin}` : ''}
                {selectedDonatur.domisili ? ` · ${selectedDonatur.domisili}` : ''}
                {selectedDonatur.tanggalDaftar
                  ? ` · Terdaftar: ${selectedDonatur.tanggalDaftar.slice(0, 10)}`
                  : ''}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                Komitmen: <strong className="tabular-nums">{formatRupiah(selectedDonatur.nominalKomitmen)}/bln</strong> · Pengingat tgl{' '}
                {selectedDonatur.tglJatuhTempo} · Perantara: {selectedDonatur.namaPerantara}
              </p>
            </div>

            <div className="lg:col-span-6 grid grid-cols-3 gap-3 text-left sm:text-right">
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Valid (Semua)</p>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums safe-wrap">
                  {formatRupiah(donorTotals.totalValidRp)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Bulan Lunas</p>
                <p className="text-sm font-bold text-teal-700 dark:text-teal-300 tabular-nums">
                  {donorTotals.lunasMonths} bln
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Belum Bayar ({selectedYear})
                </p>
                <p className="text-sm font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                  {donorTotals.unpaidThisYear} bln
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {!selectedDonatur ? (
        <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
          Belum ada data donatur terdaftar untuk diperiksa riwayat pembayarannya.
        </div>
      ) : (
        <div className="overflow-x-auto clean-scroll">
          <table className="w-full min-w-[880px] text-left border-collapse">
            <thead>
              <tr className="bg-teal-800 dark:bg-teal-950 text-white dark:text-teal-100 text-[11px] font-semibold">
                <th className="py-3 pl-5 pr-3 w-12 text-center">No</th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('bulan')}
                    className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>Bulan Tagihan</span>
                    {renderSortIcon('bulan')}
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('status')}
                    className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>Status Pembayaran</span>
                    {renderSortIcon('status')}
                  </button>
                </th>
                <th className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('komitmen')}
                    className="inline-flex items-center gap-1 ml-auto hover:underline cursor-pointer"
                  >
                    <span>Komitmen</span>
                    {renderSortIcon('komitmen')}
                  </button>
                </th>
                <th className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('nominal')}
                    className="inline-flex items-center gap-1 ml-auto hover:underline cursor-pointer"
                  >
                    <span>Nominal Terbayar</span>
                    {renderSortIcon('nominal')}
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('bukti')}
                    className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>Bukti &amp; Keterangan</span>
                    {renderSortIcon('bukti')}
                  </button>
                </th>
                <th className="py-3 pl-4 pr-5 text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-sm">
              {donorYearRows.map((row, idx) => {
                const waLink = buildReminderWaLink(selectedDonatur, row.ym, config);
                const firstProofTrx = row.transactions.find((t) => Boolean(t.linkBuktiDrive));
                const isExternalUrl =
                  row.latestProofUrl.startsWith('http://') ||
                  row.latestProofUrl.startsWith('https://');
                const isLocalDataUrl = row.latestProofUrl.startsWith('data:');

                return (
                  <tr
                    key={row.ym}
                    className="odd:bg-white/90 even:bg-emerald-50/40 dark:odd:bg-slate-900/75 dark:even:bg-slate-800/60 hover:bg-teal-50/75 dark:hover:bg-teal-950/40 transition-colors align-top"
                  >
                    <td className="py-3.5 pl-5 pr-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      {idx + 1}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {row.label}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                        {row.ym}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {row.status === 'Lunas' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>Sudah Dibayar (Valid)</span>
                        </span>
                      )}
                      {row.status === 'Menunggu Verifikasi' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          <Clock className="h-4 w-4 shrink-0" />
                          <span>Menunggu Verifikasi</span>
                        </span>
                      )}
                      {row.status === 'Belum Bayar' && (
                        <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                          Belum Dibayar
                        </span>
                      )}
                      {row.status === 'Sebelum Terdaftar' && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          Belum Terdaftar
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap tabular-nums text-xs text-slate-600 dark:text-slate-300">
                      {formatRupiah(row.komitmenRp)}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap tabular-nums">
                      {row.nominalValidRp > 0 ? (
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          {formatRupiah(row.nominalValidRp)}
                        </p>
                      ) : row.nominalPendingRp > 0 ? (
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                          {formatRupiah(row.nominalPendingRp)}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 min-w-0 max-w-[260px] space-y-1">
                      {row.transactions.length === 0 ? (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          Belum ada transaksi
                        </span>
                      ) : (
                        <>
                          {isExternalUrl && (
                            <a
                              href={row.latestProofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline"
                            >
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                              <span>Lihat Bukti Transfer</span>
                            </a>
                          )}
                          {isLocalDataUrl && firstProofTrx && (
                            <button
                              type="button"
                              onClick={() => setPreviewTrx(firstProofTrx)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5 shrink-0" />
                              <span>Lihat Pratinjau Bukti</span>
                            </button>
                          )}
                          {!isExternalUrl && !isLocalDataUrl && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Tanpa bukti upload
                            </p>
                          )}
                          {row.keteranganList.length > 0 && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 safe-wrap">
                              Ket: {row.keteranganList.join(' · ')}
                            </p>
                          )}
                          {row.diinputOleh && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 safe-wrap">
                              Input: {row.diinputOleh}
                            </p>
                          )}
                        </>
                      )}
                    </td>

                    <td className="py-3.5 pl-4 pr-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {row.status !== 'Lunas' && row.status !== 'Sebelum Terdaftar' && (
                          <button
                            type="button"
                            onClick={() => onGoToKonfirmasiBulan(selectedDonatur, row.ym)}
                            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50/85 dark:bg-emerald-950/60 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                          >
                            <PlusCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Konfirmasi</span>
                          </button>
                        )}
                        {row.status === 'Belum Bayar' && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>WA</span>
                          </a>
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

      {previewTrx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="glass-surface w-full max-w-xl rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200/70 dark:border-slate-700/70">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  Bukti Transfer — {previewTrx.namaDonatur}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {previewTrx.idTransaksi} · {formatBulanLabel(previewTrx.bulanTagihan)} ·{' '}
                  {formatRupiah(previewTrx.nominalTransfer)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTrx(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Tutup pratinjau bukti"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-50/70 dark:bg-slate-950/60">
              {previewTrx.linkBuktiDrive.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewTrx.linkBuktiDrive}
                  title="Pratinjau PDF Bukti Transfer"
                  className="w-full h-[60vh] rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
                />
              ) : (
                <img
                  src={previewTrx.linkBuktiDrive}
                  alt={`Bukti transfer ${previewTrx.namaDonatur}`}
                  className="max-h-[65vh] w-auto rounded-xl object-contain shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
