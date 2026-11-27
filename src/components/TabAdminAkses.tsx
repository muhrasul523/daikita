import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  Link2,
  Loader2,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { APP_ADMIN_URL, APP_BAYAR_URL, APP_PUBLIC_URL } from '../config';
import {
  AdminAkses,
  AdminRole,
  PageSizeOption,
  SaveAdminAksesPayload,
  StatusAktif,
} from '../types';
import { formatWADisplay, validateAndNormalizeWA } from '../utils/formatters';
import { PaginationBar, slicePaginated } from './PaginationBar';

interface TabAdminAksesProps {
  adminAksesList: AdminAkses[];
  currentAdminWa: string;
  onSaveAdminAkses: (payload: SaveAdminAksesPayload) => Promise<boolean>;
  onDeleteAdminAkses: (noWa: string) => Promise<boolean>;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

export const TabAdminAkses: React.FC<TabAdminAksesProps> = ({
  adminAksesList,
  currentAdminWa,
  onSaveAdminAkses,
  onDeleteAdminAkses,
  onNotify,
}) => {
  const [editingOriginalWa, setEditingOriginalWa] = useState<string | null>(null);
  const [noWa, setNoWa] = useState('');
  const [nama, setNama] = useState('');
  const [role, setRole] = useState<AdminRole>('Admin');
  const [status, setStatus] = useState<StatusAktif>('Aktif');
  const [catatan, setCatatan] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingWa, setDeletingWa] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);

  const waCheck = useMemo(() => validateAndNormalizeWA(noWa), [noWa]);
  const paginatedAdmins = useMemo(
    () => slicePaginated(adminAksesList, currentPage, pageSize),
    [adminAksesList, currentPage, pageSize]
  );

  const counts = useMemo(
    () => ({
      total: adminAksesList.length,
      superAdmin: adminAksesList.filter((a) => a.role === 'Super Admin' && a.status === 'Aktif')
        .length,
      admin: adminAksesList.filter((a) => a.role === 'Admin' && a.status === 'Aktif').length,
    }),
    [adminAksesList]
  );

  const resetForm = () => {
    setEditingOriginalWa(null);
    setNoWa('');
    setNama('');
    setRole('Admin');
    setStatus('Aktif');
    setCatatan('');
  };

  const handleEdit = (item: AdminAkses) => {
    setEditingOriginalWa(item.noWa);
    setNoWa(item.noWa);
    setNama(item.nama);
    setRole(item.role);
    setStatus(item.status);
    setCatatan(item.catatan || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waCheck.valid) {
      onNotify('error', 'Nomor HP tidak valid', waCheck.error);
      return;
    }
    if (!nama.trim()) {
      onNotify('error', 'Nama wajib diisi');
      return;
    }

    setIsSaving(true);
    const ok = await onSaveAdminAkses({
      originalNoWa: editingOriginalWa || undefined,
      noWa: waCheck.normalized,
      nama: nama.trim(),
      role,
      status,
      catatan: catatan.trim(),
    });
    setIsSaving(false);

    if (ok) {
      resetForm();
    }
  };

  const handleDelete = async (item: AdminAkses) => {
    setDeletingWa(item.noWa);
    await onDeleteAdminAkses(item.noWa);
    setDeletingWa(null);
  };

  const handleCopyLink = async (label: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      onNotify('success', `Tautan ${label} disalin`, url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      onNotify('error', 'Gagal menyalin tautan');
    }
  };

  const portalLinks = [
    {
      label: 'Pendaftaran Donatur Tetap (Utama)',
      desc: 'Tautan publik utama tanpa menu admin — langsung cek WA lalu isi pendaftaran atau edit data.',
      url: APP_PUBLIC_URL,
    },
    {
      label: 'Penyaluran Donasi & Riwayat',
      desc: 'Tautan langsung bagi donatur untuk upload bukti transfer, cek riwayat & gabung grup WA.',
      url: APP_BAYAR_URL,
    },
    {
      label: 'Portal Login Admin & Super Admin',
      desc: 'Tautan khusus pengurus (login dengan nomor HP yang terdaftar di bawah ini).',
      url: APP_ADMIN_URL,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Kelola Akses Admin &amp; Super Admin
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 safe-wrap">
          Daftar nomor HP yang berhak masuk ke Portal Pengurus. Perubahan di halaman ini langsung
          tersimpan ke sheet <strong>Akses_Admin</strong> (dan juga dapat diedit langsung dari
          Google Sheets).
        </p>
      </div>

      {/* Ringkasan & Tautan Portal */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 glass-surface rounded-3xl p-5 sm:p-6 space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {editingOriginalWa ? 'Edit Akses Admin' : 'Tambah Nomor Admin / Super Admin'}
            </h2>
            {editingOriginalWa && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Batal</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="akses-wa"
                className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Nomor HP / WhatsApp <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <input
                id="akses-wa"
                type="tel"
                required
                value={noWa}
                onChange={(e) => setNoWa(e.target.value)}
                placeholder="081234567890"
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              {noWa.trim() !== '' && (
                <p
                  className={`mt-1 text-[11px] font-medium ${
                    waCheck.valid
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {waCheck.valid ? `Tersimpan: ${waCheck.normalized}` : waCheck.error}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="akses-nama"
                className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Nama Pengurus <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <input
                id="akses-nama"
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Ust. Ahmad / Admin Keuangan"
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Peran (Role)
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {(['Admin', 'Super Admin'] as const).map((r) => (
                    <label
                      key={r}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer ${
                        role === r
                          ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="akses-role"
                        value={r}
                        checked={role === r}
                        onChange={() => setRole(r)}
                        className="sr-only"
                      />
                      <span
                        className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                          role === r
                            ? 'border-emerald-600 bg-emerald-600'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {role === r && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Status Akses
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {(['Aktif', 'Non Aktif'] as const).map((st) => (
                    <label
                      key={st}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer ${
                        status === st
                          ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="akses-status"
                        value={st}
                        checked={status === st}
                        onChange={() => setStatus(st)}
                        className="sr-only"
                      />
                      <span
                        className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                          status === st
                            ? 'border-emerald-600 bg-emerald-600'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {status === st && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <span>{st}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="akses-catatan"
                className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Catatan <span className="font-normal text-slate-400">(Opsional)</span>
              </label>
              <input
                id="akses-catatan"
                type="text"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Misal: Admin verifikasi wilayah Sulsel"
                className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-65 transition-all cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <Plus className="h-4 w-4 shrink-0" />
              )}
              <span>
                {isSaving
                  ? 'Menyimpan...'
                  : editingOriginalWa
                  ? 'Simpan Perubahan Akses'
                  : 'Simpan Nomor Akses'}
              </span>
            </button>
          </form>
        </div>

        {/* Daftar Tautan Portal */}
        <div className="lg:col-span-7 space-y-5 min-w-0">
          <div className="glass-surface rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Tautan Halaman Publik &amp; Admin
              </h2>
            </div>

            <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
              {portalLinks.map((item) => {
                const isCopied = copiedUrl === item.url;
                return (
                  <div
                    key={item.url}
                    className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                        {item.desc}
                      </p>
                      <p className="mt-1 font-mono text-xs text-emerald-800 dark:text-emerald-300 safe-wrap">
                        {item.url}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyLink(item.label, item.url)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>Disalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 shrink-0" />
                          <span>Salin Link</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabel Daftar Akses Admin */}
          <div className="glass-surface rounded-3xl overflow-hidden">
            <div className="p-5 border-b border-slate-200/70 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Daftar Nomor Terdaftar ({counts.total})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {counts.superAdmin} Super Admin aktif · {counts.admin} Admin aktif
                </p>
              </div>
            </div>

            {adminAksesList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Belum ada daftar nomor admin yang dimuat.
              </div>
            ) : (
              <div className="overflow-x-auto clean-scroll">
                <table className="w-full min-w-[600px] text-left border-collapse">
                  <thead>
                    <tr className="bg-emerald-800 dark:bg-emerald-950 text-white dark:text-emerald-100 text-[11px] font-semibold">
                      <th className="py-3 pl-5 pr-3">Nama &amp; Nomor HP</th>
                      <th className="py-3 px-4">Peran</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 pl-4 pr-5 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-xs">
                    {paginatedAdmins.items.map((item) => {
                      const isSelf = item.noWa === currentAdminWa;
                      const isDeleting = deletingWa === item.noWa;
                      return (
                        <tr
                          key={item.noWa}
                          className="odd:bg-white/90 even:bg-emerald-50/45 dark:odd:bg-slate-900/75 dark:even:bg-slate-800/60"
                        >
                          <td className="py-3.5 pl-5 pr-3 min-w-0">
                            <p className="font-bold text-slate-900 dark:text-slate-100 safe-wrap">
                              {item.nama}{' '}
                              {isSelf && (
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                  (Anda)
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                              {formatWADisplay(item.noWa)}
                            </p>
                            {item.catatan && (
                              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 safe-wrap">
                                {item.catatan}
                              </p>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {item.role === 'Super Admin' ? (
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300">
                                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                <span>Super Admin</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-sky-800 dark:text-sky-300">
                                <Shield className="h-3.5 w-3.5 shrink-0" />
                                <span>Admin</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`font-semibold ${
                                item.status === 'Aktif'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>

                          <td className="py-3.5 pl-4 pr-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEdit(item)}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300 cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5 shrink-0" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => void handleDelete(item)}
                                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span>{isDeleting ? 'Menghapus...' : 'Hapus'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {adminAksesList.length > 0 && (
              <PaginationBar
                totalItems={adminAksesList.length}
                currentPage={paginatedAdmins.safePage}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(next) => {
                  setPageSize(next);
                  setCurrentPage(1);
                }}
                itemLabel="pengurus"
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
