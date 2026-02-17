"use client"

/**
 * EvidencePanel Component
 * 
 * Displays the evidence (chunks, graph refs, web refs) used by the legal assistant.
 */

import * as React from "react"
import { 
  FileText, 
  Network, 
  Globe, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink,
  Copy,
  Check,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// ============================================================================
// TYPES
// ============================================================================

export interface EvidenceChunk {
  id: string
  text: string
  source_id: string
  doc_id: string
  case_id?: string
  score: number
  metadata?: Record<string, any>
}

export interface GraphReference {
  node_id: string
  entity_type: string
  name: string
  relation_type?: string
  properties?: Record<string, any>
}

export interface WebReference {
  url: string
  title: string
  snippet: string
  date?: string
  score?: number
  source_type?: string
}

export interface Evidence {
  chunks: EvidenceChunk[]
  graph_refs: GraphReference[]
  web_refs: WebReference[]
}

export interface EvidencePanelProps {
  evidence: Evidence
  className?: string
  compact?: boolean
  onChunkClick?: (chunk: EvidenceChunk) => void
}

// ============================================================================
// CHUNK ITEM COMPONENT
// ============================================================================

function ChunkItem({ chunk, onClick }: { chunk: EvidenceChunk; onClick?: () => void }) {
  const [copied, setCopied] = React.useState(false)
  
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(chunk.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const relevancePercent = Math.round(chunk.score * 100)
  
  return (
    <div 
      className="group rounded-md border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium truncate max-w-[150px]">
            {chunk.doc_id}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {relevancePercent}% relevancia
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copiar texto</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-3">
        {chunk.text}
      </p>
      {chunk.case_id && (
        <p className="text-xs text-muted-foreground mt-2">
          Expediente: {chunk.case_id}
        </p>
      )}
    </div>
  )
}

// ============================================================================
// GRAPH REF ITEM COMPONENT
// ============================================================================

function GraphRefItem({ ref }: { ref: GraphReference }) {
  const entityTypeColors: Record<string, string> = {
    Person: "bg-blue-100 text-blue-800",
    Persona: "bg-blue-100 text-blue-800",
    Norm: "bg-purple-100 text-purple-800",
    Norma: "bg-purple-100 text-purple-800",
    Fact: "bg-green-100 text-green-800",
    Hecho: "bg-green-100 text-green-800",
    Document: "bg-orange-100 text-orange-800",
    Documento: "bg-orange-100 text-orange-800",
    Entity: "bg-gray-100 text-gray-800"
  }
  
  const colorClass = entityTypeColors[ref.entity_type] || entityTypeColors.Entity
  
  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50">
      <Network className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{ref.name}</span>
          <Badge className={cn("text-xs", colorClass)}>
            {ref.entity_type}
          </Badge>
        </div>
        {ref.properties?.summary && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {ref.properties.summary}
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// WEB REF ITEM COMPONENT
// ============================================================================

function WebRefItem({ ref }: { ref: WebReference }) {
  const sourceTypeLabels: Record<string, string> = {
    "Jurisprudencia Constitucional": "Corte Constitucional",
    "Jurisprudencia Suprema": "Corte Suprema",
    "Jurisprudencia Administrativa": "Consejo de Estado",
    "Normativa Legislativa": "Legislación",
    "Fuente Oficial": "Oficial",
    "Doctrina Académica": "Académico"
  }
  
  const sourceLabel = ref.source_type ? sourceTypeLabels[ref.source_type] || ref.source_type : "Web"
  
  return (
    <a 
      href={ref.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2 py-2 px-3 rounded-md hover:bg-muted/50"
    >
      <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate group-hover:text-primary">
            {ref.title}
          </span>
          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {ref.snippet}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">
            {sourceLabel}
          </Badge>
          {ref.date && (
            <span className="text-xs text-muted-foreground">
              {ref.date}
            </span>
          )}
        </div>
      </div>
    </a>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EvidencePanel({ 
  evidence, 
  className,
  compact = false,
  onChunkClick 
}: EvidencePanelProps) {
  const [chunksOpen, setChunksOpen] = React.useState(true)
  const [graphOpen, setGraphOpen] = React.useState(true)
  const [webOpen, setWebOpen] = React.useState(true)
  
  const totalEvidence = evidence.chunks.length + evidence.graph_refs.length + evidence.web_refs.length
  
  if (totalEvidence === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            Evidencia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Sin evidencia recolectada
          </p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Evidencia</CardTitle>
          <Badge variant="outline" className="text-xs">
            {totalEvidence} fuentes
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className={cn(compact ? "max-h-48" : "max-h-96")}>
          <div className="space-y-2">
            {/* Document Chunks */}
            {evidence.chunks.length > 0 && (
              <Collapsible open={chunksOpen} onOpenChange={setChunksOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 w-full py-1 hover:text-primary">
                  {chunksOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">Documentos</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {evidence.chunks.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 mt-2 pl-5">
                    {evidence.chunks.map(chunk => (
                      <ChunkItem 
                        key={chunk.id} 
                        chunk={chunk} 
                        onClick={() => onChunkClick?.(chunk)}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            
            {/* Graph References */}
            {evidence.graph_refs.length > 0 && (
              <Collapsible open={graphOpen} onOpenChange={setGraphOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 w-full py-1 hover:text-primary">
                  {graphOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Network className="h-4 w-4" />
                  <span className="text-sm font-medium">Knowledge Graph</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {evidence.graph_refs.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 mt-2 pl-5">
                    {evidence.graph_refs.map((ref, i) => (
                      <GraphRefItem key={ref.node_id || i} ref={ref} />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            
            {/* Web References */}
            {evidence.web_refs.length > 0 && (
              <Collapsible open={webOpen} onOpenChange={setWebOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 w-full py-1 hover:text-primary">
                  {webOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Globe className="h-4 w-4" />
                  <span className="text-sm font-medium">Fuentes Web</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {evidence.web_refs.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 mt-2 pl-5">
                    {evidence.web_refs.map((ref, i) => (
                      <WebRefItem key={ref.url || i} ref={ref} />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// MINI VERSION
// ============================================================================

export function EvidenceMini({ evidence }: { evidence: Evidence }) {
  const total = evidence.chunks.length + evidence.graph_refs.length + evidence.web_refs.length
  
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      {evidence.chunks.length > 0 && (
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {evidence.chunks.length}
        </span>
      )}
      {evidence.graph_refs.length > 0 && (
        <span className="flex items-center gap-1">
          <Network className="h-3 w-3" />
          {evidence.graph_refs.length}
        </span>
      )}
      {evidence.web_refs.length > 0 && (
        <span className="flex items-center gap-1">
          <Globe className="h-3 w-3" />
          {evidence.web_refs.length}
        </span>
      )}
      {total === 0 && (
        <span>Sin evidencia</span>
      )}
    </div>
  )
}