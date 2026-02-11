import {
  getObjectProxyUrl,
  uploadObjectFromClient
} from "@/lib/storage/client-object-storage"

export const uploadMessageImage = async (path: string, image: File) => {
  const imageSizeLimit = 6000000 // 6MB

  if (image.size > imageSizeLimit) {
    throw new Error(`Image must be less than ${imageSizeLimit / 1000000}MB`)
  }

  await uploadObjectFromClient({
    bucket: "message_images",
    path,
    file: image
  })

  return path
}

export const getMessageImageFromStorage = async (filePath: string) => {
  return getObjectProxyUrl("message_images", filePath)
}
