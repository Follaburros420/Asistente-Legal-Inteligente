/**
 * LangGraph Legal Assistant Pipeline
 * 
 * Main entry point for the LangGraph-based legal assistant.
 * 
 * Features:
 * - Two modes: INVESTIGATE (Deep Research) and DRAFT (Document Writing)
 * - Three tools: Vector Store, Knowledge Graph, Web Search
 * - Interrupt-based human-in-the-loop for questions
 * - Evidence-based responses with citations
 * - Quality audit for document drafting
 * 
 * Architecture:
 * - StateGraph with shared state
 * - Conditional routing based on intent
 * - Subgraphs for deep research
 * - Interrupts for user interaction
 * - Checkpointing for persistence
 */

// ============================================================================
// STATE
// ============================================================================

export {
  AgentStateAnnotation,
  DEFAULT_AGENT_STATE,
  type AgentState,
  type AgentMode,
  type ResearchDepth,
  type TodoStatus,
  type CaseContext,
  type Constraints,
  type ResearchPlan,
  type Evidence,
  type EvidenceChunk,
  type GraphReference,
  type WebReference,
  type Citation,
  type DocSection,
  type DocOutline,
  type MissingInfo,
  type Question,
  type AuditResult,
  type AuditIssue,
  type TodoItem,
  type ToolCallRecord,
  type InterruptPayload
} from "./state/schema"

// ============================================================================
// TOOLS
// ============================================================================

export {
  // Vector tools
  vectorSearchTool,
  multiQueryVectorSearchTool,
  searchResultToChunk,
  
  // Graph tools
  graphQueryTool,
  entitySearchTool,
  relationshipTraversalTool,
  nodeToGraphRef,
  
  // Web tools
  webSearchTool,
  legalArticleSearchTool,
  jurisprudenceSearchTool,
  webResultToReference,
  
  // Tool collections
  ALL_TOOLS,
  INVESTIGATE_TOOLS,
  DRAFT_TOOLS,
  TOOL_CATEGORIES,
  getToolsByCategory,
  getToolByName
} from "./tools"

// ============================================================================
// GRAPHS
// ============================================================================

export {
  deepResearchGraph,
  createDeepResearchGraph
} from "./graphs/deepResearchGraph"

export {
  mainGraph,
  createMainGraph
} from "./graphs/mainGraph"

// ============================================================================
// API
// ============================================================================

export {
  runHandler,
  runStreamHandler,
  resumeHandler,
  getStateHandler,
  resumeStreamHandler
} from "./api"

// ============================================================================
// UTILS
// ============================================================================

export {
  logger,
  timedNodeLog,
  timedToolLog,
  withNodeLogging,
  type LogEntry,
  type RunTrace,
  type ToolCallTrace,
  type LogLevel
} from "./utils/logger"