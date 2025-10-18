'use client'

import { motion } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { Check, CheckCheck, Clock, AlertCircle, Copy, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useState } from 'react'

interface MessageBubbleProps {
  variant: 'user' | 'ai' | 'system'
  content: string
  timestamp: Date
  status?: 'sending' | 'sent' | 'delivered' | 'error'
  avatar?: string
  userName?: string
  onCopy?: () => void
  onRegenerate?: () => void
  children?: React.ReactNode
}

const statusIcons = {
  sending: Clock,
  sent: Check,
  delivered: CheckCheck,
  error: AlertCircle,
}

export function MessageBubble({
  variant,
  content,
  timestamp,
  status = 'delivered',
  avatar,
  userName = 'Usuario',
  onCopy,
  onRegenerate,
  children
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const isUser = variant === 'user'
  const isAI = variant === 'ai'
  const isSystem = variant === 'system'

  const StatusIcon = statusIcons[status]

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
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex justify-center my-4"
      >
        <div className="px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm">
          {content}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
      }}
      className={cn(
        'group flex gap-3 px-4 py-3',
        isUser && 'flex-row-reverse',
      )}
    >
      {/* Avatar */}
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarImage src={avatar} alt={userName} />
        <AvatarFallback className={cn(
          'text-xs font-medium',
          isUser && 'bg-primary text-primary-foreground',
          isAI && 'bg-secondary text-secondary-foreground'
        )}>
          {userName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Message Container */}
      <div className={cn(
        'flex flex-col gap-1.5',
        isUser ? 'items-end max-w-[70%] sm:max-w-[70%]' : 'items-start max-w-[80%] sm:max-w-[75%]'
      )}>
        {/* Bubble */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.1 }}
          className={cn(
            'px-4 py-3 rounded-2xl relative',
            'border transition-shadow duration-150',
            isUser && [
              'bg-background text-foreground',
              'rounded-tr-md',
              'shadow-md shadow-primary/20',
              'hover:shadow-lg hover:shadow-primary/30',
              'border border-border',
            ],
            isAI && [
              'bg-muted text-foreground',
              'rounded-tl-md',
              'border-border',
              'hover:shadow-md',
            ],
          )}
        >
          {/* Content */}
          {children || (
            <div className={cn(
              'text-sm leading-relaxed whitespace-pre-wrap',
              isUser && 'text-foreground font-medium',
            )}>
              {content}
            </div>
          )}

          {/* Actions on hover (para AI messages) */}
          {isAI && (onCopy || onRegenerate) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileHover={{ opacity: 1, scale: 1 }}
              className="absolute -right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <div className="flex gap-1 bg-background border border-border rounded-lg shadow-md p-1">
                {onCopy && (
                  <button
                    onClick={handleCopy}
                    className="p-1.5 hover:bg-muted rounded transition-colors"
                    aria-label="Copiar mensaje"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}
                {onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    className="p-1.5 hover:bg-muted rounded transition-colors"
                    aria-label="Regenerar respuesta"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Metadata */}
        <div className={cn(
          'flex items-center gap-2 text-xs text-muted-foreground px-2',
          isUser && 'flex-row-reverse'
        )}>
          {timestamp && !isNaN(timestamp.getTime()) && (
            <time dateTime={timestamp.toISOString()}>
              {formatDistanceToNow(timestamp, { addSuffix: true, locale: es })}
            </time>
          )}
        </div>
      </div>
    </motion.div>
  )
}

