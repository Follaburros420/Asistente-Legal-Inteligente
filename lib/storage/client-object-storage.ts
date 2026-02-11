interface ClientUploadInput {
  file: File
  path: string
  bucket: "files" | "message_images" | "profile_images" | "workspace_images" | "assistant_images"
  oldPath?: string
  workspaceId?: string
  assistantId?: string
}

function buildObjectUrl(
  bucket: ClientUploadInput["bucket"],
  path: string,
  download = false
): string {
  const params = new URLSearchParams({
    bucket,
    path
  })
  if (download) {
    params.set("download", "1")
  }
  return `/api/storage/object?${params.toString()}`
}

export function getObjectProxyUrl(
  bucket: ClientUploadInput["bucket"],
  path: string,
  options?: { download?: boolean }
): string {
  return buildObjectUrl(bucket, path, options?.download || false)
}

export async function uploadObjectFromClient(input: ClientUploadInput): Promise<{
  path: string
  url: string
}> {
  const formData = new FormData()
  formData.append("file", input.file)
  formData.append("bucket", input.bucket)
  formData.append("path", input.path)
  if (input.oldPath) {
    formData.append("old_path", input.oldPath)
  }
  if (input.workspaceId) {
    formData.append("workspace_id", input.workspaceId)
  }
  if (input.assistantId) {
    formData.append("assistant_id", input.assistantId)
  }

  const response = await fetch("/api/storage/upload", {
    method: "POST",
    body: formData
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload?.path) {
    throw new Error(payload?.error || "Error subiendo archivo")
  }

  return {
    path: payload.path,
    url: payload.url || buildObjectUrl(input.bucket, payload.path, false)
  }
}

export async function deleteObjectFromClient(
  bucket: ClientUploadInput["bucket"],
  path: string
): Promise<void> {
  const url = buildObjectUrl(bucket, path, false)
  const response = await fetch(url, {
    method: "DELETE"
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error || "Error eliminando archivo")
  }
}
