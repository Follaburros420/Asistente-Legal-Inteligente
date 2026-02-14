"use client"

import { FC, useState, useEffect } from "react"

interface LoadingScreenProps {
    message?: string
    showMessages?: boolean
    variant?: "default" | "minimal" | "branded"
}

const defaultMessages = [
    "Preparando tu experiencia legal...",
    "Cargando módulos de inteligencia...",
    "Conectando con ALI...",
    "Optimizando recursos...",
    "Casi listo...",
]

export const LoadingScreen: FC<LoadingScreenProps> = ({
    message,
    showMessages = true,
    variant = "default"
}) => {
    const [messageIndex, setMessageIndex] = useState(0)
    const [dots, setDots] = useState("")
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        if (!showMessages || message) return

        const messageInterval = setInterval(() => {
            setMessageIndex(prev => (prev + 1) % defaultMessages.length)
        }, 2000)

        return () => clearInterval(messageInterval)
    }, [showMessages, message])

    useEffect(() => {
        const dotsInterval = setInterval(() => {
            setDots(prev => (prev.length >= 3 ? "" : prev + "."))
        }, 400)

        return () => clearInterval(dotsInterval)
    }, [])

    if (!mounted) return null

    const displayMessage = message || (showMessages ? defaultMessages[messageIndex] : "Cargando...")

    if (variant === "minimal") {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                    <p className="text-sm text-foreground/70">
                        {displayMessage}
                        <span className="inline-block w-4 text-primary">{dots}</span>
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
            {/* Fondo animado */}
            <div className="absolute inset-0 overflow-hidden">
                <div
                    className="absolute -left-1/4 top-1/4 size-[600px] animate-pulse rounded-full bg-primary/5 blur-3xl dark:bg-primary/10"
                    style={{ animationDuration: "3s" }}
                />
                <div
                    className="absolute -right-1/4 bottom-1/4 size-[600px] animate-pulse rounded-full bg-blue-500/5 blur-3xl dark:bg-blue-500/10"
                    style={{ animationDuration: "3s", animationDelay: "1.5s" }}
                />
            </div>

            {/* Contenido principal */}
            <div className="relative z-10 flex flex-col items-center gap-8">
                {/* Spinner */}
                <div className="relative flex items-center justify-center">
                    <div
                        className="absolute size-28 animate-ping rounded-full bg-primary/10"
                        style={{ animationDuration: "2s" }}
                    />
                    <div className="relative size-24">
                        <div
                            className="absolute inset-0 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary"
                            style={{ animationDuration: "1.2s" }}
                        />
                        <div
                            className="absolute inset-2 animate-spin rounded-full border-[3px] border-blue-500/20 border-t-blue-500"
                            style={{ animationDuration: "1.8s", animationDirection: "reverse" }}
                        />
                        <div className="absolute inset-6 flex items-center justify-center rounded-full bg-primary/5">
                            <div className="size-3 animate-pulse rounded-full bg-primary/50" />
                        </div>
                    </div>
                </div>

                {/* Branding */}
                {variant === "branded" && (
                    <div className="mb-2 bg-gradient-to-r from-primary via-purple-500 to-blue-500 bg-clip-text text-3xl font-bold tracking-wider text-transparent">
                        ALI
                    </div>
                )}

                {/* Mensaje dinámico */}
                <div className="text-center">
                    <p className="min-w-72 text-lg font-medium text-foreground/80 transition-opacity duration-500">
                        {displayMessage}
                        <span className="inline-block w-5 text-left text-primary">{dots}</span>
                    </p>
                </div>

                {/* Barra de progreso — sólida, rápida al 80%, lenta el último 20%, se queda en 100% */}
                <div className="h-1 w-56 overflow-hidden rounded-full bg-foreground/5">
                    <div
                        className="h-full rounded-full bg-primary"
                        style={{
                            animation: "progressFill 2.5s ease-out forwards",
                        }}
                    />
                </div>

                {/* Indicador secundario */}
                <div className="flex items-center gap-2">
                    <div className="size-1.5 animate-pulse rounded-full bg-primary/60" style={{ animationDelay: "0ms" }} />
                    <div className="size-1.5 animate-pulse rounded-full bg-primary/60" style={{ animationDelay: "200ms" }} />
                    <div className="size-1.5 animate-pulse rounded-full bg-primary/60" style={{ animationDelay: "400ms" }} />
                </div>
            </div>

            <style jsx>{`
         @keyframes progressFill {
           0% {
             width: 0%;
           }
           30% {
             width: 80%;
           }
           100% {
             width: 100%;
           }
         }
       `}</style>
        </div>
    )
}

export default LoadingScreen
