"use client"

import { FC, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface SuggestedQuestionsProps {
  questions: string[]
  onQuestionClick: (question: string) => void
  isVisible: boolean
}

export const SuggestedQuestions: FC<SuggestedQuestionsProps> = ({
  questions,
  onQuestionClick,
  isVisible
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (!isVisible || questions.length === 0) {
    return null
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mt-4 px-4"
        >
          <div className="text-sm text-gray-500 mb-3 font-medium">
            💡 Preguntas relacionadas:
          </div>
          <div className="flex flex-wrap gap-2">
            {questions.map((question, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  duration: 0.2, 
                  delay: index * 0.1,
                  ease: "easeOut" 
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onQuestionClick(question)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer",
                  "bg-gray-100 hover:bg-gray-200 text-gray-700",
                  "dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200",
                  "border border-gray-200 dark:border-gray-600",
                  "shadow-sm hover:shadow-md",
                  hoveredIndex === index && "ring-2 ring-blue-500 ring-opacity-50"
                )}
              >
                {question}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
