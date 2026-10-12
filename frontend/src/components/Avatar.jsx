import { useState } from 'react'
import { avatarColorClass } from '../utils/avatar'
import { STATIC_BASE_URL } from '../services/api'

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-9 h-9 text-sm',
  md: 'w-16 h-16 text-xl',
  lg: 'w-24 h-24 text-3xl',
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
}

/**
 * Renders the user's avatar: the uploaded profile photo when available,
 * otherwise colored initials. `user` is the auth user object.
 */
export default function Avatar({ user, size = 'sm', className = '' }) {
  // The stored avatar_url is a row in the database; the FILE it points at can be
  // gone (a deploy without a volume mounted on the uploads directory), which
  // makes the tag 404 and the browser draw a broken-image icon. Remembering which
  // URL failed falls back to the initials instead — and because it is keyed by
  // URL, uploading a new photo recovers on its own without an effect.
  const [failedUrl, setFailedUrl] = useState(null)
  const photoUrl =
    user?.avatar_url && user.avatar_url !== failedUrl
      ? `${STATIC_BASE_URL}${user.avatar_url}`
      : null

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={user?.full_name || 'avatar'}
        onError={() => setFailedUrl(user.avatar_url)}
        className={`rounded-full object-cover shrink-0 overflow-hidden ${SIZE_CLASSES[size] || SIZE_CLASSES.sm} ${className}`}
      />
    )
  }

  return (
    <div
      className={`rounded-full ${avatarColorClass(user?.avatar_color)} text-white flex items-center justify-center font-bold shrink-0 whitespace-nowrap overflow-hidden ${SIZE_CLASSES[size] || SIZE_CLASSES.sm} ${className}`}
    >
      {initials(user?.full_name)}
    </div>
  )
}
