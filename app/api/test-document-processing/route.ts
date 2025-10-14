import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Probar que el endpoint funciona
    return NextResponse.json({
      success: true,
      message: 'Endpoint de procesamiento de documentos funcionando',
      test: {
        status: 'ok',
        provider: 'local',
        note: 'Los embeddings locales están configurados para uso por defecto'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Document processing test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test document processing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { text = 'Test embedding text' } = await request.json()

    // Probar generación de embedding local
    const embedding = await generateLocalEmbedding(text)

    return NextResponse.json({
      success: true,
      message: 'Embeddings locales funcionando correctamente',
      test: {
        text,
        embeddingLength: embedding.length,
        embeddingDimensions: embedding.length,
        provider: 'local'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Document processing test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test document processing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
