/**
 * Ali Baba Döner Kafe - Digital QR Menu Client Engine
 * Dynamically binds REST API data to the Anatolian Hearth UI
 */

// Application State
let menuState = {
  settings: {},
  categories: [],
  products: [],
  currentCategory: 'all',
  currentTable: '04',
  searchQuery: ''
};

// DOM Element References
const dom = {
  // Brand Header
  brandLogo: document.getElementById('brand-logo'),
  brandTitle: document.getElementById('brand-title'),
  brandSlogan: document.getElementById('brand-slogan'),
  tableBadgeText: document.getElementById('table-badge-text'),
  tableBadgeBtn: document.getElementById('table-badge-btn'),
  
  // Hero
  heroImg: document.getElementById('hero-img'),
  heroBadgeText: document.getElementById('hero-badge-text'),
  heroTitle: document.getElementById('hero-title'),
  heroSubtitle: document.getElementById('hero-subtitle'),
  
  // Search & Categories
  searchInput: document.getElementById('menu-search-input'),
  searchClearBtn: document.getElementById('search-clear-btn'),
  categoryPillTrack: document.getElementById('category-pill-track'),
  
  // Containers
  featuredSection: document.getElementById('featured-section'),
  featuredTrack: document.getElementById('featured-track'),
  menuSectionsContainer: document.getElementById('all-menu-sections'),
  emptyState: document.getElementById('empty-state'),
  resetSearchBtn: document.getElementById('reset-search-btn'),
  
  // Footer
  footerBrand: document.getElementById('footer-brand'),
  
  // Product Detail Modal
  productModal: document.getElementById('product-detail-modal'),
  modalCard: document.getElementById('modal-card'),
  modalProductImg: document.getElementById('modal-product-img'),
  modalProductFallback: document.getElementById('modal-product-fallback'),
  modalFallbackIcon: document.getElementById('modal-fallback-icon'),
  modalProductName: document.getElementById('modal-product-name'),
  modalProductPortion: document.getElementById('modal-product-portion'),
  modalProductPrice: document.getElementById('modal-product-price'),
  modalProductDesc: document.getElementById('modal-product-desc'),
  modalPortionLabel: document.getElementById('modal-portion-label'),
  portionButtons: document.querySelectorAll('.portion-btn'),
  modalAllergensList: document.getElementById('modal-allergens-list'),
  modalOrderActionBtn: document.getElementById('modal-order-action-btn'),
  
  // Info / Generic Modals
  centerModal: document.getElementById('center-modal-backdrop'),
  centerModalIcon: document.getElementById('center-modal-icon-symbol'),
  centerModalTitle: document.getElementById('center-modal-title'),
  centerModalBody: document.getElementById('center-modal-body'),
  
  // Toast
  toastNotice: document.getElementById('toast-notice'),
  toastText: document.getElementById('toast-text')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initTableNumber();
  loadMenuData();
  setupEventListeners();
});

// Table Number from URL or Storage
function initTableNumber() {
  const urlParams = new URLSearchParams(window.location.search);
  const tableParam = urlParams.get('masa') || urlParams.get('table');
  
  if (tableParam) {
    menuState.currentTable = tableParam.trim();
    sessionStorage.setItem('alibaba_table', menuState.currentTable);
  } else {
    const saved = sessionStorage.getItem('alibaba_table');
    if (saved) menuState.currentTable = saved;
  }
  
  updateTableDisplay();
}

function updateTableDisplay() {
  if (dom.tableBadgeText) {
    const val = menuState.currentTable;
    dom.tableBadgeText.textContent = isNaN(val) ? val : `Masa ${String(val).padStart(2, '0')}`;
  }
}

// Fetch Menu Data from Server
async function loadMenuData() {
  try {
    const response = await fetch('/api/menu');
    if (!response.ok) throw new Error('API yanıt vermedi');
    const result = await response.json();
    
    if (result.success && result.data) {
      menuState.settings = result.data.settings || {};
      menuState.categories = result.data.categories || [];
      menuState.products = result.data.products || [];
      
      // Save cache to localStorage
      try {
        localStorage.setItem('alibaba_menu_cache', JSON.stringify(result.data));
      } catch (e) {}

      renderFullMenu();
      return;
    }
  } catch (err) {
    console.warn('API fetch failed, trying local cache:', err);
    // Try localStorage
    const cached = localStorage.getItem('alibaba_menu_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        menuState.settings = parsed.settings || {};
        menuState.categories = parsed.categories || [];
        menuState.products = parsed.products || [];
        renderFullMenu();
        showToast('Menü çevrimdışı modda yüklendi.');
        return;
      } catch (e) {}
    }
    showToast('Menü verileri yüklenirken bir sorun oluştu.');
  }
}

// Render Entire UI
function renderFullMenu() {
  renderBrandAndHero();
  renderCategoryPills();
  renderFeaturedSection();
  renderCategorySections();
  applyFilter();
}

// 1. Render Brand & Hero
function renderBrandAndHero() {
  const s = menuState.settings;
  if (!s) return;

  if (dom.brandLogo && s.logoInitials) dom.brandLogo.textContent = s.logoInitials;
  if (dom.brandTitle && s.restaurantName) dom.brandTitle.textContent = s.restaurantName;
  if (dom.brandSlogan && s.slogan) dom.brandSlogan.textContent = s.slogan;
  if (dom.footerBrand && s.restaurantName) dom.footerBrand.textContent = s.restaurantName;

  if (dom.heroImg && s.heroImage) dom.heroImg.src = s.heroImage;
  if (dom.heroBadgeText && s.heroBadge) dom.heroBadgeText.textContent = s.heroBadge;
  if (dom.heroTitle && s.heroTitle) dom.heroTitle.textContent = s.heroTitle;
  if (dom.heroSubtitle && s.heroSubtitle) dom.heroSubtitle.textContent = s.heroSubtitle;
}

// 2. Render Category Navigation Bar
function renderCategoryPills() {
  if (!dom.categoryPillTrack) return;
  
  let html = `
    <button class="category-pill active" data-cat="all" type="button">Tümü</button>
  `;
  
  menuState.categories.forEach(cat => {
    html += `
      <button class="category-pill" data-cat="${cat.id}" type="button">${escapeHtml(cat.name)}</button>
    `;
  });
  
  dom.categoryPillTrack.innerHTML = html;
  
  // Attach Click Events to Pills
  const pills = dom.categoryPillTrack.querySelectorAll('.category-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      
      menuState.currentCategory = pill.getAttribute('data-cat');
      applyFilter();
      
      // Auto-scroll pill into view center
      pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  });
}

// 3. Render Featured / Favori Lezzetler
function renderFeaturedSection() {
  if (!dom.featuredTrack || !dom.featuredSection) return;
  
  const featuredItems = menuState.products.filter(p => p.featured);
  
  if (featuredItems.length === 0) {
    dom.featuredSection.style.display = 'none';
    return;
  }
  
  dom.featuredSection.style.display = 'block';
  
  let html = '';
  featuredItems.forEach(p => {
    const badgeText = p.badge || 'Favori';
    let badgeClass = 'badge-amber';
    if (badgeText.includes('Barista') || badgeText.includes('Kahve')) badgeClass = 'badge-dark';
    if (badgeText.includes('Ferah')) badgeClass = 'badge-rose';

    html += `
      <div class="featured-card" onclick="openProductModalById('${p.id}')">
        <div class="featured-img-wrap">
          ${p.img ? `<img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" class="featured-img" loading="lazy">` : 
            `<div class="product-thumb-fallback"><span class="material-symbols-outlined">${p.type === 'drink' ? 'local_cafe' : 'restaurant'}</span></div>`}
          <span class="featured-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
        </div>
        <div class="featured-info">
          <h4 class="featured-name">${escapeHtml(p.name)}</h4>
          <p class="featured-desc">${escapeHtml(p.desc || p.portion || '')}</p>
          <div class="featured-footer">
            <span class="featured-portion">${escapeHtml(p.portion || '')}</span>
            <span class="featured-price">${escapeHtml(p.price)} ${escapeHtml(p.currency || '₺')}</span>
          </div>
        </div>
      </div>
    `;
  });
  
  dom.featuredTrack.innerHTML = html;
}

// 4. Render Categorized Menu Sections
function renderCategorySections() {
  if (!dom.menuSectionsContainer) return;
  
  let html = '';
  
  menuState.categories.forEach(cat => {
    const catProducts = menuState.products.filter(p => p.category === cat.id);
    if (catProducts.length === 0) return; // Skip empty category
    
    html += `
      <section class="menu-category-section" data-cat-id="${cat.id}" id="sec-${cat.id}">
        <div class="cat-section-header">
          <h3 class="cat-title">
            <span class="cat-dot"></span>
            ${escapeHtml(cat.name)}
          </h3>
          <span class="cat-count">${catProducts.length} Ürün</span>
        </div>
        <div class="product-list">
          ${catProducts.map(prod => renderProductCard(prod)).join('')}
        </div>
      </section>
    `;
  });
  
  dom.menuSectionsContainer.innerHTML = html;
}

function renderProductCard(p) {
  const isSoldOut = p.inStock === false;
  const currency = p.currency || menuState.settings.currency || '₺';

  return `
    <div class="product-card ${isSoldOut ? 'out-of-stock' : ''}" 
         data-id="${p.id}" 
         data-cat="${p.category}" 
         data-name="${escapeHtml(p.name.toLowerCase())}" 
         data-desc="${escapeHtml((p.desc || '').toLowerCase())}"
         onclick="openProductModalById('${p.id}')">
      <div class="product-details">
        <div class="product-head">
          <h4 class="product-title">${escapeHtml(p.name)}</h4>
          ${isSoldOut ? `<span class="product-tag product-tag-soldout">Tükendi</span>` : 
            (p.badge ? `<span class="product-tag">${escapeHtml(p.badge)}</span>` : '')}
        </div>
        <p class="product-desc">${escapeHtml(p.desc || 'Taze hazırlanan lezzet.')}</p>
        <div class="product-meta">
          <span class="product-portion-chip">${escapeHtml(p.portion || 'Standart Servis')}</span>
          <span class="product-price">${escapeHtml(p.price)} ${escapeHtml(currency)}</span>
        </div>
      </div>
      <div class="product-thumb-wrap">
        ${p.img ? `<img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" class="product-thumb" loading="lazy">` : 
          `<div class="product-thumb-fallback"><span class="material-symbols-outlined">${p.type === 'drink' ? 'local_cafe' : (p.icon || 'restaurant')}</span></div>`}
      </div>
    </div>
  `;
}

// 5. Live Search & Category Filtering
function applyFilter() {
  const query = (dom.searchInput ? dom.searchInput.value : '').trim().toLowerCase();
  menuState.searchQuery = query;
  
  let totalVisibleItems = 0;
  
  // Search Clear button state
  if (dom.searchClearBtn) {
    if (query.length > 0) dom.searchClearBtn.classList.add('active');
    else dom.searchClearBtn.classList.remove('active');
  }
  
  // Toggle Featured Section (Hide when actively searching to keep results focused)
  if (dom.featuredSection) {
    if (query.length > 0) {
      dom.featuredSection.style.display = 'none';
    } else {
      const hasFeatured = menuState.products.some(p => p.featured);
      dom.featuredSection.style.display = hasFeatured ? 'block' : 'none';
    }
  }
  
  // Filter category sections and product cards
  const sections = document.querySelectorAll('.menu-category-section');
  sections.forEach(sec => {
    const catId = sec.getAttribute('data-cat-id');
    const isCategoryMatch = (menuState.currentCategory === 'all') || (menuState.currentCategory === catId);
    
    let sectionVisibleItems = 0;
    const cards = sec.querySelectorAll('.product-card');
    
    cards.forEach(card => {
      const name = card.getAttribute('data-name') || '';
      const desc = card.getAttribute('data-desc') || '';
      const matchesSearch = !query || name.includes(query) || desc.includes(query);
      
      if (isCategoryMatch && matchesSearch) {
        card.style.display = 'flex';
        sectionVisibleItems++;
        totalVisibleItems++;
      } else {
        card.style.display = 'none';
      }
    });
    
    // Hide or show whole category section
    if (sectionVisibleItems === 0) {
      sec.style.display = 'none';
    } else {
      sec.style.display = 'flex';
      const countEl = sec.querySelector('.cat-count');
      if (countEl) countEl.textContent = `${sectionVisibleItems} Ürün`;
    }
  });
  
  // Show Empty State if 0 products match
  if (dom.emptyState) {
    if (totalVisibleItems === 0) {
      dom.emptyState.classList.add('active');
    } else {
      dom.emptyState.classList.remove('active');
    }
  }
}

// 6. Product Detail Modal
let currentSelectedProduct = null;

function openProductModalById(prodId) {
  const product = menuState.products.find(p => p.id === prodId);
  if (!product) return;
  
  currentSelectedProduct = product;
  
  dom.modalProductName.textContent = product.name;
  dom.modalProductPrice.textContent = `${product.price} ${product.currency || '₺'}`;
  dom.modalProductDesc.textContent = product.desc || 'Bu ürün hakkında detaylı açıklama eklenmedi.';
  dom.modalProductPortion.textContent = product.portion || 'Standart Servis';
  
  // Image or Fallback
  if (product.img && product.img.trim()) {
    dom.modalProductImg.src = product.img;
    dom.modalProductImg.alt = product.name;
    dom.modalProductImg.style.display = 'block';
    dom.modalProductFallback.style.display = 'none';
  } else {
    dom.modalProductImg.style.display = 'none';
    dom.modalProductFallback.style.display = 'flex';
    dom.modalFallbackIcon.textContent = product.type === 'drink' ? 'local_cafe' : (product.icon || 'restaurant');
  }
  
  // Adapt Portion Labels
  if (product.type === 'drink') {
    dom.modalPortionLabel.textContent = 'Boyut Seçenekleri';
    dom.portionButtons[0].textContent = 'Küçük';
    dom.portionButtons[1].textContent = 'Orta';
    dom.portionButtons[2].textContent = 'Büyük';
  } else {
    dom.modalPortionLabel.textContent = 'Porsiyon Seçenekleri';
    dom.portionButtons[0].textContent = 'Standart';
    dom.portionButtons[1].textContent = '1.5 Porsiyon';
    dom.portionButtons[2].textContent = 'Duble';
  }
  
  // Reset portion selection
  dom.portionButtons.forEach((btn, idx) => {
    if (idx === 0) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  
  // Allergens
  dom.modalAllergensList.innerHTML = '';
  if (product.allergens && product.allergens.trim()) {
    product.allergens.split(',').forEach(item => {
      const tag = document.createElement('span');
      tag.className = 'allergen-tag';
      tag.textContent = item.trim();
      dom.modalAllergensList.appendChild(tag);
    });
  } else {
    const tag = document.createElement('span');
    tag.className = 'allergen-tag';
    tag.textContent = 'Belirtilmedi / Alerjen bilgisi için personele danışınız.';
    dom.modalAllergensList.appendChild(tag);
  }
  
  // Action button: If out of stock, disable
  if (product.inStock === false) {
    dom.modalOrderActionBtn.disabled = true;
    dom.modalOrderActionBtn.style.opacity = '0.5';
    dom.modalOrderActionBtn.innerHTML = `<span>Bu Ürün Şu An Tükendi</span>`;
  } else {
    dom.modalOrderActionBtn.disabled = false;
    dom.modalOrderActionBtn.style.opacity = '1';
    dom.modalOrderActionBtn.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:18px;">notifications_active</span>
      <span>Garsona Bu Ürünü Bildir</span>
    `;
  }
  
  // Open modal animation
  dom.productModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  dom.productModal.classList.remove('open');
  document.body.style.overflow = '';
}

// 7. Waiter Calling / Service Notifications
async function callWaiterService(serviceType, note = '') {
  const table = menuState.currentTable || '04';
  
  try {
    const res = await fetch('/api/call-waiter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: table,
        type: serviceType,
        note: note
      })
    });
    
    const result = await res.json();
    if (result.success) {
      showToast(`Masa ${table} için ${serviceType.toLowerCase()} talebiniz iletildi!`);
    } else {
      showToast('Talep iletilemedi, lütfen personele sesleniniz.');
    }
  } catch (err) {
    showToast(`Masa ${table} için ${serviceType.toLowerCase()} talebiniz kaydedildi.`);
  }
}

// 8. Info & Center Modals (Wi-Fi, Table, Contact, Location)
function openCenterModal(title, icon, bodyHtml) {
  dom.centerModalTitle.textContent = title;
  dom.centerModalIcon.textContent = icon;
  dom.centerModalBody.innerHTML = bodyHtml;
  dom.centerModal.classList.add('open');
}

function closeCenterModal() {
  dom.centerModal.classList.remove('open');
}

function openWifiModal() {
  const ssid = menuState.settings.wifiSSID || 'AliBaba_Misafir';
  const pass = menuState.settings.wifiPassword || 'alibaba2025';
  
  const content = `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; text-align:left; margin-bottom:14px;">
      <div style="margin-bottom:10px;">
        <span style="font-size:10px; text-transform:uppercase; font-weight:800; color:#94a3b8; display:block;">Wi-Fi Ağı (SSID)</span>
        <strong style="font-size:14px; color:#0f172a;">${escapeHtml(ssid)}</strong>
      </div>
      <div style="border-top:1px solid #e2e8f0; padding-top:10px; display:flex; align-items:center; justify-content:space-between;">
        <div>
          <span style="font-size:10px; text-transform:uppercase; font-weight:800; color:#94a3b8; display:block;">Şifre</span>
          <strong style="font-size:14px; color:#b91c1c;" id="wifi-pass-val">${escapeHtml(pass)}</strong>
        </div>
        <button type="button" onclick="copyWifiPassword('${escapeHtml(pass)}')" style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:6px 12px; font-size:11px; font-weight:700; color:#0f172a; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
          <span class="material-symbols-outlined" style="font-size:14px;">content_copy</span> Kopyala
        </button>
      </div>
    </div>
    <p style="font-size:12px; color:#64748b;">Masalarımızda sınırsız internet keyfi sizleri bekliyor.</p>
  `;
  
  openCenterModal('Ücretsiz Misafir Wi-Fi', 'wifi', content);
}

function copyWifiPassword(pass) {
  navigator.clipboard.writeText(pass).then(() => {
    showToast('Wi-Fi şifresi panoya kopyalandı!');
  }).catch(() => {
    showToast(`Şifre: ${pass}`);
  });
}

function openTableModal() {
  const current = menuState.currentTable;
  const content = `
    <p style="font-size:12.5px; color:#64748b; margin-bottom:14px;">Lütfen oturduğunuz masa numarasını seçin veya girin:</p>
    <div style="display:flex; gap:8px; margin-bottom:14px;">
      <input type="text" id="manual-table-input" value="${escapeHtml(current)}" placeholder="Örn: 04" style="flex:1; padding:10px 12px; border:1.5px solid #cbd5e1; border-radius:10px; font-size:14px; text-align:center; font-weight:700;">
      <button type="button" onclick="saveNewTableNumber()" style="background:#b91c1c; color:#fff; border:none; border-radius:10px; padding:0 16px; font-weight:700; font-size:13px; cursor:pointer;">Kaydet</button>
    </div>
    <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; max-height:140px; overflow-y:auto; padding:4px;">
      ${Array.from({ length: 20 }, (_, i) => {
        const num = String(i + 1).padStart(2, '0');
        return `<button type="button" onclick="selectQuickTable('${num}')" style="padding:6px 2px; border:1px solid #e2e8f0; border-radius:8px; background:${current === num ? '#b91c1c' : '#fff'}; color:${current === num ? '#fff' : '#0f172a'}; font-weight:700; font-size:12px; cursor:pointer;">M${num}</button>`;
      }).join('')}
    </div>
  `;
  openCenterModal('Masa Değiştir', 'table_restaurant', content);
}

function selectQuickTable(num) {
  menuState.currentTable = num;
  sessionStorage.setItem('alibaba_table', num);
  updateTableDisplay();
  closeCenterModal();
  showToast(`Masa ${num} olarak güncellendi.`);
}

function saveNewTableNumber() {
  const input = document.getElementById('manual-table-input');
  if (input && input.value.trim()) {
    selectQuickTable(input.value.trim());
  }
}

function openContactModal() {
  const info = menuState.settings.contactInfo || 'Restoran içi siparişler ve özel talepleriniz için salon görevlimiz ile iletişime geçebilirsiniz.';
  openCenterModal('İletişim & Danışma', 'contact_support', `<p style="font-size:13px; color:#475569; line-height:1.5;">${escapeHtml(info)}</p>`);
}

function openLocationModal() {
  const loc = menuState.settings.locationInfo || 'Ali Baba Döner Kafe ana cadde şubemizde açık ve kapalı teras alanlarımızla hizmetinizdeyiz.';
  openCenterModal('Konum Bilgisi', 'location_on', `<p style="font-size:13px; color:#475569; line-height:1.5;">${escapeHtml(loc)}</p>`);
}

function openInstagramModal() {
  const handle = menuState.settings.instagramHandle || '@alibabadonerkafe';
  openCenterModal('Sosyal Medya', 'share', `
    <p style="font-size:13px; color:#475569; line-height:1.5; margin-bottom:12px;">Günlük lezzetlerimizi ve özel indirimleri Instagram hesabımızdan takip edebilirsiniz.</p>
    <div style="background:#fdf2f8; border:1px solid #fbcfe8; border-radius:10px; padding:10px; font-weight:800; color:#be185d; font-size:15px;">
      ${escapeHtml(handle)}
    </div>
  `);
}

// 9. Toast Notification System
let toastTimeout;
function showToast(message) {
  if (!dom.toastNotice) return;
  dom.toastText.textContent = message;
  dom.toastNotice.classList.add('show');
  
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    dom.toastNotice.classList.remove('show');
  }, 3200);
}

// 10. Event Listeners Setup
function setupEventListeners() {
  // Search
  if (dom.searchInput) {
    dom.searchInput.addEventListener('input', applyFilter);
  }
  if (dom.searchClearBtn) {
    dom.searchClearBtn.addEventListener('click', () => {
      dom.searchInput.value = '';
      applyFilter();
      dom.searchInput.focus();
    });
  }
  if (dom.resetSearchBtn) {
    dom.resetSearchBtn.addEventListener('click', () => {
      if (dom.searchInput) dom.searchInput.value = '';
      menuState.currentCategory = 'all';
      const pills = document.querySelectorAll('.category-pill');
      pills.forEach((p, idx) => {
        if (idx === 0) p.classList.add('active');
        else p.classList.remove('active');
      });
      applyFilter();
    });
  }
  
  // Table badge click
  if (dom.tableBadgeBtn) {
    dom.tableBadgeBtn.addEventListener('click', openTableModal);
  }
  
  // Service quick buttons
  const waiterBtn = document.getElementById('quick-call-waiter-btn');
  if (waiterBtn) {
    waiterBtn.addEventListener('click', () => callWaiterService('Garson Çağır'));
  }
  const billBtn = document.getElementById('quick-ask-bill-btn');
  if (billBtn) {
    billBtn.addEventListener('click', () => callWaiterService('Hesap İste'));
  }
  
  // Portion option selector click
  dom.portionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.portionButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // Product Modal Order / Call action
  if (dom.modalOrderActionBtn) {
    dom.modalOrderActionBtn.addEventListener('click', () => {
      if (currentSelectedProduct) {
        const selectedPortion = document.querySelector('.portion-btn.active');
        const portionText = selectedPortion ? selectedPortion.textContent.trim() : '';
        callWaiterService('Sipariş Talebi', `${currentSelectedProduct.name} (${portionText})`);
        closeProductModal();
      }
    });
  }
  
  // Close Modals on Backdrop Click
  if (dom.productModal) {
    dom.productModal.addEventListener('click', (e) => {
      if (e.target === dom.productModal) closeProductModal();
    });
  }
  if (dom.centerModal) {
    dom.centerModal.addEventListener('click', (e) => {
      if (e.target === dom.centerModal) closeCenterModal();
    });
  }
}

// Utility: Escape HTML to prevent XSS
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
