import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  QrCode,
  Upload,
  X,
} from 'lucide-react';
import {
  Donatur,
  LembagaConfig,
  Panitia,
  SubmitPembayaranPayload,
  TransaksiDonasi,
} from '../types';
import {
  formatBulanLabel,
  formatRupiah,
  formatRupiahInput,
  formatWADisplay,
  getCurrentYearMonth,
  getDriveThumbnailFallback,
  normalizeDriveImageUrl,
  normalizeRoleLabel,
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
  panitia: Panitia[];
  preselectedDonatur: Donatur | null;
  onClearPreselected: () => void;
  onSubmitPembayaran: (
    payload: SubmitPembayaranPayload
  ) => Promise<{
    ok: boolean;
    message: string;
    transaksi?: TransaksiDonasi;
    savedFileName?: string;
  }>;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

export const TabKonfirmasi: React.FC<TabKonfirmasiProps> = ({
  config,
  donaturList,
  panitia,
  preselectedDonatur,
  onClearPreselected,
  onSubmitPembayaran,
  onNotify,
}) => {
  const [selectedDonaturId, setSelectedDonaturId] = useState('');
  const [idDonatur, setIdDonatur] = useState('');
  const [namaDonatur, setNamaDonatur] = useState('');
  const [noWaInput, setNoWaInput] = useState('');
  const [bulanTagihan, setBulanTagihan] = useState(getCurrentYearMonth());
  const [nominalInput, setNominalInput] = useState('');
  const [bankTujuan, setBankTujuan] = useState(
    config.infoRekening[0]
      ? `${config.infoRekening[0].bank} - ${config.infoRekening[0].nomor}`
      : 'BSI'
  );
  const [diinputOleh, setDiinputOleh] = useState('Donatur (Mandiri)');

  const [uploadFile, setUploadFile] = useState<ProcessedUploadFile | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    transaksi: TransaksiDonasi;
    savedFileName?: string;
  } | null>(null);
  const [copiedRek, setCopiedRek] = useState<string | null>(null);
  const [showQrisZoom, setShowQrisZoom] = useState(false);
  const [qrisImgSrc, setQrisImgSrc] = useState(() => normalizeDriveImageUrl(config.qrisUrl));

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQrisImgSrc(normalizeDriveImageUrl(config.qrisUrl));
  }, [config.qrisUrl]);

  const bankOptions = useMemo<SearchableOption[]>(() => {
    const list: SearchableOption[] = config.infoRekening.map((r) => {
      const val = `${r.bank} - ${r.nomor}`;
      return {
        value: val,
        label: val,
        sublabel: `a.n. ${r.atasNama}`,
        keywords: `${r.bank} ${r.nomor} ${r.atasNama}`,
      };
    });
    if (config.showQris && config.qrisUrl) {
      const qrisLabel = config.qrisMerchantName
        ? `QRIS (${config.qrisMerchantName})`
        : `QRIS (${config.namaLembaga})`;
      list.push({
        value: qrisLabel,
        label: qrisLabel,
        sublabel: 'Pembayaran Pindai QRIS',
        keywords: 'qris scan qr',
      });
    }
    return list;
  }, [config]);

  useEffect(() => {
    if (bankOptions.length > 0 && !bankOptions.some((b) => b.value === bankTujuan)) {
      setBankTujuan(bankOptions[0].value);
    }
  }, [bankOptions, bankTujuan]);

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

  const penginputOptions = useMemo<SearchableOption[]>(() => {
    const list: SearchableOption[] = [
      {
        value: 'Donatur (Mandiri)',
        label: 'Donatur (Mandiri)',
        sublabel: 'Konfirmasi langsung oleh donatur',
        keywords: 'donatur mandiri langsung',
      },
    ];
    panitia.forEach((p) => {
      const val = `${p.namaPanitia} (${p.kodePanitia})`;
      list.push({
        value: val,
        label: val,
        sublabel: `Peran: ${normalizeRoleLabel(p.role)}`,
        keywords: `${p.namaPanitia} ${p.kodePanitia} ${p.role}`,
      });
    });
    return list;
  }, [panitia]);

  const applySelectedDonatur = (d: Donatur) => {
    setSelectedDonaturId(d.idDonatur);
    setIdDonatur(d.idDonatur);
    setNamaDonatur(d.namaLengkap);
    setNoWaInput(d.noWa);
    setNominalInput(d.nominalKomitmen > 0 ? d.nominalKomitmen.toLocaleString('id-ID') : '');
    setErrorMsg(null);
  };

  useEffect(() => {
    if (preselectedDonatur) {
      applySelectedDonatur(preselectedDonatur);
      onClearPreselected();
    }
  }, [preselectedDonatur, onClearPreselected]);

  const handleDonaturDropdownChange = (val: string) => {
    if (!val) {
      setSelectedDonaturId('');
      setIdDonatur('');
      setNamaDonatur('');
      setNoWaInput('');
      setNominalInput('');
      return;
    }
    const found = donaturList.find((d) => d.idDonatur === val);
    if (found) {
      applySelectedDonatur(found);
    }
  };

  const parsedNominal = useMemo(() => parseRupiahInput(nominalInput), [nominalInput]);

  const autoRenamePreview = useMemo(() => {
    return previewAutoRenameFile({
      bulanTagihan,
      namaDonatur: namaDonatur || 'Nama-Donatur',
      nominalTransfer: parsedNominal,
      extension: uploadFile?.extension || 'jpg',
    });
  }, [bulanTagihan, namaDonatur, parsedNominal, uploadFile]);

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

    if (!namaDonatur.trim()) {
      setErrorMsg('Pilih donatur dari daftar atau isi nama lengkap donatur.');
      return;
    }

    const waCheck = validateAndNormalizeWA(noWaInput);
    if (!waCheck.valid) {
      setErrorMsg(waCheck.error);
      return;
    }

    if (!/^\d{4}-\d{2}$/.test(bulanTagihan)) {
      setErrorMsg('Pilih periode bulan yang valid.');
      return;
    }

    if (parsedNominal <= 0) {
      setErrorMsg('Nominal transfer harus lebih dari Rp 0.');
      return;
    }

    if (!uploadFile) {
      setErrorMsg('Silakan unggah bukti transfer (gambar atau PDF) terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    const res = await onSubmitPembayaran({
      idDonatur: idDonatur || '-',
      namaDonatur: namaDonatur.trim(),
      noWa: waCheck.normalized,
      bulanTagihan,
      nominalTransfer: parsedNominal,
      bankTujuan,
      diinputOleh,
      fileBase64: uploadFile.base64,
      fileMimeType: uploadFile.mimeType,
      fileName: uploadFile.originalName,
    });
    setIsSubmitting(false);

    if (res.ok && res.transaksi) {
      setSuccessInfo({
        transaksi: res.transaksi,
        savedFileName: res.savedFileName,
      });
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
            Cari dan pilih donatur untuk mengisi data otomatis, atau isi langsung bila belum
            terdaftar. Bukti gambar otomatis dikompresi agar unggahan cepat dan ringan.
          </p>
        </div>

        {successInfo && (
          <div className="mb-6 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-gradient-to-br from-emerald-50/90 to-teal-50/70 dark:from-emerald-950/60 dark:to-teal-950/40 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                  Konfirmasi Pembayaran Terkirim
                </p>
                <p className="mt-1 text-xs text-emerald-900/85 dark:text-emerald-200/90 leading-relaxed safe-wrap">
                  ID Transaksi{' '}
                  <span className="font-mono font-semibold">{successInfo.transaksi.idTransaksi}</span>{' '}
                  atas nama <strong>{successInfo.transaksi.namaDonatur}</strong> sebesar{' '}
                  <strong className="tabular-nums">
                    {formatRupiah(successInfo.transaksi.nominalTransfer)}
                  </strong>{' '}
                  untuk periode{' '}
                  <strong>{formatBulanLabel(successInfo.transaksi.bulanTagihan)}</strong> kini
                  berstatus <strong>Menunggu Verifikasi</strong>.
                </p>
                {successInfo.savedFileName && (
                  <p className="mt-2 text-[11px] font-mono text-teal-800 dark:text-teal-300 safe-wrap">
                    Arsip Tersimpan: {successInfo.savedFileName}
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
          <div>
            <label
              htmlFor="konf-search"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
            >
              Pilih Donatur Terdaftar (Nama / No. WA / ID / Domisili)
            </label>
            <SearchableSelect
              id="konf-search"
              ariaLabel="Pilih donatur terdaftar"
              options={donaturOptions}
              value={selectedDonaturId}
              onChange={handleDonaturDropdownChange}
              allowClear
              placeholder="Ketik atau pilih donatur dari daftar..."
              searchPlaceholder="Ketik nama, nomor WA, atau ID donatur..."
              emptyText="Donatur belum ditemukan dalam daftar. Silakan isi data manual di bawah."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="min-w-0">
              <label
                htmlFor="konf-id"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                ID Donatur
              </label>
              <input
                id="konf-id"
                type="text"
                value={idDonatur}
                onChange={(e) => setIdDonatur(e.target.value)}
                placeholder="Otomatis dari pilihan"
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70 px-3.5 py-2.5 text-sm font-mono text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="konf-nama"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Nama Donatur <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <input
                id="konf-nama"
                type="text"
                required
                value={namaDonatur}
                onChange={(e) => setNamaDonatur(e.target.value)}
                placeholder="Nama lengkap donatur"
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="konf-wa"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                No. WhatsApp <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <input
                id="konf-wa"
                type="tel"
                required
                value={noWaInput}
                onChange={(e) => setNoWaInput(e.target.value)}
                placeholder="628... / +60..."
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-3.5 py-2.5 text-sm tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label
                htmlFor="konf-bulan"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Bulan Amanah / Tagihan
              </label>
              <input
                id="konf-bulan"
                type="month"
                required
                value={bulanTagihan}
                onChange={(e) => setBulanTagihan(e.target.value)}
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="konf-nominal"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Nominal Transfer
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
                  onChange={(e) => setNominalInput(formatRupiahInput(e.target.value))}
                  placeholder="50.000"
                  className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 pl-11 pr-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label
                htmlFor="konf-bank"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Tujuan Transfer / Metode
              </label>
              <SearchableSelect
                id="konf-bank"
                ariaLabel="Pilih rekening tujuan atau QRIS"
                options={bankOptions}
                value={bankTujuan}
                onChange={(val) => setBankTujuan(val)}
                placeholder="Pilih rekening atau QRIS..."
                searchPlaceholder="Ketik nama bank, nomor, atau QRIS..."
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="konf-penginput"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Diinput Oleh
              </label>
              <SearchableSelect
                id="konf-penginput"
                ariaLabel="Pilih penginput konfirmasi"
                options={penginputOptions}
                value={diinputOleh}
                onChange={(val) => setDiinputOleh(val || 'Donatur (Mandiri)')}
                placeholder="Pilih penginput..."
                searchPlaceholder="Ketik nama pengurus atau Donatur..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Unggah Bukti Transfer (JPG, PNG, WEBP, atau PDF)
            </label>

            {!uploadFile ? (
              <label
                htmlFor="konf-file"
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200/90 dark:border-emerald-800/80 bg-emerald-50/35 dark:bg-emerald-950/25 px-6 py-8 text-center hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm mb-3">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {isCompressing
                    ? 'Mengompresi gambar bukti transfer...'
                    : 'Pilih atau ketuk untuk unggah bukti transfer'}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md">
                  Gambar otomatis dikompresi ke resolusi optimal (maks. 1280px) agar pengiriman
                  ringan dan cepat.
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
                  <span>Ganti</span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 safe-wrap">
              Nama file otomatis:{' '}
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {autoRenamePreview}
              </span>
            </p>
            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(5,150,105,0.45)] hover:opacity-95 disabled:opacity-55 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span>{isSubmitting ? 'Mengunggah & Menyimpan...' : 'Kirim Konfirmasi Pembayaran'}</span>
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
