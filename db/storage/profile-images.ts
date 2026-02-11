import { Tables } from "@/supabase/types"
import { uploadObjectFromClient } from "@/lib/storage/client-object-storage"

export const uploadProfileImage = async (
  profile: Tables<"profiles">,
  image: File
) => {
  const imageSizeLimit = 2000000 // 2MB

  if (image.size > imageSizeLimit) {
    throw new Error(`Image must be less than ${imageSizeLimit / 1000000}MB`)
  }

  const currentPath = profile.image_path || ""
  const filePath = `${profile.user_id}/${Date.now()}`

  const { path, url } = await uploadObjectFromClient({
    bucket: "profile_images",
    path: filePath,
    oldPath: currentPath.length > 0 ? currentPath : undefined,
    file: image
  })

  return {
    path,
    url
  }
}
