'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface ModernChatInputProps {
  children: ReactNode
  className?: string
}

export function ModernChatInputWrapper({ children, className }: ModernChatInputProps) {
  return (
    <div className={cn('border-t border-border bg-background/95 backdrop-blur', className)}>
      <div className="max-w-4xl mx-auto px-4 py-4">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn(
            'relative rounded-2xl border-2 transition-all duration-150',
            'bg-background shadow-sm',
            'focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10',
            'focus-within:shadow-md'
          )}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}


