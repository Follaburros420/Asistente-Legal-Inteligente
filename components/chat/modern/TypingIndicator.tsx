'use client'

import { motion } from 'framer-motion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function TypingIndicator() {
  const dotVariants = {
    initial: { scale: 1, opacity: 0.5 },
    animate: { 
      scale: [1, 1.2, 1],
      opacity: [0.5, 1, 0.5],
    },
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3 px-4 py-3"
    >
      {/* Avatar */}
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
          IA
        </AvatarFallback>
      </Avatar>

      {/* Typing bubble */}
      <div className="flex items-center px-4 py-3 rounded-2xl rounded-tl-md bg-muted border border-border">
        <div className="flex gap-1.5" aria-label="La IA está escribiendo">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              variants={dotVariants}
              initial="initial"
              animate="animate"
              transition={{
                duration: 1.4,
                repeat: Infinity,
                delay: index * 0.2,
                ease: 'easeInOut',
              }}
              className="w-2 h-2 rounded-full bg-foreground"
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}


