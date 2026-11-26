import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowLeft,
  ArrowUp,
  ArrowUpAZ,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { WILAYAH_KABUPATEN } from '../data/wilayah';
import {
  Donatur,
  LembagaConfig,
  NotifDeliveryResult,
  Panitia,
  RegisterDonaturPayload,
  StatusAktif,
  StatusBayarBulan,
  TransaksiDonasi,
} from '../types';
import {
  buildReminderWaLink,
  extractYearMonthFromDateStr,
  formatBulanLabel,
  formatRupiah,
  formatWADisplay,
  getCurrentYearMonth,
  normalizeMinatGrup,
  normalizeRoleLabel,
  normalizeStatusGrup,
  normalizeWA,
} from '../utils/formatters';
import { DonorHistorySection } from './DonorHistorySection';
import { SearchableOption, SearchableSelect } from './SearchableSelect';
import { TabPendaftaran } from './TabPendaftaran';

interface TabDonaturProps {
  config: LembagaConfig;
  donaturList: Donatur[];
  transaksiList: TransaksiDonasi[];
  panitiaList: Panitia[];
  isLoading: boolean;
  onUpdateStatusDonatur: (idDonatur: string, status: StatusAktif) => Promise<void>;
  onSubmitDonatur: (
    payload: RegisterDonaturPayload
  ) => Promise<{
    ok: boolean;
    message: string;
    donatur?: Donatur;
    existingDonatur?: Partial<Donatur>;
    notifStatus?: NotifDeliveryResult;
  }>;
  onGoToKonfirmasiBulan: (donatur: Donatur, targetMonth?: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

type DonorSortField = 'nama' | 'terdaftar' | 'wilayah' | 'nominal' | 'tanggal' | 'statusBayar';

interface DonorWithMonthlyStatus {
  donatur: Donatur;
  statusBulan: StatusBayarBulan;
  totalValidBulanIni: number;
  totalLainnyaBulanIni: number;
  totalPendingBulanIni: number;
}

const AKTIF_OPTIONS: SearchableOption[] = [
  { value: 'Semua', label: 'Keaktifan: Semua', keywords: 'semua' },
  { value: 'Aktif', label: 'Status Aktif', keywords: 'aktif' },
  { value: 'Non Aktif', label: 'Status Non Aktif', keywords: 'non aktif nonaktif' },
];

const DONOR_SORT_OPTIONS: SearchableOption[] = [
  { value: 'nama', label: 'Urut: Nama Donatur', keywords: 'nama' },
  { value: 'terdaftar', label: 'Urut: Tgl Terdaftar', keywords: 'terdaftar daftar' },
  { value: 'wilayah', label: 'Urut: Wilayah', keywords: 'wilayah domisili kota' },
  { value: 'nominal', label: 'Urut: Nominal Komitmen', keywords: 'nominal komitmen' },
  { value: 'tanggal', label: 'Urut: Tgl Pengingat', keywords: 'tanggal pengingat' },
  { value: 'statusBayar', label: 'Urut: Status Pembayaran', keywords: 'status bayar valid' },
];

export const TabDonatur: React.FC<TabDonaturProps> = ({
  config,
  donaturList,
  transaksiList,
  panitiaList,
  isLoading,
  onUpdateStatusDonatur,
  onSubmitDonatur,
  onGoToKonfirmasiBulan,
  onNotify,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);

  const [donorMonth, setDonorMonth] = useState(getCurrentYearMonth());
  const [statusBayarFilter, setStatusBayarFilter] = useState<'Semua' | StatusBayarBulan>('Semua');
  const [pulauFilter, setPulauFilter] = useState('');
  const [provinsiFilter, setProvinsiFilter] = useState('');
  const [kabupatenFilter, setKabupatenFilter] = useState('');
  const [perantaraFilter, setPerantaraFilter] = useState('Semua');
  const [aktifFilter, setAktifFilter] = useState<'Semua' | StatusAktif>('Semua');
  const [genderFilter, setGenderFilter] = useState<'Semua' | 'Laki-laki' | 'Perempuan'>('Semua');
  const [donorSearch, setDonorSearch] = useState('');
  const [donorSortField, setDonorSortField] = useState<DonorSortField>('nama');
  const [donorSortDir, setDonorSortDir] = useState<'asc' | 'desc'>('asc');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [historyDonaturId, setHistoryDonaturId] = useState('');
  const [historyYear, setHistoryYear] = useState<number>(() =>
    Number(getCurrentYearMonth().slice(0, 4))
  );
  const historySectionRef = useRef<HTMLElement | null>(null);

  const wilayahByKabName = useMemo(() => {
    const map = new Map<string, (typeof WILAYAH_KABUPATEN)[number]>();
    WILAYAH_KABUPATEN.forEach((w) => {
      map.set(w.kab.toLowerCase(), w);
      map.set(w.kabId, w);
    });
    return map;
  }, []);

  const resolveDonorWilayah = (d: Donatur) => {
    const matched =
      (d.kabId ? wilayahByKabName.get(d.kabId) : undefined) ||
      (d.domisili ? wilayahByKabName.get(d.domisili.toLowerCase()) : undefined);
    return {
      kabId: d.kabId || matched?.kabId || '',
      kab: d.domisili || matched?.kab || '',
      provinsi: d.provinsi || matched?.prov || '',
      pulau: d.pulau || matched?.pulau || '',
    };
  };

  const pulauOptions = useMemo<SearchableOption[]>(() => {
    const map = new Map<string, string>();
    WILAYAH_KABUPATEN.forEach((w) => {
      if (!map.has(w.pulau)) map.set(w.pulau, w.pulauId);
    });
    return Array.from(map.entries()).map(([pulau, pulauId]) => ({
      value: pulau,
      label: pulau,
      metaRight: pulauId,
      keywords: `${pulau} ${pulauId}`,
    }));
  }, []);

  const provinsiOptions = useMemo<SearchableOption[]>(() => {
    const map = new Map<string, { provId: string; pulau: string }>();
    WILAYAH_KABUPATEN.forEach((w) => {
      if (pulauFilter && w.pulau !== pulauFilter) return;
      if (!map.has(w.prov)) map.set(w.prov, { provId: w.provId, pulau: w.pulau });
    });
    return Array.from(map.entries()).map(([prov, meta]) => ({
      value: prov,
      label: prov,
      sublabel: meta.pulau,
      metaRight: meta.provId,
      keywords: `${prov} ${meta.pulau} ${meta.provId}`,
    }));
  }, [pulauFilter]);

  const kabupatenOptions = useMemo<SearchableOption[]>(() => {
    return WILAYAH_KABUPATEN.filter((w) => {
      if (pulauFilter && w.pulau !== pulauFilter) return false;
      if (provinsiFilter && w.prov !== provinsiFilter) return false;
      return true;
    }).map((w) => ({
      value: w.kab,
      label: w.kab,
      sublabel: `${w.prov} · ${w.pulau}`,
      metaRight: w.kabId,
      keywords: `${w.kab} ${w.prov} ${w.pulau} ${w.kabId}`,
    }));
  }, [pulauFilter, provinsiFilter]);

  const perantaraOptions = useMemo<SearchableOption[]>(() => {
    const set = new Set<string>();
    panitiaList.forEach((p) => set.add(p.namaPanitia));
    donaturList.forEach((d) => {
      if (d.namaPerantara) set.add(d.namaPerantara);
    });
    return [
      { value: 'Semua', label: 'Perantara: Semua', keywords: 'semua' },
      ...Array.from(set).map((name) => {
        const matched = panitiaList.find((p) => p.namaPanitia === name);
        return {
          value: name,
          label: name,
          sublabel: matched
            ? `Kode ${matched.kodePanitia} · ${normalizeRoleLabel(matched.role)}`
            : undefined,
          keywords: `${name} ${matched?.kodePanitia || ''}`,
        };
      }),
    ];
  }, [panitiaList, donaturList]);

  const donorMonthTransaksi = useMemo(
    () => transaksiList.filter((t) => t.bulanTagihan === donorMonth),
    [transaksiList, donorMonth]
  );

  const donorRows: DonorWithMonthlyStatus[] = useMemo(() => {
    return donaturList.map((donatur) => {
      const donorWa = normalizeWA(donatur.noWa) || donatur.noWa;
      const matchingTrx = donorMonthTransaksi.filter((t) => {
        if (t.jenisDonatur === 'Umum' || t.idDonatur === 'UMUM') return false;
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
      const totalLainnyaBulanIni = validTrx.reduce(
        (sum, t) => sum + Math.max(0, t.donasiLainnya || 0),
        0
      );
      const totalPendingBulanIni = pendingTrx.reduce((sum, t) => sum + t.nominalTransfer, 0);

      let statusBulan: StatusBayarBulan = 'Belum Bayar';
      if (validTrx.length > 0) statusBulan = 'Lunas';
      else if (pendingTrx.length > 0) statusBulan = 'Menunggu Verifikasi';

      return {
        donatur,
        statusBulan,
        totalValidBulanIni,
        totalLainnyaBulanIni,
        totalPendingBulanIni,
      };
    });
  }, [donaturList, donorMonthTransaksi]);

  const donorFilterCounts = useMemo(
    () => ({
      Semua: donorRows.length,
      Lunas: donorRows.filter((r) => r.statusBulan === 'Lunas').length,
      'Menunggu Verifikasi': donorRows.filter((r) => r.statusBulan === 'Menunggu Verifikasi').length,
      'Belum Bayar': donorRows.filter((r) => r.statusBulan === 'Belum Bayar').length,
    }),
    [donorRows]
  );

  const filteredAndSortedDonors = useMemo(() => {
    const q = donorSearch.trim().toLowerCase();
    const filtered = donorRows.filter((row) => {
      const w = resolveDonorWilayah(row.donatur);
      if (statusBayarFilter !== 'Semua' && row.statusBulan !== statusBayarFilter) return false;
      if (aktifFilter !== 'Semua' && row.donatur.statusAktif !== aktifFilter) return false;
      if (genderFilter !== 'Semua' && row.donatur.jenisKelamin !== genderFilter) return false;
      if (pulauFilter && w.pulau !== pulauFilter) return false;
      if (provinsiFilter && w.provinsi !== provinsiFilter) return false;
      if (kabupatenFilter && w.kab !== kabupatenFilter) return false;
      if (perantaraFilter !== 'Semua' && row.donatur.namaPerantara !== perantaraFilter) return false;

      if (!q) return true;
      const d = row.donatur;
      return (
        d.namaLengkap.toLowerCase().includes(q) ||
        (d.jenisKelamin || '').toLowerCase().includes(q) ||
        d.noWa.toLowerCase().includes(q) ||
        (d.email || '').toLowerCase().includes(q) ||
        d.namaPerantara.toLowerCase().includes(q) ||
        w.kab.toLowerCase().includes(q) ||
        w.provinsi.toLowerCase().includes(q) ||
        w.pulau.toLowerCase().includes(q) ||
        d.idDonatur.toLowerCase().includes(q)
      );
    });

    const bayarRank: Record<StatusBayarBulan, number> = {
      Lunas: 1,
      'Menunggu Verifikasi': 2,
      'Belum Bayar': 3,
    };

    const dir = donorSortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (donorSortField) {
        case 'nama':
          cmp = a.donatur.namaLengkap.localeCompare(b.donatur.namaLengkap, 'id');
          break;
        case 'wilayah': {
          const wa = resolveDonorWilayah(a.donatur).kab || a.donatur.namaPerantara;
          const wb = resolveDonorWilayah(b.donatur).kab || b.donatur.namaPerantara;
          cmp = wa.localeCompare(wb, 'id');
          break;
        }
        case 'nominal':
          cmp = a.donatur.nominalKomitmen - b.donatur.nominalKomitmen;
          break;
        case 'tanggal':
          cmp = a.donatur.tglJatuhTempo - b.donatur.tglJatuhTempo;
          break;
        case 'statusBayar':
          cmp = bayarRank[a.statusBulan] - bayarRank[b.statusBulan];
          break;
        case 'terdaftar': {
          const ymA = extractYearMonthFromDateStr(a.donatur.tanggalDaftar);
          const ymB = extractYearMonthFromDateStr(b.donatur.tanggalDaftar);
          cmp = (ymA || a.donatur.tanggalDaftar).localeCompare(ymB || b.donatur.tanggalDaftar);
          break;
        }
      }
      if (cmp === 0) {
        return a.donatur.namaLengkap.localeCompare(b.donatur.namaLengkap, 'id');
      }
      return cmp * dir;
    });
  }, [
    donorRows,
    statusBayarFilter,
    aktifFilter,
    genderFilter,
    pulauFilter,
    provinsiFilter,
    kabupatenFilter,
    perantaraFilter,
    donorSearch,
    donorSortField,
    donorSortDir,
  ]);

  const summaryStats = useMemo(() => {
    const aktifCount = filteredAndSortedDonors.filter(
      (r) => r.donatur.statusAktif === 'Aktif'
    ).length;
    const totalKomitmenRp = filteredAndSortedDonors
      .filter((r) => r.donatur.statusAktif === 'Aktif')
      .reduce((sum, r) => sum + r.donatur.nominalKomitmen, 0);
    const lunasCount = filteredAndSortedDonors.filter((r) => r.statusBulan === 'Lunas').length;
    return {
      total: filteredAndSortedDonors.length,
      aktifCount,
      totalKomitmenRp,
      lunasCount,
    };
  }, [filteredAndSortedDonors]);

  const handleDonorSort = (field: DonorSortField) => {
    if (donorSortField === field) {
      setDonorSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setDonorSortField(field);
      setDonorSortDir(field === 'nominal' || field === 'terdaftar' ? 'desc' : 'asc');
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

  const handlePulauChange = (nextPulau: string) => {
    setPulauFilter(nextPulau);
    if (nextPulau) {
      if (provinsiFilter) {
        const validProv = WILAYAH_KABUPATEN.some(
          (w) => w.pulau === nextPulau && w.prov === provinsiFilter
        );
        if (!validProv) setProvinsiFilter('');
      }
      if (kabupatenFilter) {
        const validKab = WILAYAH_KABUPATEN.some(
          (w) => w.pulau === nextPulau && w.kab === kabupatenFilter
        );
        if (!validKab) setKabupatenFilter('');
      }
    }
  };

  const handleProvinsiChange = (nextProv: string) => {
    setProvinsiFilter(nextProv);
    if (nextProv && kabupatenFilter) {
      const validKab = WILAYAH_KABUPATEN.some(
        (w) => w.prov === nextProv && w.kab === kabupatenFilter
      );
      if (!validKab) setKabupatenFilter('');
    }
  };

  const handleInspectDonorHistory = (donaturId: string) => {
    setHistoryDonaturId(donaturId);
    const yr = Number(donorMonth.slice(0, 4));
    if (Number.isFinite(yr)) setHistoryYear(yr);
    window.setTimeout(() => {
      historySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleToggleStatus = async (donatur: Donatur) => {
    const nextStatus: StatusAktif = donatur.statusAktif === 'Aktif' ? 'Non Aktif' : 'Aktif';
    setUpdatingId(donatur.idDonatur);
    await onUpdateStatusDonatur(donatur.idDonatur, nextStatus);
    setUpdatingId(null);
  };

  if (showAddForm) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowAddForm(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            <span>Kembali ke Daftar Donatur</span>
          </button>
        </div>

        <TabPendaftaran
          config={config}
          panitia={panitiaList}
          referralCode={null}
          onSubmitDonatur={onSubmitDonatur}
          onGoToKonfirmasi={(donatur) => {
            setShowAddForm(false);
            onGoToKonfirmasiBulan(donatur);
          }}
          onNotify={onNotify}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Tombol Tambah Donatur */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Daftar Donatur &amp; Riwayat Pembayaran
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 safe-wrap">
            Kelola seluruh donatur rutin Kafalah Dai dengan filter wilayah, perantara, status
            keaktifan, jenis kelamin, serta riwayat pembayaran per bulan.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
        >
          <UserPlus className="h-4 w-4 shrink-0" />
          <span>Daftarkan Donatur Baru</span>
        </button>
      </div>

      {/* Ringkasan Filter Aktif */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-surface rounded-3xl p-5 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Donatur Ditampilkan (Sesuai Filter)
          </p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {summaryStats.total}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {summaryStats.aktifCount} Aktif · {summaryStats.total - summaryStats.aktifCount} Non
            Aktif
          </p>
        </div>

        <div className="glass-surface rounded-3xl p-5 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Komitmen Aktif (Filter)
          </p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
            {formatRupiah(summaryStats.totalKomitmenRp)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Potensi per bulan dari donatur aktif terpilih
          </p>
        </div>

        <div className="glass-surface rounded-3xl p-5 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Sudah Lunas ({formatBulanLabel(donorMonth)})
          </p>
          <p className="mt-1.5 text-2xl font-bold text-teal-800 dark:text-teal-300 tabular-nums">
            {summaryStats.lunasCount} / {summaryStats.total}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Berdasarkan transaksi terverifikasi valid
          </p>
        </div>
      </section>

      {/* Tabel Donatur Lengkap dengan Multi-Filter & Sort */}
      <section className="glass-surface rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Data Donatur — {formatBulanLabel(donorMonth)}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Filter berdasarkan wilayah (pulau, provinsi, kabupaten), pengurus/perantara, status
                bayar, jenis kelamin, dan keaktifan.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <div className="relative flex items-center">
                <Calendar className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                <input
                  type="month"
                  aria-label="Pilih bulan status donatur"
                  value={donorMonth}
                  onChange={(e) => setDonorMonth(e.target.value)}
                  className="w-full sm:w-auto rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 pl-9 pr-3 py-2 text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={donorSearch}
                  onChange={(e) => setDonorSearch(e.target.value)}
                  placeholder="Cari nama, ID, WA, kabupaten, provinsi..."
                  className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100/85 dark:bg-slate-800/80 p-1.5 w-full xl:w-fit">
              {(['Semua', 'Lunas', 'Menunggu Verifikasi', 'Belum Bayar'] as const).map((tab) => {
                const active = statusBayarFilter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusBayarFilter(tab)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab}{' '}
                    <span className="tabular-nums opacity-75">({donorFilterCounts[tab]})</span>
                  </button>
                );
              })}
            </div>

            <div
              role="radiogroup"
              aria-label="Filter jenis kelamin donatur"
              className="flex items-center gap-1 rounded-2xl bg-slate-100/85 dark:bg-slate-800/80 p-1.5 w-full sm:w-fit"
            >
              {(
                [
                  { value: 'Semua', label: 'Semua Gender' },
                  { value: 'Laki-laki', label: 'Laki-laki' },
                  { value: 'Perempuan', label: 'Perempuan' },
                ] as const
              ).map((opt) => {
                const active = genderFilter === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex-1 sm:flex-none text-center rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer select-none ${
                      active
                        ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="donatur-gender-filter"
                      value={opt.value}
                      checked={active}
                      onChange={() => setGenderFilter(opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Filter Wilayah Berjenjang */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <SearchableSelect
              ariaLabel="Filter berdasarkan pulau"
              options={pulauOptions}
              value={pulauFilter}
              onChange={handlePulauChange}
              allowClear
              compact
              placeholder="Pulau: Semua"
              searchPlaceholder="Ketik nama pulau..."
            />
            <SearchableSelect
              ariaLabel="Filter berdasarkan provinsi"
              options={provinsiOptions}
              value={provinsiFilter}
              onChange={handleProvinsiChange}
              allowClear
              compact
              placeholder="Provinsi: Semua"
              searchPlaceholder="Ketik nama provinsi..."
            />
            <SearchableSelect
              ariaLabel="Filter berdasarkan kabupaten atau kota"
              options={kabupatenOptions}
              value={kabupatenFilter}
              onChange={(val) => setKabupatenFilter(val)}
              allowClear
              compact
              placeholder="Kabupaten / Kota: Semua"
              searchPlaceholder="Ketik nama kabupaten atau kota..."
            />
          </div>

          {/* Perantara, Keaktifan & Sort */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <SearchableSelect
              ariaLabel="Filter pengurus atau perantara"
              options={perantaraOptions}
              value={perantaraFilter}
              onChange={(val) => setPerantaraFilter(val || 'Semua')}
              compact
              searchPlaceholder="Ketik nama pengurus/perantara..."
            />
            <SearchableSelect
              ariaLabel="Filter status keaktifan donatur"
              options={AKTIF_OPTIONS}
              value={aktifFilter}
              onChange={(val) => setAktifFilter((val || 'Semua') as 'Semua' | StatusAktif)}
              compact
              searchPlaceholder="Filter keaktifan..."
            />
            <div className="flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  ariaLabel="Urutkan data donatur"
                  options={DONOR_SORT_OPTIONS}
                  value={donorSortField}
                  onChange={(val) => setDonorSortField((val || 'nama') as DonorSortField)}
                  compact
                  searchPlaceholder="Urutkan berdasarkan..."
                />
              </div>
              <button
                type="button"
                onClick={() => setDonorSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                title={donorSortDir === 'asc' ? 'Urutan Naik' : 'Urutan Turun'}
                aria-label="Ubah arah urutan"
              >
                {donorSortDir === 'asc' ? (
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
        ) : filteredAndSortedDonors.length === 0 ? (
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
                ? 'Mulai daftarkan donatur rutin pertama menggunakan tombol Daftarkan Donatur Baru.'
                : 'Coba ubah filter wilayah, status, atau kata kunci pencarian.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto clean-scroll">
            <table className="w-full min-w-[920px] text-left border-collapse">
              <thead>
                <tr className="bg-emerald-800 dark:bg-emerald-950 text-white dark:text-emerald-100 text-[11px] font-semibold">
                  <th className="py-3.5 pl-5 pr-3 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleDonorSort('nama')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Donatur &amp; Kontak</span>
                      {renderSortIcon(donorSortField === 'nama', donorSortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleDonorSort('terdaftar')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Tgl Terdaftar</span>
                      {renderSortIcon(donorSortField === 'terdaftar', donorSortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleDonorSort('wilayah')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Wilayah &amp; Perantara</span>
                      {renderSortIcon(donorSortField === 'wilayah', donorSortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDonorSort('nominal')}
                      className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                    >
                      <span>Komitmen</span>
                      {renderSortIcon(donorSortField === 'nominal', donorSortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleDonorSort('statusBayar')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Status Bulan Ini</span>
                      {renderSortIcon(donorSortField === 'statusBayar', donorSortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 pl-4 pr-5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-sm">
                {filteredAndSortedDonors.map((row, index) => {
                  const { donatur, statusBulan, totalValidBulanIni, totalLainnyaBulanIni } = row;
                  const wilayah = resolveDonorWilayah(donatur);
                  const isNonAktif = donatur.statusAktif === 'Non Aktif';
                  const isUpdating = updatingId === donatur.idDonatur;
                  const waLink = buildReminderWaLink(donatur, donorMonth, config);
                  const regYm = extractYearMonthFromDateStr(donatur.tanggalDaftar);

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
                          {donatur.jenisKelamin ? ` · ${donatur.jenisKelamin}` : ''}
                        </p>
                        {donatur.email && (
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                            {donatur.email}
                          </p>
                        )}
                        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 font-mono safe-wrap">
                          {donatur.idDonatur} · {donatur.statusAktif} · Grup:{' '}
                          {normalizeStatusGrup(donatur.statusGrupWa) === 'Sudah Bergabung'
                            ? 'Gabung'
                            : normalizeMinatGrup(donatur.minatGrupWa) === 'Ya'
                            ? 'Minat'
                            : 'Japri'}
                        </p>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                          {donatur.tanggalDaftar ? donatur.tanggalDaftar.split(',')[0] : '-'}
                        </p>
                        {regYm && (
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {formatBulanLabel(regYm)}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-4 min-w-0 max-w-[230px]">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 safe-wrap">
                          {wilayah.kab || 'Domisili belum diisi'}
                        </p>
                        {(wilayah.provinsi || wilayah.pulau) && (
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                            {[wilayah.provinsi, wilayah.pulau].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 safe-wrap">
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
                        {totalLainnyaBulanIni > 0 && (
                          <p className="mt-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300 tabular-nums">
                            +{formatRupiah(totalLainnyaBulanIni)} Lainnya
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
                            <span>{isNonAktif ? 'Non Aktif' : 'Belum Bayar'}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 pl-4 pr-5 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleInspectDonorHistory(donatur.idDonatur)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/50 px-3 py-2 text-xs font-semibold text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            title="Lihat riwayat pembayaran donatur per bulan"
                          >
                            <History className="h-3.5 w-3.5 shrink-0" />
                            <span>Riwayat</span>
                          </button>

                          {statusBulan === 'Belum Bayar' && !isNonAktif && (
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
                            onClick={() => void handleToggleStatus(donatur)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isNonAktif ? (
                              <>
                                <PlayCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>{isUpdating ? 'Menyimpan...' : 'Aktifkan'}</span>
                              </>
                            ) : (
                              <>
                                <PauseCircle className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                                <span>{isUpdating ? 'Menyimpan...' : 'Nonaktifkan'}</span>
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

      {/* Pengecekan Riwayat Pembayaran Per Donatur */}
      <DonorHistorySection
        config={config}
        donaturList={donaturList}
        transaksiList={transaksiList}
        selectedDonaturId={historyDonaturId}
        onSelectDonaturId={setHistoryDonaturId}
        selectedYear={historyYear}
        onSelectYear={setHistoryYear}
        onGoToKonfirmasiBulan={onGoToKonfirmasiBulan}
        sectionRef={historySectionRef}
      />
    </div>
  );
};
