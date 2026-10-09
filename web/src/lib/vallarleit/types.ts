export interface VClub {
  /** stable slug, the key saved games refer to */
  id: string
  name: string
  /** other names a player might type: full name, short name, Icelandic name */
  aliases: string[]
  league: string
  lat: number
  lon: number
  stadium: string | null
  city: string | null
  /** Wikipedia language editions with an article on the club - how well known it is */
  fame: number
  /** placed at its town, not its ground: Wikipedia has no coordinates for the ground */
  approx?: true
}
