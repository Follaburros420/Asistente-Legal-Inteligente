"use client"

import { memo, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { StreamPhase } from "@/lib/stream-protocol"

// Frases por fase del stream
const PHASE_PHRASES: Record<Exclude<StreamPhase, "idle" | "completed" | "error" | "cancelled">, string[]> = {
    classifying: [
        "Analizando tu consulta",
        "Identificando el tipo de solicitud",
        "Evaluando el alcance de tu consulta"
    ],
    searching: [
        "Investigando normas oficiales",
        "Contrastando jurisprudencia aplicable",
        "Verificando texto literal de artículos",
        "Explorando fuentes complementarias"
    ],
    drafting: [
        "Sintetizando hallazgos",
        "Preparando respuesta estructurada",
        "Organizando fundamentos legales"
    ],
    streaming: [
        "Redactando respuesta",
        "Generando contenido",
        "Finalizando respuesta"
    ]
}

const PHRASE_INTERVAL = 2800 // ms between phrase rotations

interface ThinkingIndicatorProps {
    phase?: StreamPhase
    statusMessage?: string
}

/**
 * AnimatedDots — three dots that cycle 1→2→3→1 continuously,
 * rendered inline right after the phrase text.
 */
const AnimatedDots = () => {
    const [count, setCount] = useState(1)

    useEffect(() => {
        const interval = setInterval(() => {
            setCount(prev => (prev % 3) + 1)
        }, 500)
        return () => clearInterval(interval)
    }, [])

    // Render exactly `count` dots so they animate 1→2→3→1
    return (
        <span className="inline" aria-hidden="true">
            {".".repeat(count)}
        </span>
    )
}

export const ThinkingIndicator = memo(({ phase = "classifying", statusMessage }: ThinkingIndicatorProps) => {
    const [phraseIndex, setPhraseIndex] = useState(0)

    // Obtener frases según la fase actual
    const currentPhrases = phase && phase in PHASE_PHRASES
        ? PHASE_PHRASES[phase as keyof typeof PHASE_PHRASES]
        : PHASE_PHRASES.classifying

    useEffect(() => {
        const interval = setInterval(() => {
            setPhraseIndex(prev => (prev + 1) % currentPhrases.length)
        }, PHRASE_INTERVAL)

        return () => clearInterval(interval)
    }, [currentPhrases.length])

    // Usar mensaje personalizado si se proporciona, sino usar frases rotativas
    // Strip trailing ellipsis/dots from displayMessage since AnimatedDots handles them
    const rawMessage = statusMessage || currentPhrases[phraseIndex]
    const displayMessage = rawMessage.replace(/[.…]+$/, "")

    return (
        <div className="flex items-center min-h-[24px] py-1">
            <AnimatePresence mode="wait">
                <motion.span
                    key={displayMessage}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="text-sm font-medium text-muted-foreground/70 tracking-wide"
                >
                    {displayMessage}
                    <AnimatedDots />
                </motion.span>
            </AnimatePresence>
        </div>
    )
})

ThinkingIndicator.displayName = "ThinkingIndicator"
