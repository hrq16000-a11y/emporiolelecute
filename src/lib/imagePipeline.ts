/**
 * Client-side image optimization pipeline used on catalog uploads.
 *
 * Goals (LCP/CLS):
 * - Downscale huge camera/phone photos to a sane max edge before upload.
 * - Re-encode to WebP (fallback: original type) with a good quality/size ratio.
 * - Expose intrinsic dimensions so the UI can reserve space (no layout shift).
 * - Produce a tiny blurred placeholder (data URL) for instant previews.
 *
 * Responsive sizes are generated at delivery time by the Supabase image
 * transform (see `src/lib/image.ts` — `optimizeImage` / `buildSrcSet`), so we
 * only need to store one well-sized master file per image.
 */

export interface OptimizedImage {
  file: File;
  width: number;
  height: number;
  placeholder: string | null;
  originalBytes: number;
  optimizedBytes: number;
}

const MAX_EDGE = 1600;
const QUALITY = 0.82;
const PLACEHOLDER_EDGE = 24;

const canUseCanvas = () =>
  typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined';

function loadBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem'));
    };
    img.src = url;
  });
}

function drawTo(img: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

const swapExtension = (name: string, ext: string) =>
  `${name.replace(/\.[^.]+$/, '')}.${ext}`;

/**
 * Compresses/resizes an image file before upload. Never throws: on any failure
 * the original file is returned so the upload flow keeps working.
 */
export async function optimizeImageFile(file: File): Promise<OptimizedImage> {
  const fallback: OptimizedImage = {
    file,
    width: 0,
    height: 0,
    placeholder: null,
    originalBytes: file.size,
    optimizedBytes: file.size,
  };

  if (!canUseCanvas() || !file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return fallback;
  }

  try {
    const img = await loadBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = img.naturalWidth * scale;
    const height = img.naturalHeight * scale;

    const canvas = drawTo(img, width, height);
    let blob = await toBlob(canvas, 'image/webp', QUALITY);
    let ext = 'webp';

    // Safari <16 and some browsers may not encode webp — fall back to JPEG.
    if (!blob || blob.type !== 'image/webp') {
      blob = await toBlob(canvas, 'image/jpeg', QUALITY);
      ext = 'jpg';
    }
    if (!blob) return fallback;

    // Placeholder (blur-up) — tiny, inline, no extra request.
    let placeholder: string | null = null;
    try {
      const pScale = PLACEHOLDER_EDGE / Math.max(canvas.width, canvas.height);
      const pCanvas = drawTo(img, canvas.width * pScale, canvas.height * pScale);
      placeholder = pCanvas.toDataURL('image/webp', 0.5);
    } catch {
      placeholder = null;
    }

    // Only keep the re-encoded file when it is actually smaller.
    if (blob.size >= file.size && scale === 1) {
      return { ...fallback, width: img.naturalWidth, height: img.naturalHeight, placeholder };
    }

    const optimized = new File([blob], swapExtension(file.name, ext), {
      type: blob.type,
      lastModified: Date.now(),
    });

    return {
      file: optimized,
      width: canvas.width,
      height: canvas.height,
      placeholder,
      originalBytes: file.size,
      optimizedBytes: optimized.size,
    };
  } catch {
    return fallback;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
