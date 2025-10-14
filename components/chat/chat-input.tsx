import { ChatbotUIContext } from "@/context/context"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { cn } from "@/lib/utils"
import {
  IconBolt,
  IconCirclePlus,
  IconPlayerStopFilled,
  IconSend
} from "@tabler/icons-react"
import Image from "next/image"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Input } from "../ui/input"
import { PlaceholdersAndVanishInput } from "../ui/placeholders-and-vanish-input"
import { ChatCommandInput } from "./chat-command-input"
import { ChatFilesDisplay } from "./chat-files-display"
import { useChatHandler } from "./chat-hooks/use-chat-handler"
import { useChatHistoryHandler } from "./chat-hooks/use-chat-history"
import { usePromptAndCommand } from "./chat-hooks/use-prompt-and-command"
import { useSelectFileHandler } from "./chat-hooks/use-select-file-handler"

interface ChatInputProps {}

export const ChatInput: FC<ChatInputProps> = ({}) => {
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
    isGenerating,
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
    assistantImages
  } = useContext(ChatbotUIContext)

  const {
    chatInputRef,
    handleSendMessage,
    handleStopMessage,
    handleFocusChatInput
  } = useChatHandler()

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


  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isTyping && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      setIsPromptPickerOpen(false)
      handleSendMessage(userInput, chatMessages, false)
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
            `Images are not supported for this model. Use models like GPT-4 Vision instead.`
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
        <div className="absolute bottom-[76px] left-0 z-[60] max-h-[300px] w-full overflow-auto rounded-xl dark:border-none">
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

        <PlaceholdersAndVanishInput
          placeholders={[
            "¿Cuáles son los requisitos para una demanda de responsabilidad civil?",
            "Redacta una tutela por violación al debido proceso",
            "Busca jurisprudencia sobre contratos laborales en Colombia",
            "¿Qué dice el Código Civil sobre la posesión de inmuebles?",
            "Analiza este contrato y extrae las cláusulas de penalización",
            "¿Cuál es el procedimiento para una acción de cumplimiento?",
            "Escribe un derecho de petición para solicitar información pública"
          ]}
          textareaRef={chatInputRef}
          value={userInput}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => setIsTyping(true)}
          onCompositionEnd={() => setIsTyping(false)}
          disabled={isGenerating}
          leftElement={
            <IconCirclePlus
              className="cursor-pointer p-1 hover:opacity-50"
              size={32}
              onClick={() => {
                console.log('Botón de subida de archivos clickeado')
                console.log('fileInputRef.current:', fileInputRef.current)
                console.log('filesToAccept:', filesToAccept)
                fileInputRef.current?.click()
              }}
            />
          }
          rightElement={
            isGenerating ? (
              <IconPlayerStopFilled
                className="hover:bg-background animate-pulse cursor-pointer rounded bg-transparent p-1"
                onClick={handleStopMessage}
                size={30}
              />
            ) : (
              <IconSend
                className={cn(
                  "bg-primary text-secondary cursor-pointer rounded p-1 transition-opacity hover:opacity-80",
                  !userInput && "cursor-not-allowed opacity-50"
                )}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('Botón de enviar clickeado')
                  console.log('userInput:', userInput)
                  console.log('userInput length:', userInput?.length)
                  if (!userInput) {
                    console.log('No hay userInput, no se envía mensaje')
                    return
                  }
                  console.log('Enviando mensaje...')
                  handleSendMessage(userInput, chatMessages, false)
                }}
                size={30}
              />
            )
          }
        />
      </div>
    </>
  )
}
