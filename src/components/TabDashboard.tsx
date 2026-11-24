import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  ArrowUpAZ,
  ArrowUpDown,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  History,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Search,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';
import { WILAYAH_KABUPATEN } from '../data/wilayah';
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
import { DashboardCharts } from './DashboardCharts';
import { DonorHistorySection } from './DonorHistorySection';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

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
  onGoToKonfirmasiBulan: (donatur: Donatur, targetMonth?: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

interface DonorWithMonthlyStatus {
  donatur: Donatur;
  statusBulan: StatusBayarBulan;
  totalValidBulanIni: number;
  totalPendingBulanIni: number;
  validTransaksiBulanIni: TransaksiDonasi[];
  statusPenyaluranBulan:
    | 'Sudah Disalurkan'
    | 'Sebagian Disalurkan'
    | 'Belum Disalurkan'
    | 'Belum Ada Donasi';
}

type SortField =
  | 'nama'
  | 'terdaftar'
  | 'wilayah'
  | 'nominal'
  | 'tanggal'
  | 'statusBayar'
  | 'statusSalur';
type SummaryTab = 'pulau' | 'provinsi' | 'kabupaten' | 'panitia' | 'metode';
type SummarySortField =
  | 'label'
  | 'activeCount'
  | 'lunasBulanIni'
  | 'validBulanRp'
  | 'salurBulanRp'
  | 'validSemuaRp';

const PENYALURAN_OPTIONS: SearchableOption[] = [
  { value: 'Semua', label: 'Penyaluran: Semua', keywords: 'semua' },
  { value: 'Sudah Disalurkan', label: 'Sudah Disalurkan', keywords: 'sudah' },
  { value: 'Belum Disalurkan', label: 'Belum Disalurkan', keywords: 'belum' },
];

const AKTIF_OPTIONS: SearchableOption[] = [
  { value: 'Semua', label: 'Keaktifan: Semua', keywords: 'semua' },
  { value: 'Aktif', label: 'Status Aktif', keywords: 'aktif' },
  { value: 'Cuti', label: 'Status Cuti', keywords: 'cuti' },
];

const SORT_OPTIONS: SearchableOption[] = [
  { value: 'nama', label: 'Urut: Nama Donatur', keywords: 'nama' },
  { value: 'terdaftar', label: 'Urut: Tgl Terdaftar', keywords: 'terdaftar daftar' },
  { value: 'wilayah', label: 'Urut: Wilayah', keywords: 'wilayah domisili kota' },
  { value: 'nominal', label: 'Urut: Nominal Komitmen', keywords: 'nominal komitmen' },
  { value: 'tanggal', label: 'Urut: Tgl Pengingat', keywords: 'tanggal pengingat' },
  { value: 'statusBayar', label: 'Urut: Status Pembayaran', keywords: 'status bayar valid' },
  { value: 'statusSalur', label: 'Urut: Status Penyaluran', keywords: 'status salur' },
];

export const TabDashboard: React.FC<TabDashboardProps> = ({
  config,
  donaturList,
  transaksiList,
  panitiaList,
  isLoading,
  onUpdateStatusDonatur,
  onUpdateStatusPenyaluran,
  onGoToPendaftaran,
  onGoToKonfirmasiBulan,
  onNotify,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [statusFilter, setStatusFilter] = useState<'Semua' | StatusBayarBulan>('Semua');
  const [penyaluranFilter, setPenyaluranFilter] = useState<
    'Semua' | 'Sudah Disalurkan' | 'Belum Disalurkan'
  >('Semua');
  const [pulauFilter, setPulauFilter] = useState<string>('');
  const [provinsiFilter, setProvinsiFilter] = useState<string>('');
  const [kabupatenFilter, setKabupatenFilter] = useState<string>('');
  const [perantaraFilter, setPerantaraFilter] = useState<string>('Semua');
  const [aktifFilter, setAktifFilter] = useState<'Semua' | StatusAktif>('Semua');
  const [genderFilter, setGenderFilter] = useState<'Semua' | 'Laki-laki' | 'Perempuan'>('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  const [sortField, setSortField] = useState<SortField>('nama');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [summaryTab, setSummaryTab] = useState<SummaryTab>('pulau');
  const [summarySortField, setSummarySortField] = useState<SummarySortField>('validBulanRp');
  const [summarySortDir, setSummarySortDir] = useState<'asc' | 'desc'>('desc');

  const [historyDonaturId, setHistoryDonaturId] = useState('');
  const [historyYear, setHistoryYear] = useState<number>(() =>
    Number(getCurrentYearMonth().slice(0, 4))
  );
  const historySectionRef = useRef<HTMLElement | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingSalurDonorId, setUpdatingSalurDonorId] = useState<string | null>(null);
  const [copiedKode, setCopiedKode] = useState<string | null>(null);

  const monthTransaksi = useMemo(
    () => transaksiList.filter((t) => t.bulanTagihan === selectedMonth),
    [transaksiList, selectedMonth]
  );

  // Peta lookup wilayah dari kode/nama kabupaten untuk fallback data lama
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

  // Opsi filter Pulau, Provinsi, dan Kabupaten/Kota (bertingkat)
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

      let statusPenyaluranBulan: DonorWithMonthlyStatus['statusPenyaluranBulan'] =
        'Belum Ada Donasi';
      if (validTrx.length > 0) {
        const salurCount = validTrx.filter(
          (t) => t.statusPenyaluran === 'Sudah Disalurkan'
        ).length;
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

  const overallMetrics = useMemo(() => {
    const allValid = transaksiList.filter((t) => t.statusVerifikasi === 'Valid');
    const allPending = transaksiList.filter((t) => t.statusVerifikasi === 'Pending');
    const allDisalurkan = allValid.filter((t) => t.statusPenyaluran === 'Sudah Disalurkan');
    const allBelumDisalurkan = allValid.filter((t) => t.statusPenyaluran !== 'Sudah Disalurkan');

    const totalValidRp = allValid.reduce((s, t) => s + t.nominalTransfer, 0);
    const totalLainnyaValidRp = allValid.reduce((s, t) => s + Math.max(0, t.donasiLainnya || 0), 0);
    const totalKomitmenValidRp = Math.max(0, totalValidRp - totalLainnyaValidRp);
    const totalDisalurkanRp = allDisalurkan.reduce((s, t) => s + t.nominalTransfer, 0);
    const totalBelumDisalurkanRp = allBelumDisalurkan.reduce((s, t) => s + t.nominalTransfer, 0);
    const activeCount = donaturList.filter((d) => d.statusAktif === 'Aktif').length;
    const cutiCount = donaturList.length - activeCount;
    const grupMinatCount = donaturList.filter((d) => normalizeMinatGrup(d.minatGrupWa) === 'Ya').length;
    const grupJoinedCount = donaturList.filter(
      (d) => normalizeStatusGrup(d.statusGrupWa) === 'Sudah Bergabung'
    ).length;

    return {
      totalValidRp,
      totalKomitmenValidRp,
      totalLainnyaValidRp,
      validCount: allValid.length,
      totalDisalurkanRp,
      disalurkanCount: allDisalurkan.length,
      totalBelumDisalurkanRp,
      belumDisalurkanCount: allBelumDisalurkan.length,
      pendingCount: allPending.length,
      totalDonatur: donaturList.length,
      activeCount,
      cutiCount,
      grupMinatCount,
      grupJoinedCount,
    };
  }, [transaksiList, donaturList]);

  const monthlyMetrics = useMemo(() => {
    const validMonthTrx = monthTransaksi.filter((t) => t.statusVerifikasi === 'Valid');
    const pendingMonthTrx = monthTransaksi.filter((t) => t.statusVerifikasi === 'Pending');
    const disalurkanMonthTrx = validMonthTrx.filter(
      (t) => t.statusPenyaluran === 'Sudah Disalurkan'
    );

    const totalValidRp = validMonthTrx.reduce((sum, t) => sum + t.nominalTransfer, 0);
    const totalLainnyaValidRp = validMonthTrx.reduce(
      (sum, t) => sum + Math.max(0, t.donasiLainnya || 0),
      0
    );
    const totalKomitmenValidRp = Math.max(0, totalValidRp - totalLainnyaValidRp);
    const totalDisalurkanRp = disalurkanMonthTrx.reduce((sum, t) => sum + t.nominalTransfer, 0);
    const totalPendingRp = pendingMonthTrx.reduce((sum, t) => sum + t.nominalTransfer, 0);

    const activeDonors = donorRows.filter((r) => r.donatur.statusAktif === 'Aktif');
    const lunasActiveCount = activeDonors.filter((r) => r.statusBulan === 'Lunas').length;
    const komitmenBulanIniRp = activeDonors.reduce((sum, r) => sum + r.donatur.nominalKomitmen, 0);
    const donaturBaruBulanIni = donaturList.filter(
      (d) => extractYearMonthFromDateStr(d.tanggalDaftar) === selectedMonth
    ).length;
    const compliancePct =
      activeDonors.length > 0
        ? Math.round((lunasActiveCount / activeDonors.length) * 1000) / 10
        : 0;

    return {
      totalValidRp,
      totalKomitmenValidRp,
      totalLainnyaValidRp,
      validCount: validMonthTrx.length,
      totalDisalurkanRp,
      disalurkanCount: disalurkanMonthTrx.length,
      totalPendingRp,
      pendingCount: pendingMonthTrx.length,
      activeCount: activeDonors.length,
      lunasActiveCount,
      komitmenBulanIniRp,
      donaturBaruBulanIni,
      compliancePct,
    };
  }, [monthTransaksi, donorRows, donaturList, selectedMonth]);

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
      const w = resolveDonorWilayah(row.donatur);
      if (statusFilter !== 'Semua' && row.statusBulan !== statusFilter) return false;
      if (aktifFilter !== 'Semua' && row.donatur.statusAktif !== aktifFilter) return false;
      if (genderFilter !== 'Semua' && row.donatur.jenisKelamin !== genderFilter) return false;
      if (pulauFilter && w.pulau !== pulauFilter) return false;
      if (provinsiFilter && w.provinsi !== provinsiFilter) return false;
      if (kabupatenFilter && w.kab !== kabupatenFilter) return false;
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
        case 'statusSalur':
          cmp = salurRank[a.statusPenyaluranBulan] - salurRank[b.statusPenyaluranBulan];
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
    statusFilter,
    aktifFilter,
    genderFilter,
    pulauFilter,
    provinsiFilter,
    kabupatenFilter,
    perantaraFilter,
    penyaluranFilter,
    searchQuery,
    sortField,
    sortDir,
  ]);

  const summaryRows = useMemo(() => {
    const getCategoryKey = (d: Donatur): string => {
      const w = resolveDonorWilayah(d);
      switch (summaryTab) {
        case 'pulau':
          return w.pulau || 'Belum Diisi';
        case 'provinsi':
          return w.provinsi || 'Belum Diisi';
        case 'kabupaten':
          return w.kab || 'Belum Diisi';
        case 'panitia':
          return d.namaPerantara || 'Langsung (Tanpa Perantara)';
        case 'metode':
          return d.metodeDaftar || 'Mandiri';
      }
    };

    const keySet = new Set<string>();
    if (summaryTab === 'panitia') {
      panitiaList.forEach((p) => keySet.add(p.namaPanitia));
    }
    donaturList.forEach((d) => keySet.add(getCategoryKey(d)));

    const rows = Array.from(keySet).map((label) => {
      const matchedPanitia =
        summaryTab === 'panitia' ? panitiaList.find((p) => p.namaPanitia === label) : undefined;

      const groupDonors = donorRows.filter((r) => getCategoryKey(r.donatur) === label);
      const activeGroup = groupDonors.filter((r) => r.donatur.statusAktif === 'Aktif');
      const lunasBulanIni = activeGroup.filter((r) => r.statusBulan === 'Lunas').length;

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

      let subtitle = '';
      if (matchedPanitia) {
        subtitle = `Kode ${matchedPanitia.kodePanitia} · ${normalizeRoleLabel(matchedPanitia.role)}`;
      } else if (summaryTab === 'kabupaten' && groupDonors.length > 0) {
        const w = resolveDonorWilayah(groupDonors[0].donatur);
        if (w.provinsi) subtitle = `${w.provinsi}${w.pulau ? ` · ${w.pulau}` : ''}`;
      } else if (summaryTab === 'provinsi' && groupDonors.length > 0) {
        const w = resolveDonorWilayah(groupDonors[0].donatur);
        if (w.pulau) subtitle = `Pulau ${w.pulau}`;
      }

      return {
        label,
        subtitle,
        kodePanitia: matchedPanitia?.kodePanitia || '',
        activeCount: activeGroup.length,
        totalDonatur: groupDonors.length,
        lunasBulanIni,
        validBulanRp,
        salurBulanRp,
        validSemuaRp,
      };
    });

    const dir = summarySortDir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      let cmp = 0;
      switch (summarySortField) {
        case 'label':
          cmp = a.label.localeCompare(b.label, 'id');
          break;
        case 'activeCount':
          cmp = a.activeCount - b.activeCount;
          break;
        case 'lunasBulanIni':
          cmp = a.lunasBulanIni - b.lunasBulanIni;
          break;
        case 'validBulanRp':
          cmp = a.validBulanRp - b.validBulanRp;
          break;
        case 'salurBulanRp':
          cmp = a.salurBulanRp - b.salurBulanRp;
          break;
        case 'validSemuaRp':
          cmp = a.validSemuaRp - b.validSemuaRp;
          break;
      }
      if (cmp === 0) return a.label.localeCompare(b.label, 'id');
      return cmp * dir;
    });
  }, [
    summaryTab,
    panitiaList,
    donaturList,
    donorRows,
    transaksiList,
    selectedMonth,
    summarySortField,
    summarySortDir,
  ]);

  const handleSortHeader = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'nominal' || field === 'terdaftar' ? 'desc' : 'asc');
    }
  };

  const handleSummarySortHeader = (field: SummarySortField) => {
    if (summarySortField === field) {
      setSummarySortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSummarySortField(field);
      setSummarySortDir(field === 'label' ? 'asc' : 'desc');
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

  const handleInspectDonorHistory = (donaturId: string) => {
    setHistoryDonaturId(donaturId);
    const yr = Number(selectedMonth.slice(0, 4));
    if (Number.isFinite(yr)) setHistoryYear(yr);
    window.setTimeout(() => {
      historySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Dashboard &amp; Pengingat Kafalah Dai
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

      {/* Rekap Keseluruhan */}
      <section className="glass-surface rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200/70 dark:border-slate-700/70">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Rekap Secara Keseluruhan (Seluruh Periode)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
              Akumulasi seluruh donasi terverifikasi, penyaluran, dan total donatur terdaftar di{' '}
              {config.namaLembaga}.
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
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
              {overallMetrics.validCount} transaksi valid
              {overallMetrics.totalLainnyaValidRp > 0
                ? ` · Komitmen ${formatRupiah(overallMetrics.totalKomitmenValidRp)} + Lainnya ${formatRupiah(overallMetrics.totalLainnyaValidRp)}`
                : ''}
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
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
              {overallMetrics.activeCount} Aktif · {overallMetrics.cutiCount} Cuti ·{' '}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                +{monthlyMetrics.donaturBaruBulanIni} baru
              </span>{' '}
              · Grup WA {overallMetrics.grupJoinedCount}/{overallMetrics.grupMinatCount}
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
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
            {monthlyMetrics.validCount} valid · Target{' '}
            {formatRupiah(monthlyMetrics.komitmenBulanIniRp)}
            {monthlyMetrics.totalLainnyaValidRp > 0
              ? ` · +${formatRupiah(monthlyMetrics.totalLainnyaValidRp)} lainnya`
              : ''}
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
              Kepatuhan &amp; Pertumbuhan
            </p>
            <span className="text-xs font-semibold text-teal-700 dark:text-teal-300 tabular-nums">
              {monthlyMetrics.lunasActiveCount}/{monthlyMetrics.activeCount}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-teal-800 dark:text-teal-300 tabular-nums">
            {monthlyMetrics.compliancePct.toFixed(1)}%
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-300"
              style={{ width: `${Math.min(100, monthlyMetrics.compliancePct)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            +{monthlyMetrics.donaturBaruBulanIni} donatur baru pada {formatBulanLabel(selectedMonth)}
          </p>
        </div>
      </section>

      {/* Grafik Komprehensif: Arus Dana & Pertambahan Donatur */}
      <DashboardCharts
        donaturList={donaturList}
        transaksiList={transaksiList}
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
      />

      {/* Donor Table & Multi-Level Wilayah + Status Filters */}
      <section className="glass-surface rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Daftar Status Donatur &amp; Penyaluran — {formatBulanLabel(selectedMonth)}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Filter berdasarkan wilayah (pulau, provinsi, kabupaten), pengurus, status bayar, dan
                penyaluran.
              </p>
            </div>

            <div className="relative w-full lg:w-80 shrink-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, WA, kabupaten, provinsi..."
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5">
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
                      name="dash-gender-filter"
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

          {/* Wilayah Filter Row (Pulau, Provinsi, Kabupaten/Kota) */}
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

          {/* Operational Filters & Sort */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <SearchableSelect
              ariaLabel="Filter status penyaluran"
              options={PENYALURAN_OPTIONS}
              value={penyaluranFilter}
              onChange={(val) =>
                setPenyaluranFilter(
                  (val || 'Semua') as 'Semua' | 'Sudah Disalurkan' | 'Belum Disalurkan'
                )
              }
              compact
              searchPlaceholder="Filter penyaluran..."
            />

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
                  options={SORT_OPTIONS}
                  value={sortField}
                  onChange={(val) => setSortField((val || 'nama') as SortField)}
                  compact
                  searchPlaceholder="Urutkan berdasarkan..."
                />
              </div>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                title={
                  sortDir === 'asc'
                    ? 'Urutan Naik (A–Z / Kecil–Besar)'
                    : 'Urutan Turun (Z–A / Besar–Kecil)'
                }
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
                ? 'Mulai daftarkan donatur rutin pertama melalui halaman Pendaftaran atau periksa koneksi layanan di menu Pengaturan.'
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
            <table className="w-full min-w-[1040px] text-left border-collapse">
              <thead>
                <tr className="bg-emerald-800 dark:bg-emerald-950 text-white dark:text-emerald-100 text-[11px] font-semibold">
                  <th className="py-3.5 pl-5 pr-3 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('nama')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Donatur &amp; Kontak</span>
                      {renderSortIcon(sortField === 'nama', sortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('terdaftar')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Tgl Terdaftar</span>
                      {renderSortIcon(sortField === 'terdaftar', sortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('wilayah')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Wilayah &amp; Perantara</span>
                      {renderSortIcon(sortField === 'wilayah', sortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('nominal')}
                      className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                    >
                      <span>Komitmen</span>
                      {renderSortIcon(sortField === 'nominal', sortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('statusBayar')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Konfirmasi / Valid</span>
                      {renderSortIcon(sortField === 'statusBayar', sortDir)}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('statusSalur')}
                      className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                    >
                      <span>Penyaluran</span>
                      {renderSortIcon(sortField === 'statusSalur', sortDir)}
                    </button>
                  </th>
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
                  const wilayah = resolveDonorWilayah(donatur);
                  const isCuti = donatur.statusAktif === 'Cuti';
                  const isUpdating = updatingId === donatur.idDonatur;
                  const isUpdatingSalur = updatingSalurDonorId === donatur.idDonatur;
                  const waLink = buildReminderWaLink(donatur, selectedMonth, config);
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
                          <button
                            type="button"
                            onClick={() => handleInspectDonorHistory(donatur.idDonatur)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/50 px-3 py-2 text-xs font-semibold text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            title="Lihat riwayat pembayaran donatur per bulan"
                          >
                            <History className="h-3.5 w-3.5 shrink-0" />
                            <span>Riwayat</span>
                          </button>

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

      {/* Rekap Berdasarkan Wilayah & Pengurus */}
      <section className="glass-surface rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Rekap Wilayah &amp; Pengurus
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ringkasan perolehan dan penyaluran Kafalah Dai periode{' '}
              {formatBulanLabel(selectedMonth)} serta kumulatif keseluruhan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100/85 dark:bg-slate-800/80 p-1.5 w-full xl:w-fit">
            {(
              [
                { key: 'pulau', label: 'Pulau' },
                { key: 'provinsi', label: 'Provinsi' },
                { key: 'kabupaten', label: 'Kabupaten / Kota' },
                { key: 'panitia', label: 'Pengurus / Perantara' },
                { key: 'metode', label: 'Metode Daftar' },
              ] as const
            ).map((item) => {
              const active = summaryTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSummaryTab(item.key)}
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
                <th className="py-3.5 px-4">
                  <button
                    type="button"
                    onClick={() => handleSummarySortHeader('label')}
                    className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                  >
                    <span>Kelompok</span>
                    {renderSortIcon(summarySortField === 'label', summarySortDir)}
                  </button>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSummarySortHeader('activeCount')}
                    className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                  >
                    <span>Donatur Aktif</span>
                    {renderSortIcon(summarySortField === 'activeCount', summarySortDir)}
                  </button>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSummarySortHeader('lunasBulanIni')}
                    className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                  >
                    <span>Lunas Bulan Ini</span>
                    {renderSortIcon(summarySortField === 'lunasBulanIni', summarySortDir)}
                  </button>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSummarySortHeader('validBulanRp')}
                    className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                  >
                    <span>Valid Bulan Ini</span>
                    {renderSortIcon(summarySortField === 'validBulanRp', summarySortDir)}
                  </button>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSummarySortHeader('salurBulanRp')}
                    className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                  >
                    <span>Disalurkan Bulan Ini</span>
                    {renderSortIcon(summarySortField === 'salurBulanRp', summarySortDir)}
                  </button>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSummarySortHeader('validSemuaRp')}
                    className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                  >
                    <span>Total Valid Keseluruhan</span>
                    {renderSortIcon(summarySortField === 'validSemuaRp', summarySortDir)}
                  </button>
                </th>
                {summaryTab === 'panitia' && (
                  <th className="py-3.5 pl-4 pr-5 text-right">Link Referral</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-sm">
              {summaryRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={summaryTab === 'panitia' ? 8 : 7}
                    className="py-8 px-4 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    Belum ada data untuk ditampilkan pada pengelompokan ini.
                  </td>
                </tr>
              ) : (
                summaryRows.map((row, index) => (
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
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
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
                    {summaryTab === 'panitia' && (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
