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
    const messageInterval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % loadingMessages.length)
    }, 2000)

    const dotsInterval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? "" : prev + "."))
    }, 400)

    return () => {
      clearInterval(messageInterval)
      clearInterval(dotsInterval)
    }
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
      {/* Fondo animado sutil */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 size-full animate-pulse rounded-full bg-primary/5 blur-3xl dark:bg-primary/10" />
        <div className="absolute -right-1/2 -bottom-1/2 size-full animate-pulse rounded-full bg-blue-500/5 blur-3xl dark:bg-blue-500/10" style={{ animationDelay: "1s" }} />
      </div>

      {/* Contenido principal */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Spinner */}
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" style={{ animationDuration: "1.5s" }} />
          <div className="relative size-20">
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary" style={{ animationDuration: "1s" }} />
            <div className="absolute inset-2 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-500" style={{ animationDuration: "1.5s", animationDirection: "reverse" }} />
          </div>
        </div>

        {/* Mensaje dinámico */}
        <div className="text-center">
          <p className="min-w-64 text-lg font-medium text-foreground transition-all duration-500">
            {loadingMessages[messageIndex]}
            <span className="inline-block w-6 text-left text-primary">{dots}</span>
          </p>
        </div>

        {/* Barra de progreso — sólida, rápida al 80%, lenta el último 20%, se queda en 100% */}
        <div className="h-1 w-56 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-primary"
            style={{
              animation: "progressFill 2.5s ease-out forwards",
            }}
          />
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
