# High-Quality Ingestion Pipeline

This module implements a high-quality document ingestion pipeline for legal documents with the following features:

## Key Features

### 1. Stable IDs for Idempotency
- All IDs are deterministic (same input = same ID)
- Re-running the pipeline doesn't create duplicates
- Enables safe upserts with `ON CONFLICT DO UPDATE`

```typescript
import { stableId, contentHash } from '@/lib/ingestion'

// Generate a stable document ID
const docId = stableId(workspaceId, processId, source, contentHash(content))

// Generate a stable chunk ID
const chunkId = stableChunkId(workspaceId, processId, documentId, chunkIndex)
```

### 2. Semantic Chunking
- Respects document structure (headers, paragraphs, lists)
- Configurable chunk size and overlap
- Preserves metadata about chunk origin

```typescript
import { SemanticChunker } from '@/lib/ingestion'

const chunker = new SemanticChunker({
  chunkSize: 1000,
  chunkOverlap: 200,
  useSemanticSplitting: true
})

const result = chunker.chunkDocument(content, documentId, processId, workspaceId)
```

### 3. Mention Extraction with Offsets
- Every mention has verified character offsets
- Enables highlighting in original document
- Validates that extracted text actually exists

```typescript
import { MentionExtractor } from '@/lib/ingestion'

const extractor = new MentionExtractor()
const result = await extractor.extractMentions(
  chunkContent,
  chunkId,
  documentId,
  processId,
  workspaceId,
  runId
)
```

### 4. Entity Linking
- Groups mentions by (type, normalized name)
- Handles aliases (alternative names)
- Deduplicates entities across mentions

```typescript
import { EntityLinker } from '@/lib/ingestion'

const linker = new EntityLinker()
const result = linker.linkMentions(mentions, processId, workspaceId, runId)
```

### 5. Relation Extraction with Evidence
- **GOLDEN RULE**: No relation without evidence
- Controlled vocabulary for relation types
- Confidence thresholds for validation

```typescript
import { RelationExtractor } from '@/lib/ingestion'

const extractor = new RelationExtractor()
const result = await extractor.extractRelations(
  chunkContent,
  chunk,
  entities,
  mentions,
  mentionToEntityMap,
  processId,
  workspaceId,
  runId
)
```

### 6. Run Tracking for Auditing
- Every extraction run is logged
- Tracks model name, prompt version, timestamps
- Records counts of created/rejected items

## Controlled Vocabularies

### Entity Types
```typescript
enum EntityType {
  PERSONA_NATURAL = 'PERSONA_NATURAL',
  PERSONA_JURIDICA = 'PERSONA_JURIDICA',
  ENTIDAD_PUBLICA = 'ENTIDAD_PUBLICA',
  DESPACHO_JUDICIAL = 'DESPACHO_JUDICIAL',
  NORMA = 'NORMA',
  CONCEPTO_JURIDICO = 'CONCEPTO_JURIDICO',
  HECHO = 'HECHO',
  PRETENSION = 'PRETENSION',
  PRUEBA = 'PRUEBA',
  DOCUMENTO = 'DOCUMENTO',
  FECHA = 'FECHA',
  DINERO = 'DINERO',
  UBICACION = 'UBICACION',
  OTRO = 'OTRO'
}
```

### Relation Types
```typescript
enum RelCode {
  HECHO_AFIRMADO = 'HECHO_AFIRMADO',
  OBLIGACION = 'OBLIGACION',
  DERECHO = 'DERECHO',
  INCUMPLIMIENTO = 'INCUMPLIMIENTO',
  PRETENSION = 'PRETENSION',
  EXCEPCION = 'EXCEPCION',
  PRUEBA_SOPORTA = 'PRUEBA_SOPORTA',
  DOCUMENTO_ACREDITA = 'DOCUMENTO_ACREDITA',
  CITA_NORMA = 'CITA_NORMA',
  CITA_JURISPRUDENCIA = 'CITA_JURISPRUDENCIA',
  RELACION_GENERAL = 'RELACION_GENERAL',
  PARTE_DE = 'PARTE_DE',
  REPRESENTA = 'REPRESENTA',
  DEMANDA = 'DEMANDA',
  DEMANDADO = 'DEMANDADO',
  JUEZ = 'JUEZ',
  UBICADO_EN = 'UBICADO_EN',
  OCURRIO_EN = 'OCURRIO_EN',
  MONTO_DE = 'MONTO_DE'
}
```

## Usage

### Basic Usage
```typescript
import { ingestDocument } from '@/lib/ingestion'

const result = await ingestDocument(
  documentContent,
  {
    fileName: 'demanda.pdf',
    mimeType: 'application/pdf',
    processId: 'process-uuid',
    workspaceId: 'workspace-uuid',
    userId: 'user-uuid'
  }
)

console.log(`Created ${result.chunksCreated} chunks`)
console.log(`Extracted ${result.entitiesCreated} entities`)
console.log(`Created ${result.relationsCreated} relations`)
```

### With Configuration
```typescript
import { createPipeline } from '@/lib/ingestion'

const pipeline = createPipeline({
  skipGraph: false,
  skipExtraction: false,
  chunkingConfig: {
    chunkSize: 1500,
    chunkOverlap: 300
  }
})

const result = await pipeline.ingestDocument(content, metadata)
```

### With Callbacks
```typescript
const pipeline = createPipeline({}, {
  onPhaseStart: (phase, metadata) => {
    console.log(`Starting ${phase}...`)
  },
  onPhaseComplete: (phase, result) => {
    console.log(`Completed ${phase}:`, result)
  },
  onError: (phase, error) => {
    console.error(`Error in ${phase}:`, error)
  },
  onProgress: (phase, progress, total) => {
    console.log(`${phase}: ${progress}/${total}`)
  }
})
```

## Database Schema

The pipeline uses the following tables:

- `ingestion_documents` - Documents with stable IDs
- `ingestion_chunks` - Chunks with embeddings
- `ingestion_mentions` - Mentions with offsets
- `ingestion_entities` - Canonical entities
- `ingestion_relations` - Relations with evidence
- `extraction_runs` - Run tracking for auditing

All tables use stable IDs as primary keys and have unique constraints for idempotency.

## Comparison with Old Pipeline

| Aspect | Old Pipeline | New Pipeline |
|--------|--------------|--------------|
| IDs | Random UUIDs | Stable IDs (deterministic) |
| Chunks | Size-based split | Semantic chunking |
| Entities | One per mention | Entity linking with aliases |
| Relations | Free text | Controlled vocabulary |
| Evidence | Optional | **Mandatory** |
| Validation | None | Fail-closed with thresholds |
| Auditing | None | Run tracking |
| Multi-tenancy | Partial | Full workspace/process isolation |
| Performance | Individual writes | Batch operations |

## Migration

To migrate from the old pipeline:

1. The old `document-ingestion-service.ts` has been updated to use the new pipeline internally
2. Existing API endpoints continue to work with backward compatibility
3. New data will be stored in the new tables with stable IDs
4. Old data remains in the original tables

## Testing

```typescript
import { IngestionPipeline } from '@/lib/ingestion'

// Create a test pipeline
const pipeline = new IngestionPipeline({
  skipGraph: true, // Skip Neo4j for testing
  skipExtraction: false
})

// Test with sample content
const result = await pipeline.ingestDocument(
  'Sample legal document content...',
  {
    fileName: 'test.txt',
    mimeType: 'text/plain',
    processId: 'test-process',
    workspaceId: 'test-workspace',
    userId: 'test-user'
  }
)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Document Ingestion                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Docling  │───▶│ Chunking │───▶│Embeddings│              │
│  │  Parser  │    │ Semantic │    │ OpenAI   │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│                                        │                     │
│                                        ▼                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 Extraction Pipeline                    │   │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐          │   │
│  │  │ Mentions │──▶│ Entities │──▶│Relations │          │   │
│  │  │(offsets) │   │ (linking)│   │(evidence)│          │   │
│  │  └──────────┘   └──────────┘   └──────────┘          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                        │                     │
│                                        ▼                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Storage Layer                       │   │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐          │   │
│  │  │ Supabase │   │  Neo4j   │   │Run Track │          │   │
│  │  │ Vectors  │   │  Graph   │   │ Auditing │          │   │
│  │  └──────────┘   └──────────┘   └──────────┘          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```
