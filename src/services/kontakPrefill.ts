import { JenisKelamin } from '../types';
import { formatProperPersonName, normalizeWA } from '../utils/formatters';

export interface KontakPrefillMatch {
  noWa: string;
  namaLengkap: string;
  jenisKelamin: JenisKelamin;
}

type ShardRecord = Record<string, [string, string]>;

const shardCache = new Map<string, ShardRecord>();
const inflightShards = new Map<string, Promise<ShardRecord>>();

async function loadKontakShard(bucket: string): Promise<ShardRecord> {
  const cached = shardCache.get(bucket);
  if (cached) return cached;

  const existing = inflightShards.get(bucket);
  if (existing) return existing;

  const promise = (async (): Promise<ShardRecord> => {
    try {
      const response = await fetch(`./data/kontak/${bucket}.json`, {
        method: 'GET',
        cache: 'force-cache',
      });
      if (!response.ok) return {};
      const parsed = (await response.json()) as ShardRecord;
      if (parsed && typeof parsed === 'object') {
        shardCache.set(bucket, parsed);
        return parsed;
      }
      return {};
    } catch {
      return {};
    } finally {
      inflightShards.delete(bucket);
    }
  })();

  inflightShards.set(bucket, promise);
  return promise;
}

/**
 * Mencari prapengisian nama & jenis kelamin secara instan dari basis kontak statis (sharded JSON).
 * Dipakai HANYA jika nomor WA belum terdaftar di Google Sheets.
 * Gagal diam-diam (mengembalikan null) jika data tidak ditemukan atau jaringan bermasalah.
 */
export async function lookupKontakPrefill(rawWa: string): Promise<KontakPrefillMatch | null> {
  const normalized = normalizeWA(rawWa);
  if (!normalized || normalized.length < 7) return null;

  const bucket = normalized.slice(-2);
  if (!/^\d{2}$/.test(bucket)) return null;

  const shard = await loadKontakShard(bucket);
  const entry = shard[normalized];
  if (!Array.isArray(entry) || entry.length < 2) return null;

  const [genderCode, rawName] = entry;
  const namaLengkap = formatProperPersonName(rawName);
  if (!namaLengkap) return null;

  const jenisKelamin: JenisKelamin =
    genderCode === 'P' ? 'Perempuan' : genderCode === 'L' ? 'Laki-laki' : '';

  return {
    noWa: normalized,
    namaLengkap,
    jenisKelamin,
  };
}
