import {
  DEFAULT_CONFIG,
  DEFAULT_EMAIL_TEMPLATE_DAFTAR,
  DEFAULT_EMAIL_TEMPLATE_REMINDER,
  DEFAULT_GAS_URL,
  DEFAULT_LOGO_URL,
  DEFAULT_PANITIA,
  DEFAULT_WA_FOLLOWUP_TEMPLATES,
  DEFAULT_WA_REMINDER_TEMPLATES,
  DEFAULT_WA_TEMPLATES,
  STORAGE_KEYS,
  TRANSFER_MIN_DATE,
} from '../config';
import {
  ApiResult,
  AppDataState,
  Donatur,
  LembagaConfig,
  MinatGrupWa,
  NotifDeliveryResult,
  Panitia,
  QueueStatus,
  RegisterDonaturPayload,
  SavePengaturanPayload,
  ScheduleBroadcastItemPayload,
  ScheduledMessageItem,
  SendBroadcastSinglePayload,
  StatusAktif,
  StatusGrupWa,
  StatusPenyaluran,
  StatusVerifikasi,
  SubmitPembayaranPayload,
  TestNotificationPayload,
  TransaksiDonasi,
} from '../types';
import {
  extractIsoDateFromDateStr,
  getTodayIsoDate,
  normalizeJenisKelamin,
  normalizeMinatGrup,
  normalizeRoleLabel,
  normalizeStatusGrup,
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
    ? raw!.transaksi.map((t) => {
        const nominalTransfer = Number(t.nominalTransfer) || 0;
        const donasiLainnya = Math.max(0, Number(t.donasiLainnya) || 0);
        const nominalKomitmen =
          Number(t.nominalKomitmen) > 0
            ? Number(t.nominalKomitmen)
            : Math.max(0, nominalTransfer - donasiLainnya);
        const tanggalTransfer =
          extractIsoDateFromDateStr(t.tanggalTransfer) ||
          extractIsoDateFromDateStr(t.waktuInput) ||
          '';

        return {
          ...t,
          tanggalTransfer,
          nominalKomitmen,
          donasiLainnya,
          nominalTransfer,
          bankTujuan: t.bankTujuan || '',
          linkBuktiDrive: t.linkBuktiDrive || '',
          keterangan: t.keterangan || '',
          statusPenyaluran: (t.statusPenyaluran === 'Sudah Disalurkan'
            ? 'Sudah Disalurkan'
            : 'Belum Disalurkan') as StatusPenyaluran,
        };
      })
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
        minatGrupWa: normalizeMinatGrup(d.minatGrupWa),
        statusGrupWa: normalizeStatusGrup(d.statusGrupWa),
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

  const antreanPesan: ScheduledMessageItem[] = Array.isArray(raw?.antreanPesan)
    ? raw!.antreanPesan.map((a) => ({
        idAntrean: String(a.idAntrean || ''),
        waktuBuat: String(a.waktuBuat || ''),
        jadwalKirim: String(a.jadwalKirim || ''),
        jenisPesan: String(a.jenisPesan || 'Broadcast'),
        idDonatur: String(a.idDonatur || ''),
        namaDonatur: String(a.namaDonatur || ''),
        noWa: String(a.noWa || ''),
        isiPesan: String(a.isiPesan || ''),
        mediaUrl: String(a.mediaUrl || ''),
        status: (['Menunggu', 'Terkirim', 'Gagal', 'Dibatalkan'].includes(a.status)
          ? a.status
          : 'Menunggu') as QueueStatus,
        keteranganHasil: String(a.keteranganHasil || ''),
        waktuTerkirim: String(a.waktuTerkirim || ''),
      }))
    : [];

  const rawCfg = raw?.config;
  const emailDaftar =
    rawCfg?.emailTemplateDaftar?.subject && rawCfg?.emailTemplateDaftar?.body
      ? rawCfg.emailTemplateDaftar
      : Array.isArray(rawCfg?.emailTemplates) &&
        rawCfg!.emailTemplates[0]?.subject &&
        rawCfg!.emailTemplates[0]?.body
      ? rawCfg!.emailTemplates[0]
      : DEFAULT_EMAIL_TEMPLATE_DAFTAR;

  const emailReminder =
    rawCfg?.emailTemplateReminder?.subject && rawCfg?.emailTemplateReminder?.body
      ? rawCfg.emailTemplateReminder
      : DEFAULT_EMAIL_TEMPLATE_REMINDER;

  const config: LembagaConfig = rawCfg
    ? {
        ...DEFAULT_CONFIG,
        ...rawCfg,
        logoUrl: rawCfg.logoUrl || DEFAULT_LOGO_URL,
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
        waFollowupTemplates:
          Array.isArray(rawCfg.waFollowupTemplates) && rawCfg.waFollowupTemplates.length > 0
            ? rawCfg.waFollowupTemplates
            : DEFAULT_WA_FOLLOWUP_TEMPLATES,
        waFollowupDelaySec:
          Number(rawCfg.waFollowupDelaySec) >= 15 && Number(rawCfg.waFollowupDelaySec) <= 600
            ? Math.round(Number(rawCfg.waFollowupDelaySec))
            : DEFAULT_CONFIG.waFollowupDelaySec,
        waReminderTemplates:
          Array.isArray(rawCfg.waReminderTemplates) && rawCfg.waReminderTemplates.length > 0
            ? rawCfg.waReminderTemplates
            : DEFAULT_WA_REMINDER_TEMPLATES,
        waGroupName: rawCfg.waGroupName || DEFAULT_CONFIG.waGroupName,
        waGroupLink: rawCfg.waGroupLink || '',
        waGroupId: rawCfg.waGroupId || '',
        enableEmailNotif:
          typeof rawCfg.enableEmailNotif === 'boolean'
            ? rawCfg.enableEmailNotif
            : DEFAULT_CONFIG.enableEmailNotif,
        emailSenderAlias: rawCfg.emailSenderAlias || DEFAULT_CONFIG.emailSenderAlias,
        emailSenderName: rawCfg.emailSenderName || DEFAULT_CONFIG.emailSenderName,
        emailTemplateDaftar: emailDaftar,
        emailTemplateReminder: emailReminder,
        emailTemplates: [emailDaftar, emailReminder],
      }
    : DEFAULT_CONFIG;

  return {
    config,
    donatur,
    transaksi,
    panitia,
    antreanPesan,
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

function generateLocalDonaturId(existingDonatur: Donatur[], now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const prefix = `DK${String(now.getFullYear()).slice(-2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  let maxSeq = 0;
  existingDonatur.forEach((d) => {
    const id = String(d.idDonatur || '').trim().toUpperCase();
    if (id.startsWith(prefix)) {
      const suffix = id.slice(prefix.length);
      const parsed = parseInt(suffix, 10);
      if (Number.isFinite(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  });
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
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
  const newDonatur: Donatur = {
    idDonatur: generateLocalDonaturId(state.donatur, now),
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
    minatGrupWa: normalizeMinatGrup(payload.minatGrupWa),
    statusGrupWa: 'Belum Bergabung',
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
        waFollowup: {
          attempted: false,
          ok: false,
          detail: 'Pesan arahan save nomor (jeda 1 menit) hanya berjalan saat sinkronisasi aktif.',
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
): Promise<
  ApiResult<{
    transaksi?: TransaksiDonasi;
    transaksiList?: TransaksiDonasi[];
    savedFileName?: string;
  }>
> {
  const url = gasUrl.trim();
  if (url) {
    try {
      return await callGasPost<{
        transaksi?: TransaksiDonasi;
        transaksiList?: TransaksiDonasi[];
        savedFileName?: string;
      }>(url, {
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

  const todayIso = getTodayIsoDate();
  const tglTransfer = extractIsoDateFromDateStr(payload.tanggalTransfer) || todayIso;
  if (tglTransfer < TRANSFER_MIN_DATE) {
    return {
      status: 'error',
      message: `Tanggal transfer tidak boleh sebelum ${TRANSFER_MIN_DATE}.`,
    };
  }
  if (tglTransfer > todayIso) {
    return {
      status: 'error',
      message: 'Tanggal transfer tidak boleh melebihi tanggal hari ini.',
    };
  }

  const rawMonths =
    Array.isArray(payload.bulanTagihanList) && payload.bulanTagihanList.length > 0
      ? payload.bulanTagihanList
      : [payload.bulanTagihan];
  const months = Array.from(new Set(rawMonths.filter((m) => /^\d{4}-\d{2}$/.test(m)))).sort();
  if (months.length === 0) {
    return { status: 'error', message: 'Pilih minimal 1 bulan tagihan yang valid.' };
  }

  const hasFile = Boolean(payload.fileBase64);
  const ext = payload.fileMimeType?.includes('pdf') ? 'pdf' : 'jpg';
  const savedFileName = hasFile
    ? previewAutoRenameFile({
        tanggalTransfer: tglTransfer,
        bulanTagihan: months[0],
        bulanList: months,
        namaDonatur: payload.namaDonatur,
        nominalTransfer: payload.nominalTransfer,
        extension: ext,
      })
    : undefined;

  const now = new Date();
  const ymd = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const baseSeq = state.transaksi.length + 1;
  const totalRp = Math.round(payload.nominalTransfer);

  const matchedDonor = state.donatur.find((d) => d.idDonatur === payload.idDonatur);
  const komitmenPerBulan = Math.max(
    0,
    Math.round(payload.nominalKomitmenPerBulan ?? matchedDonor?.nominalKomitmen ?? 0)
  );
  const totalKomitmenExpected = komitmenPerBulan * months.length;
  const hasExcess = komitmenPerBulan > 0 && totalRp > totalKomitmenExpected;
  const totalDonasiLainnya = hasExcess ? totalRp - totalKomitmenExpected : 0;

  const basePerMonth = Math.floor(totalRp / months.length);
  const remainder = totalRp % months.length;

  const userNote = (payload.keterangan || '').trim();
  const batchNote =
    months.length > 1
      ? `Bayar sekaligus ${months.length} bln (Total Rp ${totalRp.toLocaleString('id-ID')})`
      : '';
  const excessNote =
    totalDonasiLainnya > 0
      ? `Termasuk Donasi Lainnya Rp ${totalDonasiLainnya.toLocaleString('id-ID')}`
      : '';
  const finalKeterangan = [userNote, batchNote, excessNote].filter(Boolean).join(' · ');

  const createdRows: TransaksiDonasi[] = months.map((bulan, idx) => {
    const seq = String(baseSeq + idx).padStart(3, '0');
    const nominalKomitmenBulan = hasExcess
      ? komitmenPerBulan
      : basePerMonth + (idx < remainder ? 1 : 0);
    const donasiLainnyaBulan = hasExcess && idx === 0 ? totalDonasiLainnya : 0;
    const nominalTransferBulan = nominalKomitmenBulan + donasiLainnyaBulan;

    return {
      idTransaksi: `TRX-${ymd}-${seq}`,
      waktuInput: formatNowLocal(),
      tanggalTransfer: tglTransfer,
      idDonatur: payload.idDonatur || '-',
      namaDonatur: payload.namaDonatur.trim(),
      noWa: waCheck.normalized,
      bulanTagihan: bulan,
      nominalKomitmen: nominalKomitmenBulan,
      donasiLainnya: donasiLainnyaBulan,
      nominalTransfer: nominalTransferBulan,
      bankTujuan: payload.bankTujuan || '',
      linkBuktiDrive: payload.fileBase64 || '',
      statusVerifikasi: 'Pending',
      diinputOleh: payload.diinputOleh || 'Donatur (Mandiri)',
      statusPenyaluran: 'Belum Disalurkan',
      keterangan: finalKeterangan,
    };
  });

  state.transaksi.push(...createdRows);
  saveLocalState(state);

  return {
    status: 'success',
    message:
      createdRows.length > 1
        ? `Konfirmasi pembayaran untuk ${createdRows.length} bulan berhasil dicatat (Mode Lokal) dan menunggu verifikasi.`
        : 'Konfirmasi pembayaran berhasil dicatat (Mode Lokal) dan menunggu verifikasi.',
    data: {
      transaksi: createdRows[0],
      transaksiList: createdRows,
      savedFileName,
    },
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

export async function updateStatusGrupDonatur(
  gasUrl: string,
  idDonatur: string,
  statusGrupWa: StatusGrupWa,
  minatGrupWa?: MinatGrupWa
): Promise<ApiResult<{ idDonatur: string; statusGrupWa: StatusGrupWa; minatGrupWa?: MinatGrupWa }>> {
  const url = gasUrl.trim();
  if (url) {
    try {
      return await callGasPost<{
        idDonatur: string;
        statusGrupWa: StatusGrupWa;
        minatGrupWa?: MinatGrupWa;
      }>(url, {
        action: 'updateStatusGrupDonatur',
        idDonatur,
        statusGrupWa,
        minatGrupWa,
      });
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Gagal memperbarui status grup WA.',
      };
    }
  }

  const state = getLocalState();
  const idx = state.donatur.findIndex((d) => d.idDonatur === idDonatur);
  if (idx === -1) {
    return { status: 'error', message: `Donatur ${idDonatur} tidak ditemukan.` };
  }
  state.donatur[idx].statusGrupWa = statusGrupWa;
  if (minatGrupWa) {
    state.donatur[idx].minatGrupWa = minatGrupWa;
  }
  saveLocalState(state);

  return {
    status: 'success',
    message: `Status grup WA donatur ${idDonatur} diperbarui menjadi ${statusGrupWa}.`,
    data: { idDonatur, statusGrupWa, minatGrupWa: state.donatur[idx].minatGrupWa },
  };
}

export async function bulkUpdateStatusGrupDonatur(
  gasUrl: string,
  ids: string[],
  statusGrupWa: StatusGrupWa
): Promise<ApiResult<{ updatedIds: string[]; statusGrupWa: StatusGrupWa }>> {
  const url = gasUrl.trim();
  if (url) {
    try {
      return await callGasPost<{ updatedIds: string[]; statusGrupWa: StatusGrupWa }>(url, {
        action: 'bulkUpdateStatusGrupDonatur',
        ids,
        statusGrupWa,
      });
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Gagal memperbarui status grup massal.',
      };
    }
  }

  const idSet = new Set(ids);
  const state = getLocalState();
  const updatedIds: string[] = [];
  state.donatur = state.donatur.map((d) => {
    if (idSet.has(d.idDonatur)) {
      updatedIds.push(d.idDonatur);
      return { ...d, statusGrupWa };
    }
    return d;
  });
  saveLocalState(state);

  return {
    status: 'success',
    message: `${updatedIds.length} donatur berhasil diperbarui menjadi ${statusGrupWa}.`,
    data: { updatedIds, statusGrupWa },
  };
}

export async function sendBroadcastSingle(
  gasUrl: string,
  payload: SendBroadcastSinglePayload
): Promise<ApiResult<{ ok: boolean; detail: string; emailDetail?: string }>> {
  const url = gasUrl.trim();
  if (!url) {
    return {
      status: 'error',
      message: 'Kirim broadcast otomatis memerlukan sinkronisasi layanan aktif. Gunakan opsi Salin Teks atau Buka wa.me untuk mode lokal.',
    };
  }
  try {
    return await callGasPost<{ ok: boolean; detail: string; emailDetail?: string }>(url, {
      action: 'sendBroadcastSingle',
      ...payload,
    });
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Gagal mengirim pesan broadcast.',
    };
  }
}

export async function scheduleWaBroadcast(
  gasUrl: string,
  items: ScheduleBroadcastItemPayload[]
): Promise<ApiResult<{ queuedCount: number; antreanPesan: ScheduledMessageItem[] }>> {
  const url = gasUrl.trim();
  if (url) {
    try {
      return await callGasPost<{ queuedCount: number; antreanPesan: ScheduledMessageItem[] }>(url, {
        action: 'scheduleBroadcast',
        items,
      });
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Gagal menjadwalkan broadcast.',
      };
    }
  }

  const state = getLocalState();
  const nowStr = formatNowLocal();
  const existing = state.antreanPesan || [];
  const created: ScheduledMessageItem[] = items.map((item, idx) => ({
    idAntrean: `MSG-${Date.now()}-${String(idx + 1).padStart(3, '0')}`,
    waktuBuat: nowStr,
    jadwalKirim: item.jadwalKirim,
    jenisPesan: item.jenisPesan || 'Broadcast',
    idDonatur: item.idDonatur,
    namaDonatur: item.namaDonatur,
    noWa: item.noWa,
    isiPesan: item.isiPesan,
    mediaUrl: item.mediaUrl || '',
    status: 'Menunggu',
    keteranganHasil: 'Tersimpan lokal (aktifkan sinkronisasi agar terkirim otomatis).',
    waktuTerkirim: '',
  }));
  state.antreanPesan = [...created, ...existing];
  saveLocalState(state);

  return {
    status: 'success',
    message: `${created.length} pesan ditambahkan ke daftar jadwal (Mode Lokal).`,
    data: { queuedCount: created.length, antreanPesan: state.antreanPesan },
  };
}

export async function processScheduledQueue(
  gasUrl: string
): Promise<ApiResult<{ processedCount: number; antreanPesan: ScheduledMessageItem[] }>> {
  const url = gasUrl.trim();
  if (!url) {
    return {
      status: 'error',
      message: 'Pemrosesan antrean otomatis memerlukan layanan sinkronisasi aktif.',
    };
  }
  try {
    return await callGasPost<{ processedCount: number; antreanPesan: ScheduledMessageItem[] }>(
      url,
      { action: 'processQueue' }
    );
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Gagal memproses antrean terjadwal.',
    };
  }
}

export async function cancelScheduledMessage(
  gasUrl: string,
  idAntrean: string
): Promise<ApiResult<{ idAntrean: string; antreanPesan?: ScheduledMessageItem[] }>> {
  const url = gasUrl.trim();
  if (url) {
    try {
      return await callGasPost<{ idAntrean: string; antreanPesan?: ScheduledMessageItem[] }>(url, {
        action: 'cancelScheduledMessage',
        idAntrean,
      });
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Gagal membatalkan antrean pesan.',
      };
    }
  }

  const state = getLocalState();
  state.antreanPesan = (state.antreanPesan || []).map((item) =>
    item.idAntrean === idAntrean
      ? { ...item, status: 'Dibatalkan' as QueueStatus, keteranganHasil: 'Dibatalkan pengurus.' }
      : item
  );
  saveLocalState(state);

  return {
    status: 'success',
    message: `Antrean ${idAntrean} dibatalkan.`,
    data: { idAntrean, antreanPesan: state.antreanPesan },
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
  const cleanWaTemplates = payload.waTemplates.map((t) => t.trim()).filter(Boolean);
  const cleanFollowupTemplates = payload.waFollowupTemplates.map((t) => t.trim()).filter(Boolean);
  const cleanReminderTemplates = payload.waReminderTemplates.map((t) => t.trim()).filter(Boolean);

  const emailDaftar =
    payload.emailTemplateDaftar?.subject.trim() && payload.emailTemplateDaftar?.body.trim()
      ? {
          subject: payload.emailTemplateDaftar.subject.trim(),
          body: payload.emailTemplateDaftar.body.trim(),
        }
      : DEFAULT_EMAIL_TEMPLATE_DAFTAR;

  const emailReminder =
    payload.emailTemplateReminder?.subject.trim() && payload.emailTemplateReminder?.body.trim()
      ? {
          subject: payload.emailTemplateReminder.subject.trim(),
          body: payload.emailTemplateReminder.body.trim(),
        }
      : DEFAULT_EMAIL_TEMPLATE_REMINDER;

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
    infoRekening:
      payload.infoRekening.length > 0 ? payload.infoRekening : DEFAULT_CONFIG.infoRekening,
    enableWaNotif: payload.enableWaNotif,
    waEndpointUrl: payload.waEndpointUrl.trim() || DEFAULT_CONFIG.waEndpointUrl,
    waApiKey: payload.waApiKey.trim(),
    waTemplates: cleanWaTemplates.length > 0 ? cleanWaTemplates : DEFAULT_WA_TEMPLATES,
    waFollowupTemplates:
      cleanFollowupTemplates.length > 0
        ? cleanFollowupTemplates
        : DEFAULT_WA_FOLLOWUP_TEMPLATES,
    waFollowupDelaySec:
      payload.waFollowupDelaySec >= 15 && payload.waFollowupDelaySec <= 600
        ? Math.round(payload.waFollowupDelaySec)
        : 60,
    waReminderTemplates:
      cleanReminderTemplates.length > 0
        ? cleanReminderTemplates
        : DEFAULT_WA_REMINDER_TEMPLATES,
    waGroupName: payload.waGroupName.trim() || DEFAULT_CONFIG.waGroupName,
    waGroupLink: payload.waGroupLink.trim(),
    waGroupId: payload.waGroupId.trim(),
    enableEmailNotif: payload.enableEmailNotif,
    emailSenderAlias: payload.emailSenderAlias.trim() || DEFAULT_CONFIG.emailSenderAlias,
    emailSenderName: payload.emailSenderName.trim() || DEFAULT_CONFIG.emailSenderName,
    emailTemplateDaftar: emailDaftar,
    emailTemplateReminder: emailReminder,
    emailTemplates: [emailDaftar, emailReminder],
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
