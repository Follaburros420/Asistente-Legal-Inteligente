"use client"

import { IconBook, IconBulb, IconFileText, IconRobot, IconScale, IconSearch, IconSparkles } from "@tabler/icons-react"
import Link from "next/link"

export default function HelpPage() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl p-6 md:p-12">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="mb-4 flex justify-center">
          <IconScale className="text-primary" size={64} />
        </div>
        <h1 className="mb-4 text-4xl font-bold">Guía de Uso</h1>
        <p className="text-muted-foreground text-lg">
          Aprende a sacar el máximo partido a tu Asistente Legal Inteligente
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-12">
        {/* Sección 1: Agentes Especializados */}
        <section className="rounded-lg border-2 p-6">
          <div className="mb-4 flex items-center gap-3">
            <IconRobot className="text-primary" size={32} />
            <h2 className="text-2xl font-semibold">Agentes Especializados</h2>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-lg font-semibold">🔍 Agente de Búsqueda e Investigación Legal</h3>
              <p className="text-muted-foreground mb-2">
                Especializado en encontrar jurisprudencia, normativa y precedentes relevantes para tu caso.
              </p>
              <ul className="text-muted-foreground ml-6 list-disc space-y-1">
                <li>Busca sentencias de la Corte Suprema, Consejo de Estado y tribunales</li>
                <li>Encuentra normativa vigente (leyes, decretos, resoluciones)</li>
                <li>Analiza jurisprudencia constitucional</li>
                <li>Identifica doctrina autorizada</li>
              </ul>
              <div className="bg-secondary mt-3 rounded-md p-3">
                <p className="text-sm">
                  <strong>💡 Consejo:</strong> Sé específico con el tema legal. Ejemplo: "Busca jurisprudencia 
                  sobre responsabilidad civil médica en Colombia de los últimos 5 años"
                </p>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="mb-2 text-lg font-semibold">✍️ Agente de Redacción</h3>
              <p className="text-muted-foreground mb-2">
                Ayuda a redactar documentos legales con el formato y lenguaje jurídico apropiado.
              </p>
              <ul className="text-muted-foreground ml-6 list-disc space-y-1">
                <li>Redacta demandas, tutelas y derechos de petición</li>
                <li>Crea contratos y acuerdos legales</li>
                <li>Elabora conceptos jurídicos y memoriales</li>
                <li>Revisa y mejora documentos existentes</li>
              </ul>
              <div className="bg-secondary mt-3 rounded-md p-3">
                <p className="text-sm">
                  <strong>💡 Consejo:</strong> Proporciona todos los detalles relevantes del caso y especifica 
                  el tipo de documento que necesitas. El agente seguirá las formalidades del derecho colombiano.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sección 2: Trabajar con Archivos */}
        <section className="rounded-lg border-2 p-6">
          <div className="mb-4 flex items-center gap-3">
            <IconFileText className="text-primary" size={32} />
            <h2 className="text-2xl font-semibold">Trabajar con Archivos</h2>
          </div>
          <div className="space-y-3">
            <p className="text-muted-foreground">
              Puedes subir y analizar documentos legales para que el asistente extraiga información relevante:
            </p>
            <ul className="text-muted-foreground ml-6 list-disc space-y-2">
              <li>
                <strong>Formatos soportados:</strong> PDF, Word (.docx), texto plano (.txt)
              </li>
              <li>
                <strong>Casos de uso:</strong> Analizar contratos, extractar cláusulas importantes, 
                resumir expedientes, comparar documentos
              </li>
              <li>
                <strong>Organización:</strong> Crea procesos temáticos para agrupar documentos relacionados 
                (ej: "Caso Pérez vs. Empresa XYZ")
              </li>
            </ul>
            <div className="bg-secondary mt-3 rounded-md p-3">
              <p className="text-sm">
                <strong>💡 Consejo:</strong> Después de subir un documento, pregúntale al asistente cosas como: 
                "Resume las obligaciones de las partes" o "¿Qué cláusulas de penalización contiene?"
              </p>
            </div>
          </div>
        </section>

        {/* Sección 3: Mejores Prácticas */}
        <section className="rounded-lg border-2 p-6">
          <div className="mb-4 flex items-center gap-3">
            <IconBulb className="text-primary" size={32} />
            <h2 className="text-2xl font-semibold">Mejores Prácticas</h2>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 font-semibold">1. Sé específico en tus consultas</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <p className="text-destructive mb-2 text-sm font-semibold">❌ Menos efectivo:</p>
                  <p className="text-muted-foreground text-sm">"¿Qué dice la ley sobre contratos?"</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-green-600 mb-2 text-sm font-semibold">✅ Más efectivo:</p>
                  <p className="text-muted-foreground text-sm">
                    "¿Cuáles son los requisitos de validez de un contrato de compraventa inmobiliaria 
                    según el Código Civil Colombiano?"
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-semibold">2. Proporciona contexto</h3>
              <p className="text-muted-foreground mb-2">
                Incluye detalles relevantes sobre tu caso para obtener respuestas más precisas:
              </p>
              <ul className="text-muted-foreground ml-6 list-disc space-y-1">
                <li>Rama del derecho (civil, laboral, penal, administrativo, etc.)</li>
                <li>Hechos relevantes del caso</li>
                <li>Jurisdicción específica si aplica</li>
                <li>Fechas importantes</li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 font-semibold">3. Utiliza conversaciones separadas</h3>
              <p className="text-muted-foreground">
                Crea un chat diferente para cada caso o tema. Esto ayuda al asistente a mantener 
                el contexto y te permite organizar mejor tu trabajo.
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold">4. Verifica la información</h3>
              <div className="bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 p-3 dark:border-yellow-800">
                <p className="text-sm">
                  <strong>⚠️ Importante:</strong> Aunque el asistente está especializado en derecho colombiano, 
                  siempre debes verificar las referencias legales, especialmente en casos críticos. 
                  Este es un asistente de apoyo, no reemplaza el criterio profesional del abogado.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sección 4: Casos de Uso Comunes */}
        <section className="rounded-lg border-2 p-6">
          <div className="mb-4 flex items-center gap-3">
            <IconSparkles className="text-primary" size={32} />
            <h2 className="text-2xl font-semibold">Casos de Uso Comunes</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border p-4">
              <h3 className="mb-2 font-semibold">Investigación Legal</h3>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>• Buscar precedentes judiciales</li>
                <li>• Revisar normativa aplicable</li>
                <li>• Comparar interpretaciones judiciales</li>
                <li>• Estudiar doctrina y conceptos</li>
              </ul>
            </div>

            <div className="rounded-md border p-4">
              <h3 className="mb-2 font-semibold">Redacción de Documentos</h3>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>• Demandas y contestaciones</li>
                <li>• Tutelas y acciones constitucionales</li>
                <li>• Contratos y acuerdos</li>
                <li>• Derechos de petición</li>
              </ul>
            </div>

            <div className="rounded-md border p-4">
              <h3 className="mb-2 font-semibold">Análisis de Documentos</h3>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>• Revisar contratos existentes</li>
                <li>• Identificar riesgos legales</li>
                <li>• Extractar información clave</li>
                <li>• Comparar versiones de documentos</li>
              </ul>
            </div>

            <div className="rounded-md border p-4">
              <h3 className="mb-2 font-semibold">Consultas Rápidas</h3>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>• Plazos y términos procesales</li>
                <li>• Requisitos de procedimientos</li>
                <li>• Definiciones jurídicas</li>
                <li>• Referencias normativas</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Sección 5: Atajos de Teclado */}
        <section className="rounded-lg border-2 p-6">
          <div className="mb-4 flex items-center gap-3">
            <IconSearch className="text-primary" size={32} />
            <h2 className="text-2xl font-semibold">Atajos de Teclado</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border p-3">
              <span>Nuevo chat</span>
              <kbd className="bg-secondary rounded border px-2 py-1 text-sm">⌘ Shift O</kbd>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span>Enfocar en el chat</span>
              <kbd className="bg-secondary rounded border px-2 py-1 text-sm">⌘ Shift L</kbd>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span>Alternar archivos</span>
              <kbd className="bg-secondary rounded border px-2 py-1 text-sm">⌘ Shift F</kbd>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span>Configuración rápida</span>
              <kbd className="bg-secondary rounded border px-2 py-1 text-sm">⌘ Shift P</kbd>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span>Alternar barra lateral</span>
              <kbd className="bg-secondary rounded border px-2 py-1 text-sm">⌘ Shift S</kbd>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span>Ver ayuda</span>
              <kbd className="bg-secondary rounded border px-2 py-1 text-sm">⌘ Shift /</kbd>
            </div>
          </div>
        </section>

        {/* Sección 6: Recursos Adicionales */}
        <section className="rounded-lg border-2 p-6">
          <div className="mb-4 flex items-center gap-3">
            <IconBook className="text-primary" size={32} />
            <h2 className="text-2xl font-semibold">Recursos Adicionales</h2>
          </div>
          <div className="space-y-3">
            <p className="text-muted-foreground">
              Para aprovechar al máximo el asistente, familiarízate con:
            </p>
            <ul className="text-muted-foreground ml-6 list-disc space-y-2">
              <li>
                <strong>Procesos:</strong> Agrupa documentos relacionados con un mismo caso o tema
              </li>
              <li>
                <strong>Herramientas:</strong> Funcionalidades especiales como búsqueda web para información actualizada
              </li>
              <li>
                <strong>Configuración de Espacios de Trabajo:</strong> Organiza tu trabajo por áreas de práctica
              </li>
            </ul>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <Link 
          href="/setup"
          className="text-primary hover:underline"
        >
          ← Volver al Asistente
        </Link>
      </div>
    </div>
  )
}
