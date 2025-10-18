import { Button } from "@/components/ui/button"
import { ChatbotUIContext } from "@/context/context"
import { getCollectionFilesByCollectionId } from "@/db/collection-files"
import { useAttachFilesToChat } from "@/lib/hooks/use-attach-files-to-chat"
import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import { ContentType } from "@/types"
import {
  IconChevronDown,
  IconChevronRight,
  IconLoader2
} from "@tabler/icons-react"
import { FC, useContext, useRef, useState } from "react"
import { toast } from "sonner"
import { DeleteFolder } from "./delete-folder"
import { UpdateFolder } from "./update-folder"

interface FolderProps {
  folder: Tables<"folders">
  contentType: ContentType
  children: React.ReactNode
  onUpdateFolder: (itemId: string, folderId: string | null) => void
}

export const Folder: FC<FolderProps> = ({
  folder,
  contentType,
  children,
  onUpdateFolder
}) => {
  const itemRef = useRef<HTMLDivElement>(null)

  const { files: allFiles, collections: allCollections } =
    useContext(ChatbotUIContext)
  const attachFilesToChat = useAttachFilesToChat()

  const [isDragOver, setIsDragOver] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isAttaching, setIsAttaching] = useState(false)

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()

    setIsDragOver(false)
    const itemId = e.dataTransfer.getData("text/plain")
    onUpdateFolder(itemId, folder.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.stopPropagation()
      itemRef.current?.click()
    }
  }

  const attachFolderToChat = async () => {
    if (contentType === "files") {
      const folderFiles = allFiles.filter(
        file => file.folder_id === folder.id
      )

      if (folderFiles.length === 0) {
        toast.info("Esta carpeta no contiene archivos para usar en el chat.")
        return
      }

      attachFilesToChat(folderFiles, {
        sourceName: `la carpeta "${folder.name}"`
      })
      return
    }

    if (contentType === "collections") {
      const folderCollections = allCollections.filter(
        collection => collection.folder_id === folder.id
      )

      if (folderCollections.length === 0) {
        toast.info(
          "Esta carpeta no contiene procesos con archivos disponibles."
        )
        return
      }

      let aggregatedFiles: Tables<"files">[] = []

      for (const collection of folderCollections) {
        const collectionWithFiles = await getCollectionFilesByCollectionId(
          collection.id
        )

        const collectionFiles =
          (collectionWithFiles.files as Tables<"files">[]) || []

        aggregatedFiles = aggregatedFiles.concat(collectionFiles)
      }

      if (aggregatedFiles.length === 0) {
        toast.info(
          "Los procesos de esta carpeta no tienen archivos disponibles."
        )
        return
      }

      attachFilesToChat(aggregatedFiles, {
        sourceName: `la carpeta "${folder.name}"`
      })
      return
    }

    toast.info(
      "Solo las carpetas de archivos o procesos pueden agregarse al chat."
    )
  }

  const runFolderAttachment = async () => {
    try {
      setIsAttaching(true)
      await attachFolderToChat()
    } catch (error) {
      console.error("Error al agregar la carpeta al chat:", error)
      toast.error("No se pudieron agregar los archivos de la carpeta al chat.")
    } finally {
      setIsAttaching(false)
    }
  }

  const handleAttachFolder = async (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.stopPropagation()
    event.preventDefault()

    if (isAttaching) return

    await runFolderAttachment()
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      !isExpanded &&
      !isAttaching &&
      (contentType === "files" || contentType === "collections")
    ) {
      void runFolderAttachment()
    }

    setIsExpanded(!isExpanded)
  }

  return (
    <div
      ref={itemRef}
      id="folder"
      className={cn("rounded focus:outline-none", isDragOver && "bg-accent")}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        tabIndex={0}
        className={cn(
          "hover:bg-accent focus:bg-accent flex w-full cursor-pointer items-center justify-between rounded p-2 hover:opacity-50 focus:outline-none"
        )}
        onClick={handleClick}
      >
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center space-x-2">
            {isExpanded ? (
              <IconChevronDown stroke={3} />
            ) : (
              <IconChevronRight stroke={3} />
            )}

            <div>{folder.name}</div>
          </div>

          {isHovering && (
            <div
              onClick={e => {
                e.stopPropagation()
                e.preventDefault()
              }}
              className="ml-2 flex space-x-2"
            >
              {(contentType === "files" || contentType === "collections") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={handleAttachFolder}
                  disabled={isAttaching}
                  aria-label="Agregar carpeta al chat"
                >
                  {isAttaching ? (
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                </Button>
              )}

              <UpdateFolder folder={folder} />

              <DeleteFolder folder={folder} contentType={contentType} />
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="ml-5 mt-2 space-y-2 border-l-2 pl-4">{children}</div>
      )}
    </div>
  )
}
