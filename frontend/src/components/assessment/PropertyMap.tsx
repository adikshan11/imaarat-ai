import { useEffect, useRef, useState, type ReactNode } from 'react'
import Card from '@/components/shared/Card'
import { usePreferences } from '@/context/Preferences'
import { loadMaps, pickFromResult } from '@/api/maps'
import type { MapsApi, MapInstance, MarkerInstance, PlacePick } from '@/api/maps'
import './PropertyMap.css'

const INDIA = { lat: 22.5, lng: 79 }
const INDIA_BOUNDS = { north: 37.5, south: 6, west: 67, east: 98 }

const valid = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value !== 0

function Frame({ framed, title, children }: { framed: boolean; title: string; children: ReactNode }) {
  return framed ? <Card title={title}>{children}</Card> : <div className="map-block">{children}</div>
}

export default function PropertyMap({ latitude, longitude, onPick, framed = false }: { latitude?: number | null; longitude?: number | null; onPick?: (pick: PlacePick) => void; framed?: boolean }) {
  const { t } = usePreferences()
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<MapsApi | null>(null)
  const map = useRef<MapInstance | null>(null)
  const marker = useRef<MarkerInstance | null>(null)
  const handler = useRef(onPick)
  const [state, setState] = useState<'loading' | 'off' | 'failed' | 'ready'>('loading')
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')
  const editable = Boolean(onPick)

  useEffect(() => { handler.current = onPick }, [onPick])

  useEffect(() => {
    let active = true
    void loadMaps().then((loaded) => {
      if (!active) return
      api.current = loaded.api
      setState(loaded.api ? 'ready' : loaded.keyed ? 'failed' : 'off')
    })
    return () => { active = false }
  }, [])

  const place = (lat: number, lng: number, known?: PlacePick) => {
    const position = { lat, lng }
    marker.current?.setPosition(position)
    marker.current?.setVisible(true)
    map.current?.panTo(position)
    handler.current?.({ lat, lng })
    if (known) {
      handler.current?.(known)
      return
    }
    void new (api.current as MapsApi).maps.Geocoder().geocode({ location: position }).then((response) => handler.current?.(pickFromResult(position, response.results[0]))).catch(() => undefined)
  }

  useEffect(() => {
    if (state !== 'ready' || !host.current || !api.current || map.current) return
    const { maps } = api.current
    const has = valid(latitude) && valid(longitude)
    const center = has ? { lat: latitude, lng: longitude } : INDIA
    const instance = new maps.Map(host.current, {
      center,
      zoom: has ? 15 : 5,
      restriction: { latLngBounds: INDIA_BOUNDS, strictBounds: false },
      mapTypeControl: false,
      streetViewControl: false,
      gestureHandling: 'cooperative',
    })
    map.current = instance
    if (has || editable) {
      marker.current = new maps.Marker({ map: instance, position: center, draggable: editable, visible: has })
    }
    if (editable) {
      instance.addListener('click', (event) => {
        if (!event.latLng) return
        place(event.latLng.lat(), event.latLng.lng())
      })
      marker.current?.addListener('dragend', (event) => {
        if (!event.latLng) return
        place(event.latLng.lat(), event.latLng.lng())
      })
    }
  })

  useEffect(() => {
    if (state !== 'ready' || !map.current || !valid(latitude) || !valid(longitude)) return
    const position = { lat: latitude, lng: longitude }
    if (!marker.current && api.current) marker.current = new api.current.maps.Marker({ map: map.current, position, draggable: editable })
    marker.current?.setPosition(position)
    marker.current?.setVisible(true)
    map.current.panTo(position)
  }, [state, latitude, longitude, editable])

  const search = async () => {
    const text = query.trim()
    if (!text || !api.current) return
    setNote('')
    try {
      const { results } = await new api.current.maps.Geocoder().geocode({ address: text, componentRestrictions: { country: 'IN' } })
      const found = results[0]?.geometry?.location
      if (!found) {
        setNote(t('map.not_found'))
        return
      }
      const position = { lat: found.lat(), lng: found.lng() }
      map.current?.setZoom(16)
      place(position.lat, position.lng, pickFromResult(position, results[0]))
    } catch {
      setNote(t('map.not_found'))
    }
  }

  const locate = () => {
    setNote('')
    if (!navigator.geolocation) {
      setNote(t('map.denied'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.current?.setZoom(17)
        place(position.coords.latitude, position.coords.longitude)
      },
      () => setNote(t('map.denied')),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  if (state === 'off' || state === 'loading') return null
  if (state === 'failed') return <p className="map-note" role="status">{t('map.failed')}</p>

  return (
    <Frame framed={framed} title={t('map.title')}>
      {editable && (
        <div className="map-tools">
          <input type="search" value={query} placeholder={t('map.search_placeholder')} aria-label={t('map.search')} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search() } }} />
          <button type="button" className="btn btn-secondary" onClick={() => void search()}>{t('map.search')}</button>
          <button type="button" className="btn btn-secondary" onClick={locate}>{t('map.locate')}</button>
        </div>
      )}
      <div className="map-canvas" ref={host} role="application" aria-label={t('map.title')} />
      {editable && <p className="map-note">{t('map.hint')}</p>}
      {note && <p className="map-note" role="status">{note}</p>}
    </Frame>
  )
}
