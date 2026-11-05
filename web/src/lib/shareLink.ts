import { SITE_URL } from './site'

/** The link at the end of a shared game result. The tag lets utm_visit count landings that came from a shared result. */
export const shareUrl = (path: string, game: string) =>
  `${SITE_URL}${path}?utm_source=deila&utm_medium=share&utm_campaign=${game}`
