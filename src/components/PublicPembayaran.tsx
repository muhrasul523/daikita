import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  History,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { PROGRAM_START_YM, TRANSFER_MIN_DATE } from '../config';
import {
  Donatur,
  DonorLookupResult,
  LembagaConfig,
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
  parseRupiahInput,
  previewAutoRenameFile,
  sanitizeExternalUrl,
  validateAndNormalizeWA,
} from '../utils/formatters';
import {
  compressTransferProof,
  formatFileSize,
  ProcessedUploadFile,
} from '../utils/imageCompressor';

interface PublicPembayaranProps {
  config: LembagaConfig;
  initialPrefill?: {
    donatur?: Donatur;
    transaksi?: TransaksiDonasi[];
    wa?: string;
  } | null;
  onClearPrefill?: () => void;
  onLookupWa: (noWa: string) => Promise<{
    ok: boolean;
    message: string;
    result?: DonorLookupResult;
  }>;
  onSubmitPembayaran: (
    payload: SubmitPembayaranPayload
  ) => Promise<{
    ok: boolean;
    message: string;
    transaksi?: TransaksiDonasi;
    transaksiList?: TransaksiDonasi[];
    savedFileName?: string;
  }>;
  onSwitchToDaftar: (prefillWa?: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

const MONTHS_12 = [
  { num: '01', label: 'Januari', short: 'Jan' },
  { num: '02', label: 'Februari', short: 'Feb' },
  { num: '03', label: 'Maret', short: 'Mar' },
  { num: '04', label: 'April', short: 'Apr' },
  { num: '05', label: 'Mei', short: 'Mei' },
  { num: '06', label: 'Juni', short: 'Jun' },
  { num: '07', label: 'Juli', short: 'Jul' },
  { num: '08', label: 'Agustus', short: 'Agu' },
  { num: '09', label: 'September', short: 'Sep' },
  { num: '10', label: 'Oktober', short: 'Okt' },
  { num: '11', label: 'November', short: 'Nov' },
  { num: '12', label: 'Desember', short: 'Des' },
];

export const PublicPembayaran: React.FC<PublicPembayaranProps> = ({
  config,
  initialPrefill,
  onClearPrefill,
  onLookupWa,
  onSubmitPembayaran,
  onSwitchToDaftar,
  onNotify,
}) => {
  const todayIso = getTodayIsoDate();
  const safeGroupLink = useMemo(() => sanitizeExternalUrl(config.waGroupLink), [config.waGroupLink]);

  // Lookup state
  const [waInput, setWaInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [notFoundInfo, setNotFoundInfo] = useState<{
    rawInput: string;
    normalizedWa: string;
  } | null>(null);

  // Active donor state
  const [activeDonatur, setActiveDonatur] = useState<Donatur | null>(null);
  const [donorTransaksi, setDonorTransaksi] = useState<TransaksiDonasi[]>([]);
  const [portalTab, setPortalTab] = useState<'bayar' | 'riwayat'>('bayar');

  // Form Konfirmasi state
  const rawCurYm = getCurrentYearMonth();
  const safeCurYm = rawCurYm < PROGRAM_START_YM ? PROGRAM_START_YM : rawCurYm;
  const [tanggalTransfer, setTanggalTransfer] = useState<string>(() => getTodayIsoDate());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([safeCurYm]);
  const [windowStartYm, setWindowStartYm] = useState<string>(PROGRAM_START_YM);
  const [nominalInput, setNominalInput] = useState('');
  const [isNominalCustom, setIsNominalCustom] = useState(false);
  const [keterangan, setKeterangan] = useState('');
  const [uploadFile, setUploadFile] = useState<ProcessedUploadFile | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{
    transaksiList: TransaksiDonasi[];
    totalNominal: number;
    totalKomitmen: number;
    totalLainnya: number;
    tanggalTransfer: string;
    savedFileName?: string;
  } | null>(null);

  // Riwayat & Rekap state
  const [selectedYear, setSelectedYear] = useState<number>(() => Number(safeCurYm.slice(0, 4)));
  const [previewTrx, setPreviewTrx] = useState<TransaksiDonasi | null>(null);

  // Rekening / QRIS state
  const [copiedRek, setCopiedRek] = useState<string | null>(null);
  const [showQrisZoom, setShowQrisZoom] = useState(false);
  const [qrisImgSrc, setQrisImgSrc] = useState(() => normalizeDriveImageUrl(config.qrisUrl));

  const waInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQrisImgSrc(normalizeDriveImageUrl(config.qrisUrl));
  }, [config.qrisUrl]);

  // Apply prefill if routed from Pendaftaran
  useEffect(() => {
    if (!initialPrefill) return;
    if (initialPrefill.donatur) {
      setActiveDonatur(initialPrefill.donatur);
      setDonorTransaksi(initialPrefill.transaksi || []);
      setWaInput(initialPrefill.donatur.noWa);
      setNotFoundInfo(null);
      setLookupError(null);
      setPortalTab('bayar');
      setSubmitSuccess(null);
    } else if (initialPrefill.wa) {
      setWaInput(initialPrefill.wa);
    }
    onClearPrefill?.();
  }, [initialPrefill, onClearPrefill]);

  const waValidation = useMemo(() => validateAndNormalizeWA(waInput), [waInput]);

  // Bulan minimum untuk donatur aktif
  const minSelectableYm = useMemo(() => {
    if (!activeDonatur) return PROGRAM_START_YM;
    const regYm = extractYearMonthFromDateStr(activeDonatur.tanggalDaftar);
    if (regYm && regYm > PROGRAM_START_YM) return regYm;
    return PROGRAM_START_YM;
  }, [activeDonatur]);

  const visibleMonths = useMemo(
    () => buildMonthSequence(windowStartYm < minSelectableYm ? minSelectableYm : windowStartYm, 12),
    [windowStartYm, minSelectableYm]
  );

  const donorMonthStatusMap = useMemo(() => {
    const map = new Map<string, 'Valid' | 'Pending'>();
    donorTransaksi.forEach((t) => {
      if (!/^\d{4}-\d{2}$/.test(t.bulanTagihan)) return;
      const prev = map.get(t.bulanTagihan);
      if (t.statusVerifikasi === 'Valid') {
        map.set(t.bulanTagihan, 'Valid');
      } else if (t.statusVerifikasi === 'Pending' && prev !== 'Valid') {
        map.set(t.bulanTagihan, 'Pending');
      }
    });
    return map;
  }, [donorTransaksi]);

  const sortedSelectedMonths = useMemo(
    () => [...selectedMonths].sort((a, b) => a.localeCompare(b)),
    [selectedMonths]
  );

  useEffect(() => {
    if (!activeDonatur) return;
    setWindowStartYm((prev) => (prev < minSelectableYm ? minSelectableYm : prev));
    setSelectedMonths((prev) => {
      const valid = prev.filter((m) => m >= minSelectableYm);
      if (valid.length > 0) return valid;
      const cur = getCurrentYearMonth();
      return [cur >= minSelectableYm ? cur : minSelectableYm];
    });
  }, [activeDonatur, minSelectableYm]);

  useEffect(() => {
    if (!activeDonatur) return;
    if (!isNominalCustom) {
      const total = Math.max(1, sortedSelectedMonths.length) * activeDonatur.nominalKomitmen;
      setNominalInput(total > 0 ? total.toLocaleString('id-ID') : '');
    }
  }, [activeDonatur, sortedSelectedMonths, isNominalCustom]);

  const parsedNominal = useMemo(() => parseRupiahInput(nominalInput), [nominalInput]);
  const expectedKomitmenTotal = activeDonatur
    ? activeDonatur.nominalKomitmen * Math.max(1, sortedSelectedMonths.length)
    : 0;
  const excessDonasiLainnya =
    activeDonatur && parsedNominal > expectedKomitmenTotal
      ? parsedNominal - expectedKomitmenTotal
      : 0;

  const autoRenamePreview = useMemo(() => {
    if (!uploadFile || !activeDonatur) return '';
    const ext = uploadFile.mimeType.includes('pdf') ? 'pdf' : 'jpg';
    return previewAutoRenameFile({
      tanggalTransfer,
      bulanTagihan: sortedSelectedMonths[0] || safeCurYm,
      bulanList: sortedSelectedMonths,
      namaDonatur: activeDonatur.namaLengkap,
      nominalTransfer: parsedNominal,
      extension: ext,
    });
  }, [uploadFile, activeDonatur, tanggalTransfer, sortedSelectedMonths, parsedNominal, safeCurYm]);

  // Available years for monthly recap
  const availableYears = useMemo(() => {
    const set = new Set<number>([Number(safeCurYm.slice(0, 4))]);
    if (activeDonatur?.tanggalDaftar) {
      const regYm = extractYearMonthFromDateStr(activeDonatur.tanggalDaftar);
      if (regYm) set.add(Number(regYm.slice(0, 4)));
    }
    donorTransaksi.forEach((t) => {
      if (/^\d{4}-\d{2}$/.test(t.bulanTagihan)) {
        set.add(Number(t.bulanTagihan.slice(0, 4)));
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [activeDonatur, donorTransaksi, safeCurYm]);

  // Monthly recap breakdown for selectedYear
  const monthlyRecap = useMemo(() => {
    return MONTHS_12.map((m) => {
      const ym = `${selectedYear}-${m.num}`;
      const list = donorTransaksi.filter((t) => t.bulanTagihan === ym);
      const validList = list.filter((t) => t.statusVerifikasi === 'Valid');
      const pendingList = list.filter((t) => t.statusVerifikasi === 'Pending');
      const ditolakList = list.filter((t) => t.statusVerifikasi === 'Ditolak');

      let status: 'Valid' | 'Pending' | 'Ditolak' | 'Belum' = 'Belum';
      if (validList.length > 0) status = 'Valid';
      else if (pendingList.length > 0) status = 'Pending';
      else if (ditolakList.length > 0) status = 'Ditolak';

      const activeList =
        status === 'Valid'
          ? validList
          : status === 'Pending'
          ? pendingList
          : status === 'Ditolak'
          ? ditolakList
          : [];
      const totalNominal = activeList.reduce((sum, t) => sum + t.nominalTransfer, 0);
      const totalLainnya = activeList.reduce((sum, t) => sum + Math.max(0, t.donasiLainnya || 0), 0);
      const dates = Array.from(
        new Set(activeList.map((t) => t.tanggalTransfer).filter(Boolean))
      );
      const latestProof = activeList.find((t) => Boolean(t.linkBuktiDrive)) || null;

      return {
        ym,
        label: m.label,
        short: m.short,
        status,
        totalNominal,
        totalLainnya,
        dates,
        latestProof,
        count: activeList.length,
      };
    });
  }, [donorTransaksi, selectedYear]);

  const yearSummary = useMemo(() => {
    let validRp = 0;
    let lunasMonths = 0;
    let pendingMonths = 0;
    monthlyRecap.forEach((m) => {
      if (m.status === 'Valid') {
        lunasMonths += 1;
        validRp += m.totalNominal;
      } else if (m.status === 'Pending') {
        pendingMonths += 1;
      }
    });
    return { validRp, lunasMonths, pendingMonths };
  }, [monthlyRecap]);

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setNotFoundInfo(null);

    if (!waValidation.valid) {
      setLookupError(waValidation.error);
      return;
    }

    setIsLookingUp(true);
    const res = await onLookupWa(waValidation.normalized);
    setIsLookingUp(false);

    if (!res.ok || !res.result) {
      setLookupError(res.message || 'Gagal memeriksa nomor WhatsApp.');
      return;
    }

    if (!res.result.found || !res.result.donatur) {
      setNotFoundInfo({
        rawInput: waInput.trim(),
        normalizedWa: res.result.normalizedWa || waValidation.normalized,
      });
      return;
    }

    setActiveDonatur(res.result.donatur);
    setDonorTransaksi(res.result.transaksi || []);
    setIsNominalCustom(false);
    setSubmitSuccess(null);
    setPortalTab('bayar');
  };

  const handleRefreshDonor = async () => {
    if (!activeDonatur) return;
    setIsLookingUp(true);
    const res = await onLookupWa(activeDonatur.noWa);
    setIsLookingUp(false);
    if (res.ok && res.result?.found && res.result.donatur) {
      setActiveDonatur(res.result.donatur);
      setDonorTransaksi(res.result.transaksi || []);
      onNotify('success', 'Data diperbarui', 'Riwayat dan status verifikasi terbaru dimuat.');
    }
  };

  const toggleMonth = (ym: string) => {
    if (ym < minSelectableYm) return;
    setSelectedMonths((prev) => {
      if (prev.includes(ym)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== ym);
      }
      return [...prev, ym].sort((a, b) => a.localeCompare(b));
    });
    setIsNominalCustom(false);
  };

  const handleProcessFile = async (file: File) => {
    setFormError(null);
    setIsCompressing(true);
    try {
      const processed = await compressTransferProof(file);
      setUploadFile(processed);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal memproses file bukti transfer.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleProcessFile(file);
  };

  const handleDropFile = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await handleProcessFile(file);
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

  const handleSubmitConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDonatur) return;
    setFormError(null);

    if (!tanggalTransfer || tanggalTransfer < TRANSFER_MIN_DATE) {
      setFormError(`Tanggal transfer minimal ${TRANSFER_MIN_DATE}.`);
      return;
    }
    if (tanggalTransfer > todayIso) {
      setFormError('Tanggal transfer tidak boleh melebihi tanggal hari ini.');
      return;
    }
    if (sortedSelectedMonths.length === 0) {
      setFormError('Pilih minimal 1 bulan periode pembayaran.');
      return;
    }
    if (parsedNominal < 1000) {
      setFormError('Nominal transfer minimal Rp 1.000.');
      return;
    }

    setIsSubmitting(true);
    const res = await onSubmitPembayaran({
      jenisDonatur: 'Rutin',
      idDonatur: activeDonatur.idDonatur,
      namaDonatur: activeDonatur.namaLengkap,
      noWa: activeDonatur.noWa,
      tanggalTransfer,
      bulanTagihan: sortedSelectedMonths[0],
      bulanTagihanList: sortedSelectedMonths,
      nominalTransfer: parsedNominal,
      nominalKomitmenPerBulan: activeDonatur.nominalKomitmen,
      bankTujuan: config.infoRekening[0]?.bank || 'BSI',
      diinputOleh: 'Donatur (Mandiri)',
      keterangan: keterangan.trim(),
      fileBase64: uploadFile?.base64,
      fileMimeType: uploadFile?.mimeType,
      fileName: uploadFile?.originalName,
    });
    setIsSubmitting(false);

    if (res.ok) {
      const created =
        res.transaksiList && res.transaksiList.length > 0
          ? res.transaksiList
          : res.transaksi
          ? [res.transaksi]
          : [];
      if (created.length > 0) {
        setDonorTransaksi((prev) => [...created, ...prev]);
      }
      setSubmitSuccess({
        transaksiList: created,
        totalNominal: parsedNominal,
        totalKomitmen: Math.min(parsedNominal, expectedKomitmenTotal),
        totalLainnya: excessDonasiLainnya,
        tanggalTransfer,
        savedFileName: res.savedFileName,
      });
      setUploadFile(null);
      setKeterangan('');
      setIsNominalCustom(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      setFormError(res.message || 'Gagal mengirim konfirmasi pembayaran.');
    }
  };

  const handlePayMonthShortcut = (ym: string) => {
    if (ym < minSelectableYm) return;
    setSelectedMonths([ym]);
    const endOfWindow = getAdjacentYearMonth(minSelectableYm, 11);
    setWindowStartYm(ym <= endOfWindow ? minSelectableYm : ym);
    setIsNominalCustom(false);
    setSubmitSuccess(null);
    setPortalTab('bayar');
  };

  const renderRekeningCard = () => (
    <aside className="lg:col-span-4 glass-surface rounded-3xl p-5 sm:p-6 space-y-5 min-w-0">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Rekening Penyaluran
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed safe-wrap">
          {config.catatanPembayaran ||
            `Salurkan donasi Kafalah Dai melalui rekening resmi ${config.namaLembaga}.`}
        </p>
        <div className="mt-4 divide-y divide-slate-200/70 dark:divide-slate-700/70">
          {config.infoRekening.map((rek) => {
            const isCopied = copiedRek === rek.nomor;
            return (
              <div
                key={`${rek.bank}-${rek.nomor}`}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 safe-wrap">
                    {rek.bank}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums safe-wrap">
                    {rek.nomor}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 safe-wrap">
                    a.n. {rek.atasNama}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyRekening(rek.nomor, rek.bank)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span>Unduh</span>
            </a>
          </div>
          <button
            type="button"
            onClick={() => setShowQrisZoom(true)}
            className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white p-3 flex items-center justify-center hover:border-emerald-400 transition-colors cursor-pointer"
          >
            <img
              src={qrisImgSrc}
              alt="QRIS Pembayaran Resmi"
              referrerPolicy="no-referrer"
              onError={() => {
                const fb = getDriveThumbnailFallback(config.qrisUrl);
                if (fb && qrisImgSrc !== fb) setQrisImgSrc(fb);
              }}
              className="max-h-52 w-auto rounded-xl object-contain"
            />
          </button>
        </div>
      )}
    </aside>
  );

  // ==================== STEP 1: CEK NOMOR WA DONATUR ====================
  if (!activeDonatur) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-8 glass-surface rounded-3xl p-5 sm:p-8 min-w-0">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Portal Pembayaran Donatur · {config.namaLembaga}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 safe-wrap">
              Konfirmasi Penyaluran Kafalah
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
              Masukkan nomor WhatsApp yang terdaftar untuk mengunggah bukti transfer, melihat status
              verifikasi, rekap pembayaran per bulan, serta bergabung ke grup WhatsApp donatur.
            </p>
          </div>

          <form onSubmit={handleLookupSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="pub-bayar-wa"
                className="block text-sm font-bold text-slate-800 dark:text-slate-100 mb-2"
              >
                Nomor WhatsApp Terdaftar{' '}
                <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <input
                  ref={waInputRef}
                  id="pub-bayar-wa"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={waInput}
                  onChange={(e) => {
                    setWaInput(e.target.value);
                    setLookupError(null);
                    setNotFoundInfo(null);
                  }}
                  placeholder="Contoh: 081234567890"
                  className="w-full min-h-[52px] rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 pl-12 pr-4 py-3.5 text-base font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                />
              </div>
              {waInput.trim() !== '' && (
                <p
                  className={`mt-2 text-xs font-medium safe-wrap ${
                    waValidation.valid
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {waValidation.valid
                    ? `Format pencarian: ${formatWADisplay(waValidation.normalized)}`
                    : waValidation.error}
                </p>
              )}
            </div>

            {lookupError && (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/50 p-3.5 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span className="safe-wrap">{lookupError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLookingUp}
              className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-[0_10px_24px_-8px_rgba(5,150,105,0.5)] hover:opacity-95 active:scale-[0.99] disabled:opacity-55 transition-all cursor-pointer"
            >
              {isLookingUp ? (
                <>
                  <Search className="h-4 w-4 animate-pulse shrink-0" />
                  <span>Mencari Data Donatur...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 shrink-0" />
                  <span>Cek Data &amp; Lanjut Pembayaran</span>
                </>
              )}
            </button>
          </form>

          {/* NOMOR TIDAK TERDAFTAR: TAMPILKAN NOMOR HP & ARAHKAN CEK / DAFTAR */}
          {notFoundInfo && (
            <div className="mt-6 rounded-2xl border border-amber-300/90 dark:border-amber-700/80 bg-amber-50/85 dark:bg-amber-950/45 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-1.5">
                  <p className="text-sm font-bold text-amber-950 dark:text-amber-100">
                    Nomor HP Belum Terdaftar sebagai Donatur
                  </p>
                  <div className="rounded-xl bg-white/85 dark:bg-slate-900/75 border border-amber-200/80 dark:border-amber-800/70 px-3.5 py-2.5">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Nomor HP yang Anda masukkan:
                    </p>
                    <p className="mt-0.5 text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums safe-wrap">
                      {notFoundInfo.rawInput}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Format standar: {formatWADisplay(notFoundInfo.normalizedWa)}
                    </p>
                  </div>
                  <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed safe-wrap">
                    Mohon periksa kembali apakah nomor HP di atas sudah benar dan tidak ada angka
                    yang keliru. Jika memang belum pernah mendaftar, silakan daftar menjadi donatur
                    terlebih dahulu.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => onSwitchToDaftar(notFoundInfo.rawInput)}
                  className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  <UserPlus className="h-4 w-4 shrink-0" />
                  <span>Daftar Jadi Donatur Terlebih Dahulu</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNotFoundInfo(null);
                    waInputRef.current?.focus();
                    waInputRef.current?.select();
                  }}
                  className="min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-2xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-4 py-3 text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <span>Periksa Nomor Lagi</span>
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-600 dark:text-slate-300 safe-wrap">
              Belum pernah mendaftar sebagai donatur rutin Kafalah Dai?
            </p>
            <button
              type="button"
              onClick={() => onSwitchToDaftar(waInput.trim() || undefined)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:border-emerald-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5 shrink-0" />
              <span>Daftar Donatur Baru</span>
            </button>
          </div>
        </section>

        {renderRekeningCard()}
      </div>
    );
  }

  // ==================== STEP 2: PORTAL DONATUR TERDAFTAR ====================
  return (
    <div className="space-y-5">
      {/* KARTU PROFIL DONATUR + TOMBOL GRUP WA */}
      <section className="glass-surface rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 safe-wrap">
                {activeDonatur.namaLengkap}
              </h1>
              <span className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {activeDonatur.idDonatur}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 safe-wrap">
              <span className="tabular-nums font-medium">{formatWADisplay(activeDonatur.noWa)}</span>
              {activeDonatur.domisili ? ` · ${activeDonatur.domisili}` : ''}
              {activeDonatur.provinsi ? `, ${activeDonatur.provinsi}` : ''} · Komitmen{' '}
              <strong className="tabular-nums text-emerald-800 dark:text-emerald-300">
                {formatRupiah(activeDonatur.nominalKomitmen)}/bln
              </strong>{' '}
              · Pengingat tgl {activeDonatur.tglJatuhTempo}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {safeGroupLink && (
              <a
                href={safeGroupLink}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:opacity-95 transition-opacity whitespace-nowrap"
              >
                <Users className="h-4 w-4 shrink-0" />
                <span>Gabung Grup WA</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            )}
            <button
              type="button"
              onClick={() => void handleRefreshDonor()}
              disabled={isLookingUp}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isLookingUp ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveDonatur(null);
                setDonorTransaksi([]);
                setSubmitSuccess(null);
              }}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              <span>Ganti Nomor</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigasi Portal Donatur */}
        <div
          className="mt-5 grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 p-1.5"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={portalTab === 'bayar'}
            onClick={() => setPortalTab('bayar')}
            className={`min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              portalTab === 'bayar'
                ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span>Konfirmasi &amp; Bukti</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={portalTab === 'riwayat'}
            onClick={() => setPortalTab('riwayat')}
            className={`min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              portalTab === 'riwayat'
                ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="h-4 w-4 shrink-0" />
            <span>Riwayat &amp; Rekap ({donorTransaksi.length})</span>
          </button>
        </div>
      </section>

      {/* TAB 1: FORM KONFIRMASI & UPLOAD BUKTI TRANSFER */}
      {portalTab === 'bayar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-8 glass-surface rounded-3xl p-5 sm:p-8 min-w-0 space-y-5">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Form Konfirmasi Transfer Kafalah
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 safe-wrap">
                Pilih periode bulan yang dibayarkan (bisa sekaligus beberapa bulan), lalu unggah
                bukti transfer jika tersedia.
              </p>
            </div>

            {submitSuccess && (
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/85 dark:bg-emerald-950/55 p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                      Konfirmasi Pembayaran Berhasil Dikirim!
                    </p>
                    <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90 leading-relaxed safe-wrap">
                      Total{' '}
                      <strong className="tabular-nums">
                        {formatRupiah(submitSuccess.totalNominal)}
                      </strong>{' '}
                      (Tgl Transfer: {formatTanggalIndo(submitSuccess.tanggalTransfer)}) telah
                      tercatat dengan status <strong>Menunggu Verifikasi</strong> oleh admin.
                    </p>
                    {submitSuccess.totalLainnya > 0 && (
                      <p className="text-xs font-semibold text-sky-800 dark:text-sky-300 tabular-nums">
                        Termasuk Donasi Lainnya (kelebihan komitmen): +
                        {formatRupiah(submitSuccess.totalLainnya)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPortalTab('riwayat')}
                    className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    <History className="h-3.5 w-3.5 shrink-0" />
                    <span>Lihat Riwayat &amp; Status Verifikasi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmitSuccess(null)}
                    className="min-h-[42px] inline-flex items-center rounded-xl border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}

            {formError && (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/50 p-3.5 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span className="safe-wrap">{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitConfirm} className="space-y-5">
              {/* Pilihan Bulan (Multi-Month 12 Bulan) */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Pilih Bulan Pembayaran ({sortedSelectedMonths.length} bulan dipilih){' '}
                    <span className="text-rose-600 dark:text-rose-400">*</span>
                  </label>
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={windowStartYm <= minSelectableYm}
                      onClick={() => {
                        const prev = getAdjacentYearMonth(windowStartYm, -12);
                        setWindowStartYm(prev < minSelectableYm ? minSelectableYm : prev);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                      aria-label="12 bulan sebelumnya"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {formatBulanShortLabel(visibleMonths[0])} –{' '}
                      {formatBulanShortLabel(visibleMonths[visibleMonths.length - 1])}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWindowStartYm(getAdjacentYearMonth(windowStartYm, 12))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                      aria-label="12 bulan berikutnya"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {visibleMonths.map((ym) => {
                    const isSelected = sortedSelectedMonths.includes(ym);
                    const st = donorMonthStatusMap.get(ym);
                    return (
                      <button
                        key={ym}
                        type="button"
                        onClick={() => toggleMonth(ym)}
                        className={`min-h-[52px] rounded-2xl border px-2.5 py-2 text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm'
                            : st === 'Valid'
                            ? 'border-emerald-200/80 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/35 text-emerald-900 dark:text-emerald-200'
                            : st === 'Pending'
                            ? 'border-amber-200/80 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/35 text-amber-900 dark:text-amber-200'
                            : 'border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <p className="text-xs font-bold tabular-nums leading-tight">
                          {formatBulanShortLabel(ym)}
                        </p>
                        <p
                          className={`mt-0.5 text-[10px] font-semibold ${
                            isSelected
                              ? 'text-emerald-100'
                              : st === 'Valid'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : st === 'Pending'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {isSelected
                            ? 'Dipilih'
                            : st === 'Valid'
                            ? 'Lunas'
                            : st === 'Pending'
                            ? 'Menunggu'
                            : 'Belum'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tanggal Transfer & Nominal Transfer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label
                    htmlFor="pub-tgl-tf"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    Tanggal Transfer <span className="text-rose-600 dark:text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <input
                      id="pub-tgl-tf"
                      type="date"
                      min={TRANSFER_MIN_DATE}
                      max={todayIso}
                      required
                      value={tanggalTransfer}
                      onChange={(e) => setTanggalTransfer(e.target.value)}
                      className="w-full min-h-[48px] rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 pl-10 pr-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="pub-nominal-tf"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    Nominal Transfer <span className="text-rose-600 dark:text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 dark:text-slate-400">
                      Rp
                    </span>
                    <input
                      id="pub-nominal-tf"
                      type="text"
                      inputMode="numeric"
                      required
                      value={nominalInput}
                      onChange={(e) => {
                        setIsNominalCustom(true);
                        setNominalInput(formatRupiahInput(e.target.value));
                      }}
                      placeholder="50.000"
                      className="w-full min-h-[48px] rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 pl-11 pr-4 py-3 text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums safe-wrap">
                    Komitmen {sortedSelectedMonths.length} bln:{' '}
                    <strong>{formatRupiah(expectedKomitmenTotal)}</strong>
                    {isNominalCustom && (
                      <button
                        type="button"
                        onClick={() => setIsNominalCustom(false)}
                        className="ml-2 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Reset sesuai komitmen
                      </button>
                    )}
                  </p>
                </div>
              </div>

              {excessDonasiLainnya > 0 && (
                <div className="rounded-2xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/80 dark:bg-sky-950/40 p-3.5 flex items-start gap-2.5 text-xs text-sky-900 dark:text-sky-200">
                  <Sparkles className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed safe-wrap">
                    Nominal melebihi komitmen bulanan. Porsi komitmen{' '}
                    <strong className="tabular-nums">{formatRupiah(expectedKomitmenTotal)}</strong>{' '}
                    dan kelebihan{' '}
                    <strong className="tabular-nums">+{formatRupiah(excessDonasiLainnya)}</strong>{' '}
                    otomatis tercatat sebagai <strong>Donasi Lainnya</strong>.
                  </p>
                </div>
              )}

              {/* Keterangan Opsional */}
              <div className="min-w-0">
                <label
                  htmlFor="pub-ket"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Keterangan / Catatan{' '}
                  <span className="font-normal text-slate-400">(Opsional)</span>
                </label>
                <input
                  id="pub-ket"
                  type="text"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Contoh: Transfer via BSI Mobile / QRIS"
                  className="w-full min-h-[48px] rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Upload Bukti Transfer (Drag & Drop + Tap Mobile) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  Unggah Bukti Transfer{' '}
                  <span className="font-normal text-slate-400">(Opsional · Foto / PDF)</span>
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(false);
                  }}
                  onDrop={(e) => void handleDropFile(e)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-2xl border-2 border-dashed p-5 text-center transition-all cursor-pointer ${
                    isDraggingFile
                      ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/50'
                      : 'border-slate-300/90 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 hover:border-emerald-400'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => void handleFileChange(e)}
                    className="hidden"
                  />
                  {isCompressing ? (
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Memproses dan mengompres gambar bukti transfer...
                    </p>
                  ) : uploadFile ? (
                    <div
                      className="flex flex-col sm:flex-row items-center gap-3 text-left"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {uploadFile.isPdf ? (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600">
                          <FileText className="h-7 w-7" />
                        </div>
                      ) : (
                        <img
                          src={uploadFile.previewUrl || uploadFile.base64}
                          alt="Pratinjau bukti transfer"
                          className="h-16 w-16 shrink-0 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {uploadFile.originalName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {formatFileSize(uploadFile.compressedSizeBytes)}
                        </p>
                        {autoRenamePreview && (
                          <p className="mt-0.5 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 truncate">
                            Nama file: {autoRenamePreview}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5 shrink-0" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Upload className="mx-auto h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                        Ketuk untuk pilih foto / tarik file bukti transfer ke sini
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Format JPG, PNG, atau PDF · Dikompres otomatis agar cepat diunggah.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isCompressing}
                className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-[0_10px_24px_-8px_rgba(5,150,105,0.5)] hover:opacity-95 active:scale-[0.99] disabled:opacity-55 transition-all cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  {isSubmitting ? 'Mengirim Konfirmasi...' : 'Kirim Konfirmasi Pembayaran'}
                </span>
              </button>
            </form>
          </section>

          {renderRekeningCard()}
        </div>
      )}

      {/* TAB 2: RIWAYAT TRANSFER & REKAP PER BULAN */}
      {portalTab === 'riwayat' && (
        <div className="space-y-6">
          {/* REKAP PER BULAN */}
          <section className="glass-surface rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Rekap Pembayaran Tahun {selectedYear}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 safe-wrap">
                  Pantau status tiap bulan beserta tanggal transfer dan nominal yang tercatat.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 p-1 w-fit shrink-0">
                {availableYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedYear(yr)}
                    className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold tabular-nums transition-all cursor-pointer ${
                      selectedYear === yr
                        ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            {/* 3 Ringkasan Tahun */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-emerald-50/75 dark:bg-emerald-950/35 border border-emerald-200/70 dark:border-emerald-800/60 p-4">
                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  Terverifikasi ({selectedYear})
                </p>
                <p className="mt-1 text-xl font-bold text-emerald-950 dark:text-emerald-100 tabular-nums">
                  {formatRupiah(yearSummary.validRp)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/70 p-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Bulan Sudah Diverifikasi
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {yearSummary.lunasMonths} / 12 Bulan
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50/75 dark:bg-amber-950/35 border border-amber-200/70 dark:border-amber-800/60 p-4">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  Menunggu Verifikasi
                </p>
                <p className="mt-1 text-xl font-bold text-amber-950 dark:text-amber-100 tabular-nums">
                  {yearSummary.pendingMonths} Bulan
                </p>
              </div>
            </div>

            {/* Grid 12 Bulan Lengkap Tanggal Transfer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {monthlyRecap.map((m) => {
                const isBeforeStart = m.ym < minSelectableYm;
                const proofUrl = m.latestProof
                  ? sanitizeExternalUrl(m.latestProof.linkBuktiDrive)
                  : '';
                const hasLocalData = Boolean(
                  m.latestProof?.linkBuktiDrive.startsWith('data:')
                );

                return (
                  <div
                    key={m.ym}
                    className={`rounded-2xl border p-4 flex flex-col justify-between gap-2.5 ${
                      m.status === 'Valid'
                        ? 'border-emerald-200/90 dark:border-emerald-800/80 bg-emerald-50/55 dark:bg-emerald-950/30'
                        : m.status === 'Pending'
                        ? 'border-amber-200/90 dark:border-amber-800/80 bg-amber-50/55 dark:bg-amber-950/30'
                        : m.status === 'Ditolak'
                        ? 'border-rose-200/90 dark:border-rose-800/80 bg-rose-50/55 dark:bg-rose-950/30'
                        : 'border-slate-200/80 dark:border-slate-700/70 bg-white/75 dark:bg-slate-900/55'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {m.label} {selectedYear}
                        </p>
                        {m.status === 'Valid' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>Diverifikasi</span>
                          </span>
                        )}
                        {m.status === 'Pending' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>Menunggu</span>
                          </span>
                        )}
                        {m.status === 'Ditolak' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Ditolak</span>
                          </span>
                        )}
                        {m.status === 'Belum' && (
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                            {isBeforeStart ? '—' : 'Belum Bayar'}
                          </span>
                        )}
                      </div>

                      {m.totalNominal > 0 && (
                        <div className="mt-2 space-y-0.5">
                          <p className="text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatRupiah(m.totalNominal)}
                          </p>
                          {m.totalLainnya > 0 && (
                            <p className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 tabular-nums">
                              Termasuk +{formatRupiah(m.totalLainnya)} Donasi Lainnya
                            </p>
                          )}
                          {m.dates.length > 0 && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                              Tgl Transfer: {m.dates.map((d) => formatTanggalIndo(d)).join(', ')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-1">
                      {proofUrl ? (
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 dark:text-sky-400 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          <span>Lihat Bukti Transfer</span>
                        </a>
                      ) : hasLocalData && m.latestProof ? (
                        <button
                          type="button"
                          onClick={() => setPreviewTrx(m.latestProof)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 shrink-0" />
                          <span>Lihat Pratinjau Bukti</span>
                        </button>
                      ) : !isBeforeStart && (m.status === 'Belum' || m.status === 'Ditolak') ? (
                        <button
                          type="button"
                          onClick={() => handlePayMonthShortcut(m.ym)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          <span>Konfirmasi Bulan Ini</span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* RIWAYAT TRANSFER / MUTASI DONATUR */}
          <section className="glass-surface rounded-3xl overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Riwayat Transfer Anda ({donorTransaksi.length})
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 safe-wrap">
                Daftar seluruh konfirmasi pembayaran yang pernah dikirim beserta status
                verifikasinya.
              </p>
            </div>

            {donorTransaksi.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Belum Ada Riwayat Transfer
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Jika Anda sudah mentransfer donasi kafalah, silakan kirim konfirmasi dan bukti
                  transfer melalui tab Konfirmasi &amp; Bukti.
                </p>
                <button
                  type="button"
                  onClick={() => setPortalTab('bayar')}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 shrink-0" />
                  <span>Konfirmasi Pembayaran Sekarang</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
                {donorTransaksi.map((trx) => {
                  const proofUrl = sanitizeExternalUrl(trx.linkBuktiDrive);
                  const hasLocal = trx.linkBuktiDrive.startsWith('data:');
                  const extraRp = Math.max(0, trx.donasiLainnya || 0);

                  return (
                    <div
                      key={trx.idTransaksi}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-emerald-50/40 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {formatBulanLabel(trx.bulanTagihan)}
                          </span>
                          {trx.statusVerifikasi === 'Valid' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span>Sudah Diverifikasi</span>
                            </span>
                          )}
                          {trx.statusVerifikasi === 'Pending' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span>Menunggu Verifikasi</span>
                            </span>
                          )}
                          {trx.statusVerifikasi === 'Ditolak' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-400">
                              <XCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>Ditolak</span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 tabular-nums safe-wrap">
                          Tanggal Transfer:{' '}
                          <strong>
                            {trx.tanggalTransfer
                              ? formatTanggalIndo(trx.tanggalTransfer)
                              : trx.waktuInput.split(',')[0]}
                          </strong>{' '}
                          · ID <span className="font-mono">{trx.idTransaksi}</span>
                        </p>

                        {trx.keterangan && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 safe-wrap">
                            Catatan: {trx.keterangan}
                          </p>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0">
                        <div className="text-left sm:text-right">
                          <p className="text-base font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                            {formatRupiah(trx.nominalTransfer)}
                          </p>
                          {extraRp > 0 && (
                            <p className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 tabular-nums">
                              +{formatRupiah(extraRp)} Donasi Lainnya
                            </p>
                          )}
                        </div>
                        {proofUrl ? (
                          <a
                            href={proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[36px] items-center gap-1 text-xs font-bold text-sky-700 dark:text-sky-400 hover:underline whitespace-nowrap"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span>Lihat Bukti</span>
                          </a>
                        ) : hasLocal ? (
                          <button
                            type="button"
                            onClick={() => setPreviewTrx(trx)}
                            className="inline-flex min-h-[36px] items-center gap-1 text-xs font-bold text-sky-700 dark:text-sky-400 hover:underline whitespace-nowrap cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5 shrink-0" />
                            <span>Lihat Bukti</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Tanpa lampiran</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Modal Pratinjau Bukti Lokal */}
      {previewTrx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewTrx(null)}
        >
          <div
            className="glass-surface w-full max-w-lg rounded-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/70 dark:border-slate-700/70">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  Bukti Transfer — {formatBulanLabel(previewTrx.bulanTagihan)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {formatRupiah(previewTrx.nominalTransfer)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTrx(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Tutup pratinjau"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              {previewTrx.linkBuktiDrive.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewTrx.linkBuktiDrive}
                  title="Pratinjau PDF"
                  className="w-full h-[60vh] rounded-xl bg-white"
                />
              ) : (
                <img
                  src={previewTrx.linkBuktiDrive}
                  alt="Bukti transfer"
                  className="max-h-[60vh] w-auto rounded-xl object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Zoom QRIS */}
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
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
