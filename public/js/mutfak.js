/**
 * ALİ BABA DÖNER KAFE - MUTFAK EKRANI (KDS) JAVASCRIPT
 * Real-time Kitchen Display System with Web Audio API sound synthesis,
 * minute-based color-changing elapsed timers, and workflow state management.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. WEB AUDIO API SYNTHESIZER ENGINE
  // ==========================================================================
  class KitchenAudioSynthesizer {
    constructor() {
      this.ctx = null;
      this.soundEnabled = localStorage.getItem('kds_sound_enabled') !== 'false';
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    /**
     * Primary Kitchen Service Bell / Order Bell (Brass/Metal Chime)
     * Rich harmonic tones with long exponential decay
     */
    playKitchenBell() {
      if (!this.soundEnabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const master = this.ctx.createGain();
      master.connect(this.ctx.destination);
      master.gain.setValueAtTime(0.45, now);

      // 1. Fundamental Strike (G6 - 1568Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1567.98, now);
      gain1.gain.setValueAtTime(0.7, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
      osc1.connect(gain1);
      gain1.connect(master);
      osc1.start(now);
      osc1.stop(now + 1.6);

      // 2. High Shimmer Transient (E7 - 2637Hz)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(2637.02, now);
      gain2.gain.setValueAtTime(0.4, now);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(master);
      osc2.start(now);
      osc2.stop(now + 0.9);

      // 3. Metallic Overtones (G7 - 3136Hz)
      const osc3 = this.ctx.createOscillator();
      const gain3 = this.ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(3135.96, now);
      gain3.gain.setValueAtTime(0.35, now);
      gain3.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
      osc3.connect(gain3);
      gain3.connect(master);
      osc3.start(now);
      osc3.stop(now + 1.3);

      // Trigger visual sound wave animation
      triggerSoundWaveAnimation();
    }

    /**
     * Urgent Overdue Alert Tone (Double Warning Beep for orders > 10 min)
     */
    playUrgentAlert() {
      if (!this.soundEnabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const playBeep = (freq, start, dur) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      };

      playBeep(880, now, 0.15);
      playBeep(1174, now + 0.18, 0.25);
      triggerSoundWaveAnimation();
    }

    /**
     * Cheerful Order Ready Chime (Ding-Dong)
     */
    playOrderCompleted() {
      if (!this.soundEnabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const chime = (freq, start, dur) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      };

      chime(587.33, now, 0.3);        // D5
      chime(880, now + 0.15, 0.6);     // A5
      triggerSoundWaveAnimation();
    }
  }

  const audioSynth = new KitchenAudioSynthesizer();

  // ==========================================================================
  // 2. STATE & CONFIGURATION
  // ==========================================================================
  let kdsState = {
    token: localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token') || '',
    pin: localStorage.getItem('kds_pin') || sessionStorage.getItem('kds_pin') || '',
    orders: [],
    summary: {
      pendingCount: 0,
      preparingCount: 0,
      activeCount: 0,
      completedTodayCount: 0,
      avgPrepMinutes: 0
    },
    tableCount: 20,
    currentFilter: 'active', // 'active' | 'pending' | 'preparing' | 'completed'
    selectedTable: 'all',
    enteredPin: '',
    sseSource: null,
    alertedOrders: new Set() // Prevent repeating urgent bell on every second
  };

  const QUICK_MENU_ITEMS = [
    'Tavuk Döner Dürüm',
    'Et Döner Dürüm',
    'Tombik Döner',
    'Ekmek Arası Döner',
    'Pilav Üstü Döner',
    'Patates Kızartması',
    'Ayran',
    'Kola'
  ];

  // ==========================================================================
  // 3. INITIALIZATION & AUTHENTICATION
  // ==========================================================================
  window.addEventListener('DOMContentLoaded', () => {
    initClock();
    initSoundToggle();
    initQuickChips();

    // Check saved PIN or token
    if (kdsState.pin || kdsState.token) {
      verifyAndLoadState();
    } else {
      showAuthOverlay();
    }

    // Global click listener to unlock Web Audio API audioContext
    document.addEventListener('click', () => {
      audioSynth.init();
    }, { once: true });
  });

  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (kdsState.token) {
      headers['Authorization'] = 'Bearer ' + kdsState.token;
    }
    if (kdsState.pin) {
      headers['x-staff-pin'] = kdsState.pin;
    }
    return headers;
  }

  function showAuthOverlay() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.add('active');
    kdsState.enteredPin = '';
    renderPinDots();
  }

  function hideAuthOverlay() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.remove('active');
    const err = document.getElementById('auth-error-msg');
    if (err) err.textContent = '';
  }

  window.pressPin = function (digit) {
    if (kdsState.enteredPin.length < 4) {
      kdsState.enteredPin += digit;
      renderPinDots();
      if (kdsState.enteredPin.length === 4) {
        submitPin(kdsState.enteredPin);
      }
    }
  };

  window.clearPin = function () {
    kdsState.enteredPin = '';
    renderPinDots();
  };

  window.backspacePin = function () {
    kdsState.enteredPin = kdsState.enteredPin.slice(0, -1);
    renderPinDots();
  };

  function renderPinDots() {
    const dots = document.querySelectorAll('#pin-dots .dot');
    dots.forEach((dot, idx) => {
      if (idx < kdsState.enteredPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }

  async function submitPin(pin) {
    kdsState.pin = pin;
    const ok = await verifyAndLoadState();
    if (ok) {
      localStorage.setItem('kds_pin', pin);
      hideAuthOverlay();
      showToast('Giriş başarılı. Mutfak Ekranı aktif!', 'success');
    } else {
      kdsState.pin = '';
      kdsState.enteredPin = '';
      renderPinDots();
      const err = document.getElementById('auth-error-msg');
      if (err) err.textContent = 'Hatalı PIN! Lütfen tekrar deneyin.';
    }
  }

  window.lockKds = function () {
    localStorage.removeItem('kds_pin');
    sessionStorage.removeItem('kds_pin');
    kdsState.pin = '';
    kdsState.enteredPin = '';
    showAuthOverlay();
  };

  // ==========================================================================
  // 4. DATA FETCHING & SERVER-SENT EVENTS (SSE)
  // ==========================================================================
  async function verifyAndLoadState() {
    try {
      const res = await fetch('/api/kds/state', {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        if (res.status === 401) {
          showAuthOverlay();
          return false;
        }
        throw new Error('KDS state alınamadı (HTTP ' + res.status + ')');
      }

      const json = await res.json();
      if (json.success && json.data) {
        kdsState.orders = json.data.orders || [];
        kdsState.summary = json.data.summary || kdsState.summary;
        kdsState.tableCount = json.data.tableCount || 20;

        if (json.data.restaurantName) {
          const el = document.getElementById('kds-restaurant-name');
          if (el) el.textContent = json.data.restaurantName;
        }

        populateTableFilter(kdsState.tableCount);
        renderMetrics();
        renderTicketsGrid();
        startTimerLoop();
        initSSE();
        hideAuthOverlay();
        return true;
      }
      return false;
    } catch (err) {
      console.error('KDS yükleme hatası:', err);
      showAuthOverlay();
      return false;
    }
  }

  function initSSE() {
    if (kdsState.sseSource) {
      kdsState.sseSource.close();
    }

    const sseUrl = `/api/notifications/stream?pin=${encodeURIComponent(kdsState.pin || '1234')}&token=${encodeURIComponent(kdsState.token || '')}`;
    const source = new EventSource(sseUrl);
    kdsState.sseSource = source;

    source.onopen = () => {
      updateSseStatus(true);
    };

    source.onerror = () => {
      updateSseStatus(false);
    };

    // 1. New Kitchen Ticket Created
    source.addEventListener('kds_order_created', (e) => {
      try {
        const ticket = JSON.parse(e.data);
        handleNewKitchenTicket(ticket);
      } catch (err) {
        console.error('SSE ticket parse error:', err);
      }
    });

    // 2. Kitchen Ticket Updated (Status changed, item toggled, etc.)
    source.addEventListener('kds_order_updated', (e) => {
      try {
        const ticket = JSON.parse(e.data);
        handleUpdatedKitchenTicket(ticket);
      } catch (err) {
        console.error('SSE ticket update error:', err);
      }
    });

    // 3. Completed Orders Cleared
    source.addEventListener('kds_orders_cleared', () => {
      kdsState.orders = kdsState.orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
      renderMetrics();
      renderTicketsGrid();
      showToast('Tamamlanan siparişler temizlendi.', 'info');
    });

    // 4. Fallback: Standard order notification created from QR menu
    source.addEventListener('notification_created', (e) => {
      try {
        const notif = JSON.parse(e.data);
        if (notif && typeof notif.id === 'string' && notif.id.startsWith('order_')) {
          // If ticket was already created via kds_order_created, it is handled; otherwise reload
          setTimeout(verifyAndLoadState, 300);
        }
      } catch (err) {
        console.error('SSE notif parse error:', err);
      }
    });
  }

  function updateSseStatus(connected) {
    const pill = document.getElementById('sse-pill');
    const text = document.getElementById('sse-status-text');
    if (!pill || !text) return;

    if (connected) {
      pill.style.background = '#064e3b';
      pill.style.color = '#34d399';
      pill.style.borderColor = '#10b981';
      text.textContent = 'Canlı SSE';
    } else {
      pill.style.background = '#450a0a';
      pill.style.color = '#f87171';
      pill.style.borderColor = '#ef4444';
      text.textContent = 'Yeniden Bağlanıyor...';
    }
  }

  function handleNewKitchenTicket(ticket) {
    // Add ticket to state if not exists
    const idx = kdsState.orders.findIndex(o => o.id === ticket.id);
    if (idx === -1) {
      kdsState.orders.unshift(ticket);
    } else {
      kdsState.orders[idx] = ticket;
    }

    // Play loud, crisp Kitchen Bell via Web Audio API!
    audioSynth.playKitchenBell();

    showToast(`🔔 ${ticket.tableName} (${ticket.ticketNumber}) yeni sipariş geldi!`, 'bell');
    renderMetrics();
    renderTicketsGrid();
  }

  function handleUpdatedKitchenTicket(ticket) {
    const idx = kdsState.orders.findIndex(o => o.id === ticket.id);
    if (idx !== -1) {
      kdsState.orders[idx] = ticket;
    } else {
      kdsState.orders.unshift(ticket);
    }
    renderMetrics();
    renderTicketsGrid();
  }

  // ==========================================================================
  // 5. WORKFLOW ACTIONS ("Hazırlamaya Başla" & "Tamamlandı")
  // ==========================================================================

  // Step 1: "Hazırlamaya Başla" (Pending -> Preparing)
  window.startOrder = async function (orderId) {
    // Optimistic UI update
    const order = kdsState.orders.find(o => o.id === orderId);
    if (order) {
      order.status = 'preparing';
      order.startedAt = Date.now();
      renderTicketsGrid();
      renderMetrics();
    }

    try {
      const res = await fetch(`/api/kds/orders/${orderId}/start`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Hazırlamaya başlama başarısız');
      }
      showToast(`${order ? order.tableName : 'Sipariş'} hazırlanmaya başlandı 👨‍🍳`, 'info');
    } catch (err) {
      console.error(err);
      showToast('İşlem başarısız: ' + err.message, 'error');
      verifyAndLoadState();
    }
  };

  // Step 2: "Tamamlandı" (Preparing -> Completed + Waiter Notification)
  window.completeOrder = async function (orderId) {
    const order = kdsState.orders.find(o => o.id === orderId);
    const now = Date.now();

    // Optimistic UI update
    if (order) {
      order.status = 'completed';
      order.completedAt = now;
      if (!order.startedAt) order.startedAt = now;
      if (Array.isArray(order.items)) {
        order.items.forEach(it => { it.completed = true; });
      }
      renderTicketsGrid();
      renderMetrics();
    }

    // Play cheerful chime
    audioSynth.playOrderCompleted();

    try {
      const res = await fetch(`/api/kds/orders/${orderId}/complete`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Tamamlama başarısız');
      }
      showToast(`✅ ${order ? order.tableName : 'Sipariş'} hazırlandı! Servise bildirildi.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('İşlem başarısız: ' + err.message, 'error');
      verifyAndLoadState();
    }
  };

  // Revert / Undo action
  window.revertOrder = async function (orderId) {
    try {
      const res = await fetch(`/api/kds/orders/${orderId}/revert`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Geri alma başarısız');
      }
      if (json.data) {
        handleUpdatedKitchenTicket(json.data);
      }
      showToast('Sipariş durumu geri alındı.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Geri alma hatası: ' + err.message, 'error');
    }
  };

  // Toggle item checkbox inside ticket
  window.toggleItemCheck = async function (orderId, itemId, event) {
    if (event) event.stopPropagation();

    const order = kdsState.orders.find(o => o.id === orderId);
    if (!order) return;
    const item = (order.items || []).find(it => it.id === itemId);
    if (item) {
      item.completed = !item.completed;
      renderTicketsGrid();
    }

    try {
      await fetch(`/api/kds/orders/${orderId}/items/${itemId}/toggle`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (err) {
      console.error('Item toggle err:', err);
    }
  };

  // Cancel order
  window.cancelOrder = async function (orderId) {
    if (!confirm('Bu mutfak fişini iptal etmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      const res = await fetch(`/api/kds/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: 'Mutfaktan iptal edildi' })
      });
      const json = await res.json();
      if (json.success && json.data) {
        handleUpdatedKitchenTicket(json.data);
      }
      showToast('Sipariş iptal edildi.', 'info');
    } catch (err) {
      showToast('İptal hatası: ' + err.message, 'error');
    }
  };

  // Clear completed orders history
  window.clearCompletedOrders = async function () {
    if (!confirm('Tamamlanan tüm geçmiş fişleri ekrandan temizlemek istiyor musunuz?')) {
      return;
    }

    try {
      const res = await fetch('/api/kds/clear-completed', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (json.success) {
        kdsState.orders = kdsState.orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
        renderMetrics();
        renderTicketsGrid();
        showToast(json.message || 'Tamamlananlar temizlendi.', 'success');
      }
    } catch (err) {
      showToast('Temizleme hatası: ' + err.message, 'error');
    }
  };

  // ==========================================================================
  // 6. LIVE TIMER ENGINE (SÜRE SAYACI)
  // Dakikaya göre renk değiştiren canlı sayaç mantığı
  // < 5 dk: Yeşil (Normal)
  // 5 - 10 dk: Sarı / Kehribar (Bekliyor)
  // > 10 dk: Kırmızı / Yanıp Sönen (Gecikti / Acil)
  // ==========================================================================
  let timerInterval = null;

  function startTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateAllCardTimers, 1000);
    updateAllCardTimers();
  }

  function formatDuration(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const remS = s % 60;
    const mm = m < 10 ? '0' + m : String(m);
    const ss = remS < 10 ? '0' + remS : String(remS);
    return `${mm}:${ss}`;
  }

  function getTimerCategory(elapsedMinutes) {
    if (elapsedMinutes < 5) {
      return {
        key: 'normal',
        className: 'state-normal',
        badgeText: 'Normal',
        badgeIcon: 'timer'
      };
    } else if (elapsedMinutes < 10) {
      return {
        key: 'warning',
        className: 'state-warning',
        badgeText: 'Bekliyor',
        badgeIcon: 'warning'
      };
    } else {
      return {
        key: 'urgent',
        className: 'state-urgent',
        badgeText: 'Gecikti / Acil!',
        badgeIcon: 'crisis_alert'
      };
    }
  }

  function updateAllCardTimers() {
    const now = Date.now();
    let hasUrgentOrder = false;

    const cards = document.querySelectorAll('.kds-ticket-card');
    cards.forEach(card => {
      const orderId = card.dataset.orderId;
      const order = kdsState.orders.find(o => o.id === orderId);
      if (!order) return;

      const timerDisplayEl = card.querySelector('.timer-display');
      const timerBadgeEl = card.querySelector('.timer-status-badge');

      if (order.status === 'completed') {
        const prepSec = order.completedAt && order.createdAt ? (order.completedAt - order.createdAt) / 1000 : 0;
        if (timerDisplayEl) timerDisplayEl.textContent = formatDuration(prepSec);
        if (timerBadgeEl) timerBadgeEl.textContent = '✅ Hazırlandı';
        card.classList.remove('state-normal', 'state-warning', 'state-urgent');
        card.classList.add('state-completed');
        return;
      }

      // Elapsed seconds since order created
      const elapsedSec = (now - (order.createdAt || now)) / 1000;
      const elapsedMinutes = elapsedSec / 60;
      const cat = getTimerCategory(elapsedMinutes);

      if (cat.key === 'urgent') {
        hasUrgentOrder = true;
        // Play urgent sound alert once per order
        if (!kdsState.alertedOrders.has(order.id)) {
          kdsState.alertedOrders.add(order.id);
          audioSynth.playUrgentAlert();
          showToast(`🚨 DİKKAT: ${order.tableName} ${order.ticketNumber} 10 dakikayı aştı!`, 'error');
        }
      }

      if (timerDisplayEl) {
        timerDisplayEl.textContent = formatDuration(elapsedSec);
      }

      if (timerBadgeEl) {
        timerBadgeEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;">${cat.badgeIcon}</span> ${cat.badgeText}`;
      }

      // Update card color classification
      card.classList.remove('state-normal', 'state-warning', 'state-urgent', 'state-completed');
      card.classList.add(cat.className);
    });

    // Urgent banner visibility
    const banner = document.getElementById('kds-urgent-banner');
    if (banner) {
      banner.style.display = hasUrgentOrder ? 'flex' : 'none';
    }
  }

  // ==========================================================================
  // 7. RENDERING & UI GENERATION
  // ==========================================================================
  function renderMetrics() {
    const orders = kdsState.orders || [];
    const pending = orders.filter(o => o.status === 'pending');
    const preparing = orders.filter(o => o.status === 'preparing');
    const active = orders.filter(o => o.status === 'pending' || o.status === 'preparing');
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    const completedToday = orders.filter(o => o.status === 'completed' && (o.completedAt || o.createdAt) >= startOfToday);

    // Update Header Metric Pills
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('metric-pending-count', pending.length);
    setTxt('metric-prep-count', preparing.length);
    setTxt('metric-done-count', completedToday.length);

    // Compute average prep duration
    let totalMs = 0;
    let validCount = 0;
    completedToday.forEach(o => {
      if (o.completedAt && o.createdAt) {
        totalMs += (o.completedAt - o.createdAt);
        validCount++;
      }
    });
    const avgM = validCount > 0 ? Math.round((totalMs / validCount / 60000) * 10) / 10 : 0;
    setTxt('metric-avg-time', `${avgM} dk`);

    // Tab badges
    setTxt('tab-badge-active', active.length);
    setTxt('tab-badge-pending', pending.length);
    setTxt('tab-badge-preparing', preparing.length);
    setTxt('tab-badge-completed', completedToday.length);

    // Clear completed button toggle
    const btnClear = document.getElementById('btn-clear-completed');
    if (btnClear) {
      btnClear.style.display = kdsState.currentFilter === 'completed' ? 'flex' : 'none';
    }
  }

  function renderTicketsGrid() {
    const container = document.getElementById('kds-cards-grid');
    const emptyState = document.getElementById('kds-empty-state');
    if (!container) return;

    // Filter orders according to current tab and table selection
    let filtered = (kdsState.orders || []).filter(o => o.status !== 'cancelled');

    if (kdsState.currentFilter === 'active') {
      filtered = filtered.filter(o => o.status === 'pending' || o.status === 'preparing');
    } else if (kdsState.currentFilter === 'pending') {
      filtered = filtered.filter(o => o.status === 'pending');
    } else if (kdsState.currentFilter === 'preparing') {
      filtered = filtered.filter(o => o.status === 'preparing');
    } else if (kdsState.currentFilter === 'completed') {
      filtered = filtered.filter(o => o.status === 'completed');
    }

    if (kdsState.selectedTable !== 'all') {
      filtered = filtered.filter(o => String(o.tableId) === String(kdsState.selectedTable));
    }

    // Sort: Urgent / older orders first for active views, newest first for completed
    if (kdsState.currentFilter === 'completed') {
      filtered.sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0));
    } else {
      filtered.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    }

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    const now = Date.now();
    const htmlCards = filtered.map(order => {
      const isCompleted = order.status === 'completed';
      const isPreparing = order.status === 'preparing';

      const elapsedSec = isCompleted
        ? ((order.completedAt || now) - (order.createdAt || now)) / 1000
        : (now - (order.createdAt || now)) / 1000;
      const cat = isCompleted ? { className: 'state-completed', badgeText: 'Hazırlandı', badgeIcon: 'check_circle' } : getTimerCategory(elapsedSec / 60);

      // Order Source Badge
      let sourceClass = 'source-qr';
      let sourceLabel = 'QR Sipariş';
      if (order.source === 'garson') { sourceClass = 'source-garson'; sourceLabel = 'Garson'; }
      else if (order.source === 'kasa') { sourceClass = 'source-kasa'; sourceLabel = 'Kasa'; }
      else if (order.source === 'manual') { sourceClass = 'source-manual'; sourceLabel = 'Manuel Fiş'; }

      // Format time
      const timeStr = order.createdAt ? new Date(order.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

      // Items list HTML
      const itemsHtml = (order.items || []).map(it => `
        <div class="kds-item-row ${it.completed ? 'item-checked' : ''}" onclick="toggleItemCheck('${order.id}', '${it.id}', event)">
          <div class="item-check-box">
            <span class="material-symbols-outlined item-check-icon">check</span>
          </div>
          <div class="item-info">
            <div class="item-main-line">
              <span class="item-qty">${it.quantity}x</span>
              <span class="item-name">${escapeHtml(it.name)}</span>
              ${it.portion && it.portion !== 'Standart' ? `<span class="item-portion">(${escapeHtml(it.portion)})</span>` : ''}
            </div>
            ${it.note ? `<div class="item-kitchen-note"><span class="material-symbols-outlined" style="font-size:12px; vertical-align:middle;">assignment</span> ${escapeHtml(it.note)}</div>` : ''}
          </div>
        </div>
      `).join('');

      // Actions Footer
      let footerHtml = '';
      if (order.status === 'pending') {
        footerHtml = `
          <button type="button" class="btn-kds-start" onclick="startOrder('${order.id}')">
            <span class="material-symbols-outlined">skillet</span>
            <span>Hazırlamaya Başla</span>
          </button>
          <button type="button" class="btn-kds-cancel" onclick="cancelOrder('${order.id}')" title="Siparişi İptal Et">
            <span class="material-symbols-outlined">delete_outline</span>
          </button>
        `;
      } else if (order.status === 'preparing') {
        footerHtml = `
          <button type="button" class="btn-kds-complete" onclick="completeOrder('${order.id}')">
            <span class="material-symbols-outlined">check_circle</span>
            <span>Tamamlandı</span>
          </button>
          <button type="button" class="btn-kds-revert" onclick="revertOrder('${order.id}')" title="Beklet / Bekleyene Geri Al">
            <span class="material-symbols-outlined">undo</span>
            <span>Beklet</span>
          </button>
        `;
      } else if (isCompleted) {
        footerHtml = `
          <div class="completed-info-pill">
            <span class="material-symbols-outlined">done_all</span>
            <span>Servise Hazırlandı</span>
          </div>
          <button type="button" class="btn-kds-revert" onclick="revertOrder('${order.id}')" title="Hazırlanıyor durumuna geri al">
            <span class="material-symbols-outlined">undo</span>
            <span>Tekrar Aç</span>
          </button>
        `;
      }

      return `
        <article class="kds-ticket-card ${cat.className}" data-order-id="${order.id}">
          <div class="card-top-bar"></div>
          
          <header class="card-header">
            <div class="card-table-title">
              <span class="table-big-text">${escapeHtml(order.tableName || 'Masa')}</span>
              <span class="ticket-number-badge">${escapeHtml(order.ticketNumber || '#--')}</span>
            </div>
            <div class="card-meta-right">
              <span class="source-badge ${sourceClass}">${sourceLabel}</span>
              <span class="order-time-text">${timeStr}</span>
            </div>
          </header>

          <div class="card-timer-bar">
            <div class="timer-digits-wrap">
              <span class="material-symbols-outlined timer-clock-icon">alarm</span>
              <span class="timer-display">${formatDuration(elapsedSec)}</span>
            </div>
            <span class="timer-status-badge">
              <span class="material-symbols-outlined" style="font-size:14px;">${cat.badgeIcon}</span>
              ${cat.badgeText}
            </span>
          </div>

          <div class="card-items-list">
            ${itemsHtml}
          </div>

          ${order.note ? `
            <div class="card-general-note">
              <span class="material-symbols-outlined" style="font-size:16px;">note</span>
              <span>${escapeHtml(order.note)}</span>
            </div>
          ` : ''}

          <footer class="card-footer">
            ${footerHtml}
          </footer>
        </article>
      `;
    }).join('');

    container.innerHTML = htmlCards;
  }

  // ==========================================================================
  // 8. TABS & FILTER HANDLERS
  // ==========================================================================
  window.switchFilterTab = function (tabKey) {
    kdsState.currentFilter = tabKey;
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.toggle('active', tab.id === `tab-${tabKey}`);
    });
    renderMetrics();
    renderTicketsGrid();
  };

  window.filterByUrgent = function () {
    switchFilterTab('active');
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  window.onTableFilterChange = function (val) {
    kdsState.selectedTable = val;
    renderTicketsGrid();
  };

  function populateTableFilter(tableCount) {
    const sel = document.getElementById('kds-table-filter');
    const modalSel = document.getElementById('modal-ticket-table');
    if (!sel && !modalSel) return;

    let options = '<option value="all">Tüm Masalar</option>';
    let modalOptions = '';

    for (let i = 1; i <= tableCount; i++) {
      const id = i < 10 ? '0' + i : String(i);
      options += `<option value="${id}">Masa ${i}</option>`;
      modalOptions += `<option value="${id}">Masa ${i}</option>`;
    }

    if (sel) sel.innerHTML = options;
    if (modalSel) modalSel.innerHTML = modalOptions;
  }

  // ==========================================================================
  // 9. WEB AUDIO API TEST & SOUND CONTROLS
  // ==========================================================================
  window.testKitchenBell = function () {
    audioSynth.playKitchenBell();
    showToast('🔔 Mutfak Zili Çaldı! Web Audio API aktif ve çalışıyor.', 'bell');
  };

  function triggerSoundWaveAnimation() {
    const anim = document.getElementById('sound-wave-anim');
    if (anim) {
      anim.classList.add('ringing');
      setTimeout(() => anim.classList.remove('ringing'), 1800);
    }
  }

  function initSoundToggle() {
    const btn = document.getElementById('btn-sound-toggle');
    const icon = document.getElementById('sound-toggle-icon');
    if (!btn || !icon) return;

    updateSoundIcon();
  }

  window.toggleMute = function () {
    audioSynth.soundEnabled = !audioSynth.soundEnabled;
    localStorage.setItem('kds_sound_enabled', audioSynth.soundEnabled ? 'true' : 'false');
    updateSoundIcon();
    showToast(audioSynth.soundEnabled ? 'Sesli uyarılar açıldı 🔔' : 'Ses kapatıldı 🔇', 'info');
  };

  function updateSoundIcon() {
    const icon = document.getElementById('sound-toggle-icon');
    if (icon) {
      icon.textContent = audioSynth.soundEnabled ? 'volume_up' : 'volume_off';
      icon.style.color = audioSynth.soundEnabled ? '#38bdf8' : '#ef4444';
    }
  }

  // ==========================================================================
  // 10. NEW MANUAL TICKET MODAL
  // ==========================================================================
  window.openNewTicketModal = function () {
    const modal = document.getElementById('modal-new-ticket');
    if (modal) modal.classList.add('active');
  };

  window.closeNewTicketModal = function () {
    const modal = document.getElementById('modal-new-ticket');
    if (modal) modal.classList.remove('active');
  };

  function initQuickChips() {
    const container = document.getElementById('quick-food-chips');
    if (!container) return;

    container.innerHTML = QUICK_MENU_ITEMS.map(item => `
      <span class="food-chip" onclick="selectQuickFood('${item}')">${item}</span>
    `).join('');
  }

  window.selectQuickFood = function (name) {
    const input = document.getElementById('modal-ticket-item-name');
    if (input) {
      input.value = name;
      input.focus();
    }
  };

  window.submitManualTicket = async function () {
    const table = document.getElementById('modal-ticket-table').value;
    const itemName = (document.getElementById('modal-ticket-item-name').value || '').trim();
    const qty = parseInt(document.getElementById('modal-ticket-qty').value, 10) || 1;
    const portion = (document.getElementById('modal-ticket-portion').value || 'Standart').trim();
    const note = (document.getElementById('modal-ticket-note').value || '').trim();

    if (!itemName) {
      alert('Lütfen bir ürün adı seçin veya yazın.');
      return;
    }

    try {
      const res = await fetch('/api/kds/orders', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          table: table,
          items: [{
            name: itemName,
            portion: portion,
            quantity: qty,
            note: note
          }],
          note: note,
          source: 'manual'
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Fiş açılamadı');
      }

      closeNewTicketModal();
      document.getElementById('modal-ticket-item-name').value = '';
      document.getElementById('modal-ticket-note').value = '';
      handleNewKitchenTicket(json.data);
    } catch (err) {
      alert('Fiş açma hatası: ' + err.message);
    }
  };

  // ==========================================================================
  // 11. UTILITIES: CLOCK, TOASTS & FULLSCREEN
  // ==========================================================================
  function initClock() {
    const update = () => {
      const now = new Date();
      const timeEl = document.getElementById('kds-clock-time');
      const dateEl = document.getElementById('kds-clock-date');
      if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }
    };
    update();
    setInterval(update, 1000);
  }

  window.toggleFullScreen = function () {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  function showToast(message, type = 'info') {
    const container = document.getElementById('kds-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `kds-toast toast-${type}`;
    let iconName = 'info';
    if (type === 'bell') iconName = 'notifications_active';
    else if (type === 'success') iconName = 'check_circle';
    else if (type === 'error') iconName = 'error';

    toast.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:20px;">${iconName}</span>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();
