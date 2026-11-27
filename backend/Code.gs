/**
 * ============================================================================
 * DAIKITA - DAKWAH PELOSOK | SISTEM MANAJEMEN DONATUR TETAP (BACKEND APPS SCRIPT)
 * "Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah."
 * Arsitektur Serverless: Google Sheets + Google Drive + Gmail + ReChat WA API
 * ============================================================================
 * CARA SETUP / PERBARUI CEPAT:
 * 1. Buka Google Sheets -> menu Ekstensi -> Apps Script.
 * 2. Tempel seluruh kode ini ke file Code.gs lalu simpan (Ctrl+S).
 * 3. Pastikan DRIVE_FOLDER_ID sudah sesuai dengan folder Google Drive Anda.
 * 4. Pilih fungsi "setupDatabase" di toolbar atas -> klik Jalankan (Run).
 *    (Aman dijalankan berulang kali: merapikan sheet Master_Donatur,
 *    Transaksi_Donasi, Donasi_Lainnya, Akses_Admin, Pengaturan, Antrean_Pesan,
 *    menghapus sheet Data_Panitia lama setelah migrasi Akses_Admin, serta
 *    memasang trigger jadwal.)
 * 5. Klik Terapkan (Deploy) -> Kelola deployment -> Edit -> Versi baru -> Terapkan.
 *    Pastikan Execute as = Me (Saya) dan Who has access = Anyone (Siapa saja).
 * ============================================================================
 */

// ==================== KONFIGURASI DEFAULT ====================
const DRIVE_FOLDER_ID = '1KqfNK8yLOpb-7Ew6KXkfJoNU6XKmzK73';

const NAMA_LEMBAGA = 'DAIKITA — Dakwah Pelosok';
const TAGLINE_LEMBAGA = 'Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah.';
const APP_PUBLIC_URL = 'https://dakwahpelosok.web.id/';
const APP_BAYAR_URL = 'https://dakwahpelosok.web.id/#/bayar';
const APP_ADMIN_URL = 'https://dakwahpelosok.web.id/#/admin';
const DEFAULT_LOGO_URL = 'https://lh3.googleusercontent.com/d/1OOSQydygv0K9SNcQUXQTqQyduW57mv4Y';

const ADMIN_SESSION_TTL_SEC = 21600; // 6 jam
const PUB_CONFIG_CACHE_KEY = 'DAIKITA_PUB_CFG_V2';
const PUB_CONFIG_CACHE_TTL_SEC = 300; // 5 menit
const LOOKUP_CACHE_PREFIX = 'DAIKITA_WA_V2_';
const LOOKUP_CACHE_TTL_SEC = 180; // 3 menit

const DEFAULT_WA_ENDPOINT = 'https://www.rechat.id/api/v1/messages';
const DEFAULT_WA_API_KEY = 'wag_8d4afa8dfa57f45f95961017e050b36b15de17edd2fdc542';
const DEFAULT_CALL_CENTER_LABEL = 'Call Center Admin DAIKITA';
const DEFAULT_CALL_CENTER_WA = '6281243086241';

const DEFAULT_EMAIL_ALIAS = 'lajnahdai.dpp@gmail.com';
const DEFAULT_EMAIL_SENDER_NAME = 'DAIKITA — Dakwah Pelosok';

const TRANSFER_MIN_DATE = '2026-01-01';

const INFO_REKENING_DEFAULT = [
  {
    bank: 'BSI (Bank Syariah Indonesia)',
    nomor: '7777767407',
    atasNama: 'LAJNAH DAI'
  }
];

const DEFAULT_WA_MANUAL_CONFIRM_TEMPLATE =
  "Assalamu'alaikum Admin {lembaga}.\n\nSaya ingin melakukan konfirmasi manual penyaluran donasi *Dakwah Pelosok*:\n• Nama Donatur: *{nama}*\n• ID Donatur: {id_donatur}\n• No. WhatsApp: {no_wa}\n• Periode Donasi: *{bulan}*\n• Tanggal Transfer: {tanggal_transfer}\n• Nominal Transfer: *{nominal}*\n• Keterangan: {keterangan}\n• Bukti Transfer: {link_bukti}\n\nMohon dibantu verifikasinya ya Admin. Jazakumullahu khairan.";

/** Pesan 1: Notifikasi Awal Pendaftaran Donatur Baru (rotasi anti-spam) */
const DEFAULT_WA_TEMPLATES = [
  "Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nAhlan wa sahlan {sapaan} *{nama}*,\nTerima kasih telah bergabung sebagai Donatur Tetap *Dakwah Pelosok* di *{lembaga}*.\n\n*Rincian Data Donatur:*\n• ID Donatur: *{id_donatur}*\n• Nama Lengkap: {nama}\n• Jenis Kelamin: {jenis_kelamin}\n• Domisili: {domisili}\n• Komitmen Bulanan: *{nominal}*\n• Jadwal Pengingat: Setiap tanggal {tgl_pengingat}\n\nPenyaluran donasi dapat melalui rekening resmi:\n{rekening}\n{qris_note}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor ini.\n{link_grup_section}\n_Syukran wa jazakumullahu khairan._\n_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._\n_Aamiin._",
  "Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh {sapaan} *{nama}*.\n\nAlhamdulillah, pendaftaran Donatur Tetap *Dakwah Pelosok* di *{lembaga}* telah resmi tercatat.\n\n*Rincian Data Donatur:*\n- ID Donatur: *{id_donatur}*\n- Nama: {nama}\n- Jenis Kelamin: {jenis_kelamin}\n- Wilayah: {domisili}\n- Komitmen Bulanan: *{nominal} / bulan*\n- Pengingat Rutin: Tanggal {tgl_pengingat} setiap bulan\n\nSalurkan donasi melalui rekening resmi berikut:\n{rekening}\n{qris_note}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor ini.\n{link_grup_section}\n_Syukran wa jazakumullahu khairan._\n_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._\n_Aamiin._",
  "Assalamu'alaikum Warahmatullahi Wabarakatuh {sapaan} *{nama}*\n\nTerima kasih atas kepercayaan {sapaan} mendukung program *Dakwah Pelosok* bersama *{lembaga}*.\n\n*Detail Kepesertaan Donatur:*\n• ID Donatur: *{id_donatur}*\n• Nama Lengkap: {nama}\n• Jenis Kelamin: {jenis_kelamin}\n• Domisili: {domisili}\n• Nominal Komitmen: *{nominal}*\n• Tanggal Pengingat: Setiap tanggal {tgl_pengingat}\n\nRekening Resmi:\n{rekening}\n{qris_note}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor ini.\n{link_grup_section}\n_Syukran wa jazakumullahu khairan._\n_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._\n_Aamiin._"
];

/** Pesan 2: Arahan Save Nomor + Tautan Grup WA (jeda 1 menit setelah daftar) */
const DEFAULT_WA_FOLLOWUP_TEMPLATES = [
  "Assalamu'alaikum {sapaan} *{nama}*,\n\nMohon berkenan untuk *menyimpan (save) nomor WhatsApp ini* di kontak {sapaan} dengan nama *{lembaga}*.\n\nDengan menyimpan nomor ini:\n• Tautan konfirmasi & tautan grup di pesan ini dapat langsung diklik\n• Notifikasi pengingat rutin & informasi program *Dakwah Pelosok* dapat diterima dengan lancar\n• {sapaan} dapat langsung japri admin di nomor ini kapan saja\n{link_grup_section}\n_Syukran wa jazakumullahu khairan._",
  "Bismillah, izin mengingatkan kembali {sapaan} *{nama}* 😊\n\nAgar tautan web konfirmasi & tautan grup dapat diklik dan {sapaan} selalu menerima notifikasi pengingat rutin serta info program *Dakwah Pelosok*, silakan *simpan nomor ini* di buku kontak HP {sapaan} (contoh: *DAIKITA - Dakwah Pelosok*).\n{link_grup_section}\nJika ada pertanyaan atau konfirmasi transfer, silakan balas langsung pesan ini ya {sapaan}.\n_Jazakumullahu khairan._",
  "Halo {sapaan} *{nama}*, satu langkah kecil agar komunikasi kita semakin lancar:\n\nSilakan *save nomor resmi {lembaga}* ini di kontak HP {sapaan}. Dengan begitu, gambar QRIS, pengingat bulanan, serta update program *Dakwah Pelosok* akan tampil utuh dan tautannya langsung bisa dibuka.\n{link_grup_section}\n_Barakallahu fiikum, terima kasih banyak {sapaan}._"
];

/** Template WA Reminder Bulanan (ringkas tanpa rincian data daftar + otomatis lampirkan QRIS bila ada) */
const DEFAULT_WA_REMINDER_TEMPLATES = [
  "Assalamu'alaikum Warahmatullahi Wabarakatuh, {sapaan} *{nama}*.\n\nSemoga {sapaan} sekeluarga senantiasa dalam kesehatan dan lindungan Allah.\n\nIzin menyampaikan pengingat rutin donasi *Dakwah Pelosok* untuk periode *{bulan}* sebesar *{nominal}* melalui *{lembaga}*.\n\nPenyaluran dapat melalui rekening resmi:\n{rekening}\n{qris_note}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor ini.\n\n_Syukran wa jazakumullahu khairan._\n_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._\n_Aamiin._",
  "Bismillah, Assalamu'alaikum {sapaan} *{nama}*.\n\nMengingatkan dengan penuh hormat untuk jadwal donasi tetap *Dakwah Pelosok* periode *{bulan}* (Komitmen: *{nominal}*).\n\nSalurkan melalui rekening resmi berikut:\n{rekening}\n{qris_note}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor ini.\n\n_Syukran wa jazakumullahu khairan._\n_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._\n_Aamiin._",
  "Assalamu'alaikum Warahmatullahi Wabarakatuh {sapaan} *{nama}*.\n\nWaktu kebaikan bulan *{bulan}* telah tiba. Izin mengingatkan komitmen donasi *Dakwah Pelosok* sebesar *{nominal}* bersama *{lembaga}*.\n\nRekening resmi:\n{rekening}\n{qris_note}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor ini.\n\n_Syukran wa jazakumullahu khairan._\n_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._\n_Aamiin._"
];

/** 1 Template Email Pendaftaran Awal */
const DEFAULT_EMAIL_TEMPLATE_DAFTAR = {
  subject: 'Selamat Bergabung di {lembaga} — Donatur Tetap Dakwah Pelosok ({id_donatur})',
  body: "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nYth. {sapaan} {nama},\n\nTerima kasih telah bergabung sebagai Donatur Tetap Program Dakwah Pelosok bersama {lembaga}.\n\nRincian Data Donatur:\n• ID Donatur: {id_donatur}\n• Nama Lengkap: {nama}\n• Jenis Kelamin: {jenis_kelamin}\n• Domisili: {domisili}\n• Nominal Komitmen: {nominal} / bulan\n• Jadwal Pengingat Rutin: Setiap tanggal {tgl_pengingat}\n\nPenyaluran donasi dapat melalui rekening resmi berikut:\n{rekening}\n{qris_note}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor WhatsApp resmi kami.\n{link_grup_section}\nSyukran wa jazakumullahu khairan.\nSemoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir.\nAamiin.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh,\n{lembaga}"
};

/** 1 Template Email Pengingat / Reminder Bulanan */
const DEFAULT_EMAIL_TEMPLATE_REMINDER = {
  subject: 'Pengingat Donasi Tetap Dakwah Pelosok ({bulan}) — {lembaga}',
  body: "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nYth. {sapaan} {nama},\n\nSemoga {sapaan} beserta keluarga senantiasa dalam lindungan dan keberkahan Allah.\nDengan hormat kami menyampaikan pengingat donasi tetap Dakwah Pelosok periode {bulan} sebesar {nominal}.\n\nPenyaluran donasi dapat melalui rekening resmi berikut:\n{rekening}\n{qris_note}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor WhatsApp resmi kami.\n\nSyukran wa jazakumullahu khairan.\nSemoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir.\nAamiin.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh,\n{lembaga}"
};

const TIMEZONE = 'Asia/Jakarta';
const BULAN_INDO_SERVER = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// ==================== KONSTANTA SHEET & HEADER ====================
const SHEET_NAMES = {
  DONATUR: 'Master_Donatur',
  TRANSAKSI: 'Transaksi_Donasi',
  DONASI_LAINNYA: 'Donasi_Lainnya',
  AKSES_ADMIN: 'Akses_Admin',
  PENGATURAN: 'Pengaturan',
  ANTREAN: 'Antrean_Pesan'
};

const HEADERS = {
  Master_Donatur: [
    'ID_Donatur',
    'Tanggal_Daftar',
    'Nama_Lengkap',
    'Jenis_Kelamin',
    'No_WA',
    'Kab_ID',
    'Domisili',
    'Provinsi',
    'Pulau',
    'Nominal_Komitmen',
    'Tgl_Jatuh_Tempo',
    'Metode_Daftar',
    'Kode_Perantara',
    'Nama_Perantara',
    'Status_Aktif',
    'Email',
    'Minat_Grup_WA',
    'Status_Grup_WA'
  ],
  Transaksi_Donasi: [
    'ID_Transaksi',
    'Waktu_Input',
    'Tanggal_Transfer',
    'Jenis_Donatur',
    'ID_Donatur',
    'Nama_Donatur',
    'No_WA',
    'Bulan_Tagihan',
    'Nominal_Komitmen',
    'Donasi_Lainnya',
    'Nominal_Transfer',
    'Bank_Tujuan',
    'Link_Bukti_Drive',
    'Status_Verifikasi',
    'Diinput_Oleh',
    'Status_Penyaluran',
    'Keterangan'
  ],
  Donasi_Lainnya: [
    'ID_Transaksi',
    'Tanggal_Transfer',
    'Bulan_Tagihan',
    'Jenis_Sumber',
    'ID_Donatur',
    'Nama_Donatur',
    'No_WA',
    'Nominal_Komitmen',
    'Nominal_Donasi_Lainnya',
    'Total_Transfer',
    'Status_Verifikasi',
    'Keterangan',
    'Link_Bukti_Drive'
  ],
  Akses_Admin: [
    'No_WA',
    'Nama',
    'Role',
    'Status',
    'Catatan'
  ],
  Pengaturan: [
    'Kunci',
    'Nilai'
  ],
  Antrean_Pesan: [
    'ID_Antrean',
    'Waktu_Buat',
    'Jadwal_Kirim',
    'Jenis_Pesan',
    'ID_Donatur',
    'Nama_Donatur',
    'No_WA',
    'Isi_Pesan',
    'Media_Url',
    'Status',
    'Keterangan_Hasil',
    'Waktu_Terkirim'
  ]
};

// ==================== SETUP DATABASE (AMAN DIJALANKAN BERULANG) ====================
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet aktif tidak ditemukan. Pastikan skrip terikat pada file Google Sheets.');
  }

  ensureSheetWithHeaders_(ss, SHEET_NAMES.DONATUR, HEADERS.Master_Donatur, {
    textHeaders: [
      'ID_Donatur',
      'Tanggal_Daftar',
      'Jenis_Kelamin',
      'No_WA',
      'Kab_ID',
      'Status_Aktif',
      'Email',
      'Kode_Perantara',
      'Minat_Grup_WA',
      'Status_Grup_WA'
    ],
    currencyHeaders: ['Nominal_Komitmen'],
    widthByHeader: {
      ID_Donatur: 145,
      Tanggal_Daftar: 165,
      Nama_Lengkap: 220,
      Jenis_Kelamin: 120,
      No_WA: 155,
      Kab_ID: 100,
      Domisili: 190,
      Provinsi: 175,
      Pulau: 120,
      Nominal_Komitmen: 155,
      Tgl_Jatuh_Tempo: 130,
      Metode_Daftar: 165,
      Kode_Perantara: 130,
      Nama_Perantara: 195,
      Status_Aktif: 120,
      Email: 210,
      Minat_Grup_WA: 130,
      Status_Grup_WA: 155
    }
  });

  ensureSheetWithHeaders_(ss, SHEET_NAMES.TRANSAKSI, HEADERS.Transaksi_Donasi, {
    textHeaders: [
      'ID_Transaksi',
      'Waktu_Input',
      'Tanggal_Transfer',
      'Jenis_Donatur',
      'ID_Donatur',
      'No_WA',
      'Bulan_Tagihan',
      'Status_Verifikasi',
      'Status_Penyaluran',
      'Keterangan'
    ],
    currencyHeaders: ['Nominal_Komitmen', 'Donasi_Lainnya', 'Nominal_Transfer'],
    widthByHeader: {
      ID_Transaksi: 165,
      Waktu_Input: 165,
      Tanggal_Transfer: 135,
      Jenis_Donatur: 120,
      ID_Donatur: 145,
      Nama_Donatur: 210,
      No_WA: 155,
      Bulan_Tagihan: 125,
      Nominal_Komitmen: 155,
      Donasi_Lainnya: 150,
      Nominal_Transfer: 155,
      Bank_Tujuan: 190,
      Link_Bukti_Drive: 260,
      Status_Verifikasi: 145,
      Diinput_Oleh: 185,
      Status_Penyaluran: 165,
      Keterangan: 240
    }
  });

  ensureSheetWithHeaders_(ss, SHEET_NAMES.DONASI_LAINNYA, HEADERS.Donasi_Lainnya, {
    textHeaders: [
      'ID_Transaksi',
      'Tanggal_Transfer',
      'Bulan_Tagihan',
      'Jenis_Sumber',
      'ID_Donatur',
      'No_WA',
      'Status_Verifikasi',
      'Keterangan'
    ],
    currencyHeaders: ['Nominal_Komitmen', 'Nominal_Donasi_Lainnya', 'Total_Transfer'],
    widthByHeader: {
      ID_Transaksi: 165,
      Tanggal_Transfer: 135,
      Bulan_Tagihan: 125,
      Jenis_Sumber: 165,
      ID_Donatur: 145,
      Nama_Donatur: 210,
      No_WA: 155,
      Nominal_Komitmen: 150,
      Nominal_Donasi_Lainnya: 170,
      Total_Transfer: 155,
      Status_Verifikasi: 140,
      Keterangan: 240,
      Link_Bukti_Drive: 240
    }
  });

  const aksesAdminSheet = ensureSheetWithHeaders_(ss, SHEET_NAMES.AKSES_ADMIN, HEADERS.Akses_Admin, {
    textHeaders: ['No_WA', 'Role', 'Status'],
    widthByHeader: {
      No_WA: 165,
      Nama: 220,
      Role: 140,
      Status: 120,
      Catatan: 260
    }
  });

  // Jika sheet Data_Panitia lama masih ada, migrasikan admin ke Akses_Admin (jika kosong) lalu hapus Data_Panitia
  const legacyPanitiaSheet = ss.getSheetByName('Data_Panitia');
  if (aksesAdminSheet.getLastRow() <= 1) {
    const seededMap = {};
    const seedList = [];

    if (legacyPanitiaSheet) {
      const panitiaRows = readSheetAsObjects_(legacyPanitiaSheet);
      panitiaRows.forEach(function (row) {
        const roleNorm = normalizeRole_(row.Role);
        if (roleNorm !== 'Super Admin' && roleNorm !== 'Admin') return;
        const waNorm = safeNormalizeOrKeep_(row.No_WA_Panitia);
        if (!waNorm || seededMap[waNorm]) return;
        seededMap[waNorm] = true;
        seedList.push({
          No_WA: waNorm,
          Nama: String(row.Nama_Panitia || 'Admin').trim(),
          Role: roleNorm,
          Status: 'Aktif',
          Catatan: 'Dimigrasikan dari Data_Panitia'
        });
      });
    }

    if (seedList.length === 0) {
      seedList.push({
        No_WA: '6281100000001',
        Nama: 'Super Admin Utama',
        Role: 'Super Admin',
        Status: 'Aktif',
        Catatan: 'Ganti dengan nomor WA Super Admin Anda'
      });
    } else if (!seedList.some(function (item) { return item.Role === 'Super Admin'; })) {
      seedList[0].Role = 'Super Admin';
    }

    seedList.forEach(function (rowObj) {
      appendRowByHeaderMap_(aksesAdminSheet, rowObj, ['No_WA', 'Role', 'Status'], []);
    });
  }

  if (legacyPanitiaSheet && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(legacyPanitiaSheet);
    } catch (delErr) {
      Logger.log('Info hapus Data_Panitia: ' + delErr);
    }
  }

  const pengaturanSheet = ensureSheetWithHeaders_(ss, SHEET_NAMES.PENGATURAN, HEADERS.Pengaturan, {
    textHeaders: ['Kunci', 'Nilai'],
    widthByHeader: {
      Kunci: 240,
      Nilai: 560
    }
  });

  if (pengaturanSheet.getLastRow() <= 1) {
    const defaults = buildDefaultSettingsMap_();
    writeSettingsMap_(pengaturanSheet, defaults);
  }

  ensureSheetWithHeaders_(ss, SHEET_NAMES.ANTREAN, HEADERS.Antrean_Pesan, {
    textHeaders: [
      'ID_Antrean',
      'Waktu_Buat',
      'Jadwal_Kirim',
      'Jenis_Pesan',
      'ID_Donatur',
      'No_WA',
      'Status',
      'Waktu_Terkirim'
    ],
    widthByHeader: {
      ID_Antrean: 160,
      Waktu_Buat: 160,
      Jadwal_Kirim: 160,
      Jenis_Pesan: 150,
      ID_Donatur: 135,
      Nama_Donatur: 190,
      No_WA: 145,
      Isi_Pesan: 340,
      Media_Url: 220,
      Status: 115,
      Keterangan_Hasil: 230,
      Waktu_Terkirim: 160
    }
  });

  ensureMigratedDefaultLogo_(ss);
  ensureMigratedDefaultRekeningAndTemplates_(ss);
  ensureMigratedV3GrupFollowupAndNonAktif_(ss);
  backfillDonasiLainnyaSheet_(ss);

  // Pasang trigger berkala 5 menit untuk mengirim antrean terjadwal & follow-up 1 menit
  let triggerStatus = '';
  try {
    ensureRecurringQueueTrigger_();
    triggerStatus = ' Trigger antrean terjadwal aktif.';
  } catch (trigErr) {
    triggerStatus = ' Peringatan Trigger: ' + (trigErr && trigErr.message ? trigErr.message : String(trigErr));
  }

  // Picu verifikasi izin Google Drive & Gmail saat setupDatabase() dijalankan
  let driveStatus = '';
  try {
    const targetFolder = getDriveTargetFolder_();
    driveStatus = ' Folder Drive aktif: ' + targetFolder.getName() + '.';
  } catch (driveErr) {
    driveStatus = ' Peringatan Drive: ' + (driveErr && driveErr.message ? driveErr.message : String(driveErr));
  }

  let gmailStatus = '';
  try {
    const aliases = GmailApp.getAliases();
    gmailStatus = ' Izin Email aktif (alias terdeteksi: ' + (aliases.length > 0 ? aliases.join(', ') : 'akun utama') + ').';
  } catch (mailErr) {
    gmailStatus = ' Peringatan Email: ' + (mailErr && mailErr.message ? mailErr.message : String(mailErr));
  }

  SpreadsheetApp.flush();
  Logger.log('setupDatabase() selesai.' + driveStatus + gmailStatus + triggerStatus);
  return {
    status: 'success',
    message: 'Struktur data DAIKITA siap digunakan tanpa menghapus data lama.' + driveStatus + gmailStatus + triggerStatus
  };
}

function setupSheets() {
  return setupDatabase();
}

function ensureRecurringQueueTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  let hasRecurring = false;
  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i];
    if (t.getHandlerFunction() === 'processScheduledMessagesRecurring') {
      hasRecurring = true;
      break;
    }
  }
  if (!hasRecurring) {
    ScriptApp.newTrigger('processScheduledMessagesRecurring')
      .timeBased()
      .everyMinutes(5)
      .create();
  }
}

function scheduleOneTimeQueueTrigger_(delayMs) {
  try {
    const safeDelay = Math.max(15000, Math.min(600000, Number(delayMs) || 60000));
    ScriptApp.newTrigger('processScheduledMessagesOneTime')
      .timeBased()
      .after(safeDelay)
      .create();
    return true;
  } catch (err) {
    Logger.log('Gagal membuat trigger one-time: ' + err);
    return false;
  }
}

function processScheduledMessagesRecurring() {
  return processScheduledMessages();
}

function processScheduledMessagesOneTime() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'processScheduledMessagesOneTime') {
        try {
          ScriptApp.deleteTrigger(triggers[i]);
        } catch (delErr) {
          Logger.log('Info hapus trigger one-time: ' + delErr);
        }
      }
    }
  } catch (err) {
    Logger.log('Info cek trigger one-time: ' + err);
  }
  return processScheduledMessages();
}

function ensureSheetWithHeaders_(ss, sheetName, targetHeaders, options) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const lastRow = sheet.getLastRow();
  let finalHeaders = [];

  if (lastRow === 0) {
    finalHeaders = targetHeaders.slice();
    if (sheet.getMaxColumns() < finalHeaders.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), finalHeaders.length - sheet.getMaxColumns());
    }
    sheet.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]);
  } else {
    const existingCols = Math.max(sheet.getLastColumn(), 1);
    const existingRow1 = sheet.getRange(1, 1, 1, existingCols).getValues()[0];
    const isHeaderEmpty = existingRow1.every(function (cell) {
      return String(cell || '').trim() === '';
    });

    if (isHeaderEmpty) {
      finalHeaders = targetHeaders.slice();
      if (sheet.getMaxColumns() < finalHeaders.length) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), finalHeaders.length - sheet.getMaxColumns());
      }
      sheet.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]);
    } else {
      finalHeaders = existingRow1.map(function (h) {
        return String(h || '').trim();
      });
      const existingSet = {};
      finalHeaders.forEach(function (h) {
        if (h) existingSet[h] = true;
      });

      targetHeaders.forEach(function (h) {
        if (!existingSet[h]) {
          finalHeaders.push(h);
          if (sheet.getMaxColumns() < finalHeaders.length) {
            sheet.insertColumnsAfter(sheet.getMaxColumns(), 1);
          }
          sheet.getRange(1, finalHeaders.length).setValue(h);
        }
      });
    }
  }

  const headerCount = finalHeaders.length;
  const headerRange = sheet.getRange(1, 1, 1, headerCount);
  headerRange
    .setBackground('#065F46')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontFamily('Montserrat')
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setRowHeight(1, 34);
  sheet.setFrozenRows(1);

  const maxRows = Math.max(sheet.getMaxRows(), 1000);
  const indexMap = getHeaderIndexMap_(sheet);

  if (options && options.textHeaders) {
    options.textHeaders.forEach(function (hName) {
      const col = indexMap[hName];
      if (col) {
        sheet.getRange(2, col, maxRows - 1, 1).setNumberFormat('@');
      }
    });
  }

  if (options && options.currencyHeaders) {
    options.currencyHeaders.forEach(function (hName) {
      const col = indexMap[hName];
      if (col) {
        sheet.getRange(2, col, maxRows - 1, 1).setNumberFormat('#,##0');
      }
    });
  }

  if (options && options.widthByHeader) {
    Object.keys(options.widthByHeader).forEach(function (hName) {
      const col = indexMap[hName];
      if (col) {
        sheet.setColumnWidth(col, options.widthByHeader[hName]);
      }
    });
  }

  return sheet;
}

function getHeaderIndexMap_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return {};
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  for (let i = 0; i < headers.length; i++) {
    const key = String(headers[i] || '').trim();
    if (key) {
      map[key] = i + 1;
    }
  }
  return map;
}

// ==================== ENDPOINT WEB APP (GET & POST) ====================
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = String(params.action || 'getPublicConfig').trim();

    if (action === 'ping') {
      const cfg = loadConfigObject_(SpreadsheetApp.getActiveSpreadsheet());
      return jsonResponse_({
        status: 'success',
        message: 'Koneksi layanan data DAIKITA aktif.',
        data: {
          namaLembaga: cfg.namaLembaga,
          tagline: cfg.tagline,
          serverTime: formatTimestamp_(new Date())
        }
      });
    }

    if (action === 'getPublicConfig') {
      return jsonResponse_({
        status: 'success',
        message: 'Konfigurasi publik siap.',
        data: getPublicConfig_()
      });
    }

    if (action === 'lookupDonaturByWa') {
      return jsonResponse_(handleLookupDonaturByWa_(params));
    }

    if (action === 'getAdminData' || action === 'getInitialData') {
      const auth = requireAdminRole_(params.adminToken, 'Admin');
      if (!auth.ok) return jsonResponse_(auth.response);
      return jsonResponse_({
        status: 'success',
        message: 'Data admin berhasil disinkronkan.',
        data: getAdminDataset_(auth.admin)
      });
    }

    return jsonResponse_({
      status: 'error',
      message: 'Aksi GET tidak dikenali: ' + action
    });
  } catch (err) {
    return jsonResponse_({
      status: 'error',
      message: err && err.message ? err.message : 'Terjadi kesalahan pada server.'
    });
  }
}

function doPost(e) {
  let lock = null;
  try {
    const payload = parseRequestBody_(e);
    const action = String(payload.action || '').trim();

    // Deteksi Webhook masuk dari ReChat (POST JSON tanpa field "action")
    if (
      !action &&
      payload &&
      (payload.event ||
        (payload.data &&
          (payload.data.is_group !== undefined || payload.data.chat || payload.data.from)))
    ) {
      return jsonResponse_(handleRechatWebhook_(payload));
    }

    if (!action) {
      return jsonResponse_({
        status: 'error',
        message: 'Parameter action tidak ditemukan.'
      });
    }

    // Read-only & login actions (tidak perlu lock tulis berat)
    if (action === 'getPublicConfig') {
      return jsonResponse_({
        status: 'success',
        message: 'Konfigurasi publik siap.',
        data: getPublicConfig_()
      });
    }

    if (action === 'lookupDonaturByWa') {
      return jsonResponse_(handleLookupDonaturByWa_(payload));
    }

    if (action === 'loginAdmin') {
      return jsonResponse_(handleLoginAdmin_(payload));
    }

    if (action === 'verifyAdminSession') {
      const authCheck = requireAdminRole_(payload.adminToken, 'Admin');
      if (!authCheck.ok) return jsonResponse_(authCheck.response);
      return jsonResponse_({
        status: 'success',
        message: 'Sesi admin aktif.',
        data: { admin: authCheck.admin }
      });
    }

    if (action === 'getAdminData' || action === 'getInitialData') {
      const auth = requireAdminRole_(payload.adminToken, 'Admin');
      if (!auth.ok) return jsonResponse_(auth.response);
      return jsonResponse_({
        status: 'success',
        message: 'Data admin berhasil disinkronkan.',
        data: getAdminDataset_(auth.admin)
      });
    }

    // Validasi hak akses SEBELUM mengambil lock tulis
    const adminOnlyActions = {
      verifikasiTransaksi: true,
      updateStatusPenyaluran: true,
      updateStatusDonatur: true,
      updateStatusGrupDonatur: true,
      bulkUpdateStatusGrupDonatur: true,
      syncGroupMembers: true,
      sendBroadcastSingle: true,
      scheduleBroadcast: true,
      processQueue: true,
      cancelScheduledMessage: true
    };

    const superAdminOnlyActions = {
      savePengaturan: true,
      testNotification: true,
      saveAdminAkses: true,
      deleteAdminAkses: true
    };

    if (superAdminOnlyActions[action]) {
      const saAuth = requireAdminRole_(payload.adminToken, 'Super Admin');
      if (!saAuth.ok) return jsonResponse_(saAuth.response);
    } else if (adminOnlyActions[action]) {
      const admAuth = requireAdminRole_(payload.adminToken, 'Admin');
      if (!admAuth.ok) return jsonResponse_(admAuth.response);
    } else if (action === 'submitPembayaran' && String(payload.jenisDonatur || '').trim() === 'Umum') {
      const umumAuth = requireAdminRole_(payload.adminToken, 'Admin');
      if (!umumAuth.ok) return jsonResponse_(umumAuth.response);
    }

    lock = LockService.getScriptLock();
    const lockAcquired = lock.tryLock(25000);
    if (!lockAcquired) {
      return jsonResponse_({
        status: 'error',
        message: 'Server sedang memproses permintaan lain. Silakan coba beberapa detik lagi.'
      });
    }

    let result;
    switch (action) {
      case 'registerDonatur':
        result = handleRegisterDonatur_(payload);
        break;
      case 'updateDonaturMandiri':
        result = handleUpdateDonaturMandiri_(payload);
        break;
      case 'submitPembayaran':
        result = handleSubmitPembayaran_(payload);
        break;
      case 'verifikasiTransaksi':
        result = handleVerifikasiTransaksi_(payload);
        break;
      case 'updateStatusPenyaluran':
        result = handleUpdateStatusPenyaluran_(payload);
        break;
      case 'updateStatusDonatur':
        result = handleUpdateStatusDonatur_(payload);
        break;
      case 'updateStatusGrupDonatur':
        result = handleUpdateStatusGrupDonatur_(payload);
        break;
      case 'bulkUpdateStatusGrupDonatur':
        result = handleBulkUpdateStatusGrupDonatur_(payload);
        break;
      case 'syncGroupMembers':
        result = handleSyncGroupMembers_(payload);
        break;
      case 'savePengaturan':
        result = handleSavePengaturan_(payload);
        break;
      case 'saveAdminAkses':
        result = handleSaveAdminAkses_(payload);
        break;
      case 'deleteAdminAkses':
        result = handleDeleteAdminAkses_(payload);
        break;
      case 'testNotification':
        result = handleTestNotification_(payload);
        break;
      case 'sendBroadcastSingle':
        result = handleSendBroadcastSingle_(payload);
        break;
      case 'scheduleBroadcast':
        result = handleScheduleBroadcast_(payload);
        break;
      case 'processQueue':
        result = handleProcessQueueNow_();
        break;
      case 'cancelScheduledMessage':
        result = handleCancelScheduledMessage_(payload);
        break;
      default:
        return jsonResponse_({
          status: 'error',
          message: 'Aksi POST tidak dikenali: ' + action
        });
    }

    return jsonResponse_(result);
  } catch (err) {
    return jsonResponse_({
      status: 'error',
      message: err && err.message ? err.message : 'Terjadi kesalahan saat memproses permintaan.'
    });
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (releaseErr) {
        Logger.log('Gagal melepas lock: ' + releaseErr);
      }
    }
  }
}

// ==================== HANDLER PENGATURAN & KONFIGURASI ====================
function sanitizeLegacyBrandText_(val) {
  return String(val || '')
    .replace(/kafalah\s*da['’`]?i/gi, 'Dakwah Pelosok')
    .replace(/\bDAIKITA\s*-\s*Dakwah Pelosok/gi, 'DAIKITA — Dakwah Pelosok')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildDefaultSettingsMap_() {
  return {
    namaLembaga: NAMA_LEMBAGA,
    tagline: TAGLINE_LEMBAGA,
    logoUrl: DEFAULT_LOGO_URL,
    qrisUrl: '',
    qrisMerchantName: 'DAIKITA — Dakwah Pelosok',
    showQris: 'true',
    showRekening: 'true',
    defaultNominal: '50000',
    defaultTglPengingat: '5',
    catatanPembayaran: 'Penyaluran donasi tetap Dakwah Pelosok hanya melalui rekening resmi atau QRIS lembaga.',
    infoRekening: JSON.stringify(INFO_REKENING_DEFAULT),
    enableWaNotif: 'true',
    waEndpointUrl: DEFAULT_WA_ENDPOINT,
    waApiKey: DEFAULT_WA_API_KEY,
    waTemplates: JSON.stringify(DEFAULT_WA_TEMPLATES),
    waFollowupTemplates: JSON.stringify(DEFAULT_WA_FOLLOWUP_TEMPLATES),
    waFollowupDelaySec: '60',
    waReminderTemplates: JSON.stringify(DEFAULT_WA_REMINDER_TEMPLATES),
    showWaGroupPublic: 'true',
    waGroupName: 'Donatur Tetap DAIKITA — Dakwah Pelosok',
    waGroupLink: '',
    waGroupId: '',
    callCenterWa: DEFAULT_CALL_CENTER_WA,
    callCenterLabel: DEFAULT_CALL_CENTER_LABEL,
    waManualConfirmTemplate: DEFAULT_WA_MANUAL_CONFIRM_TEMPLATE,
    enableAdminWaGroupNotif: 'false',
    adminWaGroupName: 'Grup Admin DAIKITA — Dakwah Pelosok',
    adminWaGroupLink: '',
    adminWaGroupId: '',
    enableEmailNotif: 'true',
    emailSenderAlias: DEFAULT_EMAIL_ALIAS,
    emailSenderName: DEFAULT_EMAIL_SENDER_NAME,
    emailTemplateDaftar: JSON.stringify(DEFAULT_EMAIL_TEMPLATE_DAFTAR),
    emailTemplateReminder: JSON.stringify(DEFAULT_EMAIL_TEMPLATE_REMINDER),
    emailTemplates: JSON.stringify([DEFAULT_EMAIL_TEMPLATE_DAFTAR, DEFAULT_EMAIL_TEMPLATE_REMINDER])
  };
}

function writeSettingsMap_(sheet, map) {
  const rows = Object.keys(map).map(function (k) {
    return [k, String(map[k] === undefined || map[k] === null ? '' : map[k])];
  });
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 2).clearContent();
  }
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
  }
}

function parseTemplateArray_(rawJson, fallback) {
  try {
    const parsed = JSON.parse(rawJson || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      const clean = parsed.map(function (t) { return String(t || '').trim(); }).filter(Boolean);
      if (clean.length > 0) return clean;
    }
  } catch (e) {
    // fallback
  }
  return fallback;
}

function parseSingleEmailTemplate_(rawJson, fallback) {
  try {
    const parsed = JSON.parse(rawJson || '{}');
    if (parsed && String(parsed.subject || '').trim() && String(parsed.body || '').trim()) {
      return {
        subject: String(parsed.subject).trim(),
        body: String(parsed.body).trim()
      };
    }
  } catch (e) {
    // fallback
  }
  return fallback;
}

function loadConfigObject_(ss) {
  const defaults = buildDefaultSettingsMap_();
  const sheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
  const rawMap = Object.assign({}, defaults);

  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    data.forEach(function (row) {
      const key = String(row[0] || '').trim();
      const val = row[1];
      if (key) {
        rawMap[key] = val === undefined || val === null ? '' : String(val);
      }
    });
  }

  let parsedRekening = INFO_REKENING_DEFAULT;
  try {
    const candidate = JSON.parse(rawMap.infoRekening || '[]');
    if (Array.isArray(candidate) && candidate.length > 0) {
      parsedRekening = candidate;
    }
  } catch (e) {
    parsedRekening = INFO_REKENING_DEFAULT;
  }

  const parsedWaTemplates = parseTemplateArray_(rawMap.waTemplates, DEFAULT_WA_TEMPLATES);
  const parsedWaFollowupTemplates = parseTemplateArray_(rawMap.waFollowupTemplates, DEFAULT_WA_FOLLOWUP_TEMPLATES);
  const parsedWaReminderTemplates = parseTemplateArray_(rawMap.waReminderTemplates, DEFAULT_WA_REMINDER_TEMPLATES);

  const parsedEmailDaftar = parseSingleEmailTemplate_(rawMap.emailTemplateDaftar, DEFAULT_EMAIL_TEMPLATE_DAFTAR);
  const parsedEmailReminder = parseSingleEmailTemplate_(rawMap.emailTemplateReminder, DEFAULT_EMAIL_TEMPLATE_REMINDER);

  const effectiveWaKey = String(rawMap.waApiKey || '').trim() || DEFAULT_WA_API_KEY;
  const effectiveWaEndpoint = String(rawMap.waEndpointUrl || '').trim() || DEFAULT_WA_ENDPOINT;
  const effectiveEmailAlias = String(rawMap.emailSenderAlias || '').trim() || DEFAULT_EMAIL_ALIAS;
  const effectiveEmailName = String(rawMap.emailSenderName || '').trim() || DEFAULT_EMAIL_SENDER_NAME;
  const delayNum = parseNumber_(rawMap.waFollowupDelaySec);

  return {
    namaLembaga: sanitizeLegacyBrandText_(rawMap.namaLembaga || NAMA_LEMBAGA) || NAMA_LEMBAGA,
    tagline: String(rawMap.tagline || TAGLINE_LEMBAGA).trim() || TAGLINE_LEMBAGA,
    logoUrl: String(rawMap.logoUrl || DEFAULT_LOGO_URL).trim() || DEFAULT_LOGO_URL,
    qrisUrl: String(rawMap.qrisUrl || '').trim(),
    qrisMerchantName: sanitizeLegacyBrandText_(rawMap.qrisMerchantName || NAMA_LEMBAGA) || NAMA_LEMBAGA,
    showQris: String(rawMap.showQris || 'true').toLowerCase() !== 'false',
    showRekening: String(rawMap.showRekening || 'true').toLowerCase() !== 'false',
    defaultNominal: parseNumber_(rawMap.defaultNominal) || 50000,
    defaultTglPengingat: Math.min(31, Math.max(1, parseNumber_(rawMap.defaultTglPengingat) || 5)),
    catatanPembayaran: sanitizeLegacyBrandText_(rawMap.catatanPembayaran || ''),
    infoRekening: parsedRekening,
    enableWaNotif: String(rawMap.enableWaNotif || 'true').toLowerCase() !== 'false',
    waEndpointUrl: effectiveWaEndpoint,
    waApiKey: effectiveWaKey,
    waTemplates: parsedWaTemplates,
    waFollowupTemplates: parsedWaFollowupTemplates,
    waFollowupDelaySec: delayNum >= 15 && delayNum <= 600 ? delayNum : 60,
    waReminderTemplates: parsedWaReminderTemplates,
    showWaGroupPublic: String(rawMap.showWaGroupPublic || 'true').toLowerCase() !== 'false',
    waGroupName: sanitizeLegacyBrandText_(rawMap.waGroupName || 'Donatur Tetap DAIKITA — Dakwah Pelosok'),
    waGroupLink: String(rawMap.waGroupLink || '').trim(),
    waGroupId: String(rawMap.waGroupId || '').trim(),
    callCenterWa: safeNormalizeOrKeep_(rawMap.callCenterWa || ''),
    callCenterLabel: String(rawMap.callCenterLabel || DEFAULT_CALL_CENTER_LABEL).trim() || DEFAULT_CALL_CENTER_LABEL,
    waManualConfirmTemplate:
      String(rawMap.waManualConfirmTemplate || '').trim() || DEFAULT_WA_MANUAL_CONFIRM_TEMPLATE,
    enableAdminWaGroupNotif: String(rawMap.enableAdminWaGroupNotif || 'false').toLowerCase() === 'true',
    adminWaGroupName: sanitizeLegacyBrandText_(rawMap.adminWaGroupName || 'Grup Admin DAIKITA — Dakwah Pelosok'),
    adminWaGroupLink: String(rawMap.adminWaGroupLink || '').trim(),
    adminWaGroupId: String(rawMap.adminWaGroupId || '').trim(),
    enableEmailNotif: String(rawMap.enableEmailNotif || 'true').toLowerCase() !== 'false',
    emailSenderAlias: effectiveEmailAlias,
    emailSenderName: sanitizeLegacyBrandText_(effectiveEmailName) || DEFAULT_EMAIL_SENDER_NAME,
    emailTemplateDaftar: parsedEmailDaftar,
    emailTemplateReminder: parsedEmailReminder,
    emailTemplates: [parsedEmailDaftar, parsedEmailReminder]
  };
}

function handleSavePengaturan_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
  }

  const current = loadConfigObject_(ss);
  let logoUrl = payload.logoUrl !== undefined ? String(payload.logoUrl || '').trim() : current.logoUrl;
  let qrisUrl = payload.qrisUrl !== undefined ? String(payload.qrisUrl || '').trim() : current.qrisUrl;

  if (payload.logoBase64) {
    const logoUpload = uploadAssetToDrive_({
      fileBase64: String(payload.logoBase64),
      fileMimeType: String(payload.logoMimeType || 'image/png'),
      fileName: String(payload.logoFileName || 'logo-lembaga.png'),
      prefix: 'LOGO'
    });
    logoUrl = logoUpload.directImageUrl;
  }

  if (payload.qrisBase64) {
    const qrisUpload = uploadAssetToDrive_({
      fileBase64: String(payload.qrisBase64),
      fileMimeType: String(payload.qrisMimeType || 'image/png'),
      fileName: String(payload.qrisFileName || 'qris-lembaga.png'),
      prefix: 'QRIS'
    });
    qrisUrl = qrisUpload.directImageUrl;
  }

  const rekeningInput = Array.isArray(payload.infoRekening)
    ? payload.infoRekening
        .map(function (r) {
          return {
            bank: String((r && r.bank) || '').trim(),
            nomor: String((r && r.nomor) || '').trim(),
            atasNama: String((r && r.atasNama) || '').trim()
          };
        })
        .filter(function (r) {
          return r.bank !== '' && r.nomor !== '';
        })
    : current.infoRekening;

  const waTemplatesInput = Array.isArray(payload.waTemplates)
    ? payload.waTemplates.map(function (t) { return String(t || '').trim(); }).filter(Boolean)
    : current.waTemplates;

  const waFollowupInput = Array.isArray(payload.waFollowupTemplates)
    ? payload.waFollowupTemplates.map(function (t) { return String(t || '').trim(); }).filter(Boolean)
    : current.waFollowupTemplates;

  const waReminderInput = Array.isArray(payload.waReminderTemplates)
    ? payload.waReminderTemplates.map(function (t) { return String(t || '').trim(); }).filter(Boolean)
    : current.waReminderTemplates;

  const emailDaftarInput =
    payload.emailTemplateDaftar &&
    String(payload.emailTemplateDaftar.subject || '').trim() &&
    String(payload.emailTemplateDaftar.body || '').trim()
      ? {
          subject: String(payload.emailTemplateDaftar.subject).trim(),
          body: String(payload.emailTemplateDaftar.body).trim()
        }
      : current.emailTemplateDaftar;

  const emailReminderInput =
    payload.emailTemplateReminder &&
    String(payload.emailTemplateReminder.subject || '').trim() &&
    String(payload.emailTemplateReminder.body || '').trim()
      ? {
          subject: String(payload.emailTemplateReminder.subject).trim(),
          body: String(payload.emailTemplateReminder.body).trim()
        }
      : current.emailTemplateReminder;

  const delayVal = parseNumber_(payload.waFollowupDelaySec);
  const safeDelay = delayVal >= 15 && delayVal <= 600 ? delayVal : current.waFollowupDelaySec || 60;

  const rawCallCenterWa =
    payload.callCenterWa !== undefined ? String(payload.callCenterWa || '').trim() : current.callCenterWa;
  const cleanCallCenterWa = rawCallCenterWa ? safeNormalizeOrKeep_(rawCallCenterWa) : '';

  const updatedMap = {
    namaLembaga: sanitizeLegacyBrandText_(payload.namaLembaga || current.namaLembaga) || NAMA_LEMBAGA,
    tagline: String(payload.tagline || current.tagline).trim() || TAGLINE_LEMBAGA,
    logoUrl: logoUrl,
    qrisUrl: qrisUrl,
    qrisMerchantName: sanitizeLegacyBrandText_(
      payload.qrisMerchantName !== undefined ? payload.qrisMerchantName : current.qrisMerchantName
    ),
    showQris: payload.showQris === false ? 'false' : 'true',
    showRekening: payload.showRekening === false ? 'false' : 'true',
    defaultNominal: String(parseNumber_(payload.defaultNominal) || current.defaultNominal || 50000),
    defaultTglPengingat: String(Math.min(31, Math.max(1, parseNumber_(payload.defaultTglPengingat) || current.defaultTglPengingat || 5))),
    catatanPembayaran: sanitizeLegacyBrandText_(
      payload.catatanPembayaran !== undefined ? payload.catatanPembayaran : current.catatanPembayaran
    ),
    infoRekening: JSON.stringify(rekeningInput.length > 0 ? rekeningInput : current.infoRekening),
    enableWaNotif: payload.enableWaNotif === false ? 'false' : 'true',
    waEndpointUrl: String(payload.waEndpointUrl !== undefined ? payload.waEndpointUrl : current.waEndpointUrl).trim() || DEFAULT_WA_ENDPOINT,
    waApiKey: String(payload.waApiKey !== undefined ? payload.waApiKey : current.waApiKey).trim() || DEFAULT_WA_API_KEY,
    waTemplates: JSON.stringify(waTemplatesInput.length > 0 ? waTemplatesInput : current.waTemplates),
    waFollowupTemplates: JSON.stringify(waFollowupInput.length > 0 ? waFollowupInput : current.waFollowupTemplates),
    waFollowupDelaySec: String(safeDelay),
    waReminderTemplates: JSON.stringify(waReminderInput.length > 0 ? waReminderInput : current.waReminderTemplates),
    showWaGroupPublic: payload.showWaGroupPublic === false ? 'false' : 'true',
    waGroupName: sanitizeLegacyBrandText_(
      payload.waGroupName !== undefined ? payload.waGroupName : current.waGroupName
    ),
    waGroupLink: String(payload.waGroupLink !== undefined ? payload.waGroupLink : current.waGroupLink).trim(),
    waGroupId: String(payload.waGroupId !== undefined ? payload.waGroupId : current.waGroupId).trim(),
    callCenterWa: cleanCallCenterWa,
    callCenterLabel:
      String(payload.callCenterLabel !== undefined ? payload.callCenterLabel : current.callCenterLabel).trim() ||
      DEFAULT_CALL_CENTER_LABEL,
    waManualConfirmTemplate:
      String(
        payload.waManualConfirmTemplate !== undefined
          ? payload.waManualConfirmTemplate
          : current.waManualConfirmTemplate
      ).trim() || DEFAULT_WA_MANUAL_CONFIRM_TEMPLATE,
    enableAdminWaGroupNotif: payload.enableAdminWaGroupNotif === true ? 'true' : 'false',
    adminWaGroupName: sanitizeLegacyBrandText_(
      payload.adminWaGroupName !== undefined ? payload.adminWaGroupName : current.adminWaGroupName
    ),
    adminWaGroupLink: String(payload.adminWaGroupLink !== undefined ? payload.adminWaGroupLink : current.adminWaGroupLink).trim(),
    adminWaGroupId: String(payload.adminWaGroupId !== undefined ? payload.adminWaGroupId : current.adminWaGroupId).trim(),
    enableEmailNotif: payload.enableEmailNotif === false ? 'false' : 'true',
    emailSenderAlias: String(payload.emailSenderAlias !== undefined ? payload.emailSenderAlias : current.emailSenderAlias).trim() || DEFAULT_EMAIL_ALIAS,
    emailSenderName:
      sanitizeLegacyBrandText_(
        payload.emailSenderName !== undefined ? payload.emailSenderName : current.emailSenderName
      ) || DEFAULT_EMAIL_SENDER_NAME,
    emailTemplateDaftar: JSON.stringify(emailDaftarInput),
    emailTemplateReminder: JSON.stringify(emailReminderInput),
    emailTemplates: JSON.stringify([emailDaftarInput, emailReminderInput])
  };

  writeSettingsMap_(sheet, updatedMap);
  SpreadsheetApp.flush();
  invalidatePublicConfigCache_();

  return {
    status: 'success',
    message: 'Pengaturan aplikasi berhasil disimpan.',
    data: {
      config: loadConfigObject_(ss)
    }
  };
}

function upsertSettingKey_(sheet, keyName, valueStr) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0] || '').trim() === keyName) {
        sheet.getRange(i + 2, 2).setNumberFormat('@').setValue(valueStr);
        return;
      }
    }
  }
  sheet.getRange(lastRow + 1, 1, 1, 2).setNumberFormat('@').setValues([[keyName, valueStr]]);
}

function ensureMigratedDefaultLogo_(ss) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('MIGRATED_LOGO_1OOSQ') === '1') return;
    const sheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
    if (sheet) {
      upsertSettingKey_(sheet, 'logoUrl', DEFAULT_LOGO_URL);
    }
    props.setProperty('MIGRATED_LOGO_1OOSQ', '1');
  } catch (err) {
    Logger.log('Info migrasi logo default: ' + err);
  }
}

function ensureMigratedDefaultRekeningAndTemplates_(ss) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('MIGRATED_BSI_7777767407_V2') === '1') return;
    const sheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
    if (sheet && sheet.getLastRow() > 1) {
      const cfg = loadConfigObject_(ss);
      const hasOldDummyRek = cfg.infoRekening.some(function (r) {
        return String(r.nomor || '').trim() === '7123456789';
      });
      if (hasOldDummyRek) {
        upsertSettingKey_(sheet, 'infoRekening', JSON.stringify(INFO_REKENING_DEFAULT));
      }
      const hasOldAmanahTpl = cfg.waTemplates.some(function (t) {
        return t.indexOf('Ringkasan Amanah Anda') !== -1;
      });
      if (hasOldAmanahTpl) {
        upsertSettingKey_(sheet, 'waTemplates', JSON.stringify(DEFAULT_WA_TEMPLATES));
      }
      upsertSettingKey_(sheet, 'waFollowupTemplates', JSON.stringify(DEFAULT_WA_FOLLOWUP_TEMPLATES));
      upsertSettingKey_(sheet, 'waFollowupDelaySec', '60');
      upsertSettingKey_(sheet, 'waReminderTemplates', JSON.stringify(DEFAULT_WA_REMINDER_TEMPLATES));
      upsertSettingKey_(sheet, 'emailTemplateDaftar', JSON.stringify(DEFAULT_EMAIL_TEMPLATE_DAFTAR));
      upsertSettingKey_(sheet, 'emailTemplateReminder', JSON.stringify(DEFAULT_EMAIL_TEMPLATE_REMINDER));
    }
    props.setProperty('MIGRATED_BSI_7777767407_V2', '1');
  } catch (err) {
    Logger.log('Info migrasi rekening/template: ' + err);
  }
}

function ensureMigratedV3GrupFollowupAndNonAktif_(ss) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('MIGRATED_V3_GRUP_FOLLOWUP_NONAKTIF') === '1') return;

    // 1. Pastikan template WA Pesan 2 (Save Nomor) memuat {link_grup_section}
    const cfgSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
    if (cfgSheet && cfgSheet.getLastRow() > 1) {
      const cfg = loadConfigObject_(ss);
      const updatedFollowups = (cfg.waFollowupTemplates || DEFAULT_WA_FOLLOWUP_TEMPLATES).map(function (t) {
        const s = String(t || '').trim();
        if (!s) return s;
        if (s.indexOf('{link_grup') === -1) {
          return s + '\n{link_grup_section}';
        }
        return s;
      });
      upsertSettingKey_(cfgSheet, 'waFollowupTemplates', JSON.stringify(updatedFollowups));
    }

    // 2. Migrasi aman status 'Cuti' -> 'Non Aktif' pada Master_Donatur
    const donorSheet = ss.getSheetByName(SHEET_NAMES.DONATUR);
    if (donorSheet && donorSheet.getLastRow() > 1) {
      const idxMap = getHeaderIndexMap_(donorSheet);
      const statusCol = idxMap.Status_Aktif;
      if (statusCol) {
        const numRows = donorSheet.getLastRow() - 1;
        const vals = donorSheet.getRange(2, statusCol, numRows, 1).getValues();
        let changed = false;
        for (let i = 0; i < vals.length; i++) {
          const cur = String(vals[i][0] || '').trim().toLowerCase();
          if (cur === 'cuti') {
            vals[i][0] = 'Non Aktif';
            changed = true;
          }
        }
        if (changed) {
          donorSheet.getRange(2, statusCol, numRows, 1).setNumberFormat('@').setValues(vals);
        }
      }
    }

    props.setProperty('MIGRATED_V3_GRUP_FOLLOWUP_NONAKTIF', '1');
  } catch (err) {
    Logger.log('Info migrasi V3: ' + err);
  }
}

function backfillDonasiLainnyaSheet_(ss) {
  try {
    const trxSheet = ss.getSheetByName(SHEET_NAMES.TRANSAKSI);
    const otherSheet = ss.getSheetByName(SHEET_NAMES.DONASI_LAINNYA);
    if (!trxSheet || !otherSheet) return;

    const existingOtherIds = {};
    readSheetAsObjects_(otherSheet).forEach(function (row) {
      const id = String(row.ID_Transaksi || '').trim();
      if (id) existingOtherIds[id] = true;
    });

    const allTrx = readSheetAsObjects_(trxSheet);
    allTrx.forEach(function (row) {
      const idTrx = String(row.ID_Transaksi || '').trim();
      if (!idTrx || existingOtherIds[idTrx]) return;
      const jenis = normalizeJenisDonatur_(row.Jenis_Donatur, row.ID_Donatur);
      const donasiLainnya = Math.max(0, parseNumber_(row.Donasi_Lainnya));
      const nominalTransfer = parseNumber_(row.Nominal_Transfer);
      const nominalKomitmen = parseNumber_(row.Nominal_Komitmen);
      if (jenis === 'Umum' || donasiLainnya > 0) {
        appendDonasiLainnyaRow_(ss, {
          idTransaksi: idTrx,
          tanggalTransfer: formatIsoDateCell_(row.Tanggal_Transfer) || formatCellDateString_(row.Waktu_Input).substring(0, 10),
          bulanTagihan: formatBulanTagihan_(row.Bulan_Tagihan),
          jenisSumber: jenis === 'Umum' ? 'Donatur Insidentil' : 'Donasi Umum (Kelebihan Komitmen)',
          idDonatur: String(row.ID_Donatur || (jenis === 'Umum' ? 'UMUM' : '-')).trim(),
          namaDonatur: String(row.Nama_Donatur || 'Hamba Allah').trim(),
          noWa: safeNormalizeOrKeep_(row.No_WA),
          nominalKomitmen: jenis === 'Umum' ? 0 : nominalKomitmen,
          nominalDonasiLainnya: jenis === 'Umum' ? nominalTransfer : donasiLainnya,
          totalTransfer: nominalTransfer,
          statusVerifikasi: String(row.Status_Verifikasi || 'Pending').trim(),
          keterangan: String(row.Keterangan || '').trim(),
          linkBuktiDrive: String(row.Link_Bukti_Drive || '').trim()
        });
        existingOtherIds[idTrx] = true;
      }
    });
  } catch (err) {
    Logger.log('Info backfill Donasi_Lainnya: ' + err);
  }
}

function appendDonasiLainnyaRow_(ss, item) {
  let otherSheet = ss.getSheetByName(SHEET_NAMES.DONASI_LAINNYA);
  if (!otherSheet) {
    otherSheet = ensureSheetWithHeaders_(ss, SHEET_NAMES.DONASI_LAINNYA, HEADERS.Donasi_Lainnya, {
      textHeaders: [
        'ID_Transaksi',
        'Tanggal_Transfer',
        'Bulan_Tagihan',
        'Jenis_Sumber',
        'ID_Donatur',
        'No_WA',
        'Status_Verifikasi',
        'Keterangan'
      ],
      currencyHeaders: ['Nominal_Komitmen', 'Nominal_Donasi_Lainnya', 'Total_Transfer']
    });
  }
  appendRowByHeaderMap_(otherSheet, {
    ID_Transaksi: String(item.idTransaksi || ''),
    Tanggal_Transfer: String(item.tanggalTransfer || ''),
    Bulan_Tagihan: String(item.bulanTagihan || ''),
    Jenis_Sumber: String(item.jenisSumber || 'Kelebihan Komitmen'),
    ID_Donatur: String(item.idDonatur || '-'),
    Nama_Donatur: String(item.namaDonatur || 'Hamba Allah'),
    No_WA: String(item.noWa || ''),
    Nominal_Komitmen: Math.max(0, parseNumber_(item.nominalKomitmen)),
    Nominal_Donasi_Lainnya: Math.max(0, parseNumber_(item.nominalDonasiLainnya)),
    Total_Transfer: Math.max(0, parseNumber_(item.totalTransfer)),
    Status_Verifikasi: String(item.statusVerifikasi || 'Pending'),
    Keterangan: String(item.keterangan || ''),
    Link_Bukti_Drive: String(item.linkBuktiDrive || '')
  }, [
    'ID_Transaksi',
    'Tanggal_Transfer',
    'Bulan_Tagihan',
    'Jenis_Sumber',
    'ID_Donatur',
    'No_WA',
    'Status_Verifikasi',
    'Keterangan'
  ], ['Nominal_Komitmen', 'Nominal_Donasi_Lainnya', 'Total_Transfer']);
}

// ==================== AUTH ADMIN, PUBLIC CONFIG & LOOKUP DONATUR ====================
function normalizeAdminRole_(rawRole) {
  const r = String(rawRole || '').trim().toLowerCase();
  if (r === 'super admin' || r === 'superadmin' || r === 'super_admin') return 'Super Admin';
  return 'Admin';
}

function readAdminAksesList_(ss) {
  let sheet = ss.getSheetByName(SHEET_NAMES.AKSES_ADMIN);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(SHEET_NAMES.AKSES_ADMIN);
  }
  if (!sheet) return [];
  return readSheetAsObjects_(sheet).map(function (row) {
    return {
      noWa: safeNormalizeOrKeep_(row.No_WA),
      nama: String(row.Nama || '').trim(),
      role: normalizeAdminRole_(row.Role),
      status: normalizeStatusAktif_(row.Status),
      catatan: String(row.Catatan || '').trim()
    };
  }).filter(function (item) {
    return item.noWa !== '';
  });
}

function createAdminSession_(adminEntry) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const sessionObj = {
    noWa: adminEntry.noWa,
    nama: adminEntry.nama,
    role: adminEntry.role,
    loginAt: formatTimestamp_(new Date())
  };
  CacheService.getScriptCache().put('ADM_SESS_' + token, JSON.stringify(sessionObj), ADMIN_SESSION_TTL_SEC);
  return {
    token: token,
    admin: sessionObj
  };
}

function verifyAdminSession_(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken || cleanToken.length < 16) return null;
  const cached = CacheService.getScriptCache().get('ADM_SESS_' + cleanToken);
  if (!cached) return null;

  let parsed;
  try {
    parsed = JSON.parse(cached);
  } catch (err) {
    return null;
  }
  if (!parsed || !parsed.noWa) return null;

  // Verifikasi ulang ke sheet Akses_Admin agar pencabutan/ubah role berlaku langsung
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const list = readAdminAksesList_(ss);
  const matched = list.find(function (item) {
    return item.noWa === parsed.noWa && item.status === 'Aktif';
  });
  if (!matched) {
    CacheService.getScriptCache().remove('ADM_SESS_' + cleanToken);
    return null;
  }

  return {
    noWa: matched.noWa,
    nama: matched.nama || parsed.nama,
    role: matched.role,
    loginAt: parsed.loginAt || ''
  };
}

function requireAdminRole_(token, requiredRole) {
  const admin = verifyAdminSession_(token);
  if (!admin) {
    return {
      ok: false,
      response: {
        status: 'error',
        code: 'AUTH_REQUIRED',
        message: 'Sesi login Admin tidak valid atau telah berakhir. Silakan login kembali dengan nomor HP terdaftar.'
      }
    };
  }
  if (requiredRole === 'Super Admin' && admin.role !== 'Super Admin') {
    return {
      ok: false,
      response: {
        status: 'error',
        code: 'FORBIDDEN',
        message: 'Akses ditolak. Fitur ini hanya dapat diakses oleh Super Admin.'
      }
    };
  }
  return { ok: true, admin: admin };
}

function handleLoginAdmin_(payload) {
  const rawWa = String(payload.noWa || '').trim();
  if (!rawWa) {
    return { status: 'error', message: 'Masukkan nomor HP / WhatsApp terlebih dahulu.' };
  }
  const waCheck = validateAndNormalizeWA_(rawWa);
  if (!waCheck.valid) {
    return { status: 'error', message: waCheck.error };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aksesList = readAdminAksesList_(ss);
  const matched = aksesList.find(function (item) {
    return item.noWa === waCheck.normalized;
  });

  if (!matched) {
    return {
      status: 'error',
      code: 'ADMIN_NOT_FOUND',
      message: 'Nomor ' + waCheck.normalized + ' tidak terdaftar sebagai Admin atau Super Admin. Hubungi Super Admin untuk mendaftarkan nomor Anda.'
    };
  }

  if (matched.status !== 'Aktif') {
    return {
      status: 'error',
      code: 'ADMIN_INACTIVE',
      message: 'Akses Admin untuk nomor ' + waCheck.normalized + ' sedang berstatus Non Aktif.'
    };
  }

  const session = createAdminSession_(matched);
  return {
    status: 'success',
    message: 'Login berhasil sebagai ' + matched.role + ' (' + (matched.nama || matched.noWa) + ').',
    data: session
  };
}

function invalidatePublicConfigCache_() {
  try {
    CacheService.getScriptCache().remove(PUB_CONFIG_CACHE_KEY);
  } catch (e) {
    // abaikan error cache
  }
}

function invalidateDonorLookupCache_(noWa) {
  const norm = safeNormalizeOrKeep_(noWa);
  if (!norm) return;
  try {
    CacheService.getScriptCache().remove(LOOKUP_CACHE_PREFIX + norm);
  } catch (e) {
    // abaikan error cache
  }
}

function invalidateDonorLookupCacheList_(waList) {
  if (!Array.isArray(waList) || waList.length === 0) return;
  const keys = [];
  const seen = {};
  for (let i = 0; i < waList.length; i++) {
    const norm = safeNormalizeOrKeep_(waList[i]);
    if (norm && !seen[norm]) {
      seen[norm] = true;
      keys.push(LOOKUP_CACHE_PREFIX + norm);
    }
  }
  if (keys.length === 0) return;
  try {
    const cache = CacheService.getScriptCache();
    // removeAll menerima array kunci
    for (let i = 0; i < keys.length; i += 100) {
      cache.removeAll(keys.slice(i, i + 100));
    }
  } catch (e) {
    // abaikan error cache
  }
}

function getPublicConfig_() {
  try {
    const cached = CacheService.getScriptCache().get(PUB_CONFIG_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.config) return parsed;
    }
  } catch (e) {
    // lanjut baca sheet
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_NAMES.PENGATURAN)) {
    setupDatabase();
  }
  const fullCfg = loadConfigObject_(ss);

  // Strip kunci rahasia (waApiKey, waEndpointUrl, grup WA admin, dll.) dari respons publik
  const publicConfig = {
    namaLembaga: fullCfg.namaLembaga,
    tagline: fullCfg.tagline,
    logoUrl: fullCfg.logoUrl,
    qrisUrl: fullCfg.qrisUrl,
    qrisMerchantName: fullCfg.qrisMerchantName,
    showQris: fullCfg.showQris,
    showRekening: fullCfg.showRekening,
    defaultNominal: fullCfg.defaultNominal,
    defaultTglPengingat: fullCfg.defaultTglPengingat,
    catatanPembayaran: fullCfg.catatanPembayaran,
    infoRekening: fullCfg.infoRekening,
    enableWaNotif: false,
    waEndpointUrl: '',
    waApiKey: '',
    waTemplates: [],
    waFollowupTemplates: [],
    waFollowupDelaySec: fullCfg.waFollowupDelaySec,
    waReminderTemplates: [],
    showWaGroupPublic: fullCfg.showWaGroupPublic,
    waGroupName: fullCfg.waGroupName,
    waGroupLink: fullCfg.waGroupLink,
    waGroupId: '',
    callCenterWa: fullCfg.callCenterWa,
    callCenterLabel: fullCfg.callCenterLabel,
    waManualConfirmTemplate: fullCfg.waManualConfirmTemplate,
    enableAdminWaGroupNotif: false,
    adminWaGroupName: '',
    adminWaGroupLink: '',
    adminWaGroupId: '',
    enableEmailNotif: false,
    emailSenderAlias: '',
    emailSenderName: fullCfg.emailSenderName,
    emailTemplateDaftar: { subject: '', body: '' },
    emailTemplateReminder: { subject: '', body: '' },
    emailTemplates: []
  };

  const payload = {
    config: publicConfig,
    panitia: []
  };

  try {
    CacheService.getScriptCache().put(
      PUB_CONFIG_CACHE_KEY,
      JSON.stringify(payload),
      PUB_CONFIG_CACHE_TTL_SEC
    );
  } catch (e) {
    // abaikan error cache
  }

  return payload;
}

function rowArrayToHeaderObject_(headers, rowVals) {
  const obj = {};
  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c] || '').trim();
    if (h) obj[h] = rowVals[c];
  }
  return obj;
}

function findDonorRowFast_(donaturSheet, normalizedWa) {
  const lastRow = donaturSheet.getLastRow();
  const lastCol = donaturSheet.getLastColumn();
  if (lastRow <= 1 || lastCol <= 0) return null;

  const headers = donaturSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let waCol = 0;
  for (let c = 0; c < headers.length; c++) {
    if (String(headers[c] || '').trim() === 'No_WA') {
      waCol = c + 1;
      break;
    }
  }
  if (!waCol) return null;

  const colRange = donaturSheet.getRange(2, waCol, lastRow - 1, 1);

  // 1. Exact match via TextFinder (sangat cepat bahkan untuk puluhan ribu baris)
  const exactCell = colRange.createTextFinder(normalizedWa).matchEntireCell(true).findNext();
  if (exactCell) {
    const rowVals = donaturSheet.getRange(exactCell.getRow(), 1, 1, lastCol).getValues()[0];
    return rowArrayToHeaderObject_(headers, rowVals);
  }

  // 2. Fallback untuk nomor lama yang mungkin masih tersimpan format 08... atau +628...
  const suffix = normalizedWa.replace(/^62/, '');
  if (suffix && suffix.length >= 8) {
    const partialMatches = colRange.createTextFinder(suffix).matchEntireCell(false).findAll();
    for (let i = 0; i < partialMatches.length; i++) {
      const candidateVal = partialMatches[i].getValue();
      if (safeNormalizeOrKeep_(candidateVal) === normalizedWa) {
        const rowVals = donaturSheet.getRange(partialMatches[i].getRow(), 1, 1, lastCol).getValues()[0];
        return rowArrayToHeaderObject_(headers, rowVals);
      }
    }
  }

  return null;
}

function findDonorTransactionsFast_(txSheet, idDonatur, normalizedWa) {
  const lastRow = txSheet.getLastRow();
  const lastCol = txSheet.getLastColumn();
  if (lastRow <= 1 || lastCol <= 0) return [];

  const headers = txSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let idCol = 0;
  let waCol = 0;
  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c] || '').trim();
    if (h === 'ID_Donatur') idCol = c + 1;
    if (h === 'No_WA') waCol = c + 1;
  }

  const matchedRowMap = {};
  if (idCol && idDonatur) {
    const idHits = txSheet
      .getRange(2, idCol, lastRow - 1, 1)
      .createTextFinder(idDonatur)
      .matchEntireCell(true)
      .findAll();
    for (let i = 0; i < idHits.length; i++) {
      matchedRowMap[idHits[i].getRow()] = true;
    }
  }

  if (waCol && normalizedWa) {
    const waColRange = txSheet.getRange(2, waCol, lastRow - 1, 1);
    const waHits = waColRange.createTextFinder(normalizedWa).matchEntireCell(true).findAll();
    for (let i = 0; i < waHits.length; i++) {
      matchedRowMap[waHits[i].getRow()] = true;
    }
    const suffix = normalizedWa.replace(/^62/, '');
    if (waHits.length === 0 && suffix && suffix.length >= 8) {
      const partialWaHits = waColRange.createTextFinder(suffix).matchEntireCell(false).findAll();
      for (let i = 0; i < partialWaHits.length; i++) {
        if (safeNormalizeOrKeep_(partialWaHits[i].getValue()) === normalizedWa) {
          matchedRowMap[partialWaHits[i].getRow()] = true;
        }
      }
    }
  }

  const rowNums = Object.keys(matchedRowMap)
    .map(function (k) { return parseInt(k, 10); })
    .filter(function (n) { return !isNaN(n) && n >= 2; })
    .sort(function (a, b) { return a - b; });

  if (rowNums.length === 0) return [];

  // Baca baris yang cocok secara ringkas (grupkan baris berurutan atau pakai RangeList)
  const rawObjects = [];
  const a1Ranges = rowNums.map(function (r) {
    return txSheet.getRange(r, 1, 1, lastCol).getA1Notation();
  });

  // Batch via getRangeList untuk meminimalkan RPC ke Google Sheets
  const CHUNK_SIZE = 40;
  for (let start = 0; start < a1Ranges.length; start += CHUNK_SIZE) {
    const slice = a1Ranges.slice(start, start + CHUNK_SIZE);
    const ranges = txSheet.getRangeList(slice).getRanges();
    for (let i = 0; i < ranges.length; i++) {
      const vals = ranges[i].getValues()[0];
      rawObjects.push(rowArrayToHeaderObject_(headers, vals));
    }
  }

  return rawObjects;
}

function handleLookupDonaturByWa_(payload) {
  const rawWa = String(payload.noWa || '').trim();
  if (!rawWa) {
    return { status: 'error', message: 'Masukkan nomor WhatsApp terlebih dahulu.' };
  }
  const waCheck = validateAndNormalizeWA_(rawWa);
  if (!waCheck.valid) {
    return { status: 'error', message: waCheck.error };
  }

  const normalizedWa = waCheck.normalized;
  const forceRefresh = Boolean(payload.forceRefresh);
  const cacheKey = LOOKUP_CACHE_PREFIX + normalizedWa;

  if (!forceRefresh) {
    try {
      const cachedRaw = CacheService.getScriptCache().get(cacheKey);
      if (cachedRaw) {
        const cachedData = JSON.parse(cachedRaw);
        if (cachedData && typeof cachedData.found === 'boolean') {
          return {
            status: 'success',
            message: cachedData.found
              ? 'Data donatur ditemukan.'
              : 'Nomor belum terdaftar sebagai donatur.',
            data: cachedData
          };
        }
      }
    } catch (e) {
      // lanjut lookup langsung ke sheet
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const donaturSheet = ss.getSheetByName(SHEET_NAMES.DONATUR);
  const txSheet = ss.getSheetByName(SHEET_NAMES.TRANSAKSI);
  if (!donaturSheet || !txSheet) {
    setupDatabase();
  }

  const matchedRow = findDonorRowFast_(ss.getSheetByName(SHEET_NAMES.DONATUR), normalizedWa);

  if (!matchedRow) {
    const notFoundData = {
      found: false,
      normalizedWa: normalizedWa
    };
    try {
      CacheService.getScriptCache().put(cacheKey, JSON.stringify(notFoundData), 60);
    } catch (e) {
      // abaikan
    }
    return {
      status: 'success',
      message: 'Nomor belum terdaftar sebagai donatur.',
      data: notFoundData
    };
  }

  const donatur = {
    idDonatur: String(matchedRow.ID_Donatur || '').trim(),
    tanggalDaftar: formatCellDateString_(matchedRow.Tanggal_Daftar),
    namaLengkap: String(matchedRow.Nama_Lengkap || '').trim(),
    jenisKelamin: normalizeJenisKelamin_(matchedRow.Jenis_Kelamin),
    noWa: safeNormalizeOrKeep_(matchedRow.No_WA),
    email: String(matchedRow.Email || '').trim(),
    kabId: String(matchedRow.Kab_ID || '').trim(),
    domisili: String(matchedRow.Domisili || '').trim(),
    provinsi: String(matchedRow.Provinsi || '').trim(),
    pulau: String(matchedRow.Pulau || '').trim(),
    nominalKomitmen: parseNumber_(matchedRow.Nominal_Komitmen),
    tglJatuhTempo: parseNumber_(matchedRow.Tgl_Jatuh_Tempo) || 1,
    metodeDaftar: String(matchedRow.Metode_Daftar || 'Mandiri').trim(),
    kodePerantara: String(matchedRow.Kode_Perantara || '').trim(),
    namaPerantara: String(matchedRow.Nama_Perantara || '-').trim(),
    statusAktif: normalizeStatusAktif_(matchedRow.Status_Aktif),
    minatGrupWa: normalizeMinatGrup_(matchedRow.Minat_Grup_WA),
    statusGrupWa: normalizeStatusGrup_(matchedRow.Status_Grup_WA)
  };

  // Ambil hanya baris transaksi milik donatur ini via TextFinder (tanpa scan seluruh sheet)
  const rawTxRows = findDonorTransactionsFast_(
    ss.getSheetByName(SHEET_NAMES.TRANSAKSI),
    donatur.idDonatur,
    normalizedWa
  );

  const transaksi = rawTxRows
    .filter(function (row) {
      const jenis = normalizeJenisDonatur_(row.Jenis_Donatur, row.ID_Donatur);
      if (jenis === 'Umum') return false;
      const idMatch = donatur.idDonatur && String(row.ID_Donatur || '').trim() === donatur.idDonatur;
      const waMatch = safeNormalizeOrKeep_(row.No_WA) === normalizedWa;
      return idMatch || waMatch;
    })
    .map(function (row) {
      const waktuInput = formatCellDateString_(row.Waktu_Input);
      const tanggalTransfer = formatIsoDateCell_(row.Tanggal_Transfer) || waktuInput.substring(0, 10);
      const nominalTransfer = parseNumber_(row.Nominal_Transfer);
      const donasiLainnya = Math.max(0, parseNumber_(row.Donasi_Lainnya));
      const nominalKomitmenRaw = parseNumber_(row.Nominal_Komitmen);
      const nominalKomitmen = nominalKomitmenRaw > 0
        ? nominalKomitmenRaw
        : Math.max(0, nominalTransfer - donasiLainnya);

      return {
        idTransaksi: String(row.ID_Transaksi || '').trim(),
        waktuInput: waktuInput,
        tanggalTransfer: tanggalTransfer,
        jenisDonatur: 'Rutin',
        idDonatur: String(row.ID_Donatur || '').trim(),
        namaDonatur: String(row.Nama_Donatur || '').trim(),
        noWa: safeNormalizeOrKeep_(row.No_WA),
        bulanTagihan: formatBulanTagihan_(row.Bulan_Tagihan),
        nominalKomitmen: nominalKomitmen,
        donasiLainnya: donasiLainnya,
        nominalTransfer: nominalTransfer,
        bankTujuan: String(row.Bank_Tujuan || '').trim(),
        linkBuktiDrive: String(row.Link_Bukti_Drive || '').trim(),
        statusVerifikasi: String(row.Status_Verifikasi || 'Pending').trim(),
        diinputOleh: String(row.Diinput_Oleh || '').trim(),
        keterangan: String(row.Keterangan || '').trim()
      };
    })
    .filter(function (t) {
      return t.idTransaksi !== '';
    })
    .sort(function (a, b) {
      return (b.tanggalTransfer || b.waktuInput).localeCompare(a.tanggalTransfer || a.waktuInput);
    });

  const foundData = {
    found: true,
    normalizedWa: normalizedWa,
    donatur: donatur,
    transaksi: transaksi
  };

  try {
    const serialized = JSON.stringify(foundData);
    if (serialized.length < 95000) {
      CacheService.getScriptCache().put(cacheKey, serialized, LOOKUP_CACHE_TTL_SEC);
    }
  } catch (e) {
    // abaikan jika melebihi kapasitas cache
  }

  return {
    status: 'success',
    message: 'Data donatur ditemukan.',
    data: foundData
  };
}

function getAdminDataset_(adminUser) {
  const full = getInitialData_();
  const isSuperAdmin = adminUser && adminUser.role === 'Super Admin';
  const safeConfig = Object.assign({}, full.config);
  if (!isSuperAdmin) {
    safeConfig.waApiKey = '';
    safeConfig.adminWaGroupId = '';
    safeConfig.adminWaGroupLink = '';
  }
  return {
    config: safeConfig,
    donatur: full.donatur,
    transaksi: full.transaksi,
    panitia: [],
    antreanPesan: full.antreanPesan,
    adminAkses: isSuperAdmin ? readAdminAksesList_(SpreadsheetApp.getActiveSpreadsheet()) : []
  };
}

// ==================== HANDLER DATA UTAMA ====================
function getInitialData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_NAMES.DONATUR) ||
      !ss.getSheetByName(SHEET_NAMES.TRANSAKSI) ||
      !ss.getSheetByName(SHEET_NAMES.DONASI_LAINNYA) ||
      !ss.getSheetByName(SHEET_NAMES.AKSES_ADMIN) ||
      !ss.getSheetByName(SHEET_NAMES.PENGATURAN) ||
      !ss.getSheetByName(SHEET_NAMES.ANTREAN)) {
    setupDatabase();
  } else {
    ensureMigratedDefaultLogo_(ss);
    ensureMigratedDefaultRekeningAndTemplates_(ss);
    ensureMigratedV3GrupFollowupAndNonAktif_(ss);
  }

  const config = loadConfigObject_(ss);

  const donatur = readSheetAsObjects_(ss.getSheetByName(SHEET_NAMES.DONATUR)).map(function (row) {
    return {
      idDonatur: String(row.ID_Donatur || '').trim(),
      tanggalDaftar: formatCellDateString_(row.Tanggal_Daftar),
      namaLengkap: String(row.Nama_Lengkap || '').trim(),
      jenisKelamin: normalizeJenisKelamin_(row.Jenis_Kelamin),
      noWa: safeNormalizeOrKeep_(row.No_WA),
      email: String(row.Email || '').trim(),
      kabId: String(row.Kab_ID || '').trim(),
      domisili: String(row.Domisili || '').trim(),
      provinsi: String(row.Provinsi || '').trim(),
      pulau: String(row.Pulau || '').trim(),
      nominalKomitmen: parseNumber_(row.Nominal_Komitmen),
      tglJatuhTempo: parseNumber_(row.Tgl_Jatuh_Tempo) || 1,
      metodeDaftar: String(row.Metode_Daftar || 'Mandiri').trim(),
      kodePerantara: String(row.Kode_Perantara || '').trim(),
      namaPerantara: String(row.Nama_Perantara || '-').trim(),
      statusAktif: normalizeStatusAktif_(row.Status_Aktif),
      minatGrupWa: normalizeMinatGrup_(row.Minat_Grup_WA),
      statusGrupWa: normalizeStatusGrup_(row.Status_Grup_WA)
    };
  }).filter(function (d) {
    return d.idDonatur !== '' || d.namaLengkap !== '';
  });

  const transaksi = readSheetAsObjects_(ss.getSheetByName(SHEET_NAMES.TRANSAKSI)).map(function (row) {
    const rawPenyaluran = String(row.Status_Penyaluran || '').trim();
    const waktuInput = formatCellDateString_(row.Waktu_Input);
    const tanggalTransfer = formatIsoDateCell_(row.Tanggal_Transfer) || waktuInput.substring(0, 10);
    const jenisDonatur = normalizeJenisDonatur_(row.Jenis_Donatur, row.ID_Donatur);
    const nominalTransfer = parseNumber_(row.Nominal_Transfer);
    const donasiLainnya = jenisDonatur === 'Umum' ? 0 : Math.max(0, parseNumber_(row.Donasi_Lainnya));
    const nominalKomitmenRaw = parseNumber_(row.Nominal_Komitmen);
    const nominalKomitmen = jenisDonatur === 'Umum'
      ? 0
      : (nominalKomitmenRaw > 0 ? nominalKomitmenRaw : Math.max(0, nominalTransfer - donasiLainnya));

    return {
      idTransaksi: String(row.ID_Transaksi || '').trim(),
      waktuInput: waktuInput,
      tanggalTransfer: tanggalTransfer,
      jenisDonatur: jenisDonatur,
      idDonatur: String(row.ID_Donatur || '').trim(),
      namaDonatur: String(row.Nama_Donatur || '').trim(),
      noWa: safeNormalizeOrKeep_(row.No_WA),
      bulanTagihan: formatBulanTagihan_(row.Bulan_Tagihan),
      nominalKomitmen: nominalKomitmen,
      donasiLainnya: donasiLainnya,
      nominalTransfer: nominalTransfer,
      bankTujuan: String(row.Bank_Tujuan || '').trim(),
      linkBuktiDrive: String(row.Link_Bukti_Drive || '').trim(),
      statusVerifikasi: String(row.Status_Verifikasi || 'Pending').trim(),
      diinputOleh: String(row.Diinput_Oleh || '').trim(),
      statusPenyaluran: rawPenyaluran === 'Sudah Disalurkan' ? 'Sudah Disalurkan' : 'Belum Disalurkan',
      keterangan: String(row.Keterangan || '').trim()
    };
  }).filter(function (t) {
    return t.idTransaksi !== '';
  });

  const antreanPesan = readAntreanList_(ss);

  return {
    config: config,
    donatur: donatur,
    transaksi: transaksi,
    panitia: [],
    antreanPesan: antreanPesan
  };
}

function readAntreanList_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.ANTREAN);
  if (!sheet) return [];
  const all = readSheetAsObjects_(sheet).map(function (row) {
    return {
      idAntrean: String(row.ID_Antrean || '').trim(),
      waktuBuat: formatCellDateString_(row.Waktu_Buat),
      jadwalKirim: formatCellDateString_(row.Jadwal_Kirim),
      jenisPesan: String(row.Jenis_Pesan || 'Broadcast').trim(),
      idDonatur: String(row.ID_Donatur || '').trim(),
      namaDonatur: String(row.Nama_Donatur || '').trim(),
      noWa: safeNormalizeOrKeep_(row.No_WA),
      isiPesan: String(row.Isi_Pesan || ''),
      mediaUrl: String(row.Media_Url || '').trim(),
      status: String(row.Status || 'Menunggu').trim(),
      keteranganHasil: String(row.Keterangan_Hasil || '').trim(),
      waktuTerkirim: formatCellDateString_(row.Waktu_Terkirim)
    };
  }).filter(function (item) {
    return item.idAntrean !== '';
  });
  // Kembalikan 200 terbaru (urutan terbaru di atas)
  return all.reverse().slice(0, 200);
}

// ==================== PENDAFTARAN DONATUR ====================
function handleRegisterDonatur_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.DONATUR);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(SHEET_NAMES.DONATUR);
  } else {
    ensureSheetWithHeaders_(ss, SHEET_NAMES.DONATUR, HEADERS.Master_Donatur, {
      textHeaders: [
        'ID_Donatur',
        'Tanggal_Daftar',
        'Jenis_Kelamin',
        'No_WA',
        'Kab_ID',
        'Status_Aktif',
        'Email',
        'Kode_Perantara',
        'Minat_Grup_WA',
        'Status_Grup_WA'
      ],
      currencyHeaders: ['Nominal_Komitmen']
    });
  }

  const namaLengkap = String(payload.namaLengkap || '').trim();
  const jenisKelamin = normalizeJenisKelamin_(payload.jenisKelamin);
  const email = String(payload.email || '').trim();
  const kabId = String(payload.kabId || '').trim();
  const domisili = String(payload.domisili || '').trim();
  const provinsi = String(payload.provinsi || '').trim();
  const pulau = String(payload.pulau || '').trim();
  const nominalKomitmen = parseNumber_(payload.nominalKomitmen);
  const tglJatuhTempo = parseNumber_(payload.tglJatuhTempo);
  const metodeDaftar = 'Mandiri';
  const kodePerantara = '';
  const namaPerantara = '-';
  const minatGrupWa = normalizeMinatGrup_(payload.minatGrupWa);
  const statusGrupWa = 'Belum Bergabung';

  if (!namaLengkap) {
    return { status: 'error', message: 'Nama lengkap wajib diisi.' };
  }
  if (!jenisKelamin) {
    return { status: 'error', message: 'Jenis kelamin donatur wajib dipilih (Laki-laki atau Perempuan).' };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', message: 'Format alamat email tidak valid.' };
  }
  if (nominalKomitmen <= 0) {
    return { status: 'error', message: 'Nominal komitmen wajib diisi dan lebih dari Rp 0.' };
  }
  if (tglJatuhTempo < 1 || tglJatuhTempo > 31) {
    return { status: 'error', message: 'Tanggal pengingat bulanan wajib antara 1 sampai 31.' };
  }

  const waCheck = validateAndNormalizeWA_(payload.noWa);
  if (!waCheck.valid) {
    return { status: 'error', message: waCheck.error };
  }
  const normalizedWa = waCheck.normalized;

  const existingRows = readSheetAsObjects_(sheet);
  for (let i = 0; i < existingRows.length; i++) {
    const existingWa = safeNormalizeOrKeep_(existingRows[i].No_WA);
    if (existingWa && existingWa === normalizedWa) {
      return {
        status: 'error',
        code: 'DUPLICATE_WA',
        message: 'Nomor WA ' + normalizedWa + ' sudah terdaftar atas nama ' +
          String(existingRows[i].Nama_Lengkap || '-') + ' (ID: ' +
          String(existingRows[i].ID_Donatur || '-') + ').',
        data: {
          existingDonatur: {
            idDonatur: String(existingRows[i].ID_Donatur || ''),
            tanggalDaftar: formatCellDateString_(existingRows[i].Tanggal_Daftar),
            namaLengkap: String(existingRows[i].Nama_Lengkap || ''),
            jenisKelamin: normalizeJenisKelamin_(existingRows[i].Jenis_Kelamin),
            noWa: existingWa,
            email: String(existingRows[i].Email || ''),
            kabId: String(existingRows[i].Kab_ID || ''),
            domisili: String(existingRows[i].Domisili || ''),
            provinsi: String(existingRows[i].Provinsi || ''),
            pulau: String(existingRows[i].Pulau || ''),
            nominalKomitmen: parseNumber_(existingRows[i].Nominal_Komitmen),
            tglJatuhTempo: parseNumber_(existingRows[i].Tgl_Jatuh_Tempo) || 1,
            statusAktif: normalizeStatusAktif_(existingRows[i].Status_Aktif),
            minatGrupWa: normalizeMinatGrup_(existingRows[i].Minat_Grup_WA),
            statusGrupWa: normalizeStatusGrup_(existingRows[i].Status_Grup_WA)
          }
        }
      };
    }
  }

  const now = new Date();
  const idDonatur = generateDonaturId_(existingRows, now);
  const tanggalDaftar = formatTimestamp_(now);
  const statusAktif = 'Aktif';

  const rowValuesByHeader = {
    ID_Donatur: idDonatur,
    Tanggal_Daftar: tanggalDaftar,
    Nama_Lengkap: namaLengkap,
    Jenis_Kelamin: jenisKelamin,
    No_WA: normalizedWa,
    Kab_ID: kabId,
    Domisili: domisili,
    Provinsi: provinsi,
    Pulau: pulau,
    Program_Donasi: 'Dakwah Pelosok',
    Nominal_Komitmen: nominalKomitmen,
    Tgl_Jatuh_Tempo: tglJatuhTempo,
    Metode_Daftar: metodeDaftar,
    Kode_Perantara: kodePerantara,
    Nama_Perantara: namaPerantara,
    Status_Aktif: statusAktif,
    Email: email,
    Minat_Grup_WA: minatGrupWa,
    Status_Grup_WA: statusGrupWa
  };

  appendRowByHeaderMap_(sheet, rowValuesByHeader, [
    'ID_Donatur',
    'Tanggal_Daftar',
    'Jenis_Kelamin',
    'No_WA',
    'Kab_ID',
    'Kode_Perantara',
    'Status_Aktif',
    'Email',
    'Minat_Grup_WA',
    'Status_Grup_WA'
  ], ['Nominal_Komitmen']);
  SpreadsheetApp.flush();
  invalidateDonorLookupCache_(normalizedWa);

  const createdDonatur = {
    idDonatur: idDonatur,
    tanggalDaftar: tanggalDaftar,
    namaLengkap: namaLengkap,
    jenisKelamin: jenisKelamin,
    noWa: normalizedWa,
    email: email,
    kabId: kabId,
    domisili: domisili,
    provinsi: provinsi,
    pulau: pulau,
    nominalKomitmen: nominalKomitmen,
    tglJatuhTempo: tglJatuhTempo,
    metodeDaftar: metodeDaftar,
    kodePerantara: kodePerantara,
    namaPerantara: namaPerantara,
    statusAktif: statusAktif,
    minatGrupWa: minatGrupWa,
    statusGrupWa: statusGrupWa
  };

  const config = loadConfigObject_(ss);
  const notifStatus = sendDonorNotifications_(createdDonatur, config, { messageType: 'daftar' });
  notifStatus.adminGroup = sendAdminGroupNotifForRegister_(createdDonatur, config);

  return {
    status: 'success',
    message: 'Donatur Tetap ' + namaLengkap + ' berhasil didaftarkan (' + idDonatur + ').',
    data: {
      donatur: createdDonatur,
      notifStatus: notifStatus
    }
  };
}

function handleUpdateDonaturMandiri_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DONATUR);
  if (!sheet || sheet.getLastRow() <= 1) {
    return { status: 'error', message: 'Data donatur tidak ditemukan.' };
  }

  const idDonatur = String(payload.idDonatur || '').trim();
  const origCheck = validateAndNormalizeWA_(payload.originalNoWa);
  if (!idDonatur || !origCheck.valid) {
    return { status: 'error', message: 'Identitas donatur (ID & Nomor WA terdaftar) tidak valid.' };
  }
  const originalNoWa = origCheck.normalized;

  const namaLengkap = String(payload.namaLengkap || '').trim();
  const jenisKelamin = normalizeJenisKelamin_(payload.jenisKelamin);
  const email = String(payload.email || '').trim();
  const kabId = String(payload.kabId || '').trim();
  const domisili = String(payload.domisili || '').trim();
  const provinsi = String(payload.provinsi || '').trim();
  const pulau = String(payload.pulau || '').trim();
  const nominalKomitmen = parseNumber_(payload.nominalKomitmen);
  const tglJatuhTempo = parseNumber_(payload.tglJatuhTempo);
  const minatGrupWa = normalizeMinatGrup_(payload.minatGrupWa);

  if (!namaLengkap) {
    return { status: 'error', message: 'Nama lengkap wajib diisi.' };
  }
  if (!jenisKelamin) {
    return { status: 'error', message: 'Jenis kelamin wajib dipilih (Laki-laki atau Perempuan).' };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', message: 'Format alamat email tidak valid.' };
  }
  if (nominalKomitmen <= 0) {
    return { status: 'error', message: 'Nominal komitmen wajib diisi dan lebih dari Rp 0.' };
  }
  if (tglJatuhTempo < 1 || tglJatuhTempo > 31) {
    return { status: 'error', message: 'Tanggal pengingat bulanan wajib antara 1 sampai 31.' };
  }

  const newWaCheck = validateAndNormalizeWA_(payload.noWa);
  if (!newWaCheck.valid) {
    return { status: 'error', message: newWaCheck.error };
  }
  const newNoWa = newWaCheck.normalized;

  const indexMap = getHeaderIndexMap_(sheet);
  const idCol = indexMap.ID_Donatur;
  const waCol = indexMap.No_WA;
  if (!idCol || !waCol) {
    return { status: 'error', message: 'Struktur sheet Master_Donatur tidak lengkap.' };
  }

  const values = sheet.getDataRange().getValues();
  let targetRow = -1;
  let existingStatusAktif = 'Aktif';
  let existingStatusGrup = 'Belum Bergabung';
  let existingTanggalDaftar = '';

  for (let r = 1; r < values.length; r++) {
    const rowId = String(values[r][idCol - 1] || '').trim();
    const rowWa = safeNormalizeOrKeep_(values[r][waCol - 1]);
    if (rowId === idDonatur && rowWa === originalNoWa) {
      targetRow = r + 1;
      existingStatusAktif = indexMap.Status_Aktif ? normalizeStatusAktif_(values[r][indexMap.Status_Aktif - 1]) : 'Aktif';
      existingStatusGrup = indexMap.Status_Grup_WA ? normalizeStatusGrup_(values[r][indexMap.Status_Grup_WA - 1]) : 'Belum Bergabung';
      existingTanggalDaftar = indexMap.Tanggal_Daftar ? formatCellDateString_(values[r][indexMap.Tanggal_Daftar - 1]) : '';
      break;
    }
  }

  if (targetRow === -1) {
    return { status: 'error', message: 'Data donatur tidak cocok dengan nomor WA terdaftar.' };
  }

  // Cegah duplikasi nomor WA jika donatur mengubah nomor WA-nya
  if (newNoWa !== originalNoWa) {
    for (let r = 1; r < values.length; r++) {
      if (r + 1 === targetRow) continue;
      const otherWa = safeNormalizeOrKeep_(values[r][waCol - 1]);
      if (otherWa && otherWa === newNoWa) {
        return {
          status: 'error',
          message: 'Nomor WA baru (' + newNoWa + ') sudah digunakan oleh donatur lain.'
        };
      }
    }
  }

  const setCell = function (headerName, val, format) {
    const col = indexMap[headerName];
    if (!col) return;
    const cell = sheet.getRange(targetRow, col);
    if (format) cell.setNumberFormat(format);
    cell.setValue(val);
  };

  setCell('Nama_Lengkap', namaLengkap);
  setCell('Jenis_Kelamin', jenisKelamin, '@');
  setCell('No_WA', newNoWa, '@');
  setCell('Email', email, '@');
  setCell('Kab_ID', kabId, '@');
  setCell('Domisili', domisili);
  setCell('Provinsi', provinsi);
  setCell('Pulau', pulau);
  setCell('Program_Donasi', 'Dakwah Pelosok');
  setCell('Nominal_Komitmen', nominalKomitmen, '#,##0');
  setCell('Tgl_Jatuh_Tempo', tglJatuhTempo);
  setCell('Minat_Grup_WA', minatGrupWa, '@');
  SpreadsheetApp.flush();
  invalidateDonorLookupCache_(originalNoWa);
  if (newNoWa !== originalNoWa) {
    invalidateDonorLookupCache_(newNoWa);
  }

  const updatedDonatur = {
    idDonatur: idDonatur,
    tanggalDaftar: existingTanggalDaftar,
    namaLengkap: namaLengkap,
    jenisKelamin: jenisKelamin,
    noWa: newNoWa,
    email: email,
    kabId: kabId,
    domisili: domisili,
    provinsi: provinsi,
    pulau: pulau,
    nominalKomitmen: nominalKomitmen,
    tglJatuhTempo: tglJatuhTempo,
    metodeDaftar: 'Mandiri',
    kodePerantara: '',
    namaPerantara: '-',
    statusAktif: existingStatusAktif,
    minatGrupWa: minatGrupWa,
    statusGrupWa: existingStatusGrup
  };

  return {
    status: 'success',
    message: 'Data Donatur Tetap ' + namaLengkap + ' berhasil diperbarui.',
    data: {
      donatur: updatedDonatur
    }
  };
}

function handleTestNotification_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = loadConfigObject_(ss);
  const messageType = String(payload.messageType || 'daftar').trim();

  if (messageType === 'admin_group') {
    const targetGroupId = String(payload.adminWaGroupId || config.adminWaGroupId || '').trim();
    if (!targetGroupId) {
      return { status: 'error', message: 'ID Grup WA Admin (format xxxx@g.us) belum diisi di Pengaturan.' };
    }
    if (!config.waApiKey) {
      return { status: 'error', message: 'API Key nomor WA belum diisi di Pengaturan.' };
    }
    const testMsg =
      '*[TES NOTIFIKASI GRUP ADMIN — ' + (config.namaLembaga || NAMA_LEMBAGA) + ']*\n\n' +
      'Assalamu\'alaikum warahmatullahi wabarakatuh.\n' +
      'Ini adalah pesan uji koneksi notifikasi otomatis untuk Grup WA Khusus Admin (' +
      (config.adminWaGroupName || 'Grup Admin DAIKITA') + ').\n\n' +
      'Notifikasi otomatis akan masuk ke grup ini setiap kali ada:\n' +
      '• Pendaftaran Donatur Tetap baru\n' +
      '• Konfirmasi Penyaluran Donasi baru\n\n' +
      'Waktu uji: ' + formatTimestamp_(new Date());

    const groupRes = sendWaGroupViaRechat_(targetGroupId, testMsg, config);
    return {
      status: groupRes.ok ? 'success' : 'error',
      message: groupRes.detail,
      data: {
        notifStatus: {
          wa: { attempted: false, ok: false, detail: 'Uji khusus Grup WA Admin.' },
          email: { attempted: false, ok: false, detail: 'Uji khusus Grup WA Admin.' },
          adminGroup: groupRes
        }
      }
    };
  }

  const testWaRaw = String(payload.noWa || '').trim();
  const testEmail = String(payload.email || '').trim();
  const testNama = String(payload.namaLengkap || 'Hamba Allah (Tes Notifikasi)').trim();
  const testJk = normalizeJenisKelamin_(payload.jenisKelamin) || 'Laki-laki';
  const testMinat = normalizeMinatGrup_(payload.minatGrupWa);

  let normalizedWa = '';
  if (testWaRaw) {
    const waCheck = validateAndNormalizeWA_(testWaRaw);
    if (!waCheck.valid) {
      return { status: 'error', message: waCheck.error };
    }
    normalizedWa = waCheck.normalized;
  }

  if (!normalizedWa && !testEmail) {
    return { status: 'error', message: 'Isi minimal Nomor WhatsApp atau Email tujuan untuk pengujian.' };
  }

  const now = new Date();
  const sampleDonor = {
    idDonatur: 'DK' + Utilities.formatDate(now, TIMEZONE, 'yyMMdd') + '0001',
    namaLengkap: testNama,
    jenisKelamin: testJk,
    noWa: normalizedWa,
    email: testEmail,
    domisili: 'Kota Makassar',
    provinsi: 'Sulawesi Selatan',
    pulau: 'Sulawesi',
    nominalKomitmen: config.defaultNominal || 100000,
    tglJatuhTempo: config.defaultTglPengingat || 5,
    namaPerantara: '-',
    minatGrupWa: testMinat
  };

  const notifStatus = sendDonorNotifications_(sampleDonor, config, {
    messageType: messageType,
    forcedIndex: payload.templateIndex,
    isTest: true
  });
  return {
    status: 'success',
    message: 'Pengujian pengiriman notifikasi (' + messageType + ') selesai dijalankan.',
    data: {
      notifStatus: notifStatus
    }
  };
}

// ==================== NOTIFIKASI WA (RECHAT) & EMAIL ALIAS ====================
function nextNotificationRotationIndex_(scopeKey) {
  const propKey = 'NOTIF_ROTATION_' + String(scopeKey || 'DAFTAR').toUpperCase();
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty(propKey);
    const current = raw ? parseInt(raw, 10) : 0;
    const safeCurrent = isNaN(current) || current < 0 ? 0 : current;
    props.setProperty(propKey, String((safeCurrent + 1) % 1000000));
    return safeCurrent;
  } catch (e) {
    return Math.floor(Math.random() * 100);
  }
}

function formatRupiahServer_(amount) {
  const num = Math.round(parseNumber_(amount));
  const str = String(num).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return 'Rp ' + str;
}

function formatBulanLabelServer_(ym) {
  const match = String(ym || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return ym || '-';
  const idx = parseInt(match[2], 10) - 1;
  return (BULAN_INDO_SERVER[idx] || match[2]) + ' ' + match[1];
}

function formatRekeningTextServer_(rekeningList) {
  if (!Array.isArray(rekeningList) || rekeningList.length === 0) {
    return 'BSI (Bank Syariah Indonesia): *7777767407* a.n. LAJNAH DAI';
  }
  return rekeningList
    .map(function (r) {
      return r.bank + ': *' + r.nomor + '* a.n. ' + r.atasNama;
    })
    .join('\n');
}

function renderNotifTemplate_(templateStr, donatur, config, options) {
  const opts = options || {};
  const jk = normalizeJenisKelamin_(donatur.jenisKelamin);
  const sapaan = jk === 'Laki-laki' ? 'Bapak' : jk === 'Perempuan' ? 'Ibu' : 'Bapak/Ibu';
  const wilayahParts = [donatur.domisili, donatur.provinsi].filter(Boolean);
  const domisiliLabel = wilayahParts.length > 0 ? wilayahParts.join(', ') : '-';
  const bulanYm = opts.bulanTagihan || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM');
  const bulanLabel = formatBulanLabelServer_(bulanYm);

  const groupLink = String(config.waGroupLink || '').trim();
  const groupName = String(config.waGroupName || 'Donatur Tetap DAIKITA — Dakwah Pelosok').trim();
  const groupActive = config.showWaGroupPublic !== false;
  const shouldIncludeGroup =
    groupActive &&
    (opts.includeGroupLink !== undefined
      ? Boolean(opts.includeGroupLink)
      : normalizeMinatGrup_(donatur.minatGrupWa) === 'Ya');

  const linkGrupSection =
    shouldIncludeGroup && groupLink
      ? '\nSilakan bergabung ke *Grup WhatsApp ' + groupName + '* melalui tautan berikut:\n' + groupLink + '\n'
      : '';

  const qrisNote =
    config.showQris && config.qrisUrl
      ? 'Pembayaran juga dapat melalui QRIS resmi terlampir atau di web konfirmasi.'
      : '';

  const vars = {
    '{nama}': donatur.namaLengkap || 'Sahabat Kebaikan',
    '{sapaan}': sapaan,
    '{jenis_kelamin}': jk || '-',
    '{id_donatur}': donatur.idDonatur || '-',
    '{no_wa}': donatur.noWa || '-',
    '{domisili}': domisiliLabel,
    '{nominal}': formatRupiahServer_(donatur.nominalKomitmen || 0),
    '{tgl_pengingat}': String(donatur.tglJatuhTempo || config.defaultTglPengingat || 5),
    '{perantara}': '-',
    '{lembaga}': config.namaLembaga || NAMA_LEMBAGA,
    '{rekening}': formatRekeningTextServer_(config.infoRekening),
    '{link_konfirmasi}': APP_BAYAR_URL,
    '{bulan}': bulanLabel,
    '{link_grup}': groupLink || '-',
    '{nama_grup}': groupName,
    '{link_grup_section}': linkGrupSection,
    '{qris_note}': qrisNote
  };

  let out = String(templateStr || '');
  Object.keys(vars).forEach(function (token) {
    out = out.split(token).join(vars[token]);
  });
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function escapeHtmlServer_(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function extractDriveFileIdServer_(url) {
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

function buildDirectImageCandidatesServer_(rawUrl) {
  const clean = String(rawUrl || '').trim();
  if (!clean || !/^https?:\/\//i.test(clean)) return [];
  const fileId = extractDriveFileIdServer_(clean);
  if (fileId) {
    try {
      const f = DriveApp.getFileById(fileId);
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log('Info sharing QRIS/media: ' + shareErr);
    }
    return [
      'https://lh3.googleusercontent.com/d/' + fileId + '=s1200',
      'https://drive.google.com/uc?export=view&id=' + fileId,
      'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200'
    ];
  }
  return [clean];
}

function fetchQrisBlobServer_(qrisUrl) {
  const clean = String(qrisUrl || '').trim();
  if (!clean) return null;
  const fileId = extractDriveFileIdServer_(clean);
  if (fileId) {
    try {
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      const mime = blob.getContentType() || 'image/png';
      const ext = resolveExtension_(mime, file.getName() || 'qris.png');
      return blob.setName('QRIS-DAIKITA.' + ext);
    } catch (driveErr) {
      Logger.log('Fallback ambil QRIS via URL: ' + driveErr);
    }
  }
  const candidates = buildDirectImageCandidatesServer_(clean);
  for (let i = 0; i < candidates.length; i++) {
    try {
      const resp = UrlFetchApp.fetch(candidates[i], {
        muteHttpExceptions: true,
        followRedirects: true
      });
      if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
        const blob = resp.getBlob();
        const mime = String(blob.getContentType() || '').toLowerCase();
        if (mime.indexOf('image/') === 0) {
          const ext = resolveExtension_(mime, 'qris.png');
          return blob.setName('QRIS-DAIKITA.' + ext);
        }
      }
    } catch (fetchErr) {
      Logger.log('Info fetch QRIS candidate: ' + fetchErr);
    }
  }
  return null;
}

function sendDonorNotifications_(donatur, config, options) {
  const opts = options || {};
  const messageType = String(opts.messageType || 'daftar').trim();
  const forcedIndex = opts.forcedIndex;
  const rotationIdx =
    typeof forcedIndex === 'number' && !isNaN(forcedIndex) && forcedIndex >= 0
      ? Math.floor(forcedIndex)
      : nextNotificationRotationIndex_(messageType);

  const result = {
    wa: { attempted: false, ok: false, detail: 'Tidak dikirim.', templateIndex: undefined },
    waFollowup: undefined,
    email: { attempted: false, ok: false, detail: 'Tidak dikirim.', templateIndex: 0 }
  };

  const wantGroup = config.showWaGroupPublic !== false && normalizeMinatGrup_(donatur.minatGrupWa) === 'Ya';
  const qrisMedia = config.showQris && config.qrisUrl ? config.qrisUrl : '';

  // 1. Kirim WhatsApp sesuai jenis pesan
  if (!config.enableWaNotif) {
    result.wa.detail = 'Notifikasi WA otomatis sedang dinonaktifkan di Pengaturan.';
  } else if (!donatur.noWa) {
    result.wa.detail = 'Nomor WA donatur kosong.';
  } else if (!config.waApiKey) {
    result.wa.detail = 'API Key perangkat WA belum diisi di Pengaturan.';
  } else if (messageType === 'followup') {
    const fList = Array.isArray(config.waFollowupTemplates) && config.waFollowupTemplates.length > 0
      ? config.waFollowupTemplates
      : DEFAULT_WA_FOLLOWUP_TEMPLATES;
    const fIdx = rotationIdx % fList.length;
    const fBody = renderNotifTemplate_(fList[fIdx], donatur, config, { includeGroupLink: wantGroup });
    result.wa = sendWaViaRechat_(donatur.noWa, fBody, config, '');
    result.wa.templateIndex = fIdx;
  } else if (messageType === 'reminder') {
    const rList = Array.isArray(config.waReminderTemplates) && config.waReminderTemplates.length > 0
      ? config.waReminderTemplates
      : DEFAULT_WA_REMINDER_TEMPLATES;
    const rIdx = rotationIdx % rList.length;
    const rBody = renderNotifTemplate_(rList[rIdx], donatur, config, { includeGroupLink: false });
    result.wa = sendWaViaRechat_(donatur.noWa, rBody, config, qrisMedia);
    result.wa.templateIndex = rIdx;
  } else {
    // Default: Pendaftaran Awal (Pesan 1 langsung + QRIS bila ada + Pesan 2 terjadwal jeda 1 menit dengan link grup WA)
    const waList = Array.isArray(config.waTemplates) && config.waTemplates.length > 0
      ? config.waTemplates
      : DEFAULT_WA_TEMPLATES;
    const waTemplateIdx = rotationIdx % waList.length;
    const waBody = renderNotifTemplate_(waList[waTemplateIdx], donatur, config, {
      includeGroupLink: wantGroup
    });
    result.wa = sendWaViaRechat_(donatur.noWa, waBody, config, qrisMedia);
    result.wa.templateIndex = waTemplateIdx;

    // Jadwalkan Pesan 2 (Arahan Save Nomor + Link Grup WA) dengan jeda default 60 detik di Antrean_Pesan
    const fList = Array.isArray(config.waFollowupTemplates) && config.waFollowupTemplates.length > 0
      ? config.waFollowupTemplates
      : DEFAULT_WA_FOLLOWUP_TEMPLATES;
    const fIdx = nextNotificationRotationIndex_('followup') % fList.length;
    let fTpl = fList[fIdx];
    if (wantGroup && config.waGroupLink && fTpl.indexOf('{link_grup') === -1) {
      fTpl = fTpl + '\n{link_grup_section}';
    }
    const fBody = renderNotifTemplate_(fTpl, donatur, config, { includeGroupLink: wantGroup });
    const delaySec = Math.max(15, Math.min(600, Number(config.waFollowupDelaySec) || 60));
    const scheduledDate = new Date(Date.now() + delaySec * 1000);

    try {
      enqueueMessageRow_(SpreadsheetApp.getActiveSpreadsheet(), {
        jadwalKirim: formatTimestamp_(scheduledDate),
        jenisPesan: 'Daftar Pesan 2 (Save Nomor)',
        idDonatur: donatur.idDonatur || '-',
        namaDonatur: donatur.namaLengkap || '-',
        noWa: donatur.noWa,
        isiPesan: fBody,
        mediaUrl: ''
      });
      scheduleOneTimeQueueTrigger_(delaySec * 1000);
      result.waFollowup = {
        attempted: true,
        ok: true,
        detail: 'Dijadwalkan terkirim ±' + delaySec + ' detik lagi (Template #' + (fIdx + 1) + ').',
        templateIndex: fIdx
      };
    } catch (qErr) {
      result.waFollowup = {
        attempted: true,
        ok: false,
        detail: 'Gagal menjadwalkan Pesan 2: ' + (qErr && qErr.message ? qErr.message : String(qErr)),
        templateIndex: fIdx
      };
    }
  }

  // 2. Kirim Email (1 template per jenis: Daftar atau Reminder, sertakan QRIS bila tersedia)
  if (messageType === 'followup') {
    result.email.detail = 'Pesan arahan save nomor khusus WA (tidak mengirim email).';
  } else if (!config.enableEmailNotif) {
    result.email.detail = 'Notifikasi Email otomatis sedang dinonaktifkan di Pengaturan.';
  } else if (!donatur.email) {
    result.email.detail = 'Donatur tidak mengisi alamat email.';
  } else {
    const chosenTpl =
      messageType === 'reminder'
        ? (config.emailTemplateReminder || DEFAULT_EMAIL_TEMPLATE_REMINDER)
        : (config.emailTemplateDaftar || DEFAULT_EMAIL_TEMPLATE_DAFTAR);
    const subject = renderNotifTemplate_(chosenTpl.subject, donatur, config, {
      includeGroupLink: messageType === 'daftar' && wantGroup
    });
    const plainBody = renderNotifTemplate_(chosenTpl.body, donatur, config, {
      includeGroupLink: messageType === 'daftar' && wantGroup
    });
    result.email = sendEmailViaAlias_(donatur.email, subject, plainBody, config, qrisMedia);
    result.email.templateIndex = 0;
  }

  return result;
}

function sendWaViaRechat_(toNumber, messageText, config, mediaUrl) {
  try {
    let endpoint = String(config.waEndpointUrl || DEFAULT_WA_ENDPOINT).trim();
    const apiKey = String(config.waApiKey || '').trim();
    const useUrlKey = endpoint.indexOf('{API_KEY}') !== -1 || (apiKey && endpoint.indexOf(apiKey) !== -1);

    if (endpoint.indexOf('{API_KEY}') !== -1) {
      endpoint = endpoint.replace(/\{API_KEY\}/g, encodeURIComponent(apiKey));
    }

    const headers = { Accept: 'application/json' };
    if (!useUrlKey && apiKey) {
      headers.Authorization = 'Bearer ' + apiKey;
    }

    const cleanTo = String(toNumber || '').replace(/\D/g, '');
    const imageCandidates = buildDirectImageCandidatesServer_(mediaUrl);
    const hasMedia = imageCandidates.length > 0;

    // Mode 1: Jika ada QRIS dan panjang teks <= 950 karakter, kirim sekaligus sebagai gambar + caption
    if (hasMedia && messageText.length <= 950) {
      for (let i = 0; i < imageCandidates.length; i++) {
        const imagePayload = {
          recipient_type: 'individual',
          to: cleanTo,
          type: 'image',
          image: {
            link: imageCandidates[i],
            caption: messageText
          }
        };
        const imgResp = UrlFetchApp.fetch(endpoint, {
          method: 'post',
          contentType: 'application/json',
          headers: headers,
          payload: JSON.stringify(imagePayload),
          muteHttpExceptions: true
        });
        const imgCode = imgResp.getResponseCode();
        if (imgCode >= 200 && imgCode < 300) {
          return {
            attempted: true,
            ok: true,
            detail: 'Pesan WA + gambar QRIS terkirim (HTTP ' + imgCode + ').'
          };
        }
        Logger.log('Percobaan gambar QRIS #' + (i + 1) + ' HTTP ' + imgCode + ': ' + imgResp.getContentText().substring(0, 140));
      }
    }

    // Mode 2: Kirim pesan teks terlebih dahulu
    const bodyPayload = {
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: {
        body: messageText
      }
    };

    const response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(bodyPayload),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const rawText = response.getContentText();
    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      parsed = null;
    }

    if (code >= 200 && code < 300) {
      // Jika ada gambar QRIS, kirim gambar QRIS terpisah dengan caption ringkas agar tidak kena batas 1024 karakter WA
      if (hasMedia) {
        let qrisSent = false;
        const shortCaption =
          'QRIS Pembayaran Resmi ' +
          (config.namaLembaga || NAMA_LEMBAGA) +
          (config.qrisMerchantName ? ' (' + config.qrisMerchantName + ')' : '');
        for (let j = 0; j < imageCandidates.length; j++) {
          try {
            const qResp = UrlFetchApp.fetch(endpoint, {
              method: 'post',
              contentType: 'application/json',
              headers: headers,
              payload: JSON.stringify({
                recipient_type: 'individual',
                to: cleanTo,
                type: 'image',
                image: {
                  link: imageCandidates[j],
                  caption: shortCaption
                }
              }),
              muteHttpExceptions: true
            });
            if (qResp.getResponseCode() >= 200 && qResp.getResponseCode() < 300) {
              qrisSent = true;
              break;
            }
          } catch (qErr) {
            Logger.log('Info kirim gambar QRIS terpisah: ' + qErr);
          }
        }
        return {
          attempted: true,
          ok: true,
          detail: qrisSent
            ? 'Pesan WA + gambar QRIS terkirim (HTTP ' + code + ').'
            : 'Pesan WA teks terkirim (HTTP ' + code + '), gambar QRIS belum berhasil diunduh gateway.'
        };
      }

      return {
        attempted: true,
        ok: true,
        detail: 'Pesan WA masuk antrean kirim (HTTP ' + code + ').'
      };
    }

    const errMsg =
      (parsed && (parsed.message || parsed.error)) ||
      (code === 429 ? 'Kuota pengiriman harian WA habis (HTTP 429).' : 'HTTP ' + code + ': ' + rawText.substring(0, 140));
    return {
      attempted: true,
      ok: false,
      detail: 'Gagal kirim WA: ' + errMsg
    };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      detail: 'Kendala koneksi webhook WA: ' + (err && err.message ? err.message : String(err))
    };
  }
}

function sendWaGroupViaRechat_(groupId, messageText, config) {
  try {
    const cleanGroupId = String(groupId || '').trim();
    if (!cleanGroupId) {
      return { attempted: false, ok: false, detail: 'ID Grup WA Admin belum diisi.' };
    }
    if (!config.waApiKey) {
      return { attempted: false, ok: false, detail: 'API Key nomor WA belum diisi.' };
    }

    let endpoint = String(config.waEndpointUrl || DEFAULT_WA_ENDPOINT).trim();
    const apiKey = String(config.waApiKey || '').trim();
    const useUrlKey = endpoint.indexOf('{API_KEY}') !== -1 || (apiKey && endpoint.indexOf(apiKey) !== -1);
    if (endpoint.indexOf('{API_KEY}') !== -1) {
      endpoint = endpoint.replace(/\{API_KEY\}/g, encodeURIComponent(apiKey));
    }

    const headers = { Accept: 'application/json' };
    if (!useUrlKey && apiKey) {
      headers.Authorization = 'Bearer ' + apiKey;
    }

    const bodyPayload = {
      recipient_type: 'group',
      to: cleanGroupId,
      type: 'text',
      text: {
        body: messageText
      }
    };

    const response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(bodyPayload),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const rawText = response.getContentText();
    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      parsed = null;
    }

    if (code >= 200 && code < 300) {
      return {
        attempted: true,
        ok: true,
        detail: 'Notifikasi ke Grup WA Admin terkirim (HTTP ' + code + ').'
      };
    }

    const errMsg =
      (parsed && (parsed.message || parsed.error)) ||
      (code === 429 ? 'Kuota pengiriman harian WA habis (HTTP 429).' : 'HTTP ' + code + ': ' + rawText.substring(0, 140));
    return {
      attempted: true,
      ok: false,
      detail: 'Gagal kirim ke Grup WA Admin: ' + errMsg
    };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      detail: 'Kendala kirim ke Grup WA Admin: ' + (err && err.message ? err.message : String(err))
    };
  }
}

function sendAdminGroupNotifForRegister_(donatur, config) {
  if (!config || !config.enableAdminWaGroupNotif) {
    return { attempted: false, ok: false, detail: 'Notifikasi Grup WA Admin dinonaktifkan.' };
  }
  if (!config.adminWaGroupId) {
    return { attempted: false, ok: false, detail: 'ID Grup WA Admin belum diatur.' };
  }

  const wilayah = [donatur.domisili, donatur.provinsi, donatur.pulau].filter(Boolean).join(', ') || '-';
  const msg =
    '*[DAIKITA] Pendaftaran Donatur Tetap Baru*\n\n' +
    '• ID Donatur: *' + (donatur.idDonatur || '-') + '*\n' +
    '• Nama Lengkap: *' + (donatur.namaLengkap || '-') + '*\n' +
    '• Jenis Kelamin: ' + (donatur.jenisKelamin || '-') + '\n' +
    '• No. WhatsApp: ' + (donatur.noWa || '-') + '\n' +
    '• Email: ' + (donatur.email || '-') + '\n' +
    '• Asal Daerah: ' + wilayah + '\n' +
    '• Nominal Komitmen: *' + formatRupiahServer_(donatur.nominalKomitmen || 0) + ' / bulan*\n' +
    '• Tanggal Pengingat: Tanggal ' + (donatur.tglJatuhTempo || 5) + ' setiap bulan\n' +
    '• Bersedia Masuk Grup WA: ' + (donatur.minatGrupWa || 'Ya') + '\n' +
    '• Waktu Daftar: ' + (donatur.tanggalDaftar || formatTimestamp_(new Date())) + '\n\n' +
    'Kelola data: ' + APP_ADMIN_URL;

  return sendWaGroupViaRechat_(config.adminWaGroupId, msg, config);
}

function sendAdminGroupNotifForPayment_(createdRows, config, meta) {
  if (!config || !config.enableAdminWaGroupNotif) {
    return { attempted: false, ok: false, detail: 'Notifikasi Grup WA Admin dinonaktifkan.' };
  }
  if (!config.adminWaGroupId) {
    return { attempted: false, ok: false, detail: 'ID Grup WA Admin belum diatur.' };
  }
  if (!Array.isArray(createdRows) || createdRows.length === 0) {
    return { attempted: false, ok: false, detail: 'Tidak ada data transaksi untuk dikirim.' };
  }

  const first = createdRows[0];
  const isInsidentil = Boolean(meta && meta.isInsidentil);
  const bulanArr = (meta && Array.isArray(meta.bulanList) ? meta.bulanList : [first.bulanTagihan])
    .map(function (b) { return formatBulanLabelServer_(b); });
  const totalRp = meta && meta.totalRp ? meta.totalRp : first.nominalTransfer;
  const totalDonasiUmum = meta && meta.totalDonasiUmum ? meta.totalDonasiUmum : 0;
  const totalKomitmen = Math.max(0, totalRp - totalDonasiUmum);

  const lines = [
    '*[DAIKITA] Konfirmasi Penyaluran Donasi Baru*',
    '',
    '• Jenis Donatur: *' + (isInsidentil ? 'Donatur Insidentil' : 'Donatur Tetap') + '*',
    '• Nama Donatur: *' + (first.namaDonatur || '-') + '*',
    '• ID Donatur: ' + (isInsidentil ? 'Insidentil' : (first.idDonatur || '-')),
    '• No. WhatsApp: ' + (first.noWa || '-'),
    '• Tanggal Transfer: ' + (first.tanggalTransfer || '-'),
    '• Bulan Pencatatan: ' + bulanArr.join(', '),
    '• Total Transfer: *' + formatRupiahServer_(totalRp) + '*'
  ];

  if (!isInsidentil && totalDonasiUmum > 0) {
    lines.push('  ↳ Komitmen Tetap: ' + formatRupiahServer_(totalKomitmen));
    lines.push('  ↳ Donasi Umum (Kelebihan): ' + formatRupiahServer_(totalDonasiUmum));
  }

  lines.push('• Rekening Tujuan: ' + (first.bankTujuan || '-'));
  lines.push('• Bukti Transfer: ' + (first.linkBuktiDrive ? first.linkBuktiDrive : 'Tanpa lampiran'));
  if (first.keterangan) {
    lines.push('• Keterangan: ' + first.keterangan);
  }
  lines.push('• Diinput Oleh: ' + (first.diinputOleh || 'Donatur (Mandiri)'));
  lines.push('');
  lines.push('Verifikasi di panel admin: ' + APP_ADMIN_URL);

  return sendWaGroupViaRechat_(config.adminWaGroupId, lines.join('\n'), config);
}

function sendEmailViaAlias_(recipientEmail, subject, plainBody, config, qrisImageUrl) {
  try {
    const aliasEmail = String(config.emailSenderAlias || DEFAULT_EMAIL_ALIAS).trim();
    const senderName = String(config.emailSenderName || DEFAULT_EMAIL_SENDER_NAME).trim();

    const safeHtmlParagraphs = escapeHtmlServer_(plainBody)
      .replace(/\n\n/g, '</p><p style="margin:0 0 12px 0;">')
      .replace(/\n/g, '<br/>');

    const qrisBlob = qrisImageUrl ? fetchQrisBlobServer_(qrisImageUrl) : null;
    const directFallbackUrls = buildDirectImageCandidatesServer_(qrisImageUrl);
    const fallbackImgUrl = directFallbackUrls.length > 0 ? directFallbackUrls[0] : '';

    let qrisBlock = '';
    if (qrisBlob) {
      qrisBlock =
        '<div style="margin-top:16px;text-align:center;padding:16px;background:#f8fafc;border-radius:14px;border:1px solid #d1fae5;">' +
        '<div style="font-size:12px;font-weight:700;color:#065f46;margin-bottom:8px;">QRIS Pembayaran Resmi — ' +
        escapeHtmlServer_(config.qrisMerchantName || config.namaLembaga || NAMA_LEMBAGA) +
        '</div>' +
        '<img src="cid:qrisCode" alt="QRIS Resmi" style="max-width:260px;width:100%;height:auto;border-radius:10px;border:1px solid #e2e8f0;"/>' +
        '<div style="font-size:11px;color:#64748b;margin-top:6px;">Scan langsung gambar QRIS di atas atau unduh lampiran email ini.</div>' +
        '</div>';
    } else if (fallbackImgUrl) {
      qrisBlock =
        '<div style="margin-top:16px;text-align:center;padding:16px;background:#f8fafc;border-radius:14px;border:1px solid #d1fae5;">' +
        '<div style="font-size:12px;font-weight:700;color:#065f46;margin-bottom:8px;">QRIS Pembayaran Resmi</div>' +
        '<img src="' + escapeHtmlServer_(fallbackImgUrl) + '" alt="QRIS Resmi" style="max-width:260px;width:100%;height:auto;border-radius:10px;"/>' +
        '</div>';
    }

    const htmlBody =
      '<div style="font-family:Montserrat,Arial,sans-serif;background:#f0fdf9;padding:24px;color:#0f172a;">' +
      '<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;border:1px solid #d1fae5;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,#059669,#0d9488);padding:18px 24px;color:#ffffff;">' +
      '<div style="font-size:16px;font-weight:700;">' + escapeHtmlServer_(config.namaLembaga || NAMA_LEMBAGA) + '</div>' +
      '<div style="font-size:12px;opacity:0.9;margin-top:4px;">' + escapeHtmlServer_(config.tagline || TAGLINE_LEMBAGA) + '</div>' +
      '</div>' +
      '<div style="padding:24px;font-size:14px;line-height:1.65;color:#1e293b;"><p style="margin:0 0 12px 0;">' +
      safeHtmlParagraphs +
      '</p>' + qrisBlock + '</div>' +
      '<div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;">' +
      'Email ini dikirim otomatis oleh sistem ' + escapeHtmlServer_(config.namaLembaga || NAMA_LEMBAGA) +
      '</div></div></div>';

    const mailOptions = {
      name: senderName,
      replyTo: aliasEmail,
      htmlBody: htmlBody
    };

    if (qrisBlob) {
      mailOptions.inlineImages = { qrisCode: qrisBlob };
      mailOptions.attachments = [qrisBlob];
    }

    let usedAliasFrom = false;
    try {
      const aliases = GmailApp.getAliases();
      const matchedAlias = aliases.find(function (a) {
        return String(a || '').trim().toLowerCase() === aliasEmail.toLowerCase();
      });
      if (matchedAlias) {
        mailOptions.from = matchedAlias;
        usedAliasFrom = true;
      }
    } catch (aliasCheckErr) {
      Logger.log('Pengecekan alias Gmail: ' + aliasCheckErr);
    }

    GmailApp.sendEmail(recipientEmail, subject, plainBody, mailOptions);

    return {
      attempted: true,
      ok: true,
      detail: (usedAliasFrom
        ? 'Email terkirim menggunakan alias ' + aliasEmail
        : 'Email terkirim (Reply-To: ' + aliasEmail + ')') +
        (qrisBlob ? ' + QRIS terlampir.' : '.')
    };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      detail: 'Gagal kirim email: ' + (err && err.message ? err.message : String(err))
    };
  }
}

// ==================== ANTREAN PESAN & BROADCAST TERJADWAL ====================
function enqueueMessageRow_(ss, item) {
  let sheet = ss.getSheetByName(SHEET_NAMES.ANTREAN);
  if (!sheet) {
    sheet = ensureSheetWithHeaders_(ss, SHEET_NAMES.ANTREAN, HEADERS.Antrean_Pesan, {
      textHeaders: ['ID_Antrean', 'Waktu_Buat', 'Jadwal_Kirim', 'Jenis_Pesan', 'ID_Donatur', 'No_WA', 'Status', 'Waktu_Terkirim']
    });
  }
  const now = new Date();
  const idAntrean = 'MSG-' + Utilities.formatDate(now, TIMEZONE, 'yyMMddHHmmss') + '-' + ('000' + Math.floor(Math.random() * 1000)).slice(-3);
  const waktuBuat = formatTimestamp_(now);

  appendRowByHeaderMap_(sheet, {
    ID_Antrean: idAntrean,
    Waktu_Buat: waktuBuat,
    Jadwal_Kirim: String(item.jadwalKirim || waktuBuat),
    Jenis_Pesan: String(item.jenisPesan || 'Broadcast'),
    ID_Donatur: String(item.idDonatur || '-'),
    Nama_Donatur: String(item.namaDonatur || '-'),
    No_WA: safeNormalizeOrKeep_(item.noWa),
    Isi_Pesan: String(item.isiPesan || ''),
    Media_Url: String(item.mediaUrl || ''),
    Status: 'Menunggu',
    Keterangan_Hasil: 'Menunggu jadwal pengiriman.',
    Waktu_Terkirim: ''
  }, ['ID_Antrean', 'Waktu_Buat', 'Jadwal_Kirim', 'Jenis_Pesan', 'ID_Donatur', 'No_WA', 'Status', 'Waktu_Terkirim'], []);

  return idAntrean;
}

function handleSendBroadcastSingle_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = loadConfigObject_(ss);
  const waCheck = validateAndNormalizeWA_(payload.noWa);
  if (!waCheck.valid) {
    return { status: 'error', message: waCheck.error };
  }
  const messageText = String(payload.messageText || '').trim();
  if (!messageText) {
    return { status: 'error', message: 'Isi pesan tidak boleh kosong.' };
  }
  if (!config.waApiKey) {
    return { status: 'error', message: 'API Key perangkat WA belum diatur di menu Pengaturan.' };
  }

  const mediaUrl = String(payload.mediaUrl || '').trim();
  const waRes = sendWaViaRechat_(waCheck.normalized, messageText, config, mediaUrl);

  let emailDetail = '';
  if (payload.sendEmailReminder && payload.email) {
    const emailSubj = String(payload.emailSubject || 'Pengingat Donasi Tetap DAIKITA - Dakwah Pelosok').trim();
    const emailBody = String(payload.emailBody || messageText).trim();
    const emRes = sendEmailViaAlias_(String(payload.email).trim(), emailSubj, emailBody, config, mediaUrl);
    emailDetail = emRes.detail;
  }

  // Catat log broadcast ke Antrean_Pesan
  try {
    let sheet = ss.getSheetByName(SHEET_NAMES.ANTREAN);
    if (!sheet) {
      sheet = ensureSheetWithHeaders_(ss, SHEET_NAMES.ANTREAN, HEADERS.Antrean_Pesan, {
        textHeaders: ['ID_Antrean', 'Waktu_Buat', 'Jadwal_Kirim', 'Jenis_Pesan', 'ID_Donatur', 'No_WA', 'Status', 'Waktu_Terkirim']
      });
    }
    const nowStr = formatTimestamp_(new Date());
    const idAntrean = 'MSG-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyMMddHHmmss') + '-' + ('000' + Math.floor(Math.random() * 1000)).slice(-3);
    appendRowByHeaderMap_(sheet, {
      ID_Antrean: idAntrean,
      Waktu_Buat: nowStr,
      Jadwal_Kirim: nowStr,
      Jenis_Pesan: String(payload.jenisPesan || 'Broadcast Langsung'),
      ID_Donatur: String(payload.idDonatur || '-'),
      Nama_Donatur: String(payload.namaDonatur || '-'),
      No_WA: waCheck.normalized,
      Isi_Pesan: messageText,
      Media_Url: mediaUrl,
      Status: waRes.ok ? 'Terkirim' : 'Gagal',
      Keterangan_Hasil: waRes.detail + (emailDetail ? ' | ' + emailDetail : ''),
      Waktu_Terkirim: waRes.ok ? nowStr : ''
    }, ['ID_Antrean', 'Waktu_Buat', 'Jadwal_Kirim', 'Jenis_Pesan', 'ID_Donatur', 'No_WA', 'Status', 'Waktu_Terkirim'], []);
    SpreadsheetApp.flush();
  } catch (logErr) {
    Logger.log('Info log broadcast: ' + logErr);
  }

  if (!waRes.ok) {
    return {
      status: 'error',
      message: waRes.detail,
      data: { ok: false, detail: waRes.detail, emailDetail: emailDetail }
    };
  }
  return {
    status: 'success',
    message: waRes.detail,
    data: { ok: true, detail: waRes.detail, emailDetail: emailDetail }
  };
}

function handleScheduleBroadcast_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    return { status: 'error', message: 'Daftar penerima broadcast terjadwal masih kosong.' };
  }

  let queuedCount = 0;
  items.forEach(function (item) {
    const waCheck = validateAndNormalizeWA_(item.noWa);
    const body = String(item.isiPesan || '').trim();
    if (!waCheck.valid || !body) return;
    enqueueMessageRow_(ss, {
      jadwalKirim: String(item.jadwalKirim || formatTimestamp_(new Date())),
      jenisPesan: String(item.jenisPesan || 'Broadcast Terjadwal'),
      idDonatur: String(item.idDonatur || '-'),
      namaDonatur: String(item.namaDonatur || '-'),
      noWa: waCheck.normalized,
      isiPesan: body,
      mediaUrl: String(item.mediaUrl || '')
    });
    queuedCount++;
  });

  try {
    ensureRecurringQueueTrigger_();
  } catch (trigErr) {
    Logger.log('Info trigger jadwal: ' + trigErr);
  }
  SpreadsheetApp.flush();

  return {
    status: 'success',
    message: queuedCount + ' pesan berhasil dimasukkan ke antrean broadcast terjadwal.',
    data: {
      queuedCount: queuedCount,
      antreanPesan: readAntreanList_(ss)
    }
  };
}

function handleProcessQueueNow_() {
  const processedCount = processScheduledMessagesInternal_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    status: 'success',
    message: processedCount > 0
      ? processedCount + ' pesan jatuh tempo berhasil diproses.'
      : 'Belum ada pesan antrean yang jatuh tempo saat ini.',
    data: {
      processedCount: processedCount,
      antreanPesan: readAntreanList_(ss)
    }
  };
}

function processScheduledMessages() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return 0;
  try {
    return processScheduledMessagesInternal_();
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      // ignore
    }
  }
}

function processScheduledMessagesInternal_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.ANTREAN);
  if (!sheet || sheet.getLastRow() <= 1) return 0;

  const config = loadConfigObject_(ss);
  if (!config.waApiKey) return 0;

  const indexMap = getHeaderIndexMap_(sheet);
  const jadwalCol = indexMap.Jadwal_Kirim;
  const waCol = indexMap.No_WA;
  const isiCol = indexMap.Isi_Pesan;
  const mediaCol = indexMap.Media_Url;
  const statusCol = indexMap.Status;
  const ketCol = indexMap.Keterangan_Hasil;
  const sentCol = indexMap.Waktu_Terkirim;

  if (!jadwalCol || !waCol || !isiCol || !statusCol) return 0;

  const nowStr = formatTimestamp_(new Date());
  const values = sheet.getDataRange().getValues();
  let processed = 0;
  const MAX_PER_RUN = 15;

  for (let r = 1; r < values.length && processed < MAX_PER_RUN; r++) {
    const status = String(values[r][statusCol - 1] || '').trim();
    if (status !== 'Menunggu') continue;

    const jadwalStr = formatCellDateString_(values[r][jadwalCol - 1]);
    if (jadwalStr && jadwalStr > nowStr) continue;

    const noWa = safeNormalizeOrKeep_(values[r][waCol - 1]);
    const isi = String(values[r][isiCol - 1] || '').trim();
    const media = mediaCol ? String(values[r][mediaCol - 1] || '').trim() : '';

    if (!noWa || !isi) {
      sheet.getRange(r + 1, statusCol).setNumberFormat('@').setValue('Gagal');
      if (ketCol) sheet.getRange(r + 1, ketCol).setValue('Nomor WA atau isi pesan kosong.');
      processed++;
      continue;
    }

    const res = sendWaViaRechat_(noWa, isi, config, media);
    const doneTime = formatTimestamp_(new Date());
    sheet.getRange(r + 1, statusCol).setNumberFormat('@').setValue(res.ok ? 'Terkirim' : 'Gagal');
    if (ketCol) sheet.getRange(r + 1, ketCol).setValue(res.detail);
    if (sentCol && res.ok) sheet.getRange(r + 1, sentCol).setNumberFormat('@').setValue(doneTime);
    processed++;

    if (processed < MAX_PER_RUN) {
      Utilities.sleep(2500);
    }
  }

  if (processed > 0) {
    SpreadsheetApp.flush();
  }
  return processed;
}

function handleCancelScheduledMessage_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.ANTREAN);
  if (!sheet) {
    return { status: 'error', message: 'Sheet antrean pesan tidak ditemukan.' };
  }
  const idAntrean = String(payload.idAntrean || '').trim();
  if (!idAntrean) {
    return { status: 'error', message: 'ID Antrean wajib diisi.' };
  }

  const indexMap = getHeaderIndexMap_(sheet);
  const idCol = indexMap.ID_Antrean || 1;
  const statusCol = indexMap.Status || 10;
  const ketCol = indexMap.Keterangan_Hasil || 11;

  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol - 1] || '').trim() === idAntrean) {
      sheet.getRange(r + 1, statusCol).setNumberFormat('@').setValue('Dibatalkan');
      sheet.getRange(r + 1, ketCol).setValue('Dibatalkan oleh pengurus.');
      SpreadsheetApp.flush();
      return {
        status: 'success',
        message: 'Pesan terjadwal ' + idAntrean + ' berhasil dibatalkan.',
        data: {
          idAntrean: idAntrean,
          antreanPesan: readAntreanList_(ss)
        }
      };
    }
  }
  return { status: 'error', message: 'Antrean ' + idAntrean + ' tidak ditemukan.' };
}

// ==================== KONFIRMASI PEMBAYARAN ====================
function handleSubmitPembayaran_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.TRANSAKSI);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(SHEET_NAMES.TRANSAKSI);
  } else {
    ensureSheetWithHeaders_(ss, SHEET_NAMES.TRANSAKSI, HEADERS.Transaksi_Donasi, {
      textHeaders: [
        'ID_Transaksi',
        'Waktu_Input',
        'Tanggal_Transfer',
        'Jenis_Donatur',
        'ID_Donatur',
        'No_WA',
        'Bulan_Tagihan',
        'Status_Verifikasi',
        'Status_Penyaluran',
        'Keterangan'
      ],
      currencyHeaders: ['Nominal_Komitmen', 'Donasi_Lainnya', 'Nominal_Transfer']
    });
  }

  const jenisDonatur = normalizeJenisDonatur_(payload.jenisDonatur, payload.idDonatur);
  const isUmum = jenisDonatur === 'Umum';
  const idDonatur = isUmum ? 'UMUM' : String(payload.idDonatur || '').trim();
  const rawNamaDonatur = String(payload.namaDonatur || '').trim();
  const namaDonatur = rawNamaDonatur || (isUmum ? 'Hamba Allah' : '');
  const rawNoWa = String(payload.noWa || '').trim();
  const nominalTransfer = parseNumber_(payload.nominalTransfer);
  const bankTujuan = String(payload.bankTujuan || '').trim();
  const diinputOleh = String(payload.diinputOleh || 'Donatur (Mandiri)').trim();
  const userKeterangan = String(payload.keterangan || '').trim();

  const todayIso = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const tanggalTransfer = formatIsoDateCell_(payload.tanggalTransfer) || todayIso;
  if (tanggalTransfer < TRANSFER_MIN_DATE) {
    return { status: 'error', message: 'Tanggal transfer tidak boleh sebelum ' + TRANSFER_MIN_DATE + '.' };
  }
  if (tanggalTransfer > todayIso) {
    return { status: 'error', message: 'Tanggal transfer tidak boleh melebihi tanggal hari ini (' + todayIso + ').' };
  }

  const rawMonths = Array.isArray(payload.bulanTagihanList) && payload.bulanTagihanList.length > 0
    ? payload.bulanTagihanList
    : [payload.bulanTagihan];

  const monthMap = {};
  rawMonths.forEach(function (m) {
    const formatted = formatBulanTagihan_(m);
    if (/^\d{4}-\d{2}$/.test(formatted)) {
      monthMap[formatted] = true;
    }
  });
  const bulanList = Object.keys(monthMap).sort();

  if (!namaDonatur) {
    return { status: 'error', message: 'Pilih donatur terdaftar atau masukkan nama donatur terlebih dahulu.' };
  }

  let normalizedWa = '';
  if (rawNoWa) {
    const waCheck = validateAndNormalizeWA_(rawNoWa);
    if (!waCheck.valid) {
      return { status: 'error', message: waCheck.error };
    }
    normalizedWa = waCheck.normalized;
  } else if (!isUmum) {
    return { status: 'error', message: 'Nomor WhatsApp donatur terdaftar wajib diisi.' };
  }

  if (bulanList.length === 0) {
    return { status: 'error', message: 'Pilih minimal 1 bulan pencatatan yang valid (format YYYY-MM).' };
  }
  if (nominalTransfer <= 0) {
    return { status: 'error', message: 'Nominal transfer harus lebih dari Rp 0.' };
  }

  // Ambil komitmen per bulan (khusus Donatur Rutin)
  let komitmenPerBulan = isUmum ? 0 : parseNumber_(payload.nominalKomitmenPerBulan);
  if (!isUmum && komitmenPerBulan <= 0 && idDonatur) {
    const donaturSheet = ss.getSheetByName(SHEET_NAMES.DONATUR);
    const allDonors = readSheetAsObjects_(donaturSheet);
    for (let i = 0; i < allDonors.length; i++) {
      if (String(allDonors[i].ID_Donatur || '').trim() === idDonatur) {
        komitmenPerBulan = parseNumber_(allDonors[i].Nominal_Komitmen);
        break;
      }
    }
  }

  let proofUrl = '';
  let savedFileName = '';
  if (payload.fileBase64) {
    const uploadResult = uploadBuktiToDrive_({
      fileBase64: String(payload.fileBase64),
      fileMimeType: String(payload.fileMimeType || 'image/jpeg'),
      fileName: String(payload.fileName || 'bukti.jpg'),
      tanggalTransfer: tanggalTransfer,
      bulanTagihan: bulanList[0],
      bulanList: isUmum ? [bulanList[0]] : bulanList,
      namaDonatur: namaDonatur,
      nominalTransfer: nominalTransfer
    });
    proofUrl = uploadResult.url;
    savedFileName = uploadResult.savedFileName;
  }

  const now = new Date();
  const waktuInput = formatTimestamp_(now);
  const statusVerifikasi = 'Pending';
  const statusPenyaluran = 'Belum Disalurkan';
  const existingCount = Math.max(sheet.getLastRow() - 1, 0);

  const effectiveMonths = isUmum ? [bulanList[0]] : bulanList;
  const totalRp = Math.round(nominalTransfer);
  const totalKomitmenExpected = komitmenPerBulan * effectiveMonths.length;
  const hasExcess = !isUmum && komitmenPerBulan > 0 && totalRp > totalKomitmenExpected;
  const totalDonasiLainnya = hasExcess ? totalRp - totalKomitmenExpected : 0;

  const basePerMonth = Math.floor(totalRp / effectiveMonths.length);
  const remainder = totalRp % effectiveMonths.length;

  const batchNote = !isUmum && effectiveMonths.length > 1
    ? 'Bayar sekaligus ' + effectiveMonths.length + ' bln (Total ' + formatRupiahServer_(totalRp) + ')'
    : '';
  const excessNote = totalDonasiLainnya > 0
    ? 'Termasuk Donasi Umum ' + formatRupiahServer_(totalDonasiLainnya)
    : '';
  const finalKeterangan = [userKeterangan, batchNote, excessNote].filter(Boolean).join(' · ');

  const createdRows = [];
  for (let idx = 0; idx < effectiveMonths.length; idx++) {
    const bulanItem = effectiveMonths[idx];
    const nominalKomitmenBulan = isUmum
      ? 0
      : hasExcess
      ? komitmenPerBulan
      : basePerMonth + (idx < remainder ? 1 : 0);
    const donasiLainnyaBulan = !isUmum && hasExcess && idx === 0 ? totalDonasiLainnya : 0;
    const nominalTransferBulan = isUmum ? totalRp : nominalKomitmenBulan + donasiLainnyaBulan;
    const idTransaksi = generateTransaksiId_(existingCount + idx + 1, now);

    appendRowByHeaderMap_(sheet, {
      ID_Transaksi: idTransaksi,
      Waktu_Input: waktuInput,
      Tanggal_Transfer: tanggalTransfer,
      Jenis_Donatur: jenisDonatur,
      ID_Donatur: idDonatur || '-',
      Nama_Donatur: namaDonatur,
      No_WA: normalizedWa,
      Bulan_Tagihan: bulanItem,
      Nominal_Komitmen: nominalKomitmenBulan,
      Donasi_Lainnya: donasiLainnyaBulan,
      Nominal_Transfer: nominalTransferBulan,
      Bank_Tujuan: bankTujuan,
      Link_Bukti_Drive: proofUrl,
      Status_Verifikasi: statusVerifikasi,
      Diinput_Oleh: diinputOleh,
      Status_Penyaluran: statusPenyaluran,
      Keterangan: finalKeterangan
    }, [
      'ID_Transaksi',
      'Waktu_Input',
      'Tanggal_Transfer',
      'Jenis_Donatur',
      'ID_Donatur',
      'No_WA',
      'Bulan_Tagihan',
      'Status_Verifikasi',
      'Status_Penyaluran',
      'Keterangan'
    ], ['Nominal_Komitmen', 'Donasi_Lainnya', 'Nominal_Transfer']);

    // Catat khusus ke sheet Donasi_Lainnya jika ada kelebihan komitmen (Donasi Umum) atau merupakan Donatur Insidentil
    if (isUmum || donasiLainnyaBulan > 0) {
      appendDonasiLainnyaRow_(ss, {
        idTransaksi: idTransaksi,
        tanggalTransfer: tanggalTransfer,
        bulanTagihan: bulanItem,
        jenisSumber: isUmum ? 'Donatur Insidentil' : 'Donasi Umum (Kelebihan Komitmen)',
        idDonatur: idDonatur || '-',
        namaDonatur: namaDonatur,
        noWa: normalizedWa,
        nominalKomitmen: nominalKomitmenBulan,
        nominalDonasiLainnya: isUmum ? nominalTransferBulan : donasiLainnyaBulan,
        totalTransfer: nominalTransferBulan,
        statusVerifikasi: statusVerifikasi,
        keterangan: finalKeterangan,
        linkBuktiDrive: proofUrl
      });
    }

    createdRows.push({
      idTransaksi: idTransaksi,
      waktuInput: waktuInput,
      tanggalTransfer: tanggalTransfer,
      jenisDonatur: jenisDonatur,
      idDonatur: idDonatur || '-',
      namaDonatur: namaDonatur,
      noWa: normalizedWa,
      bulanTagihan: bulanItem,
      nominalKomitmen: nominalKomitmenBulan,
      donasiLainnya: donasiLainnyaBulan,
      nominalTransfer: nominalTransferBulan,
      bankTujuan: bankTujuan,
      linkBuktiDrive: proofUrl,
      statusVerifikasi: statusVerifikasi,
      diinputOleh: diinputOleh,
      statusPenyaluran: statusPenyaluran,
      keterangan: finalKeterangan
    });
  }

  SpreadsheetApp.flush();
  if (normalizedWa) {
    invalidateDonorLookupCache_(normalizedWa);
  }

  const config = loadConfigObject_(ss);
  const adminGroupNotif = sendAdminGroupNotifForPayment_(createdRows, config, {
    totalRp: totalRp,
    totalDonasiUmum: totalDonasiLainnya,
    isInsidentil: isUmum,
    bulanList: effectiveMonths
  });

  return {
    status: 'success',
    message: createdRows.length > 1
      ? 'Konfirmasi penyaluran donasi untuk ' + createdRows.length + ' bulan berhasil dikirim dan menunggu verifikasi admin.'
      : isUmum
      ? 'Donasi Insidentil atas nama ' + namaDonatur + ' berhasil dicatat dan menunggu verifikasi admin.'
      : 'Konfirmasi penyaluran donasi berhasil dikirim dan menunggu verifikasi admin.',
    data: {
      transaksi: createdRows[0],
      transaksiList: createdRows,
      savedFileName: savedFileName,
      adminGroupNotif: adminGroupNotif
    }
  };
}

// ==================== VERIFIKASI & STATUS DONATUR / GRUP WA ====================
function handleVerifikasiTransaksi_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.TRANSAKSI);
  if (!sheet) {
    return { status: 'error', message: 'Data transaksi tidak ditemukan.' };
  }

  const idTransaksi = String(payload.idTransaksi || '').trim();
  const newStatus = String(payload.status || '').trim();

  if (!idTransaksi) {
    return { status: 'error', message: 'ID Transaksi wajib diisi.' };
  }
  if (newStatus !== 'Valid' && newStatus !== 'Ditolak' && newStatus !== 'Pending') {
    return { status: 'error', message: 'Status verifikasi harus Valid atau Ditolak.' };
  }

  const indexMap = getHeaderIndexMap_(sheet);
  const idCol = indexMap.ID_Transaksi || 1;
  const verCol = indexMap.Status_Verifikasi;
  const salurCol = indexMap.Status_Penyaluran;

  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol - 1] || '').trim() === idTransaksi) {
      if (verCol) sheet.getRange(r + 1, verCol).setNumberFormat('@').setValue(newStatus);
      if (newStatus === 'Ditolak' && salurCol && salurCol <= sheet.getLastColumn()) {
        sheet.getRange(r + 1, salurCol).setNumberFormat('@').setValue('Belum Disalurkan');
      }

      // Sinkronkan juga status verifikasi pada sheet Donasi_Lainnya jika ID transaksi tercatat di sana
      const otherSheet = ss.getSheetByName(SHEET_NAMES.DONASI_LAINNYA);
      if (otherSheet && otherSheet.getLastRow() > 1) {
        const oIdx = getHeaderIndexMap_(otherSheet);
        const oIdCol = oIdx.ID_Transaksi || 1;
        const oVerCol = oIdx.Status_Verifikasi;
        if (oVerCol) {
          const oVals = otherSheet.getDataRange().getValues();
          for (let k = 1; k < oVals.length; k++) {
            if (String(oVals[k][oIdCol - 1] || '').trim() === idTransaksi) {
              otherSheet.getRange(k + 1, oVerCol).setNumberFormat('@').setValue(newStatus);
            }
          }
        }
      }

      SpreadsheetApp.flush();
      const txWaCol = indexMap.No_WA;
      if (txWaCol) {
        invalidateDonorLookupCache_(values[r][txWaCol - 1]);
      }
      return {
        status: 'success',
        message: 'Transaksi ' + idTransaksi + ' diperbarui menjadi ' + newStatus + '.',
        data: {
          idTransaksi: idTransaksi,
          statusVerifikasi: newStatus
        }
      };
    }
  }

  return { status: 'error', message: 'Transaksi dengan ID ' + idTransaksi + ' tidak ditemukan.' };
}

function handleUpdateStatusPenyaluran_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.TRANSAKSI);
  if (!sheet) {
    return { status: 'error', message: 'Data transaksi tidak ditemukan.' };
  }
  const idTransaksi = String(payload.idTransaksi || '').trim();
  const statusPenyaluran = String(payload.statusPenyaluran || '').trim();
  return {
    status: 'success',
    message: 'Transaksi ' + idTransaksi + ' dicatat.',
    data: { idTransaksi: idTransaksi, statusPenyaluran: statusPenyaluran }
  };
}

function handleUpdateStatusDonatur_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DONATUR);
  if (!sheet) {
    return { status: 'error', message: 'Data donatur tidak ditemukan.' };
  }

  const idDonatur = String(payload.idDonatur || '').trim();
  const rawStatus = String(payload.status || '').trim();
  const newStatus = normalizeStatusAktif_(rawStatus);

  if (!idDonatur) {
    return { status: 'error', message: 'ID Donatur wajib diisi.' };
  }
  if (!rawStatus || (newStatus !== 'Aktif' && newStatus !== 'Non Aktif')) {
    return { status: 'error', message: 'Status donatur harus Aktif atau Non Aktif.' };
  }

  const indexMap = getHeaderIndexMap_(sheet);
  const idCol = indexMap.ID_Donatur || 1;
  const statusCol = indexMap.Status_Aktif || 15;

  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol - 1] || '').trim() === idDonatur) {
      sheet.getRange(r + 1, statusCol).setNumberFormat('@').setValue(newStatus);
      SpreadsheetApp.flush();
      if (indexMap.No_WA) invalidateDonorLookupCache_(values[r][indexMap.No_WA - 1]);
      return {
        status: 'success',
        message: 'Status donatur ' + idDonatur + ' diubah menjadi ' + newStatus + '.',
        data: {
          idDonatur: idDonatur,
          statusAktif: newStatus
        }
      };
    }
  }

  return { status: 'error', message: 'Donatur dengan ID ' + idDonatur + ' tidak ditemukan.' };
}

function handleUpdateStatusGrupDonatur_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DONATUR);
  if (!sheet) {
    return { status: 'error', message: 'Data donatur tidak ditemukan.' };
  }
  ensureSheetWithHeaders_(ss, SHEET_NAMES.DONATUR, HEADERS.Master_Donatur, {
    textHeaders: ['Minat_Grup_WA', 'Status_Grup_WA']
  });

  const idDonatur = String(payload.idDonatur || '').trim();
  const statusGrupWa = normalizeStatusGrup_(payload.statusGrupWa);
  const hasMinat = payload.minatGrupWa !== undefined && payload.minatGrupWa !== null && String(payload.minatGrupWa).trim() !== '';
  const minatGrupWa = hasMinat ? normalizeMinatGrup_(payload.minatGrupWa) : '';

  if (!idDonatur) {
    return { status: 'error', message: 'ID Donatur wajib diisi.' };
  }

  const indexMap = getHeaderIndexMap_(sheet);
  const idCol = indexMap.ID_Donatur || 1;
  const statusGrupCol = indexMap.Status_Grup_WA;
  const minatGrupCol = indexMap.Minat_Grup_WA;

  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol - 1] || '').trim() === idDonatur) {
      if (statusGrupCol) sheet.getRange(r + 1, statusGrupCol).setNumberFormat('@').setValue(statusGrupWa);
      if (hasMinat && minatGrupCol) sheet.getRange(r + 1, minatGrupCol).setNumberFormat('@').setValue(minatGrupWa);
      SpreadsheetApp.flush();
      if (indexMap.No_WA) invalidateDonorLookupCache_(values[r][indexMap.No_WA - 1]);
      return {
        status: 'success',
        message: 'Status grup WA donatur ' + idDonatur + ' diperbarui menjadi ' + statusGrupWa + '.',
        data: {
          idDonatur: idDonatur,
          statusGrupWa: statusGrupWa,
          minatGrupWa: hasMinat ? minatGrupWa : undefined
        }
      };
    }
  }

  return { status: 'error', message: 'Donatur dengan ID ' + idDonatur + ' tidak ditemukan.' };
}

function handleBulkUpdateStatusGrupDonatur_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DONATUR);
  if (!sheet) {
    return { status: 'error', message: 'Data donatur tidak ditemukan.' };
  }
  ensureSheetWithHeaders_(ss, SHEET_NAMES.DONATUR, HEADERS.Master_Donatur, {
    textHeaders: ['Minat_Grup_WA', 'Status_Grup_WA']
  });

  const ids = Array.isArray(payload.ids) ? payload.ids : [];
  if (ids.length === 0) {
    return { status: 'error', message: 'Pilih minimal 1 donatur.' };
  }
  const statusGrupWa = normalizeStatusGrup_(payload.statusGrupWa);
  const idSet = {};
  ids.forEach(function (id) { idSet[String(id || '').trim()] = true; });

  const indexMap = getHeaderIndexMap_(sheet);
  const idCol = indexMap.ID_Donatur || 1;
  const waCol = indexMap.No_WA;
  const statusGrupCol = indexMap.Status_Grup_WA;
  const values = sheet.getDataRange().getValues();
  const updatedIds = [];
  const invalidatedPhones = [];

  for (let r = 1; r < values.length; r++) {
    const id = String(values[r][idCol - 1] || '').trim();
    if (id && idSet[id]) {
      if (statusGrupCol) sheet.getRange(r + 1, statusGrupCol).setNumberFormat('@').setValue(statusGrupWa);
      updatedIds.push(id);
      if (waCol) invalidatedPhones.push(values[r][waCol - 1]);
    }
  }

  SpreadsheetApp.flush();
  invalidateDonorLookupCacheList_(invalidatedPhones);
  return {
    status: 'success',
    message: updatedIds.length + ' donatur diperbarui menjadi ' + statusGrupWa + '.',
    data: {
      updatedIds: updatedIds,
      statusGrupWa: statusGrupWa
    }
  };
}

// ==================== DETEKSI OTOMATIS ANGGOTA GRUP WA (API + SCRAB + WEBHOOK) ====================
function extractPhonesFromAnyJson_(node, outSet) {
  if (node === null || node === undefined) return;
  if (typeof node === 'string' || typeof node === 'number') {
    const str = String(node);
    // Tangkap nomor JID (628...@s.whatsapp.net / @c.us) maupun nomor biasa
    const matches = str.match(/(?:\+?62|0)8\d{7,13}/g);
    if (matches) {
      for (let i = 0; i < matches.length; i++) {
        const norm = safeNormalizeOrKeep_(matches[i]);
        if (norm && /^628\d{7,13}$/.test(norm)) {
          outSet[norm] = true;
        }
      }
    }
    return;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      extractPhonesFromAnyJson_(node[i], outSet);
    }
    return;
  }
  if (typeof node === 'object') {
    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i++) {
      extractPhonesFromAnyJson_(node[keys[i]], outSet);
    }
  }
}

function fetchRechatGroupMemberPhones_(config) {
  const apiKey = String(config.waApiKey || '').trim();
  const groupId = String(config.waGroupId || '').trim();
  if (!apiKey) {
    return {
      ok: false,
      phones: [],
      detail: 'API Key ReChat belum diisi di Pengaturan.'
    };
  }
  if (!groupId) {
    return {
      ok: false,
      phones: [],
      detail: 'ID Grup WA Donatur (format xxxx@g.us) belum diisi di Pengaturan.'
    };
  }

  const baseEndpoint = String(config.waEndpointUrl || DEFAULT_WA_ENDPOINT)
    .trim()
    .replace(/\/messages\/?$/i, '')
    .replace(/\/+$/, '');
  const encodedGroup = encodeURIComponent(groupId);
  const candidateUrls = [
    baseEndpoint + '/' + encodeURIComponent(apiKey) + '/groups/' + encodedGroup + '/participants',
    baseEndpoint + '/' + encodeURIComponent(apiKey) + '/groups/' + encodedGroup,
    baseEndpoint + '/groups/' + encodedGroup + '/participants',
    baseEndpoint + '/groups/' + encodedGroup
  ];

  let lastStatus = 0;
  for (let i = 0; i < candidateUrls.length; i++) {
    try {
      const resp = UrlFetchApp.fetch(candidateUrls[i], {
        method: 'get',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          Accept: 'application/json'
        },
        muteHttpExceptions: true
      });
      const code = resp.getResponseCode();
      lastStatus = code;
      if (code >= 200 && code < 300) {
        const text = resp.getContentText() || '';
        const phoneSet = {};
        try {
          const parsed = JSON.parse(text);
          extractPhonesFromAnyJson_(parsed, phoneSet);
        } catch (parseErr) {
          extractPhonesFromAnyJson_(text, phoneSet);
        }
        const phones = Object.keys(phoneSet);
        if (phones.length > 0) {
          return {
            ok: true,
            phones: phones,
            detail: 'Berhasil menarik ' + phones.length + ' nomor anggota grup dari ReChat API.'
          };
        }
      }
    } catch (fetchErr) {
      Logger.log('Cek endpoint grup ReChat (' + candidateUrls[i] + '): ' + fetchErr);
    }
  }

  return {
    ok: false,
    phones: [],
    detail:
      'API ReChat belum menyediakan endpoint tarik daftar anggota grup secara langsung (HTTP ' +
      (lastStatus || '-') +
      '). Gunakan menu "Scrab Nomor" di ReChat lalu tempel/unggah ke kolom Cocokkan Scrab Nomor di sebelah, atau aktifkan Webhook Real-Time.'
  };
}

function handleSyncGroupMembers_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DONATUR);
  if (!sheet || sheet.getLastRow() <= 1) {
    return { status: 'error', message: 'Belum ada data donatur terdaftar.' };
  }
  ensureSheetWithHeaders_(ss, SHEET_NAMES.DONATUR, HEADERS.Master_Donatur, {
    textHeaders: ['Minat_Grup_WA', 'Status_Grup_WA']
  });

  const config = loadConfigObject_(ss);
  const markOthersNotJoined = Boolean(payload.markOthersNotJoined);
  const inputPhones = Array.isArray(payload.memberPhones) ? payload.memberPhones : [];

  let source = 'rechat_api';
  const memberSet = {};

  if (inputPhones.length > 0) {
    source = 'scrab_import';
    for (let i = 0; i < inputPhones.length; i++) {
      const norm = safeNormalizeOrKeep_(inputPhones[i]);
      if (norm && /^628\d{7,13}$/.test(norm)) {
        memberSet[norm] = true;
      }
    }
    if (Object.keys(memberSet).length === 0) {
      return {
        status: 'error',
        message: 'Tidak ada nomor WhatsApp Indonesia (628.../08...) yang valid ditemukan pada daftar yang dikirim.'
      };
    }
  } else {
    const apiRes = fetchRechatGroupMemberPhones_(config);
    if (!apiRes.ok) {
      return {
        status: 'error',
        message: apiRes.detail
      };
    }
    apiRes.phones.forEach(function (p) {
      memberSet[p] = true;
    });
  }

  const totalExtracted = Object.keys(memberSet).length;
  const indexMap = getHeaderIndexMap_(sheet);
  const idCol = indexMap.ID_Donatur || 1;
  const waCol = indexMap.No_WA;
  const statusGrupCol = indexMap.Status_Grup_WA;
  if (!waCol || !statusGrupCol) {
    return { status: 'error', message: 'Kolom No_WA atau Status_Grup_WA tidak ditemukan di Master_Donatur.' };
  }

  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const updatedColValues = [];
  const updatedJoinedIds = [];
  const updatedNotJoinedIds = [];
  const invalidatedPhones = [];
  let matchedDonors = 0;
  let alreadyJoined = 0;
  let hasAnyChange = false;

  for (let i = 0; i < values.length; i++) {
    const idDonatur = String(values[i][idCol - 1] || '').trim();
    const donorWa = safeNormalizeOrKeep_(values[i][waCol - 1]);
    const currentStatus = normalizeStatusGrup_(values[i][statusGrupCol - 1]);
    let nextStatus = currentStatus;

    if (donorWa && memberSet[donorWa]) {
      matchedDonors++;
      if (currentStatus === 'Sudah Bergabung') {
        alreadyJoined++;
      } else {
        nextStatus = 'Sudah Bergabung';
        updatedJoinedIds.push(idDonatur);
        invalidatedPhones.push(donorWa);
        hasAnyChange = true;
      }
    } else if (markOthersNotJoined && currentStatus === 'Sudah Bergabung') {
      nextStatus = 'Belum Bergabung';
      updatedNotJoinedIds.push(idDonatur);
      if (donorWa) invalidatedPhones.push(donorWa);
      hasAnyChange = true;
    }

    updatedColValues.push([nextStatus]);
  }

  if (hasAnyChange && updatedColValues.length > 0) {
    sheet
      .getRange(2, statusGrupCol, updatedColValues.length, 1)
      .setNumberFormat('@')
      .setValues(updatedColValues);
    SpreadsheetApp.flush();
    invalidateDonorLookupCacheList_(invalidatedPhones);
  }

  const summaryMsg =
    'Deteksi selesai (' +
    (source === 'scrab_import' ? 'Scrab Nomor' : 'ReChat API') +
    '): ' +
    matchedDonors +
    ' donatur cocok di grup, ' +
    updatedJoinedIds.length +
    ' baru ditandai Sudah Bergabung' +
    (updatedNotJoinedIds.length > 0 ? ', ' + updatedNotJoinedIds.length + ' diperbarui Belum Bergabung' : '') +
    '.';

  return {
    status: 'success',
    message: summaryMsg,
    data: {
      source: source,
      totalExtracted: totalExtracted,
      matchedDonors: matchedDonors,
      newlyJoined: updatedJoinedIds.length,
      newlyNotJoined: updatedNotJoinedIds.length,
      alreadyJoined: alreadyJoined,
      updatedJoinedIds: updatedJoinedIds,
      updatedNotJoinedIds: updatedNotJoinedIds
    }
  };
}

function handleRechatWebhook_(payload) {
  try {
    const eventName = String(payload.event || '').trim().toLowerCase();
    const data = payload.data || {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const config = loadConfigObject_(ss);
    const targetGroupId = String(config.waGroupId || '').trim().toLowerCase();

    // Hanya proses jika ID Grup WA Donatur sudah dikonfigurasi agar grup lain tidak salah tandai
    if (!targetGroupId) {
      return {
        status: 'success',
        message: 'Webhook diterima, namun ID Grup WA Donatur belum diatur di Pengaturan.'
      };
    }

    const chatId = String(data.chat || data.group_id || data.group || '').trim().toLowerCase();
    const isGroupEvent =
      data.is_group === true ||
      chatId.indexOf('@g.us') !== -1 ||
      eventName.indexOf('group') !== -1;

    if (!isGroupEvent || chatId !== targetGroupId) {
      return {
        status: 'success',
        message: 'Webhook diterima (bukan aktivitas pada Grup WA Donatur target).'
      };
    }

    // Kumpulkan nomor peserta/pengirim dari payload webhook
    const candidateSet = {};
    const directCandidates = [
      data.from,
      data.sender,
      data.participant,
      data.author,
      data.phone
    ];
    for (let i = 0; i < directCandidates.length; i++) {
      const norm = safeNormalizeOrKeep_(directCandidates[i]);
      if (norm && /^628\d{7,13}$/.test(norm)) {
        candidateSet[norm] = true;
      }
    }
    if (Array.isArray(data.participants)) {
      extractPhonesFromAnyJson_(data.participants, candidateSet);
    }

    const phones = Object.keys(candidateSet);
    if (phones.length === 0) {
      return {
        status: 'success',
        message: 'Webhook grup diterima (tidak ada nomor peserta yang terdeteksi).'
      };
    }

    const sheet = ss.getSheetByName(SHEET_NAMES.DONATUR);
    if (!sheet || sheet.getLastRow() <= 1) {
      return { status: 'success', message: 'Webhook grup diterima (belum ada data donatur).' };
    }

    const indexMap = getHeaderIndexMap_(sheet);
    const waCol = indexMap.No_WA;
    const statusGrupCol = indexMap.Status_Grup_WA;
    if (!waCol || !statusGrupCol) {
      return { status: 'success', message: 'Webhook grup diterima (kolom Status_Grup_WA belum tersedia).' };
    }

    const isLeaveEvent =
      eventName.indexOf('leave') !== -1 ||
      eventName.indexOf('remove') !== -1 ||
      String(data.action || '').toLowerCase() === 'remove' ||
      String(data.action || '').toLowerCase() === 'leave';
    const nextStatus = isLeaveEvent ? 'Belum Bergabung' : 'Sudah Bergabung';

    const colRange = sheet.getRange(2, waCol, sheet.getLastRow() - 1, 1);
    let updatedCount = 0;

    for (let i = 0; i < phones.length; i++) {
      const phone = phones[i];
      const hit = colRange.createTextFinder(phone).matchEntireCell(true).findNext();
      if (hit) {
        const rowNum = hit.getRow();
        const currVal = normalizeStatusGrup_(sheet.getRange(rowNum, statusGrupCol).getValue());
        if (currVal !== nextStatus) {
          sheet.getRange(rowNum, statusGrupCol).setNumberFormat('@').setValue(nextStatus);
          invalidateDonorLookupCache_(phone);
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      SpreadsheetApp.flush();
    }

    return {
      status: 'success',
      message: 'Webhook grup WA diproses (' + updatedCount + ' donatur diperbarui menjadi ' + nextStatus + ').'
    };
  } catch (err) {
    return {
      status: 'error',
      message: 'Gagal memproses webhook ReChat: ' + (err && err.message ? err.message : String(err))
    };
  }
}

// (Sheet Data_Panitia telah dihapus dan digantikan oleh Akses_Admin)



// ==================== KELOLA AKSES ADMIN & SUPER ADMIN ====================
function handleSaveAdminAkses_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.AKSES_ADMIN);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(SHEET_NAMES.AKSES_ADMIN);
  } else {
    ensureSheetWithHeaders_(ss, SHEET_NAMES.AKSES_ADMIN, HEADERS.Akses_Admin, {
      textHeaders: ['No_WA', 'Role', 'Status']
    });
  }

  const rawWa = String(payload.noWa || '').trim();
  const originalNoWa = safeNormalizeOrKeep_(payload.originalNoWa || '');
  const nama = String(payload.nama || '').trim();
  const role = normalizeAdminRole_(payload.role);
  const status = normalizeStatusAktif_(payload.status || 'Aktif');
  const catatan = String(payload.catatan || '').trim();

  if (!rawWa || !nama) {
    return { status: 'error', message: 'Nomor HP dan nama admin wajib diisi.' };
  }

  const waCheck = validateAndNormalizeWA_(rawWa);
  if (!waCheck.valid) {
    return { status: 'error', message: waCheck.error };
  }
  const normalizedWa = waCheck.normalized;

  const indexMap = getHeaderIndexMap_(sheet);
  const waCol = indexMap.No_WA || 1;
  const namaCol = indexMap.Nama || 2;
  const roleCol = indexMap.Role || 3;
  const statusCol = indexMap.Status || 4;
  const catatanCol = indexMap.Catatan || 5;

  const currentList = readAdminAksesList_(ss);
  const values = sheet.getDataRange().getValues();
  const targetLookupWa = originalNoWa || normalizedWa;

  let existingRow = -1;
  let existingItem = null;
  for (let r = 1; r < values.length; r++) {
    const rowWa = safeNormalizeOrKeep_(values[r][waCol - 1]);
    if (rowWa === targetLookupWa) {
      existingRow = r + 1;
      existingItem = currentList.find(function (x) { return x.noWa === rowWa; }) || null;
      break;
    }
  }

  // Cegah duplikasi jika mengubah nomor WA ke nomor lain yang sudah ada
  if (originalNoWa && originalNoWa !== normalizedWa) {
    const clash = currentList.some(function (x) { return x.noWa === normalizedWa; });
    if (clash) {
      return { status: 'error', message: 'Nomor HP ' + normalizedWa + ' sudah terdaftar di daftar akses admin.' };
    }
  }

  // Lindungi agar selalu ada minimal 1 Super Admin yang aktif
  if (existingItem && existingItem.role === 'Super Admin' && existingItem.status === 'Aktif') {
    const stillSuperActive = role === 'Super Admin' && status === 'Aktif';
    if (!stillSuperActive) {
      const otherActiveSuper = currentList.filter(function (x) {
        return x.noWa !== existingItem.noWa && x.role === 'Super Admin' && x.status === 'Aktif';
      });
      if (otherActiveSuper.length === 0) {
        return {
          status: 'error',
          message: 'Tidak dapat menurunkan atau menonaktifkan satu-satunya Super Admin yang aktif.'
        };
      }
    }
  }

  if (existingRow > 0) {
    sheet.getRange(existingRow, waCol).setNumberFormat('@').setValue(normalizedWa);
    sheet.getRange(existingRow, namaCol).setValue(nama);
    sheet.getRange(existingRow, roleCol).setNumberFormat('@').setValue(role);
    sheet.getRange(existingRow, statusCol).setNumberFormat('@').setValue(status);
    sheet.getRange(existingRow, catatanCol).setValue(catatan);
  } else {
    appendRowByHeaderMap_(sheet, {
      No_WA: normalizedWa,
      Nama: nama,
      Role: role,
      Status: status,
      Catatan: catatan
    }, ['No_WA', 'Role', 'Status'], []);
  }
  SpreadsheetApp.flush();

  return {
    status: 'success',
    message: 'Akses ' + role + ' untuk ' + nama + ' (' + normalizedWa + ') berhasil disimpan.',
    data: {
      adminAkses: readAdminAksesList_(ss)
    }
  };
}

function handleDeleteAdminAkses_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.AKSES_ADMIN);
  if (!sheet) {
    return { status: 'error', message: 'Sheet Akses_Admin tidak ditemukan.' };
  }

  const targetWa = safeNormalizeOrKeep_(payload.noWa || '');
  if (!targetWa) {
    return { status: 'error', message: 'Nomor HP admin yang akan dihapus wajib diisi.' };
  }

  const currentList = readAdminAksesList_(ss);
  const targetItem = currentList.find(function (x) { return x.noWa === targetWa; });
  if (!targetItem) {
    return { status: 'error', message: 'Nomor HP ' + targetWa + ' tidak ditemukan di Akses_Admin.' };
  }

  if (targetItem.role === 'Super Admin' && targetItem.status === 'Aktif') {
    const otherActiveSuper = currentList.filter(function (x) {
      return x.noWa !== targetWa && x.role === 'Super Admin' && x.status === 'Aktif';
    });
    if (otherActiveSuper.length === 0) {
      return {
        status: 'error',
        message: 'Tidak dapat menghapus satu-satunya Super Admin yang aktif.'
      };
    }
  }

  const indexMap = getHeaderIndexMap_(sheet);
  const waCol = indexMap.No_WA || 1;
  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (safeNormalizeOrKeep_(values[r][waCol - 1]) === targetWa) {
      sheet.deleteRow(r + 1);
      SpreadsheetApp.flush();
      return {
        status: 'success',
        message: 'Akses admin untuk ' + targetWa + ' berhasil dihapus.',
        data: {
          adminAkses: readAdminAksesList_(ss)
        }
      };
    }
  }

  return { status: 'error', message: 'Nomor HP ' + targetWa + ' tidak ditemukan.' };
}

// ==================== UPLOAD GOOGLE DRIVE (BUKTI & ASET LEMBAGA) ====================
function extractDriveFolderId_(rawValue) {
  const str = String(rawValue || '').trim();
  if (!str) return '';
  const folderMatch = str.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];
  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];
  return str.split('?')[0].trim();
}

function getDriveTargetFolder_() {
  const folderId = extractDriveFolderId_(DRIVE_FOLDER_ID);
  if (!folderId || folderId === 'GANTI_DENGAN_ID_FOLDER_GOOGLE_DRIVE_ANDA') {
    throw new Error('ID folder penyimpanan belum diisi di konfigurasi server.');
  }
  try {
    const folder = DriveApp.getFolderById(folderId);
    folder.getName();
    return folder;
  } catch (err) {
    const detail = err && err.message ? String(err.message) : '';
    if (/permission|izin|auth|scope|access/i.test(detail)) {
      throw new Error(
        'Izin akses Google Drive belum aktif atau akun deployment bukan Editor folder (' +
          folderId +
          '). Jalankan setupDatabase() di Apps Script dan pastikan deployment disetel Execute as: Me. Detail: ' +
          detail
      );
    }
    throw new Error(
      'Folder penyimpanan (' +
        folderId +
        ') tidak ditemukan atau akun Google Anda belum diberi akses Editor ke folder tersebut. Detail: ' +
        (detail || 'Akses ditolak')
    );
  }
}

function uploadAssetToDrive_(params) {
  const rootFolder = getDriveTargetFolder_();
  let assetFolder = rootFolder;
  const subIter = rootFolder.getFoldersByName('Aset_Lembaga');
  if (subIter.hasNext()) {
    assetFolder = subIter.next();
  } else {
    try {
      assetFolder = rootFolder.createFolder('Aset_Lembaga');
    } catch (e) {
      assetFolder = rootFolder;
    }
  }

  let base64Data = params.fileBase64;
  let mimeType = params.fileMimeType || 'image/png';
  const dataUriMatch = base64Data.match(/^data:([^;]+);base64,(.*)$/);
  if (dataUriMatch) {
    mimeType = dataUriMatch[1];
    base64Data = dataUriMatch[2];
  }

  const ext = resolveExtension_(mimeType, params.fileName);
  const ts = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd_HHmmss');
  const finalFileName = (params.prefix || 'ASET') + '_' + ts + '.' + ext;

  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, mimeType, finalFileName);
  const file = assetFolder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shareErr) {
    Logger.log('Peringatan izin sharing Drive aset: ' + shareErr);
  }

  const fileId = file.getId();
  return {
    fileId: fileId,
    url: file.getUrl(),
    directImageUrl: 'https://lh3.googleusercontent.com/d/' + fileId,
    savedFileName: finalFileName
  };
}

function uploadBuktiToDrive_(params) {
  const folder = getDriveTargetFolder_();

  let base64Data = params.fileBase64;
  let mimeType = params.fileMimeType || 'image/jpeg';
  const dataUriMatch = base64Data.match(/^data:([^;]+);base64,(.*)$/);
  if (dataUriMatch) {
    mimeType = dataUriMatch[1];
    base64Data = dataUriMatch[2];
  }

  const ext = resolveExtension_(mimeType, params.fileName);
  const datePart = formatIsoDateCell_(params.tanggalTransfer) || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const bulanArr = Array.isArray(params.bulanList) && params.bulanList.length > 0 ? params.bulanList : [];
  const rawBulanToken = bulanArr.length > 1
    ? bulanArr[0] + '-sd-' + bulanArr[bulanArr.length - 1]
    : (bulanArr[0] || params.bulanTagihan || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM'));
  const bulanPart = sanitizeFileToken_(rawBulanToken);
  const namaBersih = sanitizeDonorName_(params.namaDonatur || 'Donatur');
  const nominalPart = String(Math.round(parseNumber_(params.nominalTransfer)));

  const finalFileName = datePart + '_' + bulanPart + '_' + namaBersih + '_' + nominalPart + '.' + ext;

  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, mimeType, finalFileName);
  const file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shareErr) {
    Logger.log('Peringatan izin sharing Drive: ' + shareErr);
  }

  return {
    fileId: file.getId(),
    url: file.getUrl(),
    savedFileName: finalFileName
  };
}

// ==================== FUNGSI UTILITAS & VALIDASI ====================
function appendRowByHeaderMap_(sheet, valuesByHeader, textHeaders, currencyHeaders) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const row = [];
  for (let c = 0; c < headers.length; c++) {
    const hName = String(headers[c] || '').trim();
    if (hName && Object.prototype.hasOwnProperty.call(valuesByHeader, hName)) {
      row.push(valuesByHeader[hName]);
    } else {
      row.push('');
    }
  }

  const targetRow = sheet.getLastRow() + 1;
  const textSet = {};
  (textHeaders || []).forEach(function (h) { textSet[h] = true; });
  const currSet = {};
  (currencyHeaders || []).forEach(function (h) { currSet[h] = true; });

  for (let c = 0; c < headers.length; c++) {
    const hName = String(headers[c] || '').trim();
    if (textSet[hName]) {
      sheet.getRange(targetRow, c + 1).setNumberFormat('@');
    } else if (currSet[hName]) {
      sheet.getRange(targetRow, c + 1).setNumberFormat('#,##0');
    }
  }
  sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
}

function normalizeRole_(rawRole) {
  const clean = String(rawRole || '').trim().toLowerCase();
  if (clean === 'super admin' || clean === 'superadmin') return 'Super Admin';
  if (clean === 'publik' || clean === 'public') return 'Publik';
  return 'Admin';
}

function normalizeJenisKelamin_(raw) {
  const clean = String(raw || '').trim().toLowerCase();
  if (clean === 'laki-laki' || clean === 'l' || clean === 'pria' || clean === 'ikhwan') return 'Laki-laki';
  if (clean === 'perempuan' || clean === 'p' || clean === 'wanita' || clean === 'akhwat') return 'Perempuan';
  return '';
}

function normalizeMinatGrup_(raw) {
  const clean = String(raw || '').trim().toLowerCase();
  if (clean === 'tidak' || clean === 'no' || clean === 'false' || clean === '0') return 'Tidak';
  return 'Ya';
}

function normalizeStatusGrup_(raw) {
  const clean = String(raw || '').trim().toLowerCase();
  if (clean === 'sudah bergabung' || clean === 'sudah' || clean === 'joined' || clean === 'ya' || clean === 'true') {
    return 'Sudah Bergabung';
  }
  return 'Belum Bergabung';
}

function normalizeStatusAktif_(raw) {
  const clean = String(raw || '').trim().toLowerCase();
  if (clean === 'non aktif' || clean === 'non-aktif' || clean === 'nonaktif' || clean === 'tidak aktif' || clean === 'cuti' || clean === 'inactive') {
    return 'Non Aktif';
  }
  return 'Aktif';
}

function normalizeJenisDonatur_(raw, idDonatur) {
  const clean = String(raw || '').trim().toLowerCase();
  const cleanId = String(idDonatur || '').trim().toUpperCase();
  if (
    clean === 'umum' ||
    clean === 'insidental' ||
    clean === 'insidentil' ||
    clean === 'donatur insidentil' ||
    clean === 'non-rutin' ||
    cleanId === 'UMUM' ||
    cleanId.indexOf('DU-') === 0
  ) {
    return 'Umum';
  }
  return 'Rutin';
}

function parseRequestBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }
  const raw = String(e.postData.contents).trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function readSheetAsObjects_(sheet) {
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = data[0].map(function (h) {
    return String(h || '').trim();
  });

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    let hasValue = false;
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      if (!key) continue;
      const val = data[i][j];
      if (val !== '' && val !== null && val !== undefined) {
        hasValue = true;
      }
      obj[key] = val;
    }
    if (hasValue) {
      rows.push(obj);
    }
  }
  return rows;
}

function validateAndNormalizeWA_(raw) {
  if (raw === null || raw === undefined) {
    return { valid: false, normalized: '', error: 'Nomor WhatsApp wajib diisi.' };
  }

  const trimmed = String(raw).trim();
  if (!trimmed) {
    return { valid: false, normalized: '', error: 'Nomor WhatsApp wajib diisi.' };
  }

  const hasExplicitPlus = trimmed.charAt(0) === '+';
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return { valid: false, normalized: '', error: 'Nomor WhatsApp hanya boleh berisi angka.' };
  }

  if (digits.indexOf('00') === 0) {
    digits = digits.substring(2);
  }

  if (digits.indexOf('6208') === 0) {
    digits = '628' + digits.substring(4);
  } else if (!hasExplicitPlus && digits.indexOf('08') === 0) {
    digits = '62' + digits.substring(1);
  } else if (!hasExplicitPlus && digits.indexOf('8') === 0) {
    digits = '62' + digits;
  }

  if (digits.indexOf('628') === 0) {
    if (digits.length < 9 || digits.length > 15) {
      return {
        valid: false,
        normalized: '',
        error: 'Nomor WA Indonesia (awalan 628) harus terdiri dari 9 hingga 15 angka termasuk 628.'
      };
    }
    return { valid: true, normalized: digits, error: '' };
  }

  if (digits.indexOf('62') === 0 && digits.indexOf('628') !== 0) {
    return {
      valid: false,
      normalized: '',
      error: 'Nomor WA Indonesia harus berformat 628... (contoh: 08123456789 -> 628123456789).'
    };
  }

  if (digits.indexOf('0') === 0) {
    return {
      valid: false,
      normalized: '',
      error: 'Untuk nomor luar Indonesia, sertakan kode negara di depan (contoh: +60..., +65..., +966...).'
    };
  }

  if (digits.length < 7 || digits.length > 15) {
    return {
      valid: false,
      normalized: '',
      error: 'Nomor WhatsApp internasional harus terdiri dari 7 hingga 15 angka termasuk kode negara.'
    };
  }

  return { valid: true, normalized: digits, error: '' };
}

function safeNormalizeOrKeep_(raw) {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (!str) return '';
  const res = validateAndNormalizeWA_(str);
  return res.valid ? res.normalized : str.replace(/\D/g, '');
}

function parseNumber_(val) {
  if (typeof val === 'number' && !isNaN(val)) return val;
  const cleaned = String(val || '').replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

function sanitizeDonorName_(name) {
  const cleaned = String(name || 'Donatur')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 40);
  return cleaned || 'Donatur';
}

function sanitizeFileToken_(token) {
  return String(token || '')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .trim();
}

function resolveExtension_(mimeType, fileName) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.indexOf('svg') !== -1) return 'svg';
  if (mime.indexOf('jpeg') !== -1 || mime.indexOf('jpg') !== -1) return 'jpg';
  if (mime.indexOf('png') !== -1) return 'png';
  if (mime.indexOf('webp') !== -1) return 'webp';
  if (mime.indexOf('pdf') !== -1) return 'pdf';

  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  if (match && ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'svg'].indexOf(match[1]) !== -1) {
    return match[1] === 'jpeg' ? 'jpg' : match[1];
  }
  return 'png';
}

function formatTimestamp_(dateObj) {
  return Utilities.formatDate(dateObj, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function formatCellDateString_(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }
  return String(val).trim();
}

function formatIsoDateCell_(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, TIMEZONE, 'yyyy-MM-dd');
  }
  const s = String(val).trim();
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return isoMatch[1] + '-' + ('0' + isoMatch[2]).slice(-2) + '-' + ('0' + isoMatch[3]).slice(-2);
  }
  return '';
}

function formatBulanTagihan_(val) {
  if (!val) return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM');
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, TIMEZONE, 'yyyy-MM');
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{4})-(\d{1,2})/);
  if (match) {
    return match[1] + '-' + ('0' + match[2]).slice(-2);
  }
  return str;
}

/**
 * Generator ID Donatur berurut harian: DK{yy}{mm}{dd}{0001}
 * Nomor urut otomatis reset ke 0001 setiap ganti hari.
 */
function generateDonaturId_(existingRows, dateObj) {
  const prefix = 'DK' + Utilities.formatDate(dateObj || new Date(), TIMEZONE, 'yyMMdd');
  let maxSeq = 0;
  if (Array.isArray(existingRows)) {
    for (let i = 0; i < existingRows.length; i++) {
      const id = String(existingRows[i].ID_Donatur || '').trim().toUpperCase();
      if (id.indexOf(prefix) === 0) {
        const suffix = id.substring(prefix.length);
        const parsed = parseInt(suffix, 10);
        if (!isNaN(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      }
    }
  }
  const nextSeq = ('0000' + (maxSeq + 1)).slice(-4);
  return prefix + nextSeq;
}

function generateTransaksiId_(seq, dateObj) {
  const ymd = Utilities.formatDate(dateObj, TIMEZONE, 'yyMMdd');
  const num = ('000' + seq).slice(-3);
  const rand = ('00' + Math.floor(Math.random() * 90 + 10)).slice(-2);
  return 'TRX-' + ymd + '-' + num + rand;
}
