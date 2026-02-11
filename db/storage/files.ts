import { toast } from "sonner"
import {
  deleteObjectFromClient,
  getObjectProxyUrl,
  uploadObjectFromClient
} from "@/lib/storage/client-object-storage"

export const uploadFile = async (
  file: File,
  payload: {
    name: string
    user_id: string
    file_id: string
  }
) => {
  const SIZE_LIMIT = parseInt(
    process.env.NEXT_PUBLIC_USER_FILE_SIZE_LIMIT || "10000000"
  )

  if (file.size > SIZE_LIMIT) {
    throw new Error(
      `File must be less than ${Math.floor(SIZE_LIMIT / 1000000)}MB`
    )
  }

  const filePath = `${payload.user_id}/${Buffer.from(payload.file_id).toString("base64")}`

  const { path } = await uploadObjectFromClient({
    bucket: "files",
    path: filePath,
    file
  })

  return path
}

export const deleteFileFromStorage = async (filePath: string) => {
  try {
    await deleteObjectFromClient("files", filePath)
  } catch {
    toast.error("Failed to remove file!")
  }
}

export const getFileFromStorage = async (filePath: string) => {
  return getObjectProxyUrl("files", filePath, { download: true })
}
