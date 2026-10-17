# 图提取 ImageGrab · 官方宣传网站

纯静态官网，无需构建工具、无需后端，双击 `index.html` 即可在浏览器中打开。

## 文件结构

```
docs/
├── index.html     # 首页（产品介绍 + 核心功能 + 安装步骤）
├── css/
│   └── style.css  # 全站样式
├── js/
│   └── main.js    # 交互脚本（滚动动画、导航高亮、移动端菜单）
└── assets/        # 预留（当前使用内联 SVG / CSS 绘制，无需外部图片）
```

## 如何打开预览

直接双击 `docs/index.html` 即可；或在 `docs` 目录下启动任意静态服务器：

```bash
cd docs
python -m http.server 8000
# 访问 http://localhost:8000
```

## 如何修改主色调

所有颜色、间距、圆角都通过 CSS 变量统一定义在 `css/style.css` 的 `:root` 中。只需修改以下两个变量即可切换主色调：

```css
:root {
  --primary: #4f8cff;   /* 主色（蓝） */
  --primary-2: #7c5cff; /* 辅色（紫） */
}
```

改为你喜欢的任意颜色即可（例如绿色系：`--primary: #10b981; --primary-2: #059669;`）。

## 如何修改文案

页面所有文字都在 `index.html` 中，直接编辑对应文案即可。核心位置：

- 产品名：导航栏 Logo 与 Hero 标题
- 一句话价值：Hero 区 `<h1>`
- 副标题：Hero 区 `.hero-sub`
- 功能卡片：`#features` 区块中的各张 `.feature-card`
- 安装步骤：`#install` 区块中的 `.step`
