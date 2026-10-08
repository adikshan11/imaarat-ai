import { useEffect, useState, type FormEvent } from 'react'
import Avatar from '@/components/account/Avatar'
import { Spinner } from '@/components/shared/Loader'
import { savePhoto, saveProfile } from '@/api/session'
import { usePreferences } from '@/context/Preferences'
import { useSession } from '@/context/Session'

const PHOTO_BYTES = 2_000_000

export default function ProfileForm({ onboarding = false }: { onboarding?: boolean }) {
  const { t } = usePreferences()
  const { session, setProfile } = useSession()
  const [fullName, setFullName] = useState(session?.profile?.full_name ?? '')
  const [phone, setPhone] = useState(session?.profile?.phone ?? '')
  const [photo, setPhoto] = useState<File | null>(null)
  const [removed, setRemoved] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!photo) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])
  if (!session) return null
  const hasPhoto = Boolean(photo) || (session.profile?.has_photo && !removed)

  const choose = (file: File | undefined) => {
    setSaved(false)
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > PHOTO_BYTES) {
      setError(t('profile.photo_hint'))
      return
    }
    setError(null)
    setRemoved(false)
    setPhoto(file)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      let profile = await saveProfile(session.csrf_token, fullName, phone)
      if (photo || removed) profile = await savePhoto(session.csrf_token, photo)
      setPhoto(null)
      setRemoved(false)
      setFullName(profile.full_name ?? '')
      setPhone(profile.phone ?? '')
      setProfile(profile)
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="profile-form form-grid" onSubmit={(event) => { void submit(event) }}>
      <div className="profile-photo">
        <Avatar size={72} preview={preview ?? (removed ? null : undefined)} />
        <div className="profile-photo-actions">
          <span className="profile-photo-label">{t('profile.photo')}</span>
          <div className="profile-photo-buttons">
            <label className="btn btn-secondary profile-upload">
              {t('profile.photo_choose')}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { choose(event.target.files?.[0]); event.target.value = '' }} />
            </label>
            {hasPhoto && <button type="button" className="btn btn-secondary" onClick={() => { setPhoto(null); setRemoved(true); setSaved(false) }}>{t('profile.photo_remove')}</button>}
          </div>
          <span className="field-hint">{t('profile.photo_hint')}</span>
        </div>
      </div>
      <label>
        {t('profile.name')}
        <input value={fullName} onChange={(event) => { setFullName(event.target.value); setSaved(false) }} autoComplete="name" required minLength={2} maxLength={80} />
      </label>
      <label>
        {t('profile.phone')}
        <input type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setSaved(false) }} autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" required maxLength={20} dir="ltr" />
        <span className="field-hint">{t('profile.phone_hint')}</span>
      </label>
      {error && <p className="signin-error" role="alert">{error}</p>}
      <div className="profile-actions">
        {saved && !onboarding && <span className="profile-saved" role="status">{t('profile.saved')}</span>}
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving && <Spinner />}{t(onboarding ? 'profile.continue' : 'profile.save')}</button>
      </div>
    </form>
  )
}
