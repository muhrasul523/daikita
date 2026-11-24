import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Users } from 'lucide-react';
import { Donatur, TransaksiDonasi } from '../types';
import {
  buildMonthSequence,
  extractYearMonthFromDateStr,
  formatBulanLabel,
  formatBulanShortLabel,
  formatRupiah,
  getAdjacentYearMonth,
  normalizeWA,
} from '../utils/formatters';

interface DashboardChartsProps {
  donaturList: Donatur[];
  transaksiList: TransaksiDonasi[];
  selectedMonth: string;
  onSelectMonth: (ym: string) => void;
}

type RangeMode = '6m' | '12m' | 'year';

interface MonthStatPoint {
  ym: string;
  shortLabel: string;
  fullLabel: string;
  komitmenAktifRp: number;
  danaPendingRp: number;
  danaValidRp: number;
  danaKomitmenValidRp: number;
  danaLainnyaValidRp: number;
  danaSalurRp: number;
  donaturBaru: number;
  totalDonaturAktif: number;
  donaturLunas: number;
}

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

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  donaturList,
  transaksiList,
  selectedMonth,
  onSelectMonth,
}) => {
  const [rangeMode, setRangeMode] = useState<RangeMode>('6m');
  const [hoveredYm, setHoveredYm] = useState<string | null>(null);

  const monthKeys = useMemo(() => {
    const safeSelected = /^\d{4}-\d{2}$/.test(selectedMonth)
      ? selectedMonth
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    if (rangeMode === 'year') {
      const yr = safeSelected.slice(0, 4);
      return buildMonthSequence(`${yr}-01`, 12);
    }
    const count = rangeMode === '12m' ? 12 : 6;
    const startYm = getAdjacentYearMonth(safeSelected, -(count - 1));
    return buildMonthSequence(startYm, count);
  }, [selectedMonth, rangeMode]);

  const series = useMemo<MonthStatPoint[]>(() => {
    const parsedDonors = donaturList.map((d) => ({
      donor: d,
      regYm: extractYearMonthFromDateStr(d.tanggalDaftar),
      normWa: normalizeWA(d.noWa) || d.noWa,
    }));

    return monthKeys.map((ym) => {
      const monthTrx = transaksiList.filter((t) => t.bulanTagihan === ym);
      const validTrx = monthTrx.filter((t) => t.statusVerifikasi === 'Valid');
      const pendingTrx = monthTrx.filter((t) => t.statusVerifikasi === 'Pending');
      const salurTrx = validTrx.filter((t) => t.statusPenyaluran === 'Sudah Disalurkan');

      const danaValidRp = validTrx.reduce((s, t) => s + t.nominalTransfer, 0);
      const danaLainnyaValidRp = validTrx.reduce((s, t) => s + Math.max(0, t.donasiLainnya || 0), 0);
      const danaKomitmenValidRp = Math.max(0, danaValidRp - danaLainnyaValidRp);
      const danaPendingRp = pendingTrx.reduce((s, t) => s + t.nominalTransfer, 0);
      const danaSalurRp = salurTrx.reduce((s, t) => s + t.nominalTransfer, 0);

      let donaturBaru = 0;
      let totalDonaturAktif = 0;
      let komitmenAktifRp = 0;
      let donaturLunas = 0;

      const validIdSet = new Set(
        validTrx.map((t) => t.idDonatur).filter((id) => id && id !== '-')
      );
      const validWaSet = new Set(validTrx.map((t) => normalizeWA(t.noWa) || t.noWa).filter(Boolean));

      parsedDonors.forEach(({ donor, regYm, normWa }) => {
        if (regYm === ym) {
          donaturBaru += 1;
        }
        // Donatur dihitung aktif pada bulan `ym` bila belum ada tgl daftar atau terdaftar <= ym
        const existsByMonth = !regYm || regYm <= ym;
        if (existsByMonth && donor.statusAktif === 'Aktif') {
          totalDonaturAktif += 1;
          komitmenAktifRp += donor.nominalKomitmen || 0;
        }
        const isPaid =
          (donor.idDonatur && validIdSet.has(donor.idDonatur)) || (normWa && validWaSet.has(normWa));
        if (existsByMonth && isPaid) {
          donaturLunas += 1;
        }
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
        danaSalurRp,
        donaturBaru,
        totalDonaturAktif,
        donaturLunas,
      };
    });
  }, [monthKeys, donaturList, transaksiList]);

  const activePoint = useMemo(() => {
    const target = hoveredYm || selectedMonth;
    return series.find((p) => p.ym === target) || series[series.length - 1];
  }, [series, hoveredYm, selectedMonth]);

  const maxFinanceRp = useMemo(() => {
    let maxVal = 100_000;
    series.forEach((p) => {
      maxVal = Math.max(
        maxVal,
        p.komitmenAktifRp,
        p.danaValidRp + p.danaPendingRp,
        p.danaSalurRp
      );
    });
    return maxVal;
  }, [series]);

  const maxDonorScale = useMemo(() => {
    let maxVal = 5;
    series.forEach((p) => {
      maxVal = Math.max(maxVal, p.totalDonaturAktif, p.donaturBaru, p.donaturLunas);
    });
    return maxVal;
  }, [series]);

  const monthRatioSummary = useMemo(() => {
    const sel = series.find((p) => p.ym === selectedMonth) || activePoint;
    const prevIdx = series.findIndex((p) => p.ym === sel?.ym) - 1;
    const prev = prevIdx >= 0 ? series[prevIdx] : null;
    const growthDelta = sel && prev ? sel.donaturBaru - prev.donaturBaru : 0;

    const lakiCount = donaturList.filter((d) => d.jenisKelamin === 'Laki-laki').length;
    const perempuanCount = donaturList.filter((d) => d.jenisKelamin === 'Perempuan').length;
    const totalGender = Math.max(lakiCount + perempuanCount, 1);

    const targetKomitmen = sel?.komitmenAktifRp || 0;
    const masukValid = sel?.danaValidRp || 0;
    const realisasiPct =
      targetKomitmen > 0 ? Math.min(100, Math.round((masukValid / targetKomitmen) * 1000) / 10) : 0;
    const salurPct =
      masukValid > 0
        ? Math.min(100, Math.round(((sel?.danaSalurRp || 0) / masukValid) * 1000) / 10)
        : 0;

    return {
      sel,
      growthDelta,
      lakiCount,
      perempuanCount,
      lakiPct: Math.round((lakiCount / totalGender) * 100),
      perempuanPct: Math.round((perempuanCount / totalGender) * 100),
      realisasiPct,
      salurPct,
    };
  }, [series, selectedMonth, activePoint, donaturList]);

  // Koordinat SVG untuk Grafik Keuangan
  const financeSvgW = 680;
  const financeSvgH = 235;
  const padL = 52;
  const padR = 14;
  const padT = 16;
  const padB = 34;
  const plotW = financeSvgW - padL - padR;
  const plotH = financeSvgH - padT - padB;
  const groupW = plotW / Math.max(series.length, 1);

  // Koordinat SVG untuk Grafik Donatur
  const donorSvgW = 680;
  const donorSvgH = 235;
  const donorLinePoints = series
    .map((p, i) => {
      const cx = padL + groupW * i + groupW / 2;
      const cy = padT + plotH - (p.totalDonaturAktif / maxDonorScale) * plotH;
      return `${cx.toFixed(1)},${cy.toFixed(1)}`;
    })
    .join(' ');

  const lunasLinePoints = series
    .map((p, i) => {
      const cx = padL + groupW * i + groupW / 2;
      const cy = padT + plotH - (p.donaturLunas / maxDonorScale) * plotH;
      return `${cx.toFixed(1)},${cy.toFixed(1)}`;
    })
    .join(' ');

  return (
    <section className="glass-surface rounded-3xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200/70 dark:border-slate-700/70">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>Analitik &amp; Grafik Perkembangan Bulanan</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 safe-wrap">
            Pantau perbandingan komitmen, dana terkonfirmasi, penyaluran, serta pertambahan donatur
            dari bulan ke bulan. Ketuk atau arahkan kursor ke bulan pada grafik untuk rincian.
          </p>
        </div>

        <div
          className="inline-flex items-center gap-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/85 p-1 shrink-0 w-fit"
          role="group"
          aria-label="Rentang waktu grafik"
        >
          {(
            [
              { key: '6m', label: '6 Bulan' },
              { key: '12m', label: '12 Bulan' },
              { key: 'year', label: `Tahun ${selectedMonth.slice(0, 4)}` },
            ] as const
          ).map((item) => {
            const active = rangeMode === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setRangeMode(item.key)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
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

      {/* Ringkasan Bulan yang Disorot */}
      {activePoint && (
        <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-800/60 bg-gradient-to-r from-emerald-50/75 via-teal-50/55 to-sky-50/75 dark:from-emerald-950/45 dark:via-teal-950/35 dark:to-sky-950/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
              Sorotan Periode: {activePoint.fullLabel}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-200 tabular-nums">
              <span>
                Komitmen: <strong>{formatRupiah(activePoint.komitmenAktifRp)}</strong>
              </span>
              <span>
                Valid Masuk:{' '}
                <strong className="text-emerald-700 dark:text-emerald-300">
                  {formatRupiah(activePoint.danaValidRp)}
                </strong>
                {activePoint.danaLainnyaValidRp > 0 && (
                  <span className="text-sky-700 dark:text-sky-300">
                    {' '}
                    (+{formatRupiah(activePoint.danaLainnyaValidRp)} lainnya)
                  </span>
                )}
              </span>
              <span>
                Pending:{' '}
                <strong className="text-amber-700 dark:text-amber-300">
                  {formatRupiah(activePoint.danaPendingRp)}
                </strong>
              </span>
              <span>
                Disalurkan:{' '}
                <strong className="text-sky-700 dark:text-sky-300">
                  {formatRupiah(activePoint.danaSalurRp)}
                </strong>
              </span>
              <span>
                Donatur Baru:{' '}
                <strong className="text-teal-700 dark:text-teal-300">
                  +{activePoint.donaturBaru}
                </strong>{' '}
                ({activePoint.donaturLunas}/{activePoint.totalDonaturAktif} lunas)
              </span>
            </div>
          </div>
          {activePoint.ym !== selectedMonth && (
            <button
              type="button"
              onClick={() => onSelectMonth(activePoint.ym)}
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Terapkan ke Dashboard
            </button>
          )}
        </div>
      )}

      {/* Dua Grafik Utama */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Chart 1: Dana Masuk, Komitmen, Terkonfirmasi & Disalurkan */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/60 p-4 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Arus Dana &amp; Komitmen Bulanan
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Perbandingan target komitmen, valid masuk, menunggu verifikasi, &amp; penyaluran
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" />
                Komitmen
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                Dana Valid
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
                Pending
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />
                Disalurkan
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto clean-scroll">
            <svg
              viewBox={`0 0 ${financeSvgW} ${financeSvgH}`}
              className="w-full min-w-[460px] h-auto select-none"
              role="img"
              aria-label="Grafik arus dana bulanan"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                const y = padT + plotH - tick * plotH;
                const val = maxFinanceRp * tick;
                return (
                  <g key={tick}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={financeSvgW - padR}
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
                      {formatCompactRp(val)}
                    </text>
                  </g>
                );
              })}

              {series.map((p, i) => {
                const gx = padL + i * groupW;
                const innerPad = Math.max(4, groupW * 0.14);
                const usableW = Math.max(12, groupW - innerPad * 2);
                const barW = Math.max(4, Math.min(14, (usableW - 6) / 3));
                const gap = 3;
                const totalBarsW = barW * 3 + gap * 2;
                const startX = gx + (groupW - totalBarsW) / 2;

                const hKomitmen = (p.komitmenAktifRp / maxFinanceRp) * plotH;
                const hValid = (p.danaValidRp / maxFinanceRp) * plotH;
                const hPending = (p.danaPendingRp / maxFinanceRp) * plotH;
                const hSalur = (p.danaSalurRp / maxFinanceRp) * plotH;
                const isSelected = p.ym === selectedMonth;
                const isHovered = p.ym === hoveredYm;

                return (
                  <g
                    key={p.ym}
                    onMouseEnter={() => setHoveredYm(p.ym)}
                    onMouseLeave={() => setHoveredYm(null)}
                    onClick={() => onSelectMonth(p.ym)}
                    className="cursor-pointer"
                  >
                    {(isSelected || isHovered) && (
                      <rect
                        x={gx + 2}
                        y={padT - 4}
                        width={groupW - 4}
                        height={plotH + 8}
                        rx={8}
                        className={
                          isSelected
                            ? 'fill-emerald-500/10 stroke-emerald-500/35'
                            : 'fill-slate-400/10'
                        }
                      />
                    )}
                    {/* Bar 1: Komitmen */}
                    <rect
                      x={startX}
                      y={padT + plotH - hKomitmen}
                      width={barW}
                      height={Math.max(2, hKomitmen)}
                      rx={3}
                      className="fill-slate-300 dark:fill-slate-600 transition-all"
                    />
                    {/* Bar 2: Stacked Valid + Pending */}
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
                    {/* Bar 3: Disalurkan */}
                    <rect
                      x={startX + (barW + gap) * 2}
                      y={padT + plotH - hSalur}
                      width={barW}
                      height={Math.max(p.danaSalurRp > 0 ? 2 : 0, hSalur)}
                      rx={3}
                      className="fill-sky-500 dark:fill-sky-400 transition-all"
                    />
                    <text
                      x={gx + groupW / 2}
                      y={financeSvgH - 10}
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

        {/* Chart 2: Pertambahan Donatur & Kepatuhan Bulan ke Bulan */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/60 p-4 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>Pertambahan &amp; Keaktifan Donatur</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pendaftaran donatur baru per bulan (batang) &amp; total aktif/lunas (garis)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" />
                Donatur Baru
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-0.5 w-3 bg-sky-600 dark:bg-sky-400" />
                Total Aktif
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-0.5 w-3 bg-emerald-600 dark:bg-emerald-400" />
                Lunas
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto clean-scroll">
            <svg
              viewBox={`0 0 ${donorSvgW} ${donorSvgH}`}
              className="w-full min-w-[460px] h-auto select-none"
              role="img"
              aria-label="Grafik pertambahan donatur bulan ke bulan"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                const y = padT + plotH - tick * plotH;
                const val = Math.round(maxDonorScale * tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={donorSvgW - padR}
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
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Bars: Donatur Baru */}
              {series.map((p, i) => {
                const gx = padL + i * groupW;
                const barW = Math.max(10, Math.min(26, groupW * 0.44));
                const barX = gx + (groupW - barW) / 2;
                const hBaru = (p.donaturBaru / maxDonorScale) * plotH;
                const isSelected = p.ym === selectedMonth;
                const isHovered = p.ym === hoveredYm;

                return (
                  <g
                    key={p.ym}
                    onMouseEnter={() => setHoveredYm(p.ym)}
                    onMouseLeave={() => setHoveredYm(null)}
                    onClick={() => onSelectMonth(p.ym)}
                    className="cursor-pointer"
                  >
                    {(isSelected || isHovered) && (
                      <rect
                        x={gx + 2}
                        y={padT - 4}
                        width={groupW - 4}
                        height={plotH + 8}
                        rx={8}
                        className={
                          isSelected
                            ? 'fill-teal-500/10 stroke-teal-500/35'
                            : 'fill-slate-400/10'
                        }
                      />
                    )}
                    <rect
                      x={barX}
                      y={padT + plotH - hBaru}
                      width={barW}
                      height={Math.max(p.donaturBaru > 0 ? 4 : 0, hBaru)}
                      rx={4}
                      className="fill-teal-500/80 dark:fill-teal-400/80"
                    />
                    {p.donaturBaru > 0 && (
                      <text
                        x={gx + groupW / 2}
                        y={Math.max(padT + 10, padT + plotH - hBaru - 4)}
                        textAnchor="middle"
                        className="fill-teal-800 dark:fill-teal-200 text-[10px] font-bold"
                      >
                        +{p.donaturBaru}
                      </text>
                    )}
                    <text
                      x={gx + groupW / 2}
                      y={donorSvgH - 10}
                      textAnchor="middle"
                      className={`text-[10px] font-semibold ${
                        isSelected
                          ? 'fill-teal-700 dark:fill-teal-300'
                          : 'fill-slate-500 dark:fill-slate-400'
                      }`}
                    >
                      {p.shortLabel}
                    </text>
                  </g>
                );
              })}

              {/* Line: Total Aktif */}
              {series.length > 1 && (
                <polyline
                  fill="none"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={donorLinePoints}
                  className="stroke-sky-600 dark:stroke-sky-400 pointer-events-none"
                />
              )}
              {/* Line: Donatur Lunas */}
              {series.length > 1 && (
                <polyline
                  fill="none"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={lunasLinePoints}
                  className="stroke-emerald-600 dark:stroke-emerald-400 pointer-events-none"
                />
              )}

              {/* Dots */}
              {series.map((p, i) => {
                const cx = padL + groupW * i + groupW / 2;
                const cyAktif = padT + plotH - (p.totalDonaturAktif / maxDonorScale) * plotH;
                const cyLunas = padT + plotH - (p.donaturLunas / maxDonorScale) * plotH;
                return (
                  <g key={`${p.ym}-dots`} className="pointer-events-none">
                    <circle
                      cx={cx}
                      cy={cyAktif}
                      r={3.5}
                      className="fill-sky-600 dark:fill-sky-400 stroke-white dark:stroke-slate-900"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={cx}
                      cy={cyLunas}
                      r={3.5}
                      className="fill-emerald-600 dark:fill-emerald-400 stroke-white dark:stroke-slate-900"
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Ringkasan Rasio & Indikator Komprehensif */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/60 p-4 space-y-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Realisasi terhadap Komitmen
            </span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {monthRatioSummary.realisasiPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
              style={{ width: `${monthRatioSummary.realisasiPct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
            {formatRupiah(monthRatioSummary.sel?.danaValidRp || 0)} terkumpul dari target komitmen{' '}
            {formatRupiah(monthRatioSummary.sel?.komitmenAktifRp || 0)}.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/60 p-4 space-y-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Rasio Penyaluran Dana Valid
            </span>
            <span className="text-xs font-bold text-sky-700 dark:text-sky-300 tabular-nums">
              {monthRatioSummary.salurPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-500 transition-all duration-300"
              style={{ width: `${monthRatioSummary.salurPct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
            {formatRupiah(monthRatioSummary.sel?.danaSalurRp || 0)} telah disalurkan pada{' '}
            {formatBulanLabel(selectedMonth)}.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/60 p-4 space-y-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>Pertambahan &amp; Gender</span>
            </span>
            <span className="text-xs font-bold text-teal-700 dark:text-teal-300 tabular-nums">
              +{monthRatioSummary.sel?.donaturBaru || 0} bln ini
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${monthRatioSummary.lakiPct}%` }}
            />
            <div
              className="h-full bg-sky-400 transition-all duration-300"
              style={{ width: `${monthRatioSummary.perempuanPct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
            Laki-laki: {monthRatioSummary.lakiCount} ({monthRatioSummary.lakiPct}%) · Perempuan:{' '}
            {monthRatioSummary.perempuanCount} ({monthRatioSummary.perempuanPct}%)
          </p>
        </div>
      </div>
    </section>
  );
};
