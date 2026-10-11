import { api } from "@/lib/api"
import { sendToStorage, type SignedUpload } from "@/lib/storage-upload"

export type FieldKind =
  | "recipient_name" | "team_name" | "event_name" | "stage_name" | "placement" | "track" | "issue_date" | "credential_id" | "text" | "qr"

/** One placed field. Positions and sizes are fractions of the artwork (see the backend's src/credentials/render.py). */
export type LayoutField = {
  field: FieldKind
  x: number
  y: number
  size: number
  font: string
  color: string
  align: "left" | "center" | "right"
  max_width: number
  text: string
  prefix: string
  uppercase: boolean
}

export type Counts = { DRAFT: number; PUBLISHED: number; REVOKED: number }

export type CertificateType = {
  id: string
  stage_id: string
  name: string
  category: "PARTICIPATION" | "WINNER" | "OTHER"
  background_key: string
  background_url: string | null
  width: number
  height: number
  layout: LayoutField[]
  issue_date: string | null
  counts: Counts
}

export type CertificateTypes = { configured: boolean; fonts: string[]; fields: FieldKind[]; items: CertificateType[] }

export type BadgeDefinition = {
  id: string
  stage_id: string | null
  name: string
  description: string
  criteria: string
  image_key: string
  image_url: string | null
  counts: Counts
}

export type Candidate = {
  member_id: string
  name: string
  email: string
  role: string
  registration_id: string
  team_name: string
  team_id: string
  finalist: boolean
  submitted: boolean
  checked_in: boolean
  awards: { label: string; track: string }[]
  placement: string
  track: string
  issued: { id: string; code: string; status: string } | null
}

export type IssuedCredential = {
  id: string
  code: string
  kind: "CERTIFICATE" | "BADGE"
  title: string
  certificate_type_id: string | null
  badge_definition_id: string | null
  stage_id: string | null
  member_id: string | null
  team_id: string
  recipient_name: string
  recipient_email: string
  team_name: string
  placement: string
  track: string
  has_own_image: boolean
  status: "DRAFT" | "PUBLISHED" | "REVOKED"
  render_status: "PENDING" | "DONE" | "FAILED"
  render_error: string | null
  version: number
  issued_at: string
  issued_by: string | null
  published_at: string | null
  revoked_at: string | null
  revoked_reason: string | null
  verify_url: string
  image_url: string | null
  pdf_url: string | null
}

export const FIELD_LABELS: Record<FieldKind, string> = {
  recipient_name: "Recipient name",
  team_name: "Team name",
  event_name: "Hackathon name",
  stage_name: "Event name",
  placement: "Placement",
  track: "Track",
  issue_date: "Issue date",
  credential_id: "Credential ID",
  text: "Fixed text",
  qr: "QR code (verify link)",
}

/** What each field shows in the editor; the server preview draws real sample values. */
export const FIELD_SAMPLES: Record<FieldKind, string> = {
  recipient_name: "Aarav Sharma",
  team_name: "Team Byte Bandits",
  event_name: "HackMatrix 2026",
  stage_name: "Hack Day",
  placement: "Winner",
  track: "Health",
  issue_date: "14 November 2026",
  credential_id: "HMX-SAMP-LE00",
  text: "",
  qr: "",
}

export const CATEGORY_LABELS: Record<CertificateType["category"], string> = {
  PARTICIPATION: "Participation",
  WINNER: "Winner (placement from awards)",
  OTHER: "Other",
}

export const FONT_LABELS: Record<string, string> = {
  sans: "Sans (Poppins)",
  "sans-semibold": "Sans semibold",
  "sans-bold": "Sans bold",
  serif: "Serif (Playfair Display)",
  script: "Script (Great Vibes)",
  mono: "Mono (Space Mono)",
}

/** CSS stand-ins for the server's fonts, so the editor's chips look roughly like the result. */
export const FONT_CSS: Record<string, { family: string; weight: number; style?: string }> = {
  sans: { family: "ui-sans-serif, system-ui, sans-serif", weight: 400 },
  "sans-semibold": { family: "ui-sans-serif, system-ui, sans-serif", weight: 600 },
  "sans-bold": { family: "ui-sans-serif, system-ui, sans-serif", weight: 700 },
  serif: { family: "Georgia, 'Times New Roman', serif", weight: 400 },
  script: { family: "'Brush Script MT', 'Segoe Script', cursive", weight: 400, style: "italic" },
  mono: { family: "ui-monospace, monospace", weight: 400 },
}

export function newField(field: FieldKind, overrides: Partial<LayoutField> = {}): LayoutField {
  return {
    field, x: 0.5, y: 0.5, size: field === "qr" ? 0.16 : 0.04, font: "sans", color: "#1c0704", align: "center",
    max_width: 0, text: field === "text" ? "Certificate of Participation" : "", prefix: "Credential ID: ", uppercase: false, ...overrides,
  }
}

/** A sensible starting layout for fresh artwork; everything can be dragged afterwards. */
export function defaultLayout(category: CertificateType["category"]): LayoutField[] {
  return [
    newField("recipient_name", { y: 0.44, size: 0.08, font: "script", max_width: 0.7 }),
    newField("team_name", { y: 0.56, size: 0.032 }),
    newField("stage_name", { y: 0.62, size: 0.032, font: "sans-semibold" }),
    ...(category === "WINNER" ? [newField("placement", { y: 0.7, size: 0.04, font: "sans-bold" })] : []),
    newField("issue_date", { x: 0.08, y: 0.86, size: 0.025, align: "left" }),
    newField("credential_id", { x: 0.08, y: 0.91, size: 0.022, font: "mono", align: "left" }),
    newField("qr", { x: 0.8, y: 0.72, size: 0.18 }),
  ]
}

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]

/** Sign, upload straight to storage, and report the key with the image's pixel size. */
export async function uploadCredentialImage(purpose: "TEMPLATE" | "BADGE", file: File, onProgress: (fraction: number) => void = () => {}) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Use a PNG, JPEG or WebP image.")
  if (file.size > 15 * 1024 * 1024) throw new Error("Images can be at most 15 MB.")
  let width = 0
  let height = 0
  try {
    const bitmap = await createImageBitmap(file)
    width = bitmap.width
    height = bitmap.height
    bitmap.close()
  } catch {
    throw new Error("That image could not be read.")
  }
  const signed = await api<SignedUpload & { url: string }>("/api/admin/credentials/uploads", {
    method: "POST", body: { purpose, content_type: file.type, size_bytes: file.size },
  })
  if (!(await sendToStorage(signed, file, onProgress))) throw new Error("The image could not reach storage. Check the bucket's CORS rule.")
  return { key: signed.object_key, url: signed.url, width, height }
}
