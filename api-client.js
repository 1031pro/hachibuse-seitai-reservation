(function (global) {
  'use strict';

  function request(baseUrl, params, callback, options) {
    var settings = options || {};
    var timeoutMs = Math.max(1000, parseInt(settings.timeoutMs || '15000', 10));
    var maxAttempts = Math.max(1, parseInt(settings.maxAttempts || '1', 10));
    var retryDelayMs = Math.max(0, parseInt(settings.retryDelayMs || '500', 10));
    var retryOnErrorResponse = settings.retryOnErrorResponse === true;
    var attempt = 0;
    var requestStartedAt = Date.now();

    function runAttempt() {
      attempt += 1;
      requestOnce(baseUrl, params, timeoutMs, function (err, data) {
        var shouldRetry = attempt < maxAttempts && (
          !!err || !!(retryOnErrorResponse && data && data.error)
        );

        if (shouldRetry) {
          console.warn('[reservation-api] retry', {
            action: params.action || '',
            attempt: attempt,
            reason: err ? err.message : String(data.error || '')
          });
          global.setTimeout(runAttempt, retryDelayMs);
          return;
        }

        callback(err, data, {
          attempts: attempt,
          durationMs: Date.now() - requestStartedAt
        });
      });
    }

    runAttempt();
  }

  function requestOnce(baseUrl, params, timeoutMs, callback) {
    var requestId = 'reservation_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    var frameName = requestId + '_frame';
    var frame = document.createElement('iframe');
    var form = document.createElement('form');
    var completed = false;
    var timer = null;

    frame.name = frameName;
    frame.hidden = true;
    frame.setAttribute('aria-hidden', 'true');
    form.method = 'post';
    form.action = baseUrl;
    form.target = frameName;
    form.hidden = true;

    var bodyParams = {};
    Object.keys(params).forEach(function (key) {
      bodyParams[key] = params[key];
    });
    bodyParams.frame_request_id = requestId;
    Object.keys(bodyParams).forEach(function (key) {
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = String(bodyParams[key] == null ? '' : bodyParams[key]);
      form.appendChild(input);
    });

    function cleanup() {
      if (timer !== null) global.clearTimeout(timer);
      global.removeEventListener('message', handleMessage);
      if (form.parentNode) form.parentNode.removeChild(form);
      if (frame.parentNode) frame.parentNode.removeChild(frame);
    }

    function finish(err, data) {
      if (completed) return;
      completed = true;
      cleanup();
      callback(err, data);
    }

    function isTrustedAppsScriptOrigin(origin) {
      return origin === 'https://script.google.com' || /^https:\/\/[^/]+\.googleusercontent\.com$/.test(origin);
    }

    function handleMessage(event) {
      if (!isTrustedAppsScriptOrigin(event.origin)) return;
      var message = event.data || {};
      if (message.type !== 'reservation-api-response' || message.requestId !== requestId) return;
      finish(null, message.data);
    }

    global.addEventListener('message', handleMessage);
    timer = global.setTimeout(function () {
      finish(new Error('通信がタイムアウトしました'));
    }, timeoutMs);
    document.body.appendChild(frame);
    document.body.appendChild(form);
    form.submit();
  }

  global.ReservationApiClient = {
    request: request
  };
})(window);
