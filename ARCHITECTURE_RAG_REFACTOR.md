# Arquitectura RAG Refactorizada

## Resumen

Se ha refactorizado el sistema de base de conocimiento para usar:
- **Supabase Vector Store** para embeddings y búsqueda vectorial
- **Neo4j** como grafo de conocimiento
- **Wasabi (S3)** para almacenamiento de objetos

## Arquitectura Anterior vs Nueva

### Anterior (Problema)
```
Documento → Backend RAG Externo → Neo4j (sin process_id)
                                    ↓
                              Sin vinculación a procesos
```

### Nueva (Solución)
```
                    ┌─────────────────────────────────────┐
                    │         Wasabi (S3 Storage)         │
                    │    Almacenamiento de objetos        │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Document Ingestion Service                      │
│  - Chunking de documentos                                        │
│  - Extracción de entidades con LLM                              │
│  - Coordinación de almacenamiento                               │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   Supabase Vector Store │     │    Neo4j Knowledge Graph │
│   - Embeddings (1536d)  │     │    - Entidades          │
│   - Búsqueda vectorial  │     │    - Relaciones         │
│   - Chunks de documento │     │    - Documents nodes    │
│   - process_id ✓        │     │    - process_id ✓       │
└─────────────────────────┘     └─────────────────────────┘
```

## Componentes Creados

### 1. Tablas en Supabase

#### `document_chunks`
```sql
- id: UUID (PK)
- process_id: UUID (vinculado al proceso)
- document_id: UUID
- workspace_id: UUID
- user_id: UUID
- content: TEXT
- chunk_index: INTEGER
- embedding: vector(1536)
- metadata: JSONB
- created_at, updated_at: TIMESTAMPTZ
```

#### `graph_entities`
```sql
- id: UUID (PK)
- process_id: UUID
- name: TEXT
- entity_type: TEXT
- summary: TEXT
- neo4j_id: TEXT (sincronización)
- metadata: JSONB
```

#### `graph_relations`
```sql
- id: UUID (PK)
- process_id: UUID
- source_entity_id: UUID
- target_entity_id: UUID
- relation_type: TEXT
- neo4j_id: TEXT
```

### 2. Servicios

#### [`lib/services/supabase-vector-store.ts`](lib/services/supabase-vector-store.ts)
- Generación de embeddings con OpenAI
- Inserción de chunks con embeddings
- Búsqueda de similitud vectorial
- Gestión de entidades y relaciones

#### [`lib/services/neo4j-graph-service.ts`](lib/services/neo4j-graph-service.ts)
- Creación de entidades con process_id
- Creación de relaciones
- Obtención del grafo por proceso
- Estadísticas del grafo

#### [`lib/services/document-ingestion-service.ts`](lib/services/document-ingestion-service.ts)
- Coordinación de ingestión
- Chunking de documentos
- Extracción de entidades con LLM
- Sincronización Supabase + Neo4j

### 3. Endpoints API

#### `POST /api/processes/[processId]/ingest`
Ingiere documentos en el proceso:
- Descarga archivo de Wasabi
- Procesa y divide en chunks
- Genera embeddings
- Extrae entidades
- Almacena en Supabase Vector + Neo4j

#### `GET /api/processes/[processId]/graph`
Obtiene el grafo de conocimiento:
- Consulta Neo4j por process_id
- Fallback a Supabase si Neo4j no está disponible
- Retorna nodos y aristas para visualización

#### `POST /api/processes/[processId]/search`
Búsqueda vectorial:
- Búsqueda por similitud semántica
- Filtrado por process_id
- Retorna chunks relevantes

## Configuración Requerida

### Variables de Entorno
```env
# Supabase (ya configurado)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=...

# OpenAI (para embeddings y extracción)
OPENAI_API_KEY=sk-...

# Wasabi (S3-compatible storage)
WASABI_ACCESS_KEY=...
WASABI_SECRET_KEY=...
WASABI_BUCKET=...
WASABI_REGION=...
```

### Extensión Vector en Supabase
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Flujo de Datos

### Ingestión de Documento
1. Usuario sube documento → Wasabi Storage
2. Se llama a `/api/processes/[processId]/ingest`
3. Se descarga el archivo de Wasabi
4. Se divide en chunks (650 tokens, 100 overlap)
5. Se generan embeddings con OpenAI text-embedding-3-small
6. Se almacenan chunks en Supabase con process_id
7. Se extraen entidades con GPT-4o-mini
8. Se crean nodos en Neo4j con process_id
9. Se actualiza estado del documento a "indexed"

### Búsqueda
1. Usuario hace pregunta en el chat
2. Se genera embedding de la consulta
3. Se busca en Supabase Vector por similitud
4. Se filtra por process_id
5. Se retornan chunks relevantes

### Visualización del Grafo
1. Usuario abre vista de grafo
2. Se consulta Neo4j por process_id
3. Se transforman nodos y relaciones
4. Se renderiza con react-force-graph-2d

## Migración de Datos Existentes

Para migrar los datos existentes en Neo4j:

```cypher
// Asignar process_id a nodos existentes (si se conoce el mapeo)
MATCH (e:Entity)
WHERE e.group_id = 'c8dea7c3-f7a8-4bd6-ae9b-3200e4bdd3e7'
SET e.process_id = 'UUID_DEL_PROCESO'

// Crear índice para búsquedas por process_id
CREATE INDEX entity_process_id_idx FOR (e:Entity) ON (e.process_id)
CREATE INDEX document_process_id_idx FOR (d:Document) ON (d.process_id)
```

## Beneficios

1. **Vinculación correcta**: Cada documento/chunk/entidad tiene process_id
2. **Búsqueda eficiente**: Índice HNSW para similitud vectorial
3. **Grafo consultable**: Neo4j con process_id permite filtrar por proceso
4. **Fallback**: Si Neo4j falla, Supabase tiene respaldo de entidades
5. **Escalabilidad**: Supabase maneja vector store, Neo4j el grafo

## Próximos Pasos

1. Probar ingestión con documento real
2. Verificar visualización del grafo
3. Implementar chat con RAG usando búsqueda vectorial
4. Migrar datos existentes de Neo4j
