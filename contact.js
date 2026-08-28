/* ==========================================================================
   DRK — contact
   Opens inside the glass panel. The handles are the primary action, exactly
   as the deck specifies: a wrong handle sends an investor to a stranger, so
   they are transcribed verbatim from content/drk.ts and never generated.
   ========================================================================== */

(function () {
  "use strict";

  var dialog = document.getElementById("contact");
  var opener = document.getElementById("contact-open");
  var closer = document.getElementById("contact-close");
  if (!dialog || !opener || !closer) return;

  var FOCUSABLE = 'a[href], button:not([disabled])';
  var lastFocus = null;

  /* on a phone the page scrolls, so the dialog is pinned to the first screen
     (see styles.css) and the page behind it is held still */
  var stacked = window.matchMedia("(max-width:860px), (max-aspect-ratio:1/1)");

  var veil = dialog.querySelector(".contact-veil");
  var sheet = dialog.querySelector(".contact-body");
  var savedY = 0;

  function lock() {
    savedY = window.pageYOffset || 0;
    window.scrollTo(0, 0);
    document.documentElement.classList.add("locked");
    document.body.classList.add("locked");
  }

  function unlock() {
    document.documentElement.classList.remove("locked");
    document.body.classList.remove("locked");
    window.scrollTo(0, savedY);
  }

  function clearDrag() {
    dialog.classList.remove("dragging");
    sheet.style.transform = "";
    veil.style.opacity = "";
  }

  function open() {
    lastFocus = document.activeElement;
    if (stacked.matches) lock();
    dialog.hidden = false;
    /* one frame between unhide and the class, or the transition never runs */
    requestAnimationFrame(function () {
      dialog.classList.add("open");
      /* land on the first handle, not on the close button */
      var first = dialog.querySelector(".handles a") || dialog.querySelector(FOCUSABLE);
      if (first) first.focus();
    });
    document.addEventListener("keydown", onKey);
  }

  function close() {
    clearDrag();
    if (document.body.classList.contains("locked")) unlock();
    dialog.classList.remove("open");
    document.removeEventListener("keydown", onKey);
    window.setTimeout(function () {
      dialog.hidden = true;
    }, 550);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(ev) {
    if (ev.key === "Escape") {
      ev.preventDefault();
      close();
      return;
    }
    if (ev.key !== "Tab") return;

    /* keep focus inside the dialog while it is open */
    var items = dialog.querySelectorAll(FOCUSABLE);
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];

    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  /* ---- swipe down to dismiss ---------------------------------------------
     With the page held still behind it and its content fitting one screen,
     a drag on the sheet had nothing to move and simply felt dead. It now
     tracks the finger and lets go past a threshold. The gesture only arms
     when the sheet is scrolled to its top, so a sheet that does overflow
     still scrolls normally first. -------------------------------------- */

  var DISMISS = 88;          /* px of travel that commits to closing */
  var startY = 0, dy = 0, dragging = false;

  dialog.addEventListener("touchstart", function (ev) {
    if (!stacked.matches || ev.touches.length !== 1) return;
    if (sheet.scrollTop > 0) return;
    startY = ev.touches[0].clientY;
    dy = 0;
    dragging = true;
    dialog.classList.add("dragging");
  }, { passive: true });

  dialog.addEventListener("touchmove", function (ev) {
    if (!dragging) return;
    dy = ev.touches[0].clientY - startY;
    if (dy <= 0) {                     /* upward: hand it back to the sheet */
      dy = 0;
      sheet.style.transform = "";
      veil.style.opacity = "";
      return;
    }
    /* resistance past the threshold, so it never feels like a free fall */
    var travel = dy > DISMISS ? DISMISS + (dy - DISMISS) * 0.45 : dy;
    sheet.style.transform = "translate3d(0," + travel + "px,0)";
    veil.style.opacity = String(Math.max(0.35, 1 - dy / 620));
  }, { passive: true });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    dialog.classList.remove("dragging");
    if (dy > DISMISS) {
      close();
    } else {
      sheet.style.transform = "";
      veil.style.opacity = "";
    }
    dy = 0;
  }

  dialog.addEventListener("touchend", endDrag, { passive: true });
  dialog.addEventListener("touchcancel", endDrag, { passive: true });

  opener.addEventListener("click", open);
  closer.addEventListener("click", close);

  dialog.addEventListener("click", function (ev) {
    if (ev.target.hasAttribute("data-close")) close();
  });

  /* ---- copy: clipboard where it exists, a selection fallback where it does
     not (file:// and older Safari both refuse navigator.clipboard) ---------- */

  Array.prototype.forEach.call(dialog.querySelectorAll(".copy"), function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");

      function done() {
        var was = btn.textContent;
        btn.textContent = "Copied";
        btn.classList.add("done");
        window.setTimeout(function () {
          btn.textContent = was;
          btn.classList.remove("done");
        }, 1600);
      }

      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:-1000px;opacity:0;";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); } catch (e) { /* silent */ }
        document.body.removeChild(ta);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
    });
  });
})();
