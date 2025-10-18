import { ChatbotUIContext } from "@/context/context"
import { getFileFromStorage } from "@/db/storage/files"
import { getCollectionFilesByCollectionId } from "@/db/collection-files"
import useHotkey from "@/lib/hooks/use-hotkey"
import { cn } from "@/lib/utils"
import { ChatFile, MessageImage } from "@/types"
import { Tables } from "@/supabase/types"
import {
  IconCircleFilled,
  IconFileFilled,
  IconFileTypeCsv,
  IconFileTypeDocx,
  IconFileTypePdf,
  IconFileTypeTxt,
  IconJson,
  IconLoader2,
  IconMarkdown,
  IconX,
  IconEye,
  IconEyeOff,
  IconSettings
} from "@tabler/icons-react"
import Image from "next/image"
import { FC, useContext, useState, useEffect, useMemo } from "react"
import { Button } from "../ui/button"
import { FilePreview } from "../ui/file-preview"
import { WithTooltip } from "../ui/with-tooltip"
import { ChatRetrievalSettings } from "./chat-retrieval-settings"

interface ChatFilesDisplayProps {}

export const ChatFilesDisplay: FC<ChatFilesDisplayProps> = ({}) => {
  useHotkey("f", () => setShowFilesDisplay(prev => !prev))
  useHotkey("e", () => setUseRetrieval(prev => !prev))

  const {
    files,
    newMessageImages,
    setNewMessageImages,
    newMessageFiles,
    setNewMessageFiles,
    setShowFilesDisplay,
    showFilesDisplay,
    chatFiles,
    chatImages,
    setChatImages,
    setChatFiles,
    setUseRetrieval,
    collections
  } = useContext(ChatbotUIContext)

  const [selectedFile, setSelectedFile] = useState<ChatFile | null>(null)
  const [selectedImage, setSelectedImage] = useState<MessageImage | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [processInfo, setProcessInfo] = useState<{[key: string]: string | null}>({})

  // Función para obtener información del proceso de origen
  const getProcessInfo = async (fileId: string) => {
    try {
      // Buscar en qué colección está este archivo
      for (const collection of collections) {
        try {
          const collectionData = await getCollectionFilesByCollectionId(collection.id)
          const hasFile = collectionData.files?.some((file: any) => file.id === fileId)
          if (hasFile) {
            return collection.name
          }
        } catch (error) {
          // Continuar con la siguiente colección si hay error
          continue
        }
      }
      return null // null indica que es un archivo individual
    } catch (error) {
      console.error("Error obteniendo información del proceso:", error)
      return null
    }
  }

  // Calcular estadísticas de archivos
  const fileStats = () => {
    const processFiles = Object.values(processInfo).filter(name => name !== null)
    const individualFiles = Object.values(processInfo).filter(name => name === null)
    const uniqueProcesses = [...new Set(processFiles)]
    
    return {
      processFiles: processFiles.length,
      individualFiles: individualFiles.length,
      uniqueProcesses: uniqueProcesses,
      totalFiles: combinedChatFiles.length
    }
  }

  const messageImages = useMemo(() => [
    ...newMessageImages.filter(
      image =>
        !chatImages.some(chatImage => chatImage.messageId === image.messageId)
    )
  ], [newMessageImages, chatImages])

  const combinedChatFiles = useMemo(() => [
    ...newMessageFiles.filter(
      file => !chatFiles.some(chatFile => chatFile.id === file.id)
    ),
    ...chatFiles
  ], [newMessageFiles, chatFiles])

  const combinedMessageFiles = useMemo(() => [...messageImages, ...combinedChatFiles], [messageImages, combinedChatFiles])

  // Cargar información de procesos cuando cambien los archivos
  useEffect(() => {
    const loadProcessInfo = async () => {
      const info: {[key: string]: string | null} = {}
      for (const file of combinedChatFiles) {
        if (file.id !== "loading") {
          info[file.id] = await getProcessInfo(file.id)
        }
      }
      setProcessInfo(info)
    }
    
    if (combinedChatFiles.length > 0) {
      loadProcessInfo()
    }
  }, [combinedChatFiles, collections])

  const getLinkAndView = async (file: ChatFile) => {
    const fileRecord = files.find(f => f.id === file.id)

    if (!fileRecord) return

    const link = await getFileFromStorage(fileRecord.file_path)
    window.open(link, "_blank")
  }

  if (showFilesDisplay && combinedMessageFiles.length > 0) {
    return (
      <>
        {showPreview && selectedImage && (
          <FilePreview
            type="image"
            item={selectedImage}
            isOpen={showPreview}
            onOpenChange={(isOpen: boolean) => {
              setShowPreview(isOpen)
              setSelectedImage(null)
            }}
          />
        )}

        {showPreview && selectedFile && (
          <FilePreview
            type="file"
            item={selectedFile}
            isOpen={showPreview}
            onOpenChange={(isOpen: boolean) => {
              setShowPreview(isOpen)
              setSelectedFile(null)
            }}
          />
        )}

        <div className="space-y-3">
          {/* Header mejorado con información de archivos */}
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                  <IconFileFilled size={16} />
                  <span>{combinedMessageFiles.length} archivo{combinedMessageFiles.length > 1 ? 's' : ''}</span>
                </div>
                <RetrievalToggle fileCount={combinedMessageFiles.length} />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <WithTooltip
                delayDuration={0}
                side="top"
                display={<div>Configuración de recuperación</div>}
                trigger={
                  <div onClick={e => e.stopPropagation()}>
                    <ChatRetrievalSettings />
                  </div>
                }
              />
              
              <Button
                variant="outline"
                size="sm"
                className="flex items-center space-x-2 h-8 px-3"
                onClick={() => setShowFilesDisplay(false)}
              >
                <IconEyeOff size={16} />
                <span className="text-sm">Ocultar</span>
              </Button>
            </div>
          </div>

          {/* Información de procesos de origen - Solo nombres */}
          {(() => {
            const stats = fileStats()
            const hasProcessFiles = stats.processFiles > 0

            if (!hasProcessFiles) return null // Solo mostrar si hay archivos de procesos

            return (
              <div className="mb-3 p-3 bg-muted/20 rounded-lg border border-border/50">
                <div className="flex items-center space-x-2">
                  <IconFileFilled size={16} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {stats.uniqueProcesses.length === 1
                      ? `${stats.uniqueProcesses[0]}`
                      : `${stats.uniqueProcesses.join(", ")}`
                    }
                  </span>
                </div>
              </div>
            )
          })()}

          <div className="overflow-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-2">
              {messageImages.map((image, index) => (
                <div
                  key={index}
                  className="relative flex h-[64px] cursor-pointer items-center space-x-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors p-2"
                >
                  <div
                    className="flex h-[40px] w-[40px] items-center justify-center rounded-lg bg-primary/10 border border-primary/20 overflow-hidden flex-shrink-0"
                    onClick={() => {
                      setSelectedImage(image)
                      setShowPreview(true)
                    }}
                  >
                    <Image
                      className="rounded-lg object-cover"
                      style={{
                        width: "40px",
                        height: "40px"
                      }}
                      src={image.base64}
                      alt="File image"
                      width={40}
                      height={40}
                    />
                  </div>

                  <div className="flex flex-col justify-center flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">Imagen</div>
                    <div className="text-xs text-muted-foreground">IMAGE</div>
                  </div>

                  <IconX
                    className="flex size-4 cursor-pointer items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground hover:bg-red-500 hover:text-white transition-colors flex-shrink-0"
                    onClick={e => {
                      e.stopPropagation()
                      setNewMessageImages(
                        newMessageImages.filter(
                          f => f.messageId !== image.messageId
                        )
                      )
                    }}
                  />
                </div>
              ))}

              {combinedChatFiles.map((file, index) => (
                <div
                  key={index}
                  className="relative flex h-[64px] cursor-pointer items-center space-x-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors p-2"
                >
                  <div
                    className="flex h-[40px] w-[40px] items-center justify-center rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0"
                    onClick={() => {
                      setSelectedFile(file)
                      setShowPreview(true)
                    }}
                  >
                    {file.type === "pdf" ? (
                      <IconFileTypePdf size={20} className="text-primary" />
                    ) : file.type === "csv" ? (
                      <IconFileTypeCsv size={20} className="text-primary" />
                    ) : file.type === "txt" ? (
                      <IconFileTypeTxt size={20} className="text-primary" />
                    ) : file.type === "md" ? (
                      <IconMarkdown size={20} className="text-primary" />
                    ) : file.type === "json" ? (
                      <IconJson size={20} className="text-primary" />
                    ) : file.type === "docx" ? (
                      <IconFileTypeDocx size={20} className="text-primary" />
                    ) : (
                      <IconFileFilled size={20} className="text-primary" />
                    )}
                  </div>

                  <div className="flex flex-col justify-center flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {file.type.toUpperCase()}
                    </div>
                  </div>

                  <IconX
                    className="flex size-4 cursor-pointer items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground hover:bg-red-500 hover:text-white transition-colors flex-shrink-0"
                    onClick={e => {
                      e.stopPropagation()
                      setNewMessageFiles(
                        newMessageFiles.filter(f => f.id !== file.id)
                      )
                      setChatFiles(chatFiles.filter(f => f.id !== file.id))
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  if (combinedMessageFiles.length > 0) {
    return (
      <div className="flex w-full items-center justify-center">
        <div className="flex items-center space-x-3 bg-muted/30 rounded-lg p-3 border border-border/50">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <IconFileFilled size={16} />
            <span>{combinedMessageFiles.length} archivo{combinedMessageFiles.length > 1 ? 's' : ''} adjunto{combinedMessageFiles.length > 1 ? 's' : ''}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <RetrievalToggle fileCount={combinedMessageFiles.length} />
            
            <WithTooltip
              delayDuration={0}
              side="top"
              display={<div>Configuración de recuperación</div>}
              trigger={
                <div onClick={e => e.stopPropagation()}>
                  <ChatRetrievalSettings />
                </div>
              }
            />
            
            <Button
              variant="default"
              size="sm"
              className="flex items-center space-x-2 h-8 px-3"
              onClick={() => setShowFilesDisplay(true)}
            >
              <IconEye size={16} />
              <span className="text-sm">Ver archivos</span>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

const RetrievalToggle = ({ fileCount = 0 }: { fileCount?: number }) => {
  const { useRetrieval, setUseRetrieval } = useContext(ChatbotUIContext)

  return (
    <div className="flex items-center">
      <WithTooltip
        delayDuration={0}
        side="top"
        display={
          <div className="max-w-xs">
            <div className="font-semibold mb-1">
              {useRetrieval ? "Recuperación activa" : "Recuperación desactivada"}
            </div>
            <div className="text-sm">
              {useRetrieval
                ? "Los archivos se usarán para responder tu consulta"
                : "Los archivos no se usarán para responder tu consulta"}
            </div>
          </div>
        }
        trigger={
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-2 flex items-center space-x-1 transition-all duration-200",
              useRetrieval 
                ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 border border-green-500/30" 
                : "bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30"
            )}
            onClick={e => {
              e.stopPropagation()
              setUseRetrieval(prev => !prev)
            }}
          >
            <IconCircleFilled
              className={cn(
                "transition-colors",
                useRetrieval ? "text-green-500" : "text-red-500"
              )}
              size={12}
            />
            <span className="text-xs font-medium">
              {useRetrieval 
                ? (fileCount > 1 ? "Activos" : "Activo")
                : (fileCount > 1 ? "Inactivos" : "Inactivo")
              }
            </span>
          </Button>
        }
      />
    </div>
  )
}