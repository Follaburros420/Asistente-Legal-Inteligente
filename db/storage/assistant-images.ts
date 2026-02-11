import { Tables } from "@/supabase/types"
import {
  getObjectProxyUrl,
  uploadObjectFromClient
} from "@/lib/storage/client-object-storage"

export const uploadAssistantImage = async (
  assistant: Tables<"assistants">,
  image: File
) => {
  const imageSizeLimit = 6000000 // 6MB

  if (image.size > imageSizeLimit) {
    throw new Error(`Image must be less than ${imageSizeLimit / 1000000}MB`)
  }

  const currentPath = assistant.image_path || ""
  const filePath = `${assistant.user_id}/${assistant.id}/${Date.now()}`

  const result = await uploadObjectFromClient({
    bucket: "assistant_images",
    path: filePath,
    oldPath: currentPath.length > 0 ? currentPath : undefined,
    assistantId: assistant.id,
    file: image
  })

  return result.path
}

export const getAssistantImageFromStorage = async (filePath: string) => {
  return getObjectProxyUrl("assistant_images", filePath)
}
