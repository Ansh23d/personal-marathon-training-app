import { useEffect, useRef } from 'react'

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5 } while (byte >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5 } while (byte >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1
    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}

interface Props {
  polyline: string
}

export function RouteMap({ polyline }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const positions = decodePolyline(polyline)
    if (positions.length === 0) return

    // Dynamically import Leaflet to avoid SSR / module-level DOM crashes
    import('leaflet').then((L) => {
      if (!containerRef.current || mapRef.current) return

      // Fix marker icons
      const iconDefault = L.Icon.Default as any
      delete iconDefault.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(containerRef.current!, { scrollWheelZoom: false })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map)

      // Route line
      L.polyline(positions, { color: '#FC4C02', weight: 3, opacity: 0.9 }).addTo(map)

      // Start (green) and end (red) circle markers
      L.circleMarker(positions[0], { radius: 6, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }).addTo(map)
      L.circleMarker(positions[positions.length - 1], { radius: 6, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }).addTo(map)

      map.fitBounds(L.polyline(positions).getBounds(), { padding: [20, 20] })
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [polyline])

  if (!polyline) {
    return (
      <div className="w-full h-72 rounded-xl bg-gray-800 flex items-center justify-center text-gray-500 text-sm">
        No route data available
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-72 rounded-xl overflow-hidden"
      style={{ zIndex: 0 }}
    />
  )
}
