/**
 * Message V2
 * 
 * Renderizado simplificado basado EXCLUSIVAMENTE en streamState.
 * - NO heurísticas de formato
 * - NO detección por contenido
 * - Solo usa message.render_mode del backend
 */

import { FC, useContext, useMemo } from "react"
import { ALIContext } from "@/context/context"
import { MessageBubble } from "@/components/chat/modern/MessageBubble"
import { ThinkingIndicator } from "./thinking-indicator"
import { CitationsPanel } from "./citations-panel"
import { AnswerView } from "./answer-view"
import { DocumentEditor } from "@/components/chat/document-editor"
import { Button } from "@/components/ui/button"
import { IconFileText } from "@tabler/icons-react"
import { Tables } from "@/supabase/types"
import { BibliographyItem } from "@/types/chat-message"
import { LegalDraft } from "@/types/draft"

interface MessageV2Props {
  message: Tables<"messages">
  fileItems: Tables<"file_items">[]
  bibliography?: BibliographyItem[]
  isLast: boolean
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSubmitEdit: (value: string) => void
}

export const MessageV2: FC<MessageV2Props> = ({
  message,
  fileItems,
  bibliography,
  isLast,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit
}) => {
  const { streamState, streamPhase } = useContext(ALIContext)
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DETERMINAR ESTADO DEL STREAM
  // ═══════════════════════════════════════════════════════════════════════════
  
  const isStreaming = useMemo(() => {
    // Solo el último mensaje del asistente puede estar streameando
    if (message.role !== "assistant") return false
    if (!isLast) return false
    
    // Fases activas de streaming
    return ["classifying", "searching", "drafting", "streaming"].includes(streamPhase)
  }, [message.role, isLast, streamPhase])
  
  const isCompleted = streamPhase === "completed"
  const isError = streamPhase === "error"
  const isCancelled = streamPhase === "cancelled"
  const isActive = isStreaming && !isCompleted && !isError && !isCancelled
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DETERMINAR RENDER MODE (solo del backend)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const renderMode = useMemo(() => {
    // Si está streameando, usar el modo del streamState
    if (isLast && isStreaming) {
      return streamState.renderMode
    }
    
    // Si es mensaje histórico, detectar por contenido JSON de draft
    if (message.role === "assistant" && !isLast) {
      // Solo verificar si tiene formato de draft
      if (message.content.trim().startsWith("{") && 
          message.content.includes('"type"') &&
          message.content.includes('"draft"')) {
        try {
          const parsed = JSON.parse(message.content)
          if (parsed.type === "draft") return "document"
        } catch {
          // No es draft válido
        }
      }
    }
    
    return "chat"
  }, [isLast, isStreaming, streamState.renderMode, message.role, message.content])
  
  const isDocument = renderMode === "document"
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PARSEAR DRAFT SI ES DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════
  
  const draft: LegalDraft | null = useMemo(() => {
    if (!isDocument) return null
    
    try {
      if (message.content.trim().startsWith("{")) {
        const parsed = JSON.parse(message.content)
        if (parsed.type === "draft") {
          return parsed as LegalDraft
        }
      }
    } catch {
      // No es JSON válido
    }
    
    return null
  }, [isDocument, message.content])
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DETERMINAR QUÉ MOSTRAR
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Thinking: visible durante fases activas (classifying, searching, drafting)
  const showThinking = isActive && streamPhase !== "streaming"
  
  // Texto: visible durante streaming o cuando está completo
  const showText = streamPhase === "streaming" || isCompleted || isError || isCancelled
  
  // Citas: SOLO cuando está completado y hay citas
  const showCitations = isCompleted && (bibliography?.length || streamState.citations.length)
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERIZADO
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (message.role === "user") {
    return (
      <MessageBubble
        variant="user"
        content={message.content}
        timestamp={new Date(message.created_at)}
      />
    )
  }
  
  // Mensaje del asistente
  return (
    <div className="space-y-4">
      <MessageBubble
        variant="ai"
        content={message.content}
        timestamp={new Date(message.created_at)}
        isGenerating={isActive}
        isLast={isLast}
      >
        <div className="space-y-3">
          {/* THINKING INDICATOR */}
          {showThinking && (
            <ThinkingIndicator 
              phase={streamPhase as any}
              statusMessage={streamState.statusMessage}
            />
          )}
          
          {/* TEXTO / STREAMING */}
          {showText && !isDocument && (
            <AnswerView 
              text={message.content} 
              isStreaming={streamPhase === "streaming"}
            />
          )}
          
          {/* DOCUMENTO */}
          {isDocument && draft && (
            <DocumentEditor 
              draft={draft}
              onContentChange={() => {}}
              readOnly={isActive}  // Solo lectura mientras stream
            />
          )}
          
          {/* ESTADO CANCELADO */}
          {isCancelled && (
            <div className="text-sm text-muted-foreground italic">
              Cancelado por usuario
            </div>
          )}
          
          {/* ESTADO ERROR */}
          {isError && (
            <div className="text-sm text-destructive">
              Error: {streamState.error || "Error desconocido"}
            </div>
          )}
          
          {/* CITAS - SOLO AL FINAL */}
          {showCitations && (
            <CitationsPanel 
              items={bibliography?.length ? bibliography : streamState.citations}
            />
          )}
        </div>
      </MessageBubble>
      
      {/* Botón para ver documento (si es draft pero no se mostró editor) */}
      {!isActive && isDocument && !draft && (
        <Button variant="outline" className="w-full">
          <IconFileText className="h-4 w-4 mr-2" />
          Ver Documento
        </Button>
      )}
    </div>
  )
}

export default MessageV2
