const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const QRCode = require('qrcode');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Data file path
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'menu_data.json');
const INITIAL_DATA_FILE = path.join(__dirname, 'initial_data.json');

// Ensure data folder and file exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory Authentication & Session Management
// Token -> { createdAt, lastSeen, ip }
const activeSessions = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate Limiter for Login Brute-force Protection (IP -> { count, firstAttempt })
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_TIME_MS = 60 * 1000; // 1 minute

// Rate Limiter / Cooldown for Waiter Calling (Key -> timestamp)
const waiterCooldowns = new Map();
const WAITER_COOLDOWN_MS = 20 * 1000; // 20 seconds between waiter calls per table

// XSS Sanitizer Helper
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        // Ensure required arrays and objects exist
        parsed.settings = parsed.settings || {};
        parsed.admin = parsed.admin || { pin: '1234', password: 'admin' };
        parsed.categories = Array.isArray(parsed.categories) ? parsed.categories : [];
        parsed.products = Array.isArray(parsed.products) ? parsed.products : [];
        parsed.notifications = Array.isArray(parsed.notifications) ? parsed.notifications : [];
        return parsed;
      }
    } catch (err) {
      console.error('Error reading DATA_FILE, falling back to initial data:', err);
    }
  }

  // Load from initial_data.json
  let initial = { settings: {}, categories: [], products: [] };
  if (fs.existsSync(INITIAL_DATA_FILE)) {
    try {
      initial = JSON.parse(fs.readFileSync(INITIAL_DATA_FILE, 'utf8'));
    } catch (err) {
      console.error('Error reading INITIAL_DATA_FILE:', err);
    }
  }

  const defaultData = {
    settings: initial.settings || {
      restaurantName: 'Ali Baba Döner Kafe',
      slogan: 'Dönerden kahveye, her molaya lezzet.',
      logoInitials: 'AB',
      heroBadge: 'Zengin Restoran & Kafe Menüsü',
      heroTitle: 'Canın ne çekiyor?',
      heroSubtitle: 'İster doyurucu bir lezzet, ister keyifli bir kahve molası.',
      heroImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBePhexMPVnyKWUyULjS45OYTHfSAC1FsyeNzssegLDQY6vF2GlhO7UwEdiJqL0GYtyCVhqgh20iQFMBwTIjv9TGqptOZuZOEe0nmGS6vYogAeapHGUAAta47LVr5Md675L7GMIFHW7GiCF1JpHLSdKtu8JPZXpyRxg3JSPU0vO1uPTe-I2090Zw9v_K-pSXv2L8B5IGAvuJPK8C4WtpM0x53BZAMZ5xKmR8LEztXmo74bpCdy20SNmOg',
      wifiSSID: 'AliBaba_Misafir',
      wifiPassword: 'alibaba2025',
      contactInfo: 'Restoran içi siparişler ve özel talepleriniz için lütfen salon görevlimiz ile iletişime geçiniz.',
      locationInfo: 'Ali Baba Döner Kafe ana cadde şubemizde açık ve kapalı teras alanlarımızla hizmetinizdeyiz.',
      instagramHandle: '@alibabadonerkafe',
      currency: '₺',
      tableCount: 20,
      baseUrl: '' // Configurable Base URL for production / QR code
    },
    admin: {
      pin: '1234',
      password: 'admin'
    },
    categories: initial.categories || [],
    products: initial.products || [],
    notifications: []
  };

  saveData(defaultData);
  return defaultData;
}

// Atomic file write to prevent data corruption
function saveData(data) {
  try {
    const tempFile = path.join(DATA_DIR, `menu_data_${Date.now()}_tmp.json`);
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DATA_FILE);
    return true;
  } catch (err) {
    console.error('Error saving data safely:', err);
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (fallbackErr) {
      console.error('Fallback save also failed:', fallbackErr);
      return false;
    }
  }
}

let db = loadData();

// Multer Storage Configuration for Image Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'food-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece geçerli resim dosyaları (JPG, PNG, WebP) yüklenebilir!'), false);
    }
  }
});

// ======================== AUTHENTICATION MIDDLEWARE ========================
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  let token = null;

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else {
      token = authHeader.trim();
    }
  } else if (req.query && req.query.token) {
    token = String(req.query.token).trim();
  }

  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({
      success: false,
      message: 'Yetkisiz erişim! Lütfen yönetici girişi yapın.'
    });
  }

  const session = activeSessions.get(token);
  // Check TTL
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    activeSessions.delete(token);
    return res.status(401).json({
      success: false,
      message: 'Oturum süreniz doldu, lütfen tekrar giriş yapın.'
    });
  }

  // Update last seen
  session.lastSeen = Date.now();
  req.adminSession = session;
  next();
}

// ======================== API ROUTES ========================

// 1. Get Entire Public Menu Data (No admin credentials leaked)
app.get('/api/menu', (req, res) => {
  const publicData = {
    settings: {
      restaurantName: db.settings.restaurantName || 'Ali Baba Döner Kafe',
      slogan: db.settings.slogan || '',
      logoInitials: db.settings.logoInitials || 'AB',
      heroBadge: db.settings.heroBadge || '',
      heroTitle: db.settings.heroTitle || '',
      heroSubtitle: db.settings.heroSubtitle || '',
      heroImage: db.settings.heroImage || '',
      wifiSSID: db.settings.wifiSSID || '',
      wifiPassword: db.settings.wifiPassword || '',
      contactInfo: db.settings.contactInfo || '',
      locationInfo: db.settings.locationInfo || '',
      instagramHandle: db.settings.instagramHandle || '',
      currency: db.settings.currency || '₺',
      tableCount: db.settings.tableCount || 20,
      baseUrl: db.settings.baseUrl || ''
    },
    categories: db.categories || [],
    products: db.products || []
  };
  res.json({ success: true, data: publicData });
});

// 2. Authentication Login
app.post('/api/login', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Rate Limiter Check
  const attempts = loginAttempts.get(clientIp);
  if (attempts) {
    if (now - attempts.firstAttempt > LOGIN_BLOCK_TIME_MS) {
      loginAttempts.delete(clientIp);
    } else if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      const waitSec = Math.ceil((LOGIN_BLOCK_TIME_MS - (now - attempts.firstAttempt)) / 1000);
      return res.status(429).json({
        success: false,
        message: `Çok fazla hatalı giriş denemesi yapıldı. Lütfen ${waitSec} saniye bekleyin.`
      });
    }
  }

  const { pin, password } = req.body || {};
  const enteredPin = (pin ? String(pin) : '').trim();
  const enteredPass = (password ? String(password) : '').trim();

  if (!enteredPin && !enteredPass) {
    return res.status(400).json({ success: false, message: 'Lütfen PIN veya şifre girin.' });
  }

  const currentPin = (db.admin && db.admin.pin) ? String(db.admin.pin).trim() : '1234';
  const currentPass = (db.admin && db.admin.password) ? String(db.admin.password).trim() : 'admin';

  const isPinMatch = enteredPin && (enteredPin === currentPin || enteredPin === currentPass);
  const isPassMatch = enteredPass && (enteredPass === currentPass || enteredPass === currentPin);

  if (isPinMatch || isPassMatch) {
    // Clear failed attempts on success
    loginAttempts.delete(clientIp);

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, {
      createdAt: now,
      lastSeen: now,
      ip: clientIp
    });

    return res.json({
      success: true,
      token: token,
      message: 'Giriş başarılı'
    });
  }

  // Increment failed attempt
  const curAttempts = loginAttempts.get(clientIp) || { count: 0, firstAttempt: now };
  curAttempts.count += 1;
  loginAttempts.set(clientIp, curAttempts);

  const remaining = MAX_LOGIN_ATTEMPTS - curAttempts.count;
  const warnText = remaining > 0 ? ` (${remaining} deneme hakkı kaldı)` : ' (Geçici olarak kilitlendi)';

  return res.status(401).json({
    success: false,
    message: 'Hatalı PIN veya şifre!' + warnText
  });
});

// Verify token session validity
app.get('/api/auth-check', requireAdminAuth, (req, res) => {
  res.json({ success: true, message: 'Oturum aktif' });
});

// Logout
app.post('/api/logout', (req, res) => {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '').trim();
    activeSessions.delete(token);
  }
  res.json({ success: true, message: 'Çıkış yapıldı' });
});

// 3. Settings Management (Protected)
app.get('/api/settings', requireAdminAuth, (req, res) => {
  res.json({ success: true, data: db.settings });
});

app.put('/api/settings', requireAdminAuth, (req, res) => {
  const newSettings = req.body;
  if (!newSettings || typeof newSettings !== 'object') {
    return res.status(400).json({ success: false, message: 'Geçersiz ayar verisi.' });
  }

  // PIN / Password updates
  if (newSettings.adminPin && String(newSettings.adminPin).trim()) {
    db.admin = db.admin || {};
    db.admin.pin = String(newSettings.adminPin).trim();
    delete newSettings.adminPin;
  }
  if (newSettings.adminPassword && String(newSettings.adminPassword).trim()) {
    db.admin = db.admin || {};
    db.admin.password = String(newSettings.adminPassword).trim();
    delete newSettings.adminPassword;
  }

  // Sanitize text inputs
  const sanitized = {
    restaurantName: sanitizeString(newSettings.restaurantName || db.settings.restaurantName || 'Ali Baba Döner Kafe'),
    slogan: sanitizeString(newSettings.slogan || ''),
    logoInitials: sanitizeString(newSettings.logoInitials || 'AB').slice(0, 4),
    heroBadge: sanitizeString(newSettings.heroBadge || ''),
    heroTitle: sanitizeString(newSettings.heroTitle || ''),
    heroSubtitle: sanitizeString(newSettings.heroSubtitle || ''),
    heroImage: String(newSettings.heroImage || '').trim(),
    wifiSSID: sanitizeString(newSettings.wifiSSID || ''),
    wifiPassword: sanitizeString(newSettings.wifiPassword || ''),
    contactInfo: sanitizeString(newSettings.contactInfo || ''),
    locationInfo: sanitizeString(newSettings.locationInfo || ''),
    instagramHandle: sanitizeString(newSettings.instagramHandle || ''),
    currency: sanitizeString(newSettings.currency || '₺').slice(0, 5),
    tableCount: Math.max(1, Math.min(100, parseInt(newSettings.tableCount, 10) || 20)),
    baseUrl: String(newSettings.baseUrl || '').trim().replace(/\/+$/, '')
  };

  db.settings = { ...db.settings, ...sanitized };
  saveData(db);
  res.json({ success: true, message: 'Ayarlar başarıyla güncellendi.', data: db.settings });
});

// 4. Category Management (Protected)
app.get('/api/categories', (req, res) => {
  res.json({ success: true, data: db.categories });
});

app.post('/api/categories', requireAdminAuth, (req, res) => {
  const { id, name, icon } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Kategori adı zorunludur.' });
  }

  const cleanName = sanitizeString(name.trim());
  const slug = (id && String(id).trim()) ? String(id).trim() : cleanName.toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

  // Check duplicate
  if (db.categories.some(c => c.id === slug)) {
    return res.status(400).json({ success: false, message: 'Bu ada veya koda sahip bir kategori zaten mevcut.' });
  }

  const newCat = {
    id: slug,
    name: cleanName,
    icon: sanitizeString(icon || 'restaurant')
  };

  db.categories.push(newCat);
  saveData(db);
  res.status(201).json({ success: true, message: 'Kategori başarıyla eklendi.', data: newCat });
});

app.put('/api/categories/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { name, icon } = req.body || {};

  const catIndex = db.categories.findIndex(c => c.id === id);
  if (catIndex === -1) {
    return res.status(404).json({ success: false, message: 'Kategori bulunamadı.' });
  }

  if (name && name.trim()) db.categories[catIndex].name = sanitizeString(name.trim());
  if (icon) db.categories[catIndex].icon = sanitizeString(icon.trim());

  saveData(db);
  res.json({ success: true, message: 'Kategori güncellendi.', data: db.categories[catIndex] });
});

app.delete('/api/categories/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const initialLen = db.categories.length;
  db.categories = db.categories.filter(c => c.id !== id);

  if (db.categories.length === initialLen) {
    return res.status(404).json({ success: false, message: 'Kategori bulunamadı.' });
  }

  // Update products with this category to fallback category
  const fallbackCat = db.categories[0] ? db.categories[0].id : 'diger';
  db.products.forEach(p => {
    if (p.category === id) {
      p.category = fallbackCat;
    }
  });

  saveData(db);
  res.json({ success: true, message: 'Kategori silindi, ürünleri varsayılan kategoriye aktarıldı.' });
});

// 5. Products Management (Protected)
app.get('/api/products', (req, res) => {
  res.json({ success: true, data: db.products });
});

app.post('/api/products', requireAdminAuth, (req, res) => {
  const {
    name, price, currency, desc, portion,
    allergens, type, category, badge, featured, inStock, img, icon
  } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Ürün adı zorunludur.' });
  }

  const cleanPrice = String(price || '0').replace('₺', '').replace(/,/g, '.').trim();
  if (isNaN(parseFloat(cleanPrice))) {
    return res.status(400).json({ success: false, message: 'Geçersiz fiyat değeri girdiniz.' });
  }

  const newProduct = {
    id: 'prod_' + Date.now(),
    name: sanitizeString(name.trim()),
    price: cleanPrice,
    currency: sanitizeString(currency || db.settings.currency || '₺'),
    desc: sanitizeString(desc || ''),
    portion: sanitizeString(portion || 'Standart Porsiyon'),
    allergens: sanitizeString(allergens || ''),
    type: type === 'drink' ? 'drink' : 'food',
    category: category || (db.categories[0] ? db.categories[0].id : 'diger'),
    badge: sanitizeString(badge || ''),
    featured: Boolean(featured),
    inStock: inStock !== undefined ? Boolean(inStock) : true,
    img: String(img || '').trim(),
    icon: sanitizeString(icon || '')
  };

  db.products.unshift(newProduct);
  saveData(db);
  res.status(201).json({ success: true, message: 'Ürün eklendi.', data: newProduct });
});

app.put('/api/products/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const pIndex = db.products.findIndex(p => p.id === id);
  if (pIndex === -1) {
    return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });
  }

  const payload = req.body || {};
  const current = db.products[pIndex];

  const updated = {
    ...current,
    ...payload,
    name: payload.name ? sanitizeString(payload.name.trim()) : current.name,
    desc: payload.desc !== undefined ? sanitizeString(payload.desc) : current.desc,
    portion: payload.portion !== undefined ? sanitizeString(payload.portion) : current.portion,
    allergens: payload.allergens !== undefined ? sanitizeString(payload.allergens) : current.allergens,
    badge: payload.badge !== undefined ? sanitizeString(payload.badge) : current.badge,
    price: payload.price !== undefined ? String(payload.price).replace('₺', '').replace(/,/g, '.').trim() : current.price,
    img: payload.img !== undefined ? String(payload.img).trim() : current.img,
    featured: payload.featured !== undefined ? Boolean(payload.featured) : current.featured,
    inStock: payload.inStock !== undefined ? Boolean(payload.inStock) : current.inStock
  };

  db.products[pIndex] = updated;
  saveData(db);
  res.json({ success: true, message: 'Ürün güncellendi.', data: updated });
});

// Quick toggle stock (Protected)
app.patch('/api/products/:id/toggle-stock', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const product = db.products.find(p => p.id === id);
  if (!product) return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });

  product.inStock = !product.inStock;
  saveData(db);
  res.json({
    success: true,
    message: `Stok durumu güncellendi: ${product.inStock ? 'Stokta' : 'Tükendi'}`,
    inStock: product.inStock
  });
});

// Quick toggle featured (Protected)
app.patch('/api/products/:id/toggle-featured', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const product = db.products.find(p => p.id === id);
  if (!product) return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });

  product.featured = !product.featured;
  saveData(db);
  res.json({
    success: true,
    message: `Favori durumu güncellendi: ${product.featured ? 'Favorilerde' : 'Çıkarıldı'}`,
    featured: product.featured
  });
});

// Quick price update (Protected)
app.patch('/api/products/:id/quick-price', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { price } = req.body || {};
  const product = db.products.find(p => p.id === id);
  if (!product) return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });

  const cleanPrice = String(price || '0').replace('₺', '').replace(/,/g, '.').trim();
  if (isNaN(parseFloat(cleanPrice))) {
    return res.status(400).json({ success: false, message: 'Geçersiz fiyat biçimi.' });
  }

  product.price = cleanPrice;
  saveData(db);
  res.json({ success: true, message: 'Fiyat güncellendi.', price: product.price });
});

app.delete('/api/products/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const initialLen = db.products.length;
  db.products = db.products.filter(p => p.id !== id);

  if (db.products.length === initialLen) {
    return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });
  }

  saveData(db);
  res.json({ success: true, message: 'Ürün başarıyla silindi.' });
});

// 6. Image Upload Handler (Protected)
app.post('/api/upload', requireAdminAuth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Dosya boyutu çok büyük (Maksimum 5 MB).' });
      }
      return res.status(400).json({ success: false, message: 'Yükleme hatası: ' + err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Lütfen bir resim dosyası seçin.' });
    }

    const fileUrl = '/uploads/' + req.file.filename;
    res.json({
      success: true,
      url: fileUrl,
      message: 'Resim başarıyla yüklendi.'
    });
  });
});

// 7. QR Code Generator API (Configurable Base URL)
app.get('/api/qr', async (req, res) => {
  try {
    const table = req.query.table ? String(req.query.table).trim() : '';
    
    // Check if a custom Base URL is set in settings or env
    let baseUrl = (process.env.BASE_URL || (db.settings && db.settings.baseUrl) || '').trim();
    if (baseUrl) {
      baseUrl = baseUrl.replace(/\/+$/, '');
    } else {
      const host = req.get('host');
      const protocol = req.protocol;
      baseUrl = `${protocol}://${host}`;
    }

    const menuUrl = `${baseUrl}/${table ? '?masa=' + encodeURIComponent(table) : ''}`;

    const qrDataUrl = await QRCode.toDataURL(menuUrl, {
      width: 450,
      margin: 2,
      color: {
        dark: '#93000b',
        light: '#ffffff'
      }
    });

    res.json({ success: true, url: menuUrl, qrDataUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: 'QR Kod oluşturulamadı: ' + err.message });
  }
});

// Real-time Server-Sent Events (SSE) Client Connections
const sseClients = new Set();

function broadcastNotificationEvent(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// 8. Waiter Call & Notifications (Spam & Cooldown Protected)
app.post('/api/call-waiter', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const { table, type, note } = req.body || {};

  const cleanTable = sanitizeString(String(table || 'Bilinmiyor').slice(0, 30));
  const cleanType = sanitizeString(String(type || 'Garson Çağır').slice(0, 50));
  const cleanNote = sanitizeString(String(note || '').slice(0, 200));

  // Check if this request is a product order vs waiter/service call
  const isOrder = cleanType.toLowerCase().includes('sipariş') || cleanType.toLowerCase().includes('order');

  // Cooldown only applies to waiter/bill calls, NOT to product orders
  if (!isOrder) {
    const cooldownKey = `${cleanTable}_${clientIp}`;
    const now = Date.now();
    const lastCallTime = waiterCooldowns.get(cooldownKey);

    if (lastCallTime && (now - lastCallTime < WAITER_COOLDOWN_MS)) {
      const remainingSeconds = Math.ceil((WAITER_COOLDOWN_MS - (now - lastCallTime)) / 1000);
      return res.status(429).json({
        success: false,
        cooldown: true,
        remainingSeconds: remainingSeconds,
        message: `Talebiniz zaten iletildi. Lütfen yeni çağrı için ${remainingSeconds} saniye bekleyin.`
      });
    }

    // Set new cooldown for waiter calls
    waiterCooldowns.set(cooldownKey, now);
  }

  const now = Date.now();
  const notification = {
    id: (isOrder ? 'order_' : 'call_') + now + '_' + Math.floor(Math.random() * 1000),
    table: cleanTable,
    type: cleanType,
    note: cleanNote,
    time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    createdAt: now
  };

  db.notifications = db.notifications || [];
  db.notifications.unshift(notification);

  // Keep last 50 notifications
  if (db.notifications.length > 50) {
    db.notifications = db.notifications.slice(0, 50);
  }

  saveData(db);
  broadcastNotificationEvent('notification_created', notification);

  res.json({
    success: true,
    message: isOrder ? 'Siparişiniz başarıyla alındı!' : 'Talebiniz servis personeline iletildi!',
    data: notification
  });
});

// Real-Time Notification Stream (SSE)
app.get('/api/notifications/stream', requireAdminAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Send initial connected event + current notifications
  res.write(`event: init\ndata: ${JSON.stringify(db.notifications || [])}\n\n`);

  sseClients.add(res);

  // Keep-alive heartbeat every 20s
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (e) {
      clearInterval(heartbeatTimer);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    sseClients.delete(res);
  });
});

// Get Notifications (Protected)
app.get('/api/notifications', requireAdminAuth, (req, res) => {
  res.json({ success: true, data: db.notifications || [] });
});

// Dismiss Notification (Protected)
app.delete('/api/notifications/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const initialLen = (db.notifications || []).length;
  db.notifications = (db.notifications || []).filter(n => n.id !== id);

  if (db.notifications.length === initialLen) {
    return res.status(404).json({ success: false, message: 'Bildirim bulunamadı.' });
  }

  saveData(db);
  broadcastNotificationEvent('notification_dismissed', { id });

  res.json({ success: true, message: 'Bildirim kapatıldı.' });
});

// 9. Reset Demo Data (Protected)
app.post('/api/reset-demo', requireAdminAuth, (req, res) => {
  if (fs.existsSync(INITIAL_DATA_FILE)) {
    try {
      const initial = JSON.parse(fs.readFileSync(INITIAL_DATA_FILE, 'utf8'));
      db.settings = initial.settings;
      db.categories = initial.categories;
      db.products = initial.products;
      db.notifications = [];
      saveData(db);
      broadcastNotificationEvent('notifications_reset', []);
      return res.json({ success: true, message: 'Menü demo verilerine başarıyla sıfırlandı!' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Sıfırlama hatası: ' + err.message });
    }
  }
  res.status(404).json({ success: false, message: 'Demo verisi bulunamadı.' });
});

// Admin Route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback all other routes to customer menu index.html (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, message: 'Sunucu hatası meydana geldi.' });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`Ali Baba Döner Kafe Web Sitesi & Admin Paneli Yayında!`);
  console.log(`Müşteri QR Menü: http://localhost:${PORT}`);
  console.log(`Yönetici Admin Paneli: http://localhost:${PORT}/admin`);
  console.log(`=================================================`);
});

module.exports = { app, server };
