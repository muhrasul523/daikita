import { Donatur, LembagaConfig, RekeningInfo, TransaksiDonasi } from '../types';

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

export function formatBulanLabel(ym: string): string {
  const match = String(ym || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return ym || '-';
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const monthName = BULAN_INDO[monthIdx] || match[2];
  return `${monthName} ${year}`;
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
  bulanTagihan: string;
  namaDonatur: string;
  nominalTransfer: number;
  extension: string;
}): string {
  const datePart = getTodayIsoDate();
  const bulan = params.bulanTagihan || getCurrentYearMonth();
  const nama = sanitizeDonorNameForFile(params.namaDonatur || 'Nama-Donatur');
  const nominal = Math.round(params.nominalTransfer || 0);
  const ext = params.extension || 'jpg';
  return `${datePart}_${bulan}_${nama}_${nominal}.${ext}`;
}

export function formatRekeningLines(rekening: RekeningInfo[]): string {
  if (!rekening || rekening.length === 0) {
    return '- Hubungi pengurus untuk info rekening resmi.';
  }
  return rekening
    .map((r) => `• ${r.bank}: ${r.nomor} (a.n. ${r.atasNama})`)
    .join('\n');
}

/**
 * Membangun Smart Link wa.me untuk pengingat amanah Kafalah Da'i rutin
 */
export function buildReminderWaLink(
  donatur: Donatur,
  bulanTagihan: string,
  config: LembagaConfig
): string {
  const wa = normalizeWA(donatur.noWa) || String(donatur.noWa || '').replace(/\D/g, '');
  const bulanLabel = formatBulanLabel(bulanTagihan);
  const rekeningText = formatRekeningLines(config.infoRekening);
  const portalUrl =
    typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';

  const message = [
    `Assalamu'alaikum Warahmatullahi Wabarakatuh,`,
    ``,
    `Yth. Bapak/Ibu *${donatur.namaLengkap}*,`,
    `Semoga Bapak/Ibu beserta keluarga senantiasa dalam kesehatan dan keberkahan.`,
    ``,
    `Dengan hormat, kami menyampaikan pengingat rutin amanah *Kafalah Da'i* bulan *${bulanLabel}* melalui *${config.namaLembaga}*:`,
    `• Nominal Komitmen: *${formatRupiah(donatur.nominalKomitmen)}*`,
    `• Jadwal Pengingat Rutin: Setiap tanggal ${donatur.tglJatuhTempo}`,
    ``,
    `Transfer dapat disalurkan melalui rekening resmi:`,
    rekeningText,
    config.showQris && config.qrisUrl
      ? `Pembayaran juga dapat dilakukan melalui QRIS yang tersedia di portal konfirmasi.`
      : '',
    ``,
    portalUrl ? `Konfirmasi bukti transfer dapat dikirim melalui tautan:\n${portalUrl}` : '',
    ``,
    `Jazakumullahu khairan katsiran atas kepedulian dan amanah rutin Bapak/Ibu.`,
    `Wassalamu'alaikum Warahmatullahi Wabarakatuh.`,
  ]
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n');

  return `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;
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

  const message = [
    `Assalamu'alaikum Warahmatullahi Wabarakatuh,`,
    ``,
    `Alhamdulillah, terima kasih Bapak/Ibu *${trx.namaDonatur}*.`,
    `Amanah Kafalah Da'i Anda telah kami terima dan *TERVERIFIKASI VALID* oleh *${config.namaLembaga}*.`,
    ``,
    `*RINGKASAN KUITANSI DONASI*`,
    `• No. Transaksi: ${trx.idTransaksi}`,
    `• Periode Amanah: ${bulanLabel}`,
    `• Nominal Diterima: *${formatRupiah(trx.nominalTransfer)}*`,
    `• Tujuan Transfer: ${trx.bankTujuan}`,
    `• Status Verifikasi: Valid / Lunas`,
    `• Status Penyaluran: ${trx.statusPenyaluran || 'Belum Disalurkan'}`,
    ``,
    `Semoga Allah SWT membalas kebaikan Bapak/Ibu dengan pahala yang berlipat, rezeki yang berkah, dan kesehatan sekeluarga. Aamiin.`,
    ``,
    `Wassalamu'alaikum Warahmatullahi Wabarakatuh.`,
  ].join('\n');

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
