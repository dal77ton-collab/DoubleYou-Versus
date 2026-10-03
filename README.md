# DOUBLEYOU VERSUS

Playable browser build of DoubleYou Versus (DoubleYou Studio).

## Play

Open `index.html` in Chrome, Safari, Edge, or Firefox.

On iPhone: add to Home Screen, rotate to landscape.

If a browser blocks `file://` assets, serve the folder:

```
python3 -m http.server 8080
```

Then open http://localhost:8080

## Modes

- **Quick Match** — best of 3 vs AI, +1 W Coin
- **Competitive Match** — ranked vs AI, CP + rank, +2 W Coins
- **Practice Mode** — dummy, no timer, ultimates ready, U resets dummy
- **Local 1v1** — two keyboards on one machine
- **Invite a Friend** — room code via BroadcastChannel (two tabs on the same browser)

## Controls (P1)

| Input | Action |
|---|---|
| ← → | Move |
| ↑ / Space | Jump |
| Mouse | Face / aim |
| Left click | Punch |
| Double left click | Ultimate (after 0:30, 10 Energy) |
| Hold right click + left click | Primary special |
| Hold right click + arrows | Character specials |

P2 local: WASD move, F punch, G modifier, R ultimate.

Touch: left cluster move/jump, right cluster punch / modifier / ultimate.

## Roster

Inferna (Fire) · Shade (Shadow) · Lumen (Electric) · Tide (Water) · Crown (Magnetism) · Viper (Plant)

Progress (coins, rank, mastery, cosmetics) saves in `localStorage`.

Character numbers live in `js/data.js` and feed both combat and Character Info.
