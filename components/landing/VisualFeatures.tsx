"use client"

import Image from "next/image"
import { Card } from "@/components/ui/card"
import LayoutEffect from "./LayoutEffect"
import SectionWrapper from "./SectionWrapper"

export default function VisualFeatures() {
  const features = [
    {
      title: "Análisis Inteligente de Documentos",
      description:
        "Nuestra IA analiza contratos, sentencias y documentos legales para extraer información clave, identificar riesgos y sugerir mejoras.",
      image: "/images/Feature-1.svg",
    },
    {
      title: "Redacción Automatizada",
      description:
        "Genera contratos, demandas y documentos legales personalizados usando plantillas inteligentes y conocimiento jurídico actualizado.",
      image: "/images/Feature-2.svg",
    },
  ]

  return (
    <SectionWrapper>
      <div className="custom-screen">
        <div className="space-y-24 sm:space-y-32">
          {features.map((item, idx) => (
            <LayoutEffect
              key={idx}
              className="duration-1000 delay-300"
              isInviewState={{
                trueState: "opacity-100",
                falseState: "opacity-0",
              }}
            >
              <div
                className={`grid md:grid-cols-2 gap-12 lg:gap-16 items-center ${
                  idx % 2 === 1 ? "md:flex-row-reverse" : ""
                }`}
              >
                <div className={`space-y-4 ${idx % 2 === 1 ? "md:order-2" : ""}`}>
                  <h2 className="text-3xl sm:text-4xl font-bold">{item.title}</h2>
                  <p className="text-lg text-muted-foreground">{item.description}</p>
                </div>
                <div className={idx % 2 === 1 ? "md:order-1" : ""}>
                  <Card className="overflow-hidden border-2">
                    <Image
                      src={item.image}
                      alt={item.title}
                      width={600}
                      height={400}
                      className="w-full h-auto"
                    />
                  </Card>
                </div>
              </div>
            </LayoutEffect>
          ))}
        </div>
      </div>
    </SectionWrapper>
  )
}
