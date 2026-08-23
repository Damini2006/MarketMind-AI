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
  const photoUrl = user?.avatar_url
    ? `${STATIC_BASE_URL}${user.avatar_url}`
    : null

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={user?.full_name || 'avatar'}
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
