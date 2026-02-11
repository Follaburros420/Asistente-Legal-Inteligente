import { Tables } from "@/supabase/types"
import {
  getObjectProxyUrl,
  uploadObjectFromClient
} from "@/lib/storage/client-object-storage"

export const uploadWorkspaceImage = async (
  workspace: Tables<"workspaces">,
  image: File
) => {
  const imageSizeLimit = 6000000 // 6MB

  if (image.size > imageSizeLimit) {
    throw new Error(`Image must be less than ${imageSizeLimit / 1000000}MB`)
  }

  const currentPath = workspace.image_path || ""
  const filePath = `${workspace.user_id}/${workspace.id}/${Date.now()}`

  const result = await uploadObjectFromClient({
    bucket: "workspace_images",
    path: filePath,
    oldPath: currentPath.length > 0 ? currentPath : undefined,
    workspaceId: workspace.id,
    file: image
  })

  return result.path
}

export const getWorkspaceImageFromStorage = async (filePath: string) => {
  return getObjectProxyUrl("workspace_images", filePath)
}
