const express = require('express');
const router = express.Router();
const { dbRun, dbGet } = require('../db/database');

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    next();
};

// Vote for a debate
router.post('/:id/vote', requireAuth, async (req, res) => {
    const debateId = req.params.id;
    const { voteTarget } = req.body; // 'A' or 'B'
    const userId = req.session.userId;

    if (!['A', 'B', 'Truce'].includes(voteTarget)) return res.status(400).json({ error: 'Invalid vote target' });

    try {
        const debate = await dbGet('SELECT * FROM debates WHERE id = ?', [debateId]);
        if (!debate) return res.status(404).json({ error: 'Debate not found' });
        
        // Participants cannot vote
        if (debate.user1_id === userId || debate.user2_id === userId) {
            return res.status(403).json({ error: 'Participants cannot vote in their own debate' });
        }

        if (debate.status !== 'active') return res.status(400).json({ error: 'Voting is only allowed during active debates' });

        try {
            // Check if already voted
            const existingVote = await dbGet('SELECT * FROM votes WHERE debate_id = ? AND user_id = ?', [debateId, userId]);
            if (existingVote) {
                if (existingVote.vote_target === voteTarget) {
                    return res.status(400).json({ error: 'すでにその対象に投票済みです' });
                }
                await dbRun('UPDATE votes SET vote_target = ? WHERE debate_id = ? AND user_id = ?', [voteTarget, debateId, userId]);
            } else {
                await dbRun('INSERT INTO votes (debate_id, user_id, vote_target) VALUES (?, ?, ?)', [debateId, userId, voteTarget]);
            }
            
            // Broadcast vote update via Socket.io
            const resultA = await dbGet('SELECT COUNT(*) as count FROM votes WHERE debate_id = ? AND vote_target = ?', [debateId, 'A']);
            const resultB = await dbGet('SELECT COUNT(*) as count FROM votes WHERE debate_id = ? AND vote_target = ?', [debateId, 'B']);
            const resultTruce = await dbGet('SELECT COUNT(*) as count FROM votes WHERE debate_id = ? AND vote_target = ?', [debateId, 'Truce']);
            
            const countA = resultA.count;
            const countB = resultB.count;
            const countTruce = resultTruce.count;

            if (req.io) {
                req.io.to(`debate_${debateId}`).emit('vote_update', { A: countA, B: countB, Truce: countTruce });
            }

            // Check early end conditions
            let endResult = null;
            if (countTruce >= 10) {
                endResult = 'draw';
            } else {
                const totalAB = countA + countB;
                if (totalAB > 0) {
                    const diffMs = new Date(debate.end_time + 'Z') - new Date();
                    if (diffMs <= 3 * 60 * 1000 && diffMs > 0) {
                        if (countA / totalAB > 0.6) {
                            endResult = 'A_win';
                        } else if (countB / totalAB > 0.6) {
                            endResult = 'B_win';
                        }
                    }
                }
            }

            if (endResult) {
                await dbRun('UPDATE debates SET status = ?, result = ? WHERE id = ?', ['finished', endResult, debateId]);
                if (req.io) {
                    req.io.to(`debate_${debateId}`).emit('debate_finished', { result: endResult });
                }
            }

            res.json({ message: '投票を受け付けました' });
        } catch (err) {
            res.status(500).json({ error: 'サーバー内部エラー' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get votes for a debate
router.get('/:id/votes', async (req, res) => {
    const debateId = req.params.id;
    try {
        const resultA = await dbGet('SELECT COUNT(*) as count FROM votes WHERE debate_id = ? AND vote_target = ?', [debateId, 'A']);
        const resultB = await dbGet('SELECT COUNT(*) as count FROM votes WHERE debate_id = ? AND vote_target = ?', [debateId, 'B']);
        const resultTruce = await dbGet('SELECT COUNT(*) as count FROM votes WHERE debate_id = ? AND vote_target = ?', [debateId, 'Truce']);
        res.json({ A: resultA.count, B: resultB.count, Truce: resultTruce.count });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
