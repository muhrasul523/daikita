import { EmailTemplateItem, LembagaConfig, Panitia } from './types';

/**
 * URL layanan sinkronisasi data default.
 */
export const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbza8ngK4Wtqqw9vtAH96d-LejP2mp9KNXvUQVrFg77WGCKooQCEbgfxEyozSQ38FP72nA/exec';

export const APP_BRAND_NAME = 'DAIKITA';
export const APP_PROGRAM_FOCUS = "Kafalah Dai";
export const APP_TAGLINE = 'Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah.';
export const APP_PUBLIC_URL = 'https://daikita.duwd.web.id/';

export const DEFAULT_SCREEN_WIDTH_PCT = 95;

export const STORAGE_KEYS = {
  GAS_URL: 'donatur_rutin_gas_url_v1',
  LOCAL_DATA: 'donatur_rutin_local_sandbox_v1',
  THEME_PREF: 'daikita_theme_pref_v1',
  SCREEN_WIDTH: 'daikita_screen_width_pct_v1',
} as const;

export const DEFAULT_WA_TEMPLATES: string[] = [
  `Assalamu'alaikum Warahmatullahi Wabarakatuh.

Ahlan wa sahlan {sapaan} *{nama}*,
Jazakumullahu khairan telah bergabung sebagai Donatur Rutin *Kafalah Dai* di *{lembaga}*.

Ringkasan Amanah Anda:
• ID Donatur: {id_donatur}
• Domisili: {domisili}
• Komitmen Bulanan: *{nominal}*
• Pengingat Rutin: Setiap tanggal {tgl_pengingat}
• Perantara: {perantara}

Penyaluran dapat melalui rekening resmi:
{rekening}

Konfirmasi bukti transfer dapat dikirim melalui:
{link_konfirmasi}

Semoga Allah SWT membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir. Aamiin.`,

  `Bismillah, Assalamu'alaikum {sapaan} *{nama}*.

Alhamdulillah, pendaftaran donatur rutin *{lembaga}* telah resmi tercatat atas nama {sapaan}:
• Nomor ID: *{id_donatur}*
• Komitmen Kafalah Dai: *{nominal} / bulan*
• Jadwal Pengingat: Tanggal {tgl_pengingat} setiap bulan

Salurkan amanah Anda melalui:
{rekening}

Jika sudah berdonasi, silakan kirim konfirmasi lewat portal:
{link_konfirmasi}

Barakallahu fiikum, semoga menjadi amal shalih yang menguatkan langkah dakwah para dai.`,

  `Assalamu'alaikum Warahmatullahi Wabarakatuh {sapaan} *{nama}* 🌟

Terima kasih atas kepercayaan {sapaan} mendukung program *Kafalah Dai* bersama *{lembaga}*.

Detail Komitmen Terdaftar:
- ID Donatur: {id_donatur}
- Wilayah: {domisili}
- Nominal Komitmen: {nominal}
- Tanggal Pengingat: Tgl {tgl_pengingat}

Rekening Resmi Penyaluran:
{rekening}

Portal konfirmasi transfer:
{link_konfirmasi}

Semoga Allah melapangkan urusan dan memberkahi harta {sapaan} sekeluarga. Wassalamu'alaikum Warahmatullahi Wabarakatuh.`,
];

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateItem[] = [
  {
    subject: "Selamat Bergabung di {lembaga} — Komitmen Kafalah Dai ({id_donatur})",
    body: `Assalamu'alaikum Warahmatullahi Wabarakatuh,

Yth. {sapaan} {nama},

Jazakumullahu khairan katsiran telah mendaftarkan komitmen amal rutin Program Kafalah Dai bersama {lembaga}.

Ringkasan Data Donatur:
• ID Donatur: {id_donatur}
• Nama Lengkap: {nama} ({jenis_kelamin})
• Domisili: {domisili}
• Nominal Komitmen: {nominal} / bulan
• Jadwal Pengingat Rutin: Setiap tanggal {tgl_pengingat}
• Perantara / Pengurus: {perantara}

Salurkan amanah Anda melalui rekening resmi berikut:
{rekening}

Portal Konfirmasi Pembayaran:
{link_konfirmasi}

Semoga Allah SWT senantiasa memberkahi keluarga, kesehatan, dan rezeki {sapaan}. Aamiin.

Wassalamu'alaikum Warahmatullahi Wabarakatuh,
{lembaga}`,
  },
  {
    subject: "Konfirmasi Pendaftaran Donatur Rutin Kafalah Dai — {nama}",
    body: `Bismillahirrahmanirrahim,
Assalamu'alaikum Warahmatullahi Wabarakatuh {sapaan} {nama},

Alhamdulillah, data kepesertaan donatur rutin Anda telah kami catat di {lembaga} dengan detail sebagai berikut:
- ID Donatur: {id_donatur}
- Komitmen Bulanan: {nominal}
- Tanggal Pengingat: Setiap tanggal {tgl_pengingat}
- Wilayah: {domisili}

Transfer amanah Kafalah Dai dapat dikirimkan ke rekening resmi:
{rekening}

Untuk konfirmasi bukti transfer atau informasi QRIS, silakan kunjungi:
{link_konfirmasi}

Terima kasih atas dukungan dan amanah {sapaan}. Barakallahu fiikum.`,
  },
  {
    subject: "[{id_donatur}] Terima Kasih Amanah Rutin Kafalah Dai — {lembaga}",
    body: `Assalamu'alaikum {sapaan} {nama},

Terima kasih telah menjadi bagian dari penggerak kebaikan Kafalah Dai bersama {lembaga}.

Detail Kepesertaan:
• ID Donatur: {id_donatur}
• Domisili: {domisili}
• Komitmen Rutin: {nominal} (Pengingat tiap tgl {tgl_pengingat})

Daftar Rekening Resmi:
{rekening}

Kirim bukti konfirmasi donasi melalui tautan berikut:
{link_konfirmasi}

Jazakumullahu khairan. Wassalamu'alaikum Warahmatullahi Wabarakatuh.`,
  },
];

export const DEFAULT_CONFIG: LembagaConfig = {
  namaLembaga: "DAIKITA — Kafalah Dai",
  tagline: APP_TAGLINE,
  logoUrl: '',
  qrisUrl: '',
  qrisMerchantName: 'DAIKITA Wahdah Islamiyah',
  showQris: true,
  defaultNominal: 50000,
  defaultTglPengingat: 5,
  catatanPembayaran:
    "Penyaluran amanah rutin Kafalah Dai hanya melalui rekening resmi atau QRIS lembaga.",
  infoRekening: [
    {
      bank: 'BSI (Bank Syariah Indonesia)',
      nomor: '7123456789',
      atasNama: 'DAIKITA Wahdah Islamiyah',
    },
    {
      bank: 'Bank Mandiri',
      nomor: '1320012345678',
      atasNama: 'DAIKITA Wahdah Islamiyah',
    },
    {
      bank: 'BCA Syariah',
      nomor: '0123456789',
      atasNama: 'DAIKITA Wahdah Islamiyah',
    },
  ],
  enableWaNotif: true,
  waEndpointUrl: 'https://www.rechat.id/api/v1/messages',
  waApiKey: '',
  waTemplates: DEFAULT_WA_TEMPLATES,
  enableEmailNotif: true,
  emailSenderAlias: 'lajnahdai.dpp@gmail.com',
  emailSenderName: "DAIKITA — Lajnah Dai Wahdah Islamiyah",
  emailTemplates: DEFAULT_EMAIL_TEMPLATES,
};

export const DEFAULT_PANITIA: Panitia[] = [
  {
    kodePanitia: 'ADM01',
    namaPanitia: 'Admin Sekretariat',
    jenisKelamin: 'Laki-laki',
    noWaPanitia: '6281100000001',
    role: 'Super Admin',
  },
  {
    kodePanitia: 'PNT01',
    namaPanitia: 'Koordinator Wilayah Utara',
    jenisKelamin: 'Laki-laki',
    noWaPanitia: '6281100000002',
    role: 'Admin',
  },
  {
    kodePanitia: 'PNT02',
    namaPanitia: 'Koordinator Wilayah Selatan',
    jenisKelamin: 'Perempuan',
    noWaPanitia: '6281100000003',
    role: 'Admin',
  },
];
