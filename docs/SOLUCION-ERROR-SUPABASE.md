# Solución al Error de Supabase

## Error

```
Error: Could not resolve host: supabase_kong_chatbotui
```

Este error ocurre cuando intentas eliminar un asistente u otras operaciones en la base de datos.

## Causa

El problema tiene dos posibles causas:

1. **Estás usando Supabase Local pero no está corriendo**
2. **Las variables de entorno no están configuradas correctamente**

## Solución

### Opción 1: Usar Supabase Cloud (Recomendado)

Si quieres usar Supabase Cloud en lugar de local:

1. **Verifica tu archivo `.env.local`**:

```env
# Supabase Cloud
NEXT_PUBLIC_SUPABASE_URL=https://tu-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui

# Otros
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
```

2. **Obtén tus credenciales de Supabase Cloud**:
   - Ve a https://app.supabase.com
   - Selecciona tu proyecto
   - Ve a Settings → API
   - Copia:
     - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
     - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Mantén esto en secreto)

3. **Reinicia el servidor**:
```bash
npm run dev
```

### Opción 2: Usar Supabase Local

Si prefieres usar Supabase local:

1. **Instala Supabase CLI**:
```bash
npm install -g supabase
```

2. **Inicia Supabase local**:
```bash
supabase start
```

3. **Copia las credenciales que aparecen**:
```
API URL: http://localhost:54321
anon key: eyJh...
service_role key: eyJh...
```

4. **Actualiza tu `.env.local`**:
```env
# Supabase Local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...tu-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJh...tu-service-role-key...
```

5. **Reinicia el servidor**:
```bash
npm run dev
```

## Verificación

Para verificar que la conexión funciona correctamente:

1. Abre la consola del navegador (F12)
2. Deberías ver un mensaje: `🔧 Configurando cliente de Supabase: { url: '...', hasAnonKey: true }`
3. No deberían aparecer errores de conexión

## Nota Importante

⚠️ **NUNCA** compartas tu `SUPABASE_SERVICE_ROLE_KEY` en repositorios públicos. Este key tiene acceso total a tu base de datos.

## Variables de Entorno Completas

Aquí está un ejemplo completo de `.env.local`:

```env
# Supabase Cloud (usa SOLO UNO de los dos)
NEXT_PUBLIC_SUPABASE_URL=https://tu-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# OpenRouter (para usar LLMs via OpenRouter)
OPENROUTER_API_KEY=tu-openrouter-key

# Tongyi/Qwen (si lo usas)
QWEN_API_KEY=tu-qwen-key

# Otros servicios opcionales
FIRECRAWL_API_KEY=tu-firecrawl-key  # Para web scraping
GOOGLE_CSE_API_KEY=tu-google-api-key  # Para búsqueda web
GOOGLE_CSE_ID=tu-custom-search-engine-id

# Ollama (para modelos locales)
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
```

## Errores Comunes

### Error: "Invalid Supabase URL"
- Asegúrate de que tu URL comienza con `https://` para cloud o `http://` para local
- Para cloud debe terminar en `.supabase.co`

### Error: "Authentication error"
- Verifica que tu `ANON_KEY` sea correcta
- Si acabas de crear el proyecto, espera unos minutos

### Error: "No rows returned"
- Esto es normal si el recurso no existe
- Verifica que estés en el workspace correcto

## Soporte Adicional

Si el problema persiste:
1. Revisa los logs de Supabase en https://app.supabase.com → Logs
2. Verifica que las migraciones se hayan ejecutado correctamente
3. Consulta la documentación oficial: https://supabase.com/docs

