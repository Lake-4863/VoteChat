const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { dbRun, dbGet } = require('../db/database');

// Register
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await dbRun('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hashedPassword]);
        res.status(201).json({ message: 'User registered successfully', userId: result.id });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    try {
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ message: 'Login successful', user: { id: user.id, username: user.username } });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Could not log out' });
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
    });
});

// Get current user (Me)
router.get('/me', (req, res) => {
    if (req.session.userId) {
        res.json({ id: req.session.userId, username: req.session.username });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

module.exports = router;
