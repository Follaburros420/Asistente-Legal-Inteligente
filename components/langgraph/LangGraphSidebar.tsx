"use client"

/**
 * LangGraphSidebar Component
 * 
 * Sidebar panel that shows TodoPanel and EvidencePanel during LangGraph pipeline execution.
 * Only visible when there are active LangGraph features (todo items, evidence, or drafting mode).
 * 
 * IMPORTANT: For Deep Research mode, only shows web_refs (no graph/vector panels).
 */

import * as React from "react"
import { X, FileText, Network, Globe, ChevronRight, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { ALIContext } from "@/context/context"
import { TodoPanel } from "./TodoPanel"
import { EvidencePanel, Evidence } from "./EvidencePanel"
import { DeepResearchProgress } from "./DeepResearchProgress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export function LangGraphSidebar() {
  const {
    langGraphTodo,
    langGraphEvidence,
    langGraphMode,
    langGraphInterrupt,
    setLangGraphInterrupt,
    langGraphThreadId,
    deepResearchEnabled,
    streamPhase
  } = React.useContext(ALIContext)

  const [isOpen, setIsOpen] = React.useState(false)
  const [isCollapsed, setIsCollapsed] = React.useState(false)

  // Check if deep research is active
  const isDeepResearchActive = deepResearchEnabled && 
    streamPhase !== "idle" && 
    streamPhase !== "completed" && 
    streamPhase !== "error" && 
    streamPhase !== "cancelled"

  // For Deep Research, only show web_refs (no graph/vector panels)
  // This is the key fix: filter evidence based on mode
  const filteredEvidence: Evidence = isDeepResearchActive
    ? { chunks: [], graph_refs: [], web_refs: langGraphEvidence.web_refs }
    : langGraphEvidence

  // Determine if sidebar should be visible
  const hasContent = langGraphTodo.length > 0 || 
    (filteredEvidence.chunks.length > 0 || 
     filteredEvidence.graph_refs.length > 0 || 
     filteredEvidence.web_refs.length > 0) ||
    isDeepResearchActive

  // Auto-open when content appears
  React.useEffect(() => {
    if (hasContent && !isOpen) {
      setIsOpen(true)
    }
  }, [hasContent])

  // Don't render if no content
  if (!hasContent) {
    return null
  }

  const totalEvidence = 
    filteredEvidence.chunks.length + 
    filteredEvidence.graph_refs.length + 
    filteredEvidence.web_refs.length

  return (
    <>
      {/* Floating toggle button when sidebar is closed */}
      {!isOpen && hasContent && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-primary text-primary-foreground p-2 rounded-l-lg shadow-lg hover:bg-primary/90 transition-colors"
          aria-label="Abrir panel de progreso"
        >
          <ChevronLeft className="h-5 w-5" />
          <div className="flex flex-col items-center gap-1 mt-1">
            {langGraphTodo.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                {langGraphTodo.filter(t => t.status === "done").length}/{langGraphTodo.length}
              </Badge>
            )}
            {totalEvidence > 0 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                {totalEvidence}
              </Badge>
            )}
          </div>
        </button>
      )}

      {/* Sidebar panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full z-50 w-80 border-l bg-background shadow-xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            {isDeepResearchActive ? (
              <Badge variant="default" className="bg-purple-600">
                🔬 Investigación Profunda
              </Badge>
            ) : langGraphMode && (
              <Badge variant={langGraphMode === "draft" ? "default" : "secondary"}>
                {langGraphMode === "draft" ? "Redacción" : "Investigación"}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Deep Research Progress - Shows when deep research is active */}
          <DeepResearchProgress />

          {/* Todo Panel - Only show for draft mode, not for deep research */}
          {langGraphTodo.length > 0 && !isDeepResearchActive && (
            <TodoPanel
              items={langGraphTodo}
              title="Progreso"
              compact={false}
            />
          )}

          {/* Evidence Panel - Filtered based on mode */}
          {totalEvidence > 0 && (
            <EvidencePanel
              evidence={filteredEvidence}
              compact={false}
            />
          )}
        </div>

        {/* Thread ID footer */}
        {langGraphThreadId && !isDeepResearchActive && (
          <div className="p-4 border-t text-xs text-muted-foreground">
            Thread: {langGraphThreadId.substring(0, 8)}...
          </div>
        )}
      </div>
    </>
  )
}

/**
 * LangGraphMiniIndicator - Shows a mini indicator when LangGraph is active
 */
export function LangGraphMiniIndicator() {
  const { langGraphTodo, langGraphEvidence, langGraphMode } = React.useContext(ALIContext)

  const hasContent = langGraphTodo.length > 0 || 
    (langGraphEvidence.chunks.length > 0 || 
     langGraphEvidence.graph_refs.length > 0 || 
     langGraphEvidence.web_refs.length > 0)

  if (!hasContent) {
    return null
  }

  const completedTodos = langGraphTodo.filter(t => t.status === "done").length
  const totalTodos = langGraphTodo.length
  const totalEvidence = 
    langGraphEvidence.chunks.length + 
    langGraphEvidence.graph_refs.length + 
    langGraphEvidence.web_refs.length

  const hasRunning = langGraphTodo.some(t => t.status === "running")

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {langGraphMode && (
        <Badge variant={langGraphMode === "draft" ? "default" : "secondary"} className="text-xs">
          {langGraphMode === "draft" ? "Redacción" : "Investigación"}
        </Badge>
      )}
      {totalTodos > 0 && (
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {completedTodos}/{totalTodos}
        </span>
      )}
      {totalEvidence > 0 && (
        <span className="flex items-center gap-1">
          <Network className="h-3 w-3" />
          {totalEvidence}
        </span>
      )}
    </div>
  )
}
