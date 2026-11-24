import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Info,
  Lock,
  QrCode,
  Sparkles,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { PROGRAM_START_YM, TRANSFER_MIN_DATE } from '../config';
import {
  Donatur,
  LembagaConfig,
  Panitia,
  SubmitPembayaranPayload,
  TransaksiDonasi,
} from '../types';
import {
  buildMonthSequence,
  extractYearMonthFromDateStr,
  formatBulanLabel,
  formatBulanShortLabel,
  formatRupiah,
  formatRupiahInput,
  formatTanggalIndo,
  formatWADisplay,
  getAdjacentYearMonth,
  getCurrentYearMonth,
  getDriveThumbnailFallback,
  getTodayIsoDate,
  normalizeDriveImageUrl,
  normalizeWA,
  parseRupiahInput,
  previewAutoRenameFile,
  validateAndNormalizeWA,
} from '../utils/formatters';
import {
  compressTransferProof,
  formatFileSize,
  ProcessedUploadFile,
} from '../utils/imageCompressor';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

interface TabKonfirmasiProps {
  config: LembagaConfig;
  donaturList: Donatur[];
  transaksiList: TransaksiDonasi[];
  panitia: Panitia[];
  referralCode: string | null;
  preselectedDonatur: Donatur | null;
  preselectedMonth?: string | null;
  onClearPreselected: () => void;
  onSubmitPembayaran: (
    payload: SubmitPembayaranPayload
  ) => Promise<{
    ok: boolean;
    message: string;
    transaksi?: TransaksiDonasi;
    transaksiList?: TransaksiDonasi[];
    savedFileName?: string;
  }>;
  onGoToPendaftaran: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

export const TabKonfirmasi: React.FC<TabKonfirmasiProps> = ({
  config,
  donaturList,
  transaksiList,
  panitia,
  referralCode,
  preselectedDonatur,
  preselectedMonth,
  onClearPreselected,
  onSubmitPembayaran,
  onGoToPendaftaran,
  onNotify,
}) => {
  const todayIso = getTodayIsoDate();

  const rawInitialYm =
    preselectedMonth && /^\d{4}-\d{2}$/.test(preselectedMonth)
      ? preselectedMonth
      : getCurrentYearMonth();
  const initialYm = rawInitialYm < PROGRAM_START_YM ? PROGRAM_START_YM : rawInitialYm;

  const [selectedDonaturId, setSelectedDonaturId] = useState('');
  const [tanggalTransfer, setTanggalTransfer] = useState<string>(() => getTodayIsoDate());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([initialYm]);
  const [windowStartYm, setWindowStartYm] = useState<string>(() => {
    const firstYearEnd = getAdjacentYearMonth(PROGRAM_START_YM, 11);
    return initialYm <= firstYearEnd ? PROGRAM_START_YM : initialYm;
  });
  const [nominalInput, setNominalInput] = useState('');
  const [isNominalCustom, setIsNominalCustom] = useState(false);
  const [keterangan, setKeterangan] = useState('');

  const [uploadFile, setUploadFile] = useState<ProcessedUploadFile | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    transaksiList: TransaksiDonasi[];
    totalNominal: number;
    totalKomitmen: number;
    totalLainnya: number;
    tanggalTransfer: string;
    savedFileName?: string;
  } | null>(null);
  const [copiedRek, setCopiedRek] = useState<string | null>(null);
  const [showQrisZoom, setShowQrisZoom] = useState(false);
  const [qrisImgSrc, setQrisImgSrc] = useState(() => normalizeDriveImageUrl(config.qrisUrl));

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQrisImgSrc(normalizeDriveImageUrl(config.qrisUrl));
  }, [config.qrisUrl]);

  // Penentuan otomatis Diinput Oleh berdasarkan link referral ?ref=KODE
  const autoDiinputOleh = useMemo(() => {
    if (referralCode && referralCode.trim()) {
      const codeUpper = referralCode.trim().toUpperCase();
      const matched = panitia.find((p) => p.kodePanitia.toUpperCase() === codeUpper);
      if (matched) {
        return `${matched.namaPanitia} (${matched.kodePanitia})`;
      }
      return `Pengurus (${codeUpper})`;
    }
    return 'Donatur (Mandiri)';
  }, [referralCode, panitia]);

  const matchedReferralPanitia = useMemo(() => {
    if (!referralCode) return null;
    const codeUpper = referralCode.trim().toUpperCase();
    return panitia.find((p) => p.kodePanitia.toUpperCase() === codeUpper) || null;
  }, [referralCode, panitia]);

  const donaturOptions = useMemo<SearchableOption[]>(
    () =>
      donaturList.map((d) => ({
        value: d.idDonatur,
        label: d.namaLengkap,
        sublabel: `${d.idDonatur} · ${formatWADisplay(d.noWa)}${d.domisili ? ` · ${d.domisili}` : ''}`,
        metaRight: formatRupiah(d.nominalKomitmen),
        keywords: `${d.namaLengkap} ${d.idDonatur} ${d.noWa} ${d.noWa.replace(/^62/, '0')} ${d.email || ''} ${d.domisili || ''}`,
      })),
    [donaturList]
  );

  const selectedDonatur = useMemo(
    () => donaturList.find((d) => d.idDonatur === selectedDonaturId) || null,
    [donaturList, selectedDonaturId]
  );

  // Bulan minimum yang dapat dipilih: mulai Nov 2026 atau bulan pendaftaran donatur (mana lebih akhir)
  const minSelectableYm = useMemo(() => {
    if (!selectedDonatur) return PROGRAM_START_YM;
    const regYm = extractYearMonthFromDateStr(selectedDonatur.tanggalDaftar);
    if (regYm && regYm > PROGRAM_START_YM) return regYm;
    return PROGRAM_START_YM;
  }, [selectedDonatur]);

  // 12 bulan berurutan yang ditampilkan dalam satu layar (mis. Nov 2026 s.d. Okt 2027)
  const visibleMonths = useMemo(
    () => buildMonthSequence(windowStartYm < minSelectableYm ? minSelectableYm : windowStartYm, 12),
    [windowStartYm, minSelectableYm]
  );

  // Status transaksi yang sudah ada per bulan untuk donatur terpilih
  const donorMonthStatusMap = useMemo(() => {
    const map = new Map<string, 'Valid' | 'Pending'>();
    if (!selectedDonatur) return map;
    const targetWa = normalizeWA(selectedDonatur.noWa) || selectedDonatur.noWa;

    transaksiList.forEach((t) => {
      const byId =
        t.idDonatur && t.idDonatur !== '-' && t.idDonatur === selectedDonatur.idDonatur;
      const byWa = targetWa && (normalizeWA(t.noWa) || t.noWa) === targetWa;
      if (!byId && !byWa) return;
      if (!/^\d{4}-\d{2}$/.test(t.bulanTagihan)) return;

      const prev = map.get(t.bulanTagihan);
      if (t.statusVerifikasi === 'Valid') {
        map.set(t.bulanTagihan, 'Valid');
      } else if (t.statusVerifikasi === 'Pending' && prev !== 'Valid') {
        map.set(t.bulanTagihan, 'Pending');
      }
    });
    return map;
  }, [selectedDonatur, transaksiList]);

  const sortedSelectedMonths = useMemo(
    () => [...selectedMonths].sort((a, b) => a.localeCompare(b)),
    [selectedMonths]
  );

  // Pastikan pilihan bulan dan jendela 12 bulan tidak mundur sebelum minSelectableYm
  useEffect(() => {
    setWindowStartYm((prev) => (prev < minSelectableYm ? minSelectableYm : prev));
    setSelectedMonths((prev) => {
      const valid = prev.filter((m) => m >= minSelectableYm);
      if (valid.length > 0) return valid;
      const cur = getCurrentYearMonth();
      return [cur >= minSelectableYm ? cur : minSelectableYm];
    });
  }, [minSelectableYm]);

  // Isi otomatis nominal saat memilih donatur atau mengubah jumlah bulan (kecuali jika user mengedit manual)
  useEffect(() => {
    if (!selectedDonatur) {
      if (!isNominalCustom) setNominalInput('');
      return;
    }
    if (!isNominalCustom) {
      const total = Math.max(1, sortedSelectedMonths.length) * selectedDonatur.nominalKomitmen;
      setNominalInput(total > 0 ? total.toLocaleString('id-ID') : '');
    }
  }, [selectedDonatur, sortedSelectedMonths, isNominalCustom]);

  useEffect(() => {
    if (preselectedDonatur) {
      setSelectedDonaturId(preselectedDonatur.idDonatur);
      setIsNominalCustom(false);
      const regYm = extractYearMonthFromDateStr(preselectedDonatur.tanggalDaftar);
      const donorMin = regYm && regYm > PROGRAM_START_YM ? regYm : PROGRAM_START_YM;
      if (preselectedMonth && /^\d{4}-\d{2}$/.test(preselectedMonth)) {
        const safeMonth = preselectedMonth < donorMin ? donorMin : preselectedMonth;
        setSelectedMonths([safeMonth]);
        const endOfFirstWindow = getAdjacentYearMonth(donorMin, 11);
        setWindowStartYm(safeMonth <= endOfFirstWindow ? donorMin : safeMonth);
      } else {
        setWindowStartYm(donorMin);
      }
      setErrorMsg(null);
      onClearPreselected();
    }
  }, [preselectedDonatur, preselectedMonth, onClearPreselected]);

  const handleDonaturDropdownChange = (val: string) => {
    setSelectedDonaturId(val);
    setIsNominalCustom(false);
    setErrorMsg(null);
    if (!val) {
      setNominalInput('');
      setWindowStartYm(PROGRAM_START_YM);
      return;
    }
    const found = donaturList.find((d) => d.idDonatur === val);
    if (found) {
      const regYm = extractYearMonthFromDateStr(found.tanggalDaftar);
      const donorMin = regYm && regYm > PROGRAM_START_YM ? regYm : PROGRAM_START_YM;
      setWindowStartYm(donorMin);
    }
  };

  const handleToggleMonth = (ym: string) => {
    if (ym < minSelectableYm) return;
    setIsNominalCustom(false);
    setErrorMsg(null);
    setSelectedMonths((prev) => {
      if (prev.includes(ym)) {
        if (prev.length === 1) return prev; // Wajib minimal 1 bulan
        return prev.filter((m) => m !== ym);
      }
      return [...prev, ym].sort((a, b) => a.localeCompare(b));
    });
  };

  const handleApplyConsecutiveMonths = (count: number) => {
    const rawBase = sortedSelectedMonths[0] || minSelectableYm;
    const baseMonth = rawBase < minSelectableYm ? minSelectableYm : rawBase;
    const seq = buildMonthSequence(baseMonth, count);
    setSelectedMonths(seq);
    setIsNominalCustom(false);
    setErrorMsg(null);
  };

  const handleShiftWindow = (deltaMonths: number) => {
    setWindowStartYm((prev) => {
      const next = getAdjacentYearMonth(prev, deltaMonths);
      return next < minSelectableYm ? minSelectableYm : next;
    });
  };

  const parsedNominal = useMemo(() => parseRupiahInput(nominalInput), [nominalInput]);

  // Rincian Donasi Komitmen vs Donasi Lainnya (kelebihan nominal di atas komitmen)
  const expectedKomitmenTotal = useMemo(() => {
    if (!selectedDonatur || selectedDonatur.nominalKomitmen <= 0) return 0;
    return selectedDonatur.nominalKomitmen * Math.max(1, sortedSelectedMonths.length);
  }, [selectedDonatur, sortedSelectedMonths.length]);

  const donasiKomitmenRp = useMemo(() => {
    if (expectedKomitmenTotal > 0 && parsedNominal > expectedKomitmenTotal) {
      return expectedKomitmenTotal;
    }
    return parsedNominal;
  }, [expectedKomitmenTotal, parsedNominal]);

  const donasiLainnyaRp = useMemo(() => {
    if (expectedKomitmenTotal > 0 && parsedNominal > expectedKomitmenTotal) {
      return parsedNominal - expectedKomitmenTotal;
    }
    return 0;
  }, [expectedKomitmenTotal, parsedNominal]);

  // Deteksi cerdas bila user mengetik nominal kelipatan komitmen (mis. komitmen 100rb -> ketik 300rb)
  const smartBatchSuggestionCount = useMemo(() => {
    if (!selectedDonatur || selectedDonatur.nominalKomitmen <= 0 || parsedNominal <= 0) return null;
    if (parsedNominal % selectedDonatur.nominalKomitmen !== 0) return null;
    const multiple = Math.round(parsedNominal / selectedDonatur.nominalKomitmen);
    if (multiple >= 2 && multiple <= 24 && multiple !== sortedSelectedMonths.length) {
      return multiple;
    }
    return null;
  }, [selectedDonatur, parsedNominal, sortedSelectedMonths.length]);

  const autoRenamePreview = useMemo(() => {
    return previewAutoRenameFile({
      tanggalTransfer,
      bulanTagihan: sortedSelectedMonths[0] || minSelectableYm,
      bulanList: sortedSelectedMonths,
      namaDonatur: selectedDonatur?.namaLengkap || 'Nama-Donatur',
      nominalTransfer: parsedNominal,
      extension: uploadFile?.extension || 'jpg',
    });
  }, [tanggalTransfer, sortedSelectedMonths, minSelectableYm, selectedDonatur, parsedNominal, uploadFile]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setIsCompressing(true);
    try {
      const processed = await compressTransferProof(file);
      setUploadFile(processed);
    } catch (err) {
      setUploadFile(null);
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memproses file bukti transfer.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCopyRekening = async (nomor: string, bank: string) => {
    try {
      await navigator.clipboard.writeText(nomor);
      setCopiedRek(nomor);
      onNotify('success', `Nomor rekening ${bank} disalin`, nomor);
      setTimeout(() => setCopiedRek(null), 2000);
    } catch {
      onNotify('error', 'Gagal menyalin nomor rekening');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessInfo(null);

    if (!selectedDonatur) {
      setErrorMsg(
        'Silakan pilih donatur terdaftar terlebih dahulu. Jika nama belum ada, klik tombol Daftar Donatur Baru.'
      );
      return;
    }

    const waCheck = validateAndNormalizeWA(selectedDonatur.noWa);
    if (!waCheck.valid) {
      setErrorMsg(waCheck.error);
      return;
    }

    if (sortedSelectedMonths.length === 0) {
      setErrorMsg('Pilih minimal 1 periode bulan donasi / tagihan.');
      return;
    }

    if (!tanggalTransfer || !/^\d{4}-\d{2}-\d{2}$/.test(tanggalTransfer)) {
      setErrorMsg('Tanggal transfer wajib diisi dengan format yang valid.');
      return;
    }

    if (tanggalTransfer < TRANSFER_MIN_DATE) {
      setErrorMsg(`Tanggal transfer tidak boleh sebelum ${formatTanggalIndo(TRANSFER_MIN_DATE)}.`);
      return;
    }

    if (tanggalTransfer > todayIso) {
      setErrorMsg(
        `Tanggal transfer tidak boleh melebihi hari ini (${formatTanggalIndo(todayIso)}).`
      );
      return;
    }

    if (parsedNominal <= 0) {
      setErrorMsg('Nominal transfer wajib diisi dan harus lebih dari Rp 0.');
      return;
    }

    setIsSubmitting(true);
    const res = await onSubmitPembayaran({
      idDonatur: selectedDonatur.idDonatur,
      namaDonatur: selectedDonatur.namaLengkap,
      noWa: waCheck.normalized,
      tanggalTransfer,
      bulanTagihan: sortedSelectedMonths[0],
      bulanTagihanList: sortedSelectedMonths,
      nominalTransfer: parsedNominal,
      nominalKomitmenPerBulan: selectedDonatur.nominalKomitmen,
      diinputOleh: autoDiinputOleh,
      keterangan: keterangan.trim() || undefined,
      fileBase64: uploadFile?.base64,
      fileMimeType: uploadFile?.mimeType,
      fileName: uploadFile?.originalName,
    });
    setIsSubmitting(false);

    const createdList =
      res.transaksiList && res.transaksiList.length > 0
        ? res.transaksiList
        : res.transaksi
        ? [res.transaksi]
        : [];

    if (res.ok && createdList.length > 0) {
      setSuccessInfo({
        transaksiList: createdList,
        totalNominal: createdList.reduce((sum, t) => sum + t.nominalTransfer, 0),
        totalKomitmen: createdList.reduce((sum, t) => sum + (t.nominalKomitmen || t.nominalTransfer), 0),
        totalLainnya: createdList.reduce((sum, t) => sum + (t.donasiLainnya || 0), 0),
        tanggalTransfer: createdList[0].tanggalTransfer || tanggalTransfer,
        savedFileName: res.savedFileName,
      });
      setKeterangan('');
      setTanggalTransfer(getTodayIsoDate());
      setIsNominalCustom(false);
      handleRemoveFile();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <section className="lg:col-span-8 glass-surface rounded-3xl p-5 sm:p-8 min-w-0">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Konfirmasi Pembayaran Kafalah Dai
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Pilih donatur terdaftar, tentukan satu atau beberapa bulan sekaligus, dan cek nominal
            otomatis sesuai komitmen. Bukti transfer bersifat opsional.
          </p>
        </div>

        {/* Info Pencatatan Referral Otomatis */}
        <div className="mb-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/70 bg-emerald-50/55 dark:bg-emerald-950/35 px-4 py-3 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="min-w-0 text-xs text-emerald-900 dark:text-emerald-200 safe-wrap">
            {matchedReferralPanitia || referralCode ? (
              <span>
                Konfirmasi dicatat otomatis melalui link referral pengurus:{' '}
                <strong>{autoDiinputOleh}</strong>.
              </span>
            ) : (
              <span>
                Tanpa link referral pengurus, konfirmasi dicatat otomatis sebagai{' '}
                <strong>Donatur (Mandiri)</strong>.
              </span>
            )}
          </div>
        </div>

        {successInfo && (
          <div className="mb-6 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-gradient-to-br from-emerald-50/90 to-teal-50/70 dark:from-emerald-950/60 dark:to-teal-950/40 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                  Konfirmasi Pembayaran Terkirim ({successInfo.transaksiList.length} Periode Bulan)
                </p>
                <p className="mt-1 text-xs text-emerald-900/85 dark:text-emerald-200/90 leading-relaxed safe-wrap">
                  Atas nama <strong>{successInfo.transaksiList[0].namaDonatur}</strong> sebesar total{' '}
                  <strong className="tabular-nums">{formatRupiah(successInfo.totalNominal)}</strong>{' '}
                  (Tgl transfer: <strong>{formatTanggalIndo(successInfo.tanggalTransfer)}</strong>)
                  untuk periode{' '}
                  <strong>
                    {successInfo.transaksiList
                      .map((t) => formatBulanLabel(t.bulanTagihan))
                      .join(', ')}
                  </strong>{' '}
                  kini berstatus <strong>Menunggu Verifikasi</strong>.
                </p>
                {successInfo.totalLainnya > 0 && (
                  <p className="mt-1 text-xs text-teal-900 dark:text-teal-200 tabular-nums safe-wrap">
                    Rincian: Donasi Komitmen{' '}
                    <strong>{formatRupiah(successInfo.totalKomitmen)}</strong> + Donasi Lainnya{' '}
                    <strong>{formatRupiah(successInfo.totalLainnya)}</strong>.
                  </p>
                )}
                <p className="mt-1.5 text-[11px] font-mono text-emerald-800 dark:text-emerald-300 safe-wrap">
                  ID Transaksi: {successInfo.transaksiList.map((t) => t.idTransaksi).join(', ')}
                </p>
                {successInfo.savedFileName && (
                  <p className="mt-1 text-[11px] font-mono text-teal-800 dark:text-teal-300 safe-wrap">
                    Arsip Bukti: {successInfo.savedFileName}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 rounded-2xl border border-rose-200 dark:border-rose-800/80 bg-rose-50/90 dark:bg-rose-950/50 p-4 text-xs font-medium text-rose-800 dark:text-rose-200 leading-relaxed safe-wrap">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Pilih Donatur Terdaftar + Tombol Daftar Baru */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="konf-search"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Pilih Donatur Terdaftar (Nama / No. WA / ID / Domisili){' '}
                <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <button
                type="button"
                onClick={onGoToPendaftaran}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0" />
                <span>Belum terdaftar? Daftar Donatur Baru</span>
              </button>
            </div>

            <SearchableSelect
              id="konf-search"
              ariaLabel="Pilih donatur terdaftar"
              options={donaturOptions}
              value={selectedDonaturId}
              onChange={handleDonaturDropdownChange}
              allowClear
              placeholder="Ketik atau pilih donatur dari daftar..."
              searchPlaceholder="Ketik nama, nomor WA, atau ID donatur..."
              emptyText="Donatur belum ditemukan. Klik tombol 'Daftar Donatur Baru' di atas."
            />

            {/* Profil Otomatis Donatur Terpilih (Read-only) */}
            {selectedDonatur ? (
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/75 dark:bg-slate-800/45 p-4">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    <Lock className="h-3 w-3 shrink-0" />
                    <span>Identitas Donatur Terisi Otomatis</span>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                    Komitmen: {formatRupiah(selectedDonatur.nominalKomitmen)} / bulan
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="min-w-0 rounded-xl bg-white/80 dark:bg-slate-900/70 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      ID Donatur
                    </p>
                    <p className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                      {selectedDonatur.idDonatur}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-white/80 dark:bg-slate-900/70 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      Nama Donatur
                    </p>
                    <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100 safe-wrap">
                      {selectedDonatur.namaLengkap}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-white/80 dark:bg-slate-900/70 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      No. WhatsApp
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatWADisplay(selectedDonatur.noWa)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/30 px-4 py-3 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="safe-wrap">
                  ID Donatur, Nama, dan No. WhatsApp terisi otomatis setelah Anda memilih donatur di
                  atas.
                </span>
                <button
                  type="button"
                  onClick={onGoToPendaftaran}
                  className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 text-left cursor-pointer"
                >
                  Ke Halaman Pendaftaran →
                </button>
              </div>
            )}
          </div>

          {/* Pilih Bulan Donasi (12 Bulan Berurutan Mulai Nov 2026 / Bulan Daftar Donatur) */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/50 p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    Pilih Bulan Donasi / Tagihan{' '}
                    <span className="text-rose-600 dark:text-rose-400">*</span>
                  </span>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
                  Menampilkan 12 bulan berurutan mulai{' '}
                  <strong>{formatBulanLabel(minSelectableYm)}</strong> ke depan. Bisa pilih 1 atau
                  beberapa bulan sekaligus.
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={windowStartYm <= minSelectableYm}
                  onClick={() => handleShiftWindow(-12)}
                  className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  aria-label="12 bulan sebelumnya"
                  title="12 bulan sebelumnya"
                >
                  <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">12 Bln</span>
                </button>
                <span className="px-2 text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                  {formatBulanShortLabel(visibleMonths[0])} –{' '}
                  {formatBulanShortLabel(visibleMonths[visibleMonths.length - 1])}
                </span>
                <button
                  type="button"
                  onClick={() => handleShiftWindow(12)}
                  className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                  aria-label="12 bulan berikutnya"
                  title="12 bulan berikutnya"
                >
                  <span className="hidden sm:inline">12 Bln</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
            </div>

            {/* Pintasan Paket Beberapa Bulan Berurutan */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                Pilih cepat berurutan:
              </span>
              {[1, 2, 3, 6, 12].map((count) => {
                const active = sortedSelectedMonths.length === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handleApplyConsecutiveMonths(count)}
                    className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-400'
                    }`}
                  >
                    {count} Bulan
                  </button>
                );
              })}
            </div>

            {/* Grid 12 Bulan Berurutan (lintas tahun sekaligus) */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {visibleMonths.map((ym) => {
                const isSelected = sortedSelectedMonths.includes(ym);
                const existingStatus = donorMonthStatusMap.get(ym);

                return (
                  <button
                    key={ym}
                    type="button"
                    onClick={() => handleToggleMonth(ym)}
                    className={`rounded-xl border px-2.5 py-2 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : 'border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:border-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold tabular-nums">
                        {formatBulanShortLabel(ym)}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </div>
                    <p
                      className={`mt-0.5 text-[10px] font-medium truncate ${
                        isSelected
                          ? 'text-emerald-100'
                          : existingStatus === 'Valid'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : existingStatus === 'Pending'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {existingStatus === 'Valid'
                        ? 'Sudah Lunas'
                        : existingStatus === 'Pending'
                        ? 'Pending'
                        : 'Belum Bayar'}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Ringkasan Bulan Terpilih */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Terpilih ({sortedSelectedMonths.length} bulan):
              </span>
              {sortedSelectedMonths.map((ym) => (
                <span
                  key={ym}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200"
                >
                  <span>{formatBulanLabel(ym)}</span>
                  {sortedSelectedMonths.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleToggleMonth(ym)}
                      className="hover:text-rose-600 cursor-pointer"
                      aria-label={`Hapus ${formatBulanLabel(ym)}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Tanggal Transfer & Nominal Transfer Total */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label
                htmlFor="konf-tgl-transfer"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Tanggal Transfer <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <input
                id="konf-tgl-transfer"
                type="date"
                required
                min={TRANSFER_MIN_DATE}
                max={todayIso}
                value={tanggalTransfer}
                onChange={(e) => setTanggalTransfer(e.target.value)}
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                Otomatis terisi hari ini ({formatTanggalIndo(todayIso)}). Dapat diubah ke tanggal
                sebelumnya, tidak dapat memilih tanggal mendatang.
              </p>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="konf-nominal"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Nominal Transfer Total <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Rp
                </span>
                <input
                  id="konf-nominal"
                  type="text"
                  inputMode="numeric"
                  required
                  value={nominalInput}
                  onChange={(e) => {
                    setIsNominalCustom(true);
                    setNominalInput(formatRupiahInput(e.target.value));
                  }}
                  placeholder="100.000"
                  className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 pl-11 pr-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              {selectedDonatur && (
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
                  Komitmen: {sortedSelectedMonths.length} bln ×{' '}
                  {formatRupiah(selectedDonatur.nominalKomitmen)} ={' '}
                  <strong>{formatRupiah(expectedKomitmenTotal)}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Rincian Otomatis Kelebihan Transfer sebagai Donasi Lainnya */}
          {selectedDonatur && donasiLainnyaRp > 0 && (
            <div className="rounded-2xl border border-teal-200/90 dark:border-teal-800/75 bg-gradient-to-r from-emerald-50/80 via-teal-50/70 to-sky-50/70 dark:from-emerald-950/45 dark:via-teal-950/40 dark:to-sky-950/35 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-teal-900 dark:text-teal-200">
                  Kelebihan Nominal Tercatat Otomatis sebagai Donasi Lainnya
                </p>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  Total: {formatRupiah(parsedNominal)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl bg-white/85 dark:bg-slate-900/70 px-3 py-2 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300">
                    Donasi Komitmen ({sortedSelectedMonths.length} bln)
                  </span>
                  <strong className="text-emerald-800 dark:text-emerald-300 tabular-nums">
                    {formatRupiah(donasiKomitmenRp)}
                  </strong>
                </div>
                <div className="rounded-xl bg-white/85 dark:bg-slate-900/70 px-3 py-2 border border-sky-200/70 dark:border-sky-800/60 flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300">Donasi Lainnya</span>
                  <strong className="text-sky-700 dark:text-sky-300 tabular-nums">
                    +{formatRupiah(donasiLainnyaRp)}
                  </strong>
                </div>
              </div>
              {smartBatchSuggestionCount && (
                <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-sky-900 dark:text-sky-200">
                  <span className="safe-wrap">
                    <Sparkles className="inline h-3 w-3 mr-1 text-sky-600 dark:text-sky-400" />
                    Atau jika ingin dibagi rata menjadi <strong>{smartBatchSuggestionCount} bulan</strong>{' '}
                    komitmen ({formatRupiah(selectedDonatur.nominalKomitmen)}/bln):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleApplyConsecutiveMonths(smartBatchSuggestionCount)}
                    className="rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Jadikan {smartBatchSuggestionCount} Bulan
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Keterangan (Opsional) */}
          <div className="min-w-0">
            <label
              htmlFor="konf-keterangan"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
            >
              Keterangan (Opsional)
            </label>
            <textarea
              id="konf-keterangan"
              rows={2}
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Catatan tambahan, mis. bayar rapel 3 bulan, titip doa, atau transfer via rekening keluarga..."
              className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Upload Bukti Transfer (Opsional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Unggah Bukti Transfer (Opsional — jika ada: JPG, PNG, WEBP, atau PDF)
            </label>

            {!uploadFile ? (
              <label
                htmlFor="konf-file"
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200/90 dark:border-emerald-800/80 bg-emerald-50/35 dark:bg-emerald-950/25 px-6 py-7 text-center hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm mb-3">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {isCompressing
                    ? 'Mengompresi gambar bukti transfer...'
                    : 'Pilih file bukti transfer (opsional)'}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md">
                  Anda tetap dapat mengirim konfirmasi meski tanpa mengunggah file bukti transfer.
                  Jika diunggah, gambar otomatis dikompresi agar ringan.
                </p>
                <input
                  ref={fileInputRef}
                  id="konf-file"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileSelected}
                  disabled={isCompressing}
                  className="sr-only"
                />
              </label>
            ) : (
              <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/80 bg-white/90 dark:bg-slate-900/85 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {uploadFile.isPdf ? (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                    <FileText className="h-7 w-7" />
                  </div>
                ) : (
                  <img
                    src={uploadFile.previewUrl}
                    alt="Pratinjau bukti transfer"
                    className="h-20 w-20 shrink-0 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 safe-wrap">
                    {uploadFile.originalName}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                    Ukuran asli {formatFileSize(uploadFile.originalSizeBytes)} → siap kirim{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {formatFileSize(uploadFile.compressedSizeBytes)}
                    </strong>
                  </p>
                  <p className="mt-1 text-[11px] font-mono text-teal-700 dark:text-teal-300 safe-wrap">
                    Nama File Tersimpan: {autoRenamePreview}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-200 dark:hover:border-rose-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Hapus File</span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 safe-wrap">
              {uploadFile ? (
                <>
                  Nama file otomatis:{' '}
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {autoRenamePreview}
                  </span>
                </>
              ) : (
                <span>Tanpa bukti upload — pencatatan nominal &amp; periode tetap tersimpan.</span>
              )}
            </p>
            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(5,150,105,0.45)] hover:opacity-95 disabled:opacity-55 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span>
                {isSubmitting
                  ? 'Mengirim Konfirmasi...'
                  : sortedSelectedMonths.length > 1
                  ? `Kirim Konfirmasi (${sortedSelectedMonths.length} Bulan)`
                  : 'Kirim Konfirmasi Pembayaran'}
              </span>
            </button>
          </div>
        </form>
      </section>

      <aside className="lg:col-span-4 glass-surface rounded-3xl p-6 space-y-5 min-w-0">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Salin Nomor Rekening
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed safe-wrap">
            {config.catatanPembayaran ||
              `Pastikan transfer ditujukan ke rekening resmi ${config.namaLembaga} berikut.`}
          </p>
        </div>

        <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
          {config.infoRekening.map((rek) => {
            const isCopied = copiedRek === rek.nomor;
            return (
              <div
                key={`${rek.bank}-${rek.nomor}`}
                className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 safe-wrap">
                    {rek.bank}
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5 safe-wrap">
                    {rek.nomor}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                    a.n. {rek.atasNama}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyRekening(rek.nomor, rek.bank)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300 dark:hover:border-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 shrink-0" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {config.showQris && config.qrisUrl && (
          <div className="pt-5 border-t border-slate-200/70 dark:border-slate-700/70 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <QrCode className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>QRIS Pembayaran</span>
                </h3>
                {config.qrisMerchantName && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                    {config.qrisMerchantName}
                  </p>
                )}
              </div>
              <a
                href={qrisImgSrc}
                download="QRIS-DAIKITA.png"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300 whitespace-nowrap shrink-0"
              >
                <Download className="h-3 w-3 shrink-0" />
                <span>Unduh</span>
              </a>
            </div>
            <button
              type="button"
              onClick={() => setShowQrisZoom(true)}
              className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white p-3 flex items-center justify-center hover:border-emerald-400 transition-colors cursor-pointer"
              title="Klik untuk memperbesar QRIS"
            >
              <img
                src={qrisImgSrc}
                alt="QRIS Pembayaran Resmi"
                referrerPolicy="no-referrer"
                onError={() => {
                  const fb = getDriveThumbnailFallback(config.qrisUrl);
                  if (fb && qrisImgSrc !== fb) setQrisImgSrc(fb);
                }}
                className="max-h-56 w-auto rounded-xl object-contain"
              />
            </button>
          </div>
        )}
      </aside>

      {showQrisZoom && config.qrisUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowQrisZoom(false)}
        >
          <div
            className="glass-surface w-full max-w-md rounded-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/70 dark:border-slate-700/70">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  QRIS {config.qrisMerchantName || config.namaLembaga}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pindai melalui aplikasi perbankan atau dompet digital Anda
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQrisZoom(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Tutup QRIS"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 bg-white flex items-center justify-center">
              <img
                src={qrisImgSrc}
                alt="QRIS Pembayaran"
                referrerPolicy="no-referrer"
                className="max-h-[65vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
