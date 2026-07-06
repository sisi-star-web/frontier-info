const state = {
  tab: 'daily',
  manifest: null,
  currentData: null,
  favorites: JSON.parse(localStorage.getItem('fi_favorites') || '[]')
};

const el = {
  tabs: document.querySelectorAll('.tab-btn'),
  pageTitle: document.getElementById('pageTitle'),
  pageGreeting: document.getElementById('pageGreeting'),
  pageDate: document.getElementById('pageDate'),
  dateSelect: document.getElementById('dateSelect'),
  content: document.getElementById('content'),
  actionItem: document.getElementById('actionItem'),
  actionText: document.getElementById('actionText'),
  modal: document.getElementById('detailModal'),
  modalClose: document.getElementById('modalClose'),
  modalTag: document.getElementById('modalTag'),
  modalTitle: document.getElementById('modalTitle'),
  modalSummary: document.getElementById('modalSummary'),
  modalValue: document.getElementById('modalValue'),
  modalLink: document.getElementById('modalLink')
};

function saveFavorites() {
  localStorage.setItem('fi_favorites', JSON.stringify(state.favorites));
}

function favKey(item) {
  return item.url;
}

function isFav(item) {
  return state.favorites.some(f => f.url === favKey(item));
}

function toggleFav(item) {
  const idx = state.favorites.findIndex(f => f.url === favKey(item));
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
  } else {
    state.favorites.push(item);
  }
  saveFavorites();
}

async function loadManifest() {
  const res = await fetch('data/manifest.json');
  state.manifest = await res.json();
}

async function loadData(tab, file) {
  const res = await fetch(file);
  return res.json();
}

function renderDateSelect() {
  const list = state.manifest[state.tab] || [];
  el.dateSelect.innerHTML = list.map(d => `<option value="${d.file}">${d.date}</option>`).join('');
  el.dateSelect.onchange = () => {
    const file = el.dateSelect.value;
    loadData(state.tab, file).then(renderContent);
  };
}

function renderContent(data) {
  state.currentData = data;
  el.pageTitle.textContent = data.title;
  el.pageGreeting.textContent = data.greeting || '';
  el.pageDate.textContent = data.date;

  el.content.innerHTML = '';
  (data.sections || []).forEach(sec => {
    const block = document.createElement('div');
    block.className = 'category-block';
    const grid = sec.items.map(item => cardHtml(item)).join('');
    block.innerHTML = `<h2>${sec.category}</h2><div class="card-grid">${grid}</div>`;
    el.content.appendChild(block);
  });

  bindCardEvents();

  if (data.action_item) {
    el.actionItem.style.display = 'block';
    el.actionText.textContent = data.action_item;
  } else {
    el.actionItem.style.display = 'none';
  }
}

function cardHtml(item) {
  const fav = isFav(item) ? 'active' : '';
  const favIcon = isFav(item) ? '★' : '☆';
  return `
    <div class="card" data-url="${encodeURIComponent(item.url)}"
         data-title="${encodeURIComponent(item.title)}"
         data-summary="${encodeURIComponent(item.summary)}"
         data-tag="${encodeURIComponent(item.tag)}"
         data-value="${encodeURIComponent(item.value || '')}">
      <div class="card-top">
        <p class="card-title">${item.title}</p>
        <span class="card-tag">${item.tag}</span>
      </div>
      <p class="card-summary">${item.summary}</p>
      <div class="card-bottom">
        <span class="card-value">${item.value || ''}</span>
        <button class="fav-btn ${fav}" data-favurl="${encodeURIComponent(item.url)}">${favIcon}</button>
      </div>
    </div>
  `;
}

function findItemByUrl(url) {
  if (state.tab === 'favorites') {
    return state.favorites.find(f => f.url === url);
  }
  for (const sec of (state.currentData.sections || [])) {
    const found = sec.items.find(i => i.url === url);
    if (found) return found;
  }
  return null;
}

function bindCardEvents() {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('fav-btn')) return;
      openModal({
        title: decodeURIComponent(card.dataset.title),
        summary: decodeURIComponent(card.dataset.summary),
        tag: decodeURIComponent(card.dataset.tag),
        value: decodeURIComponent(card.dataset.value),
        url: decodeURIComponent(card.dataset.url)
      });
    });
  });

  document.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = decodeURIComponent(btn.dataset.favurl);
      const item = findItemByUrl(url);
      if (item) {
        toggleFav(item);
        if (state.tab === 'favorites') {
          renderFavorites();
        } else {
          btn.classList.toggle('active');
          btn.textContent = btn.classList.contains('active') ? '★' : '☆';
        }
      }
    });
  });
}

function openModal(item) {
  el.modalTag.textContent = item.tag;
  el.modalTitle.textContent = item.title;
  el.modalSummary.textContent = item.summary;
  el.modalValue.textContent = item.value ? `对你的价值：${item.value}` : '';
  el.modalLink.href = item.url;
  el.modal.style.display = 'flex';
}

el.modalClose.addEventListener('click', () => { el.modal.style.display = 'none'; });
el.modal.addEventListener('click', (e) => {
  if (e.target === el.modal) el.modal.style.display = 'none';
});

function renderFavorites() {
  el.pageTitle.textContent = '我的收藏';
  el.pageGreeting.textContent = '你收藏的重点内容都在这里，方便随时回顾和整理成短文素材。';
  el.pageDate.textContent = `共 ${state.favorites.length} 条`;
  el.dateSelect.style.display = 'none';
  el.actionItem.style.display = 'none';

  if (state.favorites.length === 0) {
    el.content.innerHTML = '<div class="empty-state">还没有收藏内容，点击卡片右下角的星标即可收藏</div>';
    return;
  }

  const grid = state.favorites.map(item => cardHtml(item)).join('');
  el.content.innerHTML = `<div class="card-grid">${grid}</div>`;
  bindCardEvents();
}

async function switchTab(tab) {
  state.tab = tab;
  el.tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

  if (tab === 'favorites') {
    renderFavorites();
    return;
  }

  el.dateSelect.style.display = 'inline-block';
  renderDateSelect();
  const list = state.manifest[tab] || [];
  if (list.length === 0) {
    el.content.innerHTML = '<div class="empty-state">暂无内容</div>';
    return;
  }
  const data = await loadData(tab, list[0].file);
  renderContent(data);
}

el.tabs.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

(async function init() {
  await loadManifest();
  switchTab('daily');
})();
