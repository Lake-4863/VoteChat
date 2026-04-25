CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS debates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER,
    status TEXT DEFAULT 'waiting', -- waiting, active, finished
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    result TEXT, -- A, B, draw
    FOREIGN KEY(user1_id) REFERENCES users(id),
    FOREIGN KEY(user2_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debate_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_hidden BOOLEAN DEFAULT 0,
    FOREIGN KEY(debate_id) REFERENCES debates(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debate_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    vote_target TEXT NOT NULL, -- A or B
    FOREIGN KEY(debate_id) REFERENCES debates(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(debate_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debate_id INTEGER NOT NULL,
    target_post_id INTEGER NOT NULL,
    reporter_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    FOREIGN KEY(debate_id) REFERENCES debates(id),
    FOREIGN KEY(target_post_id) REFERENCES posts(id),
    FOREIGN KEY(reporter_id) REFERENCES users(id),
    UNIQUE(target_post_id, reporter_id)
);

CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blocker_id INTEGER NOT NULL,
    blocked_id INTEGER NOT NULL,
    FOREIGN KEY(blocker_id) REFERENCES users(id),
    FOREIGN KEY(blocked_id) REFERENCES users(id),
    UNIQUE(blocker_id, blocked_id)
);
