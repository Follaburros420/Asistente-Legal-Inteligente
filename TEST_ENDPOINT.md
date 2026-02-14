# Test de Endpoint Simple

## 🧪 Probar Conectividad Frontend-Backend

### Paso 1: Verificar que el endpoint existe
```bash
curl http://localhost:3000/api/chat/test-simple
```

**Esperado:**
```json
{
  "status": "ok",
  "openrouter_key_configured": true/false,
  "timestamp": "..."
}
```

### Paso 2: Probar el streaming
```bash
curl -X POST http://localhost:3000/api/chat/test-simple \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Esperado:** (línea por línea con delays)
```
{"type":"meta",...}
{"type":"status","phase":"classifying",...}
{"type":"status","phase":"searching",...}
{"type":"delta","text":"Hola"}
...
{"type":"done",...}
```

---

## 🔍 Diagnóstico

### Si el test-simple funciona pero langchain-agent no:

**Problema:** El agente de LangChain está atascado

**Causas posibles:**
1. **OPENROUTER_API_KEY no configurada** - Verificar en `.env.local`
2. **Modelo no disponible** - Verificar que el modelo exista en OpenRouter
3. **Error en creación del agente** - Revisar logs del backend

### Si el test-simple NO funciona:

**Problema:** Conectividad general frontend-backend

**Verificar:**
1. Servidor corriendo (`npm run dev`)
2. Puerto 3000 disponible
3. No hay errores de compilación

---

## 📝 Logs a Revisar

### Backend (Terminal):
```
[Test Simple] 📥 POST recibido
[Test Simple] 📦 Body: { test: true }
[Test Simple] 🔑 OPENROUTER_API_KEY: ✅ Configurada
```

### Frontend (F12 Console):
```
[fetchChatResponse] 📡 Fetching: /api/chat/test-simple
[fetchChatResponse] ✅ Response status: 200
[processResponse] 📦 Chunk recibido: {"type":"meta"...}
```

---

## 🎯 Siguiente Paso

**Si `test-simple` funciona pero `langchain-agent` da timeout:**

El problema es específicamente el agente de LangChain. Necesitamos:
1. Verificar que `OPENROUTER_API_KEY` esté configurada
2. Verificar que el modelo `gpt-4o-mini` (o el que uses) esté disponible
3. Agregar más logs en `LegalAgent.create` y `initializeModel`

**Si `test-simple` NO funciona:**

Hay un problema general de conectividad. Revisar:
1. Servidor Next.js corriendo
2. Variables de entorno cargadas
3. Firewall/proxy bloqueando
