export interface ProcessedUploadFile {
  base64: string;
  mimeType: string;
  extension: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  previewUrl: string;
  isPdf: boolean;
  originalName: string;
}

const MAX_PDF_BYTES = 4 * 1024 * 1024; // 4 MB
const MAX_IMAGE_DIMENSION = 1280;
const JPEG_QUALITY = 0.78;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Gagal membaca berkas.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas bukti transfer.'));
    reader.readAsDataURL(file);
  });
}

function estimateBase64Bytes(dataUrl: string): number {
  const parts = dataUrl.split(',');
  const base64 = parts.length > 1 ? parts[1] : parts[0];
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * Kompres gambar bukti transfer otomatis di browser menggunakan Canvas
 * agar ukuran Base64 ringan saat dikirim ke Google Apps Script.
 * Untuk file PDF, langsung diubah menjadi Base64 dengan batas ukuran 4 MB.
 */
export async function compressTransferProof(file: File): Promise<ProcessedUploadFile> {
  const mime = (file.type || '').toLowerCase();
  const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error('Ukuran file PDF maksimal 4 MB agar pengiriman ke Google Drive stabil.');
    }
    const dataUrl = await readFileAsDataUrl(file);
    return {
      base64: dataUrl,
      mimeType: 'application/pdf',
      extension: 'pdf',
      originalSizeBytes: file.size,
      compressedSizeBytes: file.size,
      previewUrl: '',
      isPdf: true,
      originalName: file.name,
    };
  }

  if (!mime.startsWith('image/')) {
    throw new Error('Format berkas tidak didukung. Gunakan gambar (JPG, PNG, WEBP) atau PDF.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gambar tidak dapat diproses. Pastikan file tidak rusak.'));
    image.src = rawDataUrl;
  });

  let { width, height } = img;
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser tidak mendukung kompresi gambar Canvas.');
  }

  // Isi latar putih agar PNG transparan rapi saat dikonversi ke JPEG
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const compressedDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const compressedBytes = estimateBase64Bytes(compressedDataUrl);

  return {
    base64: compressedDataUrl,
    mimeType: 'image/jpeg',
    extension: 'jpg',
    originalSizeBytes: file.size,
    compressedSizeBytes: compressedBytes,
    previewUrl: compressedDataUrl,
    isPdf: false,
    originalName: file.name,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
