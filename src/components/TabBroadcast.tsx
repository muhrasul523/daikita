import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Mail,
  MessageCircle,
  Play,
  RefreshCw,
  Search,
  Send,
  Square,
  XCircle,
} from 'lucide-react';
import { WILAYAH_KABUPATEN } from '../data/wilayah';
import {
  DEFAULT_WA_FOLLOWUP_TEMPLATES,
  DEFAULT_WA_REMINDER_TEMPLATES,
  DEFAULT_WA_TEMPLATES,
} from '../config';
import {
  Donatur,
  LembagaConfig,
  PageSizeOption,
  ScheduleBroadcastItemPayload,
  ScheduledMessageItem,
  SendBroadcastSinglePayload,
  StatusAktif,
  StatusBayarBulan,
  TransaksiDonasi,
} from '../types';
import {
  buildGroupInviteMessage,
  buildWaMeUrl,
  formatBulanLabel,
  formatRupiah,
  formatWADisplay,
  getCurrentYearMonth,
  getDriveThumbnailFallback,
  normalizeDriveImageUrl,
  normalizeMinatGrup,
  normalizeStatusGrup,
  normalizeWA,
  renderMessageTemplate,
} from '../utils/formatters';
import { PaginationBar, slicePaginated } from './PaginationBar';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

interface TabBroadcastProps {
  config: LembagaConfig;
  donaturList: Donatur[];
  transaksiList: TransaksiDonasi[];
  antreanPesan: ScheduledMessageItem[];
  connectionStatus: 'connected' | 'local' | 'error';
  onSendBroadcastSingle: (
    payload: SendBroadcastSinglePayload
  ) => Promise<{ ok: boolean; detail: string; emailDetail?: string }>;
  onScheduleBroadcast: (items: ScheduleBroadcastItemPayload[]) => Promise<boolean>;
  onProcessQueue: () => Promise<boolean>;
  onCancelScheduled: (idAntrean: string) => Promise<boolean>;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

type BroadcastMessageKind = 'reminder' | 'daftar' | 'followup' | 'grup_wa' | 'custom';
type QueueSortField = 'jadwal' | 'nama' | 'jenis' | 'status';

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatServerScheduleStr(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const DELAY_PRESETS = [5, 10, 20, 30, 60];

export const TabBroadcast: React.FC<TabBroadcastProps> = ({
  config,
  donaturList,
  transaksiList,
  antreanPesan,
  connectionStatus,
  onSendBroadcastSingle,
  onScheduleBroadcast,
  onProcessQueue,
  onCancelScheduled,
  onNotify,
}) => {
  // Filter Penerima
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [bayarFilter, setBayarFilter] = useState<'Semua' | StatusBayarBulan>('Belum Bayar');
  const [aktifFilter, setAktifFilter] = useState<'Semua' | StatusAktif>('Aktif');
  const [tglFilter, setTglFilter] = useState<string>('Semua');
  const [genderFilter, setGenderFilter] = useState<'Semua' | 'Laki-laki' | 'Perempuan'>('Semua');
  const [grupFilter, setGrupFilter] = useState<'Semua' | 'Minat Belum Gabung' | 'Sudah Bergabung'>(
    'Semua'
  );
  const [pulauFilter, setPulauFilter] = useState('');
  const [provinsiFilter, setProvinsiFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [donorPage, setDonorPage] = useState(1);
  const [donorPageSize, setDonorPageSize] = useState<PageSizeOption>(10);
  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState<PageSizeOption>(10);

  // Pengaturan Pesan & Jadwal
  const [messageKind, setMessageKind] = useState<BroadcastMessageKind>('reminder');
  const [rotateTemplates, setRotateTemplates] = useState<boolean>(true);
  const [fixedTemplateIdx, setFixedTemplateIdx] = useState<number>(0);
  const [customMessageText, setCustomMessageText] = useState<string>(
    `Assalamu'alaikum {sapaan} *{nama}*,\n\nSemoga {sapaan} sekeluarga senantiasa dalam lindungan dan keberkahan Allah Subhanahu wa Ta'ala.\n\n_Syukran wa jazakumullahu khairan._`
  );
  const [attachQris, setAttachQris] = useState<boolean>(
    Boolean(config.showQris && config.qrisUrl)
  );
  const [alsoSendEmail, setAlsoSendEmail] = useState<boolean>(false);
  const [delaySeconds, setDelaySeconds] = useState<number>(10);
  const [sendMode, setSendMode] = useState<'now' | 'scheduled'>('now');
  const [scheduleDatetime, setScheduleDatetime] = useState<string>(() => {
    const d = new Date(Date.now() + 10 * 60 * 1000);
    return toLocalDatetimeInputValue(d);
  });
  const [previewDonorId, setPreviewDonorId] = useState<string>('');
  const [copiedPreview, setCopiedPreview] = useState(false);

  // Live Broadcast Execution State
  const [isSendingLive, setIsSendingLive] = useState(false);
  const [liveProgress, setLiveProgress] = useState<{
    current: number;
    total: number;
    sent: number;
    failed: number;
    currentName: string;
    countdownSec: number;
  } | null>(null);
  const [liveLogs, setLiveLogs] = useState<
    { idDonatur: string; nama: string; ok: boolean; detail: string }[]
  >([]);
  const stopLiveRef = useRef(false);

  // Scheduled Queue UI State
  const [isScheduling, setIsScheduling] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [queueSortField, setQueueSortField] = useState<QueueSortField>('jadwal');
  const [queueSortDir, setQueueSortDir] = useState<'asc' | 'desc'>('desc');
  const [qrisPreviewSrc, setQrisPreviewSrc] = useState(() =>
    normalizeDriveImageUrl(config.qrisUrl)
  );

  // Peta Status Bayar untuk bulan terpilih (O(N+M) menggunakan Map)
  const donorStatusMap = useMemo(() => {
    const map = new Map<string, StatusBayarBulan>();
    const validIdSet = new Set<string>();
    const validWaSet = new Set<string>();
    const pendingIdSet = new Set<string>();
    const pendingWaSet = new Set<string>();

    transaksiList.forEach((t) => {
      if (t.bulanTagihan !== selectedMonth) return;
      const normWa = normalizeWA(t.noWa) || t.noWa;
      if (t.statusVerifikasi === 'Valid') {
        if (t.idDonatur && t.idDonatur !== '-') validIdSet.add(t.idDonatur);
        if (normWa) validWaSet.add(normWa);
      } else if (t.statusVerifikasi === 'Pending') {
        if (t.idDonatur && t.idDonatur !== '-') pendingIdSet.add(t.idDonatur);
        if (normWa) pendingWaSet.add(normWa);
      }
    });

    donaturList.forEach((d) => {
      const donorWa = normalizeWA(d.noWa) || d.noWa;
      if ((d.idDonatur && validIdSet.has(d.idDonatur)) || (donorWa && validWaSet.has(donorWa))) {
        map.set(d.idDonatur, 'Lunas');
      } else if (
        (d.idDonatur && pendingIdSet.has(d.idDonatur)) ||
        (donorWa && pendingWaSet.has(donorWa))
      ) {
        map.set(d.idDonatur, 'Menunggu Verifikasi');
      } else {
        map.set(d.idDonatur, 'Belum Bayar');
      }
    });
    return map;
  }, [donaturList, transaksiList, selectedMonth]);

  const pulauOptions = useMemo<SearchableOption[]>(() => {
    const set = new Set<string>();
    WILAYAH_KABUPATEN.forEach((w) => set.add(w.pulau));
    return Array.from(set).map((p) => ({ value: p, label: p, keywords: p }));
  }, []);

  const provinsiOptions = useMemo<SearchableOption[]>(() => {
    const set = new Set<string>();
    WILAYAH_KABUPATEN.forEach((w) => {
      if (pulauFilter && w.pulau !== pulauFilter) return;
      set.add(w.prov);
    });
    return Array.from(set).map((p) => ({ value: p, label: p, keywords: p }));
  }, [pulauFilter]);

  const tglOptions = useMemo<SearchableOption[]>(
    () => [
      { value: 'Semua', label: 'Tgl Pengingat: Semua', keywords: 'semua' },
      ...Array.from({ length: 31 }, (_, i) => ({
        value: String(i + 1),
        label: `Tanggal ${i + 1}`,
        keywords: `${i + 1} tgl ${i + 1}`,
      })),
    ],
    []
  );

  const filteredDonors = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return donaturList.filter((d) => {
      const st = donorStatusMap.get(d.idDonatur) || 'Belum Bayar';
      if (bayarFilter !== 'Semua' && st !== bayarFilter) return false;
      if (aktifFilter !== 'Semua' && d.statusAktif !== aktifFilter) return false;
      if (tglFilter !== 'Semua' && String(d.tglJatuhTempo) !== tglFilter) return false;
      if (genderFilter !== 'Semua' && d.jenisKelamin !== genderFilter) return false;
      if (pulauFilter && d.pulau !== pulauFilter) return false;
      if (provinsiFilter && d.provinsi !== provinsiFilter) return false;

      if (grupFilter === 'Minat Belum Gabung') {
        if (
          !(
            normalizeMinatGrup(d.minatGrupWa) === 'Ya' &&
            normalizeStatusGrup(d.statusGrupWa) !== 'Sudah Bergabung'
          )
        ) {
          return false;
        }
      } else if (grupFilter === 'Sudah Bergabung') {
        if (normalizeStatusGrup(d.statusGrupWa) !== 'Sudah Bergabung') return false;
      }

      if (!q) return true;
      return (
        d.namaLengkap.toLowerCase().includes(q) ||
        d.idDonatur.toLowerCase().includes(q) ||
        d.noWa.toLowerCase().includes(q) ||
        (d.domisili || '').toLowerCase().includes(q)
      );
    });
  }, [
    donaturList,
    donorStatusMap,
    bayarFilter,
    aktifFilter,
    tglFilter,
    genderFilter,
    pulauFilter,
    provinsiFilter,
    grupFilter,
    deferredSearchQuery,
  ]);

  useEffect(() => {
    setDonorPage(1);
  }, [
    selectedMonth,
    bayarFilter,
    aktifFilter,
    tglFilter,
    genderFilter,
    pulauFilter,
    provinsiFilter,
    grupFilter,
    deferredSearchQuery,
    donorPageSize,
  ]);

  const paginatedDonors = useMemo(
    () => slicePaginated(filteredDonors, donorPage, donorPageSize),
    [filteredDonors, donorPage, donorPageSize]
  );

  const selectedDonors = useMemo(() => {
    const idSet = new Set(selectedIds);
    return donaturList.filter((d) => idSet.has(d.idDonatur));
  }, [donaturList, selectedIds]);

  const activeTemplates = useMemo<string[]>(() => {
    switch (messageKind) {
      case 'reminder':
        return config.waReminderTemplates?.length
          ? config.waReminderTemplates
          : DEFAULT_WA_REMINDER_TEMPLATES;
      case 'daftar':
        return config.waTemplates?.length ? config.waTemplates : DEFAULT_WA_TEMPLATES;
      case 'followup':
        return config.waFollowupTemplates?.length
          ? config.waFollowupTemplates
          : DEFAULT_WA_FOLLOWUP_TEMPLATES;
      case 'grup_wa':
      case 'custom':
        return [];
    }
  }, [messageKind, config]);

  const buildMessageForDonor = (donor: Donatur, recipientIndex: number): string => {
    if (messageKind === 'grup_wa') {
      return buildGroupInviteMessage(donor, config);
    }
    if (messageKind === 'custom') {
      return renderMessageTemplate(customMessageText, donor, config, {
        bulanTagihan: selectedMonth,
      });
    }
    const list = activeTemplates;
    const tplIdx = rotateTemplates
      ? recipientIndex % Math.max(list.length, 1)
      : Math.min(fixedTemplateIdx, Math.max(list.length - 1, 0));
    const tpl = list[tplIdx] || '';
    return renderMessageTemplate(tpl, donor, config, {
      bulanTagihan: selectedMonth,
      includeGroupLink: messageKind === 'daftar',
    });
  };

  const previewDonor: Donatur | null = useMemo(() => {
    if (previewDonorId) {
      const found = selectedDonors.find((d) => d.idDonatur === previewDonorId);
      if (found) return found;
    }
    if (selectedDonors.length > 0) return selectedDonors[0];
    if (filteredDonors.length > 0) return filteredDonors[0];
    return donaturList[0] || null;
  }, [previewDonorId, selectedDonors, filteredDonors, donaturList]);

  const previewIndex = useMemo(() => {
    if (!previewDonor) return 0;
    const idx = selectedDonors.findIndex((d) => d.idDonatur === previewDonor.idDonatur);
    return idx >= 0 ? idx : 0;
  }, [previewDonor, selectedDonors]);

  const previewMessageText = useMemo(() => {
    if (!previewDonor) {
      return 'Pilih minimal satu donatur untuk melihat pratinjau pesan.';
    }
    return buildMessageForDonor(previewDonor, previewIndex);
  }, [
    previewDonor,
    previewIndex,
    messageKind,
    rotateTemplates,
    fixedTemplateIdx,
    customMessageText,
    selectedMonth,
    config,
    activeTemplates,
  ]);

  const previewWaMeUrl = useMemo(() => {
    if (!previewDonor) return '#';
    return buildWaMeUrl(previewDonor.noWa, previewMessageText);
  }, [previewDonor, previewMessageText]);

  const handleToggleDonor = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSelectAllFiltered = () => {
    const merged = new Set([...selectedIds, ...filteredDonors.map((d) => d.idDonatur)]);
    setSelectedIds(Array.from(merged));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleKindChange = (kind: BroadcastMessageKind) => {
    setMessageKind(kind);
    setFixedTemplateIdx(0);
    if (kind === 'reminder' && config.showQris && config.qrisUrl) {
      setAttachQris(true);
    } else if (kind !== 'reminder') {
      setAttachQris(false);
    }
  };

  const handleCopyPreviewText = async () => {
    if (!previewDonor) return;
    try {
      await navigator.clipboard.writeText(previewMessageText);
      setCopiedPreview(true);
      onNotify('success', `Teks pesan untuk ${previewDonor.namaLengkap} disalin`);
      setTimeout(() => setCopiedPreview(false), 2000);
    } catch {
      onNotify('error', 'Gagal menyalin teks pesan.');
    }
  };

  const handleCopyRowText = async (d: Donatur, idx: number) => {
    const text = buildMessageForDonor(d, idx);
    try {
      await navigator.clipboard.writeText(text);
      onNotify('success', `Teks untuk ${d.namaLengkap} disalin`);
    } catch {
      onNotify('error', 'Gagal menyalin teks.');
    }
  };

  const getMediaUrlForSend = () => {
    if (!attachQris || !config.qrisUrl) return '';
    return normalizeDriveImageUrl(config.qrisUrl);
  };

  const getJenisLabel = (): string => {
    switch (messageKind) {
      case 'reminder':
        return `Reminder ${selectedMonth}`;
      case 'daftar':
        return 'Notifikasi Awal';
      case 'followup':
        return 'Arahan Save Nomor';
      case 'grup_wa':
        return 'Undangan Grup WA';
      case 'custom':
        return 'Broadcast Kustom';
    }
  };

  // Opsi 1: Kirim Otomatis via Broadcast (Live dengan jeda/delay atau Terjadwal di Server)
  const handleStartBroadcast = async () => {
    if (selectedDonors.length === 0) {
      onNotify('error', 'Pilih minimal 1 donatur penerima terlebih dahulu.');
      return;
    }

    const mediaUrl = getMediaUrlForSend();
    const jenisPesan = getJenisLabel();
    const safeDelay = Math.max(1, Math.min(600, Math.round(delaySeconds || 10)));

    if (sendMode === 'scheduled') {
      const startDt = new Date(scheduleDatetime);
      if (Number.isNaN(startDt.getTime())) {
        onNotify('error', 'Tanggal & jam jadwal kirim tidak valid.');
        return;
      }

      const items: ScheduleBroadcastItemPayload[] = selectedDonors.map((donor, idx) => {
        const sendAt = new Date(startDt.getTime() + idx * safeDelay * 1000);
        return {
          idDonatur: donor.idDonatur,
          namaDonatur: donor.namaLengkap,
          noWa: donor.noWa,
          isiPesan: buildMessageForDonor(donor, idx),
          mediaUrl,
          jadwalKirim: formatServerScheduleStr(sendAt),
          jenisPesan,
        };
      });

      setIsScheduling(true);
      const ok = await onScheduleBroadcast(items);
      setIsScheduling(false);
      if (ok) {
        setSelectedIds([]);
      }
      return;
    }

    // Live Sequential Broadcast
    if (connectionStatus !== 'connected') {
      onNotify(
        'error',
        'Sinkronisasi server belum aktif',
        'Kirim otomatis via broadcast membutuhkan koneksi layanan aktif. Anda tetap bisa memakai tombol Salin Teks atau Buka wa.me.'
      );
      return;
    }

    stopLiveRef.current = false;
    setIsSendingLive(true);
    setLiveLogs([]);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < selectedDonors.length; i++) {
      if (stopLiveRef.current) break;

      const donor = selectedDonors[i];
      const msgText = buildMessageForDonor(donor, i);

      setLiveProgress({
        current: i + 1,
        total: selectedDonors.length,
        sent,
        failed,
        currentName: donor.namaLengkap,
        countdownSec: 0,
      });

      let emailSubject: string | undefined;
      let emailBody: string | undefined;
      if (alsoSendEmail && donor.email) {
        const tplEmail =
          messageKind === 'daftar' ? config.emailTemplateDaftar : config.emailTemplateReminder;
        emailSubject = renderMessageTemplate(tplEmail.subject, donor, config, {
          bulanTagihan: selectedMonth,
        });
        emailBody = renderMessageTemplate(tplEmail.body, donor, config, {
          bulanTagihan: selectedMonth,
          includeGroupLink: messageKind === 'daftar',
        });
      }

      const res = await onSendBroadcastSingle({
        idDonatur: donor.idDonatur,
        namaDonatur: donor.namaLengkap,
        noWa: donor.noWa,
        email: donor.email,
        messageText: msgText,
        mediaUrl,
        jenisPesan,
        sendEmailReminder: Boolean(alsoSendEmail && donor.email),
        emailSubject,
        emailBody,
      });

      if (res.ok) sent += 1;
      else failed += 1;

      setLiveLogs((prev) => [
        {
          idDonatur: donor.idDonatur,
          nama: donor.namaLengkap,
          ok: res.ok,
          detail: res.emailDetail ? `${res.detail} · Email: ${res.emailDetail}` : res.detail,
        },
        ...prev,
      ]);

      setLiveProgress({
        current: i + 1,
        total: selectedDonors.length,
        sent,
        failed,
        currentName: donor.namaLengkap,
        countdownSec: i < selectedDonors.length - 1 ? safeDelay : 0,
      });

      // Countdown jeda antar pesan sebelum penerima berikutnya
      if (i < selectedDonors.length - 1 && !stopLiveRef.current) {
        for (let s = safeDelay; s > 0; s--) {
          if (stopLiveRef.current) break;
          setLiveProgress({
            current: i + 1,
            total: selectedDonors.length,
            sent,
            failed,
            currentName: donor.namaLengkap,
            countdownSec: s,
          });
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
        }
      }
    }

    setIsSendingLive(false);
    setLiveProgress(null);
    onNotify(
      failed === 0 ? 'success' : 'info',
      stopLiveRef.current ? 'Broadcast dihentikan' : 'Broadcast selesai',
      `Terkirim: ${sent} · Gagal: ${failed}`
    );
  };

  const handleStopLive = () => {
    stopLiveRef.current = true;
  };

  const handleProcessQueueClick = async () => {
    setIsProcessingQueue(true);
    await onProcessQueue();
    setIsProcessingQueue(false);
  };

  const handleCancelRow = async (id: string) => {
    setCancelingId(id);
    await onCancelScheduled(id);
    setCancelingId(null);
  };

  const sortedQueue = useMemo(() => {
    const dir = queueSortDir === 'asc' ? 1 : -1;
    return [...antreanPesan].sort((a, b) => {
      let cmp = 0;
      switch (queueSortField) {
        case 'jadwal':
          cmp = (a.jadwalKirim || '').localeCompare(b.jadwalKirim || '');
          break;
        case 'nama':
          cmp = (a.namaDonatur || '').localeCompare(b.namaDonatur || '', 'id');
          break;
        case 'jenis':
          cmp = (a.jenisPesan || '').localeCompare(b.jenisPesan || '', 'id');
          break;
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '', 'id');
          break;
      }
      if (cmp === 0) return (a.idAntrean || '').localeCompare(b.idAntrean || '');
      return cmp * dir;
    });
  }, [antreanPesan, queueSortField, queueSortDir]);

  useEffect(() => {
    setQueuePage(1);
  }, [queueSortField, queueSortDir, queuePageSize]);

  const paginatedQueue = useMemo(
    () => slicePaginated(sortedQueue, queuePage, queuePageSize),
    [sortedQueue, queuePage, queuePageSize]
  );

  const pendingQueueCount = useMemo(
    () => antreanPesan.filter((q) => q.status === 'Menunggu').length,
    [antreanPesan]
  );

  const toggleQueueSort = (field: QueueSortField) => {
    if (queueSortField === field) {
      setQueueSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setQueueSortField(field);
      setQueueSortDir(field === 'jadwal' ? 'desc' : 'asc');
    }
  };

  const renderQueueSortIcon = (field: QueueSortField) => {
    if (queueSortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-60 shrink-0" />;
    return queueSortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 shrink-0" />
    ) : (
      <ArrowDown className="h-3 w-3 shrink-0" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Pusat Broadcast &amp; Pengingat Donatur
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 safe-wrap">
            Kirim pesan ke 1 orang (personal) atau beberapa donatur sekaligus dengan rotasi
            template, jeda antar pesan, jadwal otomatis, salin teks, atau buka link{' '}
            <code className="font-mono text-xs">wa.me</code>.
          </p>
        </div>

        <div className="relative flex items-center shrink-0">
          <Calendar className="pointer-events-none absolute left-3.5 h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          <input
            type="month"
            aria-label="Periode bulan pengingat"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="glass-surface rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KIRI: Pemilihan Penerima Donatur */}
        <section className="lg:col-span-6 glass-surface rounded-3xl overflow-hidden min-w-0">
          <div className="p-5 border-b border-slate-200/70 dark:border-slate-700/70 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  1. Pilih Penerima Donatur
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Tampil {filteredDonors.length} donatur · Terpilih{' '}
                  <strong className="text-emerald-700 dark:text-emerald-300">
                    {selectedDonors.length}
                  </strong>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50/85 dark:bg-emerald-950/60 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 whitespace-nowrap cursor-pointer"
                >
                  Pilih Semua ({filteredDonors.length})
                </button>
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                  >
                    Bersihkan
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama donatur, nomor WA, ID, atau domisili..."
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100/85 dark:bg-slate-800/80 p-1">
                {(['Belum Bayar', 'Menunggu Verifikasi', 'Lunas', 'Semua'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setBayarFilter(st)}
                    className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      bayarFilter === st
                        ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {st === 'Menunggu Verifikasi' ? 'Pending' : st}
                  </button>
                ))}
              </div>

              <div className="flex gap-1 rounded-xl bg-slate-100/85 dark:bg-slate-800/80 p-1">
                {(['Aktif', 'Non Aktif', 'Semua'] as const).map((ak) => (
                  <button
                    key={ak}
                    type="button"
                    onClick={() => setAktifFilter(ak)}
                    className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      aktifFilter === ak
                        ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {ak}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <SearchableSelect
                ariaLabel="Filter tanggal pengingat"
                options={tglOptions}
                value={tglFilter}
                onChange={(v) => setTglFilter(v || 'Semua')}
                compact
              />
              <SearchableSelect
                ariaLabel="Filter pulau"
                options={pulauOptions}
                value={pulauFilter}
                onChange={(v) => {
                  setPulauFilter(v);
                  setProvinsiFilter('');
                }}
                allowClear
                compact
                placeholder="Pulau: Semua"
              />
              <SearchableSelect
                ariaLabel="Filter provinsi"
                options={provinsiOptions}
                value={provinsiFilter}
                onChange={(v) => setProvinsiFilter(v)}
                allowClear
                compact
                placeholder="Provinsi: Semua"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex gap-1 rounded-xl bg-slate-100/85 dark:bg-slate-800/80 p-1">
                {(['Semua', 'Laki-laki', 'Perempuan'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenderFilter(g)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                      genderFilter === g
                        ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {g === 'Semua' ? 'Semua Gender' : g}
                  </button>
                ))}
              </div>

              <div className="inline-flex gap-1 rounded-xl bg-slate-100/85 dark:bg-slate-800/80 p-1">
                {(['Semua', 'Minat Belum Gabung', 'Sudah Bergabung'] as const).map((gr) => (
                  <button
                    key={gr}
                    type="button"
                    onClick={() => setGrupFilter(gr)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                      grupFilter === gr
                        ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {gr === 'Semua' ? 'Grup: Semua' : gr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Daftar Checklist Donatur */}
          <div className="max-h-[480px] overflow-y-auto clean-scroll divide-y divide-slate-200/70 dark:divide-slate-700/70">
            {filteredDonors.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Tidak ada donatur yang cocok dengan filter di atas.
              </div>
            ) : (
              paginatedDonors.items.map((d, idx) => {
                const absoluteIdx = paginatedDonors.startIndex + idx;
                const checked = selectedIds.includes(d.idDonatur);
                const st = donorStatusMap.get(d.idDonatur) || 'Belum Bayar';
                const rowMsg = buildMessageForDonor(d, absoluteIdx);
                const rowWaMe = buildWaMeUrl(d.noWa, rowMsg);

                return (
                  <div
                    key={d.idDonatur}
                    className={`px-4 py-3 flex items-start justify-between gap-3 transition-colors ${
                      checked
                        ? 'bg-emerald-50/75 dark:bg-emerald-950/40'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <label className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleDonor(d.idDonatur)}
                        className="mt-1 rounded accent-emerald-600 shrink-0 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 safe-wrap">
                          {d.namaLengkap}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums safe-wrap">
                          {formatWADisplay(d.noWa)} · {formatRupiah(d.nominalKomitmen)} · Tgl{' '}
                          {d.tglJatuhTempo}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 safe-wrap">
                          <span
                            className={
                              st === 'Lunas'
                                ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                : st === 'Menunggu Verifikasi'
                                ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                : 'text-rose-700 dark:text-rose-400 font-semibold'
                            }
                          >
                            {st}
                          </span>
                          {d.domisili ? ` · ${d.domisili}` : ''}
                          {d.email ? ` · Email ada` : ''}
                        </p>
                      </div>
                    </label>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewDonorId(d.idDonatur)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:border-emerald-300 cursor-pointer"
                        title="Lihat pratinjau pesan donatur ini"
                      >
                        Pratinjau
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyRowText(d, absoluteIdx)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-700 cursor-pointer"
                        title="Salin teks pesan donatur ini"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <a
                        href={rowWaMe}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        title="Buka link wa.me di tab baru"
                      >
                        <MessageCircle className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {filteredDonors.length > 0 && (
            <PaginationBar
              totalItems={filteredDonors.length}
              currentPage={paginatedDonors.safePage}
              pageSize={donorPageSize}
              onPageChange={setDonorPage}
              onPageSizeChange={(next) => {
                setDonorPageSize(next);
                setDonorPage(1);
              }}
              itemLabel="donatur"
            />
          )}
        </section>

        {/* KANAN: Komposer Pesan, Pengaturan Jeda & Jadwal, serta 3 Opsi Pengiriman */}
        <section className="lg:col-span-6 glass-surface rounded-3xl p-5 sm:p-6 space-y-5 min-w-0">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              2. Susun Pesan, Template &amp; Jadwal Pengiriman
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
              Pilih jenis pesan, rotasi template anti-spam, lampiran QRIS, dan jeda antar pesan.
            </p>
          </div>

          {/* Pilihan Jenis Pesan */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: 'reminder', label: 'Pengingat Bulanan' },
                { key: 'daftar', label: 'Notif Daftar Awal' },
                { key: 'followup', label: 'Arahan Save Nomor' },
                { key: 'grup_wa', label: 'Undangan Grup WA' },
                { key: 'custom', label: 'Pesan Kustom' },
              ] as const
            ).map((k) => {
              const active = messageKind === k.key;
              return (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => handleKindChange(k.key)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-300'
                  }`}
                >
                  {k.label}
                </button>
              );
            })}
          </div>

          {/* Pilihan Template atau Teks Kustom */}
          {messageKind === 'custom' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Isi Pesan Kustom (Mendukung variabel {'{sapaan}'}, {'{nama}'}, {'{nominal}'},{' '}
                {'{bulan}'}, {'{rekening}'}, {'{link_konfirmasi}'}, {'{link_grup}'})
              </label>
              <textarea
                rows={5}
                value={customMessageText}
                onChange={(e) => setCustomMessageText(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs leading-relaxed text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          ) : activeTemplates.length > 0 ? (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rotateTemplates}
                    onChange={(e) => setRotateTemplates(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span>Rotasi template otomatis bergantian ({activeTemplates.length} variasi)</span>
                </label>
                {!rotateTemplates && (
                  <div className="flex items-center gap-1">
                    {activeTemplates.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFixedTemplateIdx(idx)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                          fixedTemplateIdx === idx
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        #{idx + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Isi template pesan dapat disesuaikan oleh Super Admin melalui menu{' '}
                <strong>Pengaturan → WA &amp; Email</strong>.
              </p>
            </div>
          ) : null}

          {/* Lampiran QRIS & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/50 p-3 space-y-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attachQris}
                  disabled={!config.qrisUrl}
                  onChange={(e) => setAttachQris(e.target.checked)}
                  className="rounded accent-emerald-600"
                />
                <ImageIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Lampirkan Gambar QRIS</span>
              </label>
              {config.qrisUrl ? (
                <div className="flex items-center gap-2">
                  <img
                    src={qrisPreviewSrc}
                    alt="QRIS"
                    referrerPolicy="no-referrer"
                    onError={() => {
                      const fb = getDriveThumbnailFallback(config.qrisUrl);
                      if (fb && qrisPreviewSrc !== fb) setQrisPreviewSrc(fb);
                    }}
                    className="h-10 w-10 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                    QRIS ikut terkirim bersama pesan pengingat (khusus broadcast otomatis).
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Belum ada file QRIS diunggah di Pengaturan.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/50 p-3 space-y-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoSendEmail}
                  disabled={sendMode === 'scheduled'}
                  onChange={(e) => setAlsoSendEmail(e.target.checked)}
                  className="rounded accent-sky-600"
                />
                <Mail className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                <span>Sekaligus Kirim Email (1 Template)</span>
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                {sendMode === 'scheduled'
                  ? 'Opsi email aktif khusus pengiriman langsung (Live).'
                  : 'Terkirim ke donatur yang memiliki alamat email memakai template Email Pengingat/Daftar.'}
              </p>
            </div>
          </div>

          {/* Pengaturan Jeda / Delay & Mode Jadwal */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Jeda Antar Pesan (Detik)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Math.max(1, Number(e.target.value) || 1))}
                    className="w-24 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1">
                    {DELAY_PRESETS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setDelaySeconds(s)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold tabular-nums cursor-pointer ${
                          delaySeconds === s
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {s}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Waktu Pengiriman Broadcast
                </span>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 dark:bg-slate-900/70 p-1">
                  <button
                    type="button"
                    onClick={() => setSendMode('now')}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      sendMode === 'now'
                        ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Kirim Sekarang
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMode('scheduled')}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      sendMode === 'scheduled'
                        ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Terjadwal
                  </button>
                </div>
              </div>
            </div>

            {sendMode === 'scheduled' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Mulai Kirim pada Tanggal &amp; Jam
                </label>
                <input
                  type="datetime-local"
                  value={scheduleDatetime}
                  onChange={(e) => setScheduleDatetime(e.target.value)}
                  className="w-full sm:w-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                  Setiap penerima otomatis dijadwalkan bertahap dengan jeda{' '}
                  <strong>{delaySeconds} detik</strong> dan diproses otomatis oleh pemicu server.
                </p>
              </div>
            )}
          </div>

          {/* Pratinjau Pesan */}
          <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/25 p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Pratinjau Pesan{previewDonor ? ` — ${previewDonor.namaLengkap}` : ''}
              </p>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Periode: {formatBulanLabel(selectedMonth)}
              </span>
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-slate-800 dark:text-slate-100 bg-white/90 dark:bg-slate-900/80 rounded-xl border border-emerald-200/70 dark:border-emerald-800/60 p-3.5 max-h-56 overflow-y-auto clean-scroll">
              {previewMessageText}
            </pre>
          </div>

          {/* 3 OPSI AKSI UTAMA */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pilih Cara Pengiriman (3 Opsi)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Opsi 1: Kirim Otomatis via Broadcast */}
              {!isSendingLive ? (
                <button
                  type="button"
                  disabled={isScheduling || selectedDonors.length === 0}
                  onClick={() => void handleStartBroadcast()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-4 py-3 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-45 transition-all cursor-pointer"
                >
                  {sendMode === 'scheduled' ? (
                    <Clock className="h-4 w-4 shrink-0" />
                  ) : (
                    <Send className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {isScheduling
                      ? 'Menjadwalkan...'
                      : sendMode === 'scheduled'
                      ? `Jadwalkan (${selectedDonors.length})`
                      : `Kirim Otomatis (${selectedDonors.length})`}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopLive}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-3 text-xs font-semibold text-white hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  <Square className="h-4 w-4 shrink-0" />
                  <span>Hentikan Broadcast</span>
                </button>
              )}

              {/* Opsi 2: Copy Teks Pesannya */}
              <button
                type="button"
                disabled={!previewDonor}
                onClick={() => void handleCopyPreviewText()}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-emerald-400 disabled:opacity-45 transition-colors cursor-pointer"
              >
                {copiedPreview ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Teks Disalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 shrink-0" />
                    <span>Copy Teks Pesannya</span>
                  </>
                )}
              </button>

              {/* Opsi 3: Buka Link wa.me di Tab Baru */}
              <a
                href={previewWaMeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!previewDonor) e.preventDefault();
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50/90 dark:bg-emerald-950/60 px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors ${
                  !previewDonor ? 'pointer-events-none opacity-45' : ''
                }`}
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span>Buka wa.me (Tab Baru)</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          </div>

          {/* Progres Live Broadcast */}
          {liveProgress && (
            <div className="rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/85 dark:bg-emerald-950/60 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <span className="truncate">
                  Mengirim {liveProgress.current}/{liveProgress.total}: {liveProgress.currentName}
                </span>
                {liveProgress.countdownSec > 0 && (
                  <span className="tabular-nums text-teal-700 dark:text-teal-300 shrink-0">
                    Jeda {liveProgress.countdownSec}d...
                  </span>
                )}
              </div>
              <div className="h-2 w-full rounded-full bg-white/80 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-300"
                  style={{
                    width: `${Math.round((liveProgress.current / liveProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                Berhasil: <strong>{liveProgress.sent}</strong> · Gagal:{' '}
                <strong>{liveProgress.failed}</strong>
              </p>
            </div>
          )}

          {/* Log Hasil Kirim Live */}
          {liveLogs.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/50 p-3.5 space-y-2 max-h-48 overflow-y-auto clean-scroll">
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                Hasil Pengiriman Sesi Ini ({liveLogs.length})
              </p>
              {liveLogs.map((log, idx) => (
                <div
                  key={`${log.idDonatur}-${idx}`}
                  className="flex items-start justify-between gap-2 text-[11px] border-t border-slate-200/60 dark:border-slate-700/60 pt-1.5 first:border-t-0 first:pt-0"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200 safe-wrap">
                    {log.nama}
                  </span>
                  <span
                    className={`safe-wrap text-right ${
                      log.ok
                        ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                        : 'text-rose-600 dark:text-rose-400 font-medium'
                    }`}
                  >
                    {log.detail}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Antrean & Riwayat Pesan Terjadwal */}
      <section className="glass-surface rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Antrean &amp; Riwayat Pesan Terjadwal ({antreanPesan.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
              Mencakup Pesan 2 otomatis (arahan save nomor delay 1 menit) dan broadcast terjadwal.
              Saat ini <strong className="tabular-nums">{pendingQueueCount}</strong> pesan menunggu
              jadwal kirim.
            </p>
          </div>
          {connectionStatus === 'connected' && (
            <button
              type="button"
              disabled={isProcessingQueue}
              onClick={() => void handleProcessQueueClick()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isProcessingQueue ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <Play className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>{isProcessingQueue ? 'Memproses...' : 'Proses Jatuh Tempo Sekarang'}</span>
            </button>
          )}
        </div>

        {sortedQueue.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Belum ada antrean pesan terjadwal.
          </div>
        ) : (
          <div className="overflow-x-auto clean-scroll">
            <table className="w-full min-w-[860px] text-left border-collapse">
              <thead>
                <tr className="bg-teal-800 dark:bg-teal-950 text-white dark:text-teal-100 text-[11px] font-semibold">
                  <th className="py-3 pl-5 pr-3">
                    <button
                      type="button"
                      onClick={() => toggleQueueSort('jadwal')}
                      className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>Jadwal Kirim</span>
                      {renderQueueSortIcon('jadwal')}
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => toggleQueueSort('nama')}
                      className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>Penerima</span>
                      {renderQueueSortIcon('nama')}
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => toggleQueueSort('jenis')}
                      className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>Jenis &amp; Cuplikan Pesan</span>
                      {renderQueueSortIcon('jenis')}
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => toggleQueueSort('status')}
                      className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>Status</span>
                      {renderQueueSortIcon('status')}
                    </button>
                  </th>
                  <th className="py-3 pl-3 pr-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-xs">
                {paginatedQueue.items.map((item) => (
                  <tr
                    key={item.idAntrean}
                    className="odd:bg-white/90 even:bg-emerald-50/40 dark:odd:bg-slate-900/75 dark:even:bg-slate-800/60 align-top"
                  >
                    <td className="py-3.5 pl-5 pr-3 whitespace-nowrap tabular-nums">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.jadwalKirim}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">{item.idAntrean}</p>
                    </td>
                    <td className="py-3.5 px-3 min-w-0 max-w-[200px]">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 safe-wrap">
                        {item.namaDonatur}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatWADisplay(item.noWa)}
                      </p>
                    </td>
                    <td className="py-3.5 px-3 min-w-0 max-w-[300px]">
                      <p className="font-semibold text-teal-800 dark:text-teal-300">
                        {item.jenisPesan}
                        {item.mediaUrl ? ' · +QRIS' : ''}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 safe-wrap">
                        {item.isiPesan}
                      </p>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {item.status === 'Terkirim' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Terkirim</span>
                        </span>
                      )}
                      {item.status === 'Menunggu' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>Menunggu</span>
                        </span>
                      )}
                      {item.status === 'Gagal' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400">
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>Gagal</span>
                        </span>
                      )}
                      {item.status === 'Dibatalkan' && (
                        <span className="text-slate-400 font-semibold">Dibatalkan</span>
                      )}
                      {item.keteranganHasil && (
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 max-w-[180px] safe-wrap">
                          {item.keteranganHasil}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                      {item.status === 'Menunggu' ? (
                        <button
                          type="button"
                          disabled={cancelingId === item.idAntrean}
                          onClick={() => void handleCancelRow(item.idAntrean)}
                          className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                        >
                          {cancelingId === item.idAntrean ? '...' : 'Batalkan'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {item.waktuTerkirim || '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sortedQueue.length > 0 && (
          <PaginationBar
            totalItems={sortedQueue.length}
            currentPage={paginatedQueue.safePage}
            pageSize={queuePageSize}
            onPageChange={setQueuePage}
            onPageSizeChange={(next) => {
              setQueuePageSize(next);
              setQueuePage(1);
            }}
            itemLabel="antrean"
          />
        )}
      </section>
    </div>
  );
};
