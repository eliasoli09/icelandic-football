/**
 * The road from a school five-a-side pitch to the national stadium. Points
 * carry the runner along it; each ground stands at the score it takes to get
 * there. The pictures are pixel redraws of real photographs of each ground
 * (see the vault note Leikir/Leiðin for where each photo came from).
 */
export interface Stadium {
  id: string
  name: string
  /** who plays there, and where */
  home: string
  /** points it takes to reach it */
  at: number
  /** public/leidin/vellir/<id>.png */
  image: string
}

export const STADIUMS: Stadium[] = [
  { id: 'battavollur', name: 'Battavöllurinn', home: 'Skólalóðin, þar sem allt byrjar', at: 0, image: '/leidin/vellir/battavollur.png' },
  { id: 'pcc', name: 'PCC völlurinn', home: 'Völsungur · Húsavík', at: 25, image: '/leidin/vellir/pcc.png' },
  { id: 'korinn', name: 'Kórinn', home: 'HK · Kópavogur', at: 60, image: '/leidin/vellir/korinn.png' },
  { id: 'throttur', name: 'Pepsi Max völlurinn', home: 'Þróttur R. · Laugardalur', at: 100, image: '/leidin/vellir/throttur.png' },
  { id: 'thor', name: 'VÍS völlurinn', home: 'Þór · Akureyri', at: 150, image: '/leidin/vellir/thor.png' },
  { id: 'stjarnan', name: 'Samsung völlurinn', home: 'Stjarnan · Garðabær', at: 205, image: '/leidin/vellir/stjarnan.png' },
  { id: 'ia', name: 'Elkem völlurinn', home: 'ÍA · Akranes', at: 265, image: '/leidin/vellir/ia.png' },
  { id: 'valur', name: 'N1 völlurinn', home: 'Valur · Hlíðarendi', at: 330, image: '/leidin/vellir/valur.png' },
  { id: 'kr', name: 'Frostaskjól', home: 'KR · Vesturbær', at: 395, image: '/leidin/vellir/kr.png' },
  { id: 'vikin', name: 'Víkingsvöllur', home: 'Víkingur R. · Fossvogur', at: 460, image: '/leidin/vellir/vikin.png' },
  { id: 'kaplakriki', name: 'Kaplakriki', home: 'FH · Hafnarfjörður', at: 530, image: '/leidin/vellir/kaplakriki.png' },
  { id: 'laugardalur', name: 'Laugardalsvöllur', home: 'Íslenska landsliðið', at: 600, image: '/leidin/vellir/laugardalur.png' },
]

/** the most a road can give: seven answers at 100 */
export const PERFECT = 700

/** World pixels between two grounds on the road. */
export const SPACING = 560
/** where the first ground stands, so the runner starts in front of it */
export const START_X = 200

export const stadiumX = (i: number) => START_X + i * SPACING

/** The furthest ground a score reaches. */
export function reached(points: number): { stadium: Stadium; index: number } {
  let index = 0
  STADIUMS.forEach((s, i) => { if (points >= s.at) index = i })
  return { stadium: STADIUMS[index], index }
}

/** The next ground ahead, or null at the national stadium. */
export function nextStadium(points: number): Stadium | null {
  return STADIUMS.find((s) => s.at > points) ?? null
}

/**
 * Where on the road a score puts the runner. Between two grounds the distance
 * is shared out evenly over the points between them, so a short leg (25 points
 * to Húsavík) is as long to run as a long one. Past the national stadium the
 * runner goes on into it, up to a perfect road.
 */
export function roadX(points: number): number {
  const p = Math.max(0, Math.min(PERFECT, points))
  const last = STADIUMS.length - 1
  if (p >= STADIUMS[last].at) {
    return stadiumX(last) + ((p - STADIUMS[last].at) / (PERFECT - STADIUMS[last].at)) * 150
  }
  const i = STADIUMS.findIndex((s, k) => k < last && p >= s.at && p < STADIUMS[k + 1].at)
  const a = STADIUMS[i], b = STADIUMS[i + 1]
  return stadiumX(i) + ((p - a.at) / (b.at - a.at)) * SPACING
}
