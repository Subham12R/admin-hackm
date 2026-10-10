/** Longest edge kept for gallery photos: sharp on a large screen, a fraction of a camera original. */
const MAX_EDGE = 2400
const QUALITY = 0.82

export type PreparedPhoto = { file: File; width?: number; height?: number }

/**
 * Downscale a photo and re-encode it as WebP in the browser, before it is signed and uploaded.
 * Falls back to the original file when the browser cannot encode WebP (older Safari) or cannot
 * decode the input, or when re-encoding would not make it smaller.
 */
export async function prepareGalleryPhoto(file: File): Promise<PreparedPhoto> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    return { file }
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  try {
    const blob = await encode(bitmap, width, height)
    if (blob?.type !== "image/webp" || (blob.size >= file.size && scale === 1)) {
      return { file, width: bitmap.width, height: bitmap.height }
    }
    const name = `${file.name.replace(/\.[^.]+$/, "") || "photo"}.webp`
    return { file: new File([blob], name, { type: "image/webp", lastModified: file.lastModified }), width, height }
  } finally {
    bitmap.close()
  }
}

async function encode(bitmap: ImageBitmap, width: number, height: number): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext("2d")
    if (!context) return null
    context.drawImage(bitmap, 0, 0, width, height)
    return canvas.convertToBlob({ type: "image/webp", quality: QUALITY })
  }
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) return null
  context.drawImage(bitmap, 0, 0, width, height)
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY))
}
