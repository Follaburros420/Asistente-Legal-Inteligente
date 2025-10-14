# Configuración de OpenRouter para Embeddings

## Problema Resuelto

Se ha implementado soporte completo para usar OpenRouter como proveedor de embeddings en lugar de OpenAI, solucionando el error "OpenAI API Key not found".

## Cambios Implementados

### 1. Sistema de Embeddings de OpenRouter
- ✅ Implementado en `lib/generate-openrouter-embedding.ts`
- ✅ Soporte para múltiples modelos de embeddings
- ✅ Generación de embeddings individuales y en lote

### 2. Integración en APIs
- ✅ `app/api/retrieval/process/route.ts` - Procesamiento de archivos
- ✅ `app/api/retrieval/process/docx/route.ts` - Procesamiento de documentos DOCX
- ✅ `app/api/retrieval/retrieve/route.ts` - Recuperación de información

### 3. Interfaz de Usuario
- ✅ Agregado OpenRouter como opción en configuración de embeddings
- ✅ Actualizado formulario de configuración de chat
- ✅ Configurado como proveedor por defecto

### 4. Tipos y Configuración
- ✅ Actualizados tipos TypeScript para incluir "openrouter"
- ✅ Configuración global actualizada
- ✅ Workspace settings actualizados

## Configuración Requerida

### 1. Clave de API de OpenRouter
Necesitas crear un archivo `.env.local` en la raíz del proyecto con:

```env
# OpenRouter API Key para embeddings
OPENROUTER_API_KEY=tu_clave_de_openrouter_aqui

# Supabase Configuration (si usas local)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

### 2. Obtener Clave de OpenRouter
1. Ve a [OpenRouter.ai](https://openrouter.ai/)
2. Crea una cuenta o inicia sesión
3. Ve a la sección de API Keys
4. Genera una nueva clave
5. Cópiala al archivo `.env.local`

### 3. Modelos de Embeddings Disponibles
- `text-embedding-3-small` (por defecto) - 1536 dimensiones, bajo costo
- `text-embedding-3-large` - 3072 dimensiones, costo medio
- `text-embedding-ada-002` - 1536 dimensiones, bajo costo

## Uso

### En la Interfaz
1. Ve a Configuración de Chat
2. Selecciona "OpenRouter" como Embeddings Provider
3. Sube archivos normalmente - ahora usarán OpenRouter

### Programáticamente
```typescript
import { generateOpenRouterEmbedding } from '@/lib/generate-openrouter-embedding'

const embedding = await generateOpenRouterEmbedding('texto a procesar', 'text-embedding-3-small')
```

## Solución al Error de Supabase

El error "Could not resolve host: supabase_kong_chatbotui" indica un problema de conectividad. Para solucionarlo:

### Opción 1: Usar Supabase Local
```bash
# Instalar Supabase CLI
npm install -g supabase

# Iniciar Supabase localmente
supabase start
```

### Opción 2: Usar Supabase Cloud
1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Actualiza las variables de entorno con las URLs de tu proyecto

## Ventajas de OpenRouter

1. **Costo**: Generalmente más económico que OpenAI directo
2. **Flexibilidad**: Acceso a múltiples modelos de embeddings
3. **Confiabilidad**: Menos problemas de rate limiting
4. **Compatibilidad**: Usa los mismos modelos que OpenAI

## Troubleshooting

### Error: "OpenRouter API key not found"
- Verifica que `OPENROUTER_API_KEY` esté en `.env.local`
- Reinicia el servidor de desarrollo

### Error: "Failed to generate OpenRouter embeddings"
- Verifica que la clave de API sea válida
- Revisa los logs para más detalles del error

### Error de conectividad con Supabase
- Verifica que Supabase esté ejecutándose
- Revisa las URLs en las variables de entorno















