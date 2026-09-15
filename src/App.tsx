import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { WorldMap } from './components/WorldMap'
import { Sidebar } from './components/Sidebar'
import { ScheduleBoard } from './components/ScheduleBoard'
import type { ActionType, Alliance, PlanLayer, PlannerState } from './types'
import {
  addAlliance,
  assignTile,
  exportState,
  loadState,
  parseImported,
  placeScheduleAction,
  removeAction,
  removeAlliance,
  saveState,
  setLabel,
  toggleScheduleAction,
  upsertAlliance,
} from './state'
import { countKinds, findConflicts, ownedOnLayer, simulateAlliance } from './engine'
import { SEASON_DAYS, TILE_BY_ID, dayLabel } from './data'

interface TileDrag {
  tileId: string
  x: number
  y: number
  overDay: number | null
}

const LAYOUT_KEY = 'lw-s2-layout-v1'
const SIDE_MIN = 240
const SIDE_MAX = 560
const SCHED_MIN = 140
const SCHED_MAX = 520

interface LayoutPrefs {
  side: number
  sched: number
  sideOpen: boolean
  schedOpen: boolean
  zoom: number
}

function defaultLayout(): LayoutPrefs {
  return { side: 320, sched: 200, sideOpen: true, schedOpen: true, zoom: 1 }
}

function loadLayout(): LayoutPrefs {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return defaultLayout()
    const parsed = JSON.parse(raw) as Partial<LayoutPrefs>
    return { ...defaultLayout(), ...parsed }
  } catch {
    return defaultLayout()
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export default function App() {
  const [state, setState] = useState<PlannerState>(() => loadState())
  const [activeLayer, setActiveLayer] = useState<PlanLayer>('current')
  const [paintAllianceId, setPaintAllianceId] = useState(state.ourAllianceId)
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [hoveredTileId, setHoveredTileId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState(1)
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [editMode, setEditMode] = useState<'paint' | 'schedule'>('paint')
  const [scheduleAction, setScheduleAction] = useState<ActionType>('capture')
  const [visible, setVisible] = useState({
    current: true,
    proposed: true,
    final: true,
    others: true,
    thermal: false,
  })
  const [status, setStatus] = useState('')
  const [tileDrag, setTileDrag] = useState<TileDrag | null>(null)
  const skipClickRef = useRef<string | null>(null)
  const [layout, setLayout] = useState<LayoutPrefs>(() => loadLayout())

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
  }, [layout])

  const paintId = state.alliances.some((a) => a.id === paintAllianceId)
    ? paintAllianceId
    : state.ourAllianceId

  const snapshots = useMemo(
    () => simulateAlliance(state, state.ourAllianceId),
    [state],
  )
  const conflicts = useMemo(() => findConflicts(state), [state])
  const errorDays = snapshots.filter((s) => s.warnings.some((w) => w.level === 'error')).length
  const selectedSnap = snapshots[selectedDay - 1]
  const proposedCounts = useMemo(
    () => countKinds(ownedOnLayer(state, 'proposed', state.ourAllianceId)),
    [state],
  )
  const startCounts = useMemo(
    () => countKinds(selectedSnap?.ownedAtStart ?? []),
    [selectedSnap],
  )
  const todayDrops = useMemo(() => {
    const drops = selectedSnap?.drops ?? []
    return {
      cities: drops.filter((id) => TILE_BY_ID[id]?.kind === 'city').length,
      digs: drops.filter((id) => TILE_BY_ID[id]?.kind === 'dig').length,
    }
  }, [selectedSnap])
  const scheduling = editMode === 'schedule'
  const dayMarks = useMemo(() => {
    const marks: Record<string, ActionType> = {}
    for (const action of state.schedule) {
      if (action.day !== selectedDay) continue
      marks[action.tileId] = action.type
    }
    return marks
  }, [state.schedule, selectedDay])

  function paint(tileId: string) {
    setState((prev) => assignTile(prev, activeLayer, tileId, paintId))
  }

  function applySchedule(tileId: string, type: ActionType, day = selectedDay) {
    setState((prev) =>
      toggleScheduleAction(prev, {
        day,
        tileId,
        allianceId: paintId,
        type,
        note: '',
      }),
    )
    const tile = TILE_BY_ID[tileId]
    const verb = type === 'capture' ? 'Take' : 'Drop'
    setStatus(`${verb} ${tile?.coord ?? tileId} on ${dayLabel(day)}`)
  }

  function placeOnDay(tileId: string, day: number, type: ActionType) {
    setSelectedTileId(tileId)
    setSelectedDay(day)
    setSelectedWeek(Math.ceil(day / 7))
    setEditMode('schedule')
    setScheduleAction(type)
    setState((prev) =>
      placeScheduleAction(prev, {
        day,
        tileId,
        allianceId: paintId,
        type,
        note: '',
      }),
    )
    const tile = TILE_BY_ID[tileId]
    const verb = type === 'capture' ? 'Take' : 'Drop'
    setStatus(`${verb} ${tile?.coord ?? tileId} on ${dayLabel(day)}`)
  }

  function onTileClick(tileId: string) {
    if (skipClickRef.current === tileId) {
      skipClickRef.current = null
      setSelectedTileId(tileId)
      return
    }
    setSelectedTileId(tileId)
    if (scheduling) applySchedule(tileId, scheduleAction)
    else paint(tileId)
  }

  function dayUnderPoint(x: number, y: number) {
    const el = document.elementFromPoint(x, y)
    const col = el?.closest('[data-day]') as HTMLElement | null
    const day = col ? Number(col.dataset.day) : NaN
    return Number.isFinite(day) ? day : null
  }

  function onTilePointerDown(tileId: string, event: ReactPointerEvent) {
    if (event.button !== 0) return
    const pointerId = event.pointerId
    const startX = event.clientX
    const startY = event.clientY
    let active = false

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY)
      if (!active && dist < 8) return
      active = true
      skipClickRef.current = tileId
      ev.preventDefault()
      setTileDrag({
        tileId,
        x: ev.clientX,
        y: ev.clientY,
        overDay: dayUnderPoint(ev.clientX, ev.clientY),
      })
    }
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      if (active) {
        const day = dayUnderPoint(ev.clientX, ev.clientY)
        if (day != null) {
          const type: ActionType = ev.altKey ? 'drop' : 'capture'
          placeOnDay(tileId, day, type)
        }
      }
      setTileDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  function setZoom(next: number) {
    setLayout((prev) => ({ ...prev, zoom: clamp(Math.round(next * 20) / 20, 0.7, 2.5) }))
  }

  function startResize(kind: 'side' | 'sched', event: ReactPointerEvent) {
    if (event.button !== 0) return
    event.preventDefault()
    const pointerId = event.pointerId
    const startX = event.clientX
    const startY = event.clientY
    const startSide = layout.side
    const startSched = layout.sched
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      if (kind === 'side') {
        const next = clamp(startSide - (ev.clientX - startX), SIDE_MIN, SIDE_MAX)
        setLayout((prev) => ({ ...prev, side: next }))
      } else {
        const next = clamp(startSched - (ev.clientY - startY), SCHED_MIN, SCHED_MAX)
        setLayout((prev) => ({ ...prev, sched: next }))
      }
    }
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  function selectDay(day: number) {
    setSelectedDay(day)
    setSelectedWeek(Math.ceil(day / 7))
    setEditMode('schedule')
    const snap = snapshots[day - 1]
    setScheduleAction(snap?.overCapacity ? 'drop' : 'capture')
  }

  function dropTile(tileId: string) {
    setSelectedTileId(tileId)
    setScheduleAction('drop')
    applySchedule(tileId, 'drop')
  }

  function download() {
    const blob = new Blob([exportState(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'polar-storm-plan.json'
    a.click()
    URL.revokeObjectURL(url)
    setStatus('Plan exported')
  }

  function onImport(file: File) {
    file.text().then((text) => {
      try {
        setState(parseImported(text))
        setStatus('Plan imported')
      } catch {
        setStatus('Could not import that file')
      }
    })
  }

  return (
    <div
      className={`app ${layout.sideOpen ? '' : 'side-min'} ${layout.schedOpen ? '' : 'sched-min'}`}
      style={
        {
          '--side': `${layout.side}px`,
          '--sched': `${layout.sched}px`,
        } as CSSProperties
      }
    >
      <header className="topbar">
        <div className="brand">
          <span className="mark">S2</span>
          <div>
            <h1>Polar Storm Planner</h1>
            <p>Last War Season 2 · 6 cities · 4 dig sites · 2 captures each per day</p>
          </div>
        </div>
        <div className="toggles">
          {(['current', 'proposed', 'final'] as PlanLayer[]).map((layer) => (
            <label key={layer}>
              <input
                type="checkbox"
                checked={visible[layer]}
                onChange={(e) => setVisible((v) => ({ ...v, [layer]: e.target.checked }))}
              />
              {layer}
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={visible.others}
              onChange={(e) => setVisible((v) => ({ ...v, others: e.target.checked }))}
            />
            others
          </label>
          <label>
            <input
              type="checkbox"
              checked={!scheduling}
              onChange={(e) => setEditMode(e.target.checked ? 'paint' : 'schedule')}
            />
            paint map
          </label>
          <label>
            <input
              type="checkbox"
              checked={visible.thermal}
              onChange={(e) => setVisible((v) => ({ ...v, thermal: e.target.checked }))}
            />
            thermal
          </label>
          <label>
            <input
              type="checkbox"
              checked={layout.sideOpen}
              onChange={(e) => setLayout((p) => ({ ...p, sideOpen: e.target.checked }))}
            />
            plan pane
          </label>
          <label>
            <input
              type="checkbox"
              checked={layout.schedOpen}
              onChange={(e) => setLayout((p) => ({ ...p, schedOpen: e.target.checked }))}
            />
            schedule
          </label>
        </div>
        <div className="top-actions">
          {conflicts.length > 0 && <span className="pill warn">{conflicts.length} deconflicts</span>}
          {errorDays > 0 && <span className="pill bad">{errorDays} days with rule breaks</span>}
          <button type="button" onClick={download}>
            Export
          </button>
          <label className="file-btn">
            Import
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onImport(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </header>

      <WorldMap
        state={state}
        selectedTileId={selectedTileId}
        hoveredTileId={hoveredTileId}
        activeLayer={activeLayer}
        visible={visible}
        dayMarks={dayMarks}
        scheduleBanner={
          tileDrag
            ? tileDrag.overDay
              ? `Drop on ${dayLabel(tileDrag.overDay)} to capture`
              : 'Drag onto a day in the schedule'
            : scheduling
              ? `Scheduling ${dayLabel(selectedDay)} · click or drag tiles onto a day`
              : 'Drag a tile onto a day to schedule it'
        }
        draggingTileId={tileDrag?.tileId ?? null}
        holdings={{
          day: selectedDay,
          heldCities: selectedSnap?.cities ?? 0,
          heldDigs: selectedSnap?.digs ?? 0,
          startCities: startCounts.cities,
          startDigs: startCounts.digs,
          proposedCities: proposedCounts.cities,
          proposedDigs: proposedCounts.digs,
          cityTakes: selectedSnap?.cityCaptures ?? 0,
          digTakes: selectedSnap?.digCaptures ?? 0,
          cityDrops: todayDrops.cities,
          digDrops: todayDrops.digs,
        }}
        zoom={layout.zoom}
        onZoom={setZoom}
        onHover={setHoveredTileId}
        onTileClick={onTileClick}
        onTilePointerDown={onTilePointerDown}
      />

      <div className="sidebar-slot">
      {layout.sideOpen && (
        <div
          className="resizer resizer-x"
          onPointerDown={(e) => startResize('side', e)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize plan pane"
        />
      )}
      <Sidebar
        state={state}
        selectedTileId={selectedTileId}
        activeLayer={activeLayer}
        paintAllianceId={paintId}
        selectedDay={selectedDay}
        editMode={editMode}
        scheduleAction={scheduleAction}
        onAllianceChange={setPaintAllianceId}
        onUpdateAlliance={(alliance: Alliance) => setState((s) => upsertAlliance(s, alliance))}
        onAddAlliance={() => setState((s) => addAlliance(s))}
        onRemoveAlliance={(id) => setState((s) => removeAlliance(s, id))}
        onLayerChange={(layer) => {
          setActiveLayer(layer)
          setEditMode('paint')
        }}
        onLabelChange={(tileId, text) => setState((s) => setLabel(s, tileId, text))}
        onAssign={(tileId, layer, allianceId) => setState((s) => assignTile(s, layer, tileId, allianceId))}
        onSchedule={(tileId, type) => {
          setEditMode('schedule')
          setScheduleAction(type)
          applySchedule(tileId, type)
        }}
        onClearTile={(tileId) =>
          setState((s) => ({
            ...s,
            current: Object.fromEntries(Object.entries(s.current).filter(([id]) => id !== tileId)),
            proposed: Object.fromEntries(Object.entries(s.proposed).filter(([id]) => id !== tileId)),
            final: Object.fromEntries(Object.entries(s.final).filter(([id]) => id !== tileId)),
            labels: Object.fromEntries(Object.entries(s.labels).filter(([id]) => id !== tileId)),
            schedule: s.schedule.filter((a) => a.tileId !== tileId),
          }))
        }
        onSelectTile={setSelectedTileId}
        collapsed={!layout.sideOpen}
        onTogglePane={() => setLayout((p) => ({ ...p, sideOpen: !p.sideOpen }))}
      />
      </div>

      <div className="schedule-slot">
      {layout.schedOpen && (
        <div
          className="resizer resizer-y"
          onPointerDown={(e) => startResize('sched', e)}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize schedule pane"
        />
      )}
      <ScheduleBoard
        state={state}
        snapshots={snapshots}
        selectedDay={selectedDay}
        selectedWeek={selectedWeek}
        editMode={editMode}
        scheduleAction={scheduleAction}
        onSelectDay={selectDay}
        onSelectWeek={setSelectedWeek}
        onRemoveAction={(id) => setState((s) => removeAction(s, id))}
        onDropTile={dropTile}
        onSelectTile={setSelectedTileId}
        onScheduleActionChange={setScheduleAction}
        onPaintMap={() => setEditMode('paint')}
        dragOverDay={tileDrag?.overDay ?? null}
        dragging={Boolean(tileDrag)}
        collapsed={!layout.schedOpen}
        onTogglePane={() => setLayout((p) => ({ ...p, schedOpen: !p.schedOpen }))}
      />
      </div>

      {tileDrag && (
        <div className="drag-ghost" style={{ left: tileDrag.x, top: tileDrag.y }}>
          {TILE_BY_ID[tileDrag.tileId]?.coord} {TILE_BY_ID[tileDrag.tileId]?.kind === 'city' ? 'City' : 'Dig'}
          <em>
            {tileDrag.overDay
              ? `→ ${dayLabel(tileDrag.overDay)}`
              : 'drop on a day'}
          </em>
        </div>
      )}

      {status && (
        <div className="toast" onAnimationEnd={() => setStatus('')}>
          {status}
        </div>
      )}
      <p className="sr-only">
        Season length {SEASON_DAYS} days
        {selectedSnap ? ` · ${selectedSnap.cities} cities ${selectedSnap.digs} digs` : ''}
      </p>
    </div>
  )
}
