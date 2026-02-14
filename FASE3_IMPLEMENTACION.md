# FASE 3: FRONTEND - MÁQUINA DE ESTADOS

## Resumen

Se actualizó el frontend para usar exclusivamente el protocolo v2 de streaming, eliminando booleanos legacy y heurísticas de detección.

---

## 🎯 CAMBIOS REALIZADOS

### 1. Nuevo Hook: `useChatHandlerV2`

**Archivo:** `components/chat/chat-hooks/use-chat-handler-v2.tsx`

Reemplaza `useChatHandler` legacy:
- Usa `streamChat` helper que conecta con `/api/chat/stream`
- Maneja eventos del protocolo v2: `meta`, `status`, `delta`, `citations`, `done`, `error`, `cancelled`
- Actualiza `streamState` en cada evento
- Cancelación real con `AbortController`

```typescript
const callbacks: StreamCallbacks = {
  onMeta: (messageId, intent, renderMode) => {
    // Actualizar modo de render
  },
  onStatus: (phase, message) => {
    // Actualizar fase (classifying, searching, streaming...)
  },
  onDelta: (text) => {
    // Acumular texto en el mensaje
  },
  onCitations: (items) => {
    // Guardar citas para mostrar al final
  },
  onDone: () => { /* Completado */ },
  onError: (msg) => { /* Error */ },
  onCancelled: () => { /* Cancelado */ }
}
```

### 2. Nuevo Componente: `MessageV2`

**Archivo:** `components/messages/message-v2.tsx`

Simplificación radical:
- **NO** detecta documento por formato/markdown/longitud
- **NO** usa heurísticas
- **SOLO** usa `renderMode` del backend (evento `meta`)

```typescript
const renderMode = isLast && isStreaming 
  ? streamState.renderMode  // ← Del backend
  : detectFromContent(message.content)  // ← Solo para históricos

// Mostrar thinking durante fases activas
const showThinking = isActive && streamPhase !== "streaming"

// Mostrar texto durante streaming o completado
const showText = streamPhase === "streaming" || isCompleted

// Citas SOLO al final
const showCitations = isCompleted && citations.length > 0
```

### 3. Actualización de Componentes

| Componente | Cambio |
|------------|--------|
| `chat-messages.tsx` | Usa `MessageV2` y `useChatHandlerV2` |
| `chat-input.tsx` | Usa `streamPhase` en lugar de `isGenerating` |
| `chat-ui.tsx` | Usa `useChatHandlerV2` |

### 4. Estados UI Unificados

**Antes (booleanos sueltos):**
```typescript
isGenerating: boolean      // ¿Está generando?
firstTokenReceived: boolean // ¿Llegó primer token?
toolInUse: string          // ¿Qué tool está en uso?
```

**Ahora (máquina de estados):**
```typescript
streamPhase: "idle" | "classifying" | "searching" | "drafting" | "streaming" | "completed" | "error" | "cancelled"
streamState: {
  phase, messageId, textBuffer, 
  citations, renderMode, intent,
  statusMessage, error, startedAt, completedAt
}
```

---

## 📊 FLUJO DE DATOS

```
Usuario escribe → handleSendMessageV2
                      │
                      ▼
              streamChat helper
                      │
                      ▼
            POST /api/chat/stream
                      │
                      ▼
            Orquestador (backend)
                      │
                      ▼
            Eventos SSE reales:
            meta → status → delta... → done
                      │
                      ▼
            Callbacks actualizan:
            - streamState (para UI)
            - chatMessages (texto acumulado)
                      │
                      ▼
            MessageV2 renderiza:
            - ThinkingIndicator (fases activas)
            - AnswerView (streaming/completado)
            - CitationsPanel (solo done)
```

---

## ✅ COMPORTAMIENTO POR CASO

### Caso a) "hola" → Chat normal, sin fuentes

```
event: meta     → {intent: "chat_response", render_mode: "chat"}
event: status   → {phase: "classifying", message: "Analizando..."}
event: status   → {phase: "streaming", message: "Generando..."}
event: delta    → {text: "Hola"}
event: delta    → {text: ","}
...
event: done     → {ok: true}
```

**UI:**
1. ThinkingIndicator aparece inmediato ("Analizando...")
2. Texto aparece palabra por palabra
3. NO hay citas (no se usaron tools)

### Caso b) "¿qué es una tutela?" → Chat, fuentes al final

```
event: meta     → {intent: "chat_response", render_mode: "chat"}
event: status   → {phase: "classifying"}
event: status   → {phase: "searching", message: "Investigando normas..."}
                  ← LLM decide usar search_legal_official →
event: delta    → {text: "La tutela es..."}
...
event: citations → {items: [{title: "Corte Constitucional", url: "..."}]}
event: done      → {ok: true}
```

**UI:**
1. ThinkingIndicator (classifying → searching)
2. Texto aparece
3. **Al final**: CitationsPanel con fuentes

### Caso c) "Redacta contrato..." → Document mode

```
event: meta     → {intent: "document_write", render_mode: "document"}
event: status   → {phase: "classifying"}
event: status   → {phase: "searching"}
event: delta    → {text: "{\n  \"type\": \"draft\","}
...
event: done     → {ok: true}
```

**UI:**
1. ThinkingIndicator
2. DocumentEditor (renderiza JSON estructurado)
3. Citas al final

### Caso d) "Necesito una tutela" → Chat + pregunta

```
event: meta     → {intent: "ambiguous", render_mode: "chat"}
event: status   → {phase: "streaming"}
event: delta    → {text: "¿Te gustaría que redacte una tutela o prefieres información sobre cómo funciona?"}
event: done     → {ok: true}
```

**UI:**
1. ThinkingIndicator
2. Respuesta chat con pregunta aclaratoria
3. NO se activa modo documento

### Caso e) Cancelar a mitad

```
Usuario presiona Stop
        ↓
abortController.abort()
        ↓
event: cancelled → {reason: "User cancelled"}
```

**UI:**
1. Stream se detiene inmediatamente
2. Mensaje muestra "Cancelado por usuario"
3. NO aparecen citas inventadas

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### ThinkingIndicator

```typescript
// Aparece desde segundo 0 en fases activas
const showThinking = isActive && streamPhase !== "streaming"

// Se apaga en:
// - "streaming" (mostrando texto)
// - "completed"
// - "error"
// - "cancelled"
```

### Streaming de Texto

```typescript
// Cada delta actualiza el mensaje
onDelta: (text) => {
  setChatMessages(prev => prev.map(msg => {
    if (msg.message.id === assistantMessageId) {
      return {
        ...msg,
        message: {
          ...msg.message,
          content: msg.message.content + text  // ← Acumulación
        }
      }
    }
    return msg
  }))
}
```

### Citas Solo al Final

```typescript
// Solo cuando está completado
const showCitations = isCompleted && citations.length > 0

// NO durante streaming
// NO en error/cancelled
```

---

## 📁 ARCHIVOS MODIFICADOS/CREADOS

### Nuevos
- `components/chat/chat-hooks/use-chat-handler-v2.tsx`
- `components/messages/message-v2.tsx`

### Modificados
- `components/chat/chat-messages.tsx` → Usa V2
- `components/chat/chat-input.tsx` → Usa streamPhase
- `components/chat/chat-ui.tsx` → Usa V2

### Deprecados (para Fase 4)
- `components/chat/chat-hooks/use-chat-handler.tsx`
- `components/messages/message.tsx`

---

## 🧪 VERIFICACIÓN

### Checklist de comportamiento

- [ ] Al enviar mensaje, thinking aparece inmediato
- [ ] Primer token llega en <3s (vs 10-30s antes)
- [ ] Texto se acumula palabra por palabra (streaming real)
- [ ] Fuentes aparecen SOLO al final (no antes)
- [ ] Cancelar detiene todo inmediatamente
- [ ] Modo documento SOLO cuando se pide explícitamente
- [ ] Ambiguo → chat + pregunta (no documento)
- [ ] No hay desincronización entre estado y UI

### Logs de request_id

Cada operación loguea con `request_id`:
```
[abc-123] 🚀 Chat stream started
[abc-123] 📋 Meta: {intent: "chat_response", ...}
[abc-123] 📊 Status: classifying
[abc-123] 📊 Status: streaming
[abc-123] ✅ Chat completed: {processingTime: "3200ms", ...}
```

---

## 🚀 SIGUIENTE: FASE 4

Eliminar código muerto:
1. Eliminar archivos LangChain no usados
2. Eliminar `use-chat-handler.tsx` legacy
3. Eliminar `message.tsx` legacy
4. Consolidar utilidades duplicadas
5. Documentación final del flujo

---

*Implementación: Fase 3 Completa*
*Fecha: 2026-02-13*
