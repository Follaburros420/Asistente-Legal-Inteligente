const FOLDERS_REMOVED_MESSAGE =
  "Folder system was removed from the database. Disable folder UI before using these actions."

export const getFoldersByWorkspaceId = async (_workspaceId: string) => {
  return []
}

export const createFolder = async (_data: any) => {
  throw new Error(FOLDERS_REMOVED_MESSAGE)
}

export const updateFolder = async (_id: string, _data: any) => {
  throw new Error(FOLDERS_REMOVED_MESSAGE)
}

export const deleteFolder = async (_id: string) => {
  throw new Error(FOLDERS_REMOVED_MESSAGE)
}

