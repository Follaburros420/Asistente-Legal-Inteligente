# 🧪 Guía Rápida: Probar Firecrawl

## ✅ Pre-requisitos

- ✅ Firecrawl API Key agregada: `fc-eb5dbfa5b2384e8eb5fac8218b4c66fa`
- ✅ Código actualizado en `lib/tools/web-search.ts`
- ✅ Variables de entorno configuradas en `.env`

---

## 🚀 Pasos para Probar

### 1. Espera ~10 segundos ⏱️

Deja que Next.js compile los cambios automáticamente.

Verás en la terminal:
```
✓ Compiled in X.Xs
```

---

### 2. Cierra COMPLETAMENTE el navegador 🔴

**IMPORTANTE:** Cierra todas las ventanas y pestañas de tu navegador actual.

- Chrome: `Alt + F4` (cierra TODO)
- Firefox: `Alt + F4` (cierra TODO)
- Edge: `Alt + F4` (cierra TODO)

**NO solo cierres la pestaña, cierra TODO el navegador.**

---

### 3. Abre modo incógnito NUEVO 🕵️

- Chrome: `Ctrl + Shift + N`
- Firefox: `Ctrl + Shift + P`
- Edge: `Ctrl + Shift + N`

---

### 4. Ve a `http://localhost:3000` 🌐

O `http://localhost:3001` si usas otro puerto.

---

### 5. Crea un NUEVO chat ➕

**NO uses un chat viejo.**

1. Click en "New Chat"
2. O presiona `Ctrl + Shift + O`

---

### 6. Preguntas de Prueba 💬

#### 🎸 Prueba 1: Persona Famosa (Ozzy)

```
¿Cuándo murió Ozzy Osbourne?
```

**Logs esperados en terminal:**
```
🔍 Palabra clave detectada en: "¿Cuándo murió Ozzy Osbourne?"
🌐 Detectada necesidad de búsqueda web para: "¿Cuándo murió Ozzy Osbourne?"
🔍 Buscando en web con Firecrawl: "¿Cuándo murió Ozzy Osbourne?"
✅ Encontrados 5 resultados con Firecrawl (contenido completo extraído)
📚 Extrayendo contenido de los primeros 2 resultados...
```

**Respuesta esperada:**
```
Ozzy Osbourne está vivo. Nació el 3 de diciembre de 1948...

---
📚 **Fuentes consultadas:**
- [Biography.com: Ozzy Osbourne](https://...)
- [Wikipedia: Ozzy Osbourne](https://...)
```

---

#### 🤖 Prueba 2: Noticias Actuales

```
¿Cuáles son las últimas noticias sobre inteligencia artificial?
```

**Logs esperados:**
```
🔍 Palabra clave detectada en: "¿Cuáles son las últimas noticias..."
🌐 Detectada necesidad de búsqueda web para: "¿Cuáles son las últimas noticias..."
🔍 Buscando en web con Firecrawl: "¿Cuáles son las últimas noticias sobre inteligencia artificial?"
✅ Encontrados 5 resultados con Firecrawl (contenido completo extraído)
```

**Respuesta esperada:**
Resumen de noticias actuales con fuentes

---

#### 🔥 Prueba 3: Sobre Firecrawl

```
¿Qué es Firecrawl?
```

**Respuesta esperada:**
Explicación técnica con documentación oficial

---

## 📊 Logs a Verificar

### ✅ Logs BUENOS (Firecrawl funciona):

```
🔍 Buscando en web con Firecrawl: "..."
✅ Encontrados 5 resultados con Firecrawl (contenido completo extraído)
📚 Extrayendo contenido de los primeros 2 resultados...
📄 Extrayendo contenido de: https://...
✅ Contenido extraído: 3000+ caracteres
✅ Búsqueda web completada: 5 resultados
🌐 Tongyi: Configurado para español + búsqueda web
```

### ⚠️ Logs de FALLBACK (Firecrawl falló):

```
⚠️ Firecrawl respondió con 429: Rate limit exceeded
🔄 Usando fallback: Wikipedia
📝 Término limpio para Wikipedia: "ozzy osbourne"
✅ Encontrado en Wikipedia
✅ Fallback exitoso: 1 resultado(s)
```

### ❌ Logs MALOS (algo está mal):

```
❌ Error en búsqueda Firecrawl: [Error details]
❌ Fallback también falló
```

Si ves esto, mándame el error completo.

---

## 🎯 Checklist de Verificación

Después de las pruebas, verifica:

- [ ] ¿Ves logs de Firecrawl en la terminal?
- [ ] ¿La búsqueda devuelve 3-5 resultados?
- [ ] ¿El contenido extraído tiene 3000+ caracteres?
- [ ] ¿Tongyi responde en español (sin chino)?
- [ ] ¿Aparece la sección "📚 Fuentes consultadas"?
- [ ] ¿Las fuentes son URLs reales y clicables?
- [ ] ¿La respuesta es precisa y actualizada?

---

## 🐛 Troubleshooting

### Problema 1: No hay logs de Firecrawl

**Causa:** Navegador en caché

**Solución:**
1. Cierra TODO el navegador (no solo pestañas)
2. Abre modo incógnito NUEVO
3. Crea un NUEVO chat

---

### Problema 2: Firecrawl responde con 401/403

**Causa:** API key inválida

**Solución:**
```bash
# Verificar API key en .env
Get-Content .env | Select-String FIRECRAWL
```

Debe mostrar:
```
FIRECRAWL_API_KEY=fc-eb5dbfa5b2384e8eb5fac8218b4c66fa
```

---

### Problema 3: Firecrawl responde con 429

**Causa:** Rate limit excedido (créditos agotados)

**Solución:**
```bash
# Verificar créditos restantes
curl https://api.firecrawl.dev/v1/account \
  -H "Authorization: Bearer fc-eb5dbfa5b2384e8eb5fac8218b4c66fa"
```

Si créditos = 0, espera hasta el próximo mes o actualiza plan.

---

### Problema 4: Búsqueda funciona pero sin fuentes

**Causa:** Prompt no está forzando fuentes

**Solución:**
El sistema ya está configurado para incluir fuentes automáticamente.
Si no aparecen, mándame un screenshot de la respuesta.

---

### Problema 5: Respuesta en chino

**Causa:** Caché antiguo o prompt no actualizado

**Solución:**
1. Cierra TODO el navegador
2. Borra caché del navegador (`Ctrl + Shift + Del`)
3. Abre modo incógnito
4. Crea NUEVO chat

---

## 📞 Reporta Resultados

Por favor, cuéntame:

1. **¿Firecrawl funcionó?**
   - ✅ Sí, veo logs de Firecrawl
   - ⚠️ Usó fallback a Wikipedia
   - ❌ Falló completamente

2. **¿Calidad de resultados?**
   - ✅ Respuestas precisas con fuentes
   - ⚠️ Respuestas vagas sin fuentes
   - ❌ Error o respuestas incorrectas

3. **¿Idioma correcto?**
   - ✅ Todo en español
   - ❌ Aparecen caracteres chinos

4. **Logs específicos:**
   - Copia y pega los logs de la terminal
   - O un screenshot

---

**¡Prueba ahora y cuéntame cómo te va!** 🔥














