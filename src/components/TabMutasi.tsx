import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  History,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  ReceiptText,
  Search,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { WILAYAH_KABUPATEN } from '../data/wilayah';
import {
  Donatur,
  JenisDonatur,
  LembagaConfig,
  Panitia,
  StatusAktif,
  StatusBayarBulan,
  StatusVerifikasi,
  TransaksiDonasi,
} from '../types';
import {
  buildReminderWaLink,
  extractYearMonthFromDateStr,
  formatBulanLabel,
  formatRupiah,
  formatTanggalIndo,
  formatWADisplay,
  getCurrentYearMonth,
  normalizeMinatGrup,
  normalizeRoleLabel,
  normalizeStatusGrup,
  normalizeWA,
} from '../utils/formatters';
import { DonorHistorySection } from './DonorHistorySection';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

interface TabMutasiProps {
  config: LembagaConfig;
  donaturList: Donatur[];
  transaksiList: TransaksiDonasi[];
  panitiaList: Panitia[];
  isLoading: boolean;
  initialSubView?: 'mutasi' | 'donatur';
  onUpdateStatusDonatur: (idDonatur: string, status: StatusAktif) => Promise<void>;
  onGoToPendaftaran: () => void;
  onGoToKonfirmasiBulan: (donatur: Donatur, targetMonth?: string) => void;
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

type DonorSortField = 'nama' | 'terdaftar' | 'wilayah' | 'nominal' | 'tanggal' | 'statusBayar';

interface DonorWithMonthlyStatus {
  donatur: Donatur;
  statusBulan: StatusBayarBulan;
  totalValidBulanIni: number;
  totalLainnyaBulanIni: number;
  totalPendingBulanIni: number;
}

const MUTASI_JENIS_OPTIONS: SearchableOption[] = [
  { value: 'Semua', label: 'Sumber: Semua Donatur', keywords: 'semua' },
  { value: 'Rutin', label: 'Donatur Rutin', keywords: 'rutin terdaftar' },
  { value: 'Umum', label: 'Donatur Umum', keywords: 'umum non terdaftar hamba allah' },
];

const MUTASI_KATEGORI_OPTIONS: SearchableOption[] = [
  { value: 'Semua', label: 'Kategori Dana: Semua', keywords: 'semua' },
  { value: 'Lainnya', label: 'Ada Donasi Lainnya (Kelebihan)', keywords: 'lainnya kelebihan lebih' },
  { value: 'Komitmen', label: 'Komitmen Rutin Saja', keywords: 'komitmen rutin' },
  { value: 'Umum', label: 'Khusus Donatur Umum', keywords: 'umum non terdaftar' },
];

const MUTASI_SORT_OPTIONS: SearchableOption[] = [
  { value: 'tanggalTransfer', label: 'Urut: Tgl Transfer', keywords: 'tanggal transfer' },
  { value: 'waktuInput', label: 'Urut: Waktu Input', keywords: 'waktu input' },
  { value: 'bulanTagihan', label: 'Urut: Periode Bulan', keywords: 'bulan periode' },
  { value: 'namaDonatur', label: 'Urut: Nama Donatur', keywords: 'nama donatur' },
  { value: 'nominalTransfer', label: 'Urut: Total Transfer', keywords: 'total nominal transfer' },
  { value: 'donasiLainnya', label: 'Urut: Donasi Lainnya', keywords: 'donasi lainnya kelebihan' },
  { value: 'statusVerifikasi', label: 'Urut: Status Verifikasi', keywords: 'status verifikasi' },
];

const AKTIF_OPTIONS: SearchableOption[] = [
  { value: 'Semua', label: 'Keaktifan: Semua', keywords: 'semua' },
  { value: 'Aktif', label: 'Status Aktif', keywords: 'aktif' },
  { value: 'Non Aktif', label: 'Status Non Aktif', keywords: 'non aktif nonaktif cuti' },
];

const DONOR_SORT_OPTIONS: SearchableOption[] = [
  { value: 'nama', label: 'Urut: Nama Donatur', keywords: 'nama' },
  { value: 'terdaftar', label: 'Urut: Tgl Terdaftar', keywords: 'terdaftar daftar' },
  { value: 'wilayah', label: 'Urut: Wilayah', keywords: 'wilayah domisili kota' },
  { value: 'nominal', label: 'Urut: Nominal Komitmen', keywords: 'nominal komitmen' },
  { value: 'tanggal', label: 'Urut: Tgl Pengingat', keywords: 'tanggal pengingat' },
  { value: 'statusBayar', label: 'Urut: Status Pembayaran', keywords: 'status bayar valid' },
];

export const TabMutasi: React.FC<TabMutasiProps> = ({
  config,
  donaturList,
  transaksiList,
  panitiaList,
  isLoading,
  initialSubView = 'mutasi',
  onUpdateStatusDonatur,
  onGoToPendaftaran,
  onGoToKonfirmasiBulan,
}) => {
  const [subView, setSubView] = useState<'mutasi' | 'donatur'>(initialSubView);

  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  // ===== State Sub-View 1: Mutasi Dana Masuk =====
  const [periodMode, setPeriodMode] = useState<'semua' | 'bulan'>('semua');
  const [mutasiMonth, setMutasiMonth] = useState(getCurrentYearMonth());
  const [statusVerifFilter, setStatusVerifFilter] = useState<'Semua' | StatusVerifikasi>('Semua');
  const [jenisFilter, setJenisFilter] = useState<'Semua' | JenisDonatur>('Semua');
  const [kategoriFilter, setKategoriFilter] = useState<KategoriDanaFilter>('Semua');
  const [mutasiSearch, setMutasiSearch] = useState('');
  const [mutasiSortField, setMutasiSortField] = useState<MutasiSortField>('tanggalTransfer');
  const [mutasiSortDir, setMutasiSortDir] = useState<'asc' | 'desc'>('desc');
  const [previewModalTrx, setPreviewModalTrx] = useState<TransaksiDonasi | null>(null);

  // ===== State Sub-View 2: Daftar Donatur & Riwayat =====
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

  // ===== Computations: Mutasi Dana Masuk =====
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
    const q = mutasiSearch.trim().toLowerCase();
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
    mutasiSearch,
    mutasiSortField,
    mutasiSortDir,
  ]);

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

  // ===== Computations: Daftar Donatur & Riwayat =====
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

  return (
    <div className="space-y-6">
      {/* Header & Switcher Mutasi / Daftar Donatur */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {subView === 'mutasi'
              ? 'Mutasi Dana Masuk'
              : 'Daftar Donatur & Riwayat Pembayaran'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 safe-wrap">
            {subView === 'mutasi'
              ? 'Daftar seluruh dana masuk dari donatur rutin, donasi lainnya (kelebihan komitmen), dan donatur umum dengan filter periode bulan atau keseluruhan.'
              : `Pantau status keaktifan, pengingat rutin, dan riwayat per donatur pada periode ${formatBulanLabel(donorMonth)}.`}
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-2xl glass-surface p-1.5 w-full sm:w-fit shrink-0">
          <button
            type="button"
            onClick={() => setSubView('mutasi')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              subView === 'mutasi'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ReceiptText className="h-3.5 w-3.5 shrink-0" />
            <span>Mutasi Dana Masuk ({transaksiList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('donatur')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              subView === 'donatur'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>Daftar &amp; Riwayat Donatur ({donaturList.length})</span>
          </button>
        </div>
      </div>

      {subView === 'mutasi' ? (
        <>
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
                Donasi Komitmen Rutin
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-teal-800 dark:text-teal-300 tabular-nums safe-wrap">
                {formatRupiah(mutasiTotals.totalKomitmenRp)}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
                Porsi komitmen bulanan donatur terdaftar
              </p>
            </div>

            <div className="glass-surface rounded-3xl p-5 min-w-0">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Donasi Lainnya (Kelebihan)
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
                Donatur Umum (Non-Terdaftar)
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-indigo-700 dark:text-indigo-300 tabular-nums safe-wrap">
                {formatRupiah(mutasiTotals.totalUmumRp)}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
                {mutasiTotals.umumCount} transaksi dari donatur umum / insidental
              </p>
            </div>
          </section>

          {/* Filter & Tabel Mutasi */}
          <section className="glass-surface rounded-3xl overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Filter Periode: Keseluruhan vs Per Bulan */}
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

                {/* Pencarian */}
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

              {/* Filter Status Verifikasi */}
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

              {/* Filter Sumber, Kategori Dana & Urutan */}
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
                  Tidak ada transaksi yang cocok dengan filter saat ini. Coba ubah periode atau
                  pilihan filter di atas.
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
                          <span>Donasi Lainnya</span>
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
                    {filteredMutasi.map((trx, index) => {
                      const isUmum = trx.jenisDonatur === 'Umum' || trx.idDonatur === 'UMUM';
                      const hasWa = Boolean(trx.noWa && trx.noWa !== '-');
                      const hasExternalUrl =
                        trx.linkBuktiDrive.startsWith('http://') ||
                        trx.linkBuktiDrive.startsWith('https://');
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
                            {index + 1}
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
                                className={`rounded-lg px-1.5 py-0.5 text-[10px] font-bold ${
                                  isUmum
                                    ? 'bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                    : 'bg-emerald-100/80 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800'
                                }`}
                              >
                                {isUmum ? 'Donatur Umum' : 'Donatur Rutin'}
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
                                Umum
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

                            {hasExternalUrl && (
                              <a
                                href={trx.linkBuktiDrive}
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
                            {!hasExternalUrl && !hasLocalDataUrl && (
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
          </section>
        </>
      ) : (
        <>
          {/* Sub-View 2: Daftar Donatur & Status Bulanan */}
          <section className="glass-surface rounded-3xl overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Daftar Status Donatur — {formatBulanLabel(donorMonth)}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Filter berdasarkan wilayah (pulau, provinsi, kabupaten), pengurus, status
                    bayar, dan keaktifan.
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
                      placeholder="Cari nama, WA, kabupaten, provinsi..."
                      className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100/85 dark:bg-slate-800/80 p-1.5 w-full xl:w-fit">
                  {(['Semua', 'Lunas', 'Menunggu Verifikasi', 'Belum Bayar'] as const).map(
                    (tab) => {
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
                          <span className="tabular-nums opacity-75">
                            ({donorFilterCounts[tab]})
                          </span>
                        </button>
                      );
                    }
                  )}
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
                          name="mutasi-gender-filter"
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

              {/* Wilayah Filter Row */}
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
                    ? 'Mulai daftarkan donatur rutin pertama melalui halaman Pendaftaran.'
                    : 'Coba ubah filter wilayah, status, atau kata kunci pencarian.'}
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
                      const { donatur, statusBulan, totalValidBulanIni, totalLainnyaBulanIni } =
                        row;
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
        </>
      )}

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
