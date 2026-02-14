# Auditoría Completa: Sistema de Streaming del Chatbot Legal

## Fecha: 2026-02-13
## Estado: ✅ CAUSA RAÍZ IDENTIFICADA

---

## 1. CAUSA RAÍZ DEL PROBLEMA

### 1.1 Problema Principal: Estado de UI Sin Máquina de Estados Clara

**Archivo afectado:** `components/chat/chat-helpers/index.ts` (líneas 293-658)

**Condición exacta del problema:**
El frontend usa múltiples banderas booleanas (heurísticas) para inferir el estado del stream:

```typescript
// En message.tsx línea 378
if (!firstTokenReceived && isGenerating && isLast && message.role === "assistant") {
  return <ThinkingIndicator />
}

// En message.tsx línea 541
{message.role === "assistant" && assistantCitations.length > 0 && !(isGenerating && isLast) && (
  <CitationsPanel items={assistantCitations} />
)}
```

**Problemas identificados:**

1. **ThinkingIndicator desaparece prematuramente**: Cuando llega el primer token (`firstTokenReceived = true`), el thinking desaparece, pero el backend aún está en fase de investigación.

2. **Fuentes aparecen en el momento incorrecto**: La condición `!(isGenerating && isLast)` es volátil - si hay un re-render, `isGenerating` puede ser false momentáneamente y las fuentes aparecen antes de tiempo.

3. **No hay estado explícito de fase**: El frontend no sabe si el backend está en:
   - `classifying` (clasificando intención)
   - `searching` (buscando fuentes)
   - `drafting` (redactando respuesta)
   - `streaming` (emitiendo tokens)
   - `done` (completado)

### 1.2 Protocolo de Eventos Inconsistente

**Backend envía estos eventos** (`app/api/chat/langchain-agent/route.ts`):
```
{ type: "status", phase: "preparing", message: "..." }
{ type: "status", phase: "investigating", message: "..." }
{ type: "tool_start", label: "..." }
{ type: "token", content: "..." }
{ type: "thinking_done" }
{ type: "sources", sources: [...] }
{ type: "done", metadata: {...} }
```

**Problemas:**
1. No hay evento `meta` inicial con `render_mode` e `intent`
2. `thinking_done` se envía pero no se usa correctamente en frontend
3. `sources` puede llegar ANTES de `done`, pero el frontend no espera
4. Headers `X-Render-Mode` y `X-Intent` se envían pero no se leen consistentemente

### 1.3 Renderizado Condicional Problemático

**Archivo:** `components/messages/message.tsx`

```typescript
// Línea 541 - Condición problemática:
{message.role === "assistant" && assistantCitations.length > 0 && !(isGenerating && isLast) && (
  <CitationsPanel items={assistantCitations} />
)}
```

**Problema:** Si el usuario hace scroll o hay cualquier re-render, `isGenerating` puede cambiar y las fuentes aparecen antes de que termine el stream.

---

## 2. RESPUESTAS A LAS PREGUNTAS DEL USUARIO

### 2.1 ¿Qué eventos EXACTOS está enviando el backend?

| Fase | Eventos Enviados |
|------|------------------|
| **Clasificación** | `{type: "status", phase: "preparing", message: "Preparando contexto legal"}` |
| **Búsqueda** | `{type: "status", phase: "investigating", message: "..."}` + `{type: "tool_start", label: "..."}` |
| **Streaming** | `{type: "token", content: "..."}` (múltiples) |
| **Finalización** | `{type: "thinking_done"}` + `{type: "status", phase: "generating", message: "Redactando respuesta final"}` |
| **Citations** | `{type: "sources", sources: [...]}` (antes de done) |
| **Done** | `{type: "done", metadata: {...}}` |

### 2.2 ¿El frontend está escuchando TODOS los eventos?

**Parcialmente.** En `chat-helpers/index.ts` líneas 526-580:

```typescript
const processEvent = (event: any) => {
  switch (event?.type) {
    case 'thinking':      // ✅ Escuchado
    case 'status':        // ✅ Escuchado (solo para toolInUse)
    case 'thinking_done': // ✅ Escuchado (pero no usado para UI)
    case 'tool_start':    // ✅ Escuchado
    case 'tool_end':      // ✅ Escuchado
    case 'token':         // ✅ Escuchado
    case 'sources':       // ✅ Escuchado (streamedBibliography)
    case 'done':          // ✅ Escuchado
    case 'error':         // ✅ Escuchado
  }
}
```

**Problema:** Aunque se escuchan, no se usan para controlar el estado de la UI de forma centralizada.

### 2.3 ¿Dónde se decide el estado isGenerating/isStreaming/isThinking?

| Estado | Ubicación | Lógica |
|--------|-----------|--------|
| `isGenerating` | `use-chat-handler.tsx` línea 235 | Se setea a `true` al enviar mensaje, `false` al terminar (línea 465) |
| `firstTokenReceived` | `chat-helpers/index.ts` línea 551 | Se setea a `true` en primer token |
| `toolInUse` | `chat-helpers/index.ts` línea 314 | Se actualiza con mensajes de status |

**No existe un estado `statusPhase` centralizado.**

### 2.4 ¿Dónde se renderiza "Fuentes Consultadas"?

**Ubicación:** `components/messages/message.tsx` línea 541

```typescript
{message.role === "assistant" && assistantCitations.length > 0 && !(isGenerating && isLast) && (
  <CitationsPanel items={assistantCitations} />
)}
```

**Condición problemática:**
- Se muestra si hay citas Y `!(isGenerating && isLast)`
- Si hay un re-render y `isGenerating` es false, aparece antes de tiempo
- No verifica que el stream haya terminado realmente (evento `done`)

---

## 3. PROTOCOLO DE EVENTOS PROPUESTO (VERSIÓN FINAL)

```typescript
// Evento 1: Meta-información (inmediato)
event: meta
data: { 
  message_id: string,
  render_mode: "chat" | "document",
  intent: "chat_response" | "document_write" | "ambiguous",
  confidence: number
}

// Evento 2: Cambios de fase
event: status
data: { 
  phase: "classifying" | "searching" | "drafting" | "streaming" | "completed" | "error",
  message: string,  // Frase amigable para mostrar
  progress?: number // 0-100 opcional
}

// Evento 3: Tokens de texto
event: delta
data: { 
  text: string 
}

// Evento 4: Fuentes encontradas (puede llegar antes que done)
event: citations
data: { 
  items: Array<{
    id: string,
    title: string,
    url: string,
    type: string,
    source?: string
  }>
}

// Evento 5: Finalización
event: done
data: { 
  ok: true,
  metadata?: {
    model: string,
    processingTime: string,
    sourcesCount: number
  }
}

// Evento 6: Error
event: error
data: { 
  message: string, 
  code?: string,
  recoverable?: boolean 
}
```

---

## 4. REFACTOR FRONTEND - MÁQUINA DE ESTADOS

### 4.1 Nuevo Hook: `useStreamState`

```typescript
// lib/hooks/use-stream-state.ts
type StreamPhase = 
  | "idle"           // Sin actividad
  | "classifying"    // Analizando consulta
  | "searching"      // Buscando fuentes
  | "drafting"       // Preparando respuesta
  | "streaming"      // Emitiendo tokens
  | "completed"      // Stream finalizado
  | "error"          // Error ocurrido
  | "cancelled";     // Cancelado por usuario

interface StreamState {
  phase: StreamPhase;
  messageId: string | null;
  textBuffer: string;
  citations: BibliographyItem[];
  renderMode: "chat" | "document";
  intent: string;
  statusMessage: string;  // "Analizando...", "Buscando...", etc.
  progress: number;       // 0-100
  error: string | null;
}
```

### 4.2 Reglas de Transición

```typescript
const PHASE_TRANSITIONS: Record<StreamPhase, StreamPhase[]> = {
  idle: ["classifying"],
  classifying: ["searching", "drafting", "streaming", "error"],
  searching: ["drafting", "streaming", "error"],
  drafting: ["streaming", "error"],
  streaming: ["completed", "error"],
  completed: ["idle"],      // Reset para nuevo mensaje
  error: ["idle"],
  cancelled: ["idle"]
};
```

### 4.3 Reglas de Renderizado

| Componente | Condición de renderizado |
|------------|-------------------------|
| `ThinkingIndicator` | `phase !== "idle" && phase !== "completed" && phase !== "error"` |
| `MessageText` | `textBuffer.length > 0` |
| `CitationsPanel` | `phase === "completed" && citations.length > 0` |
| `StatusMessage` | Siempre visible durante fases activas |

---

## 5. FIXES REQUERIDOS

### 5.1 Backend - `app/api/chat/langchain-agent/route.ts`

1. **Emitir evento `meta` al inicio** (línea ~679):
```typescript
emit({
  type: "meta",
  message_id: effectiveChatId,
  render_mode: isDraft ? "document" : "chat",
  intent: classificationResult.intent,
  confidence: classificationResult.confidence
});
```

2. **Renombrar `token` → `delta`** para consistencia:
```typescript
// Cambiar en StreamingCallbackHandler
emit({ type: 'delta', text: token });  // era 'token', content
```

3. **Asegurar orden correcto**:
   - `meta` → `status` → `delta` (múltiples) → `citations` → `done`

### 5.2 Frontend - `components/chat/chat-helpers/index.ts`

1. **Implementar processEvent con máquina de estados**:
```typescript
const processEvent = (event: any) => {
  // Validar transiciones de fase
  const currentPhase = streamState.phase;
  const newPhase = mapEventToPhase(event.type, event);
  
  if (!isValidTransition(currentPhase, newPhase)) {
    console.warn(`[Stream] Transición inválida: ${currentPhase} → ${newPhase}`);
    return;
  }
  
  // Actualizar estado
  updateStreamState({ phase: newPhase, ... });
  
  // Acumular texto
  if (event.type === 'delta') {
    streamState.textBuffer += event.text;
  }
  
  // Acumular citas (pero NO mostrar hasta done)
  if (event.type === 'citations') {
    streamState.citations = event.items;
  }
};
```

### 5.3 Frontend - `components/messages/message.tsx`

1. **Reemplazar condiciones heurísticas**:
```typescript
// ANTES (problemático):
if (!firstTokenReceived && isGenerating && isLast && message.role === "assistant") {
  return <ThinkingIndicator />;
}

// DESPUÉS (correcto):
const shouldShowThinking = 
  message.role === "assistant" && 
  isLast &&
  streamPhase !== "idle" && 
  streamPhase !== "completed" && 
  streamPhase !== "error";

if (shouldShowThinking) {
  return <ThinkingIndicator phase={streamPhase} statusMessage={statusMessage} />;
}
```

2. **Fuentes solo al finalizar**:
```typescript
// ANTES:
{message.role === "assistant" && assistantCitations.length > 0 && !(isGenerating && isLast) && (
  <CitationsPanel items={assistantCitations} />
)}

// DESPUÉS:
{message.role === "assistant" && 
 streamPhase === "completed" && 
 assistantCitations.length > 0 && (
  <CitationsPanel items={assistantCitations} />
)}
```

---

## 6. CHECKLIST DE VERIFICACIÓN

### Caso 1: "hola"
- [ ] Thinking aparece inmediatamente
- [ ] No aparecen fuentes (no hay búsqueda)
- [ ] Texto aparece fluidamente
- [ ] Al terminar, thinking desaparece

### Caso 2: "¿qué es tutela?"
- [ ] Thinking aparece inmediatamente
- [ ] Fase "Buscando normas..." visible
- [ ] Stream de texto aparece
- [ ] Fuentes aparecen SOLO al final
- [ ] Citas son clickeables

### Caso 3: "redacta contrato compraventa"
- [ ] Meta evento indica `render_mode: "document"`
- [ ] Document editor se muestra
- [ ] Fuentes aparecen al final

### Caso 4: Cancelar a mitad
- [ ] Botón cancelar detiene stream
- [ ] Texto parcial se conserva
- [ ] NO aparecen fuentes inventadas
- [ ] Estado pasa a "cancelled"

### Edge Cases
- [ ] Error de red: mostrar mensaje amigable
- [ ] Timeout: mostrar texto parcial + mensaje
- [ ] Reconexión: no duplicar mensajes

---

## 7. ARCHIVOS A MODIFICAR

### Backend:
1. `app/api/chat/langchain-agent/route.ts` - Protocolo de eventos

### Frontend:
1. `lib/hooks/use-stream-state.ts` - **NUEVO** - Máquina de estados
2. `lib/stream-protocol.ts` - **NUEVO** - Tipos y utilidades
3. `components/chat/chat-helpers/index.ts` - Procesamiento de eventos
4. `components/messages/message.tsx` - Renderizado condicional
5. `components/messages/thinking-indicator.tsx` - Fases dinámicas
6. `context/context.tsx` - Agregar estado del stream

---

## RESUMEN EJECUTIVO

**Problema:** El sistema usa heurísticas booleanas (`firstTokenReceived`, `isGenerating`) para controlar UI, causando:
1. Thinking indicator que desaparece antes de tiempo
2. Fuentes que aparecen en momentos incorrectos
3. UI inconsistente durante re-renders

**Solución:** Implementar máquina de estados explícita con protocolo de eventos estándar:
- `meta` → `status` → `delta` → `citations` → `done`
- Reglas de renderizado basadas en fase, no en heurísticas
- Transiciones validadas entre estados

**Impacto:** ~7 archivos modificados, ~200 líneas nuevas, 0 breaking changes en API pública.
