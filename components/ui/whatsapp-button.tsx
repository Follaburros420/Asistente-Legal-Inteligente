"use client"

import WhatsAppSVG from "@/components/icons/whatsapp-svg"

interface WhatsAppButtonProps {
  phoneNumber: string
  message?: string
  className?: string
}

export default function WhatsAppButton({ 
  phoneNumber, 
  message = "Hola, me interesa conocer más sobre ALI", 
  className = "" 
}: WhatsAppButtonProps) {
  const handleClick = () => {
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodedMessage}`
    window.open(whatsappUrl, '_blank')
  }

  return (
    <button
      onClick={handleClick}
      className={`
        fixed bottom-6 right-6 z-50
        bg-green-500 hover:bg-green-600 
        text-white rounded-full p-4
        shadow-lg hover:shadow-xl
        transition-all duration-300 ease-in-out
        hover:scale-110 active:scale-95
        group
        focus:outline-none focus:ring-4 focus:ring-green-300
        md:bottom-8 md:right-8
        ${className}
      `}
      aria-label="Contactar por WhatsApp"
      title="Contactar por WhatsApp"
    >
      <WhatsAppSVG className="w-6 h-6 md:w-7 md:h-7" />
      
      {/* Tooltip */}
      <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none">
        ¡Escríbenos por WhatsApp!
        <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>

      {/* Pulse animation */}
      <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-20"></div>
    </button>
  )
}
