import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp, Square } from "lucide-react"
import { FC, useEffect, useRef, useState, ReactNode, useCallback } from "react"
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
    
    // Sync local value with external value
    useEffect(() => {
        setLocalValue(value)
    }, [value])
    
    // Handle change with immediate local update
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value
        setLocalValue(newValue)
        onChange(newValue)
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
                            "text-foreground placeholder:text-muted-foreground/0", // Hide default placeholder
                            "focus:outline-none focus:ring-0",
                            "relative z-20",
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
                        onBlur={() => setIsFocused(false)}
                        disabled={disabled}
                    />

                    {/* Animated Placeholders */}
                    {showSuggestions && !localValue && placeholders.length > 0 && (
                        <div className="pointer-events-none absolute inset-0 flex items-center px-2 text-sm sm:text-base text-muted-foreground/50 z-10">
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
                        <div className="pointer-events-none absolute inset-0 flex items-center px-2 text-sm sm:text-base text-muted-foreground/50 z-10">
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
