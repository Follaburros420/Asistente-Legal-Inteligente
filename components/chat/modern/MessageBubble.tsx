"use client"

import { motion } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ShaderCanvas } from '@/components/shader-canvas'
import { cn } from '@/lib/utils'
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react'
import { useEffect, useState, memo } from 'react'
import { MessageActionBar } from '@/components/messages/message-action-bar'
import { DocumentEditor } from '@/components/chat/document-editor'
import { LegalDraft } from '@/types/draft'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MessageBubbleProps {
  variant: 'user' | 'ai' | 'system'
  content: string
  timestamp: Date
  status?: 'sending' | 'sent' | 'delivered' | 'error'
  avatar?: string
  userName?: string
  onCopy?: () => void
  onRegenerate?: () => void
  onBranchChat?: () => void
  onReport?: () => void
  onLike?: () => void
  onDislike?: () => void
  isLast?: boolean
  isGenerating?: boolean
  children?: React.ReactNode
}

const statusIcons = {
  sending: Clock,
  sent: Check,
  delivered: CheckCheck,
  error: AlertCircle,
}

export const MessageBubble = memo(({
  variant,
  content,
  timestamp,
  status = 'delivered',
  avatar,
  userName = 'Usuario',
  onCopy,
  onRegenerate,
  onBranchChat,
  onReport,
  onLike,
  onDislike,
  isLast = false,
  isGenerating = false,
  children
}: MessageBubbleProps) => {
  const [copied, setCopied] = useState(false)
  const isUser = variant === 'user'
  const isAI = variant === 'ai'
  const isSystem = variant === 'system'

  // Shader seleccionado - Optimizado: Solo el último mensaje AI necesita trackear cambios dinámicos si es necesario
  // Pero para simplicidad, mantendremos el estado pero con un listener más ligero si es posible
  const [shaderId, setShaderId] = useState<number>(1)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const saved = localStorage.getItem('selectedShader')
    if (saved) setShaderId(parseInt(saved, 10))

    if (!isAI || !isLast) return // Solo el último mensaje AI necesita reaccionar a cambios vivos de shader

    const handleShaderChanged = (e: any) => {
      setShaderId(e.detail)
    }

    window.addEventListener('shaderChanged', handleShaderChanged as any)
    return () => {
      window.removeEventListener('shaderChanged', handleShaderChanged as any)
    }
  }, [isAI, isLast])

  const handleCopy = () => {
    if (onCopy) {
      onCopy()
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center my-4"
      >
        <div className="px-5 py-2.5 rounded-full bg-muted/80 backdrop-blur-sm text-muted-foreground text-sm font-medium border border-border/50 shadow-sm">
          {content}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        'group flex gap-3 px-4 py-3',
        isUser && 'flex-row-reverse',
      )}
    >
      {isUser ? (
        <div className="w-9 h-9 flex-shrink-0">
          <Avatar className="w-9 h-9 ring-2 ring-primary/20 ring-offset-2 ring-offset-background shadow-lg">
            <AvatarImage src={avatar} alt={userName} />
            <AvatarFallback className={cn(
              'text-xs font-semibold',
              'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
            )}>
              {userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      ) : (
        <div className="w-9 h-9 flex-shrink-0 rounded-full overflow-hidden ring-2 ring-violet-500/20 ring-offset-2 ring-offset-background shadow-lg shadow-violet-500/10">
          <ShaderCanvas size={36} shaderId={shaderId} />
        </div>
      )}

      {/* Message Container */}
      <div className={cn(
        'flex flex-col gap-2',
        isUser ? 'items-end max-w-[70%] sm:max-w-[70%]' : 'items-start max-w-[80%] sm:max-w-[75%]'
      )}>
        {/* Bubble */}
        <div
          className={cn(
            'relative overflow-hidden',
            'px-4 py-3.5 rounded-2xl',
            'transition-all duration-200',
            isUser && [
              'bg-gradient-to-br from-primary via-primary to-primary/90',
              'text-primary-foreground',
              'rounded-tr-sm',
              'shadow-lg shadow-primary/25',
              'border-0',
            ],
            isAI && [
              'bg-gradient-to-br from-card via-card to-muted/50',
              'text-card-foreground',
              'rounded-tl-sm',
              'border border-border/60',
              'shadow-md shadow-black/5 dark:shadow-black/20',
              'backdrop-blur-sm',
            ],
          )}
        >
          {isAI && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
          )}

          {isUser && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
          )}

          {/* Content */}
          <div className={cn(
            'text-[15px] leading-relaxed relative z-10',
            isUser && 'font-medium',
            isAI && 'font-normal',
          )}>
            {(() => {
              // Intento de parsear si es un draft JSON
              let draft: LegalDraft | null = null
              if (isAI && content.trim().startsWith('{') && content.includes('"type": "draft"')) {
                try {
                  const parsed = JSON.parse(content)
                  if (parsed.type === 'draft') {
                    draft = parsed as LegalDraft
                  }
                } catch (e) { }
              }

              if (draft) {
                return (
                  <DocumentEditor
                    draft={draft}
                    onRequestChanges={async (instruction) => {
                      try {
                        const response = await fetch('/api/chat/refine-document', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            document: draft,
                            instruction,
                            model: 'gpt-4o'
                          })
                        })

                        if (!response.ok) throw new Error("Error refinando documento")

                        const newDraft = await response.json()
                        return newDraft
                      } catch (e) {
                        console.error(e)
                        throw e
                      }
                    }}
                  />
                )
              }

              return (
                <div className={cn(
                  "markdown-content break-words",
                  isUser ? "prose-p:text-primary-foreground prose-a:text-primary-foreground/90" : "prose-neutral dark:prose-invert"
                )}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="underline font-medium" />,
                      p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />,
                      ul: ({ node, ...props }) => <ul {...props} className="pl-4 mb-2 list-disc" />,
                      ol: ({ node, ...props }) => <ol {...props} className="pl-4 mb-2 list-decimal" />,
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Action Bar for AI messages */}
        {isAI && onCopy && (
          <MessageActionBar
            messageContent={typeof children === 'string' ? children : content}
            isAssistant={true}
            isLast={isLast}
            isGenerating={isGenerating}
            onCopy={onCopy}
            onRegenerate={onRegenerate}
            onBranchChat={onBranchChat}
            onReport={onReport}
            onLike={onLike}
            onDislike={onDislike}
          />
        )}
      </div>
    </motion.div>
  )
})

MessageBubble.displayName = 'MessageBubble'
