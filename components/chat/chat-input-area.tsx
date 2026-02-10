import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp, Square } from "lucide-react"
import { FC, useEffect, useRef, useState, ReactNode } from "react"
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
 * NOTA SOBRE EL MANEJO DE ESTADO:
 * Este componente usa un estado local (localValue) para evitar race conditions
 * durante el typing. La sincronización con el valor externo solo ocurre cuando:
 * 1. El input NO está enfocado (usuario no está escribiendo activamente)
 * 2. El valor externo es vacío (reset intencional, ej: después de enviar mensaje)
 * 3. El valor externo es significativamente diferente (ej: navegación de historial)
 *
 * Esto previene el bug donde solo se capturaba la última letra del input.
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
    const [localValue, setLocalValue] = useState(value)
    const isComposingRef = useRef(false)

    // Track the last value we synced from externally
    const lastSyncedValueRef = useRef(value)

    // Sync local value with external value when appropriate
    useEffect(() => {
        // Always sync if the external value is empty (likely a reset/clear action)
        const isEmptyReset = value === "" && localValue !== ""

        // Sync if not focused (user isn't actively typing)
        const notFocused = !isFocused

        // Sync if the external value changed and it's different from what we last synced
        // This handles cases like navigating through chat history
        const externalChange = value !== lastSyncedValueRef.current && value !== localValue

        if (isEmptyReset || (notFocused && externalChange)) {
            setLocalValue(value)
            lastSyncedValueRef.current = value
        }
    }, [value, isFocused, localValue])

    // Handle change with immediate local update
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value
        setLocalValue(newValue)
        lastSyncedValueRef.current = newValue
        onChange(newValue)
    }

    // Handle blur - reset focus state
    const handleBlur = () => {
        setIsFocused(false)
    }

    // Rotating placeholders logic
    useEffect(() => {
        if (!showSuggestions || localValue || placeholders.length === 0) return

        const interval = setInterval(() => {
            setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length)
        }, 3000)

        return () => clearInterval(interval)
    }, [showSuggestions, localValue, placeholders.length])

    return (
        <div
            className={cn(
                "relative mx-auto w-full overflow-hidden",
                "rounded-2xl",
                "bg-background/95 backdrop-blur-xl",
                "border border-white/10 dark:border-white/5",
                "transition-colors duration-200",
                isFocused && "border-primary/30",
                localValue && "bg-background"
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
                        ref={textareaRef}
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
                        value={localValue}
                        onChange={handleChange}
                        onKeyDown={onKeyDown}
                        onPaste={onPaste}
                        onCompositionStart={onCompositionStart}
                        onCompositionEnd={onCompositionEnd}
                        onFocus={() => setIsFocused(true)}
                        onBlur={handleBlur}
                        disabled={disabled}
                    />

                    {/* Animated Placeholders */}
                    {showSuggestions && !localValue && placeholders.length > 0 && (
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
                    {!localValue && (!showSuggestions || placeholders.length === 0) && placeholder && (
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
