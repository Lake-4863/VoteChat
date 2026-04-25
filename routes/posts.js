const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../db/database');

// Middleware to check auth
const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    next();
};

// Create a post
router.post('/:id/posts', requireAuth, async (req, res) => {
    const debateId = req.params.id;
    const { content } = req.body;
    const userId = req.session.userId;

    if (!content) return res.status(400).json({ error: 'Content is required' });
    if (content.length > 1500) return res.status(400).json({ error: 'Content exceeds 1500 characters' });

    try {
        const debate = await dbGet('SELECT * FROM debates WHERE id = ?', [debateId]);
        if (!debate) return res.status(404).json({ error: 'Debate not found' });
        if (debate.status !== 'active') return res.status(400).json({ error: 'Debate is not active' });
        if (debate.user1_id !== userId && debate.user2_id !== userId) return res.status(403).json({ error: 'You are not a participant in this debate' });

        // Check for 15s spam restriction (Skip for debug_user)
        if (req.session.username !== 'debug_user') {
            const lastPost = await dbGet('SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);
            if (lastPost) {
                const timeDiff = new Date() - new Date(lastPost.created_at + 'Z'); 
                if (timeDiff < 15000) {
                    return res.status(429).json({ error: 'Please wait 15 seconds before posting again' });
                }
            }
        }

        const result = await dbRun('INSERT INTO posts (debate_id, user_id, content) VALUES (?, ?, ?)', [debateId, userId, content]);
        
        // Broadcast new post via Socket.io
        const debateInfo = await dbGet('SELECT user1_id, user2_id FROM debates WHERE id = ?', [debateId]);
        const authorType = userId === debateInfo.user1_id ? 'A' : (userId === debateInfo.user2_id ? 'B' : 'Unknown');
        if (req.io) {
            req.io.to(`debate_${debateId}`).emit('new_post', {
                id: result.id,
                author: authorType,
                content: content,
                created_at: new Date().toISOString().replace('T', ' ').substring(0, 19), // Match SQLite format
                is_hidden: 0
            });
        }

        res.status(201).json({ message: 'Post created', postId: result.id });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get posts for a debate
router.get('/:id/posts', async (req, res) => {
    const debateId = req.params.id;
    try {
        const posts = await dbAll('SELECT id, debate_id, user_id, content, created_at, is_hidden FROM posts WHERE debate_id = ? ORDER BY created_at ASC', [debateId]);
        
        const debate = await dbGet('SELECT user1_id, user2_id FROM debates WHERE id = ?', [debateId]);
        if (!debate) return res.status(404).json({ error: 'Debate not found' });

        const formattedPosts = posts.map(post => {
            const authorType = post.user_id === debate.user1_id ? 'A' : (post.user_id === debate.user2_id ? 'B' : 'Unknown');
            return {
                id: post.id,
                author: authorType,
                content: post.is_hidden ? 'この投稿は通報により非表示になりました。' : post.content,
                created_at: post.created_at,
                is_hidden: post.is_hidden
            };
        });

        res.json(formattedPosts);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE post (Admin only)
router.delete('/:id/posts/:postId', requireAuth, async (req, res) => {
    if (req.session.username !== 'lake666486') return res.status(403).json({ error: 'Forbidden' });
    try {
        await dbRun('DELETE FROM posts WHERE id = ? AND debate_id = ?', [req.params.postId, req.params.id]);
        if (req.io) {
            req.io.to(`debate_${req.params.id}`).emit('post_deleted', req.params.postId);
        }
        res.json({ message: 'Post deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
