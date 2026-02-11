import { supabase } from "@/lib/supabase/robust-client"
import { TablesInsert } from "@/supabase/types"

type AssistantCollectionInput = TablesInsert<"assistant_collections">

const normalizeAssistantCollection = (
  input: AssistantCollectionInput | string,
  assistantId?: string,
  collectionId?: string
): AssistantCollectionInput => {
  if (typeof input !== "string") {
    return input
  }

  if (!assistantId || !collectionId) {
    throw new Error(
      "Missing assistant_id/collection_id for assistant_collections insert"
    )
  }

  return {
    user_id: input,
    assistant_id: assistantId,
    collection_id: collectionId
  }
}

export const getAssistantCollectionsByAssistantId = async (
  assistantId: string
) => {
  const { data: links, error: linksError } = await supabase
    .from("assistant_collections")
    .select("collection_id")
    .eq("assistant_id", assistantId)

  if (linksError) {
    throw new Error(linksError.message)
  }

  const collectionIds = Array.from(new Set((links || []).map(link => link.collection_id)))
  if (collectionIds.length === 0) {
    return { collections: [] }
  }

  const { data: processes, error: processError } = await supabase
    .from("processes")
    .select("*")
    .in("id", collectionIds)

  if (processError) {
    throw new Error(processError.message)
  }

  const processById = new Map((processes || []).map(process => [process.id, process]))
  const orderedProcesses = collectionIds
    .map(collectionId => processById.get(collectionId))
    .filter(Boolean)

  return { collections: orderedProcesses }
}

export const createAssistantCollections = async (
  items: AssistantCollectionInput[]
) => {
  if (items.length === 0) return []

  const { data, error } = await supabase
    .from("assistant_collections")
    .insert(items)
    .select("*")

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export const createAssistantCollection = async (
  input: AssistantCollectionInput | string,
  assistantId?: string,
  collectionId?: string
) => {
  const payload = normalizeAssistantCollection(input, assistantId, collectionId)

  const { data, error } = await supabase
    .from("assistant_collections")
    .insert([payload])
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Failed to create assistant_collection")
  }

  return data
}

export const deleteAssistantCollection = async (
  assistantIdOrUserId: string,
  collectionIdOrAssistantId: string,
  maybeCollectionId?: string
) => {
  const assistantId = maybeCollectionId
    ? collectionIdOrAssistantId
    : assistantIdOrUserId
  const collectionId = maybeCollectionId ?? collectionIdOrAssistantId

  const { error } = await supabase
    .from("assistant_collections")
    .delete()
    .eq("assistant_id", assistantId)
    .eq("collection_id", collectionId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}
