import { ALIContext } from "@/context/context"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { cn } from "@/lib/utils"
import { Plus, Square } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Input } from "../ui/input"
import { ModernSendIcon } from "../ui/placeholders-and-vanish-input"
import { ChatInputArea } from "./chat-input-area"
import { ChatCommandInput } from "./chat-command-input"
import { ChatFilesDisplay } from "./chat-files-display"
import { useChatHandlerV2 } from "./chat-hooks/use-chat-handler-v2"
import { useChatHistoryHandler } from "./chat-hooks/use-chat-history"
import { usePromptAndCommand } from "./chat-hooks/use-prompt-and-command"
import { useSelectFileHandler } from "./chat-hooks/use-select-file-handler"
import { CreateFileModal } from "../modals/CreateFileModal"
import { DeepResearchToggle } from "./deep-research-toggle"

interface ChatInputProps { }

export const ChatInput: FC<ChatInputProps> = ({ }) => {
  const { t } = useTranslation()

  useHotkey("l", () => {
    handleFocusChatInput()
  })

  const [isTyping, setIsTyping] = useState<boolean>(false)

  const {
    isAssistantPickerOpen,
    focusAssistant,
    setFocusAssistant,
    userInput,
    chatMessages,
    streamPhase,
    selectedPreset,
    selectedAssistant,
    focusPrompt,
    setFocusPrompt,
    focusFile,
    focusTool,
    setFocusTool,
    isToolPickerOpen,
    isPromptPickerOpen,
    setIsPromptPickerOpen,
    isFilePickerOpen,
    setFocusFile,
    chatSettings,
    selectedTools,
    setSelectedTools,
    assistantImages,
    showPlaceholderSuggestions,
    setShowPlaceholderSuggestions,
    deepResearchEnabled,
    setDeepResearchEnabled
  } = useContext(ALIContext)

  const {
    handleSendMessage,
    handleStopMessage
  } = useChatHandlerV2()
  
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const handleFocusChatInput = () => chatInputRef.current?.focus()

  const { handleInputChange } = usePromptAndCommand()

  const { filesToAccept, handleSelectDeviceFile } = useSelectFileHandler()

  const {
    setNewMessageContentToNextUserMessage,
    setNewMessageContentToPreviousUserMessage
  } = useChatHistoryHandler()

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => {
      handleFocusChatInput()
    }, 200) // FIX: hacky
  }, [selectedPreset, selectedAssistant])


  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isTyping && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      setIsPromptPickerOpen(false)

      // Desactivar sugerencias después de enviar la primera pregunta
      if (showPlaceholderSuggestions) {
        setShowPlaceholderSuggestions(false)
      }

      handleSendMessage(userInput, chatMessages, false)
      handleInputChange("") // Explicitly clear input
    }

    // Consolidate conditions to avoid TypeScript error
    if (
      isPromptPickerOpen ||
      isFilePickerOpen ||
      isToolPickerOpen ||
      isAssistantPickerOpen
    ) {
      if (
        event.key === "Tab" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown"
      ) {
        event.preventDefault()
        // Toggle focus based on picker type
        if (isPromptPickerOpen) setFocusPrompt(!focusPrompt)
        if (isFilePickerOpen) setFocusFile(!focusFile)
        if (isToolPickerOpen) setFocusTool(!focusTool)
        if (isAssistantPickerOpen) setFocusAssistant(!focusAssistant)
      }
    }

    if (event.key === "ArrowUp" && event.shiftKey && event.ctrlKey) {
      event.preventDefault()
      setNewMessageContentToPreviousUserMessage()
    }

    if (event.key === "ArrowDown" && event.shiftKey && event.ctrlKey) {
      event.preventDefault()
      setNewMessageContentToNextUserMessage()
    }

    //use shift+ctrl+up and shift+ctrl+down to navigate through chat history
    if (event.key === "ArrowUp" && event.shiftKey && event.ctrlKey) {
      event.preventDefault()
      setNewMessageContentToPreviousUserMessage()
    }

    if (event.key === "ArrowDown" && event.shiftKey && event.ctrlKey) {
      event.preventDefault()
      setNewMessageContentToNextUserMessage()
    }

    if (
      isAssistantPickerOpen &&
      (event.key === "Tab" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown")
    ) {
      event.preventDefault()
      setFocusAssistant(!focusAssistant)
    }
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    const imagesAllowed = LLM_LIST.find(
      llm => llm.modelId === chatSettings?.model
    )?.imageInput

    const items = event.clipboardData.items
    for (const item of items) {
      if (item.type.indexOf("image") === 0) {
        if (!imagesAllowed) {
          toast.error(
            `Las imágenes no son compatibles con este modelo. Usa modelos como GPT-4 Vision en su lugar.`
          )
          return
        }
        const file = item.getAsFile()
        if (!file) return
        handleSelectDeviceFile(file)
      }
    }
  }

  return (
    <>
      <div className="flex flex-col flex-wrap justify-center gap-1">
        <ChatFilesDisplay />

        {/* Selector de Colección - Oculto por defecto */}

        {/* Herramientas de búsqueda habilitadas automáticamente - Ocultas */}

        {selectedAssistant && (
          <div className="border-primary mx-auto flex w-fit items-center space-x-2 rounded-lg border p-1.5">
            {selectedAssistant.image_path && (
              <Image
                className="rounded"
                src={
                  assistantImages.find(
                    img => img.path === selectedAssistant.image_path
                  )?.base64
                }
                width={28}
                height={28}
                alt={selectedAssistant.name}
              />
            )}

            <div className="text-sm font-bold">
              Hablando con {selectedAssistant.name}
            </div>
          </div>
        )}
      </div>

      <div className="relative mt-3 w-full">
        <div className="absolute bottom-[76px] left-0 z-[60] max-h-[300px] w-full overflow-auto rounded-xl dark:border-none pointer-events-none">
          <ChatCommandInput />
        </div>

        {/* Hidden input to select files from device */}
        <Input
          ref={fileInputRef}
          className="hidden"
          type="file"
          onChange={e => {
            if (!e.target.files || e.target.files.length === 0) return
            const file = e.target.files[0]
            if (file) {
              handleSelectDeviceFile(file)
            }
          }}
          accept={filesToAccept}
        />

        <ChatInputArea
          textareaRef={chatInputRef}
          value={userInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => setIsTyping(true)}
          onCompositionEnd={() => setIsTyping(false)}
          disabled={streamPhase === "streaming" || streamPhase === "classifying" || streamPhase === "searching"}
          showSuggestions={showPlaceholderSuggestions}
          placeholders={[
            "¿Cuáles son los requisitos para una demanda de responsabilidad civil?",
            "Redacta una tutela por violación al debido proceso",
            "Busca jurisprudencia sobre contratos laborales en Colombia",
            "¿Qué dice el Código Civil sobre la posesión de inmuebles?",
            "Analiza este contrato y extrae las cláusulas de penalización",
            "¿Cuál es el procedimiento para una acción de cumplimiento?",
            "Escribe un derecho de petición para solicitar información pública"
          ]}
          leftElement={
            <div className="flex items-center gap-2">
              <DeepResearchToggle
                enabled={deepResearchEnabled}
                onToggle={setDeepResearchEnabled}
                disabled={streamPhase === "streaming" || streamPhase === "classifying" || streamPhase === "searching"}
              />
              <CreateFileModal onFileCreated={(file) => {
                console.log('Archivo creado:', file)
              }}>
                <motion.div
                  whileHover={{ scale: 1.05, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  className={cn(
                    "flex items-center justify-center",
                    "w-10 h-10 rounded-xl",
                    "bg-muted/50 hover:bg-muted",
                    "cursor-pointer transition-colors duration-200",
                    "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Plus className="w-5 h-5" />
                </motion.div>
              </CreateFileModal>
            </div>
          }
          rightElement={
            (streamPhase === "streaming" || streamPhase === "classifying" || streamPhase === "searching") ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStopMessage}
                className={cn(
                  "flex items-center justify-center",
                  "w-10 h-10 rounded-xl",
                  "bg-muted hover:bg-destructive/80",
                  "cursor-pointer transition-all duration-200",
                  "border border-border hover:border-destructive"
                )}
              >
                <Square className="w-4 h-4 text-muted-foreground hover:text-destructive-foreground fill-current transition-colors" />
              </motion.button>
            ) : (
              <ModernSendIcon
                onClick={() => {
                  if (!userInput) return

                  // Desactivar sugerencias después de enviar la primera pregunta
                  if (showPlaceholderSuggestions) {
                    setShowPlaceholderSuggestions(false)
                  }

                  if (userInput.trim()) {
                handleSendMessage(userInput, chatMessages, false)
              }
                  handleInputChange("") // Explicitly clear input
                }}
                disabled={!userInput}
              />
            )
          }
        />
      </div>
    </>
  )
}
