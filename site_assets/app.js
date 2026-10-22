/* GOLD1 — table filter + accessible row count. No dependencies. */
(function () {
  "use strict";

  function normalise(value) {
    return (value || "").toLowerCase().trim();
  }

  function applyFilter(input) {
    var tableId = input.getAttribute("data-filter");
    var table = document.getElementById(tableId);
    if (!table) return;
    var query = normalise(input.value);
    var rows = table.querySelectorAll("tbody tr");
    var shown = 0;

    rows.forEach(function (row) {
      var match = query === "" || normalise(row.textContent).indexOf(query) !== -1;
      row.style.display = match ? "" : "none";
      if (match) shown += 1;
    });

    var counter = document.querySelector('[data-count-for="' + tableId + '"]');
    if (counter) {
      counter.textContent = query === ""
        ? rows.length + " rows"
        : shown + " of " + rows.length + " rows match";
    }
  }

  document.querySelectorAll("input[data-filter]").forEach(function (input) {
    applyFilter(input);
    input.addEventListener("input", function () { applyFilter(input); });
    input.addEventListener("search", function () { applyFilter(input); });
  });

  /* Keep table rows keyboard-scrollable on small screens */
  document.querySelectorAll(".table-scroll").forEach(function (el) {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  });
})();
