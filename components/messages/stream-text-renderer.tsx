"use client"

import { memo, useEffect, useRef, useState, useCallback } from "react"
import { MessageMarkdown } from "./message-markdown"

interface StreamTextRendererProps {
    /** The full text accumulated so far (grows during streaming) */
    text: string
    /** Whether text is still actively streaming */
    isStreaming: boolean
}

/**
 * Renders streaming text with a smooth reveal buffer.
 * 
 * During streaming: renders plain text (no markdown parse) with a throttled
 * reveal that smooths bursty chunks. Auto-speeds up if the buffer grows
 * too large (>600 chars unrevealed).
 * 
 * On completion: swaps instantly to full MessageMarkdown for rich formatting.
 */
export const StreamTextRenderer = memo(({ text, isStreaming }: StreamTextRendererProps) => {
    const [revealedLength, setRevealedLength] = useState(0)
    const rafRef = useRef<number | null>(null)
    const lastTickRef = useRef<number>(0)
    const isStreamingRef = useRef(isStreaming)

    // Keep ref in sync for use inside rAF loop
    isStreamingRef.current = isStreaming

    const tick = useCallback((timestamp: number) => {
        const textLength = text.length

        setRevealedLength(prev => {
            if (prev >= textLength) return prev

            const unrevealed = textLength - prev
            const elapsed = timestamp - lastTickRef.current

            // Base: ~30ms per tick, reveal 5 chars
            // Auto-speedup: if buffer > 600 chars, reveal much faster
            let baseInterval = 30
            let charsPerTick = 5

            if (unrevealed > 1200) {
                // Very behind — catch up aggressively
                charsPerTick = Math.min(unrevealed, 80)
                baseInterval = 8
            } else if (unrevealed > 600) {
                // Moderately behind — speed up
                charsPerTick = Math.min(unrevealed, 30)
                baseInterval = 15
            } else if (unrevealed > 200) {
                // Slightly behind — gentle speedup
                charsPerTick = 12
                baseInterval = 20
            }

            if (elapsed < baseInterval) return prev

            lastTickRef.current = timestamp

            // Reveal up to next word boundary for natural feel
            const targetPos = Math.min(prev + charsPerTick, textLength)
            const nextSpace = text.indexOf(" ", targetPos)
            const revealTo = nextSpace === -1 ? textLength : Math.min(nextSpace + 1, textLength)

            return revealTo
        })

        rafRef.current = requestAnimationFrame(tick)
    }, [text])

    // Start/stop the reveal loop
    useEffect(() => {
        if (isStreaming && text.length > 0) {
            lastTickRef.current = performance.now()
            rafRef.current = requestAnimationFrame(tick)
        }

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = null
            }
        }
    }, [isStreaming, tick, text.length])

    // When streaming ends, instantly reveal everything
    useEffect(() => {
        if (!isStreaming) {
            setRevealedLength(text.length)
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = null
            }
        }
    }, [isStreaming, text.length])

    // Once streaming is done, render with full Markdown
    if (!isStreaming) {
        return <MessageMarkdown content={text} />
    }

    // During streaming: lightweight plain text render (no heavy markdown parse)
    const visibleText = text.slice(0, revealedLength)

    return (
        <div className="text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
            {visibleText}
            {revealedLength < text.length && (
                <span className="inline-block w-0.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom" />
            )}
        </div>
    )
})

StreamTextRenderer.displayName = "StreamTextRenderer"
