/**
 * Ali Baba Döner Kafe — Kasa / POS Terminali & Fiş Simülatörü
 * Canlı Renk Kodları (Boş, Sipariş Aktif, Hesap İstendi), Adisyon Yönetimi,
 * Nakit & Kredi Kartı Tahsilat, Termal Fiş Önizleme ve Günlük Raporlar
 */

// Application State
const state = {
  token: localStorage.getItem('alibaba_waiter_token') || '',
  staffPin: localStorage.getItem('alibaba_staff_pin') || '1234',
  restaurantName: 'Ali Baba Döner Kafe',
  currency: '₺',
  tableCount: 20,
  taxRate: 10,
  tables: [],
  adisyons: {},
  notifications: [],
  dailySummary: {
    totalRevenue: 0,
    totalOrders: 0,
    cashTotal: 0,
    cardTotal: 0,
    otherTotal: 0,
    activeTablesCount: 0,
    activeRevenue: 0,
    topProducts: []
  },
  recentHistory: [],
  
  // UI Selection State
  selectedTableId: '01',
  selectedStatusFilter: 'all', // 'all' | 'bill_requested' | 'occupied' | 'idle'
  tableSearchQuery: '',
  currentTab: 'pos', // 'pos' | 'reports'
  historyRange: 'today', // 'today' | 'yesterday' | 'all'
  historySearchQuery: '',
  soundEnabled: localStorage.getItem('alibaba_kasa_sound') !== 'false',
  
  // Financial Calculators
  discountRate: 0,
  discountFixed: 0,
  receivedCash: 0,
  activeReceiptData: null,
  enteredPin: ''
};

// DOM Cache
const dom = {
  pinModal: document.getElementById('pin-modal'),
  pinDots: document.getElementById('pin-dots'),
  pinError: document.getElementById('pin-error'),
  kasaApp: document.getElementById('kasa-app'),
  
  // Top Header
  headerRestaurantName: document.getElementById('header-restaurant-name'),
  posLiveTime: document.getElementById('pos-live-time'),
  posLiveDate: document.getElementById('pos-live-date'),
  tabBtnPos: document.getElementById('tab-btn-pos'),
  tabBtnReports: document.getElementById('tab-btn-reports'),
  tabBadgeOccupied: document.getElementById('tab-badge-occupied'),
  btnBillAlert: document.getElementById('btn-bill-alert'),
  headerBillsCount: document.getElementById('header-bills-count'),
  soundIcon: document.getElementById('sound-icon'),
  
  // View 1: POS
  viewPos: document.getElementById('view-pos'),
  viewReports: document.getElementById('view-reports'),
  tableSearchInput: document.getElementById('table-search-input'),
  kasaTablesGrid: document.getElementById('kasa-tables-grid'),
  
  // Table Status Counters
  countAll: document.getElementById('count-all'),
  countBill: document.getElementById('count-bill'),
  countOccupied: document.getElementById('count-occupied'),
  countIdle: document.getElementById('count-idle'),
  
  // Adisyon Settle Panel
  adisyonTableTitle: document.getElementById('adisyon-table-title'),
  adisyonStatusBadge: document.getElementById('adisyon-status-badge'),
  adisyonTimeInfo: document.getElementById('adisyon-time-info'),
  billAlertBanner: document.getElementById('bill-alert-banner'),
  billAlertTime: document.getElementById('bill-alert-time'),
  adisyonItemsList: document.getElementById('adisyon-items-list'),
  
  // Calculations
  calcSubtotal: document.getElementById('calc-subtotal'),
  calcTax: document.getElementById('calc-tax'),
  calcDiscount: document.getElementById('calc-discount'),
  rowDiscount: document.getElementById('row-discount'),
  calcGrandTotal: document.getElementById('calc-grand-total'),
  
  // Cash Drawer
  cashReceivedInput: document.getElementById('cash-received-input'),
  cashChangeAmount: document.getElementById('cash-change-amount'),
  
  // View 2: Reports
  statTotalRevenue: document.getElementById('stat-total-revenue'),
  statTotalOrders: document.getElementById('stat-total-orders'),
  statCashTotal: document.getElementById('stat-cash-total'),
  statCashPercent: document.getElementById('stat-cash-percent'),
  statCardTotal: document.getElementById('stat-card-total'),
  statCardPercent: document.getElementById('stat-card-percent'),
  statActiveRevenue: document.getElementById('stat-active-revenue'),
  statActiveTables: document.getElementById('stat-active-tables'),
  historySearchInput: document.getElementById('history-search-input'),
  historyTableBody: document.getElementById('history-table-body'),
  
  // Thermal Receipt Modal
  receiptModal: document.getElementById('receipt-modal'),
  receiptRestaurantName: document.getElementById('receipt-restaurant-name'),
  rcReceiptNum: document.getElementById('rc-receipt-num'),
  rcDatetime: document.getElementById('rc-datetime'),
  rcTableNum: document.getElementById('rc-table-num'),
  rcCashier: document.getElementById('rc-cashier'),
  rcItemsList: document.getElementById('rc-items-list'),
  rcSubtotal: document.getElementById('rc-subtotal'),
  rcRowDiscount: document.getElementById('rc-row-discount'),
  rcDiscount: document.getElementById('rc-discount'),
  rcTax: document.getElementById('rc-tax'),
  rcGrandTotal: document.getElementById('rc-grand-total'),
  rcPaymentMethod: document.getElementById('rc-payment-method'),
  rcRowCashInfo: document.getElementById('rc-row-cash-info'),
  rcReceived: document.getElementById('rc-received'),
  rcRowChangeInfo: document.getElementById('rc-row-change-info'),
  rcChange: document.getElementById('rc-change'),
  rcBarcodeNum: document.getElementById('rc-barcode-num'),
  
  // Cancel Modal
  cancelModal: document.getElementById('cancel-modal'),
  cancelModalTitle: document.getElementById('cancel-modal-title'),
  cancelReasonSelect: document.getElementById('cancel-reason-select'),
  
  // Toasts
  toastContainer: document.getElementById('toast-container')
};

// ==================== AUDIO SYNTHESIZER ====================
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTapChime() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch (e) {}
}

function playCashChime() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc2.frequency.setValueAtTime(783.99, now + 0.1); // G5
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc2.start(now + 0.1);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  } catch (e) {}
}

function playBillAlertChime() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.15); // E6
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  } catch (e) {}
}

// ==================== PIN & AUTH ====================
function showPinModal() {
  state.enteredPin = '';
  updatePinDots();
  dom.pinModal.classList.add('active');
  dom.kasaApp.style.display = 'none';
}

function hidePinModal() {
  dom.pinModal.classList.remove('active');
  dom.kasaApp.style.display = 'flex';
}

function pressKey(num) {
  if (state.enteredPin.length < 4) {
    state.enteredPin += num;
    updatePinDots();
    dom.pinError.textContent = '';
    if (state.enteredPin.length === 4) {
      setTimeout(() => verifyPin(state.enteredPin), 150);
    }
  }
}

function deletePin() {
  if (state.enteredPin.length > 0) {
    state.enteredPin = state.enteredPin.slice(0, -1);
    updatePinDots();
    dom.pinError.textContent = '';
  }
}

function clearPin() {
  state.enteredPin = '';
  updatePinDots();
  dom.pinError.textContent = '';
}

function quickFillPin() {
  state.enteredPin = '1234';
  updatePinDots();
  verifyPin('1234');
}

function updatePinDots() {
  const dots = dom.pinDots.querySelectorAll('.dot');
  dots.forEach((dot, index) => {
    dot.classList.toggle('filled', index < state.enteredPin.length);
  });
}

async function verifyPin(pin) {
  try {
    const res = await fetch('/api/kasa/state', {
      headers: {
        'Content-Type': 'application/json',
        'x-staff-pin': pin
      }
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        state.staffPin = pin;
        localStorage.setItem('alibaba_staff_pin', pin);
        hidePinModal();
        applyStateData(json.data);
        initSSE();
        initLiveClock();
        showToast('Kasa / POS oturumu açıldı', 'success');
        return;
      }
    }
    dom.pinError.textContent = 'Hatalı PIN kodu. Varsayılan PIN: 1234';
    clearPin();
  } catch (err) {
    dom.pinError.textContent = 'Bağlantı hatası oluştu.';
    clearPin();
  }
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  if (state.staffPin) headers['x-staff-pin'] = state.staffPin;
  return headers;
}

function logout() {
  showPinModal();
}

// ==================== LIVE CLOCK ====================
function initLiveClock() {
  function update() {
    const now = new Date();
    dom.posLiveTime.textContent = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    dom.posLiveDate.textContent = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  update();
  setInterval(update, 1000);
}

// ==================== DATA SYNC & REAL-TIME SSE ====================
async function loadKasaState() {
  try {
    const res = await fetch('/api/kasa/state', { headers: getAuthHeaders() });
    if (!res.ok) {
      if (res.status === 401) showPinModal();
      return;
    }
    const json = await res.json();
    if (json.success && json.data) {
      applyStateData(json.data);
    }
  } catch (err) {
    console.error('Kasa state error:', err);
  }
}

function applyStateData(d) {
  state.restaurantName = d.restaurantName || state.restaurantName;
  state.currency = d.currency || '₺';
  state.tableCount = d.tableCount || 20;
  state.taxRate = d.taxRate || 10;
  state.tables = d.tables || [];
  state.adisyons = d.adisyons || {};
  state.notifications = d.notifications || [];
  state.dailySummary = d.dailySummary || state.dailySummary;
  state.recentHistory = d.recentHistory || state.recentHistory;

  dom.headerRestaurantName.textContent = state.restaurantName;

  renderTables();
  renderAdisyon();
  renderReports();
  updateBillAlertButton();
}

let sseSource = null;
function initSSE() {
  if (sseSource) sseSource.close();
  const sseUrl = `/api/notifications/stream?pin=${encodeURIComponent(state.staffPin)}&token=${encodeURIComponent(state.token)}`;
  sseSource = new EventSource(sseUrl);

  sseSource.addEventListener('init', () => {
    loadKasaState();
  });

  sseSource.addEventListener('notification_created', (e) => {
    try {
      const call = JSON.parse(e.data);
      const isBill = isBillCall(call);
      if (isBill) {
        playBillAlertChime();
        showToast(`Masa ${parseInt(call.table, 10)} HESAP İSTEDİ!`, 'error');
      }
      loadKasaState();
    } catch (err) {}
  });

  sseSource.addEventListener('notification_dismissed', () => {
    loadKasaState();
  });

  sseSource.addEventListener('notifications_updated', () => {
    loadKasaState();
  });

  sseSource.addEventListener('adisyon_updated', () => {
    loadKasaState();
  });

  sseSource.addEventListener('adisyon_closed', () => {
    loadKasaState();
  });
}

function isBillCall(c) {
  if (!c) return false;
  const t = String(c.type || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return t.includes('hesap') || t.includes('bill');
}

// ==================== RENDERING (VIEW 1: POS & TABLES) ====================

function renderTables() {
  const normSelected = normalizeTableId(state.selectedTableId);
  const q = state.tableSearchQuery.toLowerCase().trim();

  // Calculate status counts
  let billCount = 0;
  let occupiedCount = 0;
  let idleCount = 0;

  state.tables.forEach(t => {
    if (t.status === 'bill_requested') billCount++;
    else if (t.status === 'occupied') occupiedCount++;
    else idleCount++;
  });

  dom.countAll.textContent = state.tables.length;
  dom.countBill.textContent = billCount;
  dom.countOccupied.textContent = occupiedCount;
  dom.countIdle.textContent = idleCount;
  dom.tabBadgeOccupied.textContent = occupiedCount + billCount;

  // Filter tables
  const filtered = state.tables.filter(t => {
    if (q) {
      const matchNum = String(t.number).includes(q) || String(t.tableId).includes(q);
      if (!matchNum) return false;
    }
    if (state.selectedStatusFilter === 'bill_requested') return t.status === 'bill_requested';
    if (state.selectedStatusFilter === 'occupied') return t.status === 'occupied';
    if (state.selectedStatusFilter === 'idle') return t.status === 'idle';
    return true;
  });

  if (filtered.length === 0) {
    dom.kasaTablesGrid.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-dim);">
        <span class="material-symbols-outlined" style="font-size:40px;">search_off</span>
        <p style="margin-top:8px; font-weight:700;">Eşleşen masa bulunamadı.</p>
      </div>
    `;
    return;
  }

  dom.kasaTablesGrid.innerHTML = filtered.map(t => {
    const tableId = normalizeTableId(t.tableId);
    const isSelected = tableId === normSelected;
    const adisyon = state.adisyons[tableId];
    const isOccupied = adisyon && Array.isArray(adisyon.items) && adisyon.items.length > 0;
    const totalAmount = adisyon ? (adisyon.totalAmount || 0) : 0;
    const totalItems = adisyon ? (adisyon.totalItems || 0) : 0;

    let badgeClass = 'status-idle';
    let badgeText = 'Boş';
    let badgeIcon = 'check';

    if (t.status === 'bill_requested') {
      badgeText = 'HESAP İSTENDİ';
      badgeIcon = 'receipt_long';
    } else if (t.status === 'occupied') {
      badgeText = `${totalItems} Ürün`;
      badgeIcon = 'restaurant';
    }

    return `
      <div class="kasa-table-card status-${t.status} ${isSelected ? 'selected' : ''}" onclick="selectKasaTable('${tableId}')">
        <div class="card-header-row">
          <span class="card-table-num">
            <span class="material-symbols-outlined" style="font-size:18px;">table_restaurant</span>
            Masa ${t.number}
          </span>
          <span class="card-badge">
            <span class="material-symbols-outlined" style="font-size:12px;">${badgeIcon}</span>
            <span>${badgeText}</span>
          </span>
        </div>
        <div class="card-footer-row">
          <span class="card-price">${formatMoney(totalAmount)}</span>
          <span class="card-items-count">${isOccupied ? `${totalItems} Kalem` : '—'}</span>
        </div>
      </div>
    `;
  }).join('');
}

function selectKasaTable(tableId) {
  playTapChime();
  state.selectedTableId = normalizeTableId(tableId);
  resetDiscount();
  renderTables();
  renderAdisyon();
}

function filterByStatus(filterStatus) {
  playTapChime();
  state.selectedStatusFilter = filterStatus;
  document.querySelectorAll('.status-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filterStatus);
  });
  renderTables();
}

function handleTableSearch(val) {
  state.tableSearchQuery = val;
  renderTables();
}

function updateBillAlertButton() {
  const billCount = state.tables.filter(t => t.status === 'bill_requested').length;
  dom.headerBillsCount.textContent = billCount;
  dom.btnBillAlert.classList.toggle('has-bills', billCount > 0);
}

// ==================== RENDERING (ADİSYON & CALCULATION) ====================

function renderAdisyon() {
  const normId = normalizeTableId(state.selectedTableId);
  const tableNum = parseInt(normId, 10);
  dom.adisyonTableTitle.textContent = `Masa ${tableNum}`;

  const adisyon = state.adisyons[normId];
  const items = (adisyon && Array.isArray(adisyon.items)) ? adisyon.items : [];
  const isOpen = items.length > 0;

  // Table status and calls
  const tableModel = state.tables.find(t => normalizeTableId(t.tableId) === normId);
  const isBill = tableModel && tableModel.status === 'bill_requested';

  // Status Badge
  dom.adisyonStatusBadge.className = 'live-status-tag';
  if (isBill) {
    dom.adisyonStatusBadge.classList.add('tag-bill_requested');
    dom.adisyonStatusBadge.textContent = '🔔 Hesap İstendi!';
  } else if (isOpen) {
    dom.adisyonStatusBadge.classList.add('tag-occupied');
    dom.adisyonStatusBadge.textContent = 'Açık Sipariş';
  } else {
    dom.adisyonStatusBadge.classList.add('tag-idle');
    dom.adisyonStatusBadge.textContent = 'Boş Masa';
  }

  // Time info
  if (isOpen && adisyon.openedAt) {
    const openTime = new Date(adisyon.openedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const diffMins = Math.max(1, Math.round((Date.now() - adisyon.openedAt) / 60000));
    dom.adisyonTimeInfo.textContent = `Açılış: ${openTime} • Süre: ${diffMins} dk`;
  } else {
    dom.adisyonTimeInfo.textContent = 'Açılış: — • Süre: —';
  }

  // Bill Alert Callout
  if (isBill) {
    dom.billAlertBanner.style.display = 'flex';
  } else {
    dom.billAlertBanner.style.display = 'none';
  }

  // Items List
  if (!isOpen) {
    dom.adisyonItemsList.innerHTML = `
      <div class="items-empty-state">
        <span class="material-symbols-outlined">receipt_long</span>
        <p>Masa ${tableNum} için açık sipariş bulunmuyor.</p>
        <span style="font-size:11px;">Müşteri menüden sipariş verdiğinde veya garson ürün eklediğinde burada listelenir.</span>
      </div>
    `;
    updateCalculations(0);
    return;
  }

  dom.adisyonItemsList.innerHTML = items.map(item => `
    <div class="item-row">
      <div class="item-row-left">
        <div class="item-row-name">${escapeHtml(item.name)}</div>
        <span class="item-row-portion">${escapeHtml(item.portion || 'Standart')}</span>
        ${item.note ? `<span class="item-row-note">Not: ${escapeHtml(item.note)}</span>` : ''}
      </div>
      <div class="item-row-qty">${item.quantity}</div>
      <div class="item-row-price">${formatMoney(item.price)}</div>
      <div class="item-row-total">${formatMoney(item.total || (item.price * item.quantity))}</div>
      <div style="text-align:center;">
        <button type="button" class="btn-item-delete" onclick="removeItemFromTable('${item.id}')" title="Kalemi Sil">
          <span class="material-symbols-outlined" style="font-size:16px;">close</span>
        </button>
      </div>
    </div>
  `).join('');

  updateCalculations(adisyon.totalAmount || 0);
}

function updateCalculations(subtotal) {
  let discount = 0;
  if (state.discountRate > 0) {
    discount = Math.round(subtotal * state.discountRate * 100) / 100;
  } else if (state.discountFixed > 0) {
    discount = Math.min(subtotal, state.discountFixed);
  }

  const grandTotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  const tax = Math.round((grandTotal - (grandTotal / 1.10)) * 100) / 100;

  dom.calcSubtotal.textContent = formatMoney(subtotal);
  dom.calcTax.textContent = formatMoney(tax);

  if (discount > 0) {
    dom.rowDiscount.style.display = 'flex';
    dom.calcDiscount.textContent = `-${formatMoney(discount)}`;
  } else {
    dom.rowDiscount.style.display = 'none';
  }

  dom.calcGrandTotal.textContent = formatMoney(grandTotal);

  calculateChange(dom.cashReceivedInput.value);
}

// Cash Calculator
function calculateChange(val) {
  const normId = normalizeTableId(state.selectedTableId);
  const adisyon = state.adisyons[normId];
  const subtotal = adisyon ? (adisyon.totalAmount || 0) : 0;
  let discount = 0;
  if (state.discountRate > 0) discount = Math.round(subtotal * state.discountRate * 100) / 100;
  else if (state.discountFixed > 0) discount = Math.min(subtotal, state.discountFixed);
  const grandTotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

  const received = parseFloat(val) || 0;
  state.receivedCash = received;

  if (received > grandTotal && grandTotal > 0) {
    const change = Math.round((received - grandTotal) * 100) / 100;
    dom.cashChangeAmount.textContent = formatMoney(change);
    dom.cashChangeAmount.style.color = 'var(--accent-green)';
  } else {
    dom.cashChangeAmount.textContent = formatMoney(0);
    dom.cashChangeAmount.style.color = 'var(--text-dim)';
  }
}

function setCashAmount(amt) {
  playTapChime();
  dom.cashReceivedInput.value = amt;
  calculateChange(amt);
}

function setExactCash() {
  playTapChime();
  const normId = normalizeTableId(state.selectedTableId);
  const adisyon = state.adisyons[normId];
  const subtotal = adisyon ? (adisyon.totalAmount || 0) : 0;
  let discount = 0;
  if (state.discountRate > 0) discount = Math.round(subtotal * state.discountRate * 100) / 100;
  else if (state.discountFixed > 0) discount = Math.min(subtotal, state.discountFixed);
  const grandTotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

  dom.cashReceivedInput.value = grandTotal;
  calculateChange(grandTotal);
}

// Discount Chips
function applyQuickDiscount(rate) {
  playTapChime();
  state.discountRate = rate;
  state.discountFixed = 0;
  document.querySelectorAll('.btn-disc-chip').forEach(btn => btn.classList.remove('active'));
  renderAdisyon();
}

function applyRounding() {
  playTapChime();
  const normId = normalizeTableId(state.selectedTableId);
  const adisyon = state.adisyons[normId];
  if (!adisyon || !adisyon.totalAmount) return;
  const subtotal = adisyon.totalAmount;
  const rounded = Math.floor(subtotal / 10) * 10;
  state.discountFixed = subtotal - rounded;
  state.discountRate = 0;
  renderAdisyon();
}

function resetDiscount() {
  state.discountRate = 0;
  state.discountFixed = 0;
  document.querySelectorAll('.btn-disc-chip').forEach(btn => btn.classList.remove('active'));
  dom.cashReceivedInput.value = '';
  calculateChange('');
  const normId = normalizeTableId(state.selectedTableId);
  const adisyon = state.adisyons[normId];
  updateCalculations(adisyon ? (adisyon.totalAmount || 0) : 0);
}

// ==================== SETTLEMENT & CASHIER APIS ====================

// Settle & Close Table with Payment (Nakit ve Kredi Kartı ile hesap kapatma)
async function submitCloseTable(paymentMethod) {
  const normId = normalizeTableId(state.selectedTableId);
  const tableNum = parseInt(normId, 10);
  const adisyon = state.adisyons[normId];

  if (!adisyon || !Array.isArray(adisyon.items) || adisyon.items.length === 0) {
    showToast(`Masa ${tableNum} adisyonunda ürün bulunmuyor.`, 'error');
    return;
  }

  const subtotal = adisyon.totalAmount || 0;
  let discount = 0;
  if (state.discountRate > 0) discount = Math.round(subtotal * state.discountRate * 100) / 100;
  else if (state.discountFixed > 0) discount = Math.min(subtotal, state.discountFixed);
  const grandTotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

  playCashChime();

  try {
    const res = await fetch(`/api/kasa/tables/${normId}/close`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        paymentMethod: paymentMethod,
        discountAmount: discount,
        receivedAmount: state.receivedCash || grandTotal,
        note: `Kasa Tahsilat (${paymentMethod})`
      })
    });

    const json = await res.json();
    if (json.success && json.data) {
      delete state.adisyons[normId];
      state.notifications = state.notifications.filter(n => normalizeTableId(n.table) !== normId);
      
      showToast(json.message || `Masa ${tableNum} hesabı başarıyla kapatıldı!`, 'success');
      
      // Auto open thermal receipt simulation modal
      if (json.data.receipt) {
        previewThermalReceipt(json.data.receipt);
      }

      await loadKasaState();
    } else {
      showToast(json.message || 'Hesap kapatılamadı.', 'error');
    }
  } catch (err) {
    showToast('Bağlantı hatası: Hesap kapatılamadı.', 'error');
  }
}

// Kalem Silme
async function removeItemFromTable(itemId) {
  const normId = normalizeTableId(state.selectedTableId);
  playTapChime();
  try {
    const res = await fetch(`/api/garson/tables/${normId}/items/${itemId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (json.success && json.data) {
      state.adisyons[normId] = json.data;
      renderAdisyon();
      renderTables();
      showToast('Ürün adisyondan silindi.', 'success');
    }
  } catch (err) {
    showToast('Hata oluştu.', 'error');
  }
}

// İptal / Temizleme Modal
function openCancelModal() {
  const normId = normalizeTableId(state.selectedTableId);
  const tableNum = parseInt(normId, 10);
  dom.cancelModalTitle.textContent = `Masa ${tableNum} Adisyonunu İptal Et`;
  dom.cancelModal.classList.add('active');
}

function closeCancelModal() {
  dom.cancelModal.classList.remove('active');
}

async function submitCancelTable() {
  const normId = normalizeTableId(state.selectedTableId);
  const reason = dom.cancelReasonSelect.value;
  closeCancelModal();
  playTapChime();

  try {
    const res = await fetch(`/api/kasa/tables/${normId}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    const json = await res.json();
    if (json.success) {
      delete state.adisyons[normId];
      state.notifications = state.notifications.filter(n => normalizeTableId(n.table) !== normId);
      showToast(`Masa ${parseInt(normId, 10)} adisyonu iptal edildi.`, 'success');
      await loadKasaState();
    }
  } catch (err) {
    showToast('İptal işlemi başarısız.', 'error');
  }
}

// ==================== VIEW 2: REPORTS & HISTORY ====================

function switchKasaTab(tabName) {
  playTapChime();
  state.currentTab = tabName;
  dom.tabBtnPos.classList.toggle('active', tabName === 'pos');
  dom.tabBtnReports.classList.toggle('active', tabName === 'reports');

  if (tabName === 'pos') {
    dom.viewPos.style.display = 'flex';
    dom.viewReports.style.display = 'none';
  } else {
    dom.viewPos.style.display = 'none';
    dom.viewReports.style.display = 'flex';
    loadHistoryData();
  }
}

async function loadHistoryData() {
  try {
    const query = new URLSearchParams({
      range: state.historyRange,
      search: state.historySearchQuery
    });
    const res = await fetch(`/api/kasa/history?${query}`, { headers: getAuthHeaders() });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        state.recentHistory = json.data.orders || [];
        renderReports();
      }
    }
  } catch (err) {
    console.error('History load error:', err);
  }
}

function renderReports() {
  const s = state.dailySummary || {};

  dom.statTotalRevenue.textContent = formatMoney(s.totalRevenue || 0);
  dom.statTotalOrders.textContent = `${s.totalOrders || 0} Adisyon Kapatıldı`;

  dom.statCashTotal.textContent = formatMoney(s.cashTotal || 0);
  const cashPct = s.totalRevenue > 0 ? Math.round(((s.cashTotal || 0) / s.totalRevenue) * 100) : 0;
  dom.statCashPercent.textContent = `%${cashPct} Nakit Oranı`;

  dom.statCardTotal.textContent = formatMoney(s.cardTotal || 0);
  const cardPct = s.totalRevenue > 0 ? Math.round(((s.cardTotal || 0) / s.totalRevenue) * 100) : 0;
  dom.statCardPercent.textContent = `%${cardPct} Kart Oranı`;

  dom.statActiveRevenue.textContent = formatMoney(s.activeRevenue || 0);
  dom.statActiveTables.textContent = `${s.activeTablesCount || 0} Masa Bekliyor`;

  // Render History Table
  const orders = state.recentHistory || [];

  if (orders.length === 0) {
    dom.historyTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:36px; color:var(--text-dim);">
          <span class="material-symbols-outlined" style="font-size:36px; opacity:0.5;">receipt</span>
          <p style="margin-top:6px; font-weight:700;">Bu aralıkta kapanmış adisyon bulunamadı.</p>
        </td>
      </tr>
    `;
    return;
  }

  dom.historyTableBody.innerHTML = orders.map(o => {
    const receiptNum = o.receiptNumber || `AB-${String(o.closedAt).slice(-6)}`;
    const tableNum = parseInt(o.tableId, 10) || 1;
    const timeStr = o.closedAt ? new Date(o.closedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—';
    const itemsPreview = (o.items || []).map(it => `${it.quantity}x ${it.name}`).join(', ');
    const payMethod = o.paymentMethod || 'Nakit';

    let payBadgeClass = 'badge-pay-cash';
    if (payMethod.toLowerCase().includes('kart') || payMethod.toLowerCase().includes('pos')) payBadgeClass = 'badge-pay-card';
    else if (payMethod.toLowerCase().includes('yemek')) payBadgeClass = 'badge-pay-meal';

    return `
      <tr>
        <td><strong style="font-family:var(--font-mono); color:var(--text-main);">${escapeHtml(receiptNum)}</strong></td>
        <td><strong>Masa ${tableNum}</strong></td>
        <td>${timeStr}</td>
        <td style="max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(itemsPreview)}">${escapeHtml(itemsPreview)}</td>
        <td><span class="badge-pay-method ${payBadgeClass}">${escapeHtml(payMethod)}</span></td>
        <td style="text-align:right; font-family:var(--font-mono); font-weight:800; color:var(--accent-amber);">${formatMoney(o.totalAmount || 0)}</td>
        <td style="text-align:center;">
          <button type="button" class="btn-view-receipt-row" onclick="viewHistoryReceipt('${escapeHtml(receiptNum)}')">
            <span class="material-symbols-outlined" style="font-size:14px;">receipt</span>
            <span>Fişi Aç</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function setHistoryRange(range) {
  playTapChime();
  state.historyRange = range;
  document.querySelectorAll('.range-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.range === range);
  });
  loadHistoryData();
}

function handleHistorySearch(val) {
  state.historySearchQuery = val;
  loadHistoryData();
}

// ==================== 3. REALISTIC THERMAL RECEIPT SIMULATOR ====================

function previewThermalReceipt(customOrderData = null) {
  playTapChime();
  let order = customOrderData;

  if (!order) {
    const normId = normalizeTableId(state.selectedTableId);
    const adisyon = state.adisyons[normId];
    if (!adisyon || !Array.isArray(adisyon.items) || adisyon.items.length === 0) {
      showToast('Önizleme yapılacak aktif ürün bulunmuyor.', 'error');
      return;
    }
    const subtotal = adisyon.totalAmount || 0;
    let discount = 0;
    if (state.discountRate > 0) discount = Math.round(subtotal * state.discountRate * 100) / 100;
    else if (state.discountFixed > 0) discount = Math.min(subtotal, state.discountFixed);
    const grandTotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

    order = {
      ...adisyon,
      receiptNumber: `BILGI-${normId}`,
      isPreliminary: true,
      subtotal: subtotal,
      discount: discount,
      totalAmount: grandTotal,
      taxAmount: Math.round((grandTotal - (grandTotal / 1.10)) * 100) / 100,
      paymentMethod: 'Beklemede (Ön Fiş)',
      closedAt: Date.now()
    };
  }

  state.activeReceiptData = order;

  // Populate receipt DOM
  dom.receiptRestaurantName.textContent = state.restaurantName.toUpperCase();
  dom.rcReceiptNum.textContent = order.receiptNumber || 'AB-20261028-001';
  dom.rcDatetime.textContent = new Date(order.closedAt || Date.now()).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  dom.rcTableNum.textContent = `MASA ${parseInt(order.tableId, 10) || 1}`;
  dom.rcCashier.textContent = order.cashier || `Kasa 1 (PIN ${state.staffPin})`;

  // Items
  dom.rcItemsList.innerHTML = (order.items || []).map(it => `
    <div class="rc-item-row">
      <div class="rc-item-name">${escapeHtml(it.name)}</div>
      <div style="text-align:center;">${it.quantity}</div>
      <div style="text-align:right;">${formatMoney(it.price)}</div>
      <div style="text-align:right; font-weight:700;">${formatMoney(it.total || (it.price * it.quantity))}</div>
      ${it.note ? `<div class="rc-item-note">Not: ${escapeHtml(it.note)}</div>` : ''}
    </div>
  `).join('');

  const subtotal = order.subtotal || order.totalAmount || 0;
  const discount = order.discount || 0;
  const grandTotal = order.totalAmount || 0;
  const tax = order.taxAmount || (Math.round((grandTotal - (grandTotal / 1.10)) * 100) / 100);

  dom.rcSubtotal.textContent = formatMoney(subtotal);
  if (discount > 0) {
    dom.rcRowDiscount.style.display = 'flex';
    dom.rcDiscount.textContent = `-${formatMoney(discount)}`;
  } else {
    dom.rcRowDiscount.style.display = 'none';
  }

  dom.rcTax.textContent = formatMoney(tax);
  dom.rcGrandTotal.textContent = formatMoney(grandTotal);
  dom.rcPaymentMethod.textContent = order.paymentMethod || 'Kredi Kartı / POS';

  if (order.receivedAmount && order.receivedAmount > grandTotal) {
    dom.rcRowCashInfo.style.display = 'flex';
    dom.rcReceived.textContent = formatMoney(order.receivedAmount);
    dom.rcRowChangeInfo.style.display = 'flex';
    dom.rcChange.textContent = formatMoney(order.changeAmount || (order.receivedAmount - grandTotal));
  } else {
    dom.rcRowCashInfo.style.display = 'none';
    dom.rcRowChangeInfo.style.display = 'none';
  }

  dom.rcBarcodeNum.textContent = (order.receiptNumber || '20261028').replace(/\D/g, '') || '20261028042';

  dom.receiptModal.classList.add('active');
}

function viewHistoryReceipt(receiptNumber) {
  const order = (state.recentHistory || []).find(o => o.receiptNumber === receiptNumber);
  if (order) {
    previewThermalReceipt(order);
  } else {
    fetch(`/api/kasa/receipt/${encodeURIComponent(receiptNumber)}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data) previewThermalReceipt(j.data);
      });
  }
}

function closeReceiptModal() {
  dom.receiptModal.classList.remove('active');
}

function triggerPrintReceipt() {
  playTapChime();
  window.print();
}

// Gün Sonu Z Raporu Termal Baskı
function printDailyZReport() {
  const s = state.dailySummary || {};
  const reportData = {
    receiptNumber: `Z-RAPORU-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    tableId: '00',
    tableName: 'GÜN SONU KASA DÖKÜMÜ',
    closedAt: Date.now(),
    cashier: `Kasa Yetkilisi (PIN ${state.staffPin})`,
    paymentMethod: 'GÜNLÜK Z RAPORU',
    items: [
      { name: 'Nakit Tahsilat', quantity: 1, price: s.cashTotal || 0, total: s.cashTotal || 0 },
      { name: 'Kredi Kartı / POS', quantity: 1, price: s.cardTotal || 0, total: s.cardTotal || 0 },
      { name: 'Yemek Kartı / Diğer', quantity: 1, price: s.otherTotal || 0, total: s.otherTotal || 0 }
    ],
    subtotal: s.totalRevenue || 0,
    discount: 0,
    totalAmount: s.totalRevenue || 0,
    taxAmount: Math.round(((s.totalRevenue || 0) - ((s.totalRevenue || 0) / 1.10)) * 100) / 100
  };

  previewThermalReceipt(reportData);
}

// ==================== UTILS & HELPERS ====================
function normalizeTableId(val) {
  if (!val) return '01';
  const str = String(val).trim();
  const digits = str.replace(/\D/g, '');
  if (digits) {
    const num = parseInt(digits, 10);
    return num < 10 ? '0' + num : String(num);
  }
  return str;
}

function formatMoney(amount) {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + state.currency;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined">${type === 'success' ? 'check_circle' : 'error'}</span>
    <span>${escapeHtml(msg)}</span>
  `;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  localStorage.setItem('alibaba_kasa_sound', String(state.soundEnabled));
  dom.soundIcon.textContent = state.soundEnabled ? 'volume_up' : 'volume_off';
  showToast(state.soundEnabled ? 'Sesli bildirimler açık' : 'Sesli bildirimler kapatıldı', 'success');
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  // Check stored PIN
  if (state.staffPin) {
    verifyPin(state.staffPin);
  } else {
    showPinModal();
  }

  // Keyboard shortcut support
  window.addEventListener('keydown', (e) => {
    if (dom.pinModal.classList.contains('active')) {
      if (e.key >= '0' && e.key <= '9') pressKey(e.key);
      else if (e.key === 'Backspace') deletePin();
      else if (e.key === 'Escape') clearPin();
      else if (e.key === 'Enter') {
        if (state.enteredPin.length === 4) verifyPin(state.enteredPin);
      }
    }
  });
});

