# 🔍 Instrucciones de Búsqueda Web para Tongyi Deep Research

## Herramientas Disponibles

### 1. Búsqueda Web General
**Endpoint**: `http://localhost:3000/api/tools/web-search`
**Método**: POST
**Descripción**: Búsqueda general de información en internet

**Parámetros**:
- `query` (requerido): Término de búsqueda
- `sources` (opcional): Fuentes a consultar (duckduckgo, wikipedia, news)

**Ejemplo de uso**:
```json
{
  "query": "leyes de contratos en Colombia",
  "sources": ["duckduckgo", "wikipedia"]
}
```

### 2. Búsqueda Legal Especializada
**Endpoint**: `http://localhost:3000/api/tools/legal-search`
**Método**: POST
**Descripción**: Búsqueda especializada en jurisprudencia, leyes y doctrina legal

**Parámetros**:
- `query` (requerido): Consulta legal específica
- `country` (opcional): País para búsqueda (default: colombia)
- `type` (opcional): Tipo de búsqueda (general, jurisprudencia, leyes, doctrina)

**Ejemplos de uso**:

#### Búsqueda de Jurisprudencia:
```json
{
  "query": "contratos de arrendamiento",
  "country": "colombia",
  "type": "jurisprudencia"
}
```

#### Búsqueda de Leyes:
```json
{
  "query": "código civil",
  "country": "colombia",
  "type": "leyes"
}
```

#### Búsqueda de Doctrina:
```json
{
  "query": "responsabilidad civil",
  "country": "colombia",
  "type": "doctrina"
}
```

## Cuándo Usar Cada Herramienta

### Usa Búsqueda Web General cuando:
- Necesites información general sobre un tema legal
- Quieras obtener contexto amplio sobre un concepto
- Busques definiciones o explicaciones básicas
- Necesites información de múltiples fuentes

### Usa Búsqueda Legal Especializada cuando:
- Busques jurisprudencia específica
- Necesites información sobre leyes vigentes
- Quieras consultar doctrina legal
- Requieras análisis especializado en derecho

## Mejores Prácticas

1. **Siempre usa las herramientas de búsqueda** antes de responder consultas legales
2. **Combina información** de múltiples fuentes para análisis completo
3. **Especifica el país** cuando sea relevante para la consulta legal
4. **Usa el tipo de búsqueda apropiado** según la naturaleza de la consulta
5. **Verifica la información** obtenida y cita las fuentes cuando sea posible

## Flujo de Trabajo Recomendado

1. **Recibe consulta del usuario**
2. **Identifica el tipo de información necesaria**
3. **Selecciona la herramienta apropiada**
4. **Realiza la búsqueda con parámetros específicos**
5. **Analiza los resultados obtenidos**
6. **Proporciona respuesta fundamentada** con la información encontrada
7. **Incluye recomendaciones adicionales** si es necesario

## Ejemplos de Consultas

### Consulta: "¿Cuáles son los requisitos para un contrato de arrendamiento en Colombia?"

**Paso 1**: Usar búsqueda legal especializada
```json
{
  "query": "requisitos contrato arrendamiento",
  "country": "colombia",
  "type": "leyes"
}
```

**Paso 2**: Usar búsqueda de jurisprudencia
```json
{
  "query": "contrato arrendamiento requisitos",
  "country": "colombia", 
  "type": "jurisprudencia"
}
```

**Paso 3**: Analizar resultados y proporcionar respuesta completa

## Notas Importantes

- Las herramientas están configuradas para funcionar localmente
- Los resultados incluyen información de DuckDuckGo y Wikipedia
- La búsqueda legal especializada optimiza las consultas para temas jurídicos
- Siempre verifica la vigencia de la información legal obtenida
- Recomienda consultar fuentes oficiales para información crítica



