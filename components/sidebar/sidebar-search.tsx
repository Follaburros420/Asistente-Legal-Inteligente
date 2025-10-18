import { ContentType } from "@/types"
import { FC } from "react"
import { Input } from "../ui/input"

interface SidebarSearchProps {
  contentType: ContentType
  searchTerm: string
  setSearchTerm: Function
}

const getSearchPlaceholder = (contentType: ContentType): string => {
  const labels: Record<ContentType, string> = {
    chats: "conversaciones",
    presets: "preajustes",
    prompts: "instrucciones",
    files: "archivos",
    collections: "procesos",
    assistants: "agentes",
    tools: "herramientas",
    models: "modelos"
  }
  return `Buscar ${labels[contentType] || contentType}...`
}

export const SidebarSearch: FC<SidebarSearchProps> = ({
  contentType,
  searchTerm,
  setSearchTerm
}) => {
  return (
    <Input
      placeholder={getSearchPlaceholder(contentType)}
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
    />
  )
}
