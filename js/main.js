// main.js - Common functions and Auth state management

let currentUser = null;

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            currentUser = await res.json();
            updateNav(true);
            return currentUser;
        } else {
            currentUser = null;
            updateNav(false);
            return null;
        }
    } catch (e) {
        console.error('Failed to check auth', e);
        updateNav(false);
        return null;
    }
}

function updateNav(isAuthenticated) {
    const authLinks = document.getElementById('auth-links');
    if (!authLinks) return;

    let html = `
        <button class="btn btn-secondary" onclick="toggleTheme()" style="margin-right: 1rem;">テーマ切替</button>
    `;

    if (isAuthenticated) {
        html += `
            <span style="margin-right: 1rem; color: var(--text-secondary);">@${currentUser.username}</span>
            <a href="/create.html" class="btn btn-primary" style="margin-right: 0.5rem;">討論作成</a>
            <button class="btn btn-secondary" onclick="logout()">ログアウト</button>
        `;
    } else {
        html += `
            <a href="/auth.html" class="btn btn-primary">ログイン / 新規登録</a>
        `;
    }
    authLinks.innerHTML = html;
}

async function logout() {
    try {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (res.ok) {
            window.location.href = '/';
        }
    } catch (e) {
        console.error('Logout failed', e);
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function formatDate(dateString) {
    const d = new Date(dateString + 'Z');
    if (isNaN(d)) return '';
    return new Intl.DateTimeFormat('ja-JP', {
        month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric'
    }).format(d);
}

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark'; // Default to dark for mechanical feel
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

initTheme();
