"use client"

import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { fetchProcessGraph } from "@/lib/api/processes"
import type { GraphData, GraphNode } from "@/lib/types"
import {
  getNodeGroup,
  getNodeMap
} from "@/features/graph/utils/graph-utils"

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin text-primary/60" />
    </div>
  )
})

interface MiniProcessGraphProps {
  processId: string
  className?: string
  onNodeClick?: (node: GraphNode) => void
  onNodeHover?: (node: GraphNode | null) => void
  highlightedNodeId?: string | null
  activeLayers?: Set<string>
}

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
  // Other - Gray
  OTRO: "#6B7280",
  otro: "#6B7280",
  default: "#6B7280"
}

const CORE_LAYERS = [
  { id: "hechos", types: ["hecho", "hechos", "fact", "HECHO"] },
  { id: "pruebas", types: ["prueba", "pruebas", "evidence", "documento", "document", "DOCUMENTO"] },
  { id: "normas", types: ["norma", "normas", "law", "articulo", "artículo", "NORMA"] },
  { id: "personas", types: ["persona", "person", "organization", "organizacion", "organización", "PERSONA_NATURAL", "PERSONA_JURIDICA"] },
  { id: "conceptos", types: ["CONCEPTO_JURIDICO", "concepto_juridico"] },
  { id: "entidades", types: ["ENTIDAD_PUBLICA", "DESPACHO_JUDICIAL", "entidad_publica", "despacho_judicial"] },
  { id: "ubicaciones", types: ["UBICACION", "ubicacion", "location", "lugar"] },
  { id: "otros", types: ["OTRO", "otro", "FECHA", "fecha", "date"] }
]

export const MiniProcessGraph: FC<MiniProcessGraphProps> = ({
  processId,
  className,
  onNodeClick,
  onNodeHover,
  highlightedNodeId,
  activeLayers = new Set(["hechos", "pruebas", "normas", "personas", "conceptos", "entidades", "ubicaciones", "otros"])
}) => {
  const graphRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: Math.max(rect.width || 400, 200),
          height: Math.max(rect.height || 400, 200)
        })
      }
    }

    updateDimensions()
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions()
    })
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [])

  const loadGraph = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchProcessGraph(processId, {
        status: "active",
        limit: 100, // Fewer nodes for mini view
        maxDepth: 2
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
    } catch (err) {
      console.error("Error loading mini graph:", err)
    } finally {
      setLoading(false)
    }
  }, [processId])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  useEffect(() => {
    if (!graphData || !graphRef.current) return
    // Lighter physics for mini graph
    graphRef.current.d3Force("charge")?.strength(-80).distanceMax(150)
    graphRef.current.d3Force("link")?.distance(60)
  }, [graphData])

  const nodeMap = useMemo(
    () => (graphData ? getNodeMap(graphData.nodes) : new Map()),
    [graphData]
  )

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
      const sourceId = typeof edge.source === "object" ? edge.source.id : edge.source
      const targetId = typeof edge.target === "object" ? edge.target.id : edge.target
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId)
    })

    return { nodes: filteredNodes, links: filteredEdges }
  }, [graphData, activeLayers])

  const getNodeColor = (node: GraphNode) => {
    const type = node.type?.toLowerCase() || "default"
    return NODE_COLORS[type] || NODE_COLORS.default
  }

  const handleNodeClick = (node: any) => {
    if (onNodeClick) {
      onNodeClick(node as GraphNode)
    }
  }

  const handleNodeHover = (node: any) => {
    const graphNode = node as GraphNode | null
    setHoveredNode(graphNode?.id || null)
    if (onNodeHover) {
      onNodeHover(graphNode)
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center h-full bg-background/50", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-primary/60" />
      </div>
    )
  }

  if (!graphData || filteredData.nodes.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-muted-foreground text-sm", className)}>
        <p>Sin datos para mostrar</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn("relative w-full h-full min-h-0", className)}>
      <ForceGraph2D
        ref={graphRef}
        graphData={filteredData}
        width={dimensions.width}
        height={dimensions.height}
        nodeColor={getNodeColor}
        nodeRelSize={4}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const isHighlighted = highlightedNodeId === node.id
          const isHovered = hoveredNode === node.id
          const color = getNodeColor(node)
          const baseRadius = isHighlighted || isHovered ? 6 : 4

          // Glow effect for highlighted/hovered nodes
          if (isHighlighted || isHovered) {
            ctx.shadowColor = color
            ctx.shadowBlur = 10
          }

          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(node.x, node.y, baseRadius, 0, 2 * Math.PI, false)
          ctx.fill()

          ctx.shadowColor = "transparent"
          ctx.shadowBlur = 0

          // White border
          ctx.strokeStyle = isHighlighted || isHovered
            ? "rgba(255, 255, 255, 0.9)"
            : "rgba(255, 255, 255, 0.3)"
          ctx.lineWidth = isHighlighted || isHovered ? 2 / globalScale : 0.5 / globalScale
          ctx.stroke()

          // Show label on hover (only in mini mode when zoomed in enough)
          if ((isHovered || isHighlighted) && globalScale > 0.8) {
            const label = node.label || ""
            const truncated = label.length > 18 ? `${label.slice(0, 18)}…` : label
            const fontSize = 10 / globalScale

            ctx.font = `${fontSize}px ui-sans-serif, system-ui`
            ctx.textAlign = "center"
            ctx.textBaseline = "top"
            const textWidth = ctx.measureText(truncated).width
            const padding = 3 / globalScale

            ctx.fillStyle = "rgba(0, 0, 0, 0.75)"
            ctx.fillRect(
              node.x - textWidth / 2 - padding,
              node.y + 8,
              textWidth + padding * 2,
              fontSize + padding
            )
            ctx.fillStyle = "rgba(255, 255, 255, 0.95)"
            ctx.fillText(truncated, node.x, node.y + 8 + padding / 2)
          }
        }}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI, false)
          ctx.fill()
        }}
        linkColor={() => "rgba(255, 255, 255, 0.08)"}
        linkWidth={0.8}
        linkDirectionalArrowLength={0}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        cooldownTicks={80}
        onEngineStop={() => graphRef.current?.zoomToFit(300, 30)}
        enableNodeDrag={false}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        backgroundColor="transparent"
      />
      
      {/* Stats overlay */}
      <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground/70 bg-background/60 px-2 py-1 rounded">
        {filteredData.nodes.length} entidades · {filteredData.links.length} conexiones
      </div>
    </div>
  )
}
