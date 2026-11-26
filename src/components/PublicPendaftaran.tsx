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
  Pencil,
  Phone,
  QrCode,
  Save,
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
  RegisterDonaturPayload,
  TransaksiDonasi,
  UpdateDonaturMandiriPayload,
} from '../types';
import {
  formatRupiah,
  formatRupiahInput,
  formatWADisplay,
  getDriveThumbnailFallback,
  normalizeDriveImageUrl,
  parseRupiahInput,
  sanitizeExternalUrl,
  validateAndNormalizeWA,
} from '../utils/formatters';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

interface PublicPendaftaranProps {
  config: LembagaConfig;
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
  onUpdateDonaturMandiri: (
    payload: UpdateDonaturMandiriPayload
  ) => Promise<{
    ok: boolean;
    message: string;
    donatur?: Donatur;
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
  initialWa,
  onClearInitialWa,
  onLookupWa,
  onSubmitDonatur,
  onUpdateDonaturMandiri,
  onSwitchToBayar,
  onNotify,
}) => {
  // Step 1: cek nomor WA -> Step 2: isi form / edit data terdaftar -> Step 3: sukses
  const [step, setStep] = useState<'check_wa' | 'already_registered' | 'form' | 'success'>('check_wa');
  const [waInput, setWaInput] = useState(initialWa || '');
  const [verifiedWa, setVerifiedWa] = useState('');
  const [isCheckingWa, setIsCheckingWa] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [existingMatch, setExistingMatch] = useState<{
    donatur: Donatur;
    transaksi: TransaksiDonasi[];
  } | null>(null);

  // Inline edit state for already registered donor
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [editNoWa, setEditNoWa] = useState('');
  const [editNama, setEditNama] = useState('');
  const [editJk, setEditJk] = useState<JenisKelamin>('');
  const [editEmail, setEditEmail] = useState('');
  const [editKabId, setEditKabId] = useState('');
  const [editNominalInput, setEditNominalInput] = useState('');
  const [editTglPengingat, setEditTglPengingat] = useState<number>(5);
  const [editMinatGrup, setEditMinatGrup] = useState<MinatGrupWa>('Ya');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSavedNotice, setEditSavedNotice] = useState(false);

  // Form fields (Step 2 - New registration)
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

  const showGroupUi = config.showWaGroupPublic !== false;
  const safeGroupLink = useMemo(
    () => (showGroupUi ? sanitizeExternalUrl(config.waGroupLink) : ''),
    [showGroupUi, config.waGroupLink]
  );
  const waGroupLabel = useMemo(() => {
    const raw = (config.waGroupName || 'Donatur Tetap DAIKITA — Dakwah Pelosok').trim();
    return /^grup\s+whatsapp/i.test(raw) ? raw : `Grup WhatsApp "${raw}"`;
  }, [config.waGroupName]);

  const showRekeningBlock = Boolean(config.showRekening && config.infoRekening.length > 0);
  const showQrisBlock = Boolean(config.showQris && config.qrisUrl);
  const hasSidebar = showRekeningBlock || showQrisBlock;

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
  const editWaValidation = useMemo(() => validateAndNormalizeWA(editNoWa), [editNoWa]);
  const parsedNominal = useMemo(() => parseRupiahInput(nominalInput), [nominalInput]);
  const parsedEditNominal = useMemo(() => parseRupiahInput(editNominalInput), [editNominalInput]);

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

  const selectedEditWilayah = useMemo(
    () => WILAYAH_KABUPATEN.find((w) => w.kabId === editKabId) || null,
    [editKabId]
  );

  const startEditExisting = (donatur: Donatur) => {
    const matchedWil =
      WILAYAH_KABUPATEN.find((w) => w.kabId === donatur.kabId) ||
      WILAYAH_KABUPATEN.find(
        (w) => w.kab.toLowerCase() === (donatur.domisili || '').trim().toLowerCase()
      );
    setEditNoWa(donatur.noWa || '');
    setEditNama(donatur.namaLengkap || '');
    setEditJk(donatur.jenisKelamin || '');
    setEditEmail(donatur.email || '');
    setEditKabId(matchedWil?.kabId || '');
    setEditNominalInput((donatur.nominalKomitmen || 50000).toLocaleString('id-ID'));
    setEditTglPengingat(donatur.tglJatuhTempo || 5);
    setEditMinatGrup(donatur.minatGrupWa || 'Ya');
    setEditError(null);
    setEditSavedNotice(false);
    setIsEditingExisting(true);
  };

  const handleSaveEditExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingMatch) return;
    setEditError(null);

    if (!editWaValidation.valid) {
      setEditError(editWaValidation.error);
      return;
    }
    if (!editNama.trim()) {
      setEditError('Nama lengkap donatur wajib diisi.');
      return;
    }
    if (!editJk) {
      setEditError('Silakan pilih jenis kelamin (Laki-laki atau Perempuan).');
      return;
    }
    const trimmedEmail = editEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEditError('Format alamat email tidak valid.');
      return;
    }
    if (parsedEditNominal < 1000) {
      setEditError('Nominal komitmen bulanan minimal Rp 1.000.');
      return;
    }
    if (editTglPengingat < 1 || editTglPengingat > 31) {
      setEditError('Tanggal pengingat bulanan wajib antara 1 hingga 31.');
      return;
    }

    setIsSavingEdit(true);
    const res = await onUpdateDonaturMandiri({
      idDonatur: existingMatch.donatur.idDonatur,
      originalNoWa: existingMatch.donatur.noWa,
      noWa: editWaValidation.normalized,
      namaLengkap: editNama.trim(),
      jenisKelamin: editJk,
      email: trimmedEmail,
      kabId: selectedEditWilayah?.kabId || '',
      domisili: selectedEditWilayah?.kab || '',
      provinsi: selectedEditWilayah?.prov || '',
      pulau: selectedEditWilayah?.pulau || '',
      nominalKomitmen: parsedEditNominal,
      tglJatuhTempo: editTglPengingat,
      minatGrupWa: editMinatGrup,
    });
    setIsSavingEdit(false);

    if (res.ok && res.donatur) {
      setExistingMatch({
        donatur: res.donatur,
        transaksi: existingMatch.transaksi,
      });
      setWaInput(res.donatur.noWa);
      setIsEditingExisting(false);
      setEditSavedNotice(true);
    } else {
      setEditError(res.message || 'Gagal memperbarui data donatur.');
    }
  };

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
      setIsEditingExisting(false);
      setEditSavedNotice(false);
      setEditError(null);
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
      setFormError('Tanggal pengingat bulanan wajib antara tanggal 1 hingga 31.');
      return;
    }

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
      metodeDaftar: 'Mandiri',
      kodePerantara: '',
      namaPerantara: '-',
      minatGrupWa: showGroupUi ? minatGrupWa : 'Tidak',
    });
    setIsSubmitting(false);

    if (res.ok && res.donatur) {
      setRegisteredDonatur(res.donatur);
      setRegisteredNotif(res.notifStatus || null);
      setStep('success');
      return;
    }

    if (res.existingDonatur) {
      const lookup = await onLookupWa(verifiedWa);
      if (lookup.ok && lookup.result?.found && lookup.result.donatur) {
        setExistingMatch({
          donatur: lookup.result.donatur,
          transaksi: lookup.result.transaksi || [],
        });
        setIsEditingExisting(false);
        setEditSavedNotice(false);
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
    setIsEditingExisting(false);
    setEditSavedNotice(false);
    setCheckError(null);
    setFormError(null);
    setNamaLengkap('');
    setJenisKelamin('');
    setEmailInput('');
    setSelectedKabId('');
    setNominalInput((config.defaultNominal || 50000).toLocaleString('id-ID'));
    setTglPengingat(config.defaultTglPengingat || 5);
    setMinatGrupWa('Ya');
    setRegisteredDonatur(null);
    setRegisteredNotif(null);
    setStep('check_wa');
  };

  const renderRekeningSidebar = () => {
    if (!hasSidebar) return null;

    return (
      <aside className="lg:col-span-4 glass-surface rounded-3xl p-5 sm:p-6 space-y-5 min-w-0">
        {showRekeningBlock && (
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Rekening Resmi Penyaluran Donasi
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed safe-wrap">
              {config.catatanPembayaran ||
                `Penyaluran donasi Dakwah Pelosok melalui rekening resmi ${config.namaLembaga}.`}
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
        )}

        {showQrisBlock && (
          <div
            className={
              showRekeningBlock
                ? 'pt-5 border-t border-slate-200/70 dark:border-slate-700/70 space-y-3'
                : 'space-y-3'
            }
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <QrCode className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>QRIS Penyaluran Donasi</span>
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
                alt="QRIS Penyaluran Donasi Resmi"
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
  };

  const mainColClass = hasSidebar
    ? 'lg:col-span-8 glass-surface rounded-3xl p-5 sm:p-8 min-w-0'
    : 'lg:col-span-12 max-w-3xl w-full mx-auto glass-surface rounded-3xl p-5 sm:p-8 min-w-0';

  return (
    <div className="space-y-6">
      {/* STEP 1: MASUKKAN NOMOR WHATSAPP TERLEBIH DAHULU */}
      {step === 'check_wa' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className={mainColClass}>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {config.namaLembaga}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 safe-wrap">
                Pendaftaran Donatur Tetap Dakwah Pelosok
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
                {config.tagline} Masukkan nomor WhatsApp aktif Anda terlebih dahulu untuk memulai
                pendaftaran atau mengecek data kepesertaan Anda.
              </p>
            </div>

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

            {/* Arahkan ke halaman konfirmasi penyaluran donasi bila sudah pernah daftar */}
            <div className="mt-6 pt-5 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Sudah terdaftar sebagai Donatur Tetap?
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 safe-wrap">
                  Kirim bukti transfer penyaluran donasi atau lihat riwayat bulanan Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSwitchToBayar({ wa: waInput.trim() || undefined })}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/50 px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Konfirmasi Penyaluran Donasi</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            </div>
          </section>

          {renderRekeningSidebar()}
        </div>
      )}

      {/* JIKA NOMOR WA SUDAH TERDAFTAR: TAMPILKAN DATA LENGKAP + BISA EDIT + TOMBOL KONFIRMASI */}
      {step === 'already_registered' && existingMatch && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className={`${mainColClass} space-y-5`}>
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
                  sudah terdaftar sebagai <strong>Donatur Tetap Dakwah Pelosok</strong>. Mohon
                  periksa apakah data di bawah ini sudah sesuai — Anda bisa langsung memperbaruinya
                  atau lanjut ke halaman <strong>Konfirmasi Penyaluran Donasi</strong>.
                </p>
              </div>
            </div>

            {editSavedNotice && (
              <div className="rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/90 dark:bg-emerald-950/50 p-3.5 flex items-center gap-2.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Data donatur Anda berhasil diperbarui dan tersimpan.</span>
              </div>
            )}

            {/* VIEW MODE: RINCIAN LENGKAP DATA DONATUR */}
            {!isEditingExisting ? (
              <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/70 bg-emerald-50/60 dark:bg-emerald-950/35 p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-emerald-200/70 dark:border-emerald-800/60">
                  <div>
                    <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Apakah data Donatur Tetap Anda di bawah ini sudah sesuai?
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Klik tombol Edit Data jika ada perubahan nama, daerah, nomor WA, atau nominal
                      komitmen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEditExisting(existingMatch.donatur)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5 shrink-0" />
                    <span>Edit / Perbarui Data</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      ID Donatur &amp; Status
                    </p>
                    <p className="mt-0.5 font-mono font-bold text-emerald-800 dark:text-emerald-300 safe-wrap">
                      {existingMatch.donatur.idDonatur} ·{' '}
                      <span className="font-sans text-slate-800 dark:text-slate-200">
                        {existingMatch.donatur.statusAktif}
                      </span>
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Nomor WhatsApp
                    </p>
                    <p className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums safe-wrap">
                      {formatWADisplay(existingMatch.donatur.noWa)}
                    </p>
                  </div>
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
                      Jenis Kelamin
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200 safe-wrap">
                      {existingMatch.donatur.jenisKelamin || '-'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Alamat Email
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200 safe-wrap">
                      {existingMatch.donatur.email || '-'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Asal Daerah
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200 safe-wrap">
                      {[
                        existingMatch.donatur.domisili,
                        existingMatch.donatur.provinsi,
                        existingMatch.donatur.pulau,
                      ]
                        .filter(Boolean)
                        .join(', ') || '-'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Nominal Komitmen Bulanan
                    </p>
                    <p className="mt-0.5 font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                      {formatRupiah(existingMatch.donatur.nominalKomitmen)} / bulan
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {showGroupUi ? 'Tanggal Pengingat & Grup WA' : 'Tanggal Pengingat Bulanan'}
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200 safe-wrap">
                      Setiap tgl {existingMatch.donatur.tglJatuhTempo}
                      {showGroupUi
                        ? ` · Grup WA: ${
                            existingMatch.donatur.minatGrupWa === 'Ya' ? 'Bersedia' : 'Cukup Japri'
                          }`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* INLINE EDIT FORM FOR EXISTING DONOR */
              <form
                onSubmit={handleSaveEditExisting}
                className="rounded-2xl border border-emerald-300/90 dark:border-emerald-700/80 bg-white/80 dark:bg-slate-900/70 p-4 sm:p-5 space-y-4"
              >
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-700/70">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Perbarui Data Donatur Tetap ({existingMatch.donatur.idDonatur})
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Ubah data yang perlu disesuaikan lalu klik Simpan Perubahan.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingExisting(false);
                      setEditError(null);
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label="Batal edit"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {editError && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/50 p-3 flex items-start gap-2 text-xs text-rose-800 dark:text-rose-200">
                    <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span className="safe-wrap">{editError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label
                      htmlFor="edit-wa"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                    >
                      Nomor WhatsApp <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="edit-wa"
                      type="tel"
                      inputMode="tel"
                      required
                      value={editNoWa}
                      onChange={(e) => setEditNoWa(e.target.value)}
                      className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    {editNoWa.trim() && (
                      <p
                        className={`mt-1 text-[11px] ${
                          editWaValidation.valid
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {editWaValidation.valid
                          ? `Format: ${formatWADisplay(editWaValidation.normalized)}`
                          : editWaValidation.error}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <label
                      htmlFor="edit-nama"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                    >
                      Nama Lengkap <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="edit-nama"
                      type="text"
                      required
                      value={editNama}
                      onChange={(e) => setEditNama(e.target.value)}
                      className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Jenis Kelamin <span className="text-rose-600">*</span>
                    </span>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup">
                      {(['Laki-laki', 'Perempuan'] as const).map((opt) => {
                        const selected = editJk === opt;
                        return (
                          <label
                            key={opt}
                            className={`min-h-[46px] flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer select-none ${
                              selected
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name="edit-jk"
                              value={opt}
                              checked={selected}
                              onChange={() => setEditJk(opt)}
                              className="sr-only"
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <label
                      htmlFor="edit-email"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                    >
                      Alamat Email <span className="font-normal text-slate-400">(Opsional)</span>
                    </label>
                    <input
                      id="edit-email"
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="edit-kab"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    Asal Kabupaten / Kota
                  </label>
                  <SearchableSelect
                    id="edit-kab"
                    ariaLabel="Ubah kabupaten atau kota domisili"
                    options={wilayahOptions}
                    value={editKabId}
                    onChange={(val) => setEditKabId(val)}
                    allowClear
                    placeholder="Ketik & pilih kabupaten atau kota..."
                    searchPlaceholder="Ketik nama kabupaten, kota, atau provinsi..."
                    emptyText="Kabupaten/kota tidak ditemukan."
                  />
                  {selectedEditWilayah && (
                    <p className="mt-1 text-[11px] text-teal-800 dark:text-teal-300 safe-wrap">
                      Provinsi {selectedEditWilayah.prov} · Pulau {selectedEditWilayah.pulau}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-7 min-w-0">
                    <label
                      htmlFor="edit-nominal"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                    >
                      Nominal Komitmen Bulanan <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                        Rp
                      </span>
                      <input
                        id="edit-nominal"
                        type="text"
                        inputMode="numeric"
                        required
                        value={editNominalInput}
                        onChange={(e) => setEditNominalInput(formatRupiahInput(e.target.value))}
                        className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-5 gap-1.5">
                      {QUICK_NOMINALS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setEditNominalInput(opt.value.toLocaleString('id-ID'))}
                          className={`min-h-[34px] rounded-lg px-1.5 py-1 text-[11px] font-bold tabular-nums cursor-pointer ${
                            parsedEditNominal === opt.value
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-5 min-w-0">
                    <label
                      htmlFor="edit-tempo"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                    >
                      Tanggal Pengingat (1–31) <span className="text-rose-600">*</span>
                    </label>
                    <SearchableSelect
                      id="edit-tempo"
                      ariaLabel="Ubah tanggal pengingat bulanan"
                      options={TANGGAL_OPTIONS}
                      value={String(editTglPengingat)}
                      onChange={(val) => {
                        const n = Number(val);
                        if (n >= 1 && n <= 31) setEditTglPengingat(n);
                      }}
                      placeholder="Pilih tanggal..."
                      searchPlaceholder="Ketik tanggal (1-31)..."
                    />
                  </div>
                </div>

                {showGroupUi && (
                  <div className="space-y-2">
                    <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      Bergabung ke {waGroupLabel}?
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup">
                      {(
                        [
                          { value: 'Ya', label: 'Ya, Bersedia Bergabung' },
                          { value: 'Tidak', label: 'Tidak, Cukup via Japri' },
                        ] as const
                      ).map((opt) => {
                        const selected = editMinatGrup === opt.value;
                        return (
                          <label
                            key={opt.value}
                            className={`min-h-[44px] flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer select-none ${
                              selected
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name="edit-minat-grup"
                              value={opt.value}
                              checked={selected}
                              onChange={() => setEditMinatGrup(opt.value)}
                              className="sr-only"
                            />
                            <span className="safe-wrap">{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-55 transition-colors cursor-pointer"
                  >
                    <Save className="h-4 w-4 shrink-0" />
                    <span>{isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan Data'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingExisting(false);
                      setEditError(null);
                    }}
                    className="min-h-[46px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}

            {/* TOMBOL AKSI UTAMA: TETAP TAMPILKAN KONFIRMASI PEMBAYARAN / PENYALURAN DONASI */}
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
                <span>Konfirmasi Penyaluran Donasi</span>
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
                  setIsEditingExisting(false);
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
          <section className={mainColClass}>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/70 dark:border-slate-700/70">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Lengkapi Data Donatur Tetap Dakwah Pelosok
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
                    Tanggal Pengingat Bulanan (1–31){' '}
                    <span className="text-rose-600 dark:text-rose-400">*</span>
                  </label>
                  <SearchableSelect
                    id="pub-tempo"
                    ariaLabel="Pilih tanggal pengingat bulanan"
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
                    <span>Pengingat bulanan dikirim ke WhatsApp Anda setiap bulan.</span>
                  </p>
                </div>
              </div>

              {/* Minat Bergabung Grup WhatsApp (hanya tampil jika diaktifkan di Pengaturan) */}
              {showGroupUi && (
                <div className="rounded-2xl border border-emerald-200/75 dark:border-emerald-800/70 bg-emerald-50/45 dark:bg-emerald-950/25 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Users className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 safe-wrap">
                        Bergabung ke {waGroupLabel}?
                      </span>
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
                        Dapatkan kabar penyaluran donasi dan perkembangan program Dakwah Pelosok
                        melalui Grup WhatsApp resmi donatur.
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
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-[0_10px_24px_-8px_rgba(5,150,105,0.5)] hover:opacity-95 active:scale-[0.99] disabled:opacity-55 transition-all cursor-pointer"
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <span>{isSubmitting ? 'Menyimpan Pendaftaran...' : 'Daftar Jadi Donatur Tetap'}</span>
              </button>
            </form>
          </section>

          {renderRekeningSidebar()}
        </div>
      )}

      {/* STEP 3: PENDAFTARAN BERHASIL */}
      {step === 'success' && registeredDonatur && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className={`${mainColClass} space-y-5`}>
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
                  . Anda resmi tercatat sebagai Donatur Tetap Dakwah Pelosok bersama{' '}
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
                <span>Konfirmasi Penyaluran Donasi</span>
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
                alt="QRIS Penyaluran Donasi"
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
