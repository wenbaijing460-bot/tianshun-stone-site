(function () {
  "use strict";

  var PANEL_COUNT = 6;

  var yearEl = document.querySelector("[data-year]");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  var track = document.querySelector("[data-panel-track]");
  var lastPanelIdx = -1;
  /** 防止快速切换时，上一次 requestAnimationFrame 里的 scrollIntoView 作用到已离屏的节点 */
  var scrollRouteGen = 0;

  function panelByIndex(idx) {
    return document.querySelector('[data-panel-index="' + idx + '"]');
  }

  function getDominantPanelIndex() {
    var active = document.querySelector(".panel.is-active");
    if (!active) return -1;
    var raw = active.getAttribute("data-panel-index");
    if (raw === null || raw === "") return -1;
    return parseInt(raw, 10);
  }

  var routeVerifyRetries = 0;
  var verifyScheduleTimer = null;

  /** 地址栏期望的栏与视口里占主导的那一栏不一致时，强制再跑一遍路由（不依赖刷新） */
  function verifyAndRepair() {
    var hash = normalizeHash(window.location.hash || "#home");
    var route = getRoute(hash);
    if (!route) return;
    var want = route.panel;
    var domIdx = getDominantPanelIndex();
    if (domIdx < 0) return;
    if (domIdx === want) {
      routeVerifyRetries = 0;
      return;
    }
    if (routeVerifyRetries >= 3) {
      routeVerifyRetries = 0;
      return;
    }
    routeVerifyRetries += 1;
    applyRoute(hash);
  }

  function scheduleVerifyRoute() {
    if (verifyScheduleTimer) clearTimeout(verifyScheduleTimer);
    verifyScheduleTimer = setTimeout(function () {
      verifyScheduleTimer = null;
      verifyAndRepair();
    }, 580);
  }

  /** 叠放模式下不再平移轨道，仅清除旧版横滑遗留的 inline 样式 */
  function setTrackPosition(idx) {
    if (!track) return;
    track.style.transform = "";
    track.style.width = "";
    track.style.left = "";
    var i;
    for (i = 0; i < PANEL_COUNT; i++) {
      var p = panelByIndex(i);
      if (p) {
        p.style.flex = "";
        p.style.width = "";
        p.style.maxWidth = "";
      }
    }
  }

  /** 非当前栏的纵向滚动清零，避免离屏栏 scrollTop 参与计算或残留（尤其石材样品多层块切换） */
  function resetInactivePanelScrolls(activeIdx) {
    var j;
    for (j = 0; j < PANEL_COUNT; j++) {
      if (j === activeIdx) continue;
      var p = panelByIndex(j);
      var sc = p && p.querySelector(".panel-scroll");
      if (sc) sc.scrollTop = 0;
    }
  }

  function setSamplesFromHash(hash) {
    var hub = document.querySelector("[data-samples-hub]");
    var nat = document.querySelector('[data-samples-detail="natural"]');
    var eng = document.querySelector('[data-samples-detail="engineered"]');
    if (!hub || !nat || !eng) return;
    var showNat = hash === "#natural-stone";
    var showEng = hash === "#engineered-stone";
    var showHub = !showNat && !showEng;
    hub.classList.toggle("is-hidden", !showHub);
    nat.classList.toggle("is-hidden", !showNat);
    eng.classList.toggle("is-hidden", !showEng);
  }

  /**
   * 叠放切栏无 CSS transition，用双 rAF 等待布局稳定后再滚到锚点。
   */
  function afterPanelPositionSettled(trackEl, needsSettle, callback) {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(callback);
    });
  }

  /** 将 el 顶对齐到滚动容器顶部（绝对 scrollTop，避免 += 在多层块切换时越滚越偏） */
  function scrollElementToTopOfScroller(scroller, el) {
    if (!scroller || !el) return;
    var rel =
      el.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;
    var maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    scroller.scrollTop = Math.max(0, Math.min(rel, maxScroll));
  }

  function getRoute(hash) {
    if (!hash || hash === "#") {
      return { panel: 0, scrollTop: true };
    }
    var routes = {
      "#home": { panel: 0, scrollTop: true },
      "#top": { panel: 0, scrollTop: true },
      "#about": { panel: 0, scrollTarget: "about" },
      "#capabilities": { panel: 1, scrollTop: true },
      "#samples": { panel: 2, scrollTop: true },
      "#natural-stone": { panel: 2, scrollTarget: "natural-stone" },
      "#engineered-stone": { panel: 2, scrollTarget: "engineered-stone" },
      "#cases": { panel: 3, scrollTop: true },
      "#process": { panel: 4, scrollTop: true },
      "#contact": { panel: 5, scrollTop: true },
    };
    return routes[hash] || null;
  }

  /** 统一合法 hash，避免非法片段导致 applyRoute 被跳过、轨道停在旧位置 */
  function normalizeHash(raw) {
    var h = raw || "#home";
    if (h === "#" || h === "") h = "#home";
    if (getRoute(h)) return h;
    return "#home";
  }

  function applyRoute(rawHash) {
    var hash = normalizeHash(rawHash || "#home");
    var route = getRoute(hash);
    if (!route) return false;

    var idx = route.panel;
    if (idx < 0 || idx >= PANEL_COUNT) return false;

    var fromPanelIdx = lastPanelIdx;

    scrollRouteGen += 1;
    var routeApplyGen = scrollRouteGen;

    if (lastPanelIdx === 2 && idx !== 2) {
      setSamplesFromHash("#samples");
    }

    if (fromPanelIdx !== idx || lastPanelIdx < 0) {
      resetInactivePanelScrolls(idx);
    }

    setTrackPosition(idx);

    var i;
    for (i = 0; i < PANEL_COUNT; i++) {
      var p = panelByIndex(i);
      if (!p) continue;
      var on = i === idx;
      p.setAttribute("aria-hidden", on ? "false" : "true");
      p.classList.toggle("is-active", on);
    }

    if (idx === 2) {
      setSamplesFromHash(hash);
    }

    var activePanel = panelByIndex(idx);
    var scroller = activePanel ? activePanel.querySelector(".panel-scroll") : null;
    if (scroller) {
      if (route.scrollTarget) {
        var tid = route.scrollTarget;
        var needsTrackSettle =
          (fromPanelIdx >= 0 && fromPanelIdx !== idx) || (fromPanelIdx < 0 && idx > 0);
        var runTargetScroll = function () {
          if (routeApplyGen !== scrollRouteGen) return;
          var el = scroller.querySelector("#" + tid);
          scrollElementToTopOfScroller(scroller, el);
        };
        afterPanelPositionSettled(track, needsTrackSettle, runTargetScroll);
        window.setTimeout(runTargetScroll, 120);
        window.setTimeout(runTargetScroll, 360);
      } else if (route.scrollTop) {
        scroller.scrollTop = 0;
      }
    }

    var navHash = hash === "#home" || hash === "#top" ? "" : hash;
    document.querySelectorAll(".site-nav a[href^='#']").forEach(function (a) {
      var h = a.getAttribute("href");
      var match = h === navHash && navHash !== "";
      if (h === "#samples" && (hash === "#natural-stone" || hash === "#engineered-stone")) {
        match = true;
      }
      a.classList.toggle("is-current", match);
    });

    lastPanelIdx = idx;
    scheduleVerifyRoute();
    return true;
  }

  function onHashChange() {
    routeVerifyRetries = 0;
    var raw = window.location.hash || "#home";
    var hash = normalizeHash(raw);
    if (hash !== raw) {
      if (history.replaceState) {
        history.replaceState(null, "", window.location.pathname + window.location.search + hash);
      } else {
        window.location.hash = hash;
        return;
      }
    }
    applyRoute(hash);
  }

  /**
   * 按地址栏 hash 完整重跑一遍路由，纠正轨道/样品子视图与 URL 脱节
   *（切标签、往返缓存恢复、布局完成后再对齐等场景）。
   */
  function syncRouteFromLocation() {
    onHashChange();
  }

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      syncRouteFromLocation();
    }
  });

  var visibilitySyncTimer = null;
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    if (visibilitySyncTimer) clearTimeout(visibilitySyncTimer);
    visibilitySyncTimer = setTimeout(function () {
      visibilitySyncTimer = null;
      syncRouteFromLocation();
    }, 60);
  });

  window.addEventListener("load", function () {
    syncRouteFromLocation();
  });

  var resizeSyncTimer = null;
  window.addEventListener("resize", function () {
    if (resizeSyncTimer) clearTimeout(resizeSyncTimer);
    resizeSyncTimer = setTimeout(function () {
      resizeSyncTimer = null;
      syncRouteFromLocation();
    }, 250);
  });

  document.addEventListener(
    "click",
    function (e) {
      var t = e.target;
      if (t && t.nodeType === 3 && t.parentElement) {
        t = t.parentElement;
      }
      var a = t && t.closest && t.closest("a[href^='#']");
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href || href === "#") return;
      var targetHash = normalizeHash(href);
      var route = getRoute(targetHash);
      if (!route) return;
      e.preventDefault();
      var cur = window.location.hash || "#home";
      if (cur !== targetHash) {
        window.location.hash = targetHash;
      } else {
        applyRoute(targetHash);
      }
      scheduleVerifyRoute();
      var toggle = document.querySelector("[data-nav-toggle]");
      var nav = document.querySelector("[data-site-nav]");
      if (nav && nav.contains(a) && toggle) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "打开菜单");
      }
    },
    true
  );

  window.addEventListener("hashchange", onHashChange);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onHashChange);
  } else {
    onHashChange();
  }

  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector("[data-site-nav]");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    });
  }

  /* Hero carousel */
  var root = document.querySelector("[data-carousel]");
  if (root) {

  var cTrack = root.querySelector("[data-carousel-track]");
  var slides = Array.prototype.slice.call(root.querySelectorAll("[data-slide]"));
  var btnPrev = root.querySelector("[data-carousel-prev]");
  var btnNext = root.querySelector("[data-carousel-next]");
  var dotsWrap = root.querySelector("[data-carousel-dots]");

  var index = 0;
  var count = slides.length;
  var startX = 0;
  var lastX = 0;
  var dragging = false;

  function clamp(i) {
    if (i < 0) return 0;
    if (i >= count) return count - 1;
    return i;
  }

  function renderDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = "";
    for (var i = 0; i < count; i++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "carousel-dot";
      b.setAttribute("aria-label", "第 " + (i + 1) + " 张");
      b.addEventListener(
        "click",
        (function (j) {
          return function () {
            go(j);
          };
        })(i)
      );
      dotsWrap.appendChild(b);
    }
    updateDots();
  }

  function updateDots() {
    if (!dotsWrap) return;
    var dots = dotsWrap.querySelectorAll(".carousel-dot");
    dots.forEach(function (d, i) {
      d.setAttribute("aria-current", i === index ? "true" : "false");
    });
  }

  function go(i) {
    index = clamp(i);
    var offset = -index * 100;
    cTrack.style.transform = "translateX(" + offset + "%)";
    updateDots();
  }

  function next() {
    go(index + 1 >= count ? 0 : index + 1);
  }

  function prev() {
    go(index - 1 < 0 ? count - 1 : index - 1);
  }

  renderDots();
  go(0);

  if (btnNext) btnNext.addEventListener("click", next);
  if (btnPrev) btnPrev.addEventListener("click", prev);

  root.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });
  root.tabIndex = 0;

  root.addEventListener(
    "touchstart",
    function (e) {
      if (!e.touches || !e.touches[0]) return;
      dragging = true;
      startX = e.touches[0].clientX;
      lastX = startX;
    },
    { passive: true }
  );

  root.addEventListener(
    "touchmove",
    function (e) {
      if (!dragging || !e.touches || !e.touches[0]) return;
      lastX = e.touches[0].clientX;
    },
    { passive: true }
  );

  root.addEventListener("touchend", function () {
    if (!dragging) return;
    dragging = false;
    var dx = lastX - startX;
    var threshold = 48;
    if (dx > threshold) prev();
    else if (dx < -threshold) next();
  });

  var mouseDown = false;
  var mouseStart = 0;
  root.addEventListener("mousedown", function (e) {
    var t = e.target;
    if (t && t.closest && t.closest("button, a, input, textarea, label")) return;
    mouseDown = true;
    mouseStart = e.clientX;
  });
  window.addEventListener("mouseup", function (e) {
    if (!mouseDown) return;
    mouseDown = false;
    var dx = e.clientX - mouseStart;
    var threshold = 60;
    if (dx > threshold) prev();
    else if (dx < -threshold) next();
  });
  }
})();

(function () {
  "use strict";

  /** 排除首页顶栏轮播；其余 img / 红色占位块可点击放大，背景磨砂模糊 */
  function closestInteractive(el) {
    return el && el.closest && el.closest("a, button, input, textarea, select, label");
  }

  function isHeroPreview(el) {
    return el && el.closest && el.closest(".hero, .hero-carousel, [data-carousel]");
  }

  function findLightboxTarget(el) {
    if (!el || !el.closest) return null;
    if (closestInteractive(el)) return null;
    var img = el.closest("img");
    if (img && !isHeroPreview(img)) return img;
    var ph = el.closest(".img-placeholder");
    if (ph && !isHeroPreview(ph)) return ph;
    return null;
  }

  var overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML =
    '<button type="button" class="lightbox-backdrop" aria-label="关闭预览"></button>' +
    '<div class="lightbox-dialog" role="dialog" aria-modal="true" aria-label="放大预览">' +
    '<button type="button" class="lightbox-close" aria-label="关闭">&times;</button>' +
    '<div class="lightbox-stage"></div>' +
    "</div>";

  var backdrop = overlay.querySelector(".lightbox-backdrop");
  var btnClose = overlay.querySelector(".lightbox-close");
  var stage = overlay.querySelector(".lightbox-stage");

  function closeLightbox() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    stage.innerHTML = "";
    document.documentElement.classList.remove("lightbox-open");
  }

  function openLightbox(source) {
    stage.innerHTML = "";
    var node;
    if (source.tagName === "IMG") {
      node = source.cloneNode(false);
      node.className = "lightbox-img-el";
      node.alt = source.alt || "";
      node.decoding = "async";
      node.loading = "eager";
    } else {
      node = source.cloneNode(true);
      node.classList.add("lightbox-clone");
    }
    stage.appendChild(node);
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("lightbox-open");
    btnClose.focus();
  }

  document.body.appendChild(overlay);

  document.body.addEventListener(
    "click",
    function (e) {
      if (overlay.classList.contains("is-open")) return;
      var target = findLightboxTarget(e.target);
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      openLightbox(target);
    },
    false
  );

  backdrop.addEventListener("click", closeLightbox);
  btnClose.addEventListener("click", closeLightbox);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) {
      closeLightbox();
    }
  });
})();
