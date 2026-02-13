import { SearchType } from '@/lib/types/search'

export interface RAGChatRequest {
    message: string
    search_type?: SearchType
    workspace_id?: string
    process_id?: string
    model?: string
}

export interface RAGChatResponse {
    response: string
    sources?: Array<{
        content: string
        metadata: Record<string, any>
        score?: number
    }>
}

export interface RAGSearchRequest {
    query: string
    search_type?: SearchType
    limit?: number
    workspace_id: string
    process_id?: string
}

export interface RAGSearchResult {
    content: string
    metadata: Record<string, any>
    score: number
}

export interface RAGIngestResponse {
    message: string
    document_id?: string
    status: 'success' | 'error'
    markdown?: string
}

export interface RAGDocument {
    id: string
    filename: string
    workspace_id?: string
    created_at: string
    metadata?: Record<string, any>
}

export interface RAGHealthResponse {
    status: string
    message?: string
    apis?: {
        main?: string
        neo4j?: string
        qdrant?: string
    }
}

class RAGBackendService {
    private baseUrl: string
    private skipSSLVerification: boolean

    constructor() {
        this.baseUrl = process.env.RAG_BACKEND_URL || ''
        // En desarrollo, permitir certificados auto-firmados
        this.skipSSLVerification = process.env.NODE_ENV !== 'production'

        if (!this.baseUrl) {
            console.warn('⚠️ RAG_BACKEND_URL no está configurado')
        }
    }

    /**
     * Opciones de fetch para manejar SSL en desarrollo
     */
    private getFetchOptions(): RequestInit {
        if (this.skipSSLVerification) {
            // En Node.js con undici, usamos esta configuración
            return {
                // @ts-ignore - Soporte para Node.js con certificados auto-firmados
                dispatcher: new (require('undici').Agent)({
                    connect: {
                        rejectUnauthorized: false
                    }
                })
            }
        }
        return {}
    }

    /**
     * Verificar salud del backend RAG
     */
    async getHealth(): Promise<RAGHealthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                ...this.getFetchOptions()
            })

            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status}`)
            }

            return await response.json()
        } catch (error) {
            console.error('❌ RAG Backend health check failed:', error)
            throw new Error('Backend RAG no disponible')
        }
    }

    /**
     * Enviar mensaje de chat al backend RAG
     */
    async chat(request: RAGChatRequest): Promise<RAGChatResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: request.message,
                    search_type: request.search_type || 'hybrid',
                    workspace_id: request.workspace_id,
                    process_id: request.process_id,
                    model: request.model
                }),
                ...this.getFetchOptions()
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Chat request failed: ${response.status}`)
            }

            return await response.json()
        } catch (error) {
            console.error('❌ RAG Backend chat error:', error)
            throw error
        }
    }

    /**
     * Chat con streaming (Server-Sent Events)
     */
    async streamChat(request: RAGChatRequest): Promise<ReadableStream> {
        try {
            const response = await fetch(`${this.baseUrl}/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: request.message,
                    search_type: request.search_type || 'hybrid',
                    workspace_id: request.workspace_id,
                    process_id: request.process_id,
                    model: request.model
                }),
                ...this.getFetchOptions()
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Chat stream failed: ${response.status}`)
            }

            return response.body as ReadableStream
        } catch (error) {
            console.error('❌ RAG Backend stream request failed:', error)
            throw error
        }
    }

    /**
     * Buscar documentos en el backend RAG (Híbrido: Vector + Grafo)
     */
    async search(request: RAGSearchRequest): Promise<RAGSearchResult[]> {
        const searchType = request.search_type || 'hybrid'

        try {
            // Determinar endpoint basado en el tipo de búsqueda
            let endpoint = '/search/hybrid'
            if (searchType === 'vector') endpoint = '/search/vector'
            if (searchType === 'graph') endpoint = '/search/graph' // Endpoint hipotético, ajustar según API real

            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: request.query,
                    limit: request.limit || 5,
                    workspace_id: request.workspace_id,
                    process_id: request.process_id
                }),
                ...this.getFetchOptions()
            })

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`)
            }

            const data = await response.json()
            // Normalizar respuesta si es necesario
            return data.results || data
        } catch (error) {
            console.error('❌ RAG Backend search error:', error)
            return []
        }
    }

    /**
     * Ingestar un documento (simulado o proxy al backend real)
     */
    async ingestDocument(file: File, workspaceId: string, processId: string, metadata: Record<string, any> = {}): Promise<RAGIngestResponse> {
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('workspace_id', workspaceId)
            formData.append('process_id', processId)
            formData.append('metadata', JSON.stringify(metadata))

            const response = await fetch(`${this.baseUrl}/ingest`, {
                method: 'POST',
                body: formData,
                ...this.getFetchOptions()
            })

            if (!response.ok) {
                throw new Error(`Ingestion failed: ${response.status}`)
            }

            return await response.json()
        } catch (error) {
            console.error('❌ RAG Backend ingestion error:', error)
            throw error
        }
    }

    /**
     * Listar documentos (Proxy al backend)
     */
    async listDocuments(workspaceId: string, processId?: string, limit: number = 20): Promise<RAGDocument[]> {
        try {
            const params = new URLSearchParams({
                workspace_id: workspaceId,
                limit: limit.toString()
            })
            if (processId) {
                params.append('process_id', processId)
            }

            const response = await fetch(`${this.baseUrl}/documents?${params}`, {
                method: 'GET',
                ...this.getFetchOptions()
            })

            if (!response.ok) {
                throw new Error(`List documents failed: ${response.status}`)
            }

            const data = await response.json()
            return data.documents || []
        } catch (error) {
            console.error('❌ RAG Backend list documents error:', error)
            return []
        }
    }

    /**
     * Obtener grafo de conocimiento (Nodos y Relaciones)
     */
    async getGraph(workspaceId: string, processId: string, limit: number = 50, maxDepth: number = 2): Promise<any> {
        try {
            const params = new URLSearchParams({
                workspace_id: workspaceId,
                process_id: processId,
                limit: limit.toString(),
                max_depth: maxDepth.toString()
            })

            const response = await fetch(`${this.baseUrl}/graph/visualize?${params}`, {
                method: 'GET',
                ...this.getFetchOptions()
            })

            if (!response.ok) {
                console.warn(`Graph visualization failed: ${response.status}`)
                // Retornar estructura vacía en caso de error para no romper UI
                return { nodes: [], edges: [] }
            }

            return await response.json()
        } catch (error) {
            console.error('❌ RAG Backend graph error:', error)
            return { nodes: [], edges: [] }
        }
    }

    /**
     * Verifica si el servicio está configurado
     */
    isConfigured(): boolean {
        return !!this.baseUrl
    }
}

export const ragBackendService = new RAGBackendService()
