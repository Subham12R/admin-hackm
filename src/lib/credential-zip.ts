import { downloadZip } from "client-zip"

/** The few fields a bulk action needs; both list rows and the manifest provide them. */
export type CredentialLite = {
  id: string
  code: string
  kind: "CERTIFICATE" | "BADGE"
  status: "DRAFT" | "PUBLISHED" | "REVOKED"
  render_status: "PENDING" | "DONE" | "FAILED"
  title: string
  recipient_name: string
  team_name: string
  image_url: string | null
  pdf_url: string | null
}

export type ZipFormat = "pdf" | "image" | "both"

export const ZIP_FORMATS: Record<ZipFormat, string> = {
  pdf: "PDFs (badges as images)",
  image: "Images only",
  both: "PDFs and images",
}

function safe(text: string) {
  return text.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "untitled"
}

function extension(url: string, fallback: string) {
  const match = /\.([a-z0-9]{2,4})(?:$|[?#])/i.exec(url)
  return match ? match[1].toLowerCase() : fallback
}

/** Which files of a credential go in the ZIP; badges only ever have an image. */
export function filesOf(item: CredentialLite, format: ZipFormat) {
  const files: { url: string; ext: string }[] = []
  const pdf = item.pdf_url
  const image = item.image_url
  if (pdf && format !== "image") files.push({ url: pdf, ext: "pdf" })
  if (image && (format !== "pdf" || !pdf)) files.push({ url: image, ext: extension(image, "png") })
  return files
}

/**
 * Fetches each file straight from the bucket (its CORS rule already allows GET from the admin app)
 * and streams it into one ZIP, one file at a time, so the browser never holds more than the archive.
 * Files that could not be fetched are listed in missing.txt instead of failing the whole download.
 */
export async function zipCredentials(items: CredentialLite[], format: ZipFormat, onProgress: (done: number, total: number) => void) {
  const planned = items.flatMap((item) => filesOf(item, format).map((file) => ({ item, ...file })))
  const missing: string[] = items.filter((item) => !filesOf(item, format).length)
    .map((item) => `${item.code}\t${item.recipient_name}\t${item.render_status === "DONE" ? "no file" : `drawing ${item.render_status.toLowerCase()}`}`)
  const used = new Set<string>()
  let done = 0

  async function* entries() {
    for (const file of planned) {
      const folder = safe(file.item.title)
      let name = `${folder}/${safe(file.item.team_name)} - ${safe(file.item.recipient_name)} - ${file.item.code}.${file.ext}`
      for (let copy = 2; used.has(name); copy += 1) name = name.replace(/(?: \(\d+\))?\.(\w+)$/, ` (${copy}).$1`)
      used.add(name)
      try {
        const response = await fetch(file.url, { mode: "cors", cache: "no-store" })
        if (!response.ok) throw new Error(String(response.status))
        yield { name, input: await response.blob(), lastModified: new Date() }
      } catch {
        missing.push(`${file.item.code}\t${file.item.recipient_name}\t${file.ext} could not be fetched`)
      }
      done += 1
      onProgress(done, planned.length)
    }
    if (missing.length) yield { name: "missing.txt", input: `Credential\tRecipient\tProblem\n${missing.join("\n")}\n`, lastModified: new Date() }
  }

  const blob = await downloadZip(entries()).blob()
  return { blob, files: planned.length, missing: missing.length }
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function zipName(prefix: string) {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.zip`
}
