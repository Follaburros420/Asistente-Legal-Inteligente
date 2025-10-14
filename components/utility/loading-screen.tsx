"use client"

import { FC } from "react"

interface LoadingScreenProps {
  message?: string
}

export const LoadingScreen: FC<LoadingScreenProps> = ({ 
  message = "Cargando..." 
}) => {
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'hsl(0, 0%, 3.9%)',
        color: 'hsl(0, 0%, 98%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <div 
        style={{
          width: '80px',
          height: '80px',
          border: '8px solid hsl(0, 0%, 20%)',
          borderTop: '8px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />
      <p 
        style={{
          marginTop: '2rem',
          fontSize: '1.25rem',
          fontWeight: '600',
          color: 'hsl(0, 0%, 80%)'
        }}
      >
        {message}
      </p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}













