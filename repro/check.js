// Pushes one dataLayer event and reports whether a Google Ads conversion request left the browser.
// Note: this sends a real conversion hit to the Ads account. Use a fake gclid so it cannot be attributed.
(function () {
  var out = document.getElementById("out");
  function log(line) { out.textContent += line + "\n"; }

  function containers() {
    return Object.keys(window.google_tag_manager || {}).filter(function (k) { return /^GTM-/.test(k); });
  }

  document.getElementById("fire").addEventListener("click", function () {
    var event = document.getElementById("event").value.trim() || "generate_lead";
    var t0 = performance.now();
    log("Containers loaded: " + (containers().join(", ") || "none"));
    log("_gcl_aw cookie: " + ((document.cookie.match(/_gcl_aw=[^;]+/) || ["missing"])[0]));
    log("Pushing event: " + event);
    window.dataLayer.push({ event: event });

    setTimeout(function () {
      var hits = performance.getEntriesByType("resource").filter(function (r) {
        return r.startTime > t0 && r.name.indexOf("/pagead/conversion/") !== -1;
      });
      if (!hits.length) {
        log("RESULT: NO conversion request sent");
        return;
      }
      hits.forEach(function (r) {
        var p = new URL(r.name).searchParams;
        log("RESULT: conversion request sent, label=" + p.get("label") + ", gclaw=" + p.get("gclaw"));
      });
    }, 6000);
  });
})();
