import { Button } from "@/components/ui/button"
import { getCollectionFilesByCollectionId } from "@/db/collection-files"
import { useAttachFilesToChat } from "@/lib/hooks/use-attach-files-to-chat"
import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import { ContentType, DataItemType } from "@/types"
import { IconLoader2, IconSparkles } from "@tabler/icons-react"
import { FC, useRef, useState } from "react"
import { toast } from "sonner"
import { SidebarUpdateItem } from "./sidebar-update-item"

interface SidebarItemProps {
  item: DataItemType
  isTyping: boolean
  contentType: ContentType
  icon: React.ReactNode
  updateState: any
  renderInputs: (renderState: any) => JSX.Element
}

export const SidebarItem: FC<SidebarItemProps> = ({
  item,
  contentType,
  updateState,
  renderInputs,
  icon,
  isTyping
}) => {
  const attachFilesToChat = useAttachFilesToChat()
  const itemRef = useRef<HTMLDivElement>(null)

  const [isHovering, setIsHovering] = useState(false)
  const [isAttaching, setIsAttaching] = useState(false)

  const canAttachToChat =
    contentType === "files" || contentType === "collections"

  const attachItemToChat = async () => {
    if (!canAttachToChat) return

    if (contentType === "files") {
      attachFilesToChat([item as Tables<"files">], {
        sourceName: `"${item.name}"`
      })
      return
    }

    if (contentType === "collections") {
      const collection = item as Tables<"collections">
      const collectionWithFiles = await getCollectionFilesByCollectionId(
        collection.id
      )

      const collectionFiles =
        (collectionWithFiles.files as Tables<"files">[]) || []

      if (collectionFiles.length === 0) {
        toast.info("La colección seleccionada no tiene archivos asociados.")
        return
      }

      attachFilesToChat(collectionFiles, {
        sourceName: `"${collectionWithFiles.name}"`
      })
    }
  }

  const runAttachment = async () => {
    try {
      setIsAttaching(true)
      await attachItemToChat()
    } catch (error) {
      console.error("Error al agregar archivos al chat:", error)
      toast.error("No se pudieron agregar los archivos al chat.")
    } finally {
      setIsAttaching(false)
    }
  }

  const handleRowClick = () => {
    if (!canAttachToChat || isAttaching) return
    void runAttachment()
  }

  const handleAttachToChat = async (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    if (!canAttachToChat || isAttaching) return

    event.stopPropagation()
    event.preventDefault()

    await runAttachment()
  }
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.stopPropagation()
      itemRef.current?.click()
    }
  }

  // const handleClickAction = async (
  //   e: React.MouseEvent<SVGSVGElement, MouseEvent>
  // ) => {
  //   e.stopPropagation()

  //   const action = actionMap[contentType]

  //   await action(item as any)
  // }

  return (
    <SidebarUpdateItem
      item={item}
      isTyping={isTyping}
      contentType={contentType}
      updateState={updateState}
      renderInputs={renderInputs}
    >
      <div
        ref={itemRef}
        className={cn(
          "group hover:bg-accent flex w-full cursor-pointer items-center rounded p-2 hover:opacity-50 focus:outline-none"
        )}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={handleRowClick}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {icon}

        <div className="ml-3 flex-1 truncate text-sm font-semibold">
          {item.name}
        </div>

        {canAttachToChat && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 text-muted-foreground transition-opacity hover:text-primary",
              isHovering ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            onClick={handleAttachToChat}
            disabled={isAttaching}
            aria-label="Agregar al chat"
          >
            {isAttaching ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconSparkles className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* TODO */}
        {/* {isHovering && (
          <WithTooltip
            delayDuration={1000}
            display={<div>Start chat with {contentType.slice(0, -1)}</div>}
            trigger={
              <IconSquarePlus
                className="cursor-pointer hover:text-blue-500"
                size={20}
                onClick={handleClickAction}
              />
            }
          />
        )} */}
      </div>
    </SidebarUpdateItem>
  )
}
