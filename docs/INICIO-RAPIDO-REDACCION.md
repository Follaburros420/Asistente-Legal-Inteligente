# ⚡ Inicio Rápido - Sistema de Redacción

## 🎯 En 5 Minutos Tendrás Todo Funcionando

---

## 📋 Checklist de Inicio

- [ ] Paso 1: Obtener User ID (30 segundos)
- [ ] Paso 2: Crear agentes (1 minuto)
- [ ] Paso 3: Primera prueba (2 minutos)
- [ ] Paso 4: Exportar documento (30 segundos)

---

## ⚡ PASO 1: Obtener tu User ID

### En Supabase Dashboard:

1. Ve a **SQL Editor**
2. Ejecuta:
   ```sql
   SELECT id, email FROM auth.users;
   ```
3. Copia tu **id** (algo como: `e9fc7e46-a8a5-4fd4-8ba7-af485013e6fa`)

---

## ⚡ PASO 2: Crear los Agentes

1. En **SQL Editor** de Supabase
2. Abre el archivo: `scripts/create-legal-agents.sql`
3. **Busca y reemplaza** (Ctrl+H):
   - Buscar: `TU_USER_ID`
   - Reemplazar con: `tu-id-real-aquí`
4. Ejecuta el script completo
5. Deberías ver: ✅ "Success. No rows returned"

### Verificar:
```sql
SELECT name FROM assistants WHERE user_id = 'tu-user-id';
```

Deberías ver:
```
Agente de Búsqueda e Investigación Legal
Agente de Redacción
```

---

## ⚡ PASO 3: Primera Prueba

### En tu aplicación:

1. Refresca la página (F5)

2. Haz clic en el **dropdown superior** (donde dice "Configuración Rápida")

3. Selecciona: **"Agente de Redacción"**

4. En el chat, escribe:
   ```
   Redacta una acción de tutela básica. 
   Accionante: Juan Pérez
   Accionado: EPS Salud
   Derecho violado: Derecho a la salud
   ```

5. Espera la respuesta (15-30 segundos)

6. ¡Deberías ver el botón **"📝 Editar Documento"**!

---

## ⚡ PASO 4: Editar y Exportar

1. Haz clic en **"Editar Documento"**

2. Se abre el editor full-screen con:
   - Barra de herramientas arriba
   - Documento en el centro
   - Contador de palabras abajo

3. **Prueba el editor**:
   - Selecciona texto
   - Haz clic en **"B"** (negrita)
   - Cambia la alineación
   - Ajusta encabezados

4. **Exporta**:
   - Clic en **"Word"** → Descarga .docx
   - Clic en **"PDF"** → Descarga .pdf

5. Abre el archivo descargado

¡Listo! 🎉

---

## 🎨 Interfaz Visual

### El Chat Normal
```
┌─────────────────────────────────────┐
│  ▼ Agente de Redacción             │  ← Seleccionar aquí
├─────────────────────────────────────┤
│                                     │
│  Usuario:                          │
│  "Redacta una tutela..."           │
│                                     │
│  Agente de Redacción:              │
│  ┌──────────────────────────────┐  │
│  │ 📝 Documento Generado        │  │
│  │                              │  │
│  │ [Contenido del documento]    │  │
│  │                              │  │
│  │  [📝 Editar Documento]       │  │ ← Clic aquí
│  └──────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

### El Editor
```
┌─────────────────────────────────────────────────────┐
│  Editor de Documentos Legales                  [X] │
├─────────────────────────────────────────────────────┤
│  [B][I][U] [H1][H2][H3] [←][↔][→][≡] [•][123] [Word][PDF] │ ← Toolbar
├─────────────────────────────────────────────────────┤
│                                                     │
│  DEMANDA DE TUTELA                                 │  
│                                                     │
│  SEÑORES                                           │
│  Juzgado...                                        │  ← Área editable
│                                                     │
│  [editar aquí...]                                  │
│                                                     │
├─────────────────────────────────────────────────────┤
│  1,234 palabras • 6,789 caracteres           │ ← Contador
└─────────────────────────────────────────────────────┘
```

---

## 💡 Tips para tu Primera Prueba

### ✅ BUENAS PRÁCTICAS

**Solicitud Clara**:
```
"Redacta una tutela por violación al debido proceso.
Accionante: María García
Accionado: Empresa ABC
Hechos: Me despidieron sin explicación"
```

**Resultado**: Documento bien estructurado ✅

### ❌ EVITAR

**Solicitud Vaga**:
```
"Haz una demanda"
```

**Resultado**: Documento genérico ❌

---

## 🔥 Ejemplos Listos para Copiar/Pegar

### Tutela
```
Redacta una acción de tutela por negación de servicios de salud.
Accionante: Pedro Gómez
Accionado: EPS Salud Total
Hechos: Requiero una cirugía de cadera urgente que fue negada sin justificación médica. Tengo 68 años y el dolor es insoportable.
Derecho violado: Derecho a la salud
```

### Demanda Civil
```
Redacta una demanda de responsabilidad civil extracontractual.
Demandante: Laura Martínez
Demandado: Constructora XYZ S.A.S.
Hechos: El 15 de marzo de 2024, un ladrillo cayó del edificio en construcción y golpeó mi vehículo, causando daños por $8.000.000.
Perjuicios: Daño emergente $8.000.000, lucro cesante $2.000.000 (no pude trabajar 2 semanas).
```

### Contrato
```
Redacta un contrato de arrendamiento de vivienda urbana.
Arrendador: Carlos Ramírez
Arrendatario: Ana Morales
Inmueble: Apartamento 301, Torre B, Calle 45 #12-34, Bogotá
Canon mensual: $1.500.000
Duración: 1 año
Fecha de inicio: 1 de noviembre de 2024
```

### Derecho de Petición
```
Redacta un derecho de petición en interés general.
Peticionario: Asociación de Vecinos del Barrio El Prado
Destinatario: Alcaldía Municipal de Medellín
Objeto: Solicitar información sobre el proyecto de construcción de vía en el sector, incluyendo estudios de impacto ambiental y permisos.
```

---

## 🎯 Verificación Rápida

Después de cada paso, verifica:

### ✅ Paso 1 Completo
```sql
-- Deberías poder ejecutar esto sin error:
SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com';
```

### ✅ Paso 2 Completo
```sql
-- Deberías ver 2 agentes:
SELECT COUNT(*) FROM assistants WHERE user_id = 'tu-user-id';
-- Resultado: 2
```

### ✅ Paso 3 Completo
- Ves el dropdown con "Agente de Redacción" ✅
- Puedes seleccionarlo ✅
- El agente responde ✅
- Aparece el botón "Editar Documento" ✅

### ✅ Paso 4 Completo
- Se abre el modal del editor ✅
- Puedes editar el texto ✅
- Los botones Word/PDF funcionan ✅
- Se descarga el archivo ✅

---

## 🆘 Problemas Comunes

### "No veo los agentes en el dropdown"

**Solución**:
1. Verifica que ejecutaste el SQL con TU user_id
2. Refresca la página (F5)
3. Verifica en Supabase:
   ```sql
   SELECT * FROM assistants WHERE user_id = 'tu-id';
   ```

### "El botón 'Editar Documento' no aparece"

**Solución**:
1. Asegúrate de estar usando el **Agente de Redacción**
2. En tu solicitud, especifica: "Redacta..."
3. El documento debe contener encabezados

### "Error al exportar"

**Solución**:
1. Refresca la página
2. Abre el editor de nuevo
3. Intenta exportar de nuevo
4. Verifica la consola del navegador (F12)

---

## 📈 Progreso Esperado

```
0 min:  Lees esta guía
1 min:  Obtienes tu User ID
2 min:  Ejecutas el SQL
3 min:  Refrescas y pruebas
4 min:  Generas tu primer documento
5 min:  Exportas a Word/PDF

✅ ¡LISTO!
```

---

## 🎓 Después de la Primera Prueba

### Aprende Más

1. **Guía Completa**
   - Abre: `docs/GUIA-AGENTES-LEGALES.md`
   - Ejemplos avanzados
   - Mejores prácticas
   - Casos de uso reales

2. **Detalles Técnicos**
   - Abre: `docs/SISTEMA-REDACCION-COMPLETADO.md`
   - Arquitectura
   - Personalización
   - Troubleshooting

3. **Experimenta**
   - Prueba el Agente de Búsqueda
   - Crea documentos más complejos
   - Explora las herramientas del editor

---

## 🌟 Features del Sistema

Ya tienes acceso a:

- ✅ 2 agentes especializados
- ✅ Editor profesional de documentos
- ✅ Exportación a Word
- ✅ Exportación a PDF
- ✅ Formato HTML estructurado
- ✅ Detección automática de documentos
- ✅ Contador de palabras
- ✅ Toolbar visual completo
- ✅ 100% en español

---

## 🎯 Tu Primera Meta

**Crea un documento completo** siguiendo este flow:

1. **Investiga** (Agente de Búsqueda):
   ```
   "¿Qué requisitos debe tener una tutela por derecho a la salud?"
   ```

2. **Redacta** (Agente de Redacción):
   ```
   "Basándote en la información anterior, redacta una tutela completa"
   ```

3. **Edita**:
   - Ajusta nombres
   - Mejora redacción
   - Aplica formato

4. **Exporta**:
   - Word para seguir editando
   - PDF para presentar

---

## ✨ ¡Ahora Sí, A Empezar!

Todo está listo. Solo necesitas:

1. Copiar tu User ID
2. Ejecutar el SQL
3. Hacer tu primera prueba

**Tiempo total: 5 minutos**

---

## 📞 ¿Necesitas Ayuda?

Consulta:
- Esta guía (estás aquí) - Inicio rápido
- `IMPLEMENTACION-AGENTES-REDACCION.md` - Resumen ejecutivo  
- `docs/GUIA-AGENTES-LEGALES.md` - Guía completa
- `docs/SISTEMA-REDACCION-COMPLETADO.md` - Técnica

---

**¡Éxito con tu primer documento!** 🚀

