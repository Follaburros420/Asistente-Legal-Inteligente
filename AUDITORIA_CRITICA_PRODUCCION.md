# AUDITORÍA CRÍTICA - PROBLEMAS EN PRODUCCIÓN

## Fecha: 2026-02-13
## Estado: 🚨 CRÍTICO - Múltiples fallos reportados

---

## PROBLEMAS REPORTADOS

### 1. 🚨 Primer mensaje nunca responde - "Error desconocido"
**Severidad:** CRÍTICA
**Impacto:** Usuarios nuevos no pueden usar el chat

### 2. 🚨 No hay streaming real
**Severidad:** CRÍTICA  
**Impacto:** UX degradada, usuarios ven "cuelgue" de 10-30s

### 3. 🚨 Mensajes anteriores desaparecen
**Severidad:** CRÍTICA
**Impacto:** Pérdida de contexto de conversación

### 4. 🚨 Intermitencia - a veces no responde
**Severidad:** ALTA
**Impacto:** Experiencia inconsistente

---

## ANÁLISIS DE CAUSAS RAÍZ

### PROBLEMA 1: Primer mensaje error

**Hipótesis A:** Error en handleCreateChat cuando no existe chat previo
```typescript
// En use-chat-handler-v2.tsx línea 235-255
if (!currentChat && !isRegeneration) {
  currentChat = await handleCreateChat(...)  // ← ¿Falla aquí?
}
```

**Hipótesis B:** Error en el orquestador con historial vacío
```typescript
// El historial puede ser [] y el orquestador no maneja bien
const history = chatMessages.map(...)  // ← ¿Array vacío causa problema?
```

**Hipótesis C:** Error de OpenRouter con primer mensaje
- API key no configurada
- Rate limiting
- Modelo no disponible

### PROBLEMA 2: No hay streaming real

**Hipótesis A:** Parser SSE no funciona correctamente
```typescript
// En stream-chat.ts línea 94
const events = buffer.split("\n\n")  // ← ¿El separador es correcto?

// El emisor envía:
// event: delta\ndata: {...}\n\n
// ¿Pero el fetch/reader agrupa diferente?
```

**Hipótesis B:** El orquestador NO está usando streaming real del LLM
```typescript
// En orchestrator.ts - ¿está usando stream: true?
const response = await client.chat.completions.create({
  ...,
  stream: true  // ← ¿Falta esto?
})
```

**Hipótesis C:** Buffering del navegador/proxy
```
Headers incluyen:
- 'Content-Type': 'text/event-stream'
- 'Cache-Control': 'no-cache'
- 'X-Accel-Buffering': 'no'

¿Pero están llegando al cliente?
```

### PROBLEMA 3: Mensajes desaparecen

**Causa identificada:** Error en el orden de actualización de estado
```typescript
// En use-chat-handler-v2.tsx
const { tempUserChatMessage, tempAssistantChatMessage } = createTempMessages(
  ...,
  setChatMessages,  // ← Esto actualiza el estado
  ...
)

// Pero si el stream falla, no se restauran los mensajes originales
// Y chatMessages se usa en el siguiente envío...
```

**Problema específico:**
- `createTempMessages` muta `chatMessages` agregando mensajes temporales
- Si hay error, esos mensajes permanecen pero el assistant queda vacío
- En el siguiente envío, `chatMessages` tiene el mensaje vacío
- Al llamar `createTempMessages` de nuevo, puede estar sobreescribiendo

### PROBLEMA 4: Intermitencia

**Hipótesis:** Race condition en el estado
- `setChatMessages` es async pero se usa inmediatamente después
- El `history` se construye de `chatMessages` que puede no estar actualizado

---

## PLAN DE ACCIÓN URGENTE

### FASE 1: Hotfixes Inmediatos (30 min)

#### Fix 1.1: Logging exhaustivo
Agregar logs en cada paso crítico para identificar dónde falla.

#### Fix 1.2: Manejo de errores en creación de chat
Envolver `handleCreateChat` en try-catch con logs.

#### Fix 1.3: Preservar mensajes en error
Si el stream falla, no dejar mensajes vacíos en la UI.

### FASE 2: Corrección Streaming (1 hora)

#### Fix 2.1: Verificar orquestador usa streaming real
Revisar que `stream: true` esté en la llamada a OpenRouter.

#### Fix 2.2: Parser SSE robusto
Reescribir parser para manejar múltiples formatos.

#### Fix 2.3: Headers correctos
Verificar que los headers SSE lleguen al cliente.

### FASE 3: Corrección Mensajes (1 hora)

#### Fix 3.1: Inmutabilidad correcta
No mutar chatMessages directamente.

#### Fix 3.2: Restauración en error
Si hay error, restaurar mensajes o marcar como fallido.

#### Fix 3.3: Sincronización
Esperar a que el estado se actualice antes de continuar.

---

## ARCHIVOS A MODIFICAR

| Archivo | Problema | Acción |
|---------|----------|--------|
| `use-chat-handler-v2.tsx` | Mensajes desaparecen, primer mensaje error | Hotfix manejo de estado |
| `stream-chat.ts` | Streaming no funciona | Fix parser SSE |
| `orchestrator.ts` | ¿Streaming real? | Verificar stream: true |
| `stream-emitter.ts` | Formato SSE | Verificar formato correcto |

---

## CHECKLIST DE VERIFICACIÓN

### Después de cada fix:
- [ ] Primer mensaje funciona
- [ ] Mensajes no desaparecen
- [ ] Streaming muestra texto palabra por palabra
- [ ] Cancelar funciona
- [ ] Reintentar después de error funciona
- [ ] Historial se preserva

### Tests manuales obligatorios:
1. Chat nuevo, primer mensaje simple: "hola"
2. Chat nuevo, mensaje complejo: "¿qué es una tutela?"
3. Segundo mensaje en mismo chat
4. Cancelar a mitad de stream
5. Recargar página, verificar historial persistido

---

## NOTAS DE EMERGENCIA

Si no se pueden resolver los problemas en 2 horas:
1. **ROLLBACK** a versión anterior (pre-refactor)
2. Mantener documentación del refactor para reintentar
3. Testear más exhaustivamente en staging

---

*Auditoría iniciada: 2026-02-13*
*Prioridad: CRÍTICA*
