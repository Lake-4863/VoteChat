const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'vschat.db');
const schemaPath = path.resolve(__dirname, 'schema.sql');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema, (err) => {
        if (err) {
            console.error('Error executing schema', err.message);
        } else {
            console.log('Database initialized.');
            // Patch: add result column to debates if it doesn't exist
            db.run('ALTER TABLE debates ADD COLUMN result TEXT', (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error('Failed to add result column', err.message);
                }
            });
            // Create debug_user if not exists
            const bcrypt = require('bcrypt');
            db.get('SELECT id FROM users WHERE username = ?', ['debug_user'], async (err, row) => {
                if (!err && !row) {
                    const hashed = await bcrypt.hash('debug_password', 10);
                    db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', ['debug_user', hashed], (err) => {
                        if (!err) console.log('Debug user created (debug_user / debug_password)');
                    });
                }
            });
            // Create admin lake666486
            db.get('SELECT id FROM users WHERE username = ?', ['lake666486'], async (err, row) => {
                if (!err && !row) {
                    const hashed = await bcrypt.hash('lake666486', 10);
                    db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', ['lake666486', hashed], (err) => {
                        if (!err) console.log('Admin user created (lake666486 / lake666486)');
                    });
                }
            });
        }
    });
}

// Promisify db methods for easier async/await usage
const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                console.log('Error running sql ' + sql);
                console.log(err);
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
};

const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, result) => {
            if (err) {
                console.log('Error running sql: ' + sql);
                console.log(err);
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.log('Error running sql: ' + sql);
                console.log(err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

module.exports = { db, dbRun, dbGet, dbAll };
