import { NextRequest, NextResponse } from 'next/server'
import { generateOpenRouterEmbedding } from '@/lib/generate-openrouter-embedding'

export async function POST(request: NextRequest) {
  try {
    const { text = 'Test embedding text' } = await request.json()

    // Probar generación de embedding
    const embedding = await generateOpenRouterEmbedding(text, 'text-embedding-3-small')

    return NextResponse.json({
      success: true,
      message: 'OpenRouter embeddings funcionando correctamente',
      test: {
        text,
        embeddingLength: embedding.length,
        embeddingDimensions: embedding.length,
        model: 'text-embedding-3-small'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('OpenRouter embeddings test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test OpenRouter embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Probar con texto de ejemplo
    const testText = 'Este es un texto de prueba para generar embeddings con OpenRouter'
    
    const embedding = await generateOpenRouterEmbedding(testText, 'text-embedding-3-small')

    return NextResponse.json({
      success: true,
      message: 'OpenRouter embeddings funcionando correctamente',
      test: {
        text: testText,
        embeddingLength: embedding.length,
        embeddingDimensions: embedding.length,
        model: 'text-embedding-3-small',
        firstFewValues: embedding.slice(0, 5) // Mostrar solo los primeros 5 valores
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('OpenRouter embeddings test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test OpenRouter embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}



