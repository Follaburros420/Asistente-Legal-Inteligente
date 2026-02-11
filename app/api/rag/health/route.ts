import { NextRequest, NextResponse } from 'next/server'
import { ragBackendService } from '@/lib/services/rag-backend'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * API Route: GET /api/rag/health
 * Verificar estado del backend RAG
 */
export async function GET(req: NextRequest) {
    try {
        // Verificar configuración
        if (!ragBackendService.isConfigured()) {
            return NextResponse.json(
                {
                    configured: false,
                    status: 'not_configured',
                    message: 'RAG_BACKEND_URL no está configurada en las variables de entorno'
                },
                { status: 503 }
            )
        }

        // Llamar al health check del backend
        const health = await ragBackendService.getHealth()

        return NextResponse.json({
            configured: true,
            backend_url: process.env.RAG_BACKEND_URL,
            ...health,
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('❌ Error en /api/rag/health:', error)

        return NextResponse.json(
            {
                configured: true,
                status: 'error',
                error: error.message || 'Backend RAG no disponible',
                backend_url: process.env.RAG_BACKEND_URL,
                details: process.env.NODE_ENV === 'development' ? error.toString() : undefined,
                timestamp: new Date().toISOString()
            },
            { status: 503 }
        )
    }
}
