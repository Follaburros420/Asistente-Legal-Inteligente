import { MessageMarkdown } from "./message-markdown"
import { StreamTextRenderer } from "./stream-text-renderer"

interface AnswerViewProps {
  text: string
  /** When true, uses lightweight stream-smoothing render instead of full markdown */
  isStreaming?: boolean
}

export const AnswerView = ({ text, isStreaming = false }: AnswerViewProps) => {
  if (!text || text.trim().length === 0) {
    return null
  }

  if (isStreaming) {
    return <StreamTextRenderer text={text} isStreaming={isStreaming} />
  }

  return <MessageMarkdown content={text} />
}
