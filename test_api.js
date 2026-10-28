const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Target server host & port
const PORT = 3001; // Separate port for testing
process.env.PORT = String(PORT);

const { app, server } = require('./server');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port: PORT,
      path: options.path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    let bodyData = null;
    if (data) {
      bodyData = JSON.stringify(data);
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = http.request(reqOptions, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(raw);
        } catch (e) {
          json = raw;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function runTests() {
  console.log('--- Ali Baba Döner Kafe Otomatik Entegrasyon Testleri Başlatılıyor ---');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  [BAŞARILI] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [BAŞARISIZ] ${name}`);
      console.error(`    Hata Detayı:`, err.message);
      throw err;
    }
  }

  try {
    // 1. Public Menu Test
    await test('1. GET /api/menu - Public menü çalışmalı ve admin kimlik bilgisi sızdırmamalı', async () => {
      const res = await request({ path: '/api/menu', method: 'GET' });
      assert.strictEqual(res.status, 200, 'Durum kodu 200 olmalı');
      assert.strictEqual(res.body.success, true, 'success true olmalı');
      assert.ok(Array.isArray(res.body.data.categories), 'categories array olmalı');
      assert.ok(Array.isArray(res.body.data.products), 'products array olmalı');
      assert.strictEqual(res.body.data.admin, undefined, 'Admin şifre/pin sızdırılmamalı');
    });

    // 2. Unauthenticated Operations Protection
    await test('2. Yetkilendirme Koruması - Token olmadan korumalı API 401 dönmeli', async () => {
      const res1 = await request({ path: '/api/products', method: 'POST' }, { name: 'İzinsiz Ürün' });
      assert.strictEqual(res1.status, 401, 'POST /api/products yetkisiz iken 401 olmalı');

      const res2 = await request({ path: '/api/settings', method: 'PUT' }, { restaurantName: 'Hacked' });
      assert.strictEqual(res2.status, 401, 'PUT /api/settings yetkisiz iken 401 olmalı');

      const res3 = await request({ path: '/api/notifications', method: 'GET' });
      assert.strictEqual(res3.status, 401, 'GET /api/notifications yetkisiz iken 401 olmalı');

      const res4 = await request({ path: '/api/categories/doner', method: 'DELETE' });
      assert.strictEqual(res4.status, 401, 'DELETE /api/categories yetkisiz iken 401 olmalı');
    });

    // 3. Login Authentication
    let adminToken = '';
    await test('3. Giriş İşlemi - Yanlış şifre 401, doğru şifre 200 ve güvenli token dönmeli', async () => {
      const failRes = await request({ path: '/api/login', method: 'POST' }, { pin: 'yanlis_pin_9999' });
      assert.strictEqual(failRes.status, 401, 'Hatalı PIN durumunda 401 dönmeli');
      assert.strictEqual(failRes.body.success, false);

      const successRes = await request({ path: '/api/login', method: 'POST' }, { pin: '1234' });
      assert.strictEqual(successRes.status, 200, 'Doğru PIN ile 200 dönmeli');
      assert.strictEqual(successRes.body.success, true);
      assert.ok(successRes.body.token, 'Geçerli bir session token üretilmeli');
      assert.strictEqual(typeof successRes.body.token, 'string');
      adminToken = successRes.body.token;

      // Token ile auth-check doğrulama
      const authCheck = await request({
        path: '/api/auth-check',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(authCheck.status, 200, 'auth-check 200 dönmeli');
    });

    // 4. Products CRUD & Stock Toggle & Quick Price
    let createdProductId = '';
    await test('4. Ürün CRUD İşlemleri - Ekleme, fiyat güncelleme, stok değiştirme, silme', async () => {
      // Create
      const newProdPayload = {
        name: 'Test Döner Özel',
        price: '185',
        portion: '120g Lavaş',
        category: 'doner',
        desc: 'Otomasyon test ürünü',
        inStock: true,
        featured: false
      };

      const createRes = await request({
        path: '/api/products',
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }, newProdPayload);

      assert.strictEqual(createRes.status, 201, 'Ürün ekleme 201 Created dönmeli');
      assert.strictEqual(createRes.body.success, true);
      assert.ok(createRes.body.data.id, 'Ürüne ID atanmalı');
      assert.strictEqual(createRes.body.data.name, 'Test Döner Özel');
      createdProductId = createRes.body.data.id;

      // Quick price update
      const priceRes = await request({
        path: `/api/products/${createdProductId}/quick-price`,
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }, { price: '210' });
      assert.strictEqual(priceRes.status, 200, 'Fiyat güncelleme 200 dönmeli');
      assert.strictEqual(priceRes.body.price, '210', 'Yeni fiyat yansımalı');

      // Toggle stock
      const stockRes = await request({
        path: `/api/products/${createdProductId}/toggle-stock`,
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(stockRes.status, 200, 'Stok değiştirme 200 dönmeli');
      assert.strictEqual(stockRes.body.inStock, false, 'Stok durumu tükendi olmalı');

      // Delete product
      const deleteRes = await request({
        path: `/api/products/${createdProductId}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(deleteRes.status, 200, 'Ürün silme 200 dönmeli');

      // Double delete should return 404
      const deleteAgainRes = await request({
        path: `/api/products/${createdProductId}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(deleteAgainRes.status, 404, 'Olmayan ürün silinmeye çalışıldığında 404 dönmeli');
    });

    // 5. Category Management
    let createdCatId = '';
    await test('5. Kategori Yönetimi - Ekleme, güncelleme ve silme', async () => {
      const catPayload = { name: 'Test Tatlılar', icon: 'icecream' };
      const createRes = await request({
        path: '/api/categories',
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }, catPayload);

      assert.strictEqual(createRes.status, 201, 'Kategori ekleme 201 dönmeli');
      assert.strictEqual(createRes.body.success, true);
      createdCatId = createRes.body.data.id;

      // Edit category
      const editRes = await request({
        path: `/api/categories/${createdCatId}`,
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }, { name: 'Test Gurme Tatlılar' });
      assert.strictEqual(editRes.status, 200, 'Kategori düzenleme 200 dönmeli');
      assert.strictEqual(editRes.body.data.name, 'Test Gurme Tatlılar');

      // Delete category
      const delRes = await request({
        path: `/api/categories/${createdCatId}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(delRes.status, 200, 'Kategori silme 200 dönmeli');
    });

    // 6. Waiter Calling & Spam/Cooldown Protection
    await test('6. Garson Çağırma & Spam Engelleme - Tekrarlanan tıklamalar 429 Too Many Requests almalı', async () => {
      const callPayload = {
        table: 'TestMasa99',
        type: 'Garson Çağır',
        note: 'Peçete lütfen'
      };

      // First call -> Success 200
      const firstCall = await request({ path: '/api/call-waiter', method: 'POST' }, callPayload);
      assert.strictEqual(firstCall.status, 200, 'İlk garson çağırma 200 dönmeli');
      assert.strictEqual(firstCall.body.success, true);
      const notifId = firstCall.body.data.id;

      // Immediate second call -> Rate limited 429
      const secondCall = await request({ path: '/api/call-waiter', method: 'POST' }, callPayload);
      assert.strictEqual(secondCall.status, 429, 'Peş peşe ikinci çağrı 429 Too Many Requests olmalı');
      assert.strictEqual(secondCall.body.cooldown, true, 'Cooldown bayrağı aktif olmalı');

      // Admin views notification
      const notifsRes = await request({
        path: '/api/notifications',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(notifsRes.status, 200);
      assert.ok(notifsRes.body.data.some(n => n.id === notifId), 'Yeni bildirim admin listesinde görünmeli');

      // Immediate consecutive orders -> MUST NOT be rate limited (no cooldown for orders)
      const firstOrder = await request({ path: '/api/call-waiter', method: 'POST' }, {
        table: 'TestMasa99',
        type: 'Sipariş',
        note: 'Tombik Döner (1 Porsiyon)'
      });
      assert.strictEqual(firstOrder.status, 200, 'İlk sipariş 200 dönmeli');
      assert.strictEqual(firstOrder.body.success, true);

      const secondOrder = await request({ path: '/api/call-waiter', method: 'POST' }, {
        table: 'TestMasa99',
        type: 'Sipariş',
        note: 'Ayran (Standart)'
      });
      assert.strictEqual(secondOrder.status, 200, 'Peş peşe ikinci sipariş bekleme süresiz 200 dönmeli');
      assert.strictEqual(secondOrder.body.success, true);

      // Clean up order notifications
      if (firstOrder.body.data?.id) {
        await request({ path: `/api/notifications/${firstOrder.body.data.id}`, method: 'DELETE', headers: { 'Authorization': `Bearer ${adminToken}` } });
      }
      if (secondOrder.body.data?.id) {
        await request({ path: `/api/notifications/${secondOrder.body.data.id}`, method: 'DELETE', headers: { 'Authorization': `Bearer ${adminToken}` } });
      }
    });

    // 7. XSS Sanitization
    await test('7. XSS Sanitization - Zararlı HTML/Script girdileri zararsız hale getirilmeli', async () => {
      const maliciousPayload = {
        table: '<script>alert("xss")</script>08',
        type: 'Garson Çağır',
        note: '<img src=x onerror=alert(1)>'
      };

      const xssCall = await request({ path: '/api/call-waiter', method: 'POST' }, maliciousPayload);
      assert.strictEqual(xssCall.status, 200);
      const data = xssCall.body.data;
      assert.ok(!data.table.includes('<script>'), 'table alanında <script> bulunmamalı');
      assert.ok(data.table.includes('&lt;script&gt;'), 'table alanı HTML encode edilmiş olmalı');
      assert.ok(!data.note.includes('<img'), 'note alanında <img etiketi bulunmamalı');

      // Cleanup
      await request({
        path: `/api/notifications/${data.id}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
    });

    // 8. QR Code Generator & Configurable Base URL
    await test('8. QR Kod & Yayın Adresi - Masa numarası ve yapılandırılabilir Base URL testi', async () => {
      // Default QR request
      const qrRes1 = await request({ path: '/api/qr?table=07', method: 'GET' });
      assert.strictEqual(qrRes1.status, 200, 'QR oluşturma 200 dönmeli');
      assert.strictEqual(qrRes1.body.success, true);
      assert.ok(qrRes1.body.qrDataUrl.startsWith('data:image/png;base64,'), 'Geçerli PNG data URL dönmeli');
      assert.ok(qrRes1.body.url.includes('?masa=07'), 'Masa parametresi URL içinde olmalı');

      // Configure Base URL
      const customBase = 'https://alibabadonercafe.com';
      await request({
        path: '/api/settings',
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }, { baseUrl: customBase });

      const qrRes2 = await request({ path: '/api/qr?table=12', method: 'GET' });
      assert.strictEqual(qrRes2.status, 200);
      assert.strictEqual(qrRes2.body.url, 'https://alibabadonercafe.com/?masa=12', 'QR URL yapılandırılan Base URL ile eşleşmeli');

      // Reset Base URL to empty for local testing
      await request({
        path: '/api/settings',
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }, { baseUrl: '' });
    });

    // 9. Data Persistence Verification
    await test('9. Veri Kalıcılığı - Dosya bütünlüğü ve JSON doğrulaması', async () => {
      const dataFile = path.join(__dirname, 'data', 'menu_data.json');
      assert.ok(fs.existsSync(dataFile), 'DATA_FILE mevcut olmalı');
      const content = fs.readFileSync(dataFile, 'utf8');
      const parsed = JSON.parse(content);
      assert.ok(parsed.settings, 'settings nesnesi bulunmalı');
      assert.ok(Array.isArray(parsed.products), 'products dizi olmalı');
      assert.ok(Array.isArray(parsed.categories), 'categories dizi olmalı');
    });

    // 10. Real-time SSE Stream & Notification Lifecycle
    await test('10. Gerçek Zamanlı SSE Bildirim Yayını - Anlık sipariş ve kapatma olayları', async () => {
      // Connect to SSE stream
      const events = [];
      const sseReq = http.request({
        hostname: '127.0.0.1',
        port: PORT,
        method: 'GET',
        path: `/api/notifications/stream?token=${encodeURIComponent(adminToken)}`,
        headers: { 'Accept': 'text/event-stream' }
      }, (res) => {
        res.on('data', chunk => {
          const parts = chunk.toString().split('\n\n');
          for (const part of parts) {
            if (!part.trim() || part.startsWith(':')) continue;
            let event = 'message';
            let data = '';
            for (const line of part.split('\n')) {
              if (line.startsWith('event: ')) event = line.slice(7).trim();
              if (line.startsWith('data: ')) data = line.slice(6);
            }
            try { data = JSON.parse(data); } catch (e) {}
            events.push({ event, data });
          }
        });
      });
      sseReq.end();

      // Wait 150ms for init event
      await new Promise(r => setTimeout(r, 150));
      assert.ok(events.some(e => e.event === 'init'), 'SSE init olayı alınmalı');

      // Create new order
      const orderRes = await request({ path: '/api/call-waiter', method: 'POST' }, {
        table: 'Masa 15',
        type: 'Ürün Siparişi - Kaşarlı Döner',
        note: 'Sıcak gelsin'
      });
      assert.strictEqual(orderRes.status, 200);
      const createdId = orderRes.body.data.id;

      // Wait 150ms for notification_created event
      await new Promise(r => setTimeout(r, 150));
      const createdEvent = events.find(e => e.event === 'notification_created' && e.data.id === createdId);
      assert.ok(createdEvent, 'Yeni sipariş SSE stream üzerinden anlık iletilmeli');

      // Dismiss notification (İlgilendim)
      const dismissRes = await request({
        path: `/api/notifications/${createdId}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(dismissRes.status, 200);

      // Wait 150ms for notification_dismissed event
      await new Promise(r => setTimeout(r, 150));
      const dismissedEvent = events.find(e => e.event === 'notification_dismissed' && e.data.id === createdId);
      assert.ok(dismissedEvent, 'Kapatılan bildirim SSE stream üzerinden anlık iletilmeli');

      sseReq.destroy();
    });

    console.log(`\n======================================================`);
    console.log(`Tüm testler başarıyla tamamlandı: ${passed}/${total} test geçti!`);
    console.log(`======================================================\n`);
  } catch (error) {
    console.error(`\nTest akışı başarısız oldu: ${passed}/${total} test geçti.`);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
