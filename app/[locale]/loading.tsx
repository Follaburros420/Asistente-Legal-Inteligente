"use client"

import { useState, useEffect } from "react"

const loadingMessages = [
    "Preparando tu experiencia legal...",
    "Cargando módulos de inteligencia...",
    "Conectando con ALI...",
    "Optimizando recursos...",
    "Casi listo...",
]

export default function Loading() {
    const [messageIndex, setMessageIndex] = useState(0)
    const [dots, setDots] = useState("")
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        // Rotar mensajes cada 2 segundos
        const messageInterval = setInterval(() => {
            setMessageIndex(prev => (prev + 1) % loadingMessages.length)
        }, 2000)

        // Animación de puntos cada 400ms
        const dotsInterval = setInterval(() => {
            setDots(prev => (prev.length >= 3 ? "" : prev + "."))
        }, 400)

        return () => {
            clearInterval(messageInterval)
            clearInterval(dotsInterval)
        }
    }, [])

    // Evitar hidratación incorrecta
    if (!mounted) return null

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
            {/* Fondo animado sutil - un solo orbe morado */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] animate-pulse rounded-full bg-primary/10 blur-3xl" />
            </div>

            {/* Contenido principal */}
            <div className="relative z-10 flex flex-col items-center gap-8">
                {/* Logo o Spinner animado - Un solo orbe morado */}
                <div className="relative">
                    {/* Círculo exterior pulsante */}
                    <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" style={{ animationDuration: "1.5s" }} />

                    {/* Spinner principal - Solo un anillo morado */}
                    <div className="relative size-20">
                        <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary" style={{ animationDuration: "1s" }} />
                    </div>
                </div>

                {/* Mensaje dinámico */}
                <div className="text-center">
                    <p className="min-w-64 text-lg font-medium text-foreground transition-all duration-500">
                        {loadingMessages[messageIndex]}
                        <span className="inline-block w-6 text-left text-primary">{dots}</span>
                    </p>
                </div>

                {/* Barra de progreso sutil */}
                <div className="h-1 w-48 overflow-hidden rounded-full bg-foreground/10">
                    <div
                        className="h-full animate-pulse rounded-full bg-gradient-to-r from-primary via-primary/70 to-primary"
                        style={{
                            animation: "shimmer 2s ease-in-out infinite",
                            backgroundSize: "200% 100%"
                        }}
                    />
                </div>
            </div>

            {/* Estilos para la animación shimmer */}
            <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
        </div>
    )
}
