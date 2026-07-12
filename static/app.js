/* SepticSteward — vanilla port of the design-canvas logic (no framework) */
(function () {
  "use strict";
  var motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var state = {
    people: 3, tank: 1000, disposal: false, lastPumped: "unknown",
    dispYears: 0, dispPct: 0, faqOpen: -1
  };

  /* ---------- helpers ---------- */
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function byBind(name) { return $all('[data-bind="' + name + '"]'); }
  function ref(name) { return $('[data-ref="' + name + '"]'); }

  var UNITLESS = { "grid-template-rows": 1, transform: 1, color: 1, opacity: 1 };
  function setBinds(vals) {
    Object.keys(vals).forEach(function (k) {
      byBind(k).forEach(function (el) { el.textContent = vals[k]; });
    });
    $all("[data-sbind]").forEach(function (el) {
      el.getAttribute("data-sbind").split(";").forEach(function (pair) {
        var prop = pair.split(":")[0], varName = pair.split(":")[1];
        if (!(varName in vals)) return;
        var v = vals[varName];
        if (typeof v === "number" && !UNITLESS[prop]) v = v + "px";
        el.style.setProperty(prop, String(v));
      });
    });
  }

  /* ---------- calculator core (verbatim formulas from design) ---------- */
  function interval(p, g, disp) {
    var t = (13.1 * (g / 1000)) / p - 0.6;
    if (disp) t *= 0.7;
    return Math.min(12, Math.max(0.8, Math.round(t * 10) / 10));
  }
  function targets() {
    var t = interval(state.people, state.tank, state.disposal);
    var known = state.lastPumped !== "unknown";
    var since = known ? Number(state.lastPumped) : t * 0.45;
    var pct = Math.min(46, Math.max(2, (since / t) * 33));
    return { t: t, pct: pct };
  }

  function renderCalc() {
    var t = interval(state.people, state.tank, state.disposal);
    var known = state.lastPumped !== "unknown";
    var d = new Date();
    var yearNow = d.getFullYear() + (d.getMonth() + 0.5) / 12;
    var nextLabel, statusMsg, statusColor;
    if (known) {
      var since = Number(state.lastPumped);
      var nextPt = yearNow - since + t;
      if (since >= t) {
        nextLabel = "as soon as you can book it";
        statusMsg = "Likely overdue. Sludge may be nearing the outlet — book a pump-out.";
        statusColor = "#A6452B";
      } else {
        var yr = Math.floor(nextPt), fr = nextPt - yr;
        nextLabel = "around " + (fr < 0.375 ? "early " : (fr < 0.7 ? "mid-" : "late ")) + yr;
        if (t - since <= 1) { statusMsg = "Getting close — a good time to line up two or three quotes."; statusColor = "#8A5A1F"; }
        else { statusMsg = "You've got breathing room. Set a reminder and enjoy the quiet."; statusColor = "#2F4A2E"; }
      }
    } else {
      nextLabel = "every ~" + t.toFixed(1) + " years for your setup";
      statusMsg = "Tip: pick when it was last pumped and we'll estimate a real countdown.";
      statusColor = "#6E5F4B";
    }
    var solidsH = Math.max(3, (state.dispPct / 100) * 104);
    var solidsY = 132 - solidsH;
    setBinds({
      yearsLabel: state.dispYears.toFixed(1),
      pctLabel: String(Math.round(state.dispPct)),
      nextLabel: nextLabel, statusMsg: statusMsg, statusColor: statusColor,
      solidsY: solidsY, solidsH: solidsH
    });
    var peopleInput = $('[data-value="people"]');
    if (peopleInput && document.activeElement !== peopleInput) peopleInput.value = state.people;
    var tankSel = $('[data-value="tankStr"]');
    if (tankSel) tankSel.value = String(state.tank);
  }

  var nraf = null;
  function animateNums(ty, tp) {
    if (!motion) { state.dispYears = ty; state.dispPct = tp; renderCalc(); return; }
    if (nraf) cancelAnimationFrame(nraf);
    var fy = state.dispYears, fp = state.dispPct, t0 = performance.now(), D = 700;
    function step(n) {
      var k = Math.min(1, (n - t0) / D), e = 1 - Math.pow(1 - k, 3);
      state.dispYears = fy + (ty - fy) * e;
      state.dispPct = fp + (tp - fp) * e;
      renderCalc();
      if (k < 1) nraf = requestAnimationFrame(step);
    }
    nraf = requestAnimationFrame(step);
  }
  function go() { var t = targets(); animateNums(t.t, t.pct); }

  /* ---------- click/change handlers ---------- */
  var handlers = {
    peopleDown: function () { state.people = Math.max(1, state.people - 1); go(); },
    peopleUp: function () { state.people = Math.min(12, state.people + 1); go(); },
    est1000: function () { state.tank = 1000; go(); },
    est1250: function () { state.tank = 1250; go(); },
    est1500: function () { state.tank = 1500; go(); }
  };
  for (var i = 0; i < 7; i++) (function (idx) {
    handlers["faqT" + idx] = function () {
      state.faqOpen = state.faqOpen === idx ? -1 : idx;
      for (var j = 0; j < 7; j++) {
        var open = state.faqOpen === j;
        var btn = $('[data-click="faqT' + j + '"]');
        if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
        var vals = {};
        vals["rows" + j] = open ? "1fr" : "0fr";
        vals["chev" + j] = open ? "rotate(180deg)" : "rotate(0deg)";
        setBinds(vals);
      }
    };
  })(i);

  var changes = {
    onPeople: function (e) {
      var raw = e.target.value; if (raw === "") return;
      state.people = Math.max(1, Math.min(12, Math.round(Number(raw) || 1))); go();
    },
    onTank: function (e) { state.tank = Number(e.target.value); go(); },
    onDisposal: function (e) { state.disposal = e.target.checked; go(); },
    onLast: function (e) { state.lastPumped = e.target.value; go(); }
  };

  /* ---------- email capture (hero / mag / fin) ---------- */
  function wireEmail(prefix) {
    var form = $('[data-submit="' + prefix + 'Submit"]');
    if (!form) return;
    var input = $('[data-value="' + prefix + 'Email"]');
    var errEls = byBind(prefix + "Err");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = (input && input.value || "").trim();
      if (!/^\S+@\S+\.\S+$/.test(v)) {
        errEls.forEach(function (el) { el.textContent = "That email doesn't look quite right — mind checking it?"; });
        return;
      }
      errEls.forEach(function (el) { el.textContent = ""; });
      fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v, source: prefix, site: "septicsteward" })
      }).catch(function () { /* non-blocking */ });
      var not = $('[data-if="' + prefix + 'NotDone"]'), done = $('[data-if="' + prefix + 'Done"]');
      if (not) not.classList.remove("on");
      if (done) done.classList.add("on");
      try {
        var dl = document.createElement("a");
        dl.href = "/downloads/septic-maintenance-schedule.pdf";
        dl.setAttribute("download", "Septic-Maintenance-Schedule.pdf");
        document.body.appendChild(dl); dl.click(); dl.remove();
      } catch (e) {}
    });
  }

  /* ---------- tank fill animation (hero SVG) ---------- */
  function scrollP() { return Math.min(1, Math.max(0, (window.scrollY || 0) / 520)); }
  function applyTank(f, p) {
    var W = ref("rWater"), S = ref("rScum"), SB = ref("rScumB"), L = ref("rSludge"), LD = ref("rSludgeD");
    if (!W || !S || !L) return;
    var bottom = 268, Hh = 100 * f, wy = bottom - Hh;
    W.setAttribute("y", String(wy)); W.setAttribute("height", String(Math.max(0.01, Hh)));
    var so = Math.max(0, Math.min(1, f * 1.8 - 0.8));
    var sh = (11 + 7 * p) * Math.max(0.01, so);
    S.setAttribute("y", String(wy)); S.setAttribute("height", String(sh)); S.setAttribute("opacity", String(Math.max(0.01, so)));
    if (SB) { SB.setAttribute("opacity", String(so)); SB.setAttribute("transform", "translate(0," + (wy - 168) + ")"); }
    var lh = (24 + 16 * p) * f;
    L.setAttribute("y", String(bottom - lh)); L.setAttribute("height", String(Math.max(0.01, lh)));
    if (LD) LD.setAttribute("opacity", String(Math.max(0, Math.min(1, f * 1.6 - 0.6))));
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    // default-on sections (NotDone states visible)
    ["hero", "mag", "fin"].forEach(function (p) {
      var not = $('[data-if="' + p + 'NotDone"]');
      if (not) not.classList.add("on");
      wireEmail(p);
    });

    $all("[data-click]").forEach(function (el) {
      var h = handlers[el.getAttribute("data-click")];
      if (h) el.addEventListener("click", h);
    });
    $all("[data-change]").forEach(function (el) {
      var h = changes[el.getAttribute("data-change")];
      if (!h) return;
      el.addEventListener("change", h);
      if (el.tagName === "INPUT" && el.type !== "checkbox") el.addEventListener("input", h);
    });
    $all("[data-abind-novalidate]").forEach(function (el) { el.setAttribute("novalidate", ""); });

    // FAQ initial collapsed state
    for (var j = 0; j < 7; j++) setBinds((function (o) {
      o["rows" + j] = "0fr"; o["chev" + j] = "rotate(0deg)"; return o;
    })({}));

    // calculator initial render
    var t = targets();
    if (motion) { animateNums(t.t, t.pct); } else { state.dispYears = t.t; state.dispPct = t.pct; renderCalc(); }

    // reveal-on-scroll
    var els = $all("[data-reveal]");
    if (motion && "IntersectionObserver" in window) {
      els.forEach(function (el, i) {
        el.style.opacity = "0"; el.style.transform = "translateY(16px)";
        var d = (i % 3) * 70;
        el.style.transition = "opacity 0.55s ease " + d + "ms, transform 0.55s ease " + d + "ms";
      });
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (en.isIntersecting) { en.target.style.opacity = "1"; en.target.style.transform = "none"; io.unobserve(en.target); }
        });
      }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
      els.forEach(function (el) { io.observe(el); });
    }

    // hero tank fill
    if (ref("rWater")) {
      if (!motion) { applyTank(1, 0.3); }
      else {
        var fillF = 0, fillStarted = false;
        applyTank(0, 0);
        var start = function () {
          if (fillStarted) return; fillStarted = true;
          var t0 = performance.now();
          var loop = function (n) {
            var k = Math.min(1, (n - t0) / 1600);
            fillF = 1 - Math.pow(1 - k, 3);
            applyTank(fillF, scrollP());
            if (k < 1) requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
        };
        var fig = ref("rHeroFig");
        if ("IntersectionObserver" in window && fig) {
          var io2 = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { start(); io2.disconnect(); } }, { threshold: 0.25 });
          io2.observe(fig);
        } else { start(); }
        var sraf = 0;
        window.addEventListener("scroll", function () {
          if (sraf) return;
          sraf = requestAnimationFrame(function () { sraf = 0; if (fillF >= 1) applyTank(1, scrollP()); });
        }, { passive: true });
      }
    }
  });
})();
