/**
 * ============================================================================
 * DAIKITA — SISTEM MANAJEMEN DONATUR RUTIN KAFALAH DA'I (BACKEND APPS SCRIPT)
 * "Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah."
 * Arsitektur Serverless: Google Sheets + Google Drive + Web App JSON API
 * ============================================================================
 * CARA SETUP / PERBARUI CEPAT:
 * 1. Buka Google Sheets -> menu Ekstensi -> Apps Script.
 * 2. Tempel seluruh kode ini ke file Code.gs lalu simpan (Ctrl+S).
 * 3. Pastikan DRIVE_FOLDER_ID sudah diisi ID folder Google Drive Anda.
 * 4. Pilih fungsi "setupDatabase" di toolbar atas -> klik Jalankan (Run).
 *    (Aman dijalankan berulang kali: menambahkan kolom wilayah/kode perantara
 *    serta sheet Pengaturan tanpa menghapus atau mengacak data lama.)
 * 5. Klik Terapkan (Deploy) -> Kelola deployment -> Edit -> Versi baru -> Terapkan.
 * ============================================================================
 */

// ==================== KONFIGURASI DEFAULT ====================
const DRIVE_FOLDER_ID = 'GANTI_DENGAN_ID_FOLDER_GOOGLE_DRIVE_ANDA';

const NAMA_LEMBAGA = "DAIKITA — Kafalah Da'i";
const TAGLINE_LEMBAGA = 'Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah.';

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
    'Status_Penyaluran'
  ],
  Data_Panitia: [
    'Kode_Panitia',
    'Nama_Panitia',
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
 * menambahkan kolom baru (Kab_ID, Provinsi, Pulau, Kode_Perantara, Email)
 * serta sheet Pengaturan tanpa menghapus atau mengacak data yang sudah ada.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet aktif tidak ditemukan. Pastikan skrip terikat pada file Google Sheets.');
  }

  ensureSheetWithHeaders_(ss, SHEET_NAMES.DONATUR, HEADERS.Master_Donatur, {
    textHeaders: ['ID_Donatur', 'Tanggal_Daftar', 'No_WA', 'Kab_ID', 'Status_Aktif', 'Email', 'Kode_Perantara'],
    currencyHeaders: ['Nominal_Komitmen'],
    widthByHeader: {
      ID_Donatur: 145,
      Tanggal_Daftar: 165,
      Nama_Lengkap: 220,
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
    textHeaders: ['ID_Transaksi', 'Waktu_Input', 'ID_Donatur', 'No_WA', 'Bulan_Tagihan', 'Status_Verifikasi', 'Status_Penyaluran'],
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
      Status_Penyaluran: 165
    }
  });

  const panitiaSheet = ensureSheetWithHeaders_(ss, SHEET_NAMES.PANITIA, HEADERS.Data_Panitia, {
    textHeaders: ['Kode_Panitia', 'No_WA_Panitia', 'Role'],
    widthByHeader: {
      Kode_Panitia: 140,
      Nama_Panitia: 220,
      No_WA_Panitia: 165,
      Role: 145
    }
  });

  if (panitiaSheet.getLastRow() <= 1) {
    const initialPanitia = [
      ['ADM01', 'Admin Sekretariat', '6281100000001', 'Super Admin'],
      ['PNT01', 'Koordinator Wilayah Utara', '6281100000002', 'Admin'],
      ['PNT02', 'Koordinator Wilayah Selatan', '6281100000003', 'Admin']
    ];
    const startRow = 2;
    panitiaSheet.getRange(startRow, 1, initialPanitia.length, 1).setNumberFormat('@');
    panitiaSheet.getRange(startRow, 3, initialPanitia.length, 1).setNumberFormat('@');
    panitiaSheet.getRange(startRow, 1, initialPanitia.length, 4).setValues(initialPanitia);
  }

  const pengaturanSheet = ensureSheetWithHeaders_(ss, SHEET_NAMES.PENGATURAN, HEADERS.Pengaturan, {
    textHeaders: ['Kunci', 'Nilai'],
    widthByHeader: {
      Kunci: 220,
      Nilai: 520
    }
  });

  if (pengaturanSheet.getLastRow() <= 1) {
    const defaults = buildDefaultSettingsMap_();
    writeSettingsMap_(pengaturanSheet, defaults);
  }

  SpreadsheetApp.flush();
  Logger.log('setupDatabase() selesai. Seluruh sheet DAIKITA siap digunakan.');
  return {
    status: 'success',
    message: 'Struktur data DAIKITA berhasil disiapkan tanpa menghapus data lama.'
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

      // Tambahkan header baru di sebelah kanan agar data kolom lama tetap selaras
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
    logoUrl: '',
    qrisUrl: '',
    qrisMerchantName: 'DAIKITA Wahdah Islamiyah',
    showQris: 'true',
    defaultNominal: '50000',
    defaultTglPengingat: '5',
    catatanPembayaran: "Penyaluran amanah rutin Kafalah Da'i hanya melalui rekening resmi atau QRIS lembaga.",
    infoRekening: JSON.stringify(INFO_REKENING_DEFAULT)
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

  return {
    namaLembaga: String(rawMap.namaLembaga || NAMA_LEMBAGA).trim() || NAMA_LEMBAGA,
    tagline: String(rawMap.tagline || TAGLINE_LEMBAGA).trim() || TAGLINE_LEMBAGA,
    logoUrl: String(rawMap.logoUrl || '').trim(),
    qrisUrl: String(rawMap.qrisUrl || '').trim(),
    qrisMerchantName: String(rawMap.qrisMerchantName || '').trim(),
    showQris: String(rawMap.showQris || 'true').toLowerCase() !== 'false',
    defaultNominal: parseNumber_(rawMap.defaultNominal) || 50000,
    defaultTglPengingat: Math.min(31, Math.max(1, parseNumber_(rawMap.defaultTglPengingat) || 5)),
    catatanPembayaran: String(rawMap.catatanPembayaran || '').trim(),
    infoRekening: parsedRekening
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
    infoRekening: JSON.stringify(rekeningInput.length > 0 ? rekeningInput : current.infoRekening)
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

// ==================== HANDLER DATA UTAMA ====================
function getInitialData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_NAMES.DONATUR) ||
      !ss.getSheetByName(SHEET_NAMES.TRANSAKSI) ||
      !ss.getSheetByName(SHEET_NAMES.PANITIA) ||
      !ss.getSheetByName(SHEET_NAMES.PENGATURAN)) {
    setupDatabase();
  }

  const config = loadConfigObject_(ss);

  const donatur = readSheetAsObjects_(ss.getSheetByName(SHEET_NAMES.DONATUR)).map(function (row) {
    return {
      idDonatur: String(row.ID_Donatur || '').trim(),
      tanggalDaftar: formatCellDateString_(row.Tanggal_Daftar),
      namaLengkap: String(row.Nama_Lengkap || '').trim(),
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
      statusPenyaluran: rawPenyaluran === 'Sudah Disalurkan' ? 'Sudah Disalurkan' : 'Belum Disalurkan'
    };
  }).filter(function (t) {
    return t.idTransaksi !== '';
  });

  const panitia = readSheetAsObjects_(ss.getSheetByName(SHEET_NAMES.PANITIA)).map(function (row) {
    return {
      kodePanitia: String(row.Kode_Panitia || '').trim(),
      namaPanitia: String(row.Nama_Panitia || '').trim(),
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
      textHeaders: ['ID_Donatur', 'Tanggal_Daftar', 'No_WA', 'Kab_ID', 'Status_Aktif', 'Email', 'Kode_Perantara'],
      currencyHeaders: ['Nominal_Komitmen']
    });
  }

  const namaLengkap = String(payload.namaLengkap || '').trim();
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
    No_WA: normalizedWa,
    Kab_ID: kabId,
    Domisili: domisili,
    Provinsi: provinsi,
    Pulau: pulau,
    Program_Donasi: "Kafalah Da'i",
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
    'No_WA',
    'Kab_ID',
    'Kode_Perantara',
    'Status_Aktif',
    'Email'
  ], ['Nominal_Komitmen']);
  SpreadsheetApp.flush();

  return {
    status: 'success',
    message: 'Donatur ' + namaLengkap + ' berhasil didaftarkan.',
    data: {
      donatur: {
        idDonatur: idDonatur,
        tanggalDaftar: tanggalDaftar,
        namaLengkap: namaLengkap,
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
      }
    }
  };
}

function handleSubmitPembayaran_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.TRANSAKSI);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(SHEET_NAMES.TRANSAKSI);
  } else {
    ensureSheetWithHeaders_(ss, SHEET_NAMES.TRANSAKSI, HEADERS.Transaksi_Donasi, {
      textHeaders: ['ID_Transaksi', 'Waktu_Input', 'ID_Donatur', 'No_WA', 'Bulan_Tagihan', 'Status_Verifikasi', 'Status_Penyaluran'],
      currencyHeaders: ['Nominal_Transfer']
    });
  }

  const idDonatur = String(payload.idDonatur || '').trim();
  const namaDonatur = String(payload.namaDonatur || '').trim();
  const waCheck = validateAndNormalizeWA_(payload.noWa);
  const bulanTagihan = formatBulanTagihan_(payload.bulanTagihan);
  const nominalTransfer = parseNumber_(payload.nominalTransfer);
  const bankTujuan = String(payload.bankTujuan || '').trim();
  const diinputOleh = String(payload.diinputOleh || 'Donatur (Mandiri)').trim();

  if (!namaDonatur) {
    return { status: 'error', message: 'Nama donatur wajib diisi.' };
  }
  if (!waCheck.valid) {
    return { status: 'error', message: waCheck.error };
  }
  const normalizedWa = waCheck.normalized;

  if (!/^\d{4}-\d{2}$/.test(bulanTagihan)) {
    return { status: 'error', message: 'Format bulan tagihan harus YYYY-MM.' };
  }
  if (nominalTransfer <= 0) {
    return { status: 'error', message: 'Nominal transfer harus lebih dari Rp 0.' };
  }
  if (!bankTujuan) {
    return { status: 'error', message: 'Metode atau bank tujuan wajib dipilih.' };
  }
  if (!payload.fileBase64) {
    return { status: 'error', message: 'Bukti transfer (gambar/PDF) wajib diunggah.' };
  }

  const uploadResult = uploadBuktiToDrive_({
    fileBase64: String(payload.fileBase64),
    fileMimeType: String(payload.fileMimeType || 'image/jpeg'),
    fileName: String(payload.fileName || 'bukti.jpg'),
    bulanTagihan: bulanTagihan,
    namaDonatur: namaDonatur,
    nominalTransfer: nominalTransfer
  });

  const now = new Date();
  const existingCount = Math.max(sheet.getLastRow() - 1, 0);
  const idTransaksi = generateTransaksiId_(existingCount + 1, now);
  const waktuInput = formatTimestamp_(now);
  const statusVerifikasi = 'Pending';
  const statusPenyaluran = 'Belum Disalurkan';

  appendRowByHeaderMap_(sheet, {
    ID_Transaksi: idTransaksi,
    Waktu_Input: waktuInput,
    ID_Donatur: idDonatur || '-',
    Nama_Donatur: namaDonatur,
    No_WA: normalizedWa,
    Bulan_Tagihan: bulanTagihan,
    Nominal_Transfer: nominalTransfer,
    Bank_Tujuan: bankTujuan,
    Link_Bukti_Drive: uploadResult.url,
    Status_Verifikasi: statusVerifikasi,
    Diinput_Oleh: diinputOleh,
    Status_Penyaluran: statusPenyaluran
  }, ['ID_Transaksi', 'Waktu_Input', 'ID_Donatur', 'No_WA', 'Bulan_Tagihan', 'Status_Verifikasi', 'Status_Penyaluran'], ['Nominal_Transfer']);
  SpreadsheetApp.flush();

  return {
    status: 'success',
    message: 'Konfirmasi pembayaran berhasil dikirim dan menunggu verifikasi pengurus.',
    data: {
      transaksi: {
        idTransaksi: idTransaksi,
        waktuInput: waktuInput,
        idDonatur: idDonatur || '-',
        namaDonatur: namaDonatur,
        noWa: normalizedWa,
        bulanTagihan: bulanTagihan,
        nominalTransfer: nominalTransfer,
        bankTujuan: bankTujuan,
        linkBuktiDrive: uploadResult.url,
        statusVerifikasi: statusVerifikasi,
        diinputOleh: diinputOleh,
        statusPenyaluran: statusPenyaluran
      },
      savedFileName: uploadResult.savedFileName
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
  const statusCol = indexMap.Status_Aktif || 11;

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
  }

  const kodePanitia = String(payload.kodePanitia || '').trim().toUpperCase();
  const namaPanitia = String(payload.namaPanitia || '').trim();
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
  const waCol = indexMap.No_WA_Panitia || 3;
  const roleCol = indexMap.Role || 4;

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
    sheet.getRange(updatedRow, waCol).setNumberFormat('@').setValue(noWa);
    sheet.getRange(updatedRow, roleCol).setNumberFormat('@').setValue(role);
  } else {
    appendRowByHeaderMap_(sheet, {
      Kode_Panitia: kodePanitia,
      Nama_Panitia: namaPanitia,
      No_WA_Panitia: noWa,
      Role: role
    }, ['Kode_Panitia', 'No_WA_Panitia', 'Role'], []);
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
function getDriveTargetFolder_() {
  if (!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID === 'GANTI_DENGAN_ID_FOLDER_GOOGLE_DRIVE_ANDA') {
    throw new Error('ID folder penyimpanan belum diisi di konfigurasi server.');
  }
  try {
    return DriveApp.getFolderById(DRIVE_FOLDER_ID);
  } catch (err) {
    throw new Error('Folder penyimpanan tidak ditemukan atau tidak memiliki izin akses.');
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
  const bulanPart = sanitizeFileToken_(params.bulanTagihan || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM'));
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
