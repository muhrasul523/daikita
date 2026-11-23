export type TabKey = 'pendaftaran' | 'konfirmasi' | 'dashboard' | 'verifikasi';

export type ThemeMode = 'system' | 'light' | 'dark';

export type RolePengurus = 'Publik' | 'Admin' | 'Super Admin';
export type JenisKelamin = 'Laki-laki' | 'Perempuan' | '';

export type StatusAktif = 'Aktif' | 'Cuti';
export type StatusVerifikasi = 'Pending' | 'Valid' | 'Ditolak';
export type StatusPenyaluran = 'Belum Disalurkan' | 'Sudah Disalurkan';
export type StatusBayarBulan = 'Lunas' | 'Menunggu Verifikasi' | 'Belum Bayar';

export interface RekeningInfo {
  bank: string;
  nomor: string;
  atasNama: string;
}

export interface EmailTemplateItem {
  subject: string;
  body: string;
}

export interface LembagaConfig {
  namaLembaga: string;
  tagline: string;
  logoUrl: string;
  qrisUrl: string;
  qrisMerchantName: string;
  showQris: boolean;
  defaultNominal: number;
  defaultTglPengingat: number;
  catatanPembayaran: string;
  infoRekening: RekeningInfo[];
  enableWaNotif: boolean;
  waEndpointUrl: string;
  waApiKey: string;
  waTemplates: string[];
  enableEmailNotif: boolean;
  emailSenderAlias: string;
  emailSenderName: string;
  emailTemplates: EmailTemplateItem[];
}

export interface Donatur {
  idDonatur: string;
  tanggalDaftar: string;
  namaLengkap: string;
  jenisKelamin?: JenisKelamin;
  noWa: string;
  email?: string;
  kabId: string;
  domisili: string; // Nama Kabupaten/Kota
  provinsi: string;
  pulau: string;
  nominalKomitmen: number;
  tglJatuhTempo: number;
  metodeDaftar: string;
  kodePerantara?: string;
  namaPerantara: string;
  statusAktif: StatusAktif;
}

export interface TransaksiDonasi {
  idTransaksi: string;
  waktuInput: string;
  idDonatur: string;
  namaDonatur: string;
  noWa: string;
  bulanTagihan: string; // YYYY-MM
  nominalTransfer: number;
  bankTujuan: string;
  linkBuktiDrive: string;
  statusVerifikasi: StatusVerifikasi;
  diinputOleh: string;
  statusPenyaluran: StatusPenyaluran;
}

export interface Panitia {
  kodePanitia: string;
  namaPanitia: string;
  jenisKelamin?: JenisKelamin;
  noWaPanitia: string;
  role: string; // Siap untuk pembagian role Publik / Admin / Super Admin
}

export interface AppDataState {
  config: LembagaConfig;
  donatur: Donatur[];
  transaksi: TransaksiDonasi[];
  panitia: Panitia[];
}

export interface RegisterDonaturPayload {
  namaLengkap: string;
  jenisKelamin?: JenisKelamin;
  noWa: string;
  email?: string;
  kabId: string;
  domisili: string;
  provinsi: string;
  pulau: string;
  nominalKomitmen: number;
  tglJatuhTempo: number;
  metodeDaftar: string;
  kodePerantara?: string;
  namaPerantara: string;
}

export interface NotifChannelStatus {
  attempted: boolean;
  ok: boolean;
  detail: string;
  templateIndex?: number;
}

export interface NotifDeliveryResult {
  wa: NotifChannelStatus;
  email: NotifChannelStatus;
}

export interface SubmitPembayaranPayload {
  idDonatur: string;
  namaDonatur: string;
  noWa: string;
  bulanTagihan: string;
  nominalTransfer: number;
  bankTujuan: string;
  diinputOleh: string;
  fileBase64: string;
  fileMimeType: string;
  fileName: string;
}

export interface SavePengaturanPayload {
  namaLembaga: string;
  tagline: string;
  logoUrl: string;
  logoBase64?: string;
  logoMimeType?: string;
  logoFileName?: string;
  qrisUrl: string;
  qrisBase64?: string;
  qrisMimeType?: string;
  qrisFileName?: string;
  qrisMerchantName: string;
  showQris: boolean;
  defaultNominal: number;
  defaultTglPengingat: number;
  catatanPembayaran: string;
  infoRekening: RekeningInfo[];
  enableWaNotif: boolean;
  waEndpointUrl: string;
  waApiKey: string;
  waTemplates: string[];
  enableEmailNotif: boolean;
  emailSenderAlias: string;
  emailSenderName: string;
  emailTemplates: EmailTemplateItem[];
}

export interface TestNotificationPayload {
  noWa?: string;
  email?: string;
  namaLengkap?: string;
  jenisKelamin?: JenisKelamin;
  templateIndex?: number;
}

export interface ApiResult<T = unknown> {
  status: 'success' | 'error';
  code?: string;
  message: string;
  data?: T;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}
