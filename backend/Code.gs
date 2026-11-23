/**
 * ============================================================================
 * DAIKITA — SISTEM MANAJEMEN DONATUR RUTIN (BACKEND GOOGLE APPS SCRIPT)
 * "Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah."
 * Arsitektur Serverless: Google Sheets + Google Drive + Web App JSON API
 * ============================================================================
 * CARA SETUP CEPAT:
 * 1. Buka Google Sheets -> menu Ekstensi -> Apps Script.
 * 2. Tempel seluruh kode ini ke file Code.gs lalu simpan (Ctrl+S).
 * 3. Ganti nilai DRIVE_FOLDER_ID, NAMA_LEMBAGA, dan INFO_REKENING di bawah.
 * 4. Pilih fungsi "setupDatabase" di toolbar atas -> klik Jalankan (Run)
 *    dan izinkan akses Google Sheets & Google Drive.
 *    (Aman dijalankan berulang kali — menambahkan kolom Email & Status_Penyaluran
 *    tanpa menghapus data yang sudah ada.)
 * 5. Klik Terapkan (Deploy) -> Deployment Baru (atau Kelola deployment -> Versi baru):
 *    - Jenis: Aplikasi Web
 *    - Jalankan sebagai: Saya (Me)
 *    - Yang memiliki akses: Siapa saja (Anyone)
 * 6. Salin URL Aplikasi Web (/exec) lalu tempel ke menu "Koneksi GAS" di Frontend.
 * ============================================================================
 */

// ==================== KONFIGURASI UTAMA (SILAKAN UBAH) ====================
const DRIVE_FOLDER_ID = 'GANTI_DENGAN_ID_FOLDER_GOOGLE_DRIVE_ANDA';

const NAMA_LEMBAGA = 'DAIKITA';
const TAGLINE_LEMBAGA = 'Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah.';

const INFO_REKENING = [
  {
    bank: 'BSI (Bank Syariah Indonesia)',
    nomor: '7123456789',
    atasNama: 'DAIKITA'
  },
  {
    bank: 'Bank Mandiri',
    nomor: '1320012345678',
    atasNama: 'DAIKITA'
  },
  {
    bank: 'BCA Syariah',
    nomor: '0123456789',
    atasNama: 'DAIKITA'
  }
];

const DAFTAR_PROGRAM = [
  'Beasiswa Santri & Yatim',
  'Operasional Masjid & Dakwah',
  'Pangan Berkah Bulanan',
  'Wakaf Sarana Pendidikan',
  'Infaq Umum Rutin'
];

const TIMEZONE = 'Asia/Jakarta';

// ==================== KONSTANTA NAMA SHEET & HEADER ====================
const SHEET_NAMES = {
  DONATUR: 'Master_Donatur',
  TRANSAKSI: 'Transaksi_Donasi',
  PANITIA: 'Data_Panitia'
};

const HEADERS = {
  Master_Donatur: [
    'ID_Donatur',
    'Tanggal_Daftar',
    'Nama_Lengkap',
    'No_WA',
    'Domisili',
    'Program_Donasi',
    'Nominal_Komitmen',
    'Tgl_Jatuh_Tempo',
    'Metode_Daftar',
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
  ]
};

// ==================== SETUP DATABASE (AMAN DIJALANKAN BERULANG) ====================
/**
 * Membuat dan merapikan 3 tab sheet beserta header, format Plain Text No_WA,
 * serta menambahkan kolom baru (Email & Status_Penyaluran) tanpa menghapus data lama.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet aktif tidak ditemukan. Pastikan skrip terikat pada file Google Sheets.');
  }

  ensureSheetWithHeaders_(ss, SHEET_NAMES.DONATUR, HEADERS.Master_Donatur, {
    textCols: [1, 2, 4, 11, 12],
    currencyCols: [7],
    colWidths: [145, 165, 220, 155, 170, 210, 155, 130, 165, 190, 120, 210]
  });

  ensureSheetWithHeaders_(ss, SHEET_NAMES.TRANSAKSI, HEADERS.Transaksi_Donasi, {
    textCols: [1, 2, 3, 5, 6, 10, 12],
    currencyCols: [7],
    colWidths: [165, 165, 145, 210, 155, 125, 155, 200, 250, 145, 175, 165]
  });

  const panitiaSheet = ensureSheetWithHeaders_(ss, SHEET_NAMES.PANITIA, HEADERS.Data_Panitia, {
    textCols: [1, 3, 4],
    currencyCols: [],
    colWidths: [140, 220, 165, 145]
  });

  if (panitiaSheet.getLastRow() <= 1) {
    const initialPanitia = [
      ['ADM01', 'Admin Sekretariat', '6281100000001', 'Admin'],
      ['PNT01', 'Koordinator Wilayah Utara', '6281100000002', 'Panitia'],
      ['PNT02', 'Koordinator Wilayah Selatan', '6281100000003', 'Panitia']
    ];
    const startRow = 2;
    const range = panitiaSheet.getRange(startRow, 1, initialPanitia.length, 4);
    panitiaSheet.getRange(startRow, 1, initialPanitia.length, 1).setNumberFormat('@');
    panitiaSheet.getRange(startRow, 3, initialPanitia.length, 1).setNumberFormat('@');
    range.setValues(initialPanitia);
  }

  SpreadsheetApp.flush();
  Logger.log('setupDatabase() selesai. Ketiga sheet DAIKITA siap digunakan.');
  return {
    status: 'success',
    message: 'Database DAIKITA berhasil disiapkan tanpa menghapus data yang ada.'
  };
}

function setupSheets() {
  return setupDatabase();
}

function ensureSheetWithHeaders_(ss, sheetName, headers, options) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Pastikan jumlah kolom mencukupi jika ada kolom tambahan baru
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }

  const lastRow = sheet.getLastRow();
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const existingHeaders = headerRange.getValues()[0];
  const isHeaderEmpty = existingHeaders.every(function (cell) {
    return String(cell || '').trim() === '';
  });

  if (lastRow === 0 || isHeaderEmpty) {
    headerRange.setValues([headers]);
  } else {
    for (let i = 0; i < headers.length; i++) {
      if (String(existingHeaders[i] || '').trim() === '') {
        sheet.getRange(1, i + 1).setValue(headers[i]);
      }
    }
  }

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
  if (options && options.textCols) {
    options.textCols.forEach(function (colIdx) {
      sheet.getRange(2, colIdx, maxRows - 1, 1).setNumberFormat('@');
    });
  }

  if (options && options.currencyCols) {
    options.currencyCols.forEach(function (colIdx) {
      sheet.getRange(2, colIdx, maxRows - 1, 1).setNumberFormat('#,##0');
    });
  }

  if (options && options.colWidths) {
    options.colWidths.forEach(function (width, idx) {
      sheet.setColumnWidth(idx + 1, width);
    });
  }

  return sheet;
}

// ==================== ENDPOINT WEB APP (GET & POST) ====================
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = String(params.action || 'getInitialData').trim();

    if (action === 'ping') {
      return jsonResponse_({
        status: 'success',
        message: 'Koneksi Google Apps Script DAIKITA aktif.',
        data: {
          namaLembaga: NAMA_LEMBAGA,
          tagline: TAGLINE_LEMBAGA,
          serverTime: formatTimestamp_(new Date())
        }
      });
    }

    if (action === 'getInitialData') {
      return jsonResponse_({
        status: 'success',
        message: 'Data berhasil dimuat.',
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
        message: 'Data berhasil dimuat.',
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

// ==================== HANDLER AKSI ====================
function getInitialData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_NAMES.DONATUR) ||
      !ss.getSheetByName(SHEET_NAMES.TRANSAKSI) ||
      !ss.getSheetByName(SHEET_NAMES.PANITIA)) {
    setupDatabase();
  }

  const donatur = readSheetAsObjects_(ss.getSheetByName(SHEET_NAMES.DONATUR)).map(function (row) {
    return {
      idDonatur: String(row.ID_Donatur || '').trim(),
      tanggalDaftar: formatCellDateString_(row.Tanggal_Daftar),
      namaLengkap: String(row.Nama_Lengkap || '').trim(),
      noWa: safeNormalizeOrKeep_(row.No_WA),
      email: String(row.Email || '').trim(),
      domisili: String(row.Domisili || '').trim(),
      programDonasi: String(row.Program_Donasi || 'Infaq Umum Rutin').trim(),
      nominalKomitmen: parseNumber_(row.Nominal_Komitmen),
      tglJatuhTempo: parseNumber_(row.Tgl_Jatuh_Tempo) || 1,
      metodeDaftar: String(row.Metode_Daftar || 'Mandiri').trim(),
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
      role: String(row.Role || 'Panitia').trim()
    };
  }).filter(function (p) {
    return p.kodePanitia !== '' && p.namaPanitia !== '';
  });

  return {
    config: {
      namaLembaga: NAMA_LEMBAGA,
      tagline: TAGLINE_LEMBAGA,
      infoRekening: INFO_REKENING,
      daftarProgram: DAFTAR_PROGRAM
    },
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
  }
  // Pastikan kolom Email (kolom 12) tersedia jika sheet berasal dari versi lama
  if (sheet.getLastColumn() < 12) {
    ensureSheetWithHeaders_(ss, SHEET_NAMES.DONATUR, HEADERS.Master_Donatur, {
      textCols: [1, 2, 4, 11, 12],
      currencyCols: [7]
    });
  }

  const namaLengkap = String(payload.namaLengkap || '').trim();
  const email = String(payload.email || '').trim();
  const domisili = String(payload.domisili || '').trim();
  const programDonasi = String(payload.programDonasi || 'Infaq Umum Rutin').trim() || 'Infaq Umum Rutin';
  const nominalKomitmen = parseNumber_(payload.nominalKomitmen);
  const tglJatuhTempo = parseNumber_(payload.tglJatuhTempo);
  const metodeDaftar = String(payload.metodeDaftar || 'Mandiri').trim();
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
    return {
      status: 'error',
      message: waCheck.error
    };
  }
  const normalizedWa = waCheck.normalized;

  // Cek anti-duplikasi nomor WA di Master_Donatur
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
            programDonasi: String(existingRows[i].Program_Donasi || ''),
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

  const newRow = [
    idDonatur,
    tanggalDaftar,
    namaLengkap,
    normalizedWa,
    domisili,
    programDonasi,
    nominalKomitmen,
    tglJatuhTempo,
    metodeDaftar,
    namaPerantara,
    statusAktif,
    email
  ];

  const targetRow = sheet.getLastRow() + 1;
  sheet.getRange(targetRow, 1).setNumberFormat('@');
  sheet.getRange(targetRow, 2).setNumberFormat('@');
  sheet.getRange(targetRow, 4).setNumberFormat('@');
  sheet.getRange(targetRow, 7).setNumberFormat('#,##0');
  sheet.getRange(targetRow, 12).setNumberFormat('@');
  sheet.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
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
        domisili: domisili,
        programDonasi: programDonasi,
        nominalKomitmen: nominalKomitmen,
        tglJatuhTempo: tglJatuhTempo,
        metodeDaftar: metodeDaftar,
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
  }
  if (sheet.getLastColumn() < 12) {
    ensureSheetWithHeaders_(ss, SHEET_NAMES.TRANSAKSI, HEADERS.Transaksi_Donasi, {
      textCols: [1, 2, 3, 5, 6, 10, 12],
      currencyCols: [7]
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
    return { status: 'error', message: 'Bank tujuan wajib dipilih.' };
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

  const newRow = [
    idTransaksi,
    waktuInput,
    idDonatur || '-',
    namaDonatur,
    normalizedWa,
    bulanTagihan,
    nominalTransfer,
    bankTujuan,
    uploadResult.url,
    statusVerifikasi,
    diinputOleh,
    statusPenyaluran
  ];

  const targetRow = sheet.getLastRow() + 1;
  sheet.getRange(targetRow, 1).setNumberFormat('@');
  sheet.getRange(targetRow, 2).setNumberFormat('@');
  sheet.getRange(targetRow, 3).setNumberFormat('@');
  sheet.getRange(targetRow, 5).setNumberFormat('@');
  sheet.getRange(targetRow, 6).setNumberFormat('@');
  sheet.getRange(targetRow, 7).setNumberFormat('#,##0');
  sheet.getRange(targetRow, 12).setNumberFormat('@');
  sheet.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
  SpreadsheetApp.flush();

  return {
    status: 'success',
    message: 'Konfirmasi pembayaran berhasil dikirim dan menunggu verifikasi admin.',
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
    return { status: 'error', message: 'Sheet Transaksi_Donasi tidak ditemukan.' };
  }

  const idTransaksi = String(payload.idTransaksi || '').trim();
  const newStatus = String(payload.status || '').trim();

  if (!idTransaksi) {
    return { status: 'error', message: 'ID Transaksi wajib diisi.' };
  }
  if (newStatus !== 'Valid' && newStatus !== 'Ditolak' && newStatus !== 'Pending') {
    return { status: 'error', message: 'Status verifikasi harus Valid atau Ditolak.' };
  }

  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0] || '').trim() === idTransaksi) {
      sheet.getRange(r + 1, 10).setNumberFormat('@').setValue(newStatus);
      // Jika ditolak, pastikan status penyaluran kembali ke Belum Disalurkan
      if (newStatus === 'Ditolak' && sheet.getLastColumn() >= 12) {
        sheet.getRange(r + 1, 12).setNumberFormat('@').setValue('Belum Disalurkan');
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
    return { status: 'error', message: 'Sheet Transaksi_Donasi tidak ditemukan.' };
  }
  if (sheet.getLastColumn() < 12) {
    ensureSheetWithHeaders_(ss, SHEET_NAMES.TRANSAKSI, HEADERS.Transaksi_Donasi, {
      textCols: [1, 2, 3, 5, 6, 10, 12],
      currencyCols: [7]
    });
  }

  const idTransaksi = String(payload.idTransaksi || '').trim();
  const statusPenyaluran = String(payload.statusPenyaluran || '').trim();

  if (!idTransaksi) {
    return { status: 'error', message: 'ID Transaksi wajib diisi.' };
  }
  if (statusPenyaluran !== 'Sudah Disalurkan' && statusPenyaluran !== 'Belum Disalurkan') {
    return { status: 'error', message: 'Status penyaluran harus Sudah Disalurkan atau Belum Disalurkan.' };
  }

  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0] || '').trim() === idTransaksi) {
      sheet.getRange(r + 1, 12).setNumberFormat('@').setValue(statusPenyaluran);
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
    return { status: 'error', message: 'Sheet Master_Donatur tidak ditemukan.' };
  }

  const idDonatur = String(payload.idDonatur || '').trim();
  const newStatus = String(payload.status || '').trim();

  if (!idDonatur) {
    return { status: 'error', message: 'ID Donatur wajib diisi.' };
  }
  if (newStatus !== 'Aktif' && newStatus !== 'Cuti') {
    return { status: 'error', message: 'Status donatur harus Aktif atau Cuti.' };
  }

  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0] || '').trim() === idDonatur) {
      sheet.getRange(r + 1, 11).setNumberFormat('@').setValue(newStatus);
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

// ==================== UPLOAD & AUTO-RENAME GOOGLE DRIVE ====================
function uploadBuktiToDrive_(params) {
  if (!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID === 'GANTI_DENGAN_ID_FOLDER_GOOGLE_DRIVE_ANDA') {
    throw new Error('DRIVE_FOLDER_ID di Code.gs belum diisi. Silakan isi ID Folder Google Drive terlebih dahulu lalu deploy ulang.');
  }

  let folder;
  try {
    folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  } catch (err) {
    throw new Error('Folder Google Drive tidak ditemukan atau tidak memiliki izin akses. Periksa DRIVE_FOLDER_ID Anda.');
  }

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

// ==================== FUNGSI UTILITAS & VALIDASI WA ====================
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

/**
 * Normalisasi & Validasi Nomor WA (Indonesia 628... dan Internasional):
 * - Nomor Indonesia (awalan 08, 628, +628, 00628, 6208, atau 8... tanpa '+'):
 *   disimpan dalam format 628... dengan panjang 9 sampai 15 angka termasuk 628.
 * - Nomor Internasional (mis. +60..., +65..., +966..., +81..., 6012...):
 *   tetap dapat disimpan selama 7 sampai 15 angka tanpa awalan 0.
 */
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

  // Perbaiki typo umum +6208... / 6208... menjadi 628...
  if (digits.indexOf('6208') === 0) {
    digits = '628' + digits.substring(4);
  } else if (!hasExplicitPlus && digits.indexOf('08') === 0) {
    digits = '62' + digits.substring(1);
  } else if (!hasExplicitPlus && digits.indexOf('8') === 0) {
    digits = '62' + digits;
  }

  // Cek jika nomor Indonesia (awalan 628 atau 62)
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

  // Nomor internasional (E.164: 7 - 15 digit)
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
  if (mime.indexOf('jpeg') !== -1 || mime.indexOf('jpg') !== -1) return 'jpg';
  if (mime.indexOf('png') !== -1) return 'png';
  if (mime.indexOf('webp') !== -1) return 'webp';
  if (mime.indexOf('pdf') !== -1) return 'pdf';

  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  if (match && ['jpg', 'jpeg', 'png', 'webp', 'pdf'].indexOf(match[1]) !== -1) {
    return match[1] === 'jpeg' ? 'jpg' : match[1];
  }
  return 'jpg';
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
