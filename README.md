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

Required: `POSTGRES_PASSWORD`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (the JWT secrets still sign share links and older tokens). There are no defaults; compose stops with a message naming any that are missing.

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

Go to [http://localhost:5173](http://localhost:5173) and start a session. There is no sign-in: AccessGen Lens runs on your own machine, and everything you make belongs to one local user (sessions made under older accounts are moved to it the first time the backend starts).

## How a session works

There are two ways to experience a page, chosen at the top of the start page.

### Automated: watch it happen

Pick up to four people (David, James, Meera, Thomas, Ravi). The runner container opens the page in its own Chromium as each of them, moves through it the way they would (Tab by Tab, or looking for things you list), records it, and reports what stopped them. No extension is needed. Its browser reaches the internet only through the runner's egress proxy, which refuses private and internal addresses.

### Manual: explore it yourself

1. Pick a person on the start page (Ravi's tremor, Ananya's ADHD and dyslexia, Fatima's deafness, Sofia's switch access, Margaret's cataracts, Kenji's protanopia), or choose and combine conditions on the **Configure** page.
2. The extension opens the page in your Chrome with the simulation on, modelled on how each condition is actually experienced:
   - **Low vision and cataracts:** contrast-sensitivity loss measured element by element (faint text, pale borders and placeholders fade into the page while strong contrast stays readable), a mild blur that hurts small text far more than large, and haze or glare.
   - **Tunnel vision:** the periphery blurs, loses colour and dims, never black. **Macular degeneration:** a grey, blurred smudge where you look. Both follow the pointer or keyboard focus with the eye's small lag.
   - **Colour blindness:** Machado (2009) matrices, with weaker forms at lower severities.
   - **Tremor:** a ~5 Hz rest tremor along a slowly turning axis, worse when the hand is still; clicks that slide off between press and release are lost, and a press can be felt twice.
   - **Keyboard only and switch access:** the mouse is gone (and with one switch, every key but Space).
   - **Screen reader:** for a blind user a dark screen and only what is spoken (Tab, the Down arrow to read, H for headings), shown in a speech viewer.
   - **Dyslexia:** the words where you are reading waver and settle when you stay on them. **ADHD:** thoughts that break in, losing your place, motion pulling harder. **Deaf:** all sound off.
3. The screen is recorded from the first second, with nothing to switch on: the extension captures the tab's real pixels, simulation included, and the backend joins them into a video when you end the session. For a smoother video, choose **Turn on smooth video** from the extension icon (or the shortcut) on the simulated tab.
4. While you explore, the simulation notices struggles on its own and adds them to the report as automatic moments, with a picture. For example: a tremor click that hit the wrong thing, a button a screen reader announces with no name, a press of Tab that lost your place, something only a mouse can use, a long wait for the switch, a video with no captions. Press **I felt this** on the page (with a note, if you like) whenever the page pushes back.
5. Typed text is never stored: key presses in fields are recorded as "character".
6. When you press **End session and see the report**, you get a **Playback** page (the video, with every moment on the timeline) and an **Empathy Report** you can share or download as a PDF. The report separates what the tester felt from what the simulation noticed, and groups the noticed struggles under **What made it hard**.

Known gaps in the Manual mode:

- The automatic moments are what the simulation could see from the page (an outline that is not drawn, a control with no name, a click that missed). They are never a full audit and never an all-clear.
- The frame-by-frame video is about one picture every 0.7 seconds, and only while the simulated tab is the visible tab.
- Embedded players (YouTube, Vimeo) cannot be inspected, so they are named as something to check, not as missing captions.

## How issues are found

Both modes look for problems in two ways, and the results page lists all of them with every affected element.

- **The rules engine.** Every page is checked against axe-core, the open-source accessibility rules engine (every rule, WCAG A to AAA and best practice). Each broken rule is one finding listing every element that fails it, with its selector, its HTML and why it fails. What axe cannot decide on its own (for example contrast over a picture) is listed as "check by hand", never dropped. In Manual sessions the audit runs on every page you visit, again a few seconds after big changes (a dialog opening, a menu expanding, new content), and after every navigation. `extension/issues/rules.js` says what each rule means for people and whose experience it breaks.
- **What the simulation sees as the page is used.** Keyboard: focus with no visible sign, focus lost, focus hidden or covered, keyboard traps, the long way to the content, no skip link, things only a mouse can use, menus that open only on hover, Enter that does nothing. Tremor: clicks that missed. Screen reader: controls announced with no name. Switch access: long waits. Deaf: video with no captions. In Automated runs the five keyboard checks run on every stop of a Tab walk, measured once and confirmed again on camera.

Each moment in an Automated video stays on screen for five seconds, with the element and the problem written out. While a run is going, its page shows the runner's own browser on your page, a line for every step, and each problem as it is confirmed. When a person is done, their full results appear on the same page.

## One page per session

Everything about a session is on one page (`/results/:id`): what happened, the mission result, the video with every moment on its timeline, every issue with every element, the journey, what was looked at, and share, PDF, try again and delete. The old Playback and Report addresses lead there.

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
| `backend/package.json` or `backend/Dockerfile` | `docker compose up -d --build backend` (the image includes ffmpeg, which builds Manual-mode videos) |

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
