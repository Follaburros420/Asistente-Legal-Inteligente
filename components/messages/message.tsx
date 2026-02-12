import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ALIContext } from "@/context/context"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { BibliographyItem } from "@/types/chat-message"
import { LLM, LLMID, MessageImage, ModelProvider } from "@/types"
import { Database } from "@/supabase/types"
type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
import {
  IconCaretDownFilled,
  IconCaretRightFilled,
  IconCircleFilled,
  IconFileText,
  IconMoodSmile,
  IconPencil
} from "@tabler/icons-react"
import Image from "next/image"
import { FC, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
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
import { SuggestedQuestions } from "../chat/suggested-questions"
import { useSuggestedQuestions } from "@/lib/hooks/use-suggested-questions"
import { toast } from "sonner"
import { AnswerView } from "./answer-view"
import { CitationsPanel } from "./citations-panel"
import { parseModelAnswer } from "@/lib/parsers/model-answer"
import { processStreamContent } from "@/lib/stream-processor"
import { DocumentSheet } from "../chat/document-sheet"
import { DocumentEditor } from "@/components/chat/document-editor"
import { LegalDraft } from "@/types/draft"

const ICON_SIZE = 32

interface MessageProps {
  message: Tables<"messages">
  fileItems: Tables<"file_items">[]
  bibliography?: BibliographyItem[]
  thinking?: string  // Proceso de razonamiento del agente
  draft?: LegalDraft // Borrador legal estructurado
  isEditing: boolean
  isLast: boolean
  onStartEdit: (message: Tables<"messages">) => void
  onCancelEdit: () => void
  onSubmitEdit: (value: string, sequenceNumber: number) => void
}

export const Message: FC<MessageProps> = ({
  message,
  fileItems,
  bibliography,
  thinking,
  draft: draftFromProps,
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
    models,
    suggestedQuestions,
    setSuggestedQuestions,
    showSuggestedQuestions,
    setShowSuggestedQuestions,
    setUserInput,
    selectedWorkspace,
    selectedChat
  } = useContext(ALIContext)

  const router = useRouter()
  const { handleSendMessage } = useChatHandler()
  const { generateSuggestedQuestions } = useSuggestedQuestions()

  const editInputRef = useRef<HTMLTextAreaElement>(null)

  const [isHovering, setIsHovering] = useState(false)
  const [editedMessage, setEditedMessage] = useState(message.content)

  const [showImagePreview, setShowImagePreview] = useState(false)
  const [selectedImage, setSelectedImage] = useState<MessageImage | null>(null)

  // Estado para documento editable
  const [showDocumentEditor, setShowDocumentEditor] = useState(false)
  const [documentContent, setDocumentContent] = useState("")

  // Procesar contenido para detectar documentos y razonamiento
  const processedContent = useMemo(() => {
    if (message.role === "assistant") {
      return processStreamContent(message.content)
    }
    return null
  }, [message.content, message.role])

  const assistantAnswer = useMemo(
    () =>
      message.role === "assistant"
        ? parseModelAnswer(message.content, { citationsFromBackend: bibliography })
        : { text: message.content },
    [message.content, message.role, bibliography]
  )

  const assistantCitations = assistantAnswer.citations ?? []
  const [viewSources, setViewSources] = useState(false)
  const [showFileItemPreview, setShowFileItemPreview] = useState(false)
  const [selectedFileItem, setSelectedFileItem] = useState<Tables<"file_items"> | null>(null)

  // Sincronizar contenido del documento cuando se detecta
  useEffect(() => {
    if (processedContent && processedContent.isDocument && processedContent.documentContent) {
      setDocumentContent(processedContent.documentContent)
    }
  }, [processedContent])

  // Generar preguntas sugeridas cuando el mensaje del asistente esté completo
  useEffect(() => {
    if (
      message.role === "assistant" &&
      isLast &&
      !isGenerating &&
      firstTokenReceived &&
      message.content.length > 100 // Solo para respuestas sustanciales
    ) {
      const generateQuestions = async () => {
        // Obtener la pregunta del usuario anterior
        const userMessage = chatMessages.find(
          (msg, index) =>
            msg.message.sequence_number === message.sequence_number - 1 &&
            msg.message.role === "user"
        )

        if (userMessage) {
          const questions = await generateSuggestedQuestions(
            message.content,
            userMessage.message.content,
            chatMessages.map(msg => msg.message.content)
          )

          setSuggestedQuestions(questions)
          setShowSuggestedQuestions(true)
        }
      }

      generateQuestions()
    }
  }, [message.role, isLast, isGenerating, firstTokenReceived, message.content, chatMessages, generateSuggestedQuestions, setSuggestedQuestions, setShowSuggestedQuestions])

  const handleCopy = () => {
    const textToCopy = message.role === "assistant" ? assistantAnswer.text : message.content

    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy)
      toast.success("Copiado al portapapeles")
    } else {
      const textArea = document.createElement("textarea")
      textArea.value = textToCopy
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

  // Handle branching the chat from this message
  const handleBranchChat = () => {
    // Navigate to a new chat with the context up to this message
    if (selectedWorkspace) {
      // Store the branch context in sessionStorage
      const branchContext = chatMessages
        .filter(msg => msg.message.sequence_number <= message.sequence_number)
        .map(msg => ({
          role: msg.message.role,
          content: msg.message.content
        }))
      sessionStorage.setItem('branchChatContext', JSON.stringify(branchContext))
      router.push(`/${selectedWorkspace.id}/chat`)
      toast.success("Nuevo chat creado desde este punto")
    }
  }

  // Handle reporting a message
  const handleReport = () => {
    // In production, this would open a report modal or send to moderation
    toast.info("Gracias por tu reporte. Lo revisaremos pronto.")
  }

  // Handle liking a message
  const handleLike = () => {
    // In production, this would save the feedback
    toast.success("¡Gracias por tu feedback!")
  }

  // Handle disliking a message
  const handleDislike = () => {
    // In production, this would save the feedback and optionally ask for more details
    toast.info("Gracias por tu feedback. Trabajaremos para mejorar.")
  }

  const handleSuggestedQuestionClick = (question: string) => {
    setUserInput(question)
    setShowSuggestedQuestions(false)
    // El usuario puede enviar la pregunta manualmente o podemos enviarla automáticamente
    // handleSendMessage(question, chatMessages, false)
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
    // Solo mostrar indicador de carga si es el último mensaje del asistente y está generando
    if (!firstTokenReceived && isGenerating && isLast && message.role === "assistant") {
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">Pensando</span>
          <div className="flex space-x-1">
            <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" />
          </div>
        </div>
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

    if (message.role === "assistant") {
      // Priorizar draft del prop (viene del stream processing)
      let draft: LegalDraft | null = draftFromProps || null

      // Si no hay draft en props, intentar parsear del contenido
      if (!draft) {
        let draftContent = assistantAnswer.text

        // Usar utilidad de validación para mejor parsing
        const { validateDraftContent } = require("@/lib/utils/draft-utils")
        const { tryConvertToDraft } = require("@/lib/utils/draft-converter")

        // Primero intentar como JSON
        const validation = validateDraftContent(draftContent)

        if (validation.valid && validation.draft) {
          draft = validation.draft
        } else {
          // Intentar extraer JSON si está envuelto en markdown
          const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/
          const match = draftContent.match(jsonBlockRegex)

          if (match) {
            const revalidation = validateDraftContent(match[1])
            if (revalidation.valid && revalidation.draft) {
              draft = revalidation.draft
            }
          } else if (draftContent.trim().startsWith('{') && draftContent.includes('"type": "draft"')) {
            // Intentar parsear directamente (puede estar incompleto durante streaming)
            try {
              // Buscar el JSON completo incluso si está incompleto
              const jsonStart = draftContent.indexOf('{')
              if (jsonStart !== -1) {
                // Intentar encontrar el cierre del JSON
                let braceCount = 0
                let jsonEnd = jsonStart
                for (let i = jsonStart; i < draftContent.length; i++) {
                  if (draftContent[i] === '{') braceCount++
                  if (draftContent[i] === '}') braceCount--
                  if (braceCount === 0) {
                    jsonEnd = i + 1
                    break
                  }
                }
                const jsonCandidate = draftContent.substring(jsonStart, jsonEnd)
                const candidateValidation = validateDraftContent(jsonCandidate)
                if (candidateValidation.valid && candidateValidation.draft) {
                  draft = candidateValidation.draft
                }
              }
            } catch (e) {
              // Si falla el parseo, intentar convertir desde texto
            }
          }

          // Si aún no hay draft, intentar convertir desde texto plano
          // (útil cuando el modelo no genera JSON)
          if (!draft) {
            const convertedDraft = tryConvertToDraft(draftContent, message.content)
            if (convertedDraft) {
              draft = convertedDraft
              console.log("📄 Draft convertido desde texto plano")
            }
          }
        }
      }

      if (draft) {
        // Handler para cambios en el draft (persistencia local)
        const handleDraftChange = (newContent: string) => {
          // Guardar en estado local si es necesario
          // Por ahora solo actualizamos el estado del componente
          // En el futuro se podría guardar en metadata del mensaje
        }

        return <DocumentEditor draft={draft} onContentChange={handleDraftChange} />
      }

      return <AnswerView text={assistantAnswer.text} />
    }

    return <MessageMarkdown content={message.content} />
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
        content={message.role === "assistant" ? assistantAnswer.text : message.content}
        timestamp={new Date(message.created_at)}
        avatar={getAvatarImage()}
        userName={getUserName()}
        status={message.role === "user" ? "delivered" : undefined}
        onCopy={message.role === "assistant" ? handleCopy : undefined}
        onRegenerate={message.role === "assistant" && isLast ? handleRegenerate : undefined}
        onBranchChat={message.role === "assistant" ? handleBranchChat : undefined}
        onReport={message.role === "assistant" ? handleReport : undefined}
        onLike={message.role === "assistant" ? handleLike : undefined}
        onDislike={message.role === "assistant" ? handleDislike : undefined}
        isLast={isLast}
        isGenerating={isGenerating && isLast}
      >
        <div className="space-y-3">
          {/* Contenido del mensaje */}
          {renderMessageContent()}

          {/* Botón para abrir editor de documento */}
          {processedContent && processedContent.isDocument && (
            <Button
              variant="outline"
              onClick={() => setShowDocumentEditor(true)}
              className="w-full"
            >
              <IconFileText className="h-4 w-4 mr-2" />
              Ver/Editar Documento Generado
            </Button>
          )}

          {message.role === "assistant" && assistantCitations.length > 0 && (
            <CitationsPanel items={assistantCitations} />
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
                  {fileItems.length > 1 ? " Fuentes " : " Fuente "}
                  from {Object.keys(fileSummary).length}{" "}
                  {Object.keys(fileSummary).length > 1 ? "Archivos" : "Archivo"}{" "}
                  <IconCaretRightFilled className="ml-1" />
                </div>
              ) : (
                <>
                  <div
                    className="flex cursor-pointer items-center text-lg hover:opacity-50"
                    onClick={() => setViewSources(false)}
                  >
                    {fileItems.length}
                    {fileItems.length > 1 ? " Fuentes " : " Fuente "}
                    from {Object.keys(fileSummary).length}{" "}
                    {Object.keys(fileSummary).length > 1 ? "Archivos" : "Archivo"}{" "}
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
                  src={item?.url || item?.base64 || path}
                  alt="message image"
                  width={300}
                  height={300}
                  onClick={() => {
                    setSelectedImage({
                      messageId: message.id,
                      path,
                      base64: item?.base64 || "",
                      url: item?.url || (path.startsWith("data") ? "" : path),
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

      {/* Preguntas sugeridas para mensajes del asistente */}
      {message.role === "assistant" && isLast && (
        <SuggestedQuestions
          questions={suggestedQuestions}
          onQuestionClick={handleSuggestedQuestionClick}
          isVisible={showSuggestedQuestions}
        />
      )}

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

      {/* Sheet para editar documentos */}
      {processedContent && processedContent.isDocument && (
        <DocumentSheet
          open={showDocumentEditor}
          onOpenChange={setShowDocumentEditor}
          content={documentContent}
          onSave={(newContent) => {
            setDocumentContent(newContent)
            toast.success("Documento guardado")
          }}
        />
      )}
    </div>
  )
}
