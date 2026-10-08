import Icon from '@/components/shared/Icon'
import { photoUrl } from '@/api/session'
import { useSession } from '@/context/Session'

function initials(name: string | null | undefined): string {
  return (name ?? '').split(' ').filter(Boolean).slice(0, 2).map((word) => [...word][0]).join('').toUpperCase()
}

export default function Avatar({ preview, size = 28 }: { preview?: string | null; size?: number }) {
  const { session, photoVersion } = useSession()
  const letters = initials(session?.profile?.full_name)
  const source = preview === undefined ? (session?.profile?.has_photo ? photoUrl(photoVersion) : null) : preview
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
      {source ? <img src={source} alt="" width={size} height={size} /> : letters || <Icon name="user" size={Math.round(size * 0.65)} />}
    </span>
  )
}
