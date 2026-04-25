function toggleAuth(view) {
    if (view === 'login') {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('register-section').classList.add('hidden');
    } else {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('register-section').classList.remove('hidden');
    }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            window.location.href = '/';
        } else {
            errorEl.textContent = data.error || 'ログインに失敗しました';
        }
    } catch (e) {
        errorEl.textContent = 'ネットワークエラー';
    }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const errorEl = document.getElementById('reg-error');
    errorEl.textContent = '';

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            // Auto login
            await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            window.location.href = '/';
        } else {
            errorEl.textContent = data.error || '登録に失敗しました';
        }
    } catch (e) {
        errorEl.textContent = 'ネットワークエラー';
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (user) {
        window.location.href = '/'; // Redirect if already logged in
    }
});
