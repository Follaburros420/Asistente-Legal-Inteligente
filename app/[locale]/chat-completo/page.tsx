'use client'

import { useState } from 'react'
import { MessageBubble } from '@/components/chat/modern/MessageBubble'
import { TypingIndicator } from '@/components/chat/modern/TypingIndicator'
import { QuickReplies } from '@/components/chat/modern/QuickReplies'
import { ModernSidebar } from '@/components/sidebar/modern/ModernSidebar'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Send, Paperclip, Menu, X, Moon, Sun, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ContentType } from '@/types'
import { useTheme } from 'next-themes'
import { ChatbotUIContext } from '@/context/context'

export default function ChatCompletoPage() {
  const [isTyping, setIsTyping] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [contentType, setContentType] = useState<ContentType>('chats')
  const [inputValue, setInputValue] = useState('')
  const { theme, setTheme } = useTheme()
  
  const [messages, setMessages] = useState([
    {
      id: 1,
      variant: 'ai' as const,
      content: '¡Bienvenido al nuevo diseño del Asistente Legal Inteligente! 🎨\n\nAhora con:\n• Animaciones suaves y profesionales\n• Sidebar moderna y organizada\n• Interfaz más limpia y espaciosa\n• Mejor experiencia de usuario\n\n¿En qué puedo ayudarte hoy?',
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
    setMessages(prev => [...prev, {
      id: prev.length + 1,
      variant: 'user' as const,
      content: reply,
      timestamp: new Date(),
      userName: 'Pedro',
      status: 'delivered' as const,
    }])

    setTimeout(() => {
      setIsTyping(true)
      
      setTimeout(() => {
        setIsTyping(false)
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          variant: 'ai' as const,
          content: `Excelente pregunta sobre "${reply}".\n\nEsta es una demostración del nuevo sistema de chat moderno. El diseño ahora incluye:\n\n✨ Burbujas de mensaje con animaciones\n🎨 Colores consistentes con el tema\n💬 Indicador de escritura animado\n🎯 Sidebar moderna y organizada\n\nLa interfaz es más profesional y agradable de usar.`,
          timestamp: new Date(),
          userName: 'Asistente Legal',
        }])
        
        toast.success('Respuesta generada', {
          description: 'Nuevo diseño activo'
        })
      }, 2000)
    }, 300)
  }

  const handleSend = () => {
    if (!inputValue.trim()) return
    
    handleQuickReply(inputValue)
    setInputValue('')
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('Copiado al portapapeles')
  }

  const handleRegenerate = () => {
    toast.info('Regenerando respuesta...', {
      description: 'Conectar con la IA real'
    })
  }

  // Mock context data para la sidebar
  const mockContextValue = {
    chats: [
      { id: '1', name: 'Consulta sobre contratos', user_id: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: '2', name: 'Derechos laborales', user_id: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: '3', name: 'Análisis de documento', user_id: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ],
    files: [
      { id: '1', name: 'Contrato ejemplo.pdf', user_id: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), type: 'pdf', file_path: '', size: 1024, tokens: 100 },
      { id: '2', name: 'Documento legal.docx', user_id: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), type: 'docx', file_path: '', size: 2048, tokens: 200 },
    ],
    collections: [],
    assistants: [
      { id: '1', name: 'Asistente Laboral', user_id: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), folder_id: null, sharing: 'private', context_length: 4096, include_profile_context: true, include_workspace_instructions: true, model: 'gpt-4', image_path: '', description: '', embeddings_provider: 'openai', prompt: '' },
    ],
    tools: [],
    folders: [
      { id: '1', name: 'Contratos', user_id: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), type: 'chats', workspace_id: '1', description: '' },
    ],
  } as any

  return (
    <ChatbotUIContext.Provider value={mockContextValue}>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Sidebar moderna */}
        <div className={`transition-all duration-300 ${showSidebar ? 'w-80' : 'w-0'} overflow-hidden`}>
          <ModernSidebar 
            contentType={contentType}
            showSidebar={showSidebar}
            onContentTypeChange={setContentType}
          />
        </div>

        {/* Main chat area */}
        <div className="flex flex-col flex-1">
          {/* Header moderno */}
          <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="hover:bg-muted"
                >
                  {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
                
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/landing">
                    <ArrowLeft className="w-5 h-5" />
                  </Link>
                </Button>

                <Separator orientation="vertical" className="h-6" />

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold">Chat Completo - Nueva Interfaz</h1>
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="w-3 h-3" />
                      Moderno
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span>En línea</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </header>

          {/* Chat messages área */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto py-8">
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

              <AnimatePresence>
                {isTyping && <TypingIndicator />}
              </AnimatePresence>

              {!isTyping && messages.length > 0 && (
                <QuickReplies 
                  replies={quickReplies}
                  onSelect={handleQuickReply}
                />
              )}
            </div>
          </div>

          {/* Composer moderno */}
          <div className="border-t border-border bg-background/95 backdrop-blur">
            <div className="max-w-4xl mx-auto px-4 py-4">
              <div className={cn(
                'relative rounded-2xl border-2 transition-all duration-150',
                'bg-background',
                'focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10',
              )}>
                <div className="flex items-end gap-3 p-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder="Escribe tu mensaje legal..."
                    rows={1}
                    className="flex-1 bg-transparent resize-none focus:outline-none text-sm py-2 max-h-32 min-h-[36px]"
                    style={{ 
                      height: 'auto',
                      overflowY: inputValue.split('\n').length > 3 ? 'auto' : 'hidden'
                    }}
                  />
                  
                  <Button
                    size="icon"
                    className="h-9 w-9 flex-shrink-0"
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <p className="mt-2 text-xs text-muted-foreground text-center">
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Enter</kbd> para enviar,{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Shift + Enter</kbd> para nueva línea
              </p>
            </div>
          </div>
        </div>
      </div>
    </ChatbotUIContext.Provider>
  )
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}

function Badge({ children, variant = 'default', className = '' }: any) {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
      variant === 'secondary' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'
    } ${className}`}>
      {children}
    </span>
  )
}

function Separator({ orientation = 'horizontal', className = '' }: any) {
  return (
    <div className={`bg-border ${
      orientation === 'vertical' ? 'w-px' : 'h-px w-full'
    } ${className}`} />
  )
}


