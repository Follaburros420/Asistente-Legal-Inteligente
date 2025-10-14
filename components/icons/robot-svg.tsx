import { FC } from "react"

interface RobotSVGProps {
  theme?: "light" | "dark"
  scale?: number
  className?: string
}

export const RobotSVG: FC<RobotSVGProps> = ({ 
  theme = "dark", 
  scale = 1, 
  className = "" 
}) => {
  const size = 512 * scale
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 512 512" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Cabeza del robot */}
      <circle 
        cx="256" 
        cy="200" 
        r="120" 
        fill={theme === "dark" ? "#E5E7EB" : "#1F2937"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="4"
      />
      
      {/* Antena */}
      <line 
        x1="256" 
        y1="80" 
        x2="256" 
        y2="120" 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="3"
      />
      <circle 
        cx="256" 
        cy="75" 
        r="8" 
        fill={theme === "dark" ? "#9CA3AF" : "#6B7280"}
      />
      
      {/* Ojos */}
      <circle 
        cx="220" 
        cy="180" 
        r="25" 
        fill={theme === "dark" ? "#FFFFFF" : "#000000"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="3"
      />
      <circle 
        cx="220" 
        cy="180" 
        r="15" 
        fill={theme === "dark" ? "#000000" : "#FFFFFF"}
      />
      <circle 
        cx="225" 
        cy="175" 
        r="4" 
        fill={theme === "dark" ? "#FFFFFF" : "#000000"}
      />
      
      {/* Ojo cerrado (guiño) */}
      <path 
        d="M 292 175 Q 302 180 292 185" 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="3" 
        fill="none"
      />
      
      {/* Sonrisa */}
      <path 
        d="M 200 220 Q 256 250 312 220" 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="3" 
        fill="none"
      />
      
      {/* Auriculares */}
      <ellipse 
        cx="180" 
        cy="200" 
        rx="35" 
        ry="25" 
        fill={theme === "dark" ? "#4B5563" : "#9CA3AF"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="2"
      />
      <ellipse 
        cx="332" 
        cy="200" 
        rx="35" 
        ry="25" 
        fill={theme === "dark" ? "#4B5563" : "#9CA3AF"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="2"
      />
      <line 
        x1="145" 
        y1="200" 
        x2="367" 
        y2="200" 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="3"
      />
      
      {/* Cuerpo (traje) */}
      <rect 
        x="180" 
        y="320" 
        width="152" 
        height="120" 
        fill={theme === "dark" ? "#374151" : "#E5E7EB"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="4" 
        rx="10"
      />
      
      {/* Camisa */}
      <rect 
        x="200" 
        y="340" 
        width="112" 
        height="80" 
        fill={theme === "dark" ? "#FFFFFF" : "#000000"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="2" 
        rx="5"
      />
      
      {/* Corbata */}
      <polygon 
        points="256,340 240,380 272,380" 
        fill="#F97316" 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="2"
      />
      <rect 
        x="250" 
        y="380" 
        width="12" 
        height="40" 
        fill="#F97316" 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="2"
      />
      
      {/* Cuello */}
      <rect 
        x="240" 
        y="320" 
        width="32" 
        height="20" 
        fill={theme === "dark" ? "#FFFFFF" : "#000000"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="2"
      />
      
      {/* Brazos */}
      <rect 
        x="140" 
        y="340" 
        width="40" 
        height="80" 
        fill={theme === "dark" ? "#374151" : "#E5E7EB"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="3" 
        rx="20"
      />
      <rect 
        x="332" 
        y="340" 
        width="40" 
        height="80" 
        fill={theme === "dark" ? "#374151" : "#E5E7EB"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="3" 
        rx="20"
      />
      
      {/* Manos */}
      <circle 
        cx="160" 
        cy="440" 
        r="15" 
        fill={theme === "dark" ? "#E5E7EB" : "#1F2937"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="2"
      />
      <circle 
        cx="352" 
        cy="440" 
        r="15" 
        fill={theme === "dark" ? "#E5E7EB" : "#1F2937"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="2"
      />
      
      {/* Piernas */}
      <rect 
        x="200" 
        y="440" 
        width="30" 
        height="60" 
        fill={theme === "dark" ? "#374151" : "#E5E7EB"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="3" 
        rx="15"
      />
      <rect 
        x="282" 
        y="440" 
        width="30" 
        height="60" 
        fill={theme === "dark" ? "#374151" : "#E5E7EB"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="3" 
        rx="15"
      />
      
      {/* Pies */}
      <ellipse 
        cx="215" 
        cy="510" 
        rx="20" 
        ry="8" 
        fill={theme === "dark" ? "#1F2937" : "#F3F4F6"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="2"
      />
      <ellipse 
        cx="297" 
        cy="510" 
        rx="20" 
        ry="8" 
        fill={theme === "dark" ? "#1F2937" : "#F3F4F6"} 
        stroke={theme === "dark" ? "#000000" : "#FFFFFF"} 
        strokeWidth="2"
      />
    </svg>
  )
}















