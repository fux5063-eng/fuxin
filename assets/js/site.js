/* ============================================================
   付昕｜新作品集网站 · 交互
   依据 V3 §25 动态 / §26 时长 / §38 导航 / §39 Lightbox / §43 移动端 / §44 性能
   ============================================================ */
(function () {
  'use strict';
  window.__siteBuild = 'v9-v4batch3';   /* 构建标记：排查缓存用 */
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
    /* V4 P1-02：收起后不让视口跳动 —— 先量住"展开区是否整个在视口上方"，
       短了多少就在终态补回多少滚动量，用户感觉仍在原位置。 */
    var docBefore = document.documentElement.scrollHeight;
    var docked = box.getBoundingClientRect().bottom < 0;
    box.style.height = box.scrollHeight + 'px';   /* 先固定当前高度 */
    box.getBoundingClientRect();                  /* 强制回流 */
    box.setAttribute('data-open', 'false');       /* 先改状态（守卫依赖它）*/
    box.style.height = '0px';
    /* 终态强制：离屏元素不产生帧时 transition 不会推进，
       这里保证"收起"这个结果无论如何都落到 0。 */
    timers.set(box, window.setTimeout(function () {
      if (box.getAttribute('data-open') !== 'true') {
        box.style.height = '0px';
        if (docked) {
          var shrink = docBefore - document.documentElement.scrollHeight;
          if (shrink > 2) window.scrollBy(0, -shrink);
        }
      }
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
        btn.textContent = labelOpen;   /* V4 P1-02：不再自动 scrollIntoView */
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

  /* ══ V4 第三批：项目专属交互（V4 原话：把交互需求写进网页 ≠ 实现交互需求）══ */

  /* ── 1. Lumora：使用态 / 收纳态 真切换 ── */
  (function () {
    var sw = document.getElementById('lumora-switch');
    if (!sw) return;
    var img = sw.querySelector('.state-switch__img');
    var cap = sw.querySelector('.state-switch__cap');
    var btns = [].slice.call(sw.querySelectorAll('.state-switch__btn'));
    var CAPS = {
      open: '展开最高 1280mm · 可调灯臂',
      stowed: '收纳总高 572mm · 折叠 + 脚轮移动'
    };
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var st = b.getAttribute('data-state');
        if (sw.getAttribute('data-state') === st) return;
        sw.setAttribute('data-state', st);
        btns.forEach(function (x) { x.classList.toggle('is-on', x === b); });
        if (cap) cap.textContent = CAPS[st] || '';
        img.classList.add('is-fading');
        var pre = new Image();
        var done = function () {
          img.src = pre.src;
          img.alt = b.getAttribute('data-alt') || '';
          img.classList.remove('is-fading');
        };
        pre.onload = done;
        pre.onerror = done;
        pre.src = b.getAttribute('data-src');
      });
    });
  })();

  /* ── 2. Robot：系统链路真点亮（进入视口自动跑一次 + 悬停看节点说明）── */
  (function () {
    var chain = document.getElementById('robot-chain');
    if (!chain) return;
    var nodes = [].slice.call(chain.querySelectorAll('.chain__node'));
    var note = document.getElementById('chain-note');
    var DEFAULT_NOTE = '点亮路径：语音 → 后台 → 实机执行 → 反馈';
    var played = false;
    function focusNode(n) {
      nodes.forEach(function (x) { x.classList.toggle('is-lit', x === n); });
      if (note) note.textContent = n.getAttribute('data-note') || '';
    }
    nodes.forEach(function (n) {
      n.addEventListener('mouseenter', function () { focusNode(n); });
      n.addEventListener('focus', function () { focusNode(n); });
      n.addEventListener('click', function () { focusNode(n); });
    });
    function play() {
      if (played) return;
      played = true;
      nodes.forEach(function (n, i) {
        window.setTimeout(function () { n.classList.add('is-lit'); }, 150 * i);
        window.setTimeout(function () {
          if (!n.matches(':hover') && document.activeElement !== n) n.classList.remove('is-lit');
        }, 150 * i + 760);
      });
      window.setTimeout(function () { if (note) note.textContent = DEFAULT_NOTE; },
        150 * nodes.length + 760);
    }
    if (reduce.matches) return;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { play(); io.disconnect(); }
      }, { threshold: 0.35 });
      io.observe(chain);
    } else {
      play();
    }
  })();

  /* ── 3. DesignDNA：三态约束轻交互（点一行 → 橙色状态 + 说明变化）── */
  (function () {
    var box = document.getElementById('dna-states');
    if (!box) return;
    var rows = [].slice.call(box.querySelectorAll('.tstates__row'));
    var note = document.getElementById('tstates-note');
    var DEFAULT_NOTE = '点一行看这条约束能改到什么程度';
    rows.forEach(function (r) {
      r.addEventListener('click', function () {
        var wasOn = r.classList.contains('is-on');
        rows.forEach(function (x) { x.classList.remove('is-on'); });
        if (wasOn) {
          if (note) note.textContent = DEFAULT_NOTE;
        } else {
          r.classList.add('is-on');
          if (note) note.textContent = r.getAttribute('data-note') || '';
        }
      });
    });
  })();

  /* ── 4. 工业 → AI 过渡：产品轮廓 → 拆成节点 → 出现连线 ──
     纯 canvas 2D、滚动驱动、不锁滚动、快速滚动直接跳到该有的状态。 */
  (function () {
    var sec = document.querySelector('[data-transition="product-to-system"]');
    var cv = document.getElementById('transition-canvas');
    if (!sec || !cv) return;
    if (reduce.matches || (window.matchMedia && matchMedia('(max-width: 720px)').matches)) {
      cv.style.display = 'none';
      return;
    }
    var ctx = cv.getContext('2d');
    var W = 1, H = 1, SCALE = 1, N = 9, nodes = [];
    function size() {
      var r = sec.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      SCALE = Math.min(window.devicePixelRatio || 1, 1);
      cv.width = Math.round(W * SCALE);
      cv.height = Math.round(H * SCALE);
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      nodes = [];
      for (var i = 0; i < N; i++) {
        nodes.push({
          x: W * (0.09 + i * 0.102),
          y: H * (0.5 + Math.sin(i * 0.95 + 0.6) * 0.19)
        });
      }
    }
    function progress() {
      var r = sec.getBoundingClientRect();
      return Math.max(0, Math.min(1, (window.innerHeight - r.top) / (window.innerHeight + r.height)));
    }
    function draw() {
      var p = progress();
      ctx.clearRect(0, 0, W, H);
      /* ① 产品轮廓（0 → 0.34 淡出）*/
      var a1 = Math.max(0, 1 - p / 0.34);
      if (a1 > 0.02) {
        ctx.globalAlpha = a1 * 0.55;
        ctx.strokeStyle = '#FF6A1A';
        ctx.lineWidth = 1.3;
        var bw = Math.min(W * 0.26, 320), bh = Math.min(H * 0.46, 200);
        var x0 = W / 2 - bw / 2, y0 = H / 2 - bh / 2 + H * 0.06, rr = 26;
        ctx.beginPath();
        ctx.moveTo(x0 + rr, y0);
        ctx.arcTo(x0 + bw, y0, x0 + bw, y0 + bh, rr);
        ctx.arcTo(x0 + bw, y0 + bh, x0, y0 + bh, rr);
        ctx.arcTo(x0, y0 + bh, x0, y0, rr);
        ctx.arcTo(x0, y0, x0 + bw, y0, rr);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x0 + bw * 0.32, y0);
        ctx.lineTo(x0 + bw * 0.68, y0);
        ctx.stroke();
      }
      /* ② 连线（0.52 → 1）*/
      var a3 = Math.max(0, Math.min(1, (p - 0.52) / 0.48));
      ctx.globalAlpha = 1;
      for (var i = 1; i < nodes.length; i++) {
        var ln = Math.max(0, Math.min(1, a3 * (nodes.length - 1) - (i - 1)));
        if (ln <= 0) continue;
        var a = nodes[i - 1], b = nodes[i];
        ctx.globalAlpha = ln * 0.42;
        ctx.strokeStyle = '#8B8D90';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + (b.x - a.x) * ln, a.y + (b.y - a.y) * ln);
        ctx.stroke();
      }
      /* ③ 节点（0.18 → 0.66 依次出现）*/
      var a2 = Math.max(0, Math.min(1, (p - 0.18) / 0.48));
      for (var k = 0; k < nodes.length; k++) {
        var ap = Math.max(0, Math.min(1, a2 * nodes.length - k));
        if (ap <= 0) continue;
        ctx.globalAlpha = ap * 0.85;
        ctx.fillStyle = (k % 3 === 0) ? '#FF6A1A' : '#B9BBC0';
        ctx.beginPath();
        ctx.arc(nodes[k].x, nodes[k].y, (k % 3 === 0) ? 3.2 : 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    size();
    draw();
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var r = sec.getBoundingClientRect();
        if (r.bottom > -120 && r.top < window.innerHeight + 120) draw();
        ticking = false;
      });
    }, { passive: true });
    window.addEventListener('resize', function () { size(); draw(); });
  })();

  /* ── 5. Lightbox gallery（V4 P1-01：项目图分组、前后翻、序号、键盘、滑动、关闭回原位）── */
  var lb = document.getElementById('lb');
  if (lb) {
    var lbImg = lb.querySelector('.lb__img');
    var lbCap = lb.querySelector('.lb__cap');
    var lbCount = lb.querySelector('.lb__count');
    var lbPrev = lb.querySelector('.lb__nav--prev');
    var lbNext = lb.querySelector('.lb__nav--next');
    var lbGroup = [], lbIdx = 0, lastFocus = null, touchX = null;

    function capOf(im) {
      var fig = im.closest('figure');
      var c = fig ? fig.querySelector('figcaption') : null;
      return (c && c.textContent.trim()) || im.getAttribute('alt') || '';
    }
    function groupOf(im) {
      var sec = im.closest('section') || document.body;
      return [].slice.call(sec.querySelectorAll('.media--zoom img, .cover__main, .state-switch__img'));
    }
    function show(i) {
      if (!lbGroup.length) return;
      lbIdx = (i + lbGroup.length) % lbGroup.length;
      var im = lbGroup[lbIdx];
      lbImg.src = im.currentSrc || im.src;
      lbImg.alt = im.getAttribute('alt') || '';
      lbCap.textContent = capOf(im);
      lbCount.textContent = (lbIdx + 1) + ' / ' + lbGroup.length;
      var many = lbGroup.length > 1;
      lbPrev.hidden = !many;
      lbNext.hidden = !many;
    }
    function lbOpen(im) {
      lbGroup = groupOf(im);
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      lastFocus = document.activeElement;
      var c = lb.querySelector('.lb__close');
      if (c) c.focus();
      show(lbGroup.indexOf(im));
    }
    function lbClose() {
      lb.hidden = true;
      lbImg.removeAttribute('src');
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    [].slice.call(document.querySelectorAll('.media--zoom img, .cover__main, .state-switch__img'))
      .forEach(function (im) {
        im.addEventListener('click', function () { lbOpen(im); });
      });
    lb.querySelector('.lb__close').addEventListener('click', lbClose);
    lbPrev.addEventListener('click', function () { show(lbIdx - 1); });
    lbNext.addEventListener('click', function () { show(lbIdx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lbClose(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') lbClose();
      else if (e.key === 'ArrowLeft') show(lbIdx - 1);
      else if (e.key === 'ArrowRight') show(lbIdx + 1);
    });
    lb.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 44) show(lbIdx + (dx < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
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
