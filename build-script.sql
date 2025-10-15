-- -----------------------------
-- Event Management Tables Setup
-- -----------------------------

-- 1️⃣ Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2️⃣ Events Table
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    date TIMESTAMP NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3️⃣ Registrations Table
CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    registered_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, event_id)  -- prevent duplicate registrations
);

-- 4️⃣ Optional: Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reg_user ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);

-- -----------------------------
-- Script End
-- -----------------------------
