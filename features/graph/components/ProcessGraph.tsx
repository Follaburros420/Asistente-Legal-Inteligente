"use client"

import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import {
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  X,
  ExternalLink,
  FileText
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { chipVariants } from "@/components/ui/chip"
import { cn } from "@/lib/utils"
import { es } from "@/lib/i18n/es"
import { fetchProcessGraph } from "@/lib/api/processes"
import type { GraphData, GraphEdge, GraphNode, ProcessInsights } from "@/lib/types"
import {
  buildGraphInsights,
  getEdgeKind,
  getEdgeNodeIds,
  getNodeGroup,
  getNodeMap
} from "@/features/graph/utils/graph-utils"

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )
})

interface ProcessGraphProps {
  processId: string
  workspaceId: string
  onInsights?: (insights: Partial<ProcessInsights>) => void
  onAskChat?: (message: string) => void
  onViewDocument?: (documentId?: string) => void
}

type GuidedViewId = "contradictions" | "critical-norms" | "facts-evidence" | "key-people"

const GUIDED_VIEWS: Array<{
  id: GuidedViewId
  label: string
  description: string
  layers: string[]
}> = [
  {
    id: "contradictions",
    label: es.graph.guidedViews.contradictions,
    description: es.graph.guidedDescriptions.contradictions,
    layers: ["hechos", "pruebas", "normas", "personas", "conceptos"]
  },
  {
    id: "critical-norms",
    label: es.graph.guidedViews.criticalNorms,
    description: es.graph.guidedDescriptions.criticalNorms,
    layers: ["normas", "hechos", "conceptos"]
  },
  {
    id: "facts-evidence",
    label: es.graph.guidedViews.factsEvidence,
    description: es.graph.guidedDescriptions.factsEvidence,
    layers: ["hechos", "pruebas", "documentos"]
  },
  {
    id: "key-people",
    label: es.graph.guidedViews.keyPeople,
    description: es.graph.guidedDescriptions.keyPeople,
    layers: ["personas", "hechos", "entidades"]
  }
]

const NODE_COLORS: Record<string, string> = {
  // Facts/Hechos - Purple
  hecho: "#8B5CF6",
  hechos: "#8B5CF6",
  fact: "#8B5CF6",
  HECHO: "#8B5CF6",
  // Evidence/Pruebas/Documentos - Green
  prueba: "#22C55E",
  pruebas: "#22C55E",
  evidence: "#22C55E",
  documento: "#22C55E",
  document: "#22C55E",
  DOCUMENTO: "#22C55E",
  // Norms/Laws - Blue
  norma: "#3B82F6",
  normas: "#3B82F6",
  law: "#3B82F6",
  articulo: "#3B82F6",
  artículo: "#3B82F6",
  NORMA: "#3B82F6",
  // People/Persons - Pink
  persona: "#EC4899",
  person: "#EC4899",
  organization: "#EC4899",
  organizacion: "#EC4899",
  organización: "#EC4899",
  PERSONA_NATURAL: "#EC4899",
  PERSONA_JURIDICA: "#EC4899",
  // Legal Concepts - Indigo
  CONCEPTO_JURIDICO: "#6366F1",
  concepto_juridico: "#6366F1",
  // Public Entities - Teal
  ENTIDAD_PUBLICA: "#14B8A6",
  entidad_publica: "#14B8A6",
  DESPACHO_JUDICIAL: "#14B8A6",
  despacho_judicial: "#14B8A6",
  // Locations - Amber
  fecha: "#F59E0B",
  date: "#F59E0B",
  location: "#F59E0B",
  lugar: "#F59E0B",
  UBICACION: "#F59E0B",
  ubicacion: "#F59E0B",
  // Money - Red
  money: "#EF4444",
  dinero: "#EF4444",
  // Actions/Decisions - Cyan
  actuacion: "#06B6D4",
  decision: "#06B6D4",
  pretension: "#06B6D4",
  // Other/OTRO - Gray
  OTRO: "#6B7280",
  otro: "#6B7280",
  default: "#6B7280"
}

const EDGE_STYLES = {
  "fact-evidence": { color: "rgba(34, 197, 94, 0.65)", dash: [2, 4], width: 1.6 },
  "fact-norm": { color: "rgba(59, 130, 246, 0.6)", dash: [], width: 1.6 },
  contradiction: { color: "rgba(239, 68, 68, 0.8)", dash: [4, 3], width: 2.2 },
  default: { color: "rgba(255, 255, 255, 0.12)", dash: [], width: 1.2 }
}

const CORE_LAYERS = [
  { 
    id: "hechos", 
    label: es.graph.layerLabels.facts, 
    types: ["hecho", "hechos", "fact", "HECHO"] 
  },
  {
    id: "pruebas",
    label: es.graph.layerLabels.evidence,
    types: ["prueba", "pruebas", "evidence", "documento", "document", "DOCUMENTO"]
  },
  {
    id: "normas",
    label: es.graph.layerLabels.norms,
    types: ["norma", "normas", "law", "articulo", "artículo", "NORMA"]
  },
  {
    id: "personas",
    label: es.graph.layerLabels.people,
    types: ["persona", "person", "organization", "organizacion", "organización", "PERSONA_NATURAL", "PERSONA_JURIDICA"]
  },
  {
    id: "conceptos",
    label: "Conceptos Jurídicos",
    types: ["CONCEPTO_JURIDICO", "concepto_juridico"]
  },
  {
    id: "entidades",
    label: "Entidades",
    types: ["ENTIDAD_PUBLICA", "DESPACHO_JUDICIAL", "entidad_publica", "despacho_judicial"]
  },
  {
    id: "ubicaciones",
    label: "Ubicaciones",
    types: ["UBICACION", "ubicacion", "location", "lugar"]
  },
  {
    id: "otros",
    label: "Otros",
    types: ["OTRO", "otro", "FECHA", "fecha", "date"]
  }
]

const SIDE_PANEL_WIDTH = 360

export const ProcessGraph: FC<ProcessGraphProps> = ({
  processId,
  workspaceId,
  onInsights,
  onAskChat,
  onViewDocument
}) => {
  const graphRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [showSidePanel, setShowSidePanel] = useState(false)
  const [guidedView, setGuidedView] = useState<GuidedViewId | null>(null)

  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set(["hechos", "pruebas", "normas", "personas", "conceptos", "entidades", "ubicaciones", "otros"]))

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: rect.width,
          height: Math.max(rect.height, 320)
        })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)

    const resizeObserver = new ResizeObserver(updateDimensions)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      window.removeEventListener("resize", updateDimensions)
      resizeObserver.disconnect()
    }
  }, [])

  const loadGraph = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await fetchProcessGraph(processId, {
        status: "active",
        limit: 200,
        maxDepth: 3
      })

      const transformedData: GraphData = {
        nodes: data.nodes || [],
        edges: (data.edges || []).map((edge) => ({
          ...edge,
          source: edge.source,
          target: edge.target
        })),
        meta: data.meta
      }

      setGraphData(transformedData)
    } catch (err: any) {
      console.error("Error loading graph:", err)
      setError(err.message || es.graph.error)
    } finally {
      setLoading(false)
    }
  }, [processId])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  useEffect(() => {
    if (!graphData || !graphRef.current) return

    graphRef.current.d3Force("charge").strength(-140).distanceMax(280)
    graphRef.current.d3Force("link")?.distance(110)

    if (onInsights) {
      onInsights(buildGraphInsights(graphData))
    }
  }, [graphData, onInsights])

  const nodeMap = useMemo(() => (graphData ? getNodeMap(graphData.nodes) : new Map()), [graphData])

  const toggleLayer = (layerId: string) => {
    setActiveLayers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(layerId)) {
        newSet.delete(layerId)
      } else {
        newSet.add(layerId)
      }
      return newSet
    })
  }

  const handleGuidedView = (viewId: GuidedViewId) => {
    setGuidedView((prev) => {
      const next = prev === viewId ? null : viewId
      if (next) {
        const viewConfig = GUIDED_VIEWS.find((view) => view.id === next)
        if (viewConfig) {
          setActiveLayers(new Set(viewConfig.layers))
        }
      } else {
        setActiveLayers(new Set(["hechos"]))
      }
      return next
    })
  }

  const getNodeColor = (node: GraphNode) => {
    const type = node.type?.toLowerCase() || "default"
    return NODE_COLORS[type] || NODE_COLORS.default
  }

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node)
    setShowSidePanel(true)

    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 800)
      graphRef.current.zoom(2, 800)
    }
  }

  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom()
      graphRef.current.zoom(currentZoom * 1.4, 300)
    }
  }

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom()
      graphRef.current.zoom(currentZoom / 1.4, 300)
    }
  }

  const handleFitToScreen = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50)
    }
  }

  const closeSidePanel = () => {
    setShowSidePanel(false)
    setSelectedNode(null)
  }

  const filteredData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] }

    const visibleTypes = new Set<string>()
    CORE_LAYERS.forEach((layer) => {
      if (activeLayers.has(layer.id)) {
        // Add both lowercase and original case types for matching
        layer.types.forEach((type) => {
          visibleTypes.add(type.toLowerCase())
          visibleTypes.add(type)
        })
      }
    })

    const showAll = visibleTypes.size === 0

    const visibleNodeIds = new Set<string>()
    const filteredNodes = graphData.nodes.filter((node) => {
      const nodeType = node.type || "default"
      const nodeTypeLower = nodeType.toLowerCase()
      const isVisible = showAll || visibleTypes.has(nodeType) || visibleTypes.has(nodeTypeLower) || nodeTypeLower === "default"
      if (isVisible) visibleNodeIds.add(node.id)
      return isVisible
    })

    const filteredEdges = graphData.edges.filter((edge) => {
      const { sourceId, targetId } = getEdgeNodeIds(edge)
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId)
    })

    if (!guidedView) {
      return { nodes: filteredNodes, links: filteredEdges }
    }

    const guidedEdges = filteredEdges.filter((edge) => {
      const kind = getEdgeKind(edge, nodeMap)
      const { sourceId, targetId } = getEdgeNodeIds(edge)
      const sourceGroup = getNodeGroup(nodeMap.get(sourceId)?.type)
      const targetGroup = getNodeGroup(nodeMap.get(targetId)?.type)

      if (guidedView === "contradictions") {
        return kind === "contradiction"
      }

      if (guidedView === "critical-norms") {
        return sourceGroup === "norms" || targetGroup === "norms"
      }

      if (guidedView === "facts-evidence") {
        return (
          (sourceGroup === "facts" && targetGroup === "evidence") ||
          (sourceGroup === "evidence" && targetGroup === "facts")
        )
      }

      if (guidedView === "key-people") {
        return sourceGroup === "people" || targetGroup === "people"
      }

      return true
    })

    const guidedNodeIds = new Set<string>()
    guidedEdges.forEach((edge) => {
      const { sourceId, targetId } = getEdgeNodeIds(edge)
      guidedNodeIds.add(sourceId)
      guidedNodeIds.add(targetId)
    })

    const guidedNodes = filteredNodes.filter((node) => {
      if (guidedNodeIds.has(node.id)) return true
      const group = getNodeGroup(node.type)
      if (guidedView === "critical-norms") return group === "norms"
      if (guidedView === "facts-evidence") return group === "facts" || group === "evidence"
      if (guidedView === "key-people") return group === "people"
      return false
    })

    return {
      nodes: guidedNodes,
      links: guidedEdges
    }
  }, [graphData, activeLayers, guidedView, nodeMap])

  const hasData = filteredData.nodes.length > 0
  const isDesktop = dimensions.width >= 768

  const graphWidth = Math.max(
    240,
    dimensions.width - (showSidePanel && isDesktop ? SIDE_PANEL_WIDTH : 0)
  )

  const selectedView = GUIDED_VIEWS.find((view) => view.id === guidedView)

  const getEdgeStyle = (edge: GraphEdge) => {
    const kind = getEdgeKind(edge, nodeMap)
    return EDGE_STYLES[kind] || EDGE_STYLES.default
  }

  const getNodeSummary = (node: GraphNode) => {
    const props = node.properties || {}
    return (
      props.summary ||
      props.descripcion ||
      props.description ||
      props.explicacion ||
      es.graph.panel.fallbackSummary(node.type)
    )
  }

  const getNodeImportance = (node: GraphNode) => {
    const group = getNodeGroup(node.type)
    if (group === "facts") return es.graph.panel.importance.facts
    if (group === "evidence") return es.graph.panel.importance.evidence
    if (group === "norms") return es.graph.panel.importance.norms
    if (group === "people") return es.graph.panel.importance.people
    return es.graph.panel.importance.default
  }

  const getSourceDocument = (node: GraphNode) => {
    const props = node.properties || {}
    const raw =
      props.source_document ||
      props.document ||
      props.document_id ||
      props.documentId ||
      props.source

    if (!raw) return null
    if (typeof raw === "string" || typeof raw === "number") {
      return { id: String(raw), label: String(raw) }
    }

    if (typeof raw === "object") {
      const label = raw.title || raw.name || raw.id || es.graph.panel.documentFallback
      return { id: String(raw.id || label), label: String(label) }
    }

    return null
  }

  const connectionsCount = selectedNode
    ? graphData?.edges.filter((edge) => {
        const { sourceId, targetId } = getEdgeNodeIds(edge)
        return sourceId === selectedNode.id || targetId === selectedNode.id
      }).length || 0
    : 0

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 bg-[hsl(var(--mode-graph-bg))]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">{es.graph.loading}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 bg-[hsl(var(--mode-graph-bg))]">
        <p className="text-destructive">{error}</p>
        <Button onClick={loadGraph} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          {es.graph.retry}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full relative min-h-0">
      <div className="p-4 border-b bg-[hsl(var(--mode-graph-bg))] flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{es.graph.guidedTitle}:</span>
              {GUIDED_VIEWS.map((view) => (
                <button
                  key={view.id}
                  onClick={() => handleGuidedView(view.id)}
                  className={cn(
                    chipVariants({ variant: guidedView === view.id ? "info" : "subtle", size: "sm" }),
                    "text-[11px]"
                  )}
                >
                  {view.label}
                </button>
              ))}
            </div>
            {selectedView && (
              <p className="text-xs text-muted-foreground max-w-xl">{selectedView.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {graphData?.meta && (
              <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {graphData.meta.nodeCount} {es.graph.stats.entities}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span>
                  {graphData.meta.edgeCount} {es.graph.stats.connections}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                title={es.graph.controls.zoomIn}
                aria-label={es.graph.controls.zoomIn}
                className="h-8 w-8"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                title={es.graph.controls.zoomOut}
                aria-label={es.graph.controls.zoomOut}
                className="h-8 w-8"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFitToScreen}
                title={es.graph.controls.fit}
                aria-label={es.graph.controls.fit}
                className="h-8 w-8"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={loadGraph}
                title={es.graph.controls.refresh}
                aria-label={es.graph.controls.refresh}
                className="h-8 w-8"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="text-xs text-muted-foreground">{es.graph.layersLabel}:</span>
          {CORE_LAYERS.map((layer) => (
            <button
              key={layer.id}
              onClick={() => toggleLayer(layer.id)}
              className={cn(
                "layer-toggle",
                activeLayers.has(layer.id) ? "layer-toggle-active" : "layer-toggle-inactive"
              )}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative bg-[hsl(var(--mode-graph-bg))] min-h-0">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-24 h-24 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">{es.graph.emptyTitle}</h3>
            <p className="text-muted-foreground text-sm max-w-md">{es.graph.emptyDescription}</p>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={filteredData}
            width={graphWidth}
            height={dimensions.height}
            nodeLabel={(node: any) => `${node.label} (${node.type})`}
            nodeColor={getNodeColor}
            nodeRelSize={6}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.label || ""
              const truncated = label.length > 22 ? `${label.slice(0, 22)}…` : label
              const fontSize = 12 / globalScale

              const color = getNodeColor(node)
              const isSelected = selectedNode?.id === node.id

              ctx.fillStyle = color
              ctx.beginPath()
              ctx.arc(node.x, node.y, isSelected ? 9 : 7, 0, 2 * Math.PI, false)
              ctx.fill()

              ctx.strokeStyle = isSelected
                ? "rgba(255, 255, 255, 0.85)"
                : "rgba(255, 255, 255, 0.3)"
              ctx.lineWidth = isSelected ? 2 / globalScale : 1 / globalScale
              ctx.stroke()

              if (globalScale > 0.6) {
                ctx.font = `${fontSize}px ui-sans-serif, system-ui`
                ctx.textAlign = "center"
                ctx.textBaseline = "top"
                const textWidth = ctx.measureText(truncated).width
                const padding = 4 / globalScale
                ctx.fillStyle = "rgba(0, 0, 0, 0.55)"
                ctx.fillRect(
                  node.x - textWidth / 2 - padding,
                  node.y + 10,
                  textWidth + padding * 2,
                  fontSize + padding
                )
                ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
                ctx.fillText(truncated, node.x, node.y + 10 + padding / 2)
              }
            }}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              ctx.fillStyle = color
              ctx.beginPath()
              ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI, false)
              ctx.fill()
            }}
            linkColor={(link: any) => getEdgeStyle(link).color}
            linkWidth={(link: any) => getEdgeStyle(link).width}
            linkLineDash={(link: any) => getEdgeStyle(link).dash}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            linkLabel={(link: any) => link.label}
            linkCurvature={0.1}
            onNodeClick={handleNodeClick}
            cooldownTicks={120}
            onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            backgroundColor="transparent"
          />
        )}

        <div className="absolute bottom-4 left-4 flex flex-col gap-2 max-w-[320px]">
          <div className="flex flex-wrap gap-2">
            {CORE_LAYERS.filter((layer) => activeLayers.has(layer.id)).map((layer) => {
              const color = NODE_COLORS[layer.types[0]] || NODE_COLORS.default
              return (
                <Badge
                  key={layer.id}
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: color, color: color }}
                >
                  {layer.label}
                </Badge>
              )
            })}
          </div>
          <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground/80 mb-2">{es.graph.legend.edgeTypes}</div>
            <div className="flex items-center gap-2">
              <span className="h-0.5 w-6 rounded-full" style={{ background: EDGE_STYLES["fact-evidence"].color }} />
              <span>{es.graph.legend.factEvidence}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="h-0.5 w-6 rounded-full" style={{ background: EDGE_STYLES["fact-norm"].color }} />
              <span>{es.graph.legend.factNorm}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="h-0.5 w-6 rounded-full" style={{ background: EDGE_STYLES.contradiction.color }} />
              <span>{es.graph.legend.contradiction}</span>
            </div>
          </div>
        </div>
      </div>

      {showSidePanel && selectedNode && (
        <div className="hidden md:block graph-side-panel animate-in fade-in">
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">{selectedNode.label}</h3>
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: getNodeColor(selectedNode) + "20",
                    color: getNodeColor(selectedNode)
                  }}
                >
                  {selectedNode.type}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={closeSidePanel}
                aria-label={es.graph.panel.closeLabel}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground leading-relaxed">{getNodeSummary(selectedNode)}</p>

              {getSourceDocument(selectedNode) && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{es.graph.panel.sourceDoc}</span>
                  </div>
                  <div className="text-sm font-medium truncate">
                    {getSourceDocument(selectedNode)?.label}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  {es.graph.panel.whyMatters}
                </h4>
                <p className="text-sm text-foreground/90">{getNodeImportance(selectedNode)}</p>
              </div>

              <div className="pt-4 border-t border-border/60">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>
                    {connectionsCount} {es.graph.panel.connections}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    {es.graph.panel.suggestedActions}
                  </h4>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAskChat?.(es.graph.panel.askChatPrompt(selectedNode.label))}
                    >
                      {es.graph.panel.askChat}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!getSourceDocument(selectedNode)}
                      onClick={() => onViewDocument?.(getSourceDocument(selectedNode)?.id)}
                    >
                      {es.graph.panel.viewSource}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSidePanel && selectedNode && (
        <div className="md:hidden bottom-sheet" style={{ transform: "translateY(0)" }}>
          <div className="bottom-sheet-handle" />
          <div className="px-6 pb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">{selectedNode.label}</h3>
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: getNodeColor(selectedNode) + "20",
                    color: getNodeColor(selectedNode)
                  }}
                >
                  {selectedNode.type}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={closeSidePanel}
                aria-label={es.graph.panel.closeLabel}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">{getNodeSummary(selectedNode)}</p>

            <div className="space-y-3 text-sm">
              {getSourceDocument(selectedNode) && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{es.graph.panel.sourceDoc}</span>
                  </div>
                  <div className="text-sm font-medium truncate">
                    {getSourceDocument(selectedNode)?.label}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  {es.graph.panel.whyMatters}
                </h4>
                <p className="text-sm text-foreground/90">{getNodeImportance(selectedNode)}</p>
              </div>

              <div className="pt-2 border-t border-border/60">
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAskChat?.(es.graph.panel.askChatPrompt(selectedNode.label))}
                  >
                    {es.graph.panel.askChat}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!getSourceDocument(selectedNode)}
                    onClick={() => onViewDocument?.(getSourceDocument(selectedNode)?.id)}
                  >
                    {es.graph.panel.viewSource}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
