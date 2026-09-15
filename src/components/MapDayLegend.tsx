import { MAX_CITIES, MAX_DIGS, dayLabel } from '../data'

interface Props {
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

function Count({ value, max }: { value: number; max: number }) {
  return (
    <strong className={value > max ? 'bad' : value === max ? 'cap' : ''}>
      {value}/{max}
    </strong>
  )
}

export function MapDayLegend({
  day,
  heldCities,
  heldDigs,
  startCities,
  startDigs,
  proposedCities,
  proposedDigs,
  cityTakes,
  digTakes,
  cityDrops,
  digDrops,
}: Props) {
  const moved = cityTakes + digTakes + cityDrops + digDrops > 0
  return (
    <aside className="map-holdings" aria-live="polite">
      <header>
        <strong>{dayLabel(day)}</strong>
        <span>Day {day} holdings</span>
      </header>
      <table>
        <thead>
          <tr>
            <th />
            <th>Cities</th>
            <th>Strongholds</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Held</th>
            <td>
              <Count value={heldCities} max={MAX_CITIES} />
            </td>
            <td>
              <Count value={heldDigs} max={MAX_DIGS} />
            </td>
          </tr>
          <tr>
            <th scope="row">Proposed</th>
            <td>
              <Count value={proposedCities} max={MAX_CITIES} />
            </td>
            <td>
              <Count value={proposedDigs} max={MAX_DIGS} />
            </td>
          </tr>
        </tbody>
      </table>
      <p className="map-holdings-note">
        {moved
          ? [
              cityTakes || digTakes ? `Take ${cityTakes}C · ${digTakes}S` : null,
              cityDrops || digDrops ? `Drop ${cityDrops}C · ${digDrops}S` : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : `Started the day at ${startCities}C · ${startDigs}S`}
      </p>
    </aside>
  )
}
