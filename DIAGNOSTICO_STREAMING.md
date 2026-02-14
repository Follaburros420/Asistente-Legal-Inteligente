# Diagnóstico de Problemas de Streaming

## 🚨 Problemas Identificados y Soluciones Aplicadas

### Problema 1: Doble Animación / Componente No Estético
**Causa:** La detección de documentos (`isLegalDocument`) usaba heurísticas que capturaban palabras como "tutela" en consultas simples.

**Solución aplicada:**
- Ahora se usa `streamState.renderMode` del backend para decidir si mostrar modo documento
- Heurísticas solo como fallback para mensajes históricos
- No se convierte texto plano a draft automáticamente

### Problema 2: No se Muestra Dinámicamente el Progreso
**Causa:** Los eventos del backend no se estaban procesando correctamente o no llegaban.

**Solución aplicada:**
- Logs extensivos en frontend (`[processResponse]`) y backend (`[LangChain Agent]`)
- Handler `onPhaseChange` conectado a `setStreamPhase` y `setStreamMessage`
- Procesamiento de eventos `meta`, `status`, `delta`, `citations`, `done`

### Problema 3: Formatos de Escritura para Consultas Simples
**Causa:** `renderMessageContent` intentaba parsear drafts de múltiples formas.

**Solución aplicada:**
- Refactorización completa de `renderMessageContent`
- Solo muestra DocumentEditor si hay un draft JSON válido
- DocumentViewer solo para contenido HTML con palabras clave específicas

---

## 🔍 Logs Esperados (Consola del Navegador)

### Al enviar "hola":

```
[Chat] 🚀 Iniciando handleSendMessage: hola
[Chat] 📝 Creando mensajes temporales…
[Chat] ✅ Mensajes temporales creados. ID Asistente: xxx
[handleHostedChat] 🚀 Iniciando…
[handleHostedChat] 📝 Formateando mensajes…
[handleHostedChat] ✅ Mensajes formateados: 2
[handleHostedChat] 🌐 Endpoint: /api/chat/langchain-agent
[handleHostedChat] 🌐 Full URL: http://localhost:3000/api/chat/langchain-agent
[fetchChatResponse] 📡 Fetching: /api/chat/langchain-agent
[fetchChatResponse] ✅ Response status: 200
[processResponse] 🔄 Iniciando consumo del stream…
[processResponse] 📦 Chunk recibido: {"type":"meta",...}
[processResponse] 📄 Línea parseada: {"type":"meta",...}
[processResponse] ✅ Evento JSON válido: meta
[processResponse] 📥 Evento recibido: meta
[processResponse] 🎯 Evento META - render_mode: chat
[processResponse] 📦 Chunk recibido: {"type":"status","phase":"classifying"...}
[processResponse] 📄 Línea parseada: {"type":"status",...}
[processResponse] ✅ Evento JSON válido: status
[processResponse] 📥 Evento recibido: status
[processResponse] 📊 Evento STATUS - phase: classifying message: Analizando…
[processResponse] 📦 Chunk recibido: {"type":"delta","text":"La"}
[processResponse] ✅ Evento JSON válido: delta
...
[processResponse] ✅ Evento DONE
```

### Al enviar "redacta contrato":

```
[processResponse] 🎯 Evento META - render_mode: document
...
[processResponse] 📊 Evento STATUS - phase: searching message: Investigando…
```

---

## 🔧 Si No Ves Estos Logs

### Opción 1: Backend No Recibe la Petición
**Síntoma:** No ves `[LangChain Agent] 📥 POST recibido` en terminal del backend

**Verificar:**
```bash
# En terminal aparte
curl -X POST http://localhost:3000/api/chat/langchain-agent \
  -H "Content-Type: application/json" \
  -d '{"chatSettings":{"model":"gpt-4o-mini"},"messages":[{"role":"user","content":"hola"}]}'
```

Si esto funciona, el problema es en el frontend fetch.

### Opción 2: Eventos No Se Parsean
**Síntoma:** Ves chunks pero no ves "✅ Evento JSON válido"

**Causa posible:** El backend envía formato diferente a JSON Lines

**Verificar en backend:** Asegúrate que los eventos se envíen como:
```javascript
controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
```

### Opción 3: UI No Se Actualiza
**Síntoma:** Ves los eventos en consola pero la UI no cambia

**Verificar:**
- `streamPhase` debe cambiar de "classifying" → "searching" → "streaming" → "completed"
- `streamMessage` debe mostrar los mensajes dinámicos

---

## 🎨 Comportamiento Esperado de la UI

### Para "hola":

| Tiempo | UI | Fase Interna |
|--------|-----|--------------|
| 0ms | ThinkingIndicator: "Analizando tu consulta legal…" | classifying |
| 500ms | ThinkingIndicator: "Investigando normas oficiales…" (opcional) | searching |
| 1000ms | Texto aparece: "Hola, ¿en qué puedo ayudarte?" | streaming |
| 2000ms | Texto completo visible | completed |

### Para "redacta contrato de compraventa":

| Tiempo | UI | Fase Interna |
|--------|-----|--------------|
| 0ms | ThinkingIndicator: "Analizando…" | classifying |
| 500ms | ThinkingIndicator: "Investigando normas…" | searching |
| 3000ms | ThinkingIndicator: "Sintetizando hallazgos…" | drafting |
| 4000ms | Texto aparece con preview del documento | streaming |
| 8000ms | Documento completo + Fuentes | completed |

---

## 🐛 Si Aún Hay Problemas

### Recopilar información:

1. **Abrir consola (F12)**
2. **Limpiar consola (Ctrl+L)**
3. **Enviar mensaje "hola"**
4. **Copiar TODO el output de la consola**
5. **Copiar TODO el output del terminal del backend**

### Verificar Estado del Stream:

En consola del navegador, ejecutar:
```javascript
// Ver el estado actual
console.log(window.__ALI_CONTEXT__)
```

(O necesitamos agregar esto al código)

---

## ✅ Checklist de Funcionamiento

- [ ] Backend log: `[LangChain Agent] 📥 POST recibido`
- [ ] Frontend log: `[fetchChatResponse] ✅ Response status: 200`
- [ ] Frontend log: `[processResponse] 🔄 Iniciando consumo del stream…`
- [ ] Frontend log: Evento `meta` con `render_mode`
- [ ] Frontend log: Evento `status` con fases cambiando
- [ ] Frontend log: Evento `delta` con texto
- [ ] Frontend log: Evento `done` al finalizar
- [ ] UI: Se ve ThinkingIndicator con frases cambiando
- [ ] UI: Luego aparece texto stream
- [ ] UI: No aparece DocumentViewer para "hola"
- [ ] UI: Fuentes aparecen solo al final
