// ============================================================
// content.js —— 内容脚本（注入到电商商品详情页）
//
// 职责：
//   1. 在详情页右下角注入一个「获取图片」悬浮按钮
//   2. 点击后扫描页面所有商品相关图片（<img>、srcset、懒加载属性、
//      背景图 background-image 等）
//   3. 过滤图标 / logo / 占位图 / 小图，补全绝对地址、去重
//   4. 通过 chrome.runtime.sendMessage 把图片列表发送给后台
// ============================================================

(() => {
  'use strict';

  // 最小图片尺寸（宽或高），小于该值的图片视为小图 / 占位图，直接过滤
  const MIN_SIZE = 100;

  // 命中以下关键词的图片，视为图标 / logo / 占位图，直接过滤
  const EXCLUDE_KEYWORDS = [
    'logo', 'icon', 'avatar', 'placeholder', 'loading', 'blank',
    'sprite', 'qrcode', 'qr_', 'wechat', 'share', 'like', 'cart',
    'btn', 'button', 'close', 'arrow', 'banner', 'favicon',
    'star', 'badge', 'corner', 'loading.gif'
  ];

  // ---------- 工具函数 ----------

  // 补全相对路径为绝对 URL；过滤 data: 等无效地址
  function toAbsoluteUrl(raw) {
    if (!raw) return null;
    const url = String(raw).trim();
    if (!url || url.startsWith('data:') || url.startsWith('javascript:')) return null;
    try {
      return new URL(url, location.href).href;
    } catch (e) {
      return null;
    }
  }

  // 解析 srcset 属性，返回其中的 URL 列表（取每个候选的地址部分）
  function parseSrcset(srcset) {
    const urls = [];
    if (!srcset) return urls;
    srcset.split(',').forEach((part) => {
      const seg = part.trim().split(/\s+/)[0];
      if (seg) urls.push(seg);
    });
    return urls;
  }

  // 判断当前页面是否为商品详情页
  function isDetailPage() {
    const url = location.href;
    const patterns = [
      /item\.htm/i,          // 淘宝 / 天猫商品页
      /item\.taobao\.com/i,
      /detail\.tmall\.com/i,
      /item\.jd\.com/i,      // 京东商品页
      /\/item\/\d+/i,
      /goods\.html/i,        // 拼多多商品页
      /goods_detail/i,
      /detail/i              // 兜底
    ];
    return patterns.some((p) => p.test(url));
  }

  // 非商品详情页不注入按钮
  if (!isDetailPage()) return;

  // ---------- 收集候选图片地址 ----------

  function collectCandidates() {
    const seen = new Set();
    const candidates = [];

    const add = (raw) => {
      const abs = toAbsoluteUrl(raw);
      if (!abs || seen.has(abs)) return;
      seen.add(abs);
      candidates.push(abs);
    };

    // 1. <img> 标签：src / currentSrc / srcset / 常见懒加载属性
    document.querySelectorAll('img').forEach((img) => {
      const sources = [
        img.currentSrc,
        img.getAttribute('src'),
        img.getAttribute('data-src'),
        img.getAttribute('data-lazy-src'),
        img.getAttribute('data-lazyload'),
        img.getAttribute('data-original'),
        img.getAttribute('data-echo'),
        img.getAttribute('data-ks-lazyload'),
        img.getAttribute('data-lazy')
      ];
      sources.concat(
        parseSrcset(img.getAttribute('srcset')),
        parseSrcset(img.getAttribute('data-srcset'))
      ).forEach(add);
    });

    // 2. <source> 标签（<picture> 元素内的响应式图片源）
    document.querySelectorAll('source').forEach((s) => {
      add(s.getAttribute('src'));
      parseSrcset(s.getAttribute('srcset')).forEach(add);
    });

    // 3. 背景图 background-image：内联样式 + 计算样式（兼容 CSS 类设置的背景）
    const bgRe = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
    document.querySelectorAll('*').forEach((el) => {
      const collect = (css) => {
        if (!css) return;
        let m;
        bgRe.lastIndex = 0;
        while ((m = bgRe.exec(css))) add(m[2]);
      };
      // 内联样式
      collect(el.getAttribute('style'));
      // 计算样式（可能覆盖多张背景图，用于 CSS 类设置的背景）
      try {
        const cs = getComputedStyle(el);
        if (cs && cs.backgroundImage && cs.backgroundImage !== 'none') {
          collect(cs.backgroundImage);
        }
      } catch (e) { /* 忽略 */ }
    });

    return candidates;
  }

  // ---------- 获取图片实际尺寸 ----------

  // 通过新建 Image 加载图片以读取真实尺寸（跨域图片也能读到 naturalWidth/Height）
  function loadImageSize(url) {
    return new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => {
        img.onload = img.onerror = null;
        resolve({ url, width: 0, height: 0 });
      }, 8000);
      img.onload = () => {
        clearTimeout(timer);
        resolve({ url, width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve({ url, width: 0, height: 0 });
      };
      img.src = url;
    });
  }

  // ---------- 主流程：提取并过滤图片 ----------

  async function gatherImages() {
    const candidates = collectCandidates();
    if (!candidates.length) return [];

    // 并行读取每张图片的尺寸
    const sized = await Promise.allSettled(candidates.map(loadImageSize));

    const results = [];
    sized.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      const { url, width, height } = r.value;
      if (!width || !height) return;                  // 加载失败
      if (width === 1 && height === 1) return;        // 1x1 像素图
      if (width < MIN_SIZE && height < MIN_SIZE) return; // 小图过滤

      const lower = url.toLowerCase();
      if (EXCLUDE_KEYWORDS.some((k) => lower.includes(k))) return; // 图标 / logo 过滤

      results.push({ url, width, height });
    });

    return results;
  }

  // ---------- 注入悬浮按钮 ----------

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'image-grab-btn';
  btn.textContent = '获取图片';
  document.body.appendChild(btn);

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = '提取中…';

    try {
      const images = await gatherImages();
      if (!images || !images.length) {
        showToast('未找到商品图片');
        return;
      }

      // 把图片列表发送给后台，由后台打开画廊页
      const resp = await chrome.runtime.sendMessage({
        type: 'GATHER_IMAGES',
        images
      });
      if (resp && resp.ok) {
        showToast(`已提取 ${images.length} 张图片`);
      }
    } catch (e) {
      // 扩展可能被重新加载，提示用户刷新页面
      showToast('发送失败，请刷新页面后重试');
      console.error('[图提取] 提取失败：', e);
    } finally {
      btn.disabled = false;
      btn.textContent = '获取图片';
    }
  });

  // ---------- 轻提示 ----------

  function showToast(text) {
    let toast = document.querySelector('.image-grab-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'image-grab-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
  }
})();
