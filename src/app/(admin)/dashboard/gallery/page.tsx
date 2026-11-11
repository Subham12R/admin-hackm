"use client"

import { useRef, useState } from "react"

import { Badge, Button, ConfirmButton, Empty, Field, LoadingRows, Notice, PageHeader, Panel, TextInput } from "@/components/admin/kit"
import { api, dateTime, errorMessage } from "@/lib/api"
import { notify, toast } from "@/lib/notify"
import { sendToStorage, type SignedUpload } from "@/lib/storage-upload"
import { prepareGalleryPhoto, type PreparedPhoto } from "@/lib/webp"
import { can, keys, useAdminMutation, useAdminQuery, useRoles } from "@/lib/queries"

type Photo = {
  id: string
  url: string | null
  caption: string
  content_type: string
  size_bytes: number
  width: number | null
  height: number | null
  published: boolean
  created_at: string
  uploaded_by: string | null
}

type Gallery = { configured: boolean; max_bytes: number; content_types: string[]; items: Photo[] }
type UploadState = { name: string; size: number; status: "waiting" | "converting" | "uploading" | "done" | "failed"; progress: number; error?: string }

const AREA = [["gallery"]]

/** Sign, upload straight to storage, then register the photo. Bytes never pass through the admin app. */
async function uploadPhoto({ file, width, height }: PreparedPhoto, caption: string, onProgress: (fraction: number) => void) {
  const signed = await api<SignedUpload>("/api/admin/gallery/uploads", { method: "POST", body: { content_type: file.type, size_bytes: file.size } })
  if (!(await sendToStorage(signed, file, onProgress))) throw new Error("The photo could not reach storage. Check the bucket's CORS rule.")
  await api("/api/admin/gallery", { method: "POST", body: { object_key: signed.object_key, caption, width, height } })
}

function ProgressBar({ value, tone = "green" }: { value: number; tone?: "green" | "red" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className={`h-full rounded-full transition-[width] duration-200 ${tone === "red" ? "bg-red-500" : "bg-green-600"}`} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}

function megabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function GalleryPage() {
  const editable = can.eventControl(useRoles())
  const gallery = useAdminQuery<Gallery>(keys.gallery, "/api/admin/gallery")
  const input = useRef<HTMLInputElement>(null)
  const [caption, setCaption] = useState("")
  const [uploads, setUploads] = useState<UploadState[]>([])
  const [captions, setCaptions] = useState<Record<string, string>>({})
  const update = useAdminMutation<{ id: string; body: { caption?: string; published?: boolean } }>(({ id, body }) => ({ path: `/api/admin/gallery/${id}`, method: "PATCH", body }), AREA)
  const remove = useAdminMutation<string>((id) => ({ path: `/api/admin/gallery/${id}`, method: "DELETE" }), AREA)
  const bulk = useAdminMutation<{ ids: string[]; action: "show" | "hide" | "delete" }, { changed: number }>((body) => ({ path: "/api/admin/gallery/bulk", body }), AREA)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const data = gallery.data
  const uploading = uploads.some((item) => item.status === "uploading" || item.status === "converting" || item.status === "waiting")
  const totalBytes = uploads.reduce((sum, item) => sum + item.size, 0)
  const overall = totalBytes ? uploads.reduce((sum, item) => sum + item.size * (item.status === "done" ? 1 : item.progress), 0) / totalBytes : 0
  const finished = uploads.filter((item) => item.status === "done").length
  const failed = uploads.filter((item) => item.status === "failed").length

  async function upload(files: File[]) {
    if (!data) return
    // The size limit is checked after conversion: a large camera original usually shrinks well under it.
    const accepted = files.filter((file) => data.content_types.includes(file.type))
    const rejected = files.length - accepted.length
    if (rejected) toast.error(`${rejected} file${rejected === 1 ? "" : "s"} skipped: use JPEG, PNG, WebP or AVIF.`)
    setUploads(accepted.map((file) => ({ name: file.name, size: file.size, status: "waiting", progress: 0 })))
    const patch = (index: number, change: Partial<UploadState>) =>
      setUploads((current) => current.map((item, position) => position === index ? { ...item, ...change } : item))
    let done = 0
    for (const [index, file] of accepted.entries()) {
      try {
        patch(index, { status: "converting" })
        const prepared = await prepareGalleryPhoto(file)
        if (prepared.file.size > data.max_bytes) throw new Error(`Still ${megabytes(prepared.file.size)} after compression; the limit is ${megabytes(data.max_bytes)}.`)
        patch(index, { status: "uploading", size: prepared.file.size })
        await uploadPhoto(prepared, caption.trim(), (progress) => patch(index, { progress }))
        done += 1
        patch(index, { status: "done", progress: 1 })
        // Refresh after each photo so the grid below fills in while the rest of the batch uploads.
        void gallery.refetch()
      } catch (error) {
        const message = error instanceof Error && !("status" in error) ? error.message : errorMessage(error, "Upload failed.")
        patch(index, { status: "failed", error: message })
      }
    }
    if (done) toast.success(`${done} photo${done === 1 ? "" : "s"} added to the gallery.`)
    if (input.current) input.current.value = ""
  }

  if (gallery.isError) return <Notice tone="red">{errorMessage(gallery.error, "The gallery could not be loaded.")}</Notice>

  const items = data?.items ?? []
  const chosen = items.filter((item) => selected.has(item.id)).map((item) => item.id)

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function runBulk(action: "show" | "hide" | "delete") {
    const done = { show: "made public", hide: "hidden from the site", delete: "deleted" }[action]
    void bulk.mutateAsync({ ids: chosen, action }).then((result) => {
      toast.success(`${result.changed} photo${result.changed === 1 ? "" : "s"} ${done}.`)
      setSelected(new Set())
    }).catch((error: unknown) => toast.error(errorMessage(error, "The bulk action failed.")))
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader title="Gallery" description="Photos shown on the public gallery page at /gallery. Hidden photos stay here but leave the site." />

      {data && !data.configured ? (
        <Notice tone="amber">Photo storage is not configured on the server yet. Set R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_PUBLIC_URL in the backend environment to enable uploads.</Notice>
      ) : null}

      {editable && data?.configured ? (
        <Panel title="Upload photos" description={`JPEG, PNG, WebP or AVIF. Photos are resized to 2400px and converted to WebP in your browser, then go straight to storage (up to ${megabytes(data.max_bytes)} each).`}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Field label="Caption for this batch (optional)">
                <TextInput value={caption} maxLength={300} className="w-full" placeholder="Opening ceremony" onChange={(event) => setCaption(event.target.value)} />
              </Field>
              <input
                ref={input}
                type="file"
                multiple
                accept={data.content_types.join(",")}
                className="hidden"
                onChange={(event) => void upload(Array.from(event.target.files ?? []))}
              />
              <div>
                <Button tone="green" disabled={uploading} onClick={() => input.current?.click()}>
                  {uploading ? "Uploading…" : "Choose photos"}
                </Button>
              </div>
              {uploads.length ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{finished} of {uploads.length} uploaded{failed ? `, ${failed} failed` : ""}</span>
                    <span>{Math.round(overall * 100)}%</span>
                  </div>
                  <ProgressBar value={overall} />
                </div>
              ) : null}
            </div>

            <div className="flex min-h-32 flex-col rounded-xl border border-border p-3">
              <p className="mb-2 text-sm font-medium">Upload queue</p>
              {uploads.length ? (
                <ul className="max-h-80 space-y-2 overflow-y-auto pr-1 text-sm">
                  {uploads.map((item, index) => (
                    <li key={`${item.name}-${index}`} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {item.status === "uploading" ? `${Math.round(item.progress * 100)}% · ` : ""}{megabytes(item.size)}
                        </span>
                        <Badge tone={item.status === "done" ? "green" : item.status === "failed" ? "red" : "amber"}>{item.status}</Badge>
                      </div>
                      <ProgressBar value={item.status === "done" ? 1 : item.progress} tone={item.status === "failed" ? "red" : "green"} />
                      {item.error ? <span className="text-xs text-red-600">{item.error}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Chosen photos show up here with their progress.</p>}
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel title="Photos" description={data ? `${items.filter((item) => item.published).length} public, ${items.filter((item) => !item.published).length} hidden` : undefined}>
        {editable && items.length ? (
          <div role="region" aria-label="Bulk actions" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" aria-label="Select every photo" checked={chosen.length === items.length}
                onChange={(event) => setSelected(event.target.checked ? new Set(items.map((item) => item.id)) : new Set())} />
              {chosen.length ? `${chosen.length} selected` : "Select all"}
            </label>
            {chosen.length ? (
              <>
                <Button disabled={bulk.isPending} onClick={() => runBulk("show")}>Show</Button>
                <Button disabled={bulk.isPending} onClick={() => runBulk("hide")}>Hide</Button>
                <ConfirmButton confirmLabel={`Delete ${chosen.length} for good`} disabled={bulk.isPending} onConfirm={() => runBulk("delete")}>Delete</ConfirmButton>
                <button type="button" className="text-xs underline underline-offset-2" onClick={() => setSelected(new Set())}>Clear</button>
              </>
            ) : null}
          </div>
        ) : null}
        {!data ? <LoadingRows /> : items.length ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((photo) => {
              const draft = captions[photo.id] ?? photo.caption
              return (
                <li key={photo.id} className="flex flex-col overflow-hidden rounded-xl border border-border">
                  <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-muted">
                    {photo.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- bucket URLs are external and already sized for the web
                      <img src={photo.url} alt={photo.caption || "Gallery photo"} loading="lazy" className={`absolute inset-0 size-full object-cover ${photo.published ? "" : "opacity-50"}`} />
                    ) : null}
                    {!photo.published ? <span className="absolute left-2 top-2"><Badge tone="amber">hidden</Badge></span> : null}
                    {editable ? (
                      <input type="checkbox" aria-label={`Select ${photo.caption || "photo"}`} checked={selected.has(photo.id)}
                        onChange={(event) => toggle(photo.id, event.target.checked)}
                        className="absolute right-2 top-2 size-5 accent-sky-600" />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-2">
                    {editable ? (
                      <div className="flex gap-1">
                        <TextInput value={draft} maxLength={300} placeholder="Caption" aria-label="Caption" className="min-w-0 flex-1"
                          onChange={(event) => setCaptions((current) => ({ ...current, [photo.id]: event.target.value }))} />
                        {draft !== photo.caption ? (
                          <Button tone="green" disabled={update.isPending}
                            onClick={() => void notify(update.mutateAsync({ id: photo.id, body: { caption: draft } }), "Caption saved.", () =>
                              setCaptions((current) => { const next = { ...current }; delete next[photo.id]; return next }))}>
                            Save
                          </Button>
                        ) : null}
                      </div>
                    ) : <p className="text-sm">{photo.caption || "No caption"}</p>}
                    <p className="text-xs text-muted-foreground">
                      {megabytes(photo.size_bytes)}{photo.width && photo.height ? ` · ${photo.width}×${photo.height}` : ""} · {dateTime(photo.created_at)}
                      {photo.uploaded_by ? ` · ${photo.uploaded_by}` : ""}
                    </p>
                    {editable ? (
                      <div className="mt-auto flex flex-wrap gap-1">
                        <Button disabled={update.isPending}
                          onClick={() => void notify(update.mutateAsync({ id: photo.id, body: { published: !photo.published } }), photo.published ? "Photo hidden from the site." : "Photo is public again.")}>
                          {photo.published ? "Hide" : "Show"}
                        </Button>
                        <ConfirmButton confirmLabel="Delete photo" disabled={remove.isPending}
                          onConfirm={() => void notify(remove.mutateAsync(photo.id), "Photo deleted.")}>
                          Delete
                        </ConfirmButton>
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : <Empty>No photos yet.</Empty>}
      </Panel>
    </div>
  )
}
