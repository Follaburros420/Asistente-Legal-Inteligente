/**
 * Local RAG Service
 * 
 * This service provides RAG (Retrieval-Augmented Generation) functionality
 * using local Supabase vector store and OpenAI, without requiring an external backend.
 */

import OpenAI from 'openai'
import { supabaseVectorStore } from './supabase-vector-store'
import { neo4jGraphService } from './neo4j-graph-service'
import { env } from '@/lib/env/runtime-env'

export interface LocalRAGRequest {
  message: string
  process_id: string
  workspace_id?: string
  model?: string
  conversationHistory?: Array<{ role: string; content: string }>
}

export interface LocalRAGResponse {
  response: string
  sources?: Array<{
    content: string
    metadata: Record<string, any>
    score?: number
  }>
}

class LocalRAGService {
  private openai: OpenAI | null = null

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      this.openai = new OpenAI({ apiKey })
    } else {
      console.warn('⚠️ OPENAI_API_KEY not configured - local RAG will not work')
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.openai
  }

  /**
   * Perform RAG chat with streaming
   */
  async *streamChat(request: LocalRAGRequest): AsyncGenerator<string> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized - missing API key')
    }

    console.log(`🔍 [Local RAG] Processing message for process: ${request.process_id}`)

    // Step 1: Retrieve relevant context from vector store
    const searchResults = await supabaseVectorStore.similaritySearch(request.message, {
      processId: request.process_id,
      workspaceId: request.workspace_id,
      limit: 5,
      threshold: 0.5
    })

    console.log(`📚 [Local RAG] Found ${searchResults.length} relevant chunks`)

    // Step 2: Get graph context if available
    let graphContext = ''
    if (neo4jGraphService.isConfigured()) {
      try {
        const graphData = await neo4jGraphService.getProcessGraph(request.process_id, { limit: 20 })
        if (graphData.nodes.length > 0) {
          const entityNames = graphData.nodes
            .filter(n => n.properties?.name)
            .map(n => n.properties.name)
            .slice(0, 10)
          
          if (entityNames.length > 0) {
            graphContext = `\nEntidades relevantes en el grafo de conocimiento: ${entityNames.join(', ')}`
          }
        }
      } catch (error) {
        console.warn('⚠️ [Local RAG] Could not fetch graph context:', error)
      }
    }

    // Step 3: Build context from search results
    const contextParts = searchResults.map((result, index) => {
      const source = result.metadata?.file_name || result.document_id
      return `[Documento ${index + 1}${source ? ` - ${source}` : ''}]:\n${result.content}`
    })
    
    const context = contextParts.length > 0 
      ? `\n\nContexto relevante de los documentos:\n${contextParts.join('\n\n')}` 
      : ''

    // Step 4: Build system prompt
    const systemPrompt = `Eres un asistente legal especializado en análisis de documentos jurídicos colombianos. 
Tu tarea es responder preguntas basándote en el contexto proporcionado de los documentos del proceso.

Instrucciones:
1. Responde de manera clara y precisa en español
2. Cita las partes relevantes de los documentos cuando sea apropiado
3. Si la información no está en el contexto, indícalo claramente
4. Usa formato markdown para estructurar tus respuestas
5. Sé conciso pero completo en tus respuestas
${graphContext}
${context}`

    // Step 5: Build messages array
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ]

    // Add conversation history if provided
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      for (const msg of request.conversationHistory.slice(-6)) { // Keep last 6 messages for context
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })
      }
    }

    // Add current message
    messages.push({ role: 'user', content: request.message })

    // Step 6: Stream response from OpenAI
    const model = request.model || 'gpt-4o-mini'
    
    try {
      const stream = await this.openai.chat.completions.create({
        model,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
      })

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          yield content
        }
      }
    } catch (error: any) {
      console.error('❌ [Local RAG] OpenAI streaming error:', error)
      throw new Error(`Error generating response: ${error.message}`)
    }
  }

  /**
   * Non-streaming chat (for simple queries)
   */
  async chat(request: LocalRAGRequest): Promise<LocalRAGResponse> {
    let fullResponse = ''
    
    for await (const chunk of this.streamChat(request)) {
      fullResponse += chunk
    }

    // Get sources from search
    const searchResults = await supabaseVectorStore.similaritySearch(request.message, {
      processId: request.process_id,
      workspaceId: request.workspace_id,
      limit: 3,
      threshold: 0.5
    })

    return {
      response: fullResponse,
      sources: searchResults.map(r => ({
        content: r.content.substring(0, 500) + (r.content.length > 500 ? '...' : ''),
        metadata: r.metadata,
        score: r.similarity
      }))
    }
  }
}

export const localRAGService = new LocalRAGService()
