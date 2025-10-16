"use client"

import { useCallback, useContext } from "react"
import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import { ChatFile } from "@/types"
import { toast } from "sonner"

interface AttachOptions {
  sourceName?: string
}

const mapToChatFile = (file: Tables<"files">): ChatFile => ({
  id: file.id,
  name: file.name,
  type: file.type || "file",
  file: null
})

export const useAttachFilesToChat = () => {
  const { setChatFiles, setShowFilesDisplay, setUseRetrieval } =
    useContext(ChatbotUIContext)

  return useCallback(
    (filesToAttach: Tables<"files">[], options: AttachOptions = {}) => {
      if (!filesToAttach || filesToAttach.length === 0) {
        toast.info("No hay archivos para agregar al contexto del chat.")
        return
      }

      let filesToAdd: ChatFile[] = []

      setChatFiles(prev => {
        const existingIds = new Set(prev.map(file => file.id))
        const uniqueRecords = filesToAttach.filter(
          file => file && !existingIds.has(file.id)
        )

        filesToAdd = uniqueRecords.map(mapToChatFile)

        if (filesToAdd.length === 0) {
          return prev
        }

        return [...prev, ...filesToAdd]
      })

      if (filesToAdd.length === 0) {
        toast.info("Los archivos seleccionados ya están disponibles en el chat.")
        return
      }

      setShowFilesDisplay(true)
      setUseRetrieval(true)

      const label =
        options.sourceName ||
        (filesToAdd.length === 1
          ? filesToAdd[0].name
          : `${filesToAdd.length} archivos`)

      toast.success(
        `Se añadieron ${filesToAdd.length} archivo${
          filesToAdd.length > 1 ? "s" : ""
        } de ${label} al contexto del chat.`
      )
    },
    [setChatFiles, setShowFilesDisplay, setUseRetrieval]
  )
}
