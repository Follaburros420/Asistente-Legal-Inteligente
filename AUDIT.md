# Auditoría del Chatbot - 2026-02-10

## Resumen Ejecutivo

Se realizaron correcciones críticas en el módulo de chatbot para garantizar que el sistema use el modelo correcto (Google Gemini 3 Pro Preview) y para solucionar un bug que impedía escribir correctamente en el input del chat.

### Problemas Identificados

1. **Modelo incorrecto en producción**: Los logs mostraban que se usaba `alibaba/tongyi-deepresearch-30b-a3b` en lugar de `google/gemini-3-pro-preview`
   - **Causa raíz**: En `chat-ui.tsx`, la lista de `validModels` incluía modelos obsoletos para "compatibilidad con chats existentes", permitiendo que chats antiguos cargaran con el modelo equivocado.

2. **Bug del input que solo capturaba la última letra**: El usuario no podía escribir palabras completas en el chat.
   - **Causa raíz**: El `useEffect` de sincronización en `ChatInputArea` creaba un race condition donde el valor externo (aún no actualizado) sobrescribía el valor local durante el typing.

---

## Cambios por Archivo

### 1. `components/chat/chat-ui.tsx`

**Cambio**: Eliminados modelos obsoletos de la lista de modelos válidos.

```diff
- const validModels = [
-   'google/gemini-2.0-flash-thinking-exp:free',
-   'google/gemini-3-pro-preview',
-   'alibaba/tongyi-deepresearch-30b-a3b', // Mantener para compatibilidad
-   'moonshotai/kimi-k2-thinking' // Mantener para compatibilidad
- ]
+ // Modelos válidos - Solo Gemini
+ const validModels = [
+   'google/gemini-2.0-flash-thinking-exp:free',
+   'google/gemini-3-pro-preview'
+ ]
```

**Razón**: Los chats existentes con modelos obsoletos se migran automáticamente a Gemini 3 Pro Preview.

### 2. `components/chat/chat-helpers/index.ts`

**Cambio**: Simplificada la detección de modelos LangChain.

```diff
- const isLangChainModel = modelId.includes('tongyi') ||
-                          modelId.includes('deepresearch') ||
-                          modelId.includes('alibaba') ||
-                          modelId.includes('kimi') ||
-                          modelId.includes('moonshot') ||
-                          modelId.includes('gemini')
+ // Solo modelos Gemini usan LangChain Agent (tool calling nativo)
+ const isLangChainModel = modelId.includes('gemini')
```

### 3. `components/chat/chat-hooks/use-chat-handler.tsx`

**Cambio**: Simplificada la detección de modelos de investigación.

```diff
- const isResearchModel = modelId.includes('tongyi') ||
-                         modelId.includes('deepresearch') ||
-                         modelId.includes('alibaba') ||
-                         modelId.includes('kimi') ||
-                         modelId.includes('moonshot')
+ // Solo modelos Gemini usan LangChain
+ const isResearchModel = modelId.includes('gemini')
```

### 4. `app/api/chat/langchain-agent/route.ts`

**Cambio**: Actualizados comentarios y documentación para reflejar solo modelos Gemini.

### 5. `components/ui/chat-settings-form.tsx`

**Cambio**: Actualizado comentario sobre el selector de modelo.

### 6. `components/chat/chat-input-area.tsx` (CORRECCIÓN CRÍTICA)

**Cambio**: Reescrita la lógica de sincronización del estado para prevenir race conditions.

**Antes (problemático)**:
```typescript
useEffect(() => {
    setLocalValue(value)
}, [value])
```

**Después (corregido)**:
```typescript
useEffect(() => {
    // Solo sincronizar si:
    // 1. El valor externo está vacío (reset intencional)
    // 2. El input no está enfocado Y el valor cambió externamente
    const isEmptyReset = value === "" && localValue !== ""
    const notFocused = !isFocused
    const externalChange = value !== lastSyncedValueRef.current && value !== localValue

    if (isEmptyReset || (notFocused && externalChange)) {
        setLocalValue(value)
        lastSyncedValueRef.current = value
    }
}, [value, isFocused, localValue])
```

**Razón**: El enfoque anterior sincronizaba inmediatamente cuando el valor externo cambiaba, pero durante el typing, el valor externo puede no haberse actualizado todavía en el contexto de React, causando que el input se resetee.

---

## Configuración de Modelos

### Modelo por Defecto
- **Producción**: `google/gemini-3-pro-preview`
- **Definido en**: `lib/langchain/config/models.ts`

### Fallbacks
1. `google/gemini-3-pro-preview` → `google/gemini-1.5-pro-latest` → `anthropic/claude-3.5-sonnet`
2. `openai/gpt-5-mini` → `openai/gpt-4o-mini`

### Flujo de Selección de Modelo
```
1. chat-ui.tsx: fetchChat() → usa modelo del chat o Gemini 3 Pro
2. use-chat-handler.tsx: handleSendMessage() → pasa modelo a backend
3. chat-helpers/index.ts: handleHostedChat() → detecta si es Gemini
4. api/chat/langchain-agent/route.ts → usa modelo recibido
5. legal-agent.ts: initializeModel() → crea instancia del modelo
```

---

## Verificación

### Tests Recomendados

1. **Test de input**: Escribir "hola mundo" completo sin que se pierdan caracteres
2. **Test de modelo**: Verificar en logs que aparezca `google/gemini-3-pro-preview`
3. **Test de chat existente**: Cargar un chat antiguo y verificar que use Gemini 3 Pro

### Comando de Build
```bash
npm run build
```

### Variables de Entorno Requeridas
- `OPENROUTER_API_KEY` - Para acceso a modelos
- `NEXT_PUBLIC_SUPABASE_URL` - URL de Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Key de Supabase
- `SERPER_API_KEY` - Para búsqueda web

---

## Código Legacy (No Modificado)

Los siguientes archivos contienen referencias a modelos obsoletos pero no se modificaron porque:
1. Son endpoints legacy que probablemente no se usan en producción
2. Son archivos de test
3. Modificarlos podría romper compatibilidad con features existentes

- `lib/tongyi/` - Librería legacy de Tongyi
- `app/api/tongyi/` - Endpoints legacy
- `__tests__/setup.ts` - Configuración de tests

**Recomendación**: Evaluar si estos archivos se pueden eliminar en una futura limpieza.

---

## Instrucciones de Deploy

1. **Verificar variables de entorno** en producción
2. **Ejecutar build**: `npm run build`
3. **Deploy**: `git push origin produccion`

### Rollback
Si hay problemas, revertir los commits:
```bash
git log --oneline -5  # Identificar commits
git revert <commit-hash>
```

---

## Contacto

- Auditor realizado por: Claude Code
- Fecha: 2026-02-10
- Branch: produccion
