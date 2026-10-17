// ============================================================
// background.js —— Service Worker（后台服务）
//
// 职责：
//   1. 接收内容脚本提取的图片列表，存入 storage 并打开画廊页
//   2. 处理 PNG 转换与批量下载（fetch + createImageBitmap + OffscreenCanvas）
//   3. 向画廊页广播下载进度
// ============================================================

'use strict';

// 处理来自内容脚本 / 画廊页的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GATHER_IMAGES') {
    handleGather(message.images)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // 保持消息通道，等待异步结果
  }

  if (message.type === 'DOWNLOAD_IMAGES') {
    // 下载是长任务，立即响应；进度通过 sendMessage 广播给画廊页
    handleDownload(message.images, message.token)
      .catch((err) => console.error('[图提取] 下载失败：', err));
    sendResponse({ ok: true });
    return false;
  }
});

// 打开画廊页
async function handleGather(images) {
  await chrome.storage.local.set({ pendingImages: images });
  await chrome.tabs.create({ url: chrome.runtime.getURL('gallery.html') });
}

// ---------- 图片下载与 PNG 转换 ----------

// 拉取图片并统一转换为 PNG Blob
async function fetchAndConvertToPng(url) {
  const resp = await fetch(url, { credentials: 'include' });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);

  const blob = await resp.blob();
  // 已是 PNG 时直接返回，避免无谓的重复转换
  if (blob.type === 'image/png') return blob;

  // 通过 createImageBitmap 解码（在 service worker 中可用）
  const bitmap = await createImageBitmap(blob);

  // 用 OffscreenCanvas 重绘并导出 PNG
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  return canvas.convertToBlob({ type: 'image/png' });
}

// Blob -> base64 Data URL（供 chrome.downloads.download 使用）
async function blobToDataUrl(blob) {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return 'data:image/png;base64,' + btoa(binary);
}

// 序号补零：1 -> 001
function pad(num, len = 3) {
  return String(num).padStart(len, '0');
}

// 批量下载
async function handleDownload(images, token) {
  const total = images.length;
  const report = (payload) => {
    // 广播进度给画廊页（只有画廊页在监听）
    try {
      chrome.runtime.sendMessage({ type: 'DOWNLOAD_PROGRESS', token, ...payload });
    } catch (e) { /* 忽略 */ }
  };

  report({ phase: 'start', total });

  let success = 0;
  const results = [];

  for (let i = 0; i < total; i++) {
    const item = images[i];
    const idx = i + 1;
    try {
      report({ phase: 'progress', current: idx, total, url: item.url });

      const png = await fetchAndConvertToPng(item.url);
      const dataUrl = await blobToDataUrl(png);
      const filename = `商品图_${pad(idx)}.png`;

      await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
      success++;
      results.push({ url: item.url, ok: true, filename });
    } catch (err) {
      results.push({ url: item.url, ok: false, error: String(err) });
    }
  }

  report({ phase: 'done', total, success, fail: total - success, results });
}
