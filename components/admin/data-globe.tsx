"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import createGlobe from "cobe"
import { createClient } from "@/lib/supabase/client"

interface UserLocation {
    city: string
    country: string
    lat: number
    lng: number
    ip: string
}

export function DataGlobe() {
    const [locations, setLocations] = useState<UserLocation[]>([])
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null)
    const supabase = createClient()
    const phiRef = useRef(0)

    const fetchLocations = useCallback(async () => {
        const { data, error } = await supabase
            .from("user_locations" as any)
            .select("latitude, longitude, city, country, ip_address")
            .not("latitude", "is", null)
            .not("longitude", "is", null)
            .order('created_at', { ascending: false })
            .limit(1000)

        if (error) {
            console.error("Error loading locations:", error)
            return []
        }

        return (data || []).map((d: any) => ({
            lat: d.latitude,
            lng: d.longitude,
            city: d.city,
            country: d.country,
            ip: d.ip_address,
        }))
    }, [supabase])

    useEffect(() => {
        let isMounted = true

        async function initGlobe() {
            const locs = await fetchLocations()
            if (!isMounted) return
            setLocations(locs)

            if (canvasRef.current && !globeRef.current) {
                globeRef.current = createGlobe(canvasRef.current, {
                    devicePixelRatio: 2,
                    width: 600 * 2,
                    height: 600 * 2,
                    phi: 0,
                    theta: 0.3,
                    dark: 1,
                    diffuse: 1.2,
                    mapSamples: 16000,
                    mapBrightness: 6,
                    baseColor: [0.1, 0.1, 0.15],
                    markerColor: [0.627, 0.365, 0.929], // Purple color #a05eff
                    glowColor: [0.627, 0.365, 0.929],
                    markers: locs.map(loc => ({
                        location: [loc.lat, loc.lng],
                        size: 0.05
                    })),
                    onRender: (state) => {
                        // Auto rotate
                        phiRef.current += 0.002
                        state.phi = phiRef.current
                    }
                })
            }
        }

        initGlobe()

        return () => {
            isMounted = false
            if (globeRef.current) {
                globeRef.current.destroy?.()
                globeRef.current = null
            }
        }
    }, [fetchLocations])

    return (
        <div className="relative h-[600px] w-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#0B0F19]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(124,58,237,0.15),transparent_70%)] pointer-events-none" />
            
            {/* Globe Canvas */}
            <div className="absolute inset-0 flex items-center justify-center">
                <canvas
                    ref={canvasRef}
                    style={{
                        width: 600,
                        height: 600,
                        aspectRatio: '1',
                        opacity: locations.length > 0 ? 1 : 0.3,
                    }}
                    className="transition-opacity duration-500"
                />
            </div>

            {/* Loading overlay */}
            {locations.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-gray-400 animate-pulse">Cargando mapa del mundo...</div>
                </div>
            )}

            {/* Overlay Stats */}
            <div className="absolute top-6 left-6 z-10 p-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
                <h3 className="text-white font-bold text-sm tracking-wide uppercase mb-1">Mapa de Usuarios</h3>
                <div className="flex items-center space-x-2">
                    <span className="relative flex h-3 w-3">
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                    </span>
                    <span className="text-2xl font-bold text-white tracking-tight">{locations.length}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Ubicaciones registradas</p>
            </div>

            {/* Legend */}
            <div className="absolute bottom-6 right-6 z-10 p-3 rounded-lg border border-white/10 bg-black/40 backdrop-blur-md">
                <div className="flex items-center gap-2 text-xs text-gray-300">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    <span>Actividad de usuarios</span>
                </div>
            </div>
        </div>
    )
}
