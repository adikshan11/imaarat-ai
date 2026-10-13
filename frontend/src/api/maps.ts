const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export interface LatLng { lat: number; lng: number }
interface Point { lat(): number; lng(): number }
export interface AddressPart { long_name: string; types: string[] }
export interface GeocodeResult { formatted_address?: string; address_components?: AddressPart[]; geometry?: { location: Point } }
export interface MapClick { latLng?: Point }
export interface MapInstance {
  panTo(position: LatLng): void
  setZoom(zoom: number): void
  addListener(name: string, handler: (event: MapClick) => void): void
}
export interface MarkerInstance {
  setPosition(position: LatLng): void
  setVisible(visible: boolean): void
  addListener(name: string, handler: (event: MapClick) => void): void
}
export interface MapsApi {
  maps: {
    Map: new (host: HTMLElement, options: object) => MapInstance
    Marker: new (options: object) => MarkerInstance
    Geocoder: new () => { geocode(request: object): Promise<{ results: GeocodeResult[] }> }
  }
}
export interface MapsLoad { keyed: boolean; api: MapsApi | null }

interface MapsWindow { google?: MapsApi; imaaratMapsReady?: () => void }

let pending: Promise<MapsLoad> | null = null

function injectScript(key: string): Promise<MapsApi | null> {
  return new Promise((resolve) => {
    const scope = window as unknown as MapsWindow
    if (scope.google?.maps) {
      resolve(scope.google)
      return
    }
    scope.imaaratMapsReady = () => resolve(scope.google ?? null)
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=imaaratMapsReady&v=weekly`
    script.async = true
    script.onerror = () => resolve(null)
    document.head.append(script)
  })
}

export function loadMaps(): Promise<MapsLoad> {
  pending ??= fetch(`${API_BASE_URL}/maps/config`)
    .then((response) => (response.ok ? response.json() : null))
    .then(async (body: { key?: string | null } | null) => (body?.key ? { keyed: true, api: await injectScript(body.key) } : { keyed: false, api: null }))
    .catch(() => ({ keyed: false, api: null }))
  return pending
}

export interface PlacePick { lat: number; lng: number; address?: string; city?: string; state?: string; zip?: string }

export function pickFromResult(position: LatLng, result: GeocodeResult | undefined): PlacePick {
  const parts = result?.address_components ?? []
  const find = (...types: string[]) => parts.find((part) => types.some((type) => part.types.includes(type)))?.long_name
  return {
    ...position,
    address: result?.formatted_address,
    city: find('locality', 'administrative_area_level_2'),
    state: find('administrative_area_level_1'),
    zip: find('postal_code'),
  }
}
