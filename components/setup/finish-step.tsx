import { FC } from "react"

interface FinishStepProps {
  displayName: string
}

export const FinishStep: FC<FinishStepProps> = ({ displayName }) => {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="text-2xl font-bold text-primary">
          ¡Bienvenido al Asistente Legal Inteligente
          {displayName.length > 0 ? `, ${displayName.split(" ")[0]}` : null}!
        </div>
        
        <div className="text-muted-foreground">
          Tu plataforma de inteligencia artificial para la práctica legal
        </div>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        Haz clic en "Siguiente" para comenzar a usar tu asistente legal.
      </div>
    </div>
  )
}
