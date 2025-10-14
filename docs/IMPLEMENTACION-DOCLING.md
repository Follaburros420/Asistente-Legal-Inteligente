# 📄 Implementación de Docling para Procesamiento Avanzado de Documentos

## 🎯 Objetivos

1. Permitir que usuarios suban **múltiples tipos de archivos** (excepto audio)
2. **Extraer contenido** de forma robusta y precisa
3. **Generar embeddings locales** (gratuitos, sin depender de APIs externas)
4. **Soportar documentos complejos** con tablas, imágenes, metadatos

## 📚 ¿Qué es Docling?

**Docling** es una librería de Python desarrollada por IBM Research para:

- ✅ **Parsear documentos** de múltiples formatos
- ✅ **Extraer contenido estructurado** (texto, tablas, imágenes, metadatos)
- ✅ **OCR integrado** para PDFs escaneados
- ✅ **Exportar a Markdown, JSON, HTML**
- ✅ **Preservar jerarquía** del documento

### Formatos Soportados:

- ✅ PDF (incluyendo escaneados con OCR)
- ✅ DOCX (Microsoft Word)
- ✅ PPTX (Microsoft PowerPoint)
- ✅ HTML
- ✅ Images (PNG, JPG con OCR)
- ✅ Markdown
- ✅ AsciiDoc
- ✅ XLSX (Excel) - experimental

## 🔄 Arquitectura Propuesta

```
Usuario sube archivo
    ↓
Next.js API Route
    ↓
Docling (Python) [Microservicio separado]
    ↓
Extrae contenido estructurado
    ↓
Divide en chunks inteligentes
    ↓
Genera embeddings locales (@xenova/transformers)
    ↓
Guarda en Supabase
```

## 🛠️ Implementación

### Opción A: Docling como Microservicio Python (Recomendado) 🚀

**Ventajas**:
- Docling funciona mejor en Python nativo
- Separación de responsabilidades
- Escalable

**Arquitectura**:
```
[Next.js Frontend/Backend] ←→ HTTP ←→ [Python Microservicio con Docling]
                                           ↓
                                    Supabase Storage
```

### Opción B: Docling vía Child Process en Node.js

**Ventajas**:
- Todo en un solo proyecto
- Más simple para desarrollo

**Desventajas**:
- Requiere Python instalado en el servidor

---

## 📦 Plan de Implementación: Opción A (Microservicio)

### Paso 1: Crear Microservicio Python con Docling

```bash
# En una carpeta separada
mkdir docling-service
cd docling-service
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install docling fastapi uvicorn python-multipart
```

### Paso 2: API de Docling (FastAPI)

```python
# docling-service/main.py
from fastapi import FastAPI, File, UploadFile
from docling.document_converter import DocumentConverter
import tempfile
import os

app = FastAPI()

@app.post("/process-document")
async def process_document(file: UploadFile = File(...)):
    # Guardar archivo temporal
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Procesar con Docling
        converter = DocumentConverter()
        result = converter.convert(tmp_path)
        
        # Extraer contenido
        text_content = result.document.export_to_markdown()
        
        # Dividir en chunks inteligentes (por secciones)
        chunks = []
        for section in result.document.sections:
            chunks.append({
                "content": section.text,
                "metadata": {
                    "level": section.level,
                    "title": section.title
                }
            })
        
        return {
            "success": True,
            "chunks": chunks,
            "metadata": {
                "pages": len(result.document.pages),
                "title": result.document.title
            }
        }
    finally:
        # Limpiar archivo temporal
        os.unlink(tmp_path)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### Paso 3: Actualizar Next.js API Route

```typescript
// app/api/retrieval/process-docling/route.ts
import { generateLocalEmbedding } from "@/lib/generate-local-embedding"
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const DOCLING_SERVICE_URL = process.env.DOCLING_SERVICE_URL || "http://localhost:8001"

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const profile = await getServerProfile()

    const formData = await req.formData()
    const file_id = formData.get("file_id") as string

    // 1. Obtener metadata del archivo de Supabase
    const { data: fileMetadata, error: metadataError } = await supabaseAdmin
      .from("files")
      .select("*")
      .eq("id", file_id)
      .single()

    if (metadataError || !fileMetadata) {
      throw new Error("File not found")
    }

    // 2. Descargar archivo de Supabase Storage
    const { data: file, error: fileError } = await supabaseAdmin.storage
      .from("files")
      .download(fileMetadata.file_path)

    if (fileError) {
      throw new Error(`Failed to download file: ${fileError.message}`)
    }

    // 3. Enviar a Docling Service
    const doclingFormData = new FormData()
    doclingFormData.append("file", file, fileMetadata.name)

    const doclingResponse = await fetch(`${DOCLING_SERVICE_URL}/process-document`, {
      method: "POST",
      body: doclingFormData
    })

    if (!doclingResponse.ok) {
      throw new Error(`Docling service error: ${doclingResponse.statusText}`)
    }

    const { chunks, metadata } = await doclingResponse.json()

    console.log(`✅ Docling processed: ${chunks.length} chunks, ${metadata.pages} pages`)

    // 4. Generar embeddings locales
    const embeddingPromises = chunks.map(async (chunk: any) => {
      try {
        const embedding = await generateLocalEmbedding(chunk.content)
        return {
          content: chunk.content,
          embedding,
          tokens: chunk.content.split(" ").length * 1.3, // Estimación
          metadata: chunk.metadata
        }
      } catch (error) {
        console.error("Error generating embedding:", error)
        return null
      }
    })

    const chunksWithEmbeddings = (await Promise.all(embeddingPromises)).filter(Boolean)

    // 5. Guardar en Supabase
    const file_items = chunksWithEmbeddings.map((chunk: any) => ({
      file_id,
      user_id: profile.user_id,
      content: chunk.content,
      tokens: chunk.tokens,
      local_embedding: chunk.embedding,
      openai_embedding: null
    }))

    await supabaseAdmin.from("file_items").upsert(file_items)

    const totalTokens = file_items.reduce((acc: number, item: any) => acc + item.tokens, 0)

    await supabaseAdmin
      .from("files")
      .update({ tokens: totalTokens })
      .eq("id", file_id)

    return new NextResponse(JSON.stringify({ 
      success: true,
      chunks: chunks.length,
      pages: metadata.pages
    }), {
      status: 200
    })
  } catch (error: any) {
    console.error(`Error in docling process: ${error.stack}`)
    return new Response(JSON.stringify({ message: error.message }), {
      status: 500
    })
  }
}
```

---

## 🚀 Solución Inmediata: Usar Embeddings Locales (Sin Docling por ahora)

Como solución rápida, podemos **activar los embeddings locales** que ya están implementados:

1. Los embeddings locales ya funcionan con `@xenova/transformers`
2. Son **100% gratuitos**
3. Funcionan **offline**
4. Ya están probados en tu código

### Cambio Rápido:

En `app/api/retrieval/process/route.ts`, cambiar la línea 505:

```typescript
// ❌ ANTES (intentaba usar OpenRouter):
🔥 FORZANDO embeddingsProvider a 'openrouter'
Using local embeddings for document processing  // 👈 Ya lo estás usando!

// ✅ SOLUCIÓN: Simplemente remover el forzado de openrouter
// y dejar que use 'local' por defecto
```

---

## 🎯 Recomendación Final

### Para HOY (Solución Inmediata):
1. **Usar embeddings locales** (ya funcionan, sin APIs)
2. **Mantener procesadores actuales** (PDF, DOCX, TXT, etc.)
3. **Todo funciona offline y gratis** ✅

### Para PRÓXIMA FASE (Mejora con Docling):
1. **Implementar microservicio Python con Docling**
2. **Mejorar extracción de contenido**
3. **Soportar más formatos**
4. **OCR para PDFs escaneados**

¿Quieres que implemente la solución inmediata (embeddings locales) primero?

Esto te permitirá subir archivos **HOY MISMO**, y luego podemos agregar Docling cuando lo necesites.














