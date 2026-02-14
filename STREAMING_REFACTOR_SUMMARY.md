# Resumen del Refactor de Streaming

## Fecha: 2026-02-13
## Versión: 2.0.0

---

## 📋 CAMBIOS REALIZADOS

### 1. Nuevos Archivos Creados

#### `lib/stream-protocol.ts`
- Define el protocolo de eventos estándar para streaming
- Tipos: `meta`, `status`, `delta`, `citations`, `done`, `error`, `cancelled`
- Fases: `idle` → `classifying` → `searching` → `drafting` → `streaming` → `completed`
- Máquina de estados con transiciones validadas
- Funciones helper para parseo y logging

#### `lib/hooks/use-stream-state.ts`
- Hook React con reducer para gestionar estado del stream
- Acciones: `START_STREAM`, `PROCESS_EVENT`, `TRANSITION_PHASE`, etc.
- Valores computados: `isActive`, `isCompleted`, `shouldShowThinking`, `shouldShowCitations`

### 2. Backend Modificado

#### `app/api/chat/langchain-agent/route.ts`
- **Evento `meta`**: Emitido al inicio con `message_id`, `render_mode`, `intent`, `confidence`
- **Fases actualizadas**: 
  - `classifying` (antes: preparing)
  - `searching` (antes: investigating)
  - `drafting` (antes: generating)
  - `streaming` (durante tokens)
- **Evento `delta`**: Reemplaza `token` (renombrado de `content` a `text`)
- **Evento `citations`**: Reemplaza `sources` (renombrado de `sources` a `items`)
- **Evento `done`**: Ahora incluye `ok: true` y metadata

### 3. Frontend Modificado

#### `context/context.tsx`
- Agregados tipos para `StreamState`
- Nuevas propiedades: `streamState`, `setStreamState`, `streamPhase`, `setStreamPhase`, `streamMessage`, `setStreamMessage`

#### `components/utility/global-state.tsx`
- Estados del stream inicializados
- Provider actualizado con valores por defecto

#### `components/chat/chat-helpers/index.ts`
- Interface `StreamHandlers` para callbacks
- `processProtocolEvent()`: Procesa eventos del nuevo protocolo
- Fallback a protocolo legacy para compatibilidad
- `handleHostedChat()` acepta `streamHandlers` opcional

#### `components/chat/chat-hooks/use-chat-handler.tsx`
- Importa `setStreamPhase`, `setStreamMessage`, `setStreamState`
- Inicializa estado del stream al enviar mensaje
- Handlers `onPhaseChange`, `onComplete`, `onError`
- `handleStopMessage()` actualiza estado a `cancelled`

#### `components/messages/message.tsx`
- Usa `streamPhase` y `streamMessage` del contexto
- `shouldShowThinking`: Basado en fase, no en `firstTokenReceived`
- `shouldShowCitations`: Solo cuando `streamPhase === "completed"`
- Citas ya no dependen de `!(isGenerating && isLast)`

#### `components/messages/thinking-indicator.tsx`
- Props `phase` y `statusMessage` opcionales
- Frases rotativas según la fase actual
- Mensaje personalizado si se proporciona

---

## 🔄 FLUJO DE EVENTOS (NUEVO)

```
Usuario envía mensaje
        ↓
[Frontend] Inicializa streamState (fase: "classifying")
        ↓
[Backend] POST /api/chat/langchain-agent
        ↓
[Backend] Emit: {type: "meta", render_mode: "chat", intent: "..."}
        ↓
[Backend] Emit: {type: "status", phase: "classifying", message: "..."}
        ↓
[Backend] Emit: {type: "status", phase: "searching", message: "..."}
        ↓
[Backend] Emit: {type: "status", phase: "drafting", message: "..."}
        ↓
[Backend] Emit: {type: "delta", text: "..."} (múltiples)
        ↓
[Backend] Emit: {type: "citations", items: [...]}
        ↓
[Backend] Emit: {type: "done", ok: true}
        ↓
[Frontend] Actualiza: streamPhase = "completed"
        ↓
[Frontend] Muestra: Fuentes Consultadas (solo ahora)
```

---

## ✅ PROBLEMAS RESUELTOS

| Problema | Antes | Después |
|----------|-------|---------|
| **Thinking desaparece** | Se ocultaba en primer token | Visible durante toda la fase activa |
| **Fuentes aparecen tarde/pronto** | Condición `!(isGenerating && isLast)` | Solo cuando `streamPhase === "completed"` |
| **No hay estado explícito** | Heurísticas booleanas | Máquina de estados con fases |
| **Re-renders causaban UI inconsistente** | Estados volátiles | Estado centralizado en reducer |
| **Mensajes de status genéricos** | Frases fijas | Frases según fase + mensaje personalizado |
| **Cancelación no reflejada** | Estado inconsistente | Fase `cancelled` con mensaje |

---

## 🧪 CASOS DE PRUEBA

### Caso 1: Mensaje simple "hola"
```
Expected:
1. Thinking aparece inmediatamente (fase: classifying)
2. Cambia a fase searching (si aplica)
3. Stream de texto aparece (fase: streaming)
4. Al terminar, thinking desaparece
5. No aparecen fuentes (no hubo búsqueda)
```

### Caso 2: Consulta legal "¿qué es tutela?"
```
Expected:
1. Thinking aparece (fase: classifying)
2. Cambia a "Investigando normas…" (fase: searching)
3. Stream de texto aparece (fase: streaming)
4. Evento citations llega (pero NO se muestra)
5. Evento done llega → fase: completed
6. Fuentes aparecen SOLO ahora
```

### Caso 3: Redacción de documento
```
Expected:
1. Meta indica render_mode: "document"
2. Fases igual que consulta legal
3. Document editor se renderiza
4. Fuentes al final
```

### Caso 4: Cancelar a mitad
```
Expected:
1. Usuario presiona Stop
2. AbortController cancela fetch
3. streamPhase = "cancelled"
4. Texto parcial se conserva
5. NO aparecen fuentes inventadas
```

---

## 📁 ARCHIVOS MODIFICADOS

### Nuevos (2):
- `lib/stream-protocol.ts`
- `lib/hooks/use-stream-state.ts`

### Modificados (7):
- `app/api/chat/langchain-agent/route.ts`
- `context/context.tsx`
- `components/utility/global-state.tsx`
- `components/chat/chat-helpers/index.ts`
- `components/chat/chat-hooks/use-chat-handler.tsx`
- `components/messages/message.tsx`
- `components/messages/thinking-indicator.tsx`

---

## 🔧 MIGRACIÓN / ROLLBACK

### Si hay problemas:
1. El backend sigue enviando eventos compatibles (delta/token, citations/sources)
2. El frontend tiene fallback al protocolo legacy
3. Para rollback completo: revertir los commits de este refactor

### Limpieza gradual:
- Después de 1 semana estable: eliminar fallback legacy
- Actualizar otros endpoints (legal-writing, etc.) al nuevo protocolo

---

## 📊 MÉTRICAS ESPERADAS

- **Tiempo de respuesta**: Sin cambio (protocolo más ligero)
- **Consistencia de UI**: 100% (estado predecible)
- **Errores de timing**: 0 (transiciones validadas)
- **Re-renders innecesarios**: Reducidos (reducer centralizado)

---

## 🚀 PRÓXIMOS PASOS

1. **Testing en staging**: Verificar todos los casos de prueba
2. **Monitorización**: Revisar logs de eventos en producción
3. **Documentación de API**: Actualizar docs del endpoint
4. **Extensión**: Aplicar protocolo a otros endpoints (legal-writing, etc.)

---

## 🐛 DEBUGGING

### Activar logs detallados:
```typescript
// En lib/stream-protocol.ts
const DEBUG = true // Forzar logs
```

### Ver flujo de eventos:
```
[Stream RX] meta: {...}
[Stream RX] status: {phase: "classifying", ...}
[Stream RX] status: {phase: "searching", ...}
[Stream RX] delta: {text: "..."}
[Stream RX] citations: {items: [...]}
[Stream RX] done: {ok: true}
```

### Ver estados:
```
[StreamState] Fase: classifying | Mensaje: Analizando…
[StreamState] Fase: searching | Mensaje: Investigando…
[StreamState] Fase: streaming | Mensaje: Redactando…
[StreamState] Fase: completed | Mensaje: Respuesta completa
```
