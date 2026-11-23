import React, { useMemo, useState } from 'react';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Search,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Donatur,
  LembagaConfig,
  Panitia,
  StatusAktif,
  StatusBayarBulan,
  StatusPenyaluran,
  TransaksiDonasi,
} from '../types';
import {
  buildReferralUrl,
  buildReminderWaLink,
  formatBulanLabel,
  formatRupiah,
  formatWADisplay,
  getCurrentYearMonth,
  normalizeWA,
} from '../utils/formatters';

interface TabDashboardProps {
  config: LembagaConfig;
  donaturList: Donatur[];
  transaksiList: TransaksiDonasi[];
  panitiaList: Panitia[];
  isLoading: boolean;
  onUpdateStatusDonatur: (idDonatur: string, status: StatusAktif) => Promise<void>;
  onUpdateStatusPenyaluran: (
    idTransaksi: string,
    statusPenyaluran: StatusPenyaluran
  ) => Promise<boolean>;
  onGoToPendaftaran: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

interface DonorWithMonthlyStatus {
  donatur: Donatur;
  statusBulan: StatusBayarBulan;
  totalValidBulanIni: number;
  totalPendingBulanIni: number;
  validTransaksiBulanIni: TransaksiDonasi[];
  statusPenyaluranBulan: 'Sudah Disalurkan' | 'Sebagian Disalurkan' | 'Belum Disalurkan' | 'Belum Ada Donasi';
}

type SortField = 'nama' | 'nominal' | 'tanggal' | 'statusBayar' | 'statusSalur' | 'terdaftar';
type CategoryTab = 'program' | 'panitia' | 'domisili' | 'metode';

export const TabDashboard: React.FC<TabDashboardProps> = ({
  config,
  donaturList,
  transaksiList,
  panitiaList,
  isLoading,
  onUpdateStatusDonatur,
  onUpdateStatusPenyaluran,
  onGoToPendaftaran,
  onNotify,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [statusFilter, setStatusFilter] = useState<'Semua' | StatusBayarBulan>('Semua');
  const [penyaluranFilter, setPenyaluranFilter] = useState<
    'Semua' | 'Sudah Disalurkan' | 'Belum Disalurkan'
  >('Semua');
  const [programFilter, setProgramFilter] = useState<string>('Semua');
  const [perantaraFilter, setPerantaraFilter] = useState<string>('Semua');
  const [aktifFilter, setAktifFilter] = useState<'Semua' | StatusAktif>('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  const [sortField, setSortField] = useState<SortField>('nama');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [categoryTab, setCategoryTab] = useState<CategoryTab>('program');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingSalurDonorId, setUpdatingSalurDonorId] = useState<string | null>(null);
  const [copiedKode, setCopiedKode] = useState<string | null>(null);

  const monthTransaksi = useMemo(
    () => transaksiList.filter((t) => t.bulanTagihan === selectedMonth),
    [transaksiList, selectedMonth]
  );

  // Hitung status pembayaran & status penyaluran per donatur pada bulan terpilih
  const donorRows: DonorWithMonthlyStatus[] = useMemo(() => {
    return donaturList.map((donatur) => {
      const donorWa = normalizeWA(donatur.noWa) || donatur.noWa;
      const matchingTrx = monthTransaksi.filter((t) => {
        const idMatch =
          donatur.idDonatur &&
          t.idDonatur &&
          t.idDonatur !== '-' &&
          t.idDonatur === donatur.idDonatur;
        const waMatch = donorWa && (normalizeWA(t.noWa) || t.noWa) === donorWa;
        return idMatch || waMatch;
      });

      const validTrx = matchingTrx.filter((t) => t.statusVerifikasi === 'Valid');
      const pendingTrx = matchingTrx.filter((t) => t.statusVerifikasi === 'Pending');

      const totalValidBulanIni = validTrx.reduce((sum, t) => sum + t.nominalTransfer, 0);
      const totalPendingBulanIni = pendingTrx.reduce((sum, t) => sum + t.nominalTransfer, 0);

      let statusBulan: StatusBayarBulan = 'Belum Bayar';
      if (validTrx.length > 0) {
        statusBulan = 'Lunas';
      } else if (pendingTrx.length > 0) {
        statusBulan = 'Menunggu Verifikasi';
      }

      let statusPenyaluranBulan: DonorWithMonthlyStatus['statusPenyaluranBulan'] = 'Belum Ada Donasi';
      if (validTrx.length > 0) {
        const salurCount = validTrx.filter((t) => t.statusPenyaluran === 'Sudah Disalurkan').length;
        if (salurCount === validTrx.length) {
          statusPenyaluranBulan = 'Sudah Disalurkan';
        } else if (salurCount > 0) {
          statusPenyaluranBulan = 'Sebagian Disalurkan';
        } else {
          statusPenyaluranBulan = 'Belum Disalurkan';
        }
      }

      return {
        donatur,
        statusBulan,
        totalValidBulanIni,
        totalPendingBulanIni,
        validTransaksiBulanIni: validTrx,
        statusPenyaluranBulan,
      };
    });
  }, [donaturList, monthTransaksi]);

  // Rekap Secara Keseluruhan (Seluruh Periode)
  const overallMetrics = useMemo(() => {
    const allValid = transaksiList.filter((t) => t.statusVerifikasi === 'Valid');
    const allPending = transaksiList.filter((t) => t.statusVerifikasi === 'Pending');
    const allDisalurkan = allValid.filter((t) => t.statusPenyaluran === 'Sudah Disalurkan');
    const allBelumDisalurkan = allValid.filter((t) => t.statusPenyaluran !== 'Sudah Disalurkan');

    const totalValidRp = allValid.reduce((s, t) => s + t.nominalTransfer, 0);
    const totalDisalurkanRp = allDisalurkan.reduce((s, t) => s + t.nominalTransfer, 0);
    const totalBelumDisalurkanRp = allBelumDisalurkan.reduce((s, t) => s + t.nominalTransfer, 0);
    const activeCount = donaturList.filter((d) => d.statusAktif === 'Aktif').length;
    const cutiCount = donaturList.length - activeCount;

    return {
      totalValidRp,
      validCount: allValid.length,
      totalDisalurkanRp,
      disalurkanCount: allDisalurkan.length,
      totalBelumDisalurkanRp,
      belumDisalurkanCount: allBelumDisalurkan.length,
      pendingCount: allPending.length,
      totalDonatur: donaturList.length,
      activeCount,
      cutiCount,
    };
  }, [transaksiList, donaturList]);

  // Metrik KPI Bulan Terpilih
  const monthlyMetrics = useMemo(() => {
    const validMonthTrx = monthTransaksi.filter((t) => t.statusVerifikasi === 'Valid');
    const pendingMonthTrx = monthTransaksi.filter((t) => t.statusVerifikasi === 'Pending');
    const disalurkanMonthTrx = validMonthTrx.filter(
      (t) => t.statusPenyaluran === 'Sudah Disalurkan'
    );

    const totalValidRp = validMonthTrx.reduce((sum, t) => sum + t.nominalTransfer, 0);
    const totalDisalurkanRp = disalurkanMonthTrx.reduce((sum, t) => sum + t.nominalTransfer, 0);
    const totalPendingRp = pendingMonthTrx.reduce((sum, t) => sum + t.nominalTransfer, 0);

    const activeDonors = donorRows.filter((r) => r.donatur.statusAktif === 'Aktif');
    const lunasActiveCount = activeDonors.filter((r) => r.statusBulan === 'Lunas').length;
    const compliancePct =
      activeDonors.length > 0 ? Math.round((lunasActiveCount / activeDonors.length) * 1000) / 10 : 0;

    return {
      totalValidRp,
      validCount: validMonthTrx.length,
      totalDisalurkanRp,
      disalurkanCount: disalurkanMonthTrx.length,
      totalPendingRp,
      pendingCount: pendingMonthTrx.length,
      activeCount: activeDonors.length,
      lunasActiveCount,
      compliancePct,
    };
  }, [monthTransaksi, donorRows]);

  const programOptions = useMemo(() => {
    const set = new Set<string>(config.daftarProgram);
    donaturList.forEach((d) => {
      if (d.programDonasi) set.add(d.programDonasi);
    });
    return Array.from(set);
  }, [config.daftarProgram, donaturList]);

  const perantaraOptions = useMemo(() => {
    const set = new Set<string>();
    panitiaList.forEach((p) => set.add(p.namaPanitia));
    donaturList.forEach((d) => {
      if (d.namaPerantara) set.add(d.namaPerantara);
    });
    return Array.from(set);
  }, [panitiaList, donaturList]);

  const filterCounts = useMemo(() => {
    return {
      Semua: donorRows.length,
      Lunas: donorRows.filter((r) => r.statusBulan === 'Lunas').length,
      'Menunggu Verifikasi': donorRows.filter((r) => r.statusBulan === 'Menunggu Verifikasi').length,
      'Belum Bayar': donorRows.filter((r) => r.statusBulan === 'Belum Bayar').length,
    };
  }, [donorRows]);

  const filteredAndSortedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = donorRows.filter((row) => {
      if (statusFilter !== 'Semua' && row.statusBulan !== statusFilter) return false;
      if (aktifFilter !== 'Semua' && row.donatur.statusAktif !== aktifFilter) return false;
      if (programFilter !== 'Semua' && row.donatur.programDonasi !== programFilter) return false;
      if (perantaraFilter !== 'Semua' && row.donatur.namaPerantara !== perantaraFilter) return false;

      if (penyaluranFilter === 'Sudah Disalurkan') {
        if (row.statusPenyaluranBulan !== 'Sudah Disalurkan') return false;
      } else if (penyaluranFilter === 'Belum Disalurkan') {
        if (row.statusPenyaluranBulan === 'Sudah Disalurkan') return false;
      }

      if (!q) return true;
      const d = row.donatur;
      return (
        d.namaLengkap.toLowerCase().includes(q) ||
        d.noWa.toLowerCase().includes(q) ||
        (d.email || '').toLowerCase().includes(q) ||
        d.namaPerantara.toLowerCase().includes(q) ||
        d.programDonasi.toLowerCase().includes(q) ||
        (d.domisili || '').toLowerCase().includes(q) ||
        d.idDonatur.toLowerCase().includes(q)
      );
    });

    const bayarRank: Record<StatusBayarBulan, number> = {
      Lunas: 1,
      'Menunggu Verifikasi': 2,
      'Belum Bayar': 3,
    };
    const salurRank: Record<DonorWithMonthlyStatus['statusPenyaluranBulan'], number> = {
      'Sudah Disalurkan': 1,
      'Sebagian Disalurkan': 2,
      'Belum Disalurkan': 3,
      'Belum Ada Donasi': 4,
    };

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'nama':
          cmp = a.donatur.namaLengkap.localeCompare(b.donatur.namaLengkap, 'id');
          break;
        case 'nominal':
          cmp = a.donatur.nominalKomitmen - b.donatur.nominalKomitmen;
          break;
        case 'tanggal':
          cmp = a.donatur.tglJatuhTempo - b.donatur.tglJatuhTempo;
          break;
        case 'statusBayar':
          cmp = bayarRank[a.statusBulan] - bayarRank[b.statusBulan];
          break;
        case 'statusSalur':
          cmp = salurRank[a.statusPenyaluranBulan] - salurRank[b.statusPenyaluranBulan];
          break;
        case 'terdaftar':
          cmp = a.donatur.tanggalDaftar.localeCompare(b.donatur.tanggalDaftar);
          break;
      }
      if (cmp === 0) {
        return a.donatur.namaLengkap.localeCompare(b.donatur.namaLengkap, 'id');
      }
      return cmp * dir;
    });
  }, [
    donorRows,
    statusFilter,
    aktifFilter,
    programFilter,
    perantaraFilter,
    penyaluranFilter,
    searchQuery,
    sortField,
    sortDir,
  ]);

  // Helper pembentuk rekap kategori (Program, Panitia, Domisili, Metode)
  const categorySummaryRows = useMemo(() => {
    const getCategoryKey = (d: Donatur): string => {
      switch (categoryTab) {
        case 'program':
          return d.programDonasi || 'Infaq Umum Rutin';
        case 'panitia':
          return d.namaPerantara || 'Langsung (Tanpa Perantara)';
        case 'domisili':
          return d.domisili?.trim() || 'Belum Diisi';
        case 'metode':
          return d.metodeDaftar || 'Mandiri';
      }
    };

    const keySet = new Set<string>();
    if (categoryTab === 'panitia') {
      panitiaList.forEach((p) => keySet.add(p.namaPanitia));
    } else if (categoryTab === 'program') {
      config.daftarProgram.forEach((prog) => keySet.add(prog));
    }
    donaturList.forEach((d) => keySet.add(getCategoryKey(d)));

    const rows = Array.from(keySet).map((label) => {
      const matchedPanitia =
        categoryTab === 'panitia' ? panitiaList.find((p) => p.namaPanitia === label) : undefined;

      const groupDonors = donorRows.filter((r) => getCategoryKey(r.donatur) === label);
      const activeGroup = groupDonors.filter((r) => r.donatur.statusAktif === 'Aktif');
      const lunasBulanIni = activeGroup.filter((r) => r.statusBulan === 'Lunas').length;
      const komitmenBulanan = activeGroup.reduce((s, r) => s + r.donatur.nominalKomitmen, 0);

      const donorIdSet = new Set(groupDonors.map((r) => r.donatur.idDonatur));
      const donorWaSet = new Set(
        groupDonors.map((r) => normalizeWA(r.donatur.noWa) || r.donatur.noWa)
      );

      const validTrxGroup = transaksiList.filter((t) => {
        if (t.statusVerifikasi !== 'Valid') return false;
        const byId = t.idDonatur && t.idDonatur !== '-' && donorIdSet.has(t.idDonatur);
        const byWa = donorWaSet.has(normalizeWA(t.noWa) || t.noWa);
        return byId || byWa;
      });

      const validBulanTrx = validTrxGroup.filter((t) => t.bulanTagihan === selectedMonth);
      const validBulanRp = validBulanTrx.reduce((s, t) => s + t.nominalTransfer, 0);
      const salurBulanRp = validBulanTrx
        .filter((t) => t.statusPenyaluran === 'Sudah Disalurkan')
        .reduce((s, t) => s + t.nominalTransfer, 0);
      const validSemuaRp = validTrxGroup.reduce((s, t) => s + t.nominalTransfer, 0);

      return {
        label,
        subtitle: matchedPanitia ? `Kode ${matchedPanitia.kodePanitia} · ${matchedPanitia.role}` : '',
        kodePanitia: matchedPanitia?.kodePanitia || '',
        activeCount: activeGroup.length,
        totalDonatur: groupDonors.length,
        lunasBulanIni,
        komitmenBulanan,
        validBulanRp,
        salurBulanRp,
        validSemuaRp,
      };
    });

    return rows.sort(
      (a, b) =>
        b.validBulanRp - a.validBulanRp ||
        b.validSemuaRp - a.validSemuaRp ||
        b.activeCount - a.activeCount
    );
  }, [categoryTab, panitiaList, config.daftarProgram, donaturList, donorRows, transaksiList, selectedMonth]);

  const handleToggleStatus = async (donatur: Donatur) => {
    const nextStatus: StatusAktif = donatur.statusAktif === 'Aktif' ? 'Cuti' : 'Aktif';
    setUpdatingId(donatur.idDonatur);
    await onUpdateStatusDonatur(donatur.idDonatur, nextStatus);
    setUpdatingId(null);
  };

  const handleTogglePenyaluranBulan = async (row: DonorWithMonthlyStatus) => {
    if (row.validTransaksiBulanIni.length === 0) return;
    const nextStatus: StatusPenyaluran =
      row.statusPenyaluranBulan === 'Sudah Disalurkan' ? 'Belum Disalurkan' : 'Sudah Disalurkan';
    setUpdatingSalurDonorId(row.donatur.idDonatur);
    for (const trx of row.validTransaksiBulanIni) {
      await onUpdateStatusPenyaluran(trx.idTransaksi, nextStatus);
    }
    setUpdatingSalurDonorId(null);
  };

  const handleCopyRef = async (kode: string) => {
    const url = buildReferralUrl(kode);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKode(kode);
      onNotify('success', `Link referral ${kode} disalin`, url);
      setTimeout(() => setCopiedKode(null), 2000);
    } catch {
      onNotify('error', 'Gagal menyalin link referral');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Dashboard &amp; Penagihan WA
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 safe-wrap">
            Pantau status konfirmasi, penyaluran, dan pengingat rutin periode{' '}
            <strong className="text-emerald-800 dark:text-emerald-300">
              {formatBulanLabel(selectedMonth)}
            </strong>
            .
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="dash-month" className="sr-only">
            Pilih Periode Bulan
          </label>
          <div className="relative flex items-center">
            <Calendar className="pointer-events-none absolute left-3.5 h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            <input
              id="dash-month"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="glass-surface rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            />
          </div>
        </div>
      </div>

      {/* Rekap Keseluruhan (Seluruh Periode) */}
      <section className="glass-surface rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200/70 dark:border-slate-700/70">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Rekap Secara Keseluruhan (Seluruh Periode)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Akumulasi seluruh donasi terverifikasi, penyaluran, dan total donatur terdaftar di {config.namaLembaga}.
            </p>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
            {overallMetrics.pendingCount} transaksi menunggu verifikasi
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Terkumpul (Valid)</p>
            <p className="mt-1 text-xl font-bold text-emerald-800 dark:text-emerald-300 tabular-nums safe-wrap">
              {formatRupiah(overallMetrics.totalValidRp)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {overallMetrics.validCount} transaksi valid
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400">Sudah Disalurkan</p>
            <p className="mt-1 text-xl font-bold text-sky-800 dark:text-sky-300 tabular-nums safe-wrap">
              {formatRupiah(overallMetrics.totalDisalurkanRp)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {overallMetrics.disalurkanCount} transaksi tersalurkan
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400">Belum Disalurkan</p>
            <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300 tabular-nums safe-wrap">
              {formatRupiah(overallMetrics.totalBelumDisalurkanRp)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {overallMetrics.belumDisalurkanCount} transaksi valid menunggu salur
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Donatur Terdaftar</p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {overallMetrics.totalDonatur}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {overallMetrics.activeCount} Aktif · {overallMetrics.cutiCount} Cuti
            </p>
          </div>
        </div>
      </section>

      {/* 4 KPI Summary Cards — Bulan Terpilih */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-surface rounded-3xl p-5 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Valid — {formatBulanLabel(selectedMonth)}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-800 dark:text-emerald-300 tabular-nums safe-wrap">
            {formatRupiah(monthlyMetrics.totalValidRp)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {monthlyMetrics.validCount} transaksi terkonfirmasi valid
          </p>
        </div>

        <div className="glass-surface rounded-3xl p-5 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Disalurkan — {formatBulanLabel(selectedMonth)}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-sky-800 dark:text-sky-300 tabular-nums safe-wrap">
            {formatRupiah(monthlyMetrics.totalDisalurkanRp)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {monthlyMetrics.disalurkanCount} dari {monthlyMetrics.validCount} transaksi valid
          </p>
        </div>

        <div className="glass-surface rounded-3xl p-5 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Menunggu Verifikasi
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-300 tabular-nums safe-wrap">
            {formatRupiah(monthlyMetrics.totalPendingRp)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {monthlyMetrics.pendingCount} konfirmasi berstatus Pending
          </p>
        </div>

        <div className="glass-surface rounded-3xl p-5 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Kepatuhan Bulan Ini
            </p>
            <span className="text-xs font-semibold text-teal-700 dark:text-teal-300 tabular-nums">
              {monthlyMetrics.lunasActiveCount}/{monthlyMetrics.activeCount}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-teal-800 dark:text-teal-300 tabular-nums">
            {monthlyMetrics.compliancePct.toFixed(1)}%
          </p>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-300"
              style={{ width: `${Math.min(100, monthlyMetrics.compliancePct)}%` }}
            />
          </div>
        </div>
      </section>

      {/* Donor Monthly Status, Distribution & WhatsApp Reminder Panel */}
      <section className="glass-surface rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Daftar Status Donatur &amp; Penyaluran — {formatBulanLabel(selectedMonth)}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Menampilkan status konfirmasi/valid dan penyaluran per bulan untuk setiap donatur.
              </p>
            </div>

            <div className="relative w-full lg:w-80 shrink-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, WA, email, program, domisili..."
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Interactive Status Filter Controls */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100/85 dark:bg-slate-800/80 p-1.5 w-full xl:w-fit">
            {(['Semua', 'Lunas', 'Menunggu Verifikasi', 'Belum Bayar'] as const).map((tab) => {
              const active = statusFilter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab}{' '}
                  <span className="tabular-nums opacity-75">({filterCounts[tab]})</span>
                </button>
              );
            })}
          </div>

          {/* Additional Filters & Sort Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <select
              aria-label="Filter status penyaluran"
              value={penyaluranFilter}
              onChange={(e) =>
                setPenyaluranFilter(
                  e.target.value as 'Semua' | 'Sudah Disalurkan' | 'Belum Disalurkan'
                )
              }
              className="rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="Semua">Penyaluran: Semua</option>
              <option value="Sudah Disalurkan">Sudah Disalurkan</option>
              <option value="Belum Disalurkan">Belum Disalurkan</option>
            </select>

            <select
              aria-label="Filter program donasi"
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="Semua">Program: Semua</option>
              {programOptions.map((prog) => (
                <option key={prog} value={prog}>
                  {prog}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter perantara"
              value={perantaraFilter}
              onChange={(e) => setPerantaraFilter(e.target.value)}
              className="rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="Semua">Perantara: Semua</option>
              {perantaraOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter keaktifan donatur"
              value={aktifFilter}
              onChange={(e) => setAktifFilter(e.target.value as 'Semua' | StatusAktif)}
              className="rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="Semua">Keaktifan: Semua</option>
              <option value="Aktif">Status Aktif</option>
              <option value="Cuti">Status Cuti</option>
            </select>

            <div className="flex items-center gap-1.5">
              <select
                aria-label="Urutkan data donatur"
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="flex-1 min-w-0 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="nama">Urut: Nama</option>
                <option value="nominal">Urut: Komitmen</option>
                <option value="tanggal">Urut: Tgl Pengingat</option>
                <option value="statusBayar">Urut: Status Valid</option>
                <option value="statusSalur">Urut: Penyaluran</option>
                <option value="terdaftar">Urut: Tgl Daftar</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                title={sortDir === 'asc' ? 'Urutan Naik (A–Z / Kecil–Besar)' : 'Urutan Turun (Z–A / Besar–Kecil)'}
                aria-label="Ubah arah urutan"
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

        {/* Table / Empty / Loading States */}
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 animate-pulse"
              />
            ))}
          </div>
        ) : filteredAndSortedRows.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {donaturList.length === 0
                ? 'Belum Ada Data Donatur Rutin'
                : 'Tidak Ada Donatur yang Sesuai Filter'}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              {donaturList.length === 0
                ? 'Mulai daftarkan donatur rutin pertama melalui tab Pendaftaran atau hubungkan URL Web App Google Apps Script Anda.'
                : 'Coba ubah filter status, penyaluran, kategori, atau kata kunci pencarian.'}
            </p>
            {donaturList.length === 0 && (
              <button
                type="button"
                onClick={onGoToPendaftaran}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <span>Daftarkan Donatur Pertama</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto clean-scroll">
            <table className="w-full min-w-[960px] text-left border-collapse">
              <thead>
                <tr className="bg-emerald-800 dark:bg-emerald-950 text-white dark:text-emerald-100 text-[11px] font-semibold">
                  <th className="py-3.5 pl-5 pr-3 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">Donatur &amp; Kontak</th>
                  <th className="py-3.5 px-4">Program &amp; Perantara</th>
                  <th className="py-3.5 px-4 text-right">Komitmen</th>
                  <th className="py-3.5 px-4">Konfirmasi / Valid</th>
                  <th className="py-3.5 px-4">Penyaluran</th>
                  <th className="py-3.5 pl-4 pr-5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-sm">
                {filteredAndSortedRows.map((row, index) => {
                  const {
                    donatur,
                    statusBulan,
                    totalValidBulanIni,
                    statusPenyaluranBulan,
                    validTransaksiBulanIni,
                  } = row;
                  const isCuti = donatur.statusAktif === 'Cuti';
                  const isUpdating = updatingId === donatur.idDonatur;
                  const isUpdatingSalur = updatingSalurDonorId === donatur.idDonatur;
                  const waLink = buildReminderWaLink(donatur, selectedMonth, config);

                  return (
                    <tr
                      key={donatur.idDonatur}
                      className="odd:bg-white/90 even:bg-emerald-50/55 dark:odd:bg-slate-900/75 dark:even:bg-slate-800/65 hover:bg-teal-50/80 dark:hover:bg-emerald-950/45 transition-colors align-top"
                    >
                      <td className="py-4 pl-5 pr-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                        {index + 1}
                      </td>

                      <td className="py-4 px-4 min-w-0 max-w-[230px]">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 safe-wrap">
                          {donatur.namaLengkap}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 tabular-nums safe-wrap">
                          {formatWADisplay(donatur.noWa)}
                          {donatur.domisili ? ` · ${donatur.domisili}` : ''}
                        </p>
                        {donatur.email && (
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                            {donatur.email}
                          </p>
                        )}
                        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                          {donatur.idDonatur} · {donatur.statusAktif}
                        </p>
                      </td>

                      <td className="py-4 px-4 min-w-0 max-w-[220px]">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 safe-wrap">
                          {donatur.programDonasi}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 safe-wrap">
                          Perantara: {donatur.namaPerantara}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {donatur.metodeDaftar} · Pengingat tgl {donatur.tglJatuhTempo}
                        </p>
                      </td>

                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <p className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatRupiah(donatur.nominalKomitmen)}
                        </p>
                        {totalValidBulanIni > 0 && (
                          <p className="mt-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                            Valid {formatRupiah(totalValidBulanIni)}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {statusBulan === 'Lunas' && (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>Valid / Lunas</span>
                          </div>
                        )}
                        {statusBulan === 'Menunggu Verifikasi' && (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                            <Clock className="h-4 w-4 shrink-0" />
                            <span>Menunggu Verifikasi</span>
                          </div>
                        )}
                        {statusBulan === 'Belum Bayar' && (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                            <span>{isCuti ? 'Cuti Bulan Ini' : 'Belum Bayar'}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {validTransaksiBulanIni.length === 0 ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            Belum Disalurkan
                          </span>
                        ) : (
                          <div className="space-y-1.5">
                            <div
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                                statusPenyaluranBulan === 'Sudah Disalurkan'
                                  ? 'text-sky-700 dark:text-sky-400'
                                  : 'text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              <Send className="h-3.5 w-3.5 shrink-0" />
                              <span>{statusPenyaluranBulan}</span>
                            </div>
                            <div>
                              <button
                                type="button"
                                disabled={isUpdatingSalur}
                                onClick={() => void handleTogglePenyaluranBulan(row)}
                                className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 hover:underline disabled:opacity-50 cursor-pointer"
                              >
                                {isUpdatingSalur
                                  ? 'Memperbarui...'
                                  : statusPenyaluranBulan === 'Sudah Disalurkan'
                                  ? 'Tandai Belum Disalurkan'
                                  : 'Tandai Sudah Disalurkan'}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-4 pl-4 pr-5 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          {statusBulan === 'Belum Bayar' && !isCuti && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
                            >
                              <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>Ingatkan via WA</span>
                            </a>
                          )}

                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleToggleStatus(donatur)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isCuti ? (
                              <>
                                <PlayCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>{isUpdating ? 'Menyimpan...' : 'Aktifkan'}</span>
                              </>
                            ) : (
                              <>
                                <PauseCircle className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                                <span>{isUpdating ? 'Menyimpan...' : 'Set Cuti'}</span>
                              </>
                            )}
                          </button>
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

      {/* Rekap Berdasarkan Beberapa Kategori */}
      <section className="glass-surface rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Rekap Berdasarkan Kategori
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ringkasan perolehan dan penyaluran pada periode {formatBulanLabel(selectedMonth)} serta kumulatif keseluruhan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100/85 dark:bg-slate-800/80 p-1.5 w-full lg:w-fit">
            {(
              [
                { key: 'program', label: 'Program Donasi' },
                { key: 'panitia', label: 'Panitia / Perantara' },
                { key: 'domisili', label: 'Domisili' },
                { key: 'metode', label: 'Metode Daftar' },
              ] as const
            ).map((item) => {
              const active = categoryTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setCategoryTab(item.key)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto clean-scroll">
          <table className="w-full min-w-[780px] text-left border-collapse">
            <thead>
              <tr className="bg-teal-800 dark:bg-teal-950 text-white dark:text-teal-100 text-[11px] font-semibold">
                <th className="py-3.5 pl-5 pr-3 w-12 text-center">No</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4 text-right">Donatur Aktif</th>
                <th className="py-3.5 px-4 text-right">Lunas Bulan Ini</th>
                <th className="py-3.5 px-4 text-right">Valid Bulan Ini</th>
                <th className="py-3.5 px-4 text-right">Disalurkan Bulan Ini</th>
                <th className="py-3.5 px-4 text-right">Total Valid Keseluruhan</th>
                {categoryTab === 'panitia' && (
                  <th className="py-3.5 pl-4 pr-5 text-right">Link Referral</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-sm">
              {categorySummaryRows.map((row, index) => (
                <tr
                  key={row.label}
                  className="odd:bg-white/90 even:bg-sky-50/45 dark:odd:bg-slate-900/75 dark:even:bg-slate-800/65 hover:bg-emerald-50/60 dark:hover:bg-teal-950/45 transition-colors"
                >
                  <td className="py-3.5 pl-5 pr-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    {index + 1}
                  </td>
                  <td className="py-3.5 px-4 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 safe-wrap">
                      {row.label}
                    </p>
                    {row.subtitle && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {row.subtitle}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
                    {row.activeCount}{' '}
                    <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                      / {row.totalDonatur}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-teal-700 dark:text-teal-300 tabular-nums whitespace-nowrap">
                    {row.lunasBulanIni} donatur
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-800 dark:text-emerald-300 tabular-nums whitespace-nowrap">
                    {formatRupiah(row.validBulanRp)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-sky-800 dark:text-sky-300 tabular-nums whitespace-nowrap">
                    {formatRupiah(row.salurBulanRp)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">
                    {formatRupiah(row.validSemuaRp)}
                  </td>
                  {categoryTab === 'panitia' && (
                    <td className="py-3.5 pl-4 pr-5 text-right whitespace-nowrap">
                      {row.kodePanitia ? (
                        <button
                          type="button"
                          onClick={() => handleCopyRef(row.kodePanitia)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300 dark:hover:border-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          {copiedKode === row.kodePanitia ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>Disalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5 shrink-0" />
                              <span>Salin Link</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
