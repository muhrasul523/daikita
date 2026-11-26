import React, { useEffect, useState } from 'react';
import {
  BellRing,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  KeyRound,
  Landmark,
  Mail,
  MessageCircle,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Server,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import gasCodeSource from '../../backend/Code.gs?raw';
import {
  DEFAULT_EMAIL_TEMPLATE_DAFTAR,
  DEFAULT_EMAIL_TEMPLATE_REMINDER,
  DEFAULT_WA_FOLLOWUP_TEMPLATES,
  DEFAULT_WA_REMINDER_TEMPLATES,
  DEFAULT_WA_TEMPLATES,
} from '../config';
import {
  EmailTemplateItem,
  LembagaConfig,
  NotifDeliveryResult,
  RekeningInfo,
  SavePengaturanPayload,
  TestNotificationPayload,
} from '../types';
import { isValidGasUrl, pingGasConnection } from '../services/api';
import {
  formatRupiahInput,
  getDriveThumbnailFallback,
  normalizeDriveImageUrl,
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
  onSaveUrl: (newUrl: string) => Promise<void>;
  onSavePengaturan: (payload: SavePengaturanPayload) => Promise<boolean>;
  onTestNotification: (
    payload: TestNotificationPayload
  ) => Promise<{ ok: boolean; message: string; notifStatus?: NotifDeliveryResult }>;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

const TANGGAL_OPTIONS: SearchableOption[] = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: `Setiap tanggal ${i + 1}`,
  keywords: `${i + 1}`,
}));

const TEMPLATE_VARIABLES = [
  '{sapaan}',
  '{nama}',
  '{jenis_kelamin}',
  '{id_donatur}',
  '{domisili}',
  '{nominal}',
  '{tgl_pengingat}',
  '{rekening}',
  '{lembaga}',
  '{link_konfirmasi}',
  '{bulan}',
  '{nama_grup}',
  '{link_grup}',
  '{link_grup_section}',
  '{qris_note}',
];

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, description }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-all cursor-pointer ${
      checked
        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/75 dark:bg-emerald-950/45'
        : 'border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/60'
    }`}
  >
    <div className="min-w-0">
      <p
        className={`text-xs font-bold safe-wrap ${
          checked
            ? 'text-emerald-950 dark:text-emerald-100'
            : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {label}
      </p>
      {description && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
          {description}
        </p>
      )}
    </div>
    <span
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </span>
  </button>
);

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  gasUrl,
  connectionStatus,
  config,
  onSaveUrl,
  onSavePengaturan,
  onTestNotification,
  onNotify,
}) => {
  const [activeSection, setActiveSection] = useState<
    'identitas' | 'rekening' | 'notifikasi' | 'koneksi'
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
  const [showRekening, setShowRekening] = useState<boolean>(config.showRekening !== false);
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

  // State Notifikasi WA (ReChat / MiPos), Grup WA Donatur, Grup WA Admin & Email Alias
  const [enableWaNotif, setEnableWaNotif] = useState<boolean>(config.enableWaNotif);
  const [waEndpointUrl, setWaEndpointUrl] = useState(config.waEndpointUrl);
  const [waApiKey, setWaApiKey] = useState(config.waApiKey || '');
  const [showWaKey, setShowWaKey] = useState(false);
  const [waTemplateSubTab, setWaTemplateSubTab] = useState<'daftar' | 'followup' | 'reminder'>(
    'daftar'
  );
  const [waTemplates, setWaTemplates] = useState<string[]>(config.waTemplates);
  const [waFollowupTemplates, setWaFollowupTemplates] = useState<string[]>(
    config.waFollowupTemplates
  );
  const [waFollowupDelaySec, setWaFollowupDelaySec] = useState<number>(
    config.waFollowupDelaySec || 60
  );
  const [waReminderTemplates, setWaReminderTemplates] = useState<string[]>(
    config.waReminderTemplates
  );
  const [waGroupName, setWaGroupName] = useState(config.waGroupName || '');
  const [waGroupLink, setWaGroupLink] = useState(config.waGroupLink || '');
  const [waGroupId, setWaGroupId] = useState(config.waGroupId || '');

  // State Grup WA Khusus Admin
  const [enableAdminWaGroupNotif, setEnableAdminWaGroupNotif] = useState<boolean>(
    Boolean(config.enableAdminWaGroupNotif)
  );
  const [adminWaGroupName, setAdminWaGroupName] = useState(
    config.adminWaGroupName || 'Grup Admin DAIKITA - Dakwah Pelosok'
  );
  const [adminWaGroupLink, setAdminWaGroupLink] = useState(config.adminWaGroupLink || '');
  const [adminWaGroupId, setAdminWaGroupId] = useState(config.adminWaGroupId || '');
  const [isTestingAdminGroup, setIsTestingAdminGroup] = useState(false);
  const [adminGroupTestDetail, setAdminGroupTestDetail] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // State Email
  const [enableEmailNotif, setEnableEmailNotif] = useState<boolean>(config.enableEmailNotif);
  const [emailSenderAlias, setEmailSenderAlias] = useState(config.emailSenderAlias);
  const [emailSenderName, setEmailSenderName] = useState(config.emailSenderName);
  const [emailTemplateDaftar, setEmailTemplateDaftar] = useState<EmailTemplateItem>(
    config.emailTemplateDaftar || DEFAULT_EMAIL_TEMPLATE_DAFTAR
  );
  const [emailTemplateReminder, setEmailTemplateReminder] = useState<EmailTemplateItem>(
    config.emailTemplateReminder || DEFAULT_EMAIL_TEMPLATE_REMINDER
  );

  // State Uji Kirim Notifikasi Donatur
  const [testWaInput, setTestWaInput] = useState('');
  const [testEmailInput, setTestEmailInput] = useState('');
  const [testMessageType, setTestMessageType] = useState<'daftar' | 'followup' | 'reminder'>(
    'daftar'
  );
  const [isSendingTestNotif, setIsSendingTestNotif] = useState(false);
  const [testNotifResult, setTestNotifResult] = useState<NotifDeliveryResult | null>(null);

  const [isSavingSettings, setIsSavingSettings] = useState(false);

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
    setShowRekening(config.showRekening !== false);
    setQrisUrl(config.qrisUrl || '');
    setQrisPendingUpload(null);
    setQrisMerchantName(config.qrisMerchantName || '');
    setShowQris(config.showQris);
    setDefaultNominalInput((config.defaultNominal || 50000).toLocaleString('id-ID'));
    setDefaultTglPengingat(config.defaultTglPengingat || 5);
    setCatatanPembayaran(config.catatanPembayaran || '');

    setEnableWaNotif(config.enableWaNotif);
    setWaEndpointUrl(config.waEndpointUrl || 'https://www.rechat.id/api/v1/messages');
    setWaApiKey(config.waApiKey || '');
    setWaTemplates(
      config.waTemplates && config.waTemplates.length > 0
        ? [...config.waTemplates]
        : [...DEFAULT_WA_TEMPLATES]
    );
    setWaFollowupTemplates(
      config.waFollowupTemplates && config.waFollowupTemplates.length > 0
        ? [...config.waFollowupTemplates]
        : [...DEFAULT_WA_FOLLOWUP_TEMPLATES]
    );
    setWaFollowupDelaySec(config.waFollowupDelaySec || 60);
    setWaReminderTemplates(
      config.waReminderTemplates && config.waReminderTemplates.length > 0
        ? [...config.waReminderTemplates]
        : [...DEFAULT_WA_REMINDER_TEMPLATES]
    );
    setWaGroupName(config.waGroupName || 'Grup Donatur DAIKITA - Dakwah Pelosok');
    setWaGroupLink(config.waGroupLink || '');
    setWaGroupId(config.waGroupId || '');

    setEnableAdminWaGroupNotif(Boolean(config.enableAdminWaGroupNotif));
    setAdminWaGroupName(config.adminWaGroupName || 'Grup Admin DAIKITA - Dakwah Pelosok');
    setAdminWaGroupLink(config.adminWaGroupLink || '');
    setAdminWaGroupId(config.adminWaGroupId || '');
    setAdminGroupTestDetail(null);

    setEnableEmailNotif(config.enableEmailNotif);
    setEmailSenderAlias(config.emailSenderAlias || 'lajnahdai.dpp@gmail.com');
    setEmailSenderName(config.emailSenderName || 'DAIKITA - Dakwah Pelosok');
    setEmailTemplateDaftar(
      config.emailTemplateDaftar?.subject && config.emailTemplateDaftar?.body
        ? { ...config.emailTemplateDaftar }
        : { ...DEFAULT_EMAIL_TEMPLATE_DAFTAR }
    );
    setEmailTemplateReminder(
      config.emailTemplateReminder?.subject && config.emailTemplateReminder?.body
        ? { ...config.emailTemplateReminder }
        : { ...DEFAULT_EMAIL_TEMPLATE_REMINDER }
    );
    setTestNotifResult(null);
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
      onNotify(
        'info',
        'Logo siap disimpan',
        'Klik "Simpan Pengaturan" agar diterapkan ke seluruh aplikasi.'
      );
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
      onNotify(
        'info',
        'Gambar QRIS siap disimpan',
        'Klik "Simpan Pengaturan" untuk mengaktifkan QRIS.'
      );
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

      const grad = ctx.createLinearGradient(0, 0, 1200, 630);
      grad.addColorStop(0, '#ecfdf5');
      grad.addColorStop(0.55, '#f0fdfa');
      grad.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1200, 630);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.beginPath();
      ctx.roundRect(28, 24, 1144, 582, 36);
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.28)';
      ctx.lineWidth = 3;
      ctx.stroke();

      let titleY = 235;
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
          const maxLogoW = 560;
          const maxLogoH = 295;
          const ratio = Math.min(maxLogoW / img.width, maxLogoH / img.height);
          const w = img.width * ratio;
          const h = img.height * ratio;
          ctx.drawImage(img, (1200 - w) / 2, 44 + (maxLogoH - h) / 2, w, h);
          titleY = 415;
        } catch {
          titleY = 240;
          logoSkippedByCors = true;
        }
      }

      const maxContentW = 1056;
      const titleText = namaLembaga || 'DAIKITA - Dakwah Pelosok';
      let titleSize = activeLogoPreview && !logoSkippedByCors ? 66 : 74;
      ctx.fillStyle = '#065f46';
      ctx.textAlign = 'center';
      while (titleSize > 42) {
        ctx.font = `700 ${titleSize}px Montserrat, sans-serif`;
        if (ctx.measureText(titleText).width <= maxContentW) break;
        titleSize -= 2;
      }
      ctx.fillText(titleText, 600, titleY, maxContentW);

      const tagText = tagline || 'Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah.';
      ctx.fillStyle = '#1e293b';
      const tagSize = activeLogoPreview && !logoSkippedByCors ? 34 : 38;
      ctx.font = `600 ${tagSize}px Montserrat, sans-serif`;

      const words = tagText.trim().split(/\s+/);
      const lines: string[] = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width <= maxContentW || !currentLine) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);

      const lineHeight = tagSize + 12;
      const tagStartY = titleY + (lines.length > 1 ? 58 : 66);
      lines.slice(0, 2).forEach((line, idx) => {
        ctx.fillText(line, 600, tagStartY + idx * lineHeight, maxContentW);
      });

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

    if (showRekening && cleanRekening.length === 0) {
      onNotify('error', 'Minimal satu rekening resmi harus diisi bila tampilan rekening aktif.');
      return;
    }

    const cleanWaTemplates = waTemplates.map((t) => t.trim()).filter(Boolean);
    const cleanFollowupTemplates = waFollowupTemplates.map((t) => t.trim()).filter(Boolean);
    const cleanReminderTemplates = waReminderTemplates.map((t) => t.trim()).filter(Boolean);

    const safeEmailDaftar: EmailTemplateItem =
      emailTemplateDaftar.subject.trim() && emailTemplateDaftar.body.trim()
        ? {
            subject: emailTemplateDaftar.subject.trim(),
            body: emailTemplateDaftar.body.trim(),
          }
        : DEFAULT_EMAIL_TEMPLATE_DAFTAR;

    const safeEmailReminder: EmailTemplateItem =
      emailTemplateReminder.subject.trim() && emailTemplateReminder.body.trim()
        ? {
            subject: emailTemplateReminder.subject.trim(),
            body: emailTemplateReminder.body.trim(),
          }
        : DEFAULT_EMAIL_TEMPLATE_REMINDER;

    setIsSavingSettings(true);
    const ok = await onSavePengaturan({
      namaLembaga: namaLembaga.trim() || 'DAIKITA - Dakwah Pelosok',
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
      showRekening,
      defaultNominal: parseRupiahInput(defaultNominalInput) || 50000,
      defaultTglPengingat,
      catatanPembayaran: catatanPembayaran.trim(),
      infoRekening: cleanRekening,
      enableWaNotif,
      waEndpointUrl: waEndpointUrl.trim() || 'https://www.rechat.id/api/v1/messages',
      waApiKey: waApiKey.trim(),
      waTemplates: cleanWaTemplates.length > 0 ? cleanWaTemplates : DEFAULT_WA_TEMPLATES,
      waFollowupTemplates:
        cleanFollowupTemplates.length > 0
          ? cleanFollowupTemplates
          : DEFAULT_WA_FOLLOWUP_TEMPLATES,
      waFollowupDelaySec: Math.max(10, Math.min(600, Math.round(waFollowupDelaySec || 60))),
      waReminderTemplates:
        cleanReminderTemplates.length > 0
          ? cleanReminderTemplates
          : DEFAULT_WA_REMINDER_TEMPLATES,
      waGroupName: waGroupName.trim() || 'Grup Donatur DAIKITA - Dakwah Pelosok',
      waGroupLink: waGroupLink.trim(),
      waGroupId: waGroupId.trim(),
      enableAdminWaGroupNotif,
      adminWaGroupName: adminWaGroupName.trim() || 'Grup Admin DAIKITA - Dakwah Pelosok',
      adminWaGroupLink: adminWaGroupLink.trim(),
      adminWaGroupId: adminWaGroupId.trim(),
      enableEmailNotif,
      emailSenderAlias: emailSenderAlias.trim() || 'lajnahdai.dpp@gmail.com',
      emailSenderName: emailSenderName.trim() || 'DAIKITA - Dakwah Pelosok',
      emailTemplateDaftar: safeEmailDaftar,
      emailTemplateReminder: safeEmailReminder,
      emailTemplates: [safeEmailDaftar, safeEmailReminder],
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

  const handleCopyVariable = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      onNotify('info', `Variabel ${token} disalin`, 'Tempelkan ke dalam isi template WA/Email.');
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSendTestNotif = async () => {
    if (!testWaInput.trim() && !testEmailInput.trim()) {
      onNotify('error', 'Isi minimal Nomor WA atau Email tujuan pengujian.');
      return;
    }
    setIsSendingTestNotif(true);
    setTestNotifResult(null);
    const res = await onTestNotification({
      noWa: testWaInput.trim(),
      email: testEmailInput.trim(),
      namaLengkap: 'Hamba Allah (Uji Coba)',
      jenisKelamin: 'Laki-laki',
      minatGrupWa: 'Ya',
      messageType: testMessageType,
    });
    setIsSendingTestNotif(false);
    if (res.notifStatus) {
      setTestNotifResult(res.notifStatus);
    }
    if (!res.ok) {
      onNotify('error', 'Uji kirim notifikasi gagal', res.message);
    }
  };

  const handleTestAdminWaGroup = async () => {
    const targetId = adminWaGroupId.trim();
    if (!targetId) {
      onNotify(
        'error',
        'ID Grup WA Admin wajib diisi',
        'Masukkan ID grup format xxxx@g.us (mis. 120363...@g.us) lalu coba lagi.'
      );
      return;
    }
    setIsTestingAdminGroup(true);
    setAdminGroupTestDetail(null);
    const res = await onTestNotification({
      messageType: 'admin_group',
      adminWaGroupId: targetId,
      namaLengkap: 'Uji Koneksi Grup Admin',
    });
    setIsTestingAdminGroup(false);
    const detail = res.notifStatus?.adminGroup?.detail || res.message;
    const ok = Boolean(res.notifStatus?.adminGroup?.ok ?? res.ok);
    setAdminGroupTestDetail({ ok, text: detail });
    if (ok) {
      onNotify('success', 'Pesan uji terkirim ke Grup WA Admin', detail);
    } else {
      onNotify('error', 'Gagal kirim ke Grup WA Admin', detail);
    }
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
      onNotify(
        'success',
        'Skrip server disalin',
        'Tempelkan ke editor skrip lalu terapkan versi baru.'
      );
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      onNotify('error', 'Gagal menyalin otomatis', 'Silakan blok dan salin teks secara manual.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-pengaturan-title"
    >
      <div className="glass-surface w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-200/70 dark:border-slate-700/70">
          <div className="min-w-0">
            <h2
              id="modal-pengaturan-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate"
            >
              Pengaturan Aplikasi (Super Admin)
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
                { key: 'notifikasi', label: 'WA & Email', icon: BellRing },
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
                    placeholder="DAIKITA - Dakwah Pelosok"
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

              {/* Upload Logo */}
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
                  <div className="min-w-0 flex-1 space-y-2 w-full">
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
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50 dark:from-slate-900 dark:to-slate-800 p-5 sm:p-6 text-center space-y-2.5">
                  {activeLogoPreview && (
                    <img
                      src={activeLogoPreview}
                      alt="Logo Preview WA"
                      referrerPolicy="no-referrer"
                      className="h-24 sm:h-28 w-auto mx-auto object-contain"
                    />
                  )}
                  <p className="text-lg sm:text-xl font-bold text-emerald-900 dark:text-emerald-200 safe-wrap">
                    {namaLembaga || 'DAIKITA - Dakwah Pelosok'}
                  </p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 safe-wrap max-w-lg mx-auto">
                    {tagline || 'Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah.'}
                  </p>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
                  Agar gambar pratinjau WhatsApp menampilkan logo resmi Anda secara langsung saat
                  tautan dibagikan, unduh kedua file di bawah setelah memilih file logo lalu simpan
                  menimpa file di folder <code className="font-mono font-semibold">public/</code>.
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
              {/* Kontrol Tampilan Rekening & QRIS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ToggleSwitch
                  checked={showRekening}
                  onChange={setShowRekening}
                  label="Tampilkan Informasi Rekening"
                  description="Tampilkan daftar nomor rekening di halaman pendaftaran & penyaluran donasi."
                />
                <ToggleSwitch
                  checked={showQris}
                  onChange={setShowQris}
                  label="Tampilkan Gambar QRIS"
                  description="Tampilkan QRIS resmi di halaman pendaftaran, penyaluran donasi, & notifikasi."
                />
              </div>

              {/* Daftar Rekening Resmi */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Daftar Rekening Resmi &amp; Pemilik
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                      Status tampilan di web donatur:{' '}
                      <strong className={showRekening ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                        {showRekening ? 'Ditampilkan' : 'Disembunyikan'}
                      </strong>
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
                      className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/85 dark:bg-slate-900/65 p-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
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
                  <span
                    className={`text-[11px] font-semibold ${
                      showQris
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {showQris ? 'Status: Ditampilkan' : 'Status: Disembunyikan'}
                  </span>
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
                      placeholder="Nama Merchant QRIS (mis. DAIKITA - Dakwah Pelosok)"
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

          {activeSection === 'notifikasi' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveAllSettings} className="space-y-6">
                {/* Panel Kontrol Cepat Toggle Notifikasi */}
                <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/70 bg-gradient-to-br from-emerald-50/50 via-teal-50/35 to-sky-50/35 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-sky-950/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <p className="text-xs font-bold text-emerald-950 dark:text-emerald-100">
                      Kontrol Aktif / Nonaktif Notifikasi Otomatis
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <ToggleSwitch
                      checked={enableWaNotif}
                      onChange={setEnableWaNotif}
                      label="Notifikasi WA Donatur"
                      description="Kirim WA otomatis saat daftar & pengingat bulanan."
                    />
                    <ToggleSwitch
                      checked={enableEmailNotif}
                      onChange={setEnableEmailNotif}
                      label="Notifikasi Email Donatur"
                      description="Kirim email otomatis via alias lembaga."
                    />
                    <ToggleSwitch
                      checked={enableAdminWaGroupNotif}
                      onChange={setEnableAdminWaGroupNotif}
                      label="Notifikasi Grup WA Admin"
                      description="Kirim info ke grup admin saat ada pendaftar & konfirmasi."
                    />
                  </div>
                </div>

                {/* Pengaturan API Nomor WA (Gampang Ganti Perangkat/Nomor) */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/65 dark:bg-slate-800/40 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Pengaturan API Nomor WA Pengirim (ReChat / MiPos)
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                        Cukup ubah API Key / Token perangkat di bawah ini kapan saja bila Anda
                        ingin mengganti nomor WA pengirim notifikasi donatur maupun grup admin.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        API Key / Token Perangkat Nomor WA
                      </label>
                      <div className="relative">
                        <input
                          type={showWaKey ? 'text' : 'password'}
                          value={waApiKey}
                          onChange={(e) => setWaApiKey(e.target.value)}
                          placeholder="wag_..."
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3 pr-10 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowWaKey((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          aria-label="Tampilkan atau sembunyikan API Key"
                        >
                          {showWaKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        URL Endpoint API Webhook
                      </label>
                      <input
                        type="url"
                        value={waEndpointUrl}
                        onChange={(e) => setWaEndpointUrl(e.target.value)}
                        placeholder="https://www.rechat.id/api/v1/messages"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Grup WA Khusus Para Admin */}
                <div className="rounded-2xl border border-teal-200/80 dark:border-teal-800/75 bg-teal-50/40 dark:bg-teal-950/25 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldAlert className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-teal-950 dark:text-teal-100">
                          Grup WA Khusus Para Admin (Notifikasi Pendaftar &amp; Penyaluran Donasi)
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 safe-wrap">
                          Setiap ada pendaftar donatur tetap baru atau pengisian konfirmasi
                          penyaluran donasi, sistem otomatis mengirim laporan ringkas ke grup ini.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="min-w-0">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Nama Grup WA Admin
                      </label>
                      <input
                        type="text"
                        value={adminWaGroupName}
                        onChange={(e) => setAdminWaGroupName(e.target.value)}
                        placeholder="Grup Admin DAIKITA - Dakwah Pelosok"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Link Grup WA Admin
                      </label>
                      <input
                        type="url"
                        value={adminWaGroupLink}
                        onChange={(e) => setAdminWaGroupLink(e.target.value)}
                        placeholder="https://chat.whatsapp.com/..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        ID Grup WA Admin (Wajib untuk API)
                      </label>
                      <input
                        type="text"
                        value={adminWaGroupId}
                        onChange={(e) => setAdminWaGroupId(e.target.value)}
                        placeholder="120363...@g.us"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                      Simpan pengaturan dulu setelah mengubah API Key / ID Grup, lalu uji kirim.
                    </p>
                    <button
                      type="button"
                      disabled={isTestingAdminGroup || !adminWaGroupId.trim()}
                      onClick={() => void handleTestAdminWaGroup()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {isTestingAdminGroup ? 'Mengirim ke Grup...' : 'Tes Kirim ke Grup Admin'}
                      </span>
                    </button>
                  </div>

                  {adminGroupTestDetail && (
                    <div
                      className={`rounded-xl px-3 py-2 text-xs font-medium safe-wrap ${
                        adminGroupTestDetail.ok
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {adminGroupTestDetail.text}
                    </div>
                  )}
                </div>

                {/* Variabel Template */}
                <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/70 bg-emerald-50/45 dark:bg-emerald-950/30 p-4 space-y-2">
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Variabel Dinamis &amp; Rotasi Anti-Spam Otomatis
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed safe-wrap">
                    Setiap pendaftaran donatur baru otomatis mengirim notifikasi menggunakan
                    template secara bergantian (Template 1 → 2 → 3 → dst) untuk mengurangi indikasi
                    spam. Klik variabel untuk menyalin:
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {TEMPLATE_VARIABLES.map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => void handleCopyVariable(token)}
                        className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-mono font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pengaturan Grup WA Donatur & Template WA */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Grup WhatsApp Donatur &amp; Template Pesan WA Donatur
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="min-w-0">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Nama Grup WA Donatur
                      </label>
                      <input
                        type="text"
                        value={waGroupName}
                        onChange={(e) => setWaGroupName(e.target.value)}
                        placeholder="Grup Donatur DAIKITA - Dakwah Pelosok"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Link Undangan Grup WA Donatur
                      </label>
                      <input
                        type="url"
                        value={waGroupLink}
                        onChange={(e) => setWaGroupLink(e.target.value)}
                        placeholder="https://chat.whatsapp.com/..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        ID Grup WA Donatur (Opsional)
                      </label>
                      <input
                        type="text"
                        value={waGroupId}
                        onChange={(e) => setWaGroupId(e.target.value)}
                        placeholder="120363...@g.us"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Daftar Template WA — Terpisah 3 Jenis Pesan */}
                  <div className="space-y-3 pt-3 border-t border-slate-200/70 dark:border-slate-700/70">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-200/70 dark:bg-slate-900/70 p-1">
                        {(
                          [
                            {
                              key: 'daftar',
                              label: `Daftar Awal · Pesan 1 (${waTemplates.length})`,
                            },
                            {
                              key: 'followup',
                              label: `Save Nomor · Pesan 2 (${waFollowupTemplates.length})`,
                            },
                            {
                              key: 'reminder',
                              label: `Reminder Bulanan (${waReminderTemplates.length})`,
                            },
                          ] as const
                        ).map((sub) => (
                          <button
                            key={sub.key}
                            type="button"
                            onClick={() => setWaTemplateSubTab(sub.key)}
                            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                              waTemplateSubTab === sub.key
                                ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (waTemplateSubTab === 'daftar') {
                            setWaTemplates((prev) => [
                              ...prev,
                              `Assalamu'alaikum {sapaan} *{nama}*,\nTerima kasih atas komitmen Donatur Tetap Dakwah Pelosok sebesar *{nominal}* (ID: {id_donatur}).\n\n*Rincian Data Donatur*\n• Jenis Kelamin: {jenis_kelamin}\n• Domisili: {domisili}\n\n{rekening}\n{qris_note}\n{link_grup_section}\n_Syukran wa jazakumullahu khairan._`,
                            ]);
                          } else if (waTemplateSubTab === 'followup') {
                            setWaFollowupTemplates((prev) => [
                              ...prev,
                              `Halo {sapaan} *{nama}*, mohon berkenan menyimpan nomor resmi *{lembaga}* ini agar tautan konfirmasi penyaluran donasi dapat diklik langsung dan notifikasi tersampaikan dengan baik.\n{link_grup_section}\n_Syukran wa jazakumullahu khairan._`,
                            ]);
                          } else {
                            setWaReminderTemplates((prev) => [
                              ...prev,
                              `Assalamu'alaikum {sapaan} *{nama}*, mengingatkan komitmen donasi tetap Dakwah Pelosok bulan *{bulan}* sebesar *{nominal}*.\n\n{rekening}\n{qris_note}\nKonfirmasi bukti transfer dapat dikirim melalui web: {link_konfirmasi} atau melalui japri admin via nomor ini.\n\n_Syukran wa jazakumullahu khairan._`,
                            ]);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                        <span>Tambah Variasi</span>
                      </button>
                    </div>

                    {waTemplateSubTab === 'daftar' && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 safe-wrap">
                        Template pendaftaran awal otomatis mengirim gambar QRIS (jika diaktifkan &amp;
                        diunggah di menu Rekening &amp; QRIS) serta link Grup WhatsApp bagi donatur
                        yang bersedia bergabung.
                      </p>
                    )}

                    {waTemplateSubTab === 'followup' && (
                      <div className="rounded-xl border border-teal-200/80 dark:border-teal-800/70 bg-teal-50/50 dark:bg-teal-950/30 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] text-teal-900 dark:text-teal-200 safe-wrap">
                          Pesan 2 otomatis dijadwalkan terkirim setelah Pesan 1 pendaftaran awal
                          (arahan save nomor &amp; link Grup WhatsApp melalui{' '}
                          <code className="font-mono">{'{link_grup_section}'}</code>).
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="text-[11px] font-semibold text-teal-900 dark:text-teal-200">
                            Jeda (detik):
                          </label>
                          <input
                            type="number"
                            min={10}
                            max={600}
                            value={waFollowupDelaySec}
                            onChange={(e) =>
                              setWaFollowupDelaySec(Math.max(10, Number(e.target.value) || 60))
                            }
                            className="w-20 rounded-lg border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    )}

                    {waTemplateSubTab === 'reminder' && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 safe-wrap">
                        Template pengingat bulanan ringkas (tanpa rincian data pendaftaran) dan
                        otomatis melampirkan gambar QRIS melalui WhatsApp &amp; Email apabila QRIS
                        diaktifkan di menu Rekening &amp; QRIS.
                      </p>
                    )}

                    <div className="space-y-3">
                      {(waTemplateSubTab === 'daftar'
                        ? waTemplates
                        : waTemplateSubTab === 'followup'
                        ? waFollowupTemplates
                        : waReminderTemplates
                      ).map((tpl, idx, arr) => (
                        <div
                          key={`${waTemplateSubTab}-${idx}`}
                          className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/70 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                              {waTemplateSubTab === 'daftar'
                                ? `Template Daftar Awal #${idx + 1}`
                                : waTemplateSubTab === 'followup'
                                ? `Template Arahan Save Nomor #${idx + 1}`
                                : `Template Reminder Bulanan #${idx + 1}`}
                            </span>
                            {arr.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (waTemplateSubTab === 'daftar') {
                                    setWaTemplates((prev) => prev.filter((_, i) => i !== idx));
                                  } else if (waTemplateSubTab === 'followup') {
                                    setWaFollowupTemplates((prev) =>
                                      prev.filter((_, i) => i !== idx)
                                    );
                                  } else {
                                    setWaReminderTemplates((prev) =>
                                      prev.filter((_, i) => i !== idx)
                                    );
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>Hapus</span>
                              </button>
                            )}
                          </div>
                          <textarea
                            rows={waTemplateSubTab === 'followup' ? 4 : 6}
                            value={tpl}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (waTemplateSubTab === 'daftar') {
                                setWaTemplates((prev) =>
                                  prev.map((item, i) => (i === idx ? val : item))
                                );
                              } else if (waTemplateSubTab === 'followup') {
                                setWaFollowupTemplates((prev) =>
                                  prev.map((item, i) => (i === idx ? val : item))
                                );
                              } else {
                                setWaReminderTemplates((prev) =>
                                  prev.map((item, i) => (i === idx ? val : item))
                                );
                              }
                            }}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/60 px-3 py-2 text-xs leading-relaxed text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pengaturan Email Alias — 1 Template per Jenis Pesan */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-sky-700 dark:text-sky-400" />
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Notifikasi Email Otomatis (1 Template per Jenis Pesan)
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-semibold ${
                        enableEmailNotif
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {enableEmailNotif ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Email Pengirim (Alias)
                      </label>
                      <input
                        type="email"
                        value={emailSenderAlias}
                        onChange={(e) => setEmailSenderAlias(e.target.value)}
                        placeholder="lajnahdai.dpp@gmail.com"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Nama Pengirim Email
                      </label>
                      <input
                        type="text"
                        value={emailSenderName}
                        onChange={(e) => setEmailSenderName(e.target.value)}
                        placeholder="DAIKITA - Dakwah Pelosok"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 1 Template Email Daftar Awal */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/70 p-3 space-y-2">
                      <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300">
                        Template Email — Notifikasi Daftar Awal (1 Template)
                      </span>
                      <input
                        type="text"
                        value={emailTemplateDaftar.subject}
                        onChange={(e) =>
                          setEmailTemplateDaftar((prev) => ({ ...prev, subject: e.target.value }))
                        }
                        placeholder="Subjek Email Daftar Awal..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                      <textarea
                        rows={6}
                        value={emailTemplateDaftar.body}
                        onChange={(e) =>
                          setEmailTemplateDaftar((prev) => ({ ...prev, body: e.target.value }))
                        }
                        placeholder="Isi Email Daftar Awal..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/60 px-3 py-2 text-xs leading-relaxed text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    {/* 1 Template Email Pengingat Bulanan */}
                    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/70 p-3 space-y-2">
                      <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300">
                        Template Email — Pengingat / Reminder Bulanan (1 Template)
                      </span>
                      <input
                        type="text"
                        value={emailTemplateReminder.subject}
                        onChange={(e) =>
                          setEmailTemplateReminder((prev) => ({ ...prev, subject: e.target.value }))
                        }
                        placeholder="Subjek Email Pengingat Bulanan..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                      <textarea
                        rows={5}
                        value={emailTemplateReminder.body}
                        onChange={(e) =>
                          setEmailTemplateReminder((prev) => ({ ...prev, body: e.target.value }))
                        }
                        placeholder="Isi Email Pengingat Bulanan..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/60 px-3 py-2 text-xs leading-relaxed text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-4 w-4 shrink-0" />
                    <span>
                      {isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan Notifikasi'}
                    </span>
                  </button>
                </div>
              </form>

              {/* Uji Kirim Notifikasi Donatur */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/55 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Uji Kirim Notifikasi WA &amp; Email Donatur
                    </p>
                  </div>
                  <div className="inline-flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                    {(
                      [
                        { key: 'daftar', label: 'Daftar Awal (Pesan 1+2)' },
                        { key: 'followup', label: 'Save Nomor' },
                        { key: 'reminder', label: 'Reminder (+QRIS)' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setTestMessageType(m.key)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                          testMessageType === m.key
                            ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                  <input
                    type="tel"
                    value={testWaInput}
                    onChange={(e) => setTestWaInput(e.target.value)}
                    placeholder="No. WA tujuan tes (mis. 0812...)"
                    className="sm:col-span-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="email"
                    value={testEmailInput}
                    onChange={(e) => setTestEmailInput(e.target.value)}
                    placeholder="Email tujuan tes (mis. nama@gmail.com)"
                    className="sm:col-span-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={isSendingTestNotif}
                    onClick={() => void handleSendTestNotif()}
                    className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5 shrink-0" />
                    <span>{isSendingTestNotif ? 'Mengirim...' : 'Kirim Tes'}</span>
                  </button>
                </div>

                {testNotifResult && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs space-y-1">
                    <p
                      className={
                        testNotifResult.wa.ok
                          ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
                          : 'text-amber-700 dark:text-amber-300'
                      }
                    >
                      WA (Pesan 1): {testNotifResult.wa.detail}
                    </p>
                    {testNotifResult.waFollowup && (
                      <p
                        className={
                          testNotifResult.waFollowup.ok
                            ? 'text-teal-700 dark:text-teal-300 font-semibold'
                            : 'text-slate-600 dark:text-slate-300'
                        }
                      >
                        WA (Pesan 2 · Save Nomor): {testNotifResult.waFollowup.detail}
                      </p>
                    )}
                    <p
                      className={
                        testNotifResult.email.ok
                          ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
                          : 'text-amber-700 dark:text-amber-300'
                      }
                    >
                      Email: {testNotifResult.email.detail}
                    </p>
                  </div>
                )}
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
                    Tautan tersimpan di perangkat ini. Kosongkan bila ingin menjalankan aplikasi
                    dalam Mode Lokal tanpa sinkronisasi daring.
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

              {/* Pengaturan Skrip Server Lanjutan */}
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
