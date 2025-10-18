"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Sparkles, Shield, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import GradientWrapper from "./GradientWrapper"
import LayoutEffect from "./LayoutEffect"

export default function Hero() {
  const stats = [
    { label: "Documentos Analizados", value: "10K+" },
    { label: "Horas Ahorradas", value: "5000+" },
    { label: "Abogados Activos", value: "500+" },
  ]

  return (
    <section className="relative overflow-hidden py-24 sm:py-32 lg:py-40">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      
      <div className="custom-screen">
        <LayoutEffect
          className="duration-1000 delay-300"
          isInviewState={{
            trueState: "opacity-100",
            falseState: "opacity-0 translate-y-8",
          }}
        >
          <div className="text-center space-y-10 sm:space-y-12">
            {/* Badge */}
            <div className="flex justify-center">
              <Badge variant="secondary" className="px-4 py-2 text-sm gap-2">
                <Sparkles className="w-4 h-4" />
                Potenciado por IA Avanzada
              </Badge>
            </div>

            {/* Heading */}
            <div className="space-y-6 max-w-4xl mx-auto">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
                Asistente Legal{" "}
                <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Inteligente
                </span>
                <br />
                <span className="invisible">con IA</span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                Transforma tu práctica legal con IA. Analiza documentos, redacta contratos y
                encuentra jurisprudencia en segundos.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" asChild className="gap-2 text-base">
                <Link href="/login">
                  Comenzar Gratis
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="gap-2 text-base">
                <Link href="/landing#features">
                  Ver Características
                </Link>
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-6 pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" />
                <span>100% Seguro</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>Resultados Instantáneos</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>IA de Última Generación</span>
              </div>
            </div>
          </div>
        </LayoutEffect>


        {/* Stats */}
        <LayoutEffect
          className="duration-1000 delay-700"
          isInviewState={{
            trueState: "opacity-100",
            falseState: "opacity-0",
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-20 sm:mt-24 max-w-3xl mx-auto">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center space-y-2">
                <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </LayoutEffect>
      </div>
    </section>
  )
}
