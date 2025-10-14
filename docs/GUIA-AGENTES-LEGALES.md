# Guía de Agentes Legales

## 📋 Contenido

1. [Introducción](#introducción)
2. [Crear los Agentes](#crear-los-agentes)
3. [Agente de Búsqueda e Investigación Legal](#agente-de-búsqueda-e-investigación-legal)
4. [Agente de Redacción](#agente-de-redacción)
5. [Editor de Documentos](#editor-de-documentos)
6. [Exportar Documentos](#exportar-documentos)

---

## Introducción

El sistema cuenta con dos agentes especializados para trabajo legal:

1. **🔍 Agente de Búsqueda e Investigación Legal**
2. **✍️ Agente de Redacción**

Cada agente está optimizado para tareas específicas y utiliza prompts especializados para ofrecer la mejor asistencia posible.

---

## Crear los Agentes

### Opción 1: Ejecutar el Script SQL

1. Abre tu panel de Supabase
2. Ve a la sección **SQL Editor**
3. Abre el archivo `scripts/create-legal-agents.sql`
4. **IMPORTANTE**: Reemplaza `'TU_USER_ID'` con tu ID de usuario real
   - Puedes encontrar tu user_id en la tabla `profiles` o ejecutando:
   ```sql
   SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com';
   ```
5. Ejecuta el script

### Opción 2: Crear Manualmente desde la Interfaz

1. Haz clic en el ícono de **robot** (🤖) en la barra lateral
2. Haz clic en **"+ Nuevo Agente"**
3. Copia la configuración de cada agente (ver secciones siguientes)

---

## Agente de Búsqueda e Investigación Legal

### 🎯 Propósito

Especializado en encontrar:
- Jurisprudencia de altas cortes
- Normativa vigente
- Precedentes relevantes
- Doctrina autorizada

### ⚙️ Configuración

```
Nombre: Agente de Búsqueda e Investigación Legal

Descripción: Especializado en encontrar jurisprudencia, normativa y precedentes relevantes para casos legales en Colombia.

Modelo: qwen-max (Tongyi)

Instrucciones del Sistema:
Eres un asistente legal especializado en investigación jurídica en Colombia. Tu función principal es:

1. **Búsqueda de Jurisprudencia**: Encuentra sentencias de la Corte Suprema de Justicia, Corte Constitucional, Consejo de Estado y tribunales inferiores.

2. **Normativa Vigente**: Identifica leyes, decretos, resoluciones y demás normas aplicables al caso.

3. **Análisis de Precedentes**: Examina precedentes judiciales relevantes y su aplicabilidad.

4. **Doctrina Autorizada**: Busca conceptos de autoridades administrativas y académicas.

**Instrucciones específicas**:
- Siempre cita las fuentes completas (número de sentencia, magistrado ponente, fecha)
- Verifica que la normativa esté vigente
- Explica la relevancia de cada hallazgo para el caso específico
- Usa búsqueda web para información actualizada
- Prioriza fuentes oficiales: Corte Constitucional, Consejo de Estado, Rama Judicial

**Formato de respuesta**:
1. Resumen ejecutivo del hallazgo
2. Fuentes encontradas (con citas completas)
3. Análisis de aplicabilidad al caso
4. Recomendaciones para profundizar la investigación

Temperature: 0.3
Context Length: 32000
```

### 💡 Ejemplos de Uso

**Búsqueda de jurisprudencia**:
```
"Busca jurisprudencia de la Corte Constitucional sobre el derecho a la vivienda digna de los últimos 5 años"
```

**Normativa vigente**:
```
"¿Qué dice la normativa colombiana sobre contratos de arrendamiento comercial?"
```

**Análisis de caso**:
```
"Tengo un caso de despido sin justa causa. ¿Cuál es la jurisprudencia reciente de la Corte Suprema sobre indemnizaciones?"
```

---

## Agente de Redacción

### 🎯 Propósito

Especializado en redactar documentos legales:
- Demandas
- Tutelas
- Contratos
- Derechos de petición
- Recursos
- Memoriales

### ⚙️ Configuración

```
Nombre: Agente de Redacción

Descripción: Especializado en redactar documentos legales con formato apropiado y lenguaje jurídico técnico.

Modelo: qwen-max (Tongyi)

Instrucciones del Sistema:
Eres un asistente legal especializado en redacción de documentos jurídicos en Colombia. Tu función principal es crear documentos legales formales, claros y técnicamente correctos.

**Tipos de documentos que puedes redactar**:
1. Demandas (civiles, laborales, administrativas)
2. Acciones de tutela
3. Derechos de petición
4. Contratos (compraventa, arrendamiento, servicios, etc.)
5. Recursos (reposición, apelación, casación)
6. Memoriales y escritos judiciales
7. Conceptos jurídicos
8. Contestaciones de demanda

**Estructura de tus documentos**:
- Usa formato HTML con encabezados (<h1>, <h2>, <h3>)
- Incluye todas las secciones requeridas según el tipo de documento
- Usa lenguaje formal y técnico jurídico
- Cita normativa y jurisprudencia cuando sea pertinente
- Sigue las formalidades procesales colombianas

**Formato para demandas**:
<h1>DEMANDA DE [TIPO]</h1>
<h2>SEÑORES</h2>
[Autoridad competente]

<h2>E.S.D.</h2>

<h2>DEMANDANTE:</h2>
[Información del demandante]

<h2>DEMANDADO:</h2>
[Información del demandado]

<h2>HECHOS</h2>
[Relato cronológico]

<h2>FUNDAMENTOS DE DERECHO</h2>
[Base legal]

<h2>PRETENSIONES</h2>
[Lo que se solicita]

<h2>PRUEBAS</h2>
[Pruebas que se aportan]

<h2>NOTIFICACIONES</h2>
[Direcciones]

**IMPORTANTE**: Siempre usa formato HTML estructurado para que el documento pueda ser editado y exportado a Word/PDF.

Temperature: 0.7
Context Length: 32000
```

### 💡 Ejemplos de Uso

**Redactar una demanda**:
```
"Redacta una demanda de responsabilidad civil por daños y perjuicios. 
Demandante: Juan Pérez
Demandado: Empresa XYZ S.A.S.
Hechos: [describe los hechos]
Daños: [describe los daños]"
```

**Redactar una tutela**:
```
"Redacta una acción de tutela por violación al derecho al debido proceso. 
La empresa me despidió sin darme la oportunidad de defenderme."
```

**Redactar un contrato**:
```
"Redacta un contrato de prestación de servicios profesionales de consultoría. 
Duración: 6 meses
Valor: $10.000.000
Objeto: Consultoría en derecho laboral"
```

---

## Editor de Documentos

Cuando el **Agente de Redacción** genera un documento, automáticamente se muestra con un botón **"Editar Documento"** que abre el editor completo.

### 🛠️ Herramientas del Editor

#### Formato de Texto
- **Negrita**: Texto en negrita
- **Cursiva**: Texto en cursiva
- **Subrayado**: Texto subrayado

#### Encabezados
- **H1**: Título principal
- **H2**: Subtítulo
- **H3**: Sub-subtítulo

#### Alineación
- **Izquierda**: Alineación estándar
- **Centro**: Para títulos
- **Derecha**: Para fechas/lugares
- **Justificado**: Para párrafos legales

#### Listas
- **Viñetas**: Para listas no ordenadas
- **Numeradas**: Para enumeraciones

#### Acciones
- **Copiar**: Copia todo el texto
- **Limpiar**: Borra el contenido

---

## Exportar Documentos

### 📄 Formato Word (.docx)

1. Haz clic en el botón **"Word"** en la barra de herramientas
2. El archivo se descargará automáticamente
3. Abre con Microsoft Word o LibreOffice
4. El formato se preserva (encabezados, negritas, listas, etc.)

**Ventajas**:
- ✅ Formato completamente editable
- ✅ Compatible con Word, Google Docs, LibreOffice
- ✅ Preserva estilos y estructura
- ✅ Listo para imprimir o enviar

### 📑 Formato PDF

1. Haz clic en el botón **"PDF"** en la barra de herramientas
2. El archivo se descargará automáticamente
3. Abre con cualquier lector de PDF

**Ventajas**:
- ✅ Formato inmutable
- ✅ Listo para firma digital
- ✅ Compatible universalmente
- ✅ Ideal para presentación oficial

---

## 💡 Mejores Prácticas

### Para Investigación

1. **Sé específico** con las fechas y el tipo de jurisprudencia
2. **Menciona la rama del derecho** (civil, laboral, penal, etc.)
3. **Incluye contexto** del caso que estás investigando
4. **Verifica siempre** las citas en las fuentes oficiales

### Para Redacción

1. **Proporciona todos los datos** necesarios (nombres, fechas, hechos)
2. **Especifica el tipo de documento** claramente
3. **Revisa el documento** en el editor antes de exportar
4. **Ajusta el formato** según necesites (alineación, encabezados)
5. **Guarda múltiples versiones** si es necesario

### Trabajo en Equipo

1. **Crea espacios de trabajo** separados por caso o cliente
2. **Usa colecciones** para agrupar documentos relacionados
3. **Nombra claramente** cada chat (ej: "Caso Pérez - Investigación", "Caso Pérez - Demanda")
4. **Exporta regularmente** los documentos importantes

---

## 🆘 Solución de Problemas

### El documento no se exporta correctamente

**Solución**: Asegúrate de que el documento tenga formato HTML válido. El agente siempre debe usar `<h1>`, `<h2>`, `<p>` etc.

### El editor no aparece

**Solución**: El editor solo aparece para documentos que:
- Provienen del **Agente de Redacción**
- Contienen formato HTML estructurado
- Incluyen palabras clave como "demanda", "tutela", "contrato"

### El formato se pierde al exportar

**Solución**: 
- Usa las herramientas del editor para aplicar formato
- No copies/pegues desde Word directamente
- Usa los encabezados H1, H2, H3 apropiadamente

---

## 📞 Ayuda Adicional

Para más ayuda, consulta:
- `/help` - Guía general de la aplicación
- La sección de **Atajos de Teclado** en la ayuda
- La documentación en la carpeta `docs/`

---

**¡Listo para empezar!** 🚀

Comienza creando los agentes y prueba con algún documento simple para familiarizarte con el sistema.

