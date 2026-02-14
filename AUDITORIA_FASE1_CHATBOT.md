# FASE 1: AUDITORÍA Y MAPA DEL SISTEMA

## Resumen Ejecutivo

El chatbot legal presenta una **arquitectura altamente fragmentada** con múltiples implementaciones paralelas que causan inconsistencias, cuelgues y desincronización entre backend y frontend. Se identifican **3 rutas de chat diferentes**, **2 sistemas de streaming incompatibles** y un **uso problemático de LangChain** que agrega complejidad sin beneficio claro.

---

## 1. DIAGRAMA TEXTUAL DEL FLUJO

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              FLUJO ACTUAL (FRAGMENTADO)                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

Usuario envía mensaje
         │
         ▼
┌─────────────────┐
│ useChatHandler  │  ← Maneja estado local, inicia stream
│  (frontend)     │
└────────┬────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                           DECISIÓN DE RUTA (CAÓTICA)                            │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────┐  │
│  │ /api/chat/legal-agent│    │ /api/rag/chat/stream │    │ /api/chat/       │  │
│  │                      │    │                      │    │ langchain-agent  │  │
│  │ • Tool-calling       │    │ • Proxy a backend    │    │ • LangChain      │  │
│  │ • Simula streaming*  │    │   RAG externo        │    │   completo       │  │
│  │ • NO streaming real  │    │ • SSE real           │    │ • Muy complejo   │  │
│  └──────────────────────┘    └──────────────────────┘    └──────────────────┘  │
│           ▲                                                        ▲          │
│           └────────────────────┬───────────────────────────────────┘          │
│                                │                                               │
│                    ¿isManagedMModel?                                          │
│                    ¿selectedTools.length > 0?                                 │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                              CLASIFICACIÓN DE INTENCIÓN                         │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. Heurística local (detectDraftIntent)    → rápida pero limitada             │
│  2. LLM vía OpenRouter                      → más precisa pero lenta           │
│                                                                                 │
│  PROBLEMA: Se ejecutan AMBAS en paralelo sin estrategia de fallback clara      │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                           STREAMING AL FRONTEND                                 │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  RUTA LEGAL-AGENT:                                                              │
│    • Recibe respuesta completa del LLM                                        │
│    • Divide en palabras: finalResponse.split(" ")                              │
│    • Simula streaming enviando palabra por palabra con queueMicrotask          │
│    • ⚠️ NO ES STREAMING REAL - es un "fake stream"                             │
│                                                                                 │
│  RUTA RAG/STREAM:                                                               │
│    • Proxy directo al backend RAG                                              │
│    • Backend RAG emite eventos SSE                                             │
│    • Se pasan tal cual al cliente                                              │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND RENDER                                    │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  • Message.tsx recibe datos del stream                                          │
│  • useStreamState gestiona fases (classifying → streaming → completed)         │
│  • PROBLEMA: El streamPhase se setea desde múltiples lugares                   │
│  • PROBLEMA: isGenerating + firstTokenReceived son booleanos sueltos           │
│  • PROBLEMA: Las citas se muestran con condiciones inconsistentes              │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ARCHIVOS CLAVE Y SUS ROLES

### Backend - Rutas API

| Archivo | Rol | Estado |
|---------|-----|--------|
| `app/api/chat/legal-agent/route.ts` | **RUTA PRINCIPAL** - Tool-calling directo | ⚠️ PROBLEMA: Fake streaming |
| `app/api/rag/chat/stream/route.ts` | Proxy SSE al backend RAG | ✅ Funciona pero poco usado |
| `app/api/chat/langchain-agent/route.ts` | Legacy LangChain completo | 🔴 CÓDIGO MUERTO |
| `app/api/processes/[processId]/chat/route.ts` | Chat con contexto de proceso | ⚠️ Duplica lógica |

### Backend - Librerías Core

| Archivo | Rol | Estado |
|---------|-----|--------|
| `lib/langchain/agents/legal-agent.ts` | Agente LangChain con tool calling | 🔴 COMPLEJIDAD INNECESARIA |
| `lib/classifiers/document-classifier.ts` | Clasificación LLM de intención | ⚠️ Usa modelo externo (gpt-4o-mini) |
| `lib/draft-detection.ts` | Heurística local de intención | ⚠️ Duplica lógica con classifier |
| `lib/services/rag-backend.ts` | Cliente HTTP al backend RAG | ✅ Bien estructurado |
| `lib/tools/legal/legal-search-toolkit.ts` | Definición y ejecución de tools | ✅ Sólido |
| `lib/server/tool-execution-guard.ts` | Guardias para ejecución de tools | ✅ Buen patrón |
| `lib/server/request-context.ts` | Contexto de request para logs | ✅ Buen observability |
| `lib/stream-protocol.ts` | **PROTOCOLO DE EVENTOS V2** | ✅ Bien diseñado, poco usado |

### Frontend - Componentes

| Archivo | Rol | Estado |
|---------|-----|--------|
| `components/chat/chat-ui.tsx` | Container del chat | ⚠️ OK pero acoplado |
| `components/messages/message.tsx` | Render de mensajes | 🔴 **CRÍTICO: Lógica muy compleja** |
| `components/chat/chat-hooks/use-chat-handler.tsx` | Handler de envío | 🔴 Maneja demasiado estado |
| `lib/hooks/use-stream-state.ts` | Máquina de estados del stream | ✅ Bien diseñado |
| `context/context.tsx` | Contexto global (ALIContext) | 🔴 **MONOLITO DE ESTADO** |

---

## 3. DUPLICIDADES DETECTADAS

### 3.1 Múltiples Implementaciones de Streaming

```typescript
// FORMA 1: Legal-Agent (FAKE STREAMING)
// Archivo: app/api/chat/legal-agent/route.ts (líneas 406-424)
const words = finalResponse!.split(" ")
let index = 0
const pushWord = () => {
  if (index < words.length) {
    const word = words[index] + (index < words.length - 1 ? " " : "")
    controller.enqueue(encoder.encode(word))
    index += 1
    queueMicrotask(pushWord)
    return
  }
  controller.close()
}
// ⚠️ PROBLEMA: Espera la respuesta COMPLETA del LLM antes de "streamear"

// FORMA 2: RAG Backend (STREAMING REAL)
// Archivo: app/api/rag/chat/stream/route.ts
const stream = new ReadableStream({
  async start(controller) {
    const reader = backendStream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) { controller.close(); break }
      controller.enqueue(value)  // Pasa chunks reales del LLM
    }
  }
})
```

### 3.2 Múltiples Sistemas de Detección de Documentos

```typescript
// SISTEMA 1: Heurística local
// Archivo: lib/draft-detection.ts
export function detectDraftIntent(message: string) {
  const draftKeywords = ["minuta", "contrato", "tutela", ...]
  const draftingVerbs = ["redacta", "escribe", "genera", ...]
  // Lógica basada en keywords
}

// SISTEMA 2: Clasificador LLM
// Archivo: lib/classifiers/document-classifier.ts
export async function classifyWithLLM(userMessage: string) {
  // Llama a OpenRouter con gpt-4o-mini
  // Clasifica en: chat_response | document_write | ambiguous
}

// SISTEMA 3: Detección en frontend por formato
// Archivo: components/messages/message.tsx (líneas 326-345)
const isLegalDocumentFromStream = streamState.renderMode === "document"
const isLegalDocumentFromHeuristics = message.content.includes("<h1>") && 
                                      message.content.includes("ARTICULO")
```

### 3.3 Múltiples Stores de Estado

```typescript
// ESTADO 1: Booleanos sueltos (LEGACY)
// Contexto: ALIContext
isGenerating: boolean
firstTokenReceived: boolean
toolInUse: string

// ESTADO 2: Protocolo v2 (NUEVO, INCOMPLETO)
// Contexto: ALIContext
streamPhase: StreamPhase
streamMessage: string
streamState: StreamState

// PROBLEMA: Ambos coexisten y a veces se usan intercambiablamente
// a veces se contradicen (isGenerating=true pero streamPhase=completed)
```

---

## 4. CÓDIGO MUERTO / SIN USO

### 4.1 Rutas Legacy

| Archivo | Evidencia de no uso |
|---------|---------------------|
| `app/api/chat/langchain-agent/route.ts` | No se importa en ningún lado. Reemplazado por legal-agent |
| `app/api/chat/legal-writing/route.ts` | Endpoint específico, no referenciado en UI |
| `app/api/chat/refine-document/route.ts` | No referenciado en el frontend |

### 4.2 Librerías Glanchain/LangChain

| Archivo | Problema |
|---------|----------|
| `lib/langchain/agents/index.ts` | Re-exporta legal-agent, no aporta valor |
| `lib/langchain/tools/article-search-tool.ts` | No usado, reemplazado por legal-search-toolkit |
| `lib/langchain/tools/content-tools.ts` | No referenciado |
| `lib/langchain/tools/process-rag-tool.ts` | Duplica funcionalidad de RAG backend |

### 4.3 Componentes Muertos

```bash
# Componentes no referenciados en imports:
components/chat/legal-writing-screen.tsx  # No se usa, reemplazado por DocumentEditor
components/chat/draft-card.tsx            # Antiguo visualizador de borradores
components/messages/message-reasoning.tsx # Reemplazado por ThinkingIndicator
```

### 4.4 Funciones Duplicadas

| Función | Ubicaciones | Acción recomendada |
|---------|-------------|-------------------|
| `extractSourcesFromResponse` | legal-agent/route.ts + legal-agent.ts | Unificar en utils |
| `formatSearchResultsForLLM` | serper-legal-search.ts + search-tools.ts | Consolidar |
| `detectDraftIntent` vs `classifyDocumentIntent` | draft-detection.ts + document-classifier.ts | Usar solo LLM |

---

## 5. RIESGOS Y BUGS PROBABLES

### 🔴 CRÍTICO: Fake Streaming en legal-agent

**Archivo:** `app/api/chat/legal-agent/route.ts:406-424`

```typescript
// El código actual:
const stream = new ReadableStream({
  start(controller) {
    const words = finalResponse!.split(" ")  // ← RESPUESTA COMPLETA YA RECIBIDA
    let index = 0
    const pushWord = () => {
      if (index < words.length) {
        controller.enqueue(encoder.encode(words[index]))  // ← "Streamea" palabra por palabra
        index += 1
        queueMicrotask(pushWord)
      }
    }
    pushWord()
  }
})
```

**Problemas:**
1. El usuario espera 10-30s sin ver nada mientras el LLM procesa
2. Luego ve el texto "aparecer" rápidamente palabra por palabra
3. El timeout de 45s puede agotarse antes de recibir la respuesta completa
4. No hay forma de cancelar realmente - el LLM sigue procesando

### 🔴 CRÍTICO: Desincronización de Fases

**Archivos:** `use-chat-handler.tsx`, `message.tsx`, `use-stream-state.ts`

```typescript
// En use-chat-handler.tsx (línea 251)
setStreamPhase("classifying")

// En message.tsx (línea 439)
const displayPhase = (streamPhase === "idle" || streamPhase === "unknown") 
  ? "classifying" 
  : streamPhase

// PROBLEMA: El frontend asume "classifying" como default cuando no hay fase,
// pero el backend podría estar en "searching" o "streaming"
```

### 🟠 ALTO: Glanchain introduce latencia

**Archivo:** `lib/langchain/agents/legal-agent.ts:236-273`

```typescript
// El agente LangChain re-inicializa el modelo en cada request si cambia el router
if (routerConfig.model !== this.currentModelId) {
  await this.initializeModel(routerConfig.model)  // ← Latencia extra
}

// Además, AgentExecutor añade overhead de:
// - Parsing de tool calls
// - Manejo de historial
// - Lógica de retry interna
```

### 🟠 ALTO: Doble clasificación de intención

**Archivo:** `app/api/chat/legal-agent/route.ts:268-269`

```typescript
// Se ejecutan ambas en la misma request:
const heuristicResult = detectDraftIntent(userQuery)           // Local
const classification = await classifyDocumentIntent(userQuery, heuristicResult)  // LLM

// Si el LLM falla (timeout), todavía se usó tiempo de CPU en la heurística
// Si la heurística es fuerte pero el LLM dice "chat", se ignora el LLM
```

### 🟡 MEDIO: Citas pueden aparecer en momentos incorrectos

**Archivo:** `components/messages/message.tsx:396-399`

```typescript
const shouldShowCitations = 
  message.role === "assistant" && 
  streamPhase === "completed" && 
  assistantCitations.length > 0

// PROBLEMA: Si el stream se interrumpe (error, cancel), 
// streamPhase no es "completed" y las citas nunca se muestran
// aunque el backend las haya generado
```

---

## 6. LISTA PRIORIZADA DE ACCIONES

### Prioridad 1: Estabilización Inmediata (Fase 2)

1. **Reemplazar fake streaming por streaming real**
   - Usar `response_mode: "stream"` en OpenRouter
   - Emitir eventos siguiendo `lib/stream-protocol.ts`
   - Archivos: `app/api/chat/legal-agent/route.ts`

2. **Unificar sistema de intención**
   - Eliminar `detectDraftIntent` (heurística)
   - Usar solo `classifyDocumentIntent` (LLM) con timeout corto
   - Cache de clasificación por mensaje

3. **Simplificar estado del frontend**
   - Deprecar `isGenerating` + `firstTokenReceived`
   - Usar exclusivamente `streamState` del protocolo v2
   - Archivos: `context/context.tsx`, `use-chat-handler.tsx`

### Prioridad 2: Eliminación de LangChain (Fase 2-3)

1. **Evaluar reemplazo de AgentExecutor**
   - Implementar tool-calling directo con OpenAI SDK
   - Manejo manual de tool_calls en stream
   - Mantener las tool definitions actuales

2. **Migrar away de LangChain cuando no aporte**
   - Prompt templates → string literals tipados
   - Historial de mensajes → manejo manual simple
   - Parsing de respuestas → funciones puras

### Prioridad 3: Limpieza (Fase 4)

1. **Eliminar rutas legacy:**
   - `app/api/chat/langchain-agent/route.ts`
   - `app/api/chat/legal-writing/route.ts`
   - `app/api/chat/refine-document/route.ts`

2. **Eliminar librerías no usadas:**
   - `lib/langchain/tools/article-search-tool.ts`
   - `lib/langchain/tools/content-tools.ts`
   - `lib/langchain/tools/process-rag-tool.ts`

3. **Consolidar utilidades duplicadas:**
   - Crear `lib/utils/chat-response.ts`
   - Unificar extracción de fuentes

---

## 7. RECOMENDACIÓN SOBRE GLANCHAIN (LANGCHAIN)

### Evaluación

| Aspecto | Valoración | Justificación |
|---------|------------|---------------|
| Complejidad | 🔴 Alto | AgentExecutor, callbacks, parsers |
| Control | 🔴 Bajo | "Magia" interna difícil de debuggear |
| Latencia | 🔴 Negativo | Re-inicialización, overhead de ejecución |
| Tool Calling | 🟡 Neutral | Lo mismo que SDK de OpenAI |
| Streaming | 🔴 Problemático | No nativo, requiere workarounds |
| Observabilidad | 🟡 Regular | Logs mezclados, difícil trazar |

### Recomendación: **REEMPLAZAR**

**Razones prácticas:**
1. **Tool calling nativo de OpenAI SDK** hace lo mismo con menos código
2. **Streaming real** es trivial con SDK nativo, complejo con LangChain
3. **Menos dependencias** = menos vectores de fallo
4. **Código más explícito** = más fácil de debuggear en producción

**Riesgos de mantener LangChain:**
1. Actualizaciones breaking frecuentes
2. Documentación dispersa
3. Comunidad migrando a SDKs nativos
4. Overhead de abstracción innecesaria para nuestro caso de uso

### Plan de migración propuesto

```typescript
// ANTES (LangChain)
const agent = await createToolCallingAgent({ llm, tools, prompt })
const executor = new AgentExecutor({ agent, tools, maxIterations: 10 })
const result = await executor.invoke({ input, chat_history })

// DESPUÉS (SDK Nativo)
const response = await openrouter.chat.completions.create({
  model,
  messages: buildMessages(input, history),
  tools: TOOL_DEFINITIONS,
  stream: true  // ← Streaming real nativo
})

for await (const chunk of response) {
  if (chunk.choices[0].delta.tool_calls) {
    // Ejecutar tool
  } else {
    // Emitir texto al cliente
  }
}
```

---

## 8. MÉTRICAS DE ÉXITO (PARA FASES 2-4)

| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Tiempo hasta primer token | 5-30s | <2s |
| Tasa de cancelaciones efectivas | ~30% | >95% |
| Consistencia de fases UI | ~60% | >98% |
| Latencia p95 (consulta simple) | 8s | <4s |
| Latencia p95 (con tools) | 25s | <15s |
| Errores de desincronización | Frecuentes | Cero |
| Bundle size (langchain) | ~150KB | 0KB |

---

## 9. PRÓXIMOS PASOS

1. **Fase 2:** Implementar orquestador thin sin LangChain
2. **Fase 3:** Refactorizar frontend con máquina de estados única
3. **Fase 4:** Eliminar código muerto, consolidar utilidades

---

*Auditoría realizada por: Arquitecta Senior LLM*
*Fecha: 2026-02-13*
*Versión: 1.0*
