"use client"

import Image from "next/image"
import { Star } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import LayoutEffect from "./LayoutEffect"
import SectionWrapper from "./SectionWrapper"

export default function Testimonials() {
  const testimonials = [
    {
      name: "María González",
      role: "Abogada Especialista en Derecho Civil",
      content:
        "El asistente legal ha revolucionado mi práctica. Ahora puedo analizar contratos en minutos en lugar de horas, y la precisión es impresionante.",
      avatar: "/testimonial/user1.webp",
    },
    {
      name: "Carlos Rodríguez",
      role: "Socio Fundador, Rodríguez & Asociados",
      content:
        "La integración con nuestros sistemas existentes fue perfecta. Nuestro equipo es 40% más productivo desde que implementamos la IA.",
      avatar: "/testimonial/user2.webp",
    },
    {
      name: "Ana Martínez",
      role: "Abogada Corporativa",
      content:
        "La investigación jurídica automatizada me ahorra horas de trabajo. Encuentra precedentes que nunca habría encontrado manualmente.",
      avatar: "/testimonial/user3.webp",
    },
  ]

  return (
    <SectionWrapper>
      <div id="testimonials" className="custom-screen">
        <LayoutEffect
          className="duration-1000 delay-300"
          isInviewState={{
            trueState: "opacity-100",
            falseState: "opacity-0",
          }}
        >
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold">
              Lo que dicen nuestros usuarios
            </h2>
            <p className="text-lg text-muted-foreground">
              Miles de abogados ya están transformando su práctica legal con nuestra plataforma de
              IA.
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
          <div className="mt-16 sm:mt-20 max-w-6xl mx-auto">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((item, idx) => (
                <Card key={idx} className="border-2">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-x-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed italic">"{item.content}"</p>
                    <div className="flex items-center gap-x-3 pt-4 border-t">
                      <Avatar>
                        <AvatarImage src={item.avatar} alt={item.name} />
                        <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-sm">{item.name}</h3>
                        <p className="text-xs text-muted-foreground">{item.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </LayoutEffect>
      </div>
    </SectionWrapper>
  )
}
