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
 * ChatInputArea - Componente de input para el chat
 *
 * REFACTORIZACIÓN: Este componente ahora usa un enfoque completamente controlado.
 * El valor se gestiona EXCLUSIVAMENTE desde el padre (userInput del contexto).
 * No hay estado local que pueda causar race conditions.
 *
 * La sincronización funciona así:
 * - El usuario escribe → onChange(actualValue) → padre actualiza userInput
 * - Padre re-renderiza con nuevo value → input muestra el valor correcto
 *
 * Para limpiar el input, el padre debe llamar setUserInput("")
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
        <div
            className={cn(
                "relative mx-auto w-full overflow-hidden",
                "rounded-2xl",
                "bg-background/95 backdrop-blur-xl",
                "border border-white/10 dark:border-white/5",
                "transition-colors duration-200",
                isFocused && "border-primary/30",
                value && "bg-background"
            )}
            style={{ minHeight: "60px" }}
        >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

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

            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border/30 to-transparent" />
        </div>
    )
}
