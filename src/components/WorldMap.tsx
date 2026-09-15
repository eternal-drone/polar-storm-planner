import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ActionType, PlanLayer, PlannerState } from '../types'
import { MAP_SIZE, TILES, TILE_BY_ID } from '../data'
import { MapDayLegend } from './MapDayLegend'

const LAYERS: PlanLayer[] = ['current', 'proposed', 'final']

interface Props {
  state: PlannerState
  selectedTileId: string | null
  hoveredTileId: string | null
  activeLayer: PlanLayer
  visible: Record<PlanLayer, boolean> & { thermal: boolean; others: boolean }
  dayMarks: Record<string, ActionType>
  scheduleBanner: string | null
  draggingTileId: string | null
  holdings: {
    day: number
    heldCities: number
    heldDigs: number
    startCities: number
    startDigs: number
    proposedCities: number
    proposedDigs: number
    cityTakes: number
    digTakes: number
    cityDrops: number
    digDrops: number
  }
  zoom: number
  onZoom: (next: number) => void
  onHover: (id: string | null) => void
  onTileClick: (id: string) => void
  onTilePointerDown: (id: string, event: ReactPointerEvent) => void
}

export function WorldMap({
  state,
  selectedTileId,
  hoveredTileId,
  activeLayer,
  visible,
  dayMarks,
  scheduleBanner,
  draggingTileId,
  holdings,
  zoom,
  onZoom,
  onHover,
  onTileClick,
  onTilePointerDown,
}: Props) {
  const allianceById = Object.fromEntries(state.alliances.map((a) => [a.id, a]))
  const hovered = hoveredTileId ? TILE_BY_ID[hoveredTileId] : null
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      onZoom(zoom + (e.deltaY < 0 ? 0.1 : -0.1))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, onZoom])

  return (
    <div className="map-wrap">
      <MapDayLegend {...holdings} />
      {scheduleBanner && <div className="map-banner">{scheduleBanner}</div>}
      <div className="map-zoom">
        <button type="button" onClick={() => onZoom(zoom - 0.15)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={() => onZoom(1)} title="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" onClick={() => onZoom(zoom + 0.15)} aria-label="Zoom in">
          +
        </button>
      </div>
      <div className="map-frame">
        <div className="map-stage" ref={stageRef}>
          <div className="map-board" style={{ ['--zoom' as string]: String(zoom) }}>
            <span className="map-corner" />
            <div className="map-col-labels">
              {Array.from({ length: MAP_SIZE }, (_, i) => (
                <span key={i}>{String.fromCharCode(65 + i)}</span>
              ))}
            </div>
            <div className="map-row-labels">
              {Array.from({ length: MAP_SIZE }, (_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
            <div className="map-grid" role="grid" aria-label="Season 2 world map" data-layer={activeLayer}>
            {TILES.map((tile) => {
              const owners = LAYERS.map((layer) => ({
                layer,
                allianceId: state[layer][tile.id],
              })).filter((o) => o.allianceId)
              const currentOwner = allianceById[state.current[tile.id]]
              const proposedOwner = allianceById[state.proposed[tile.id]]
              const finalOwner = allianceById[state.final[tile.id]]
              const canShow = (a?: { isUs: boolean }) => a && (a.isUs || visible.others)
              const showCurrent = visible.current && canShow(currentOwner)
              const showProposed = visible.proposed && canShow(proposedOwner)
              const showFinal = visible.final && canShow(finalOwner)
              const tagAlliance = showFinal ? finalOwner : showCurrent ? currentOwner : showProposed ? proposedOwner : null
              const oursConflict =
                owners.some((o) => o.allianceId === state.ourAllianceId) &&
                owners.some((o) => o.allianceId && o.allianceId !== state.ourAllianceId)
              const tempAlpha = visible.thermal ? (80 + tile.temperature) / 95 : 0
              const dayMark = dayMarks[tile.id]

              return (
                <button
                  key={tile.id}
                  type="button"
                  role="gridcell"
                  aria-label={`${tile.coord} ${tile.kind === 'city' ? tile.name : 'Digsite'} Lv ${tile.level}`}
                  className={[
                    'tile',
                    tile.kind,
                    `lv${tile.level}`,
                    selectedTileId === tile.id ? 'selected' : '',
                    oursConflict ? 'conflict' : '',
                    tile.row === 6 && tile.col === 6 ? 'capitol' : '',
                    showCurrent ? 'has-now' : '',
                    showFinal ? 'has-final' : '',
                    showProposed ? 'has-proposed' : '',
                    dayMark ? `sched-${dayMark}` : '',
                    draggingTileId === tile.id ? 'dragging' : '',
                  ].join(' ')}
                  style={{
                    ['--fill' as string]: showFinal ? (finalOwner?.color ?? 'transparent') : 'transparent',
                    ['--fill-alpha' as string]: showFinal ? 0.58 : 0,
                    ['--now' as string]: currentOwner?.color ?? 'transparent',
                    ['--final-line' as string]: finalOwner?.color ?? 'transparent',
                    ['--hatch' as string]: proposedOwner?.color ?? 'transparent',
                    ['--temp' as string]: String(tempAlpha),
                  }}
                  onClick={() => onTileClick(tile.id)}
                  onPointerDown={(e) => onTilePointerDown(tile.id, e)}
                  onDragStart={(e) => e.preventDefault()}
                  onMouseEnter={() => onHover(tile.id)}
                  onMouseLeave={() => onHover(null)}
                >
                  {showProposed && <span className="overlay proposed" />}
                  {showFinal && <span className="overlay final" />}
                  {showCurrent && <span className="overlay now" />}
                  {dayMark && (
                    <span className={`sched-mark ${dayMark === 'drop' ? 'drop' : 'take'}`}>
                      {dayMark === 'drop' ? 'Drop' : 'Take'}
                    </span>
                  )}
                  <span className="tile-kind">
                    {tile.kind === 'dig' ? 'Digsite' : tile.level === 7 ? 'Capitol' : 'City'}
                  </span>
                  <span className="tile-lv">Lv {tile.level}</span>
                  {state.labels[tile.id] && <span className="tile-label">{state.labels[tile.id]}</span>}
                  {tagAlliance && (
                    <span className="tile-tag" style={{ color: tagAlliance.color }}>
                      {tagAlliance.tag}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
      <div className="map-legend">
        <span><i className="lg-city" /> City + level</span>
        <span><i className="lg-dig" /> Digsite + level</span>
        <span><i className="lg-ring" /> Now outline</span>
        <span><i className="lg-stripe" /> Proposed hatch</span>
        <span><i className="lg-fill" /> Final fill + outline</span>
        {Object.keys(dayMarks).length > 0 && (
          <>
            <span><i className="lg-take" /> Day capture</span>
            <span><i className="lg-drop" /> Day drop</span>
          </>
        )}
      </div>
      {hovered && !draggingTileId && (
        <div className="map-tooltip">
          <strong>
            {hovered.coord} · {hovered.kind === 'city' ? hovered.name : `Dig Site`} L{hovered.level}
          </strong>
          <span>
            {hovered.temperature}°C
            {hovered.kind === 'city'
              ? ` · ${hovered.rareSoilPerHour}/h soil · +${hovered.heatC}°C heat`
              : ` · ${hovered.coalPerHour}/h coal · ${hovered.rareSoilPerHour}/h soil`}
          </span>
          {hovered.buff && (
            <span>
              {hovered.buff.label} +{hovered.buff.percent}%
            </span>
          )}
          {hovered.beast && (
            <span>
              {hovered.beast.name} · weak to {hovered.beast.weakness}
            </span>
          )}
          {dayMarks[hovered.id] && (
            <span>
              This day: {dayMarks[hovered.id] === 'drop' ? 'drop' : 'capture'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
