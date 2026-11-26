import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Lock,
  Phone,
  QrCode,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { WILAYAH_KABUPATEN } from '../data/wilayah';
import {
  Donatur,
  DonorLookupResult,
  JenisKelamin,
  LembagaConfig,
  MinatGrupWa,
  NotifDeliveryResult,
  Panitia,
  RegisterDonaturPayload,
  TransaksiDonasi,
} from '../types';
import {
  formatRupiah,
  formatRupiahInput,
  formatWADisplay,
  getDriveThumbnailFallback,
  normalizeDriveImageUrl,
  normalizeRoleLabel,
  parseRupiahInput,
  sanitizeExternalUrl,
  validateAndNormalizeWA,
} from '../utils/formatters';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

interface PublicPendaftaranProps {
  config: LembagaConfig;
  panitia: Panitia[];
  referralCode: string | null;
  initialWa?: string;
  onClearInitialWa?: () => void;
  onLookupWa: (noWa: string) => Promise<{
    ok: boolean;
    message: string;
    result?: DonorLookupResult;
  }>;
  onSubmitDonatur: (
    payload: RegisterDonaturPayload
  ) => Promise<{
    ok: boolean;
    message: string;
    donatur?: Donatur;
    existingDonatur?: Partial<Donatur>;
    notifStatus?: NotifDeliveryResult;
  }>;
  onSwitchToBayar: (prefill?: { donatur?: Donatur; transaksi?: TransaksiDonasi[]; wa?: string }) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

const QUICK_NOMINALS = [
  { value: 10000, label: '10rb' },
  { value: 20000, label: '20rb' },
  { value: 25000, label: '25rb' },
  { value: 50000, label: '50rb' },
  { value: 100000, label: '100rb' },
  { value: 150000, label: '150rb' },
  { value: 200000, label: '200rb' },
  { value: 250000, label: '250rb' },
  { value: 500000, label: '500rb' },
  { value: 1000000, label: '1jt' },
];

const TANGGAL_OPTIONS: SearchableOption[] = Array.from({ length: 31 }, (_, i) => {
  const day = i + 1;
  return {
    value: String(day),
    label: `Setiap tanggal ${day}`,
    keywords: `${day} tgl ${day}`,
  };
});

export const PublicPendaftaran: React.FC<PublicPendaftaranProps> = ({
  config,
  panitia,
  referralCode,
  initialWa,
  onClearInitialWa,
  onLookupWa,
  onSubmitDonatur,
  onSwitchToBayar,
  onNotify,
}) => {
  const matchedRefPanitia = useMemo(() => {
    if (!referralCode) return null;
    const upper = referralCode.trim().toUpperCase();
    return (
      panitia.find((p) => p.kodePanitia.trim().toUpperCase() === upper) || {
        kodePanitia: upper,
        namaPanitia: `Pengurus (${upper})`,
        noWaPanitia: '',
        role: 'Admin',
      }
    );
  }, [referralCode, panitia]);

  const isReferralLocked = Boolean(referralCode && matchedRefPanitia);

  // Step 1: cek nomor WA -> Step 2: isi form -> Step 3: sukses
  const [step, setStep] = useState<'check_wa' | 'already_registered' | 'form' | 'success'>('check_wa');
  const [waInput, setWaInput] = useState(initialWa || '');
  const [verifiedWa, setVerifiedWa] = useState('');
  const [isCheckingWa, setIsCheckingWa] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [existingMatch, setExistingMatch] = useState<{
    donatur: Donatur;
    transaksi: TransaksiDonasi[];
  } | null>(null);

  // Form fields (Step 2)
  const [namaLengkap, setNamaLengkap] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState<JenisKelamin>('');
  const [emailInput, setEmailInput] = useState('');
  const [selectedKabId, setSelectedKabId] = useState('');
  const [nominalInput, setNominalInput] = useState(() =>
    (config.defaultNominal || 50000).toLocaleString('id-ID')
  );
  const [tglPengingat, setTglPengingat] = useState<number>(
    () => config.defaultTglPengingat || 5
  );
  const [selectedPanitiaKode, setSelectedPanitiaKode] = useState('');
  const [minatGrupWa, setMinatGrupWa] = useState<MinatGrupWa>('Ya');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [registeredDonatur, setRegisteredDonatur] = useState<Donatur | null>(null);
  const [registeredNotif, setRegisteredNotif] = useState<NotifDeliveryResult | null>(null);

  const [copiedRek, setCopiedRek] = useState<string | null>(null);
  const [showQrisZoom, setShowQrisZoom] = useState(false);
  const [qrisImgSrc, setQrisImgSrc] = useState(() => normalizeDriveImageUrl(config.qrisUrl));

  const manualOverridePosRef = useRef<number | null>(null);
  const namaInputRef = useRef<HTMLInputElement | null>(null);

  const safeGroupLink = useMemo(() => sanitizeExternalUrl(config.waGroupLink), [config.waGroupLink]);

  useEffect(() => {
    setQrisImgSrc(normalizeDriveImageUrl(config.qrisUrl));
  }, [config.qrisUrl]);

  useEffect(() => {
    if (initialWa && initialWa.trim()) {
      const check = validateAndNormalizeWA(initialWa);
      setWaInput(initialWa);
      if (check.valid) {
        setVerifiedWa(check.normalized);
        setStep('form');
        setCheckError(null);
      }
      onClearInitialWa?.();
    }
  }, [initialWa, onClearInitialWa]);

  const waValidation = useMemo(() => validateAndNormalizeWA(waInput), [waInput]);
  const parsedNominal = useMemo(() => parseRupiahInput(nominalInput), [nominalInput]);

  const wilayahOptions = useMemo<SearchableOption[]>(
    () =>
      WILAYAH_KABUPATEN.map((w) => ({
        value: w.kabId,
        label: w.kab,
        sublabel: `${w.prov} · ${w.pulau}`,
        metaRight: w.kabId,
        keywords: `${w.kab} ${w.prov} ${w.pulau} ${w.kabId} ${w.provId}`,
      })),
    []
  );

  const selectedWilayah = useMemo(
    () => WILAYAH_KABUPATEN.find((w) => w.kabId === selectedKabId) || null,
    [selectedKabId]
  );

  const panitiaOptions = useMemo<SearchableOption[]>(
    () => [
      {
        value: '',
        label: 'Daftar Mandiri (Langsung)',
        sublabel: 'Tanpa perantara pengurus',
        keywords: 'mandiri langsung sendiri tanpa perantara',
      },
      ...panitia.map((p) => ({
        value: p.kodePanitia,
        label: p.namaPanitia,
        sublabel: `Kode ${p.kodePanitia} · ${normalizeRoleLabel(p.role)}`,
        keywords: `${p.namaPanitia} ${p.kodePanitia} ${p.role}`,
      })),
    ],
    [panitia]
  );

  const selectedPanitiaObj = useMemo(
    () => panitia.find((p) => p.kodePanitia === selectedPanitiaKode) || null,
    [panitia, selectedPanitiaKode]
  );

  const handleCheckWa = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckError(null);

    if (!waValidation.valid) {
      setCheckError(waValidation.error);
      return;
    }

    setIsCheckingWa(true);
    const res = await onLookupWa(waValidation.normalized);
    setIsCheckingWa(false);

    if (!res.ok || !res.result) {
      setCheckError(res.message || 'Gagal memeriksa nomor WhatsApp. Silakan coba lagi.');
      return;
    }

    if (res.result.found && res.result.donatur) {
      setExistingMatch({
        donatur: res.result.donatur,
        transaksi: res.result.transaksi || [],
      });
      setStep('already_registered');
      return;
    }

    setVerifiedWa(res.result.normalizedWa || waValidation.normalized);
    setExistingMatch(null);
    setFormError(null);
    setStep('form');
  };

  const handleNamaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const prev = namaLengkap;
    let next = e.target.value;
    const cursor = e.target.selectionStart ?? next.length;

    if (next.length < prev.length) {
      manualOverridePosRef.current = cursor;
      setNamaLengkap(next);
      return;
    }

    if (next.length === prev.length + 1) {
      const insertedIdx = cursor - 1;
      const insertedChar = next.charAt(insertedIdx);
      const isWordStart = insertedIdx === 0 || /\s/.test(next.charAt(insertedIdx - 1));

      if (isWordStart && /[a-z]/.test(insertedChar)) {
        if (manualOverridePosRef.current === insertedIdx) {
          manualOverridePosRef.current = null;
        } else {
          next =
            next.slice(0, insertedIdx) +
            insertedChar.toUpperCase() +
            next.slice(insertedIdx + 1);
          setNamaLengkap(next);
          window.requestAnimationFrame(() => {
            if (namaInputRef.current) {
              namaInputRef.current.setSelectionRange(cursor, cursor);
            }
          });
          return;
        }
      } else {
        manualOverridePosRef.current = null;
      }
    } else {
      manualOverridePosRef.current = null;
    }

    setNamaLengkap(next);
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

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!namaLengkap.trim()) {
      setFormError('Nama lengkap donatur wajib diisi.');
      return;
    }
    if (!jenisKelamin) {
      setFormError('Silakan pilih jenis kelamin (Laki-laki atau Perempuan).');
      return;
    }
    const trimmedEmail = emailInput.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Format alamat email tidak valid. Kosongkan jika tidak ingin mengisi email.');
      return;
    }
    if (parsedNominal < 1000) {
      setFormError('Nominal komitmen minimal Rp 1.000.');
      return;
    }
    if (tglPengingat < 1 || tglPengingat > 31) {
      setFormError('Tanggal pengingat rutin wajib antara tanggal 1 hingga 31.');
      return;
    }

    const metodeDaftar = isReferralLocked
      ? 'Mandiri (Referral)'
      : selectedPanitiaObj
      ? 'Via Pengurus'
      : 'Mandiri';
    const kodePerantara = isReferralLocked
      ? matchedRefPanitia!.kodePanitia
      : selectedPanitiaObj
      ? selectedPanitiaObj.kodePanitia
      : '';
    const namaPerantara = isReferralLocked
      ? matchedRefPanitia!.namaPanitia
      : selectedPanitiaObj
      ? selectedPanitiaObj.namaPanitia
      : 'Langsung (Tanpa Perantara)';

    setIsSubmitting(true);
    const res = await onSubmitDonatur({
      namaLengkap: namaLengkap.trim(),
      jenisKelamin,
      noWa: verifiedWa,
      email: trimmedEmail,
      kabId: selectedWilayah?.kabId || '',
      domisili: selectedWilayah?.kab || '',
      provinsi: selectedWilayah?.prov || '',
      pulau: selectedWilayah?.pulau || '',
      nominalKomitmen: parsedNominal,
      tglJatuhTempo: tglPengingat,
      metodeDaftar,
      kodePerantara,
      namaPerantara,
      minatGrupWa,
    });
    setIsSubmitting(false);

    if (res.ok && res.donatur) {
      setRegisteredDonatur(res.donatur);
      setRegisteredNotif(res.notifStatus || null);
      setStep('success');
      return;
    }

    if (res.existingDonatur) {
      // Nomor ternyata baru saja terdaftar
      const lookup = await onLookupWa(verifiedWa);
      if (lookup.ok && lookup.result?.found && lookup.result.donatur) {
        setExistingMatch({
          donatur: lookup.result.donatur,
          transaksi: lookup.result.transaksi || [],
        });
        setStep('already_registered');
        return;
      }
    }

    setFormError(res.message || 'Pendaftaran tidak dapat diproses. Silakan coba lagi.');
  };

  const handleStartOver = () => {
    setWaInput('');
    setVerifiedWa('');
    setExistingMatch(null);
    setCheckError(null);
    setFormError(null);
    setNamaLengkap('');
    setJenisKelamin('');
    setEmailInput('');
    setSelectedKabId('');
    setNominalInput((config.defaultNominal || 50000).toLocaleString('id-ID'));
    setTglPengingat(config.defaultTglPengingat || 5);
    setSelectedPanitiaKode('');
    setMinatGrupWa('Ya');
    setRegisteredDonatur(null);
    setRegisteredNotif(null);
    setStep('check_wa');
  };

  const renderRekeningSidebar = () => (
    <aside className="lg:col-span-4 glass-surface rounded-3xl p-5 sm:p-6 space-y-5 min-w-0">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Rekening Resmi Kafalah Dai
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed safe-wrap">
          {config.catatanPembayaran ||
            `Penyaluran donasi rutin Kafalah Dai melalui rekening resmi ${config.namaLembaga}.`}
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
                  <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight safe-wrap">
                    {rek.nomor}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 safe-wrap">
                    a.n. {rek.atasNama}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyRekening(rek.nomor, rek.bank)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300 dark:hover:border-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
            title="Ketuk untuk memperbesar QRIS"
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

  return (
    <div className="space-y-6">
      {/* STEP 1: MASUKKAN NOMOR WHATSAPP TERLEBIH DAHULU */}
      {step === 'check_wa' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-8 glass-surface rounded-3xl p-5 sm:p-8 min-w-0">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Program Kafalah Dai · {config.namaLembaga}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 safe-wrap">
                Pendaftaran Donatur Rutin
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
                {config.tagline} Masukkan nomor WhatsApp aktif Anda terlebih dahulu untuk memulai
                pendaftaran atau mengecek status kepesertaan Anda.
              </p>
            </div>

            {isReferralLocked && matchedRefPanitia && (
              <div className="mt-5 rounded-2xl border border-emerald-200/90 dark:border-emerald-800/80 bg-emerald-50/75 dark:bg-emerald-950/50 p-4 flex items-start gap-3">
                <Lock className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 safe-wrap">
                    Tautan Perantara Aktif: {matchedRefPanitia.namaPanitia}
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-800/90 dark:text-emerald-300/90 safe-wrap">
                    Pendaftaran Anda otomatis tercatat melalui perantara{' '}
                    <strong>{matchedRefPanitia.namaPanitia}</strong> (Kode{' '}
                    {matchedRefPanitia.kodePanitia}).
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleCheckWa} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="pub-reg-wa"
                  className="block text-sm font-bold text-slate-800 dark:text-slate-100 mb-2"
                >
                  Nomor WhatsApp Aktif <span className="text-rose-600 dark:text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <input
                    id="pub-reg-wa"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    value={waInput}
                    onChange={(e) => {
                      setWaInput(e.target.value);
                      setCheckError(null);
                    }}
                    placeholder="Contoh: 081234567890"
                    className="w-full min-h-[52px] rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 pl-12 pr-4 py-3.5 text-base font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                  />
                </div>
                {waInput.trim() !== '' ? (
                  <p
                    className={`mt-2 text-xs font-medium safe-wrap ${
                      waValidation.valid
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {waValidation.valid
                      ? `Format nomor siap digunakan: ${formatWADisplay(waValidation.normalized)}`
                      : waValidation.error}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 safe-wrap">
                    Gunakan awalan 08... untuk nomor Indonesia atau +kode negara (+60, +65, dll.)
                    untuk luar negeri.
                  </p>
                )}
              </div>

              {checkError && (
                <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/50 p-3.5 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
                  <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span className="safe-wrap">{checkError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isCheckingWa}
                className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-[0_10px_24px_-8px_rgba(5,150,105,0.5)] hover:opacity-95 active:scale-[0.99] disabled:opacity-55 transition-all cursor-pointer"
              >
                {isCheckingWa ? (
                  <>
                    <Search className="h-4 w-4 animate-pulse shrink-0" />
                    <span>Memeriksa Nomor WhatsApp...</span>
                  </>
                ) : (
                  <>
                    <span>Lanjutkan Pendaftaran</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </>
                )}
              </button>
            </form>

            {/* Arahkan ke halaman konfirmasi pembayaran bila sudah pernah daftar */}
            <div className="mt-6 pt-5 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Sudah terdaftar sebagai donatur?
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 safe-wrap">
                  Kirim bukti transfer kafalah atau lihat riwayat pembayaran bulanan Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSwitchToBayar({ wa: waInput.trim() || undefined })}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/50 px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Konfirmasi Penyaluran Kafalah</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            </div>
          </section>

          {renderRekeningSidebar()}
        </div>
      )}

      {/* JIKA NOMOR WA SUDAH TERDAFTAR */}
      {step === 'already_registered' && existingMatch && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-8 glass-surface rounded-3xl p-5 sm:p-8 space-y-5 min-w-0">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                <UserCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 safe-wrap">
                  Nomor Anda Sudah Terdaftar
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
                  Alhamdulillah, nomor WhatsApp{' '}
                  <strong className="font-mono text-slate-900 dark:text-white">
                    {formatWADisplay(existingMatch.donatur.noWa)}
                  </strong>{' '}
                  sudah terdaftar sebagai Donatur Rutin Kafalah Dai. Anda tidak perlu mendaftar
                  ulang — silakan lanjut ke halaman pembayaran untuk mengunggah bukti transfer.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/70 bg-emerald-50/60 dark:bg-emerald-950/35 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Nama Lengkap
                </p>
                <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100 safe-wrap">
                  {existingMatch.donatur.namaLengkap}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  ID Donatur
                </p>
                <p className="mt-0.5 font-mono font-bold text-emerald-800 dark:text-emerald-300">
                  {existingMatch.donatur.idDonatur}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Komitmen Bulanan
                </p>
                <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatRupiah(existingMatch.donatur.nominalKomitmen)} / bulan
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Domisili &amp; Status
                </p>
                <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200 safe-wrap">
                  {existingMatch.donatur.domisili || '-'} · {existingMatch.donatur.statusAktif}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() =>
                  onSwitchToBayar({
                    donatur: existingMatch.donatur,
                    transaksi: existingMatch.transaksi,
                  })
                }
                className="flex-1 sm:flex-none min-h-[50px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-6 py-3 text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(5,150,105,0.45)] hover:opacity-95 transition-all cursor-pointer"
              >
                <span>Ke Halaman Pembayaran &amp; Upload Bukti</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>

              {safeGroupLink && (
                <a
                  href={safeGroupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[50px] inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700 transition-colors whitespace-nowrap"
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span>Gabung Grup WA</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setStep('check_wa');
                  setExistingMatch(null);
                }}
                className="min-h-[50px] inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span>Cek Nomor Lain</span>
              </button>
            </div>
          </section>

          {renderRekeningSidebar()}
        </div>
      )}

      {/* STEP 2: FORM PENDAFTARAN LENGKAP */}
      {step === 'form' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-8 glass-surface rounded-3xl p-5 sm:p-8 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/70 dark:border-slate-700/70">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Lengkapi Data Donatur Rutin
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 safe-wrap">
                  Nomor WhatsApp{' '}
                  <strong className="font-mono text-emerald-800 dark:text-emerald-300">
                    {formatWADisplay(verifiedWa)}
                  </strong>{' '}
                  belum terdaftar dan siap didaftarkan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep('check_wa')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                <span>Ganti Nomor</span>
              </button>
            </div>

            {isReferralLocked && matchedRefPanitia && (
              <div className="mt-5 rounded-2xl border border-emerald-200/90 dark:border-emerald-800/80 bg-emerald-50/75 dark:bg-emerald-950/50 p-3.5 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                <Lock className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="safe-wrap">
                  Perantara otomatis: <strong>{matchedRefPanitia.namaPanitia}</strong> (Kode{' '}
                  {matchedRefPanitia.kodePanitia}).
                </span>
              </div>
            )}

            {formError && (
              <div className="mt-5 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/50 p-4 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-200">
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed safe-wrap">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="mt-6 space-y-5">
              {/* Nama Lengkap */}
              <div className="min-w-0">
                <label
                  htmlFor="pub-nama"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Nama Lengkap Donatur <span className="text-rose-600 dark:text-rose-400">*</span>
                </label>
                <input
                  ref={namaInputRef}
                  id="pub-nama"
                  type="text"
                  autoCapitalize="words"
                  required
                  value={namaLengkap}
                  onChange={handleNamaChange}
                  placeholder="Contoh: Ahmad Fauzi"
                  className="w-full min-h-[48px] rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 px-4 py-3 text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Jenis Kelamin + Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Jenis Kelamin <span className="text-rose-600 dark:text-rose-400">*</span>
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Pilih jenis kelamin donatur"
                    className="grid grid-cols-2 gap-2.5"
                  >
                    {(['Laki-laki', 'Perempuan'] as const).map((opt) => {
                      const selected = jenisKelamin === opt;
                      return (
                        <label
                          key={opt}
                          className={`min-h-[48px] flex items-center justify-center sm:justify-start gap-2 rounded-2xl border px-3.5 py-3 text-sm font-semibold transition-all cursor-pointer select-none ${
                            selected
                              ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                              : 'border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 text-slate-700 dark:text-slate-200 hover:border-emerald-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="pub-jenis-kelamin"
                            value={opt}
                            checked={selected}
                            onChange={() => setJenisKelamin(opt)}
                            className="sr-only"
                          />
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? 'border-emerald-600 bg-emerald-600'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}
                          >
                            {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          <span className="whitespace-nowrap">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="pub-email"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    Alamat Email{' '}
                    <span className="font-normal text-slate-400">(Opsional, untuk notifikasi)</span>
                  </label>
                  <input
                    id="pub-email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full min-h-[48px] rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Asal Kabupaten / Kota */}
              <div className="min-w-0">
                <label
                  htmlFor="pub-kab"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Asal Kabupaten / Kota{' '}
                  <span className="font-normal text-slate-400">(Opsional)</span>
                </label>
                <SearchableSelect
                  id="pub-kab"
                  ariaLabel="Pilih kabupaten atau kota domisili"
                  options={wilayahOptions}
                  value={selectedKabId}
                  onChange={(val) => setSelectedKabId(val)}
                  allowClear
                  placeholder="Ketik & pilih kabupaten atau kota..."
                  searchPlaceholder="Ketik nama kabupaten, kota, atau provinsi..."
                  emptyText="Kabupaten/kota tidak ditemukan."
                />
                {selectedWilayah && (
                  <p className="mt-1.5 text-xs text-teal-800 dark:text-teal-300 safe-wrap">
                    Provinsi {selectedWilayah.prov} · Pulau {selectedWilayah.pulau}
                  </p>
                )}
              </div>

              {/* Nominal Komitmen & Tanggal Pengingat */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-7 min-w-0">
                  <label
                    htmlFor="pub-nominal"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    Nominal Komitmen Bulanan{' '}
                    <span className="text-rose-600 dark:text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 dark:text-slate-400">
                      Rp
                    </span>
                    <input
                      id="pub-nominal"
                      type="text"
                      inputMode="numeric"
                      required
                      value={nominalInput}
                      onChange={(e) => setNominalInput(formatRupiahInput(e.target.value))}
                      placeholder="50.000"
                      className="w-full min-h-[48px] rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 pl-11 pr-4 py-3 text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="mt-2.5 grid grid-cols-5 gap-1.5">
                    {QUICK_NOMINALS.map((opt) => {
                      const isActive = parsedNominal === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNominalInput(opt.value.toLocaleString('id-ID'))}
                          className={`min-h-[38px] rounded-xl px-2 py-1.5 text-xs font-bold tabular-nums transition-colors whitespace-nowrap cursor-pointer ${
                            isActive
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/40'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-5 min-w-0">
                  <label
                    htmlFor="pub-tempo"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    Tanggal Pengingat Rutin (1–31){' '}
                    <span className="text-rose-600 dark:text-rose-400">*</span>
                  </label>
                  <SearchableSelect
                    id="pub-tempo"
                    ariaLabel="Pilih tanggal pengingat rutin"
                    options={TANGGAL_OPTIONS}
                    value={String(tglPengingat)}
                    onChange={(val) => {
                      const n = Number(val);
                      if (n >= 1 && n <= 31) setTglPengingat(n);
                    }}
                    placeholder="Pilih tanggal..."
                    searchPlaceholder="Ketik angka tanggal (1-31)..."
                  />
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-teal-800 dark:text-teal-300 leading-relaxed safe-wrap">
                    <BellRing className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Pengingat rutin dikirim ke WhatsApp Anda setiap bulan.</span>
                  </p>
                </div>
              </div>

              {/* Perantara (opsional bila bukan link referral) */}
              {!isReferralLocked && panitia.length > 0 && (
                <div className="min-w-0">
                  <label
                    htmlFor="pub-panitia"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    Perantara / Pengurus{' '}
                    <span className="font-normal text-slate-400">(Opsional)</span>
                  </label>
                  <SearchableSelect
                    id="pub-panitia"
                    ariaLabel="Pilih nama pengurus atau perantara"
                    options={panitiaOptions}
                    value={selectedPanitiaKode}
                    onChange={(val) => setSelectedPanitiaKode(val)}
                    placeholder="Daftar Mandiri (Langsung)"
                    searchPlaceholder="Ketik nama pengurus/perantara..."
                    emptyText="Nama pengurus tidak ditemukan."
                  />
                </div>
              )}

              {/* Minat Bergabung Grup WhatsApp */}
              <div className="rounded-2xl border border-emerald-200/75 dark:border-emerald-800/70 bg-emerald-50/45 dark:bg-emerald-950/25 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <Users className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                      Bergabung ke {config.waGroupName || 'Grup WhatsApp Donatur'}?
                    </span>
                    <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
                      Dapatkan kabar penyaluran kafalah dan perkembangan dakwah Dai melalui grup
                      resmi donatur.
                    </p>
                  </div>
                </div>
                <div
                  role="radiogroup"
                  aria-label="Pilihan bergabung Grup WhatsApp Donatur"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                >
                  {(
                    [
                      { value: 'Ya', label: 'Ya, Bersedia Bergabung' },
                      { value: 'Tidak', label: 'Tidak, Cukup via Japri' },
                    ] as const
                  ).map((opt) => {
                    const selected = minatGrupWa === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`min-h-[46px] flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none ${
                          selected
                            ? 'border-emerald-500 bg-white dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-sm'
                            : 'border-slate-200/90 dark:border-slate-700 bg-white/85 dark:bg-slate-900/75 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="pub-minat-grup"
                          value={opt.value}
                          checked={selected}
                          onChange={() => setMinatGrupWa(opt.value)}
                          className="sr-only"
                        />
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? 'border-emerald-600 bg-emerald-600'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                          }`}
                        >
                          {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="safe-wrap">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-[0_10px_24px_-8px_rgba(5,150,105,0.5)] hover:opacity-95 active:scale-[0.99] disabled:opacity-55 transition-all cursor-pointer"
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <span>{isSubmitting ? 'Menyimpan Pendaftaran...' : 'Daftar Jadi Donatur Rutin'}</span>
              </button>
            </form>
          </section>

          {renderRekeningSidebar()}
        </div>
      )}

      {/* STEP 3: PENDAFTARAN BERHASIL */}
      {step === 'success' && registeredDonatur && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-8 glass-surface rounded-3xl p-5 sm:p-8 space-y-5 min-w-0">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 safe-wrap">
                  Alhamdulillah, Pendaftaran Berhasil!
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
                  Jazakumullahu khairan{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {registeredDonatur.namaLengkap}
                  </strong>
                  . Anda resmi tercatat sebagai Donatur Rutin Kafalah Dai bersama{' '}
                  <strong>{config.namaLembaga}</strong>.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/70 bg-emerald-50/60 dark:bg-emerald-950/35 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  ID Donatur
                </p>
                <p className="mt-0.5 font-mono font-bold text-emerald-800 dark:text-emerald-300">
                  {registeredDonatur.idDonatur}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Nomor WhatsApp
                </p>
                <p className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {formatWADisplay(registeredDonatur.noWa)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Komitmen Bulanan
                </p>
                <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatRupiah(registeredDonatur.nominalKomitmen)} / bulan
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Jadwal Pengingat
                </p>
                <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">
                  Setiap tanggal {registeredDonatur.tglJatuhTempo}
                </p>
              </div>
            </div>

            {registeredNotif && (
              <div className="rounded-2xl bg-white/75 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 p-3.5 text-xs space-y-1">
                <p
                  className={
                    registeredNotif.wa.ok
                      ? 'text-emerald-800 dark:text-emerald-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-300'
                  }
                >
                  Notifikasi WhatsApp:{' '}
                  {registeredNotif.wa.ok
                    ? 'Terkirim ke nomor WhatsApp Anda.'
                    : registeredNotif.wa.detail}
                </p>
                {registeredDonatur.email && (
                  <p
                    className={
                      registeredNotif.email.ok
                        ? 'text-emerald-800 dark:text-emerald-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-300'
                    }
                  >
                    Notifikasi Email:{' '}
                    {registeredNotif.email.ok ? 'Terkirim.' : registeredNotif.email.detail}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() =>
                  onSwitchToBayar({
                    donatur: registeredDonatur,
                    transaksi: [],
                  })
                }
                className="flex-1 sm:flex-none min-h-[50px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-6 py-3 text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(5,150,105,0.45)] hover:opacity-95 transition-all cursor-pointer"
              >
                <span>Lanjut Pembayaran &amp; Upload Bukti</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>

              {safeGroupLink && (
                <a
                  href={safeGroupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[50px] inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700 transition-colors whitespace-nowrap"
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span>Gabung Grup WA Donatur</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              )}

              <button
                type="button"
                onClick={handleStartOver}
                className="min-h-[50px] inline-flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Daftarkan Donatur Lain
              </button>
            </div>
          </section>

          {renderRekeningSidebar()}
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
