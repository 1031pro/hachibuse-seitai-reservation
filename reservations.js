(function () {
  'use strict';

  var config = window.RESERVATION_CONFIG || {};
  var loadingState = document.getElementById('loadingState');
  var reservationState = document.getElementById('reservationState');
  var reservationList = document.getElementById('reservationList');
  var cancellationPolicy = document.getElementById('cancellationPolicy');
  var emptyState = document.getElementById('emptyState');
  var errorState = document.getElementById('errorState');
  var errorMessage = document.getElementById('errorMessage');
  var cancelledState = document.getElementById('cancelledState');
  var cancelledSummary = document.getElementById('cancelledSummary');
  var rebookLink = document.getElementById('rebookLink');
  var cancelModal = document.getElementById('cancelModal');
  var cancelModalSummary = document.getElementById('cancelModalSummary');
  var cancelConfirmButton = document.getElementById('cancelConfirmButton');
  var previewNotice = document.getElementById('previewNotice');
  var toast = document.getElementById('toast');
  var selectedReservation = null;
  var accessToken = '';
  var toastTimer = null;

  document.addEventListener('DOMContentLoaded', function () {
    applyConfigText();
    bindEvents();
    if (config.SCREEN_REVIEW_MODE) {
      previewNotice.hidden = false;
      renderReservations(buildReviewReservations());
      return;
    }
    initializeLineAndLoad();
  });

  function applyConfigText() {
    document.querySelectorAll('[data-config]').forEach(function (element) {
      var key = element.getAttribute('data-config');
      if (Object.prototype.hasOwnProperty.call(config, key)) {
        element.textContent = config[key] || '';
      }
    });
  }

  function bindEvents() {
    document.getElementById('retryButton').addEventListener('click', loadReservations);
    document.getElementById('cancelModalClose').addEventListener('click', closeCancelModal);
    document.getElementById('backToListButton').addEventListener('click', loadReservations);
    document.getElementById('closeButton').addEventListener('click', closeWindow);
    cancelConfirmButton.addEventListener('click', confirmCancellation);
    cancelModal.addEventListener('click', function (event) {
      if (event.target === cancelModal) closeCancelModal();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !cancelModal.hidden) closeCancelModal();
    });
  }

  function initializeLineAndLoad() {
    showOnly('loading');
    if (!config.LIFF_ID || typeof liff === 'undefined') {
      showError('LINEから開き直してください。');
      return;
    }
    liff.init({ liffId: config.LIFF_ID }).then(function () {
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }
      accessToken = liff.getAccessToken() || '';
      if (!accessToken) {
        showError('LINEでの本人確認ができませんでした。');
        return;
      }
      loadReservations();
    }).catch(function () {
      showError('LINEから開き直してください。');
    });
  }

  function loadReservations() {
    closeCancelModal();
    showOnly('loading');
    if (config.SCREEN_REVIEW_MODE) {
      window.setTimeout(function () {
        renderReservations(buildReviewReservations());
      }, 250);
      return;
    }
    callApi({
      action: 'customerReservations',
      access_token: accessToken
    }, function (err, data) {
      if (err || !data || !data.success) {
        showError(data && (data.error || data.message)
          ? (data.error || data.message)
          : '時間をおいて、もう一度お試しください。');
        return;
      }
      renderReservations(data.reservations || []);
    });
  }

  function renderReservations(reservations) {
    reservationList.innerHTML = '';
    if (!reservations.length) {
      showOnly('empty');
      return;
    }

    cancellationPolicy.textContent = 'お客様によるキャンセルは、施術開始の'
      + (Number(config.CUSTOMER_CANCELLATION_CUTOFF_HOURS) || 6)
      + '時間前まで受け付けています。';
    reservations.forEach(function (reservation) {
      var card = document.createElement('article');
      card.className = 'reservation-card';
      var price = reservation.price ? Number(reservation.price).toLocaleString() + '円' : '';
      var range = window.ReservationTime.formatDateTimeRange(
        reservation.displayDate,
        reservation.time,
        reservation.durationMinutes
      );
      var actionHtml = reservation.canCancel
        ? '<button class="cancel-button" type="button">この予約をキャンセルする</button>'
        : '<p class="reservation-card__deadline">キャンセル期限を過ぎています。<br>公式LINEからお問い合わせください。</p>';
      card.innerHTML = '<div class="reservation-card__head">'
        + '<span>予約番号 ' + escapeHtml(reservation.reservationId) + '</span>'
        + '<strong>予約済み</strong>'
        + '</div>'
        + '<dl class="reservation-card__details">'
        + '<div><dt>日時</dt><dd>' + escapeHtml(range) + '</dd></div>'
        + '<div><dt>メニュー</dt><dd>' + escapeHtml(reservation.menuName) + '</dd></div>'
        + (price ? '<div><dt>料金</dt><dd>' + escapeHtml(price) + '</dd></div>' : '')
        + '</dl>'
        + actionHtml;
      var cancelButton = card.querySelector('.cancel-button');
      if (cancelButton) {
        cancelButton.addEventListener('click', function () {
          openCancelModal(reservation, range);
        });
      }
      reservationList.appendChild(card);
    });
    showOnly('reservations');
  }

  function openCancelModal(reservation, range) {
    selectedReservation = reservation;
    cancelModalSummary.textContent = range + '　' + reservation.menuName;
    cancelModal.hidden = false;
    cancelConfirmButton.disabled = false;
    cancelConfirmButton.textContent = 'キャンセルする';
    cancelConfirmButton.focus();
  }

  function closeCancelModal() {
    cancelModal.hidden = true;
    selectedReservation = null;
  }

  function confirmCancellation() {
    if (!selectedReservation) return;
    var reservation = selectedReservation;
    cancelConfirmButton.disabled = true;
    cancelConfirmButton.textContent = '処理しています';

    if (config.SCREEN_REVIEW_MODE) {
      window.setTimeout(function () {
        closeCancelModal();
        showCancellationComplete(reservation);
      }, 350);
      return;
    }

    callApi({
      action: 'customerCancel',
      access_token: accessToken,
      reservation_id: reservation.reservationId
    }, function (err, data) {
      cancelConfirmButton.disabled = false;
      cancelConfirmButton.textContent = 'キャンセルする';
      if (err || !data || !data.success) {
        closeCancelModal();
        showToast(data && (data.error || data.message)
          ? (data.error || data.message)
          : 'キャンセル処理に失敗しました。');
        if (data && data.code === 'cancellation_deadline') loadReservations();
        return;
      }
      closeCancelModal();
      showCancellationComplete(reservation);
    });
  }

  function showCancellationComplete(reservation) {
    var range = window.ReservationTime.formatDateTimeRange(
      reservation.displayDate,
      reservation.time,
      reservation.durationMinutes
    );
    cancelledSummary.textContent = range + 'の' + reservation.menuName + 'をキャンセルしました。';
    rebookLink.href = 'index.html?menu_id=' + encodeURIComponent(reservation.menuId || '');
    showOnly('cancelled');
  }

  function callApi(params, callback) {
    if (!config.GAS_WEBAPP_URL || config.GAS_WEBAPP_URL.indexOf('__') === 0) {
      callback(new Error('API URLが未設定です'));
      return;
    }
    window.ReservationApiClient.request(config.GAS_WEBAPP_URL, params, callback, {
      timeoutMs: 15000,
      maxAttempts: params.action === 'customerCancel' ? 1 : 2,
      retryDelayMs: 500,
      retryOnErrorResponse: false
    });
  }

  function showOnly(name) {
    loadingState.hidden = name !== 'loading';
    reservationState.hidden = name !== 'reservations';
    emptyState.hidden = name !== 'empty';
    errorState.hidden = name !== 'error';
    cancelledState.hidden = name !== 'cancelled';
  }

  function showError(message) {
    errorMessage.textContent = message;
    showOnly('error');
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 3600);
  }

  function closeWindow() {
    if (typeof liff !== 'undefined' && liff.isInClient()) {
      liff.closeWindow();
    } else {
      window.close();
    }
  }

  function buildReviewReservations() {
    var date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(10, 0, 0, 0);
    var laterDate = new Date(date.getTime());
    laterDate.setDate(laterDate.getDate() + 1);
    return [{
      reservationId: '確認用予約',
      date: formatDateKey(date),
      time: '10:00',
      displayDate: formatJapaneseDate(date),
      menuId: 'seitai_60',
      menuName: '60分コース',
      durationMinutes: 60,
      price: 5000,
      canCancel: true
    }, {
      reservationId: '確認用・期限後',
      date: formatDateKey(laterDate),
      time: '14:00',
      displayDate: formatJapaneseDate(laterDate),
      menuId: 'seitai_30',
      menuName: '30分コース',
      durationMinutes: 30,
      price: 2500,
      canCancel: false
    }];
  }

  function formatDateKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function formatJapaneseDate(date) {
    var weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate()
      + '日（' + weekdays[date.getDay()] + '）';
  }

  function pad(value) {
    return ('0' + value).slice(-2);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }
})();
