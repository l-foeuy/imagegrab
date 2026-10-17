// ============================================================
// gallery.js —— 画廊页脚本
//
// 职责：
//   1. 从 storage 读取内容脚本提取的图片列表并网格化展示
//   2. 支持全选 / 反选 / 勾选 / 已选数量显示
//   3. 点击「下载选中」把选中图片交给后台批量下载，并展示进度
// ============================================================

'use strict';

const grid = document.getElementById('grid');
const empty = document.getElementById('empty');
const selectAllBtn = document.getElementById('selectAllBtn');
const invertBtn = document.getElementById('invertBtn');
const countLabel = document.getElementById('countLabel');
const downloadBtn = document.getElementById('downloadBtn');
const progressWrap = document.getElementById('progressWrap');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

const state = {
  images: [],          // 图片列表 [{ url, width, height }]
  selected: new Set(), // 已选中的 url
  token: null,         // 本次下载任务的标识
  downloading: false
};

// ---------- 初始化 ----------

async function init() {
  try {
    const data = await chrome.storage.local.get('pendingImages');
    const images = data.pendingImages;
    if (Array.isArray(images) && images.length) {
      state.images = images;
      // 默认全部选中
      images.forEach((img) => state.selected.add(img.url));
      renderGrid();
    } else {
      showEmpty();
    }
    updateToolbar();
  } catch (e) {
    showEmpty();
  }
}

function showEmpty() {
  empty.hidden = false;
  grid.hidden = true;
}

// ---------- 渲染网格 ----------

function renderGrid() {
  grid.hidden = false;
  grid.innerHTML = '';

  state.images.forEach((img, index) => {
    const card = document.createElement('figure');
    card.className = 'card';
    card.dataset.url = img.url;

    // 复选框
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'card-check';
    checkbox.checked = state.selected.has(img.url);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selected.add(img.url);
      else state.selected.delete(img.url);
      card.classList.toggle('selected', checkbox.checked);
      updateToolbar();
    });

    // 缩略图
    const imgEl = document.createElement('img');
    imgEl.className = 'card-img';
    imgEl.src = img.url;
    imgEl.loading = 'lazy';
    imgEl.alt = `商品图 ${index + 1}`;

    // 尺寸信息
    const figcaption = document.createElement('figcaption');
    figcaption.className = 'card-meta';
    const idx = document.createElement('span');
    idx.className = 'card-idx';
    idx.textContent = '#' + String(index + 1).padStart(3, '0');
    const size = document.createElement('span');
    size.className = 'card-size';
    size.textContent = `${img.width || '?'} × ${img.height || '?'}`;
    figcaption.appendChild(idx);
    figcaption.appendChild(size);

    card.appendChild(checkbox);
    card.appendChild(imgEl);
    card.appendChild(figcaption);

    // 点击卡片切换勾选（点复选框时避免重复触发）
    card.addEventListener('click', (e) => {
      if (e.target === checkbox) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    });

    card.classList.toggle('selected', checkbox.checked);
    grid.appendChild(card);
  });
}

// ---------- 工具栏状态 ----------

function updateToolbar() {
  const count = state.selected.size;
  countLabel.textContent = `已选 ${count} 张`;
  downloadBtn.disabled = count === 0 || state.downloading;
}

// ---------- 全选 / 反选 ----------

selectAllBtn.addEventListener('click', () => {
  state.images.forEach((img) => state.selected.add(img.url));
  syncChecks();
});

invertBtn.addEventListener('click', () => {
  state.images.forEach((img) => {
    if (state.selected.has(img.url)) state.selected.delete(img.url);
    else state.selected.add(img.url);
  });
  syncChecks();
});

function syncChecks() {
  grid.querySelectorAll('.card').forEach((card) => {
    const cb = card.querySelector('.card-check');
    cb.checked = state.selected.has(card.dataset.url);
    card.classList.toggle('selected', cb.checked);
  });
  updateToolbar();
}

// ---------- 下载 ----------

downloadBtn.addEventListener('click', async () => {
  if (state.downloading) return;
  const selected = state.images.filter((img) => state.selected.has(img.url));
  if (!selected.length) return;

  state.downloading = true;
  state.token = Date.now().toString();
  updateToolbar();

  // 显示进度条
  progressWrap.hidden = false;
  progressFill.style.width = '0%';
  progressText.textContent = '准备下载…';

  try {
    await chrome.runtime.sendMessage({
      type: 'DOWNLOAD_IMAGES',
      images: selected,
      token: state.token
    });
  } catch (e) {
    progressText.textContent = '下载失败：' + String(e);
    state.downloading = false;
    updateToolbar();
  }
});

// 监听后台广播的下载进度
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'DOWNLOAD_PROGRESS') return;
  if (msg.token !== state.token) return;

  if (msg.phase === 'start') {
    progressWrap.hidden = false;
    progressFill.style.width = '0%';
    progressText.textContent = `共 ${msg.total} 张，开始下载…`;
  } else if (msg.phase === 'progress') {
    const pct = Math.round((msg.current / msg.total) * 100);
    progressFill.style.width = pct + '%';
    progressText.textContent = `正在下载 ${msg.current} / ${msg.total}`;
  } else if (msg.phase === 'done') {
    progressFill.style.width = '100%';
    progressText.textContent = `下载完成：成功 ${msg.success} 张，失败 ${msg.fail} 张`;
    state.downloading = false;
    updateToolbar();
  }
});

init();
