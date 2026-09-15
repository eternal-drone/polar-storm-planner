import type { Beast, Buff, BuffKey, Tile, TileKind } from './types'

export const MAP_SIZE = 13
export const CENTER = 6
export const SEASON_DAYS = 56
export const MAX_CITIES = 6
export const MAX_DIGS = 4
export const DAILY_CITY_CAPTURES = 2
export const DAILY_DIG_CAPTURES = 2

export const CITY_UNLOCK_DAY: Record<number, number> = {
  1: 3,
  2: 6,
  3: 10,
  4: 13,
  5: 17,
  6: 20,
  7: 28,
}

export const TEMP_BY_DIST = [-80, -70, -60, -50, -40, -30, -15]

export const CITY_STATS: Record<number, { rareSoil: number; heat: number; name: string }> = {
  1: { rareSoil: 350, heat: 5, name: 'Village' },
  2: { rareSoil: 400, heat: 20, name: 'Town' },
  3: { rareSoil: 450, heat: 30, name: 'Factory' },
  4: { rareSoil: 800, heat: 40, name: 'Train Station' },
  5: { rareSoil: 900, heat: 50, name: 'Launch Site' },
  6: { rareSoil: 1000, heat: 60, name: 'War Palace' },
  7: { rareSoil: 0, heat: 0, name: 'Nuclear Furnace' },
}

export const DIG_STATS: Record<number, { rareSoil: number; coal: number }> = {
  1: { rareSoil: 100, coal: 2736 },
  2: { rareSoil: 110, coal: 2880 },
  3: { rareSoil: 120, coal: 3024 },
  4: { rareSoil: 130, coal: 3168 },
  5: { rareSoil: 140, coal: 3312 },
  6: { rareSoil: 150, coal: 3456 },
}

export const VIRUS_RESISTANCE: Record<number, number> = {
  1: 4000,
  2: 6500,
  3: 8500,
  4: 9500,
  5: 10000,
  6: 10500,
}

const BEASTS: Beast[] = [
  { name: 'Polar Bear', troopType: 'Missile', weakness: 'Tank' },
  { name: 'Mutant Gorilla', troopType: 'Aircraft', weakness: 'Missile' },
  { name: 'Mammoth', troopType: 'Tank', weakness: 'Aircraft' },
]

const BUFF_CYCLE: { key: BuffKey; label: string }[] = [
  { key: 'coin', label: 'Coin Production' },
  { key: 'gathering', label: 'Gathering Speed' },
  { key: 'food', label: 'Food Production' },
  { key: 'iron', label: 'Iron Production' },
  { key: 'construction', label: 'Construction Speed' },
  { key: 'research', label: 'Research Speed' },
  { key: 'training', label: 'Training Speed' },
  { key: 'healing', label: 'Healing Speed' },
]

const BUFF_PCT: Record<number, number[]> = {
  1: [2, 2, 3, 5],
  2: [3, 5, 5],
  3: [4, 4, 6],
  4: [6, 6, 8, 15],
  5: [8, 10, 15, 20],
  6: [20],
  7: [10],
}

function chebyshev(row: number, col: number) {
  return Math.max(Math.abs(row - CENTER), Math.abs(col - CENTER))
}

function isCityCell(row: number, col: number) {
  if (row === CENTER && col === CENTER) return true
  return (row + col) % 2 === 1
}

export function coordLabel(row: number, col: number) {
  return `${String.fromCharCode(65 + col)}${row + 1}`
}

export function tileId(row: number, col: number) {
  return `${row},${col}`
}

function cityBuff(row: number, col: number, level: number): Buff | null {
  if (row === CENTER && col === CENTER) {
    return { key: 'march', label: 'March Speed', percent: 10 }
  }
  if (level === 6) {
    if (row === CENTER - 1 && col === CENTER) {
      return { key: 'construction', label: 'Construction Speed', percent: 20 }
    }
    if (row === CENTER && col === CENTER + 1) {
      return { key: 'research', label: 'Research Speed', percent: 20 }
    }
    if (row === CENTER + 1 && col === CENTER) {
      return { key: 'healing', label: 'Healing Speed', percent: 20 }
    }
    if (row === CENTER && col === CENTER - 1) {
      return { key: 'gathering', label: 'Gathering Speed', percent: 20 }
    }
  }
  const angle = (Math.atan2(row - CENTER, col - CENTER) + Math.PI) / (Math.PI * 2)
  const stat = BUFF_CYCLE[Math.floor(angle * BUFF_CYCLE.length + row + col) % BUFF_CYCLE.length]
  const pcts = BUFF_PCT[level] ?? [2]
  const percent = pcts[(row * 13 + col) % pcts.length]
  return { key: stat.key, label: stat.label, percent }
}

function buildTiles(): Tile[] {
  const tiles: Tile[] = []
  for (let row = 0; row < MAP_SIZE; row++) {
    for (let col = 0; col < MAP_SIZE; col++) {
      const dist = chebyshev(row, col)
      const kind: TileKind = isCityCell(row, col) ? 'city' : 'dig'
      const isCapitol = row === CENTER && col === CENTER
      const level = isCapitol ? 7 : 7 - dist
      const city = kind === 'city' ? CITY_STATS[level] : null
      const dig = kind === 'dig' ? DIG_STATS[level] : null
      tiles.push({
        id: tileId(row, col),
        row,
        col,
        coord: coordLabel(row, col),
        kind,
        level,
        name: isCapitol
          ? 'Nuclear Furnace'
          : kind === 'city'
            ? city?.name ?? `City ${level}`
            : `Dig Site`,
        temperature: TEMP_BY_DIST[dist] ?? -15,
        rareSoilPerHour: city?.rareSoil ?? dig?.rareSoil ?? 0,
        coalPerHour: dig?.coal ?? 0,
        heatC: city?.heat ?? 0,
        globalHeatC: isCapitol ? 10 : 0,
        buff: kind === 'city' ? cityBuff(row, col, level) : null,
        beast: kind === 'dig' ? BEASTS[(row * 3 + col) % BEASTS.length] : null,
        virusResistance: kind === 'dig' ? VIRUS_RESISTANCE[level] ?? null : null,
        unlockDay: kind === 'city' ? CITY_UNLOCK_DAY[level] ?? 1 : 1,
      })
    }
  }
  return tiles
}

export const TILES = buildTiles()
export const TILE_BY_ID = Object.fromEntries(TILES.map((t) => [t.id, t]))

export function neighbors(tile: Tile) {
  const out: Tile[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const n = TILE_BY_ID[tileId(tile.row + dr, tile.col + dc)]
      if (n) out.push(n)
    }
  }
  return out
}

export function weekOf(day: number) {
  return Math.min(8, Math.max(1, Math.ceil(day / 7)))
}

export function weekdayOf(day: number) {
  return ((day - 1) % 7) + 1
}

export function dayLabel(day: number) {
  return `W${weekOf(day)}D${weekdayOf(day)}`
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const DEFAULT_ALLIANCE_COLORS = [
  '#2ee6c8',
  '#f4a261',
  '#e76f51',
  '#9b5de5',
  '#00bbf9',
  '#fee440',
  '#ef476f',
  '#118ab2',
  '#90be6d',
  '#f72585',
]
