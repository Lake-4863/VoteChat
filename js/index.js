async function loadDebates(status = '') {
    // Update active tab styles
    document.querySelectorAll('[id^="tab-"]').forEach(el => {
        el.className = 'btn btn-secondary';
    });
    const activeTab = document.getElementById(status ? `tab-${status}` : 'tab-all');
    if (activeTab) activeTab.className = 'btn btn-primary';

    const container = document.getElementById('debates-container');
    container.innerHTML = '<div style="text-align: center; color: var(--text-secondary);">読み込み中...</div>';

    try {
        const url = status ? `/api/debates?status=${status}` : '/api/debates';
        const res = await fetch(url);
        const debates = await res.json();

        if (debates.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-secondary);">討論が見つかりません。</div>';
            return;
        }

        container.innerHTML = debates.map(debate => `
            <div class="debate-card" onclick="location.href='/debate.html?id=${debate.id}'">
                <div class="debate-card-header">
                    <span class="badge ${debate.status}">${debate.status.toUpperCase()}</span>
                    <span style="font-size: 0.85rem; color: var(--text-secondary);">${formatDate(debate.created_at)}</span>
                </div>
                <h3 class="debate-title">${escapeHTML(debate.title)}</h3>
                <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">カテゴリ: ${escapeHTML(debate.category)}</div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                    <span>作成者: A (${escapeHTML(debate.user1_name || '匿名')})</span>
                    ${debate.user2_name ? `<span>対戦相手: B (${escapeHTML(debate.user2_name)})</span>` : '<span>対戦相手を待っています...</span>'}
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<div style="text-align: center; color: var(--danger-color);">討論の読み込みに失敗しました。</div>';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadDebates();
});
