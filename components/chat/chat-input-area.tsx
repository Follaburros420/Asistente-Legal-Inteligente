"use client"

import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { FC, useEffect, useState, ReactNode, useRef } from "react"
import ReactTextareaAutosize from "react-textarea-autosize"

interface ChatInputAreaProps {
    value: string
    onChange: (value: string) => void
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
    onPaste?: (e: React.ClipboardEvent) => void
    onCompositionStart?: () => void
    onCompositionEnd?: () => void
    placeholder?: string
    placeholders?: string[]
    disabled?: boolean
    textareaRef?: React.RefObject<HTMLTextAreaElement>
    leftElement?: ReactNode
    rightElement?: ReactNode
    showSuggestions?: boolean
}

/**
 * ChatInputArea - Componente de input para el chat con glassmorphism real
 *
 * REFACTORIZACIÓN: Glassmorphism aplicado directamente en la barra de input,
 * eliminando cualquier fondo/banda detrás. Efectos hover en desktop.
 */
export const ChatInputArea: FC<ChatInputAreaProps> = ({
    value,
    onChange,
    onKeyDown,
    onPaste,
    onCompositionStart,
    onCompositionEnd,
    placeholder,
    placeholders = [],
    disabled = false,
    textareaRef,
    leftElement,
    rightElement,
    showSuggestions = true
}) => {
    const [isFocused, setIsFocused] = useState(false)
    const [currentPlaceholder, setCurrentPlaceholder] = useState(0)
    const [isHovered, setIsHovered] = useState(false)

    // Internal ref as fallback if external ref not provided
    const internalRef = useRef<HTMLTextAreaElement>(null)
    const textAreaRef = textareaRef || internalRef

    // Rotating placeholders logic - solo cuando el input está vacío
    useEffect(() => {
        if (!showSuggestions || value || placeholders.length === 0) return

        const interval = setInterval(() => {
            setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length)
        }, 3000)

        return () => clearInterval(interval)
    }, [showSuggestions, value, placeholders.length])

    // Handler simple que pasa el valor directamente al padre
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value)
    }

    return (
        <motion.div
            className={cn(
                "relative mx-auto w-full overflow-hidden",
                "rounded-2xl",
                /* Glassmorphism: fondo semitransparente que funciona con o sin blur */
                "bg-white/10 dark:bg-black/40",
                "border border-white/15 dark:border-white/10",
                "shadow-lg shadow-black/15 dark:shadow-black/30",
                /* Transiciones suaves */
                "transition-all duration-300 ease-out",
                /* Focus state */
                isFocused && [
                    "border-primary/40",
                    "shadow-xl shadow-primary/10",
                    "bg-white/15 dark:bg-black/50"
                ],
                /* Hover effect - solo en desktop (detectado por isHovered) */
                isHovered && !isFocused && [
                    "border-white/25 dark:border-white/15",
                    "shadow-xl shadow-black/20 dark:shadow-black/40"
                ],
                /* Clase para fallback sin backdrop-filter */
                "glass-fallback-supported"
            )}
            style={{
                /* Backdrop filter con fallback */
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                minHeight: "60px"
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            initial={false}
            animate={{
                scale: isHovered && !isFocused ? 1.02 : 1,
            }}
            transition={{
                type: "spring",
                stiffness: 400,
                damping: 25
            }}
        >
            {/* Gradiente sutil en la parte superior */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="flex items-end gap-2 px-3 py-2 relative z-10 w-full">
                {leftElement && (
                    <div className="flex-shrink-0 z-20 mb-1">
                        {leftElement}
                    </div>
                )}

                <div className="relative flex-1 min-w-0 self-center">
                    <ReactTextareaAutosize
                        ref={textAreaRef}
                        className={cn(
                            "w-full resize-none border-none bg-transparent",
                            "px-2 py-3",
                            "text-sm sm:text-base",
                            "text-foreground placeholder:text-muted-foreground/0",
                            "focus:outline-none focus:ring-0",
                            "relative z-30",
                            "cursor-text"
                        )}
                        minRows={1}
                        maxRows={8}
                        value={value}
                        onChange={handleChange}
                        onKeyDown={onKeyDown}
                        onPaste={onPaste}
                        onCompositionStart={onCompositionStart}
                        onCompositionEnd={onCompositionEnd}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        disabled={disabled}
                    />

                    {/* Animated Placeholders */}
                    {showSuggestions && !value && placeholders.length > 0 && (
                        <div className="pointer-events-none absolute inset-0 flex items-center px-2 text-sm sm:text-base text-muted-foreground/50 z-0 select-none">
                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={`placeholder-${currentPlaceholder}`}
                                    initial={{ y: 5, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -5, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="truncate"
                                >
                                    {placeholders[currentPlaceholder]}
                                </motion.p>
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Static Placeholder fallback */}
                    {!value && (!showSuggestions || placeholders.length === 0) && placeholder && (
                        <div className="pointer-events-none absolute inset-0 flex items-center px-2 text-sm sm:text-base text-muted-foreground/50 z-0 select-none">
                            <p className="truncate">{placeholder}</p>
                        </div>
                    )}
                </div>

                {rightElement && (
                    <div className="flex-shrink-0 z-20 mb-1">
                        {rightElement}
                    </div>
                )}
            </div>

            {/* Gradiente sutil en la parte inferior */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Fallback para navegadores sin backdrop-filter */}
            <noscript>
                <style>{`
                    .glass-input-fallback {
                        background: rgba(0, 0, 0, 0.4) !important;
                    }
                `}</style>
            </noscript>
        </motion.div>
    )
}
