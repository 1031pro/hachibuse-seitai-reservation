(function (global) {
  'use strict';
  var until = Date.parse('2026-09-10T00:00:00+09:00');
  var initialStart = now(); // HTML parsed through the loading section; before LIFF SDK download.
  var initial = true;
  var liffStarted = 0;
  var liffMs = 0;
  var hidden = document.visibilityState === 'hidden';
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') hidden = true;
  });
  function now() { return global.performance.now(); }
  global.ReservationDiagnostics = {
    startLiff: function () { liffStarted = now(); },
    endLiff: function () { liffMs = now() - liffStarted; },
    begin: function () {
      if (Date.now() >= until || (global.RESERVATION_CONFIG || {}).SCREEN_REVIEW_MODE) return null;
      var sample = {start:initial ? initialStart : now(), liffMs:initial ? liffMs : 0};
      initial = false;
      return sample;
    },
    finish: function (sample, success, metadata, renderStart, token) {
      if (!sample || !metadata || !metadata.requestId || !token) return;
      // Two animation frames approximate a rendering opportunity, not physical screen paint.
      global.requestAnimationFrame(function () {
        global.requestAnimationFrame(function () {
          var end = now();
          var params = {
            action:'clientPerformance', access_token:token, source_request_id:metadata.requestId,
            result:success ? 'success' : 'error', backgrounded:String(hidden),
            pageMs:Math.round(end), loadingMs:Math.round(end-sample.start),
            liffMs:Math.round(sample.liffMs), apiMs:metadata.durationMs,
            renderMs:Math.round(end-renderStart), attempts:metadata.attempts
          };
          // Upload after rendering, once only; telemetry failure never changes the screen.
          global.setTimeout(function () {
            try {
              global.ReservationApiClient.request(global.RESERVATION_CONFIG.GAS_WEBAPP_URL,
                params, function () {}, {timeoutMs:10000, maxAttempts:1});
            } catch (e) { /* Best effort, without logging credentials. */ }
          }, 0);
        });
      });
    },
    now:now
  };
})(window);
