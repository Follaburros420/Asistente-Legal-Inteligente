import { TablesInsert } from "@/supabase/types"
import {
  createProcessFile,
  deleteProcessFile,
  getProcessFilesByProcessId
} from "./process-files"

type CollectionFileInput = TablesInsert<"process_files">

export const getCollectionFilesByCollectionId = async (collectionId: string) => {
  const result = await getProcessFilesByProcessId(collectionId)
  return { files: result.files || [] }
}

export const createCollectionFile = async (data: CollectionFileInput) => {
  return createProcessFile(data)
}

export const createCollectionFiles = async (dataArray: CollectionFileInput[]) => {
  if (dataArray.length === 0) return []
  return Promise.all(dataArray.map(data => createProcessFile(data)))
}

export const deleteCollectionFile = async (
  collectionId: string,
  fileId: string
) => {
  return deleteProcessFile(collectionId, fileId)
}
