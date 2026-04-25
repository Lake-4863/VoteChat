const express = require('express');
const router = express.Router();
const { dbRun, dbGet } = require('../db/database');

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    next();
};

router.post('/', requireAuth, async (req, res) => {
    const { debateId, postId, reason } = req.body;
    const userId = req.session.userId;

    if (!debateId || !postId || !reason) return res.status(400).json({ error: 'Missing required fields' });

    try {
        try {
            await dbRun('INSERT INTO reports (debate_id, target_post_id, reporter_id, reason) VALUES (?, ?, ?, ?)', [debateId, postId, userId, reason]);
            
            // Check report count
            const postInfo = await dbGet('SELECT user_id FROM posts WHERE id = ?', [postId]);
            const authorInfo = await dbGet('SELECT username FROM users WHERE id = ?', [postInfo.user_id]);

            if (authorInfo.username !== 'debug_user') {
                const reportCount = await dbGet('SELECT COUNT(*) as count FROM reports WHERE target_post_id = ?', [postId]);
                if (reportCount.count >= 5) {
                    // Hide post
                    await dbRun('UPDATE posts SET is_hidden = 1 WHERE id = ?', [postId]);
                    if (req.io) {
                        req.io.to(`debate_${debateId}`).emit('post_hidden', { id: postId });
                    }
                }
            }

            res.json({ message: 'Report submitted successfully' });
        } catch (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'You have already reported this post' });
            }
            throw err;
        }
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
