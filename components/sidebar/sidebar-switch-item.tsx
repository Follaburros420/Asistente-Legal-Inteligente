import { ContentType } from "@/types"
import { FC } from "react"
import { TabsTrigger } from "../ui/tabs"
import { WithTooltip } from "../ui/with-tooltip"

interface SidebarSwitchItemProps {
  contentType: ContentType
  icon: React.ReactNode
  onContentTypeChange: (contentType: ContentType) => void
}

const getContentTypeLabel = (contentType: ContentType): string => {
  const labels: Record<ContentType, string> = {
    chats: "Conversaciones",
    presets: "Preajustes",
    prompts: "Instrucciones",
    files: "Archivos",
    collections: "Colecciones",
    assistants: "Agentes",
    tools: "Herramientas",
    models: "Modelos"
  }
  return labels[contentType] || contentType
}

export const SidebarSwitchItem: FC<SidebarSwitchItemProps> = ({
  contentType,
  icon,
  onContentTypeChange
}) => {
  return (
    <WithTooltip
      display={
        <div>{getContentTypeLabel(contentType)}</div>
      }
      trigger={
        <TabsTrigger
          className="hover:opacity-50"
          value={contentType}
          onClick={() => onContentTypeChange(contentType as ContentType)}
        >
          {icon}
        </TabsTrigger>
      }
    />
  )
}
