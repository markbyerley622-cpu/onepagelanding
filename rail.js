/* ==========================================================================
   DRK — category rail
   On a pointer device the note is the reward for hovering. There is no hover
   on a phone, so there the rail is tapped open instead: one note at a time,
   and the anchor never navigates away from the panel.
   ========================================================================== */

(function () {
  "use strict";

  var links = document.querySelectorAll(".nav-col a[data-accent]");
  if (!links.length) return;

  /* matches the breakpoint the stacked layout uses in styles.css */
  var stacked = window.matchMedia("(max-width:860px), (max-aspect-ratio:1/1)");

  Array.prototype.forEach.call(links, function (a) {
    a.setAttribute("aria-expanded", "false");

    a.addEventListener("click", function (ev) {
      if (!stacked.matches) return;      /* desktop keeps the hover behaviour */

      ev.preventDefault();
      var was = a.classList.contains("is-open");

      Array.prototype.forEach.call(links, function (other) {
        other.classList.remove("is-open");
        other.setAttribute("aria-expanded", "false");
      });

      if (!was) {
        a.classList.add("is-open");
        a.setAttribute("aria-expanded", "true");
      }
    });
  });

  /* rotating a phone into landscape hands the rail back to hover */
  function reset() {
    if (stacked.matches) return;
    Array.prototype.forEach.call(links, function (a) {
      a.classList.remove("is-open");
      a.setAttribute("aria-expanded", "false");
    });
  }
  if (stacked.addEventListener) stacked.addEventListener("change", reset);
  else if (stacked.addListener) stacked.addListener(reset);
})();
