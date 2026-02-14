# Diagnóstico del Módulo de Pensamiento

## 🔍 Logs Esperados en la Consola (F12)

Cuando envías un mensaje, deberías ver EXACTAMENTE este flujo de logs:

### 1. Inicio del Envío
```
[Chat] 🚀 Iniciando handleSendMessage: hola
[Chat] 📋 Preparando mensajes temporales…
[Chat] 📝 Creando mensajes temporales…
[Chat] ✅ Mensajes temporales creados. ID Asistente: xxx
[Chat] 🎯 StreamState inicializado
```

**Si NO ves estos logs:** El problema está en `use-chat-handler.tsx`, en la función `handleSendMessage`.

---

### 2. Llamada al Backend
```
[handleHostedChat] 🚀 Iniciando…
[handleHostedChat] 📝 Formateando mensajes…
[handleHostedChat] ✅ Mensajes formateados: 2
[handleHostedChat] 🌐 Endpoint: /api/chat/langchain-agent
[handleHostedChat] 🌐 Full URL: http://localhost:3000/api/chat/langchain-agent
[fetchChatResponse] 📡 Fetching: /api/chat/langchain-agent
[fetchChatResponse] ✅ Response status: 200
```

**Si ves `[fetchChatResponse] ❌` o no ves status 200:** El backend no está respondiendo.

**Si NO ves `[fetchChatResponse] 📡 Fetching`:** El código se está deteniendo antes del fetch, probablemente en `buildFinalMessages`.

---

### 3. Recepción del Stream
```
[processResponse] 🔄 Iniciando consumo del stream…
[processResponse] 📦 Chunk recibido: {"type":"meta",...}
[processResponse] 📄 Línea parseada: {"type":"meta",...}
[processResponse] ✅ Evento JSON válido: meta
[processResponse] 📥 Evento recibido: meta
[processResponse] 🎯 Evento META - render_mode: chat
[processResponse] 📦 Chunk recibido: {"type":"status",...}
[processResponse] 📄 Línea parseada: {"type":"status",...}
[processResponse] ✅ Evento JSON válido: status
[processResponse] 📥 Evento recibido: status
[processResponse] 📊 Evento STATUS - phase: classifying message: Analizando…
```

**Si NO ves `[processResponse] 🔄 Iniciando consumo`:** El problema está en `handleHostedChat` o `fetchChatResponse`.

**Si ves chunks pero NO ves "✅ Evento JSON válido":** Los eventos no están en formato JSON Lines correcto. Revisar backend.

**Si ves "✅ Evento JSON válido: status" pero NO ves "📊 Evento STATUS":** El evento no tiene la estructura esperada.

---

### 4. Actualización de Estado
```
[Chat] 🔄 Phase change: classifying - Analizando tu consulta legal…
[Message] 📝 Render - isLast: true, isGenerating: true, streamPhase: classifying
[Message] 🎨 Rendering - phase: classifying, isGenerating: true
```

**Si NO ves `[Chat] 🔄 Phase change`:** Los handlers no se están ejecutando. Revisar `streamHandlers` en `use-chat-handler.tsx`.

**Si ves `streamPhase: idle` en lugar de `classifying`:** El estado no se está inicializando correctamente.

---

## ⚠️ Problemas Comunes y Soluciones

### Problema 1: `streamPhase` es "idle"
**Síntoma:** Log muestra `streamPhase: idle`

**Causa:** El estado no se inicializó o se reseteó.

**Solución:** Verificar que en `handleSendMessage` se llame:
```javascript
setStreamPhase("classifying")
```

Antes de hacer el fetch.

---

### Problema 2: `isGenerating` es `false`
**Síntoma:** Log muestra `isGenerating: false`

**Causa:** El estado se reseteó prematuramente.

**Solución:** Verificar que no haya un `finally` o `catch` que ponga `setIsGenerating(false)` antes de tiempo.

---

### Problema 3: No llegan eventos del backend
**Síntoma:** No ves logs de `[processResponse]`

**Verificar en backend:** Agrega log al inicio del POST:
```typescript
export async function POST(request: NextRequest) {
  console.log("[LangChain Agent] 📥 POST recibido")
  // ...
}
```

**Si NO ves el log en el terminal del backend:** La petición no está llegando. Verificar:
- URL correcta
- CORS
- Red

---

### Problema 4: Los eventos llegan pero no se parsean
**Síntoma:** Ves `[processResponse] 📦 Chunk recibido` pero NO ves `✅ Evento JSON válido`

**Causa:** El formato de los eventos no es JSON Lines.

**Verificar formato esperado:**
```
{"type":"status","phase":"classifying","message":"Analizando…"}\n
```

**Nota:** Debe terminar con `\n` (newline).

---

## 🧪 Test Rápido

Copia y pega esto en la consola del navegador (F12) después de enviar un mensaje:

```javascript
// Verificar estado actual
const context = window.__ALI_CONTEXT__ || "No disponible"
console.log("Estado actual:", {
  isGenerating: context?.isGenerating,
  streamPhase: context?.streamPhase,
  streamMessage: context?.streamMessage,
  chatMessages: context?.chatMessages?.length
})
```

Si `window.__ALI_CONTEXT__` no existe, necesitamos exponerlo para debuggear.

---

## 📝 Recopilación de Información

Si el problema persiste, necesito que copies y pegues:

1. **TODO el output de la consola** (F12 → Console) desde que envías el mensaje
2. **TODO el output del terminal del backend** desde que envías el mensaje
3. **Screenshot de la pestaña Network** (F12 → Network) mostrando:
   - La petición POST a `/api/chat/langchain-agent`
   - Su status code
   - Su response (preview)

Con esta información podré identificar exactamente dónde se rompe el flujo.
