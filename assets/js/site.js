/* ============================================================
   付昕｜新作品集网站 · 交互
   依据 V3 §25 动态 / §26 时长 / §38 导航 / §39 Lightbox / §43 移动端 / §44 性能
   ============================================================ */
(function () {
  'use strict';
  window.__siteBuild = 'v8-v4batch2';   /* 构建标记：排查缓存用 */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var isMobile = function () { return window.innerWidth <= 720; };

  /* ── 1. 展开 / 收起（V3 §26：400–500ms；不强制收起）──
     用实测内容高度驱动 height 过渡，结束后置为 auto，
     这样展开区内的懒加载图片尺寸变化不会撑破或裁切内容。 */
  var timers = new WeakMap();
  function clearTimer(box) {
    var id = timers.get(box);
    if (id) { window.clearTimeout(id); timers.delete(box); }
  }
  function expand(box) {
    clearTimer(box);
    var h = box.scrollHeight;
    box.style.height = h + 'px';
    box.setAttribute('data-open', 'true');
    var settle = function () {
      /* 关键守卫：如果这期间已经被收起，就不要再回填 auto，否则会把收起撑回去 */
      if (box.getAttribute('data-open') !== 'true') return;
      box.style.height = 'auto';
    };
    var onEnd = function (e) {
      if (e && e.propertyName !== 'height') return;
      box.removeEventListener('transitionend', onEnd);
      clearTimer(box);
      settle();
    };
    box.addEventListener('transitionend', onEnd);
    timers.set(box, window.setTimeout(function () {
      box.removeEventListener('transitionend', onEnd);
      settle();
    }, 620));
  }
  function collapse(box) {
    clearTimer(box);
    box.style.height = box.scrollHeight + 'px';   /* 先固定当前高度 */
    box.getBoundingClientRect();                  /* 强制回流 */
    box.setAttribute('data-open', 'false');       /* 先改状态（守卫依赖它）*/
    box.style.height = '0px';
    /* 终态强制：离屏元素不产生帧时 transition 不会推进，
       这里保证"收起"这个结果无论如何都落到 0。 */
    timers.set(box, window.setTimeout(function () {
      if (box.getAttribute('data-open') !== 'true') box.style.height = '0px';
    }, 520));
  }
  function setOpen(box, open) {
    if (reduce.matches) {                     /* 降级：不做高度动画 */
      box.style.height = open ? 'auto' : '0px';
      box.setAttribute('data-open', open ? 'true' : 'false');
      return;
    }
    if (open) { expand(box); } else { collapse(box); }
  }
  document.querySelectorAll('.expand-toggle').forEach(function (btn) {
    var targetId = btn.getAttribute('aria-controls') || btn.getAttribute('data-collapse');
    var box = document.getElementById(targetId);
    if (!box) return;
    var isCollapse = btn.hasAttribute('data-collapse');
    var inExp = !!(btn.closest && btn.closest('#experience'));
    var labelOpen = inExp ? '收起经历 ↑' : '收起项目 ↑';
    var labelClose = inExp ? '展开经历 ↓' : '展开项目 ↓';
    btn.addEventListener('click', function () {
      var open = box.getAttribute('data-open') !== 'true';
      setOpen(box, open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (isCollapse) {
        btn.textContent = labelOpen;
        if (!open) {
          var host = btn.closest('section');
          if (host) host.scrollIntoView({ block: 'start' });
        }
      } else {
        btn.textContent = open ? labelOpen : labelClose;
      }
    });
  });

  /* ── 2. 滚动揭示（V3 §26：600–800ms）──
     用几何检测驱动，不依赖 IntersectionObserver 回调时机，
     脚本一旦跑起来就必然把可见内容显示出来。 */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  function checkReveal() {
    if (reduce.matches) {
      for (var k = 0; k < reveals.length; k++) reveals[k].classList.add('is-in');
      reveals.length = 0;
      return;
    }
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = reveals.length - 1; i >= 0; i--) {
      var el = reveals[i];
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.94 && r.bottom > -40) {
        el.classList.add('is-in');
        reveals.splice(i, 1);
      }
    }
  }
  var rTick = false;
  function onRevealScroll() {
    if (rTick) return;
    rTick = true;
    window.requestAnimationFrame(function () { rTick = false; checkReveal(); });
  }
  window.addEventListener('scroll', onRevealScroll, { passive: true });
  window.addEventListener('resize', onRevealScroll, { passive: true });
  window.addEventListener('load', checkReveal);
  checkReveal();
  window.setTimeout(checkReveal, 120);   /* 字体 / 图片落位后再判 */
  window.setTimeout(checkReveal, 700);

  /* ── 3. 图片淡入（V3 §26：400–600ms）+ 懒加载兜底 ── */
  document.querySelectorAll('img').forEach(function (img) {
    if (img.complete && img.naturalWidth > 0) { img.classList.add('is-loaded'); return; }
    img.addEventListener('load', function () { img.classList.add('is-loaded'); });
    img.addEventListener('error', function () { img.classList.add('is-loaded'); });
  });

  /* ── 4. 导航状态（V3 §38：下滚缩小 / 上滚恢复 / 当前章节橙点）── */
  var nav = document.getElementById('nav');
  var lastY = window.scrollY, ticking = false;
  var pbar = document.getElementById('pbar');
  function onScroll() {
    var y = window.scrollY;
    if (nav) nav.setAttribute('data-scrolled', y > 40 ? 'true' : 'false');
    if (pbar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      pbar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0).toFixed(4) + ')';
    }
    lastY = y; ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });

  var sections = ['top', 'work', 'experience', 'about'];
  var links = {};
  document.querySelectorAll('.nav__link').forEach(function (a) {
    var id = (a.getAttribute('href') || '').replace('#', '');
    if (sections.indexOf(id) > -1) links[id] = a;
  });
  if ('IntersectionObserver' in window) {
    var navIo = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].removeAttribute('aria-current'); });
        if (links[e.target.id]) links[e.target.id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) navIo.observe(el);
    });
  }

  /* ── 5. 能力卡：移动端用点击替代 Hover（V3 §43）── */
  document.querySelectorAll('.ability__card').forEach(function (card) {
    card.addEventListener('click', function () {
      if (!isMobile()) return;
      var on = card.getAttribute('data-peek') === 'on';
      document.querySelectorAll('.ability__card').forEach(function (c) { c.removeAttribute('data-peek'); });
      if (!on) card.setAttribute('data-peek', 'on');
    });
  });

  /* ── 6. Lightbox（V3 §39：深色、大图、Esc 关闭）── */
  var lb = document.getElementById('lb');
  if (lb) {
    var lbImg = lb.querySelector('.lb__img');
    var lbCap = lb.querySelector('.lb__cap');
    var lastFocus = null;
    function lbOpen(src, cap) {
      lbImg.src = src;
      lbCap.textContent = cap || '';
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      lastFocus = document.activeElement;
      lb.querySelector('.lb__close').focus();
    }
    function lbClose() {
      lb.hidden = true;
      lbImg.removeAttribute('src');
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    document.querySelectorAll('[data-lb]').forEach(function (el) {
      el.addEventListener('click', function () {
        lbOpen(el.getAttribute('data-lb'), el.getAttribute('data-lb-cap'));
      });
    });
    lb.querySelector('.lb__close').addEventListener('click', lbClose);
    lb.addEventListener('click', function (e) { if (e.target === lb) lbClose(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !lb.hidden) lbClose();
    });
  }

  /* ── 6. 背景动态：稀疏节点 + 连线 + 缓慢漂移（V3 §25）── */
  var cv = document.getElementById('bg');
  if (cv && !reduce.matches) {
    var ctx = cv.getContext('2d');
    /* 背景层是柔和的节点/连线，按 0.5 倍分辨率绘制再交给 CSS 拉伸：
       2560×1600 屏上把每帧 clearRect 从 920 万像素降到约 100 万，肉眼无差别。*/
    var dpr = Math.min(window.devicePixelRatio || 1, 1);
    var W = 0, H = 0, nodes = [], mouse = { x: -9999, y: -9999 };
    var COUNT_DESKTOP = 34, COUNT_MOBILE = 14, LINK = 190;

    function size() {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = isMobile() ? COUNT_MOBILE : COUNT_DESKTOP;
      nodes = [];
      for (var i = 0; i < n; i++) {
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.16,      /* 缓慢漂移，不用高速 */
          vy: (Math.random() - 0.5) * 0.16,
          r: 1.2 + Math.random() * 1.6
        });
      }
    }
    var rafId = null, running = false, visible = true, last = 0, INTERVAL = 1000 / 40; /* 限 40fps */
    function loop(ts) {
      rafId = window.requestAnimationFrame(loop);
      if (!visible || document.hidden) return;      /* 离屏或后台页：不绘制 */
      if (ts - last < INTERVAL) return;             /* 限帧，别把主线程吃满 */
      last = ts;
      frame();
    }
    function start() {
      if (running) return;
      running = true; last = 0;
      rafId = window.requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
    }
    function frame() {
      if (!cv.isConnected) { stop(); return; }
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        a.x += a.vx; a.y += a.vy;
        if (a.x < -20) a.x = W + 20; if (a.x > W + 20) a.x = -20;
        if (a.y < -20) a.y = H + 20; if (a.y > H + 20) a.y = -20;
        /* 鼠标靠近时轻微响应 */
        var mdx = a.x - mouse.x, mdy = a.y - mouse.y;
        var md = Math.sqrt(mdx * mdx + mdy * mdy);
        var near = md < 150;
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx.strokeStyle = 'rgba(150,152,156,' + (0.30 * (1 - d / LINK)).toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        ctx.fillStyle = near ? 'rgba(255,106,26,0.95)' : 'rgba(178,180,184,0.72)';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    size();
    start();
    /* Hero 移出视口就暂停（省电、不掉帧）*/
    var hero = document.getElementById('top');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) { start(); }
      }, { threshold: 0 }).observe(hero);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) { stop(); } else { start(); } });
    window.addEventListener('resize', size);
    window.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    window.addEventListener('mouseout', function () { mouse.x = -9999; mouse.y = -9999; });
  } else if (cv) {
    cv.style.display = 'none';   /* 降级：reduced-motion 时不出背景动态 */
  }
})();
