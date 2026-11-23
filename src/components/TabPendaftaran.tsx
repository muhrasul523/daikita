import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Lock,
  UserPlus,
} from 'lucide-react';
import {
  Donatur,
  LembagaConfig,
  Panitia,
  RegisterDonaturPayload,
} from '../types';
import {
  formatRupiah,
  formatRupiahInput,
  parseRupiahInput,
  validateAndNormalizeWA,
} from '../utils/formatters';

interface TabPendaftaranProps {
  config: LembagaConfig;
  panitia: Panitia[];
  referralCode: string | null;
  onSubmitDonatur: (
    payload: RegisterDonaturPayload
  ) => Promise<{
    ok: boolean;
    message: string;
    donatur?: Donatur;
    existingDonatur?: Partial<Donatur>;
  }>;
  onGoToKonfirmasi: (donatur: Donatur) => void;
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

export const TabPendaftaran: React.FC<TabPendaftaranProps> = ({
  config,
  panitia,
  referralCode,
  onSubmitDonatur,
  onGoToKonfirmasi,
}) => {
  const matchedRefPanitia = useMemo(() => {
    if (!referralCode) return null;
    const upper = referralCode.trim().toUpperCase();
    return (
      panitia.find((p) => p.kodePanitia.trim().toUpperCase() === upper) || {
        kodePanitia: upper,
        namaPanitia: `Panitia (${upper})`,
        noWaPanitia: '',
        role: 'Panitia',
      }
    );
  }, [referralCode, panitia]);

  const isReferralLocked = Boolean(referralCode && matchedRefPanitia);

  const [mode, setMode] = useState<'mandiri' | 'panitia'>('mandiri');
  const [selectedPanitia, setSelectedPanitia] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [noWaInput, setNoWaInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [domisili, setDomisili] = useState('');
  const [programDonasi, setProgramDonasi] = useState(config.daftarProgram[0] || 'Infaq Umum Rutin');
  const [nominalInput, setNominalInput] = useState('50.000');
  const [tglPengingat, setTglPengingat] = useState<number>(5);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorState, setErrorState] = useState<{
    message: string;
    existing?: Partial<Donatur>;
  } | null>(null);
  const [registeredDonatur, setRegisteredDonatur] = useState<Donatur | null>(null);

  // Ref untuk melacak posisi yang baru saja dihapus pengguna agar override manual keyboard tetap dihormati
  const manualOverridePosRef = useRef<number | null>(null);
  const namaInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (config.daftarProgram.length > 0 && !config.daftarProgram.includes(programDonasi)) {
      setProgramDonasi(config.daftarProgram[0]);
    }
  }, [config.daftarProgram, programDonasi]);

  useEffect(() => {
    if (panitia.length > 0 && !selectedPanitia) {
      setSelectedPanitia(panitia[0].namaPanitia);
    }
  }, [panitia, selectedPanitia]);

  const waValidation = useMemo(() => validateAndNormalizeWA(noWaInput), [noWaInput]);
  const parsedNominal = useMemo(() => parseRupiahInput(nominalInput), [nominalInput]);

  /**
   * Auto-kapital di awal setiap kata saat mengetik normal, namun tetap menghormati
   * pengaturan manual keyboard pengguna (misal hapus & ketik huruf kecil untuk "bin", "dr.", dll).
   */
  const handleNamaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const prev = namaLengkap;
    let next = e.target.value;
    const cursor = e.target.selectionStart ?? next.length;

    if (next.length < prev.length) {
      // Pengguna menghapus karakter -> tandai posisi kursor agar huruf berikutnya tidak dipaksa kapital
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
          // Pengguna baru saja menghapus huruf kapital di posisi ini -> biarkan sesuai ketikan manual
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

  const handleNominalChange = (val: string) => {
    setNominalInput(formatRupiahInput(val));
  };

  const handleResetForm = () => {
    setNamaLengkap('');
    setNoWaInput('');
    setEmailInput('');
    setDomisili('');
    setNominalInput('50.000');
    setTglPengingat(5);
    setErrorState(null);
    setRegisteredDonatur(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorState(null);

    if (!namaLengkap.trim()) {
      setErrorState({ message: 'Nama lengkap donatur wajib diisi.' });
      return;
    }

    if (!waValidation.valid) {
      setErrorState({ message: waValidation.error });
      return;
    }

    const trimmedEmail = emailInput.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorState({ message: 'Format alamat email tidak valid. Kosongkan jika tidak ingin mengisi email.' });
      return;
    }

    if (parsedNominal < 1000) {
      setErrorState({ message: 'Nominal komitmen minimal Rp 1.000.' });
      return;
    }

    if (tglPengingat < 1 || tglPengingat > 31) {
      setErrorState({ message: 'Tanggal pengingat rutin wajib antara tanggal 1 hingga 31.' });
      return;
    }

    if (!isReferralLocked && mode === 'panitia' && !selectedPanitia) {
      setErrorState({ message: 'Pilih nama panitia atau admin yang mendaftarkan.' });
      return;
    }

    const metodeDaftar = isReferralLocked
      ? 'Mandiri (Referral)'
      : mode === 'panitia'
      ? 'Via Panitia'
      : 'Mandiri';

    const namaPerantara = isReferralLocked
      ? matchedRefPanitia!.namaPanitia
      : mode === 'panitia'
      ? selectedPanitia
      : 'Langsung (Tanpa Perantara)';

    setIsSubmitting(true);
    const res = await onSubmitDonatur({
      namaLengkap: namaLengkap.trim(),
      noWa: waValidation.normalized,
      email: trimmedEmail,
      domisili: domisili.trim(),
      programDonasi,
      nominalKomitmen: parsedNominal,
      tglJatuhTempo: tglPengingat,
      metodeDaftar,
      namaPerantara,
    });
    setIsSubmitting(false);

    if (res.ok && res.donatur) {
      setRegisteredDonatur(res.donatur);
      setNamaLengkap('');
      setNoWaInput('');
      setEmailInput('');
      setDomisili('');
    } else {
      setErrorState({
        message: res.message,
        existing: res.existingDonatur,
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Registration Form */}
      <section className="lg:col-span-8 glass-surface rounded-3xl p-5 sm:p-8 min-w-0">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Pendaftaran Donatur Rutin
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Catat komitmen amal rutin bersama{' '}
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              {config.namaLembaga}
            </span>
            . Bidang wajib: <strong>Nama</strong>, <strong>No. WA</strong>, <strong>Nominal Komitmen</strong>, dan <strong>Tanggal Pengingat Rutin</strong>.
          </p>
        </div>

        {/* Referral Lock Notice OR Mode Selector */}
        {isReferralLocked && matchedRefPanitia ? (
          <div className="mb-6 rounded-2xl border border-emerald-200/90 dark:border-emerald-800/80 bg-emerald-50/75 dark:bg-emerald-950/50 p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 safe-wrap">
                Tautan Referral Panitia Aktif
              </p>
              <p className="mt-0.5 text-xs text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed safe-wrap">
                Metode pendaftaran otomatis tercatat sebagai <strong>Mandiri (Referral)</strong> melalui perantara{' '}
                <strong>{matchedRefPanitia.namaPanitia}</strong> (Kode {matchedRefPanitia.kodePanitia}).
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              Mode Pendaftaran
            </label>
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 p-1.5">
              <button
                type="button"
                onClick={() => setMode('mandiri')}
                className={`rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  mode === 'mandiri'
                    ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Daftar Mandiri
              </button>
              <button
                type="button"
                onClick={() => setMode('panitia')}
                className={`rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  mode === 'panitia'
                    ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Via Panitia / Admin
              </button>
            </div>
          </div>
        )}

        {/* Duplicate / Validation Error Banner */}
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
                    {errorState.existing.programDonasi} ·{' '}
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

        {/* Success Confirmation Card */}
        {registeredDonatur && (
          <div className="mb-6 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-gradient-to-br from-emerald-50/90 to-teal-50/70 dark:from-emerald-950/60 dark:to-teal-950/40 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                  Pendaftaran Donatur Berhasil Disimpan
                </p>
                <p className="mt-1 text-xs text-emerald-900/85 dark:text-emerald-200/90 leading-relaxed safe-wrap">
                  <strong className="font-semibold">{registeredDonatur.namaLengkap}</strong> resmi tercatat dengan ID{' '}
                  <span className="font-mono font-semibold">{registeredDonatur.idDonatur}</span> · WA{' '}
                  <span className="font-mono">{registeredDonatur.noWa}</span> · Komitmen{' '}
                  <span className="tabular-nums font-semibold">
                    {formatRupiah(registeredDonatur.nominalKomitmen)}
                  </span>{' '}
                  (Pengingat rutin setiap tanggal {registeredDonatur.tglJatuhTempo}).
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onGoToKonfirmasi(registeredDonatur)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Lanjut Konfirmasi Pembayaran</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  </button>
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
          {!isReferralLocked && mode === 'panitia' && (
            <div>
              <label
                htmlFor="reg-panitia"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Nama Panitia / Perantara
              </label>
              <select
                id="reg-panitia"
                value={selectedPanitia}
                onChange={(e) => setSelectedPanitia(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {panitia.map((p) => (
                  <option key={p.kodePanitia} value={p.namaPanitia}>
                    {p.namaPanitia} ({p.kodePanitia} - {p.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Nama Lengkap (Wajib) & Nomor WA (Wajib) */}
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
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Otomatis huruf kapital di awal kata, tetap bisa diubah manual lewat keyboard.
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
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Indonesia tersimpan format 628... (9–15 angka). Nomor luar negeri awali kode negara (+60, +65, dll).
                </p>
              )}
            </div>
          </div>

          {/* Email (Opsional) & Domisili (Opsional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label
                htmlFor="reg-email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Alamat Email <span className="font-normal text-slate-400">(Opsional)</span>
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

            <div className="min-w-0">
              <label
                htmlFor="reg-domisili"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Domisili / Kota <span className="font-normal text-slate-400">(Opsional)</span>
              </label>
              <input
                id="reg-domisili"
                type="text"
                value={domisili}
                onChange={(e) => setDomisili(e.target.value)}
                placeholder="Contoh: Bandung Barat"
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Program Donasi */}
          <div>
            <label
              htmlFor="reg-program"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
            >
              Program Donasi Rutin <span className="font-normal text-slate-400">(Opsional)</span>
            </label>
            <select
              id="reg-program"
              value={programDonasi}
              onChange={(e) => setProgramDonasi(e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {config.daftarProgram.map((prog) => (
                <option key={prog} value={prog}>
                  {prog}
                </option>
              ))}
            </select>
          </div>

          {/* Nominal Komitmen (Wajib) & Tanggal Pengingat Rutin (Wajib) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-7 min-w-0">
              <label
                htmlFor="reg-nominal"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Nominal Komitmen Bulanan <span className="text-rose-600 dark:text-rose-400">*</span>
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
                  onChange={(e) => handleNominalChange(e.target.value)}
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
                Tanggal Pengingat Rutin (1–31) <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <select
                id="reg-tempo"
                required
                value={tglPengingat}
                onChange={(e) => setTglPengingat(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    Setiap tanggal {day}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-teal-800 dark:text-teal-300 leading-relaxed">
                <BellRing className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Anda akan diingatkan secara rutin setiap bulan pada tanggal pilihan ini melalui WhatsApp.
                </span>
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 safe-wrap">
              Tersimpan ke tab <span className="font-mono text-slate-700 dark:text-slate-300">Master_Donatur</span> dengan status awal Aktif.
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(5,150,105,0.45)] hover:opacity-95 disabled:opacity-55 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              <span>{isSubmitting ? 'Menyimpan Data...' : 'Daftarkan Donatur'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Side Summary & Official Accounts */}
      <aside className="lg:col-span-4 glass-surface rounded-3xl p-6 space-y-6 min-w-0">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Rekening Resmi {config.namaLembaga}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Penyaluran amanah infak rutin hanya melalui rekening resmi berikut.
          </p>
          <div className="mt-4 divide-y divide-slate-200/70 dark:divide-slate-700/70">
            {config.infoRekening.map((rek) => (
              <div key={`${rek.bank}-${rek.nomor}`} className="py-3 first:pt-0 last:pb-0">
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 safe-wrap">
                  {rek.bank}
                </p>
                <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight safe-wrap">
                  {rek.nomor}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 safe-wrap">
                  a.n. {rek.atasNama}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-5 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2.5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Komitmen Amanah Rutin
          </h3>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <li>Satu nomor WhatsApp berlaku untuk satu profil donatur agar riwayat bulanan tetap tertata rapi.</li>
            <li>Pengingat dikirim secara ramah melalui WhatsApp sesuai tanggal pengingat rutin pilihan Anda.</li>
            <li>Status keaktifan dapat dialihkan sementara ke Cuti kapan saja apabila sedang berhalangan.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
};
