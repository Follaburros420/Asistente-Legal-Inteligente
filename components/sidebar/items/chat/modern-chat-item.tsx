'use client'

import { motion } from 'framer-motion'
import { WithTooltip } from "@/components/ui/with-tooltip"
import { ALIContext } from "@/context/context"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import { LLM } from "@/types"
import { IconRobotFace, IconCpu, IconBrain, IconBolt } from "@tabler/icons-react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { FC, useContext, useRef, useState } from "react"
import { DeleteChat } from "./delete-chat"
import { UpdateChat } from "./update-chat"
import { M1_MODEL_ID, M1_PRO_MODEL_ID, M1_SMALL_MODEL_ID } from "@/lib/models/m1-models"

interface ModernChatItemProps {
  chat: Tables<"chats">
}

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 }
  }
}

// Model ID to friendly name mapping
const M1_SMALL_MODEL = M1_SMALL_MODEL_ID
const M1_MODEL = M1_MODEL_ID
const M1_PRO_MODEL = M1_PRO_MODEL_ID

type ModelVariant = "small" | "standard" | "pro" | "other"

const getModelDisplayName = (modelId: string | undefined, modelName?: string): { name: string; variant: ModelVariant } => {
  if (modelId === M1_SMALL_MODEL) return { name: "M1 Small", variant: "small" }
  if (modelId === M1_MODEL) return { name: "M1", variant: "standard" }
  if (modelId === M1_PRO_MODEL) return { name: "M1 Pro", variant: "pro" }
  // Fallback: use shortened model name or provider
  if (modelName) {
    // Try to get a short version of the model name
    const shortName = modelName.split('/').pop()?.split('-')[0] || modelName
    return { name: shortName.slice(0, 12), variant: "other" }
  }
  return { name: "Modelo", variant: "other" }
}

export const ModernChatItem: FC<ModernChatItemProps> = ({ chat }) => {
  const {
    selectedWorkspace,
    selectedChat,
    availableLocalModels,
    assistantImages,
    availableOpenRouterModels
  } = useContext(ALIContext)

  const router = useRouter()
  const params = useParams()
  const isActive = params.chatid === chat.id || selectedChat?.id === chat.id
  const [showActions, setShowActions] = useState(false)

  const itemRef = useRef<HTMLDivElement>(null)

  const handleClick = () => {
    if (!selectedWorkspace) return
    return router.push(`/${selectedWorkspace.id}/chat/${chat.id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.stopPropagation()
      itemRef.current?.click()
    }
  }

  const MODEL_DATA = [
    ...LLM_LIST,
    ...availableLocalModels,
    ...availableOpenRouterModels
  ].find(llm => llm.modelId === chat.model) as LLM

  const assistantImage = assistantImages.find(
    image => image.assistantId === chat.assistant_id
  )?.base64

  // Get friendly model display name
  const modelDisplay = getModelDisplayName(chat.model, MODEL_DATA?.modelName)

  // Formato relativo de tiempo
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    
    if (diffMins < 1) return 'Ahora'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  return (
    <motion.div
      ref={itemRef}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ 
        scale: 1.01,
        transition: { type: 'spring', stiffness: 400, damping: 25 }
      }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200",
        "border border-transparent",
        isActive
          ? "bg-primary/10 border-primary/20 shadow-sm shadow-primary/5"
          : "hover:bg-foreground/5 hover:border-border/50"
      )}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Indicador activo */}
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      {/* Icono del modelo/asistente */}
      <div className={cn(
        "relative flex-shrink-0 rounded-lg p-1.5 transition-colors duration-200",
        isActive 
          ? "bg-primary/15" 
          : "bg-foreground/5 group-hover:bg-foreground/10"
      )}>
        {chat.assistant_id ? (
          assistantImage ? (
            <Image
              className="rounded-md"
              src={assistantImage}
              alt="Assistant"
              width={24}
              height={24}
            />
          ) : (
            <IconRobotFace
              className={cn(
                "w-5 h-5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            />
          )
        ) : (
          <WithTooltip
            delayDuration={200}
            display={<div className="text-xs">{modelDisplay.name}</div>}
            trigger={
              <div className="w-5 h-5 flex items-center justify-center">
                {modelDisplay.variant === "pro" ? (
                  <IconBrain size={18} className="text-violet-500" />
                ) : modelDisplay.variant === "small" ? (
                  <IconBolt size={18} className="text-emerald-500" />
                ) : (
                  <IconCpu size={18} className="text-primary" />
                )}
              </div>
            }
          />
        )}
      </div>

      {/* Contenido principal */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className={cn(
          "text-sm font-medium truncate transition-colors",
          isActive ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"
        )}>
          {chat.name}
        </p>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[11px] transition-colors",
            isActive ? "text-primary/70" : "text-muted-foreground"
          )}>
            {getRelativeTime(chat.updated_at || chat.created_at)}
          </span>
          {chat.model && (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium truncate",
                modelDisplay.variant === "pro" 
                  ? "text-violet-500 dark:text-violet-400" 
                  : modelDisplay.variant === "small"
                    ? "text-emerald-500 dark:text-emerald-400"
                    : isActive 
                      ? "text-primary/80" 
                      : "text-muted-foreground"
              )}>
                {modelDisplay.variant === "pro" ? (
                  <IconBrain size={11} className="flex-shrink-0" />
                ) : modelDisplay.variant === "small" ? (
                  <IconBolt size={11} className="flex-shrink-0" />
                ) : (
                  <IconCpu size={11} className="flex-shrink-0" />
                )}
                {modelDisplay.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Acciones */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showActions || isActive ? 1 : 0 }}
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hover:opacity-70 transition-opacity">
          <UpdateChat chat={chat} />
        </div>
        <div className="hover:opacity-70 transition-opacity">
          <DeleteChat chat={chat} />
        </div>
      </motion.div>
    </motion.div>
  )
}

