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
      '1. Müşteri QR Siparişi Alındı (Garson Onayı Bekliyor)',
      `Sipariş ID: ${resCustomerOrder.json.data.id}`
    );

    // 2.2 KRİTİK KURAL KONTROLÜ: Garson onaylamadan mutfak ekranına DÜŞMEMELİ!
    const resKdsBeforeApprove = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/kds/state',
      method: 'GET',
      headers: { 'x-staff-pin': STAFF_PIN }
    });

    const isAlreadyInKitchen = (resKdsBeforeApprove.json.data.orders || []).some(o => o.tableId === NORM_TABLE_ID && o.status === 'pending');
    assert(
      !isAlreadyInKitchen,
      '2. Garson Onay Kuralı: Garson onaylamadan sipariş mutfağa DÜŞMEDİ',
      'Mutfak fişi henüz oluşturulmadı (Gereksiz pişirme ve fire engellendi)'
    );

    // 2.3 Garson Terminali: Garson çağrıyı inceler, masayı teyit eder ve "Onayla & Adisyona Ekle" butonuna basar
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

    // 2.4 Garson onayladıktan sonra Mutfak Ekranı (KDS) bileti oluşmuş olmalı
    const resKdsAfterApprove = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/kds/state',
      method: 'GET',
      headers: { 'x-staff-pin': STAFF_PIN }
    });

    const kitchenTicket = (resKdsAfterApprove.json.data.orders || []).find(o => o.tableId === NORM_TABLE_ID && o.status === 'pending');
    assert(
      kitchenTicket && kitchenTicket.status === 'pending' && kitchenTicket.tableId === NORM_TABLE_ID,
      '4. Garson Onayı Sonrası Mutfak Ekranı (KDS) Bilet Senkronizasyonu',
      `Fiş No: ${kitchenTicket ? kitchenTicket.ticketNumber : 'Yok'}, Durum: ${kitchenTicket ? kitchenTicket.status : 'Yok'}`
    );

    // 2.5 Mutfak Ekranı (KDS): Aşçı siparişi görür ve "Hazırlamaya Başla" butonuna basar
    const resKitchenStart = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: `/api/kds/orders/${kitchenTicket.id}/start`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    });

    assert(
      resKitchenStart.statusCode === 200 && resKitchenStart.json.data.status === 'preparing',
      '5. Mutfak Ekranı Siparişi Ocağa Aldı ("Hazırlanıyor")',
      `Durum: ${resKitchenStart.json.data.status}, Başlama: ${new Date(resKitchenStart.json.data.startedAt).toLocaleTimeString('tr-TR')}`
    );

    // 2.6 Garson sonradan masaya 1x Sütlaç (tatlı) ekler
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
      '6. Garson Adisyona Ek Ürün Girdi (Fırın Sütlaç 90₺)',
      `Güncel Adisyon Bakiyesi: ${resGarsonExtraItem.json.data.totalAmount}₺ (370 + 90 = 460₺)`
    );

    // 2.7 Mutfak Ekranı: Dürümler pişti, "Tamamlandı" butonuna basılır
    const resKitchenComplete = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: `/api/kds/orders/${kitchenTicket.id}/complete`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    });

    assert(
      resKitchenComplete.statusCode === 200 && resKitchenComplete.json.data.status === 'completed',
      '7. Mutfak Ekranı Siparişi Tamamladı ("Servise Hazır")',
      `Tamamlanma Zamanı: ${new Date(resKitchenComplete.json.data.completedAt).toLocaleTimeString('tr-TR')}`
    );

    // 2.8 Mutfak tamamlayınca Garson Terminaline otomatik bildirim düşmeli
    assert(
      resKitchenComplete.json.notification && resKitchenComplete.json.notification.type.includes('Hazır'),
      '8. Mutfak Tamamlaması Garsona "Sipariş Hazır 🔔" Bildirimi Olarak Ulaştı',
      `Bildirim Metni: ${resKitchenComplete.json.notification ? resKitchenComplete.json.notification.note : 'Yok'}`
    );

    // 2.9 MASA TAŞIMA / TRANSFER TESTİ: Masa 16 bahçeden Masa 17'ye transfer edilir
    const resTransfer = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: `/api/garson/tables/${NORM_TABLE_ID}/transfer`,
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    }, {
      toTableId: '17',
      note: 'Masa 16 -> Masa 17 bahçe geçişi'
    });

    assert(
      resTransfer.statusCode === 200 && resTransfer.json.data && resTransfer.json.data.toTableId === '17' && resTransfer.json.data.adisyon.totalAmount === 460,
      '9. Masa Transferi: Masa 16 adisyonu (460₺) başarıyla Masa 17 masasına aktarıldı',
      `Hedef Masa: Masa ${resTransfer.json.data.toTableId}, Tutar: ${resTransfer.json.data.adisyon.totalAmount}₺`
    );

    // 2.10 Müşteri yemeğini bitirdi ve Masa 17'den "Hesap İste" butonuna tıkladı
    const resCustomerBillRequest = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/call-waiter',
      method: 'POST'
    }, {
      table: 'Masa 17',
      type: 'Hesap İste',
      note: 'Kart ve nakit ödeyeceğiz'
    });

    assert(
      resCustomerBillRequest.statusCode === 200,
      '10. Müşteri Masa 17 İçin "Hesap İste" Çağrısı Gönderdi',
      `Çağrı Tipi: ${resCustomerBillRequest.json.data.type}`
    );

    // 2.11 Kasa / POS Ekranı: Masa 17 canlı durumu "bill_requested" (kehribar/yanıp sönen) olarak algılandı mı?
    const resKasaState = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/kasa/state',
      method: 'GET',
      headers: { 'x-staff-pin': STAFF_PIN }
    });

    const kasaTable = resKasaState.json.data.tables.find(t => t.tableId === '17');
    assert(
      kasaTable && kasaTable.status === 'bill_requested' && kasaTable.totalAmount === 460,
      '11. Kasa POS Ekranı Canlı Renk Kodu Uyarısı ("bill_requested")',
      `Masa 17 Durumu: ${kasaTable ? kasaTable.status : 'Yok'}, Açık Adisyon: ${kasaTable ? kasaTable.totalAmount : 0}₺`
    );

    // 2.12 PARÇALI ÖDEME (SPLIT BILL) TESTİ: 460₺ hesap; 200₺ Nakit + 260₺ Kredi Kartı ile kapatılır
    const resKasaClose = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/kasa/tables/17/close',
      method: 'POST',
      headers: { 'x-staff-pin': STAFF_PIN }
    }, {
      paymentMethod: 'Parçalı Ödeme',
      splitDetails: { cash: 200, card: 260 },
      receivedAmount: 460,
      discountAmount: 0,
      cashier: 'Ahmet Kasiyer',
      note: 'Masa 17 parçalı ödeme (200₺ Nakit + 260₺ Kart)'
    });

    const receipt = resKasaClose.json && resKasaClose.json.data && resKasaClose.json.data.receipt;
    assert(
      resKasaClose.statusCode === 200 && receipt && receipt.receiptNumber && receipt.splitDetails && receipt.splitDetails.cash === 200 && receipt.splitDetails.card === 260,
      '12. Parçalı Ödeme (Split Bill) Tahsilatı & 80mm Termal Fiş Üretimi',
      `Fiş No: ${receipt ? receipt.receiptNumber : 'Yok'}, Nakit: 200₺, Kart: 260₺, Toplam: 460₺`
    );

    // 2.13 Kasa kapandıktan sonra masa 'idle' (boş) ve 0₺ olmalı, hesap çağrısı otomatik temizlenmeli
    const resKasaStateAfter = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/kasa/state',
      method: 'GET',
      headers: { 'x-staff-pin': STAFF_PIN }
    });

    const kasaTableAfter = resKasaStateAfter.json.data.tables.find(t => t.tableId === '17');
    const hasRemainingBillCall = resKasaStateAfter.json.data.notifications.some(n => n.table.includes('17'));
    assert(
      kasaTableAfter && kasaTableAfter.status === 'idle' && !hasRemainingBillCall,
      '13. Kasa Kapanış Sonrası Masa Sıfırlanması & Bildirim Temizliği',
      `Masa Statüsü: ${kasaTableAfter ? kasaTableAfter.status : 'Yok'}, Kalan Hesap Çağrısı: ${hasRemainingBillCall ? 'Var (HATA)' : 'Yok (TEMİZLENDİ)'}`
    );

    // 2.14 Admin Paneli Finansal Rapor & CSV İndirme Testi
    // Admin login
    const resLogin = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/login',
      method: 'POST'
    }, { password: 'admin' });

    const adminToken = resLogin.json && resLogin.json.token;

    const resAdminStats = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/admin/dashboard-stats',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert(
      resAdminStats.statusCode === 200 && resAdminStats.json.data.dailySummary,
      '14. Admin Paneli Canlı Ciro ve Finansal Dashboard API',
      `Günlük Ciro: ${resAdminStats.json.data.dailySummary.totalRevenue}₺, Kapanan Sipariş: ${resAdminStats.json.data.dailySummary.totalOrders}`
    );

    // 2.15 Admin CSV Export
    const resCsv = await request({
      hostname: '127.0.0.1',
      port: 3006,
      path: '/api/admin/reports/export-csv',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert(
      resCsv.statusCode === 200 && resCsv.headers['content-type'].includes('csv') && resCsv.body.includes('Fiş No'),
      '15. Muhasebe CSV/Excel Dışa Aktarma (Export CSV)',
      `CSV Dosya Başlığı: ${resCsv.headers['content-disposition']}`
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
