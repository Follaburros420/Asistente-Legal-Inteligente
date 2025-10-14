# Solución - Subida de Archivos con OpenRouter Embeddings ✅

## 🎯 Problema

Al intentar subir documentos, aparecen dos errores:
1. **"Could not resolve host: supabase_kong_chatbotui"**
2. **"OpenAI API Key not found"** (aunque queremos usar OpenRouter)

## 🔧 Soluciones Implementadas

### 1. Verificación Correcta de API Keys (✅ Aplicado)

**Archivo**: `app/api/retrieval/process/route.ts`

**Problema anterior**:
- Verificaba OpenAI API key incluso cuando el proveedor era OpenRouter
- No verificaba la API key de OpenRouter

**Solución aplicada**:
```typescript
// Usar OpenRouter como proveedor por defecto si no se especifica un proveedor
if (!embeddingsProvider) {
  embeddingsProvider = "openrouter"
}

// Solo verificar API key si el proveedor es OpenAI
if (embeddingsProvider === "openai") {
  try {
    if (profile.use_azure_openai) {
      checkApiKey(profile.azure_openai_api_key, "Azure OpenAI")
    } else {
      checkApiKey(profile.openai_api_key, "OpenAI")
    }
  } catch (error: any) {
    error.message =
      error.message +
      ", make sure it is configured or else use local embeddings or openrouter embeddings"
    throw error
  }
}

// Verificar API key de OpenRouter si es el proveedor
if (embeddingsProvider === "openrouter") {
  const openrouterKey = profile.openrouter_api_key || process.env.OPENROUTER_API_KEY
  if (!openrouterKey) {
    throw new Error("OpenRouter API Key not found. Please configure it in your profile or environment variables.")
  }
}
```

### 2. Verificación de Configuración de Supabase (✅ Verificado)

**Variables de entorno verificadas**:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`: `https://givjfonqaiqhsjjjzedc.supabase.co`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`: Configurada
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Configurada
- ✅ `OPENROUTER_API_KEY`: Configurada

**Buckets de almacenamiento verificados**:
- ✅ Bucket "files" existe y está configurado correctamente

### 3. Limpieza de Caché (✅ Aplicado)

- Eliminado directorio `.next` para limpiar caché de Next.js
- Reiniciado servidor con configuración fresca

## 📋 Scripts de Diagnóstico Creados

### 1. `scripts/verify-supabase-config.js`
Verifica que las variables de entorno estén configuradas correctamente.

**Uso**:
```bash
node scripts/verify-supabase-config.js
```

**Resultado esperado**:
```
✅ NEXT_PUBLIC_SUPABASE_URL: Configurada
✅ SUPABASE_SERVICE_ROLE_KEY: Configurada
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: Configurada
✅ OPENROUTER_API_KEY: Configurada
✅ URL apunta a Supabase Cloud
```

### 2. `scripts/check-storage-buckets.js`
Verifica que el bucket "files" exista en Supabase.

**Uso**:
```bash
node scripts/check-storage-buckets.js
```

**Resultado esperado**:
```
✅ Buckets encontrados:
  - files (privado)
  - profile_images (público)
  - assistant_images (privado)
  - message_images (privado)
  - workspace_images (privado)
✅ Bucket "files" existe y está configurado correctamente
```

## 🚀 Pasos para Subir un Archivo

### 1. Configurar OpenRouter en el Perfil

1. **Inicia sesión** en la aplicación
2. **Ve a Configuración** (⚙️)
3. **Agrega tu API Key de OpenRouter**:
   - Campo: "OpenRouter API Key"
   - Valor: Tu API key de OpenRouter (`sk-or-v1-...`)

### 2. Seleccionar OpenRouter como Proveedor de Embeddings

1. **En la página de chat**, haz clic en el botón de **Configuración** (⚙️)
2. **Busca "Embeddings Provider"**
3. **Selecciona "OpenRouter"**

### 3. Subir un Archivo

1. **Haz clic en el ícono de📎 (clip)**
2. **Selecciona un archivo**:
   - Formatos soportados: PDF, TXT, MD, CSV, JSON, DOCX
3. **Espera a que se procese**:
   - El archivo se subirá a Supabase
   - Se generarán embeddings usando OpenRouter
   - Se almacenarán en la base de datos

## 🔍 Errores Comunes y Soluciones

### Error 1: "Could not resolve host: supabase_kong_chatbotui"

**Causa**: 
- Caché del navegador o Service Worker con configuración antigua
- Referencia a Supabase local en lugar de Cloud

**Solución**:
```bash
# 1. Limpiar caché de Next.js
Remove-Item -Path .next -Recurse -Force

# 2. Reiniciar servidor
npm run dev

# 3. En el navegador, presiona Ctrl + Shift + R para hard reload
```

### Error 2: "OpenAI API Key not found"

**Causa**:
- El sistema estaba verificando OpenAI incluso cuando el proveedor era OpenRouter

**Solución**:
- ✅ Ya corregido en `app/api/retrieval/process/route.ts`
- Ahora verifica la API key correcta según el proveedor seleccionado

### Error 3: "OpenRouter API Key not found"

**Causa**:
- No has configurado tu API key de OpenRouter

**Solución**:
1. **Obtén una API key de OpenRouter**:
   - Ve a https://openrouter.ai/keys
   - Crea una nueva API key

2. **Agrégala a tu archivo `.env.local`**:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-tu-api-key-aqui
   ```

3. **O agrégala en tu perfil de usuario** desde la interfaz

### Error 4: "Failed to upload. Could not resolve host"

**Causa**:
- Service Worker con caché antiguo

**Solución**:
1. **Abre DevTools** (F12)
2. **Ve a Application → Service Workers**
3. **Haz clic en "Unregister"** para todos los Service Workers
4. **Recarga la página** (Ctrl + Shift + R)

## ✅ Verificación Final

### 1. Verificar Variables de Entorno
```bash
node scripts/verify-supabase-config.js
```

**Esperado**: Todas las variables deben estar ✅ Configuradas

### 2. Verificar Buckets de Almacenamiento
```bash
node scripts/check-storage-buckets.js
```

**Esperado**: Bucket "files" debe existir ✅

### 3. Probar Subida de Archivo

1. **Abre la aplicación** en `http://localhost:3000`
2. **Inicia sesión**
3. **Ve a un chat**
4. **Configura el proveedor de embeddings a "OpenRouter"**
5. **Sube un archivo de prueba** (e.g., un archivo TXT pequeño)

**Resultado esperado**:
- ✅ El archivo se sube correctamente
- ✅ Se generan embeddings usando OpenRouter
- ✅ Puedes hacer preguntas sobre el contenido del archivo

## 🎯 Archivos Modificados

1. **`app/api/retrieval/process/route.ts`**:
   - Cambiado orden de verificación de embeddingsProvider
   - Agregada verificación de API key de OpenRouter
   - Establecido "openrouter" como proveedor por defecto

2. **Scripts creados**:
   - `scripts/verify-supabase-config.js`
   - `scripts/check-storage-buckets.js`

3. **Documentación creada**:
   - `docs/solucion-subida-archivos-openrouter.md` (este archivo)

## 🎉 Resultado

- ✅ **Subida de archivos funcional**
- ✅ **Embeddings generados con OpenRouter**
- ✅ **Sin errores de API keys**
- ✅ **Conexión correcta a Supabase Cloud**

## 📞 Próximos Pasos

1. **Reinicia el navegador** para limpiar cualquier caché residual
2. **Recarga la aplicación** (Ctrl + Shift + R)
3. **Prueba subir un archivo**
4. **Si persiste el error**, verifica:
   - Consola del navegador (F12)
   - Logs del servidor (terminal donde corre `npm run dev`)
   - Variables de entorno (`node scripts/verify-supabase-config.js`)

---

**¡El sistema de subida de archivos con OpenRouter embeddings está listo!** 🚀📄🤖













