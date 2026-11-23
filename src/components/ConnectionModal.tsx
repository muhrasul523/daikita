import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Landmark,
  Link2,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import gasCodeSource from '../../backend/Code.gs?raw';
import {
  LembagaConfig,
  Panitia,
  RekeningInfo,
  SavePengaturanPayload,
} from '../types';
import { isValidGasUrl, pingGasConnection } from '../services/api';
import {
  buildReferralUrl,
  formatRupiahInput,
  getDriveThumbnailFallback,
  normalizeDriveImageUrl,
  normalizeRoleLabel,
  parseRupiahInput,
} from '../utils/formatters';
import { processBrandingImage } from '../utils/imageCompressor';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  gasUrl: string;
  connectionStatus: 'connected' | 'local' | 'error';
  config: LembagaConfig;
  panitia: Panitia[];
  onSaveUrl: (newUrl: string) => Promise<void>;
  onSavePengaturan: (payload: SavePengaturanPayload) => Promise<boolean>;
  onSavePanitia: (p: Panitia) => Promise<boolean>;
  onDeletePanitia: (kodePanitia: string) => Promise<boolean>;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

const ROLE_OPTIONS: SearchableOption[] = [
  { value: 'Admin', label: 'Admin (Pengurus / Perantara)', keywords: 'admin pengurus panitia' },
  { value: 'Super Admin', label: 'Super Admin', keywords: 'super admin' },
  { value: 'Publik', label: 'Publik', keywords: 'publik donatur' },
];

const TANGGAL_OPTIONS: SearchableOption[] = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: `Setiap tanggal ${i + 1}`,
  keywords: `${i + 1}`,
}));

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  gasUrl,
  connectionStatus,
  config,
  panitia,
  onSaveUrl,
  onSavePengaturan,
  onSavePanitia,
  onDeletePanitia,
  onNotify,
}) => {
  const [activeSection, setActiveSection] = useState<
    'identitas' | 'rekening' | 'pengurus' | 'koneksi'
  >('identitas');

  // State Identitas, Logo & Preview WA
  const [namaLembaga, setNamaLembaga] = useState(config.namaLembaga);
  const [tagline, setTagline] = useState(config.tagline || '');
  const [logoUrl, setLogoUrl] = useState(config.logoUrl || '');
  const [logoPendingUpload, setLogoPendingUpload] = useState<{
    base64: string;
    mimeType: string;
    fileName: string;
  } | null>(null);

  // State Rekening, QRIS & Default Form
  const [infoRekening, setInfoRekening] = useState<RekeningInfo[]>(config.infoRekening);
  const [qrisUrl, setQrisUrl] = useState(config.qrisUrl || '');
  const [qrisPendingUpload, setQrisPendingUpload] = useState<{
    base64: string;
    mimeType: string;
    fileName: string;
  } | null>(null);
  const [qrisMerchantName, setQrisMerchantName] = useState(config.qrisMerchantName || '');
  const [showQris, setShowQris] = useState<boolean>(config.showQris);
  const [defaultNominalInput, setDefaultNominalInput] = useState(
    (config.defaultNominal || 50000).toLocaleString('id-ID')
  );
  const [defaultTglPengingat, setDefaultTglPengingat] = useState<number>(
    config.defaultTglPengingat || 5
  );
  const [catatanPembayaran, setCatatanPembayaran] = useState(config.catatanPembayaran || '');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // State Pengurus & Referral
  const [kodeInput, setKodeInput] = useState('');
  const [namaPanitiaInput, setNamaPanitiaInput] = useState('');
  const [waPanitiaInput, setWaPanitiaInput] = useState('');
  const [rolePanitiaInput, setRolePanitiaInput] = useState('Admin');
  const [isSavingPanitia, setIsSavingPanitia] = useState(false);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // State Koneksi Sinkronisasi
  const [urlInput, setUrlInput] = useState(gasUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [showAdvancedScript, setShowAdvancedScript] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNamaLembaga(config.namaLembaga);
    setTagline(config.tagline || '');
    setLogoUrl(config.logoUrl || '');
    setLogoPendingUpload(null);
    setInfoRekening(
      config.infoRekening.length > 0
        ? config.infoRekening.map((r) => ({ ...r }))
        : [{ bank: '', nomor: '', atasNama: '' }]
    );
    setQrisUrl(config.qrisUrl || '');
    setQrisPendingUpload(null);
    setQrisMerchantName(config.qrisMerchantName || '');
    setShowQris(config.showQris);
    setDefaultNominalInput((config.defaultNominal || 50000).toLocaleString('id-ID'));
    setDefaultTglPengingat(config.defaultTglPengingat || 5);
    setCatatanPembayaran(config.catatanPembayaran || '');
    setUrlInput(gasUrl);
  }, [isOpen, config, gasUrl]);

  if (!isOpen) return null;

  const activeLogoPreview = logoPendingUpload?.base64 || normalizeDriveImageUrl(logoUrl);
  const activeQrisPreview = qrisPendingUpload?.base64 || normalizeDriveImageUrl(qrisUrl);

  const handleSelectLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processBrandingImage(file, 512);
      setLogoPendingUpload({
        base64: processed.base64,
        mimeType: processed.mimeType,
        fileName: processed.originalName,
      });
      onNotify('info', 'Logo siap disimpan', 'Klik "Simpan Pengaturan" agar diterapkan ke seluruh aplikasi.');
    } catch (err) {
      onNotify('error', 'Gagal memproses logo', err instanceof Error ? err.message : undefined);
    }
  };

  const handleSelectQris = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processBrandingImage(file, 1024);
      setQrisPendingUpload({
        base64: processed.base64,
        mimeType: processed.mimeType,
        fileName: processed.originalName,
      });
      setShowQris(true);
      onNotify('info', 'Gambar QRIS siap disimpan', 'Klik "Simpan Pengaturan" untuk mengaktifkan QRIS.');
    } catch (err) {
      onNotify('error', 'Gagal memproses QRIS', err instanceof Error ? err.message : undefined);
    }
  };

  const handleDownloadOgPreview = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Latar belakang soft gradient 2026
      const grad = ctx.createLinearGradient(0, 0, 1200, 630);
      grad.addColorStop(0, '#ecfdf5');
      grad.addColorStop(0.55, '#f0fdfa');
      grad.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1200, 630);

      // Kartu frosted di tengah
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.roundRect(80, 65, 1040, 500, 36);
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Gambar Logo jika ada
      let textStartY = 260;
      let logoSkippedByCors = false;
      if (activeLogoPreview) {
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            if (!activeLogoPreview.startsWith('data:')) {
              image.crossOrigin = 'anonymous';
            }
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Logo tidak dapat dimuat ke kanvas.'));
            image.src = activeLogoPreview;
          });
          const maxLogoH = 160;
          const maxLogoW = 280;
          const ratio = Math.min(maxLogoW / img.width, maxLogoH / img.height);
          const w = img.width * ratio;
          const h = img.height * ratio;
          ctx.drawImage(img, (1200 - w) / 2, 125 + (maxLogoH - h) / 2, w, h);
          textStartY = 345;
        } catch {
          textStartY = 250;
          logoSkippedByCors = true;
        }
      }

      // Nama Aplikasi di bawah logo
      ctx.fillStyle = '#065f46';
      ctx.font = '700 48px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(namaLembaga || "DAIKITA — Kafalah Da'i", 600, textStartY, 940);

      // Tagline di bawah nama aplikasi
      ctx.fillStyle = '#334155';
      ctx.font = '500 26px Montserrat, sans-serif';
      const tag = tagline || 'Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah.';
      ctx.fillText(tag, 600, textStartY + 56, 940);

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'og-preview.png';
      a.click();
      if (logoSkippedByCors) {
        onNotify(
          'info',
          'Preview diunduh tanpa logo',
          'Pilih ulang file logo dari perangkat Anda lalu klik Unduh Preview WA lagi agar logo ikut tergambar.'
        );
      } else {
        onNotify(
          'success',
          'Gambar preview WhatsApp diunduh',
          'Simpan sebagai public/og-preview.png sebelum push ke GitHub.'
        );
      }
    } catch {
      onNotify('error', 'Gagal membuat gambar preview WhatsApp.');
    }
  };

  const handleDownloadFavicon = async () => {
    if (!activeLogoPreview) {
      onNotify('error', 'Unggah logo terlebih dahulu untuk membuat favicon.');
      return;
    }
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        if (!activeLogoPreview.startsWith('data:')) {
          image.crossOrigin = 'anonymous';
        }
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Logo tidak dapat dimuat.'));
        image.src = activeLogoPreview;
      });
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const ratio = Math.min(224 / img.width, 224 / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, (256 - w) / 2, (256 - h) / 2, w, h);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'favicon.png';
      a.click();
      onNotify(
        'success',
        'Favicon PNG diunduh',
        'Simpan sebagai public/favicon.png sebelum push ke GitHub.'
      );
    } catch {
      onNotify(
        'error',
        'Gagal membuat file favicon',
        'Pilih ulang file logo dari perangkat Anda terlebih dahulu lalu unduh favicon.'
      );
    }
  };

  const handleSaveAllSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRekening = infoRekening
      .map((r) => ({
        bank: r.bank.trim(),
        nomor: r.nomor.trim(),
        atasNama: r.atasNama.trim(),
      }))
      .filter((r) => r.bank !== '' && r.nomor !== '');

    if (cleanRekening.length === 0) {
      onNotify('error', 'Minimal satu rekening resmi harus diisi.');
      return;
    }

    setIsSavingSettings(true);
    const ok = await onSavePengaturan({
      namaLembaga: namaLembaga.trim() || "DAIKITA — Kafalah Da'i",
      tagline: tagline.trim(),
      logoUrl,
      logoBase64: logoPendingUpload?.base64,
      logoMimeType: logoPendingUpload?.mimeType,
      logoFileName: logoPendingUpload?.fileName,
      qrisUrl,
      qrisBase64: qrisPendingUpload?.base64,
      qrisMimeType: qrisPendingUpload?.mimeType,
      qrisFileName: qrisPendingUpload?.fileName,
      qrisMerchantName: qrisMerchantName.trim(),
      showQris,
      defaultNominal: parseRupiahInput(defaultNominalInput) || 50000,
      defaultTglPengingat,
      catatanPembayaran: catatanPembayaran.trim(),
      infoRekening: cleanRekening,
    });
    setIsSavingSettings(false);
    if (ok) {
      setLogoPendingUpload(null);
      setQrisPendingUpload(null);
    }
  };

  const handleAddRekeningRow = () => {
    setInfoRekening((prev) => [...prev, { bank: '', nomor: '', atasNama: '' }]);
  };

  const handleUpdateRekeningRow = (idx: number, field: keyof RekeningInfo, val: string) => {
    setInfoRekening((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    );
  };

  const handleRemoveRekeningRow = (idx: number) => {
    setInfoRekening((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSavePanitiaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kodeInput.trim() || !namaPanitiaInput.trim()) {
      onNotify('error', 'Kode dan nama pengurus wajib diisi.');
      return;
    }
    setIsSavingPanitia(true);
    const ok = await onSavePanitia({
      kodePanitia: kodeInput.trim().toUpperCase(),
      namaPanitia: namaPanitiaInput.trim(),
      noWaPanitia: waPanitiaInput.trim(),
      role: rolePanitiaInput,
    });
    setIsSavingPanitia(false);
    if (ok) {
      setKodeInput('');
      setNamaPanitiaInput('');
      setWaPanitiaInput('');
      setRolePanitiaInput('Admin');
    }
  };

  const handleEditPanitiaRow = (p: Panitia) => {
    setKodeInput(p.kodePanitia);
    setNamaPanitiaInput(p.namaPanitia);
    setWaPanitiaInput(p.noWaPanitia);
    setRolePanitiaInput(normalizeRoleLabel(p.role));
  };

  const handleTest = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setTestResult({ ok: false, text: 'Masukkan URL layanan sinkronisasi terlebih dahulu.' });
      return;
    }
    if (!isValidGasUrl(trimmed)) {
      setTestResult({
        ok: false,
        text: 'URL tidak valid. Harus diawali https://script.google.com/ dan diakhiri /exec.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    const res = await pingGasConnection(trimmed);
    setIsTesting(false);

    if (res.status === 'success') {
      setTestResult({
        ok: true,
        text: `Koneksi aktif! Terhubung ke ${res.data?.namaLembaga || 'layanan data'}.`,
      });
    } else {
      setTestResult({
        ok: false,
        text: res.message || 'Tidak dapat menghubungi layanan server.',
      });
    }
  };

  const handleSaveUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (trimmed && !isValidGasUrl(trimmed)) {
      setTestResult({
        ok: false,
        text: 'Format URL tidak valid. Pastikan diakhiri /exec.',
      });
      return;
    }

    setIsSavingUrl(true);
    await onSaveUrl(trimmed);
    setIsSavingUrl(false);
    onClose();
  };

  const handleUseLocalMode = async () => {
    setUrlInput('');
    setTestResult(null);
    setIsSavingUrl(true);
    await onSaveUrl('');
    setIsSavingUrl(false);
    onClose();
  };

  const handleCopyGasCode = async () => {
    try {
      await navigator.clipboard.writeText(gasCodeSource);
      setCopiedCode(true);
      onNotify('success', 'Skrip server disalin', 'Tempelkan ke editor skrip lalu terapkan versi baru.');
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      onNotify('error', 'Gagal menyalin otomatis', 'Silakan blok dan salin teks secara manual.');
    }
  };

  const handleCopyRef = async (kode: string) => {
    const link = buildReferralUrl(kode);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedRef(kode);
      onNotify('success', `Link referral ${kode} disalin`, link);
      setTimeout(() => setCopiedRef(null), 2000);
    } catch {
      onNotify('error', 'Gagal menyalin tautan');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-pengaturan-title"
    >
      <div className="glass-surface w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-200/70 dark:border-slate-700/70">
          <div className="min-w-0">
            <h2
              id="modal-pengaturan-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate"
            >
              Pengaturan Aplikasi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
              Status sinkronisasi:{' '}
              <span
                className={
                  connectionStatus === 'connected'
                    ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                    : connectionStatus === 'error'
                    ? 'font-semibold text-rose-600 dark:text-rose-400'
                    : 'font-semibold text-sky-700 dark:text-sky-400'
                }
              >
                {connectionStatus === 'connected'
                  ? 'Sinkronisasi Aktif'
                  : connectionStatus === 'error'
                  ? 'Koneksi Bermasalah'
                  : 'Mode Lokal (Offline)'}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
            aria-label="Tutup pengaturan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 sm:px-6 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/85 p-1">
            {(
              [
                { key: 'identitas', label: 'Identitas & Logo', icon: ImageIcon },
                { key: 'rekening', label: 'Rekening & QRIS', icon: Landmark },
                { key: 'pengurus', label: 'Pengurus & Link', icon: Users },
                { key: 'koneksi', label: 'Sinkronisasi', icon: Server },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 clean-scroll">
          {activeSection === 'identitas' && (
            <form onSubmit={handleSaveAllSettings} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    Nama Aplikasi / Lembaga
                  </label>
                  <input
                    type="text"
                    value={namaLembaga}
                    onChange={(e) => setNamaLembaga(e.target.value)}
                    placeholder="DAIKITA — Kafalah Da'i"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    Tagline Aplikasi
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Upload Logo Wahdah Islamiyah */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Logo Lembaga (Wahdah Islamiyah)
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                      Ditampilkan di header aplikasi, ikon browser (favicon), dan bahan gambar
                      preview tautan WhatsApp.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer">
                    <Upload className="h-3.5 w-3.5 shrink-0" />
                    <span>Pilih File Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSelectLogo}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="h-20 w-20 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white flex items-center justify-center p-2 shrink-0 overflow-hidden">
                    {activeLogoPreview ? (
                      <img
                        src={activeLogoPreview}
                        alt="Pratinjau Logo Lembaga"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          const fb = getDriveThumbnailFallback(logoUrl);
                          if (fb && target.src !== fb) target.src = fb;
                        }}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[11px] text-slate-400 text-center">Belum ada logo</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => {
                        setLogoUrl(e.target.value);
                        setLogoPendingUpload(null);
                      }}
                      placeholder="Atau tempel tautan gambar logo (https://...)"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                    {activeLogoPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoUrl('');
                          setLogoPendingUpload(null);
                        }}
                        className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        Hapus Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Pratinjau Kartu WhatsApp & Generator File Statis */}
              <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/30 p-4 space-y-3">
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Pratinjau Tautan WhatsApp (Logo + Nama + Tagline)
                </p>
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50 dark:from-slate-900 dark:to-slate-800 p-5 text-center space-y-2">
                  {activeLogoPreview && (
                    <img
                      src={activeLogoPreview}
                      alt="Logo Preview WA"
                      referrerPolicy="no-referrer"
                      className="h-14 w-auto mx-auto object-contain"
                    />
                  )}
                  <p className="text-base font-bold text-emerald-900 dark:text-emerald-200 safe-wrap">
                    {namaLembaga || "DAIKITA — Kafalah Da'i"}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 safe-wrap">
                    {tagline || 'Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah.'}
                  </p>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
                  Agar gambar pratinjau WhatsApp &amp; ikon peramban tampil saat tautan dibagikan,
                  unduh kedua file di bawah setelah mengunggah logo lalu simpan ke folder{' '}
                  <code className="font-mono font-semibold">public/</code> sebelum dikirim ke GitHub.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDownloadOgPreview()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>Unduh Preview WA (og-preview.png)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadFavicon()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>Unduh Favicon (favicon.png)</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-4 w-4 shrink-0" />
                  <span>{isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                </button>
              </div>
            </form>
          )}

          {activeSection === 'rekening' && (
            <form onSubmit={handleSaveAllSettings} className="space-y-5">
              {/* Daftar Rekening Resmi */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Daftar Rekening Resmi &amp; Pemilik
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Otomatis muncul di halaman Pendaftaran, Konfirmasi, dan pesan pengingat WA.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRekeningRow}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>Tambah Rekening</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {infoRekening.map((rek, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/60 p-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                    >
                      <input
                        type="text"
                        value={rek.bank}
                        onChange={(e) => handleUpdateRekeningRow(idx, 'bank', e.target.value)}
                        placeholder="Nama Bank (mis. BSI)"
                        className="sm:col-span-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={rek.nomor}
                        onChange={(e) => handleUpdateRekeningRow(idx, 'nomor', e.target.value)}
                        placeholder="Nomor Rekening"
                        className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={rek.atasNama}
                        onChange={(e) => handleUpdateRekeningRow(idx, 'atasNama', e.target.value)}
                        placeholder="Atas Nama Pemilik"
                        className="sm:col-span-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          disabled={infoRekening.length <= 1}
                          onClick={() => handleRemoveRekeningRow(idx)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 disabled:opacity-30 cursor-pointer"
                          aria-label="Hapus rekening"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pengaturan QRIS */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Gambar QRIS Resmi
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showQris}
                      onChange={(e) => setShowQris(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    <span>Tampilkan QRIS di aplikasi</span>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="h-24 w-24 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                    {activeQrisPreview ? (
                      <img
                        src={activeQrisPreview}
                        alt="Pratinjau QRIS"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          const fb = getDriveThumbnailFallback(qrisUrl);
                          if (fb && target.src !== fb) target.src = fb;
                        }}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[11px] text-slate-400 text-center">Belum ada QRIS</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer">
                        <Upload className="h-3.5 w-3.5 shrink-0" />
                        <span>Unggah File QRIS</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSelectQris}
                          className="sr-only"
                        />
                      </label>
                      {activeQrisPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setQrisUrl('');
                            setQrisPendingUpload(null);
                          }}
                          className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                        >
                          Hapus QRIS
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={qrisMerchantName}
                      onChange={(e) => setQrisMerchantName(e.target.value)}
                      placeholder="Nama Merchant QRIS (mis. DAIKITA Wahdah Islamiyah)"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Pengaturan Operasional Lainnya */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    Nominal Komitmen Default (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={defaultNominalInput}
                    onChange={(e) => setDefaultNominalInput(formatRupiahInput(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    Tanggal Pengingat Default
                  </label>
                  <SearchableSelect
                    ariaLabel="Tanggal pengingat default"
                    options={TANGGAL_OPTIONS}
                    value={String(defaultTglPengingat)}
                    onChange={(val) => {
                      const n = Number(val);
                      if (n >= 1 && n <= 31) setDefaultTglPengingat(n);
                    }}
                    compact
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Catatan Pembayaran (Tampil di Sisi Rekening)
                </label>
                <textarea
                  rows={2}
                  value={catatanPembayaran}
                  onChange={(e) => setCatatanPembayaran(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-4 w-4 shrink-0" />
                  <span>{isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                </button>
              </div>
            </form>
          )}

          {activeSection === 'pengurus' && (
            <div className="space-y-5">
              <form
                onSubmit={handleSavePanitiaSubmit}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3"
              >
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Tambah atau Perbarui Pengurus / Perantara
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={kodeInput}
                    onChange={(e) => setKodeInput(e.target.value.toUpperCase())}
                    placeholder="Kode Pengurus (mis. PNT03)"
                    required
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={namaPanitiaInput}
                    onChange={(e) => setNamaPanitiaInput(e.target.value)}
                    placeholder="Nama Pengurus"
                    required
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="tel"
                    value={waPanitiaInput}
                    onChange={(e) => setWaPanitiaInput(e.target.value)}
                    placeholder="No. WA (mis. 0812...)"
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <SearchableSelect
                    ariaLabel="Pilih peran pengurus"
                    options={ROLE_OPTIONS}
                    value={rolePanitiaInput}
                    onChange={(val) => setRolePanitiaInput(val || 'Admin')}
                    compact
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingPanitia}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>{isSavingPanitia ? 'Menyimpan...' : 'Simpan Pengurus'}</span>
                  </button>
                </div>
              </form>

              <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/50">
                {panitia.map((p) => {
                  const refUrl = buildReferralUrl(p.kodePanitia);
                  const isCopied = copiedRef === p.kodePanitia;
                  return (
                    <div
                      key={p.kodePanitia}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 safe-wrap">
                          {p.namaPanitia}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
                          Kode {p.kodePanitia} · {normalizeRoleLabel(p.role)}
                          {p.noWaPanitia ? ` · ${p.noWaPanitia}` : ''}
                        </p>
                        <p
                          className="text-[11px] text-teal-700 dark:text-teal-400 font-mono mt-1 truncate"
                          title={refUrl}
                        >
                          {refUrl}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditPanitiaRow(p)}
                          className="rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyRef(p.kodePanitia)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5 shrink-0" />
                              <span>Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Link2 className="h-3.5 w-3.5 shrink-0" />
                              <span>Salin Link</span>
                            </>
                          )}
                        </button>
                        <a
                          href={refUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
                          title="Buka tautan referral"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        {panitia.length > 1 && (
                          <button
                            type="button"
                            onClick={() => void onDeletePanitia(p.kodePanitia)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                            title="Hapus pengurus"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeSection === 'koneksi' && (
            <div className="space-y-5">
              <form onSubmit={handleSaveUrlSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="sync-url-input"
                    className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                  >
                    Tautan Layanan Sinkronisasi Data
                  </label>
                  <input
                    id="sync-url-input"
                    type="url"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed safe-wrap">
                    Tautan tersimpan di perangkat ini. Kosongkan bila ingin menjalankan aplikasi dalam
                    Mode Lokal tanpa sinkronisasi daring.
                  </p>
                </div>

                {testResult && (
                  <div
                    className={`rounded-2xl p-3.5 text-xs font-medium leading-relaxed safe-wrap ${
                      testResult.ok
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/80'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200/80 dark:border-rose-800/80'
                    }`}
                  >
                    {testResult.text}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTest}
                      disabled={isTesting}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 shrink-0 ${isTesting ? 'animate-spin' : ''}`}
                      />
                      <span>{isTesting ? 'Menguji...' : 'Uji Koneksi'}</span>
                    </button>
                    {gasUrl && (
                      <button
                        type="button"
                        onClick={handleUseLocalMode}
                        disabled={isSavingUrl}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>Pakai Mode Lokal</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingUrl}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50 transition-all whitespace-nowrap cursor-pointer"
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>{isSavingUrl ? 'Menyimpan...' : 'Simpan & Muat Data'}</span>
                  </button>
                </div>
              </form>

              {/* Pengaturan Skrip Server Lanjutan (Tersembunyi secara default) */}
              <div className="pt-4 border-t border-slate-200/70 dark:border-slate-700/70">
                <button
                  type="button"
                  onClick={() => setShowAdvancedScript((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      showAdvancedScript ? 'rotate-180' : ''
                    }`}
                  />
                  <span>Pengaturan Skrip Server (Lanjutan)</span>
                </button>

                {showAdvancedScript && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400 safe-wrap">
                        Salin skrip terbaru ini saat memperbarui layanan server penyimpanan Anda.
                      </p>
                      <button
                        type="button"
                        onClick={handleCopyGasCode}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap cursor-pointer"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="h-3.5 w-3.5 shrink-0" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 shrink-0" />
                            <span>Salin Skrip Server</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="max-h-64 overflow-auto rounded-2xl bg-slate-950 p-4 text-[11px] leading-relaxed text-emerald-100 font-mono clean-scroll">
                      <code>{gasCodeSource}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
