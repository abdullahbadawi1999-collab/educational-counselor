CREATE TABLE IF NOT EXISTS circles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  teacher_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  student_phone TEXT,
  parent_phone_1 TEXT,
  parent_phone_2 TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS behavior_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('positive', 'negative')),
  category TEXT DEFAULT 'other',
  severity TEXT DEFAULT 'low' CHECK(severity IN ('low', 'medium', 'high')),
  escalation_rule TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS behaviors (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  behavior_type_id INTEGER REFERENCES behavior_types(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK(type IN ('positive', 'negative')),
  description TEXT NOT NULL,
  date TEXT NOT NULL,
  action_taken INTEGER DEFAULT 0,
  action_description TEXT,
  action_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK(level IN (1, 2, 3)),
  level_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  trigger_behavior_ids TEXT,
  trigger_type TEXT DEFAULT 'auto' CHECK(trigger_type IN ('auto', 'manual')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'done')),
  action_taken TEXT,
  action_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actions (
  id SERIAL PRIMARY KEY,
  behavior_id INTEGER NOT NULL REFERENCES behaviors(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  action_date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_circle ON students(circle_id);
CREATE INDEX IF NOT EXISTS idx_behaviors_student ON behaviors(student_id);
CREATE INDEX IF NOT EXISTS idx_behaviors_date ON behaviors(date);
CREATE INDEX IF NOT EXISTS idx_behaviors_type ON behaviors(type);
CREATE INDEX IF NOT EXISTS idx_behaviors_btype ON behaviors(behavior_type_id);
CREATE INDEX IF NOT EXISTS idx_actions_behavior ON actions(behavior_id);
CREATE INDEX IF NOT EXISTS idx_alerts_student ON alerts(student_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_level ON alerts(level);
