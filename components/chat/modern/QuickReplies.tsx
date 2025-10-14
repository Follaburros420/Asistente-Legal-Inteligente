'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface QuickRepliesProps {
  replies: string[]
  onSelect: (reply: string) => void
  maxVisible?: number
}

export function QuickReplies({ replies, onSelect, maxVisible }: QuickRepliesProps) {
  const visibleReplies = maxVisible ? replies.slice(0, maxVisible) : replies

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 10 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 25,
      },
    },
  }

  if (replies.length === 0) return null

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-wrap gap-2 px-4 py-3"
    >
      {visibleReplies.map((reply, index) => (
        <motion.button
          key={index}
          variants={itemVariants}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(reply)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium',
            'bg-muted border border-border',
            'text-foreground hover:bg-secondary',
            'transition-colors duration-120',
            'hover:shadow-md hover:border-border-hover',
            'focus:outline-none focus:ring-2 focus:ring-primary/20',
          )}
        >
          {reply}
        </motion.button>
      ))}
    </motion.div>
  )
}


