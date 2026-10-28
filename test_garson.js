/**
 * Ali Baba Döner Kafe — Garson Terminali Otomatik Testleri
 * http://localhost:3000/garson URL ve Garson API Entegrasyon Testleri
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Dynamically start server on port 3002
process.env.PORT = '3002';
const { app, server } = require('./server');

const BASE_URL = 'http://127.0.0.1:3002';
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

async function runGarsonTests() {
  console.log('\n--- Ali Baba Döner Kafe Garson Terminali Testleri Başlatılıyor ---');

  try {
    // 1. GET /garson HTML Route
    const garsonPage = await httpRequest('GET', '/garson');
    assert(
      garsonPage.status === 200 && typeof garsonPage.data === 'string' && garsonPage.data.includes('Garson Terminali'),
      '1. GET /garson - Garson Terminali sayfası 200 OK ve HTML içeriği dönmeli'
    );

    // 2. Authentication check
    const unauth = await httpRequest('GET', '/api/garson/state');
    assert(
      unauth.status === 401,
      '2. Yetkisiz Erişim - PIN veya token olmadan /api/garson/state 401 dönmeli'
    );

    // 3. State with staff PIN
    const stateRes = await httpRequest('GET', '/api/garson/state', { 'x-staff-pin': '1234' });
    assert(
      stateRes.status === 200 && stateRes.data && stateRes.data.success && Array.isArray(stateRes.data.data.tables),
      '3. GET /api/garson/state - PIN ile tüm masa, menü ve bildirim durumu çekilmeli',
      JSON.stringify(stateRes.data)
    );

    const tables = stateRes.data.data.tables;
    assert(
      tables.length >= 20 && tables[0].tableId === '01' && tables[3].tableId === '04',
      '4. Hızlı Masa Yapısı - Masalar 1\'den tableCount\'a kadar doğru ID ve formatta listelenmeli'
    );

    // 4. Add product to table 04 adisyon
    const addItemRes = await httpRequest('POST', '/api/garson/tables/04/items', { 'x-staff-pin': '1234' }, {
      productId: 'prod_test_1',
      name: 'Tombik Döner',
      price: 150,
      portion: 'Standart',
      note: 'Soğansız',
      quantity: 2
    });

    assert(
      addItemRes.status === 200 && addItemRes.data.success && addItemRes.data.data.totalAmount === 300,
      '5. Hızlı Adisyona Ürün Ekleme - 2x Tombik Döner (150₺) Masa 4 adisyonuna 300₺ olarak eklenmeli',
      JSON.stringify(addItemRes.data)
    );

    // 5. Update item delta
    const itemId = addItemRes.data.data.items[0].id;
    const updateItemRes = await httpRequest('PATCH', `/api/garson/tables/04/items/${itemId}`, { 'x-staff-pin': '1234' }, {
      delta: 1
    });

    assert(
      updateItemRes.status === 200 && updateItemRes.data.data.totalAmount === 450 && updateItemRes.data.data.totalItems === 3,
      '6. Adisyon Miktar Artırma - Miktar +1 artırıldığında toplam 450₺ ve 3 adet olmalı'
    );

    // 6. Waiter call creation & acknowledgement
    const callRes = await httpRequest('POST', '/api/call-waiter', {}, {
      table: '04',
      type: 'Garson Çağır',
      note: 'Peçete ve tuz rica ediyoruz'
    });

    assert(
      callRes.status === 200 && callRes.data.success && callRes.data.data.id,
      '7. Masa Çağrısı Oluşturma - Masa 4 için servis talebi başarıyla iletilmeli'
    );

    const callId = callRes.data.data.id;

    // Check table now has pending call in garson state
    const stateAfterCall = await httpRequest('GET', '/api/garson/state', { 'x-staff-pin': '1234' });
    const table4 = stateAfterCall.data.data.tables.find(t => t.tableId === '04');
    assert(
      table4 && table4.pendingCallsCount >= 1,
      '8. Bekleyen Masa Çağrısı Tespiti - Garson Terminali Masa 4 için bekleyen çağrıyı algılamalı'
    );

    // Dismiss call
    const dismissRes = await httpRequest('POST', `/api/garson/calls/${callId}/dismiss`, { 'x-staff-pin': '1234' });
    assert(
      dismissRes.status === 200 && dismissRes.data.success,
      '9. Masa Çağrısını Onaylayıp Kapatma - Çağrı garson tarafından tek tıkla onaylanıp kapatılmalı'
    );

    // 7. Settle / Close table adisyon
    const closeRes = await httpRequest('POST', '/api/garson/tables/04/close', { 'x-staff-pin': '1234' }, {
      paymentMethod: 'Kredi Kartı',
      note: 'Masa 4 ödeme tamamlandı'
    });

    assert(
      closeRes.status === 200 && closeRes.data.success,
      '10. Hesap Kapatma & Masa Boşaltma - Adisyon kapatılmalı, ödeme arşivlenmeli ve masa boşaltılmalı'
    );

    // Verify table 04 is idle now
    const stateAfterClose = await httpRequest('GET', '/api/garson/state', { 'x-staff-pin': '1234' });
    const table4After = stateAfterClose.data.data.tables.find(t => t.tableId === '04');
    assert(
      table4After && table4After.status === 'idle' && table4After.totalAmount === 0,
      '11. Masa Durum Doğrulaması - Kapanan masa \'idle\' (boş) ve 0₺ durumuna dönmeli'
    );

  } catch (err) {
    console.error('Test akışında beklenmeyen hata:', err);
  } finally {
    console.log('\n======================================================');
    console.log(`Garson Terminali testleri tamamlandı: ${passedCount}/${totalCount} test geçti!`);
    console.log('======================================================\n');
    server.close();
  }
}

runGarsonTests();
