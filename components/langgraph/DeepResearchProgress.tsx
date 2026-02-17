"use client"

/**
 * DeepResearchProgress Component
 * 
 * Shows the deep research pipeline steps with real-time progress indicators.
 * Displays all 7 steps of the investigation pipeline with visual feedback.
 */

import * as React from "react"
import { Check, Circle, Loader2, Search, FileText, Network, Globe, Sparkles, ShieldCheck, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { ALIContext } from "@/context/context"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// ============================================================================
// TYPES
// ============================================================================

export interface ResearchStep {
  id: string
  nodeName: string
  label: string
  description: string
  icon: React.ElementType
}

export interface DeepResearchProgressProps {
  className?: string
  compact?: boolean
}

// ============================================================================
// DEEP RESEARCH STEPS DEFINITION
// ============================================================================

const DEEP_RESEARCH_STEPS: ResearchStep[] = [
  {
    id: "make_research_plan",
    nodeName: "make_research_plan",
    label: "Planificando investigación",
    description: "Analizando consulta y definiendo estrategia de búsqueda",
    icon: Search
  },
  {
    id: "search_vector_store",
    nodeName: "retrieve_vector",
    label: "Buscando en documentos locales",
    description: "Consultando base de documentos internos",
    icon: FileText
  },
  {
    id: "search_knowledge_graph",
    nodeName: "retrieve_graph",
    label: "Consultando grafo de conocimiento",
    description: "Explorando relaciones y entidades legales",
    icon: Network
  },
  {
    id: "search_web",
    nodeName: "maybe_web_search",
    label: "Buscando en la web",
    description: "Consultando fuentes externas y jurisprudencia",
    icon: Globe
  },
  {
    id: "synthesize_findings",
    nodeName: "synthesize_answer",
    label: "Sintetizando hallazgos",
    description: "Integrando información de todas las fuentes",
    icon: Sparkles
  },
  {
    id: "review_quality",
    nodeName: "quality_review",
    label: "Revisando calidad",
    description: "Verificando precisión y completitud",
    icon: ShieldCheck
  },
  {
    id: "finalize_response",
    nodeName: "streaming",
    label: "Finalizando respuesta",
    description: "Generando respuesta final con citas",
    icon: Send
  }
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Maps status message to step ID
 */
function mapMessageToStepId(message: string): string | null {
  const messageMap: Record<string, string> = {
    "Planificando investigación legal…": "make_research_plan",
    "Buscando en documentos internos…": "search_vector_store",
    "Consultando knowledge graph…": "search_knowledge_graph",
    "Investigando fuentes web…": "search_web",
    "Sintetizando respuesta con citas…": "synthesize_findings",
    "Revisión de calidad…": "review_quality",
    "Generando respuesta…": "finalize_response",
    "Analizando tu consulta legal…": "make_research_plan"
  }
  
  for (const [key, value] of Object.entries(messageMap)) {
    if (message.includes(key) || key.includes(message)) {
      return value
    }
  }
  
  return null
}

/**
 * Get step status based on current step and step index
 */
function getStepStatus(
  stepIndex: number,
  currentStepIndex: number,
  isRunning: boolean,
  isCompleted: boolean
): "pending" | "running" | "done" {
  if (isCompleted) return "done"
  if (stepIndex < currentStepIndex) return "done"
  if (stepIndex === currentStepIndex && isRunning) return "running"
  return "pending"
}

// ============================================================================
// STEP ITEM COMPONENT
// ============================================================================

function StepItem({
  step,
  status,
  isCompact
}: {
  step: ResearchStep
  status: "pending" | "running" | "done"
  isCompact?: boolean
}) {
  const Icon = step.icon
  
  return (
    <div className={cn(
      "flex items-start gap-3 transition-all duration-300",
      status === "running" && "bg-primary/5 -mx-2 px-2 py-1 rounded-lg"
    )}>
      {/* Status Icon */}
      <div className={cn(
        "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors",
        status === "done" && "bg-green-500/20 text-green-500",
        status === "running" && "bg-primary/20 text-primary",
        status === "pending" && "bg-muted text-muted-foreground"
      )}>
        {status === "done" && <Check className="h-3.5 w-3.5" />}
        {status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {status === "pending" && <Circle className="h-3.5 w-3.5" />}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className={cn(
            "h-4 w-4",
            status === "done" && "text-green-500",
            status === "running" && "text-primary",
            status === "pending" && "text-muted-foreground"
          )} />
          <span className={cn(
            "text-sm font-medium truncate",
            status === "running" && "text-primary",
            status === "pending" && "text-muted-foreground"
          )}>
            {step.label}
          </span>
        </div>
        
        {!isCompact && status === "running" && (
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            {step.description}
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DeepResearchProgress({
  className,
  compact = false
}: DeepResearchProgressProps) {
  const {
    streamPhase,
    streamMessage,
    deepResearchEnabled,
    streamState
  } = React.useContext(ALIContext)
  
  // Don't render if deep research is not enabled
  if (!deepResearchEnabled) {
    return null
  }
  
  // Don't render if idle or completed
  const isActive = streamPhase !== "idle" && streamPhase !== "completed" && streamPhase !== "error" && streamPhase !== "cancelled"
  const isCompleted = streamPhase === "completed"
  
  if (!isActive && !isCompleted) {
    return null
  }
  
  // Determine current step based on stream message
  const currentStepId = mapMessageToStepId(streamMessage || "")
  const currentStepIndex = currentStepId 
    ? DEEP_RESEARCH_STEPS.findIndex(s => s.id === currentStepId || s.nodeName === currentStepId)
    : -1
  
  // Calculate progress
  const progressPercentage = isCompleted 
    ? 100 
    : currentStepIndex >= 0 
      ? Math.round(((currentStepIndex + 1) / DEEP_RESEARCH_STEPS.length) * 100)
      : 0
  
  // Compact version for header/mini display
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Badge variant="secondary" className="gap-1.5">
          <Search className="h-3 w-3" />
          Investigación Profunda
        </Badge>
        {isActive && (
          <>
            <Progress value={progressPercentage} className="w-20 h-1.5" />
            <span className="text-xs text-muted-foreground">{progressPercentage}%</span>
          </>
        )}
        {isCompleted && (
          <Badge variant="outline" className="text-green-500 border-green-500/50">
            <Check className="h-3 w-3 mr-1" />
            Completado
          </Badge>
        )}
      </div>
    )
  }
  
  // Full version
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Investigación Profunda
          </CardTitle>
          <Badge variant={isCompleted ? "default" : "secondary"}>
            {isCompleted ? "Completado" : `${progressPercentage}%`}
          </Badge>
        </div>
        {/* Progress bar */}
        <div className="mt-2">
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {DEEP_RESEARCH_STEPS.map((step, index) => {
          const status = getStepStatus(index, currentStepIndex, isActive, isCompleted)
          return (
            <StepItem
              key={step.id}
              step={step}
              status={status}
              isCompact={compact}
            />
          )
        })}
        
        {/* Current status message */}
        {isActive && streamMessage && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs text-muted-foreground italic">
              {streamMessage}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// MINI INDICATOR FOR CHAT HEADER
// ============================================================================

export function DeepResearchMiniIndicator({ className }: { className?: string }) {
  const { streamPhase, streamMessage, deepResearchEnabled } = React.useContext(ALIContext)
  
  if (!deepResearchEnabled) {
    return null
  }
  
  const isActive = streamPhase !== "idle" && streamPhase !== "completed" && streamPhase !== "error" && streamPhase !== "cancelled"
  
  if (!isActive) {
    return null
  }
  
  // Find current step
  const currentStepId = mapMessageToStepId(streamMessage || "")
  const currentStep = DEEP_RESEARCH_STEPS.find(s => s.id === currentStepId || s.nodeName === currentStepId)
  const currentStepIndex = currentStep 
    ? DEEP_RESEARCH_STEPS.findIndex(s => s.id === currentStep.id)
    : -1
  
  const progressPercentage = currentStepIndex >= 0 
    ? Math.round(((currentStepIndex + 1) / DEEP_RESEARCH_STEPS.length) * 100)
    : 0
  
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium">
          {currentStep?.label || "Procesando..."}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={progressPercentage} className="w-16 h-1.5" />
        <span className="text-xs text-muted-foreground w-8">{progressPercentage}%</span>
      </div>
    </div>
  )
}
