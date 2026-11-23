import React, { useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  Link2,
  RefreshCw,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react';
import gasCodeSource from '../../backend/Code.gs?raw';
import { Panitia } from '../types';
import { isValidGasUrl, pingGasConnection } from '../services/api';
import { buildReferralUrl } from '../utils/formatters';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  gasUrl: string;
  connectionStatus: 'connected' | 'local' | 'error';
  panitia: Panitia[];
  onSaveUrl: (newUrl: string) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  gasUrl,
  connectionStatus,
  panitia,
  onSaveUrl,
  onNotify,
}) => {
  const [activeSection, setActiveSection] = useState<'koneksi' | 'backend' | 'referral'>('koneksi');
  const [urlInput, setUrlInput] = useState(gasUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setTestResult({ ok: false, text: 'Masukkan URL Web App Google Apps Script terlebih dahulu.' });
      return;
    }
    if (!isValidGasUrl(trimmed)) {
      setTestResult({
        ok: false,
        text: 'URL tidak valid. Harus diawali https://script.google.com/ dan diakhiri /exec.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    const res = await pingGasConnection(trimmed);
    setIsTesting(false);

    if (res.status === 'success') {
      setTestResult({
        ok: true,
        text: `Koneksi berhasil! Terhubung ke ${res.data?.namaLembaga || 'Google Apps Script'}.`,
      });
    } else {
      setTestResult({
        ok: false,
        text: res.message || 'Tidak dapat menghubungi Apps Script.',
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (trimmed && !isValidGasUrl(trimmed)) {
      setTestResult({
        ok: false,
        text: 'Format URL tidak valid. Pastikan URL adalah Web App Apps Script (https://script.google.com/.../exec).',
      });
      return;
    }

    setIsSaving(true);
    await onSaveUrl(trimmed);
    setIsSaving(false);
    onClose();
  };

  const handleUseLocalMode = async () => {
    setUrlInput('');
    setTestResult(null);
    setIsSaving(true);
    await onSaveUrl('');
    setIsSaving(false);
    onClose();
  };

  const handleCopyGasCode = async () => {
    try {
      await navigator.clipboard.writeText(gasCodeSource);
      setCopiedCode(true);
      onNotify('success', 'Kode Code.gs disalin', 'Tempelkan langsung ke editor Google Apps Script.');
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      onNotify('error', 'Gagal menyalin otomatis', 'Silakan blok dan salin teks kode secara manual.');
    }
  };

  const handleCopyRef = async (kode: string) => {
    const link = buildReferralUrl(kode);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedRef(kode);
      onNotify('success', `Link referral ${kode} disalin`, link);
      setTimeout(() => setCopiedRef(null), 2000);
    } catch {
      onNotify('error', 'Gagal menyalin tautan');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-koneksi-title"
    >
      <div className="glass-surface w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-200/70 dark:border-slate-700/70">
          <div className="min-w-0">
            <h2
              id="modal-koneksi-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate"
            >
              Pengaturan Koneksi & Backend
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
              Status saat ini:{' '}
              <span
                className={
                  connectionStatus === 'connected'
                    ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                    : connectionStatus === 'error'
                    ? 'font-semibold text-rose-600 dark:text-rose-400'
                    : 'font-semibold text-sky-700 dark:text-sky-400'
                }
              >
                {connectionStatus === 'connected'
                  ? 'Terhubung ke Google Apps Script'
                  : connectionStatus === 'error'
                  ? 'Koneksi Bermasalah'
                  : 'Mode Uji Lokal (Browser)'}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
            aria-label="Tutup pengaturan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Segmented tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/85 p-1">
            <button
              type="button"
              onClick={() => setActiveSection('koneksi')}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeSection === 'koneksi'
                  ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Server className="h-3.5 w-3.5 shrink-0" />
              <span>URL Web App</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('backend')}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeSection === 'backend'
                  ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Code2 className="h-3.5 w-3.5 shrink-0" />
              <span>Kode Code.gs</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('referral')}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeSection === 'referral'
                  ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              <span>Link Referral</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 clean-scroll">
          {activeSection === 'koneksi' && (
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label
                  htmlFor="gas-url-input"
                  className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                >
                  URL Web App Google Apps Script
                </label>
                <input
                  id="gas-url-input"
                  type="url"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed safe-wrap">
                  URL tersimpan aman di browser ini (localStorage). Kosongkan bila ingin menggunakan Mode Uji Lokal tanpa Google Sheets.
                </p>
              </div>

              {testResult && (
                <div
                  className={`rounded-2xl p-3.5 text-xs font-medium leading-relaxed safe-wrap ${
                    testResult.ok
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/80'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200/80 dark:border-rose-800/80'
                  }`}
                >
                  {testResult.text}
                </div>
              )}

              <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Langkah singkat menghubungkan Google Sheets & Drive:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <li>
                    Buka tab <strong>Kode Code.gs</strong> lalu salin seluruh kode ke Google Apps Script pada Google Sheets Anda.
                  </li>
                  <li>
                    Isi konstanta <code className="font-mono text-emerald-700 dark:text-emerald-400">DRIVE_FOLDER_ID</code> dengan ID folder Google Drive untuk bukti transfer.
                  </li>
                  <li>
                    Jalankan fungsi <code className="font-mono text-emerald-700 dark:text-emerald-400">setupDatabase()</code> sekali (aman dijalankan ulang untuk menambah kolom Email &amp; Status_Penyaluran).
                  </li>
                  <li>
                    Deploy sebagai <strong>Web App</strong> (Jalankan sebagai: Saya · Akses: Siapa saja) lalu tempel URL <code className="font-mono text-emerald-700 dark:text-emerald-400">/exec</code> di atas.
                  </li>
                </ol>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={isTesting}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Menguji...' : 'Uji Koneksi'}</span>
                  </button>
                  {gasUrl && (
                    <button
                      type="button"
                      onClick={handleUseLocalMode}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>Pakai Mode Lokal</span>
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all whitespace-nowrap cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan & Muat Data'}</span>
                </button>
              </div>
            </form>
          )}

          {activeSection === 'backend' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed min-w-0 flex-1">
                  Kode backend Google Apps Script lengkap siap salin ke file{' '}
                  <code className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    Code.gs
                  </code>
                  .
                </p>
                <button
                  type="button"
                  onClick={handleCopyGasCode}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 shrink-0" />
                      <span>Salin Code.gs</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-[11px] leading-relaxed text-emerald-100 font-mono clean-scroll">
                <code>{gasCodeSource}</code>
              </pre>
            </div>
          )}

          {activeSection === 'referral' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Bagikan tautan berikut kepada masing-masing panitia. Calon donatur yang membuka tautan ini otomatis tercatat dengan metode <strong>Mandiri (Referral)</strong> dan perantara terkunci sesuai kode panitia.
              </p>

              <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/50">
                {panitia.map((p) => {
                  const refUrl = buildReferralUrl(p.kodePanitia);
                  const isCopied = copiedRef === p.kodePanitia;
                  return (
                    <div
                      key={p.kodePanitia}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 safe-wrap">
                          {p.namaPanitia}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 safe-wrap">
                          Kode {p.kodePanitia} · {p.role}
                        </p>
                        <p
                          className="text-[11px] text-teal-700 dark:text-teal-400 font-mono mt-1 truncate"
                          title={refUrl}
                        >
                          {refUrl}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyRef(p.kodePanitia)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/60 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5 shrink-0" />
                              <span>Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5 shrink-0" />
                              <span>Salin Link</span>
                            </>
                          )}
                        </button>
                        <a
                          href={refUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                          title="Buka tautan referral di tab baru"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
