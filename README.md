# Polar Storm Planner

A Last War: Survival Season 2 (Polar Storm) alliance planning tool. Paint the 13×13 world map, schedule city and stronghold captures by day, and stay inside the 6-city / 4-stronghold caps.

Live use is in the browser. Your plan is saved on your computer (this browser’s local storage) and can be exported as JSON.

## Quick start

### 1. Install Node.js

You need **Node.js 20 or newer**. Check with:

```bash
node -v
```

If that command fails, install Node from [https://nodejs.org](https://nodejs.org) (LTS) and open a new terminal.

### 2. Download the project

```bash
git clone https://github.com/eternal-drone/polar-storm-planner.git
cd polar-storm-planner
```

No git? On the GitHub repo page click **Code → Download ZIP**, unzip it, then `cd` into the unzipped folder.

### 3. Install and run

```bash
npm install
npm run dev
```

When Vite is ready, open the **Local** URL it prints, usually:

**[http://localhost:5173/](http://localhost:5173/)**

Leave that terminal open while you use the planner. Stop it with `Ctrl+C`.

To start it again later:

```bash
cd polar-storm-planner
npm run dev
```

## How to use it

1. **Paint land** — In the sidebar pick **Now** (held today), **Proposed** (next moves), or **Final** (season target). Click map tiles to assign your alliance. Click again to clear.
2. **Schedule captures** — Click a day under the map, then click tiles to add takes. Or **drag a tile onto a day**. Switch that day to **Drop** when you are at cap. Hold **Alt** while dropping a dragged tile to schedule a drop.
3. **Watch the caps** — Max **6 cities** and **4 strongholds**, **2 city takes** and **2 stronghold takes** per day. If a day goes over cap, a red drop notice appears inside that day’s box with one-click drop targets.
4. **Holdings panel** — Top-left of the map shows cities and strongholds **held** on the selected day vs **proposed**.
5. **Other alliances** — Add tags in the sidebar and paint them on the same layers to deconflict.
6. **Save / share** — **Export** downloads a JSON backup. **Import** loads one. The current plan also auto-saves in this browser.

## Season 2 rules built in

- First territory must be a level 1 stronghold (dig site).
- Corners count as adjacent.
- City unlocks (12:00): L1 d3, L2 d6, L3 d10, L4 d13, L5 d17, L6 d20, L7 (Nuclear Furnace) d28.

## Requirements

- Node.js 20+
- npm (comes with Node)
- A current desktop browser
