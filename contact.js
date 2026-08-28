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

  function open() {
    lastFocus = document.activeElement;
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
