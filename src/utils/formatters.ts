import { APP_PUBLIC_URL, DEFAULT_WA_REMINDER_TEMPLATES } from '../config';
import {
  Donatur,
  LembagaConfig,
  MinatGrupWa,
  RekeningInfo,
  StatusGrupWa,
  TransaksiDonasi,
} from '../types';

const BULAN_INDO = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export interface WaValidationResult {
  valid: boolean;
  normalized: string;
  isIndonesia: boolean;
  error: string;
}

/**
 * Validasi & normalisasi nomor WhatsApp (Indonesia & Internasional):
 * - Nomor Indonesia (awalan 08, 628, +628, 00628, 6208, atau 8... tanpa '+'):
 *   disimpan sebagai format "628..." dengan panjang 9 sampai 15 angka termasuk 628.
 * - Nomor Internasional (mis. +60..., +65..., +966..., +81..., 6012...):
 *   disimpan sebagai angka kode negara + nomor (7 sampai 15 angka, tanpa awalan 0).
 */
export function validateAndNormalizeWA(raw: string): WaValidationResult {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      normalized: '',
      isIndonesia: false,
      error: 'Nomor WhatsApp wajib diisi.',
    };
  }

  const hasExplicitPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return {
      valid: false,
      normalized: '',
      isIndonesia: false,
      error: 'Nomor WhatsApp hanya boleh berisi angka.',
    };
  }

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('6208')) {
    digits = '628' + digits.slice(4);
  } else if (!hasExplicitPlus && digits.startsWith('08')) {
    digits = '62' + digits.slice(1);
  } else if (!hasExplicitPlus && digits.startsWith('8')) {
    digits = '62' + digits;
  }

  if (digits.startsWith('628')) {
    if (digits.length < 9 || digits.length > 15) {
      return {
        valid: false,
        normalized: digits,
        isIndonesia: true,
        error: `Nomor WA Indonesia (628...) harus 9–15 angka termasuk 628 (saat ini ${digits.length} angka).`,
      };
    }
    return {
      valid: true,
      normalized: digits,
      isIndonesia: true,
      error: '',
    };
  }

  if (digits.startsWith('62') && !digits.startsWith('628')) {
    return {
      valid: false,
      normalized: digits,
      isIndonesia: true,
      error: 'Nomor WA Indonesia harus berformat 628... (contoh: 08123456789 → 628123456789).',
    };
  }

  if (digits.startsWith('0')) {
    return {
      valid: false,
      normalized: digits,
      isIndonesia: false,
      error: 'Untuk nomor luar Indonesia, awali dengan kode negara (contoh: +60..., +65..., +966...).',
    };
  }

  if (digits.length < 7 || digits.length > 15) {
    return {
      valid: false,
      normalized: digits,
      isIndonesia: false,
      error: `Nomor WA internasional harus 7–15 angka termasuk kode negara (saat ini ${digits.length} angka).`,
    };
  }

  return {
    valid: true,
    normalized: digits,
    isIndonesia: false,
    error: '',
  };
}

export function normalizeWA(raw: string): string {
  const res = validateAndNormalizeWA(raw);
  return res.valid ? res.normalized : '';
}

export function formatWADisplay(wa: string): string {
  const clean = normalizeWA(wa) || String(wa || '').replace(/\D/g, '');
  if (!clean) return '-';
  if (clean.startsWith('62') && clean.length >= 9) {
    return `+${clean.slice(0, 2)} ${clean.slice(2, 5)}-${clean.slice(5, 9)}${clean.length > 9 ? '-' + clean.slice(9) : ''}`;
  }
  return `+${clean}`;
}

export function normalizeRoleLabel(role: string): 'Super Admin' | 'Admin' | 'Publik' {
  const clean = String(role || '').trim().toLowerCase();
  if (clean === 'super admin' || clean === 'superadmin') return 'Super Admin';
  if (clean === 'publik' || clean === 'public') return 'Publik';
  return 'Admin';
}

export function normalizeMinatGrup(raw?: string): MinatGrupWa {
  const clean = String(raw || '').trim().toLowerCase();
  if (clean === 'tidak' || clean === 'no' || clean === 'false' || clean === '0') {
    return 'Tidak';
  }
  return 'Ya';
}

export function normalizeStatusGrup(raw?: string): StatusGrupWa {
  const clean = String(raw || '').trim().toLowerCase();
  if (
    clean === 'sudah bergabung' ||
    clean === 'sudah' ||
    clean === 'joined' ||
    clean === 'ya' ||
    clean === 'true'
  ) {
    return 'Sudah Bergabung';
  }
  return 'Belum Bergabung';
}

export function extractDriveFileId(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const pathMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];
  const queryMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];
  const lhMatch = raw.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lhMatch) return lhMatch[1];
  return '';
}

export function normalizeDriveImageUrl(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:')) return raw;
  const fileId = extractDriveFileId(raw);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  return raw;
}

export function getDriveThumbnailFallback(url: string): string {
  const fileId = extractDriveFileId(url);
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
  }
  return url;
}

export function formatRupiah(amount: number): string {
  const num = Number.isFinite(amount) ? Math.round(amount) : 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

export function formatRupiahInput(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('id-ID');
}

export function parseRupiahInput(raw: string): number {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

export function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function extractIsoDateFromDateStr(raw?: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  return '';
}

export function extractYearMonthFromDateStr(raw?: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}`;
  }
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  }
  return '';
}

export function formatTanggalIndo(isoDate?: string): string {
  const iso = extractIsoDateFromDateStr(isoDate);
  if (!iso) return isoDate || '-';
  const [y, m, d] = iso.split('-');
  const monthName = BULAN_INDO[Number(m) - 1] || m;
  return `${Number(d)} ${monthName.slice(0, 3)} ${y}`;
}

export function getAdjacentYearMonth(ym: string, offsetMonths: number): string {
  const match = String(ym || '').match(/^(\d{4})-(\d{2})$/);
  const baseYear = match ? Number(match[1]) : new Date().getFullYear();
  const baseMonthIdx = match ? Number(match[2]) - 1 : new Date().getMonth();
  const d = new Date(baseYear, baseMonthIdx + offsetMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function buildMonthSequence(startYm: string, count: number): string[] {
  const safeCount = Math.max(1, Math.min(24, Math.floor(count)));
  return Array.from({ length: safeCount }, (_, i) => getAdjacentYearMonth(startYm, i));
}

export function formatBulanLabel(ym: string): string {
  const match = String(ym || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return ym || '-';
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const monthName = BULAN_INDO[monthIdx] || match[2];
  return `${monthName} ${year}`;
}

export function formatBulanShortLabel(ym: string): string {
  const match = String(ym || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return ym || '-';
  const monthIdx = Number(match[2]) - 1;
  const monthName = BULAN_INDO[monthIdx] || match[2];
  return `${monthName.slice(0, 3)} ${match[1].slice(-2)}`;
}

export function sanitizeDonorNameForFile(name: string): string {
  const cleaned = String(name || 'Donatur')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
  return cleaned || 'Donatur';
}

export function previewAutoRenameFile(params: {
  tanggalTransfer?: string;
  bulanTagihan: string;
  bulanList?: string[];
  namaDonatur: string;
  nominalTransfer: number;
  extension: string;
}): string {
  const datePart = extractIsoDateFromDateStr(params.tanggalTransfer) || getTodayIsoDate();
  const list = Array.isArray(params.bulanList) ? params.bulanList.filter(Boolean) : [];
  const bulan =
    list.length > 1
      ? `${list[0]}-sd-${list[list.length - 1]}`
      : list[0] || params.bulanTagihan || getCurrentYearMonth();
  const nama = sanitizeDonorNameForFile(params.namaDonatur || 'Nama-Donatur');
  const nominal = Math.round(params.nominalTransfer || 0);
  const ext = params.extension || 'jpg';
  return `${datePart}_${bulan}_${nama}_${nominal}.${ext}`;
}

export function formatRekeningLines(rekening: RekeningInfo[]): string {
  if (!rekening || rekening.length === 0) {
    return 'BSI (Bank Syariah Indonesia): *7777767407* a.n. LAJNAH DAI';
  }
  return rekening
    .map((r) => `${r.bank}: *${r.nomor}* a.n. ${r.atasNama}`)
    .join('\n');
}

export function normalizeJenisKelamin(raw?: string): 'Laki-laki' | 'Perempuan' | '' {
  const clean = String(raw || '').trim().toLowerCase();
  if (clean === 'laki-laki' || clean === 'l' || clean === 'pria' || clean === 'ikhwan') {
    return 'Laki-laki';
  }
  if (clean === 'perempuan' || clean === 'p' || clean === 'wanita' || clean === 'akhwat') {
    return 'Perempuan';
  }
  return '';
}

export function getSapaanByGender(raw?: string): string {
  const jk = normalizeJenisKelamin(raw);
  if (jk === 'Laki-laki') return 'Bapak';
  if (jk === 'Perempuan') return 'Ibu';
  return 'Bapak/Ibu';
}

/**
 * Render template pesan WA / Email dengan seluruh variabel donatur & konfigurasi
 */
export function renderMessageTemplate(
  templateStr: string,
  donatur: Partial<Donatur>,
  config: LembagaConfig,
  options?: { bulanTagihan?: string; includeGroupLink?: boolean }
): string {
  const jk = normalizeJenisKelamin(donatur.jenisKelamin);
  const sapaan = getSapaanByGender(jk);
  const wilayahParts = [donatur.domisili, donatur.provinsi].filter(Boolean);
  const domisiliLabel = wilayahParts.length > 0 ? wilayahParts.join(', ') : '-';
  const portalUrl =
    APP_PUBLIC_URL ||
    (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');

  const bulanYm = options?.bulanTagihan || getCurrentYearMonth();
  const bulanLabel = formatBulanLabel(bulanYm);
  const groupLink = (config.waGroupLink || '').trim();
  const groupName = (config.waGroupName || 'Grup Donatur DAIKITA').trim();
  const shouldIncludeGroup =
    options?.includeGroupLink !== undefined
      ? options.includeGroupLink
      : normalizeMinatGrup(donatur.minatGrupWa) === 'Ya';

  const linkGrupSection =
    shouldIncludeGroup && groupLink
      ? `\nSilakan bergabung ke *${groupName}* melalui tautan berikut:\n${groupLink}\n`
      : '';

  const qrisNote =
    config.showQris && config.qrisUrl
      ? 'Pembayaran juga dapat melalui QRIS resmi terlampir atau di web konfirmasi.'
      : '';

  const vars: Record<string, string> = {
    '{nama}': donatur.namaLengkap || 'Sahabat Kebaikan',
    '{sapaan}': sapaan,
    '{jenis_kelamin}': jk || '-',
    '{id_donatur}': donatur.idDonatur || '-',
    '{no_wa}': donatur.noWa || '-',
    '{domisili}': domisiliLabel,
    '{nominal}': formatRupiah(donatur.nominalKomitmen || 0),
    '{tgl_pengingat}': String(donatur.tglJatuhTempo || config.defaultTglPengingat || 5),
    '{perantara}': donatur.namaPerantara || 'Langsung (Tanpa Perantara)',
    '{lembaga}': config.namaLembaga || 'DAIKITA — Kafalah Dai',
    '{rekening}': formatRekeningLines(config.infoRekening),
    '{link_konfirmasi}': portalUrl,
    '{bulan}': bulanLabel,
    '{link_grup}': groupLink || '-',
    '{nama_grup}': groupName,
    '{link_grup_section}': linkGrupSection,
    '{qris_note}': qrisNote,
  };

  let out = String(templateStr || '');
  Object.keys(vars).forEach((token) => {
    out = out.split(token).join(vars[token]);
  });

  // Rapikan baris kosong berlebih (> 2 baris kosong berturut-turut)
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function buildWaMeUrl(noWa: string, messageText: string): string {
  const wa = normalizeWA(noWa) || String(noWa || '').replace(/\D/g, '');
  return `https://wa.me/${wa}?text=${encodeURIComponent(messageText)}`;
}

/**
 * Membangun Smart Link wa.me untuk pengingat donasi Kafalah Dai rutin
 * Menggunakan template pengingat dari Pengaturan (tanpa rincian data daftar)
 */
export function buildReminderWaLink(
  donatur: Donatur,
  bulanTagihan: string,
  config: LembagaConfig,
  templateIndex = 0
): string {
  const templates =
    config.waReminderTemplates && config.waReminderTemplates.length > 0
      ? config.waReminderTemplates
      : DEFAULT_WA_REMINDER_TEMPLATES;
  const tpl = templates[Math.abs(templateIndex) % templates.length];
  const message = renderMessageTemplate(tpl, donatur, config, {
    bulanTagihan,
    includeGroupLink: false,
  });
  return buildWaMeUrl(donatur.noWa, message);
}

/**
 * Membangun teks undangan Grup WhatsApp Donatur
 */
export function buildGroupInviteMessage(donatur: Donatur, config: LembagaConfig): string {
  const sapaan = getSapaanByGender(donatur.jenisKelamin);
  const groupName = config.waGroupName || 'Grup Donatur DAIKITA — Kafalah Dai';
  const groupLink = config.waGroupLink || '(Link grup belum diatur di Pengaturan)';
  return [
    `Assalamu'alaikum Warahmatullahi Wabarakatuh ${sapaan} *${donatur.namaLengkap}*.`,
    ``,
    `Terima kasih atas partisipasi ${sapaan} sebagai Donatur Rutin *Kafalah Dai* di *${config.namaLembaga}*.`,
    `Silakan bergabung ke *${groupName}* untuk mendapatkan info penyaluran & kabar dakwah para dai melalui tautan berikut:`,
    groupLink,
    ``,
    `_Syukran wa jazakumullahu khairan._`,
    `_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._`,
    `_Aamiin._`,
  ].join('\n');
}

/**
 * Membangun Smart Link wa.me untuk kuitansi / ucapan terima kasih setelah validasi
 */
export function buildReceiptWaLink(
  trx: TransaksiDonasi,
  config: LembagaConfig
): string {
  const wa = normalizeWA(trx.noWa) || String(trx.noWa || '').replace(/\D/g, '');
  const bulanLabel = formatBulanLabel(trx.bulanTagihan);
  const donasiKomitmen =
    trx.nominalKomitmen > 0 ? trx.nominalKomitmen : trx.nominalTransfer;
  const donasiLainnya = Math.max(0, trx.donasiLainnya || 0);

  const lines = [
    `Assalamu'alaikum Warahmatullahi Wabarakatuh,`,
    ``,
    `Alhamdulillah, terima kasih Bapak/Ibu *${trx.namaDonatur}*.`,
    `Donasi Kafalah Dai Anda telah kami terima dan *TERVERIFIKASI VALID* oleh *${config.namaLembaga}*.`,
    ``,
    `*RINGKASAN KUITANSI DONASI*`,
    `• No. Transaksi: ${trx.idTransaksi}`,
    trx.tanggalTransfer ? `• Tanggal Transfer: ${formatTanggalIndo(trx.tanggalTransfer)}` : '',
    `• Periode Donasi: ${bulanLabel}`,
    `• Donasi Komitmen: *${formatRupiah(donasiKomitmen)}*`,
    donasiLainnya > 0 ? `• Donasi Lainnya: *${formatRupiah(donasiLainnya)}*` : '',
    `• Total Diterima: *${formatRupiah(trx.nominalTransfer)}*`,
    trx.keterangan ? `• Keterangan: ${trx.keterangan}` : '',
    `• Status Verifikasi: Valid / Lunas`,
    `• Status Penyaluran: ${trx.statusPenyaluran || 'Belum Disalurkan'}`,
    ``,
    `_Syukran wa jazakumullahu khairan._`,
    `_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._`,
    `_Aamiin._`,
    ``,
    `Wassalamu'alaikum Warahmatullahi Wabarakatuh.`,
  ].filter((line, idx, arr) => {
    if (line === '' && arr[idx - 1] === '') return false;
    return line !== '' || arr[idx - 1] !== undefined;
  });

  const message = lines.join('\n');

  return `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;
}

export function buildReferralUrl(kodePanitia: string): string {
  if (typeof window === 'undefined') return `?ref=${encodeURIComponent(kodePanitia)}`;
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('ref', kodePanitia);
  return url.toString();
}
