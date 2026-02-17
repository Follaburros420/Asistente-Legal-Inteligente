/**
 * LangGraph Tools Index
 * 
 * Exports all tools for the legal assistant pipeline.
 */

// Vector Store Tools
export {
  vectorSearchTool,
  multiQueryVectorSearchTool,
  searchResultToChunk,
  type VectorSearchInput,
  type VectorSearchOutput
} from "./vector"

// Knowledge Graph Tools
export {
  graphQueryTool,
  entitySearchTool,
  relationshipTraversalTool,
  nodeToGraphRef,
  type GraphQueryInput,
  type EntitySearchInput,
  type RelationshipTraversalInput
} from "./graph"

// Web Search Tools
export {
  webSearchTool,
  legalArticleSearchTool,
  jurisprudenceSearchTool,
  webResultToReference,
  type WebSearchInput,
  type LegalArticleSearchInput,
  type JurisprudenceSearchInput
} from "./web"

import { tool } from "@langchain/core/tools"
import { vectorSearchTool, multiQueryVectorSearchTool } from "./vector"
import { graphQueryTool, entitySearchTool, relationshipTraversalTool } from "./graph"
import { webSearchTool, legalArticleSearchTool, jurisprudenceSearchTool } from "./web"

/**
 * All available tools for the legal assistant
 */
export const ALL_TOOLS = [
  // Vector tools
  vectorSearchTool,
  multiQueryVectorSearchTool,
  
  // Graph tools
  graphQueryTool,
  entitySearchTool,
  relationshipTraversalTool,
  
  // Web tools
  webSearchTool,
  legalArticleSearchTool,
  jurisprudenceSearchTool
] as const

/**
 * Tools for INVESTIGATE mode (deep research)
 */
export const INVESTIGATE_TOOLS = [
  vectorSearchTool,
  multiQueryVectorSearchTool,
  graphQueryTool,
  entitySearchTool,
  webSearchTool,
  legalArticleSearchTool,
  jurisprudenceSearchTool
] as const

/**
 * Tools for DRAFT mode (document writing)
 */
export const DRAFT_TOOLS = [
  vectorSearchTool,
  graphQueryTool,
  entitySearchTool,
  webSearchTool,
  legalArticleSearchTool
] as const

/**
 * Tool categories for selective binding
 */
export const TOOL_CATEGORIES = {
  retrieval: [vectorSearchTool, multiQueryVectorSearchTool],
  knowledge_graph: [graphQueryTool, entitySearchTool, relationshipTraversalTool],
  web_research: [webSearchTool, legalArticleSearchTool, jurisprudenceSearchTool]
} as const

/**
 * Get tools by category
 */
export function getToolsByCategory(category: keyof typeof TOOL_CATEGORIES) {
  return TOOL_CATEGORIES[category]
}

/**
 * Get tool by name
 */
export function getToolByName(name: string) {
  return ALL_TOOLS.find(t => t.name === name)
}