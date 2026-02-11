/**
 * RAG Backend Service
 * Servicio para interactuar con el backend RAG especializado
 * que proporciona búsqueda híbrida (vectorial + grafo de conocimiento)
 */

export type SearchType = 'vector' | 'graph' | 'hybrid'

export interface RAGChatRequest {
    message: string
    search_type?: SearchType
    workspace_id?: string
    process_id?: string
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

export interface RAGRequestOptions {
    timeoutMs?: number
    retries?: number
}

export class RAGBackendRequestError extends Error {
    status?: number
    retryable: boolean
    operation: string

    constructor(message: string, operation: string, retryable: boolean, status?: number) {
        super(message)
        this.name = "RAGBackendRequestError"
        this.operation = operation
        this.retryable = retryable
        this.status = status
    }
}

class RAGBackendService {
    private baseUrl: string
    private skipSSLVerification: boolean
    private readonly defaultTimeoutMs: number
    private readonly maxRetries: number
    private readonly retryBaseMs: number
    private readonly circuitFailureThreshold: number
    private readonly circuitCooldownMs: number
    private circuitFailures = 0
    private circuitOpenedAt: number | null = null

    constructor() {
        this.baseUrl = process.env.RAG_BACKEND_URL || ''
        // En desarrollo, permitir certificados auto-firmados
        this.skipSSLVerification = process.env.NODE_ENV !== 'production'
        this.defaultTimeoutMs = parsePositiveInt(process.env.RAG_BACKEND_TIMEOUT_MS, 25000)
        this.maxRetries = parsePositiveInt(process.env.RAG_BACKEND_MAX_RETRIES, 2)
        this.retryBaseMs = parsePositiveInt(process.env.RAG_BACKEND_RETRY_BASE_MS, 500)
        this.circuitFailureThreshold = parsePositiveInt(
            process.env.RAG_BACKEND_CIRCUIT_FAILURE_THRESHOLD,
            5
        )
        this.circuitCooldownMs = parsePositiveInt(
            process.env.RAG_BACKEND_CIRCUIT_COOLDOWN_MS,
            30000
        )

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

    private isCircuitOpen(): boolean {
        if (this.circuitOpenedAt === null) {
            return false
        }
        if (Date.now() - this.circuitOpenedAt >= this.circuitCooldownMs) {
            // Half-open: allow one probe request
            this.circuitOpenedAt = null
            return false
        }
        return true
    }

    private registerSuccess() {
        this.circuitFailures = 0
        this.circuitOpenedAt = null
    }

    private registerFailure() {
        this.circuitFailures += 1
        if (this.circuitFailures >= this.circuitFailureThreshold) {
            this.circuitOpenedAt = Date.now()
        }
    }

    private async resilientFetch(
        endpoint: string,
        init: RequestInit,
        operation: string,
        options?: RAGRequestOptions
    ): Promise<Response> {
        if (this.isCircuitOpen()) {
            throw new RAGBackendRequestError(
                "Backend RAG temporalmente degradado. Intenta nuevamente en unos segundos.",
                operation,
                true,
                503
            )
        }

        const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs
        const retries = options?.retries ?? this.maxRetries
        let lastError: Error | null = null

        for (let attempt = 0; attempt <= retries; attempt++) {
            const controller = new AbortController()
            const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

            try {
                const response = await fetch(`${this.baseUrl}${endpoint}`, {
                    ...this.getFetchOptions(),
                    ...init,
                    signal: controller.signal
                })

                clearTimeout(timeoutHandle)

                if (!response.ok) {
                    const body = await response.json().catch(() => ({}))
                    const message =
                        body.error || body.message || `${operation} failed: ${response.status}`
                    const retryable = this.isRetryableStatus(response.status)
                    throw new RAGBackendRequestError(
                        message,
                        operation,
                        retryable,
                        response.status
                    )
                }

                this.registerSuccess()
                return response
            } catch (error: any) {
                clearTimeout(timeoutHandle)
                const normalized = this.normalizeError(error, operation)
                lastError = normalized
                const canRetry = normalized.retryable && attempt < retries
                if (!canRetry) {
                    this.registerFailure()
                    throw normalized
                }
                await sleep(this.backoffMs(attempt))
            }
        }

        this.registerFailure()
        throw (
            lastError ||
            new RAGBackendRequestError(
                "Error desconocido comunicando con backend RAG",
                operation,
                true
            )
        )
    }

    private normalizeError(error: any, operation: string): RAGBackendRequestError {
        if (error instanceof RAGBackendRequestError) {
            return error
        }

        if (error?.name === "AbortError") {
            return new RAGBackendRequestError(
                `Timeout en ${operation}`,
                operation,
                true,
                504
            )
        }

        return new RAGBackendRequestError(
            error?.message || `Error en ${operation}`,
            operation,
            true
        )
    }

    private isRetryableStatus(status: number): boolean {
        return status === 408 || status === 429 || status >= 500
    }

    private backoffMs(attempt: number): number {
        const exp = this.retryBaseMs * 2 ** attempt
        const jitter = Math.floor(Math.random() * this.retryBaseMs)
        return exp + jitter
    }

    /**
     * Verificar salud del backend RAG
     */
    async getHealth(): Promise<RAGHealthResponse> {
        try {
            const response = await this.resilientFetch('/health', {
                method: 'GET',
                ...this.getFetchOptions()
            }, "health")

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
            const response = await this.resilientFetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: request.message,
                    search_type: request.search_type || 'hybrid',
                    workspace_id: request.workspace_id,
                    process_id: request.process_id
                }),
                ...this.getFetchOptions()
            }, "chat")

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
            const response = await this.resilientFetch('/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: request.message,
                    search_type: request.search_type || 'hybrid',
                    workspace_id: request.workspace_id,
                    process_id: request.process_id
                }),
                ...this.getFetchOptions()
            }, "streamChat", { retries: 0 })

            if (!response.body) {
                throw new Error('No response body')
            }

            return response.body
        } catch (error) {
            console.error('❌ RAG Backend stream error:', error)
            throw error
        }
    }

    /**
     * Realizar búsqueda en el backend RAG
     */
    async search(request: RAGSearchRequest): Promise<RAGSearchResult[]> {
        const searchType = request.search_type || 'hybrid'

        try {
            const response = await this.resilientFetch(`/search/${searchType}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: request.query,
                    limit: request.limit || 10,
                    workspace_id: request.workspace_id,
                    process_id: request.process_id
                }),
                ...this.getFetchOptions()
            }, "search")

            const data = await response.json()
            return data.results || []
        } catch (error) {
            console.error('❌ RAG Backend search error:', error)
            throw error
        }
    }

    /**
     * Ingestar documento en el backend RAG
     */
    async ingestDocument(
        file: File,
        workspaceId?: string,
        processId?: string,
        metadata?: Record<string, any>,
        options?: RAGRequestOptions
    ): Promise<RAGIngestResponse> {
        try {
            const formData = new FormData()
            formData.append('file', file)
            // Opciones adicionales por defecto para el backend RAG
            formData.append('chunk_size', '1000')
            formData.append('use_semantic', 'true')

            if (workspaceId) {
                formData.append('workspace_id', workspaceId)
            }

            if (processId) {
                formData.append('process_id', processId)
            }

            if (metadata) {
                formData.append('metadata', JSON.stringify(metadata))
            }

            const response = await this.resilientFetch('/ingest', {
                method: 'POST',
                body: formData,
                ...this.getFetchOptions()
            }, "ingestDocument", options)

            return await response.json()
        } catch (error) {
            console.error('❌ RAG Backend ingest error:', error)
            throw error
        }
    }

    /**
     * Listar documentos indexados
     */
    async listDocuments(workspaceId?: string, processId?: string, limit: number = 100): Promise<RAGDocument[]> {
        try {
            const params = new URLSearchParams()
            if (workspaceId) params.append('workspace_id', workspaceId)
            if (processId) params.append('process_id', processId)
            params.append('limit', limit.toString())

            const response = await this.resilientFetch(`/documents?${params.toString()}`, {
                method: 'GET',
                ...this.getFetchOptions()
            }, "listDocuments")

            const data = await response.json()
            return data.documents || []
        } catch (error) {
            console.error('❌ RAG Backend list documents error:', error)
            throw error
        }
    }

    /**
     * Obtener grafo de conocimiento
     */
    async getGraph(
        workspaceId: string,
        processId: string,
        status: string = 'active',
        limit: number = 100,
        maxDepth: number = 3
    ): Promise<any> {
        try {
            const params = new URLSearchParams()
            if (workspaceId) params.append('workspace_id', workspaceId)
            if (processId) params.append('process_id', processId)
            params.append('status', status)
            params.append('limit', limit.toString())
            params.append('max_depth', maxDepth.toString())

            const response = await this.resilientFetch(`/graph?${params.toString()}`, {
                method: 'GET',
                ...this.getFetchOptions()
            }, "getGraph")

            return await response.json()
        } catch (error) {
            console.error('❌ RAG Backend graph error:', error)
            throw error
        }
    }

    /**
     * Verificar si el backend está configurado
     */
    isConfigured(): boolean {
        return Boolean(this.baseUrl)
    }
}

// Singleton instance
export const ragBackendService = new RAGBackendService()

function parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value || "", 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
