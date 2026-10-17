# 图提取 ImageGrab · 电商图片下载插件

一键提取淘宝、京东、拼多多商家版商品详情页的所有商品图片，在新页面集中预览、勾选并批量下载为 PNG。

## 文件结构

```
extension/
├── manifest.json    # 扩展清单（Manifest V3）
├── content.js       # 注入「获取图片」按钮 + 提取图片
├── content.css      # 按钮样式
├── background.js    # Service Worker：消息转发 + PNG 转换 + 批量下载
├── gallery.html     # 新页面：图片预览与勾选下载
├── gallery.js       # 画廊页逻辑
├── gallery.css      # 画廊页样式
└── icons/           # 扩展图标（16 / 48 / 128）
```

## 安装步骤

1. 打开 Chrome，地址栏输入 `chrome://extensions` 并回车。
2. 打开页面右上角的「开发者模式」开关。
3. 点击「加载已解压的扩展程序」，选择本 `extension` 文件夹。
4. 安装完成后，工具栏会出现「图提取 ImageGrab」图标。

## 使用方法

1. 打开任意淘宝 / 天猫 / 京东 / 拼多多商家版的**商品详情页**。
2. 页面右下角会出现一个「获取图片」悬浮按钮。
3. 点击「获取图片」，插件会扫描页面所有商品图片，并自动打开一个新的预览页。
4. 在预览页中勾选（默认全选）需要下载的图片，支持「全选 / 反选」。
5. 点击「下载选中」，图片会统一转换为 PNG，并按 `商品图_001.png` 的编号规则保存到浏览器默认下载目录。

## 技术说明

- 支持提取 `<img>` 标签、`srcset`、`data-src` / `data-lazy-src` 等懒加载属性，以及 `background-image` 背景图。
- 自动过滤图标、logo、占位图、1×1 像素图及小于 100×100 的小图。
- 跨域图片在 Service Worker 中通过 `fetch + createImageBitmap + OffscreenCanvas` 统一转换为 PNG。
- 覆盖域名：`*.taobao.com`、`*.tmall.com`、`*.jd.com`、`*.pinduoduo.com`、`*.yangkeduo.com`。

## 常见问题

- **点击「获取图片」没反应**：请确认已开启「开发者模式」并正确加载本文件夹；如修改过代码，点击扩展卡片上的刷新按钮后，刷新商品页面重试。
- **下载被拦截**：首次批量下载时浏览器可能提示「下载多个文件」，选择「允许」即可。
