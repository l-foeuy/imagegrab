// ============================================================
// main.js —— 图提取 ImageGrab 官网交互脚本
//
// 功能：
//   1. 滚动进入视口时元素淡入上移动画（IntersectionObserver）
//   2. 导航栏滚动吸顶 + 当前区块高亮（滚动监听）
//   3. 移动端汉堡菜单展开 / 收起
// ============================================================

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.getElementById('navbar');
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  const links = Array.from(document.querySelectorAll('.nav-link'));

  // ---------- 1. 淡入上移动画（IntersectionObserver） ----------
  const revealEls = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); // 动画只触发一次
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach((el) => observer.observe(el));

  // ---------- 2. 导航栏吸顶 + 区块高亮 ----------
  const sections = Array.from(
    document.querySelectorAll('section[id], footer[id]')
  );

  // 根据当前滚动位置高亮对应导航链接
  function highlightNav() {
    const scrollPos = window.scrollY + 100;
    let currentId = null;
    sections.forEach((sec) => {
      if (sec.offsetTop <= scrollPos) currentId = sec.id;
    });
    links.forEach((link) => {
      const target = link.getAttribute('href').slice(1);
      link.classList.toggle('active', target === currentId);
    });
  }

  function onScroll() {
    // 滚动超过阈值时给导航栏加毛玻璃背景
    navbar.classList.toggle('scrolled', window.scrollY > 10);
    highlightNav();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // 初始执行一次

  // ---------- 3. 移动端汉堡菜单 ----------
  menuToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    menuToggle.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  // 点击导航链接后关闭菜单（移动端）
  links.forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuToggle.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
});
