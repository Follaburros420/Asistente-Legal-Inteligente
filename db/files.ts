import { supabase } from "@/lib/supabase/robust-client"
import { TablesInsert, TablesUpdate } from "@/supabase/types"
import mammoth from "mammoth"
import { toast } from "sonner"
import { uploadFile } from "./storage/files"

type FileInsertInput = Omit<TablesInsert<"files">, "workspace_id">

export const getFileById = async (fileId: string) => {
  const { data: file, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", fileId)
    .single()

  if (!file) {
    throw new Error(error.message)
  }

  return file
}

export const getFileWorkspacesByWorkspaceId = async (workspaceId: string) => {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      `
      id,
      name,
      files (*)
    `
    )
    .eq("id", workspaceId)
    .single()

  if (!workspace) {
    throw new Error(error.message)
  }

  return workspace
}

export const getFileWorkspacesByFileId = async (fileId: string) => {
  const { data: file, error } = await supabase
    .from("files")
    .select(
      `
      id, 
      name, 
      workspaces (*)
    `
    )
    .eq("id", fileId)
    .single()

  if (!file) {
    throw new Error(error.message)
  }

  return file
}

export const createFileBasedOnExtension = async (
  file: File,
  fileRecord: FileInsertInput,
  workspace_id: string,
  embeddingsProvider: "openai" | "local" | "openrouter"
) => {
  const fileExtension = file.name.split(".").pop()

  if (fileExtension === "docx") {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({
      arrayBuffer
    })

    return createDocXFile(
      result.value,
      file,
      fileRecord,
      workspace_id,
      embeddingsProvider
    )
  } else {
    return createFile(file, fileRecord, workspace_id, embeddingsProvider)
  }
}

// For non-docx files
export const createFile = async (
  file: File,
  fileRecord: FileInsertInput,
  workspace_id: string,
  embeddingsProvider: "openai" | "local" | "openrouter"
) => {
  let validFilename = fileRecord.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()
  const extension = file.name.split(".").pop()
  const extensionIndex = validFilename.lastIndexOf(".")
  const baseName = validFilename.substring(0, (extensionIndex < 0) ? undefined : extensionIndex)
  const maxBaseNameLength = 100 - (extension?.length || 0) - 1
  if (baseName.length > maxBaseNameLength) {
    fileRecord.name = baseName.substring(0, maxBaseNameLength) + "." + extension
  } else {
    fileRecord.name = baseName + "." + extension
  }
  const fileRow: TablesInsert<"files"> = {
    ...fileRecord,
    workspace_id
  }

  const { data: createdFile, error } = await supabase
    .from("files")
    .insert([fileRow])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const filePath = await uploadFile(file, {
    name: createdFile.name,
    user_id: createdFile.user_id,
    file_id: createdFile.name
  })

  await updateFile(createdFile.id, {
    file_path: filePath
  })

  const formData = new FormData()
  formData.append("file_id", createdFile.id)
  formData.append("embeddingsProvider", embeddingsProvider)

  const response = await fetch("/api/retrieval/process", {
    method: "POST",
    body: formData
  })

  if (!response.ok) {
    const responseText = await response.text()
    let errorMessage = "Error desconocido al procesar el archivo"
    
    try {
      // Try to parse as JSON
      const json = JSON.parse(responseText)
      errorMessage = json.message || json.error || errorMessage
    } catch (e) {
      // If it's not JSON (e.g., HTML error page), use the status text
      errorMessage = `Error ${response.status}: ${response.statusText}`
      console.error("Response was not JSON:", responseText.substring(0, 200))
    }
    
    console.error(
      `Error processing file:${createdFile.id}, status:${response.status}, response:${errorMessage}`
    )
    toast.error("Failed to process file. Reason: " + errorMessage, {
      duration: 10000
    })
    await deleteFile(createdFile.id)
  }

  const fetchedFile = await getFileById(createdFile.id)

  return fetchedFile
}

// // Handle docx files
export const createDocXFile = async (
  text: string,
  file: File,
  fileRecord: FileInsertInput,
  workspace_id: string,
  embeddingsProvider: "openai" | "local" | "openrouter"
) => {
  const fileRow: TablesInsert<"files"> = {
    ...fileRecord,
    workspace_id
  }

  const { data: createdFile, error } = await supabase
    .from("files")
    .insert([fileRow])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const filePath = await uploadFile(file, {
    name: createdFile.name,
    user_id: createdFile.user_id,
    file_id: createdFile.name
  })

  await updateFile(createdFile.id, {
    file_path: filePath
  })

  // Use the general process endpoint with FormData (same as other file types)
  // The endpoint will download the file from storage and process it
  const formData = new FormData()
  formData.append("file_id", createdFile.id)
  formData.append("embeddingsProvider", embeddingsProvider)

  const response = await fetch("/api/retrieval/process", {
    method: "POST",
    body: formData
  })

  if (!response.ok) {
    const responseText = await response.text()
    let errorMessage = "Error desconocido al procesar el archivo"
    
    try {
      // Try to parse as JSON
      const json = JSON.parse(responseText)
      errorMessage = json.message || json.error || errorMessage
    } catch (e) {
      // If it's not JSON (e.g., HTML error page), use the status text
      errorMessage = `Error ${response.status}: ${response.statusText}`
      console.error("Response was not JSON:", responseText.substring(0, 200))
    }
    
    console.error(
      `Error processing file:${createdFile.id}, status:${response.status}, response:${errorMessage}`
    )
    toast.error("Failed to process file. Reason: " + errorMessage, {
      duration: 10000
    })
    await deleteFile(createdFile.id)
  }

  const fetchedFile = await getFileById(createdFile.id)

  return fetchedFile
}

export const createFiles = async (
  files: FileInsertInput[],
  workspace_id: string
) => {
  const filesWithWorkspace = files.map(file => ({
    ...file,
    workspace_id
  }))

  const { data: createdFiles, error } = await supabase
    .from("files")
    .insert(filesWithWorkspace)
    .select("*")

  if (error) {
    throw new Error(error.message)
  }

  return createdFiles
}

export const createFileWorkspace = async (item: {
  user_id: string
  file_id: string
  workspace_id: string
}) => {
  const { data: updatedFile, error } = await supabase
    .from("files")
    .update({ workspace_id: item.workspace_id })
    .eq("id", item.file_id)
    .eq("user_id", item.user_id)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return updatedFile
}

export const createFileWorkspaces = async (
  items: { user_id: string; file_id: string; workspace_id: string }[]
) => {
  if (items.length === 0) return []

  const workspaceId = items[0].workspace_id
  const fileIds = items.map(item => item.file_id)

  const { data: updatedFiles, error } = await supabase
    .from("files")
    .update({ workspace_id: workspaceId })
    .in("id", fileIds)
    .select("*")

  if (error) throw new Error(error.message)

  return updatedFiles
}

export const updateFile = async (
  fileId: string,
  file: TablesUpdate<"files">
) => {
  const { data: updatedFile, error } = await supabase
    .from("files")
    .update(file)
    .eq("id", fileId)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return updatedFile
}

export const deleteFile = async (fileId: string) => {
  const { error } = await supabase.from("files").delete().eq("id", fileId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}

export const deleteFileWorkspace = async (
  fileId: string,
  workspaceId: string
) => {
  const { data: file, error } = await supabase
    .from("files")
    .select("id, workspace_id")
    .eq("id", fileId)
    .single()

  if (error) throw new Error(error.message)
  if (file.workspace_id !== workspaceId) return true

  return true
}
