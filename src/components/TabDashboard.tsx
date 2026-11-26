import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Coins,
  ReceiptText,
  Users,
} from 'lucide-react';
import { WILAYAH_KABUPATEN } from '../data/wilayah';
import { Donatur, LembagaConfig, StatusAktif, TransaksiDonasi } from '../types';
import {
  extractYearMonthFromDateStr,
  formatBulanLabel,
  formatRupiah,
  getCurrentYearMonth,
  normalizeMinatGrup,
  normalizeStatusGrup,
  normalizeWA,
} from '../utils/formatters';
import { DashboardCharts } from './DashboardCharts';

interface TabDashboardProps {
  config: LembagaConfig;
  donaturList: Donatur[];
  transaksiList: TransaksiDonasi[];
  isLoading: boolean;
  onOpenMutasi: (subView: 'mutasi' | 'donatur') => void;
}

type SummaryTab = 'pulau' | 'provinsi' | 'kabupaten';
type SummarySortField =
  | 'label'
  | 'activeCount'
  | 'potensiBulanRp'
  | 'lunasBulanIni'
  | 'validBulanRp'
  | 'validSemuaRp';

const COMMITMENT_TIERS = [
  5_000,
  10_000,
  20_000,
  25_000,
  50_000,
  100_000,
  150_000,
  200_000,
  250_000,
  300_000,
  500_000,
  1_000_000,
] as const;

function buildDonorPersonKey(t: TransaksiDonasi): { key: string; isInsidentil: boolean } {
  const isInsidentil = t.jenisDonatur === 'Umum' || t.idDonatur === 'UMUM';
  const wa = normalizeWA(t.noWa) || String(t.noWa || '').replace(/\D/g, '');
  if (!isInsidentil) {
    if (t.idDonatur && t.idDonatur !== '-') {
      return { key: `tetap:id:${t.idDonatur}`, isInsidentil: false };
    }
    if (wa) {
      return { key: `tetap:wa:${wa}`, isInsidentil: false };
    }
    return {
      key: `tetap:nama:${(t.namaDonatur || t.idTransaksi).trim().toLowerCase()}`,
      isInsidentil: false,
    };
  }
  if (wa) {
    return { key: `insidentil:wa:${wa}`, isInsidentil: true };
  }
  const cleanName = (t.namaDonatur || '').trim().toLowerCase();
  if (cleanName && cleanName !== 'hamba allah') {
    return { key: `insidentil:nama:${cleanName}`, isInsidentil: true };
  }
  return { key: `insidentil:trx:${t.idTransaksi}`, isInsidentil: true };
}

export const TabDashboard: React.FC<TabDashboardProps> = ({
  config,
  donaturList,
  transaksiList,
  isLoading,
  onOpenMutasi,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [tierStatusFilter, setTierStatusFilter] = useState<'Aktif' | 'Semua' | StatusAktif>(
    'Aktif'
  );
  const [summaryTab, setSummaryTab] = useState<SummaryTab>('pulau');
  const [summarySortField, setSummarySortField] = useState<SummarySortField>('validBulanRp');
  const [summarySortDir, setSummarySortDir] = useState<'asc' | 'desc'>('desc');

  const monthTransaksi = useMemo(
    () => transaksiList.filter((t) => t.bulanTagihan === selectedMonth),
    [transaksiList, selectedMonth]
  );

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

  // ===== Rekap Keseluruhan (Seluruh Periode) =====
  const overallMetrics = useMemo(() => {
    const allValid = transaksiList.filter((t) => t.statusVerifikasi === 'Valid');
    const allPending = transaksiList.filter((t) => t.statusVerifikasi === 'Pending');

    let totalValidRp = 0;
    let totalKomitmenValidRp = 0;
    let totalDonasiUmumValidRp = 0;
    let totalInsidentilValidRp = 0;
    let donasiUmumTrxCount = 0;
    let insidentilTrxCount = 0;

    const uniqueTetapSet = new Set<string>();
    const uniqueInsidentilSet = new Set<string>();

    allValid.forEach((t) => {
      const { key, isInsidentil } = buildDonorPersonKey(t);
      totalValidRp += t.nominalTransfer;
      if (isInsidentil) {
        totalInsidentilValidRp += t.nominalTransfer;
        insidentilTrxCount += 1;
        uniqueInsidentilSet.add(key);
      } else {
        const extra = Math.max(0, t.donasiLainnya || 0);
        const base =
          t.nominalKomitmen > 0 ? t.nominalKomitmen : Math.max(0, t.nominalTransfer - extra);
        totalKomitmenValidRp += base;
        totalDonasiUmumValidRp += extra;
        if (extra > 0) donasiUmumTrxCount += 1;
        uniqueTetapSet.add(key);
      }
    });

    const activeDonors = donaturList.filter((d) => d.statusAktif === 'Aktif');
    const activeCount = activeDonors.length;
    const nonAktifCount = donaturList.length - activeCount;
    const potensiPerBulanRp = activeDonors.reduce((sum, d) => sum + (d.nominalKomitmen || 0), 0);
    const rataRataKomitmenRp = activeCount > 0 ? Math.round(potensiPerBulanRp / activeCount) : 0;

    const grupMinatCount = donaturList.filter(
      (d) => normalizeMinatGrup(d.minatGrupWa) === 'Ya'
    ).length;
    const grupJoinedCount = donaturList.filter(
      (d) => normalizeStatusGrup(d.statusGrupWa) === 'Sudah Bergabung'
    ).length;

    return {
      totalValidRp,
      totalKomitmenValidRp,
      totalDonasiUmumValidRp,
      totalInsidentilValidRp,
      donasiUmumTrxCount,
      insidentilTrxCount,
      validCount: allValid.length,
      pendingCount: allPending.length,
      totalDonatur: donaturList.length,
      activeCount,
      nonAktifCount,
      potensiPerBulanRp,
      rataRataKomitmenRp,
      grupMinatCount,
      grupJoinedCount,
      uniqueTetapAllCount: uniqueTetapSet.size,
      uniqueInsidentilAllCount: uniqueInsidentilSet.size,
      uniquePeopleAllCount: uniqueTetapSet.size + uniqueInsidentilSet.size,
    };
  }, [transaksiList, donaturList]);

  // ===== Rekap Bulan Terpilih =====
  const monthlyMetrics = useMemo(() => {
    const validMonthTrx = monthTransaksi.filter((t) => t.statusVerifikasi === 'Valid');
    const pendingMonthTrx = monthTransaksi.filter((t) => t.statusVerifikasi === 'Pending');

    let totalValidRp = 0;
    let totalKomitmenValidRp = 0;
    let totalDonasiUmumValidRp = 0;
    let totalInsidentilValidRp = 0;
    let donasiUmumCount = 0;
    let insidentilCount = 0;

    const uniqueTetapMonthSet = new Set<string>();
    const uniqueInsidentilMonthSet = new Set<string>();

    validMonthTrx.forEach((t) => {
      const { key, isInsidentil } = buildDonorPersonKey(t);
      totalValidRp += t.nominalTransfer;
      if (isInsidentil) {
        totalInsidentilValidRp += t.nominalTransfer;
        insidentilCount += 1;
        uniqueInsidentilMonthSet.add(key);
      } else {
        const extra = Math.max(0, t.donasiLainnya || 0);
        const base =
          t.nominalKomitmen > 0 ? t.nominalKomitmen : Math.max(0, t.nominalTransfer - extra);
        totalKomitmenValidRp += base;
        totalDonasiUmumValidRp += extra;
        if (extra > 0) donasiUmumCount += 1;
        uniqueTetapMonthSet.add(key);
      }
    });

    const totalPendingRp = pendingMonthTrx.reduce((sum, t) => sum + t.nominalTransfer, 0);

    const validIdSet = new Set(
      validMonthTrx
        .filter((t) => t.jenisDonatur !== 'Umum' && t.idDonatur !== 'UMUM')
        .map((t) => t.idDonatur)
        .filter((id) => id && id !== '-')
    );
    const validWaSet = new Set(
      validMonthTrx
        .filter((t) => t.jenisDonatur !== 'Umum' && t.idDonatur !== 'UMUM')
        .map((t) => normalizeWA(t.noWa) || t.noWa)
        .filter(Boolean)
    );

    const activeDonors = donaturList.filter((d) => d.statusAktif === 'Aktif');
    const lunasActiveCount = activeDonors.filter((d) => {
      const wa = normalizeWA(d.noWa) || d.noWa;
      return validIdSet.has(d.idDonatur) || (wa && validWaSet.has(wa));
    }).length;
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
      totalDonasiUmumValidRp,
      totalInsidentilValidRp,
      donasiUmumCount,
      insidentilCount,
      validCount: validMonthTrx.length,
      totalPendingRp,
      pendingCount: pendingMonthTrx.length,
      activeCount: activeDonors.length,
      lunasActiveCount,
      donaturBaruBulanIni,
      compliancePct,
      uniqueTetapMonthCount: uniqueTetapMonthSet.size,
      uniqueInsidentilMonthCount: uniqueInsidentilMonthSet.size,
      uniqueDonorsMonthCount: uniqueTetapMonthSet.size + uniqueInsidentilMonthSet.size,
    };
  }, [monthTransaksi, donaturList, selectedMonth]);

  // ===== Rekap Komitmen Donasi Berdasarkan Nominal (5rb - 1jt + Nominal Lainnya) =====
  const commitmentBreakdown = useMemo(() => {
    const scopedDonors = donaturList.filter((d) => {
      if (tierStatusFilter === 'Semua') return true;
      return d.statusAktif === tierStatusFilter;
    });

    const tierSet = new Set<number>(COMMITMENT_TIERS);
    const tierCountMap = new Map<number, number>();
    COMMITMENT_TIERS.forEach((t) => tierCountMap.set(t, 0));

    const otherMap = new Map<number, number>();
    let otherCount = 0;
    let otherTotalRp = 0;

    scopedDonors.forEach((d) => {
      const nom = Math.round(d.nominalKomitmen || 0);
      if (tierSet.has(nom)) {
        tierCountMap.set(nom, (tierCountMap.get(nom) || 0) + 1);
      } else {
        otherCount += 1;
        otherTotalRp += nom;
        otherMap.set(nom, (otherMap.get(nom) || 0) + 1);
      }
    });

    const totalDonors = scopedDonors.length;
    const totalPotensiRp = scopedDonors.reduce((s, d) => s + (d.nominalKomitmen || 0), 0);

    const standardRows = COMMITMENT_TIERS.map((nominal) => {
      const count = tierCountMap.get(nominal) || 0;
      const subtotalRp = count * nominal;
      const pct = totalDonors > 0 ? Math.round((count / totalDonors) * 1000) / 10 : 0;
      return {
        key: String(nominal),
        label: formatRupiah(nominal),
        nominal,
        count,
        subtotalRp,
        pct,
        isOther: false,
        otherDetails: [] as { nominal: number; count: number }[],
      };
    });

    const otherDetails = Array.from(otherMap.entries())
      .map(([nominal, count]) => ({ nominal, count }))
      .sort((a, b) => a.nominal - b.nominal);

    const otherRow = {
      key: 'lainnya',
      label: 'Nominal Lainnya',
      nominal: 0,
      count: otherCount,
      subtotalRp: otherTotalRp,
      pct: totalDonors > 0 ? Math.round((otherCount / totalDonors) * 1000) / 10 : 0,
      isOther: true,
      otherDetails,
    };

    const allRows = [...standardRows, otherRow];
    const maxCount = Math.max(1, ...allRows.map((r) => r.count));

    return {
      rows: allRows,
      totalDonors,
      totalPotensiRp,
      maxCount,
    };
  }, [donaturList, tierStatusFilter]);

  // ===== Rekap Berdasarkan Wilayah (Pulau / Provinsi / Kabupaten) =====
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
      }
    };

    const validMonthRoutine = monthTransaksi.filter(
      (t) => t.statusVerifikasi === 'Valid' && t.jenisDonatur !== 'Umum' && t.idDonatur !== 'UMUM'
    );
    const validMonthIds = new Set(
      validMonthRoutine.map((t) => t.idDonatur).filter((id) => id && id !== '-')
    );
    const validMonthWas = new Set(
      validMonthRoutine.map((t) => normalizeWA(t.noWa) || t.noWa).filter(Boolean)
    );

    const keySet = new Set<string>();
    donaturList.forEach((d) => keySet.add(getCategoryKey(d)));

    const rows = Array.from(keySet).map((label) => {
      const groupDonors = donaturList.filter((d) => getCategoryKey(d) === label);
      const activeGroup = groupDonors.filter((d) => d.statusAktif === 'Aktif');
      const potensiBulanRp = activeGroup.reduce((s, d) => s + (d.nominalKomitmen || 0), 0);

      const lunasBulanIni = activeGroup.filter((d) => {
        const wa = normalizeWA(d.noWa) || d.noWa;
        return validMonthIds.has(d.idDonatur) || (wa && validMonthWas.has(wa));
      }).length;

      const donorIdSet = new Set(groupDonors.map((d) => d.idDonatur));
      const donorWaSet = new Set(groupDonors.map((d) => normalizeWA(d.noWa) || d.noWa));

      const validTrxGroup = transaksiList.filter((t) => {
        if (t.statusVerifikasi !== 'Valid') return false;
        if (t.jenisDonatur === 'Umum' || t.idDonatur === 'UMUM') return false;
        const byId = t.idDonatur && t.idDonatur !== '-' && donorIdSet.has(t.idDonatur);
        const byWa = donorWaSet.has(normalizeWA(t.noWa) || t.noWa);
        return byId || byWa;
      });

      const validBulanRp = validTrxGroup
        .filter((t) => t.bulanTagihan === selectedMonth)
        .reduce((s, t) => s + t.nominalTransfer, 0);
      const validSemuaRp = validTrxGroup.reduce((s, t) => s + t.nominalTransfer, 0);

      let subtitle = '';
      if (summaryTab === 'kabupaten' && groupDonors.length > 0) {
        const w = resolveDonorWilayah(groupDonors[0]);
        if (w.provinsi) subtitle = `${w.provinsi}${w.pulau ? ` · ${w.pulau}` : ''}`;
      } else if (summaryTab === 'provinsi' && groupDonors.length > 0) {
        const w = resolveDonorWilayah(groupDonors[0]);
        if (w.pulau) subtitle = `Pulau ${w.pulau}`;
      }

      return {
        label,
        subtitle,
        activeCount: activeGroup.length,
        totalDonatur: groupDonors.length,
        potensiBulanRp,
        lunasBulanIni,
        validBulanRp,
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
        case 'potensiBulanRp':
          cmp = a.potensiBulanRp - b.potensiBulanRp;
          break;
        case 'lunasBulanIni':
          cmp = a.lunasBulanIni - b.lunasBulanIni;
          break;
        case 'validBulanRp':
          cmp = a.validBulanRp - b.validBulanRp;
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
    donaturList,
    monthTransaksi,
    transaksiList,
    selectedMonth,
    summarySortField,
    summarySortDir,
  ]);

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

  return (
    <div className="space-y-6">
      {/* Header Dashboard Rekap */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Dashboard Rekap Dakwah Pelosok
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 safe-wrap">
            Ringkasan potensi bulanan, keaktifan donatur tetap, donasi masuk, dan analitik periode{' '}
            <strong className="text-emerald-800 dark:text-emerald-300">
              {formatBulanLabel(selectedMonth)}
            </strong>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
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

      {/* SECTION 1: Rekap Bulanan (Urutan Kiri -> Kanan sesuai permintaan) */}
      <section className="glass-surface rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200/70 dark:border-slate-700/70">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Rekap Bulanan — {formatBulanLabel(selectedMonth)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
              Potensi bulanan, donatur tetap aktif, total donasi masuk, serta jumlah orang yang
              berdonasi pada bulan terpilih.
            </p>
          </div>
          {monthlyMetrics.pendingCount > 0 && (
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 tabular-nums shrink-0">
              {monthlyMetrics.pendingCount} pending ({formatRupiah(monthlyMetrics.totalPendingRp)})
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. PALING KIRI: Potensi Dana per Bulan */}
            <div className="min-w-0 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800/60 p-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Potensi Dana per Bulan
              </p>
              <p className="mt-1.5 text-xl sm:text-2xl font-bold text-teal-800 dark:text-teal-300 tabular-nums safe-wrap">
                {formatRupiah(overallMetrics.potensiPerBulanRp)}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
                Dari {overallMetrics.activeCount} donatur aktif · rata-rata{' '}
                {formatRupiah(overallMetrics.rataRataKomitmenRp)}/bln
              </p>
            </div>

            {/* 2. Total Donatur Aktif Saat Ini */}
            <div className="min-w-0 rounded-2xl bg-white/80 dark:bg-slate-900/55 border border-slate-200/80 dark:border-slate-700/75 p-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Total Donatur Aktif Saat Ini
              </p>
              <p className="mt-1.5 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {overallMetrics.activeCount}{' '}
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  / {overallMetrics.totalDonatur} terdaftar
                </span>
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
                {overallMetrics.nonAktifCount} Non Aktif ·{' '}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  +{monthlyMetrics.donaturBaruBulanIni} baru
                </span>{' '}
                di {formatBulanLabel(selectedMonth)}
              </p>
            </div>

            {/* 3. Total Donasi Masuk Bulan Ini */}
            <div className="min-w-0 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 p-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Total Donasi Masuk Bulan Ini
              </p>
              <p className="mt-1.5 text-xl sm:text-2xl font-bold text-emerald-800 dark:text-emerald-300 tabular-nums safe-wrap">
                {formatRupiah(monthlyMetrics.totalValidRp)}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
                Komitmen {formatRupiah(monthlyMetrics.totalKomitmenValidRp)} · Donasi Umum{' '}
                {formatRupiah(monthlyMetrics.totalDonasiUmumValidRp)} · Insidentil{' '}
                {formatRupiah(monthlyMetrics.totalInsidentilValidRp)}
              </p>
            </div>

            {/* 4. Total Orang Berdonasi Bulan Ini */}
            <div className="min-w-0 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/60 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Total Orang Berdonasi Bulan Ini
                </p>
                <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 tabular-nums shrink-0">
                  {monthlyMetrics.compliancePct.toFixed(1)}%
                </span>
              </div>
              <p className="mt-1.5 text-xl sm:text-2xl font-bold text-sky-900 dark:text-sky-200 tabular-nums">
                {monthlyMetrics.uniqueDonorsMonthCount}{' '}
                <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">orang</span>
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, monthlyMetrics.compliancePct)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
                {monthlyMetrics.uniqueTetapMonthCount} Donatur Tetap ·{' '}
                {monthlyMetrics.uniqueInsidentilMonthCount} Donatur Insidentil
              </p>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: Rekap Secara Keseluruhan (Seluruh Periode) */}
      <section className="glass-surface rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200/70 dark:border-slate-700/70">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Rekap Secara Keseluruhan (Seluruh Periode)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
              Akumulasi total donatur terdaftar, jumlah orang pada mutasi tercatat, dan seluruh
              donasi terverifikasi di {config.namaLembaga}.
            </p>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
            {overallMetrics.pendingCount} transaksi menunggu verifikasi
          </p>
        </div>

        {isLoading ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Jumlah Donatur */}
            <div className="min-w-0 rounded-2xl bg-white/80 dark:bg-slate-900/55 border border-slate-200/80 dark:border-slate-700/75 p-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Jumlah Donatur
              </p>
              <p className="mt-1.5 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {overallMetrics.totalDonatur}{' '}
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  donatur tetap
                </span>
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
                {overallMetrics.activeCount} Aktif · {overallMetrics.nonAktifCount} Non Aktif ·
                Grup WA {overallMetrics.grupJoinedCount}/{overallMetrics.grupMinatCount}
              </p>
            </div>

            {/* 2. Jumlah Orang Mutasi Tercatat */}
            <div className="min-w-0 rounded-2xl bg-sky-50/55 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/60 p-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Jumlah Orang Mutasi Tercatat
              </p>
              <p className="mt-1.5 text-xl sm:text-2xl font-bold text-sky-800 dark:text-sky-300 tabular-nums">
                {overallMetrics.uniquePeopleAllCount}{' '}
                <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">orang</span>
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
                {overallMetrics.uniqueTetapAllCount} Donatur Tetap ·{' '}
                {overallMetrics.uniqueInsidentilAllCount} Donatur Insidentil (seluruh periode)
              </p>
            </div>

            {/* 3. Jumlah Donasi Tercatat (Keseluruhan) */}
            <div className="min-w-0 rounded-2xl bg-emerald-50/55 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 p-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Jumlah Donasi Tercatat (Keseluruhan)
              </p>
              <p className="mt-1.5 text-xl sm:text-2xl font-bold text-emerald-800 dark:text-emerald-300 tabular-nums safe-wrap">
                {formatRupiah(overallMetrics.totalValidRp)}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
                {overallMetrics.validCount} transaksi valid · Komitmen{' '}
                {formatRupiah(overallMetrics.totalKomitmenValidRp)} · Donasi Umum{' '}
                {formatRupiah(overallMetrics.totalDonasiUmumValidRp)} (
                {overallMetrics.donasiUmumTrxCount}) · Insidentil{' '}
                {formatRupiah(overallMetrics.totalInsidentilValidRp)} (
                {overallMetrics.insidentilTrxCount})
              </p>
            </div>
          </div>
        )}

        {/* Pintasan Cepat ke Halaman Mutasi & Daftar Donatur */}
        <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2.5">
          <p className="text-xs text-slate-500 dark:text-slate-400 safe-wrap">
            Ingin melihat rincian mutasi dana masuk atau riwayat pembayaran per donatur tetap?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenMutasi('mutasi')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <ReceiptText className="h-3.5 w-3.5 shrink-0" />
              <span>Buka Mutasi Dana Masuk</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => onOpenMutasi('donatur')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>Daftar &amp; Riwayat Donatur</span>
            </button>
          </div>
        </div>
      </section>

      {/* Rekap Jumlah Komitmen Donasi Berdasarkan Nominal (5rb - 1jt + Nominal Lainnya) */}
      <section className="glass-surface rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Coins className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>Rekap Jumlah Komitmen Donasi Berdasarkan Nominal</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
              Sebaran donatur tetap dan total potensi dana per bulan dari nominal Rp 5.000 sampai Rp
              1.000.000 serta nominal lainnya.
            </p>
          </div>

          <div
            className="inline-flex items-center gap-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/85 p-1 shrink-0 w-fit"
            role="group"
            aria-label="Filter status donatur pada rekap nominal"
          >
            {(['Aktif', 'Semua', 'Non Aktif'] as const).map((st) => {
              const active = tierStatusFilter === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setTierStatusFilter(st)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto clean-scroll">
          <table className="w-full min-w-[680px] text-left border-collapse">
            <thead>
              <tr className="bg-emerald-800 dark:bg-emerald-950 text-white dark:text-emerald-100 text-[11px] font-semibold">
                <th className="py-3 pl-5 pr-3 w-12 text-center">No</th>
                <th className="py-3 px-4">Nominal Komitmen</th>
                <th className="py-3 px-4 text-right">Jumlah Donatur</th>
                <th className="py-3 px-4 w-56">Distribusi</th>
                <th className="py-3 pl-4 pr-5 text-right">Total Potensi / Bulan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-sm">
              {commitmentBreakdown.rows.map((row, idx) => {
                const barWidth =
                  row.count > 0
                    ? Math.max(4, Math.round((row.count / commitmentBreakdown.maxCount) * 100))
                    : 0;
                return (
                  <tr
                    key={row.key}
                    className={`transition-colors ${
                      row.isOther
                        ? 'bg-sky-50/55 dark:bg-sky-950/30 hover:bg-sky-50 dark:hover:bg-sky-950/45'
                        : 'odd:bg-white/90 even:bg-emerald-50/45 dark:odd:bg-slate-900/75 dark:even:bg-slate-800/60 hover:bg-teal-50/70 dark:hover:bg-emerald-950/40'
                    }`}
                  >
                    <td className="py-3 pl-5 pr-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 min-w-0">
                      <p
                        className={`text-xs sm:text-sm font-bold tabular-nums ${
                          row.isOther
                            ? 'text-sky-800 dark:text-sky-300'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {row.label}
                      </p>
                      {row.isOther && row.otherDetails.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.otherDetails.map((d) => (
                            <span
                              key={d.nominal}
                              className="inline-flex items-center rounded-lg bg-white/90 dark:bg-slate-900/80 border border-sky-200/80 dark:border-sky-800/70 px-2 py-0.5 text-[10px] font-semibold text-sky-800 dark:text-sky-200 tabular-nums"
                            >
                              {formatRupiah(d.nominal)} ({d.count})
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
                      <span
                        className={`text-xs sm:text-sm font-bold ${
                          row.count > 0
                            ? 'text-slate-900 dark:text-slate-100'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {row.count} donatur
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2 flex-1 rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              row.isOther
                                ? 'bg-gradient-to-r from-sky-500 to-indigo-500'
                                : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="w-11 text-right text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums shrink-0">
                          {row.pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pl-4 pr-5 text-right whitespace-nowrap tabular-nums">
                      <span
                        className={`text-xs sm:text-sm font-bold ${
                          row.subtotalRp > 0
                            ? 'text-emerald-800 dark:text-emerald-300'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {formatRupiah(row.subtotalRp)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50/90 dark:bg-emerald-950/60 border-t-2 border-emerald-200 dark:border-emerald-800 font-bold text-xs sm:text-sm">
                <td colSpan={2} className="py-3.5 pl-5 pr-4 text-emerald-950 dark:text-emerald-100">
                  Total Komitmen ({tierStatusFilter})
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-950 dark:text-emerald-100 tabular-nums whitespace-nowrap">
                  {commitmentBreakdown.totalDonors} donatur
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-800 dark:text-emerald-300 tabular-nums">
                  100%
                </td>
                <td className="py-3.5 pl-4 pr-5 text-right text-emerald-900 dark:text-emerald-200 tabular-nums whitespace-nowrap">
                  {formatRupiah(commitmentBreakdown.totalPotensiRp)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Grafik Komprehensif: Pemasukan & Pertambahan Donatur */}
      <DashboardCharts
        donaturList={donaturList}
        transaksiList={transaksiList}
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
      />

      {/* Rekap Berdasarkan Wilayah (Pulau / Provinsi / Kabupaten) */}
      <section className="glass-surface rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Rekap Sebaran Wilayah Donatur Tetap
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ringkasan jumlah donatur, potensi bulanan, dan total dana valid periode{' '}
              {formatBulanLabel(selectedMonth)} serta kumulatif keseluruhan berdasarkan wilayah.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100/85 dark:bg-slate-800/80 p-1.5 w-full xl:w-fit">
            {(
              [
                { key: 'pulau', label: 'Pulau' },
                { key: 'provinsi', label: 'Provinsi' },
                { key: 'kabupaten', label: 'Kabupaten / Kota' },
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
          <table className="w-full min-w-[740px] text-left border-collapse">
            <thead>
              <tr className="bg-teal-800 dark:bg-teal-950 text-white dark:text-teal-100 text-[11px] font-semibold">
                <th className="py-3.5 pl-5 pr-3 w-12 text-center">No</th>
                <th className="py-3.5 px-4">
                  <button
                    type="button"
                    onClick={() => handleSummarySortHeader('label')}
                    className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                  >
                    <span>Wilayah</span>
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
                    onClick={() => handleSummarySortHeader('potensiBulanRp')}
                    className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                  >
                    <span>Potensi / Bulan</span>
                    {renderSortIcon(summarySortField === 'potensiBulanRp', summarySortDir)}
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
                <th className="py-3.5 pl-4 pr-5 text-right">
                  <button
                    type="button"
                    onClick={() => handleSummarySortHeader('validSemuaRp')}
                    className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                  >
                    <span>Total Valid Keseluruhan</span>
                    {renderSortIcon(summarySortField === 'validSemuaRp', summarySortDir)}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-sm">
              {summaryRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 px-4 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    Belum ada data untuk ditampilkan pada pengelompokan wilayah ini.
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
                    <td className="py-3.5 px-4 text-right font-semibold text-teal-800 dark:text-teal-300 tabular-nums whitespace-nowrap">
                      {formatRupiah(row.potensiBulanRp)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-sky-700 dark:text-sky-300 tabular-nums whitespace-nowrap">
                      {row.lunasBulanIni} donatur
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-800 dark:text-emerald-300 tabular-nums whitespace-nowrap">
                      {formatRupiah(row.validBulanRp)}
                    </td>
                    <td className="py-3.5 pl-4 pr-5 text-right font-semibold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">
                      {formatRupiah(row.validSemuaRp)}
                    </td>
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
