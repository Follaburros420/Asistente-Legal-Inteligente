"use client"

/**
 * ChatView Component
 * 
 * Main chat interface for the LangGraph legal assistant.
 * Integrates with TodoPanel and EvidencePanel.
 */

import * as React from "react"
import { 
  Send, 
  Loader2, 
  AlertCircle, 
  FileText, 
  Network, 
  Globe,
  RefreshCw,
  Copy,
  Check,
  ChevronDown
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TodoPanel, TodoItem } from "./TodoPanel"
import { EvidencePanel, Evidence } from "./EvidencePanel"
import { YesNoInterruptModal } from "./YesNoInterruptModal"

// ============================================================================
// TYPES
// ============================================================================

export type MessageRole = "user" | "assistant" | "system"

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  citations?: Citation[]
}

export interface Citation {
  id: string
  type: "vector" | "graph" | "web"
  ref: string
  excerpt: string
  source_url?: string
}

export interface InterruptPayload {
  ui_type: "yes_no_list" | "text_input" | "document_preview"
  title: string
  why_needed: string
  what_happens_next?: string
  questions: Question[]
  explain?: string
}

export interface Question {
  id: string
  label: string
  type: "yes_no" | "text" | "select"
  default?: string | boolean
  depends_on?: {
    question_id: string
    value: any
  }
  section?: string
  required?: boolean
  help?: string
  options?: string[]
}

export interface ChatViewState {
  messages: ChatMessage[]
  todo: TodoItem[]
  evidence: Evidence
  isRunning: boolean
  interruptPayload: InterruptPayload | null
  threadId: string | null
  mode: "investigate" | "draft" | null
  finalDocument: string | null
  error: string | null
}

export interface ChatViewProps {
  className?: string
  initialMessage?: string
  caseContext?: {
    case_id?: string
    jurisdiction?: string
  }
  onMessageSent?: (message: string) => void
  onDocumentComplete?: (document: string) => void
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function startRun(query: string, caseContext?: any): Promise<any> {
  const response = await fetch("/api/langgraph/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      caseContext
    })
  })
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  
  return response.json()
}

async function resumeRun(threadId: string, answers: Record<string, any>): Promise<any> {
  const response = await fetch("/api/langgraph/resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      threadId,
      answers
    })
  })
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  
  return response.json()
}

// ============================================================================
// MESSAGE BUBBLE COMPONENT
// ============================================================================

function MessageBubble({ message, onCopy }: { message: ChatMessage; onCopy: () => void }) {
  const [copied, setCopied] = React.useState(false)
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onCopy()
  }
  
  const isUser = message.role === "user"
  
  return (
    <div className={cn(
      "flex gap-3",
      isUser ? "justify-end" : "justify-start"
    )}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={cn(
        "max-w-[80%] rounded-lg p-3",
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted"
      )}>
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        
        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Network className="h-3 w-3" />
              Fuentes:
            </div>
            <div className="flex flex-wrap gap-1">
              {message.citations.map(citation => (
                <Badge key={citation.id} variant="outline" className="text-xs">
                  {citation.type === "vector" && <FileText className="h-3 w-3 mr-1" />}
                  {citation.type === "graph" && <Network className="h-3 w-3 mr-1" />}
                  {citation.type === "web" && <Globe className="h-3 w-3 mr-1" />}
                  {citation.ref}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Actions */}
        {!isUser && (
          <div className="mt-2 flex justify-end">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3 mr-1" />
              ) : (
                <Copy className="h-3 w-3 mr-1" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
          <span className="text-xs text-primary-foreground font-medium">U</span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ChatView({
  className,
  initialMessage,
  caseContext,
  onMessageSent,
  onDocumentComplete
}: ChatViewProps) {
  const [state, setState] = React.useState<ChatViewState>({
    messages: [],
    todo: [],
    evidence: { chunks: [], graph_refs: [], web_refs: [] },
    isRunning: false,
    interruptPayload: null,
    threadId: null,
    mode: null,
    finalDocument: null,
    error: null
  })
  
  const [input, setInput] = React.useState(initialMessage || "")
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  
  // Scroll to bottom on new messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [state.messages])
  
  // Handle initial message
  React.useEffect(() => {
    if (initialMessage && state.messages.length === 0) {
      handleSubmit(initialMessage)
    }
  }, [initialMessage])
  
  // Handle submit
  const handleSubmit = async (query?: string) => {
    const messageText = query || input.trim()
    if (!messageText || state.isRunning) return
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date()
    }
    
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isRunning: true,
      error: null
    }))
    
    setInput("")
    onMessageSent?.(messageText)
    
    try {
      const result = await startRun(messageText, caseContext)
      
      if (result.success) {
        // Add assistant message
        const lastMessage = result.result?.messages?.slice(-1)[0]
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: lastMessage?.content || "Procesando...",
          timestamp: new Date(),
          citations: result.result?.citations
        }
        
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          todo: result.result?.todo || [],
          threadId: result.threadId,
          mode: result.mode,
          interruptPayload: result.interruptPayload,
          finalDocument: result.result?.finalDocument || null,
          isRunning: result.status === "running"
        }))
        
        if (result.result?.finalDocument) {
          onDocumentComplete?.(result.result.finalDocument)
        }
      } else {
        throw new Error(result.error || "Error en el procesamiento")
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: error.message
      }))
    }
  }
  
  // Handle interrupt answers
  const handleInterruptAnswers = async (answers: Record<string, any>) => {
    if (!state.threadId) return
    
    setState(prev => ({
      ...prev,
      isRunning: true,
      interruptPayload: null
    }))
    
    try {
      const result = await resumeRun(state.threadId, answers)
      
      if (result.success) {
        const lastMessage = result.result?.messages?.slice(-1)[0]
        const assistantMessage: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          content: lastMessage?.content || "Continuando...",
          timestamp: new Date()
        }
        
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          todo: result.result?.todo || prev.todo,
          interruptPayload: result.interruptPayload,
          finalDocument: result.result?.finalDocument || null,
          isRunning: result.status === "running"
        }))
        
        if (result.result?.finalDocument) {
          onDocumentComplete?.(result.result.finalDocument)
        }
      } else {
        throw new Error(result.error || "Error al continuar")
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: error.message
      }))
    }
  }
  
  // Handle form submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSubmit()
  }
  
  return (
    <div className={cn("flex h-full", className)}>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-4xl mx-auto">
            {state.messages.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Asistente Legal Inteligente</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Puedo ayudarte a investigar temas legales o redactar documentos jurídicos.
                  Escribe tu consulta para comenzar.
                </p>
              </div>
            )}
            
            {state.messages.map(message => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                onCopy={() => {}}
              />
            ))}
            
            {state.isRunning && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Procesando...</span>
              </div>
            )}
            
            {state.error && (
              <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{state.error}</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        {/* Input Area */}
        <div className="border-t p-4">
          <form onSubmit={handleFormSubmit} className="max-w-4xl mx-auto">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu consulta legal..."
                className="min-h-[60px] resize-none"
                disabled={state.isRunning || !!state.interruptPayload}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
              />
              <Button 
                type="submit" 
                size="icon"
                disabled={!input.trim() || state.isRunning || !!state.interruptPayload}
              >
                {state.isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Side Panel */}
      <div className="w-80 border-l flex flex-col bg-muted/30">
        {/* Mode Badge */}
        {state.mode && (
          <div className="p-4 border-b">
            <Badge variant={state.mode === "draft" ? "default" : "secondary"}>
              {state.mode === "draft" ? "Redacción" : "Investigación"}
            </Badge>
          </div>
        )}
        
        {/* Todo Panel */}
        <div className="p-4 border-b">
          <TodoPanel 
            items={state.todo} 
            title="Progreso"
            compact
          />
        </div>
        
        {/* Evidence Panel */}
        <div className="flex-1 p-4 overflow-hidden">
          <EvidencePanel 
            evidence={state.evidence}
            compact
          />
        </div>
        
        {/* Final Document Preview */}
        {state.finalDocument && (
          <div className="p-4 border-t">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Documento Final</span>
                  <Button variant="outline" size="sm">
                    Ver completo
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {state.finalDocument.substring(0, 200)}...
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      
      {/* Interrupt Modal */}
      {state.interruptPayload && (
        <YesNoInterruptModal
          payload={state.interruptPayload}
          onSubmit={handleInterruptAnswers}
          onCancel={() => setState(prev => ({ ...prev, interruptPayload: null }))}
        />
      )}
    </div>
  )
}