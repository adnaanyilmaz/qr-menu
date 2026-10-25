const fs = require('fs');

const html = fs.readFileSync('code.html', 'utf8');

// Categories
const catMatches = [...html.matchAll(/data-cat="([^"]+)"[^>]*>([^<]+)<\/button>/g)];
const categories = catMatches.map(m => ({ id: m[1], name: m[2].trim() })).filter(c => c.id !== 'all');

// Featured items
const featuredRegex = /<div class="featured-card[^"]*"[^>]*onclick="openModalFromData\(([^)]+)\)"/g;
let fMatch;
const featured = [];
while ((fMatch = featuredRegex.exec(html)) !== null) {
  featured.push(fMatch[1]);
}

// Product items
const prodRegex = /<div class="product-item[^"]*"([^>]*)>/g;
let pMatch;
const products = [];

while ((pMatch = prodRegex.exec(html)) !== null) {
  const attrs = pMatch[1];
  const getAttr = (name) => {
    const m = attrs.match(new RegExp(`data-${name}="([^"]*)"`));
    return m ? m[1] : '';
  };

  // Find parent section category
  const beforePos = pMatch.index;
  const lastSecIndex = html.lastIndexOf('<section class="menu-category-section"', beforePos);
  let categoryId = 'diger';
  if (lastSecIndex !== -1) {
    const secChunk = html.substring(lastSecIndex, beforePos);
    const catM = secChunk.match(/data-category="([^"]+)"/);
    if (catM) categoryId = catM[1];
  }

  // Check badge inside item HTML
  const nextItemPos = html.indexOf('<div class="product-item', pMatch.index + 1);
  const itemHtml = html.substring(pMatch.index, nextItemPos !== -1 ? nextItemPos : pMatch.index + 1500);
  const badgeMatch = itemHtml.match(/<span class="text-\[9\.5px\][^>]*>([^<]+)<\/span>/);
  const badge = badgeMatch ? badgeMatch[1].trim() : '';

  // Check if featured
  const pName = getAttr('name');
  const isFeatured = html.includes(`openModalFromData('${pName}'`);

  products.push({
    id: 'prod_' + (products.length + 1),
    name: pName,
    price: getAttr('price').replace('₺', '').trim(),
    currency: '₺',
    desc: getAttr('desc'),
    portion: getAttr('portion'),
    allergens: getAttr('allergens'),
    type: getAttr('type') || 'food',
    category: categoryId,
    badge: badge,
    featured: isFeatured,
    inStock: true,
    img: getAttr('img'),
    icon: getAttr('icon')
  });
}

const siteSettings = {
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
};

console.log('Categories count:', categories.length);
console.log('Products count:', products.length);

fs.writeFileSync('initial_data.json', JSON.stringify({ settings: siteSettings, categories, products }, null, 2), 'utf8');
console.log('Written to initial_data.json successfully!');

