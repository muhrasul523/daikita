export type TabKey = 'pendaftaran' | 'konfirmasi' | 'dashboard' | 'verifikasi';

export type ThemeMode = 'system' | 'light' | 'dark';

export type StatusAktif = 'Aktif' | 'Cuti';
export type StatusVerifikasi = 'Pending' | 'Valid' | 'Ditolak';
export type StatusPenyaluran = 'Belum Disalurkan' | 'Sudah Disalurkan';
export type StatusBayarBulan = 'Lunas' | 'Menunggu Verifikasi' | 'Belum Bayar';

export interface RekeningInfo {
  bank: string;
  nomor: string;
  atasNama: string;
}

export interface LembagaConfig {
  namaLembaga: string;
  tagline?: string;
  infoRekening: RekeningInfo[];
  daftarProgram: string[];
}

export interface Donatur {
  idDonatur: string;
  tanggalDaftar: string;
  namaLengkap: string;
  noWa: string;
  email?: string;
  domisili: string;
  programDonasi: string;
  nominalKomitmen: number;
  tglJatuhTempo: number;
  metodeDaftar: string;
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
  noWaPanitia: string;
  role: string;
}

export interface AppDataState {
  config: LembagaConfig;
  donatur: Donatur[];
  transaksi: TransaksiDonasi[];
  panitia: Panitia[];
}

export interface RegisterDonaturPayload {
  namaLengkap: string;
  noWa: string;
  email?: string;
  domisili?: string;
  programDonasi: string;
  nominalKomitmen: number;
  tglJatuhTempo: number;
  metodeDaftar: string;
  namaPerantara: string;
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
