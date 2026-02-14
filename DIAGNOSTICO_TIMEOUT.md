# Diagnóstico de Timeout

## 🚨 Problema
El endpoint `/api/chat/langchain-agent` devuelve timeout después de 75 segundos (ahora reducido a 15 segundos para diagnóstico).

## 🔍 Logs Agregados

### Backend (ver en terminal):

1. **Al recibir POST:**
   ```
   [LangChain Agent] 📥 POST recibido: 2026-02-13T...
   [LangChain Agent] ✅ Body recibido: {...}
   [LangChain Agent] 🔑 API Key configurada: ✅ Sí / ❌ No
   ```

2. **Al crear agente:**
   ```
   [LangChain Agent] 🔧 Creando/Obteniendo agente…
   [getOrCreateAgent] 🔍 Cache key: ...
   [getOrCreateAgent] 🆕 Creando nuevo agente LegalAgent…
   [getOrCreateAgent] ✅ Agente creado exitosamente
   ```

3. **Al invocar agente:**
   ```
   [LangChain Agent] 🤖 Invocando agente…
   [LangChain Agent] 📝 Input: hola
   [LangChain Agent] 📜 Chat history length: 0
   ```

4. **Tokens:**
   ```
   [LangChain Agent] 📝 Tokens emitidos: 50
   [LangChain Agent] 📝 Tokens emitidos: 100
   ```

5. **Error:**
   ```
   [LangChain Agent] ❌ Error creando agente: ...
   [LangChain Agent] ❌ OPENROUTER_API_KEY no configurada
   ```

### Frontend (ver en F12 Console):

```
[Chat] 🚀 Iniciando handleSendMessage: hola
[handleHostedChat] 🚀 Iniciando…
[fetchChatResponse] 📡 Fetching: /api/chat/langchain-agent
[fetchChatResponse] ✅ Response status: 200
[processResponse] 🔄 Iniciando consumo del stream…
[processResponse] 📦 Chunk recibido: {"type":"meta",...}
[Chat] 🔄 Phase change: classifying - Analizando…
[Message] 🎨 Rendering streaming - phase: classifying
```

---

## 🧪 Pasos para Diagnosticar

### Paso 1: Probar endpoint de test
```bash
curl http://localhost:3000/api/chat/test-simple
```

Si esto funciona, el problema es específicamente el agente de LangChain.

### Paso 2: Ver logs del backend
Al enviar un mensaje, verifica qué logs aparecen en el terminal del backend:

- ¿Aparece `[LangChain Agent] 📥 POST recibido`? 
- ¿Aparece `[LangChain Agent] 🔑 API Key configurada: ✅ Sí`?
- ¿Aparece `[getOrCreateAgent] ✅ Agente creado`?
- ¿Aparece `[LangChain Agent] 🤖 Invocando agente`?

### Paso 3: Identificar dónde se detiene

| Log | Significado |
|-----|-------------|
| No aparece `📥 POST recibido` | El request no llega al backend |
| No aparece `🔑 API Key` | Error antes de validar API key |
| No aparece `🔧 Creando agente` | Error en billing/autenticación |
| No aparece `✅ Agente creado` | Error creando LegalAgent |
| No aparece `🤖 Invocando` | Error preparando input/historial |
| No aparece tokens | El LLM no responde (timeout) |

---

## 🔧 Soluciones Comunes

### Si "API Key no configurada":
```bash
# Verificar archivo .env.local
cat .env.local | grep OPENROUTER
```

Debe contener:
```
OPENROUTER_API_KEY=sk-or-v1-...
```

### Si "Error creando LegalAgent":
Revisar que el modelo exista:
```bash
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

### Si "No llega POST":
- Verificar que el servidor esté corriendo: `npm run dev`
- Verificar puerto 3000
- Limpiar cache: Ctrl+Shift+R

---

## ⏱️ Timeout Reducido

Para diagnóstico, el timeout se redujo de 75s a 15s:
```typescript
const AGENT_INVOKE_TIMEOUT_MS = 15_000  // Era 75_000
```

Esto hará que falle más rápido y podamos ver el error real.

---

## 📝 Comandos Útiles

```bash
# Verificar variables de entorno
node -e "console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'OK' : 'MISSING')"

# Probar endpoint simple
curl -X POST http://localhost:3000/api/chat/test-simple \
  -H "Content-Type: application/json" \
  -d '{"test":true}'

# Ver logs en tiempo real
npm run dev 2>&1 | grep -E "(LangChain|error|Error|timeout)"
```
