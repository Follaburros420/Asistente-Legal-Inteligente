"use client"

import { Check, Star } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import LayoutEffect from "./LayoutEffect"
import SectionWrapper from "./SectionWrapper"

export default function Pricing() {
  const plans = [
    {
      name: "Básico",
      price: "$19/mes",
      description: "Perfecto para empezar",
      features: [
        "200 consultas por mes",
        "Análisis básico de documentos",
        "Soporte por email",
        "Acceso a base de datos legal básica",
        "Sin subida de documentos",
      ],
      cta: "Comenzar Prueba",
      popular: false,
    },
    {
      name: "Profesional",
      price: "$47/mes",
      description: "Para abogados independientes",
      features: [
        "1,000 consultas por mes",
        "Subida y análisis de documentos",
        "Organización en carpetas",
        "Integración de conocimiento de procesos",
        "Redacción de contratos",
        "Soporte prioritario",
      ],
      cta: "Comenzar Prueba",
      popular: true,
    },
    {
      name: "Empresarial",
      price: "Desde $500/mes",
      description: "Para firmas de abogados",
      features: [
        "Consultas ilimitadas",
        "Todo lo del plan Profesional",
        "Soluciones a la medida",
        "Modelos personalizados",
        "Múltiples usuarios",
        "API personalizada",
        "Soporte 24/7",
        "Capacitación incluida",
        "Reportes avanzados",
      ],
      cta: "Contactar Ventas",
      popular: false,
    },
  ]

  return (
    <SectionWrapper>
      <div id="pricing" className="custom-screen">
        <LayoutEffect
          className="duration-1000 delay-300"
          isInviewState={{
            trueState: "opacity-100",
            falseState: "opacity-0",
          }}
        >
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold">
              Planes que se adaptan a tu práctica
            </h2>
            <p className="text-lg text-muted-foreground">
              Elige el plan que mejor se adapte a tus necesidades y comienza a trabajar de manera
              más inteligente.
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
          <div className="mt-16 sm:mt-20 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {plans.map((item, idx) => (
              <Card
                key={idx}
                className={`relative flex flex-col ${
                  item.popular
                    ? "border-primary border-2 shadow-2xl scale-105"
                    : "border-2"
                }`}
              >
                {item.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="gap-1 px-3 py-1">
                      <Star className="w-3 h-3 fill-current" />
                      Más Popular
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{item.name}</CardTitle>
                  <CardDescription className="text-base">{item.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{item.price}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {item.features.map((feature, featureIdx) => (
                      <li key={featureIdx} className="flex items-start gap-x-3">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    asChild
                    className="w-full"
                    variant={item.popular ? "default" : "outline"}
                    size="lg"
                  >
                    <Link href="/login">{item.cta}</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </LayoutEffect>
      </div>
    </SectionWrapper>
  )
}
