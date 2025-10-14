import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { createFolder } from "@/db/folders"
import { ContentType } from "@/types"
import { IconFolderPlus, IconPlus } from "@tabler/icons-react"
import { FC, useContext, useState } from "react"
import { Button } from "../ui/button"
import { CreateAssistant } from "./items/assistants/create-assistant"
import { CreateCollection } from "./items/collections/create-collection"
import { CreateFile } from "./items/files/create-file"
import { CreateTool } from "./items/tools/create-tool"

interface SidebarCreateButtonsProps {
  contentType: ContentType
  hasData: boolean
}

export const SidebarCreateButtons: FC<SidebarCreateButtonsProps> = ({
  contentType,
  hasData
}) => {
  const { profile, selectedWorkspace, folders, setFolders } =
    useContext(ChatbotUIContext)
  const { handleNewChat } = useChatHandler()

  const [isCreatingFile, setIsCreatingFile] = useState(false)
  const [isCreatingCollection, setIsCreatingCollection] = useState(false)
  const [isCreatingAssistant, setIsCreatingAssistant] = useState(false)
  const [isCreatingTool, setIsCreatingTool] = useState(false)

  const handleCreateFolder = async () => {
    if (!profile) return
    if (!selectedWorkspace) return

    const createdFolder = await createFolder({
      user_id: profile.user_id,
      workspace_id: selectedWorkspace.id,
      name: "Nueva Carpeta",
      description: "",
      type: contentType
    })
    setFolders([...folders, createdFolder])
  }

  const getCreateButtonLabel = (contentType: ContentType): string => {
    const labels: Record<ContentType, string> = {
      chats: "Conversación",
      presets: "Preajuste",
      prompts: "Instrucción",
      files: "Archivo",
      collections: "Colección",
      assistants: "Agente",
      tools: "Herramienta",
      models: "Modelo"
    }
    return labels[contentType] || contentType
  }

  const getCreateFunction = () => {
    switch (contentType) {
      case "chats":
        return async () => {
          handleNewChat()
        }

      case "files":
        return async () => {
          setIsCreatingFile(true)
        }

      case "collections":
        return async () => {
          setIsCreatingCollection(true)
        }

      case "assistants":
        return async () => {
          setIsCreatingAssistant(true)
        }

      case "tools":
        return async () => {
          setIsCreatingTool(true)
        }

      default:
        break
    }
  }

  return (
    <div className="flex w-full space-x-2">
      <Button className="flex h-[36px] grow" onClick={getCreateFunction()}>
        <IconPlus className="mr-1" size={20} />
        Nuevo {getCreateButtonLabel(contentType)}
      </Button>

      {hasData && (
        <Button className="size-[36px] p-1" onClick={handleCreateFolder}>
          <IconFolderPlus size={20} />
        </Button>
      )}

      {isCreatingFile && (
        <CreateFile isOpen={isCreatingFile} onOpenChange={setIsCreatingFile} />
      )}

      {isCreatingCollection && (
        <CreateCollection
          isOpen={isCreatingCollection}
          onOpenChange={setIsCreatingCollection}
        />
      )}

      {isCreatingAssistant && (
        <CreateAssistant
          isOpen={isCreatingAssistant}
          onOpenChange={setIsCreatingAssistant}
        />
      )}

      {isCreatingTool && (
        <CreateTool isOpen={isCreatingTool} onOpenChange={setIsCreatingTool} />
      )}
    </div>
  )
}
