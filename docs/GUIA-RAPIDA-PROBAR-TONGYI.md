# 🚀 Guía Rápida: Probar Tongyi en Español + Fuentes

## ✅ ¿Qué se arregló?

### Problema 1: Caracteres chinos ❌
**Antes:**
```
...personajes que representan缺陷es de la adultez...
```

**Después:**
```
...personajes que representan defectos de la adultez...
```

### Problema 2: Sin fuentes web ❌
**Antes:**
```
[Solo respuesta sin fuentes]
```

**Después:**
```
[Respuesta completa]

---
📚 **Fuentes consultadas:**
- [Wikipedia: Tema](https://ejemplo.com)
- [Fuente 2](https://ejemplo2.com)
```

---

## 🧪 Cómo Probar (5 pasos)

### 1️⃣ Abre Modo Incógnito
- **Chrome/Edge**: `Ctrl + Shift + N`
- **Firefox**: `Ctrl + Shift + P`

**¿Por qué?** Para evitar caché del navegador antiguo.

---

### 2️⃣ Ve a la aplicación
```
http://localhost:3000
```

Verifica que el servidor esté corriendo (debe mostrar la interfaz).

---

### 3️⃣ Crea un NUEVO chat

⚠️ **IMPORTANTE**: NO uses chats antiguos, crea uno nuevo.

**Pasos:**
1. Haz clic en el botón "+"
2. Selecciona modelo Tongyi (ej: `qwen/qwen-2.5-7b-instruct`)
3. Crea el chat

---

### 4️⃣ Test: Verificar idioma español

**Pregunta de prueba:**
```
Resume la historia del Principito y sus personajes principales
```

**Resultado esperado:**
- ✅ Respuesta completamente en español
- ✅ SIN caracteres chinos (缺陷, 问题, etc.)
- ✅ Palabras como "defectos", "personajes", "viaje", etc.

**Verificación:**
```
✅ CORRECTO: "...el Principito viaja entre planetas conociendo personajes que representan defectos de la adultez..."

❌ INCORRECTO: "...el Principito viaja entre planetas conociendo personajes que representan缺陷es de la adultez..."
```

---

### 5️⃣ Test: Verificar búsqueda web con fuentes

**Pregunta de prueba:**
```
¿Cuáles son las últimas noticias sobre inteligencia artificial en Colombia?
```

**Resultado esperado:**
```
[Respuesta con información actualizada]

---
📚 **Fuentes consultadas:**
- [Fuente 1: Título](https://url1.com)
- [Fuente 2: Título](https://url2.com)
```

**⚠️ Nota importante sobre búsqueda web:**

No todos los modelos Tongyi tienen búsqueda web incorporada. Si no ves fuentes:
1. No es un error del código
2. Es una limitación del modelo específico
3. Puedes cambiar a un modelo con búsqueda garantizada como Perplexity

---

## 📊 Test con Documento (Opcional)

### Paso 1: Crear archivo de prueba

Crea un archivo `test-principito.txt`:
```
El Principito vive en el asteroide B-612.
Tiene una rosa que es muy especial para él.
Un día conoce a un zorro que le enseña sobre la amistad.
La frase más importante es: "Lo esencial es invisible para los ojos".
```

### Paso 2: Subir el archivo

1. En el chat, haz clic en el botón **Files** (📁)
2. Selecciona `test-principito.txt`
3. Espera a que se procese

**Logs esperados en la terminal:**
```
🔥 FORZANDO embeddingsProvider a 'openai'
✅ OpenAI API Key found
Processing file...
✅ Generated embeddings successfully
```

### Paso 3: Hacer pregunta sobre el documento

**Pregunta:**
```
¿En qué asteroide vive el Principito según el documento?
```

**Resultado esperado:**
```
Según el documento, el Principito vive en el asteroide B-612.
```

**Verificación:**
- ✅ Respuesta en español (sin caracteres chinos)
- ✅ Menciona información específica del archivo (B-612)
- ✅ Cita el documento como fuente

---

## 🐛 Troubleshooting

### ❌ Sigue escribiendo en chino

**Causa:** Caché del navegador o chat antiguo

**Solución:**
1. Cierra TODAS las ventanas del navegador
2. Abre modo incógnito
3. Ve a `http://localhost:3000`
4. Crea un NUEVO chat
5. Prueba de nuevo

---

### ❌ No muestra fuentes web

**Causa posible 1:** El modelo no tiene búsqueda incorporada

**Solución:**
- Esto es normal para algunos modelos Tongyi
- Considera cambiar a `perplexity/llama-3.1-sonar-large-128k-online`
- O usar un modelo Qwen específico con búsqueda

**Causa posible 2:** La pregunta no requiere búsqueda actualizada

**Solución:**
- Haz preguntas explícitas sobre actualidad
- Ejemplo: "noticias de hoy", "eventos recientes", "últimas novedades"

---

### ❌ Error al subir archivo

**Logs esperados:**
```
🔥 FORZANDO embeddingsProvider a 'openai'
✅ OpenAI API Key found
```

**Si ves:**
```
❌ OpenAI API Key not found
```

**Solución:**
1. Verifica que `.env` tiene la API key:
   ```bash
   Get-Content .env | Select-String "OPENAI"
   ```
2. Reinicia el servidor completamente:
   ```bash
   taskkill /F /IM node.exe
   npm run dev
   ```

---

### ❌ Error 429: Quota exceeded (OpenAI)

**Causa:** La API key de OpenAI no tiene créditos

**Solución:**
1. Ve a: https://platform.openai.com/settings/organization/billing
2. Verifica tu balance
3. Agrega créditos ($5 es suficiente para meses)
4. O usa una API key diferente

---

## 🎯 Checklist Final

Antes de probar:
- [x] Servidor reiniciado (`npm run dev`)
- [x] Configuración verificada (`node scripts/test-tongyi-config.js`)
- [ ] Navegador en modo incógnito
- [ ] Nuevo chat creado
- [ ] Modelo Tongyi seleccionado (ej: `qwen/qwen-2.5-7b-instruct`)

Después de probar:
- [ ] ✅ Respuesta en español (sin caracteres chinos)
- [ ] ✅ Archivo subido correctamente
- [ ] ✅ Tongyi responde basándose en el documento
- [ ] ⚠️ Fuentes web mostradas (si el modelo soporta búsqueda)

---

## 📞 Resultados Esperados

### ✅ Funcionando Correctamente:

```
Usuario: Resume la historia del Principito

Tongyi: El Principito es una novela corta escrita por Antoine de Saint-Exupéry
en 1943. La historia narra las aventuras de un niño que viaja de planeta en 
planeta, conociendo personajes que representan defectos de la adultez, como 
un rey obsesionado con el poder, un vanidoso, un bebedor, etc.

Al llegar a la Tierra, conoce a un zorro que le enseña la importancia de las 
relaciones humanas con la célebre frase: "Lo esencial es invisible para los ojos".

La novela critica la perspectiva materialista de los adultos y celebra la 
inocencia y sabiduría infantil.
```

**Verificación:**
- ✅ TODO en español
- ✅ Cero caracteres chinos
- ✅ Respuesta clara y coherente

---

### ⚠️ Limitación del Modelo (Normal):

Si no ves fuentes web:
```
Usuario: ¿Cuáles son las noticias actuales sobre IA?

Tongyi: No tengo acceso a información actualizada en tiempo real...
```

**Esto NO es un error**. Simplemente significa que el modelo no tiene búsqueda incorporada.

**Alternativas:**
1. Cambiar a Perplexity (con búsqueda garantizada)
2. Usar un modelo Qwen específico con búsqueda
3. Implementar búsqueda manual con Brave/Serper API (requiere desarrollo adicional)

---

## 🚀 ¡Listo para Probar!

El servidor debe estar corriendo. Verifica con:
```bash
# En otra terminal
curl http://localhost:3000
```

Si responde, el servidor está activo. ¡Ahora prueba siguiendo los 5 pasos! 🎉














