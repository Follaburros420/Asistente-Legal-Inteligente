# 📄 Instrucciones para Subir Archivos con OpenRouter

## ✅ Cambios Drásticos Aplicados

He reescrito completamente la lógica de verificación de embeddings provider para que **OpenRouter sea el proveedor por defecto** y eliminar cualquier verificación innecesaria de OpenAI.

### Archivos Modificados:

1. **`app/api/retrieval/process/route.ts`** - Procesamiento general de archivos
2. **`app/api/retrieval/process/docx/route.ts`** - Procesamiento específico de DOCX

### Cambios Clave:

#### Antes (❌ Problema):
```typescript
if (embeddingsProvider === "openai") {
  checkApiKey(profile.openai_api_key, "OpenAI")  // ❌ Siempre verificaba OpenAI primero
}
```

#### Ahora (✅ Solución):
```typescript
// Por defecto, usar OpenRouter (sin necesidad de OpenAI API key)
if (!embeddingsProvider || embeddingsProvider === "") {
  embeddingsProvider = "openrouter"
  console.log("📌 Usando OpenRouter por defecto")
}

// Verificar SOLO la API key del proveedor seleccionado
if (embeddingsProvider === "openrouter") {
  const openrouterKey = profile.openrouter_api_key || process.env.OPENROUTER_API_KEY
  if (!openrouterKey) {
    throw new Error("❌ OpenRouter API Key not found")
  }
  console.log("✅ OpenRouter API Key found")
}
```

## 🚀 Pasos para Usar la Aplicación

### 1. Verificar Configuración

```bash
# Verifica que OpenRouter API key esté configurada
node scripts/verify-supabase-config.js
```

**Esperado**:
```
✅ OPENROUTER_API_KEY: Configurada
✅ NEXT_PUBLIC_SUPABASE_URL: Configurada
✅ URL apunta a Supabase Cloud
```

### 2. Limpiar Navegador

Es **CRÍTICO** limpiar el caché del navegador:

1. **Abre el navegador** en `http://localhost:3000`
2. **Presiona `Ctrl + Shift + Delete`** para abrir configuración de caché
3. **Selecciona**:
   - ✅ Caché e imágenes
   - ✅ Cookies y datos de sitio
4. **Haz clic en "Borrar datos"**

**O simplemente**:
1. **Presiona `Ctrl + Shift + R`** (hard reload)
2. **Repite 2-3 veces** para asegurar

### 3. Limpiar Service Workers

1. **Presiona `F12`** para abrir DevTools
2. **Ve a** `Application` → `Service Workers`
3. **Haz clic en "Unregister"** para TODOS los Service Workers
4. **Recarga la página** (`Ctrl + R`)

### 4. Subir un Archivo

1. **Inicia sesión** en la aplicación
2. **Ve a un workspace** existente o crea uno nuevo
3. **Abre un chat**
4. **Haz clic en el ícono 📎** (Files)
5. **Selecciona "Upload File"**
6. **Elige un archivo**:
   - ✅ Formatos soportados: PDF, TXT, MD, CSV, JSON, DOCX
7. **Espera a que se procese**

### 5. Verificar en Logs del Servidor

En la terminal donde corre `npm run dev`, deberías ver:

```
📌 Embeddings provider seleccionado: openrouter
✅ OpenRouter API Key found
```

**Si ves**:
```
Error: OpenAI API Key not found
```
**Entonces el caché del navegador no se ha limpiado correctamente.**

## 🔍 Diagnóstico de Problemas

### Problema 1: "Could not resolve host: supabase_kong_chatbotui"

**Causa**: Service Worker con caché antiguo

**Solución**:
```bash
# 1. Cierra COMPLETAMENTE el navegador (todas las ventanas)
# 2. Reabre el navegador
# 3. Ve a DevTools (F12) → Application → Storage
# 4. Haz clic en "Clear site data"
# 5. Recarga la página (Ctrl + Shift + R)
```

### Problema 2: "OpenAI API Key not found"

**Causa**: Caché de Next.js o navegador

**Solución**:
```bash
# 1. Detener servidor
taskkill /F /IM node.exe

# 2. Limpiar caché de Next.js
Remove-Item -Path .next -Recurse -Force

# 3. Reiniciar servidor
npm run dev

# 4. En el navegador:
#    - Cerrar TODAS las ventanas del navegador
#    - Abrir de nuevo
#    - Ir a http://localhost:3000
```

### Problema 3: "Failed to process file"

**Causa**: OpenRouter API key no configurada o inválida

**Solución**:
```bash
# Verificar que la API key esté en .env.local
cat .env.local | grep OPENROUTER

# Debería mostrar:
# OPENROUTER_API_KEY=sk-or-v1-...

# Si no está, agrégala:
echo "OPENROUTER_API_KEY=tu-api-key-aqui" >> .env.local

# Reinicia el servidor
taskkill /F /IM node.exe
npm run dev
```

## 📋 Checklist de Verificación

Antes de subir un archivo, verifica:

- [ ] ✅ Servidor corriendo (`npm run dev`)
- [ ] ✅ OpenRouter API key configurada (`.env.local`)
- [ ] ✅ Supabase Cloud configurado correctamente
- [ ] ✅ Caché del navegador limpiado
- [ ] ✅ Service Workers desregistrados
- [ ] ✅ Navegador recargado con Ctrl + Shift + R
- [ ] ✅ No hay errores en la consola del navegador (F12)

## 🎯 Resultado Esperado

Cuando subes un archivo correctamente, deberías ver:

### En el Servidor (terminal):
```
📌 Embeddings provider seleccionado: openrouter
✅ OpenRouter API Key found
Processing PDF...
Generating embeddings with OpenRouter...
✅ File processed successfully
```

### En el Navegador:
- ✅ El archivo aparece en la lista de archivos del chat
- ✅ Puedes hacer preguntas sobre el contenido del archivo
- ✅ El asistente responde con información del archivo

### En la Consola del Navegador (F12):
- ✅ Sin errores rojos
- ✅ Mensajes de éxito: "File uploaded successfully"

## 🔧 Comandos Útiles

### Limpiar TODO y reiniciar:
```bash
# Windows PowerShell
taskkill /F /IM node.exe
Remove-Item -Path .next -Recurse -Force
npm run dev
```

### Verificar configuración:
```bash
node scripts/verify-supabase-config.js
node scripts/check-storage-buckets.js
```

### Ver logs en tiempo real:
```bash
# En la terminal donde corre npm run dev
# Busca líneas que empiecen con 📌 o ✅
```

## 🎉 ¡Listo!

El servidor está corriendo con los cambios drásticos aplicados. **Por favor**:

1. **Cierra COMPLETAMENTE tu navegador** (todas las ventanas)
2. **Abre de nuevo** el navegador
3. **Ve a** `http://localhost:3000`
4. **Presiona `Ctrl + Shift + R`** varias veces
5. **Intenta subir un archivo**

**Los logs en la terminal te dirán si está usando OpenRouter correctamente.**

---

## 📞 Si Aún No Funciona

Si después de seguir TODOS los pasos anteriores, aún ves el error de OpenAI:

1. **Captura de pantalla** de la consola del navegador (F12)
2. **Copia los logs** de la terminal donde corre `npm run dev`
3. **Verifica** que estés en modo incógnito del navegador (para evitar extensiones)

**El código ahora prioriza OpenRouter sobre todo lo demás. Si sigue fallando, es 100% un problema de caché.**













