(function () {
  var config = window.RESERVATION_CONFIG || {};
  var loginView = document.getElementById('loginView');
  var dashboard = document.getElementById('dashboard');
  var loader = document.getElementById('loader');
  var reservationRows = document.getElementById('reservationRows');
  var adminKeyInput = document.getElementById('adminKey');
  var loginError = document.getElementById('loginError');

  var state = {
    key: '',
    reservations: []
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-config]').forEach(function (el) {
      var key = el.getAttribute('data-config');
      if (config[key]) el.textContent = config[key];
    });

    document.getElementById('loginButton').addEventListener('click', login);
    document.getElementById('refreshButton').addEventListener('click', loadAll);
    document.getElementById('logoutButton').addEventListener('click', logout);
    document.getElementById('statusFilter').addEventListener('change', renderReservations);
    document.getElementById('dateFilter').addEventListener('change', renderReservations);
    document.getElementById('searchInput').addEventListener('input', renderReservations);
    var saved = sessionStorage.getItem(config.ADMIN_SESSION_KEY || 'reservationAdminKey');
    if (saved) {
      adminKeyInput.value = saved;
      login();
    }
  });

  function hasApiUrl() {
    return config.GAS_WEBAPP_URL && config.GAS_WEBAPP_URL.indexOf('__') !== 0;
  }

  function login() {
    var key = adminKeyInput.value.trim();
    if (!key) return;
    state.key = key;
    showLoader(true);
    callApi({ action: 'adminList', key: key }, function (err, data) {
      showLoader(false);
      if (err || !data || data.error) {
        loginError.textContent = data && data.error ? data.error : '通信エラーが発生しました';
        loginError.style.display = 'block';
        return;
      }
      sessionStorage.setItem(config.ADMIN_SESSION_KEY || 'reservationAdminKey', key);
      loginError.style.display = 'none';
      loginView.style.display = 'none';
      dashboard.style.display = 'block';
      state.reservations = data.reservations || [];
      renderReservations();
    });
  }

  function logout() {
    sessionStorage.removeItem(config.ADMIN_SESSION_KEY || 'reservationAdminKey');
    location.reload();
  }

  function loadAll() {
    showLoader(true);
    callApi({ action: 'adminList', key: state.key }, function (err, data) {
      showLoader(false);
      if (err || !data || data.error) {
        alert(data && data.error ? data.error : '取得に失敗しました');
        return;
      }
      state.reservations = data.reservations || [];
      renderReservations();
    });
  }

  function renderReservations() {
    var status = document.getElementById('statusFilter').value;
    var date = document.getElementById('dateFilter').value;
    var query = document.getElementById('searchInput').value.trim().toLowerCase();

    var rows = state.reservations.filter(function (item) {
      if (status === 'active' && item.status === 'キャンセル') return false;
      if (status === 'cancelled' && item.status !== 'キャンセル') return false;
      if (date && item.date !== date) return false;
      if (query) {
        var haystack = [item.reservationId, item.name, item.phone, item.email, item.menuName].join(' ').toLowerCase();
        if (haystack.indexOf(query) < 0) return false;
      }
      return true;
    });

    if (!rows.length) {
      reservationRows.innerHTML = '<tr><td class="empty" colspan="9">該当する予約はありません</td></tr>';
      return;
    }

    reservationRows.innerHTML = rows.map(function (item) {
      var cancelled = item.status === 'キャンセル';
      return '<tr>'
        + '<td>' + escapeHtml(item.reservationId) + '</td>'
        + '<td>' + escapeHtml(item.date) + '</td>'
        + '<td>' + escapeHtml(item.time) + '</td>'
        + '<td>' + escapeHtml(item.menuName || '-') + '<br><small>' + escapeHtml(item.durationMinutes || '') + '分</small></td>'
        + '<td>' + escapeHtml(item.name) + '</td>'
        + '<td>' + escapeHtml(item.phone) + '<br><small>' + escapeHtml(item.email || '') + '</small></td>'
        + '<td>' + escapeHtml(item.payment || '-') + (item.price ? '<br><small>' + Number(item.price).toLocaleString() + '円</small>' : '') + '</td>'
        + '<td><span class="status ' + (cancelled ? 'cancelled' : '') + '">' + escapeHtml(item.status || '-') + '</span></td>'
        + '<td>' + (cancelled ? '-' : '<button class="danger" type="button" data-cancel="' + escapeHtml(item.reservationId) + '" data-cancel-name="' + escapeAttr(item.name || '') + '">キャンセル</button>') + '</td>'
        + '</tr>';
    }).join('');

    reservationRows.querySelectorAll('[data-cancel]').forEach(function (button) {
      button.addEventListener('click', function () {
        cancelReservation(
          button.getAttribute('data-cancel'),
          button.getAttribute('data-cancel-name')
        );
      });
    });
  }

  function cancelReservation(reservationId, reservationName) {
    if (!confirm(reservationName + '（' + reservationId + '）をキャンセルしますか？')) return;
    showLoader(true);
    callApi({
      action: 'adminCancel',
      key: state.key,
      reservation_id: reservationId
    }, function (err, data) {
      showLoader(false);
      if (err || !data || data.error) {
        alert(data && data.error ? data.error : (err && err.message ? err.message : '取消結果を確認できませんでした。一覧を更新してご確認ください。'));
        return;
      }
      if (data.lineNotificationSent) {
        alert('キャンセルしました。お客様へLINE通知を送信しました。');
      } else if (data.lineNotificationAvailable) {
        alert('キャンセルしましたが、LINE通知の送信に失敗しました。電話またはメールでご連絡ください。');
      } else {
        alert('キャンセルしました。LINE通知先がない予約のため、電話またはメールでご連絡ください。');
      }
      loadAll();
    });
  }

  function callApi(params, callback) {
    if (!hasApiUrl()) {
      window.setTimeout(function () {
        callback(null, mockApi(params));
      }, 250);
      return;
    }
    window.ReservationApiClient.request(
      config.GAS_WEBAPP_URL,
      params,
      callback,
      {
        timeoutMs: 15000,
        maxAttempts: params.action === 'adminList' ? 2 : 1,
        retryDelayMs: 500,
        retryOnErrorResponse: false
      }
    );
  }

  function mockApi(params) {
    if (params.action === 'adminCancel') return { success: true };
    return {
      success: true,
      reservations: [
        {
          reservationId: 'RSV20260618001',
          date: '2026-06-18',
          time: '10:00',
          menuName: '整体',
          durationMinutes: 60,
          name: '山田 花子',
          phone: '09012345678',
          email: 'sample@example.com',
          payment: '当日支払い',
          price: 0,
          status: '確定'
        }
      ]
    };
  }

  function showLoader(show) {
    loader.style.display = show ? 'grid' : 'none';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }
})();
