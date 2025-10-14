'use client'

import { useState } from 'react'
import { MessageBubble } from '@/components/chat/modern/MessageBubble'
import { TypingIndicator } from '@/components/chat/modern/TypingIndicator'
import { QuickReplies } from '@/components/chat/modern/QuickReplies'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Send } from 'lucide-react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'

export default function ChatDemoPage() {
  const [isTyping, setIsTyping] = useState(false)
  const [messages, setMessages] = useState([
    {
      id: 1,
      variant: 'ai' as const,
      content: '¡Hola! Soy tu Asistente Legal Inteligente. ¿En qué puedo ayudarte hoy?',
      timestamp: new Date(Date.now() - 1000 * 60 * 2),
      userName: 'Asistente Legal',
    },
  ])

  const quickReplies = [
    '¿Cómo redactar un contrato?',
    'Información sobre derechos laborales',
    'Análisis de documento legal',
    'Consulta sobre jurisprudencia',
  ]

  const handleQuickReply = (reply: string) => {
    // Agregar mensaje del usuario
    setMessages(prev => [...prev, {
      id: prev.length + 1,
      variant: 'user' as const,
      content: reply,
      timestamp: new Date(),
      userName: 'Pedro',
      status: 'delivered' as const,
    }])

    // Simular que la IA está escribiendo
    setTimeout(() => {
      setIsTyping(true)
      
      // Después de 2 segundos, mostrar respuesta
      setTimeout(() => {
        setIsTyping(false)
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          variant: 'ai' as const,
          content: `Entiendo que necesitas ayuda con: "${reply}". Esta es una respuesta de demostración con el nuevo diseño moderno del chatbot. El sistema ahora incluye animaciones suaves, mejor jerarquía visual y una experiencia más profesional.`,
          timestamp: new Date(),
          userName: 'Asistente Legal',
        }])
        
        toast.success('Respuesta generada', {
          description: 'El nuevo diseño del chat está activo'
        })
      }, 2000)
    }, 300)
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('Copiado al portapapeles')
  }

  const handleRegenerate = () => {
    toast.info('Regenerando respuesta...', {
      description: 'Esta funcionalidad se conectaría con la IA'
    })
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header moderno */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/landing">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Chat Moderno - Demo</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>En línea</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Tema Moderno Activo
            </Button>
          </div>
        </div>
      </header>

      {/* Chat messages área */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-8">
          {/* Mensajes */}
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                variant={message.variant}
                content={message.content}
                timestamp={message.timestamp}
                userName={message.userName}
                status={message.variant === 'user' ? (message.status || 'delivered') : undefined}
                onCopy={message.variant === 'ai' ? () => handleCopy(message.content) : undefined}
                onRegenerate={message.variant === 'ai' ? handleRegenerate : undefined}
              />
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {isTyping && <TypingIndicator />}
          </AnimatePresence>

          {/* Quick replies */}
          {!isTyping && messages.length > 0 && (
            <QuickReplies 
              replies={quickReplies}
              onSelect={handleQuickReply}
            />
          )}

          {/* Demostración de características */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-12 px-4"
          >
            <div className="max-w-2xl mx-auto space-y-6 p-6 rounded-2xl border-2 border-dashed border-border bg-muted/30">
              <h2 className="text-xl font-bold">✨ Características del Nuevo Diseño</h2>
              
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h3 className="font-semibold">🎨 Diseño Visual</h3>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Burbujas con sombras suaves</li>
                    <li>• Esquinas redondeadas modernas</li>
                    <li>• Colores consistentes con el tema</li>
                    <li>• Avatares profesionales</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">✨ Animaciones</h3>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Entrada suave con spring</li>
                    <li>• Hover effects en burbujas</li>
                    <li>• Typing indicator animado</li>
                    <li>• Quick replies staggered</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">🎯 Interactividad</h3>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Botones de acción en hover</li>
                    <li>• Copiar al portapapeles</li>
                    <li>• Regenerar respuestas</li>
                    <li>• Quick replies clickeables</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">♿ Accesibilidad</h3>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Contraste AA verificado</li>
                    <li>• ARIA labels correctos</li>
                    <li>• Navegación por teclado</li>
                    <li>• Timestamps legibles</li>
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  <strong>Prueba las interacciones:</strong> Haz hover sobre los mensajes de la IA para ver los botones de acción. Haz clic en los "Quick Replies" para simular una conversación.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Composer moderno (simplificado para la demo) */}
      <div className="border-t border-border bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 p-3 rounded-2xl border-2 border-border bg-background">
            <input
              type="text"
              placeholder="Escribe tu mensaje..."
              className="flex-1 bg-transparent focus:outline-none text-sm"
              disabled
            />
            <Button size="icon" className="h-9 w-9" disabled>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Esta es una demo visual. Usa los Quick Replies para simular interacciones.
          </p>
        </div>
      </div>
    </div>
  )
}


