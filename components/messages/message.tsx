import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import { LLM, LLMID, MessageImage, ModelProvider } from "@/types"
import {
  IconBolt,
  IconCaretDownFilled,
  IconCaretRightFilled,
  IconCircleFilled,
  IconFileText,
  IconMoodSmile,
  IconPencil
} from "@tabler/icons-react"
import Image from "next/image"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { ModelIcon } from "../models/model-icon"
import { Button } from "../ui/button"
import { FileIcon } from "../ui/file-icon"
import { FilePreview } from "../ui/file-preview"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { WithTooltip } from "../ui/with-tooltip"
import { MessageActions } from "./message-actions"
import { MessageMarkdown } from "./message-markdown"
import { DocumentViewer } from "../chat/document-viewer"
import { MessageBubble } from "../chat/modern/MessageBubble"
import { BibliographySection } from "../chat/bibliography-section"
import { useBibliographyParser } from "../chat/use-bibliography-parser"
import { toast } from "sonner"

const ICON_SIZE = 32

interface MessageProps {
  message: Tables<"messages">
  fileItems: Tables<"file_items">[]
  isEditing: boolean
  isLast: boolean
  onStartEdit: (message: Tables<"messages">) => void
  onCancelEdit: () => void
  onSubmitEdit: (value: string, sequenceNumber: number) => void
}

export const Message: FC<MessageProps> = ({
  message,
  fileItems,
  isEditing,
  isLast,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit
}) => {
  const {
    assistants,
    profile,
    isGenerating,
    setIsGenerating,
    firstTokenReceived,
    availableLocalModels,
    availableOpenRouterModels,
    chatMessages,
    selectedAssistant,
    chatImages,
    assistantImages,
    toolInUse,
    files,
    models
  } = useContext(ChatbotUIContext)

  const { handleSendMessage } = useChatHandler()

  const editInputRef = useRef<HTMLTextAreaElement>(null)

  const [isHovering, setIsHovering] = useState(false)
  const [editedMessage, setEditedMessage] = useState(message.content)

  const [showImagePreview, setShowImagePreview] = useState(false)
  const [selectedImage, setSelectedImage] = useState<MessageImage | null>(null)
  
  // Parsear bibliografía del mensaje
  const { bibliographyItems, contentWithoutBibliography } = useBibliographyParser(message.content)
  const displayContent =
    contentWithoutBibliography && contentWithoutBibliography.length > 0
      ? contentWithoutBibliography
      : message.content

  const [showFileItemPreview, setShowFileItemPreview] = useState(false)
  const [selectedFileItem, setSelectedFileItem] =
    useState<Tables<"file_items"> | null>(null)

  const [viewSources, setViewSources] = useState(false)

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(message.content)
      toast.success("Copiado al portapapeles")
    } else {
      const textArea = document.createElement("textarea")
      textArea.value = message.content
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      toast.success("Copiado al portapapeles")
    }
  }

  const handleSendEdit = () => {
    onSubmitEdit(editedMessage, message.sequence_number)
    onCancelEdit()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isEditing && event.key === "Enter" && event.metaKey) {
      handleSendEdit()
    }
  }

  const handleRegenerate = async () => {
    setIsGenerating(true)
    await handleSendMessage(
      editedMessage || chatMessages[chatMessages.length - 2].message.content,
      chatMessages,
      true
    )
  }

  const handleStartEdit = () => {
    onStartEdit(message)
  }

  useEffect(() => {
    setEditedMessage(message.content)

    if (isEditing && editInputRef.current) {
      const input = editInputRef.current
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    }
  }, [isEditing])

  const MODEL_DATA = [
    ...models.map(model => ({
      modelId: model.model_id as LLMID,
      modelName: model.name,
      provider: "custom" as ModelProvider,
      hostedId: model.id,
      platformLink: "",
      imageInput: false
    })),
    ...LLM_LIST,
    ...availableLocalModels,
    ...availableOpenRouterModels
  ].find(llm => llm.modelId === message.model) as LLM

  const messageAssistantImage = assistantImages.find(
    image => image.assistantId === message.assistant_id
  )?.base64

  const selectedAssistantImage = assistantImages.find(
    image => image.path === selectedAssistant?.image_path
  )?.base64

  const modelDetails = LLM_LIST.find(model => model.modelId === message.model)

  // Detectar si el mensaje es un documento legal estructurado
  const isLegalDocument = 
    message.role === "assistant" && 
    (message.content.includes("<h1>") || message.content.includes("<h2>")) &&
    (message.content.includes("demanda") ||
     message.content.includes("tutela") ||
     message.content.includes("contrato") ||
     message.content.includes("documento legal") ||
     message.content.includes("memorial") ||
     message.content.includes("derecho de petición") ||
     message.assistant_id && assistants.find(a => 
       a.id === message.assistant_id && 
       (a.name.toLowerCase().includes("redacción") || a.name.toLowerCase().includes("redaccion"))
     ))

  const fileAccumulator: Record<
    string,
    {
      id: string
      name: string
      count: number
      type: string
      description: string
    }
  > = {}

  const fileSummary = fileItems.reduce((acc, fileItem) => {
    const parentFile = files.find(file => file.id === fileItem.file_id)
    if (parentFile) {
      if (!acc[parentFile.id]) {
        acc[parentFile.id] = {
          id: parentFile.id,
          name: parentFile.name,
          count: 1,
          type: parentFile.type,
          description: parentFile.description
        }
      } else {
        acc[parentFile.id].count += 1
      }
    }
    return acc
  }, fileAccumulator)

  // Determinar la imagen del avatar
  const getAvatarImage = () => {
    if (message.role === "assistant") {
      return messageAssistantImage || selectedAssistantImage || undefined
    }
    return profile?.image_url || undefined
  }

  // Determinar el nombre
  const getUserName = () => {
    if (message.role === "assistant") {
      return message.assistant_id
        ? assistants.find(assistant => assistant.id === message.assistant_id)?.name
        : selectedAssistant?.name || MODEL_DATA?.modelName || "Asistente Legal"
    }
    return profile?.display_name || profile?.username || "Usuario"
  }

  // Contenido del mensaje
  const renderMessageContent = () => {
    if (!firstTokenReceived && isGenerating && isLast && message.role === "assistant") {
      return (
        <>
          {(() => {
            switch (toolInUse) {
              case "none":
                return <IconCircleFilled className="animate-pulse" size={20} />
              case "retrieval":
                return (
                  <div className="flex animate-pulse items-center space-x-2">
                    <IconFileText size={20} />
                    <div>Buscando archivos...</div>
                  </div>
                )
              default:
                return (
                  <div className="flex flex-col animate-pulse space-y-1">
                    <div className="flex items-center space-x-2">
                      <IconBolt size={20} />
                      <div>Pensando a profundidad...</div>
                    </div>
                    <div className="text-xs text-muted-foreground ml-7">
                      Buscando en fuentes oficiales colombianas
                    </div>
                  </div>
                )
            }
          })()}
        </>
      )
    }
    
    if (isEditing) {
      return (
        <div className="space-y-4">
          <TextareaAutosize
            textareaRef={editInputRef}
            className="text-md"
            value={editedMessage}
            onValueChange={setEditedMessage}
            maxRows={20}
          />
          <div className="flex justify-center space-x-2">
            <Button size="sm" onClick={handleSendEdit}>
              Guardar y Enviar
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelEdit}>
              Cancelar
            </Button>
          </div>
        </div>
      )
    }
    
    if (isLegalDocument) {
      return <DocumentViewer content={message.content} messageId={message.id} />
    }
    
    return <MessageMarkdown content={displayContent} />
  }

  // Si es mensaje del sistema, usar el diseño simple
  if (message.role === "system") {
    return (
      <MessageBubble
        variant="system"
        content={message.content}
        timestamp={new Date(message.created_at)}
      />
    )
  }

  return (
    <div
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onKeyDown={handleKeyDown}
    >
      <MessageBubble
        variant={message.role === "user" ? "user" : "ai"}
        content=""
        timestamp={new Date(message.created_at)}
        avatar={getAvatarImage()}
        userName={getUserName()}
        status={message.role === "user" ? "delivered" : undefined}
        onCopy={message.role === "assistant" ? handleCopy : undefined}
        onRegenerate={message.role === "assistant" && isLast ? handleRegenerate : undefined}
      >
        <div className="space-y-3">
          {/* Contenido del mensaje */}
          {renderMessageContent()}

          {/* Bibliografía */}
          {bibliographyItems.length > 0 && (
            <BibliographySection items={bibliographyItems} />
          )}

          {/* File items */}
          {fileItems.length > 0 && (
          <div className="border-primary mt-6 border-t pt-4 font-bold">
            {!viewSources ? (
              <div
                className="flex cursor-pointer items-center text-lg hover:opacity-50"
                onClick={() => setViewSources(true)}
              >
                {fileItems.length}
                {fileItems.length > 1 ? " Sources " : " Source "}
                from {Object.keys(fileSummary).length}{" "}
                {Object.keys(fileSummary).length > 1 ? "Files" : "File"}{" "}
                <IconCaretRightFilled className="ml-1" />
              </div>
            ) : (
              <>
                <div
                  className="flex cursor-pointer items-center text-lg hover:opacity-50"
                  onClick={() => setViewSources(false)}
                >
                  {fileItems.length}
                  {fileItems.length > 1 ? " Sources " : " Source "}
                  from {Object.keys(fileSummary).length}{" "}
                  {Object.keys(fileSummary).length > 1 ? "Files" : "File"}{" "}
                  <IconCaretDownFilled className="ml-1" />
                </div>

                <div className="mt-3 space-y-4">
                  {Object.values(fileSummary).map((file, index) => (
                    <div key={index}>
                      <div className="flex items-center space-x-2">
                        <div>
                          <FileIcon type={file.type} />
                        </div>

                        <div className="truncate">{file.name}</div>
                      </div>

                      {fileItems
                        .filter(fileItem => {
                          const parentFile = files.find(
                            parentFile => parentFile.id === fileItem.file_id
                          )
                          return parentFile?.id === file.id
                        })
                        .map((fileItem, index) => (
                          <div
                            key={index}
                            className="ml-8 mt-1.5 flex cursor-pointer items-center space-x-2 hover:opacity-50"
                            onClick={() => {
                              setSelectedFileItem(fileItem)
                              setShowFileItemPreview(true)
                            }}
                          >
                            <div className="text-sm font-normal">
                              <span className="mr-1 text-lg font-bold">-</span>{" "}
                              {fileItem.content.substring(0, 200)}...
                            </div>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          )}

          {/* Images */}
          <div className="mt-3 flex flex-wrap gap-2">
            {message.image_paths.map((path, index) => {
              const item = chatImages.find(image => image.path === path)

              return (
                <Image
                  key={index}
                  className="cursor-pointer rounded hover:opacity-50"
                  src={path.startsWith("data") ? path : item?.base64}
                  alt="message image"
                  width={300}
                  height={300}
                  onClick={() => {
                    setSelectedImage({
                      messageId: message.id,
                      path,
                      base64: path.startsWith("data") ? path : item?.base64 || "",
                      url: path.startsWith("data") ? "" : item?.url || "",
                      file: null
                    })

                    setShowImagePreview(true)
                  }}
                  loading="lazy"
                />
              )
            })}
          </div>
        </div>
      </MessageBubble>

      <>
        {showImagePreview && selectedImage && (
          <FilePreview
            type="image"
            item={selectedImage}
            isOpen={showImagePreview}
            onOpenChange={(isOpen: boolean) => {
              setShowImagePreview(isOpen)
              setSelectedImage(null)
            }}
          />
        )}

        {showFileItemPreview && selectedFileItem && (
          <FilePreview
            type="file_item"
            item={selectedFileItem}
            isOpen={showFileItemPreview}
            onOpenChange={(isOpen: boolean) => {
              setShowFileItemPreview(isOpen)
              setSelectedFileItem(null)
            }}
          />
        )}
      </>
    </div>
  )
}
