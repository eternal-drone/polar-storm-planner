export type TileKind = 'city' | 'dig'
export type PlanLayer = 'current' | 'proposed' | 'final'
export type ActionType = 'capture' | 'drop'
export type BuffKey =
  | 'coin'
  | 'food'
  | 'iron'
  | 'gathering'
  | 'construction'
  | 'research'
  | 'training'
  | 'healing'
  | 'march'

export interface Buff {
  key: BuffKey
  label: string
  percent: number
}

export interface Beast {
  name: string
  troopType: string
  weakness: string
}

export interface Tile {
  id: string
  row: number
  col: number
  coord: string
  kind: TileKind
  level: number
  name: string
  temperature: number
  rareSoilPerHour: number
  coalPerHour: number
  heatC: number
  globalHeatC: number
  buff: Buff | null
  beast: Beast | null
  virusResistance: number | null
  unlockDay: number
}

export interface Alliance {
  id: string
  name: string
  tag: string
  color: string
  isUs: boolean
}

export interface ScheduleAction {
  id: string
  day: number
  tileId: string
  allianceId: string
  type: ActionType
  note: string
}

export interface PlannerState {
  alliances: Alliance[]
  ourAllianceId: string
  current: Record<string, string>
  proposed: Record<string, string>
  final: Record<string, string>
  labels: Record<string, string>
  schedule: ScheduleAction[]
}

export interface DayWarning {
  level: 'error' | 'warn' | 'info'
  message: string
}

export interface DaySnapshot {
  day: number
  owned: string[]
  cities: number
  digs: number
  cityCaptures: number
  digCaptures: number
  drops: string[]
  captures: string[]
  requiredDrops: { kind: TileKind; count: number }[]
  overCapacity: boolean
  ownedAtStart: string[]
  rareSoilPerHour: number
  coalPerHour: number
  heatC: number
  globalHeatC: number
  accumulatedSoil: number
  buffs: Buff[]
  warnings: DayWarning[]
}

export interface Conflict {
  tileId: string
  oursLayer: PlanLayer
  otherAllianceId: string
  otherLayer: PlanLayer
}
