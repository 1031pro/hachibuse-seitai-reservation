window.RESERVATION_CONFIG = {
  GAS_WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbx4hWFUdXqeKM2CNN8B-oXJJxnDUlrVcQdhaybqddwTNKxMkp34eLXo4k4Hvq5cxvFEBw/exec',
  LIFF_ID: '2011264157-zCt4A73V',

  STORE_NAME: '蜂伏整体院',
  HEADER_SUBTITLE: '予約受付',
  RESERVATION_NOTICE: '',

  SERVICE_NAME: '整体コース',
  SERVICE_DURATION_LABEL: '30分〜90分',
  MENU_SELECTION_ENABLED: true,
  EXTENSION_SELECTION_ENABLED: false,
  SLOT_SCREEN_IDLE_TIMEOUT_MS: 10 * 60 * 1000,
  MENUS: [
    { id: 'seitai_30', name: '30分コース', durationMinutes: 30, durationLabel: '30分', price: 2500, description: '施術時間30分' },
    { id: 'seitai_45', name: '45分コース', durationMinutes: 45, durationLabel: '45分', price: 3800, description: '施術時間45分' },
    { id: 'seitai_60', name: '60分コース', durationMinutes: 60, durationLabel: '60分', price: 5000, description: '施術時間60分' },
    { id: 'seitai_90', name: '90分コース', durationMinutes: 90, durationLabel: '90分', price: 7000, description: '施術時間90分' }
  ],
  PAYMENT_MODE: 'none',
  PAYMENT_LABEL: '事前カード決済',
  ONSITE_PAYMENT_LABEL: '当日支払い',
  ADMIN_SESSION_KEY: 'reservationAdminKey'
};
