# ⚖️ Asistente Legal Inteligente para Abogados Colombianos

## 🎯 Optimizaciones Implementadas

### 1. **Búsqueda Legal Colombiana (5-10 Fuentes)**

#### Enriquecimiento Automático de Queries:
```
Usuario: "tutela contra entidad pública"
    ↓
Sistema: "tutela contra entidad pública derecho colombiano legislación Colombia jurisprudencia"
```

#### Priorización de Fuentes Oficiales:

**Fuentes Prioritarias (Marcadas con ⚖️):**
- ✅ `corteconstitucional.gov.co` - Corte Constitucional
- ✅ `consejodeestado.gov.co` - Consejo de Estado
- ✅ `cortesuprema.gov.co` - Corte Suprema de Justicia
- ✅ `funcionpublica.gov.co` - Función Pública
- ✅ `ramajudicial.gov.co` - Rama Judicial
- ✅ `defensoria.gov.co` - Defensoría del Pueblo
- ✅ `procuraduria.gov.co` - Procuraduría General
- ✅ `icbf.gov.co` - ICBF
- ✅ `supernotariado.gov.co` - Superintendencia de Notariado
- ✅ `supersalud.gov.co` - Supersalud
- ✅ `sic.gov.co` - Superintendencia de Industria y Comercio
- ✅ `mintic.gov.co` - MinTIC
- ✅ `minjusticia.gov.co` - Ministerio de Justicia

**Fuentes Secundarias:**
- `lexbase.co` - Base legal
- `notinet.com.co` - Información notarial
- `ambito-juridico.com.br` - Ámbito Jurídico (Latam)

---

### 2. **Procesamiento Optimizado**

#### Extracción Paralela:
```
Batch 1 (simultáneo):
  🔥 Firecrawl: corteconstitucional.gov.co/...
  🔥 Firecrawl: consejodeestado.gov.co/...
  🔥 Firecrawl: cortesuprema.gov.co/...
  
Pausa 500ms

Batch 2 (simultáneo):
  🔥 Firecrawl: funcionpublica.gov.co/...
  🔥 Firecrawl: ramajudicial.gov.co/...
  🔥 Firecrawl: defensoria.gov.co/...
  
...hasta 10 fuentes
```

#### Timeouts Ajustados:
- **Sitios .gov.co**: 20 segundos (pueden ser lentos)
- **Otros sitios**: 15 segundos
- **Total máximo**: ~45 segundos para 10 fuentes

---

### 3. **Contenido Legal Amplio**

- **3000 caracteres** por fuente (vs 1000 anteriormente)
- Contenido suficiente para:
  - Textos completos de sentencias
  - Artículos de leyes con contexto
  - Análisis jurisprudencial completo
  - Procedimientos detallados

---

### 4. **Palabras Clave Legales**

El sistema detecta automáticamente consultas legales:

#### Legal Colombiano:
- `ley`, `código`, `artículo`, `decreto`, `sentencia`, `jurisprudencia`
- `constitución`, `corte`, `consejo de estado`, `corte suprema`
- `reforma`, `nueva ley`, `modificación`, `derogatoria`
- `vigencia`, `aplicación`, `interpretación`

#### Procedimientos:
- `demanda`, `tutela`, `acción`, `recurso`, `apelación`
- `proceso`, `trámite`, `procedimiento`
- `requisitos`, `plazos`, `términos`

#### Instituciones:
- `notaría`, `registraduría`, `cámara de comercio`
- `fiscalía`, `procuraduría`, `defensoría`
- `superintendencia`, `ministerio`

#### Documentos:
- `formato`, `modelo`, `plantilla`, `ejemplo`
- `cómo redactar`, `cómo presentar`

---

### 5. **Prompt Legal Especializado**

El sistema ahora instruye al LLM para:

1. **Contexto**: Asistente legal especializado en derecho colombiano
2. **Idioma**: Español colombiano con terminología jurídica
3. **Prioridad**: Fuentes oficiales > Otras fuentes
4. **Formato**:
   - Respuesta directa
   - Fundamento jurídico (artículos, leyes)
   - Jurisprudencia aplicable
   - Procedimiento (si aplica)
   - Consideraciones adicionales
   - Fuentes obligatorias
5. **Calidad**:
   - Lenguaje técnico pero claro
   - Distinguir leyes vigentes vs. derogadas
   - Indicar fechas
   - Advertir cambios recientes
6. **Precisión**:
   - No inventar artículos
   - Admitir falta de información
   - Mencionar dudas interpretativas
   - Recomendar especialista si es complejo

---

## 📊 Logs Esperados

### Búsqueda Legal Óptima:

```
⚖️ Palabra clave legal detectada en: "requisitos tutela contra eps..."
🌐 Detectada necesidad de búsqueda web para: "requisitos tutela contra eps..."
⚖️ Búsqueda legal Colombia: "requisitos tutela contra eps"
📡 DuckDuckGo Colombia: Buscando fuentes legales...
📍 Encontradas 12 URLs (4 fuentes oficiales), extrayendo con Firecrawl...
🔥 Firecrawl: https://corteconstitucional.gov.co/...
✅ Firecrawl: 8474 caracteres
🔥 Firecrawl: https://defensoria.gov.co/...
✅ Firecrawl: 7489 caracteres
🔥 Firecrawl: https://ramajudicial.gov.co/...
✅ Firecrawl: 6200 caracteres
🔥 Firecrawl: https://funcionpublica.gov.co/...
✅ Firecrawl: 5800 caracteres
... (hasta 10 fuentes)
✅ Búsqueda legal completada: 8 fuentes (4 oficiales)
📚 Extrayendo contenido de los primeros 2 resultados...
✅ Búsqueda web completada: 8 resultados
🌐 Tongyi: Configurado para español + búsqueda web
```

---

## 🧪 Ejemplos de Uso

### Ejemplo 1: Tutela

**Pregunta:**
```
¿Cuáles son los requisitos para presentar una tutela contra una EPS?
```

**Respuesta Esperada:**
```
**Requisitos para presentar tutela contra EPS en Colombia:**

**1. Fundamento jurídico:**
- Artículo 86 de la Constitución Política de Colombia
- Decreto 2591 de 1991 (Reglamentación de la tutela)

**2. Requisitos formales:**
a) Identificación del accionante
b) Identificación de la entidad contra quien se dirige (EPS)
c) Descripción de los hechos que motivan la tutela
d) Derechos fundamentales que se consideran vulnerados
e) Pruebas que demuestren la vulneración
f) No existir otro medio de defensa judicial (o ser este ineficaz)

**3. Procedimiento:**
1. Presentar escrito ante cualquier juez de la república
2. No requiere abogado
3. Juez tiene 10 días para resolver
4. Sentencia es de inmediato cumplimiento

**4. Jurisprudencia aplicable:**
- Sentencia T-760 de 2008: Derecho a la salud como fundamental
- Sentencia T-121 de 2015: Requisitos mínimos de la tutela

**5. Consideraciones:**
- Agotamiento previo de reclamación administrativa (derecho de petición)
- Inmediatez: Presentar dentro de un tiempo razonable
- Subsidiariedad: No existir otro mecanismo eficaz

---
⚖️ **Fuentes legales consultadas:**

**Fuentes oficiales:**
- ⚖️ [Corte Constitucional - Sentencia T-760/08](https://corteconstitucional.gov.co/...)
- ⚖️ [Defensoría del Pueblo - Guía Tutela](https://defensoria.gov.co/...)
- ⚖️ [Rama Judicial - Trámites](https://ramajudicial.gov.co/...)

**Marco normativo:**
- Constitución Política, Artículo 86
- Decreto 2591 de 1991
```

---

### Ejemplo 2: Código Laboral

**Pregunta:**
```
¿Qué dice el código laboral sobre indemnización por despido sin justa causa?
```

**Respuesta Esperada:**
```
**Indemnización por despido sin justa causa en Colombia:**

**1. Marco legal:**
- Código Sustantivo del Trabajo (CST), Artículo 64
- Ley 789 de 2002

**2. Fórmula de indemnización:**

**Para contratos a término indefinido:**
- Menos de 1 año: 30 días de salario
- Más de 1 año: 30 días de salario por el primer año + 20 días por cada año adicional

**Salarios menores a 10 SMMLV:**
- 30 días por el primer año
- 20 días por cada año adicional
- Proporción por fracción

**Salarios iguales o superiores a 10 SMMLV:**
- 20 días por el primer año
- 15 días por cada año adicional

**3. Jurisprudencia:**
- Sentencia C-119 de 2018: Constitucionalidad de la indemnización diferencial
- CSJ Laboral, Rad. 60838 de 2016: Cálculo de proporciones

**4. Consideraciones:**
- Debe pagarse dentro de los 30 días siguientes al despido
- Si no se paga, genera intereses moratorios
- Se calcula sobre el último salario devengado

---
⚖️ **Fuentes legales consultadas:**

**Fuentes oficiales:**
- ⚖️ [MinTrabajo - Indemnizaciones](https://mintrabajo.gov.co/...)
- ⚖️ [Corte Suprema - Jurisprudencia Laboral](https://cortesuprema.gov.co/...)

**Marco normativo:**
- Código Sustantivo del Trabajo, Art. 64
- Ley 789 de 2002, Art. 28
```

---

## 💰 Costo Estimado

### Por Consulta Legal:
- DuckDuckGo: **Gratis**
- Firecrawl: **5-10 créditos** (1 por URL)
- Jina Reader (fallback): **Gratis**

### Plan Gratuito de Firecrawl:
- **500 créditos/mes**
- **50-100 consultas legales/mes** (promedio 5-10 fuentes por consulta)

### Recomendación:
Para uso profesional intensivo (>100 consultas/mes):
- Plan Pro: $20/mes = ~2000 créditos = **200-400 consultas legales**
- Plan Business: $50/mes = ~5000 créditos = **500-1000 consultas legales**

---

## 🎯 Ventajas para Abogados

1. **Fuentes Oficiales Priorizadas**
   - Cortes, superintendencias, ministerios
   - Información confiable y actualizada

2. **Cobertura Amplia**
   - 5-10 fuentes por consulta
   - Contexto legal completo (3000 caracteres/fuente)

3. **Jurisprudencia Incluida**
   - Sentencias relevantes
   - Líneas jurisprudenciales

4. **Formato Profesional**
   - Estructura legal clara
   - Fundamentos normativos
   - Procedimientos detallados

5. **Ahorro de Tiempo**
   - Investigación automática en segundos
   - Fuentes verificadas y citadas
   - Contenido listo para usar

---

## 🧪 Probar Ahora

1. **Espera 10 segundos** ⏱️
2. **Cierra TODO** el navegador (`Alt + F4`) 🔴
3. **Modo incógnito** (`Ctrl + Shift + N`) 🕵️
4. Ve a `http://localhost:3000` 🌐
5. **NUEVO chat** ➕
6. **Pregunta legal** 💬

### Preguntas de Prueba:

```
¿Cuáles son los requisitos para presentar una tutela?
```

```
¿Qué dice la ley sobre contratos laborales a término fijo?
```

```
¿Cómo se calcula la liquidación de una sociedad?
```

```
Sentencia T-760 de 2008 sobre derecho a la salud
```

---

## 📞 Reporta

Cuéntame:

1. **¿Se detectan palabras clave legales?**
2. **¿Se priorizan fuentes .gov.co?**
3. **¿Aparecen 5-10 fuentes?**
4. **¿El contenido es relevante y completo?**
5. **¿Las fuentes son oficiales?**

---

**Este es tu asistente legal profesional. Optimizado para abogados colombianos.** ⚖️














