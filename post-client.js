(function (global) {
  'use strict';
  function request(baseUrl, params, timeoutMs, callback) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/(exec|dev)$/.test(baseUrl)) {
      callback(new Error('接続先が正しくありません'));
      return;
    }
    var bytes = new Uint8Array(16);
    global.crypto.getRandomValues(bytes);
    var requestId = Array.prototype.map.call(bytes, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
    var frame = document.createElement('iframe');
    var form = document.createElement('form');
    var timer;
    var completed = false;
    frame.name = 'reservation_' + requestId;
    frame.hidden = true;
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('aria-hidden', 'true');
    form.method = 'post';
    form.action = baseUrl;
    form.target = frame.name;
    form.hidden = true;
    Object.keys(params).concat(['frame_request_id']).forEach(function (key) {
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = key === 'frame_request_id' ? requestId : String(params[key] == null ? '' : params[key]);
      form.appendChild(input);
    });
    function finish(error, result) {
      if (completed) return;
      completed = true;
      global.clearTimeout(timer);
      global.removeEventListener('message', receive);
      if (form.parentNode) form.parentNode.removeChild(form);
      if (frame.parentNode) frame.parentNode.removeChild(frame);
      callback(error, result);
    }
    function belongsToRequest(source) {
      // event.source is the inner Google sandbox, not necessarily the outer frame.
      try {
        for (var depth = 0; source && depth < 10; depth++) {
          if (source === frame.contentWindow) return true;
          if (source === source.parent) return false;
          source = source.parent;
        }
      } catch (ignored) {}
      return false;
    }
    function receive(event) {
      if (!/^https:\/\/([a-z0-9-]+\.)*googleusercontent\.com$/.test(event.origin)
          && event.origin !== 'https://script.google.com') return;
      var message = event.data;
      if (!message || message.type !== 'reservation-api-response'
          || message.requestId !== requestId || !belongsToRequest(event.source)) return;
      finish(null, message.data);
    }
    global.addEventListener('message', receive);
    timer = global.setTimeout(function () {
      finish(new Error('通信がタイムアウトしました。処理結果をご確認ください。'));
    }, timeoutMs);
    document.body.appendChild(frame);
    document.body.appendChild(form);
    try { form.submit(); } catch (error) { finish(error); }
  }
  global.ReservationPostClient = { request: request };
})(window);
