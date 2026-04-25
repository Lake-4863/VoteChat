const urlParams = new URLSearchParams(window.location.search);
const debateId = urlParams.get('id');
let currentDebate = null;
const socket = typeof io !== 'undefined' ? io() : null;
let timeInterval = null;

function updateTimeDisplay() {
    if (!currentDebate || currentDebate.status !== 'active' || !currentDebate.end_time) return;
    const endTime = new Date(currentDebate.end_time + 'Z');
    const now = new Date();
    const diff = endTime - now;

    const timeEl = document.getElementById('d-time');
    if (diff <= 0) {
        timeEl.textContent = '残り時間: 00:00';
        timeEl.style.color = 'var(--danger-color)';
        if (timeInterval) clearInterval(timeInterval);
        // Fetch result immediately on time-up
        fetchAndShowResult();
    } else {
        const m = Math.floor(diff / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        timeEl.textContent = `残り時間: ${m}:${s}`;
        if (diff < 60000) timeEl.style.color = 'var(--danger-color)';
        else timeEl.style.color = 'inherit';
    }
}

async function fetchAndShowResult() {
    // Retry up to 5 times (server may take a moment to finalize)
    for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
            const res = await fetch(`/api/debates/${debateId}`);
            if (!res.ok) continue;
            const debate = await res.json();
            if (debate.status === 'finished' && debate.result) {
                currentDebate.status = 'finished';
                currentDebate.result = debate.result;
                const statusEl = document.getElementById('d-status');
                if (statusEl) {
                    statusEl.textContent = 'FINISHED';
                    statusEl.className = 'badge finished';
                }
                updateUI();
                showResult(debate.result);
                return;
            }
        } catch (e) { /* retry */ }
    }
}

async function loadDebateDetails() {
    try {
        const res = await fetch(`/api/debates/${debateId}`);
        if (!res.ok) {
            document.getElementById('d-title').textContent = '討論が見つかりません';
            return;
        }
        currentDebate = await res.json();
        
        document.getElementById('d-title').textContent = currentDebate.title;
        document.getElementById('d-category').textContent = `カテゴリ: ${currentDebate.category}`;
        
        const statusEl = document.getElementById('d-status');
        statusEl.textContent = currentDebate.status.toUpperCase();
        statusEl.className = `badge ${currentDebate.status}`;

        if (currentDebate.end_time) {
            if (currentDebate.status === 'active') {
                updateTimeDisplay();
                if (timeInterval) clearInterval(timeInterval);
                timeInterval = setInterval(updateTimeDisplay, 1000);
            } else {
                document.getElementById('d-time').textContent = `終了: ${formatDate(currentDebate.end_time)}`;
            }
        }

        if (currentDebate.status === 'finished' && currentDebate.result) {
            showResult(currentDebate.result);
        }

        updateUI();
    } catch (e) {
        console.error(e);
    }
}

function showResult(result) {
    const resEl = document.getElementById('result-presentation');
    if (!resEl) return;
    resEl.classList.remove('hidden');
    resEl.style.animation = 'none';
    // Force reflow to restart animation
    void resEl.offsetWidth;
    resEl.style.animation = 'popIn 0.5s ease-out';

    const isParticipant = currentUser && currentDebate &&
        (currentUser.id === currentDebate.user1_id || currentUser.id === currentDebate.user2_id);
    const isA = currentUser && currentDebate && currentUser.id === currentDebate.user1_id;

    let text = '';
    let color = '';
    let bg = '';
    let border = '';

    if (result === 'A_win') {
        color = 'var(--accent-a)';
        bg = 'rgba(76, 175, 80, 0.1)';
        border = '2px solid var(--accent-a)';
        if (isParticipant) {
            text = isA ? '🏆 Win' : '😞 Lose';
        } else {
            text = '🏆 Winner A';
        }
    } else if (result === 'B_win') {
        color = 'var(--accent-b)';
        bg = 'rgba(33, 150, 243, 0.1)';
        border = '2px solid var(--accent-b)';
        if (isParticipant) {
            text = isA ? '😞 Lose' : '🏆 Win';
        } else {
            text = '🏆 Winner B';
        }
    } else {
        color = 'var(--text-primary)';
        bg = 'var(--secondary-bg)';
        border = '2px solid var(--text-secondary)';
        text = '🤝 Draw';
    }

    resEl.textContent = text;
    resEl.style.color = color;
    resEl.style.backgroundColor = bg;
    resEl.style.border = border;
}

function updateVoteBar(votesA, votesB, votesTruce = 0) {
    document.getElementById('vote-count-a').textContent = `(${votesA})`;
    document.getElementById('vote-count-b').textContent = `(${votesB})`;
    const truceEl = document.getElementById('vote-count-truce');
    if (truceEl) truceEl.textContent = `(${votesTruce})`;
    
    const total = votesA + votesB;
    const barA = document.getElementById('vote-bar-a');
    const barB = document.getElementById('vote-bar-b');
    
    if (total === 0) {
        barA.style.width = '50%';
        barB.style.width = '50%';
    } else {
        barA.style.width = `${(votesA / total) * 100}%`;
        barB.style.width = `${(votesB / total) * 100}%`;
    }
}

async function loadVotes() {
    if (currentDebate?.status !== 'active' && currentDebate?.status !== 'finished') return;
    try {
        const res = await fetch(`/api/debates/${debateId}/votes`);
        if (res.ok) {
            const votes = await res.json();
            updateVoteBar(votes.A, votes.B, votes.Truce);
        }
    } catch (e) {
        console.error(e);
    }
}

function updateUI() {
    if (!currentUser || !currentDebate) return;

    const isParticipant = currentUser.id === currentDebate.user1_id || currentUser.id === currentDebate.user2_id;
    const isWaiting = currentDebate.status === 'waiting';
    const isActive = currentDebate.status === 'active';

    // Join button logic
    const joinSection = document.getElementById('join-section');
    if (isWaiting && !isParticipant) {
        joinSection.classList.remove('hidden');
    } else {
        joinSection.classList.add('hidden');
    }

    // Post section logic
    const postSection = document.getElementById('post-section');
    if (isActive && isParticipant) {
        postSection.classList.remove('hidden');
    } else {
        postSection.classList.add('hidden');
    }

    // Vote section logic
    const voteSection = document.getElementById('vote-section');
    if (isActive || currentDebate.status === 'finished') {
        voteSection.classList.remove('hidden');
        const voteBtns = voteSection.querySelectorAll('button');
        if (isParticipant) {
            voteBtns.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                btn.title = '話者は投票できません';
            });
        }
    } else {
        voteSection.classList.add('hidden');
    }

    // Admin panel
    if (currentUser?.username === 'lake666486') {
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel) {
            adminPanel.classList.remove('hidden');
            adminPanel.style.display = 'flex';
        }
    }
}

async function adminTime(change) {
    try {
        await fetch(`/api/debates/${debateId}/time`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ change })
        });
    } catch (e) {
        alert('ネットワークエラー');
    }
}

async function adminDeleteDebate() {
    if (!confirm('この討論を完全に削除してもよろしいですか？')) return;
    try {
        const res = await fetch(`/api/debates/${debateId}`, { method: 'DELETE' });
        if (res.ok) window.location.href = '/';
    } catch (e) {
        alert('ネットワークエラー');
    }
}

async function adminDeletePost(postId) {
    if (!confirm('この投稿を削除しますか？')) return;
    try {
        await fetch(`/api/debates/${debateId}/posts/${postId}`, { method: 'DELETE' });
    } catch (e) {
        alert('ネットワークエラー');
    }
}

async function joinDebate() {
    try {
        const res = await fetch(`/api/debates/${debateId}/join`, { method: 'POST' });
        if (res.ok) {
            location.reload();
        } else {
            const data = await res.json();
            alert(data.error || '参加に失敗しました');
        }
    } catch (e) {
        alert('ネットワークエラー');
    }
}

async function vote(target) {
    try {
        const res = await fetch(`/api/debates/${debateId}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voteTarget: target })
        });
        if (res.ok) {
            loadVotes();
        } else {
            const data = await res.json();
            alert(data.error || '投票に失敗しました');
        }
    } catch (e) {
        alert('ネットワークエラー');
    }
}

async function reportPost(postId) {
    if (!confirm('この投稿を通報してもよろしいですか？')) return;
    try {
        const res = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ debateId, postId, reason: '不適切なコンテンツ' })
        });
        if (res.ok) {
            alert('通報しました');
            loadPosts();
        } else {
            const data = await res.json();
            alert(data.error || '通報に失敗しました');
        }
    } catch (e) {
        alert('ネットワークエラー');
    }
}

function renderPostHtml(post) {
    let alignClass = 'post-unknown';
    if (post.author === 'A') alignClass = 'post-a';
    if (post.author === 'B') alignClass = 'post-b';

    return `
        <div class="post ${alignClass}">
            <div class="post-meta">
                <span>ユーザー ${post.author} • ${formatDate(post.created_at)}</span>
                <div>
                    ${currentUser && !post.is_hidden ? `<button class="report-btn" onclick="reportPost(${post.id})">通報</button>` : ''}
                    ${currentUser?.username === 'lake666486' ? `<button class="report-btn" style="color: var(--danger-color); margin-left: 0.5rem;" onclick="adminDeletePost(${post.id})">削除</button>` : ''}
                </div>
            </div>
            <div class="post-bubble">
                <div class="post-content" style="${post.is_hidden ? 'font-style: italic; opacity: 0.7;' : ''}">${post.is_hidden ? 'この投稿は通報により非表示になりました。' : escapeHTML(post.content)}</div>
            </div>
        </div>
    `;
}

function appendPost(post) {
    const timeline = document.getElementById('timeline');
    if (timeline.innerHTML.includes('まだ投稿がありません。') || timeline.innerHTML.includes('投稿を読み込み中...')) {
        timeline.innerHTML = '';
    }
    timeline.insertAdjacentHTML('beforeend', renderPostHtml(post));
    timeline.scrollTop = timeline.scrollHeight;
}

async function loadPosts() {
    try {
        const res = await fetch(`/api/debates/${debateId}/posts`);
        if (!res.ok) return;
        const posts = await res.json();
        
        const timeline = document.getElementById('timeline');
        
        if (posts.length === 0) {
            timeline.innerHTML = '<div style="text-align: center; color: var(--text-secondary); margin-top: 2rem;">まだ投稿がありません。</div>';
            return;
        }

        timeline.innerHTML = posts.map(renderPostHtml).join('');
        timeline.scrollTop = timeline.scrollHeight;
    } catch (e) {
        console.error('投稿の読み込みに失敗しました', e);
    }
}

document.getElementById('post-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('post-content').value;
    const errorEl = document.getElementById('post-error');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    errorEl.textContent = '';
    submitBtn.disabled = true;

    try {
        const res = await fetch(`/api/debates/${debateId}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        const data = await res.json();

        if (res.ok) {
            document.getElementById('post-content').value = '';
            // socket.io event handles appending the post for all users, including sender
        } else {
            errorEl.textContent = data.error || '投稿に失敗しました';
        }
    } catch (err) {
        errorEl.textContent = 'ネットワークエラー';
    } finally {
        submitBtn.disabled = false;
    }
});

document.getElementById('btn-join')?.addEventListener('click', joinDebate);

document.addEventListener('DOMContentLoaded', async () => {
    if (!debateId) {
        window.location.href = '/';
        return;
    }
    
    await checkAuth();
    await loadDebateDetails();
    await loadVotes();
    await loadPosts();

    // Socket.io for real-time updates
    if (socket && currentDebate?.status === 'active') {
        socket.emit('join_debate', debateId);
        
        socket.on('new_post', (post) => {
            appendPost(post);
        });

        socket.on('vote_update', (votes) => {
            updateVoteBar(votes.A, votes.B, votes.Truce);
        });

        socket.on('viewer_count', (count) => {
            document.getElementById('d-viewers').textContent = `閲覧者数: ${count}人`;
        });

        socket.on('debate_finished', (data) => {
            currentDebate.status = 'finished';
            currentDebate.result = data.result;
            const statusEl = document.getElementById('d-status');
            if (statusEl) {
                statusEl.textContent = 'FINISHED';
                statusEl.className = 'badge finished';
            }
            updateUI();
            showResult(data.result);
        });

        socket.on('post_hidden', (data) => {
            // Reload posts to reflect hidden status accurately
            loadPosts();
        });

        socket.on('post_deleted', (postId) => {
            loadPosts();
        });
        
        socket.on('debate_deleted', () => {
            alert('この討論は管理者によって削除されました。');
            window.location.href = '/';
        });

        socket.on('time_updated', (newTimeStr) => {
            currentDebate.end_time = newTimeStr;
            updateTimeDisplay();
        });

        socket.on('debate_started', () => {
            location.reload();
        });
    } else if (socket && currentDebate?.status === 'waiting') {
        socket.emit('join_debate', debateId);
        socket.on('debate_started', () => {
            location.reload();
        });
    }
});
