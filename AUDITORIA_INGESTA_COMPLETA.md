# 🔍 AUDITORÍA COMPLETA - PIPELINE DE INGESTA DE DOCUMENTOS

**Fecha:** 2026-02-16  
**Proyecto:** Asistente Legal Inteligente  
**Alcance:** Pipeline de ingesta (Wasabi → Docling → Vector Store → Neo4j)

---

## 📋 RESUMEN EJECUTIVO

### Estado General: ❌ NO FUNCIONAL

El pipeline de ingesta tiene **2 errores críticos** que impiden su funcionamiento:

| Componente | Estado | Problema |
|------------|--------|----------|
| Wasabi (Storage) | ✅ Funcional | - |
| Docling | ❌ ROTO | Endpoint incorrecto |
| Vector Store | ✅ Funcional | - |
| Neo4j | ❌ ROTO | Protocolo incorrecto |
| RAG Backend | ⚠️ No verificado | Dependencia de Docling |

---

## 🚨 ERRORES CRÍTICOS ENCONTRADOS

### 1. **DOCLING SERVICE - Endpoint Incorrecto**

**Archivo:** [`lib/services/docling-service.ts`](lib/services/docling-service.ts:90)

**Problema:**
```typescript
// CÓDIGO ACTUAL (INCORRECTO):
const response = await fetch(`${this.baseUrl}/parse`, {
  method: 'POST',
  body: formData
})
```

**Error en logs:**
```
❌ Error parsing document with Docling: Error: Docling API error: 404 - {"detail":"Not Found"}
```

**Causa:**
El servicio Docling Serve usa endpoints diferentes según su OpenAPI spec:
- ✅ Correcto: `POST /v1/convert/file` (para archivos)
- ❌ Incorrecto: `POST /parse` (no existe)

**Solución:**
```typescript
// CÓDIGO CORREGIDO:
const response = await fetch(`${this.baseUrl}/v1/convert/file`, {
  method: 'POST',
  body: formData
})
```

**Verificación:**
```bash
# Health check funciona:
curl http://ali-doclingserve-3291af-109-205-177-175.traefik.me/health
# Response: {"status":"ok"}

# OpenAPI spec confirma endpoints:
# /v1/convert/file - Process File (multipart/form-data)
# /v1/convert/source - Process URL (JSON)
```

---

### 2. **NEO4J SERVICE - Protocolo Incorrecto**

**Archivo:** [`lib/services/neo4j-graph-service.ts`](lib/services/neo4j-graph-service.ts:60)

**Problema:**
```typescript
// CÓDIGO ACTUAL (INCORRECTO):
const response = await fetch(`${this.uri.replace('bolt://', 'http://').replace('neo4j://', 'http://')}/db/neo4j/tx/commit`, {
```

**Error en logs:**
```
❌ Error getting process graph: TypeError: fetch failed
[cause]: SocketError: other side closed
    remoteAddress: '109.205.177.175',
    remotePort: 7687,
```

**Causa:**
1. El puerto **7687** es para el protocolo **Bolt** (binario), no HTTP
2. El intento de convertir `bolt://` a `http://` y usar fetch HTTP no funciona
3. Neo4j requiere un driver nativo o usar el puerto HTTP (7474)

**Configuración actual en `.env`:**
```env
NEO4J_URI=bolt://ali-neo4j-khji4p-5d6d2a-109-205-177-175.traefik.me:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=contrasena
```

**Soluciones:**

**Opción A: Usar driver oficial de Neo4j**
```typescript
import neo4j from 'neo4j-driver'

class Neo4jGraphService {
  private driver: any

  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
    )
  }

  private async executeQuery(query: string, params: Record<string, any> = {}): Promise<any[]> {
    const session = this.driver.session()
    try {
      const result = await session.run(query, params)
      return result.records.map(record => record.toObject())
    } finally {
      await session.close()
    }
  }
}
```

**Opción B: Usar puerto HTTP (7474)**
```env
NEO4J_HTTP_URI=http://ali-neo4j-khji4p-5d6d2a-109-205-177-175.traefik.me:7474
```

**Verificación via MCP:**
```cypher
// El servidor Neo4j SÍ funciona (verificado via MCP):
MATCH (n) RETURN labels(n) as labels, count(*) as count
// Result: Entity: 28, Episodic: 34, TipoRelacion: 11
```

---

## 📊 FLUJO DE INGESTA ANALIZADO

### Flujo Diseñado:
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Usuario   │───▶│   Wasabi    │───▶│   Docling   │───▶│   Vector    │
│  (Upload)   │    │  (Storage)  │    │  (Parsing)  │    │   Store     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                                                                ▼
                                                         ┌─────────────┐
                                                         │    Neo4j    │
                                                         │   (Graph)   │
                                                         └─────────────┘
```

### Estado de cada paso:

#### 1. Upload a Wasabi ✅
**Endpoint:** `POST /api/processes/[processId]/upload`

```typescript
// Código funcional en app/api/processes/[processId]/upload/route.ts
const { error: uploadError } = await supabaseAdmin.storage
  .from("files")
  .upload(filePath, file, { upsert: true })
```

**Verificación en logs:**
```
POST /api/processes/8a2387f6-9183-45ae-be04-8cbf1fd37b41/upload 200
```

#### 2. Ingesta ❌ (falla en Docling)
**Endpoint:** `POST /api/processes/[processId]/ingest`

```typescript
// El archivo se descarga correctamente:
const { data: fileData } = await supabaseAdmin.storage
  .from("files")
  .download(document.storage_path)
// ✅ File downloaded successfully, size: 138085 bytes

// Pero falla al parsear:
const result = await documentIngestionService.ingestDocumentFromBuffer(fileBuffer, metadata)
// ❌ Docling API error: 404 - {"detail":"Not Found"}
```

#### 3. Vector Store ✅ (configurado correctamente)
**Tablas existentes:**
- `document_chunks` - con columna `embedding` (vector)
- `graph_entities` - para respaldo de entidades
- `graph_relations` - para respaldo de relaciones

**Funciones RPC:**
- `match_documents` - búsqueda vectorial
- `match_chunks` - búsqueda vectorial

#### 4. Neo4j ❌ (conexión incorrecta)
**Datos existentes en Neo4j:**
- 28 nodos Entity
- 34 nodos Episodic
- 11 nodos TipoRelacion

El servidor funciona, pero el código no puede conectarse.

---

## 🔧 CÓDIGO NO UTILIZADO / MUERTO

### Servicios con código duplicado o no utilizado:

1. **`lib/services/rag-backend.ts`** - Servicio para backend RAG externo
   - Configurado pero no se usa en el flujo principal
   - Podría ser redundante con el pipeline interno

2. **Múltiples endpoints de chat:**
   - `/api/chat/stream` - Orquestador interno
   - `/api/rag/chat` - Proxy a backend RAG
   - `/api/rag/chat/stream` - Streaming a backend RAG
   - `/api/processes/[processId]/chat` - Chat de procesos

3. **Tablas duplicadas:**
   - `documents` + `chunks` (sin usar)
   - `document_chunks` (en uso)
   - `graph_entities` + `graph_relations` (respaldo, poco uso)

---

## 📝 RECOMENDACIONES

### Prioridad Inmediata (P0):

1. **Corregir endpoint de Docling**
   ```typescript
   // En lib/services/docling-service.ts, línea 90:
   - const response = await fetch(`${this.baseUrl}/parse`, {
   + const response = await fetch(`${this.baseUrl}/v1/convert/file`, {
   ```

2. **Corregir conexión Neo4j**
   - Instalar driver oficial: `npm install neo4j-driver`
   - O cambiar a puerto HTTP si está disponible

### Prioridad Alta (P1):

3. **Unificar endpoints de chat**
   - Definir un solo flujo de chat
   - Eliminar código duplicado

4. **Limpiar tablas no utilizadas**
   - Evaluar uso de `documents` y `chunks`
   - Consolidar en `document_chunks`

### Prioridad Media (P2):

5. **Agregar manejo de errores robusto**
   - Retry logic para Docling
   - Fallback a texto plano si Docling falla

6. **Monitoreo y logging**
   - Agregar health checks periódicos
   - Alertas cuando servicios no respondan

---

## 🧪 PLAN DE PRUEBAS

Después de aplicar las correcciones:

```bash
# 1. Verificar Docling
curl -X POST http://ali-doclingserve-3291af-109-205-177-175.traefik.me/v1/convert/file \
  -F "file=@test.pdf"

# 2. Verificar Neo4j via driver
# (probar conexión con neo4j-driver)

# 3. Probar flujo completo
# - Crear proceso
# - Subir documento
# - Verificar ingesta
# - Consultar grafo
# - Usar chat
```

---

## 📈 ARQUITECTURA ACTUAL VS ESPERADA

### Actual (Roto):
```
Upload → Wasabi ✅ → Docling ❌ → Vector ✅ → Neo4j ❌
```

### Esperada (Después de correcciones):
```
Upload → Wasabi ✅ → Docling ✅ → Vector ✅ → Neo4j ✅
                                    ↓
                              Chat Agent ✅
```

---

## ✅ CHECKLIST DE CORRECCIONES

- [ ] Cambiar endpoint Docling de `/parse` a `/v1/convert/file`
- [ ] Instalar `neo4j-driver` o configurar puerto HTTP
- [ ] Probar ingesta con documento de prueba
- [ ] Verificar visualización del grafo
- [ ] Probar chat con proceso indexado
- [ ] Limpiar código no utilizado
- [ ] Documentar flujo final

---

**Auditoría realizada por:** Kilo Code  
**Archivos revisados:** 15+  
**Líneas de código analizadas:** 2000+
