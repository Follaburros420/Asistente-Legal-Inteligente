"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import LayoutEffect from "./LayoutEffect"
import SectionWrapper from "./SectionWrapper"

export default function FAQs() {

  const faqs = [
    {
      question: "¿Qué es el Asistente Legal Inteligente?",
      answer:
        "Es una plataforma de IA diseñada específicamente para abogados y profesionales del derecho en Colombia. Te ayuda a analizar documentos, redactar contratos, investigar jurisprudencia y gestionar casos de manera más eficiente.",
    },
    {
      question: "¿Es seguro usar IA para documentos legales?",
      answer:
        "Absolutamente. Nuestra plataforma utiliza las más altas medidas de seguridad y encriptación. Todos los documentos se procesan de forma segura y no se almacenan permanentemente sin tu consentimiento explícito.",
    },
    {
      question: "¿Funciona con la legislación colombiana?",
      answer:
        "Sí, nuestro asistente está específicamente entrenado con la legislación colombiana, incluyendo códigos, leyes, decretos y jurisprudencia de las altas cortes del país.",
    },
    {
      question: "¿Puedo cancelar mi suscripción en cualquier momento?",
      answer:
        "Sí, puedes cancelar tu suscripción en cualquier momento desde tu panel de usuario. No hay penalizaciones ni cargos adicionales por cancelación.",
    },
    {
      question: "¿Ofrecen soporte técnico?",
      answer:
        "Sí, ofrecemos soporte técnico por email para todos los planes, y soporte prioritario 24/7 para nuestros planes Profesional y Empresarial.",
    },
    {
      question: "¿Puedo integrar el asistente con mis sistemas existentes?",
      answer:
        "Sí, nuestro plan Empresarial incluye integración con sistemas de gestión legal existentes a través de API personalizada y soporte técnico especializado.",
    },
  ]

  return (
    <SectionWrapper>
      <div id="faqs" className="custom-screen">
        <LayoutEffect
          className="duration-1000 delay-300"
          isInviewState={{
            trueState: "opacity-100",
            falseState: "opacity-0",
          }}
        >
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold">
              Preguntas Frecuentes
            </h2>
            <p className="text-lg text-muted-foreground">
              Encuentra respuestas a las preguntas más comunes sobre nuestro asistente legal
              inteligente.
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
          <div className="mt-16 sm:mt-20 max-w-3xl mx-auto">
            <Accordion type="single" collapsible defaultValue="item-0" className="space-y-4">
              {faqs.map((item, idx) => (
                <AccordionItem key={idx} value={`item-${idx}`} className="border rounded-lg px-6">
                  <AccordionTrigger className="text-left hover:no-underline">
                    <span className="font-semibold">{item.question}</span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </LayoutEffect>
      </div>
    </SectionWrapper>
  )
}
