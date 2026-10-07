# AccessGen Lens

**Experience your website as a person with a disability would.**

AccessGen Lens is a browser-based accessibility *empathy simulation* tool. It is not an audit tool: it never shows WCAG violations or compliance checklists. It makes you **feel** what it is like to navigate a website as a person with a disability: colorblindness, tunnel vision, tremor, switch access, dyslexia, ADHD, deafness, screen-reader use, and more.

## Three parts, working together

| Part | What it does | Where it runs |
|---|---|---|
| **Web App** | Control panel, live session dashboard, playback, empathy reports | React + Vite on `localhost:5173` |
| **Chrome Extension** | The simulation execution engine: applies profiles to any page, records the session | Loaded unpacked in Chrome |
| **Backend** | Sessions, frames, video compilation, PDF reports, sharing | Node.js in Docker on `localhost:3001` |

## Prerequisites

- Node.js 18+
- Docker Desktop
- Google Chrome

## Setup

```bash
# 1. Clone the repo, then from the project root:
cp .env.example .env

# 2. Start PostgreSQL, Redis, MinIO and the backend
docker-compose up -d

# 3. Web app
cd web-app
npm install
npm run dev          # http://localhost:5173

# 4. Extension (new terminal)
cd extension
npm install
npm run build:watch  # rebuilds dist/ on change
```

**5. Load the extension in Chrome**

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `extension/dist` folder

**6. Open the app** at [http://localhost:5173](http://localhost:5173), create an account, and start a session.

### Reloading the extension

After code changes in `extension/`, the watch build rewrites `dist/`. Go to `chrome://extensions` and click the refresh icon on **AccessGen Lens**, then reload any page you were simulating on.

## How a session works

1. In the web app, pick disability profiles (or a persona like *Meera, 72*) on the **Configure** page.
2. Click **Start Simulation** and enter the URL to test.
3. The extension opens the page and applies the simulation: SVG color matrices, canvas vision overlays, event interception for motor profiles, Web Speech announcements for the screen reader.
4. Everything you do is recorded: frames every 500 ms, every interaction, every **"I Felt This"** empathy moment you log.
5. When you stop, the backend compiles the frames into a smooth MP4 video, and you get a **Playback** page and a shareable **Empathy Report**.

## Services

| Service | Port | Credentials |
|---|---|---|
| Web app | 5173 | none |
| Backend API | 3001 | none |
| PostgreSQL | 5432 | user `accessgen`, password `POSTGRES_PASSWORD` from `.env` |
| Redis | 6380 | none |
| MinIO API | 9000 | `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` from `.env` |
| MinIO Console | 9001 | `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` from `.env` |

## Philosophy

Every simulation must feel visceral and real. This is an empathy engine, not a checklist. The tool speaks in human language, for example *"Meera would struggle to find this"*, never in criterion numbers.
