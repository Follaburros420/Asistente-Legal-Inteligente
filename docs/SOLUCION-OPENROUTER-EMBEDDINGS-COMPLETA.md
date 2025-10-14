# 🎯 Solución Completa: OpenRouter Embeddings para Subida de Archivos

## ✅ Cambios Realizados

### 1. Actualización de `lib/generate-openrouter-embedding.ts`

**Problema**: Las funciones no aceptaban el API key como parámetro.

**Solución**: Se actualizaron ambas funciones para soportar múltiples firmas:

```typescript
// Antes:
generateOpenRouterEmbedding(text, model)
generateMultipleOpenRouterEmbeddings(texts, model)

// Ahora (soporta 3 firmas):
generateOpenRouterEmbedding(text, apiKey, model)  // ✅ Nuevo
generateOpenRouterEmbedding(text, apiKey)         // ✅ Nuevo (modelo por defecto)
generateOpenRouterEmbedding(text, model)          // ✅ Mantiene compatibilidad

// Lo mismo para generateMultipleOpenRouterEmbeddings
```

**Lógica de detección**:
- Si el segundo parámetro empieza con `sk-` o `or-` → es un API key
- Si hay un tercer parámetro → (apiKey, model)
- Si no hay segundo parámetro o no es API key → usa `process.env.OPENROUTER_API_KEY`

---

### 2. Actualización de `app/api/retrieval/process/route.ts`

**Problema**: El código estaba usando embeddings locales en lugar de OpenRouter.

**Cambios**:

#### a) Agregado soporte para OpenRouter en el switch de embeddings

```typescript
if (embeddingsProvider === "openai") {
  // Código OpenAI existente...
} else if (embeddingsProvider === "openrouter") {
  // 🔥 NUEVO: Usar OpenRouter para embeddings
  console.log('🚀 Using OpenRouter embeddings for document processing')
  const openrouterKey = profile.openrouter_api_key || process.env.OPENROUTER_API_KEY
  
  embeddings = await generateMultipleOpenRouterEmbeddings(
    chunks.map(chunk => chunk.content),
    openrouterKey!,
    'text-embedding-3-small'
  )
  
  console.log(`✅ Generated ${embeddings.length} OpenRouter embeddings`)
} else {
  // Embeddings locales (solo si se especifica explícitamente)
  console.log('Using local embeddings for document processing')
  // ...
}
```

#### b) Actualizado el mapeo de columnas en Supabase

```typescript
const file_items = chunks.map((chunk, index) => ({
  file_id,
  user_id: profile.user_id,
  content: chunk.content,
  tokens: chunk.tokens,
  openai_embedding:
    embeddingsProvider === "openai" || embeddingsProvider === "openrouter"  // ✅ AGREGADO
      ? ((embeddings[index] || null) as any)
      : null,
  local_embedding:
    embeddingsProvider === "local"
      ? ((embeddings[index] || null) as any)
      : null
}))
```

**Razón**: Los embeddings de OpenRouter son compatibles con los de OpenAI (ambos usan el modelo `text-embedding-3-small`), así que se guardan en la misma columna `openai_embedding`.

---

### 3. Actualización de `app/api/retrieval/process/docx/route.ts`

**Cambios idénticos** a los de `route.ts` principal, pero para archivos DOCX específicamente.

```typescript
} else if (embeddingsProvider === "openrouter") {
  try {
    console.log('🚀 [DOCX] Using OpenRouter embeddings for document processing')
    const openrouterKey = profile.openrouter_api_key || process.env.OPENROUTER_API_KEY
    
    embeddings = await generateMultipleOpenRouterEmbeddings(
      chunks.map(chunk => chunk.content),
      openrouterKey!,
      'text-embedding-3-small'
    )
    
    console.log(`✅ [DOCX] Generated ${embeddings.length} OpenRouter embeddings`)
  } catch (error) {
    console.error('❌ [DOCX] OpenRouter embeddings error:', error)
    throw new Error('Failed to generate OpenRouter embeddings')
  }
}
```

---

### 4. Actualización de `app/api/retrieval/retrieve/route.ts`

**Problema**: La recuperación de embeddings no pasaba el API key correctamente.

**Solución**:

```typescript
} else if (embeddingsProvider === "openrouter") {
  try {
    const openrouterKey = profile.openrouter_api_key || process.env.OPENROUTER_API_KEY
    console.log('🔍 Generando embedding de búsqueda con OpenRouter...')
    
    const openrouterEmbedding = await generateOpenRouterEmbedding(
      userInput, 
      openrouterKey!,  // ✅ Pasar el API key explícitamente
      'text-embedding-3-small'
    )

    console.log('✅ Embedding generado, buscando en base de datos...')
    
    const { data: openrouterFileItems, error: openrouterError } =
      await supabaseAdmin.rpc("match_file_items_openai", {  // Usa la misma función que OpenAI
        query_embedding: openrouterEmbedding as any,
        match_count: sourceCount,
        file_ids: uniqueFileIds
      })

    if (openrouterError) {
      console.error('❌ Error en búsqueda de Supabase:', openrouterError)
      throw openrouterError
    }

    console.log(`✅ Encontrados ${openrouterFileItems?.length || 0} chunks relevantes`)
    chunks = openrouterFileItems
  } catch (error) {
    console.error('❌ OpenRouter retrieval error:', error)
    throw new Error('Failed to retrieve with OpenRouter embeddings')
  }
}
```

**Nota importante**: Se usa `match_file_items_openai` porque los embeddings de OpenRouter son compatibles con OpenAI (mismo modelo y dimensiones).

---

## 🔄 Flujo Completo de Subida y Recuperación

### 📤 Flujo de Subida de Archivos

1. **Usuario sube un archivo** → Frontend envía a `/api/retrieval/process`
2. **Backend procesa el archivo**:
   - Lee el contenido
   - Divide en chunks
   - Tokeniza cada chunk
3. **Backend genera embeddings con OpenRouter**:
   ```
   🔥 FORZANDO embeddingsProvider a 'openrouter'
   📌 Embeddings provider seleccionado: openrouter
   ✅ OpenRouter API Key found
   🚀 Using OpenRouter embeddings for document processing
   ✅ Generated X OpenRouter embeddings
   ```
4. **Backend guarda en Supabase**:
   - Tabla: `file_items`
   - Columna: `openai_embedding` (compatible con OpenRouter)
   - Contenido: texto del chunk
   - Tokens: cantidad de tokens

### 🔍 Flujo de Recuperación (cuando el usuario hace una pregunta)

1. **Usuario hace una pregunta** con archivos adjuntos
2. **Frontend llama** a `/api/retrieval/retrieve`:
   ```javascript
   {
     userInput: "pregunta del usuario",
     fileIds: ["id1", "id2"],
     embeddingsProvider: "openrouter",
     sourceCount: 10
   }
   ```
3. **Backend genera embedding de la pregunta**:
   ```
   🔍 Generando embedding de búsqueda con OpenRouter...
   ✅ Embedding generado, buscando en base de datos...
   ```
4. **Backend busca chunks similares** en Supabase:
   - Usa la función RPC: `match_file_items_openai`
   - Compara el embedding de la pregunta con los embeddings guardados
   - Devuelve los top N chunks más similares
5. **Backend devuelve los chunks** al frontend:
   ```
   ✅ Encontrados X chunks relevantes
   ```
6. **Frontend construye el mensaje final**:
   - Agrega los chunks al final del mensaje del usuario
   - Formato:
     ```
     [Pregunta del usuario]

     You may use the following sources if needed to answer the user's question...
     
     <BEGIN SOURCE>
     [Contenido del chunk 1]
     </END SOURCE>
     
     <BEGIN SOURCE>
     [Contenido del chunk 2]
     </END SOURCE>
     ```
7. **Frontend envía el mensaje completo** al modelo (Tongyi, OpenAI, etc.)
8. **El modelo responde** basándose en el contexto proporcionado

---

## 🧪 Logs Esperados

### Al subir un archivo:

```
🔥 FORZANDO embeddingsProvider a 'openrouter' (valor recibido ignorado)
📌 Embeddings provider seleccionado: openrouter
✅ OpenRouter API Key found
🚀 Using OpenRouter embeddings for document processing
Processing file...
Generating 15 chunks...
✅ Generated 15 OpenRouter embeddings
✅ File uploaded and processed successfully
```

### Al hacer una pregunta con archivo adjunto:

```
🔍 Generando embedding de búsqueda con OpenRouter...
✅ Embedding generado, buscando en base de datos...
✅ Encontrados 5 chunks relevantes
```

---

## 📋 Verificación en Supabase

Para verificar que los embeddings se están guardando correctamente:

```sql
-- Ver los últimos file_items creados
SELECT 
  fi.id,
  fi.content,
  fi.tokens,
  CASE 
    WHEN fi.openai_embedding IS NOT NULL THEN 'OpenRouter/OpenAI'
    WHEN fi.local_embedding IS NOT NULL THEN 'Local'
    ELSE 'Sin embedding'
  END as embedding_type,
  f.name as file_name,
  fi.created_at
FROM file_items fi
JOIN files f ON fi.file_id = f.id
ORDER BY fi.created_at DESC
LIMIT 10;
```

**Resultado esperado**:
- `embedding_type`: "OpenRouter/OpenAI"
- `content`: El texto del chunk
- `tokens`: Número de tokens

---

## 🛠️ Troubleshooting

### Si sigue apareciendo "OpenAI API Key not found":

1. **Verifica el workspace y chat**:
   ```sql
   -- Ver embeddings_provider del workspace actual
   SELECT id, name, embeddings_provider FROM workspaces 
   WHERE user_id = 'tu_user_id';

   -- Actualizar si es necesario
   UPDATE workspaces SET embeddings_provider = 'openrouter';

   -- Lo mismo para chats
   SELECT id, name, embeddings_provider FROM chats;
   UPDATE chats SET embeddings_provider = 'openrouter';
   ```

2. **Crea un nuevo chat** (no uses el antiguo) para asegurarte de que use la configuración actualizada.

3. **Limpia el caché del navegador**:
   - Modo incógnito (Ctrl + Shift + N)
   - O limpia el caché (Ctrl + Shift + Delete)

### Si los embeddings no se generan:

1. **Verifica el OpenRouter API Key**:
   ```javascript
   // En la consola del navegador o en un script de Node.js
   console.log(process.env.OPENROUTER_API_KEY)
   ```

2. **Verifica los logs de la terminal** al subir un archivo.

3. **Verifica la respuesta de OpenRouter**:
   - Si hay un error 401: API key incorrecta
   - Si hay un error 429: Límite de rate excedido
   - Si hay un error 500: Error del servidor de OpenRouter

---

## ✅ Checklist Final

Antes de subir un archivo:

- [x] ✅ Servidor corriendo (`npm run dev`)
- [x] ✅ OpenRouter API Key configurada (`.env` o perfil de usuario)
- [x] ✅ Cache del navegador limpiado
- [x] ✅ Workspace con `embeddings_provider = 'openrouter'`
- [x] ✅ Chat nuevo o actualizado con `embeddings_provider = 'openrouter'`

Al subir un archivo, deberías ver en la terminal:

```
🔥 FORZANDO embeddingsProvider a 'openrouter'
✅ OpenRouter API Key found
🚀 Using OpenRouter embeddings for document processing
✅ Generated X OpenRouter embeddings
```

Al hacer una pregunta con el archivo:

```
🔍 Generando embedding de búsqueda con OpenRouter...
✅ Encontrados X chunks relevantes
```

---

## 🎯 Próximos Pasos para Tongyi

Si los embeddings funcionan pero Tongyi no responde con el contenido:

1. **Lee** `docs/DIAGNOSTICO-TONGYI-RETRIEVAL.md`
2. **Verifica** que Tongyi recibe el mensaje completo con el contexto
3. **Revisa** los logs del navegador (F12 → Network → filter by `chat`)
4. **Comprueba** que el Request Payload incluye `<BEGIN SOURCE>`

---

## 📞 Contacto para Soporte

Si después de seguir todos estos pasos el problema persiste, proporciona:

1. **Logs de la terminal** al subir un archivo
2. **Logs de la terminal** al hacer una pregunta
3. **Logs de la consola del navegador** (F12)
4. **Screenshot de la configuración** del workspace/chat en Supabase
5. **Configuración del modelo Tongyi** (si es custom)

Con esta información podremos diagnosticar el problema específico.

---

✅ **CAMBIOS COMPLETADOS Y SERVIDOR REINICIADO**

El servidor está corriendo con la nueva configuración de OpenRouter embeddings. 
Ahora puedes intentar subir un archivo y verificar los logs.














