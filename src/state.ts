import { DEFAULT_ALLIANCE_COLORS } from './data'
import { newId } from './engine'
import type { ActionType, Alliance, PlanLayer, PlannerState, ScheduleAction } from './types'

export const STORAGE_KEY = 'lw-s2-planner-v1'

export function defaultState(): PlannerState {
  const us: Alliance = {
    id: 'us',
    name: 'Our Alliance',
    tag: 'OURS',
    color: DEFAULT_ALLIANCE_COLORS[0],
    isUs: true,
  }
  return {
    alliances: [
      us,
      { id: 'a2', name: 'Neighbor A', tag: 'NBR', color: DEFAULT_ALLIANCE_COLORS[1], isUs: false },
      { id: 'a3', name: 'Rival B', tag: 'RVL', color: DEFAULT_ALLIANCE_COLORS[2], isUs: false },
    ],
    ourAllianceId: us.id,
    current: {},
    proposed: {},
    final: {},
    labels: {},
    schedule: [],
  }
}

export function loadState(): PlannerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as PlannerState
    if (!parsed.alliances?.length) return defaultState()
    return { ...defaultState(), ...parsed }
  } catch {
    return defaultState()
  }
}

export function saveState(state: PlannerState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function exportState(state: PlannerState) {
  return JSON.stringify(state, null, 2)
}

export function parseImported(text: string): PlannerState {
  const parsed = JSON.parse(text) as PlannerState
  if (!parsed.alliances || !parsed.current) throw new Error('Invalid plan file')
  return { ...defaultState(), ...parsed }
}

export function assignTile(
  state: PlannerState,
  layer: PlanLayer,
  tileId: string,
  allianceId: string | null,
): PlannerState {
  const next = { ...state[layer] }
  if (!allianceId || next[tileId] === allianceId) delete next[tileId]
  else next[tileId] = allianceId
  return { ...state, [layer]: next }
}

export function setLabel(state: PlannerState, tileId: string, text: string): PlannerState {
  const labels = { ...state.labels }
  if (!text.trim()) delete labels[tileId]
  else labels[tileId] = text.trim()
  return { ...state, labels }
}

export function upsertAlliance(state: PlannerState, alliance: Alliance): PlannerState {
  const exists = state.alliances.some((a) => a.id === alliance.id)
  const alliances = exists
    ? state.alliances.map((a) => (a.id === alliance.id ? alliance : a))
    : [...state.alliances, alliance]
  return { ...state, alliances }
}

export function removeAlliance(state: PlannerState, allianceId: string): PlannerState {
  if (allianceId === state.ourAllianceId) return state
  const strip = (layer: Record<string, string>) =>
    Object.fromEntries(Object.entries(layer).filter(([, id]) => id !== allianceId))
  return {
    ...state,
    alliances: state.alliances.filter((a) => a.id !== allianceId),
    current: strip(state.current),
    proposed: strip(state.proposed),
    final: strip(state.final),
    schedule: state.schedule.filter((a) => a.allianceId !== allianceId),
  }
}

export function addAlliance(state: PlannerState): PlannerState {
  const used = new Set(state.alliances.map((a) => a.color))
  const color = DEFAULT_ALLIANCE_COLORS.find((c) => !used.has(c)) ?? '#888888'
  const n = state.alliances.length + 1
  return {
    ...state,
    alliances: [
      ...state.alliances,
      { id: newId(), name: `Alliance ${n}`, tag: `A${n}`, color, isUs: false },
    ],
  }
}

export function addAction(
  state: PlannerState,
  partial: Omit<ScheduleAction, 'id'>,
): PlannerState {
  const duplicate = state.schedule.find(
    (a) =>
      a.day === partial.day &&
      a.tileId === partial.tileId &&
      a.allianceId === partial.allianceId &&
      a.type === partial.type,
  )
  if (duplicate) return state
  return { ...state, schedule: [...state.schedule, { ...partial, id: newId() }] }
}

export function toggleScheduleAction(
  state: PlannerState,
  partial: Omit<ScheduleAction, 'id'>,
): PlannerState {
  const existing = state.schedule.find(
    (a) =>
      a.day === partial.day &&
      a.tileId === partial.tileId &&
      a.allianceId === partial.allianceId &&
      a.type === partial.type,
  )
  if (existing) {
    return { ...state, schedule: state.schedule.filter((a) => a.id !== existing.id) }
  }
  const withoutOpposite = state.schedule.filter(
    (a) =>
      !(
        a.day === partial.day &&
        a.tileId === partial.tileId &&
        a.allianceId === partial.allianceId
      ),
  )
  return { ...state, schedule: [...withoutOpposite, { ...partial, id: newId() }] }
}

export function placeScheduleAction(
  state: PlannerState,
  partial: Omit<ScheduleAction, 'id'>,
): PlannerState {
  const already = state.schedule.find(
    (a) =>
      a.day === partial.day &&
      a.tileId === partial.tileId &&
      a.allianceId === partial.allianceId &&
      a.type === partial.type,
  )
  if (already) return state
  const withoutMoved = state.schedule.filter(
    (a) =>
      !(
        a.tileId === partial.tileId &&
        a.allianceId === partial.allianceId &&
        a.type === partial.type
      ),
  )
  const withoutOpposite = withoutMoved.filter(
    (a) =>
      !(
        a.day === partial.day &&
        a.tileId === partial.tileId &&
        a.allianceId === partial.allianceId
      ),
  )
  return { ...state, schedule: [...withoutOpposite, { ...partial, id: newId() }] }
}

export function removeAction(state: PlannerState, id: string): PlannerState {
  return { ...state, schedule: state.schedule.filter((a) => a.id !== id) }
}

export function updateAction(state: PlannerState, id: string, patch: Partial<ScheduleAction>): PlannerState {
  return {
    ...state,
    schedule: state.schedule.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  }
}

export function scheduleForTile(
  state: PlannerState,
  tileId: string,
  allianceId: string,
  day: number,
  type: ActionType,
) {
  return addAction(state, { day, tileId, allianceId, type, note: '' })
}
