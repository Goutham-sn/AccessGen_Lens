# AccessGen Lens

**Experience your website as a person with a disability would.**

AccessGen Lens is a browser-based accessibility *empathy simulation* tool. It is not an audit tool: it never shows WCAG violations or compliance checklists. It makes you **feel** what it is like to navigate a website as a person with a disability: colorblindness, tunnel vision, tremor, switch access, dyslexia, ADHD, deafness, screen-reader use, and more.

## The parts, working together

| Part | What it does | Where it runs |
|---|---|---|
| **Web App** (frontend) | Control panel, live session dashboard, playback, empathy reports | React + Vite on your machine, `localhost:5173` |
| **Chrome Extension** | The simulation execution engine: applies profiles to any page, records the session | Loaded unpacked in Chrome |
| **Backend** | Sessions, frames, video compilation, PDF reports, sharing | Node.js in Docker, `localhost:3001` |
| **Runner** | "Watch it happen": server-side Chromium walks a public page as a persona and records it | Playwright in Docker, no port (takes jobs from Redis) |
| **PostgreSQL, Redis, MinIO** | Database, job queue and live updates, file storage | Docker |

## Where you run each command

Every path below is relative to the repo root (the folder holding this README and `docker-compose.yml`).

| What | Folder to run it from | Command | Address |
|---|---|---|---|
| Backend, runner, PostgreSQL, Redis, MinIO | repo root | `docker compose up -d --build` | API on http://localhost:3001 |
| Frontend (web app) | `web-app/` | `npm install`, then `npm run dev` | http://localhost:5173 |
| Chrome extension build | `extension/` | `npm install`, then `npm run build:watch` | output in `extension/dist/` |
| Chrome extension load | Chrome, `chrome://extensions` | Load unpacked, pick `extension/dist/` | |
| Repo-wide text check | repo root | `npm test` | |
| Web app tests | `web-app/` | `npm test` | |
| Backend tests | repo root | `docker compose exec backend sh -c "node --test test/*.test.js"` | |
| Runner tests | repo root | `docker compose run --rm runner npm test` | |

The backend and runner are not started with `npm` on your machine: Docker Compose builds them from `backend/` and `runner/` and runs them in containers. All `docker compose` commands are run from the repo root.

## Prerequisites

- Node.js 18+ (20 matches the containers)
- Docker Desktop, running
- Google Chrome

## Setup

### 1. Settings (repo root)

```bash
cp .env.example .env              # PowerShell: Copy-Item .env.example .env
```

Replace every `CHANGE_ME` value in `.env`. Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Required: `POSTGRES_PASSWORD`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`. There are no defaults; compose stops with a message naming any that are missing.

### 2. Backend, runner and data services (repo root)

```bash
docker compose up -d --build
docker compose ps                 # postgres, redis and minio should show "healthy"
docker compose logs -f backend    # wait for: [server] AccessGen Lens backend on http://localhost:3001
```

On startup the backend creates the database tables, the MinIO bucket and the built-in personas. There is no separate migrate step.

### 3. Frontend: web app (new terminal, `web-app/`)

```bash
cd web-app
npm install
npm run dev          # http://localhost:5173
```

The port is fixed (`strictPort`): if 5173 is taken, Vite stops instead of picking another. The extension and the backend both expect 5173.

### 4. Extension build (new terminal, `extension/`)

```bash
cd extension
npm install
npm run build:watch  # rebuilds extension/dist on every change
```

### 5. Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `extension/dist` folder

### 6. Open the app

Go to [http://localhost:5173](http://localhost:5173), create an account, and start a session.

## How a session works

1. In the web app, pick disability profiles (or a persona like *Meera, 72*) on the **Configure** page.
2. Click **Start Simulation** and enter the URL to test.
3. The extension opens the page and applies the simulation: SVG color matrices, canvas vision overlays, event interception for motor profiles, Web Speech announcements for the screen reader.
4. Everything you do is recorded: frames every 500 ms, every interaction, every **"I Felt This"** empathy moment you log.
5. When you stop, the backend compiles the frames into a smooth MP4 video, and you get a **Playback** page and a shareable **Empathy Report**.

A persona run started from the start page ("Watch it happen") does not need the extension: the runner container walks the page in its own Chromium and records it. Its browser reaches the internet only through the runner's egress proxy, which refuses private and internal addresses.

## Task Mode: giving the people something to find

On the start page, a "Watch it happen" run can be given a goal and up to six things to find, in order. Each person looks for the first, then for the next from where they ended up, using only Tab and Enter. Enter is pressed only on a link to a page on the same site, or on a button that does not send a form, and only on a place that matches what is being looked for. Nothing is typed, no one signs in, and no form is sent. The audit checks do not run in these runs.

When a thing is not reached, the report gets a moment in plain words. A separate structured record goes to the `task_failures` table, for counting and grouping. It is never shown as report text. A run that stops because a found link would leave the site, open a new tab or send a form says so on the run page, and is not counted as a failure.

Known gaps:

- After Enter loads a new page, the person's view (colour filters, the tunnel-vision dark) is put back once the page is ready, so the first moments of that page in the video are unfiltered.
- Tunnel vision uses one fixed distance, 300 px from the middle of the screen and from the stop just left, whatever the persona's severity. The video and the finding use the same distance.
- A moment's "persona view" picture of a place that could not be made out is taken after the page has scrolled that place to the middle, so it can look clear there. The video shows the moment of arrival.
- The 90 second limit per person is unchanged and has not been measured on long lists or slow sites.

## The page pre-check: a quick look before a run

Once someone ticks "I'm allowed to test this site." on the start page, the runner opens the address once and counts how many places Tab can reach. On a page with none, or only a few, the keyboard and screen reader cards (David, James) say so in one line. It is advice: the card can still be chosen. It counts what is there and never says whether it is done well, so it is not an audit.

- It starts only from the tick (or the "Check this page" button), never from typing. Changing the address or taking the tick back clears it.
- It has its own queue (`lens-precheck`), its own concurrency and its own browser contexts (`RUNNER_PRECHECK_CONCURRENCY` and `RUNNER_PRECHECK_CONTEXTS`, both 2), so it neither waits behind a run nor takes a run's contexts. It uses the runner's page loading and egress proxy, with a 6 second limit.
- Each check is a visit to someone's site, so a good look is kept for ten minutes (anyone asking for the same address in that time is answered from it), a person has one check in flight at a time, and the daily number matches the run limit (`RUNNER_DAILY_LIMIT`).
- The count approximates Tab: visible, enabled things with a tab index of 0 or more, one per group of radio buttons, including open shadow roots. A page whose content is in a frame is reported as unsure rather than empty.

The one look measures four things, and each card hears only about the ones that apply to the person. Each is a note only when there is little for that person to meet, never a verdict on the page:

- **Places Tab can reach** (David, James): none or few.
- **Text to read** (Meera, Thomas, Ravi): almost none, or little. A short page with a large picture, video or frame is "unsure", because the words may be in the picture.
- **Colour that changes** (David): how much of the first screen looks different through the red-green filter the run applies. The matrix is read from the profile itself and worked in linear light, as the real filter is. The note says "on screen", so colour further down the page is not counted.
- **Places out of sight with tunnel vision** (Thomas, only when something to find is on, because only that run simulates tunnel vision): the run's own "made out" rule (`madeOutNarrow` in `task.js`), applied to each Tab stop placed where Chromium lands it when scrolled into view. It is graded by how many places are out of view, and the sentence gives both numbers: none ("would be able to make out every place"), three or fewer ("little to miss: only 1 of the 4 places sits out of view"), eight or more ("a lot to miss: 11 of 57 places sit out of view"), and nothing in between. It is a count and not a share because a page with one link has all of its places out of view and almost nothing to miss. The edges, 3 and 8, were set from real pages (see the table in `measuringStick.js`) and are pinned by fixtures with exactly 3, 4, 7 and 8 places out of view.

Every threshold, with its reason, is in `runner/src/measuringStick.js`. Each number was checked against what the real run produces on the same page (tests in `precheck-signals.test.js`, and the real Tab walk, `taskWalk` and a real filtered render). Known gaps:

- A menu that opens when Tab reaches it (DuckDuckGo's) puts its items somewhere the pre-check cannot know without tabbing, so its out-of-sight count can be a few stops off (33 against 30 of 172 there). Skip links, which wait off the page and appear when focused, are handled: they are focused for a moment to see where they appear.
- A page that changes by itself while it is looked at (a rotating banner) gives a colour number that is true of one moment only.
- The tunnel-vision count assumes the page scrolls, not an inner box; stops inside a scrolling box can be placed wrongly.
- Colour is measured on the first screen only, and text counts the words on the page, not words inside pictures.

## After changing code

| You changed | Do this |
|---|---|
| `backend/src/` | Nothing, usually: the folder is mounted into the container and nodemon restarts it. If not, `docker compose restart backend` (repo root). |
| `web-app/src/` | Nothing: Vite reloads the page. |
| `extension/` | The watch build rewrites `dist/`. In `chrome://extensions`, click the refresh icon on **AccessGen Lens**, then reload any page you were simulating on. |
| `runner/` or `extension/profiles/` | Rebuild the runner (repo root): `docker compose up -d --build runner`. Its code and the extension's profiles are copied into the image when it is built, not mounted. |
| `backend/package.json` | `docker compose up -d --build backend` |

## Tests

| Suite | Run from | Command | Needs |
|---|---|---|---|
| Hidden characters and em dashes in every tracked file | repo root | `npm test` | nothing |
| Web app | `web-app/` | `npm test` | `npm install` done |
| Backend | repo root | `docker compose exec backend sh -c "node --test test/*.test.js"` | backend running (most tests call the live API, database and MinIO) |
| Backend, one file | repo root | `docker compose exec backend node --test test/lookedAt.test.js` | |
| Runner | repo root | `docker compose run --rm runner npm test` | Chromium in the container; files run one at a time |
| Runner, one file | repo root | `docker compose run --rm runner node --test test/walk.test.js` | |

### Runner scripts (repo root)

```bash
# Phase 1 checks, with a stub store (writes nothing to the database or MinIO)
docker compose run --rm runner node scripts/phase1-check.js

# Video timing calibration
docker compose run --rm runner node scripts/calibrate.js

# Hand-check list for the keyboard detectors (urls.txt: a URL per line, then a short label)
docker compose run --rm --no-deps \
  -v "$PWD/runner/validation:/app/runner/validation" \
  runner node scripts/validate-keyboard.js validation/urls.txt
# Add --fixtures to try it on local fixture pages instead of the network.
```

`regenerate-howto.js` is run from `runner/`: `node scripts/regenerate-howto.js validation/<folder> [--apply]`.

## Stopping

Run from the repo root:

```bash
docker compose down       # stop, keep data
docker compose down -v    # stop and DELETE all PostgreSQL, Redis and MinIO data
```

Stop the web app and the extension watch build with Ctrl+C in their terminals.

## Services

| Service | Port | Credentials |
|---|---|---|
| Web app | 5173 | none |
| Backend API | 3001 | none |
| PostgreSQL | 5432 | user `accessgen`, database `accessgen_lens`, password `POSTGRES_PASSWORD` from `.env` |
| Redis | 6380 (6379 inside Docker) | none |
| MinIO API | 9000 | `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` from `.env` |
| MinIO Console | 9001 | `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` from `.env` |

## Dev only: unverified checks

Checks that are built but not yet verified by hand produce runner moments (labelled "Unverified, for testing") only when both lines below are in `.env`. Leave them out for normal use. Rebuild the runner after changing them.

```
RUNNER_NODE_ENV=development
UNVERIFIED_CHECKS=1
```

## Philosophy

Every simulation must feel visceral and real. This is an empathy engine, not a checklist. The tool speaks in human language, for example *"Meera would struggle to find this"*, never in criterion numbers.
