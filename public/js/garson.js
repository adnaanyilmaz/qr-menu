/**
 * Ali Baba Döner Kafe — Garson Terminali & POS Controller
 * Hızlı Masa Seçimi, Bekleyen Çağrıları Onaylama & Kapatma, Hızlı Adisyon Yönetimi
 */

// Application State
const state = {
  token: localStorage.getItem('alibaba_waiter_token') || '',
  staffPin: localStorage.getItem('alibaba_staff_pin') || '1234',
  restaurantName: 'Ali Baba Döner Kafe',
  currency: '₺',
  tableCount: 20,
  tables: [],
  adisyons: {},
  notifications: [],
  categories: [],
  products: [],
  
  // UI State
  selectedTableId: '01',
  selectedCategory: 'all',
  searchQuery: '',
  tableFilter: 'all',
  currentView: 'tables', // 'tables' | 'catalog' | 'adisyon'
  soundEnabled: localStorage.getItem('alibaba_waiter_sound') !== 'false',
  selectedPaymentMethod: 'Nakit',
  enteredPin: '',
  isCallsDrawerOpen: false
};

// DOM References
const dom = {
  pinModal: document.getElementById('pin-modal'),
  pinDots: document.getElementById('pin-dots'),
  pinError: document.getElementById('pin-error'),
  terminalApp: document.getElementById('terminal-app'),
  headerRestaurantName: document.getElementById('header-restaurant-name'),
  headerTableName: document.getElementById('header-table-name'),
  headerCallsCount: document.getElementById('header-calls-count'),
  btnPendingCalls: document.getElementById('btn-pending-calls'),
  soundIcon: document.getElementById('sound-icon'),
  
  // Panels
  panelTables: document.getElementById('panel-tables'),
  panelCatalog: document.getElementById('panel-catalog'),
  panelAdisyon: document.getElementById('panel-adisyon'),
  mobileBottomNav: document.getElementById('mobile-bottom-nav'),
  mBottomCallsBadge: document.getElementById('m-bottom-calls-badge'),
  mBottomItemsBadge: document.getElementById('m-bottom-items-badge'),
  mBottomAdisyonText: document.getElementById('m-bottom-adisyon-text'),
  mobileAdisyonFloatBar: document.getElementById('mobile-adisyon-float-bar'),
  floatBarTableTitle: document.getElementById('float-bar-table-title'),
  floatBarSummary: document.getElementById('float-bar-summary'),

  // Table View
  tablesGrid: document.getElementById('tables-grid'),
  tablesTotalCount: document.getElementById('tables-total-count'),
  countFilterAll: document.getElementById('count-filter-all'),
  countFilterCalling: document.getElementById('count-filter-calling'),
  countFilterOccupied: document.getElementById('count-filter-occupied'),
  countFilterIdle: document.getElementById('count-filter-idle'),

  // Catalog View
  catalogSearch: document.getElementById('catalog-search'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  categoryScrollBar: document.getElementById('category-scroll-bar'),
  productsGrid: document.getElementById('products-grid'),
  catalogCurrentTableName: document.getElementById('catalog-current-table-name'),

  // Adisyon View
  adisyonTableTitle: document.getElementById('adisyon-table-title'),
  adisyonStatusTag: document.getElementById('adisyon-status-tag'),
  tableCallBanner: document.getElementById('table-call-banner'),
  tableCallTitle: document.getElementById('table-call-title'),
  tableCallNote: document.getElementById('table-call-note'),
  tableCallIcon: document.getElementById('table-call-icon'),
  btnBannerAction: document.getElementById('btn-banner-action'),
  btnBannerIcon: document.getElementById('btn-banner-icon'),
  btnBannerText: document.getElementById('btn-banner-text'),
  adisyonItemsList: document.getElementById('adisyon-items-list'),
  adisyonTotalCount: document.getElementById('adisyon-total-count'),
  adisyonTotalPrice: document.getElementById('adisyon-total-price'),

  // Drawers & Modals
  callsDrawerBackdrop: document.getElementById('calls-drawer-backdrop'),
  callsDrawer: document.getElementById('calls-drawer'),
  drawerCallsCount: document.getElementById('drawer-calls-count'),
  drawerCallsList: document.getElementById('drawer-calls-list'),
  paymentModal: document.getElementById('payment-modal'),
  paymentModalTitle: document.getElementById('payment-modal-title'),
  paymentModalAmount: document.getElementById('payment-modal-amount'),
  paymentNoteInput: document.getElementById('payment-note-input'),
  receiptModal: document.getElementById('receipt-modal'),
  receiptPaperContent: document.getElementById('receipt-paper-content'),
  receiptTableText: document.getElementById('receipt-table-text'),
  receiptDateText: document.getElementById('receipt-date-text'),
  receiptItemsTable: document.getElementById('receipt-items-table'),
  receiptTotalAmount: document.getElementById('receipt-total-amount'),
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

function playCallChime() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Pleasant dual chime
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.setValueAtTime(1174.66, now + 0.15); // D6

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);
  } catch (e) {}
}

function playTapChime() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch (e) {}
}

function playSuccessChime() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.1); // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.2); // C6
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch (e) {}
}

// ==================== INITIALIZATION & AUTH ====================
document.addEventListener('DOMContentLoaded', () => {
  updateSoundIcon();

  // If token or staffPin exists, try auto-login
  if (state.token || state.staffPin) {
    checkAuthAndInit();
  } else {
    showPinModal();
  }

  // Handle keyboard numeric entry on PIN modal
  document.addEventListener('keydown', (e) => {
    if (dom.pinModal.classList.contains('active')) {
      if (e.key >= '0' && e.key <= '9') {
        pressKey(e.key);
      } else if (e.key === 'Backspace') {
        deletePin();
      } else if (e.key === 'Escape') {
        clearPin();
      }
    }
  });
});

function showPinModal() {
  state.enteredPin = '';
  updatePinDots();
  dom.pinModal.classList.add('active');
  dom.terminalApp.style.display = 'none';
}

function hidePinModal() {
  dom.pinModal.classList.remove('active');
  dom.terminalApp.style.display = 'flex';
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
    if (index < state.enteredPin.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  });
}

async function verifyPin(pinToVerify) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pinToVerify })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      state.token = data.token;
      state.staffPin = pinToVerify;
      localStorage.setItem('alibaba_waiter_token', state.token);
      localStorage.setItem('alibaba_staff_pin', state.staffPin);
      hidePinModal();
      initTerminal();
      showToast('Giriş başarılı! Terminal hazır.', 'success');
    } else {
      dom.pinError.textContent = data.message || 'Hatalı PIN!';
      clearPin();
    }
  } catch (err) {
    dom.pinError.textContent = 'Bağlantı hatası meydana geldi.';
    clearPin();
  }
}

async function checkAuthAndInit() {
  try {
    const res = await fetch('/api/garson/state', {
      headers: getAuthHeaders()
    });

    if (res.ok) {
      hidePinModal();
      initTerminal();
    } else {
      showPinModal();
    }
  } catch (err) {
    showPinModal();
  }
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  if (state.staffPin) {
    headers['x-staff-pin'] = state.staffPin;
  }
  return headers;
}

function logout() {
  localStorage.removeItem('alibaba_waiter_token');
  state.token = '';
  showPinModal();
}

// ==================== TERMINAL DATA & STREAM ====================
async function initTerminal() {
  await loadState();
  initSSE();
  // Poll backup every 15s
  setInterval(loadState, 15000);
}

async function loadState() {
  try {
    const res = await fetch('/api/garson/state', { headers: getAuthHeaders() });
    if (!res.ok) {
      if (res.status === 401) showPinModal();
      return;
    }
    const json = await res.json();
    if (json.success && json.data) {
      const d = json.data;
      state.restaurantName = d.restaurantName || state.restaurantName;
      state.currency = d.currency || '₺';
      state.tableCount = d.tableCount || 20;
      state.tables = d.tables || [];
      state.adisyons = d.adisyons || {};
      state.notifications = d.notifications || [];
      state.categories = d.categories || [];
      state.products = d.products || [];

      renderHeader();
      renderTables();
      renderCategories();
      renderProducts();
      renderAdisyon();
      renderCallsDrawer();
    }
  } catch (err) {
    console.error('Error loading garson state:', err);
  }
}

// Real-time SSE Connection
let sseSource = null;
function initSSE() {
  if (sseSource) {
    sseSource.close();
  }

  const sseUrl = `/api/notifications/stream?pin=${encodeURIComponent(state.staffPin)}&token=${encodeURIComponent(state.token)}`;
  sseSource = new EventSource(sseUrl);

  sseSource.addEventListener('init', (e) => {
    try {
      state.notifications = JSON.parse(e.data);
      renderHeader();
      renderTables();
      renderAdisyon();
      renderCallsDrawer();
    } catch (err) {}
  });

  sseSource.addEventListener('notification_created', (e) => {
    try {
      const call = JSON.parse(e.data);
      // Prepend
      state.notifications.unshift(call);
      playCallChime();
      showToast(`${call.table}: ${call.type}`, 'error');
      renderHeader();
      renderTables();
      renderAdisyon();
      renderCallsDrawer();
    } catch (err) {}
  });

  sseSource.addEventListener('notification_dismissed', (e) => {
    try {
      const { id } = JSON.parse(e.data);
      state.notifications = state.notifications.filter(n => n.id !== id);
      renderHeader();
      renderTables();
      renderAdisyon();
      renderCallsDrawer();
    } catch (err) {}
  });

  sseSource.addEventListener('notifications_updated', (e) => {
    try {
      state.notifications = JSON.parse(e.data);
      renderHeader();
      renderTables();
      renderAdisyon();
      renderCallsDrawer();
    } catch (err) {}
  });

  sseSource.addEventListener('adisyon_updated', (e) => {
    try {
      const { tableId, adisyon } = JSON.parse(e.data);
      state.adisyons[tableId] = adisyon;
      renderTables();
      if (state.selectedTableId === tableId) {
        renderAdisyon();
      }
    } catch (err) {}
  });

  sseSource.addEventListener('adisyon_closed', (e) => {
    try {
      const { tableId } = JSON.parse(e.data);
      delete state.adisyons[tableId];
      renderTables();
      if (state.selectedTableId === tableId) {
        renderAdisyon();
      }
    } catch (err) {}
  });

  sseSource.onerror = () => {
    // Reconnect will happen automatically
  };
}

// ==================== RENDERING LOGIC ====================

// 1. Header Rendering
function renderHeader() {
  dom.headerRestaurantName.textContent = state.restaurantName;
  const currentTableNum = parseInt(state.selectedTableId, 10);
  dom.headerTableName.textContent = `Masa ${currentTableNum}`;
  dom.catalogCurrentTableName.textContent = `Masa ${currentTableNum}`;

  const callsCount = state.notifications.length;
  dom.headerCallsCount.textContent = callsCount;
  dom.drawerCallsCount.textContent = callsCount;

  if (callsCount > 0) {
    dom.btnPendingCalls.classList.remove('no-calls');
  } else {
    dom.btnPendingCalls.classList.add('no-calls');
  }

  // Active items count and total for selected table
  const normId = normalizeTableId(state.selectedTableId);
  const activeAdisyon = state.adisyons[normId];
  const itemsCount = activeAdisyon ? (activeAdisyon.totalItems || 0) : 0;
  const totalAmount = activeAdisyon ? (activeAdisyon.totalAmount || 0) : 0;

  // Mobile Bottom Navigation Badges
  if (dom.mBottomCallsBadge) {
    dom.mBottomCallsBadge.style.display = callsCount > 0 ? 'inline-block' : 'none';
    dom.mBottomCallsBadge.textContent = callsCount;
  }
  if (dom.mBottomItemsBadge) {
    dom.mBottomItemsBadge.style.display = itemsCount > 0 ? 'inline-block' : 'none';
    dom.mBottomItemsBadge.textContent = itemsCount;
  }
  if (dom.mBottomAdisyonText) {
    dom.mBottomAdisyonText.textContent = itemsCount > 0 ? `Adisyon (${itemsCount})` : 'Adisyon';
  }

  // Mobile Floating Adisyon Quick Bar
  if (dom.floatBarTableTitle && dom.floatBarSummary) {
    dom.floatBarTableTitle.textContent = `Masa ${currentTableNum} Adisyonu`;
    dom.floatBarSummary.textContent = `${itemsCount} Ürün • ${formatMoney(totalAmount)}`;
  }
}

// 2. Table Grid Rendering (HIZLI MASA SEÇİMİ)
function renderTables() {
  const normSelected = normalizeTableId(state.selectedTableId);
  dom.tablesTotalCount.textContent = `${state.tables.length} Masa`;

  // Counters
  let callingCount = 0;
  let occupiedCount = 0;
  let idleCount = 0;

  state.tables.forEach(t => {
    const tableId = normalizeTableId(t.tableId);
    const adisyon = state.adisyons[tableId];
    const isOccupied = adisyon && adisyon.items && adisyon.items.length > 0;
    const hasCalls = state.notifications.some(n => normalizeTableId(n.table) === tableId);

    if (hasCalls) callingCount++;
    if (isOccupied) occupiedCount++;
    else idleCount++;
  });

  dom.countFilterAll.textContent = state.tables.length;
  dom.countFilterCalling.textContent = callingCount;
  dom.countFilterOccupied.textContent = occupiedCount;
  dom.countFilterIdle.textContent = idleCount;

  // Filter tables
  const filtered = state.tables.filter(t => {
    const tableId = normalizeTableId(t.tableId);
    const adisyon = state.adisyons[tableId];
    const isOccupied = adisyon && adisyon.items && adisyon.items.length > 0;
    const hasCalls = state.notifications.some(n => normalizeTableId(n.table) === tableId);

    if (state.tableFilter === 'calling') return hasCalls;
    if (state.tableFilter === 'occupied') return isOccupied;
    if (state.tableFilter === 'idle') return !isOccupied;
    return true;
  });

  dom.tablesGrid.innerHTML = filtered.map(t => {
    const tableId = normalizeTableId(t.tableId);
    const isSelected = tableId === normSelected;
    const adisyon = state.adisyons[tableId];
    const isOccupied = adisyon && adisyon.items && adisyon.items.length > 0;
    const pendingCalls = state.notifications.filter(n => normalizeTableId(n.table) === tableId);
    const hasCalls = pendingCalls.length > 0;

    let badgeClass = 'idle';
    let badgeText = 'Boş';
    if (hasCalls) {
      badgeClass = 'call';
      badgeText = pendingCalls[0].type.slice(0, 10);
    } else if (isOccupied) {
      badgeClass = 'occupied';
      badgeText = 'Açık';
    }

    const totalPrice = adisyon ? (adisyon.totalAmount || 0) : 0;
    const totalItems = adisyon ? (adisyon.totalItems || 0) : 0;

    return `
      <div class="table-card ${isSelected ? 'selected' : ''} ${hasCalls ? 'calling' : ''}" onclick="selectTable('${tableId}')">
        <div class="table-card-top">
          <span class="table-card-num">Masa ${t.number}</span>
          <span class="table-card-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="table-card-bottom">
          <span class="table-card-price">${formatMoney(totalPrice)}</span>
          <span class="table-card-items">${isOccupied ? `${totalItems} Ürün` : '—'}</span>
        </div>
      </div>
    `;
  }).join('');
}

function filterTables(filterType) {
  state.tableFilter = filterType;
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filterType);
  });
  renderTables();
}

function selectTable(tableId) {
  state.selectedTableId = normalizeTableId(tableId);
  renderHeader();
  renderTables();
  renderAdisyon();
  renderProducts();

  // If mobile, switch view smoothly
  if (window.innerWidth <= 768) {
    const norm = normalizeTableId(tableId);
    const adisyon = state.adisyons[norm];
    const hasItems = adisyon && adisyon.items && adisyon.items.length > 0;
    switchView(hasItems ? 'adisyon' : 'catalog');
  }
}

// 3. Category Bar Rendering
function renderCategories() {
  const categories = [{ id: 'all', name: 'Tüm Menü', icon: 'restaurant' }, ...state.categories];
  dom.categoryScrollBar.innerHTML = categories.map(c => {
    const count = c.id === 'all'
      ? state.products.length
      : state.products.filter(p => p.category === c.id).length;

    return `
      <button type="button" class="cat-pill ${state.selectedCategory === c.id ? 'active' : ''}" onclick="selectCategory('${c.id}')">
        <span class="material-symbols-outlined" style="font-size:16px;">${c.icon || 'restaurant'}</span>
        <span class="cat-pill-name">${escapeHtml(c.name)}</span>
        <span class="cat-count-badge">${count}</span>
      </button>
    `;
  }).join('');
}

function selectCategory(catId) {
  state.selectedCategory = catId;
  renderCategories();
  renderProducts();
}

function getCategoryIcon(catId) {
  switch (catId) {
    case 'donerler': return 'lunch_dining';
    case 'tostlar': return 'breakfast_dining';
    case 'burgerler': return 'lunch_dining';
    case 'menuler': return 'restaurant_menu';
    case 'citir-lezzetler': return 'fastfood';
    case 'sicak-icecekler': return 'local_cafe';
    case 'soguk-icecekler': return 'local_drink';
    case 'frozen': return 'icecream';
    case 'tatlilar': return 'cake';
    default: return 'restaurant';
  }
}

// 4. Products Grid Rendering (HIZLI ÜRÜN EKLEME)
function renderProducts() {
  const query = state.searchQuery.toLowerCase().trim();
  const currentTableNorm = normalizeTableId(state.selectedTableId);
  const currentAdisyon = state.adisyons[currentTableNorm];
  const adisyonItems = (currentAdisyon && Array.isArray(currentAdisyon.items)) ? currentAdisyon.items : [];

  const filtered = state.products.filter(p => {
    if (state.selectedCategory !== 'all' && p.category !== state.selectedCategory) {
      return false;
    }
    if (query) {
      const matchName = (p.name || '').toLowerCase().includes(query);
      const matchDesc = (p.desc || '').toLowerCase().includes(query);
      const matchPortion = (p.portion || '').toLowerCase().includes(query);
      return matchName || matchDesc || matchPortion;
    }
    return true;
  });

  if (filtered.length === 0) {
    dom.productsGrid.innerHTML = `
      <div class="products-empty-state">
        <span class="material-symbols-outlined">search_off</span>
        <p>Eşleşen ürün bulunamadı</p>
        <span>Farklı bir arama kelimesi veya kategori seçin.</span>
      </div>
    `;
    return;
  }

  dom.productsGrid.innerHTML = filtered.map(p => {
    const priceNum = parseFloat(String(p.price || 0).replace(',', '.')) || 0;
    const hasImg = p.img && typeof p.img === 'string' && p.img.trim().length > 0;
    const catIcon = getCategoryIcon(p.category);

    // Quantity of this product already in active table adisyon
    const tableItemCount = adisyonItems
      .filter(it => it.productId === p.id || it.name.toLowerCase() === (p.name || '').toLowerCase())
      .reduce((sum, it) => sum + (it.quantity || 0), 0);

    return `
      <div class="product-card ${tableItemCount > 0 ? 'in-adisyon' : ''}" onclick="quickAddItem('${p.id}', '', event)">
        <div class="product-card-thumb">
          ${hasImg
            ? `<img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" class="product-card-img" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
               <div class="thumb-fallback" style="display:none;">
                 <span class="material-symbols-outlined">${catIcon}</span>
               </div>`
            : `<div class="thumb-fallback">
                 <span class="material-symbols-outlined">${catIcon}</span>
               </div>`
          }
          ${p.badge ? `<span class="product-card-badge">${escapeHtml(p.badge)}</span>` : ''}
          ${tableItemCount > 0 ? `
            <span class="product-card-count-badge" title="Masa adisyonunda ${tableItemCount} adet var">
              <span class="material-symbols-outlined" style="font-size:11px;">receipt</span>
              <span>x${tableItemCount}</span>
            </span>` : ''
          }
        </div>
        <div class="product-card-body">
          <div class="product-card-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
          <div class="product-card-portion">${escapeHtml(p.portion || 'Standart Servis')}</div>
        </div>
        <div class="product-card-footer">
          <span class="product-card-price">${formatMoney(priceNum)}</span>
          <button type="button" class="product-card-add-btn" title="Adisyona Ekle">
            <span class="material-symbols-outlined" style="font-size:18px;">add</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function handleCatalogSearch(val) {
  state.searchQuery = val;
  dom.btnClearSearch.style.display = val.trim() ? 'flex' : 'none';
  renderProducts();
}

function clearCatalogSearch() {
  dom.catalogSearch.value = '';
  handleCatalogSearch('');
}

// 5. Adisyon Panel Rendering
function renderAdisyon() {
  const normId = normalizeTableId(state.selectedTableId);
  const tableNum = parseInt(normId, 10);
  dom.adisyonTableTitle.textContent = `Masa ${tableNum} Adisyonu`;

  const adisyon = state.adisyons[normId];
  const items = (adisyon && Array.isArray(adisyon.items)) ? adisyon.items : [];
  const isOpen = items.length > 0;

  dom.adisyonStatusTag.textContent = isOpen ? 'Açık Adisyon' : 'Boş Masa';
  dom.adisyonStatusTag.style.color = isOpen ? 'var(--accent-green)' : 'var(--text-dim)';

  // Table Call Alert Banner
  const tableCalls = state.notifications.filter(n => normalizeTableId(n.table) === normId);
  if (tableCalls.length > 0) {
    const firstCall = tableCalls[0];
    const isOrder = isOrderNotification(firstCall);

    dom.tableCallBanner.style.display = 'flex';
    dom.tableCallBanner.classList.toggle('order-style', isOrder);

    if (dom.tableCallIcon) {
      dom.tableCallIcon.textContent = isOrder ? 'restaurant' : 'notifications_active';
    }

    dom.tableCallTitle.textContent = isOrder
      ? `🔔 Yeni Sipariş Geldi! (${firstCall.time || ''})`
      : `${firstCall.type} (${firstCall.time || ''})`;

    dom.tableCallNote.textContent = firstCall.note ? firstCall.note : (isOrder ? 'Müşteri menüden sipariş gönderdi.' : 'Müşteri servis bekliyor.');

    if (dom.btnBannerText && dom.btnBannerIcon) {
      dom.btnBannerIcon.textContent = isOrder ? 'check_circle' : 'done';
      dom.btnBannerText.textContent = isOrder ? 'Siparişi Onayla & Adisyona Ekle' : 'Onayla & Kapat';
    }
  } else {
    dom.tableCallBanner.style.display = 'none';
  }

  // Items List
  if (!isOpen) {
    dom.adisyonItemsList.innerHTML = `
      <div class="empty-adisyon">
        <span class="material-symbols-outlined">add_shopping_cart</span>
        <p>Masa ${tableNum} için açık sipariş yok.</p>
        <span>Ortadaki menüden ürünlere dokunarak hızlıca ekleyin.</span>
      </div>
    `;
    dom.adisyonTotalCount.textContent = '0 Adet';
    dom.adisyonTotalPrice.textContent = formatMoney(0);
    return;
  }

  dom.adisyonTotalCount.textContent = `${adisyon.totalItems || 0} Adet`;
  dom.adisyonTotalPrice.textContent = formatMoney(adisyon.totalAmount || 0);

  dom.adisyonItemsList.innerHTML = items.map(item => `
    <div class="adisyon-item-row">
      <div class="item-row-top">
        <div class="item-info">
          <div class="item-name">${escapeHtml(item.name)}</div>
          <div class="item-portion">${escapeHtml(item.portion || 'Standart')}</div>
          ${item.note ? `<div class="item-note-badge">Not: ${escapeHtml(item.note)}</div>` : ''}
        </div>
        <button type="button" class="btn-remove-item" onclick="removeItem('${item.id}')" title="Ürünü Sil">
          <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
        </button>
      </div>

      <div class="item-row-bottom">
        <div class="qty-stepper">
          <button type="button" class="stepper-btn" onclick="updateItemDelta('${item.id}', -1)">-</button>
          <span class="stepper-qty">${item.quantity}</span>
          <button type="button" class="stepper-btn" onclick="updateItemDelta('${item.id}', 1)">+</button>
        </div>

        <div class="item-pricing">
          <span style="font-size:11px; color:var(--text-dim);">${formatMoney(item.price)} × ${item.quantity}</span>
          <span class="item-total-price">${formatMoney(item.total || 0)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// 6. Calls Drawer Rendering (BEKLEYEN ÇAĞRILARI GÖRME & KAPATMA)
function renderCallsDrawer() {
  const calls = state.notifications;
  dom.drawerCallsCount.textContent = calls.length;

  if (calls.length === 0) {
    dom.drawerCallsList.innerHTML = `
      <div style="text-align:center; padding: 40px 16px; color:var(--text-dim);">
        <span class="material-symbols-outlined" style="font-size:40px; color:var(--accent-green);">check_circle</span>
        <p style="margin-top:8px; font-weight:700; color:var(--text-main);">Bekleyen çağrı bulunmuyor!</p>
        <span style="font-size:12px;">Müşteri çağrıları anlık olarak burada listelenir.</span>
      </div>
    `;
    return;
  }

  dom.drawerCallsList.innerHTML = calls.map(c => {
    const isOrder = isOrderNotification(c);
    const normTable = normalizeTableId(c.table);
    const tableNum = parseInt(normTable, 10);

    let itemsPreviewHtml = '';
    if (Array.isArray(c.items) && c.items.length > 0) {
      itemsPreviewHtml = `
        <div class="order-items-preview">
          ${c.items.map(it => `
            <div class="order-item-preview-row">
              <span class="qty-name">${it.quantity || 1}x ${escapeHtml(it.name)}${it.portion && it.portion !== 'Standart' ? ` (${escapeHtml(it.portion)})` : ''}</span>
              <span class="price">${formatMoney((it.price || 0) * (it.quantity || 1))}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="call-card ${isOrder ? 'order-type' : ''}">
        <div class="call-card-top">
          <span class="call-card-table">
            <span class="material-symbols-outlined" style="font-size:16px;">table_restaurant</span>
            Masa ${tableNum}
          </span>
          <span class="call-card-time">${c.time || ''}</span>
        </div>
        <div class="call-card-type">${isOrder ? '📦 Müşteri Siparişi' : escapeHtml(c.type)}</div>
        ${c.note ? `<div class="call-card-note">${escapeHtml(c.note)}</div>` : ''}
        ${itemsPreviewHtml}

        <div class="call-card-actions" style="${isOrder ? 'flex-direction:column; gap:6px;' : ''}">
          ${isOrder ? `
            <button type="button" class="btn-approve-order" onclick="approveOrder('${c.id}')">
              <span class="material-symbols-outlined" style="font-size:16px;">check_circle</span>
              <span>Siparişi Onayla & Adisyona Ekle</span>
            </button>
            <div style="display:flex; width:100%; gap:8px;">
              <button type="button" class="btn-open-table-from-call" onclick="jumpToTableFromCall('${normTable}')">
                <span class="material-symbols-outlined" style="font-size:14px;">receipt_long</span>
                <span>Adisyonu Aç</span>
              </button>
              <button type="button" class="btn-dismiss-call" style="background:var(--bg-panel); color:var(--text-muted); border:1px solid var(--border-color);" onclick="dismissSingleCall('${c.id}', false)">
                <span>Yalnızca Kapat</span>
              </button>
            </div>
          ` : `
            <button type="button" class="btn-open-table-from-call" onclick="jumpToTableFromCall('${normTable}')">
              <span class="material-symbols-outlined" style="font-size:14px;">receipt_long</span>
              <span>Adisyonu Aç</span>
            </button>
            <button type="button" class="btn-dismiss-call" onclick="dismissSingleCall('${c.id}')">
              <span class="material-symbols-outlined" style="font-size:14px;">check</span>
              <span>Onayla & Kapat</span>
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// ==================== ACTIONS & APIS ====================

// Hızlı Ürün Ekleme (POST /api/garson/tables/:tableId/items)
async function quickAddItem(productId, customNote = '', event = null) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  playTapChime();

  if (event) {
    const card = event.currentTarget || (event.target && event.target.closest('.product-card'));
    if (card) {
      card.classList.add('item-tap-pulse');
      setTimeout(() => card.classList.remove('item-tap-pulse'), 300);
    }
  }

  const tableId = normalizeTableId(state.selectedTableId);

  try {
    const res = await fetch(`/api/garson/tables/${tableId}/items`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        productId: product.id,
        name: product.name,
        price: product.price,
        portion: product.portion || 'Standart',
        note: customNote,
        quantity: 1
      })
    });

    const json = await res.json();
    if (json.success && json.data) {
      state.adisyons[tableId] = json.data;
      renderHeader();
      renderTables();
      renderAdisyon();
      renderProducts();
      showToast(`${product.name} adisyona eklendi.`, 'success');
    }
  } catch (err) {
    showToast('Ürün eklenirken hata oluştu.', 'error');
  }
}

// Adisyon Miktar Değiştirme (+1 / -1)
async function updateItemDelta(itemId, delta) {
  playTapChime();
  const tableId = normalizeTableId(state.selectedTableId);

  try {
    const res = await fetch(`/api/garson/tables/${tableId}/items/${itemId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ delta })
    });
    const json = await res.json();
    if (json.success && json.data) {
      state.adisyons[tableId] = json.data;
      renderHeader();
      renderTables();
      renderAdisyon();
      renderProducts();
    }
  } catch (err) {
    showToast('Güncelleme hatası.', 'error');
  }
}

// Adisyondan Ürün Silme
async function removeItem(itemId) {
  playTapChime();
  const tableId = normalizeTableId(state.selectedTableId);

  try {
    const res = await fetch(`/api/garson/tables/${tableId}/items/${itemId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (json.success && json.data) {
      state.adisyons[tableId] = json.data;
      renderHeader();
      renderTables();
      renderAdisyon();
      renderProducts();
      showToast('Ürün adisyondan çıkarıldı.', 'success');
    }
  } catch (err) {
    showToast('Silme hatası.', 'error');
  }
}

// Hızlı Not Ekleme Çipi
function applyQuickNote(note) {
  const normId = normalizeTableId(state.selectedTableId);
  const adisyon = state.adisyons[normId];
  if (!adisyon || !adisyon.items || adisyon.items.length === 0) {
    showToast('Önce adisyona bir ürün ekleyin.', 'error');
    return;
  }
  // Attach note to the most recently added item
  const lastItem = adisyon.items[adisyon.items.length - 1];
  const combinedNote = lastItem.note ? `${lastItem.note}, ${note}` : note;

  fetch(`/api/garson/tables/${normId}/items/${lastItem.id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ note: combinedNote })
  }).then(r => r.json()).then(json => {
    if (json.success && json.data) {
      state.adisyons[normId] = json.data;
      renderAdisyon();
      showToast(`Not eklendi: ${note}`, 'success');
    }
  });
}

function openCustomNoteModal() {
  const note = prompt('Bu masa için özel sipariş notu girin:');
  if (note && note.trim()) {
    applyQuickNote(note.trim());
  }
}

// ==================== ÇAĞRILARI KAPATMA & SİPARİŞİ ONAYLAMA APILERI ====================

// Siparişi Onayla & Doğrudan Masa Adisyonuna Ekle
async function approveOrder(callId) {
  playSuccessChime();
  const targetCall = state.notifications.find(n => n.id === callId);
  const targetTableId = targetCall ? normalizeTableId(targetCall.table) : state.selectedTableId;

  let handledOnServer = false;

  // 1. Primary dedicated endpoint
  try {
    const res = await fetch(`/api/garson/calls/${callId}/approve-order`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) {
        handledOnServer = true;
        if (json.data && json.data.tableId && json.data.adisyon) {
          state.adisyons[json.data.tableId] = json.data.adisyon;
        }
      }
    }
  } catch (err) {
    console.warn('approve-order route error, trying resilient fallback...', err);
  }

  // 2. Resilient fallback (if server had not restarted or returned non-JSON)
  if (!handledOnServer) {
    try {
      // Add items directly to table
      if (targetCall && Array.isArray(targetCall.items) && targetCall.items.length > 0) {
        for (const it of targetCall.items) {
          await fetch(`/api/garson/tables/${targetTableId}/items`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              productId: it.productId || '',
              name: it.name || 'Sipariş Ürünü',
              price: it.price || 0,
              portion: it.portion || 'Standart',
              quantity: it.quantity || 1,
              note: it.note || ''
            })
          }).then(r => r.json()).then(j => {
            if (j && j.success && j.data) {
              state.adisyons[targetTableId] = j.data;
            }
          }).catch(() => {});
        }
      }
      // Dismiss notification via DELETE or POST dismiss
      await fetch(`/api/notifications/${callId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      }).catch(() => {});
    } catch (fallbackErr) {
      console.warn('Fallback error:', fallbackErr);
    }
  }

  // 3. Always remove notification from client state
  state.notifications = state.notifications.filter(n => n.id !== callId);

  // 4. Auto-select this table
  state.selectedTableId = targetTableId;

  // 5. Close calls drawer if currently open
  if (state.isCallsDrawerOpen) {
    toggleCallsDrawer();
  }

  // 6. Re-render UI
  renderHeader();
  renderTables();
  renderAdisyon();
  renderCallsDrawer();

  // 7. On mobile, switch smoothly to adisyon view so waiter sees added items
  if (window.innerWidth <= 768) {
    switchView('adisyon');
  }

  showToast(`Masa ${parseInt(targetTableId, 10)} siparişi onaylandı ve adisyona eklendi!`, 'success');
}

// Seçili Masanın Banner İşlemi (Sipariş ise Onayla&Ekle, Servis ise Kapat)
async function handleCurrentTableCallAction() {
  const normId = normalizeTableId(state.selectedTableId);
  const tableCalls = state.notifications.filter(n => normalizeTableId(n.table) === normId);
  if (tableCalls.length === 0) return;

  const firstCall = tableCalls[0];
  if (isOrderNotification(firstCall)) {
    await approveOrder(firstCall.id);
  } else {
    await dismissSingleCall(firstCall.id, false);
  }
}

// Tekil Çağrıyı Kapat (Sipariş ise isteğe bağlı adisyona ekler)
async function dismissSingleCall(callId, addToAdisyon = true) {
  playTapChime();
  const targetCall = state.notifications.find(n => n.id === callId);
  const isOrder = isOrderNotification(targetCall);

  if (isOrder && addToAdisyon) {
    return await approveOrder(callId);
  }

  try {
    const res = await fetch(`/api/garson/calls/${callId}/dismiss`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ addToAdisyon: false })
    });
    if (!res.ok) {
      await fetch(`/api/notifications/${callId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
    }
  } catch (err) {
    await fetch(`/api/notifications/${callId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    }).catch(() => {});
  }

  state.notifications = state.notifications.filter(n => n.id !== callId);

  if (state.isCallsDrawerOpen && state.notifications.length === 0) {
    toggleCallsDrawer();
  }

  renderHeader();
  renderTables();
  renderAdisyon();
  renderCallsDrawer();
  showToast('Çağrı kapatıldı.', 'success');
}

// Seçili Masanın Tüm Çağrılarını Kapat
async function dismissCurrentTableCalls() {
  playTapChime();
  const tableId = normalizeTableId(state.selectedTableId);
  try {
    const res = await fetch('/api/garson/calls/dismiss-table', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ tableId })
    });
    const json = await res.json();
    if (json.success) {
      state.notifications = state.notifications.filter(n => normalizeTableId(n.table) !== tableId);
      renderHeader();
      renderTables();
      renderAdisyon();
      renderCallsDrawer();
      showToast(`Masa ${parseInt(tableId, 10)} çağrıları onaylandı ve kapatıldı.`, 'success');
    }
  } catch (err) {
    showToast('Hata oluştu.', 'error');
  }
}

// Tüm Bekleyen Çağrıları Kapat
async function dismissAllCalls() {
  if (state.notifications.length === 0) return;
  if (!confirm('Tüm bekleyen masa çağrılarını onaylayıp kapatmak istiyor musunuz?')) return;

  const callsToDismiss = [...state.notifications];
  for (const call of callsToDismiss) {
    await fetch(`/api/garson/calls/${call.id}/dismiss`, {
      method: 'POST',
      headers: getAuthHeaders()
    }).catch(() => {});
  }

  state.notifications = [];
  renderHeader();
  renderTables();
  renderAdisyon();
  renderCallsDrawer();
  showToast('Tüm çağrılar başarıyla kapatıldı.', 'success');
}

function jumpToTableFromCall(tableId) {
  selectTable(tableId);
  toggleCallsDrawer();
}

function toggleCallsDrawer() {
  state.isCallsDrawerOpen = !state.isCallsDrawerOpen;
  dom.callsDrawer.classList.toggle('active', state.isCallsDrawerOpen);
  dom.callsDrawerBackdrop.classList.toggle('active', state.isCallsDrawerOpen);
}

// ==================== HESAP KAPATMA & ÖDEME ====================
function openPaymentModal() {
  const normId = normalizeTableId(state.selectedTableId);
  const adisyon = state.adisyons[normId];
  if (!adisyon || !adisyon.items || adisyon.items.length === 0) {
    showToast('Bu masada açık adisyon bulunmuyor.', 'error');
    return;
  }

  dom.paymentModalTitle.textContent = `Hesap Kapat — Masa ${parseInt(normId, 10)}`;
  dom.paymentModalAmount.textContent = formatMoney(adisyon.totalAmount || 0);
  dom.paymentNoteInput.value = '';
  selectPaymentMethod('Nakit');
  dom.paymentModal.classList.add('active');
}

function closePaymentModal() {
  dom.paymentModal.classList.remove('active');
}

// ==================== MASA TAŞIMA / BİRLEŞTİRME ====================
function openTableTransferModal() {
  const normId = normalizeTableId(state.selectedTableId);
  const adisyon = state.adisyons[normId];
  if (!adisyon || !adisyon.items || adisyon.items.length === 0) {
    showToast('Aktarılacak açık bir adisyon bulunmuyor.', 'error');
    return;
  }

  const modal = document.getElementById('transfer-modal');
  const sel = document.getElementById('transfer-target-select');
  const title = document.getElementById('transfer-modal-title');
  if (title) title.textContent = `Masa ${parseInt(normId, 10)} ➔ Taşı / Birleştir`;

  if (sel) {
    let opts = '';
    const tableCount = state.tableCount || 20;
    for (let i = 1; i <= tableCount; i++) {
      const id = i < 10 ? '0' + i : String(i);
      if (id !== normId) {
        const destAdisyon = state.adisyons[id];
        const statusText = destAdisyon && destAdisyon.items && destAdisyon.items.length > 0
          ? ` (Dolu - ${formatMoney(destAdisyon.totalAmount)} ile BİRLEŞECEK)`
          : ' (Boş Masa)';
        opts += `<option value="${id}">Masa ${i}${statusText}</option>`;
      }
    }
    sel.innerHTML = opts;
  }

  if (modal) modal.classList.add('active');
}

function closeTableTransferModal() {
  const modal = document.getElementById('transfer-modal');
  if (modal) modal.classList.remove('active');
}

async function submitTableTransfer() {
  const fromId = normalizeTableId(state.selectedTableId);
  const sel = document.getElementById('transfer-target-select');
  const toId = sel ? sel.value : null;

  if (!toId || fromId === toId) {
    showToast('Lütfen geçerli bir hedef masa seçin.', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/garson/tables/${fromId}/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-staff-pin': state.pin || '1234',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ toTableId: toId })
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Masa aktarılamadı');
    }

    closeTableTransferModal();
    showToast(json.message || `Masa ${fromId} ➔ Masa ${toId} aktarıldı!`, 'success');
    selectTable(toId);
    loadFullState();
  } catch (err) {
    showToast('Aktarım hatası: ' + err.message, 'error');
  }
}

window.openTableTransferModal = openTableTransferModal;
window.closeTableTransferModal = closeTableTransferModal;
window.submitTableTransfer = submitTableTransfer;

function selectPaymentMethod(method) {
  state.selectedPaymentMethod = method;
  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === method);
  });
}

async function submitPayment() {
  const tableId = normalizeTableId(state.selectedTableId);
  const paymentMethod = state.selectedPaymentMethod;
  const note = dom.paymentNoteInput.value.trim();

  try {
    const res = await fetch(`/api/garson/tables/${tableId}/close`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ paymentMethod, note })
    });
    const json = await res.json();
    if (json.success) {
      delete state.adisyons[tableId];
      state.notifications = state.notifications.filter(n => normalizeTableId(n.table) !== tableId);
      closePaymentModal();
      playSuccessChime();
      renderHeader();
      renderTables();
      renderAdisyon();
      renderCallsDrawer();
      showToast(`Masa ${parseInt(tableId, 10)} hesabı alındı (${paymentMethod}). Masa boşaltıldı.`, 'success');
    }
  } catch (err) {
    showToast('Hesap kapatılırken hata oluştu.', 'error');
  }
}

// Adisyon İptal Et
async function clearAdisyonWithConfirm() {
  const normId = normalizeTableId(state.selectedTableId);
  const adisyon = state.adisyons[normId];
  if (!adisyon || !adisyon.items || adisyon.items.length === 0) return;

  if (!confirm(`Masa ${parseInt(normId, 10)} adisyonunu tamamen iptal etmek ve masayı boşaltmak istiyor musunuz?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/garson/tables/${normId}/clear`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (json.success) {
      delete state.adisyons[normId];
      renderHeader();
      renderTables();
      renderAdisyon();
      showToast('Adisyon iptal edildi, masa hazır.', 'success');
    }
  } catch (err) {
    showToast('İptal işlemi başarısız.', 'error');
  }
}

// Fiş Görüntüleme Modal
function openReceiptModal() {
  const normId = normalizeTableId(state.selectedTableId);
  const adisyon = state.adisyons[normId];
  if (!adisyon || !adisyon.items || adisyon.items.length === 0) {
    showToast('Yazdırılacak adisyon bulunmuyor.', 'error');
    return;
  }

  dom.receiptTableText.textContent = `Masa: ${parseInt(normId, 10)}`;
  dom.receiptDateText.textContent = `Tarih: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
  dom.receiptTotalAmount.textContent = formatMoney(adisyon.totalAmount || 0);

  dom.receiptItemsTable.innerHTML = adisyon.items.map(it => `
    <div class="receipt-item-row">
      <span>${it.quantity}x ${escapeHtml(it.name)}</span>
      <span>${formatMoney(it.total)}</span>
    </div>
  `).join('');

  dom.receiptModal.classList.add('active');
}

function closeReceiptModal() {
  dom.receiptModal.classList.remove('active');
}

// ==================== VIEW SWITCHER (FOR MOBILE) ====================
function switchView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll('.m-bottom-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  dom.panelTables.classList.toggle('active', viewName === 'tables');
  dom.panelCatalog.classList.toggle('active', viewName === 'catalog');
  dom.panelAdisyon.classList.toggle('active', viewName === 'adisyon');

  const activePanel = viewName === 'tables' ? dom.panelTables : (viewName === 'catalog' ? dom.panelCatalog : dom.panelAdisyon);
  if (activePanel) {
    activePanel.scrollTop = 0;
  }
}

// ==================== HELPERS ====================
function normalizeTurkish(str) {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isOrderNotification(call) {
  if (!call) return false;
  if (typeof call.id === 'string' && call.id.startsWith('order_')) return true;
  if (Array.isArray(call.items) && call.items.length > 0) return true;
  const t = normalizeTurkish(call.type);
  return t.includes('sipar') || t.includes('order');
}

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

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  localStorage.setItem('alibaba_waiter_sound', String(state.soundEnabled));
  updateSoundIcon();
  if (state.soundEnabled) {
    playTapChime();
    showToast('Sesli bildirimler açık', 'success');
  } else {
    showToast('Sesli bildirimler kapatıldı', 'success');
  }
}

function updateSoundIcon() {
  dom.soundIcon.textContent = state.soundEnabled ? 'volume_up' : 'volume_off';
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined" style="font-size:18px;">
      ${type === 'success' ? 'check_circle' : type === 'error' ? 'info' : 'notifications'}
    </span>
    <span>${escapeHtml(message)}</span>
  `;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'all 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

