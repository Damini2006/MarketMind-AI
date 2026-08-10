// Avatar color palette shared by the sidebar and the profile settings.
// Keys are stored on the user (avatar_color); values are literal Tailwind
// classes so they are always included in the build.
export const AVATAR_COLORS = {
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  slate: 'bg-slate-600',
}

export function avatarColorClass(color) {
  return AVATAR_COLORS[color] || AVATAR_COLORS.indigo
}
