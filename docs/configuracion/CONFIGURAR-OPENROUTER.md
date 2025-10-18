# 🔑 Configuración de OpenRouter API Key

## ⚠️ **IMPORTANTE - LEE ESTO PRIMERO**

Para usar el modelo **Tongyi Deep Research 30B** de OpenRouter, necesitas configurar una **API Key de OpenRouter**.

---

## 🚀 **PASO 1: Obtener tu API Key de OpenRouter**

1. **Ve a OpenRouter**: https://openrouter.ai/
2. **Crea una cuenta** o **inicia sesión**
3. **Ve a la sección de API Keys**: https://openrouter.ai/keys
4. **Crea una nueva API Key**
5. **Copia la API Key** (se verá algo como: `sk-or-v1-...`)

---

## 🔧 **PASO 2: Configurar la API Key**

### **Opción A: Variable de Entorno (Recomendado)**

1. **Crea un archivo** llamado `.env.local` en la raíz del proyecto
2. **Agrega la siguiente línea**:
   ```
   OPENROUTER_API_KEY=sk-or-v1-tu-api-key-aqui
   ```
3. **Reemplaza** `sk-or-v1-tu-api-key-aqui` con tu API Key real
4. **Reinicia el servidor**:
   ```bash
   npm run dev
   ```

### **Opción B: Perfil de Usuario**

1. **Inicia sesión** en la aplicación
2. **Ve a Configuración** (Settings)
3. **Busca el campo "OpenRouter API Key"**
4. **Pega tu API Key**
5. **Guarda los cambios**

---

## ✅ **PASO 3: Verificar la Configuración**

1. **Accede a la aplicación**: http://localhost:3000/es/login
2. **Inicia sesión** con cualquier usuario
3. **Escribe un mensaje** en el chat
4. **Verifica que funcione** sin errores

---

## 📋 **Configuración Actual del Sistema**

### **Modelo por Defecto** ✅
- **Modelo**: `alibaba/tongyi-deepresearch-30b-a3b`
- **Proveedor**: OpenRouter
- **Búsqueda automática**: Habilitada
- **Interfaz**: Limpia sin componentes innecesarios

### **Archivos Actualizados** ✅
- `app/api/chat/openrouter/route.ts` - Usa variable de entorno o perfil
- `components/utility/global-state.tsx` - Modelo Tongyi por defecto
- `components/chat/chat-hooks/use-chat-handler.tsx` - Provider OpenRouter
- Base de datos - Todos los modelos actualizados

---

## 🔍 **Solución de Problemas**

### **Error: "OpenRouter API Key no configurada"**
- **Causa**: No has configurado la API Key
- **Solución**: Sigue el PASO 2 arriba

### **Error: "invalid model ID"**
- **Causa**: La API Key no está configurada correctamente
- **Solución**: 
  1. Verifica que la API Key esté en `.env.local` o en tu perfil
  2. Reinicia el servidor
  3. Recarga la página

### **Error: "Authentication failed"**
- **Causa**: La API Key es inválida o expiró
- **Solución**: 
  1. Ve a https://openrouter.ai/keys
  2. Genera una nueva API Key
  3. Actualiza la configuración

---

## 💡 **Consejos**

- **Usa la Opción A (Variable de Entorno)** - Es más segura y funciona para todos los usuarios
- **No compartas tu API Key** - Es privada y confidencial
- **Añade créditos** - OpenRouter requiere créditos para usar modelos (algunos son gratuitos)
- **Verifica el saldo** - Ve a https://openrouter.ai/activity

---

## 🎯 **Siguiente Paso**

Una vez configurada la API Key:

1. **Reinicia el servidor**: `npm run dev`
2. **Recarga la página**: http://localhost:3000/es/login
3. **Envía un mensaje**: Debe funcionar sin errores
4. **Disfruta**: Tongyi Deep Research está listo para usar

---

## 📚 **Recursos**

- **OpenRouter Docs**: https://openrouter.ai/docs
- **Modelos Disponibles**: https://openrouter.ai/models
- **Tongyi Deep Research**: https://openrouter.ai/models/alibaba/tongyi-deepresearch-30b-a3b
- **Pricing**: https://openrouter.ai/models (algunos modelos son gratuitos)

---

**¡Listo para usar Tongyi Deep Research!** 🎉
