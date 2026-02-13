# Plan de Refactorización Industrial - Asistente Legal Inteligente

## 🔴 Problemas Críticos Identificados

### 1. Arquitectura del Agente (Causa raíz de "max iterations")
**Problema:** El `AgentExecutor` de LangChain con `createToolCallingAgent` tiene limitaciones fundamentales:
- Cada llamada a tool + respuesta del LLM cuenta como 2 iteraciones
- Con maxIterations=6, solo permite ~3 llamadas a herramientas
- El agente se queda en loops innecesarios repitiendo búsquedas
- No hay control granular sobre el flujo de investigación

**Síntomas:**
- "Agent stopped due to max iterations"
- Respuestas incompletas porque el agente no puede terminar su análisis
- Frustración del usuario al ver que "investiga" pero no responde

### 2. Sistema de Streaming Deficiente
**Problema:** 
- El streaming actual es pasivo (solo escucha tokens)
- No hay actualización progresiva de estado mientras investiga
- El usuario no ve qué está haciendo el agente en tiempo real

### 3. Calidad de Respuestas Legales
**Problemas:**
- Prompts genéricos sin estructura jurídica profesional
- No hay validación de la calidad de la respuesta
- Falta estructura: Tesis, Fundamentación, Análisis, Conclusión
- No cita correctamente las fuentes (faltan normas APA o equivalentes legales)

### 4. Manejo de Errores Inadecuado
**Problemas:**
- Cuando falla, el usuario no recibe una respuesta útil
- No hay fallback a respuestas basadas en conocimiento cuando las búsquedas fallan
- Errores de tools no se manejan gracefulmente

---

## 🏗️ Arquitectura Refactorizada (Nueva)

### Principios de Diseño

1. **Orquestación Manual en lugar de Agente Autónomo**
   - Eliminar `AgentExecutor` que causa max iterations
   - Implementar flujo de investigación controlado paso a paso
   - El sistema decide qué buscar basado en análisis de la consulta

2. **Pipeline de Investigación Clara**
   ```
   1. Análisis de Intención → Clasifica tipo de consulta
   2. Plan de Investigación → Decide qué buscar
   3. Ejecución Paralela → Busca en múltiples fuentes simultáneamente
   4. Síntesis Legal → Estructura respuesta profesional
   5. Validación → Verifica calidad antes de responder
   ```

3. **Streaming Activo con Progreso Real**
   - Actualizar estado cada vez que cambia de fase
   - Mostrar información encontrada parcialmente
   - Progress bar basado en pasos completados, no tokens

4. **Respuestas Legales Estructuradas**
   - Formato: TESIS + FUNDAMENTACIÓN + ANÁLISIS + CONCLUSIÓN
   - Citas formales con normas jurídicas colombianas
   - Referencias estructuradas (Sentencia T-XXX de YYYY, Corte Constitucional)

---

## 📋 Plan de Implementación

### Fase 1: Reemplazar Agente Autónomo (CRÍTICO)
- [ ] Crear `lib/legal-research/orchestrator.ts` - Orquestador manual
- [ ] Implementar flujo: Analizar → Planificar → Investigar → Sintetizar
- [ ] Eliminar dependencia de `AgentExecutor`
- [ ] Actualizar endpoint para usar nuevo orquestador

### Fase 2: Mejorar Sistema de Streaming
- [ ] Implementar eventos de progreso por fase
- [ ] Mostrar resultados parciales de búsqueda
- [ ] Agregar "thinking" visible al usuario

### Fase 3: Prompts Legales Profesionales
- [ ] Rediseñar prompts con estructura jurídica formal
- [ ] Agregar ejemplos few-shot de alta calidad
- [ ] Implementar validación de respuesta

### Fase 4: Robustez y Recovery
- [ ] Implementar fallback por si fallan las búsquedas
- [ ] Agregar retry logic para tools
- [ ] Manejo graceful de timeouts

---

## 🔧 Implementación Detallada

### Nuevo Flujo de Investigación Legal

```typescript
// Nuevo enfoque: Orquestación manual en lugar de agente autónomo
class LegalResearchOrchestrator {
  async execute(query: string, context: ResearchContext): Promise<ResearchResult> {
    // 1. ANALIZAR - Clasificar tipo de consulta
    const analysis = await this.analyzeQuery(query);
    this.emitProgress('analyzing', 10, 'Analizando consulta legal...');
    
    // 2. PLANIFICAR - Decidir estrategia de búsqueda
    const plan = this.createSearchPlan(analysis);
    this.emitProgress('planning', 20, 'Planificando investigación...');
    
    // 3. INVESTIGAR - Ejecutar búsquedas en paralelo (controlado)
    const searchResults = await this.executeSearches(plan);
    this.emitProgress('searching', 50, 'Investigando fuentes legales...');
    
    // 4. SINTETIZAR - Generar respuesta estructurada
    const response = await this.synthesizeResponse(query, searchResults);
    this.emitProgress('synthesizing', 80, 'Redactando respuesta profesional...');
    
    // 5. VALIDAR - Verificar calidad
    const validated = this.validateResponse(response);
    this.emitProgress('completed', 100, 'Respuesta completada');
    
    return validated;
  }
}
```

### Estructura de Respuesta Legal Profesional

```
# [TEMA DE LA CONSULTA]

## 1. TESIS JURÍDICA
Respuesta directa y precisa a la pregunta planteada.

## 2. MARCO NORMATIVO APLICABLE
### 2.1 Normas Vigentes
- **Ley/Código X de YYYY**, Artículo Z: "[Cita textual exacta]"
- **Decreto X de YYYY**, Artículo Z: "[Cita textual exacta]"

### 2.2 Jurisprudencia Relevante
- **Sentencia [Número] de [Fecha]**, [Tribunal]: [Extracto del fallo]

## 3. ANÁLISIS JURÍDICO
Desarrollo técnico aplicando la norma al caso concreto, diferenciando:
- Elementos objetivos
- Elementos subjetivos  
- Requisitos procedimentales

## 4. CONCLUSIÓN
Respuesta concreta aplicable al caso consultado.

## 5. FUENTES CONSULTADAS
1. [Nombre oficial], [URL], consultado el [fecha]
```

---

## 📊 Métricas de Éxito

- [ ] Reducir "max iterations" a 0%
- [ ] Tiempo promedio de respuesta < 30 segundos
- [ ] Respuestas con al menos 3 fuentes citadas
- [ ] Estructura jurídica en 100% de respuestas
- [ ] 0 respuestas en idioma incorrecto
