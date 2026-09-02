# PODS Tailgate

Static site for **podstailgate.com** — the Razorback tailgate in the Gardens.
Plain HTML/CSS/JS, no build step. Hosted on GitHub Pages from the `main` branch
(custom domain in `CNAME`).

## Editing content (no code)

All the stuff that changes lives in `data/*.json`. Edit the file, commit, push —
Pages redeploys in about a minute.

| File | What it controls |
| --- | --- |
| `data/site.json` | Hero text, announcement bar, location, parking, Venmo (+ QR), sponsor bar, YouTube video, award image |
| `data/schedule.json` | Every game: date, time, opponent, menu, result, and the "Next Tailgate" card on the home page |
| `data/faq.json` | The FAQ list (shown on both the home page and the About page) |
| `data/galleries.json` | Photo galleries on the Photos page |

### Sponsor bar

The strip under the header on every page comes from `sponsors` in `data/site.json`.
Each entry is `{ "name", "image", "url" }`:

- `image` is a path like `assets/img/sponsors/pods.png`. If the file is missing
  or fails to load, the sponsor's `name` shows as text instead.
- `url` is optional; set it to make the logo a link.
- Logos render 64px tall (48px on phones) — use a transparent or white-background PNG, roughly 3:1 to 5:1 wide.

### Add or update a game

Add an object to `games` in `data/schedule.json`:

```json
{
  "date": "2026-09-19",
  "opponent": "Ole Miss",
  "home": true,
  "time": "11:00 AM",
  "menu": "Smoked Brisket",
  "chef": "Ben Pierce",
  "status": "upcoming",
  "result": "",
  "preview": "Short paragraph shown on the home page while this is the next game.",
  "gallery": ""
}
```

- `status`: `"upcoming"` or `"final"`.
- `time`: kickoff time, a tailgate window like `"2:00 – 7:00 PM"`, or `"TBD"` (hidden when TBD).
- The home page automatically shows the **soonest game that isn't `"final"` and
  whose date hasn't passed** (game day itself still counts). No upcoming games → it
  shows an off-season message. The card also shows a countdown ("12 days out").
- `result`: fill in after the game, e.g. `"W 24-17"`.
- `gallery`: set to a gallery `slug` (see below) to link "View photos" from the schedule.

### Change the announcement bar

In `data/site.json`, set `"announcement"` to any text (empty string hides the bar).
If left empty and `"announcementFallbackFromSchedule"` is `true`, the bar auto-shows
`This week: <menu> — Arkansas vs. <opponent>` for the next game.

### Add a photo gallery

1. Make a folder: `photos/<slug>/` (e.g. `photos/lsu-2026/`) and drop the images in.
2. Run `python3 scripts/build-galleries.py` — it rebuilds `data/galleries.json`,
   keeping any titles/dates/blurbs you've already set and appending new photos.
3. Edit the new gallery's `title`, `date`, and `blurb` in `data/galleries.json`.
4. Commit the images + the JSON.

Photo order is the order in the `photos` array. New files from the script are
appended to the end; reorder by hand if you care.

## Local preview

No server needed for most things, but `fetch()` of the JSON files requires HTTP.
Run any static server from the repo root:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Structure

```
index.html schedule.html photos.html about.html 404.html
CNAME
assets/css/site.css
assets/js/site.js       # shared: nav, announcement, this-week card, schedule, faq
assets/js/gallery.js    # photos page: gallery render + lightbox
assets/img/             # logo, backgrounds, map, parking, sponsor, award
data/*.json             # editable content
photos/<slug>/          # gallery images
scripts/build-galleries.py
```

## Deploy

Push to `main`. GitHub Pages serves the repo root. `CNAME` keeps the custom domain.
