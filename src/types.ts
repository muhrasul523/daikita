export type TabKey =
  | 'pendaftaran'
  | 'konfirmasi'
  | 'verifikasi'
  | 'mutasi'
  | 'dashboard'
  | 'grup_wa'
  | 'broadcast';

export type ThemeMode = 'system' | 'light' | 'dark';

export type RolePengurus = 'Publik' | 'Admin' | 'Super Admin';
export type JenisKelamin = 'Laki-laki' | 'Perempuan' | '';
export type MinatGrupWa = 'Ya' | 'Tidak';
export type StatusGrupWa = 'Sudah Bergabung' | 'Belum Bergabung';
export type JenisDonatur = 'Rutin' | 'Umum';

export type StatusAktif = 'Aktif' | 'Non Aktif';
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
  /** Template WA Pesan 1 (Notifikasi Awal Pendaftaran) */
  waTemplates: string[];
  /** Template WA Pesan 2 (Arahan Save Nomor, dikirim delay 1 menit setelah daftar) */
  waFollowupTemplates: string[];
  /** Jeda pengiriman Pesan 2 pendaftaran awal dalam detik (default 60 detik) */
  waFollowupDelaySec: number;
  /** Template WA Notifikasi Pengingat / Reminder Bulanan */
  waReminderTemplates: string[];
  /** Pengaturan Grup WhatsApp Donatur */
  waGroupName: string;
  waGroupLink: string;
  waGroupId: string;
  enableEmailNotif: boolean;
  emailSenderAlias: string;
  emailSenderName: string;
  /** 1 Template Email khusus Notifikasi Awal Daftar */
  emailTemplateDaftar: EmailTemplateItem;
  /** 1 Template Email khusus Pengingat / Reminder Bulanan */
  emailTemplateReminder: EmailTemplateItem;
  /** Legacy array untuk kompatibilitas mundur */
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
  minatGrupWa?: MinatGrupWa;
  statusGrupWa?: StatusGrupWa;
}

export interface TransaksiDonasi {
  idTransaksi: string;
  waktuInput: string;
  tanggalTransfer: string; // YYYY-MM-DD
  jenisDonatur?: JenisDonatur; // 'Rutin' | 'Umum'
  idDonatur: string;
  namaDonatur: string;
  noWa: string;
  bulanTagihan: string; // YYYY-MM
  nominalKomitmen: number; // Porsi donasi komitmen (0 untuk Donatur Umum)
  donasiLainnya: number; // Kelebihan di atas komitmen (untuk Donatur Rutin)
  nominalTransfer: number; // Total dana masuk
  bankTujuan: string;
  linkBuktiDrive: string;
  statusVerifikasi: StatusVerifikasi;
  diinputOleh: string;
  statusPenyaluran?: StatusPenyaluran;
  keterangan?: string;
}

export interface Panitia {
  kodePanitia: string;
  namaPanitia: string;
  jenisKelamin?: JenisKelamin;
  noWaPanitia: string;
  role: string; // Siap untuk pembagian role Publik / Admin / Super Admin
}

export type QueueStatus = 'Menunggu' | 'Terkirim' | 'Gagal' | 'Dibatalkan';

export interface ScheduledMessageItem {
  idAntrean: string;
  waktuBuat: string;
  jadwalKirim: string;
  jenisPesan: string;
  idDonatur: string;
  namaDonatur: string;
  noWa: string;
  isiPesan: string;
  mediaUrl: string;
  status: QueueStatus;
  keteranganHasil: string;
  waktuTerkirim: string;
}

export interface AppDataState {
  config: LembagaConfig;
  donatur: Donatur[];
  transaksi: TransaksiDonasi[];
  panitia: Panitia[];
  antreanPesan?: ScheduledMessageItem[];
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
  minatGrupWa: MinatGrupWa;
}

export interface NotifChannelStatus {
  attempted: boolean;
  ok: boolean;
  detail: string;
  templateIndex?: number;
}

export interface NotifDeliveryResult {
  wa: NotifChannelStatus;
  waFollowup?: NotifChannelStatus;
  email: NotifChannelStatus;
}

export interface SubmitPembayaranPayload {
  jenisDonatur?: JenisDonatur;
  idDonatur: string;
  namaDonatur: string;
  noWa: string;
  tanggalTransfer: string; // YYYY-MM-DD
  bulanTagihan: string;
  bulanTagihanList?: string[];
  nominalTransfer: number;
  nominalKomitmenPerBulan?: number;
  bankTujuan?: string;
  diinputOleh: string;
  keterangan?: string;
  fileBase64?: string;
  fileMimeType?: string;
  fileName?: string;
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
  waFollowupTemplates: string[];
  waFollowupDelaySec: number;
  waReminderTemplates: string[];
  waGroupName: string;
  waGroupLink: string;
  waGroupId: string;
  enableEmailNotif: boolean;
  emailSenderAlias: string;
  emailSenderName: string;
  emailTemplateDaftar: EmailTemplateItem;
  emailTemplateReminder: EmailTemplateItem;
  emailTemplates?: EmailTemplateItem[];
}

export interface TestNotificationPayload {
  noWa?: string;
  email?: string;
  namaLengkap?: string;
  jenisKelamin?: JenisKelamin;
  minatGrupWa?: MinatGrupWa;
  messageType?: 'daftar' | 'followup' | 'reminder';
  templateIndex?: number;
}

export interface SendBroadcastSinglePayload {
  idDonatur?: string;
  namaDonatur: string;
  noWa: string;
  email?: string;
  messageText: string;
  mediaUrl?: string;
  jenisPesan?: string;
  sendEmailReminder?: boolean;
  emailSubject?: string;
  emailBody?: string;
}

export interface ScheduleBroadcastItemPayload {
  idDonatur: string;
  namaDonatur: string;
  noWa: string;
  isiPesan: string;
  mediaUrl?: string;
  jadwalKirim: string; // YYYY-MM-DD HH:mm:ss
  jenisPesan: string;
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
