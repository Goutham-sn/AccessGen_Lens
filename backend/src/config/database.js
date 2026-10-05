import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10
})

export async function query(text, params) {
  return pool.query(text, params)
}

const MIGRATIONS = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  password_hash TEXT,
  google_id VARCHAR(255),
  subscription_tier VARCHAR(50) DEFAULT 'free',
  team_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  page_title TEXT,
  page_thumbnail TEXT,
  active_profiles JSONB NOT NULL DEFAULT '[]',
  persona_id UUID,
  persona_snapshot JSONB,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_seconds INTEGER,
  frame_count INTEGER DEFAULT 0,
  event_count INTEGER DEFAULT 0,
  empathy_moment_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'recording',
  video_url TEXT,
  processing_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  frame_index INTEGER NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  screenshot_url TEXT,
  scroll_x INTEGER DEFAULT 0,
  scroll_y INTEGER DEFAULT 0,
  focused_element JSONB,
  active_profiles JSONB,
  cognitive_load_score FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_frames_session ON session_frames(session_id, frame_index);

CREATE TABLE IF NOT EXISTS session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp_ms INTEGER NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  target_element JSONB,
  coordinates JSONB,
  key_pressed VARCHAR(100),
  is_empathy_moment BOOLEAN DEFAULT FALSE,
  empathy_label VARCHAR(255),
  empathy_note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id, timestamp_ms);

CREATE TABLE IF NOT EXISTS empathy_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp_ms INTEGER NOT NULL,
  frame_index INTEGER,
  label VARCHAR(255) NOT NULL,
  note TEXT,
  screenshot_url TEXT,
  active_profiles JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_moments_session ON empathy_moments(session_id, timestamp_ms);

CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_built_in BOOLEAN DEFAULT FALSE,
  name VARCHAR(255) NOT NULL,
  age INTEGER,
  story TEXT,
  illustration_url TEXT,
  profiles JSONB NOT NULL DEFAULT '[]',
  is_public BOOLEAN DEFAULT FALSE,
  team_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  share_token VARCHAR(255) UNIQUE NOT NULL,
  is_password_protected BOOLEAN DEFAULT FALSE,
  password_hash TEXT,
  expires_at TIMESTAMP,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

-- Milliseconds between session start and the tab video starting, so
-- empathy moments (stamped from session start) line up with the video.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS recording_offset_ms INTEGER;

-- Runner mode ("Watch it happen"): one session per persona, grouped by run.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'extension';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS run_id UUID;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS coverage JSONB;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS narration JSONB;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS run_timings JSONB;
-- Internal only (dropped findings, mismatches). Never sent to the client.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS run_debug JSONB;
CREATE INDEX IF NOT EXISTS idx_sessions_run ON sessions(run_id);

ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'extension';
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS detector VARCHAR(64);
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS profile_id VARCHAR(64);
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS video_ms INTEGER;
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS rect JSONB;
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS evidence JSONB;
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS shot_url TEXT;
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS shot_clean_url TEXT;
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS closeup_url TEXT;
-- The page as the persona sees it (their filter on), taken just before the
-- filter is paused for the clean and highlighted shots.
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS shot_persona_url TEXT;
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS pattern_count INTEGER;
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS fact TEXT;
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS for_team TEXT;
-- Internal only. Never sent to the client.
ALTER TABLE empathy_moments ADD COLUMN IF NOT EXISTS internal_ref TEXT;

-- One built-in persona per name, so the seed can upsert and keep ids stable.
-- Older boots could only ever leave one copy of each (they deleted all
-- built-ins first), but drop any extra copies just in case, keeping the oldest.
DELETE FROM personas a USING personas b
 WHERE a.is_built_in AND b.is_built_in AND a.name = b.name AND a.created_at > b.created_at;
CREATE UNIQUE INDEX IF NOT EXISTS uq_personas_builtin_name ON personas(name) WHERE is_built_in;
-- Pronouns for card stories only (detector copy uses names). Set by the
-- product owner for built-ins; everyone else defaults to they/them/their.
ALTER TABLE personas ADD COLUMN IF NOT EXISTS pronouns JSONB NOT NULL
  DEFAULT '{"subject":"they","object":"them","possessive":"their"}';

-- Per-session upload token for the extension. Only the SHA-256 hash is kept.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS upload_token_hash TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS upload_token_expires_at TIMESTAMP;
-- Set by /end: frames and moments stop, the recording gets a grace period.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS uploads_closed_at TIMESTAMP;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS recording_token_used BOOLEAN DEFAULT FALSE;
`

export async function migrate() {
  await pool.query(MIGRATIONS)
  console.log('[db] migrations applied')
}
