const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { db, dbGet, dbRun, dbAll } = require('./db/database');

const authRoutes = require('./routes/auth');
const debateRoutes = require('./routes/debates');
const postRoutes = require('./routes/posts');
const voteRoutes = require('./routes/votes');
const reportRoutes = require('./routes/reports');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'debate-sns-secret-key-dev',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 }
});
app.use(sessionMiddleware);

// Share session with socket.io
io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// Pass io to request object so routes can use it
app.use((req, res, next) => {
    req.io = io;
    next();
});

async function broadcastViewerCount(io, roomName, debateId) {
    const roomSockets = await io.in(roomName).fetchSockets();
    const debate = await dbGet('SELECT user1_id, user2_id FROM debates WHERE id = ?', [debateId]);
    if (!debate) return;

    let viewerCount = 0;
    for (const s of roomSockets) {
        const sessionUserId = s.request?.session?.userId;
        if (sessionUserId !== debate.user1_id && sessionUserId !== debate.user2_id) {
            viewerCount++;
        }
    }
    io.to(roomName).emit('viewer_count', viewerCount);
}

// Socket.io connection handling
io.on('connection', (socket) => {
    socket.on('join_debate', async (debateId) => {
        const roomName = `debate_${debateId}`;
        socket.join(roomName);
        await broadcastViewerCount(io, roomName, debateId);
    });

    socket.on('disconnecting', async () => {
        for (const roomName of socket.rooms) {
            if (roomName.startsWith('debate_')) {
                const debateId = roomName.replace('debate_', '');
                const roomSockets = await io.in(roomName).fetchSockets();
                const debate = await dbGet('SELECT user1_id, user2_id FROM debates WHERE id = ?', [debateId]);
                if (!debate) continue;

                let viewerCount = 0;
                for (const s of roomSockets) {
                    if (s.id === socket.id) continue;
                    const sessionUserId = s.request?.session?.userId;
                    if (sessionUserId !== debate.user1_id && sessionUserId !== debate.user2_id) {
                        viewerCount++;
                    }
                }
                io.to(roomName).emit('viewer_count', viewerCount);
            }
        }
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/debates', debateRoutes);
app.use('/api/debates', postRoutes);
app.use('/api/debates', voteRoutes);
app.use('/api/reports', reportRoutes);

// Serve static files
app.use(express.static(__dirname));

// Periodic check for debate endings
setInterval(async () => {
    try {
        const activeDebates = await dbAll('SELECT * FROM debates WHERE status = "active"');
        for (const debate of activeDebates) {
            if (!debate.end_time) continue;
            const diffMs = new Date(debate.end_time + 'Z') - new Date();
            let shouldEnd = false;
            let endResult = 'draw';

            const votesA = await dbGet('SELECT COUNT(*) as count FROM votes WHERE debate_id = ? AND vote_target = ?', [debate.id, 'A']);
            const votesB = await dbGet('SELECT COUNT(*) as count FROM votes WHERE debate_id = ? AND vote_target = ?', [debate.id, 'B']);
            const countA = votesA.count;
            const countB = votesB.count;
            const total = countA + countB;

            if (diffMs <= 0) {
                // Time's up
                shouldEnd = true;
                if (countA > countB) endResult = 'A_win';
                else if (countB > countA) endResult = 'B_win';
            } else if (diffMs <= 3 * 60 * 1000) {
                // Less than 3 mins, > 60% check
                if (total > 0) {
                    if (countA / total > 0.6) {
                        shouldEnd = true;
                        endResult = 'A_win';
                    } else if (countB / total > 0.6) {
                        shouldEnd = true;
                        endResult = 'B_win';
                    }
                }
            }

            if (shouldEnd) {
                await dbRun('UPDATE debates SET status = ?, result = ? WHERE id = ?', ['finished', endResult, debate.id]);
                io.to(`debate_${debate.id}`).emit('debate_finished', { result: endResult });
            }
        }
    } catch (e) {
        console.error('Interval check error:', e);
    }
}, 5000);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
