import type { GraphData, GraphEdge, GraphNode } from "@/lib/types"
import type { ProcessInsights } from "@/lib/types"

export const NODE_GROUPS = {
  facts: ["hecho", "hechos", "fact", "HECHO"],
  evidence: ["prueba", "pruebas", "evidence", "documento", "document", "DOCUMENTO"],
  norms: ["norma", "normas", "law", "articulo", "artículo", "NORMA"],
  people: ["persona", "person", "organization", "organizacion", "organización", "PERSONA_NATURAL", "PERSONA_JURIDICA"],
  concepts: ["CONCEPTO_JURIDICO", "concepto_juridico"],
  entities: ["ENTIDAD_PUBLICA", "DESPACHO_JUDICIAL", "entidad_publica", "despacho_judicial"],
  locations: ["UBICACION", "ubicacion", "location", "lugar"],
  other: ["OTRO", "otro", "FECHA", "fecha", "date"]
}

export type NodeGroup = "facts" | "evidence" | "norms" | "people" | "concepts" | "entities" | "locations" | "other"

export type EdgeKind = "fact-evidence" | "fact-norm" | "contradiction" | "default"

export const normalizeType = (value?: string) => (value || "").toLowerCase()

export const getNodeGroup = (type?: string): NodeGroup => {
  const normalized = normalizeType(type)
  // Check both normalized and original type for uppercase matches
  const originalType = type || ""
  
  if (NODE_GROUPS.facts.some(t => t.toLowerCase() === normalized)) return "facts"
  if (NODE_GROUPS.evidence.some(t => t.toLowerCase() === normalized)) return "evidence"
  if (NODE_GROUPS.norms.some(t => t.toLowerCase() === normalized)) return "norms"
  if (NODE_GROUPS.people.some(t => t.toLowerCase() === normalized)) return "people"
  if (NODE_GROUPS.concepts.some(t => t.toLowerCase() === normalized || t === originalType)) return "concepts"
  if (NODE_GROUPS.entities.some(t => t.toLowerCase() === normalized || t === originalType)) return "entities"
  if (NODE_GROUPS.locations.some(t => t.toLowerCase() === normalized)) return "locations"
  if (NODE_GROUPS.other.some(t => t.toLowerCase() === normalized || t === originalType)) return "other"
  return "other"
}

const getNodeId = (node: string | GraphNode) =>
  typeof node === "string" ? node : node.id

export const getNodeMap = (nodes: GraphNode[]) => new Map(nodes.map((node) => [node.id, node]))

const CONTRADICTION_REGEX = /contradic/i

export const getEdgeKind = (edge: GraphEdge, nodeMap: Map<string, GraphNode>): EdgeKind => {
  const label = normalizeType(edge.label || edge.properties?.type || edge.properties?.relation)
  if (CONTRADICTION_REGEX.test(label)) return "contradiction"

  const sourceId = getNodeId(edge.source)
  const targetId = getNodeId(edge.target)
  const sourceGroup = getNodeGroup(nodeMap.get(sourceId)?.type)
  const targetGroup = getNodeGroup(nodeMap.get(targetId)?.type)

  if (
    (sourceGroup === "facts" && targetGroup === "evidence") ||
    (sourceGroup === "evidence" && targetGroup === "facts")
  ) {
    return "fact-evidence"
  }

  if (
    (sourceGroup === "facts" && targetGroup === "norms") ||
    (sourceGroup === "norms" && targetGroup === "facts")
  ) {
    return "fact-norm"
  }

  return "default"
}

export const buildGraphInsights = (graphData: GraphData): Partial<ProcessInsights> => {
  const nodeMap = getNodeMap(graphData.nodes)

  let facts = 0
  let evidence = 0
  let norms = 0
  let contradictions = 0

  graphData.nodes.forEach((node) => {
    const group = getNodeGroup(node.type)
    if (group === "facts") facts += 1
    if (group === "evidence") evidence += 1
    if (group === "norms") norms += 1
  })

  graphData.edges.forEach((edge) => {
    if (getEdgeKind(edge, nodeMap) === "contradiction") {
      contradictions += 1
    }
  })

  return {
    facts,
    evidence,
    norms,
    contradictions
  }
}

export const getEdgeNodeIds = (edge: GraphEdge) => {
  return {
    sourceId: getNodeId(edge.source),
    targetId: getNodeId(edge.target)
  }
}
