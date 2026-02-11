import { supabase } from "@/lib/supabase/robust-client"
import { TablesInsert, TablesUpdate } from "@/supabase/types"

export const getAssistantById = async (assistantId: string) => {
  const { data: assistant, error } = await supabase
    .from("assistants")
    .select("*")
    .eq("id", assistantId)
    .single()

  if (!assistant) {
    throw new Error(error?.message || "Assistant not found")
  }

  return assistant
}

export const getAssistantWorkspacesByWorkspaceId = async (workspaceId: string) => {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      `
      id,
      name,
      assistants (*)
    `
    )
    .eq("id", workspaceId)
    .single()

  if (!workspace) {
    throw new Error(error?.message || "Workspace not found")
  }

  return workspace
}

export const getAssistantWorkspacesByAssistantId = async (assistantId: string) => {
  const { data: assistant, error } = await supabase
    .from("assistants")
    .select(
      `
      id,
      name,
      workspaces (*)
    `
    )
    .eq("id", assistantId)
    .single()

  if (!assistant) {
    throw new Error(error?.message || "Assistant not found")
  }

  return assistant
}

export const createAssistant = async (
  assistant: TablesInsert<"assistants">,
  workspaceId: string
) => {
  const { data: createdAssistant, error } = await supabase
    .from("assistants")
    .insert([assistant])
    .select("*")
    .single()

  if (error || !createdAssistant) {
    throw new Error(error?.message || "Failed to create assistant")
  }

  await createAssistantWorkspace({
    user_id: createdAssistant.user_id,
    assistant_id: createdAssistant.id,
    workspace_id: workspaceId
  })

  return createdAssistant
}

export const createAssistants = async (
  assistants: TablesInsert<"assistants">[],
  workspaceId: string
) => {
  if (assistants.length === 0) return []

  const { data: createdAssistants, error } = await supabase
    .from("assistants")
    .insert(assistants)
    .select("*")

  if (error || !createdAssistants) {
    throw new Error(error?.message || "Failed to create assistants")
  }

  await createAssistantWorkspaces(
    createdAssistants.map(assistant => ({
      user_id: assistant.user_id,
      assistant_id: assistant.id,
      workspace_id: workspaceId
    }))
  )

  return createdAssistants
}

export const createAssistantWorkspace = async (item: {
  user_id: string
  assistant_id: string
  workspace_id: string
}) => {
  const { data: createdAssistantWorkspace, error } = await supabase
    .from("assistant_workspaces")
    .insert([item])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return createdAssistantWorkspace
}

export const createAssistantWorkspaces = async (
  items: TablesInsert<"assistant_workspaces">[]
) => {
  if (items.length === 0) return []

  const { data: createdAssistantWorkspaces, error } = await supabase
    .from("assistant_workspaces")
    .insert(items)
    .select("*")

  if (error) {
    throw new Error(error.message)
  }

  return createdAssistantWorkspaces
}

export const updateAssistant = async (
  assistantId: string,
  assistant: TablesUpdate<"assistants">
) => {
  const { data: updatedAssistant, error } = await supabase
    .from("assistants")
    .update(assistant)
    .eq("id", assistantId)
    .select("*")
    .single()

  if (error || !updatedAssistant) {
    throw new Error(error?.message || "Failed to update assistant")
  }

  return updatedAssistant
}

export const deleteAssistant = async (assistantId: string) => {
  const { error } = await supabase
    .from("assistants")
    .delete()
    .eq("id", assistantId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}

export const deleteAssistantWorkspace = async (
  assistantId: string,
  workspaceId: string
) => {
  const { error } = await supabase
    .from("assistant_workspaces")
    .delete()
    .eq("assistant_id", assistantId)
    .eq("workspace_id", workspaceId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}
