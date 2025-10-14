# Configuración de Supabase Cloud

## Variables de Entorno Requeridas

Para conectar tu aplicación con Supabase Cloud, necesitas crear un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```env
# Supabase Cloud Configuration
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui

# OpenRouter API Key para embeddings
OPENROUTER_API_KEY=tu_clave_de_openrouter_aqui

# Otras APIs opcionales
# OPENAI_API_KEY=tu_clave_de_openai_si_la_necesitas
# ANTHROPIC_API_KEY=tu_clave_de_anthropic_si_la_necesitas
```

## Cómo Obtener las Credenciales de Supabase

### 1. URL del Proyecto (NEXT_PUBLIC_SUPABASE_URL)
1. Ve a [supabase.com](https://supabase.com)
2. Inicia sesión en tu cuenta
3. Selecciona tu proyecto
4. Ve a Settings → API
5. Copia la "Project URL" (algo como `https://abcdefghijklmnop.supabase.co`)

### 2. Service Role Key (SUPABASE_SERVICE_ROLE_KEY)
1. En la misma página de Settings → API
2. Busca la sección "Project API keys"
3. Copia la "service_role" key (⚠️ **MANTÉN ESTA CLAVE SEGURA**)
4. Esta clave tiene permisos administrativos completos

### 3. Anon Key (opcional, para cliente)
1. En la misma sección
2. Copia la "anon" key
3. Esta se usa para operaciones del lado del cliente

## Configuración Completa

### Archivo .env.local
```env
# Supabase Cloud
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenRouter para embeddings
OPENROUTER_API_KEY=sk-or-v1-tu-clave-openrouter...

# Opcional: Otras APIs
# OPENAI_API_KEY=sk-tu-clave-openai...
# ANTHROPIC_API_KEY=sk-ant-tu-clave-anthropic...
```

## Verificación de la Configuración

### 1. Reiniciar el Servidor
```bash
npm run dev
```

### 2. Verificar Conexión
- Abre la aplicación en el navegador
- Intenta subir un archivo
- Debería funcionar sin errores de conectividad

### 3. Verificar en Supabase Dashboard
- Ve a tu proyecto en Supabase
- Revisa la tabla `files` y `file_items`
- Deberías ver los archivos subidos

## Solución de Problemas

### Error: "Could not resolve host"
- Verifica que la URL de Supabase sea correcta
- Asegúrate de que no haya espacios extra en las variables

### Error: "Invalid API key"
- Verifica que la service_role key sea correcta
- Asegúrate de copiar la clave completa

### Error: "OpenRouter API key not found"
- Verifica que `OPENROUTER_API_KEY` esté configurada
- Reinicia el servidor después de agregar la variable

## Migración desde Supabase Local

Si estabas usando Supabase local:

1. **Detener Supabase local**:
   ```bash
   supabase stop
   ```

2. **Actualizar variables de entorno** con las credenciales de Cloud

3. **Reiniciar aplicación**:
   ```bash
   npm run dev
   ```

## Seguridad

⚠️ **IMPORTANTE**:
- Nunca commitees el archivo `.env.local` al repositorio
- La `service_role` key tiene permisos administrativos completos
- Mantén estas credenciales seguras y privadas















