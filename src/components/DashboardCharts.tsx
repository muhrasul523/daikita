import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  CalendarDays,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Donatur, PageSizeOption, TransaksiDonasi } from '../types';
import {
  buildMonthSequence,
  extractIsoDateFromDateStr,
  extractYearMonthFromDateStr,
  formatBulanLabel,
  formatBulanShortLabel,
  formatRupiah,
  formatTanggalIndo,
  getAdjacentYearMonth,
  getCurrentYearMonth,
  getTodayIsoDate,
  normalizeWA,
} from '../utils/formatters';
import { PaginationBar, slicePaginated } from './PaginationBar';

interface DashboardChartsProps {
  donaturList: Donatur[];
  transaksiList: TransaksiDonasi[];
  selectedMonth: string;
  onSelectMonth: (ym: string) => void;
  /** Jika diisi, kunci tampilan hanya ke mode tertentu (berguna saat mode "Semua Rekap") */
  lockedChartMode?: 'pertambahan' | 'keuangan';
}

type ChartMode = 'pertambahan' | 'keuangan';
type GrowthGranularity = 'harian' | 'pekanan' | 'bulanan';
type DailyRange = '14d' | '30d' | 'month';
type WeeklyRange = '8w' | '12w' | 'month';
type MonthlyRange = '6m' | '12m' | 'year';
type GrowthSortField = 'key' | 'donaturBaru' | 'potensiBaruRp' | 'kumulatifTotal';

interface GrowthPoint {
  key: string;
  shortLabel: string;
  fullLabel: string;
  rangeStart: string;
  rangeEnd: string;
  donaturBaru: number;
  potensiBaruRp: number;
  kumulatifTotal: number;
  ym?: string;
}

interface FinancePoint {
  ym: string;
  shortLabel: string;
  fullLabel: string;
  komitmenAktifRp: number;
  danaPendingRp: number;
  danaValidRp: number;
  danaKomitmenValidRp: number;
  danaLainnyaValidRp: number;
  danaUmumValidRp: number;
  danaTambahanValidRp: number;
  donaturBaru: number;
  totalDonaturAktif: number;
  donaturLunas: number;
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function formatCompactRp(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}jt`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}rb`;
  }
  return String(Math.round(value));
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDaysIso(iso: string, offsetDays: number): string {
  const d = parseIsoLocal(iso);
  d.setDate(d.getDate() + offsetDays);
  return toIsoDate(d);
}

function getMonthEndIso(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0);
  return toIsoDate(lastDay);
}

function getMondayIso(iso: string): string {
  const d = parseIsoLocal(iso);
  const day = d.getDay(); // 0=Min, 1=Sen, ..., 6=Sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return toIsoDate(d);
}

function formatDayMonthShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${m}`;
}

function formatWeekRangeLabel(startIso: string, endIso: string): string {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  const sMon = SHORT_MONTHS[(sm || 1) - 1] || '';
  const eMon = SHORT_MONTHS[(em || 1) - 1] || '';
  if (sy === ey && sm === em) {
    return `${sd}–${ed} ${eMon} ${ey}`;
  }
  if (sy === ey) {
    return `${sd} ${sMon} – ${ed} ${eMon} ${ey}`;
  }
  return `${sd} ${sMon} ${sy} – ${ed} ${eMon} ${ey}`;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  donaturList,
  transaksiList,
  selectedMonth,
  onSelectMonth,
  lockedChartMode,
}) => {
  const [chartMode, setChartMode] = useState<ChartMode>(lockedChartMode || 'pertambahan');
  const effectiveMode: ChartMode = lockedChartMode || chartMode;

  // Controls untuk Pertambahan Donatur
  const [granularity, setGranularity] = useState<GrowthGranularity>('harian');
  const [dailyRange, setDailyRange] = useState<DailyRange>('14d');
  const [weeklyRange, setWeeklyRange] = useState<WeeklyRange>('8w');
  const [monthlyGrowthRange, setMonthlyGrowthRange] = useState<MonthlyRange>('6m');
  const [hoveredGrowthKey, setHoveredGrowthKey] = useState<string | null>(null);
  const [growthSortField, setGrowthSortField] = useState<GrowthSortField>('key');
  const [growthSortDir, setGrowthSortDir] = useState<'asc' | 'desc'>('desc');
  const [growthPage, setGrowthPage] = useState(1);
  const [growthPageSize, setGrowthPageSize] = useState<PageSizeOption>(10);

  // Controls untuk Arus Dana Bulanan
  const [financeRange, setFinanceRange] = useState<MonthlyRange>('6m');
  const [hoveredFinanceYm, setHoveredFinanceYm] = useState<string | null>(null);

  const safeSelectedMonth = useMemo(
    () => (/^\d{4}-\d{2}$/.test(selectedMonth) ? selectedMonth : getCurrentYearMonth()),
    [selectedMonth]
  );

  // Anchor date: hari ini jika bulan terpilih = bulan berjalan, atau akhir bulan terpilih jika bulan lain
  const anchorIsoDate = useMemo(() => {
    const todayIso = getTodayIsoDate();
    const curYm = getCurrentYearMonth();
    if (safeSelectedMonth === curYm) return todayIso;
    return getMonthEndIso(safeSelectedMonth);
  }, [safeSelectedMonth]);

  // Pre-parse tanggal daftar donatur sekali saja (O(N))
  const parsedDonors = useMemo(
    () =>
      donaturList.map((d) => ({
        donor: d,
        regIso: extractIsoDateFromDateStr(d.tanggalDaftar),
        regYm: extractYearMonthFromDateStr(d.tanggalDaftar),
        normWa: normalizeWA(d.noWa) || d.noWa,
      })),
    [donaturList]
  );

  // ==================== SERIES 1: PERTAMBAHAN DONATUR (HARIAN / PEKANAN / BULANAN) ====================
  const growthSeries = useMemo<GrowthPoint[]>(() => {
    const undatedCount = parsedDonors.filter((p) => !p.regIso && !p.regYm).length;

    if (granularity === 'harian') {
      let startIso: string;
      let endIso: string;
      if (dailyRange === 'month') {
        startIso = `${safeSelectedMonth}-01`;
        endIso = getMonthEndIso(safeSelectedMonth);
      } else {
        const count = dailyRange === '30d' ? 30 : 14;
        endIso = anchorIsoDate;
        startIso = addDaysIso(endIso, -(count - 1));
      }

      const dayCountMap = new Map<string, { count: number; potensiRp: number }>();
      let baselineBefore = undatedCount;

      parsedDonors.forEach(({ donor, regIso }) => {
        if (!regIso) return;
        if (regIso < startIso) {
          baselineBefore += 1;
        } else if (regIso <= endIso) {
          const cur = dayCountMap.get(regIso) || { count: 0, potensiRp: 0 };
          cur.count += 1;
          cur.potensiRp += donor.nominalKomitmen || 0;
          dayCountMap.set(regIso, cur);
        }
      });

      const points: GrowthPoint[] = [];
      let runningTotal = baselineBefore;
      let cursor = startIso;
      while (cursor <= endIso) {
        const bucket = dayCountMap.get(cursor) || { count: 0, potensiRp: 0 };
        runningTotal += bucket.count;
        points.push({
          key: cursor,
          shortLabel: formatDayMonthShort(cursor),
          fullLabel: formatTanggalIndo(cursor),
          rangeStart: cursor,
          rangeEnd: cursor,
          donaturBaru: bucket.count,
          potensiBaruRp: bucket.potensiRp,
          kumulatifTotal: runningTotal,
        });
        cursor = addDaysIso(cursor, 1);
      }
      return points;
    }

    if (granularity === 'pekanan') {
      const weeks: { startIso: string; endIso: string }[] = [];
      if (weeklyRange === 'month') {
        const monthStart = `${safeSelectedMonth}-01`;
        const monthEnd = getMonthEndIso(safeSelectedMonth);
        let curStart = monthStart;
        while (curStart <= monthEnd) {
          const d = parseIsoLocal(curStart);
          const day = d.getDay();
          const daysToSunday = day === 0 ? 0 : 7 - day;
          let curEnd = addDaysIso(curStart, daysToSunday);
          if (curEnd > monthEnd) curEnd = monthEnd;
          weeks.push({ startIso: curStart, endIso: curEnd });
          curStart = addDaysIso(curEnd, 1);
        }
      } else {
        const count = weeklyRange === '12w' ? 12 : 8;
        const latestMonday = getMondayIso(anchorIsoDate);
        for (let i = count - 1; i >= 0; i--) {
          const startIso = addDaysIso(latestMonday, -i * 7);
          const endIso = addDaysIso(startIso, 6);
          weeks.push({ startIso, endIso });
        }
      }

      if (weeks.length === 0) return [];
      const firstStart = weeks[0].startIso;
      let runningTotal = undatedCount;
      parsedDonors.forEach(({ regIso }) => {
        if (regIso && regIso < firstStart) runningTotal += 1;
      });

      return weeks.map((w, idx) => {
        let count = 0;
        let potensiRp = 0;
        parsedDonors.forEach(({ donor, regIso }) => {
          if (regIso && regIso >= w.startIso && regIso <= w.endIso) {
            count += 1;
            potensiRp += donor.nominalKomitmen || 0;
          }
        });
        runningTotal += count;
        return {
          key: w.startIso,
          shortLabel:
            weeklyRange === 'month' ? `P${idx + 1}` : formatDayMonthShort(w.startIso),
          fullLabel: formatWeekRangeLabel(w.startIso, w.endIso),
          rangeStart: w.startIso,
          rangeEnd: w.endIso,
          donaturBaru: count,
          potensiBaruRp: potensiRp,
          kumulatifTotal: runningTotal,
        };
      });
    }

    // Bulanan
    let ymKeys: string[];
    if (monthlyGrowthRange === 'year') {
      ymKeys = buildMonthSequence(`${safeSelectedMonth.slice(0, 4)}-01`, 12);
    } else {
      const count = monthlyGrowthRange === '12m' ? 12 : 6;
      const startYm = getAdjacentYearMonth(safeSelectedMonth, -(count - 1));
      ymKeys = buildMonthSequence(startYm, count);
    }

    const firstYm = ymKeys[0];
    let runningTotal = undatedCount;
    const monthBucketMap = new Map<string, { count: number; potensiRp: number }>();

    parsedDonors.forEach(({ donor, regYm }) => {
      if (!regYm) return;
      if (regYm < firstYm) {
        runningTotal += 1;
      } else {
        const cur = monthBucketMap.get(regYm) || { count: 0, potensiRp: 0 };
        cur.count += 1;
        cur.potensiRp += donor.nominalKomitmen || 0;
        monthBucketMap.set(regYm, cur);
      }
    });

    return ymKeys.map((ym) => {
      const bucket = monthBucketMap.get(ym) || { count: 0, potensiRp: 0 };
      runningTotal += bucket.count;
      return {
        key: ym,
        shortLabel: formatBulanShortLabel(ym),
        fullLabel: formatBulanLabel(ym),
        rangeStart: `${ym}-01`,
        rangeEnd: getMonthEndIso(ym),
        donaturBaru: bucket.count,
        potensiBaruRp: bucket.potensiRp,
        kumulatifTotal: runningTotal,
        ym,
      };
    });
  }, [
    parsedDonors,
    granularity,
    dailyRange,
    weeklyRange,
    monthlyGrowthRange,
    safeSelectedMonth,
    anchorIsoDate,
  ]);

  useEffect(() => {
    setGrowthPage(1);
    setHoveredGrowthKey(null);
  }, [granularity, dailyRange, weeklyRange, monthlyGrowthRange, safeSelectedMonth]);

  const growthSummary = useMemo(() => {
    const totalBaru = growthSeries.reduce((s, p) => s + p.donaturBaru, 0);
    const totalPotensiBaru = growthSeries.reduce((s, p) => s + p.potensiBaruRp, 0);
    const avgPerPeriod =
      growthSeries.length > 0 ? Math.round((totalBaru / growthSeries.length) * 10) / 10 : 0;
    let peak = growthSeries[0] || null;
    growthSeries.forEach((p) => {
      if (!peak || p.donaturBaru > peak.donaturBaru) peak = p;
    });
    return { totalBaru, totalPotensiBaru, avgPerPeriod, peak };
  }, [growthSeries]);

  const activeGrowthPoint = useMemo(() => {
    if (growthSeries.length === 0) return null;
    if (hoveredGrowthKey) {
      return growthSeries.find((p) => p.key === hoveredGrowthKey) || growthSeries[growthSeries.length - 1];
    }
    if (granularity === 'bulanan') {
      return growthSeries.find((p) => p.ym === safeSelectedMonth) || growthSeries[growthSeries.length - 1];
    }
    return growthSeries[growthSeries.length - 1];
  }, [growthSeries, hoveredGrowthKey, granularity, safeSelectedMonth]);

  const sortedGrowthRows = useMemo(() => {
    const dir = growthSortDir === 'asc' ? 1 : -1;
    return [...growthSeries].sort((a, b) => {
      let cmp = 0;
      switch (growthSortField) {
        case 'key':
          cmp = a.key.localeCompare(b.key);
          break;
        case 'donaturBaru':
          cmp = a.donaturBaru - b.donaturBaru;
          break;
        case 'potensiBaruRp':
          cmp = a.potensiBaruRp - b.potensiBaruRp;
          break;
        case 'kumulatifTotal':
          cmp = a.kumulatifTotal - b.kumulatifTotal;
          break;
      }
      if (cmp === 0) return b.key.localeCompare(a.key);
      return cmp * dir;
    });
  }, [growthSeries, growthSortField, growthSortDir]);

  const paginatedGrowthRows = useMemo(
    () => slicePaginated(sortedGrowthRows, growthPage, growthPageSize),
    [sortedGrowthRows, growthPage, growthPageSize]
  );

  const handleGrowthSort = (field: GrowthSortField) => {
    if (growthSortField === field) {
      setGrowthSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setGrowthSortField(field);
      setGrowthSortDir('desc');
    }
    setGrowthPage(1);
  };

  // ==================== SERIES 2: ARUS DANA BULANAN ====================
  const financeMonthKeys = useMemo(() => {
    if (financeRange === 'year') {
      return buildMonthSequence(`${safeSelectedMonth.slice(0, 4)}-01`, 12);
    }
    const count = financeRange === '12m' ? 12 : 6;
    const startYm = getAdjacentYearMonth(safeSelectedMonth, -(count - 1));
    return buildMonthSequence(startYm, count);
  }, [safeSelectedMonth, financeRange]);

  const financeSeries = useMemo<FinancePoint[]>(() => {
    const trxByMonth = new Map<string, TransaksiDonasi[]>();
    transaksiList.forEach((t) => {
      if (!t.bulanTagihan) return;
      const list = trxByMonth.get(t.bulanTagihan);
      if (list) list.push(t);
      else trxByMonth.set(t.bulanTagihan, [t]);
    });

    return financeMonthKeys.map((ym) => {
      const monthTrx = trxByMonth.get(ym) || [];
      const validTrx: TransaksiDonasi[] = [];
      let danaValidRp = 0;
      let danaUmumValidRp = 0;
      let danaLainnyaValidRp = 0;
      let danaPendingRp = 0;

      for (let i = 0; i < monthTrx.length; i++) {
        const t = monthTrx[i];
        if (t.statusVerifikasi === 'Valid') {
          validTrx.push(t);
          danaValidRp += t.nominalTransfer;
          if (t.jenisDonatur === 'Umum' || t.idDonatur === 'UMUM') {
            danaUmumValidRp += t.nominalTransfer;
          } else {
            danaLainnyaValidRp += Math.max(0, t.donasiLainnya || 0);
          }
        } else if (t.statusVerifikasi === 'Pending') {
          danaPendingRp += t.nominalTransfer;
        }
      }

      const danaTambahanValidRp = danaLainnyaValidRp + danaUmumValidRp;
      const danaKomitmenValidRp = Math.max(0, danaValidRp - danaTambahanValidRp);

      let donaturBaru = 0;
      let totalDonaturAktif = 0;
      let komitmenAktifRp = 0;
      let donaturLunas = 0;

      const validIdSet = new Set(
        validTrx
          .map((t) => t.idDonatur)
          .filter((id) => id && id !== '-' && id !== 'UMUM')
      );
      const validWaSet = new Set(
        validTrx
          .filter((t) => t.jenisDonatur !== 'Umum' && t.idDonatur !== 'UMUM')
          .map((t) => normalizeWA(t.noWa) || t.noWa)
          .filter(Boolean)
      );

      parsedDonors.forEach(({ donor, regYm, normWa }) => {
        if (regYm === ym) donaturBaru += 1;
        const existsByMonth = !regYm || regYm <= ym;
        if (existsByMonth && donor.statusAktif === 'Aktif') {
          totalDonaturAktif += 1;
          komitmenAktifRp += donor.nominalKomitmen || 0;
        }
        const isPaid =
          (donor.idDonatur && validIdSet.has(donor.idDonatur)) || (normWa && validWaSet.has(normWa));
        if (existsByMonth && isPaid) donaturLunas += 1;
      });

      return {
        ym,
        shortLabel: formatBulanShortLabel(ym),
        fullLabel: formatBulanLabel(ym),
        komitmenAktifRp,
        danaPendingRp,
        danaValidRp,
        danaKomitmenValidRp,
        danaLainnyaValidRp,
        danaUmumValidRp,
        danaTambahanValidRp,
        donaturBaru,
        totalDonaturAktif,
        donaturLunas,
      };
    });
  }, [financeMonthKeys, parsedDonors, transaksiList]);

  const activeFinancePoint = useMemo(() => {
    const target = hoveredFinanceYm || safeSelectedMonth;
    return financeSeries.find((p) => p.ym === target) || financeSeries[financeSeries.length - 1];
  }, [financeSeries, hoveredFinanceYm, safeSelectedMonth]);

  const ratioSummary = useMemo(() => {
    const sel = financeSeries.find((p) => p.ym === safeSelectedMonth) || activeFinancePoint;
    const lakiCount = donaturList.filter((d) => d.jenisKelamin === 'Laki-laki').length;
    const perempuanCount = donaturList.filter((d) => d.jenisKelamin === 'Perempuan').length;
    const totalGender = Math.max(lakiCount + perempuanCount, 1);

    const targetKomitmen = sel?.komitmenAktifRp || 0;
    const masukValid = sel?.danaValidRp || 0;
    const realisasiPct =
      targetKomitmen > 0 ? Math.min(100, Math.round((masukValid / targetKomitmen) * 1000) / 10) : 0;
    const tambahanPct =
      masukValid > 0
        ? Math.min(100, Math.round(((sel?.danaTambahanValidRp || 0) / masukValid) * 1000) / 10)
        : 0;

    return {
      sel,
      lakiCount,
      perempuanCount,
      lakiPct: Math.round((lakiCount / totalGender) * 100),
      perempuanPct: Math.round((perempuanCount / totalGender) * 100),
      realisasiPct,
      tambahanPct,
    };
  }, [financeSeries, safeSelectedMonth, activeFinancePoint, donaturList]);

  // ==================== SVG GEOMETRY ====================
  const svgW = 760;
  const svgH = 240;
  const padL = 48;
  const padR = 44;
  const padT = 18;
  const padB = 34;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  // Growth chart scales (dual independent axes: bars = new donors, line = cumulative)
  const maxNewDonors = useMemo(
    () => Math.max(4, ...growthSeries.map((p) => p.donaturBaru)),
    [growthSeries]
  );
  const { minCum, maxCum } = useMemo(() => {
    if (growthSeries.length === 0) return { minCum: 0, maxCum: 10 };
    const vals = growthSeries.map((p) => p.kumulatifTotal);
    const maxV = Math.max(5, ...vals);
    const minV = Math.min(...vals);
    const floor = minV > 10 ? Math.max(0, Math.floor(minV * 0.9)) : 0;
    return { minCum: floor, maxCum: Math.max(floor + 5, maxV) };
  }, [growthSeries]);

  const growthGroupW = plotW / Math.max(growthSeries.length, 1);
  const growthLabelStep =
    growthSeries.length > 22 ? 3 : growthSeries.length > 14 ? 2 : 1;

  const cumLinePoints = useMemo(
    () =>
      growthSeries
        .map((p, i) => {
          const cx = padL + growthGroupW * i + growthGroupW / 2;
          const ratio = (p.kumulatifTotal - minCum) / Math.max(1, maxCum - minCum);
          const cy = padT + plotH - ratio * plotH;
          return `${cx.toFixed(1)},${cy.toFixed(1)}`;
        })
        .join(' '),
    [growthSeries, growthGroupW, minCum, maxCum, padL, padT, plotH]
  );

  // Finance chart scale
  const maxFinanceRp = useMemo(() => {
    let maxVal = 100_000;
    financeSeries.forEach((p) => {
      maxVal = Math.max(
        maxVal,
        p.komitmenAktifRp,
        p.danaValidRp + p.danaPendingRp,
        p.danaTambahanValidRp
      );
    });
    return maxVal;
  }, [financeSeries]);
  const finPlotW = svgW - 56 - 16;
  const finGroupW = finPlotW / Math.max(financeSeries.length, 1);

  const renderSortIcon = (active: boolean, dir: 'asc' | 'desc') => {
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-60 shrink-0" />;
    return dir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 shrink-0" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 shrink-0" />
    );
  };

  const granularityLabel =
    granularity === 'harian' ? 'Harian' : granularity === 'pekanan' ? 'Pekanan' : 'Bulanan';

  return (
    <section className="glass-surface rounded-3xl overflow-hidden">
      {/* Header Kontrol Grafik (Single Focused Chart, Zero Clutter) */}
      <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            {effectiveMode === 'pertambahan' ? (
              <TrendingUp className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            ) : (
              <BarChart3 className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            )}
            <span>
              {effectiveMode === 'pertambahan'
                ? `Pertambahan Donatur (${granularityLabel})`
                : 'Grafik Arus Dana & Komitmen Bulanan'}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 safe-wrap">
            {effectiveMode === 'pertambahan'
              ? 'Pantau pendaftaran donatur tetap baru dan akumulasi pertumbuhan secara harian, pekanan, maupun bulanan.'
              : 'Perbandingan potensi komitmen aktif, dana valid masuk, pending, serta donasi umum & insidentil.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Switcher Mode Grafik (disembunyikan jika dikunci pada mode Semua Rekap) */}
          {!lockedChartMode && (
            <div
              className="inline-flex items-center gap-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/85 p-1"
              role="tablist"
              aria-label="Pilih jenis grafik utama"
            >
              <button
                type="button"
                role="tab"
                aria-selected={effectiveMode === 'pertambahan'}
                onClick={() => setChartMode('pertambahan')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  effectiveMode === 'pertambahan'
                    ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>Pertambahan Donatur</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={effectiveMode === 'keuangan'}
                onClick={() => setChartMode('keuangan')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  effectiveMode === 'keuangan'
                    ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5 shrink-0" />
                <span>Arus Dana</span>
              </button>
            </div>
          )}

          {/* Switcher Rentang Waktu */}
          {effectiveMode === 'keuangan' && (
            <div
              className="inline-flex items-center gap-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/85 p-1"
              role="group"
              aria-label="Rentang waktu arus dana"
            >
              {(
                [
                  { key: '6m', label: '6 Bln' },
                  { key: '12m', label: '12 Bln' },
                  { key: 'year', label: `Thn ${safeSelectedMonth.slice(0, 4)}` },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFinanceRange(item.key)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    financeRange === item.key
                      ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ==================== KONTEN MODE 1: PERTAMBAHAN DONATUR (HARIAN / PEKANAN / BULANAN) ==================== */}
      {effectiveMode === 'pertambahan' && (
        <div className="p-5 sm:p-6 space-y-5">
          {/* Baris Filter Granularitas & Rentang */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div
              className="inline-flex items-center gap-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/85 p-1 w-fit"
              role="group"
              aria-label="Pilih periode pertambahan donatur"
            >
              {(
                [
                  { key: 'harian', label: 'Harian' },
                  { key: 'pekanan', label: 'Pekanan' },
                  { key: 'bulanan', label: 'Bulanan' },
                ] as const
              ).map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGranularity(g.key)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    granularity === g.key
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Sub-filter Rentang sesuai Granularitas */}
            <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/60 p-1 w-fit">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400 ml-2 mr-1 shrink-0" />
              {granularity === 'harian' &&
                (
                  [
                    { key: '14d', label: '14 Hari' },
                    { key: '30d', label: '30 Hari' },
                    { key: 'month', label: formatBulanShortLabel(safeSelectedMonth) },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDailyRange(opt.key)}
                    className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      dailyRange === opt.key
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}

              {granularity === 'pekanan' &&
                (
                  [
                    { key: '8w', label: '8 Pekan' },
                    { key: '12w', label: '12 Pekan' },
                    { key: 'month', label: formatBulanShortLabel(safeSelectedMonth) },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setWeeklyRange(opt.key)}
                    className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      weeklyRange === opt.key
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}

              {granularity === 'bulanan' &&
                (
                  [
                    { key: '6m', label: '6 Bulan' },
                    { key: '12m', label: '12 Bulan' },
                    { key: 'year', label: `Tahun ${safeSelectedMonth.slice(0, 4)}` },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setMonthlyGrowthRange(opt.key)}
                    className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      monthlyGrowthRange === opt.key
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
            </div>
          </div>

          {/* Sorotan Ringkas Periode & Total Rentang */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/50 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 tabular-nums">
              <span>
                Total Baru (Rentang Ini):{' '}
                <strong className="text-emerald-700 dark:text-emerald-300">
                  +{growthSummary.totalBaru} donatur
                </strong>
              </span>
              <span>
                Potensi Tambahan:{' '}
                <strong className="text-teal-700 dark:text-teal-300">
                  {formatRupiah(growthSummary.totalPotensiBaru)}/bln
                </strong>
              </span>
              <span>
                Rata-rata:{' '}
                <strong className="text-slate-800 dark:text-slate-100">
                  {growthSummary.avgPerPeriod} /{' '}
                  {granularity === 'harian' ? 'hari' : granularity === 'pekanan' ? 'pekan' : 'bln'}
                </strong>
              </span>
            </div>
            {activeGrowthPoint && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 dark:text-slate-300 tabular-nums border-t md:border-t-0 md:border-l border-slate-200/80 dark:border-slate-700/80 pt-2 md:pt-0 md:pl-4">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {activeGrowthPoint.fullLabel}:
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                  +{activeGrowthPoint.donaturBaru} baru
                </span>
                <span>Akumulasi {activeGrowthPoint.kumulatifTotal}</span>
              </div>
            )}
          </div>

          {/* Grafik SVG Tunggal: Batang Donatur Baru + Garis Akumulasi */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Arahkan kursor atau ketuk batang grafik untuk melihat rincian tiap periode.</span>
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  Donatur Baru (sumbu kiri)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-3.5 bg-sky-600 dark:bg-sky-400" />
                  Akumulasi Total (sumbu kanan)
                </span>
              </div>
            </div>

            <div className="w-full overflow-x-auto clean-scroll">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full min-w-[540px] h-auto select-none"
                role="img"
                aria-label={`Grafik pertambahan donatur ${granularityLabel.toLowerCase()}`}
              >
                {/* Horizontal grid + Left (New) & Right (Cumulative) Y-Axis */}
                {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                  const y = padT + plotH - tick * plotH;
                  const leftVal = Math.round(maxNewDonors * tick);
                  const rightVal = Math.round(minCum + (maxCum - minCum) * tick);
                  return (
                    <g key={tick}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={svgW - padR}
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-700/70"
                        strokeDasharray={tick === 0 ? undefined : '3 3'}
                      />
                      <text
                        x={padL - 8}
                        y={y + 3}
                        textAnchor="end"
                        className="fill-slate-400 dark:fill-slate-500 text-[10px] font-medium"
                      >
                        {leftVal}
                      </text>
                      <text
                        x={svgW - padR + 8}
                        y={y + 3}
                        textAnchor="start"
                        className="fill-sky-600/80 dark:fill-sky-400/80 text-[10px] font-medium"
                      >
                        {rightVal}
                      </text>
                    </g>
                  );
                })}

                {/* Bars: Donatur Baru */}
                {growthSeries.map((p, i) => {
                  const gx = padL + i * growthGroupW;
                  const barW = Math.max(6, Math.min(28, growthGroupW * 0.56));
                  const barX = gx + (growthGroupW - barW) / 2;
                  const hBar = (p.donaturBaru / maxNewDonors) * plotH;
                  const isActive = activeGrowthPoint?.key === p.key;
                  const showTickLabel =
                    i === 0 || i === growthSeries.length - 1 || i % growthLabelStep === 0;

                  return (
                    <g
                      key={p.key}
                      onMouseEnter={() => setHoveredGrowthKey(p.key)}
                      onMouseLeave={() => setHoveredGrowthKey(null)}
                      onClick={() => {
                        setHoveredGrowthKey(p.key);
                        if (p.ym) onSelectMonth(p.ym);
                      }}
                      className="cursor-pointer"
                    >
                      {isActive && (
                        <rect
                          x={gx + 1}
                          y={padT - 4}
                          width={Math.max(4, growthGroupW - 2)}
                          height={plotH + 8}
                          rx={6}
                          className="fill-emerald-500/10 stroke-emerald-500/35"
                        />
                      )}
                      <rect
                        x={barX}
                        y={padT + plotH - hBar}
                        width={barW}
                        height={Math.max(p.donaturBaru > 0 ? 3 : 0, hBar)}
                        rx={3}
                        className={
                          isActive
                            ? 'fill-emerald-600 dark:fill-emerald-400'
                            : 'fill-emerald-500/80 dark:fill-emerald-400/75'
                        }
                      />
                      {p.donaturBaru > 0 && (growthSeries.length <= 16 || isActive) && (
                        <text
                          x={gx + growthGroupW / 2}
                          y={Math.max(padT + 9, padT + plotH - hBar - 4)}
                          textAnchor="middle"
                          className="fill-emerald-800 dark:fill-emerald-200 text-[10px] font-bold"
                        >
                          +{p.donaturBaru}
                        </text>
                      )}
                      {showTickLabel && (
                        <text
                          x={gx + growthGroupW / 2}
                          y={svgH - 10}
                          textAnchor="middle"
                          className={`text-[10px] font-semibold ${
                            isActive
                              ? 'fill-emerald-700 dark:fill-emerald-300'
                              : 'fill-slate-500 dark:fill-slate-400'
                          }`}
                        >
                          {p.shortLabel}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Line: Akumulasi Total Donatur */}
                {growthSeries.length > 1 && (
                  <polyline
                    fill="none"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={cumLinePoints}
                    className="stroke-sky-600 dark:stroke-sky-400 pointer-events-none"
                  />
                )}
                {growthSeries.map((p, i) => {
                  const cx = padL + growthGroupW * i + growthGroupW / 2;
                  const ratio = (p.kumulatifTotal - minCum) / Math.max(1, maxCum - minCum);
                  const cy = padT + plotH - ratio * plotH;
                  const isActive = activeGrowthPoint?.key === p.key;
                  if (growthSeries.length > 20 && !isActive && i % 2 !== 0) return null;
                  return (
                    <circle
                      key={`${p.key}-dot`}
                      cx={cx}
                      cy={cy}
                      r={isActive ? 4 : 2.8}
                      className="fill-sky-600 dark:fill-sky-400 stroke-white dark:stroke-slate-900 pointer-events-none"
                      strokeWidth={1.5}
                    />
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Tabel Pertambahan Donatur (Selaras dengan Granularitas Harian / Pekanan / Bulanan) */}
          <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Tabel Pertambahan Donatur — {granularityLabel}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {growthSeries.length} periode ditampilkan
              </p>
            </div>

            <div className="overflow-x-auto clean-scroll rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
              <table className="w-full min-w-[600px] text-left border-collapse">
                <thead>
                  <tr className="bg-emerald-800 dark:bg-emerald-950 text-white dark:text-emerald-100 text-[11px] font-semibold">
                    <th className="py-2.5 pl-4 pr-3 w-12 text-center">No</th>
                    <th className="py-2.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleGrowthSort('key')}
                        className="inline-flex items-center gap-1 hover:text-emerald-200 cursor-pointer"
                      >
                        <span>
                          {granularity === 'harian'
                            ? 'Tanggal'
                            : granularity === 'pekanan'
                            ? 'Rentang Pekan'
                            : 'Bulan'}
                        </span>
                        {renderSortIcon(growthSortField === 'key', growthSortDir)}
                      </button>
                    </th>
                    <th className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleGrowthSort('donaturBaru')}
                        className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                      >
                        <span>Donatur Baru</span>
                        {renderSortIcon(growthSortField === 'donaturBaru', growthSortDir)}
                      </button>
                    </th>
                    <th className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleGrowthSort('potensiBaruRp')}
                        className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                      >
                        <span>Potensi Baru / Bln</span>
                        {renderSortIcon(growthSortField === 'potensiBaruRp', growthSortDir)}
                      </button>
                    </th>
                    <th className="py-2.5 pl-4 pr-5 text-right">
                      <button
                        type="button"
                        onClick={() => handleGrowthSort('kumulatifTotal')}
                        className="inline-flex items-center justify-end gap-1 hover:text-emerald-200 cursor-pointer ml-auto"
                      >
                        <span>Akumulasi Total</span>
                        {renderSortIcon(growthSortField === 'kumulatifTotal', growthSortDir)}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-xs sm:text-sm">
                  {paginatedGrowthRows.items.map((row, idx) => (
                    <tr
                      key={row.key}
                      onMouseEnter={() => setHoveredGrowthKey(row.key)}
                      onMouseLeave={() => setHoveredGrowthKey(null)}
                      className="odd:bg-white/95 even:bg-slate-50/60 dark:odd:bg-slate-900/75 dark:even:bg-slate-800/55 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/35 transition-colors"
                    >
                      <td className="py-2.5 pl-4 pr-3 text-center text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {paginatedGrowthRows.startIndex + idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {row.fullLabel}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap">
                        <span
                          className={
                            row.donaturBaru > 0
                              ? 'font-bold text-emerald-700 dark:text-emerald-300'
                              : 'text-slate-400 dark:text-slate-500'
                          }
                        >
                          {row.donaturBaru > 0 ? `+${row.donaturBaru} donatur` : '0'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap">
                        <span
                          className={
                            row.potensiBaruRp > 0
                              ? 'font-semibold text-teal-800 dark:text-teal-300'
                              : 'text-slate-400 dark:text-slate-500'
                          }
                        >
                          {formatRupiah(row.potensiBaruRp)}
                        </span>
                      </td>
                      <td className="py-2.5 pl-4 pr-5 text-right font-semibold text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
                        {row.kumulatifTotal} donatur
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50/90 dark:bg-emerald-950/60 border-t border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                    <td colSpan={2} className="py-3 pl-4 pr-4 text-emerald-950 dark:text-emerald-100">
                      Total Pertambahan pada Rentang Ini
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-800 dark:text-emerald-300 tabular-nums whitespace-nowrap">
                      +{growthSummary.totalBaru} donatur
                    </td>
                    <td className="py-3 px-4 text-right text-teal-800 dark:text-teal-300 tabular-nums whitespace-nowrap">
                      {formatRupiah(growthSummary.totalPotensiBaru)}
                    </td>
                    <td className="py-3 pl-4 pr-5 text-right text-slate-800 dark:text-slate-100 tabular-nums whitespace-nowrap">
                      {growthSeries[growthSeries.length - 1]?.kumulatifTotal || 0} donatur
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {sortedGrowthRows.length > 0 && (
              <div className="mt-2">
                <PaginationBar
                  totalItems={sortedGrowthRows.length}
                  currentPage={paginatedGrowthRows.safePage}
                  pageSize={growthPageSize}
                  onPageChange={setGrowthPage}
                  onPageSizeChange={(next) => {
                    setGrowthPageSize(next);
                    setGrowthPage(1);
                  }}
                  itemLabel={
                    granularity === 'harian'
                      ? 'hari'
                      : granularity === 'pekanan'
                      ? 'pekan'
                      : 'bulan'
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== KONTEN MODE 2: ARUS DANA BULANAN ==================== */}
      {effectiveMode === 'keuangan' && (
        <div className="p-5 sm:p-6 space-y-5">
          {activeFinancePoint && (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-700 dark:text-slate-200 tabular-nums">
                <span className="font-bold text-slate-900 dark:text-white">
                  {activeFinancePoint.fullLabel}:
                </span>
                <span>
                  Komitmen <strong>{formatRupiah(activeFinancePoint.komitmenAktifRp)}</strong>
                </span>
                <span>
                  Valid{' '}
                  <strong className="text-emerald-700 dark:text-emerald-300">
                    {formatRupiah(activeFinancePoint.danaValidRp)}
                  </strong>
                </span>
                <span>
                  Umum &amp; Insidentil{' '}
                  <strong className="text-sky-700 dark:text-sky-300">
                    {formatRupiah(activeFinancePoint.danaTambahanValidRp)}
                  </strong>
                </span>
                <span>
                  Pending{' '}
                  <strong className="text-amber-700 dark:text-amber-300">
                    {formatRupiah(activeFinancePoint.danaPendingRp)}
                  </strong>
                </span>
                <span>
                  Lunas{' '}
                  <strong>
                    {activeFinancePoint.donaturLunas}/{activeFinancePoint.totalDonaturAktif}
                  </strong>
                </span>
              </div>
              {activeFinancePoint.ym !== safeSelectedMonth && (
                <button
                  type="button"
                  onClick={() => onSelectMonth(activeFinancePoint.ym)}
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Terapkan Bulan Ini
                </button>
              )}
            </div>
          )}

          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Ketuk bulan pada grafik untuk menerapkan filter periode di Dashboard.</span>
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" />
                  Komitmen
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  Dana Valid
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
                  Pending
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />
                  Umum &amp; Insidentil
                </span>
              </div>
            </div>

            <div className="w-full overflow-x-auto clean-scroll">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full min-w-[520px] h-auto select-none"
                role="img"
                aria-label="Grafik arus dana bulanan"
              >
                {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                  const y = padT + plotH - tick * plotH;
                  const val = maxFinanceRp * tick;
                  return (
                    <g key={tick}>
                      <line
                        x1={56}
                        y1={y}
                        x2={svgW - 16}
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-700/70"
                        strokeDasharray={tick === 0 ? undefined : '3 3'}
                      />
                      <text
                        x={48}
                        y={y + 3}
                        textAnchor="end"
                        className="fill-slate-400 dark:fill-slate-500 text-[10px] font-medium"
                      >
                        {formatCompactRp(val)}
                      </text>
                    </g>
                  );
                })}

                {financeSeries.map((p, i) => {
                  const gx = 56 + i * finGroupW;
                  const innerPad = Math.max(4, finGroupW * 0.16);
                  const usableW = Math.max(12, finGroupW - innerPad * 2);
                  const barW = Math.max(5, Math.min(18, (usableW - 6) / 3));
                  const gap = 3;
                  const totalBarsW = barW * 3 + gap * 2;
                  const startX = gx + (finGroupW - totalBarsW) / 2;

                  const hKomitmen = (p.komitmenAktifRp / maxFinanceRp) * plotH;
                  const hValid = (p.danaValidRp / maxFinanceRp) * plotH;
                  const hPending = (p.danaPendingRp / maxFinanceRp) * plotH;
                  const hTambahan = (p.danaTambahanValidRp / maxFinanceRp) * plotH;
                  const isSelected = p.ym === safeSelectedMonth;
                  const isHovered = p.ym === hoveredFinanceYm;

                  return (
                    <g
                      key={p.ym}
                      onMouseEnter={() => setHoveredFinanceYm(p.ym)}
                      onMouseLeave={() => setHoveredFinanceYm(null)}
                      onClick={() => onSelectMonth(p.ym)}
                      className="cursor-pointer"
                    >
                      {(isSelected || isHovered) && (
                        <rect
                          x={gx + 2}
                          y={padT - 4}
                          width={finGroupW - 4}
                          height={plotH + 8}
                          rx={8}
                          className={
                            isSelected
                              ? 'fill-emerald-500/10 stroke-emerald-500/35'
                              : 'fill-slate-400/10'
                          }
                        />
                      )}
                      <rect
                        x={startX}
                        y={padT + plotH - hKomitmen}
                        width={barW}
                        height={Math.max(2, hKomitmen)}
                        rx={3}
                        className="fill-slate-300 dark:fill-slate-600 transition-all"
                      />
                      <rect
                        x={startX + barW + gap}
                        y={padT + plotH - hValid}
                        width={barW}
                        height={Math.max(p.danaValidRp > 0 ? 2 : 0, hValid)}
                        rx={3}
                        className="fill-emerald-500 dark:fill-emerald-400 transition-all"
                      />
                      {p.danaPendingRp > 0 && (
                        <rect
                          x={startX + barW + gap}
                          y={padT + plotH - hValid - hPending}
                          width={barW}
                          height={Math.max(2, hPending)}
                          rx={2}
                          className="fill-amber-400 dark:fill-amber-300 transition-all"
                        />
                      )}
                      <rect
                        x={startX + (barW + gap) * 2}
                        y={padT + plotH - hTambahan}
                        width={barW}
                        height={Math.max(p.danaTambahanValidRp > 0 ? 2 : 0, hTambahan)}
                        rx={3}
                        className="fill-sky-500 dark:fill-sky-400 transition-all"
                      />
                      <text
                        x={gx + finGroupW / 2}
                        y={svgH - 10}
                        textAnchor="middle"
                        className={`text-[10px] font-semibold ${
                          isSelected
                            ? 'fill-emerald-700 dark:fill-emerald-300'
                            : 'fill-slate-500 dark:fill-slate-400'
                        }`}
                      >
                        {p.shortLabel}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* 3 Indikator Rasio Ringkas (Single-Elevation Divider Strip) */}
          <div className="pt-4 border-t border-slate-200/70 dark:border-slate-700/70 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/70 dark:divide-slate-700/70">
            <div className="py-3 md:py-0 md:pr-5 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Realisasi Komitmen
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {ratioSummary.realisasiPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${ratioSummary.realisasiPct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {formatRupiah(ratioSummary.sel?.danaValidRp || 0)} /{' '}
                {formatRupiah(ratioSummary.sel?.komitmenAktifRp || 0)}
              </p>
            </div>

            <div className="py-3 md:py-0 md:px-5 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Porsi Umum &amp; Insidentil
                </span>
                <span className="font-bold text-sky-700 dark:text-sky-300 tabular-nums">
                  {ratioSummary.tambahanPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${ratioSummary.tambahanPct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                Umum {formatRupiah(ratioSummary.sel?.danaLainnyaValidRp || 0)} · Insidentil{' '}
                {formatRupiah(ratioSummary.sel?.danaUmumValidRp || 0)}
              </p>
            </div>

            <div className="py-3 md:py-0 md:pl-5 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Komposisi Gender Donatur
                </span>
                <span className="font-bold text-teal-700 dark:text-teal-300 tabular-nums">
                  {ratioSummary.lakiPct}% / {ratioSummary.perempuanPct}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${ratioSummary.lakiPct}%` }}
                />
                <div
                  className="h-full bg-sky-400 transition-all duration-300"
                  style={{ width: `${ratioSummary.perempuanPct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                Laki-laki {ratioSummary.lakiCount} · Perempuan {ratioSummary.perempuanCount}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
