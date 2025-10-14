# 🧪 Guía Rápida: Probar Búsqueda Web

## 🎯 ¿Qué se implementó?

Tongyi ahora tiene **búsqueda web automática** usando herramientas **100% open source**:

- ✅ **SearXNG**: Metabuscador (no necesita API key)
- ✅ **Jina AI Reader**: Extractor de contenido (gratuito)
- ✅ **Detección automática**: El sistema detecta cuándo buscar
- ✅ **Fuentes con hipervínculos**: Verificables

---

## 🚀 Prueba en 3 Pasos

### 1️⃣ Abre el chat

- Modo incógnito: `Ctrl + Shift + N`
- Ve a: `http://localhost:3000`
- Crea un **NUEVO** chat con Tongyi

### 2️⃣ Haz una pregunta que requiera búsqueda

```
¿Cuándo murió Ozzy Osbourne?
```

### 3️⃣ Observa los resultados

**En la terminal verás:**
```
🌐 Detectada necesidad de búsqueda web para: "¿Cuándo murió Ozzy Osbourne?"
🔍 Buscando en web: "¿Cuándo murió Ozzy Osbourne?"
📡 Intentando con: https://searx.be
✅ Encontrados 5 resultados usando https://searx.be
📚 Extrayendo contenido de los primeros 2 resultados...
✅ Búsqueda web completada: 3 resultados
🌐 Tongyi: Configurado para español + búsqueda web
```

**En el chat verás:**
```
Según la información disponible, Ozzy Osbourne sigue con vida. 
Nació el 3 de diciembre de 1948 y es un cantante y músico inglés 
famoso como el vocalista de la banda Black Sabbath.

---
📚 **Fuentes consultadas:**
- [Wikipedia: Ozzy Osbourne](https://es.wikipedia.org/wiki/Ozzy_Osbourne)
- [Biography.com: Ozzy Osbourne](https://www.biography.com/musicians/ozzy-osbourne)
```

---

## 📝 Más Preguntas de Prueba

### Test 1: Actualidad
```
¿Cuáles son las últimas noticias sobre inteligencia artificial en Colombia?
```

### Test 2: Eventos Recientes
```
¿Qué eventos importantes ocurrieron hoy en el mundo?
```

### Test 3: Información Legal
```
¿Cuál es la ley actual sobre protección de datos personales en Colombia?
```

### Test 4: Comparativas
```
¿Cuáles son los mejores modelos de IA de código abierto en 2025?
```

### Test 5: Información en Tiempo Real
```
¿Cuál es el precio actual del Bitcoin?
```

---

## ✅ Qué Verificar

### En la Respuesta:

- [x] TODO en español (sin caracteres chinos)
- [x] Información actualizada de internet
- [x] Sección "📚 Fuentes consultadas:" al final
- [x] Enlaces clickeables a las fuentes

### En la Terminal:

- [x] Logs de detección de búsqueda
- [x] Logs de SearXNG
- [x] Logs de Jina AI Reader
- [x] "✅ Búsqueda web completada"

---

## 🐛 Si Algo Sale Mal

### Problema: No aparecen fuentes

**Causa:** La pregunta no activó búsqueda automática

**Solución:** Usa palabras clave explícitas:
- "últimas noticias"
- "información actual"
- "¿cuándo murió...?"
- "busca información sobre..."

### Problema: Error en terminal

**Causa:** Instancias de SearXNG caídas

**Solución:** El sistema probará con 5 instancias diferentes automáticamente. Si todas fallan, revisa tu conexión a internet.

### Problema: Respuesta lenta

**Normal:** La búsqueda web toma 5-15 segundos:
- 10s: Buscar en SearXNG
- 15s: Extraer contenido con Jina AI
- Total: ~25s máximo

---

## 📊 Palabras Clave que Activan Búsqueda

El sistema detecta estas palabras automáticamente:

**Actualidad:**
- noticias, actualidad, reciente, últimas, hoy, actual, novedades

**Búsqueda explícita:**
- busca, investiga, verifica, encuentra, información sobre

**Eventos:**
- murió, falleció, cuando murió, cuándo falleció

**Información en tiempo real:**
- precio, cotización, clima, temperatura

**Comparativas:**
- mejores, top, ranking, comparar

**Legal:**
- ley actual, reforma, nueva ley, sentencia reciente

---

## 🎯 Ejemplo Completo

### Pregunta:
```
¿Cuándo murió Ozzy Osbourne?
```

### Terminal (logs):
```
🌐 Detectada necesidad de búsqueda web para: "¿Cuándo murió Ozzy Osbourne?"
🔍 Buscando en web: "¿Cuándo murió Ozzy Osbourne?"
📡 Intentando con: https://searx.be
✅ Encontrados 5 resultados usando https://searx.be
📚 Extrayendo contenido de los primeros 2 resultados...
📄 Extrayendo contenido de: https://es.wikipedia.org/wiki/Ozzy_Osbourne
✅ Contenido extraído: 2891 caracteres
📄 Extrayendo contenido de: https://www.biography.com/musicians/ozzy-osbourne
✅ Contenido extraído: 2456 caracteres
✅ Búsqueda web completada: 3 resultados
🌐 Tongyi: Configurado para español + búsqueda web
```

### Respuesta (en el chat):
```
De acuerdo con la información disponible, Ozzy Osbourne (considerando que "Ozzi"
probablemente se refiere a él) sigue con vida. Nació el 3 de diciembre de 1948 y es un
cantante y músico inglés famoso como el vocalista de la banda Black Sabbath.

No hay información verificada sobre su fallecimiento. Si se refiere a otra persona llamada
Ozzi, necesitaría más contexto para poder proporcionar una respuesta precisa.

Si su pregunta se refiere a un evento específico o a otra persona con ese nombre, por favor
proporcione más detalles para poder ayudarle mejor.

---
📚 **Fuentes consultadas:**
- [Wikipedia: Ozzy Osbourne](https://es.wikipedia.org/wiki/Ozzy_Osbourne)
- [Biography.com: Ozzy Osbourne](https://www.biography.com/musicians/ozzy-osbourne)
- [Rolling Stone: Ozzy Osbourne](https://www.rollingstone.com/music/music-news/ozzy-osbourne)
```

---

## 🚀 ¡Todo Listo!

El servidor debería estar corriendo. Solo:

1. **Abre modo incógnito**
2. **Ve a** `http://localhost:3000`
3. **Pregunta**: "¿Cuándo murió Ozzy Osbourne?"
4. **Observa** los logs en la terminal
5. **Verifica** que la respuesta incluya fuentes

**¡Disfruta de Tongyi con búsqueda web open source!** 🎉














