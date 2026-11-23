import { LembagaConfig, Panitia } from './types';

/**
 * URL layanan sinkronisasi data default.
 */
export const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbza8ngK4Wtqqw9vtAH96d-LejP2mp9KNXvUQVrFg77WGCKooQCEbgfxEyozSQ38FP72nA/exec';

export const APP_BRAND_NAME = 'DAIKITA';
export const APP_PROGRAM_FOCUS = "Kafalah Da'i";
export const APP_TAGLINE = 'Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah.';

export const DEFAULT_SCREEN_WIDTH_PCT = 95;

export const STORAGE_KEYS = {
  GAS_URL: 'donatur_rutin_gas_url_v1',
  LOCAL_DATA: 'donatur_rutin_local_sandbox_v1',
  THEME_PREF: 'daikita_theme_pref_v1',
  SCREEN_WIDTH: 'daikita_screen_width_pct_v1',
} as const;

export const DEFAULT_CONFIG: LembagaConfig = {
  namaLembaga: "DAIKITA — Kafalah Da'i",
  tagline: APP_TAGLINE,
  logoUrl: '',
  qrisUrl: '',
  qrisMerchantName: 'DAIKITA Wahdah Islamiyah',
  showQris: true,
  defaultNominal: 50000,
  defaultTglPengingat: 5,
  catatanPembayaran:
    "Penyaluran amanah rutin Kafalah Da'i hanya melalui rekening resmi atau QRIS lembaga.",
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
};

export const DEFAULT_PANITIA: Panitia[] = [
  {
    kodePanitia: 'ADM01',
    namaPanitia: 'Admin Sekretariat',
    noWaPanitia: '6281100000001',
    role: 'Super Admin',
  },
  {
    kodePanitia: 'PNT01',
    namaPanitia: 'Koordinator Wilayah Utara',
    noWaPanitia: '6281100000002',
    role: 'Admin',
  },
  {
    kodePanitia: 'PNT02',
    namaPanitia: 'Koordinator Wilayah Selatan',
    noWaPanitia: '6281100000003',
    role: 'Admin',
  },
];
