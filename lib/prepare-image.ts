const MAX_EDGE = 2000;
const MAX_BYTES = 3.5 * 1024 * 1024;

function blobToFile(blob: Blob, name: string) {
  const base = name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

/** Resize/compress in the browser so live hosts accept the upload. */
export async function prepareImageFile(file: File): Promise<File> {
  const looksLikeImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(file.name);
  if (!looksLikeImage) throw new Error("Use PNG, JPG, or WebP");

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    bitmap = null;
  }
  if (!bitmap) {
    if (file.size > MAX_BYTES) throw new Error("Image must be under 4MB. Try a smaller JPG or PNG.");
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      throw new Error("Use PNG, JPG, or WebP");
    }
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not process this image.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.85;
  let blob: Blob | null = null;
  while (quality >= 0.5) {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_BYTES) break;
    quality -= 0.1;
  }
  if (!blob) throw new Error("Could not process this image.");
  if (blob.size > MAX_BYTES) throw new Error("Image is still too large after compression. Try another photo.");
  return blobToFile(blob, file.name);
}

export async function postImageUpload(file: File): Promise<{ url: string }> {
  const prepared = await prepareImageFile(file);
  const body = new FormData();
  body.set("file", prepared);
  const res = await fetch("/api/uploads", { method: "POST", body });
  const text = await res.text();
  let data: { url?: string; error?: string } | null = null;
  try {
    data = text ? (JSON.parse(text) as { url?: string; error?: string }) : null;
  } catch {
    data = null;
  }
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || (res.status === 413 ? "Image is too large for this server." : "Could not upload image"));
  }
  return { url: data.url };
}
