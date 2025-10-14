"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import LayoutEffect from "./LayoutEffect"
import SectionWrapper from "./SectionWrapper"

export default function CTA() {
  return (
    <SectionWrapper>
      <div className="custom-screen">
        <LayoutEffect
          className="duration-1000 delay-300"
          isInviewState={{
            trueState: "opacity-100 scale-100",
            falseState: "opacity-0 scale-95",
          }}
        >
          <Card className="relative overflow-hidden border-2">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10" />
            
            <div className="relative px-6 py-16 sm:px-12 sm:py-20">
              <div className="max-w-2xl mx-auto text-center space-y-6">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
                  ¿Listo para revolucionar tu práctica legal?
                </h2>
                <p className="text-lg text-muted-foreground">
                  Únete a miles de abogados que ya están usando IA para ser más eficientes y
                  efectivos en su trabajo diario.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                  <Button size="lg" asChild className="gap-2">
                    <Link href="/login">
                      Comenzar Gratis
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/landing#pricing">Ver Planes</Link>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  No se requiere tarjeta de crédito • Configuración en 2 minutos
                </p>
              </div>
            </div>
          </Card>
        </LayoutEffect>
      </div>
    </SectionWrapper>
  )
}
