"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit, Upload, Loader2, Network, Sparkles, Clock, FileText, Maximize2, GripVertical, X, Shrink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProcessChat } from "@/components/processes/process-chat"
import { ProcessDocuments } from "@/components/processes/process-documents"
import { ProcessGraph } from "@/components/processes/process-graph"
import { GraphSidePanel } from "@/components/processes/graph-side-panel"
import { ProcessStatusBadge } from "@/components/processes/process-status-badge"
import { EditProcessModal } from "@/components/processes/edit-process-modal"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getProcessById } from "@/db/processes"
import { getProcessDocumentsByProcessId } from "@/db/process-documents"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { ProcessInsights, GraphNode } from "@/lib/types"
import { PROCESS_TYPE_LABELS } from "@/features/processes/utils/labels"

type ViewMode = "integrated" | "full-graph"
type MobileGraphMode = "closed" | "mini" | "fullscreen"

export default function ProcessDetailPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = params.workspaceid as string
  const processId = params.processId as string

  const [process, setProcess] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("chat")
  const [showEditModal, setShowEditModal] = useState(false)
  const [graphInsights, setGraphInsights] = useState<Partial<ProcessInsights> | null>(null)

  // New state for integrated view
  const [viewMode, setViewMode] = useState<ViewMode>("integrated")
  // Track whether graph panel is being shown (for conditional rendering)
  const [showGraphPanel, setShowGraphPanel] = useState(false)

  // Panel sizes for resizable layout (percentage based)
  const [mainPanelWidth, setMainPanelWidth] = useState(70)
  const [graphPanelWidth, setGraphPanelWidth] = useState(30)
  const [isDragging, setIsDragging] = useState(false)

  const separatorRef = useRef<HTMLDivElement>(null)

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)
  // Mobile graph modal state
  const [mobileGraphMode, setMobileGraphMode] = useState<MobileGraphMode>("closed")
  
  // Drag state for mobile graph modal
  const [dragY, setDragY] = useState(0)
  const [isModalDragging, setIsModalDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragCurrentY = useRef(0)
  const MINI_HEIGHT = 45 // vh
  const FULLSCREEN_THRESHOLD = -100 // px to trigger fullscreen
  const CLOSE_THRESHOLD = 100 // px to trigger close

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const [isPolling, setIsPolling] = useState(false)

  useEffect(() => {
    loadProcess()
  }, [processId])

  // Reset panel sizes when toggling graph panel
  useEffect(() => {
    if (showGraphPanel) {
      setMainPanelWidth(70)
      setGraphPanelWidth(30)
    }
  }, [showGraphPanel])

  // Poll for updates if processing
  useEffect(() => {
    let interval: NodeJS.Timeout

    const shouldPoll = process?.indexing_status !== 'ready' ||
      documents.some(d => d.status === 'pending' || d.status === 'processing')

    if (shouldPoll && !isPolling) {
      interval = setInterval(() => {
        loadProcess(true)
      }, 3000)
    }

    return () => clearInterval(interval)
  }, [process?.indexing_status, documents, isPolling])

  const loadProcess = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      else setIsPolling(true)

      const processData = await getProcessById(processId)
      setProcess(processData)

      const documentsData = await getProcessDocumentsByProcessId(processId)
      setDocuments(documentsData)

      if (!silent && processData.indexing_status !== "ready") {
        setActiveTab("documents")
      }
    } catch (error) {
      console.error("Error loading process:", error)
      if (!silent) {
        toast.error("Error al cargar el proceso")
        router.back()
      }
    } finally {
      setLoading(false)
      setIsPolling(false)
    }
  }

  const handleBack = () => {
    router.push(`/${workspaceId}/processes`)
  }

  const handleAskAboutNode = (node: GraphNode) => {
    setActiveTab("chat")
    const message = `¿Qué puedes decirme sobre "${node.label}"?`
    window.dispatchEvent(new CustomEvent("process-chat-suggestion", { detail: { text: message } }))
  }

  const handleGraphAskChat = (message: string) => {
    setActiveTab("chat")
    window.dispatchEvent(new CustomEvent("process-chat-suggestion", { detail: { text: message } }))
  }

  const handleGraphViewDocument = (_documentId?: string) => {
    setActiveTab("documents")
  }

  const handleToggleFullGraph = () => {
    if (viewMode === "full-graph") {
      setViewMode("integrated")
    } else {
      setViewMode("full-graph")
    }
  }

  // Handle drag gestures for mobile graph modal
  const handleDragStart = (clientY: number) => {
    if (mobileGraphMode === "fullscreen") return // No drag in fullscreen
    dragStartY.current = clientY
    dragCurrentY.current = clientY
    setIsModalDragging(true)
  }

  const handleDragMove = (clientY: number) => {
    if (!isModalDragging || mobileGraphMode === "fullscreen") return
    dragCurrentY.current = clientY
    const delta = clientY - dragStartY.current
    // Allow dragging in both directions now
    setDragY(delta)
  }

  const handleDragEnd = () => {
    if (!isModalDragging) return
    setIsModalDragging(false)
    
    const delta = dragCurrentY.current - dragStartY.current
    
    if (delta > CLOSE_THRESHOLD) {
      // Dragged down enough - close
      setMobileGraphMode("closed")
      setDragY(0)
    } else if (delta < -50) {
      // Dragged up enough - go fullscreen
      setMobileGraphMode("fullscreen")
      setDragY(0)
    } else {
      // Not enough - snap back
      setDragY(0)
    }
  }

  // Prevent drag events from bubbling to parent (Dashboard drop zone)
  const handleDragEvent = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  // Custom drag-to-resize handlers
  const handleSeparatorMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const startX = e.clientX
    const containerWidth = (e.currentTarget.parentElement as HTMLElement).offsetWidth
    const startGraphWidth = graphPanelWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX
      const newGraphWidthPercent = (startGraphWidth + (deltaX / containerWidth) * 100)

      // Enforce constraints: graph panel 20%-50%, main panel 50%-80%
      const clampedGraphWidth = Math.max(20, Math.min(50, newGraphWidthPercent))
      const newMainWidth = 100 - clampedGraphWidth

      setGraphPanelWidth(clampedGraphWidth)
      setMainPanelWidth(newMainWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [graphPanelWidth])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!process) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Proceso no encontrado</p>
      </div>
    )
  }

  const processingDocs = documents.filter(d => d.status === 'processing' || d.status === 'pending').length
  const totalDocs = documents.length
  const progressPercent = totalDocs > 0 ? ((totalDocs - processingDocs) / totalDocs) * 100 : 0

  const processTypeLabel = process.process_type
    ? PROCESS_TYPE_LABELS[process.process_type?.toLowerCase()] || process.process_type
    : "Proceso legal"

  const entityCount = process.entity_count || 0
  const factCount = graphInsights?.facts ?? process.fact_count ?? 0
  const isReady = process.indexing_status === "ready"

  // Full Graph Mode - Show only the graph
  if (viewMode === "full-graph") {
    return (
      <div className="flex flex-col h-full overflow-hidden min-h-0">
        {/* Header */}
        <div className="border-b bg-card px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("integrated")}
              className="h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold leading-tight truncate">{process.name}</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Network className="w-3 h-3" />
                <span>Grafo de Conocimiento</span>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode("integrated")}
              className="text-xs"
            >
              Volver al Chat
            </Button>
          </div>
        </div>

        {/* Full Graph */}
        <div className="flex-1 overflow-hidden min-h-0">
          <ProcessGraph
            processId={processId}
            workspaceId={workspaceId}
            onInsights={setGraphInsights}
            onAskChat={handleGraphAskChat}
            onViewDocument={handleGraphViewDocument}
          />
        </div>
      </div>
    )
  }

  // Integrated Mode - Graph sidebar + Chat/Documents
  return (
    <div className="flex flex-col h-full overflow-hidden min-h-0">
      {/* Header - Minimalist */}
      <div className="px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-8 w-8"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-semibold leading-tight truncate flex-1">{process.name}</h1>
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-muted/60 text-muted-foreground inline-flex h-9 items-center justify-center rounded-full p-1 shadow-sm border border-border/60">
                <TabsTrigger
                  value="chat"
                  className={cn(
                    "rounded-full px-3 py-1 text-xs sm:text-sm",
                    activeTab === "chat" && "glow-tab-selected"
                  )}
                >
                  Chat
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className={cn(
                    "rounded-full px-3 py-1 text-xs sm:text-sm",
                    activeTab === "documents" && "glow-tab-selected"
                  )}
                >
                  Documentos
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Progress Banner - Only when processing */}
        {(processingDocs > 0 || process.indexing_status === 'processing') && (
          <div className="mt-2 ml-11 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-md px-2.5 py-1.5 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
              <div className="text-xs text-blue-700 dark:text-blue-300">
                <span className="font-medium">Indexando documentos:</span> {totalDocs - processingDocs} de {totalDocs} completados
              </div>
            </div>
            <div className="w-24 h-1.5 bg-blue-100 dark:bg-blue-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area - Desktop: Resizable Panels | Mobile: Full width */}
      <div className="flex-1 overflow-hidden flex min-h-0 relative">
        {/* Main Content - Chat/Documents */}
        <div
          id="main-content-panel"
          className="h-full overflow-hidden flex-1 min-h-0"
          style={isMobile ? {} : {
            width: showGraphPanel ? `${mainPanelWidth}%` : '100%',
            minWidth: '50%',
            transition: isDragging ? 'none' : 'width 0.3s ease-out'
          }}
        >
          <div className="h-full overflow-hidden min-h-0">
            {activeTab === "chat" && (
              <ProcessChat
                processId={processId}
                processName={process.name}
                indexingStatus={process.indexing_status || "pending"}
                chatId={`process-${processId}`}
                insights={graphInsights || undefined}
              />
            )}

            {activeTab === "documents" && (
              <div className="h-full overflow-y-auto p-6">
                <ProcessDocuments
                  processId={processId}
                  workspaceId={workspaceId}
                  documents={documents}
                  onDocumentsChange={() => loadProcess(true)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Desktop: Resizable Handle */}
        {!isMobile && showGraphPanel && (
          <div
            ref={separatorRef}
            className="bg-border/50 hover:bg-primary/20 transition-colors relative flex items-center justify-center select-none cursor-col-resize"
            style={{ width: '4px', flexShrink: 0, userSelect: 'none' }}
            onMouseDown={handleSeparatorMouseDown}
          >
            <div className="w-1 h-8 bg-border/50 rounded-full" />
          </div>
        )}

        {/* Desktop: Graph Side Panel */}
        {!isMobile && showGraphPanel && (
          <div
            id="graph-panel"
            className="h-full overflow-hidden flex flex-col min-h-0"
            style={{
              width: `${graphPanelWidth}%`,
              minWidth: '20%',
              maxWidth: '50%',
              transition: isDragging ? 'none' : 'width 0.1s ease-out'
            }}
          >
            <GraphSidePanel
              processId={processId}
              workspaceId={workspaceId}
              isExpanded={true}
              onToggleExpanded={() => setShowGraphPanel(false)}
              onFullGraphClick={handleToggleFullGraph}
              onAskAboutNode={handleAskAboutNode}
              className="h-full"
            />
          </div>
        )}
      </div>

      {/* Floating Graph Button - Desktop & Mobile */}
      {/* Desktop: Show when graph panel is closed */}
      {!isMobile && !showGraphPanel && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowGraphPanel(true)}
              className="fixed right-4 bottom-24 h-12 w-12 rounded-full bg-card/90 border-primary/30 shadow-lg hover:bg-primary/10 hover:border-primary/50 z-50"
            >
              <Network className="h-5 w-5 text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Abrir grafo de conocimiento</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      {/* Mobile: Show when graph modal is closed */}
      {isMobile && mobileGraphMode === "closed" && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileGraphMode("mini")}
          className="fixed right-4 bottom-24 h-12 w-12 rounded-full bg-card/90 border-primary/30 shadow-lg hover:bg-primary/10 hover:border-primary/50 z-50"
        >
          <Network className="h-5 w-5 text-primary" />
        </Button>
      )}

      {/* Mobile: Draggable Floating Graph Modal */}
      {isMobile && mobileGraphMode !== "closed" && (
        <>
        {/* Full screen overlay during drag to prevent Dashboard drop zone interference */}
        {isModalDragging && (
          <div 
            className="fixed inset-0 z-[60] bg-transparent"
            style={{ touchAction: 'none' }}
          />
        )}
        <div 
          className={`fixed inset-x-0 bg-card border-t border-border/50 shadow-2xl flex flex-col ${
            mobileGraphMode === "fullscreen" 
              ? "inset-y-0 rounded-none" 
              : "bottom-0 rounded-t-2xl"
          }`}
          style={{
            height: mobileGraphMode === "fullscreen" ? "100vh" : `${MINI_HEIGHT}vh`,
            transform: `translateY(${Math.max(0, dragY)}px)`,
            transition: isModalDragging ? 'none' : 'transform 0.3s ease-out, height 0.3s ease-out',
            zIndex: 70
          }}
          onDragEnter={handleDragEvent}
          onDragOver={handleDragEvent}
          onDragLeave={handleDragEvent}
          onDrop={handleDragEvent}
        >
          {/* Draggable Handle Bar - Solo en modo mini */}
          {mobileGraphMode === "mini" && (
            <div 
              className="absolute top-0 left-0 right-0 h-10 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
              style={{ touchAction: 'none' }}
              onTouchStart={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleDragStart(e.touches[0].clientY)
              }}
              onTouchMove={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleDragMove(e.touches[0].clientY)
              }}
              onTouchEnd={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleDragEnd()
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                handleDragStart(e.clientY)
              }}
              onMouseMove={(e) => {
                if (isModalDragging) {
                  e.preventDefault()
                  handleDragMove(e.clientY)
                }
              }}
              onMouseUp={(e) => {
                e.preventDefault()
                handleDragEnd()
              }}
              onMouseLeave={(e) => {
                if (isModalDragging) {
                  e.preventDefault()
                  handleDragEnd()
                }
              }}
            >
              <div 
                className={`w-12 h-1.5 rounded-full transition-colors ${
                  isModalDragging ? 'bg-primary/50' : 'bg-muted-foreground/30'
                }`} 
              />
              <div className="absolute inset-0" /> {/* Invisible hit area for easier grabbing */}
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0 mt-2">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Grafo de Conocimiento</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Toggle Fullscreen */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileGraphMode(mobileGraphMode === "mini" ? "fullscreen" : "mini")}
                className="h-8 w-8"
              >
                {mobileGraphMode === "mini" ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Shrink className="h-4 w-4" />
                )}
              </Button>
              {/* Close */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setMobileGraphMode("closed")
                  setDragY(0)
                }}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Graph Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ProcessGraph
              processId={processId}
              workspaceId={workspaceId}
              onInsights={setGraphInsights}
              onAskChat={(msg) => {
                handleGraphAskChat(msg)
                setMobileGraphMode("closed")
                setDragY(0)
              }}
              onViewDocument={() => {
                setActiveTab("documents")
                setMobileGraphMode("closed")
                setDragY(0)
              }}
            />
          </div>
          
          {/* Visual hint for swipe up */}
          {mobileGraphMode === "mini" && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none opacity-50">
              <div className="flex flex-col items-center gap-1">
                <div className="w-0.5 h-4 bg-gradient-to-t from-transparent via-primary/50 to-primary/80" />
                <span className="text-[10px] text-muted-foreground">Desliza para expandir</span>
              </div>
            </div>
          )}
        </div>
        </>
      )}

      {/* Edit Process Modal */}
      <EditProcessModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        process={process}
        onSuccess={() => loadProcess(false)}
      />
    </div>
  )
}


