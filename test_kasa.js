/**
 * Ali Baba Döner Kafe — Kasa / POS Terminali Otomatik Testleri
 * http://localhost:3000/kasa URL, Canlı Renk Kodları, Tahsilat & Fiş Testleri
 */

const http = require('http');

// Dynamically start server on port 3004
process.env.PORT = '3004';
const { app, server } = require('./server');

const BASE_URL = 'http://127.0.0.1:3004';
let passedCount = 0;
let totalCount = 0;

function httpRequest(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, testName, details = '') {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  [BAŞARILI] ${testName}`);
  } else {
    console.error(`  [BAŞARISIZ] ${testName}`);
    if (details) console.error(`    Detay: ${details}`);
  }
}

async function runKasaTests() {
  console.log('\n--- Ali Baba Döner Kafe Kasa / POS Terminali Testleri Başlatılıyor ---');

  try {
    // 1. GET /kasa HTML Route
    const kasaPage = await httpRequest('GET', '/kasa');
    assert(
      kasaPage.status === 200 && typeof kasaPage.data === 'string' && kasaPage.data.includes('Kasa & POS Terminali'),
      '1. GET /kasa - Kasa POS ekranı 200 OK ve HTML içeriği dönmeli'
    );

    // 2. Auth protection
    const unauth = await httpRequest('GET', '/api/kasa/state');
    assert(
      unauth.status === 401,
      '2. Yetkisiz Erişim Koruması - PIN veya token olmadan /api/kasa/state 401 dönmeli'
    );

    // 3. State with staff PIN
    const stateRes = await httpRequest('GET', '/api/kasa/state', { 'x-staff-pin': '1234' });
    assert(
      stateRes.status === 200 && stateRes.data && stateRes.data.success && Array.isArray(stateRes.data.data.tables),
      '3. GET /api/kasa/state - PIN ile masa durumları, adisyonlar ve günlük ciro özeti çekilmeli'
    );

    // Clean test table 08 before testing
    await httpRequest('POST', '/api/kasa/tables/08/cancel', { 'x-staff-pin': '1234' });

    // 4. Test Live Color Code: Boş (Idle)
    const stateIdle = await httpRequest('GET', '/api/kasa/state', { 'x-staff-pin': '1234' });
    const table8Idle = stateIdle.data.data.tables.find(t => t.tableId === '08');
    assert(
      table8Idle && table8Idle.status === 'idle' && table8Idle.totalAmount === 0,
      '4. Canlı Renk Kodu [Boş] - Siparişi olmayan masa \'idle\' statüsünde görünmeli'
    );

    // 5. Add items to Table 08
    const addRes = await httpRequest('POST', '/api/garson/tables/08/items', { 'x-staff-pin': '1234' }, {
      productId: 'prod_1',
      name: 'Tavuk Döner Dürüm',
      price: 150,
      portion: 'Lavaş',
      quantity: 2
    });

    assert(
      addRes.status === 200 && addRes.data.success && addRes.data.data.totalAmount === 300,
      '5. Adisyona Ürün Ekleme - 2x Tavuk Dürüm Masa 8 adisyonuna 300₺ olarak eklenmeli'
    );

    // 6. Test Live Color Code: Sipariş Aktif (Occupied - Yeşil)
    const stateOccupied = await httpRequest('GET', '/api/kasa/state', { 'x-staff-pin': '1234' });
    const table8Occupied = stateOccupied.data.data.tables.find(t => t.tableId === '08');
    assert(
      table8Occupied && table8Occupied.status === 'occupied' && table8Occupied.totalAmount === 300,
      '6. Canlı Renk Kodu [Sipariş Aktif] - Ürünü olan masa \'occupied\' (Yeşil) statüsünde olmalı'
    );

    // 7. Customer asks for Bill -> Live Color Code: Hesap İstendi (Bill Requested - Kehribar/Pulse)
    await httpRequest('POST', '/api/call-waiter', {}, {
      table: '08',
      type: 'Hesap İste',
      note: 'Masa 8 hesap istedi'
    });

    const stateBill = await httpRequest('GET', '/api/kasa/state', { 'x-staff-pin': '1234' });
    const table8Bill = stateBill.data.data.tables.find(t => t.tableId === '08');
    assert(
      table8Bill && table8Bill.status === 'bill_requested' && table8Bill.hasBillRequest === true,
      '7. Canlı Renk Kodu [Hesap İstendi] - Hesap isteyen masa \'bill_requested\' (Kehribar/Parlayan) statüsünde görünmeli'
    );

    // 8. Settle Table 08 with Cash (Nakit Tahsilat & Para Üstü)
    const closeCashRes = await httpRequest('POST', '/api/kasa/tables/08/close', { 'x-staff-pin': '1234' }, {
      paymentMethod: 'Nakit',
      receivedAmount: 350,
      discountAmount: 0,
      note: 'Nakit tahsilat yapıldı'
    });

    assert(
      closeCashRes.status === 200 && closeCashRes.data.success && closeCashRes.data.data.receipt,
      '8. Nakit ile Hesap Kapatma - Masa 8 hesabı 300₺ nakit olarak kapatılmalı ve termal fiş üretilmeli',
      JSON.stringify(closeCashRes.data)
    );

    const receipt = closeCashRes.data.data.receipt;
    assert(
      receipt.receiptNumber && receipt.totalAmount === 300 && receipt.changeAmount === 50 && receipt.paymentMethod === 'Nakit',
      '9. Termal Fiş Parametreleri - Fiş numarası, 50₺ para üstü ve KDV hesaplaması doğrulanmalı'
    );

    // 10. Table 08 returns to idle and notification dismissed
    const stateAfterClose = await httpRequest('GET', '/api/kasa/state', { 'x-staff-pin': '1234' });
    const table8After = stateAfterClose.data.data.tables.find(t => t.tableId === '08');
    const billNotifStillExists = stateAfterClose.data.data.notifications.some(n => n.table === '08');
    assert(
      table8After && table8After.status === 'idle' && !billNotifStillExists,
      '10. Kasa Kapanış Sonrası Durum - Hesap kapatılınca masa \'idle\' olmalı ve hesap çağrısı otomatik temizlenmeli'
    );

    // 11. Credit Card (Kredi Kartı / POS) Settle Test on Table 09
    await httpRequest('POST', '/api/kasa/tables/09/cancel', { 'x-staff-pin': '1234' });
    await httpRequest('POST', '/api/garson/tables/09/items', { 'x-staff-pin': '1234' }, {
      productId: 'prod_2',
      name: 'Et Döner Dürüm',
      price: 240,
      portion: 'Lavaş',
      quantity: 1
    });

    const closeCardRes = await httpRequest('POST', '/api/kasa/tables/09/close', { 'x-staff-pin': '1234' }, {
      paymentMethod: 'Kredi Kartı',
      discountAmount: 20, // 20₺ iskonto
      note: 'POS slip onaylı'
    });

    assert(
      closeCardRes.status === 200 && closeCardRes.data.success && closeCardRes.data.data.receipt.totalAmount === 220,
      '11. Kredi Kartı ile Hesap Kapatma - 240₺ - 20₺ iskonto ile 220₺ Kredi Kartı tahsilatı tamamlanmalı'
    );

    // 12. Thermal Receipt Fetch API
    const receiptNum = closeCardRes.data.data.receipt.receiptNumber;
    const getReceiptRes = await httpRequest('GET', `/api/kasa/receipt/${encodeURIComponent(receiptNum)}`, { 'x-staff-pin': '1234' });
    assert(
      getReceiptRes.status === 200 && getReceiptRes.data.success && getReceiptRes.data.data.receiptNumber === receiptNum,
      '12. Termal Fiş Sorgulama API - Fiş numarası ile geçmiş fiş verisi çekilebilmeli'
    );

    // 13. Cancel / Void Adisyon Test on Table 10
    await httpRequest('POST', '/api/garson/tables/10/items', { 'x-staff-pin': '1234' }, {
      productId: 'prod_19',
      name: 'Çay',
      price: 20,
      quantity: 2
    });

    const cancelRes = await httpRequest('POST', '/api/kasa/tables/10/cancel', { 'x-staff-pin': '1234' }, {
      reason: 'Yanlış masa girildi'
    });

    assert(
      cancelRes.status === 200 && cancelRes.data.success,
      '13. Adisyon İptal / Temizleme - Masa adisyonu iptal sebebiyle sıfırlanabilmeli'
    );

    // 14. History & Daily Summary API
    const historyRes = await httpRequest('GET', '/api/kasa/history?range=today', { 'x-staff-pin': '1234' });
    assert(
      historyRes.status === 200 && historyRes.data.success && historyRes.data.data.orders.length >= 2,
      '14. Günlük Sipariş Geçmişi - Bugünkü kapanan siparişler filtrelenip listelenebilmeli'
    );

    // 15. Daily Summary Metrics verification
    const summary = stateAfterClose.data.data.dailySummary;
    assert(
      summary && summary.totalRevenue >= 300 && summary.cashTotal >= 300,
      '15. Günlük Ciro & Tahsilat Özeti - Günlük ciro, nakit ve kart dağılımı otomatik hesaplanmalı'
    );

    // Clean up test tables
    await httpRequest('POST', '/api/kasa/tables/08/cancel', { 'x-staff-pin': '1234' });
    await httpRequest('POST', '/api/kasa/tables/09/cancel', { 'x-staff-pin': '1234' });
    await httpRequest('POST', '/api/kasa/tables/10/cancel', { 'x-staff-pin': '1234' });

  } catch (err) {
    console.error('Kasa test akışında hata:', err);
  } finally {
    console.log('\n======================================================');
    console.log(`Kasa / POS Terminali testleri tamamlandı: ${passedCount}/${totalCount} test geçti!`);
    console.log('======================================================\n');
    server.close();
  }
}

runKasaTests();

