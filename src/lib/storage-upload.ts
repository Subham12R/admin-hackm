export type SignedUpload =
  | { object_key: string; method: "POST"; url: string; fields: Record<string, string> }
  | { object_key: string; method: "PUT"; url: string; headers: Record<string, string> }

/**
 * Send the file with the presigned POST (AWS S3) or PUT (Cloudflare R2 and other S3-compatible stores).
 * XMLHttpRequest rather than fetch, because only XHR reports upload progress.
 */
export function sendToStorage(signed: SignedUpload, file: File, onProgress: (fraction: number) => void) {
  return new Promise<boolean>((resolve) => {
    const request = new XMLHttpRequest()
    request.open(signed.method, signed.url)
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total) }
    request.onload = () => resolve(request.status >= 200 && request.status < 300)
    request.onerror = () => resolve(false)
    if (signed.method === "PUT") {
      for (const [name, value] of Object.entries(signed.headers)) request.setRequestHeader(name, value)
      request.send(file)
      return
    }
    const form = new FormData()
    for (const [name, value] of Object.entries(signed.fields)) form.append(name, value)
    form.append("file", file)
    request.send(form)
  })
}
