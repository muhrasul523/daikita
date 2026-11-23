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
 *    (Aman dijalankan berulang kali: menambahkan kolom baru Jenis_Kelamin,
 *    wilayah, kode perantara, sheet Pengaturan, serta memicu izin Drive & Email.)
 * 5. Klik Terapkan (Deploy) -> Kelola deployment -> Edit -> Versi baru -> Terapkan.
 *    Pastikan Execute as = Me (Saya) dan Who has access = Anyone (Siapa saja).
 * ============================================================================
 */

// ==================== KONFIGURASI DEFAULT ====================
const DRIVE_FOLDER_ID = '1KqfNK8yLOpb-7Ew6KXkfJoNU6XKmzK73';

const NAMA_LEMBAGA = "DAIKITA — Kafalah Dai";
const TAGLINE_LEMBAGA = 'Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah.';
const APP_PUBLIC_URL = 'https://daikita.duwd.web.id/';
const DEFAULT_LOGO_URL = 'https://lh3.googleusercontent.com/d/1OOSQydygv0K9SNcQUXQTqQyduW57mv4Y';

const DEFAULT_WA_ENDPOINT = 'https://www.rechat.id/api/v1/messages';
const DEFAULT_WA_API_KEY = 'wag_8d4afa8dfa57f45f95961017e050b36b15de17edd2fdc542';

const DEFAULT_EMAIL_ALIAS = 'lajnahdai.dpp@gmail.com';
const DEFAULT_EMAIL_SENDER_NAME = "DAIKITA — Lajnah Dai Wahdah Islamiyah";

const INFO_REKENING_DEFAULT = [
  {
    bank: 'BSI (Bank Syariah Indonesia)',
    nomor: '7123456789',
    atasNama: 'DAIKITA Wahdah Islamiyah'
  },
  {
    bank: 'Bank Mandiri',
    nomor: '1320012345678',
    atasNama: 'DAIKITA Wahdah Islamiyah'
  },
  {
    bank: 'BCA Syariah',
    nomor: '0123456789',
    atasNama: 'DAIKITA Wahdah Islamiyah'
  }
];

const DEFAULT_WA_TEMPLATES = [
  "Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nAhlan wa sahlan {sapaan} *{nama}*,\nJazakumullahu khairan telah bergabung sebagai Donatur Rutin *Kafalah Dai* di *{lembaga}*.\n\nRingkasan Amanah Anda:\n• ID Donatur: {id_donatur}\n• Domisili: {domisili}\n• Komitmen Bulanan: *{nominal}*\n• Pengingat Rutin: Setiap tanggal {tgl_pengingat}\n• Perantara: {perantara}\n\nPenyaluran dapat melalui rekening resmi:\n{rekening}\n\nKonfirmasi bukti transfer dapat dikirim melalui:\n{link_konfirmasi}\n\nSemoga Allah SWT membalas dengan keberkahan rezeki dan pahala jariyah yang terus mengalir. Aamiin.",
  "Bismillah, Assalamu'alaikum {sapaan} *{nama}*.\n\nAlhamdulillah, pendaftaran donatur rutin *{lembaga}* telah resmi tercatat atas nama {sapaan}:\n• Nomor ID: *{id_donatur}*\n• Komitmen Kafalah Dai: *{nominal} / bulan*\n• Jadwal Pengingat: Tanggal {tgl_pengingat} setiap bulan\n\nSalurkan amanah Anda melalui:\n{rekening}\n\nJika sudah berdonasi, silakan kirim konfirmasi lewat portal:\n{link_konfirmasi}\n\nBarakallahu fiikum, semoga menjadi amal shalih yang menguatkan langkah dakwah para dai.",
  "Assalamu'alaikum Warahmatullahi Wabarakatuh {sapaan} *{nama}* 🌟\n\nTerima kasih atas kepercayaan {sapaan} mendukung program *Kafalah Dai* bersama *{lembaga}*.\n\nDetail Komitmen Terdaftar:\n- ID Donatur: {id_donatur}\n- Wilayah: {domisili}\n- Nominal Komitmen: {nominal}\n- Tanggal Pengingat: Tgl {tgl_pengingat}\n\nRekening Resmi Penyaluran:\n{rekening}\n\nPortal konfirmasi transfer:\n{link_konfirmasi}\n\nSemoga Allah melapangkan urusan dan memberkahi harta {sapaan} sekeluarga. Wassalamu'alaikum Warahmatullahi Wabarakatuh."
];

const DEFAULT_EMAIL_TEMPLATES = [
  {
    subject: "Selamat Bergabung di {lembaga} — Komitmen Kafalah Dai ({id_donatur})",
    body: "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nYth. {sapaan} {nama},\n\nJazakumullahu khairan katsiran telah mendaftarkan komitmen amal rutin Program Kafalah Dai bersama {lembaga}.\n\nRingkasan Data Donatur:\n• ID Donatur: {id_donatur}\n• Nama Lengkap: {nama} ({jenis_kelamin})\n• Domisili: {domisili}\n• Nominal Komitmen: {nominal} / bulan\n• Jadwal Pengingat Rutin: Setiap tanggal {tgl_pengingat}\n• Perantara / Pengurus: {perantara}\n\nSalurkan amanah Anda melalui rekening resmi berikut:\n{rekening}\n\nPortal Konfirmasi Pembayaran:\n{link_konfirmasi}\n\nSemoga Allah SWT senantiasa memberkahi keluarga, kesehatan, dan rezeki {sapaan}. Aamiin.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh,\n{lembaga}"
  },
  {
    subject: "Konfirmasi Pendaftaran Donatur Rutin Kafalah Dai — {nama}",
    body: "Bismillahirrahmanirrahim,\nAssalamu'alaikum Warahmatullahi Wabarakatuh {sapaan} {nama},\n\nAlhamdulillah, data kepesertaan donatur rutin Anda telah kami catat di {lembaga} dengan detail sebagai berikut:\n- ID Donatur: {id_donatur}\n- Komitmen Bulanan: {nominal}\n- Tanggal Pengingat: Setiap tanggal {tgl_pengingat}\n- Wilayah: {domisili}\n\nTransfer amanah Kafalah Dai dapat dikirimkan ke rekening resmi:\n{rekening}\n\nUntuk konfirmasi bukti transfer atau informasi QRIS, silakan kunjungi:\n{link_konfirmasi}\n\nTerima kasih atas dukungan dan amanah {sapaan}. Barakallahu fiikum."
  },
  {
    subject: "[{id_donatur}] Terima Kasih Amanah Rutin Kafalah Dai — {lembaga}",
    body: "Assalamu'alaikum {sapaan} {nama},\n\nTerima kasih telah menjadi bagian dari penggerak kebaikan Kafalah Dai bersama {lembaga}.\n\nDetail Kepesertaan:\n• ID Donatur: {id_donatur}\n• Domisili: {domisili}\n• Komitmen Rutin: {nominal} (Pengingat tiap tgl {tgl_pengingat})\n\nDaftar Rekening Resmi:\n{rekening}\n\nKirim bukti konfirmasi donasi melalui tautan berikut:\n{link_konfirmasi}\n\nJazakumullahu khairan. Wassalamu'alaikum Warahmatullahi Wabarakatuh."
  }
];

const TIMEZONE = 'Asia/Jakarta';

// ==================== KONSTANTA SHEET & HEADER ====================
const SHEET_NAMES = {
  DONATUR: 'Master_Donatur',
  TRANSAKSI: 'Transaksi_Donasi',
  PANITIA: 'Data_Panitia',
  PENGATURAN: 'Pengaturan'
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
    'Email'
  ],
  Transaksi_Donasi: [
    'ID_Transaksi',
    'Waktu_Input',
    'ID_Donatur',
    'Nama_Donatur',
    'No_WA',
    'Bulan_Tagihan',
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
  ]
};

// ==================== SETUP DATABASE (AMAN DIJALANKAN BERULANG) ====================
/**
 * Membuat dan merapikan sheet beserta header, format Plain Text No_WA,
 * menambahkan kolom baru (Jenis_Kelamin, Kab_ID, Provinsi, Pulau, Kode_Perantara)
 * serta memicu izin Google Drive dan Gmail tanpa menghapus data yang sudah ada.
 */
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
      'Kode_Perantara'
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
      Email: 210
    }
  });

  ensureSheetWithHeaders_(ss, SHEET_NAMES.TRANSAKSI, HEADERS.Transaksi_Donasi, {
    textHeaders: ['ID_Transaksi', 'Waktu_Input', 'ID_Donatur', 'No_WA', 'Bulan_Tagihan', 'Status_Verifikasi', 'Status_Penyaluran', 'Keterangan'],
    currencyHeaders: ['Nominal_Transfer'],
    widthByHeader: {
      ID_Transaksi: 165,
      Waktu_Input: 165,
      ID_Donatur: 145,
      Nama_Donatur: 210,
      No_WA: 155,
      Bulan_Tagihan: 125,
      Nominal_Transfer: 155,
      Bank_Tujuan: 210,
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
      ['ADM01', 'Admin Sekretariat', 'Laki-laki', '6281100000001', 'Super Admin'],
      ['PNT01', 'Koordinator Wilayah Utara', 'Laki-laki', '6281100000002', 'Admin'],
      ['PNT02', 'Koordinator Wilayah Selatan', 'Perempuan', '6281100000003', 'Admin']
    ];
    appendRowByHeaderMap_(panitiaSheet, {
      Kode_Panitia: initialPanitia[0][0],
      Nama_Panitia: initialPanitia[0][1],
      Jenis_Kelamin: initialPanitia[0][2],
      No_WA_Panitia: initialPanitia[0][3],
      Role: initialPanitia[0][4]
    }, ['Kode_Panitia', 'Jenis_Kelamin', 'No_WA_Panitia', 'Role'], []);
    appendRowByHeaderMap_(panitiaSheet, {
      Kode_Panitia: initialPanitia[1][0],
      Nama_Panitia: initialPanitia[1][1],
      Jenis_Kelamin: initialPanitia[1][2],
      No_WA_Panitia: initialPanitia[1][3],
      Role: initialPanitia[1][4]
    }, ['Kode_Panitia', 'Jenis_Kelamin', 'No_WA_Panitia', 'Role'], []);
    appendRowByHeaderMap_(panitiaSheet, {
      Kode_Panitia: initialPanitia[2][0],
      Nama_Panitia: initialPanitia[2][1],
      Jenis_Kelamin: initialPanitia[2][2],
      No_WA_Panitia: initialPanitia[2][3],
      Role: initialPanitia[2][4]
    }, ['Kode_Panitia', 'Jenis_Kelamin', 'No_WA_Panitia', 'Role'], []);
  }

  const pengaturanSheet = ensureSheetWithHeaders_(ss, SHEET_NAMES.PENGATURAN, HEADERS.Pengaturan, {
    textHeaders: ['Kunci', 'Nilai'],
    widthByHeader: {
      Kunci: 230,
      Nilai: 560
    }
  });

  if (pengaturanSheet.getLastRow() <= 1) {
    const defaults = buildDefaultSettingsMap_();
    writeSettingsMap_(pengaturanSheet, defaults);
  }
  ensureMigratedDefaultLogo_(ss);

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
  Logger.log('setupDatabase() selesai.' + driveStatus + gmailStatus);
  return {
    status: 'success',
    message: 'Struktur data DAIKITA siap digunakan tanpa menghapus data lama.' + driveStatus + gmailStatus
  };
}

function setupSheets() {
  return setupDatabase();
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

      // Tambahkan kolom baru di sebelah kanan agar data lama tetap selaras
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
      map[key] = i + 1; // 1-indexed
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
    qrisMerchantName: 'DAIKITA Wahdah Islamiyah',
    showQris: 'true',
    defaultNominal: '50000',
    defaultTglPengingat: '5',
    catatanPembayaran: "Penyaluran amanah rutin Kafalah Dai hanya melalui rekening resmi atau QRIS lembaga.",
    infoRekening: JSON.stringify(INFO_REKENING_DEFAULT),
    enableWaNotif: 'true',
    waEndpointUrl: DEFAULT_WA_ENDPOINT,
    waApiKey: DEFAULT_WA_API_KEY,
    waTemplates: JSON.stringify(DEFAULT_WA_TEMPLATES),
    enableEmailNotif: 'true',
    emailSenderAlias: DEFAULT_EMAIL_ALIAS,
    emailSenderName: DEFAULT_EMAIL_SENDER_NAME,
    emailTemplates: JSON.stringify(DEFAULT_EMAIL_TEMPLATES)
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

  let parsedWaTemplates = DEFAULT_WA_TEMPLATES;
  try {
    const candidateWa = JSON.parse(rawMap.waTemplates || '[]');
    if (Array.isArray(candidateWa) && candidateWa.length > 0) {
      const cleanWa = candidateWa.map(function (t) { return String(t || '').trim(); }).filter(Boolean);
      if (cleanWa.length > 0) parsedWaTemplates = cleanWa;
    }
  } catch (e) {
    parsedWaTemplates = DEFAULT_WA_TEMPLATES;
  }

  let parsedEmailTemplates = DEFAULT_EMAIL_TEMPLATES;
  try {
    const candidateEm = JSON.parse(rawMap.emailTemplates || '[]');
    if (Array.isArray(candidateEm) && candidateEm.length > 0) {
      const cleanEm = candidateEm
        .map(function (item) {
          return {
            subject: String((item && item.subject) || '').trim(),
            body: String((item && item.body) || '').trim()
          };
        })
        .filter(function (item) {
          return item.subject !== '' && item.body !== '';
        });
      if (cleanEm.length > 0) parsedEmailTemplates = cleanEm;
    }
  } catch (e) {
    parsedEmailTemplates = DEFAULT_EMAIL_TEMPLATES;
  }

  const effectiveWaKey = String(rawMap.waApiKey || '').trim() || DEFAULT_WA_API_KEY;
  const effectiveWaEndpoint = String(rawMap.waEndpointUrl || '').trim() || DEFAULT_WA_ENDPOINT;
  const effectiveEmailAlias = String(rawMap.emailSenderAlias || '').trim() || DEFAULT_EMAIL_ALIAS;
  const effectiveEmailName = String(rawMap.emailSenderName || '').trim() || DEFAULT_EMAIL_SENDER_NAME;

  return {
    namaLembaga: String(rawMap.namaLembaga || NAMA_LEMBAGA).trim() || NAMA_LEMBAGA,
    tagline: String(rawMap.tagline || TAGLINE_LEMBAGA).trim() || TAGLINE_LEMBAGA,
    logoUrl: String(rawMap.logoUrl || DEFAULT_LOGO_URL).trim() || DEFAULT_LOGO_URL,
    qrisUrl: String(rawMap.qrisUrl || '').trim(),
    qrisMerchantName: String(rawMap.qrisMerchantName || '').trim(),
    showQris: String(rawMap.showQris || 'true').toLowerCase() !== 'false',
    defaultNominal: parseNumber_(rawMap.defaultNominal) || 50000,
    defaultTglPengingat: Math.min(31, Math.max(1, parseNumber_(rawMap.defaultTglPengingat) || 5)),
    catatanPembayaran: String(rawMap.catatanPembayaran || '').trim(),
    infoRekening: parsedRekening,
    enableWaNotif: String(rawMap.enableWaNotif || 'true').toLowerCase() !== 'false',
    waEndpointUrl: effectiveWaEndpoint,
    waApiKey: effectiveWaKey,
    waTemplates: parsedWaTemplates,
    enableEmailNotif: String(rawMap.enableEmailNotif || 'true').toLowerCase() !== 'false',
    emailSenderAlias: effectiveEmailAlias,
    emailSenderName: effectiveEmailName,
    emailTemplates: parsedEmailTemplates
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

  const emailTemplatesInput = Array.isArray(payload.emailTemplates)
    ? payload.emailTemplates
        .map(function (t) {
          return {
            subject: String((t && t.subject) || '').trim(),
            body: String((t && t.body) || '').trim()
          };
        })
        .filter(function (t) {
          return t.subject !== '' && t.body !== '';
        })
    : current.emailTemplates;

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
    enableEmailNotif: payload.enableEmailNotif === false ? 'false' : 'true',
    emailSenderAlias: String(payload.emailSenderAlias !== undefined ? payload.emailSenderAlias : current.emailSenderAlias).trim() || DEFAULT_EMAIL_ALIAS,
    emailSenderName: String(payload.emailSenderName !== undefined ? payload.emailSenderName : current.emailSenderName).trim() || DEFAULT_EMAIL_SENDER_NAME,
    emailTemplates: JSON.stringify(emailTemplatesInput.length > 0 ? emailTemplatesInput : current.emailTemplates)
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

function ensureMigratedDefaultLogo_(ss) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('MIGRATED_LOGO_1OOSQ') === '1') return;
    const sheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
    if (sheet && sheet.getLastRow() > 1) {
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
      let found = false;
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0] || '').trim() === 'logoUrl') {
          sheet.getRange(i + 2, 2).setNumberFormat('@').setValue(DEFAULT_LOGO_URL);
          found = true;
          break;
        }
      }
      if (!found) {
        sheet.getRange(sheet.getLastRow() + 1, 1, 1, 2).setNumberFormat('@').setValues([['logoUrl', DEFAULT_LOGO_URL]]);
      }
    }
    props.setProperty('MIGRATED_LOGO_1OOSQ', '1');
  } catch (err) {
    Logger.log('Info migrasi logo default: ' + err);
  }
}

// ==================== HANDLER DATA UTAMA ====================
function getInitialData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_NAMES.DONATUR) ||
      !ss.getSheetByName(SHEET_NAMES.TRANSAKSI) ||
      !ss.getSheetByName(SHEET_NAMES.PANITIA) ||
      !ss.getSheetByName(SHEET_NAMES.PENGATURAN)) {
    setupDatabase();
  } else {
    ensureMigratedDefaultLogo_(ss);
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
      statusAktif: String(row.Status_Aktif || 'Aktif').trim()
    };
  }).filter(function (d) {
    return d.idDonatur !== '' || d.namaLengkap !== '';
  });

  const transaksi = readSheetAsObjects_(ss.getSheetByName(SHEET_NAMES.TRANSAKSI)).map(function (row) {
    const rawPenyaluran = String(row.Status_Penyaluran || '').trim();
    return {
      idTransaksi: String(row.ID_Transaksi || '').trim(),
      waktuInput: formatCellDateString_(row.Waktu_Input),
      idDonatur: String(row.ID_Donatur || '').trim(),
      namaDonatur: String(row.Nama_Donatur || '').trim(),
      noWa: safeNormalizeOrKeep_(row.No_WA),
      bulanTagihan: formatBulanTagihan_(row.Bulan_Tagihan),
      nominalTransfer: parseNumber_(row.Nominal_Transfer),
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

  return {
    config: config,
    donatur: donatur,
    transaksi: transaksi,
    panitia: panitia
  };
}

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
        'Kode_Perantara'
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
  const idDonatur = generateDonaturId_(existingRows.length + 1, now);
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
    Program_Donasi: "Kafalah Dai",
    Nominal_Komitmen: nominalKomitmen,
    Tgl_Jatuh_Tempo: tglJatuhTempo,
    Metode_Daftar: metodeDaftar,
    Kode_Perantara: kodePerantara,
    Nama_Perantara: namaPerantara,
    Status_Aktif: statusAktif,
    Email: email
  };

  appendRowByHeaderMap_(sheet, rowValuesByHeader, [
    'ID_Donatur',
    'Tanggal_Daftar',
    'Jenis_Kelamin',
    'No_WA',
    'Kab_ID',
    'Kode_Perantara',
    'Status_Aktif',
    'Email'
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
    statusAktif: statusAktif
  };

  // Kirim notifikasi WA (ReChat) & Email otomatis secara non-blocking
  const config = loadConfigObject_(ss);
  const notifStatus = sendDonorNotifications_(createdDonatur, config);

  return {
    status: 'success',
    message: 'Donatur ' + namaLengkap + ' berhasil didaftarkan.',
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

  const sampleDonor = {
    idDonatur: 'DNR-TES-001',
    namaLengkap: testNama,
    jenisKelamin: testJk,
    noWa: normalizedWa,
    email: testEmail,
    domisili: 'Kota Makassar',
    provinsi: 'Sulawesi Selatan',
    pulau: 'Sulawesi',
    nominalKomitmen: config.defaultNominal || 100000,
    tglJatuhTempo: config.defaultTglPengingat || 5,
    namaPerantara: 'Admin Sekretariat'
  };

  const notifStatus = sendDonorNotifications_(sampleDonor, config, payload.templateIndex);
  return {
    status: 'success',
    message: 'Pengujian pengiriman notifikasi selesai dijalankan.',
    data: {
      notifStatus: notifStatus
    }
  };
}

// ==================== NOTIFIKASI WA (RECHAT) & EMAIL ALIAS ====================
function nextNotificationRotationIndex_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty('NOTIF_ROTATION_IDX');
    const current = raw ? parseInt(raw, 10) : 0;
    const safeCurrent = isNaN(current) || current < 0 ? 0 : current;
    props.setProperty('NOTIF_ROTATION_IDX', String((safeCurrent + 1) % 1000000));
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

function formatRekeningTextServer_(rekeningList) {
  if (!Array.isArray(rekeningList) || rekeningList.length === 0) {
    return '• Hubungi pengurus untuk info rekening resmi.';
  }
  return rekeningList
    .map(function (r) {
      return '• ' + r.bank + ': ' + r.nomor + ' (a.n. ' + r.atasNama + ')';
    })
    .join('\n');
}

function renderNotifTemplate_(templateStr, donatur, config) {
  const jk = normalizeJenisKelamin_(donatur.jenisKelamin);
  const sapaan = jk === 'Laki-laki' ? 'Bapak' : jk === 'Perempuan' ? 'Ibu' : 'Bapak/Ibu';
  const wilayahParts = [donatur.domisili, donatur.provinsi].filter(Boolean);
  const domisiliLabel = wilayahParts.length > 0 ? wilayahParts.join(', ') : '-';

  const vars = {
    '{nama}': donatur.namaLengkap || 'Sahabat Kebaikan',
    '{sapaan}': sapaan,
    '{jenis_kelamin}': jk || '-',
    '{id_donatur}': donatur.idDonatur || '-',
    '{no_wa}': donatur.noWa || '-',
    '{domisili}': domisiliLabel,
    '{nominal}': formatRupiahServer_(donatur.nominalKomitmen || 0),
    '{tgl_pengingat}': String(donatur.tglJatuhTempo || 5),
    '{perantara}': donatur.namaPerantara || 'Langsung (Tanpa Perantara)',
    '{lembaga}': config.namaLembaga || NAMA_LEMBAGA,
    '{rekening}': formatRekeningTextServer_(config.infoRekening),
    '{link_konfirmasi}': APP_PUBLIC_URL
  };

  let out = String(templateStr || '');
  Object.keys(vars).forEach(function (token) {
    out = out.split(token).join(vars[token]);
  });
  return out;
}

function escapeHtmlServer_(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendDonorNotifications_(donatur, config, forcedIndex) {
  const rotationIdx =
    typeof forcedIndex === 'number' && !isNaN(forcedIndex) && forcedIndex >= 0
      ? Math.floor(forcedIndex)
      : nextNotificationRotationIndex_();

  const result = {
    wa: { attempted: false, ok: false, detail: 'Tidak dikirim.', templateIndex: undefined },
    email: { attempted: false, ok: false, detail: 'Tidak dikirim.', templateIndex: undefined }
  };

  // 1. Kirim WhatsApp via ReChat / MiPos Webhook
  if (!config.enableWaNotif) {
    result.wa.detail = 'Notifikasi WA otomatis sedang dinonaktifkan di Pengaturan.';
  } else if (!donatur.noWa) {
    result.wa.detail = 'Nomor WA donatur kosong.';
  } else if (!config.waApiKey) {
    result.wa.detail = 'API Key perangkat WA belum diisi di Pengaturan.';
  } else {
    const waList = Array.isArray(config.waTemplates) && config.waTemplates.length > 0
      ? config.waTemplates
      : DEFAULT_WA_TEMPLATES;
    const waTemplateIdx = rotationIdx % waList.length;
    const waBody = renderNotifTemplate_(waList[waTemplateIdx], donatur, config);
    result.wa = sendWaViaRechat_(donatur.noWa, waBody, config);
    result.wa.templateIndex = waTemplateIdx;
  }

  // 2. Kirim Email via Gmail Alias (lajnahdai.dpp@gmail.com)
  if (!config.enableEmailNotif) {
    result.email.detail = 'Notifikasi Email otomatis sedang dinonaktifkan di Pengaturan.';
  } else if (!donatur.email) {
    result.email.detail = 'Donatur tidak mengisi alamat email.';
  } else {
    const emList = Array.isArray(config.emailTemplates) && config.emailTemplates.length > 0
      ? config.emailTemplates
      : DEFAULT_EMAIL_TEMPLATES;
    const emTemplateIdx = rotationIdx % emList.length;
    const chosenTpl = emList[emTemplateIdx];
    const subject = renderNotifTemplate_(chosenTpl.subject, donatur, config);
    const plainBody = renderNotifTemplate_(chosenTpl.body, donatur, config);
    result.email = sendEmailViaAlias_(donatur.email, subject, plainBody, config);
    result.email.templateIndex = emTemplateIdx;
  }

  return result;
}

function sendWaViaRechat_(toNumber, messageText, config) {
  try {
    let endpoint = String(config.waEndpointUrl || DEFAULT_WA_ENDPOINT).trim();
    const apiKey = String(config.waApiKey || '').trim();
    const useUrlKey = endpoint.indexOf('{API_KEY}') !== -1 || endpoint.indexOf(apiKey) !== -1;

    if (endpoint.indexOf('{API_KEY}') !== -1) {
      endpoint = endpoint.replace(/\{API_KEY\}/g, encodeURIComponent(apiKey));
    }

    const headers = {
      Accept: 'application/json'
    };
    if (!useUrlKey && apiKey) {
      headers.Authorization = 'Bearer ' + apiKey;
    }

    const bodyPayload = {
      recipient_type: 'individual',
      to: String(toNumber).replace(/\D/g, ''),
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

function sendEmailViaAlias_(recipientEmail, subject, plainBody, config) {
  try {
    const aliasEmail = String(config.emailSenderAlias || DEFAULT_EMAIL_ALIAS).trim();
    const senderName = String(config.emailSenderName || DEFAULT_EMAIL_SENDER_NAME).trim();

    const safeHtmlParagraphs = escapeHtmlServer_(plainBody)
      .replace(/\n\n/g, '</p><p style="margin:0 0 12px 0;">')
      .replace(/\n/g, '<br/>');

    const htmlBody =
      '<div style="font-family:Montserrat,Arial,sans-serif;background:#f0fdf9;padding:24px;color:#0f172a;">' +
      '<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;border:1px solid #d1fae5;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,#059669,#0d9488);padding:18px 24px;color:#ffffff;">' +
      '<div style="font-size:16px;font-weight:700;">' + escapeHtmlServer_(config.namaLembaga || NAMA_LEMBAGA) + '</div>' +
      '<div style="font-size:12px;opacity:0.9;margin-top:4px;">' + escapeHtmlServer_(config.tagline || TAGLINE_LEMBAGA) + '</div>' +
      '</div>' +
      '<div style="padding:24px;font-size:14px;line-height:1.65;color:#1e293b;"><p style="margin:0 0 12px 0;">' +
      safeHtmlParagraphs +
      '</p></div>' +
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
        : 'Email terkirim (Reply-To: ' + aliasEmail + '). Aktifkan "Send mail as" di Gmail untuk ' + aliasEmail + ' jika ingin alamat pengirim utama berubah penuh.'
    };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      detail: 'Gagal kirim email: ' + (err && err.message ? err.message : String(err))
    };
  }
}

function handleSubmitPembayaran_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.TRANSAKSI);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(SHEET_NAMES.TRANSAKSI);
  } else {
    ensureSheetWithHeaders_(ss, SHEET_NAMES.TRANSAKSI, HEADERS.Transaksi_Donasi, {
      textHeaders: ['ID_Transaksi', 'Waktu_Input', 'ID_Donatur', 'No_WA', 'Bulan_Tagihan', 'Status_Verifikasi', 'Status_Penyaluran', 'Keterangan'],
      currencyHeaders: ['Nominal_Transfer']
    });
  }

  const idDonatur = String(payload.idDonatur || '').trim();
  const namaDonatur = String(payload.namaDonatur || '').trim();
  const waCheck = validateAndNormalizeWA_(payload.noWa);
  const nominalTransfer = parseNumber_(payload.nominalTransfer);
  const bankTujuan = String(payload.bankTujuan || '').trim();
  const diinputOleh = String(payload.diinputOleh || 'Donatur (Mandiri)').trim();
  const userKeterangan = String(payload.keterangan || '').trim();

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

  let proofUrl = '';
  let savedFileName = '';
  if (payload.fileBase64) {
    const uploadResult = uploadBuktiToDrive_({
      fileBase64: String(payload.fileBase64),
      fileMimeType: String(payload.fileMimeType || 'image/jpeg'),
      fileName: String(payload.fileName || 'bukti.jpg'),
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
  const basePerMonth = Math.floor(totalRp / bulanList.length);
  const remainder = totalRp % bulanList.length;
  const batchNote = bulanList.length > 1
    ? 'Bayar sekaligus ' + bulanList.length + ' bln (Total ' + formatRupiahServer_(totalRp) + ')'
    : '';
  const finalKeterangan = [userKeterangan, batchNote].filter(Boolean).join(' · ');

  const createdRows = [];
  for (let idx = 0; idx < bulanList.length; idx++) {
    const bulanItem = bulanList[idx];
    const nominalBulan = basePerMonth + (idx < remainder ? 1 : 0);
    const idTransaksi = generateTransaksiId_(existingCount + idx + 1, now);

    appendRowByHeaderMap_(sheet, {
      ID_Transaksi: idTransaksi,
      Waktu_Input: waktuInput,
      ID_Donatur: idDonatur || '-',
      Nama_Donatur: namaDonatur,
      No_WA: normalizedWa,
      Bulan_Tagihan: bulanItem,
      Nominal_Transfer: nominalBulan,
      Bank_Tujuan: bankTujuan,
      Link_Bukti_Drive: proofUrl,
      Status_Verifikasi: statusVerifikasi,
      Diinput_Oleh: diinputOleh,
      Status_Penyaluran: statusPenyaluran,
      Keterangan: finalKeterangan
    }, ['ID_Transaksi', 'Waktu_Input', 'ID_Donatur', 'No_WA', 'Bulan_Tagihan', 'Status_Verifikasi', 'Status_Penyaluran', 'Keterangan'], ['Nominal_Transfer']);

    createdRows.push({
      idTransaksi: idTransaksi,
      waktuInput: waktuInput,
      idDonatur: idDonatur || '-',
      namaDonatur: namaDonatur,
      noWa: normalizedWa,
      bulanTagihan: bulanItem,
      nominalTransfer: nominalBulan,
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
  const verCol = indexMap.Status_Verifikasi || 10;
  const salurCol = indexMap.Status_Penyaluran || 12;

  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol - 1] || '').trim() === idTransaksi) {
      sheet.getRange(r + 1, verCol).setNumberFormat('@').setValue(newStatus);
      if (newStatus === 'Ditolak' && salurCol <= sheet.getLastColumn()) {
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
  const salurCol = indexMap.Status_Penyaluran || 12;

  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol - 1] || '').trim() === idTransaksi) {
      sheet.getRange(r + 1, salurCol).setNumberFormat('@').setValue(statusPenyaluran);
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
  const datePart = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
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

function generateDonaturId_(seq, dateObj) {
  const ym = Utilities.formatDate(dateObj, TIMEZONE, 'yyMM');
  const num = ('0000' + seq).slice(-4);
  const rand = ('00' + Math.floor(Math.random() * 90 + 10)).slice(-2);
  return 'DNR-' + ym + '-' + num + rand;
}

function generateTransaksiId_(seq, dateObj) {
  const ymd = Utilities.formatDate(dateObj, TIMEZONE, 'yyMMdd');
  const num = ('000' + seq).slice(-3);
  const rand = ('00' + Math.floor(Math.random() * 90 + 10)).slice(-2);
  return 'TRX-' + ymd + '-' + num + rand;
}
