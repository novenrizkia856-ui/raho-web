/* Runs before first paint: turns on motion classes and restores the chosen mode. */
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  try {
    var mode = localStorage.getItem("raho.mode");
    if (mode === "drawing" || mode === "blueprint") root.setAttribute("data-mode", mode);
  } catch (e) {
    /* Storage blocked: keep the default blueprint mode. */
  }
})();
