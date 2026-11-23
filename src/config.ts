import { LembagaConfig, Panitia } from './types';

/**
 * URL Web App Google Apps Script default (opsional).
 * Anda bisa menempelkan URL /exec di sini sebelum push ke GitHub,
 * ATAU mengaturnya langsung dari tombol "Koneksi GAS" di antarmuka aplikasi.
 */
export const DEFAULT_GAS_URL = '';

export const APP_BRAND_NAME = 'DAIKITA';
export const APP_TAGLINE = 'Dukungan Amal Infak, Kuatkan Ikhtiar, Teguhkan Amanah.';

export const DEFAULT_SCREEN_WIDTH_PCT = 95;

export const STORAGE_KEYS = {
  GAS_URL: 'donatur_rutin_gas_url_v1',
  LOCAL_DATA: 'donatur_rutin_local_sandbox_v1',
  THEME_PREF: 'daikita_theme_pref_v1',
  SCREEN_WIDTH: 'daikita_screen_width_pct_v1',
} as const;

export const DEFAULT_CONFIG: LembagaConfig = {
  namaLembaga: 'DAIKITA',
  tagline: APP_TAGLINE,
  infoRekening: [
    {
      bank: 'BSI (Bank Syariah Indonesia)',
      nomor: '7123456789',
      atasNama: 'DAIKITA',
    },
    {
      bank: 'Bank Mandiri',
      nomor: '1320012345678',
      atasNama: 'DAIKITA',
    },
    {
      bank: 'BCA Syariah',
      nomor: '0123456789',
      atasNama: 'DAIKITA',
    },
  ],
  daftarProgram: [
    'Beasiswa Santri & Yatim',
    'Operasional Masjid & Dakwah',
    'Pangan Berkah Bulanan',
    'Wakaf Sarana Pendidikan',
    'Infaq Umum Rutin',
  ],
};

export const DEFAULT_PANITIA: Panitia[] = [
  {
    kodePanitia: 'ADM01',
    namaPanitia: 'Admin Sekretariat',
    noWaPanitia: '6281100000001',
    role: 'Admin',
  },
  {
    kodePanitia: 'PNT01',
    namaPanitia: 'Koordinator Wilayah Utara',
    noWaPanitia: '6281100000002',
    role: 'Panitia',
  },
  {
    kodePanitia: 'PNT02',
    namaPanitia: 'Koordinator Wilayah Selatan',
    noWaPanitia: '6281100000003',
    role: 'Panitia',
  },
];
