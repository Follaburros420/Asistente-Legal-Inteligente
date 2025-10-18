"use client"

import { useState, useCallback } from "react"

interface SuggestedQuestion {
  question: string
  category: string
}

export const useSuggestedQuestions = () => {
  const [isGenerating, setIsGenerating] = useState(false)

  const generateSuggestedQuestions = useCallback(async (
    assistantResponse: string,
    userQuestion: string,
    chatHistory: string[]
  ): Promise<string[]> => {
    setIsGenerating(true)
    
    try {
      // Extraer palabras clave del tema principal
      const keywords = extractKeywords(assistantResponse, userQuestion)
      
      // Generar preguntas basadas en el contexto
      const suggestedQuestions = generateContextualQuestions(keywords, assistantResponse, chatHistory)
      
      // Limitar a 3 preguntas más relevantes
      return suggestedQuestions.slice(0, 3)
    } catch (error) {
      console.error('Error generando preguntas sugeridas:', error)
      return []
    } finally {
      setIsGenerating(false)
    }
  }, [])

  return {
    generateSuggestedQuestions,
    isGenerating
  }
}

// Función para extraer palabras clave del tema
const extractKeywords = (response: string, userQuestion: string): string[] => {
  const legalTerms = [
    'constitución', 'artículo', 'ley', 'decreto', 'resolución', 'sentencia',
    'código', 'norma', 'jurisprudencia', 'tribunal', 'corte', 'demanda',
    'tutela', 'acción', 'proceso', 'procedimiento', 'penal', 'civil',
    'laboral', 'administrativo', 'comercial', 'familia', 'contrato',
    'responsabilidad', 'derecho', 'obligación', 'sanción', 'multa'
  ]
  
  const text = (response + ' ' + userQuestion).toLowerCase()
  const foundTerms = legalTerms.filter(term => text.includes(term))
  
  return foundTerms
}

// Función para generar preguntas contextuales
const generateContextualQuestions = (
  keywords: string[], 
  response: string, 
  chatHistory: string[]
): string[] => {
  const questions: SuggestedQuestion[] = []
  
  // Preguntas basadas en palabras clave específicas
  const keywordQuestions: Record<string, string[]> = {
    'constitución': [
      '¿Qué otros artículos de la Constitución están relacionados?',
      '¿Cuáles son los derechos fundamentales involucrados?',
      '¿Hay jurisprudencia constitucional sobre este tema?'
    ],
    'artículo': [
      '¿Qué otros artículos del mismo código aplican?',
      '¿Cómo se interpreta este artículo en la práctica?',
      '¿Hay modificaciones recientes a este artículo?'
    ],
    'ley': [
      '¿Qué otras leyes complementan esta normativa?',
      '¿Cuándo fue promulgada esta ley?',
      '¿Hay proyectos de ley relacionados?'
    ],
    'sentencia': [
      '¿Qué otras sentencias tratan este tema?',
      '¿Cuál es la jurisprudencia más reciente?',
      '¿Cómo han evolucionado los criterios judiciales?'
    ],
    'demanda': [
      '¿Cuáles son los requisitos para interponer esta demanda?',
      '¿Qué documentos necesito para la demanda?',
      '¿Cuál es el procedimiento completo?'
    ],
    'tutela': [
      '¿Cuándo procede una tutela en este caso?',
      '¿Qué derechos fundamentales se están vulnerando?',
      '¿Cuál es el plazo para interponer la tutela?'
    ],
    'contrato': [
      '¿Qué cláusulas son obligatorias en este contrato?',
      '¿Cuáles son las consecuencias del incumplimiento?',
      '¿Cómo puedo modificar este contrato?'
    ],
    'responsabilidad': [
      '¿Qué tipos de responsabilidad aplican?',
      '¿Cómo se determina la culpa o dolo?',
      '¿Cuáles son las excepciones de responsabilidad?'
    ]
  }
  
  // Generar preguntas basadas en las palabras clave encontradas
  keywords.forEach(keyword => {
    if (keywordQuestions[keyword]) {
      questions.push(...keywordQuestions[keyword].map(q => ({
        question: q,
        category: keyword
      })))
    }
  })
  
  // Preguntas generales basadas en el contexto
  const generalQuestions = [
    '¿Qué otros aspectos legales debo considerar?',
    '¿Hay excepciones o casos especiales?',
    '¿Cuál es la práctica actual en los tribunales?',
    '¿Qué documentos necesito para este proceso?',
    '¿Cuáles son los plazos importantes?',
    '¿Hay sanciones por incumplimiento?',
    '¿Cómo puedo proteger mis derechos?',
    '¿Qué precedentes existen sobre este tema?'
  ]
  
  // Agregar preguntas generales si no hay suficientes específicas
  if (questions.length < 3) {
    const remaining = 3 - questions.length
    generalQuestions.slice(0, remaining).forEach(q => {
      questions.push({
        question: q,
        category: 'general'
      })
    })
  }
  
  // Eliminar duplicados y devolver solo el texto de las preguntas
  const uniqueQuestions = questions
    .map(q => q.question)
    .filter((question, index, array) => array.indexOf(question) === index)
  
  return uniqueQuestions
}
