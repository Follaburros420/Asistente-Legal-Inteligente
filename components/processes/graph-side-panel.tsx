"use client"

import { FC, useState, useCallback } from "react"
import {
  Network,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Filter,
  MessageSquare,
  X
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { MiniProcessGraph } from "@/features/graph/components/MiniProcessGraph"
import type { GraphNode } from "@/lib/types"

interface GraphSidePanelProps {
  processId: string
  workspaceId: string
  isExpanded: boolean
  onToggleExpanded: () => void
  onFullGraphClick: () => void
  onAskAboutNode?: (node: GraphNode) => void
  className?: string
}

const LAYER_OPTIONS = [
  { id: "hechos", label: "Hechos", color: "#8B5CF6" },
  { id: "pruebas", label: "Pruebas", color: "#22C55E" },
  { id: "normas", label: "Normas", color: "#3B82F6" },
  { id: "personas", label: "Personas", color: "#EC4899" },
  { id: "conceptos", label: "Conceptos", color: "#6366F1" },
  { id: "entidades", label: "Entidades", color: "#14B8A6" },
  { id: "ubicaciones", label: "Ubicaciones", color: "#F59E0B" },
  { id: "otros", label: "Otros", color: "#6B7280" }
]

export const GraphSidePanel: FC<GraphSidePanelProps> = ({
  processId,
  workspaceId,
  isExpanded,
  onToggleExpanded,
  onFullGraphClick,
  onAskAboutNode,
  className
}) => {
  const [activeLayers, setActiveLayers] = useState<Set<string>>(
    new Set(["hechos", "pruebas", "normas", "personas", "conceptos", "entidades", "ubicaciones", "otros"])
  )
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  const toggleLayer = (layerId: string) => {
    setActiveLayers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(layerId)) {
        if (newSet.size > 1) {
          newSet.delete(layerId)
        }
      } else {
        newSet.add(layerId)
      }
      return newSet
    })
  }

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
  }, [])

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node)
  }, [])

  const handleAskAboutNode = () => {
    if (selectedNode && onAskAboutNode) {
      onAskAboutNode(selectedNode)
      setSelectedNode(null)
    }
  }

  // When not expanded, don't render anything (floating button handles opening)
  if (!isExpanded) {
    return null
  }

  // Expanded state - RIGHT SIDE panel
  return (
    <div className={cn("flex flex-col h-full bg-card/30 border-l", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card/50">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Grafo de Conocimiento</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onFullGraphClick}
                className="h-7 w-7"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Vista completa del grafo</p>
            </TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleExpanded}
            className="h-7 w-7"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Layer Filters */}
      <div className="px-3 py-2 border-b bg-background/30">
        <div className="flex items-center gap-1 mb-2">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Capas</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LAYER_OPTIONS.map((layer) => (
            <button
              key={layer.id}
              onClick={() => toggleLayer(layer.id)}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium transition-all",
                activeLayers.has(layer.id)
                  ? "text-white shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
              style={
                activeLayers.has(layer.id)
                  ? { backgroundColor: layer.color }
                  : undefined
              }
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mini Graph */}
      <div className="flex-1 min-h-0 relative">
        <MiniProcessGraph
          processId={processId}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          highlightedNodeId={selectedNode?.id}
          activeLayers={activeLayers}
          className="h-full"
        />
      </div>

      {/* Selected Node Panel */}
      {selectedNode && (
        <div className="border-t bg-card/60 p-3 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium truncate">{selectedNode.label}</h4>
              <Badge variant="outline" className="mt-1 text-[10px]">
                {selectedNode.type}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedNode(null)}
              className="h-6 w-6 -mr-1 -mt-1"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          
          {selectedNode.properties?.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {selectedNode.properties.summary}
            </p>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleAskAboutNode}
            className="w-full h-7 text-xs"
          >
            <MessageSquare className="h-3 w-3 mr-1.5" />
            Preguntar sobre esto
          </Button>
        </div>
      )}

      {/* Hover Tooltip */}
      {hoveredNode && !selectedNode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-popover border rounded-lg px-3 py-2 shadow-lg animate-in fade-in zoom-in-95 duration-150 max-w-[200px]">
          <p className="text-xs font-medium truncate">{hoveredNode.label}</p>
          <p className="text-[10px] text-muted-foreground">{hoveredNode.type}</p>
        </div>
      )}
    </div>
  )
}
