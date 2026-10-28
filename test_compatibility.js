/**
 * Comprehensive Cross-System Compatibility & End-to-End Integration Test Suite
 * Tests full restaurant lifecycle across:
 * 1. Customer QR Menu (/)
 * 2. Waiter Terminal (/garson)
 * 3. Kitchen Display System - KDS (/mutfak)
 * 4. Cashier & POS Terminal (/kasa)
 * 5. Admin Portal (/admin)
 */

const http = require('http');

process.env.PORT = '3006';
const { app, server } = require('./server');

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

async function runCompatibilityTests() {
  console.log('\n======================================================');
  console.log('--- SİSTEMLER ARASI UYUMLULUK & ENTEGRASYON TESTİ ---');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message, details = '') {
    total++;
    if (condition) {
      console.log(`  [BAŞARILI] ${total}. ${message}`);
      if (details) console.log(`             └─ ${details}`);
      passed++;
    } else {
      console.error(`  [BAŞARISIZ] ${total}. ${message}`);
      if (details) console.error(`             └─ Hata Detayı: ${details}`);
    }
  }

  const TEST_TABLE = 'Masa 16';
  const NORM_TABLE_ID = '16';

  try {
    // ------------------------------------------------------------------------
    // ADIM 1: Tüm Arayüz Uç Noktalarının Sağlık Kontrolü (Health Checks)
    // ------------------------------------------------------------------------
    const routes = [
      { name: 'Müşteri QR Menü', path: '/' },
      { name: 'Garson Terminali', path: '/garson' },
      { name: 'Kasa / POS Ekranı', path: '/kasa' },
      { name: 'Mutfak Ekranı (KDS)', path: '/mutfak' },
      { name: 'Admin Paneli', path: '/admin' }
    ];

    for (const r of routes) {
      const res = await request({ hostname: '127.0.0.1', port: 3006, path: r.path, method: 'GET' });
      assert(res.statusCode === 200, `${r.name} (${r.path}) 200 OK yanıt vermeli`);
    }

    // ------------------------------------------------------------------------
    // ADIM 2: Uçtan Uca Sipariş Döngüsü (End-to-End Restaurant Lifecycle)
    // ------------------------------------------------------------------------
    
    // 2.1 Müşteri masaya oturur, QR menüden 2x Tavuk Dürüm + 2x Ayran siparişi verir
    const resCustomerOrder = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/call-waiter',
      method: 'POST'
    }, {
      table: TEST_TABLE,
      type: 'Sipariş Ver',
      note: 'Soğanlar az olsun, dürümler çıtır',
      items: [
        { name: 'Tavuk Döner Dürüm', portion: 'Lavaş', quantity: 2, price: 150, note: 'Az soğanlı' },
        { name: 'Ayran', portion: '300ml', quantity: 2, price: 35, note: '' }
      ]
    });

    assert(
      resCustomerOrder.statusCode === 200 && resCustomerOrder.json.success,
      '1. Müşteri QR Siparişi Başarıyla Alındı',
      `Sipariş ID: ${resCustomerOrder.json.data.id}`
    );

    const kitchenTicket = resCustomerOrder.json.kitchenTicket;
    assert(
      kitchenTicket && kitchenTicket.status === 'pending' && kitchenTicket.tableId === NORM_TABLE_ID,
      '2. Mutfak Ekranı (KDS) Bilet Senkronizasyonu',
      `Fiş No: ${kitchenTicket ? kitchenTicket.ticketNumber : 'Yok'}, Durum: ${kitchenTicket ? kitchenTicket.status : 'Yok'}`
    );

    // 2.2 Garson Terminali: Bekleyen sipariş çağrısını onaylar ve masa adisyonuna ekler
    const resGarsonApprove = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: `/api/garson/calls/${resCustomerOrder.json.data.id}/approve-order`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    });

    assert(
      resGarsonApprove.statusCode === 200 && resGarsonApprove.json.data && resGarsonApprove.json.data.adisyon,
      '3. Garson Terminali Siparişi Onayladı ve Adisyona Ekledi',
      `Masa ${NORM_TABLE_ID} Toplamı: ${resGarsonApprove.json.data.adisyon.totalAmount}₺ (370₺ olmalı)`
    );

    // 2.3 Mutfak Ekranı (KDS): Aşçı siparişi görür ve "Hazırlamaya Başla" butonuna basar
    const resKitchenStart = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: `/api/kds/orders/${kitchenTicket.id}/start`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    });

    assert(
      resKitchenStart.statusCode === 200 && resKitchenStart.json.data.status === 'preparing',
      '4. Mutfak Ekranı Siparişi Ocağa Aldı ("Hazırlanıyor")',
      `Durum: ${resKitchenStart.json.data.status}, Başlama: ${new Date(resKitchenStart.json.data.startedAt).toLocaleTimeString('tr-TR')}`
    );

    // 2.4 Garson sonradan masaya 1x Sütlaç (tatlı) ekler
    const resGarsonExtraItem = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: `/api/garson/tables/${NORM_TABLE_ID}/items`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    }, {
      name: 'Fırın Sütlaç',
      portion: 'Porsiyon',
      quantity: 1,
      price: 90,
      note: 'Fındıklı'
    });

    assert(
      resGarsonExtraItem.statusCode === 200 && resGarsonExtraItem.json.data.totalAmount === 460,
      '5. Garson Adisyona Ek Ürün Girdi (Fırın Sütlaç 90₺)',
      `Güncel Adisyon Bakiyesi: ${resGarsonExtraItem.json.data.totalAmount}₺ (370 + 90 = 460₺)`
    );

    // 2.5 Mutfak Ekranı: Dürümler pişti, "Tamamlandı" butonuna basılır
    const resKitchenComplete = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: `/api/kds/orders/${kitchenTicket.id}/complete`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    });

    assert(
      resKitchenComplete.statusCode === 200 && resKitchenComplete.json.data.status === 'completed',
      '6. Mutfak Ekranı Siparişi Tamamladı ("Servise Hazır")',
      `Tamamlanma Zamanı: ${new Date(resKitchenComplete.json.data.completedAt).toLocaleTimeString('tr-TR')}`
    );

    // 2.6 Mutfak tamamlayınca Garson Terminaline otomatik bildirim düşmeli
    assert(
      resKitchenComplete.json.notification && resKitchenComplete.json.notification.type.includes('Hazır'),
      '7. Mutfak Tamamlaması Garsona "Sipariş Hazır 🔔" Bildirimi Olarak Ulaştı',
      `Bildirim Metni: ${resKitchenComplete.json.notification ? resKitchenComplete.json.notification.note : 'Yok'}`
    );

    // 2.7 Müşteri yemeğini bitirdi ve menüden "Hesap İste" butonuna tıkladı
    const resCustomerBillRequest = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/call-waiter',
      method: 'POST'
    }, {
      table: TEST_TABLE,
      type: 'Hesap İste',
      note: 'Nakit ödeyeceğiz'
    });

    assert(
      resCustomerBillRequest.statusCode === 200,
      '8. Müşteri "Hesap İste" Çağrısı Gönderdi',
      `Çağrı Tipi: ${resCustomerBillRequest.json.data.type}`
    );

    // 2.8 Kasa / POS Ekranı: Masa 16 canlı durumu "bill_requested" (kehribar/yanıp sönen) olarak algılandı mı?
    const resKasaState = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/kasa/state',
      method: 'GET',
      headers: { 'x-staff-pin': STAFF_PIN }
    });

    const kasaTable = resKasaState.json.data.tables.find(t => t.tableId === NORM_TABLE_ID);
    assert(
      kasaTable && kasaTable.status === 'bill_requested' && kasaTable.totalAmount === 460,
      '9. Kasa POS Ekranı Canlı Renk Kodu Uyarısı ("bill_requested")',
      `Masa Durumu: ${kasaTable ? kasaTable.status : 'Yok'}, Açık Adisyon: ${kasaTable ? kasaTable.totalAmount : 0}₺`
    );

    // 2.9 Kasa / POS Ekranı: Kasiyer 460₺ hesabı 500₺ Nakit alarak kapatır (40₺ Para Üstü)
    const resKasaClose = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: `/api/kasa/tables/${NORM_TABLE_ID}/close`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    }, {
      paymentMethod: 'Nakit',
      receivedAmount: 500,
      discountAmount: 0,
      cashier: 'Ahmet Kasiyer',
      note: 'Masa 16 nakit tahsilat'
    });

    const receipt = resKasaClose.json && resKasaClose.json.data && resKasaClose.json.data.receipt;
    assert(
      resKasaClose.statusCode === 200 && receipt && receipt.receiptNumber && receipt.changeAmount === 40,
      '10. Kasa Tahsilatı & 80mm Termal Fiş Üretimi',
      `Fiş No: ${receipt ? receipt.receiptNumber : 'Yok'}, Alınan: 500₺, Tutar: 460₺, Para Üstü: ${receipt ? receipt.changeAmount : 0}₺`
    );

    // 2.10 Kasa kapandıktan sonra masa 'idle' (boş) ve 0₺ olmalı, hesap çağrısı otomatik temizlenmeli
    const resKasaStateAfter = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/kasa/state',
      method: 'GET',
      headers: { 'x-staff-pin': STAFF_PIN }
    });

    const kasaTableAfter = resKasaStateAfter.json.data.tables.find(t => t.tableId === NORM_TABLE_ID);
    const hasRemainingBillCall = resKasaStateAfter.json.data.notifications.some(n => n.table.includes(NORM_TABLE_ID));
    assert(
      kasaTableAfter && kasaTableAfter.status === 'idle' && !hasRemainingBillCall,
      '11. Kasa Kapanış Sonrası Masa Sıfırlanması & Bildirim Temizliği',
      `Masa Statüsü: ${kasaTableAfter ? kasaTableAfter.status : 'Yok'}, Kalan Hesap Çağrısı: ${hasRemainingBillCall ? 'Var (HATA)' : 'Yok (TEMİZLENDİ)'}`
    );

    // 2.11 Günlük Ciro & Finansal Rapor Güncellemesi
    const resHistory = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/kasa/history?range=today',
      method: 'GET',
      headers: { 'x-staff-pin': STAFF_PIN }
    });

    const closedOrderInHistory = resHistory.json.data.orders.find(o => o.receiptNumber === receipt.receiptNumber);
    assert(
      closedOrderInHistory && resHistory.json.data.summary.totalRevenue >= 460,
      '12. Günlük Ciro ve Rapor Entegrasyonu',
      `Kapanan Fiş Raporda Bulundu, Toplam Günlük Ciro: ${resHistory.json.data.summary.totalRevenue}₺`
    );

    console.log(`\n======================================================`);
    console.log(`Sistemler arası uyumluluk testleri tamamlandı: ${passed}/${total} test geçti!`);
    console.log(`======================================================\n`);

  } catch (err) {
    console.error('Uyumluluk testinde hata:', err);
  } finally {
    server.close();
  }
}

runCompatibilityTests();
