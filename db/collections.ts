import { supabase } from "@/lib/supabase/robust-client"
import { TablesInsert, TablesUpdate } from "@/supabase/types"
import {
  createProcess,
  createProcesses,
  deleteProcess,
  getProcessById,
  getProcessWorkspacesByWorkspaceId,
  updateProcess
} from "./processes"

type CollectionWorkspaceInput = {
  user_id: string
  process_id: string
  workspace_id: string
}

export const getCollectionById = async (collectionId: string) => {
  return getProcessById(collectionId)
}

export const getCollectionWorkspacesByWorkspaceId = async (workspaceId: string) => {
  const result = await getProcessWorkspacesByWorkspaceId(workspaceId)

  return {
    id: result.id,
    name: result.name,
    collections: result.processes ?? []
  }
}

export const getCollectionWorkspacesByCollectionId = async (
  collectionId: string
) => {
  const process = await getProcessById(collectionId)

  if (!process.workspace_id) {
    return { id: process.id, name: process.name, workspaces: [] }
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", process.workspace_id)
    .single()

  if (error || !workspace) {
    return { id: process.id, name: process.name, workspaces: [] }
  }

  return { id: process.id, name: process.name, workspaces: [workspace] }
}

export const createCollection = async (
  collection: TablesInsert<"processes">,
  workspaceId: string
) => {
  return createProcess(collection, workspaceId)
}

export const createCollections = async (
  collections: TablesInsert<"processes">[],
  workspaceId: string
) => {
  return createProcesses(collections, workspaceId)
}

export const updateCollection = async (
  collectionId: string,
  collection: TablesUpdate<"processes">
) => {
  return updateProcess(collectionId, collection)
}

export const deleteCollection = async (collectionId: string) => {
  return deleteProcess(collectionId)
}

export const deleteCollectionWorkspace = async (
  collectionId: string,
  workspaceId: string
) => {
  const process = await getProcessById(collectionId)

  // Processes are single-workspace entities. Re-assignment happens in createCollectionWorkspaces.
  if (process.workspace_id !== workspaceId) {
    return true
  }

  return true
}

export const createCollectionWorkspaces = async (
  items: CollectionWorkspaceInput[],
  _workspaceId?: string
) => {
  if (items.length === 0) return []

  const latestByProcess = new Map<string, CollectionWorkspaceInput>()
  for (const item of items) {
    latestByProcess.set(item.process_id, item)
  }

  const updatedProcesses = []
  for (const item of latestByProcess.values()) {
    const updated = await updateProcess(item.process_id, {
      workspace_id: item.workspace_id
    })
    updatedProcesses.push(updated)
  }

  return updatedProcesses
}
