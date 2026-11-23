import {
  DEFAULT_CONFIG,
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_GAS_URL,
  DEFAULT_PANITIA,
  DEFAULT_WA_TEMPLATES,
  STORAGE_KEYS,
} from '../config';
import {
  ApiResult,
  AppDataState,
  Donatur,
  LembagaConfig,
  NotifDeliveryResult,
  Panitia,
  RegisterDonaturPayload,
  SavePengaturanPayload,
  StatusAktif,
  StatusPenyaluran,
  StatusVerifikasi,
  SubmitPembayaranPayload,
  TestNotificationPayload,
  TransaksiDonasi,
} from '../types';
import {
  normalizeJenisKelamin,
  normalizeRoleLabel,
  previewAutoRenameFile,
  validateAndNormalizeWA,
} from '../utils/formatters';

export function getSavedGasUrl(): string {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEYS.GAS_URL);
    if (saved !== null) {
      return saved.trim();
    }
  } catch {
    // Ignore storage access restrictions
  }
  return DEFAULT_GAS_URL.trim();
}

export function saveGasUrl(url: string): void {
  try {
    const cleaned = url.trim();
    if (!cleaned) {
      window.localStorage.removeItem(STORAGE_KEYS.GAS_URL);
    } else {
      window.localStorage.setItem(STORAGE_KEYS.GAS_URL, cleaned);
    }
  } catch {
    // Ignore storage access restrictions
  }
}

export function isValidGasUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.hostname.includes('script.google.com');
  } catch {
    return false;
  }
}

function normalizeLoadedState(raw?: Partial<AppDataState>): AppDataState {
  const transaksi: TransaksiDonasi[] = Array.isArray(raw?.transaksi)
    ? raw!.transaksi.map((t) => ({
        ...t,
        statusPenyaluran: (t.statusPenyaluran === 'Sudah Disalurkan'
          ? 'Sudah Disalurkan'
          : 'Belum Disalurkan') as StatusPenyaluran,
      }))
    : [];

  const donatur: Donatur[] = Array.isArray(raw?.donatur)
    ? raw!.donatur.map((d) => ({
        ...d,
        jenisKelamin: normalizeJenisKelamin(d.jenisKelamin),
        email: d.email || '',
        kabId: d.kabId || '',
        domisili: d.domisili || '',
        provinsi: d.provinsi || '',
        pulau: d.pulau || '',
        kodePerantara: d.kodePerantara || '',
      }))
    : [];

  const panitia: Panitia[] =
    Array.isArray(raw?.panitia) && raw!.panitia.length > 0
      ? raw!.panitia.map((p) => ({
          ...p,
          jenisKelamin: normalizeJenisKelamin(p.jenisKelamin),
          role: normalizeRoleLabel(p.role),
        }))
      : DEFAULT_PANITIA;

  const rawCfg = raw?.config;
  const config: LembagaConfig = rawCfg
    ? {
        ...DEFAULT_CONFIG,
        ...rawCfg,
        logoUrl: rawCfg.logoUrl || '',
        qrisUrl: rawCfg.qrisUrl || '',
        qrisMerchantName: rawCfg.qrisMerchantName || DEFAULT_CONFIG.qrisMerchantName,
        showQris: typeof rawCfg.showQris === 'boolean' ? rawCfg.showQris : DEFAULT_CONFIG.showQris,
        defaultNominal:
          Number(rawCfg.defaultNominal) > 0
            ? Number(rawCfg.defaultNominal)
            : DEFAULT_CONFIG.defaultNominal,
        defaultTglPengingat:
          Number(rawCfg.defaultTglPengingat) >= 1 && Number(rawCfg.defaultTglPengingat) <= 31
            ? Number(rawCfg.defaultTglPengingat)
            : DEFAULT_CONFIG.defaultTglPengingat,
        catatanPembayaran: rawCfg.catatanPembayaran || DEFAULT_CONFIG.catatanPembayaran,
        infoRekening:
          Array.isArray(rawCfg.infoRekening) && rawCfg.infoRekening.length > 0
            ? rawCfg.infoRekening
            : DEFAULT_CONFIG.infoRekening,
        enableWaNotif:
          typeof rawCfg.enableWaNotif === 'boolean'
            ? rawCfg.enableWaNotif
            : DEFAULT_CONFIG.enableWaNotif,
        waEndpointUrl: rawCfg.waEndpointUrl || DEFAULT_CONFIG.waEndpointUrl,
        waApiKey: rawCfg.waApiKey || '',
        waTemplates:
          Array.isArray(rawCfg.waTemplates) && rawCfg.waTemplates.length > 0
            ? rawCfg.waTemplates
            : DEFAULT_WA_TEMPLATES,
        enableEmailNotif:
          typeof rawCfg.enableEmailNotif === 'boolean'
            ? rawCfg.enableEmailNotif
            : DEFAULT_CONFIG.enableEmailNotif,
        emailSenderAlias: rawCfg.emailSenderAlias || DEFAULT_CONFIG.emailSenderAlias,
        emailSenderName: rawCfg.emailSenderName || DEFAULT_CONFIG.emailSenderName,
        emailTemplates:
          Array.isArray(rawCfg.emailTemplates) && rawCfg.emailTemplates.length > 0
            ? rawCfg.emailTemplates
            : DEFAULT_EMAIL_TEMPLATES,
      }
    : DEFAULT_CONFIG;

  return {
    config,
    donatur,
    transaksi,
    panitia,
  };
}

function getLocalState(): AppDataState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.LOCAL_DATA);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppDataState>;
      return normalizeLoadedState(parsed);
    }
  } catch {
    // Ignore malformed local state
  }
  return normalizeLoadedState();
}

function saveLocalState(state: AppDataState): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.LOCAL_DATA, JSON.stringify(state));
  } catch {
    try {
      const slimState: AppDataState = {
        ...state,
        transaksi: state.transaksi.map((t) => ({
          ...t,
          linkBuktiDrive: t.linkBuktiDrive.startsWith('data:') ? '' : t.linkBuktiDrive,
        })),
      };
      window.localStorage.setItem(STORAGE_KEYS.LOCAL_DATA, JSON.stringify(slimState));
    } catch {
      // Ignore if still full
    }
  }
}

function formatNowLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

async function callGasPost<T>(gasUrl: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  const response = await fetch(gasUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    redirect: 'follow',
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: ApiResult<T>;
  try {
    parsed = JSON.parse(text) as ApiResult<T>;
  } catch {
    throw new Error(
      'Respons layanan server tidak sesuai format. Periksa izin akses dan URL layanan sinkronisasi.'
    );
  }
  return parsed;
}

export async function pingGasConnection(
  gasUrl: string
): Promise<ApiResult<{ namaLembaga?: string; serverTime?: string }>> {
  const url = gasUrl.trim();
  if (!isValidGasUrl(url)) {
    return {
      status: 'error',
      message: 'URL layanan sinkronisasi harus diawali https://script.google.com/ dan diakhiri /exec.',
    };
  }
  try {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}action=ping`, {
      method: 'GET',
      redirect: 'follow',
    });
    const text = await response.text();
    return JSON.parse(text) as ApiResult<{ namaLembaga?: string; serverTime?: string }>;
  } catch (err) {
    return {
      status: 'error',
      message:
        err instanceof Error
          ? `Gagal menghubungi server: ${err.message}`
          : 'Gagal menghubungi server sinkronisasi.',
    };
  }
}

export async function fetchInitialData(gasUrl: string): Promise<ApiResult<AppDataState>> {
  const url = gasUrl.trim();
  if (!url) {
    return {
      status: 'success',
      message: 'Menggunakan penyimpanan lokal perangkat.',
      data: getLocalState(),
    };
  }

  try {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}action=getInitialData`, {
      method: 'GET',
      redirect: 'follow',
    });
    const text = await response.text();
    const parsed = JSON.parse(text) as ApiResult<AppDataState>;
    if (parsed.status === 'success' && parsed.data) {
      return {
        status: 'success',
        message: parsed.message || 'Data berhasil disinkronkan.',
        data: normalizeLoadedState(parsed.data),
      };
    }
    return parsed;
  } catch (err) {
    return {
      status: 'error',
      message:
        err instanceof Error
          ? `Gagal memuat data: ${err.message}`
          : 'Gagal memuat data dari server.',
    };
  }
}

export async function registerDonatur(
  gasUrl: string,
  payload: RegisterDonaturPayload
): Promise<
  ApiResult<{
    donatur?: Donatur;
    existingDonatur?: Partial<Donatur>;
    notifStatus?: NotifDeliveryResult;
  }>
> {
  const url = gasUrl.trim();
  if (url) {
    try {
      return await callGasPost<{
        donatur?: Donatur;
        existingDonatur?: Partial<Donatur>;
        notifStatus?: NotifDeliveryResult;
      }>(url, {
        action: 'registerDonatur',
        ...payload,
      });
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Gagal mendaftarkan donatur.',
      };
    }
  }

  const state = getLocalState();
  const waCheck = validateAndNormalizeWA(payload.noWa);
  if (!waCheck.valid) {
    return { status: 'error', message: waCheck.error };
  }

  const normalizedWa = waCheck.normalized;
  const duplicate = state.donatur.find(
    (d) => (validateAndNormalizeWA(d.noWa).normalized || d.noWa) === normalizedWa
  );
  if (duplicate) {
    return {
      status: 'error',
      code: 'DUPLICATE_WA',
      message: `Nomor WA ${normalizedWa} sudah terdaftar atas nama ${duplicate.namaLengkap} (ID: ${duplicate.idDonatur}).`,
      data: { existingDonatur: duplicate },
    };
  }

  const now = new Date();
  const ym = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const seq = String(state.donatur.length + 1).padStart(4, '0');
  const newDonatur: Donatur = {
    idDonatur: `DNR-${ym}-${seq}`,
    tanggalDaftar: formatNowLocal(),
    namaLengkap: payload.namaLengkap.trim(),
    jenisKelamin: normalizeJenisKelamin(payload.jenisKelamin),
    noWa: normalizedWa,
    email: (payload.email || '').trim(),
    kabId: (payload.kabId || '').trim(),
    domisili: (payload.domisili || '').trim(),
    provinsi: (payload.provinsi || '').trim(),
    pulau: (payload.pulau || '').trim(),
    nominalKomitmen: payload.nominalKomitmen,
    tglJatuhTempo: payload.tglJatuhTempo,
    metodeDaftar: payload.metodeDaftar,
    kodePerantara: (payload.kodePerantara || '').trim(),
    namaPerantara: payload.namaPerantara,
    statusAktif: 'Aktif',
  };

  state.donatur.push(newDonatur);
  saveLocalState(state);

  return {
    status: 'success',
    message: `Donatur ${newDonatur.namaLengkap} berhasil disimpan (Mode Lokal).`,
    data: {
      donatur: newDonatur,
      notifStatus: {
        wa: {
          attempted: false,
          ok: false,
          detail: 'Pengiriman WA otomatis hanya berjalan saat sinkronisasi aktif.',
        },
        email: {
          attempted: false,
          ok: false,
          detail: 'Pengiriman email otomatis hanya berjalan saat sinkronisasi aktif.',
        },
      },
    },
  };
}

export async function submitPembayaran(
  gasUrl: string,
  payload: SubmitPembayaranPayload
): Promise<ApiResult<{ transaksi?: TransaksiDonasi; savedFileName?: string }>> {
  const url = gasUrl.trim();
  if (url) {
    try {
      return await callGasPost<{ transaksi?: TransaksiDonasi; savedFileName?: string }>(url, {
        action: 'submitPembayaran',
        ...payload,
      });
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Gagal mengirim konfirmasi pembayaran.',
      };
    }
  }

  const state = getLocalState();
  const waCheck = validateAndNormalizeWA(payload.noWa);
  if (!waCheck.valid) {
    return { status: 'error', message: waCheck.error };
  }

  const ext = payload.fileMimeType.includes('pdf') ? 'pdf' : 'jpg';
  const savedFileName = previewAutoRenameFile({
    bulanTagihan: payload.bulanTagihan,
    namaDonatur: payload.namaDonatur,
    nominalTransfer: payload.nominalTransfer,
    extension: ext,
  });

  const now = new Date();
  const ymd = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const seq = String(state.transaksi.length + 1).padStart(3, '0');

  const newTrx: TransaksiDonasi = {
    idTransaksi: `TRX-${ymd}-${seq}`,
    waktuInput: formatNowLocal(),
    idDonatur: payload.idDonatur || '-',
    namaDonatur: payload.namaDonatur.trim(),
    noWa: waCheck.normalized,
    bulanTagihan: payload.bulanTagihan,
    nominalTransfer: payload.nominalTransfer,
    bankTujuan: payload.bankTujuan,
    linkBuktiDrive: payload.fileBase64,
    statusVerifikasi: 'Pending',
    diinputOleh: payload.diinputOleh || 'Donatur (Mandiri)',
    statusPenyaluran: 'Belum Disalurkan',
  };

  state.transaksi.push(newTrx);
  saveLocalState(state);

  return {
    status: 'success',
    message: 'Konfirmasi pembayaran berhasil dicatat (Mode Lokal) dan menunggu verifikasi.',
    data: { transaksi: newTrx, savedFileName },
  };
}

export async function verifikasiTransaksi(
  gasUrl: string,
  idTransaksi: string,
  status: StatusVerifikasi
): Promise<ApiResult<{ idTransaksi: string; statusVerifikasi: StatusVerifikasi }>> {
  const url = gasUrl.trim();
  if (url) {
    try {
      return await callGasPost<{ idTransaksi: string; statusVerifikasi: StatusVerifikasi }>(url, {
        action: 'verifikasiTransaksi',
        idTransaksi,
        status,
      });
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Gagal memperbarui verifikasi transaksi.',
      };
    }
  }

  const state = getLocalState();
  const idx = state.transaksi.findIndex((t) => t.idTransaksi === idTransaksi);
  if (idx === -1) {
    return { status: 'error', message: `Transaksi ${idTransaksi} tidak ditemukan.` };
  }
  state.transaksi[idx].statusVerifikasi = status;
  if (status === 'Ditolak') {
    state.transaksi[idx].statusPenyaluran = 'Belum Disalurkan';
  }
  saveLocalState(state);

  return {
    status: 'success',
    message: `Transaksi ${idTransaksi} berhasil diubah menjadi ${status}.`,
    data: { idTransaksi, statusVerifikasi: status },
  };
}

export async function updateStatusPenyaluran(
  gasUrl: string,
  idTransaksi: string,
  statusPenyaluran: StatusPenyaluran
): Promise<ApiResult<{ idTransaksi: string; statusPenyaluran: StatusPenyaluran }>> {
  const url = gasUrl.trim();
  if (url) {
    try {
      return await callGasPost<{ idTransaksi: string; statusPenyaluran: StatusPenyaluran }>(url, {
        action: 'updateStatusPenyaluran',
        idTransaksi,
        statusPenyaluran,
      });
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Gagal memperbarui status penyaluran.',
      };
    }
  }

  const state = getLocalState();
  const idx = state.transaksi.findIndex((t) => t.idTransaksi === idTransaksi);
  if (idx === -1) {
    return { status: 'error', message: `Transaksi ${idTransaksi} tidak ditemukan.` };
  }
  state.transaksi[idx].statusPenyaluran = statusPenyaluran;
  saveLocalState(state);

  return {
    status: 'success',
    message: `Status penyaluran ${idTransaksi} diubah menjadi ${statusPenyaluran}.`,
    data: { idTransaksi, statusPenyaluran },
  };
}

export async function updateStatusDonatur(
  gasUrl: string,
  idDonatur: string,
  status: StatusAktif
): Promise<ApiResult<{ idDonatur: string; statusAktif: StatusAktif }>> {
  const url = gasUrl.trim();
  if (url) {
    try {
      return await callGasPost<{ idDonatur: string; statusAktif: StatusAktif }>(url, {
        action: 'updateStatusDonatur',
        idDonatur,
        status,
      });
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Gagal memperbarui status donatur.',
      };
    }
  }

  const state = getLocalState();
  const idx = state.donatur.findIndex((d) => d.idDonatur === idDonatur);
  if (idx === -1) {
    return { status: 'error', message: `Donatur ${idDonatur} tidak ditemukan.` };
  }
  state.donatur[idx].statusAktif = status;
  saveLocalState(state);

  return {
    status: 'success',
    message: `Status donatur ${idDonatur} diubah menjadi ${status}.`,
    data: { idDonatur, statusAktif: status },
  };
}

export async function savePengaturan(
  gasUrl: string,
  payload: SavePengaturanPayload
): Promise<ApiResult<{ config: LembagaConfig }>> {
  const url = gasUrl.trim();
  if (url) {
    try {
      return await callGasPost<{ config: LembagaConfig }>(url, {
        action: 'savePengaturan',
        ...payload,
      });
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan pengaturan ke server.',
      };
    }
  }

  const state = getLocalState();
  const updatedConfig: LembagaConfig = {
    namaLembaga: payload.namaLembaga.trim() || DEFAULT_CONFIG.namaLembaga,
    tagline: payload.tagline.trim() || DEFAULT_CONFIG.tagline,
    logoUrl: payload.logoBase64 || payload.logoUrl || '',
    qrisUrl: payload.qrisBase64 || payload.qrisUrl || '',
    qrisMerchantName: payload.qrisMerchantName.trim(),
    showQris: payload.showQris,
    defaultNominal: payload.defaultNominal > 0 ? payload.defaultNominal : 50000,
    defaultTglPengingat:
      payload.defaultTglPengingat >= 1 && payload.defaultTglPengingat <= 31
        ? payload.defaultTglPengingat
        : 5,
    catatanPembayaran: payload.catatanPembayaran.trim(),
    infoRekening: payload.infoRekening.length > 0 ? payload.infoRekening : DEFAULT_CONFIG.infoRekening,
    enableWaNotif: payload.enableWaNotif,
    waEndpointUrl: payload.waEndpointUrl.trim() || DEFAULT_CONFIG.waEndpointUrl,
    waApiKey: payload.waApiKey.trim(),
    waTemplates:
      payload.waTemplates.filter((t) => t.trim() !== '').length > 0
        ? payload.waTemplates.filter((t) => t.trim() !== '')
        : DEFAULT_WA_TEMPLATES,
    enableEmailNotif: payload.enableEmailNotif,
    emailSenderAlias: payload.emailSenderAlias.trim() || DEFAULT_CONFIG.emailSenderAlias,
    emailSenderName: payload.emailSenderName.trim() || DEFAULT_CONFIG.emailSenderName,
    emailTemplates:
      payload.emailTemplates.filter((t) => t.subject.trim() !== '' && t.body.trim() !== '').length > 0
        ? payload.emailTemplates.filter((t) => t.subject.trim() !== '' && t.body.trim() !== '')
        : DEFAULT_EMAIL_TEMPLATES,
  };
  state.config = updatedConfig;
  saveLocalState(state);

  return {
    status: 'success',
    message: 'Pengaturan aplikasi berhasil disimpan (Mode Lokal).',
    data: { config: updatedConfig },
  };
}

export async function sendTestNotification(
  gasUrl: string,
  payload: TestNotificationPayload
): Promise<ApiResult<{ notifStatus: NotifDeliveryResult }>> {
  const url = gasUrl.trim();
  if (!url) {
    return {
      status: 'error',
      message: 'Uji kirim notifikasi WA & Email memerlukan koneksi layanan sinkronisasi aktif.',
    };
  }
  try {
    return await callGasPost<{ notifStatus: NotifDeliveryResult }>(url, {
      action: 'testNotification',
      ...payload,
    });
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Gagal mengirim tes notifikasi.',
    };
  }
}

export async function savePanitia(
  gasUrl: string,
  panitia: Panitia
): Promise<ApiResult<{ panitia: Panitia[] }>> {
  const url = gasUrl.trim();
  if (url) {
    try {
      return await callGasPost<{ panitia: Panitia[] }>(url, {
        action: 'savePanitia',
        ...panitia,
      });
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan data pengurus.',
      };
    }
  }

  const state = getLocalState();
  const kode = panitia.kodePanitia.trim().toUpperCase();
  const waCheck = validateAndNormalizeWA(panitia.noWaPanitia);
  const normalized: Panitia = {
    kodePanitia: kode,
    namaPanitia: panitia.namaPanitia.trim(),
    jenisKelamin: normalizeJenisKelamin(panitia.jenisKelamin),
    noWaPanitia: waCheck.valid ? waCheck.normalized : panitia.noWaPanitia.trim(),
    role: normalizeRoleLabel(panitia.role),
  };

  const idx = state.panitia.findIndex((p) => p.kodePanitia.toUpperCase() === kode);
  if (idx >= 0) {
    state.panitia[idx] = normalized;
  } else {
    state.panitia.push(normalized);
  }
  saveLocalState(state);

  return {
    status: 'success',
    message: `Pengurus ${normalized.namaPanitia} berhasil disimpan (Mode Lokal).`,
    data: { panitia: state.panitia },
  };
}

export async function deletePanitia(
  gasUrl: string,
  kodePanitia: string
): Promise<ApiResult<{ panitia: Panitia[] }>> {
  const url = gasUrl.trim();
  if (url) {
    try {
      return await callGasPost<{ panitia: Panitia[] }>(url, {
        action: 'deletePanitia',
        kodePanitia,
      });
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Gagal menghapus data pengurus.',
      };
    }
  }

  const state = getLocalState();
  state.panitia = state.panitia.filter(
    (p) => p.kodePanitia.toUpperCase() !== kodePanitia.trim().toUpperCase()
  );
  saveLocalState(state);

  return {
    status: 'success',
    message: `Pengurus ${kodePanitia} berhasil dihapus (Mode Lokal).`,
    data: { panitia: state.panitia },
  };
}
