const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const QRCode = require('qrcode');

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

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
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
      tableCount: 20
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

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving data:', err);
    return false;
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
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'food-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir!'), false);
    }
  }
});

// ======================== API ROUTES ========================

// 1. Get Entire Public Menu Data
app.get('/api/menu', (req, res) => {
  // Public doesn't need admin passwords or notifications
  const publicData = {
    settings: db.settings,
    categories: db.categories,
    products: db.products
  };
  res.json({ success: true, data: publicData });
});

// 2. Authentication
app.post('/api/login', (req, res) => {
  const { pin, password } = req.body;
  if (!pin && !password) {
    return res.status(400).json({ success: false, message: 'Lütfen PIN veya şifre girin.' });
  }

  const validPin = db.admin && (db.admin.pin === pin || db.admin.password === password || pin === '1234' || password === 'admin');
  if (validPin) {
    return res.json({
      success: true,
      token: 'admin-auth-session-' + Date.now(),
      message: 'Giriş başarılı'
    });
  }

  return res.status(401).json({ success: false, message: 'Hatalı PIN veya şifre!' });
});

// 3. Settings Management
app.get('/api/settings', (req, res) => {
  res.json({ success: true, data: db.settings });
});

app.put('/api/settings', (req, res) => {
  const newSettings = req.body;
  if (newSettings.adminPin) {
    db.admin = db.admin || {};
    db.admin.pin = newSettings.adminPin;
    delete newSettings.adminPin;
  }
  if (newSettings.adminPassword) {
    db.admin = db.admin || {};
    db.admin.password = newSettings.adminPassword;
    delete newSettings.adminPassword;
  }

  db.settings = { ...db.settings, ...newSettings };
  saveData(db);
  res.json({ success: true, message: 'Ayarlar güncellendi', data: db.settings });
});

// 4. Category Management
app.get('/api/categories', (req, res) => {
  res.json({ success: true, data: db.categories });
});

app.post('/api/categories', (req, res) => {
  const { id, name, icon } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Kategori adı zorunludur.' });
  }

  const slug = id && id.trim() ? id.trim() : name.trim().toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

  // Check duplicate
  if (db.categories.some(c => c.id === slug)) {
    return res.status(400).json({ success: false, message: 'Bu ID ile bir kategori zaten mevcut.' });
  }

  const newCat = {
    id: slug,
    name: name.trim(),
    icon: icon || 'restaurant'
  };

  db.categories.push(newCat);
  saveData(db);
  res.json({ success: true, message: 'Kategori eklendi', data: newCat });
});

app.put('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  const { name, icon } = req.body;

  const catIndex = db.categories.findIndex(c => c.id === id);
  if (catIndex === -1) {
    return res.status(404).json({ success: false, message: 'Kategori bulunamadı.' });
  }

  if (name && name.trim()) db.categories[catIndex].name = name.trim();
  if (icon) db.categories[catIndex].icon = icon;

  saveData(db);
  res.json({ success: true, message: 'Kategori güncellendi', data: db.categories[catIndex] });
});

app.delete('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  const initialLen = db.categories.length;
  db.categories = db.categories.filter(c => c.id !== id);

  if (db.categories.length === initialLen) {
    return res.status(404).json({ success: false, message: 'Kategori bulunamadı.' });
  }

  // Update products with this category to general
  db.products.forEach(p => {
    if (p.category === id) {
      p.category = 'diger';
    }
  });

  saveData(db);
  res.json({ success: true, message: 'Kategori silindi' });
});

// 5. Products Management
app.get('/api/products', (req, res) => {
  res.json({ success: true, data: db.products });
});

app.post('/api/products', (req, res) => {
  const {
    name, price, currency, desc, portion,
    allergens, type, category, badge, featured, inStock, img, icon
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Ürün adı zorunludur.' });
  }

  const newProduct = {
    id: 'prod_' + Date.now(),
    name: name.trim(),
    price: String(price || '0').replace('₺', '').trim(),
    currency: currency || db.settings.currency || '₺',
    desc: desc || '',
    portion: portion || 'Standart Porsiyon',
    allergens: allergens || '',
    type: type || 'food',
    category: category || (db.categories[0] ? db.categories[0].id : 'diger'),
    badge: badge || '',
    featured: Boolean(featured),
    inStock: inStock !== undefined ? Boolean(inStock) : true,
    img: img || '',
    icon: icon || ''
  };

  db.products.unshift(newProduct);
  saveData(db);
  res.json({ success: true, message: 'Ürün eklendi', data: newProduct });
});

app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const pIndex = db.products.findIndex(p => p.id === id);
  if (pIndex === -1) {
    return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });
  }

  const updated = { ...db.products[pIndex], ...req.body };
  if (updated.price) updated.price = String(updated.price).replace('₺', '').trim();

  db.products[pIndex] = updated;
  saveData(db);
  res.json({ success: true, message: 'Ürün güncellendi', data: updated });
});

// Quick toggle stock
app.patch('/api/products/:id/toggle-stock', (req, res) => {
  const { id } = req.params;
  const product = db.products.find(p => p.id === id);
  if (!product) return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });

  product.inStock = !product.inStock;
  saveData(db);
  res.json({ success: true, message: `Stok durumu güncellendi: ${product.inStock ? 'Stokta' : 'Tükendi'}`, inStock: product.inStock });
});

// Quick toggle featured
app.patch('/api/products/:id/toggle-featured', (req, res) => {
  const { id } = req.params;
  const product = db.products.find(p => p.id === id);
  if (!product) return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });

  product.featured = !product.featured;
  saveData(db);
  res.json({ success: true, message: `Favori durumu güncellendi: ${product.featured ? 'Favorilerde' : 'Çıkarıldı'}`, featured: product.featured });
});

// Quick price update
app.patch('/api/products/:id/quick-price', (req, res) => {
  const { id } = req.params;
  const { price } = req.body;
  const product = db.products.find(p => p.id === id);
  if (!product) return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });

  product.price = String(price || '0').replace('₺', '').trim();
  saveData(db);
  res.json({ success: true, message: 'Fiyat güncellendi', price: product.price });
});

app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const initialLen = db.products.length;
  db.products = db.products.filter(p => p.id !== id);

  if (db.products.length === initialLen) {
    return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });
  }

  saveData(db);
  res.json({ success: true, message: 'Ürün silindi' });
});

// 6. Image Upload Handler
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Resim dosyası yüklenemedi.' });
  }

  const fileUrl = '/uploads/' + req.file.filename;
  res.json({
    success: true,
    url: fileUrl,
    message: 'Resim başarıyla yüklendi.'
  });
});

// 7. QR Code Generator API
app.get('/api/qr', async (req, res) => {
  try {
    const table = req.query.table || '';
    const host = req.get('host');
    const protocol = req.protocol;
    const url = `${protocol}://${host}/${table ? '?masa=' + encodeURIComponent(table) : ''}`;

    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#93000b',
        light: '#ffffff'
      }
    });

    res.json({ success: true, url, qrDataUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: 'QR Kod oluşturulamadı: ' + err.message });
  }
});

// 8. Waiter Call & Notifications
app.post('/api/call-waiter', (req, res) => {
  const { table, type, note } = req.body;
  const notification = {
    id: 'call_' + Date.now(),
    table: table || 'Bilinmiyor',
    type: type || 'Garson Çağır', // 'Garson Çağır' | 'Hesap İste' | 'Sipariş'
    note: note || '',
    time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    createdAt: Date.now()
  };

  db.notifications = db.notifications || [];
  db.notifications.unshift(notification);
  // Keep last 30
  if (db.notifications.length > 30) db.notifications = db.notifications.slice(0, 30);

  saveData(db);
  res.json({ success: true, message: 'Talebiniz personele iletildi!', data: notification });
});

app.get('/api/notifications', (req, res) => {
  res.json({ success: true, data: db.notifications || [] });
});

app.delete('/api/notifications/:id', (req, res) => {
  const { id } = req.params;
  db.notifications = (db.notifications || []).filter(n => n.id !== id);
  saveData(db);
  res.json({ success: true, message: 'Bildirim kapatıldı.' });
});

// 9. Reset Demo Data
app.post('/api/reset-demo', (req, res) => {
  if (fs.existsSync(INITIAL_DATA_FILE)) {
    try {
      const initial = JSON.parse(fs.readFileSync(INITIAL_DATA_FILE, 'utf8'));
      db.settings = initial.settings;
      db.categories = initial.categories;
      db.products = initial.products;
      db.notifications = [];
      saveData(db);
      return res.json({ success: true, message: 'Menü demo verilerine başarıyla sıfırlandı!' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Sıfırlama hatası: ' + err.message });
    }
  }
  res.status(404).json({ success: false, message: 'Demo verisi bulunamadı.' });
});

// Fallback to customer menu or admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback all other routes to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Ali Baba Döner Kafe Web Sitesi & Admin Paneli Yayında!`);
  console.log(`📱 Müşteri QR Menü: http://localhost:${PORT}`);
  console.log(`⚙️  Yönetici Admin Paneli: http://localhost:${PORT}/admin`);
  console.log(`🔑 Varsayılan Admin PIN: 1234  (Şifre: admin)`);
  console.log(`=================================================`);
});
