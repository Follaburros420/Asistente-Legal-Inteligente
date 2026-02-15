/**
 * Message V2
 *
 * Renderizado basado en streamState para el ultimo mensaje,
 * preservando siempre los mensajes historicos.
 */

import { FC, useContext, useMemo } from "react";
import { motion } from "framer-motion";
import { ALIContext } from "@/context/context";
import { MessageBubble } from "@/components/chat/modern/MessageBubble";
import { ThinkingIndicator } from "./thinking-indicator";
import { ShaderCanvas } from "@/components/shader-canvas";
import { CitationsPanel } from "./citations-panel";
import { AnswerView } from "./answer-view";
import { DocumentEditor } from "@/components/chat/document-editor";
import { Button } from "@/components/ui/button";
import { IconFileText } from "@tabler/icons-react";
import { Tables } from "@/supabase/types";
import { BibliographyItem } from "@/types/chat-message";
import { LegalDraft } from "@/types/draft";

interface MessageV2Props {
  message: Tables<"messages">;
  fileItems: Tables<"file_items">[];
  bibliography?: BibliographyItem[];
  isLast: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (value: string) => void;
}

export const MessageV2: FC<MessageV2Props> = ({
  message,
  fileItems: _fileItems,
  bibliography,
  isLast,
  isEditing: _isEditing,
  onStartEdit: _onStartEdit,
  onCancelEdit: _onCancelEdit,
  onSubmitEdit: _onSubmitEdit,
}) => {
  const { streamState, streamPhase } = useContext(ALIContext);

  const isCurrentAssistantTarget = message.role === "assistant" && isLast;

  const isStreaming = useMemo(() => {
    if (!isCurrentAssistantTarget) return false;
    return ["classifying", "searching", "drafting", "streaming"].includes(
      streamPhase,
    );
  }, [isCurrentAssistantTarget, streamPhase]);

  const isCompleted = isCurrentAssistantTarget && streamPhase === "completed";
  const isError = isCurrentAssistantTarget && streamPhase === "error";
  const isCancelled = isCurrentAssistantTarget && streamPhase === "cancelled";
  const isActive = isStreaming && !isCompleted && !isError && !isCancelled;

  const renderMode = useMemo(() => {
    if (isCurrentAssistantTarget && isStreaming) {
      return streamState.renderMode;
    }

    if (message.role === "assistant") {
      if (
        message.content.trim().startsWith("{") &&
        message.content.includes('"type"') &&
        message.content.includes('"draft"')
      ) {
        try {
          const parsed = JSON.parse(message.content);
          if (parsed.type === "draft") return "document";
        } catch {
          // no-op
        }
      }
    }

    return "chat";
  }, [
    isCurrentAssistantTarget,
    isStreaming,
    streamState.renderMode,
    message.role,
    message.content,
  ]);

  const isDocument = renderMode === "document";

  const draft: LegalDraft | null = useMemo(() => {
    if (!isDocument) return null;

    try {
      if (message.content.trim().startsWith("{")) {
        const parsed = JSON.parse(message.content);
        if (parsed.type === "draft") {
          return parsed as LegalDraft;
        }
      }
    } catch {
      // no-op
    }

    return null;
  }, [isDocument, message.content]);

  const citationsForMessage = bibliography?.length
    ? bibliography
    : isCurrentAssistantTarget
      ? streamState.citations
      : [];

  const showThinking = isActive && streamPhase !== "streaming";
  const showText =
    !isCurrentAssistantTarget ||
    streamPhase === "streaming" ||
    streamPhase === "completed" ||
    streamPhase === "error" ||
    streamPhase === "cancelled";
  const showCitations =
    citationsForMessage.length > 0 &&
    (!isCurrentAssistantTarget || streamPhase === "completed");

  if (message.role === "user") {
    return (
      <MessageBubble
        variant="user"
        content={message.content}
        timestamp={new Date(message.created_at)}
      />
    );
  }

  if (showThinking) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex items-center gap-3 px-4 py-3"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            duration: 0.35,
            delay: 0.1,
            type: "spring",
            stiffness: 200,
            damping: 20,
          }}
          className="w-9 h-9 flex-shrink-0 rounded-full overflow-hidden ring-2 ring-violet-500/20 ring-offset-2 ring-offset-background shadow-lg shadow-violet-500/10"
        >
          <ShaderCanvas
            size={36}
            shaderId={(() => {
              if (typeof window === "undefined") return 1;
              const saved = localStorage.getItem("selectedShader");
              return saved ? parseInt(saved, 10) : 1;
            })()}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <ThinkingIndicator
            phase={streamPhase as any}
            statusMessage={streamState.statusMessage}
          />
        </motion.div>
      </motion.div>
    );
  }

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
          {showText && !isDocument && (
            <AnswerView
              text={message.content}
              isStreaming={
                isCurrentAssistantTarget && streamPhase === "streaming"
              }
            />
          )}

          {isDocument && draft && (
            <DocumentEditor
              draft={draft}
              onContentChange={() => {}}
              readOnly={isActive}
            />
          )}

          {isCancelled && (
            <div className="text-sm text-muted-foreground italic">
              Cancelado por usuario
            </div>
          )}

          {isError && (
            <div className="text-sm text-destructive">
              Error: {streamState.error || "Error desconocido"}
            </div>
          )}

          {showCitations && <CitationsPanel items={citationsForMessage} />}
        </div>
      </MessageBubble>

      {!isActive && isDocument && !draft && (
        <Button variant="outline" className="w-full">
          <IconFileText className="h-4 w-4 mr-2" />
          Ver Documento
        </Button>
      )}
    </div>
  );
};

export default MessageV2;
