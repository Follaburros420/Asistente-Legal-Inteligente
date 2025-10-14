import { FC } from "react"

interface LegalSVGProps {
  theme: "dark" | "light"
  scale?: number
}

export const LegalSVG: FC<LegalSVGProps> = ({ theme, scale = 1 }) => {
  const primaryColor = theme === "dark" ? "#d4af37" : "#1e3a5f"
  const bgColor = theme === "dark" ? "#1e3a5f" : "#ffffff"
  const accentColor = theme === "dark" ? "#c9a961" : "#8b7429"
  
  return (
    <svg
      width={200 * scale}
      height={200 * scale}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Fondo circular */}
      <circle cx="100" cy="100" r="95" fill={bgColor} stroke={primaryColor} strokeWidth="3"/>
      
      {/* Balanza de la justicia */}
      <g id="balanza">
        {/* Columna central */}
        <rect x="95" y="70" width="10" height="70" fill={primaryColor} rx="2"/>
        
        {/* Base */}
        <ellipse cx="100" cy="145" rx="30" ry="8" fill={primaryColor}/>
        
        {/* Barra horizontal */}
        <rect x="50" y="67" width="100" height="6" fill={primaryColor} rx="3"/>
        
        {/* Plato izquierdo */}
        <g id="plato-izq">
          {/* Cadenas */}
          <line x1="60" y1="70" x2="55" y2="90" stroke={primaryColor} strokeWidth="2"/>
          <line x1="60" y1="70" x2="65" y2="90" stroke={primaryColor} strokeWidth="2"/>
          
          {/* Plato */}
          <ellipse cx="60" cy="90" rx="20" ry="5" fill={accentColor}/>
          <path d="M 40 90 Q 40 95, 60 95 Q 80 95, 80 90" fill={primaryColor}/>
        </g>
        
        {/* Plato derecho */}
        <g id="plato-der">
          {/* Cadenas */}
          <line x1="140" y1="70" x2="135" y2="90" stroke={primaryColor} strokeWidth="2"/>
          <line x1="140" y1="70" x2="145" y2="90" stroke={primaryColor} strokeWidth="2"/>
          
          {/* Plato */}
          <ellipse cx="140" cy="90" rx="20" ry="5" fill={accentColor}/>
          <path d="M 120 90 Q 120 95, 140 95 Q 160 95, 160 90" fill={primaryColor}/>
        </g>
        
        {/* Círculo superior */}
        <circle cx="100" cy="62" r="8" fill={primaryColor}/>
      </g>
      
      {/* Libro de leyes debajo */}
      <g id="libro">
        <rect x="75" y="155" width="50" height="30" fill="#8b4513" rx="2"/>
        <rect x="77" y="157" width="46" height="26" fill="#a0522d" rx="1"/>
        <line x1="100" y1="157" x2="100" y2="183" stroke="#8b4513" strokeWidth="2"/>
        <text x="100" y="173" fontFamily="serif" fontSize="14" fontWeight="bold" fill={primaryColor} textAnchor="middle">LEY</text>
      </g>
      
      {/* Texto circular superior */}
      <path id="circlePath" d="M 100,25 m -70,0 a 70,70 0 1,1 140,0 a 70,70 0 1,1 -140,0" fill="none"/>
      <text fontFamily="serif" fontSize="16" fontWeight="bold" fill={primaryColor} letterSpacing="2">
        <textPath href="#circlePath" startOffset="50%" textAnchor="middle">
          ASISTENTE LEGAL
        </textPath>
      </text>
    </svg>
  )
}














