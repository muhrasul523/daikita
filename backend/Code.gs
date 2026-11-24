/**
 * ============================================================================
 * DAIKITA — SISTEM MANAJEMEN DONATUR RUTIN KAFALAH DAI (BACKEND APPS SCRIPT)
 * "Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah."
 * Arsitektur Serverless: Google Sheets + Google Drive + Gmail + ReChat WA API
 * ============================================================================
 * CARA SETUP / PERBARUI CEPAT:
 * 1. Buka Google Sheets -> menu Ekstensi -> Apps Script.
 * 2. Tempel seluruh kode ini ke file Code.gs lalu simpan (Ctrl+S).
 * 3. Pastikan DRIVE_FOLDER_ID sudah sesuai dengan folder Google Drive Anda.
 * 4. Pilih fungsi "setupDatabase" di toolbar atas -> klik Jalankan (Run).
 *    (Aman dijalankan berulang kali: menambahkan kolom baru Minat_Grup_WA,
 *    Status_Grup_WA, Tanggal_Transfer, Nominal_Komitmen, Donasi_Lainnya,
 *    sheet Antrean_Pesan, memicu izin Drive/Gmail, dan memasang trigger jadwal.)
 * 5. Klik Terapkan (Deploy) -> Kelola deployment -> Edit -> Versi baru -> Terapkan.
 *    Pastikan Execute as = Me (Saya) dan Who has access = Anyone (Siapa saja).
 * ============================================================================
 */

// ==================== KONFIGURASI DEFAULT ====================
const DRIVE_FOLDER_ID = '1KqfNK8yLOpb-7Ew6KXkfJoNU6XKmzK73';

const NAMA_LEMBAGA = 'DAIKITA — Kafalah Dai';
const TAGLINE_LEMBAGA = 'Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah.';
const APP_PUBLIC_URL = 'https://daikita.duwd.web.id/';
const DEFAULT_LOGO_URL = 'https://lh3.googleusercontent.com/d/1OOSQydygv0K9SNcQUXQTqQyduW57mv4Y';

const DEFAULT_WA_ENDPOINT = 'https://www.rechat.id/api/v1/messages';
const DEFAULT_WA_API_KEY = 'wag_8d4afa8dfa57f45f95961017e050b36b15de17edd2fdc542';

const DEFAULT_EMAIL_ALIAS = 'lajnahdai.dpp@gmail.com';
const DEFAULT_EMAIL_SENDER_NAME = 'DAIKITA — Lajnah Dai Wahdah Islamiyah';

const TRANSFER_MIN_DATE = '2026-01-01';

const INFO_REKENING_DEFAULT = [
  {
    bank: 'BSI (Bank Syariah Indonesia)',
    nomor: '7777767407',
    atasNama: 'LAJNAH DAI'
  }
];

/** Pesan 1: Notifikasi Awal Pendaftaran Donatur Baru (rotasi anti-spam) */
const DEFAULT_WA_TEMPLATES = [
  "Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nAhlan wa sahlan {sapaan} *{nama}*,\nTerima kasih telah bergabung sebagai Donatur Rutin *Kafalah Dai* di *{lembaga}*.\n\n*Rincian Data Donatur:*\n• ID Donatur: *{id_donatur}*\n• Nama Lengkap: {nama}\n• Jenis Kelamin: {jenis_kelamin}\n• Domisili: {domisili}\n• Komitmen Bulanan: *{nominal}*\n• Jadwal Pengingat: Setiap tanggal {tgl_pengingat}\n• Perantara: {perantara}\n\nPenyaluran donasi dapat melalui rekening resmi:\n{rekening}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor ini.\n{link_grup_section}\n_Syukran wa jazakumullahu khairan._\n_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._\n_Aamiin._",
  "Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh {sapaan} *{nama}*.\n\nAlhamdulillah, pendaftaran Donatur Rutin *Kafalah Dai* di *{lembaga}* telah resmi tercatat.\n\n*Rincian Data Donatur:*\n- ID Donatur: *{id_donatur}*\n- Nama: {nama}\n- Jenis Kelamin: {jenis_kelamin}\n- Wilayah: {domisili}\n- Komitmen Bulanan: *{nominal} / bulan*\n- Pengingat Rutin: Tanggal {tgl_pengingat} setiap bulan\n- Perantara: {perantara}\n\nSalurkan donasi melalui rekening resmi berikut:\n{rekening}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor ini.\n{link_grup_section}\n_Syukran wa jazakumullahu khairan._\n_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._\n_Aamiin._",
  "Assalamu'alaikum Warahmatullahi Wabarakatuh {sapaan} *{nama}*\n\nTerima kasih atas kepercayaan {sapaan} mendukung program *Kafalah Dai* bersama *{lembaga}*.\n\n*Detail Kepesertaan Donatur:*\n• ID Donatur: *{id_donatur}*\n• Nama Lengkap: {nama}\n• Jenis Kelamin: {jenis_kelamin}\n• Domisili: {domisili}\n• Nominal Komitmen: *{nominal}*\n• Tanggal Pengingat: Setiap tanggal {tgl_pengingat}\n• Perantara: {perantara}\n\nRekening Resmi Penyaluran:\n{rekening}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor ini.\n{link_grup_section}\n_Syukran wa jazakumullahu khairan._\n_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._\n_Aamiin._"
];

/** Pesan 2: Arahan Save Nomor (jeda 1 menit setelah daftar) */
const DEFAULT_WA_FOLLOWUP_TEMPLATES = [
  "Assalamu'alaikum {sapaan} *{nama}*,\n\nMohon berkenan untuk *menyimpan (save) nomor WhatsApp ini* di kontak {sapaan} dengan nama *{lembaga}*.\n\nDengan menyimpan nomor ini:\n• Tautan konfirmasi & tautan grup di pesan sebelumnya dapat langsung diklik\n• Notifikasi pengingat rutin & informasi penyaluran *Kafalah Dai* dapat diterima dengan lancar\n• {sapaan} dapat langsung japri admin di nomor ini kapan saja\n\n_Syukran wa jazakumullahu khairan._",
  "Bismillah, izin mengingatkan kembali {sapaan} *{nama}* 😊\n\nAgar tautan web konfirmasi dapat diklik dan {sapaan} selalu menerima notifikasi pengingat rutin serta laporan penyaluran *Kafalah Dai*, silakan *simpan nomor ini* di buku kontak HP {sapaan} (contoh: *DAIKITA Lajnah Dai*).\n\nJika ada pertanyaan atau konfirmasi transfer, silakan balas langsung pesan ini ya {sapaan}.\n_Jazakumullahu khairan._",
  "Halo {sapaan} *{nama}*, satu langkah kecil agar komunikasi kita semakin lancar:\n\nSilakan *save nomor resmi {lembaga}* ini di kontak HP {sapaan}. Dengan begitu, gambar QRIS, pengingat bulanan, serta update program *Kafalah Dai* akan tampil utuh dan tautannya langsung bisa dibuka.\n\n_Barakallahu fiikum, terima kasih banyak {sapaan}._"
];

/** Template WA Reminder Bulanan (ringkas tanpa rincian data daftar + otomatis lampirkan QRIS bila ada) */
const DEFAULT_WA_REMINDER_TEMPLATES = [
  "Assalamu'alaikum Warahmatullahi Wabarakatuh, {sapaan} *{nama}*.\n\nSemoga {sapaan} sekeluarga senantiasa dalam kesehatan dan lindungan Allah.\n\nIzin menyampaikan pengingat rutin donasi *Kafalah Dai* untuk periode *{bulan}* sebesar *{nominal}* melalui *{lembaga}*.\n\nPenyaluran dapat melalui rekening resmi:\n{rekening}\n{qris_note}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor ini.\n\n_Syukran wa jazakumullahu khairan._\n_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._\n_Aamiin._",
  "Bismillah, Assalamu'alaikum {sapaan} *{nama}*.\n\nMengingatkan dengan penuh hormat untuk jadwal donasi rutin *Kafalah Dai* periode *{bulan}* (Komitmen: *{nominal}*).\n\nSalurkan melalui rekening resmi berikut:\n{rekening}\n{qris_note}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor ini.\n\n_Syukran wa jazakumullahu khairan._\n_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._\n_Aamiin._",
  "Assalamu'alaikum Warahmatullahi Wabarakatuh {sapaan} *{nama}*.\n\nWaktu kebaikan bulan *{bulan}* telah tiba. Izin mengingatkan komitmen donasi *Kafalah Dai* sebesar *{nominal}* bersama *{lembaga}*.\n\nRekening resmi penyaluran:\n{rekening}\n{qris_note}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor ini.\n\n_Syukran wa jazakumullahu khairan._\n_Semoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir._\n_Aamiin._"
];

/** 1 Template Email Pendaftaran Awal */
const DEFAULT_EMAIL_TEMPLATE_DAFTAR = {
  subject: 'Selamat Bergabung di {lembaga} — Donatur Rutin Kafalah Dai ({id_donatur})',
  body: "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nYth. {sapaan} {nama},\n\nTerima kasih telah bergabung sebagai Donatur Rutin Program Kafalah Dai bersama {lembaga}.\n\nRincian Data Donatur:\n• ID Donatur: {id_donatur}\n• Nama Lengkap: {nama}\n• Jenis Kelamin: {jenis_kelamin}\n• Domisili: {domisili}\n• Nominal Komitmen: {nominal} / bulan\n• Jadwal Pengingat Rutin: Setiap tanggal {tgl_pengingat}\n• Perantara / Pengurus: {perantara}\n\nPenyaluran donasi dapat melalui rekening resmi berikut:\n{rekening}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor WhatsApp resmi kami.\n{link_grup_section}\nSyukran wa jazakumullahu khairan.\nSemoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir.\nAamiin.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh,\n{lembaga}"
};

/** 1 Template Email Pengingat / Reminder Bulanan */
const DEFAULT_EMAIL_TEMPLATE_REMINDER = {
  subject: 'Pengingat Donasi Rutin Kafalah Dai ({bulan}) — {lembaga}',
  body: "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nYth. {sapaan} {nama},\n\nSemoga {sapaan} beserta keluarga senantiasa dalam lindungan dan keberkahan Allah.\nDengan hormat kami menyampaikan pengingat donasi rutin Kafalah Dai periode {bulan} sebesar {nominal}.\n\nPenyaluran donasi dapat melalui rekening resmi berikut:\n{rekening}\n{qris_note}\n\nKonfirmasi bukti transfer dapat dikirim melalui web:\n{link_konfirmasi}\natau melalui japri admin via nomor WhatsApp resmi kami.\n\nSyukran wa jazakumullahu khairan.\nSemoga Allah membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir.\nAamiin.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh,\n{lembaga}"
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
  PANITIA: 'Data_Panitia',
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
  Data_Panitia: [
    'Kode_Panitia',
    'Nama_Panitia',
    'Jenis_Kelamin',
    'No_WA_Panitia',
    'Role'
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

  const panitiaSheet = ensureSheetWithHeaders_(ss, SHEET_NAMES.PANITIA, HEADERS.Data_Panitia, {
    textHeaders: ['Kode_Panitia', 'Jenis_Kelamin', 'No_WA_Panitia', 'Role'],
    widthByHeader: {
      Kode_Panitia: 140,
      Nama_Panitia: 220,
      Jenis_Kelamin: 120,
      No_WA_Panitia: 165,
      Role: 145
    }
  });

  if (panitiaSheet.getLastRow() <= 1) {
    const initialPanitia = [
      { Kode_Panitia: 'ADM01', Nama_Panitia: 'Admin Sekretariat', Jenis_Kelamin: 'Laki-laki', No_WA_Panitia: '6281100000001', Role: 'Super Admin' },
      { Kode_Panitia: 'PNT01', Nama_Panitia: 'Koordinator Wilayah Utara', Jenis_Kelamin: 'Laki-laki', No_WA_Panitia: '6281100000002', Role: 'Admin' },
      { Kode_Panitia: 'PNT02', Nama_Panitia: 'Koordinator Wilayah Selatan', Jenis_Kelamin: 'Perempuan', No_WA_Panitia: '6281100000003', Role: 'Admin' }
    ];
    initialPanitia.forEach(function (rowObj) {
      appendRowByHeaderMap_(panitiaSheet, rowObj, ['Kode_Panitia', 'Jenis_Kelamin', 'No_WA_Panitia', 'Role'], []);
    });
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
    const action = String(params.action || 'getInitialData').trim();

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

    if (action === 'getInitialData') {
      return jsonResponse_({
        status: 'success',
        message: 'Data berhasil disinkronkan.',
        data: getInitialData_()
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

    if (!action) {
      return jsonResponse_({
        status: 'error',
        message: 'Parameter action tidak ditemukan.'
      });
    }

    if (action === 'getInitialData') {
      return jsonResponse_({
        status: 'success',
        message: 'Data berhasil disinkronkan.',
        data: getInitialData_()
      });
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
      case 'savePengaturan':
        result = handleSavePengaturan_(payload);
        break;
      case 'savePanitia':
        result = handleSavePanitia_(payload);
        break;
      case 'deletePanitia':
        result = handleDeletePanitia_(payload);
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
function buildDefaultSettingsMap_() {
  return {
    namaLembaga: NAMA_LEMBAGA,
    tagline: TAGLINE_LEMBAGA,
    logoUrl: DEFAULT_LOGO_URL,
    qrisUrl: '',
    qrisMerchantName: 'LAJNAH DAI',
    showQris: 'true',
    defaultNominal: '50000',
    defaultTglPengingat: '5',
    catatanPembayaran: 'Penyaluran donasi rutin Kafalah Dai hanya melalui rekening resmi atau QRIS lembaga.',
    infoRekening: JSON.stringify(INFO_REKENING_DEFAULT),
    enableWaNotif: 'true',
    waEndpointUrl: DEFAULT_WA_ENDPOINT,
    waApiKey: DEFAULT_WA_API_KEY,
    waTemplates: JSON.stringify(DEFAULT_WA_TEMPLATES),
    waFollowupTemplates: JSON.stringify(DEFAULT_WA_FOLLOWUP_TEMPLATES),
    waFollowupDelaySec: '60',
    waReminderTemplates: JSON.stringify(DEFAULT_WA_REMINDER_TEMPLATES),
    waGroupName: 'Grup Donatur DAIKITA — Kafalah Dai',
    waGroupLink: '',
    waGroupId: '',
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
    namaLembaga: String(rawMap.namaLembaga || NAMA_LEMBAGA).trim() || NAMA_LEMBAGA,
    tagline: String(rawMap.tagline || TAGLINE_LEMBAGA).trim() || TAGLINE_LEMBAGA,
    logoUrl: String(rawMap.logoUrl || DEFAULT_LOGO_URL).trim() || DEFAULT_LOGO_URL,
    qrisUrl: String(rawMap.qrisUrl || '').trim(),
    qrisMerchantName: String(rawMap.qrisMerchantName || 'LAJNAH DAI').trim(),
    showQris: String(rawMap.showQris || 'true').toLowerCase() !== 'false',
    defaultNominal: parseNumber_(rawMap.defaultNominal) || 50000,
    defaultTglPengingat: Math.min(31, Math.max(1, parseNumber_(rawMap.defaultTglPengingat) || 5)),
    catatanPembayaran: String(rawMap.catatanPembayaran || '').trim(),
    infoRekening: parsedRekening,
    enableWaNotif: String(rawMap.enableWaNotif || 'true').toLowerCase() !== 'false',
    waEndpointUrl: effectiveWaEndpoint,
    waApiKey: effectiveWaKey,
    waTemplates: parsedWaTemplates,
    waFollowupTemplates: parsedWaFollowupTemplates,
    waFollowupDelaySec: delayNum >= 15 && delayNum <= 600 ? delayNum : 60,
    waReminderTemplates: parsedWaReminderTemplates,
    waGroupName: String(rawMap.waGroupName || 'Grup Donatur DAIKITA — Kafalah Dai').trim(),
    waGroupLink: String(rawMap.waGroupLink || '').trim(),
    waGroupId: String(rawMap.waGroupId || '').trim(),
    enableEmailNotif: String(rawMap.enableEmailNotif || 'true').toLowerCase() !== 'false',
    emailSenderAlias: effectiveEmailAlias,
    emailSenderName: effectiveEmailName,
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

  const updatedMap = {
    namaLembaga: String(payload.namaLembaga || current.namaLembaga).trim() || NAMA_LEMBAGA,
    tagline: String(payload.tagline || current.tagline).trim() || TAGLINE_LEMBAGA,
    logoUrl: logoUrl,
    qrisUrl: qrisUrl,
    qrisMerchantName: String(payload.qrisMerchantName !== undefined ? payload.qrisMerchantName : current.qrisMerchantName).trim(),
    showQris: payload.showQris === false ? 'false' : 'true',
    defaultNominal: String(parseNumber_(payload.defaultNominal) || current.defaultNominal || 50000),
    defaultTglPengingat: String(Math.min(31, Math.max(1, parseNumber_(payload.defaultTglPengingat) || current.defaultTglPengingat || 5))),
    catatanPembayaran: String(payload.catatanPembayaran !== undefined ? payload.catatanPembayaran : current.catatanPembayaran).trim(),
    infoRekening: JSON.stringify(rekeningInput.length > 0 ? rekeningInput : current.infoRekening),
    enableWaNotif: payload.enableWaNotif === false ? 'false' : 'true',
    waEndpointUrl: String(payload.waEndpointUrl !== undefined ? payload.waEndpointUrl : current.waEndpointUrl).trim() || DEFAULT_WA_ENDPOINT,
    waApiKey: String(payload.waApiKey !== undefined ? payload.waApiKey : current.waApiKey).trim() || DEFAULT_WA_API_KEY,
    waTemplates: JSON.stringify(waTemplatesInput.length > 0 ? waTemplatesInput : current.waTemplates),
    waFollowupTemplates: JSON.stringify(waFollowupInput.length > 0 ? waFollowupInput : current.waFollowupTemplates),
    waFollowupDelaySec: String(safeDelay),
    waReminderTemplates: JSON.stringify(waReminderInput.length > 0 ? waReminderInput : current.waReminderTemplates),
    waGroupName: String(payload.waGroupName !== undefined ? payload.waGroupName : current.waGroupName).trim(),
    waGroupLink: String(payload.waGroupLink !== undefined ? payload.waGroupLink : current.waGroupLink).trim(),
    waGroupId: String(payload.waGroupId !== undefined ? payload.waGroupId : current.waGroupId).trim(),
    enableEmailNotif: payload.enableEmailNotif === false ? 'false' : 'true',
    emailSenderAlias: String(payload.emailSenderAlias !== undefined ? payload.emailSenderAlias : current.emailSenderAlias).trim() || DEFAULT_EMAIL_ALIAS,
    emailSenderName: String(payload.emailSenderName !== undefined ? payload.emailSenderName : current.emailSenderName).trim() || DEFAULT_EMAIL_SENDER_NAME,
    emailTemplateDaftar: JSON.stringify(emailDaftarInput),
    emailTemplateReminder: JSON.stringify(emailReminderInput),
    emailTemplates: JSON.stringify([emailDaftarInput, emailReminderInput])
  };

  writeSettingsMap_(sheet, updatedMap);
  SpreadsheetApp.flush();

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

// ==================== HANDLER DATA UTAMA ====================
function getInitialData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_NAMES.DONATUR) ||
      !ss.getSheetByName(SHEET_NAMES.TRANSAKSI) ||
      !ss.getSheetByName(SHEET_NAMES.PANITIA) ||
      !ss.getSheetByName(SHEET_NAMES.PENGATURAN) ||
      !ss.getSheetByName(SHEET_NAMES.ANTREAN)) {
    setupDatabase();
  } else {
    ensureMigratedDefaultLogo_(ss);
    ensureMigratedDefaultRekeningAndTemplates_(ss);
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
      namaPerantara: String(row.Nama_Perantara || 'Langsung (Tanpa Perantara)').trim(),
      statusAktif: String(row.Status_Aktif || 'Aktif').trim(),
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
    const nominalTransfer = parseNumber_(row.Nominal_Transfer);
    const donasiLainnya = Math.max(0, parseNumber_(row.Donasi_Lainnya));
    const nominalKomitmenRaw = parseNumber_(row.Nominal_Komitmen);
    const nominalKomitmen = nominalKomitmenRaw > 0 ? nominalKomitmenRaw : Math.max(0, nominalTransfer - donasiLainnya);

    return {
      idTransaksi: String(row.ID_Transaksi || '').trim(),
      waktuInput: waktuInput,
      tanggalTransfer: tanggalTransfer,
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

  const panitia = readSheetAsObjects_(ss.getSheetByName(SHEET_NAMES.PANITIA)).map(function (row) {
    return {
      kodePanitia: String(row.Kode_Panitia || '').trim(),
      namaPanitia: String(row.Nama_Panitia || '').trim(),
      jenisKelamin: normalizeJenisKelamin_(row.Jenis_Kelamin),
      noWaPanitia: safeNormalizeOrKeep_(row.No_WA_Panitia),
      role: normalizeRole_(row.Role)
    };
  }).filter(function (p) {
    return p.kodePanitia !== '' && p.namaPanitia !== '';
  });

  const antreanPesan = readAntreanList_(ss);

  return {
    config: config,
    donatur: donatur,
    transaksi: transaksi,
    panitia: panitia,
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
  const metodeDaftar = String(payload.metodeDaftar || 'Mandiri').trim();
  const kodePerantara = String(payload.kodePerantara || '').trim();
  const namaPerantara = String(payload.namaPerantara || 'Langsung (Tanpa Perantara)').trim();
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
    return { status: 'error', message: 'Tanggal pengingat rutin wajib antara 1 sampai 31.' };
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
            namaLengkap: String(existingRows[i].Nama_Lengkap || ''),
            jenisKelamin: normalizeJenisKelamin_(existingRows[i].Jenis_Kelamin),
            noWa: existingWa,
            email: String(existingRows[i].Email || ''),
            domisili: String(existingRows[i].Domisili || ''),
            provinsi: String(existingRows[i].Provinsi || ''),
            nominalKomitmen: parseNumber_(existingRows[i].Nominal_Komitmen),
            statusAktif: String(existingRows[i].Status_Aktif || 'Aktif')
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
    Program_Donasi: 'Kafalah Dai',
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

  return {
    status: 'success',
    message: 'Donatur ' + namaLengkap + ' berhasil didaftarkan (' + idDonatur + ').',
    data: {
      donatur: createdDonatur,
      notifStatus: notifStatus
    }
  };
}

function handleTestNotification_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = loadConfigObject_(ss);
  const testWaRaw = String(payload.noWa || '').trim();
  const testEmail = String(payload.email || '').trim();
  const testNama = String(payload.namaLengkap || 'Hamba Allah (Tes Notifikasi)').trim();
  const testJk = normalizeJenisKelamin_(payload.jenisKelamin) || 'Laki-laki';
  const testMinat = normalizeMinatGrup_(payload.minatGrupWa);
  const messageType = String(payload.messageType || 'daftar').trim();

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
    namaPerantara: 'Admin Sekretariat',
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
  const groupName = String(config.waGroupName || 'Grup Donatur DAIKITA').trim();
  const shouldIncludeGroup =
    opts.includeGroupLink !== undefined
      ? Boolean(opts.includeGroupLink)
      : normalizeMinatGrup_(donatur.minatGrupWa) === 'Ya';

  const linkGrupSection =
    shouldIncludeGroup && groupLink
      ? '\nSilakan bergabung ke *' + groupName + '* melalui tautan berikut:\n' + groupLink + '\n'
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
    '{perantara}': donatur.namaPerantara || 'Langsung (Tanpa Perantara)',
    '{lembaga}': config.namaLembaga || NAMA_LEMBAGA,
    '{rekening}': formatRekeningTextServer_(config.infoRekening),
    '{link_konfirmasi}': APP_PUBLIC_URL,
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
    const fBody = renderNotifTemplate_(fList[fIdx], donatur, config, { includeGroupLink: false });
    result.wa = sendWaViaRechat_(donatur.noWa, fBody, config, '');
    result.wa.templateIndex = fIdx;
  } else if (messageType === 'reminder') {
    const rList = Array.isArray(config.waReminderTemplates) && config.waReminderTemplates.length > 0
      ? config.waReminderTemplates
      : DEFAULT_WA_REMINDER_TEMPLATES;
    const rIdx = rotationIdx % rList.length;
    const rBody = renderNotifTemplate_(rList[rIdx], donatur, config, { includeGroupLink: false });
    const qrisMedia = config.showQris && config.qrisUrl ? config.qrisUrl : '';
    result.wa = sendWaViaRechat_(donatur.noWa, rBody, config, qrisMedia);
    result.wa.templateIndex = rIdx;
  } else {
    // Default: Pendaftaran Awal (Pesan 1 langsung + Pesan 2 terjadwal jeda 1 menit)
    const waList = Array.isArray(config.waTemplates) && config.waTemplates.length > 0
      ? config.waTemplates
      : DEFAULT_WA_TEMPLATES;
    const waTemplateIdx = rotationIdx % waList.length;
    const waBody = renderNotifTemplate_(waList[waTemplateIdx], donatur, config, {
      includeGroupLink: normalizeMinatGrup_(donatur.minatGrupWa) === 'Ya'
    });
    result.wa = sendWaViaRechat_(donatur.noWa, waBody, config, '');
    result.wa.templateIndex = waTemplateIdx;

    // Jadwalkan Pesan 2 (Arahan Save Nomor) dengan jeda default 60 detik di Antrean_Pesan
    const fList = Array.isArray(config.waFollowupTemplates) && config.waFollowupTemplates.length > 0
      ? config.waFollowupTemplates
      : DEFAULT_WA_FOLLOWUP_TEMPLATES;
    const fIdx = nextNotificationRotationIndex_('followup') % fList.length;
    const fBody = renderNotifTemplate_(fList[fIdx], donatur, config, { includeGroupLink: false });
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

  // 2. Kirim Email (1 template per jenis: Daftar atau Reminder)
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
      includeGroupLink: messageType === 'daftar' && normalizeMinatGrup_(donatur.minatGrupWa) === 'Ya'
    });
    const plainBody = renderNotifTemplate_(chosenTpl.body, donatur, config, {
      includeGroupLink: messageType === 'daftar' && normalizeMinatGrup_(donatur.minatGrupWa) === 'Ya'
    });
    const qrisEmailImg = messageType === 'reminder' && config.showQris && config.qrisUrl ? config.qrisUrl : '';
    result.email = sendEmailViaAlias_(donatur.email, subject, plainBody, config, qrisEmailImg);
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
    const cleanMedia = String(mediaUrl || '').trim();

    // Jika ada gambar QRIS, kirim sebagai type: image + caption terlebih dahulu
    if (cleanMedia && /^https?:\/\//i.test(cleanMedia)) {
      const imagePayload = {
        recipient_type: 'individual',
        to: cleanTo,
        type: 'image',
        image: {
          link: cleanMedia,
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
      Logger.log('Fallback kirim teks WA karena image HTTP ' + imgCode + ': ' + imgResp.getContentText().substring(0, 140));
    }

    const finalText = cleanMedia && messageText.indexOf(cleanMedia) === -1 && /^https?:\/\//i.test(cleanMedia)
      ? messageText + '\n\nLink QRIS: ' + cleanMedia
      : messageText;

    const bodyPayload = {
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: {
        body: finalText
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

function sendEmailViaAlias_(recipientEmail, subject, plainBody, config, qrisImageUrl) {
  try {
    const aliasEmail = String(config.emailSenderAlias || DEFAULT_EMAIL_ALIAS).trim();
    const senderName = String(config.emailSenderName || DEFAULT_EMAIL_SENDER_NAME).trim();

    const safeHtmlParagraphs = escapeHtmlServer_(plainBody)
      .replace(/\n\n/g, '</p><p style="margin:0 0 12px 0;">')
      .replace(/\n/g, '<br/>');

    const qrisBlock = qrisImageUrl && /^https?:\/\//i.test(qrisImageUrl)
      ? '<div style="margin-top:16px;text-align:center;padding:14px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">' +
        '<div style="font-size:12px;font-weight:700;color:#065f46;margin-bottom:8px;">QRIS Pembayaran Resmi</div>' +
        '<img src="' + escapeHtmlServer_(qrisImageUrl) + '" alt="QRIS Resmi" style="max-width:240px;height:auto;border-radius:8px;"/>' +
        '</div>'
      : '';

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
      detail: usedAliasFrom
        ? 'Email terkirim menggunakan alias ' + aliasEmail + '.'
        : 'Email terkirim (Reply-To: ' + aliasEmail + ').'
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
    const emailSubj = String(payload.emailSubject || 'Pengingat Donasi Rutin Kafalah Dai').trim();
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

  const idDonatur = String(payload.idDonatur || '').trim();
  const namaDonatur = String(payload.namaDonatur || '').trim();
  const waCheck = validateAndNormalizeWA_(payload.noWa);
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
    return { status: 'error', message: 'Pilih donatur terdaftar terlebih dahulu.' };
  }
  if (!waCheck.valid) {
    return { status: 'error', message: waCheck.error };
  }
  const normalizedWa = waCheck.normalized;

  if (bulanList.length === 0) {
    return { status: 'error', message: 'Pilih minimal 1 bulan tagihan yang valid (format YYYY-MM).' };
  }
  if (nominalTransfer <= 0) {
    return { status: 'error', message: 'Nominal transfer harus lebih dari Rp 0.' };
  }

  // Ambil komitmen per bulan (dari payload atau lookup Master_Donatur)
  let komitmenPerBulan = parseNumber_(payload.nominalKomitmenPerBulan);
  if (komitmenPerBulan <= 0 && idDonatur) {
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
      bulanList: bulanList,
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

  const totalRp = Math.round(nominalTransfer);
  const totalKomitmenExpected = komitmenPerBulan * bulanList.length;
  const hasExcess = komitmenPerBulan > 0 && totalRp > totalKomitmenExpected;
  const totalDonasiLainnya = hasExcess ? totalRp - totalKomitmenExpected : 0;

  const basePerMonth = Math.floor(totalRp / bulanList.length);
  const remainder = totalRp % bulanList.length;

  const batchNote = bulanList.length > 1
    ? 'Bayar sekaligus ' + bulanList.length + ' bln (Total ' + formatRupiahServer_(totalRp) + ')'
    : '';
  const excessNote = totalDonasiLainnya > 0
    ? 'Termasuk Donasi Lainnya ' + formatRupiahServer_(totalDonasiLainnya)
    : '';
  const finalKeterangan = [userKeterangan, batchNote, excessNote].filter(Boolean).join(' · ');

  const createdRows = [];
  for (let idx = 0; idx < bulanList.length; idx++) {
    const bulanItem = bulanList[idx];
    const nominalKomitmenBulan = hasExcess
      ? komitmenPerBulan
      : basePerMonth + (idx < remainder ? 1 : 0);
    const donasiLainnyaBulan = hasExcess && idx === 0 ? totalDonasiLainnya : 0;
    const nominalTransferBulan = nominalKomitmenBulan + donasiLainnyaBulan;
    const idTransaksi = generateTransaksiId_(existingCount + idx + 1, now);

    appendRowByHeaderMap_(sheet, {
      ID_Transaksi: idTransaksi,
      Waktu_Input: waktuInput,
      Tanggal_Transfer: tanggalTransfer,
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
      'ID_Donatur',
      'No_WA',
      'Bulan_Tagihan',
      'Status_Verifikasi',
      'Status_Penyaluran',
      'Keterangan'
    ], ['Nominal_Komitmen', 'Donasi_Lainnya', 'Nominal_Transfer']);

    createdRows.push({
      idTransaksi: idTransaksi,
      waktuInput: waktuInput,
      tanggalTransfer: tanggalTransfer,
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

  return {
    status: 'success',
    message: createdRows.length > 1
      ? 'Konfirmasi pembayaran untuk ' + createdRows.length + ' bulan berhasil dikirim dan menunggu verifikasi pengurus.'
      : 'Konfirmasi pembayaran berhasil dikirim dan menunggu verifikasi pengurus.',
    data: {
      transaksi: createdRows[0],
      transaksiList: createdRows,
      savedFileName: savedFileName
    }
  };
}

// ==================== VERIFIKASI, PENYALURAN & STATUS DONATUR / GRUP WA ====================
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
      SpreadsheetApp.flush();
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
  ensureSheetWithHeaders_(ss, SHEET_NAMES.TRANSAKSI, HEADERS.Transaksi_Donasi, {
    textHeaders: ['Status_Penyaluran']
  });

  const idTransaksi = String(payload.idTransaksi || '').trim();
  const statusPenyaluran = String(payload.statusPenyaluran || '').trim();

  if (!idTransaksi) {
    return { status: 'error', message: 'ID Transaksi wajib diisi.' };
  }
  if (statusPenyaluran !== 'Sudah Disalurkan' && statusPenyaluran !== 'Belum Disalurkan') {
    return { status: 'error', message: 'Status penyaluran harus Sudah Disalurkan atau Belum Disalurkan.' };
  }

  const indexMap = getHeaderIndexMap_(sheet);
  const idCol = indexMap.ID_Transaksi || 1;
  const salurCol = indexMap.Status_Penyaluran;

  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol - 1] || '').trim() === idTransaksi) {
      if (salurCol) sheet.getRange(r + 1, salurCol).setNumberFormat('@').setValue(statusPenyaluran);
      SpreadsheetApp.flush();
      return {
        status: 'success',
        message: 'Status penyaluran transaksi ' + idTransaksi + ' diperbarui menjadi ' + statusPenyaluran + '.',
        data: {
          idTransaksi: idTransaksi,
          statusPenyaluran: statusPenyaluran
        }
      };
    }
  }

  return { status: 'error', message: 'Transaksi dengan ID ' + idTransaksi + ' tidak ditemukan.' };
}

function handleUpdateStatusDonatur_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DONATUR);
  if (!sheet) {
    return { status: 'error', message: 'Data donatur tidak ditemukan.' };
  }

  const idDonatur = String(payload.idDonatur || '').trim();
  const newStatus = String(payload.status || '').trim();

  if (!idDonatur) {
    return { status: 'error', message: 'ID Donatur wajib diisi.' };
  }
  if (newStatus !== 'Aktif' && newStatus !== 'Cuti') {
    return { status: 'error', message: 'Status donatur harus Aktif atau Cuti.' };
  }

  const indexMap = getHeaderIndexMap_(sheet);
  const idCol = indexMap.ID_Donatur || 1;
  const statusCol = indexMap.Status_Aktif || 15;

  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol - 1] || '').trim() === idDonatur) {
      sheet.getRange(r + 1, statusCol).setNumberFormat('@').setValue(newStatus);
      SpreadsheetApp.flush();
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
  const statusGrupCol = indexMap.Status_Grup_WA;
  const values = sheet.getDataRange().getValues();
  const updatedIds = [];

  for (let r = 1; r < values.length; r++) {
    const id = String(values[r][idCol - 1] || '').trim();
    if (id && idSet[id]) {
      if (statusGrupCol) sheet.getRange(r + 1, statusGrupCol).setNumberFormat('@').setValue(statusGrupWa);
      updatedIds.push(id);
    }
  }

  SpreadsheetApp.flush();
  return {
    status: 'success',
    message: updatedIds.length + ' donatur diperbarui menjadi ' + statusGrupWa + '.',
    data: {
      updatedIds: updatedIds,
      statusGrupWa: statusGrupWa
    }
  };
}

// ==================== PENGURUS / PANITIA ====================
function handleSavePanitia_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.PANITIA);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(SHEET_NAMES.PANITIA);
  } else {
    ensureSheetWithHeaders_(ss, SHEET_NAMES.PANITIA, HEADERS.Data_Panitia, {
      textHeaders: ['Kode_Panitia', 'Jenis_Kelamin', 'No_WA_Panitia', 'Role']
    });
  }

  const kodePanitia = String(payload.kodePanitia || '').trim().toUpperCase();
  const namaPanitia = String(payload.namaPanitia || '').trim();
  const jenisKelamin = normalizeJenisKelamin_(payload.jenisKelamin);
  const noWaRaw = String(payload.noWaPanitia || '').trim();
  const role = normalizeRole_(payload.role);

  if (!kodePanitia || !namaPanitia) {
    return { status: 'error', message: 'Kode dan nama pengurus wajib diisi.' };
  }

  let noWa = noWaRaw;
  if (noWaRaw) {
    const waCheck = validateAndNormalizeWA_(noWaRaw);
    if (!waCheck.valid) {
      return { status: 'error', message: waCheck.error };
    }
    noWa = waCheck.normalized;
  }

  const indexMap = getHeaderIndexMap_(sheet);
  const kodeCol = indexMap.Kode_Panitia || 1;
  const namaCol = indexMap.Nama_Panitia || 2;
  const jkCol = indexMap.Jenis_Kelamin;
  const waCol = indexMap.No_WA_Panitia || 4;
  const roleCol = indexMap.Role || 5;

  const values = sheet.getDataRange().getValues();
  let updatedRow = -1;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][kodeCol - 1] || '').trim().toUpperCase() === kodePanitia) {
      updatedRow = r + 1;
      break;
    }
  }

  if (updatedRow > 0) {
    sheet.getRange(updatedRow, kodeCol).setNumberFormat('@').setValue(kodePanitia);
    sheet.getRange(updatedRow, namaCol).setValue(namaPanitia);
    if (jkCol) sheet.getRange(updatedRow, jkCol).setNumberFormat('@').setValue(jenisKelamin);
    sheet.getRange(updatedRow, waCol).setNumberFormat('@').setValue(noWa);
    sheet.getRange(updatedRow, roleCol).setNumberFormat('@').setValue(role);
  } else {
    appendRowByHeaderMap_(sheet, {
      Kode_Panitia: kodePanitia,
      Nama_Panitia: namaPanitia,
      Jenis_Kelamin: jenisKelamin,
      No_WA_Panitia: noWa,
      Role: role
    }, ['Kode_Panitia', 'Jenis_Kelamin', 'No_WA_Panitia', 'Role'], []);
  }
  SpreadsheetApp.flush();

  return {
    status: 'success',
    message: 'Data pengurus ' + namaPanitia + ' berhasil disimpan.',
    data: {
      panitia: getInitialData_().panitia
    }
  };
}

function handleDeletePanitia_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.PANITIA);
  if (!sheet) {
    return { status: 'error', message: 'Daftar pengurus tidak ditemukan.' };
  }

  const kodePanitia = String(payload.kodePanitia || '').trim().toUpperCase();
  if (!kodePanitia) {
    return { status: 'error', message: 'Kode pengurus wajib diisi.' };
  }

  const indexMap = getHeaderIndexMap_(sheet);
  const kodeCol = indexMap.Kode_Panitia || 1;
  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][kodeCol - 1] || '').trim().toUpperCase() === kodePanitia) {
      sheet.deleteRow(r + 1);
      SpreadsheetApp.flush();
      return {
        status: 'success',
        message: 'Pengurus ' + kodePanitia + ' berhasil dihapus.',
        data: {
          panitia: getInitialData_().panitia
        }
      };
    }
  }

  return { status: 'error', message: 'Pengurus dengan kode ' + kodePanitia + ' tidak ditemukan.' };
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
