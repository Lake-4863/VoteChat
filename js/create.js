document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) {
        window.location.href = '/auth.html';
    }
});

document.getElementById('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('title').value;
    const category = document.getElementById('category').value;
    const errorEl = document.getElementById('create-error');
    errorEl.textContent = '';

    try {
        const res = await fetch('/api/debates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category })
        });
        const data = await res.json();

        if (res.ok) {
            window.location.href = `/debate.html?id=${data.debateId}`;
        } else {
            errorEl.textContent = data.error || '討論の作成に失敗しました';
        }
    } catch (e) {
        errorEl.textContent = 'ネットワークエラー';
    }
});
