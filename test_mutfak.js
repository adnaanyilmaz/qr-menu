/**
 * Automated Integration Test Suite for Ali Baba Döner Kafe
 * Mutfak Ekranı (Kitchen Display System - KDS)
 */

const http = require('http');

process.env.PORT = '3005';
const { app, server } = require('./server');

const BASE_URL = 'http://127.0.0.1:3005';
const STAFF_PIN = '1234';

function request(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
      });
    });

    req.on('error', reject);

    if (bodyData) {
      const payload = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(payload));
      req.write(payload);
    }

    req.end();
  });
}

async function runTests() {
  console.log('\n--- Ali Baba Döner Kafe Mutfak Ekranı (KDS) Testleri Başlatılıyor ---');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  [BAŞARILI] ${total}. ${message}`);
      passed++;
    } else {
      console.error(`  [BAŞARISIZ] ${total}. ${message}`);
    }
  }

  try {
    // 1. GET /mutfak route
    const resMutfakHtml = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/mutfak',
      method: 'GET'
    });
    assert(
      resMutfakHtml.statusCode === 200 && resMutfakHtml.body.includes('Mutfak Ekranı (KDS)'),
      'GET /mutfak - Mutfak KDS ekranı 200 OK ve HTML içeriği dönmeli'
    );

    // 2. Yetkisiz erişim koruması
    const resUnauthorized = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/kds/state',
      method: 'GET'
    });
    assert(
      resUnauthorized.statusCode === 401,
      'Yetkisiz Erişim Koruması - PIN veya token olmadan /api/kds/state 401 dönmeli'
    );

    // 3. GET /api/kds/state with PIN
    const resKdsState = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/kds/state',
      method: 'GET',
      headers: { 'x-staff-pin': STAFF_PIN }
    });
    assert(
      resKdsState.statusCode === 200 && resKdsState.json && resKdsState.json.success && resKdsState.json.data.summary,
      'GET /api/kds/state - PIN ile mutfak siparişleri ve özet sayaçlar çekilmeli'
    );

    // 4. Müşteri QR siparişi oluşturulduğunda otomatik mutfak bileti oluşmalı
    const qrOrderData = {
      table: 'Masa 11',
      type: 'Sipariş Ver',
      note: 'Acil lütfen, soğansız',
      items: [
        { name: 'Tavuk Döner Dürüm', portion: 'Lavaş', quantity: 2, note: 'Soğansız, bol soslu' },
        { name: 'Ayran', portion: '300ml', quantity: 2, note: '' }
      ]
    };
    const resQrOrder = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/call-waiter',
      method: 'POST'
    }, qrOrderData);
    assert(
      resQrOrder.statusCode === 200 && resQrOrder.json.success && resQrOrder.json.kitchenTicket,
      'Müşteri QR Siparişi - Otomatik KDS mutfak fişi oluşturulmalı'
    );

    const testTicket = resQrOrder.json.kitchenTicket;

    // 5. Bilet veri modeli doğrulaması
    assert(
      testTicket && testTicket.id && testTicket.ticketNumber && testTicket.tableId === '11' && testTicket.status === 'pending' && testTicket.items.length === 2,
      'Bilet Veri Modeli - Fiş numarası (#10x), masa ID (11), status: "pending" ve kalemler doğrulanmalı'
    );

    // 6. "Hazırlamaya Başla" iş akışı (Pending -> Preparing)
    const resStart = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: `/api/kds/orders/${testTicket.id}/start`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    });
    assert(
      resStart.statusCode === 200 && resStart.json.data && resStart.json.data.status === 'preparing' && resStart.json.data.startedAt,
      '"Hazırlamaya Başla" İş Akışı - Sipariş "preparing" durumuna geçmeli ve startedAt kaydedilmeli'
    );

    // 7. Kalem tamamlama kontrolü (item checkbox toggle)
    const firstItemId = testTicket.items[0].id;
    const resItemToggle = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: `/api/kds/orders/${testTicket.id}/items/${firstItemId}/toggle`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    });
    const updatedFirstItem = resItemToggle.json && resItemToggle.json.data && resItemToggle.json.data.items.find(i => i.id === firstItemId);
    assert(
      resItemToggle.statusCode === 200 && updatedFirstItem && updatedFirstItem.completed === true,
      'Kalem Checkbox Kontrolü - Aşçı tek tek ürünleri tamamlandı olarak işaretleyebilmeli'
    );

    // 8. "Tamamlandı" iş akışı (Preparing -> Completed)
    const resComplete = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: `/api/kds/orders/${testTicket.id}/complete`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    });
    assert(
      resComplete.statusCode === 200 && resComplete.json.data && resComplete.json.data.status === 'completed' && resComplete.json.data.completedAt,
      '"Tamamlandı" İş Akışı - Sipariş "completed" durumuna geçmeli ve completedAt kaydedilmeli'
    );

    // 9. Servis personeline otomatik bildirim düşmesi
    assert(
      resComplete.json.notification && resComplete.json.notification.type.includes('Hazır') && resComplete.json.notification.table.includes('11'),
      'Otomatik Garson Bildirimi - Sipariş tamamlanınca "Sipariş Hazır 🔔" bildirimi garson terminaline iletilmeli'
    );

    // 10. Geri alma iş akışı (Undo / Revert)
    const resRevert = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: `/api/kds/orders/${testTicket.id}/revert`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    });
    assert(
      resRevert.statusCode === 200 && resRevert.json.data && resRevert.json.data.status === 'preparing',
      'Geri Alma (Undo) - Tamamlanan sipariş gerektiğinde "preparing" durumuna geri alınabilmeli'
    );

    // Re-complete it so stats reflect today
    await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: `/api/kds/orders/${testTicket.id}/complete`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    });

    // 11. Garson adisyona ürün eklediğinde mutfak siparişi oluşumu
    const resGarsonItem = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/garson/tables/12/items',
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    }, {
      name: 'Tombik Döner',
      portion: 'Standart',
      quantity: 1,
      price: 150,
      note: 'Turşusuz'
    });
    assert(
      resGarsonItem.statusCode === 200 && resGarsonItem.json.kitchenTicket && resGarsonItem.json.kitchenTicket.source === 'garson',
      'Garson Terminali Entegrasyonu - Garson adisyona ürün girdiğinde mutfağa otomatik fiş iletilmeli'
    );

    // 12. Manuel bilet oluşturma API'si
    const resManualTicket = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/kds/orders',
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    }, {
      table: 'Masa 14',
      items: [{ name: 'Pilav Üstü Döner', portion: '1.5 Porsiyon', quantity: 2, note: 'Tereyağlı' }],
      note: 'Paket sipariş',
      source: 'manual'
    });
    assert(
      resManualTicket.statusCode === 201 && resManualTicket.json.data && resManualTicket.json.data.tableId === '14',
      'Manuel Fiş Oluşturma - Mutfak veya garson hızlı manuel fiş oluşturabilmeli'
    );

    // 13. Mutfak sipariş iptali
    const manualTicketId = resManualTicket.json.data.id;
    const resCancel = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: `/api/kds/orders/${manualTicketId}/cancel`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    }, { reason: 'Müşteri vazgeçti' });
    assert(
      resCancel.statusCode === 200 && resCancel.json.data && resCancel.json.data.status === 'cancelled',
      'Sipariş İptali - Mutfak siparişi iptal sebebiyle "cancelled" durumuna geçebilmeli'
    );

    // 14. KDS özet metrikleri doğrulaması
    const resMetrics = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/kds/state',
      method: 'GET',
      headers: { 'x-staff-pin': STAFF_PIN }
    });
    const summary = resMetrics.json && resMetrics.json.data && resMetrics.json.data.summary;
    assert(
      summary && summary.completedTodayCount >= 1 && summary.avgPrepMinutes !== undefined,
      'KDS Özet & İstatistik - Bekleyen, hazırlanan, tamamlanan ve ortalama hazırlık süresi hesaplanmalı'
    );

    // 15. Web Audio API ve Süre Sayacı bileşenleri kontrolü
    assert(
      resMutfakHtml.body.includes('testKitchenBell') &&
      resMutfakHtml.body.includes('kds-cards-grid') &&
      resMutfakHtml.body.includes('Zil Sesini Test Et'),
      'Web Audio API & Arayüz Bileşenleri - Zil test butonu ve süre sayacı altyapısı HTML ve JS içinde tanımlı olmalı'
    );

    console.log(`\n======================================================`);
    console.log(`Mutfak Ekranı (KDS) testleri tamamlandı: ${passed}/${total} test geçti!`);
    console.log(`======================================================\n`);

  } catch (err) {
    console.error('KDS test akışında hata:', err);
  } finally {
    server.close();
  }
}

runTests();
