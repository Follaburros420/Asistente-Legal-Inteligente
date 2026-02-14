"use client"

import { memo, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { StreamPhase, getStatusMessageForPhase } from "@/lib/stream-protocol"

// Frases por fase del stream
const PHASE_PHRASES: Record<Exclude<StreamPhase, "idle" | "completed" | "error" | "cancelled">, string[]> = {
    classifying: [
        "Analizando tu consulta…",
        "Identificando el tipo de solicitud…",
        "Evaluando el alcance de tu consulta…"
    ],
    searching: [
        "Investigando normas oficiales…",
        "Contrastando jurisprudencia aplicable…",
        "Verificando texto literal de artículos…",
        "Explorando fuentes complementarias…"
    ],
    drafting: [
        "Sintetizando hallazgos…",
        "Preparando respuesta estructurada…",
        "Organizando fundamentos legales…"
    ],
    streaming: [
        "Redactando respuesta…",
        "Generando contenido…",
        "Finalizando respuesta…"
    ]
}

const PHRASE_INTERVAL = 2800 // ms between phrase rotations

interface ThinkingIndicatorProps {
    phase?: StreamPhase
    statusMessage?: string
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
    const displayMessage = statusMessage || currentPhrases[phraseIndex]

    return (
        <div className="flex flex-col gap-1 min-h-[24px] justify-center py-1">
            <div className="flex items-center gap-3">
                {/* 
                 * Abstract "Breathing" Source
                 * Replaces technical spinners with a subtle, organic pulse.
                 */}
                <div className="relative flex items-center justify-center">
                    <motion.div
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 1, 0.5]
                        }}
                        transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                    <motion.div
                        className="absolute inset-0 rounded-full bg-primary/20"
                        animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.2, 0, 0.2]
                        }}
                        transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "easeOut"
                        }}
                    />
                </div>

                {/* 
                 * Editorial Text Treatment
                 * Muestra el mensaje de status o frases rotativas según la fase.
                 */}
                <div className="relative h-6 flex-1 overflow-hidden min-w-[200px]">
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={displayMessage}
                            initial={{ opacity: 0, y: 5, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -5, filter: "blur(4px)" }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                            className="absolute inset-0 text-sm font-medium text-muted-foreground/90 tracking-wide"
                        >
                            {displayMessage}
                        </motion.span>
                    </AnimatePresence>
                </div>
            </div>

            {/* 
             * Ambient Light Trace
             * A very subtle pass of light to suggest active processing without
             * looking like a progress bar.
             */}
            <div className="h-[1px] w-full overflow-hidden mt-2 bg-gradient-to-r from-transparent via-primary/5 to-transparent relative opacity-50">
                <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent w-full h-full"
                    animate={{
                        x: ["-100%", "100%"]
                    }}
                    transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "linear",
                        repeatDelay: 0.5
                    }}
                />
            </div>
        </div>
    )
})

ThinkingIndicator.displayName = "ThinkingIndicator"
