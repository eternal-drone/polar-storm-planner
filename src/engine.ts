import {
  DAILY_CITY_CAPTURES,
  DAILY_DIG_CAPTURES,
  MAX_CITIES,
  MAX_DIGS,
  SEASON_DAYS,
  TILE_BY_ID,
  neighbors,
} from './data'
import type {
  Buff,
  Conflict,
  DaySnapshot,
  DayWarning,
  PlanLayer,
  PlannerState,
  Tile,
  TileKind,
} from './types'

export function countKinds(ids: Iterable<string>) {
  let cities = 0
  let digs = 0
  for (const id of ids) {
    const tile = TILE_BY_ID[id]
    if (!tile) continue
    if (tile.kind === 'city') cities += 1
    else digs += 1
  }
  return { cities, digs }
}

export function aggregateTiles(ids: Iterable<string>) {
  let rareSoilPerHour = 0
  let coalPerHour = 0
  let heatC = 0
  let globalHeatC = 0
  const buffs: Buff[] = []
  const tiles: Tile[] = []
  for (const id of ids) {
    const tile = TILE_BY_ID[id]
    if (!tile) continue
    tiles.push(tile)
    rareSoilPerHour += tile.rareSoilPerHour
    coalPerHour += tile.coalPerHour
    heatC += tile.heatC
    globalHeatC += tile.globalHeatC
    if (tile.buff) buffs.push(tile.buff)
  }
  const stacked = new Map<string, Buff>()
  for (const buff of buffs) {
    const prev = stacked.get(buff.key)
    if (prev) prev.percent += buff.percent
    else stacked.set(buff.key, { ...buff })
  }
  return {
    tiles,
    rareSoilPerHour,
    coalPerHour,
    heatC,
    globalHeatC,
    buffs: [...stacked.values()].sort((a, b) => b.percent - a.percent),
  }
}

function isAdjacentToOwned(tile: Tile, owned: Set<string>) {
  if (owned.size === 0) return tile.kind === 'dig' && tile.level === 1
  return neighbors(tile).some((n) => owned.has(n.id))
}

function applyCaptures(owned: Set<string>, captureIds: string[]) {
  const remaining = [...captureIds]
  const applied: string[] = []
  while (remaining.length) {
    const idx = remaining.findIndex((id) => {
      const tile = TILE_BY_ID[id]
      return tile && isAdjacentToOwned(tile, owned)
    })
    if (idx === -1) break
    const id = remaining.splice(idx, 1)[0]
    owned.add(id)
    applied.push(id)
  }
  return { applied, leftover: remaining }
}

export function ownedOnLayer(state: PlannerState, layer: PlanLayer, allianceId: string) {
  return Object.entries(state[layer])
    .filter(([, id]) => id === allianceId)
    .map(([tileId]) => tileId)
}

export function simulateAlliance(state: PlannerState, allianceId: string): DaySnapshot[] {
  const owned = new Set(ownedOnLayer(state, 'current', allianceId))
  const snapshots: DaySnapshot[] = []
  let accumulatedSoil = 0

  for (let day = 1; day <= SEASON_DAYS; day++) {
    const warnings: DayWarning[] = []
    const ownedAtStart = [...owned]
    const actions = state.schedule.filter((a) => a.day === day && a.allianceId === allianceId)
    const dropIds = actions.filter((a) => a.type === 'drop').map((a) => a.tileId)
    const captureIds = actions.filter((a) => a.type === 'capture').map((a) => a.tileId)

    for (const id of dropIds) {
      if (!owned.has(id)) {
        warnings.push({ level: 'warn', message: `Drop ${TILE_BY_ID[id]?.coord ?? id} is not owned.` })
      }
      owned.delete(id)
    }

    let cityCaptures = 0
    let digCaptures = 0
    for (const id of captureIds) {
      const tile = TILE_BY_ID[id]
      if (!tile) continue
      if (tile.kind === 'city') cityCaptures += 1
      else digCaptures += 1
      if (tile.kind === 'city' && day < tile.unlockDay) {
        warnings.push({
          level: 'error',
          message: `${tile.name} ${tile.coord} unlocks on day ${tile.unlockDay} (W${Math.ceil(tile.unlockDay / 7)}).`,
        })
      }
      if (owned.has(id)) {
        warnings.push({ level: 'warn', message: `${tile.coord} is already owned.` })
      }
    }
    if (cityCaptures > DAILY_CITY_CAPTURES) {
      warnings.push({
        level: 'error',
        message: `${cityCaptures} city captures planned; daily max is ${DAILY_CITY_CAPTURES}.`,
      })
    }
    if (digCaptures > DAILY_DIG_CAPTURES) {
      warnings.push({
        level: 'error',
        message: `${digCaptures} dig captures planned; daily max is ${DAILY_DIG_CAPTURES}.`,
      })
    }

    const freshCaptures = captureIds.filter((id) => !owned.has(id))
    const { leftover } = applyCaptures(owned, freshCaptures)
    for (const id of leftover) {
      const tile = TILE_BY_ID[id]
      if (!tile) continue
      if (owned.size === 0 && !(tile.kind === 'dig' && tile.level === 1)) {
        warnings.push({
          level: 'error',
          message: `First territory must be a level 1 Dig Site. ${tile.coord} is not.`,
        })
      } else {
        warnings.push({
          level: 'error',
          message: `${tile.coord} is not adjacent (including corners) to owned land.`,
        })
      }
    }

    const { cities, digs } = countKinds(owned)
    const requiredDrops: { kind: TileKind; count: number }[] = []
    if (cities > MAX_CITIES) requiredDrops.push({ kind: 'city', count: cities - MAX_CITIES })
    if (digs > MAX_DIGS) requiredDrops.push({ kind: 'dig', count: digs - MAX_DIGS })
    const overCapacity = requiredDrops.length > 0
    if (overCapacity) {
      for (const req of requiredDrops) {
        warnings.push({
          level: 'error',
          message: `Over cap: drop ${req.count} ${req.kind === 'city' ? 'city' : 'dig site'} to stay at ${req.kind === 'city' ? MAX_CITIES : MAX_DIGS}.`,
        })
      }
    } else if (cities === MAX_CITIES && cityCaptures > 0 && dropIds.every((id) => TILE_BY_ID[id]?.kind !== 'city')) {
      const capturingNew = captureIds.some((id) => TILE_BY_ID[id]?.kind === 'city' && !dropIds.includes(id))
      if (capturingNew && cities >= MAX_CITIES) {
        /* already at cap after drops+captures handled */
      }
    }

    const totals = aggregateTiles(owned)
    accumulatedSoil += totals.rareSoilPerHour * 24
    snapshots.push({
      day,
      owned: [...owned],
      cities,
      digs,
      cityCaptures,
      digCaptures,
      drops: dropIds,
      captures: captureIds,
      requiredDrops,
      overCapacity,
      ownedAtStart,
      rareSoilPerHour: totals.rareSoilPerHour,
      coalPerHour: totals.coalPerHour,
      heatC: totals.heatC,
      globalHeatC: totals.globalHeatC,
      accumulatedSoil,
      buffs: totals.buffs,
      warnings,
    })
  }
  return snapshots
}

const LAYERS: PlanLayer[] = ['current', 'proposed', 'final']

export function findConflicts(state: PlannerState): Conflict[] {
  const our = state.ourAllianceId
  const conflicts: Conflict[] = []
  for (const oursLayer of LAYERS) {
    for (const [tileId, allianceId] of Object.entries(state[oursLayer])) {
      if (allianceId !== our) continue
      for (const otherLayer of LAYERS) {
        const other = state[otherLayer][tileId]
        if (other && other !== our) {
          conflicts.push({ tileId, oursLayer, otherAllianceId: other, otherLayer })
        }
      }
    }
  }
  return conflicts
}

export function gapAnalysis(state: PlannerState) {
  const our = state.ourAllianceId
  const current = new Set(ownedOnLayer(state, 'current', our))
  const proposed = new Set(ownedOnLayer(state, 'proposed', our))
  const final = new Set(ownedOnLayer(state, 'final', our))
  const toCaptureFinal = [...final].filter((id) => !current.has(id))
  const toDropFinal = [...current].filter((id) => final.size > 0 && !final.has(id))
  const proposedNotFinal = [...proposed].filter((id) => final.size > 0 && !final.has(id))
  const finalNotProposed = [...final].filter((id) => proposed.size > 0 && !proposed.has(id))
  return { toCaptureFinal, toDropFinal, proposedNotFinal, finalNotProposed }
}

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
