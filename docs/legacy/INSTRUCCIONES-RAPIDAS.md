# ⚡ Instrucciones Rápidas - Tongyi Deep Research

## 🎯 **PROBLEMA**
Error: `{"message":"invalid model ID"}`

## ✅ **SOLUCIÓN**
Necesitas configurar tu **API Key de OpenRouter**

---

## 🚀 **PASOS (5 minutos)**

### **1. Obtén tu API Key**
- Ve a: https://openrouter.ai/keys
- Crea cuenta o inicia sesión
- Crea nueva API Key
- Copia la key (empieza con `sk-or-v1-...`)

### **2. Configura la API Key**
- Crea archivo `.env.local` en la raíz del proyecto
- Agrega esta línea:
  ```
  OPENROUTER_API_KEY=sk-or-v1-tu-api-key-aqui
  ```
- Reemplaza `sk-or-v1-tu-api-key-aqui` con tu key real

### **3. Reinicia el servidor**
```bash
npm run dev
```

### **4. Prueba**
- Ve a: http://localhost:3000/es/login
- Envía un mensaje
- Debe funcionar sin errores

---

## 📋 **CONFIGURACIÓN ACTUAL**

✅ **Modelo**: `alibaba/tongyi-deepresearch-30b-a3b`  
✅ **Proveedor**: OpenRouter  
✅ **Búsqueda**: Automática y siempre activa  
✅ **Interfaz**: Limpia sin componentes  
⚠️ **Pendiente**: Configurar API Key

---

## 💡 **ARCHIVO DE EJEMPLO**

Ver: `ENV-EXAMPLE.txt` para instrucciones detalladas sobre cómo crear el archivo `.env.local`

---

## 📚 **MÁS INFORMACIÓN**

- **Guía completa**: `CONFIGURAR-OPENROUTER.md`
- **Solución técnica**: `SOLUCION-TONGYI-OPENROUTER-FINAL.md`

---

**¡Solo necesitas configurar tu API Key y funcionará!** 🎉
