-- ============================================================
-- Labor-AI Delivery Room Simulator — Database Schema
-- Run against your Vercel Postgres instance to set up tables
-- ============================================================

-- Staff roster (all roles)
CREATE TABLE IF NOT EXISTS sim_staff (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  role       VARCHAR(50)  NOT NULL,   -- 'מתמחה' | 'מיילדת' | 'רופא בכיר' | 'מיילדת אחראית'
  email      VARCHAR(255) DEFAULT '',
  active     BOOLEAN      DEFAULT TRUE,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Scenarios
CREATE TABLE IF NOT EXISTS sim_scenarios (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  case_story       TEXT,
  expected_actions TEXT,
  phases           TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cards (belong to scenarios)
CREATE TABLE IF NOT EXISTS sim_cards (
  id                  SERIAL  PRIMARY KEY,
  scenario_id         INT     REFERENCES sim_scenarios(id) ON DELETE CASCADE,
  card_number         INT     NOT NULL,
  title               VARCHAR(255),
  clinical_description TEXT,
  structured_data     JSONB,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions
CREATE TABLE IF NOT EXISTS sim_sessions (
  id               SERIAL PRIMARY KEY,
  session_code     VARCHAR(20) UNIQUE NOT NULL,
  scenario_id      INT REFERENCES sim_scenarios(id),
  instructor_name  VARCHAR(255),
  status           VARCHAR(20) DEFAULT 'setup',  -- setup|running|debrief|completed
  started_at       TIMESTAMP,
  ended_at         TIMESTAMP,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session participants
CREATE TABLE IF NOT EXISTS sim_session_participants (
  id               SERIAL PRIMARY KEY,
  session_id       INT REFERENCES sim_sessions(id) ON DELETE CASCADE,
  staff_id         INT REFERENCES sim_staff(id),
  role_in_session  VARCHAR(50) NOT NULL,
  evaluated        BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notes
CREATE TABLE IF NOT EXISTS sim_notes (
  id               SERIAL PRIMARY KEY,
  session_id       INT REFERENCES sim_sessions(id) ON DELETE CASCADE,
  author_id        INT REFERENCES sim_staff(id),
  sim_time_seconds INT     NOT NULL,
  note_type        VARCHAR(20) DEFAULT 'text',     -- text|quick_tag|debrief
  tag_type         VARCHAR(50) DEFAULT '',
  content          TEXT    DEFAULT '',
  phase            VARCHAR(20) DEFAULT 'simulation', -- simulation|debrief
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notepads (per evaluator per session)
CREATE TABLE IF NOT EXISTS sim_notepads (
  id         SERIAL PRIMARY KEY,
  session_id INT REFERENCES sim_sessions(id) ON DELETE CASCADE,
  author_id  INT REFERENCES sim_staff(id),
  content    TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Video clips
CREATE TABLE IF NOT EXISTS sim_video_clips (
  id               SERIAL PRIMARY KEY,
  session_id       INT REFERENCES sim_sessions(id) ON DELETE CASCADE,
  device_role      VARCHAR(20) NOT NULL,
  sim_time_start   INT NOT NULL,
  sim_time_end     INT NOT NULL,
  blob_url         TEXT NOT NULL,
  duration_seconds INT NOT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assessments
CREATE TABLE IF NOT EXISTS sim_assessments (
  id             SERIAL PRIMARY KEY,
  session_id     INT REFERENCES sim_sessions(id) ON DELETE CASCADE,
  participant_id INT REFERENCES sim_session_participants(id),
  evaluator_id   INT REFERENCES sim_staff(id),
  form_type      VARCHAR(20) NOT NULL,   -- resident|midwife
  scores         JSONB,
  strengths      TEXT DEFAULT '',
  improvements   TEXT DEFAULT '',
  key_message    TEXT DEFAULT '',
  total_score    INT,
  submitted_at   TIMESTAMP,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
