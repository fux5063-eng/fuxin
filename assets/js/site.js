/* ============================================================
   付昕｜新作品集网站 · 交互
   依据 V3 §25 动态 / §26 时长 / §38 导航 / §39 Lightbox / §43 移动端 / §44 性能
   ============================================================ */
(function () {
  'use strict';
  window.__siteBuild = 'v13-v41-b3';   /* 构建标记：排查缓存用 */
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
  /* V4.1 §24 修正：More Work 卡片用 data-lb / data-lb-cap 指定大图与说明，
     但这些属性此前在 JS 里完全没有处理 —— 点了没反应（死交互）。这里接上。 */
  var lbOpenSingle = function (src, cap) {
    lbGroup = [];
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    lastFocus = document.activeElement;
    lbImg.src = src;
    lbImg.alt = cap || '';
    lbCap.textContent = cap || '';
    lbCount.textContent = '';
    lbPrev.hidden = true;
    lbNext.hidden = true;
    lb.querySelector('.lb__close').focus();
  };
  document.querySelectorAll('[data-lb]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;   /* 卡片内的可玩原型链接照常新开标签页 */
      lbOpenSingle(el.getAttribute('data-lb'), el.getAttribute('data-lb-cap') || '');
    });
  });
    lb.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 44) show(lbIdx + (dx < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
  }

  /* ══ Hero 背景粒子（V4.1 §6：恢复旧站「粒子 + 连线 + 轻交互」）══
     观感参数逐项对照旧站 fuxin-portfolio/assets/js/app.js 的 createParticles：
     density 8200 / maxN 260 / 波带 bandBase .52 · bandAmp .34 · bandWidth 132 /
     freeRatio .42 / link 130 / linkAlpha .44 / speed 1.95 /
     暖橙节点 rgba(255,158,102,.85) · 冷白点 rgba(226,236,246,.7) · 鼠标作用半径 150
     差异：只服务 Hero 一块画布，去掉旧站为一页 20+ 画布设计的共享注册表；
     并加上「离屏暂停 / 页面隐藏暂停 / reduced-motion 关闭 / 移动端减量」。 */
  (function () {
    var cv = document.getElementById('bg');
    if (!cv || !cv.getContext) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) { cv.style.display = 'none'; return; }
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var MOBILE = window.matchMedia('(max-width: 720px)').matches;
    var O = {
      density: MOBILE ? 15000 : 8200,
      maxN: MOBILE ? 110 : 260,
      minN: MOBILE ? 30 : 40,
      link: MOBILE ? 108 : 130,
      linkAlpha: MOBILE ? .34 : .44,
      bandBase: .52, bandAmp: .34, bandWidth: 132, freeRatio: .42, speed: 1.95,
      dpr: 1.25, dotScale: 1,
      dot: 'rgba(226,236,246,.7)',
      accent: 'rgba(255,158,102,.85)',
      linkRGB: '255,255,255',
      glow: '255,158,102'
    };
    var linkD2 = O.link * O.link;
    var dpr = Math.min(window.devicePixelRatio || 1, O.dpr);
    var W = 0, H = 0, parts = [], rafId = 0, running = false, last = 0, visible = true;
    var mouse = { x: -9999, y: -9999, on: false, r: 150 };
    var myRect = null;

    function build() {
      var n = Math.round(Math.min(O.maxN, Math.max(O.minN, (W * H) / O.density)));
      parts = [];
      for (var i = 0; i < n; i++) {
        parts.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (.22 + Math.random() * .32) * O.speed,
          vy: (Math.random() - .5) * .2 * O.speed,
          r: Math.random() * 1.35 + .6,
          hot: Math.random() < .18,
          free: Math.random() < O.freeRatio,
          band: (Math.random() - .5) * 2 * (O.bandWidth * (0.32 + Math.random() * 0.68)),
          sp: .7 + Math.random() * .8,
          ph: Math.random() * 6.283, ph2: Math.random() * 6.283,
          w1: .00045 + Math.random() * .00055,
          w2: .00028 + Math.random() * .00042,
          wa: .55 + Math.random() * .75
        });
      }
    }

    function size(rebuild) {
      var pw = Math.max(1, cv.clientWidth), phh = Math.max(1, cv.clientHeight);
      var ow = W, oh = H;
      W = pw; H = phh;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (rebuild || !parts.length) build();
      else if (ow > 0 && oh > 0) {
        var sx = W / ow, sy = H / oh;
        for (var i = 0; i < parts.length; i++) { parts[i].x *= sx; parts[i].y *= sy; }
      }
      myRect = null;
    }

    function bandY(x, ts) {
      return H * O.bandBase + Math.sin(x / W * 2.15 + ts) * H * O.bandAmp +
             Math.sin(x / W * 4.6 - ts * .7) * H * (O.bandAmp * .32);
    }

    function frame(t) {
      if (!running) return;
      rafId = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      var dt = last ? Math.min(2.4, Math.max(.35, (t - last) / 16.667)) : 1;
      last = t;
      var ts = t * .00016;
      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var wander = Math.sin(t * p.w1 + p.ph) * p.wa + Math.cos(t * p.w2 + p.ph2) * (p.wa * .5);
        if (p.free) {
          p.vx += wander * .0055 * dt;
          p.vy += Math.cos(t * p.w1 * .85 + p.ph) * .005 * dt;
          p.vx += (Math.random() - .5) * .0062 * dt;
          p.vy += (Math.random() - .5) * .0062 * dt;
        } else {
          p.vx += ((.95 - Math.abs(p.vy) * .22) * p.sp * O.speed - p.vx) * .02 * dt;
          p.vy += (bandY(p.x, ts) + p.band - p.y) * .0022 * dt;
          p.vy += wander * .009 * dt;
        }
        if (mouse.on) {
          var mdx = p.x - mouse.x, mdy = p.y - mouse.y, md2 = mdx * mdx + mdy * mdy;
          if (md2 < 4900 && md2 > 1) {
            var md = Math.sqrt(md2), mt = 1 - md / 70;
            p.vx += mdx / md * .25 * mt * dt;
            p.vy += mdy / md * .25 * mt * dt;
          }
        }
        p.vx *= 1 - .014 * dt;
        p.vy *= 1 - .014 * dt;
        var sp = Math.hypot(p.vx, p.vy), mx = (p.free ? .9 : 1.6) * O.speed;
        if (sp > mx) { p.vx = p.vx / sp * mx; p.vy = p.vy / sp * mx; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x > W + 26) {
          p.x = -26; p.vx = (.22 + Math.random() * .3) * O.speed;
          p.y = (!p.free) ? bandY(p.x, ts) + p.band + (Math.random() - .5) * 30 : Math.random() * H;
        }
        if (p.x < -46) p.x = W + 26;
        if (p.y < -28) p.y = H + 22; else if (p.y > H + 28) p.y = -22;
      }

      /* 近邻连线：网格分桶，只比同格与 4 个邻格；按透明度分 5 档批量描线 */
      var cell = O.link, grid = new Map(), k, a, i2;
      for (i2 = 0; i2 < parts.length; i2++) {
        var pp = parts[i2];
        k = ((pp.x / cell) | 0) + '|' + ((pp.y / cell) | 0);
        a = grid.get(k);
        if (!a) { a = []; grid.set(k, a); }
        a.push(pp);
      }
      ctx.lineWidth = 1;
      var LB = 5, buckets = [[], [], [], [], []];
      grid.forEach(function (arr, key) {
        var gp = key.split('|'), gx = +gp[0], gy = +gp[1];
        for (var ox = 0; ox <= 1; ox++) {
          for (var oy = (ox === 0 ? 0 : -1); oy <= 1; oy++) {
            var nb = grid.get((gx + ox) + '|' + (gy + oy));
            if (!nb) continue;
            var same = (ox === 0 && oy === 0);
            for (var i3 = 0; i3 < arr.length; i3++) {
              var pa = arr[i3];
              for (var j = same ? i3 + 1 : 0; j < nb.length; j++) {
                var pb = nb[j], dx = pa.x - pb.x, dy = pa.y - pb.y, d2 = dx * dx + dy * dy;
                if (d2 < linkD2) {
                  var tt = 1 - Math.sqrt(d2) / O.link;
                  var bi = tt <= 0 ? 0 : (tt >= 1 ? LB - 1 : (tt * LB) | 0);
                  buckets[bi].push(pa.x, pa.y, pb.x, pb.y);
                }
              }
            }
          }
        }
      });
      for (var b = 0; b < LB; b++) {
        var seg = buckets[b];
        if (!seg.length) continue;
        ctx.strokeStyle = 'rgba(' + O.linkRGB + ',' + (((b + 0.5) / LB) * O.linkAlpha).toFixed(3) + ')';
        ctx.beginPath();
        for (var s2 = 0; s2 < seg.length; s2 += 4) {
          ctx.moveTo(seg[s2], seg[s2 + 1]); ctx.lineTo(seg[s2 + 2], seg[s2 + 3]);
        }
        ctx.stroke();
      }

      /* 指针交互：柔光 + 连线（让「能交互」一眼可见）*/
      if (mouse.on) {
        var mr2 = mouse.r * mouse.r;
        var g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mouse.r);
        g.addColorStop(0, 'rgba(' + O.glow + ',.20)');
        g.addColorStop(1, 'rgba(' + O.glow + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(mouse.x, mouse.y, mouse.r, 0, 6.283); ctx.fill();
        var PB = 4, pbk = [[], [], [], []];
        for (var i4 = 0; i4 < parts.length; i4++) {
          var p4 = parts[i4], ddx = p4.x - mouse.x, ddy = p4.y - mouse.y, dd2 = ddx * ddx + ddy * ddy;
          if (dd2 < mr2) {
            var t4 = 1 - Math.sqrt(dd2) / mouse.r;
            pbk[Math.min(PB - 1, Math.max(0, (t4 * PB) | 0))].push(mouse.x, mouse.y, p4.x, p4.y);
          }
        }
        ctx.lineWidth = 1;
        for (var b4 = 0; b4 < PB; b4++) {
          var seg4 = pbk[b4];
          if (!seg4.length) continue;
          ctx.strokeStyle = 'rgba(' + O.glow + ',' + (((b4 + 0.5) / PB) * .5).toFixed(3) + ')';
          ctx.beginPath();
          for (var s4 = 0; s4 < seg4.length; s4 += 4) {
            ctx.moveTo(seg4[s4], seg4[s4 + 1]); ctx.lineTo(seg4[s4 + 2], seg4[s4 + 3]);
          }
          ctx.stroke();
        }
      }

      /* 粒子本体：18% 暖橙「hot」/ 其余冷白 */
      for (var i5 = 0; i5 < parts.length; i5++) {
        var p5 = parts[i5];
        ctx.beginPath();
        ctx.fillStyle = p5.hot ? O.accent : O.dot;
        ctx.arc(p5.x, p5.y, p5.r * O.dotScale, 0, 6.283);
        ctx.fill();
      }
    }

    function start() {
      if (running) return;
      running = true; last = 0;
      rafId = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    }

    size(true);
    start();

    /* 指针 → 画布局部坐标（rect 缓存，滚动/缩放才重测，避免每次移动都强制布局）*/
    window.addEventListener('pointermove', function (e) {
      if (!myRect) myRect = cv.getBoundingClientRect();
      var x = e.clientX - myRect.left, y = e.clientY - myRect.top;
      mouse.x = x; mouse.y = y;
      mouse.on = x > -80 && y > -80 && x < myRect.width + 80 && y < myRect.height + 80;
    }, { passive: true });
    document.addEventListener('pointerleave', function () {
      mouse.on = false; mouse.x = -9999; mouse.y = -9999;
    });
    window.addEventListener('scroll', function () { myRect = null; }, { passive: true });
    window.addEventListener('resize', function () { size(false); myRect = null; });

    /* 离屏 / 页面隐藏即停（V4.1：不影响滚动、不常驻重动画）*/
    var hero = document.getElementById('top');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) start();
      }, { threshold: 0 }).observe(hero);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });
  })();
})();
