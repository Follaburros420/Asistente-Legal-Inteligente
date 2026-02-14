# Guía de Debug - Streaming Atascado en "Pensando"

## 🔍 Pasos para Diagnosticar el Problema

### 1. Abrir Consola del Navegador

Presiona `F12` y ve a la pestaña **Console**. Luego envía un mensaje en el chat.

### 2. Verificar Logs Esperados

Deberías ver estos logs en orden:

```
[Chat] 🚀 Iniciando handleSendMessage: hola
[Chat] 📋 Preparando mensajes temporales…
[Chat] 📝 Creando mensajes temporales…
[Chat] ✅ Mensajes temporales creados. ID Asistente: xxx
[Chat] 🎯 StreamState inicializado
[handleHostedChat] 🚀 Iniciando…
[handleHostedChat] 📝 Formateando mensajes…
[handleHostedChat] 📋 Payload: 3 mensajes
[handleHostedChat] ✅ Mensajes formateados: 3
[handleHostedChat] 🌐 Endpoint: /api/chat/langchain-agent
[handleHostedChat] 📦 Request body: {...}
[handleHostedChat] 📡 Haciendo fetch…
[fetchChatResponse] 📡 Fetching: /api/chat/langchain-agent
[fetchChatResponse] ✅ Response status: 200
[handleHostedChat] ✅ Fetch completado. Status: 200
```

### 3. Si NO ves logs del backend

Si ves logs hasta `[fetchChatResponse] 📡 Fetching` pero NO ves:
- `[LangChain Agent] 📥 POST recibido` en el terminal del backend

**Posibles causas:**

#### A. Error de red (CORS, etc)
En la consola del navegador, busca errores rojos como:
```
Failed to fetch
net::ERR_FAILED
CORS policy
```

**Solución:** Verificar que el servidor esté corriendo y sea accesible.

#### B. AbortController cancelando inmediatamente
Busca en consola:
```
The user aborted a request.
```

**Solución:** Verificar que no haya un `handleStopMessage` llamado accidentalmente.

#### C. URL incorrecta
Verificar en los logs que diga:
```
[fetchChatResponse] 📡 Fetching: /api/chat/langchain-agent
```

No debe ser `undefined` o una URL completa con dominio incorrecto.

### 4. Si VES logs del backend pero no responde

Si ves en el terminal del backend:
```
[LangChain Agent] 📥 POST recibido: 2026-02-13T...
```

Pero no ves:
```
[LangChain Agent] ✅ Body recibido: {...}
```

**Posibles causas:**

#### A. Error parseando el body
Busca:
```
[LangChain Agent] ❌ Error parsing body:
```

**Solución:** Verificar que el request body sea JSON válido.

#### B. Error en autenticación
El backend podría estar retornando 401 sin logs.

**Verificar:** En Network tab (F12 > Network), buscar la petición POST a `/api/chat/langchain-agent` y ver el status code.

### 5. Verificar Network Tab

En F12 > Network:
1. Filtrar por "chat/langchain-agent"
2. Enviar mensaje
3. Verificar:
   - Status code: debe ser 200
   - Response: debe mostrar datos streaming
   - Timing: no debe estar "pending" indefinidamente

### 6. Si todo parece correcto pero no hay respuesta

Ejecutar este curl para probar el backend directamente:

```bash
curl -X POST http://localhost:3000/api/chat/langchain-agent \
  -H "Content-Type: application/json" \
  -d '{
    "chatSettings": {
      "model": "gpt-4o-mini",
      "temperature": 0.5
    },
    "messages": [{"role": "user", "content": "hola"}]
  }'
```

Debería retornar un stream de eventos.

---

## 🛠️ Fixes Comunes

### Fix 1: AbortController ya usado
Si el AbortController se reutiliza o se cancela antes del fetch, la petición falla.

**Verificar:** Que se cree un nuevo AbortController en cada mensaje:
```typescript
const newAbortController = new AbortController()
```

### Fix 2: Error en buildFinalMessages
Si hay un error en buildFinalMessages, el catch block lo captura pero no muestra bien el error.

**Verificar:** En consola buscar:
```
[handleHostedChat] ❌ Error en buildFinalMessages:
```

### Fix 3: Falta OPENROUTER_API_KEY
Si falta la API key, el backend puede fallar silenciosamente.

**Verificar:** En terminal del backend:
```
OPENROUTER_API_KEY no configurada
```

### Fix 4: Problema con Supabase Auth
Si la sesión expiró, el backend retorna 401.

**Verificar:** En Network tab, verificar que no haya 401.

---

## 📋 Checklist de Verificación

- [ ] Servidor Next.js corriendo (`npm run dev`)
- [ ] Backend muestra `[LangChain Agent] 📥 POST recibido`
- [ ] Frontend muestra `[fetchChatResponse] ✅ Response status: 200`
- [ ] No hay errores rojos en consola del navegador
- [ ] No hay errores en terminal del backend
- [ ] La petición en Network tab muestra status 200
- [ ] La petición no está "pending" indefinidamente

---

## 🆘 Si nada funciona

1. Recargar página (F5)
2. Limpiar cache del navegador (Ctrl+Shift+R)
3. Reiniciar servidor Next.js
4. Verificar variables de entorno (.env)
5. Verificar que Supabase esté configurado correctamente
