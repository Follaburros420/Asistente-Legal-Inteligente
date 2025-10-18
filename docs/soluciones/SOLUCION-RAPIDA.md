# ⚡ Solución Rápida al Error de Supabase

## Error Actual
```
Error: Could not resolve host: supabase_kong_chatbotui
```

## ✅ Tu Configuración está CORRECTA
Ya tienes configurado:
- `NEXT_PUBLIC_SUPABASE_URL=https://givjfonqaiqhsjjjzedc.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` está presente

## 🔧 El Problema
Next.js tiene la configuración antigua en caché (de cuando usabas Supabase local).

## 🚀 Solución en 3 Pasos

### Paso 1: Detén el servidor
Presiona `Ctrl + C` en la terminal donde corre `npm run dev`

### Paso 2: Limpia la caché
```bash
# Elimina la carpeta .next
Remove-Item -Recurse -Force .next

# Opcional: También limpia node_modules/.cache si existe
Remove-Item -Recurse -Force node_modules/.cache -ErrorAction SilentlyContinue
```

### Paso 3: Reinicia el servidor
```bash
npm run dev
```

## 🎯 Verificación

Después de reiniciar, en la consola del navegador (F12) deberías ver:
```
🔧 Configurando cliente de Supabase: { url: 'https://givjfonqaiqhsjjjzedc...', hasAnonKey: true }
```

## 💡 Si el Error Persiste

### Opción 1: Limpieza Completa (Recomendado)
```bash
# Detén el servidor (Ctrl + C)

# Limpia todo
Remove-Item -Recurse -Force .next
Remove-Item -Recurse -Force node_modules/.cache -ErrorAction SilentlyContinue

# Reinstala dependencias
npm install

# Reinicia
npm run dev
```

### Opción 2: Verifica las Variables
```bash
# En PowerShell, verifica que las variables se estén leyendo:
node -e "require('dotenv').config({path:'.env.local'}); console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

### Opción 3: Modo Desarrollo Limpio
```bash
# Detén todo
# Limpia
Remove-Item -Recurse -Force .next

# Inicia en modo limpio
npm run dev
```

## 📝 Notas Importantes

1. **NO necesitas cambiar tu `.env.local`** - Ya está bien configurado
2. **El problema es solo de caché** - No es un error de conectividad real
3. **Después de limpiar** - La primera carga puede tardar un poco más

## 🆘 Si Aún No Funciona

Envíame el output completo de:
```bash
npm run dev
```

Y también el contenido de:
```bash
Get-Content .env.local
```

