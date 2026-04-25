const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../db/database');

// Middleware to check auth
const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    next();
};

// Create a new debate
router.post('/', requireAuth, async (req, res) => {
    const { title, category } = req.body;
    if (!title || !category) return res.status(400).json({ error: 'Title and category are required' });

    try {
        const userId = req.session.userId;

        // Check if user is already a speaker in an active/waiting debate
        const existingDebate = await dbGet(`
            SELECT id FROM debates 
            WHERE (user1_id = ? OR user2_id = ?) 
            AND (status = 'waiting' OR status = 'active')
        `, [userId, userId]);

        if (existingDebate) {
            return res.status(403).json({ error: 'あなたはすでに進行中または待機中の討論に参加しています。新しい討論は作成できません。' });
        }

        const result = await dbRun('INSERT INTO debates (title, category, user1_id) VALUES (?, ?, ?)', [title, category, userId]);
        res.status(201).json({ message: 'Debate created', debateId: result.id });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all debates (with filtering by status)
router.get('/', async (req, res) => {
    const status = req.query.status; // 'waiting', 'active', 'finished'
    try {
        let query = 'SELECT d.*, u1.username as user1_name, u2.username as user2_name FROM debates d LEFT JOIN users u1 ON d.user1_id = u1.id LEFT JOIN users u2 ON d.user2_id = u2.id';
        let params = [];
        if (status) {
            query += ' WHERE d.status = ?';
            params.push(status);
        }
        query += ' ORDER BY d.created_at DESC';
        const debates = await dbAll(query, params);
        res.json(debates);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a single debate
router.get('/:id', async (req, res) => {
    try {
        const debate = await dbGet('SELECT d.*, u1.username as user1_name, u2.username as user2_name FROM debates d LEFT JOIN users u1 ON d.user1_id = u1.id LEFT JOIN users u2 ON d.user2_id = u2.id WHERE d.id = ?', [req.params.id]);
        if (!debate) return res.status(404).json({ error: 'Debate not found' });
        res.json(debate);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Join a debate
router.post('/:id/join', requireAuth, async (req, res) => {
    try {
        const debate = await dbGet('SELECT * FROM debates WHERE id = ?', [req.params.id]);
        if (!debate) return res.status(404).json({ error: 'Debate not found' });
        if (debate.status !== 'waiting') return res.status(400).json({ error: 'Debate is not waiting for participants' });
        if (debate.user1_id === req.session.userId) return res.status(400).json({ error: 'You cannot join your own debate' });

        // Set end_time to 10 minutes from now
        const endTimeStr = new Date(Date.now() + 10 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        await dbRun('UPDATE debates SET user2_id = ?, status = ?, end_time = ? WHERE id = ?', [req.session.userId, 'active', endTimeStr, req.params.id]);
        
        if (req.io) {
            req.io.to(`debate_${req.params.id}`).emit('debate_started');
        }

        res.json({ message: 'Joined debate successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE Debate (Admin only)
router.delete('/:id', requireAuth, async (req, res) => {
    if (req.session.username !== 'lake666486') return res.status(403).json({ error: 'Forbidden' });
    try {
        await dbRun('DELETE FROM debates WHERE id = ?', [req.params.id]);
        await dbRun('DELETE FROM posts WHERE debate_id = ?', [req.params.id]);
        await dbRun('DELETE FROM votes WHERE debate_id = ?', [req.params.id]);
        
        if (req.io) {
            req.io.to(`debate_${req.params.id}`).emit('debate_deleted');
        }
        res.json({ message: 'Debate deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST change time (Admin only)
router.post('/:id/time', requireAuth, async (req, res) => {
    if (req.session.username !== 'lake666486') return res.status(403).json({ error: 'Forbidden' });
    const { change } = req.body;
    try {
        const debate = await dbGet('SELECT * FROM debates WHERE id = ?', [req.params.id]);
        if (!debate || debate.status !== 'active') return res.status(400).json({ error: 'Debate not active' });
        
        const currentEndTime = new Date(debate.end_time + 'Z');
        currentEndTime.setMinutes(currentEndTime.getMinutes() + change);
        const newEndTimeStr = currentEndTime.toISOString().replace('T', ' ').substring(0, 19);
        
        await dbRun('UPDATE debates SET end_time = ? WHERE id = ?', [newEndTimeStr, req.params.id]);
        
        if (req.io) {
            req.io.to(`debate_${req.params.id}`).emit('time_updated', newEndTimeStr);
        }
        res.json({ message: 'Time updated', end_time: newEndTimeStr });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
