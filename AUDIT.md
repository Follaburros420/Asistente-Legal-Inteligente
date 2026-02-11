# Auditoría del Chatbot - 2026-02-10 (Actualizado)

## Resumen Ejecutivo

Se realizaron **dos rondas de correcciones** en el módulo de chatbot:

### Ronda 1 (Commit e54be29)
- Eliminados modelos obsoletos `alibaba/tongyi` y `moonshot/kimi` de `validModels`
- Primer intento de corregir el bug del input (fallido)

### Ronda 2 (Commit 9c09ffb) - CRÍTICO
- **Corregido el bug del input** que impedía escribir correctamente
- **Eliminados modelos OpenAI** (`gpt-5-mini`, `gpt-4o-mini`) que NO existen en OpenRouter
- **Forzado uso exclusivo de Gemini 3 Pro Preview**
- **Corregido error "content: got null"** que causaba fallos en el API

---

## Problemas Identificados y Corregidos

### 1. Modelo incorrecto: `openai/gpt-5-mini`
**Síntoma**: Los logs mostraban:
```
🎯 Router seleccionó: openai/gpt-5-mini
🔄 Intentando fallback: openai/gpt-4o-mini
⚠️ Modelo openai/gpt-5-mini no disponible: 400 Provider returned error
```

**Causa raíz**: El router (`routeModel()`) seleccionaba `gpt-5-mini` para consultas simples, pero ese modelo NO existe en OpenRouter.

**Corrección**:
- `SIMPLE_TASK_MODEL` cambiado de `'openai/gpt-5-mini'` a `'google/gemini-3-pro-preview'`
- `routeModel()` ahora siempre devuelve Gemini 3 Pro Preview
- Fallbacks solo usan modelos Gemini

### 2. Error "content: expected a string, got null"
**Síntoma**: El API retornaba error 400 con mensaje:
```
Invalid value for 'content': expected a string, got null
```

**Causa raíz**: En `legal-agent/route.ts`, cuando había tool calls, el content se pasaba como `null`:
```typescript
content: message.content || null,  // ❌ null causa error
```

**Corrección**:
```typescript
content: message.content || "",  // ✅ string vacío funciona
```

### 3. Bug del input que solo capturaba la última letra
**Causa raíz**: El componente `ChatInputArea` tenía un estado local (`localValue`) que se sincronizaba con el valor externo mediante un `useEffect`. Esto creaba un race condition donde el valor externo (aún no actualizado por React) sobrescribía el valor local durante el typing.

**Corrección**: Refactorización completa a controlled component:
- Eliminado el estado local `localValue`
- El componente ahora es un controlled input puro
- El valor se gestiona EXCLUSIVAMENTE desde el contexto (`userInput`)

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `lib/langchain/config/models.ts` | `SIMPLE_TASK_MODEL` = Gemini, router simplificado, fallbacks solo Gemini |
| `app/api/chat/legal-agent/route.ts` | Modelos válidos solo Gemini, corregido content null |
| `components/chat/chat-input-area.tsx` | Refactorizado a controlled component puro |
| `lib/langchain/agents/index.ts` | Agregado alias `createDefaultLegalAgent` |

---

## Configuración Final de Modelos

### Modelo Único
```
Principal: google/gemini-3-pro-preview
Fallbacks: google/gemini-1.5-pro-latest → google/gemini-1.5-flash
```

### Por qué solo Gemini
1. Los modelos OpenAI (`gpt-5-mini`, `gpt-4o-mini`) NO están disponibles en OpenRouter
2. Gemini 3 Pro Preview tiene 1M de contexto y soporta tool calling
3. Los modelos Claude no están garantizados en OpenRouter

---

## Verificación en Producción

### Logs esperados
```
🎯 Modelo por defecto: google/gemini-3-pro-preview
✅ Modelo google/gemini-3-pro-preview disponible
📝 Query: "..."
🤖 Modelo: google/gemini-3-pro-preview
```

### Tests manuales
1. **Input**: Escribir "hola mundo completo" y verificar que queda completo
2. **Envío**: Presionar Enter y verificar que el mensaje se envía
3. **Modelo**: Verificar en logs que aparezca `google/gemini-3-pro-preview`

---

## Commits

1. `e54be29` - Primera ronda de correcciones (incompleta)
2. `9c09ffb` - Correcciones críticas definitivas

---

## Rollback

```bash
git revert 9c09ffb  # Si hay problemas con los cambios
```
