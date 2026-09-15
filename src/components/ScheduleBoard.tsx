import type { ActionType, DaySnapshot, PlannerState } from '../types'
import {
  DAILY_CITY_CAPTURES,
  DAILY_DIG_CAPTURES,
  MAX_CITIES,
  MAX_DIGS,
  SEASON_DAYS,
  TILE_BY_ID,
  WEEKDAYS,
  dayLabel,
} from '../data'

interface Props {
  state: PlannerState
  snapshots: DaySnapshot[]
  selectedDay: number
  selectedWeek: number
  editMode: 'paint' | 'schedule'
  scheduleAction: ActionType
  onSelectDay: (day: number) => void
  onSelectWeek: (week: number) => void
  onRemoveAction: (id: string) => void
  onDropTile: (tileId: string) => void
  onSelectTile: (tileId: string) => void
  onScheduleActionChange: (type: ActionType) => void
  onPaintMap: () => void
  dragOverDay: number | null
  dragging: boolean
  collapsed: boolean
  onTogglePane: () => void
}

function unlockNote(day: number) {
  const notes: string[] = []
  if (day === 1) notes.push('Digs open · first land must be L1 Dig')
  if (day === 3) notes.push('L1 cities unlock 12:00')
  if (day === 6) notes.push('L2 cities unlock 12:00')
  if (day === 10) notes.push('L3 cities unlock 12:00')
  if (day === 13) notes.push('L4 cities unlock 12:00')
  if (day === 17) notes.push('L5 cities unlock 12:00')
  if (day === 20) notes.push('L6 cities unlock 12:00')
  if (day === 28) notes.push('Nuclear Furnace unlocks 12:00')
  return notes
}

export function ScheduleBoard({
  state,
  snapshots,
  selectedDay,
  selectedWeek,
  editMode,
  scheduleAction,
  onSelectDay,
  onSelectWeek,
  onRemoveAction,
  onDropTile,
  onSelectTile,
  onScheduleActionChange,
  onPaintMap,
  dragOverDay,
  dragging,
  collapsed,
  onTogglePane,
}: Props) {
  const start = (selectedWeek - 1) * 7 + 1
  const days = Array.from({ length: 7 }, (_, i) => start + i).filter((d) => d <= SEASON_DAYS)
  const allianceById = Object.fromEntries(state.alliances.map((a) => [a.id, a]))
  const selectedSnap = snapshots[selectedDay - 1]
  const scheduling = editMode === 'schedule'

  if (collapsed) {
    return (
      <section className="schedule collapsed">
        <button type="button" className="pane-restore wide" onClick={onTogglePane}>
          Capture schedule · click to expand
        </button>
      </section>
    )
  }

  return (
    <section className={`schedule ${scheduling ? 'editing' : ''} ${dragging ? 'receiving' : ''}`}>
      <div className="schedule-head">
        <div>
          <h2>Capture schedule</h2>
          <p className="schedule-help">
            {scheduling
              ? `Selected ${dayLabel(selectedDay)} · click tiles or drag them onto a day`
              : 'Drag a tile onto a day, or click a day then click the map'}
          </p>
        </div>
        {scheduling && (
          <button type="button" className="text-btn" onClick={onPaintMap}>
            Done · paint map
          </button>
        )}
        <button type="button" className="text-btn" onClick={onTogglePane} aria-label="Minimize schedule pane">
          Minimize
        </button>
        <div className="week-tabs">
          {Array.from({ length: 8 }, (_, i) => i + 1).map((week) => (
            <button
              key={week}
              type="button"
              className={week === selectedWeek ? 'on' : ''}
              onClick={() => {
                onSelectWeek(week)
                onSelectDay((week - 1) * 7 + 1)
              }}
            >
              Week {week}
            </button>
          ))}
        </div>
        {selectedSnap && (
          <div className="day-summary">
            <span className={selectedSnap.cities > MAX_CITIES ? 'bad' : ''}>
              {selectedSnap.cities}/{MAX_CITIES} cities
            </span>
            <span className={selectedSnap.digs > MAX_DIGS ? 'bad' : ''}>
              {selectedSnap.digs}/{MAX_DIGS} digs
            </span>
            <span>
              {selectedSnap.cityCaptures}/{DAILY_CITY_CAPTURES} city takes
            </span>
            <span>
              {selectedSnap.digCaptures}/{DAILY_DIG_CAPTURES} dig takes
            </span>
            {selectedSnap.overCapacity && <span className="bad">Drop required</span>}
          </div>
        )}
      </div>
      <div className="day-grid">
        {days.map((day, i) => {
          const snap = snapshots[day - 1]
          const actions = state.schedule.filter((a) => a.day === day)
          const notes = unlockNote(day)
          const selected = scheduling && day === selectedDay
          const citySlots = snap?.cityCaptures ?? 0
          const digSlots = snap?.digCaptures ?? 0
          return (
            <div
              key={day}
              className={`day-col ${selected ? 'selected' : ''} ${snap?.overCapacity ? 'over' : ''} ${dragOverDay === day ? 'drag-over' : ''}`}
              data-day={day}
              onClick={() => onSelectDay(day)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelectDay(day)
              }}
              role="group"
              aria-label={`${WEEKDAYS[i]} ${dayLabel(day)}`}
              aria-pressed={selected}
              tabIndex={0}
            >
              <div className="day-head">
                <strong>
                  {WEEKDAYS[i]} · {dayLabel(day)}
                </strong>
                <span>Day {day}</span>
                <span className={`meters ${snap?.overCapacity ? 'bad' : ''}`}>
                  Hold {snap?.cities ?? 0}/{MAX_CITIES}C · {snap?.digs ?? 0}/{MAX_DIGS}D
                </span>
                <span className="slots">
                  Take {citySlots}/{DAILY_CITY_CAPTURES} cities · {digSlots}/{DAILY_DIG_CAPTURES}{' '}
                  digs
                </span>
              </div>
              {selected && (
                <div className="day-tools" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={scheduleAction === 'capture' ? 'on' : ''}
                    onClick={() => onScheduleActionChange('capture')}
                  >
                    Capture
                  </button>
                  <button
                    type="button"
                    className={scheduleAction === 'drop' ? 'on danger' : 'danger'}
                    onClick={() => onScheduleActionChange('drop')}
                  >
                    Drop
                  </button>
                </div>
              )}
              {selected && (
                <div className="day-hint">
                  {scheduleAction === 'drop'
                    ? 'Click a held tile, drag it here, or use a Drop chip'
                    : 'Click a tile on the map, or drag it onto this day'}
                </div>
              )}
              {notes.map((n) => (
                <div key={n} className="unlock">
                  {n}
                </div>
              ))}
              {snap?.requiredDrops.map((req) => {
                const candidates = (snap.ownedAtStart ?? []).filter((id) => {
                  const tile = TILE_BY_ID[id]
                  return tile?.kind === req.kind && !snap.drops.includes(id)
                })
                const undoTakes = actions.filter(
                  (a) => a.type === 'capture' && TILE_BY_ID[a.tileId]?.kind === req.kind,
                )
                return (
                  <div
                    key={req.kind}
                    className="must-drop-box"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <strong>
                      Drop {req.count} {req.kind === 'city' ? 'city' : 'digsite'}
                    </strong>
                    <span>At {req.kind === 'city' ? MAX_CITIES : MAX_DIGS} max. Click one to drop it today.</span>
                    <div className="drop-picks">
                      {candidates.length === 0 && undoTakes.length === 0 && (
                        <em>No held {req.kind === 'city' ? 'cities' : 'digsites'} to drop</em>
                      )}
                      {undoTakes.map((action) => {
                        const tile = TILE_BY_ID[action.tileId]
                        return (
                          <button key={action.id} type="button" onClick={() => onRemoveAction(action.id)}>
                            Undo take {tile?.coord}
                          </button>
                        )
                      })}
                      {candidates.map((id) => {
                        const tile = TILE_BY_ID[id]
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              onSelectTile(id)
                              onDropTile(id)
                            }}
                          >
                            Drop {tile?.coord} {tile?.kind === 'city' ? 'C' : 'D'}
                            {tile?.level}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {citySlots > DAILY_CITY_CAPTURES && (
                <div className="must-drop-box">City takes exceed {DAILY_CITY_CAPTURES}/day</div>
              )}
              {digSlots > DAILY_DIG_CAPTURES && (
                <div className="must-drop-box">Dig takes exceed {DAILY_DIG_CAPTURES}/day</div>
              )}
              <div className="action-list" onClick={(e) => e.stopPropagation()}>
                {actions.length === 0 && (
                  <em className="empty">{selected ? 'No lands yet — drag a tile here' : 'Drag a tile here'}</em>
                )}
                {actions.map((action) => {
                  const tile = TILE_BY_ID[action.tileId]
                  const ally = allianceById[action.allianceId]
                  return (
                    <div key={action.id} className={`action ${action.type}`}>
                      <span className="dot" style={{ background: ally?.color }} />
                      <button type="button" className="action-name" onClick={() => onSelectTile(action.tileId)}>
                        {action.type === 'capture' ? 'Take' : 'Drop'} {tile?.coord}{' '}
                        {tile ? `${tile.kind === 'city' ? 'C' : 'D'}${tile.level}` : ''}
                      </button>
                      <button type="button" onClick={() => onRemoveAction(action.id)} aria-label="Remove">
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
              {snap?.warnings
                .filter((w) => !w.message.startsWith('Over cap'))
                .slice(0, 2)
                .map((w, idx) => (
                  <div key={idx} className={`warn ${w.level}`}>
                    {w.message}
                  </div>
                ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}
