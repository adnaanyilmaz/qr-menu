/**
 * Ali Baba Döner Kafe - Admin Control Engine
 * Comprehensive administration dashboard for digital menu, categories, QR generator & settings
 */

let adminData = {
  settings: {},
  categories: [],
  products: [],
  notifications: [],
  currentTab: 'dashboard',
  editingProductId: null,
  editingCategoryId: null,
  pollTimer: null
};

// Initialize Admin on load
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupNavTabs();
  setupEventListeners();
});

// Authentication Handling
function checkAuth() {
  const token = sessionStorage.getItem('alibaba_admin_token');
  const loginScreen = document.getElementById('login-screen');
  
  if (token) {
    if (loginScreen) loginScreen.style.display = 'none';
    loadAllAdminData();
    startNotificationPolling();
  } else {
    if (loginScreen) loginScreen.style.display = 'flex';
  }
}

async function handleLogin(e) {
  if (e) e.preventDefault();
  const pinInput = document.getElementById('login-pin');
  const errorMsg = document.getElementById('login-error');
  const pin = pinInput ? pinInput.value.trim() : '';

  if (!pin) {
    if (errorMsg) errorMsg.textContent = 'Lütfen PIN veya şifre girin.';
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin, password: pin })
    });

    const data = await res.json();
    if (data.success && data.token) {
      sessionStorage.setItem('alibaba_admin_token', data.token);
      document.getElementById('login-screen').style.display = 'none';
      if (errorMsg) errorMsg.textContent = '';
      loadAllAdminData();
      startNotificationPolling();
      showAdminToast('Giriş başarılı!');
    } else {
      if (errorMsg) errorMsg.textContent = data.message || 'Geçersiz PIN veya şifre!';
    }
  } catch (err) {
    if (errorMsg) errorMsg.textContent = 'Sunucuya bağlanılamadı.';
  }
}

function handleLogout() {
  sessionStorage.removeItem('alibaba_admin_token');
  clearInterval(adminData.pollTimer);
  window.location.reload();
}

// Fetch All Initial Data
async function loadAllAdminData() {
  try {
    const res = await fetch('/api/menu');
    const result = await res.json();
    if (result.success && result.data) {
      adminData.settings = result.data.settings || {};
      adminData.categories = result.data.categories || [];
      adminData.products = result.data.products || [];
      
      updateBrandUI();
      renderDashboard();
      renderProductsTable();
      renderCategoriesList();
      populateCategoryDropdowns();
      populateSettingsForm();
      updateTableQRPreview('04');
    }
  } catch (err) {
    console.error('Error loading admin data:', err);
    showAdminToast('Veriler yüklenirken hata oluştu.');
  }
}

// Navigation Tabs
function setupNavTabs() {
  const navBtns = document.querySelectorAll('.nav-item-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');
      switchTab(tabTarget);
    });
  });

  // Mobile menu toggle
  const toggleBtn = document.getElementById('menu-toggle-btn');
  const sidebar = document.getElementById('admin-sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

function switchTab(tabId) {
  adminData.currentTab = tabId;

  // Update nav buttons
  document.querySelectorAll('.nav-item-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  // Update tab sections
  document.querySelectorAll('.tab-content').forEach(sec => {
    if (sec.id === `tab-${tabId}`) sec.classList.add('active');
    else sec.classList.remove('active');
  });

  // Update page title
  const titles = {
    'dashboard': 'Genel Bakış & Sipariş Masaları',
    'products': 'Ürün ve Fiyat Yönetimi',
    'categories': 'Kategori Yönetimi',
    'qr-studio': 'Masa QR Kod Stüdyosu',
    'settings': 'Kafe & Sistem Ayarları'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl && titles[tabId]) titleEl.textContent = titles[tabId];

  // Close mobile sidebar if open
  const sidebar = document.getElementById('admin-sidebar');
  if (sidebar) sidebar.classList.remove('open');

  if (tabId === 'dashboard') renderDashboard();
  if (tabId === 'products') renderProductsTable();
  if (tabId === 'categories') renderCategoriesList();
  if (tabId === 'qr-studio') updateTableQRPreview(document.getElementById('qr-table-select').value || '04');
}

// Update Topbar and Branding
function updateBrandUI() {
  const s = adminData.settings;
  const brandTitle = document.getElementById('sidebar-brand-name');
  const brandLogo = document.getElementById('sidebar-logo');
  if (brandTitle && s.restaurantName) brandTitle.textContent = s.restaurantName;
  if (brandLogo && s.logoInitials) brandLogo.textContent = s.logoInitials;
}

// ==========================================================================
// Dashboard View & Live Waiter Notifications
// ==========================================================================
function renderDashboard() {
  const totalProducts = adminData.products.length;
  const inStock = adminData.products.filter(p => p.inStock !== false).length;
  const outOfStock = totalProducts - inStock;
  const totalCats = adminData.categories.length;

  document.getElementById('stat-total-products').textContent = totalProducts;
  document.getElementById('stat-in-stock').textContent = inStock;
  document.getElementById('stat-out-stock').textContent = outOfStock;
  document.getElementById('stat-total-categories').textContent = totalCats;

  fetchNotifications();
}

function startNotificationPolling() {
  clearInterval(adminData.pollTimer);
  fetchNotifications();
  adminData.pollTimer = setInterval(fetchNotifications, 5000);
}

async function fetchNotifications() {
  try {
    const res = await fetch('/api/notifications');
    const result = await res.json();
    if (result.success && result.data) {
      adminData.notifications = result.data;
      renderNotificationList();
    }
  } catch (e) {}
}

function renderNotificationList() {
  const container = document.getElementById('notification-list');
  const countBadge = document.getElementById('notif-nav-badge');
  const notifs = adminData.notifications;

  if (countBadge) {
    if (notifs.length > 0) {
      countBadge.style.display = 'inline-block';
      countBadge.textContent = notifs.length;
    } else {
      countBadge.style.display = 'none';
    }
  }

  if (!container) return;

  if (notifs.length === 0) {
    container.innerHTML = `
      <div class="notif-empty">
        <span class="material-symbols-outlined" style="font-size:36px; color:#cbd5e1; display:block; margin-bottom:8px;">notifications_paused</span>
        Şu anda bekleyen masa çağrısı bulunmuyor.
      </div>
    `;
    return;
  }

  let html = '';
  notifs.forEach(n => {
    html += `
      <div class="notif-item">
        <div class="notif-left">
          <div class="notif-title">
            <span class="notif-table-pill">Masa ${escapeHtml(n.table)}</span>
            <span>${escapeHtml(n.type)}</span>
          </div>
          ${n.note ? `<div class="notif-desc">${escapeHtml(n.note)}</div>` : ''}
          <div class="notif-time">İletilme: ${escapeHtml(n.time)}</div>
        </div>
        <button class="notif-btn-clear" onclick="dismissNotification('${n.id}')" title="Tamamlandı olarak işaretle">
          <span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle;">check</span> İlgilendim
        </button>
      </div>
    `;
  });

  container.innerHTML = html;
}

async function dismissNotification(id) {
  try {
    const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      adminData.notifications = adminData.notifications.filter(n => n.id !== id);
      renderNotificationList();
      showAdminToast('Masa bildirimi kapatıldı.');
    }
  } catch (e) {}
}

// ==========================================================================
// Product Management (CRUD)
// ==========================================================================
function renderProductsTable() {
  const tableBody = document.getElementById('products-table-body');
  if (!tableBody) return;

  const searchQuery = (document.getElementById('product-search-input')?.value || '').trim().toLowerCase();
  const filterCategory = document.getElementById('product-filter-category')?.value || 'all';
  const filterStock = document.getElementById('product-filter-stock')?.value || 'all';

  let filtered = adminData.products.filter(p => {
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery) || 
      (p.desc && p.desc.toLowerCase().includes(searchQuery));
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    const matchesStock = filterStock === 'all' || 
      (filterStock === 'in' && p.inStock !== false) || 
      (filterStock === 'out' && p.inStock === false);

    return matchesSearch && matchesCategory && matchesStock;
  });

  document.getElementById('filtered-product-count').textContent = `${filtered.length} ürün listeleniyor`;

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:32px; color:#94a3b8;">
          Kriterlere uygun ürün bulunamadı.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  filtered.forEach(p => {
    const catObj = adminData.categories.find(c => c.id === p.category);
    const catName = catObj ? catObj.name : p.category;
    const isStock = p.inStock !== false;
    const isFeatured = Boolean(p.featured);

    html += `
      <tr>
        <td style="width:60px;">
          ${p.img ? `<img src="${escapeHtml(p.img)}" class="prod-thumb" alt="${escapeHtml(p.name)}">` : 
            `<div class="prod-thumb" style="display:flex; align-items:center; justify-content:center; color:#94a3b8;"><span class="material-symbols-outlined">restaurant</span></div>`}
        </td>
        <td>
          <div class="prod-name-cell">
            <span class="prod-table-title">${escapeHtml(p.name)}</span>
            <span class="prod-table-desc">${escapeHtml(p.portion || '')} • ${escapeHtml(p.desc || '')}</span>
          </div>
        </td>
        <td>
          <span style="background:#f1f5f9; padding:3px 8px; border-radius:6px; font-weight:600; font-size:12px;">${escapeHtml(catName)}</span>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:4px;">
            <input type="text" class="quick-price-input" value="${escapeHtml(p.price)}" 
                   onchange="quickUpdatePrice('${p.id}', this.value)"
                   style="width:65px; padding:4px 6px; border:1px solid #cbd5e1; border-radius:6px; font-weight:700; text-align:right;">
            <span style="font-weight:700; color:#b91c1c;">${escapeHtml(p.currency || '₺')}</span>
          </div>
        </td>
        <td>
          <button class="stock-toggle-btn ${isStock ? 'stock-in' : 'stock-out'}" onclick="toggleStock('${p.id}')">
            <span class="material-symbols-outlined" style="font-size:14px;">${isStock ? 'check_circle' : 'cancel'}</span>
            <span>${isStock ? 'Stokta' : 'Tükendi'}</span>
          </button>
        </td>
        <td>
          <button class="star-featured-btn ${isFeatured ? 'active' : ''}" onclick="toggleFeatured('${p.id}')" title="Favorilere ekle/çıkar">
            <span class="material-symbols-outlined" style="font-size:22px;">${isFeatured ? 'star' : 'star_border'}</span>
          </button>
        </td>
        <td>
          <div class="action-btns">
            <button class="icon-action-btn" onclick="openEditProductModal('${p.id}')" title="Düzenle">
              <span class="material-symbols-outlined" style="font-size:17px;">edit</span>
            </button>
            <button class="icon-action-btn btn-delete" onclick="confirmDeleteProduct('${p.id}')" title="Sil">
              <span class="material-symbols-outlined" style="font-size:17px;">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;
}

// Quick Inline Updates
async function quickUpdatePrice(id, newPrice) {
  try {
    const res = await fetch(`/api/products/${id}/quick-price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: newPrice })
    });
    const result = await res.json();
    if (result.success) {
      const p = adminData.products.find(x => x.id === id);
      if (p) p.price = result.price;
      showAdminToast('Fiyat güncellendi.');
    }
  } catch (e) {
    showAdminToast('Fiyat güncellenemedi.');
  }
}

async function toggleStock(id) {
  try {
    const res = await fetch(`/api/products/${id}/toggle-stock`, { method: 'PATCH' });
    const result = await res.json();
    if (result.success) {
      const p = adminData.products.find(x => x.id === id);
      if (p) p.inStock = result.inStock;
      renderProductsTable();
      renderDashboard();
      showAdminToast(result.message);
    }
  } catch (e) {
    showAdminToast('Stok durumu güncellenemedi.');
  }
}

async function toggleFeatured(id) {
  try {
    const res = await fetch(`/api/products/${id}/toggle-featured`, { method: 'PATCH' });
    const result = await res.json();
    if (result.success) {
      const p = adminData.products.find(x => x.id === id);
      if (p) p.featured = result.featured;
      renderProductsTable();
      showAdminToast(result.message);
    }
  } catch (e) {
    showAdminToast('Favori durumu güncellenemedi.');
  }
}

// Product Add / Edit Modal
function openAddProductModal() {
  adminData.editingProductId = null;
  document.getElementById('modal-product-form-title').textContent = 'Yeni Ürün Ekle';
  document.getElementById('product-form').reset();
  document.getElementById('form-prod-instock').checked = true;
  document.getElementById('form-prod-featured').checked = false;
  document.getElementById('img-upload-preview').style.display = 'none';

  populateCategoryDropdowns();
  openAdminModal('product-modal');
}

function openEditProductModal(id) {
  const p = adminData.products.find(x => x.id === id);
  if (!p) return;

  adminData.editingProductId = id;
  document.getElementById('modal-product-form-title').textContent = 'Ürünü Düzenle: ' + p.name;
  
  populateCategoryDropdowns();

  document.getElementById('form-prod-name').value = p.name || '';
  document.getElementById('form-prod-category').value = p.category || '';
  document.getElementById('form-prod-price').value = p.price || '';
  document.getElementById('form-prod-portion').value = p.portion || '';
  document.getElementById('form-prod-type').value = p.type || 'food';
  document.getElementById('form-prod-badge').value = p.badge || '';
  document.getElementById('form-prod-allergens').value = p.allergens || '';
  document.getElementById('form-prod-desc').value = p.desc || '';
  document.getElementById('form-prod-img-url').value = p.img || '';
  document.getElementById('form-prod-instock').checked = p.inStock !== false;
  document.getElementById('form-prod-featured').checked = Boolean(p.featured);

  const preview = document.getElementById('img-upload-preview');
  if (p.img) {
    preview.src = p.img;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  openAdminModal('product-modal');
}

// Handle Image File Upload directly via API
async function handleImageUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('image', file);

  showAdminToast('Resim yükleniyor...');

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (result.success && result.url) {
      document.getElementById('form-prod-img-url').value = result.url;
      const preview = document.getElementById('img-upload-preview');
      preview.src = result.url;
      preview.style.display = 'block';
      showAdminToast('Resim başarıyla yüklendi!');
    } else {
      showAdminToast(result.message || 'Resim yüklenemedi.');
    }
  } catch (err) {
    showAdminToast('Resim sunucuya yüklenirken hata oluştu.');
  }
}

// Save Product (Create or Update)
async function saveProductForm(e) {
  if (e) e.preventDefault();

  const name = document.getElementById('form-prod-name').value.trim();
  const category = document.getElementById('form-prod-category').value;
  const price = document.getElementById('form-prod-price').value.trim();
  const portion = document.getElementById('form-prod-portion').value.trim();
  const type = document.getElementById('form-prod-type').value;
  const badge = document.getElementById('form-prod-badge').value.trim();
  const allergens = document.getElementById('form-prod-allergens').value.trim();
  const desc = document.getElementById('form-prod-desc').value.trim();
  const img = document.getElementById('form-prod-img-url').value.trim();
  const inStock = document.getElementById('form-prod-instock').checked;
  const featured = document.getElementById('form-prod-featured').checked;

  if (!name) {
    alert('Lütfen ürün adını giriniz.');
    return;
  }

  const payload = {
    name, category, price, portion, type, badge,
    allergens, desc, img, inStock, featured,
    currency: adminData.settings.currency || '₺'
  };

  try {
    let res, result;
    if (adminData.editingProductId) {
      // Update
      res = await fetch(`/api/products/${adminData.editingProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      result = await res.json();
      if (result.success) {
        const idx = adminData.products.findIndex(p => p.id === adminData.editingProductId);
        if (idx !== -1) adminData.products[idx] = result.data;
        showAdminToast('Ürün başarıyla güncellendi.');
      }
    } else {
      // Create
      res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      result = await res.json();
      if (result.success) {
        adminData.products.unshift(result.data);
        showAdminToast('Yeni ürün eklendi.');
      }
    }

    closeAdminModal('product-modal');
    renderProductsTable();
    renderDashboard();
  } catch (err) {
    showAdminToast('Ürün kaydedilirken hata oluştu.');
  }
}

async function confirmDeleteProduct(id) {
  const p = adminData.products.find(x => x.id === id);
  if (!p) return;

  if (confirm(`"${p.name}" adlı ürünü silmek istediğinize emin misiniz?`)) {
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        adminData.products = adminData.products.filter(x => x.id !== id);
        renderProductsTable();
        renderDashboard();
        showAdminToast('Ürün silindi.');
      }
    } catch (e) {
      showAdminToast('Ürün silinemedi.');
    }
  }
}

// Populate Category Dropdowns
function populateCategoryDropdowns() {
  const selects = [
    document.getElementById('product-filter-category'),
    document.getElementById('form-prod-category')
  ];

  selects.forEach(select => {
    if (!select) return;
    const isFilter = select.id.includes('filter');
    let html = isFilter ? '<option value="all">Tüm Kategoriler</option>' : '';

    adminData.categories.forEach(cat => {
      html += `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`;
    });

    select.innerHTML = html;
  });
}

// ==========================================================================
// Category Management
// ==========================================================================
function renderCategoriesList() {
  const container = document.getElementById('categories-list-container');
  if (!container) return;

  let html = '';
  adminData.categories.forEach(cat => {
    const prodCount = adminData.products.filter(p => p.category === cat.id).length;

    html += `
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; display:flex; align-items:center; justify-content:space-between; box-shadow:var(--shadow-sm);">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:38px; height:38px; border-radius:8px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:#b91c1c;">
            <span class="material-symbols-outlined">${escapeHtml(cat.icon || 'restaurant')}</span>
          </div>
          <div>
            <h4 style="font-size:14px; font-weight:800; color:#0f172a;">${escapeHtml(cat.name)}</h4>
            <span style="font-size:11.5px; color:#64748b;">${prodCount} Ürün • Kod: ${escapeHtml(cat.id)}</span>
          </div>
        </div>
        <div class="action-btns">
          <button class="icon-action-btn" onclick="openEditCategoryModal('${cat.id}')" title="Düzenle">
            <span class="material-symbols-outlined" style="font-size:17px;">edit</span>
          </button>
          <button class="icon-action-btn btn-delete" onclick="confirmDeleteCategory('${cat.id}')" title="Sil">
            <span class="material-symbols-outlined" style="font-size:17px;">delete</span>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function openAddCategoryModal() {
  adminData.editingCategoryId = null;
  document.getElementById('modal-cat-form-title').textContent = 'Yeni Kategori Ekle';
  document.getElementById('form-cat-name').value = '';
  openAdminModal('category-modal');
}

function openEditCategoryModal(id) {
  const cat = adminData.categories.find(c => c.id === id);
  if (!cat) return;

  adminData.editingCategoryId = id;
  document.getElementById('modal-cat-form-title').textContent = 'Kategoriyi Düzenle: ' + cat.name;
  document.getElementById('form-cat-name').value = cat.name;
  openAdminModal('category-modal');
}

async function saveCategoryForm(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('form-cat-name').value.trim();
  if (!name) {
    alert('Lütfen kategori adını giriniz.');
    return;
  }

  try {
    let res, result;
    if (adminData.editingCategoryId) {
      res = await fetch(`/api/categories/${adminData.editingCategoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      result = await res.json();
      if (result.success) {
        const c = adminData.categories.find(x => x.id === adminData.editingCategoryId);
        if (c) c.name = name;
        showAdminToast('Kategori güncellendi.');
      }
    } else {
      res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      result = await res.json();
      if (result.success) {
        adminData.categories.push(result.data);
        showAdminToast('Kategori eklendi.');
      }
    }

    closeAdminModal('category-modal');
    renderCategoriesList();
    populateCategoryDropdowns();
    renderDashboard();
  } catch (err) {
    showAdminToast('Kategori kaydedilemedi.');
  }
}

async function confirmDeleteCategory(id) {
  const cat = adminData.categories.find(c => c.id === id);
  if (!cat) return;

  if (confirm(`"${cat.name}" kategorisini silmek istediğinize emin misiniz? Bu kategorideki ürünler "diger" kategorisine aktarılacaktır.`)) {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        adminData.categories = adminData.categories.filter(c => c.id !== id);
        renderCategoriesList();
        populateCategoryDropdowns();
        renderDashboard();
        showAdminToast('Kategori silindi.');
      }
    } catch (e) {
      showAdminToast('Kategori silinemedi.');
    }
  }
}

// ==========================================================================
// Table QR Studio
// ==========================================================================
async function updateTableQRPreview(tableNum) {
  if (!tableNum) tableNum = '04';
  const padded = isNaN(tableNum) ? tableNum : String(tableNum).padStart(2, '0');

  // Update card elements
  document.getElementById('qr-card-logo').textContent = adminData.settings.logoInitials || 'AB';
  document.getElementById('qr-card-title').textContent = adminData.settings.restaurantName || 'Ali Baba Döner Kafe';
  document.getElementById('qr-card-table-badge').textContent = `Masa ${padded}`;

  const qrImg = document.getElementById('qr-card-img');
  const qrUrlDisplay = document.getElementById('qr-direct-url');

  try {
    const res = await fetch(`/api/qr?table=${encodeURIComponent(padded)}`);
    const data = await res.json();
    if (data.success && data.qrDataUrl) {
      qrImg.src = data.qrDataUrl;
      if (qrUrlDisplay) qrUrlDisplay.textContent = data.url;
    }
  } catch (e) {
    console.error('QR fetch error:', e);
  }
}

function printSingleTableCard() {
  window.print();
}

// Generate batch printable sheet for tables 1-20
function printBatchQRCards() {
  const printWindow = window.open('', '_blank');
  const count = adminData.settings.tableCount || 20;

  let cardsHtml = '';
  for (let i = 1; i <= count; i++) {
    const tableNum = String(i).padStart(2, '0');
    cardsHtml += `
      <div class="print-card">
        <div class="card-logo">${escapeHtml(adminData.settings.logoInitials || 'AB')}</div>
        <h3>${escapeHtml(adminData.settings.restaurantName || 'Ali Baba Döner Kafe')}</h3>
        <p class="sub">Temassız Dijital Menü</p>
        <img src="/api/qr?table=${tableNum}" class="qr-img" alt="Masa ${tableNum}">
        <div class="table-badge">Masa ${tableNum}</div>
        <p class="inst">Kameranızı açıp okutunuz</p>
      </div>
    `;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Toplu Masa QR Kartları - Ali Baba Döner Kafe</title>
      <style>
        body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; background: #fff; margin: 0; padding: 20px; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .print-card { border: 2px dashed #000; border-radius: 12px; padding: 18px 12px; text-align: center; page-break-inside: avoid; }
        .card-logo { width: 36px; height: 36px; background: #93000b; color: #fff; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; margin-bottom: 6px; }
        h3 { margin: 0 0 2px 0; font-size: 15px; }
        .sub { margin: 0 0 10px 0; font-size: 11px; color: #666; }
        .qr-img { width: 140px; height: 140px; }
        .table-badge { background: #93000b; color: #fff; display: inline-block; padding: 4px 14px; border-radius: 9999px; font-weight: 800; font-size: 13px; margin: 8px 0 4px 0; }
        .inst { margin: 0; font-size: 10px; color: #777; }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body onload="setTimeout(() => { window.print(); }, 800);">
      <div class="grid">${cardsHtml}</div>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ==========================================================================
// Settings Form
// ==========================================================================
function populateSettingsForm() {
  const s = adminData.settings;
  if (!s) return;

  document.getElementById('set-restaurant-name').value = s.restaurantName || '';
  document.getElementById('set-slogan').value = s.slogan || '';
  document.getElementById('set-logo-initials').value = s.logoInitials || '';
  document.getElementById('set-hero-title').value = s.heroTitle || '';
  document.getElementById('set-hero-subtitle').value = s.heroSubtitle || '';
  document.getElementById('set-hero-badge').value = s.heroBadge || '';
  document.getElementById('set-hero-img').value = s.heroImage || '';
  document.getElementById('set-wifi-ssid').value = s.wifiSSID || '';
  document.getElementById('set-wifi-pass').value = s.wifiPassword || '';
  document.getElementById('set-contact-info').value = s.contactInfo || '';
  document.getElementById('set-location-info').value = s.locationInfo || '';
  document.getElementById('set-instagram').value = s.instagramHandle || '';
  document.getElementById('set-currency').value = s.currency || '₺';
  document.getElementById('set-table-count').value = s.tableCount || 20;
}

async function saveSettings(e) {
  if (e) e.preventDefault();

  const payload = {
    restaurantName: document.getElementById('set-restaurant-name').value.trim(),
    slogan: document.getElementById('set-slogan').value.trim(),
    logoInitials: document.getElementById('set-logo-initials').value.trim(),
    heroTitle: document.getElementById('set-hero-title').value.trim(),
    heroSubtitle: document.getElementById('set-hero-subtitle').value.trim(),
    heroBadge: document.getElementById('set-hero-badge').value.trim(),
    heroImage: document.getElementById('set-hero-img').value.trim(),
    wifiSSID: document.getElementById('set-wifi-ssid').value.trim(),
    wifiPassword: document.getElementById('set-wifi-pass').value.trim(),
    contactInfo: document.getElementById('set-contact-info').value.trim(),
    locationInfo: document.getElementById('set-location-info').value.trim(),
    instagramHandle: document.getElementById('set-instagram').value.trim(),
    currency: document.getElementById('set-currency').value.trim(),
    tableCount: parseInt(document.getElementById('set-table-count').value, 10) || 20
  };

  const newPin = document.getElementById('set-admin-pin').value.trim();
  if (newPin) payload.adminPin = newPin;

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      adminData.settings = result.data;
      updateBrandUI();
      showAdminToast('Ayarlar başarıyla kaydedildi!');
    }
  } catch (e) {
    showAdminToast('Ayarlar kaydedilirken hata oluştu.');
  }
}

async function resetDemoData() {
  if (confirm('Tüm menü ve ayarlar varsayılan demo verilerine sıfırlanacaktır. Devam etmek istiyor musunuz?')) {
    try {
      const res = await fetch('/api/reset-demo', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        showAdminToast(result.message);
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e) {
      showAdminToast('Sıfırlama başarısız.');
    }
  }
}

// ==========================================================================
// Modal & Toast Helpers
// ==========================================================================
function openAdminModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeAdminModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

let toastTimer;
function showAdminToast(msg) {
  const toast = document.getElementById('admin-toast');
  const text = document.getElementById('admin-toast-text');
  if (!toast || !text) return;

  text.textContent = msg;
  toast.style.display = 'flex';
  toast.style.opacity = '1';

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.style.display = 'none', 300);
  }, 3000);
}

function setupEventListeners() {
  // Search & Filter product listeners
  const searchInput = document.getElementById('product-search-input');
  if (searchInput) searchInput.addEventListener('input', renderProductsTable);

  const catFilter = document.getElementById('product-filter-category');
  if (catFilter) catFilter.addEventListener('change', renderProductsTable);

  const stockFilter = document.getElementById('product-filter-stock');
  if (stockFilter) stockFilter.addEventListener('change', renderProductsTable);

  // Table QR dropdown listener
  const qrSelect = document.getElementById('qr-table-select');
  if (qrSelect) {
    qrSelect.addEventListener('change', (e) => {
      updateTableQRPreview(e.target.value);
    });
  }

  // QR custom input
  const qrCustomBtn = document.getElementById('qr-custom-apply-btn');
  if (qrCustomBtn) {
    qrCustomBtn.addEventListener('click', () => {
      const val = document.getElementById('qr-custom-table-input').value.trim();
      if (val) updateTableQRPreview(val);
    });
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
