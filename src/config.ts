import { AdminAkses, EmailTemplateItem, LembagaConfig, Panitia } from './types';

/**
 * URL layanan sinkronisasi data default.
 */
export const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbza8ngK4Wtqqw9vtAH96d-LejP2mp9KNXvUQVrFg77WGCKooQCEbgfxEyozSQ38FP72nA/exec';

export const APP_BRAND_NAME = 'DAIKITA';
export const APP_PROGRAM_FOCUS = 'Kafalah Dai';
export const APP_TAGLINE = 'Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah.';
export const APP_PUBLIC_URL = 'https://daikita.duwd.web.id/';
export const APP_BAYAR_URL = 'https://daikita.duwd.web.id/#/bayar';
export const APP_ADMIN_URL = 'https://daikita.duwd.web.id/#/admin';
export const DEFAULT_LOGO_URL = 'https://lh3.googleusercontent.com/d/1OOSQydygv0K9SNcQUXQTqQyduW57mv4Y';

/** Bulan awal pencatatan pembayaran donasi */
export const PROGRAM_START_YM = '2026-11';
/** Batas awal tanggal transfer yang diperbolehkan */
export const TRANSFER_MIN_DATE = '2026-01-01';

export const DEFAULT_SCREEN_WIDTH_PCT = 95;

export const STORAGE_KEYS = {
  GAS_URL: 'donatur_rutin_gas_url_v1',
  LOCAL_DATA: 'donatur_rutin_local_sandbox_v1',
  THEME_PREF: 'daikita_theme_pref_v1',
  SCREEN_WIDTH: 'daikita_screen_width_pct_v1',
} as const;

/**
 * Template WA Pesan 1: Notifikasi Awal Pendaftaran Donatur Baru (rotasi anti-spam)
 */
export const DEFAULT_WA_TEMPLATES: string[] = [
  `Assalamu'alaikum Warahmatullahi Wabarakatuh.

Ahlan wa sahlan {sapaan} *{nama}*,
Terima kasih telah bergabung sebagai Donatur Rutin *Kafalah Dai* di *{lembaga}*.

*Rincian Data Donatur:*
• ID Donatur: *{id_donatur}*
• Nama Lengkap: {nama}
• Jenis Kelamin: {jenis_kelamin}
• Domisili: {domisili}
• Komitmen Bulanan: *{nominal}*
• Jadwal Pengingat: Setiap tanggal {tgl_pengingat}
• Perantara: {perantara}

Penyaluran donasi dapat melalui rekening resmi:
{rekening}
{qris_note}

Konfirmasi bukti transfer dapat dikirim melalui web:
{link_konfirmasi}
atau melalui japri admin via nomor ini.
{link_grup_section}
_Syukran wa jazakumullahu khairan._
_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._
_Aamiin._`,

  `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh {sapaan} *{nama}*.

Alhamdulillah, pendaftaran Donatur Rutin *Kafalah Dai* di *{lembaga}* telah resmi tercatat.

*Rincian Data Donatur:*
- ID Donatur: *{id_donatur}*
- Nama: {nama}
- Jenis Kelamin: {jenis_kelamin}
- Wilayah: {domisili}
- Komitmen Bulanan: *{nominal} / bulan*
- Pengingat Rutin: Tanggal {tgl_pengingat} setiap bulan
- Perantara: {perantara}

Salurkan donasi melalui rekening resmi berikut:
{rekening}
{qris_note}

Konfirmasi bukti transfer dapat dikirim melalui web:
{link_konfirmasi}
atau melalui japri admin via nomor ini.
{link_grup_section}
_Syukran wa jazakumullahu khairan._
_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._
_Aamiin._`,

  `Assalamu'alaikum Warahmatullahi Wabarakatuh {sapaan} *{nama}*

Terima kasih atas kepercayaan {sapaan} mendukung program *Kafalah Dai* bersama *{lembaga}*.

*Detail Kepesertaan Donatur:*
• ID Donatur: *{id_donatur}*
• Nama Lengkap: {nama}
• Jenis Kelamin: {jenis_kelamin}
• Domisili: {domisili}
• Nominal Komitmen: *{nominal}*
• Tanggal Pengingat: Setiap tanggal {tgl_pengingat}
• Perantara: {perantara}

Rekening Resmi:
{rekening}
{qris_note}

Konfirmasi bukti transfer dapat dikirim melalui web:
{link_konfirmasi}
atau melalui japri admin via nomor ini.
{link_grup_section}
_Syukran wa jazakumullahu khairan._
_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._
_Aamiin._`,
];

/**
 * Template WA Pesan 2: Arahan Save Nomor + Tautan Grup WA (dikirim otomatis dengan jeda 1 menit setelah daftar)
 */
export const DEFAULT_WA_FOLLOWUP_TEMPLATES: string[] = [
  `Assalamu'alaikum {sapaan} *{nama}*,

Mohon berkenan untuk *menyimpan (save) nomor WhatsApp ini* di kontak {sapaan} dengan nama *{lembaga}*.

Dengan menyimpan nomor ini:
• Tautan konfirmasi & tautan grup di pesan ini dapat langsung diklik
• Notifikasi pengingat rutin & informasi program *Kafalah Dai* dapat diterima dengan lancar
• {sapaan} dapat langsung japri admin di nomor ini kapan saja
{link_grup_section}
_Syukran wa jazakumullahu khairan._`,

  `Bismillah, izin mengingatkan kembali {sapaan} *{nama}* 😊

Agar tautan web konfirmasi & tautan grup dapat diklik dan {sapaan} selalu menerima notifikasi pengingat rutin serta info program *Kafalah Dai*, silakan *simpan nomor ini* di buku kontak HP {sapaan} (contoh: *DAIKITA Lajnah Dai*).
{link_grup_section}
Jika ada pertanyaan atau konfirmasi transfer, silakan balas langsung pesan ini ya {sapaan}.
_Jazakumullahu khairan._`,

  `Halo {sapaan} *{nama}*, satu langkah kecil agar komunikasi kita semakin lancar:

Silakan *save nomor resmi {lembaga}* ini di kontak HP {sapaan}. Dengan begitu, gambar QRIS, pengingat bulanan, serta update program *Kafalah Dai* akan tampil utuh dan tautannya langsung bisa dibuka.
{link_grup_section}
_Barakallahu fiikum, terima kasih banyak {sapaan}._`,
];

/**
 * Template WA Pengingat / Reminder Bulanan (ringkas tanpa rincian data daftar, siap disertai gambar QRIS)
 */
export const DEFAULT_WA_REMINDER_TEMPLATES: string[] = [
  `Assalamu'alaikum Warahmatullahi Wabarakatuh, {sapaan} *{nama}*.

Semoga {sapaan} sekeluarga senantiasa dalam kesehatan dan lindungan Allah.

Izin menyampaikan pengingat rutin donasi *Kafalah Dai* untuk periode *{bulan}* sebesar *{nominal}* melalui *{lembaga}*.

Penyaluran dapat melalui rekening resmi:
{rekening}
{qris_note}

Konfirmasi bukti transfer dapat dikirim melalui web:
{link_konfirmasi}
atau melalui japri admin via nomor ini.

_Syukran wa jazakumullahu khairan._
_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._
_Aamiin._`,

  `Bismillah, Assalamu'alaikum {sapaan} *{nama}*.

Mengingatkan dengan penuh hormat untuk jadwal donasi rutin *Kafalah Dai* periode *{bulan}* (Komitmen: *{nominal}*).

Salurkan melalui rekening resmi berikut:
{rekening}
{qris_note}

Konfirmasi bukti transfer dapat dikirim melalui web:
{link_konfirmasi}
atau melalui japri admin via nomor ini.

_Syukran wa jazakumullahu khairan._
_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._
_Aamiin._`,

  `Assalamu'alaikum Warahmatullahi Wabarakatuh {sapaan} *{nama}*.

Waktu kebaikan bulan *{bulan}* telah tiba. Izin mengingatkan komitmen donasi *Kafalah Dai* sebesar *{nominal}* bersama *{lembaga}*.

Rekening resmi penyaluran:
{rekening}
{qris_note}

Konfirmasi bukti transfer dapat dikirim melalui web:
{link_konfirmasi}
atau melalui japri admin via nomor ini.

_Syukran wa jazakumullahu khairan._
_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._
_Aamiin._`,
];

/**
 * 1 Template Email Khusus Pendaftaran Awal
 */
export const DEFAULT_EMAIL_TEMPLATE_DAFTAR: EmailTemplateItem = {
  subject: 'Selamat Bergabung di {lembaga} — Donatur Rutin Kafalah Dai ({id_donatur})',
  body: `Assalamu'alaikum Warahmatullahi Wabarakatuh,

Yth. {sapaan} {nama},

Terima kasih telah bergabung sebagai Donatur Rutin Program Kafalah Dai bersama {lembaga}.

Rincian Data Donatur:
• ID Donatur: {id_donatur}
• Nama Lengkap: {nama}
• Jenis Kelamin: {jenis_kelamin}
• Domisili: {domisili}
• Nominal Komitmen: {nominal} / bulan
• Jadwal Pengingat Rutin: Setiap tanggal {tgl_pengingat}
• Perantara / Pengurus: {perantara}

Penyaluran donasi dapat melalui rekening resmi berikut:
{rekening}
{qris_note}

Konfirmasi bukti transfer dapat dikirim melalui web:
{link_konfirmasi}
atau melalui japri admin via nomor WhatsApp resmi kami.
{link_grup_section}
Syukran wa jazakumullahu khairan.
Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir.
Aamiin.

Wassalamu'alaikum Warahmatullahi Wabarakatuh,
{lembaga}`,
};

/**
 * 1 Template Email Khusus Pengingat / Reminder Bulanan
 */
export const DEFAULT_EMAIL_TEMPLATE_REMINDER: EmailTemplateItem = {
  subject: 'Pengingat Donasi Rutin Kafalah Dai ({bulan}) — {lembaga}',
  body: `Assalamu'alaikum Warahmatullahi Wabarakatuh,

Yth. {sapaan} {nama},

Semoga {sapaan} beserta keluarga senantiasa dalam lindungan dan keberkahan Allah.
Dengan hormat kami menyampaikan pengingat donasi rutin Kafalah Dai periode {bulan} sebesar {nominal}.

Penyaluran donasi dapat melalui rekening resmi berikut:
{rekening}
{qris_note}

Konfirmasi bukti transfer dapat dikirim melalui web:
{link_konfirmasi}
atau melalui japri admin via nomor WhatsApp resmi kami.

Syukran wa jazakumullahu khairan.
Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir.
Aamiin.

Wassalamu'alaikum Warahmatullahi Wabarakatuh,
{lembaga}`,
};

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateItem[] = [
  DEFAULT_EMAIL_TEMPLATE_DAFTAR,
  DEFAULT_EMAIL_TEMPLATE_REMINDER,
];

export const DEFAULT_CONFIG: LembagaConfig = {
  namaLembaga: 'DAIKITA — Kafalah Dai',
  tagline: APP_TAGLINE,
  logoUrl: DEFAULT_LOGO_URL,
  qrisUrl: '',
  qrisMerchantName: 'LAJNAH DAI',
  showQris: true,
  defaultNominal: 50000,
  defaultTglPengingat: 5,
  catatanPembayaran:
    'Penyaluran donasi rutin Kafalah Dai hanya melalui rekening resmi atau QRIS lembaga.',
  infoRekening: [
    {
      bank: 'BSI (Bank Syariah Indonesia)',
      nomor: '7777767407',
      atasNama: 'LAJNAH DAI',
    },
  ],
  enableWaNotif: true,
  waEndpointUrl: 'https://www.rechat.id/api/v1/messages',
  waApiKey: '',
  waTemplates: DEFAULT_WA_TEMPLATES,
  waFollowupTemplates: DEFAULT_WA_FOLLOWUP_TEMPLATES,
  waFollowupDelaySec: 60,
  waReminderTemplates: DEFAULT_WA_REMINDER_TEMPLATES,
  waGroupName: 'Grup Donatur DAIKITA — Kafalah Dai',
  waGroupLink: '',
  waGroupId: '',
  enableEmailNotif: true,
  emailSenderAlias: 'lajnahdai.dpp@gmail.com',
  emailSenderName: 'DAIKITA — Lajnah Dai Wahdah Islamiyah',
  emailTemplateDaftar: DEFAULT_EMAIL_TEMPLATE_DAFTAR,
  emailTemplateReminder: DEFAULT_EMAIL_TEMPLATE_REMINDER,
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

export const DEFAULT_ADMIN_AKSES: AdminAkses[] = [
  {
    noWa: '6281100000001',
    nama: 'Admin Sekretariat',
    role: 'Super Admin',
    status: 'Aktif',
    catatan: 'Super Admin bawaan (Mode Lokal)',
  },
  {
    noWa: '6281100000002',
    nama: 'Koordinator Wilayah Utara',
    role: 'Admin',
    status: 'Aktif',
    catatan: 'Admin bawaan (Mode Lokal)',
  },
];
