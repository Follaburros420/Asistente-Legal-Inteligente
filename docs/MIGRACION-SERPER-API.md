# Migración de Google CSE a Serper API

## 📋 Resumen

Se ha completado la migración del sistema de búsqueda de Google Custom Search Engine (CSE) a Serper API para resolver los problemas de limitación de queries y mejorar la fiabilidad del sistema.

## 🔄 Cambios Realizados

### 1. Variables de Entorno
- **Nueva variable**: `SERPER_API_KEY` - Requiere configuración con una API key válida de Serper
- **Variables mantenidas**: `GOOGLE_CSE_API_KEY` y `GOOGLE_CSE_CX` (conservadas por compatibilidad)

### 2. Archivos Modificados

#### `lib/tools/enhanced-web-search.ts`
- **Nivel 1 (Fuentes Oficiales)**: Migrado de Google CSE a Serper API
- **Nivel 2 (Fuentes Académicas)**: Migrado de Google CSE a Serper API
- **Niveles 3 y 4**: Sin cambios (DuckDuckGo y Wikipedia permanecen igual)

#### `lib/tools/simple-web-search.ts`
- **Función principal**: Renombrada `searchWithGoogle` → `searchWithSerper`
- **Implementación**: Completamente migrada a Serper API
- **Fallback**: DuckDuckGo se mantiene como alternativa

#### `lib/tools/no-api-search.ts`
- **Sin cambios**: Continúa usando el sistema sin APIs (fuente directa, Bing scraping, conocimiento propio)

### 3. Nuevos Scripts de Prueba

#### `scripts/test-serper-api.js`
- Script especializado para probar la funcionalidad de Serper API
- Pruebas automáticas con consultas legales colombianas
- Verificación de ambos sistemas (simple y enhanced)

## 🚀 Ventajas de Serper API

1. **Mayor límite de queries**: Significativamente superior a Google CSE
2. **Mayor fiabilidad**: Menos probabilidades de alcanzar límites de cuota
3. **Resultados de alta calidad**: Usa el índice de Google actualizado
4. **Respuesta rápida**: API optimizada para velocidad
5. **Fácil implementación**: API REST simple y documentación clara

## ⚙️ Configuración Requerida

### 1. Obtener API Key de Serper
1. Visita [https://serper.dev/](https://serper.dev/)
2. Registra una cuenta
3. Obtén tu API key desde el dashboard
4. Configúrala en tu archivo `.env`:

```env
SERPER_API_KEY=tu_api_key_aqui
```

### 2. Verificar Configuración
Ejecuta el script de prueba:
```bash
node scripts/test-serper-api.js
```

## 🔍 Estructura de Búsqueda Actual

### Sistema Enhanced (4 niveles)
1. **Nivel 1**: Serper API - Fuentes oficiales colombianas
2. **Nivel 2**: Serper API - Fuentes académicas
3. **Nivel 3**: DuckDuckGo - Web general
4. **Nivel 4**: Wikipedia/Jina AI - Último recurso

### Sistema Simple (2 niveles)
1. **Nivel 1**: Serper API - Búsqueda general (sin Wikipedia)
2. **Nivel 2**: DuckDuckGo - Fallback

### Sistema No-API (sin APIs externas)
- Fuentes gubernamentales directas
- Bing scraping
- Conocimiento legal incorporado
- Respuestas basadas en conocimiento

## 🧪 Pruebas y Validación

### Consultas de Prueba Recomendadas
- `Código Civil Colombiano prescripción adquisitiva`
- `Ley 1564 de 2012 Código General del Proceso`
- `Corte Constitucional Colombia sentencias`
- `derecho contractual Colombia`

### Verificación
1. Ejecuta el script de prueba: `node scripts/test-serper-api.js`
2. Verifica que los resultados incluyan fuentes oficiales colombianas
3. Confirma que Wikipedia esté filtrada en los sistemas correspondientes
4. Prueba el endpoint legal con una consulta real

## 🔄 Compatibilidad y Rollback

### Compatibilidad hacia atrás
- Las variables de Google CSE se mantienen por si se necesita revertir
- La estructura de respuestas es idéntica
- No se requieren cambios en los endpoints que consumen los servicios

### Procedimiento de Rollback (si es necesario)
1. Restaurar las funciones `searchWithGoogle` en los archivos modificados
2. Revertir las llamadas a las funciones originales
3. Configurar las variables de Google CSE si no están presentes

## 📊 Monitoreo y Logs

### Indicadores a monitorear
- Tasa de éxito de búsquedas
- Tiempo de respuesta de Serper API
- Número de resultados obtenidos
- Errores de cuota o conexión

### Logs mejorados
- Todos los sistemas ahora loguean el uso de Serper API
- Mensajes específicos para cada nivel de búsqueda
- Información detallada de errores y fallbacks

## 🎯 Próximos Pasos

1. **Configurar SERPER_API_KEY** con un valor real
2. **Ejecutar pruebas completas** del sistema
3. **Monitorear rendimiento** en producción
4. **Documentar cuotas y límites** de Serper API
5. **Considerar migración completa** si los resultados son satisfactorios

## 🆘 Soporte y Troubleshooting

### Problemas Comunes
- **Error 401**: Verifica que `SERPER_API_KEY` esté configurada correctamente
- **Error 429**: Límite de cuota alcanzado, considera upgrade de plan
- **Sin resultados**: Verifica la query y la conexión a internet

### Contacto
- Documentación de Serper: [https://serper.dev/docs](https://serper.dev/docs)
- Soporte: [https://serper.dev/contact](https://serper.dev/contact)

---

**Fecha de migración**: 18 de octubre de 2025  
**Responsable**: Sistema de Asistente Legal Inteligente  
**Versión**: v2.0 - Serper API Integration
