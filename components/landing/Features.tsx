"use client"

import { FileText, BookOpen, Scale, Sparkles, FolderOpen, Zap } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import LayoutEffect from "./LayoutEffect"
import SectionWrapper from "./SectionWrapper"

export default function Features() {
  const featuresList = [
    {
      icon: FileText,
      title: "Análisis Automatizado de Documentos",
      desc: "Nuestra plataforma de IA analiza automáticamente contratos, sentencias y documentos legales para extraer información clave",
    },
    {
      icon: Sparkles,
      title: "Redacción Inteligente de Contratos",
      desc: "Genera contratos personalizados usando IA que se adapta a las necesidades específicas de cada caso legal.",
    },
    {
      icon: Scale,
      title: "Consultas Legales Personalizadas",
      desc: "Obtén respuestas precisas y contextualizadas sobre leyes colombianas y jurisprudencia relevante.",
    },
    {
      icon: BookOpen,
      title: "Investigación Jurídica Automatizada",
      desc: "Encuentra precedentes, jurisprudencia y normativa relevante de forma automática para fortalecer tus argumentos.",
    },
    {
      icon: FolderOpen,
      title: "Gestión Inteligente de Casos",
      desc: "Organiza y gestiona tus casos legales con seguimiento automático de fechas importantes y recordatorios.",
    },
    {
      icon: Zap,
      title: "Integración con Sistemas Legales",
      desc: "Conecta con sistemas de gestión legal existentes y bases de datos jurídicas para un flujo de trabajo optimizado.",
    },
  ]

  return (
    <SectionWrapper>
      <div id="features" className="custom-screen">
        <LayoutEffect
          className="duration-1000 delay-300"
          isInviewState={{
            trueState: "opacity-100",
            falseState: "opacity-0 translate-y-6",
          }}
        >
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold">
              Potencia tu práctica legal con IA
            </h2>
            <p className="text-lg text-muted-foreground">
              Nuestro asistente legal inteligente te ayuda a automatizar tareas repetitivas, analizar
              documentos complejos y tomar decisiones más informadas en menos tiempo.
            </p>
          </div>
        </LayoutEffect>
        <LayoutEffect
          className="duration-1000 delay-500"
          isInviewState={{
            trueState: "opacity-100",
            falseState: "opacity-0",
          }}
        >
          <div className="relative mt-16 sm:mt-20">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {featuresList.map((item, idx) => {
                const IconComponent = item.icon
                return (
                  <Card key={idx} className="group hover:shadow-lg transition-all duration-300 border-2">
                    <CardHeader>
                      <div className="w-12 h-12 flex items-center justify-center bg-primary/10 rounded-lg text-primary group-hover:scale-110 transition-transform">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-xl mt-4">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base">{item.desc}</CardDescription>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </LayoutEffect>
      </div>
    </SectionWrapper>
  )
}
