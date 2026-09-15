import type { ActionType, Alliance, PlanLayer, PlannerState, Tile } from '../types'
import {
  DAILY_CITY_CAPTURES,
  DAILY_DIG_CAPTURES,
  MAX_CITIES,
  MAX_DIGS,
  TILE_BY_ID,
  dayLabel,
} from '../data'
import { aggregateTiles, countKinds, findConflicts, gapAnalysis, ownedOnLayer } from '../engine'

interface Props {
  state: PlannerState
  selectedTileId: string | null
  activeLayer: PlanLayer
  paintAllianceId: string
  selectedDay: number
  editMode: 'paint' | 'schedule'
  scheduleAction: ActionType
  onAllianceChange: (id: string) => void
  onUpdateAlliance: (alliance: Alliance) => void
  onAddAlliance: () => void
  onRemoveAlliance: (id: string) => void
  onLayerChange: (layer: PlanLayer) => void
  onLabelChange: (tileId: string, text: string) => void
  onAssign: (tileId: string, layer: PlanLayer, allianceId: string | null) => void
  onSchedule: (tileId: string, type: 'capture' | 'drop') => void
  onClearTile: (tileId: string) => void
  onSelectTile: (tileId: string) => void
}

const LAYERS: PlanLayer[] = ['current', 'proposed', 'final']
const LAYER_COPY: Record<PlanLayer, { title: string; hint: string }> = {
  current: { title: 'Now', hint: 'Held today' },
  proposed: { title: 'Proposed', hint: 'Next moves' },
  final: { title: 'Final', hint: 'Season target' },
}

function Meter({ label, value, max, warn }: { label: string; value: number; max: number; warn: boolean }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className={`meter ${warn ? 'over' : ''}`}>
      <div className="meter-head">
        <span>{label}</span>
        <strong>
          {value}/{max}
        </strong>
      </div>
      <div className="meter-track">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Production({ ids, layer }: { ids: string[]; layer: PlanLayer }) {
  const { cities, digs } = countKinds(ids)
  const totals = aggregateTiles(ids)
  return (
    <div className="production">
      <div className="meters">
        <Meter label="Cities" value={cities} max={MAX_CITIES} warn={cities > MAX_CITIES} />
        <Meter label="Digsites" value={digs} max={MAX_DIGS} warn={digs > MAX_DIGS} />
      </div>
      <div className="stat-grid">
        <div>
          <label>Rare Soil</label>
          <strong>{totals.rareSoilPerHour.toLocaleString()}/h</strong>
          <em>{(totals.rareSoilPerHour * 24).toLocaleString()} per day</em>
        </div>
        <div>
          <label>Coal</label>
          <strong>{totals.coalPerHour.toLocaleString()}/h</strong>
          <em>{(totals.coalPerHour * 24).toLocaleString()} per day</em>
        </div>
        <div>
          <label>City heat</label>
          <strong>{totals.heatC ? `+${totals.heatC}°C` : '—'}</strong>
          <em>from owned cities</em>
        </div>
        <div>
          <label>Nuclear</label>
          <strong>{totals.globalHeatC ? `+${totals.globalHeatC}°C map` : '—'}</strong>
          <em>after reactivation</em>
        </div>
      </div>
      {totals.buffs.length > 0 && (
        <ul className="buff-list">
          {totals.buffs.map((b) => (
            <li key={b.key}>
              <span>{b.label}</span>
              <strong>+{b.percent}%</strong>
            </li>
          ))}
        </ul>
      )}
      {ids.length === 0 && (
        <p className="hint">No {LAYER_COPY[layer].title.toLowerCase()} land painted for us yet.</p>
      )}
    </div>
  )
}

function TileDetails({ tile }: { tile: Tile }) {
  return (
    <dl className="tile-facts">
      <div>
        <dt>Type</dt>
        <dd>
          {tile.kind === 'dig' ? 'Digsite' : tile.name} · Lv {tile.level}
        </dd>
      </div>
      <div>
        <dt>Land temp</dt>
        <dd>{tile.temperature}°C</dd>
      </div>
      <div>
        <dt>Rare Soil</dt>
        <dd>{tile.rareSoilPerHour ? `${tile.rareSoilPerHour}/h` : 'Not published'}</dd>
      </div>
      {tile.kind === 'dig' ? (
        <>
          <div>
            <dt>Coal</dt>
            <dd>{tile.coalPerHour.toLocaleString()}/h</dd>
          </div>
          <div>
            <dt>Beast</dt>
            <dd>
              {tile.beast?.name} · weak to {tile.beast?.weakness}
            </dd>
          </div>
          <div>
            <dt>Virus Res.</dt>
            <dd>{tile.virusResistance?.toLocaleString()}</dd>
          </div>
        </>
      ) : (
        <>
          <div>
            <dt>City furnace</dt>
            <dd>{tile.heatC ? `+${tile.heatC}°C` : tile.globalHeatC ? `+${tile.globalHeatC}°C map-wide` : '—'}</dd>
          </div>
          <div>
            <dt>Alliance buff</dt>
            <dd>{tile.buff ? `${tile.buff.label} +${tile.buff.percent}%` : '—'}</dd>
          </div>
          <div>
            <dt>Unlocks</dt>
            <dd>
              Day {tile.unlockDay} · {dayLabel(tile.unlockDay)} 12:00
            </dd>
          </div>
        </>
      )}
    </dl>
  )
}

export function Sidebar({
  state,
  selectedTileId,
  activeLayer,
  paintAllianceId,
  selectedDay,
  editMode,
  scheduleAction,
  onAllianceChange,
  onUpdateAlliance,
  onAddAlliance,
  onRemoveAlliance,
  onLayerChange,
  onLabelChange,
  onAssign,
  onSchedule,
  onClearTile,
  onSelectTile,
}: Props) {
  const tile = selectedTileId ? TILE_BY_ID[selectedTileId] : null
  const our = state.ourAllianceId
  const conflicts = findConflicts(state)
  const gaps = gapAnalysis(state)
  const allianceById = Object.fromEntries(state.alliances.map((a) => [a.id, a]))
  const painter = allianceById[paintAllianceId]

  return (
    <aside className="sidebar">
      <section className="card paint-card">
        <header>
          <h3>1. Choose plan layer</h3>
        </header>
        <div className="layer-switch">
          {LAYERS.map((layer) => (
            <button
              key={layer}
              type="button"
              className={activeLayer === layer ? 'on' : ''}
              onClick={() => onLayerChange(layer)}
            >
              <strong>{LAYER_COPY[layer].title}</strong>
              <span>{LAYER_COPY[layer].hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <header>
          <h3>2. Painting as</h3>
          <button type="button" className="text-btn" onClick={onAddAlliance}>
            + Alliance
          </button>
        </header>
        <ul className="alliance-list">
          {state.alliances.map((a) => (
            <li key={a.id} className={paintAllianceId === a.id ? 'active' : ''}>
              <button type="button" className="swatch-btn" onClick={() => onAllianceChange(a.id)}>
                <input
                  type="color"
                  value={a.color}
                  onChange={(e) => onUpdateAlliance({ ...a, color: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${a.name} color`}
                />
                <span className="who">
                  <input
                    className="tag"
                    value={a.tag}
                    maxLength={5}
                    onChange={(e) => onUpdateAlliance({ ...a, tag: e.target.value.toUpperCase() })}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <input
                    value={a.name}
                    onChange={(e) => onUpdateAlliance({ ...a, name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                  />
                </span>
                {a.isUs && <em className="us-badge">Us</em>}
              </button>
              {!a.isUs && (
                <button type="button" className="icon-btn" onClick={() => onRemoveAlliance(a.id)} aria-label="Remove">
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="hint">
          {editMode === 'schedule'
            ? `Map clicks ${scheduleAction === 'capture' ? 'capture' : 'drop'} land for ${painter?.tag} on ${dayLabel(selectedDay)}. Switch Capture/Drop in the day box.`
            : `Click map tiles to assign ${painter?.tag} to the ${LAYER_COPY[activeLayer].title} plan. Click again to clear.`}
        </p>
      </section>

      <section className={`card tile-card ${tile ? 'has-tile' : ''}`}>
        <header>
          <h3>3. Selected tile</h3>
          {tile && (
            <button type="button" className="text-btn" onClick={() => onClearTile(tile.id)}>
              Clear tile
            </button>
          )}
        </header>
        {tile ? (
          <>
            <div className="tile-title">
              <strong>{tile.coord}</strong>
              <span>
                {tile.kind === 'dig' ? 'Digsite' : tile.name} · Lv {tile.level}
              </span>
            </div>
            <TileDetails tile={tile} />
            <label className="field">
              Note
              <input
                value={state.labels[tile.id] ?? ''}
                placeholder="keep / drop / swap with NBR…"
                onChange={(e) => onLabelChange(tile.id, e.target.value)}
              />
            </label>
            <div className="owner-row">
              {LAYERS.map((layer) => {
                const owner = allianceById[state[layer][tile.id]]
                return (
                  <button
                    key={layer}
                    type="button"
                    className={owner ? 'filled' : ''}
                    onClick={() => onAssign(tile.id, layer, paintAllianceId)}
                  >
                    <span>{LAYER_COPY[layer].title}</span>
                    <strong style={{ color: owner?.color }}>{owner ? owner.tag : 'empty'}</strong>
                  </button>
                )
              })}
            </div>
            <div className="btn-row">
              <button type="button" onClick={() => onSchedule(tile.id, 'capture')}>
                Capture {dayLabel(selectedDay)}
              </button>
              <button type="button" className="danger" onClick={() => onSchedule(tile.id, 'drop')}>
                Drop {dayLabel(selectedDay)}
              </button>
            </div>
            <p className="hint">
              Or click a day below, then click this tile on the map.
            </p>
          </>
        ) : (
          <p className="hint empty-tile">
            {editMode === 'schedule'
              ? `Click a city or digsite on the map to ${scheduleAction === 'capture' ? 'add it to' : 'drop it from'} ${dayLabel(selectedDay)}.`
              : 'Click a city or digsite on the map to inspect it, or click a day below to start scheduling.'}
          </p>
        )}
      </section>

      <section className="card">
        <header>
          <h3>Our {LAYER_COPY[activeLayer].title.toLowerCase()} production</h3>
        </header>
        <Production ids={ownedOnLayer(state, activeLayer, our)} layer={activeLayer} />
      </section>

      <section className="card">
        <header>
          <h3>Plan check</h3>
          <span className={`cap ${conflicts.length || gaps.toDropFinal.length ? 'bad' : ''}`}>
            {conflicts.length} clash{conflicts.length === 1 ? '' : 'es'}
          </span>
        </header>
        <div className="plan-check">
          <p className="hint">
            To reach final: <strong>{gaps.toCaptureFinal.length}</strong> captures,{' '}
            <strong>{gaps.toDropFinal.length}</strong> drops. Max {DAILY_CITY_CAPTURES} cities and{' '}
            {DAILY_DIG_CAPTURES} digs per day.
          </p>
          {gaps.toDropFinal.length > 0 && (
            <div className="chip-row">
              <span className="chip warn">Drop</span>
              {gaps.toDropFinal.map((id) => (
                <button key={id} type="button" className="coord-chip" onClick={() => onSelectTile(id)}>
                  {TILE_BY_ID[id]?.coord}
                </button>
              ))}
            </div>
          )}
          {gaps.toCaptureFinal.length > 0 && (
            <div className="chip-row">
              <span className="chip">Take</span>
              {gaps.toCaptureFinal.slice(0, 16).map((id) => (
                <button key={id} type="button" className="coord-chip" onClick={() => onSelectTile(id)}>
                  {TILE_BY_ID[id]?.coord}
                </button>
              ))}
              {gaps.toCaptureFinal.length > 16 && <span className="hint">+{gaps.toCaptureFinal.length - 16}</span>}
            </div>
          )}
          {conflicts.length === 0 ? (
            <p className="hint ok-line">No overlap with other alliances.</p>
          ) : (
            <ul className="conflict-list">
              {conflicts.slice(0, 10).map((c, i) => {
                const t = TILE_BY_ID[c.tileId]
                const other = allianceById[c.otherAllianceId]
                return (
                  <li key={`${c.tileId}-${i}`}>
                    <button type="button" onClick={() => onSelectTile(c.tileId)}>
                      <strong>{t?.coord}</strong> our {LAYER_COPY[c.oursLayer].title} vs {other?.tag}{' '}
                      {LAYER_COPY[c.otherLayer].title}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      <details className="card rules-card">
        <summary>
          <h3>Season 2 rules</h3>
        </summary>
        <ul className="rules">
          <li>Max 6 cities and 4 dig sites at once.</li>
          <li>2 city captures and 2 dig captures per day.</li>
          <li>At cap, drop matching land before taking more.</li>
          <li>First territory must be a level 1 Dig Site.</li>
          <li>Corners count as adjacent.</li>
          <li>Cities unlock L1 d3, L2 d6, L3 d10, L4 d13, L5 d17, L6 d20, L7 d28 at 12:00.</li>
        </ul>
      </details>
    </aside>
  )
}
