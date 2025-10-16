import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import { ContentType } from "@/types"
import { FC, useContext, useState } from "react"
import { SIDEBAR_WIDTH } from "../ui/dashboard"
import { TabsContent } from "../ui/tabs"
import { WorkspaceSwitcher } from "../utility/workspace-switcher"
import { WorkspaceSettings } from "../workspace/workspace-settings"
import { SidebarContent } from "./sidebar-content"
import { ModernSidebar } from "./modern/ModernSidebar"
import { motion, AnimatePresence } from "framer-motion"

interface SidebarProps {
  contentType: ContentType
  showSidebar: boolean
  onContentTypeChange?: (type: ContentType) => void
}

export const Sidebar: FC<SidebarProps> = ({ contentType, showSidebar, onContentTypeChange }) => {
  const {
    folders,
    chats,
    files,
    collections,
    assistants,
    tools
  } = useContext(ChatbotUIContext)
  
  const [useModernDesign] = useState(true) // Flag para activar el diseño moderno

  const chatFolders = folders.filter(folder => folder.type === "chats")
  const filesFolders = folders.filter(folder => folder.type === "files")
  const collectionFolders = folders.filter(
    folder => folder.type === "collections"
  )
  const assistantFolders = folders.filter(
    folder => folder.type === "assistants"
  )
  const toolFolders = folders.filter(folder => folder.type === "tools")

  const renderSidebarContent = (
    contentType: ContentType,
    data: any[],
    folders: Tables<"folders">[]
  ) => {
    return (
      <SidebarContent contentType={contentType} data={data} folders={folders} />
    )
  }

  // Si está activado el diseño moderno, usar ModernSidebar
  if (useModernDesign) {
    return (
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full h-full"
          >
            <ModernSidebar
              contentType={contentType}
              showSidebar={showSidebar}
              onContentTypeChange={onContentTypeChange}
            />
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // Diseño original como fallback
  return (
    <TabsContent
      className="m-0 w-full space-y-2"
      style={{
        // Sidebar - SidebarSwitcher
        minWidth: showSidebar ? `calc(${SIDEBAR_WIDTH}px - 60px)` : "0px",
        maxWidth: showSidebar ? `calc(${SIDEBAR_WIDTH}px - 60px)` : "0px",
        width: showSidebar ? `calc(${SIDEBAR_WIDTH}px - 60px)` : "0px"
      }}
      value={contentType}
    >
      <div className="flex h-full flex-col p-3">
        <div className="flex items-center border-b-2 pb-2">
          <WorkspaceSwitcher showSettingsButton={false} />

          <WorkspaceSettings />
        </div>

        {(() => {
          switch (contentType) {
            case "chats":
              return renderSidebarContent("chats", chats, chatFolders)

            case "files":
              return renderSidebarContent("files", files, filesFolders)

            case "collections":
              return renderSidebarContent(
                "collections",
                collections,
                collectionFolders
              )

            case "assistants":
              return renderSidebarContent(
                "assistants",
                assistants,
                assistantFolders
              )

            case "tools":
              return renderSidebarContent("tools", tools, toolFolders)

            default:
              return null
          }
        })()}
      </div>
    </TabsContent>
  )
}
