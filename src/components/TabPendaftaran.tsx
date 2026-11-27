import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  QrCode,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { WILAYAH_KABUPATEN } from '../data/wilayah';
import {
  Donatur,
  JenisKelamin,
  LembagaConfig,
  MinatGrupWa,
  NotifDeliveryResult,
  RegisterDonaturPayload,
} from '../types';
import {
  formatRupiah,
  formatRupiahInput,
  getDriveThumbnailFallback,
  normalizeDriveImageUrl,
  parseRupiahInput,
  validateAndNormalizeWA,
} from '../utils/formatters';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

interface TabPendaftaranProps {
  config: LembagaConfig;
  adminName?: string;
  onSubmitDonatur: (
    payload: RegisterDonaturPayload
  ) => Promise<{
    ok: boolean;
    message: string;
    donatur?: Donatur;
    existingDonatur?: Partial<Donatur>;
    notifStatus?: NotifDeliveryResult;
  }>;
  onGoToKonfirmasi: (donatur: Donatur) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

const QUICK_NOMINALS = [
  { value: 5000, label: '5rb' },
  { value: 15000, label: '15rb' },
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

export const TabPendaftaran: React.FC<TabPendaftaranProps> = ({
  config,
  adminName,
  onSubmitDonatur,
  onGoToKonfirmasi,
  onNotify,
}) => {
  const [namaLengkap, setNamaLengkap] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState<JenisKelamin>('');
  const [noWaInput, setNoWaInput] = useState('');
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
  const [errorState, setErrorState] = useState<{
    message: string;
    existing?: Partial<Donatur>;
  } | null>(null);
  const [registeredDonatur, setRegisteredDonatur] = useState<Donatur | null>(null);
  const [registeredNotif, setRegisteredNotif] = useState<NotifDeliveryResult | null>(null);
  const [copiedRek, setCopiedRek] = useState<string | null>(null);
  const [showQrisZoom, setShowQrisZoom] = useState(false);
  const [qrisImgSrc, setQrisImgSrc] = useState(() => normalizeDriveImageUrl(config.qrisUrl));

  const manualOverridePosRef = useRef<number | null>(null);
  const namaInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQrisImgSrc(normalizeDriveImageUrl(config.qrisUrl));
  }, [config.qrisUrl]);

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

  const waValidation = useMemo(() => validateAndNormalizeWA(noWaInput), [noWaInput]);
  const parsedNominal = useMemo(() => parseRupiahInput(nominalInput), [nominalInput]);

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

  const handleResetForm = () => {
    setNamaLengkap('');
    setJenisKelamin('');
    setNoWaInput('');
    setEmailInput('');
    setSelectedKabId('');
    setNominalInput((config.defaultNominal || 50000).toLocaleString('id-ID'));
    setTglPengingat(config.defaultTglPengingat || 5);
    setMinatGrupWa('Ya');
    setErrorState(null);
    setRegisteredDonatur(null);
    setRegisteredNotif(null);
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
    setErrorState(null);

    if (!namaLengkap.trim()) {
      setErrorState({ message: 'Nama lengkap donatur wajib diisi.' });
      return;
    }

    if (!jenisKelamin) {
      setErrorState({ message: 'Jenis kelamin donatur wajib dipilih (Laki-laki atau Perempuan).' });
      return;
    }

    if (!waValidation.valid) {
      setErrorState({ message: waValidation.error });
      return;
    }

    const trimmedEmail = emailInput.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorState({
        message: 'Format alamat email tidak valid. Kosongkan jika tidak ingin mengisi email.',
      });
      return;
    }

    if (parsedNominal < 1000) {
      setErrorState({ message: 'Nominal komitmen minimal Rp 1.000.' });
      return;
    }

    if (tglPengingat < 1 || tglPengingat > 31) {
      setErrorState({ message: 'Tanggal pengingat wajib antara tanggal 1 hingga 31.' });
      return;
    }

    setIsSubmitting(true);
    const res = await onSubmitDonatur({
      namaLengkap: namaLengkap.trim(),
      jenisKelamin,
      noWa: waValidation.normalized,
      email: trimmedEmail,
      kabId: selectedWilayah?.kabId || '',
      domisili: selectedWilayah?.kab || '',
      provinsi: selectedWilayah?.prov || '',
      pulau: selectedWilayah?.pulau || '',
      nominalKomitmen: parsedNominal,
      tglJatuhTempo: tglPengingat,
      metodeDaftar: adminName ? `Input Admin (${adminName})` : 'Input Admin',
      kodePerantara: '',
      namaPerantara: '',
      minatGrupWa,
    });
    setIsSubmitting(false);

    if (res.ok && res.donatur) {
      setRegisteredDonatur(res.donatur);
      setRegisteredNotif(res.notifStatus || null);
      setNamaLengkap('');
      setJenisKelamin('');
      setNoWaInput('');
      setEmailInput('');
      setSelectedKabId('');
      setMinatGrupWa('Ya');
    } else {
      setErrorState({
        message: res.message,
        existing: res.existingDonatur,
      });
    }
  };

  const showRekeningCard = config.showRekening !== false && config.infoRekening.length > 0;
  const showQrisCard = config.showQris && Boolean(config.qrisUrl);
  const waGroupDisplayName = config.waGroupName || 'Donatur DAIKITA - Dakwah Pelosok';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <section className="lg:col-span-8 glass-surface rounded-3xl p-5 sm:p-8 min-w-0">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Pendaftaran Donatur Tetap Dakwah Pelosok
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
            Catat komitmen donatur tetap bersama{' '}
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              {config.namaLembaga}
            </span>
            . Bidang wajib: <strong>Nama</strong>, <strong>Jenis Kelamin</strong>,{' '}
            <strong>No. WA</strong>, <strong>Nominal Komitmen</strong>, dan{' '}
            <strong>Tanggal Pengingat</strong>.
          </p>
        </div>

        {errorState && (
          <div className="mb-6 rounded-2xl border border-rose-200 dark:border-rose-800/80 bg-rose-50/90 dark:bg-rose-950/50 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-rose-900 dark:text-rose-200 safe-wrap">
                Pendaftaran Tidak Dapat Diproses
              </p>
              <p className="mt-1 text-xs text-rose-800 dark:text-rose-300 leading-relaxed safe-wrap">
                {errorState.message}
              </p>
              {errorState.existing && (
                <div className="mt-2.5 pt-2.5 border-t border-rose-200/80 dark:border-rose-800/60 text-xs text-rose-900/90 dark:text-rose-200/90 space-y-0.5 safe-wrap">
                  <p>
                    Data terdaftar: <strong>{errorState.existing.namaLengkap}</strong> · ID{' '}
                    <span className="font-mono">{errorState.existing.idDonatur}</span>
                  </p>
                  <p>
                    {errorState.existing.domisili ? `${errorState.existing.domisili} · ` : ''}
                    <span className="tabular-nums font-medium">
                      {formatRupiah(errorState.existing.nominalKomitmen || 0)}/bulan
                    </span>{' '}
                    · Status {errorState.existing.statusAktif}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {registeredDonatur && (
          <div className="mb-6 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-gradient-to-br from-emerald-50/90 to-teal-50/70 dark:from-emerald-950/60 dark:to-teal-950/40 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                  Pendaftaran Donatur Tetap Berhasil Disimpan
                </p>
                <p className="mt-1 text-xs text-emerald-900/85 dark:text-emerald-200/90 leading-relaxed safe-wrap">
                  <strong className="font-semibold">{registeredDonatur.namaLengkap}</strong>
                  {registeredDonatur.jenisKelamin ? ` (${registeredDonatur.jenisKelamin})` : ''} resmi
                  tercatat dengan ID{' '}
                  <span className="font-mono font-semibold">{registeredDonatur.idDonatur}</span> ·
                  WA <span className="font-mono">{registeredDonatur.noWa}</span> · Komitmen{' '}
                  <span className="tabular-nums font-semibold">
                    {formatRupiah(registeredDonatur.nominalKomitmen)}
                  </span>{' '}
                  (Pengingat setiap tanggal {registeredDonatur.tglJatuhTempo}).
                </p>
                {registeredNotif && (
                  <div className="mt-2.5 space-y-1 text-[11px] rounded-xl bg-white/75 dark:bg-slate-900/60 px-3 py-2 border border-emerald-200/70 dark:border-emerald-800/60">
                    <p
                      className={
                        registeredNotif.wa.ok
                          ? 'text-emerald-800 dark:text-emerald-300 font-medium'
                          : 'text-amber-700 dark:text-amber-300'
                      }
                    >
                      Notifikasi WA (Pesan 1):{' '}
                      {registeredNotif.wa.ok
                        ? `Terkirim (Template #${(registeredNotif.wa.templateIndex ?? 0) + 1})`
                        : registeredNotif.wa.detail}
                    </p>
                    {registeredNotif.waFollowup && (
                      <p
                        className={
                          registeredNotif.waFollowup.ok
                            ? 'text-teal-800 dark:text-teal-300 font-medium'
                            : 'text-slate-600 dark:text-slate-300'
                        }
                      >
                        Notifikasi WA (Pesan 2 · Arahan Save Nomor):{' '}
                        {registeredNotif.waFollowup.detail}
                      </p>
                    )}
                    <p
                      className={
                        registeredNotif.email.ok
                          ? 'text-emerald-800 dark:text-emerald-300 font-medium'
                          : 'text-slate-600 dark:text-slate-300'
                      }
                    >
                      Notifikasi Email:{' '}
                      {registeredNotif.email.ok ? 'Terkirim' : registeredNotif.email.detail}
                    </p>
                    {registeredNotif.adminGroup && (
                      <p
                        className={
                          registeredNotif.adminGroup.ok
                            ? 'text-teal-800 dark:text-teal-300 font-medium'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        Notifikasi Grup Admin: {registeredNotif.adminGroup.detail}
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onGoToKonfirmasi(registeredDonatur)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Lanjut Penyaluran Donasi</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  </button>
                  {registeredDonatur.minatGrupWa === 'Ya' && config.waGroupLink && (
                    <a
                      href={config.waGroupLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap"
                    >
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span>Gabung Grup WhatsApp</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="inline-flex items-center rounded-xl border border-emerald-200 dark:border-emerald-700 bg-white/90 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-white dark:hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Daftarkan Donatur Lain
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label
                htmlFor="reg-nama"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Nama Lengkap Donatur <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <input
                ref={namaInputRef}
                id="reg-nama"
                type="text"
                autoCapitalize="words"
                required
                value={namaLengkap}
                onChange={handleNamaChange}
                placeholder="Contoh: Ahmad Fauzi"
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                Otomatis kapital di awal kata, tetap bisa diubah manual lewat keyboard.
              </p>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="reg-wa"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Nomor WhatsApp Aktif <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <input
                id="reg-wa"
                type="tel"
                required
                value={noWaInput}
                onChange={(e) => setNoWaInput(e.target.value)}
                placeholder="081234567890 atau +60123456789"
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              {noWaInput.trim() !== '' ? (
                <p
                  className={`mt-1 text-[11px] font-medium safe-wrap ${
                    waValidation.valid
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {waValidation.valid
                    ? waValidation.isIndonesia
                      ? `Format Indonesia tersimpan: ${waValidation.normalized} (${waValidation.normalized.length} angka)`
                      : `Format Internasional tersimpan: ${waValidation.normalized} (${waValidation.normalized.length} angka)`
                    : waValidation.error}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                  Indonesia tersimpan format 628... (9–15 angka). Nomor luar negeri awali kode
                  negara (+60, +65, dll).
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
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
                      className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-semibold transition-all cursor-pointer select-none ${
                        selected
                          ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                          : 'border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 text-slate-700 dark:text-slate-200 hover:border-emerald-300 dark:hover:border-emerald-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reg-jenis-kelamin"
                        value={opt}
                        checked={selected}
                        onChange={() => setJenisKelamin(opt)}
                        className="sr-only"
                      />
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
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
                htmlFor="reg-email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Alamat Email{' '}
                <span className="font-normal text-slate-400">(Opsional, untuk notif)</span>
              </label>
              <input
                id="reg-email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="nama@email.com"
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="min-w-0">
            <label
              htmlFor="reg-kab"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
            >
              Domisili (Kabupaten / Kota){' '}
              <span className="font-normal text-slate-400">(Opsional)</span>
            </label>
            <SearchableSelect
              id="reg-kab"
              ariaLabel="Pilih kabupaten atau kota domisili"
              options={wilayahOptions}
              value={selectedKabId}
              onChange={(val) => setSelectedKabId(val)}
              allowClear
              placeholder="Cari kabupaten atau kota..."
              searchPlaceholder="Ketik nama kabupaten, kota, atau provinsi..."
              emptyText="Kabupaten/kota tidak ditemukan."
            />
            {selectedWilayah && (
              <p className="mt-1 text-[11px] text-teal-800 dark:text-teal-300 safe-wrap">
                Provinsi {selectedWilayah.prov} · Pulau {selectedWilayah.pulau} (ID{' '}
                <span className="font-mono">{selectedWilayah.kabId}</span>)
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-7 min-w-0">
              <label
                htmlFor="reg-nominal"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Nominal Komitmen Bulanan{' '}
                <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Rp
                </span>
                <input
                  id="reg-nominal"
                  type="text"
                  inputMode="numeric"
                  required
                  value={nominalInput}
                  onChange={(e) => setNominalInput(formatRupiahInput(e.target.value))}
                  placeholder="50.000"
                  className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 pl-11 pr-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {QUICK_NOMINALS.map((opt) => {
                  const isActive = parsedNominal === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNominalInput(opt.value.toLocaleString('id-ID'))}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tabular-nums transition-colors whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 hover:text-emerald-800 dark:hover:text-emerald-200'
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
                htmlFor="reg-tempo"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Tanggal Pengingat Bulanan (1–31){' '}
                <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <SearchableSelect
                id="reg-tempo"
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
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-teal-800 dark:text-teal-300 leading-relaxed safe-wrap">
                <BellRing className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Pengingat dikirim setiap bulan pada tanggal pilihan melalui WhatsApp.
                </span>
              </p>
            </div>
          </div>

          {/* Pilihan Bergabung Grup WhatsApp */}
          <div className="rounded-2xl border border-emerald-200/75 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/25 p-4 space-y-2.5">
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 safe-wrap">
                  Bersedia bergabung ke Grup WhatsApp {waGroupDisplayName}?{' '}
                  <span className="text-rose-600 dark:text-rose-400">*</span>
                </span>
                <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
                  Bila memilih <strong>Ya</strong>, tautan undangan{' '}
                  <strong>Grup WhatsApp {waGroupDisplayName}</strong> akan otomatis dikirimkan
                  bersama pesan notifikasi pendaftaran untuk info penyaluran donasi &amp; kabar
                  dakwah.
                </p>
              </div>
            </div>
            <div
              role="radiogroup"
              aria-label={`Pilihan bergabung Grup WhatsApp ${waGroupDisplayName}`}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
            >
              {(
                [
                  { value: 'Ya', label: 'Ya, Bersedia Bergabung Grup WhatsApp' },
                  { value: 'Tidak', label: 'Tidak, Cukup via Japri WhatsApp' },
                ] as const
              ).map((opt) => {
                const selected = minatGrupWa === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none ${
                      selected
                        ? 'border-emerald-500 bg-white dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-slate-200/90 dark:border-slate-700 bg-white/85 dark:bg-slate-900/75 text-slate-700 dark:text-slate-200 hover:border-emerald-300 dark:hover:border-emerald-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reg-minat-grup"
                      value={opt.value}
                      checked={selected}
                      onChange={() => setMinatGrupWa(opt.value)}
                      className="sr-only"
                    />
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
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

          <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 safe-wrap">
              Data donatur akan tersimpan otomatis sebagai Donatur Tetap Aktif Dakwah Pelosok.
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(5,150,105,0.45)] hover:opacity-95 disabled:opacity-65 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <UserPlus className="h-4 w-4 shrink-0" />
              )}
              <span>{isSubmitting ? 'Menyimpan Data...' : 'Daftarkan Donatur Tetap'}</span>
            </button>
          </div>
        </form>
      </section>

      <aside className="lg:col-span-4 glass-surface rounded-3xl p-6 space-y-6 min-w-0">
        {showRekeningCard && (
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Rekening Resmi
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
          </div>
        )}

        {showQrisCard && (
          <div
            className={`${
              showRekeningCard ? 'pt-5 border-t border-slate-200/70 dark:border-slate-700/70' : ''
            } space-y-3`}
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
                alt="QRIS Resmi"
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

        <div
          className={`${
            showRekeningCard || showQrisCard
              ? 'pt-5 border-t border-slate-200/70 dark:border-slate-700/70'
              : ''
          } space-y-2.5`}
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Komitmen Donatur Tetap
          </h3>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <li>
              Satu nomor WhatsApp berlaku untuk satu profil donatur tetap agar riwayat bulanan
              tertata rapi.
            </li>
            <li>
              Pengingat dikirim secara ramah melalui WhatsApp sesuai tanggal pengingat pilihan
              donatur.
            </li>
            <li>
              Status keaktifan dapat dialihkan sementara ke Non Aktif kapan saja bila sedang
              berhalangan.
            </li>
          </ul>
        </div>
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
