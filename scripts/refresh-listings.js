/**
 * refresh-listings.js
 * Fetches fresh property data from Airtable and rewrites the
 * listings grid in index.html — keeping everything else untouched.
 *
 * FIELD MAP — update these if your Airtable column names differ:
 */

const FIELD = {
  propertyId:   'Property ID',
  notes:        'Notes',
  location:     'Just Location',
  images:       'Property Cards',
  price:        'Price',
  sqft:         'Sqft',
  land:         'Land',
  type:         'Type',
  status:       'Status',
};

const BASE_ID  = 'appQonnXgyO6xwj6n';
const TABLE_ID = 'tblmBsrMcsLSxTcja';
const TOKEN    = process.env.AIRTABLE_TOKEN;
const INDEX    = './index.html';

const fs = require('fs');

const TAG_CLASS = {
  'Available':          'tag-avail',
  'New Home':           'tag-new',
  'Used Home':          'tag-used',
  'Under construction': 'tag-uc',
};

const SVG_PIN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;

async function fetchAllRecords() {
  const records = [];
  let offset = null;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    url.searchParams.set('view', 'Grid view');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable API error ${res.status}: ${body}`);
    }
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  return records;
}

function buildCard(record) {
  const f = record.fields;
  const propId   = f[FIELD.propertyId] || record.id;
  const location = (f[FIELD.location]  || '').trim();
  const status   = (f[FIELD.status]    || 'Available').trim();
  const type     = (f[FIELD.type]      || 'House').trim();
  const notes    = (f[FIELD.notes]     || '').trim();
  const sqft     = f[FIELD.sqft]       || null;
  const land     = (f[FIELD.land]      || '').trim();

  let priceRaw = f[FIELD.price];
  let priceDisplay;
  if (!priceRaw || priceRaw === '' || priceRaw === '0') {
    priceDisplay = 'Price on Request';
  } else if (typeof priceRaw === 'number') {
    priceDisplay = `\u20b9${priceRaw} Lakhs`;
  } else {
    priceDisplay = priceRaw.startsWith('\u20b9') ? priceRaw : `\u20b9${priceRaw}`;
  }

  const images   = Array.isArray(f[FIELD.images]) ? f[FIELD.images] : [];
  const imgUrl   = images.length > 0 ? images[0].url : null;
  const altText  = `${type} for sale in ${location}, Kottayam, Kerala`;
  const tagClass = TAG_CLASS[status] || 'tag-avail';

  const imageBlock = imgUrl
    ? `<img src="${imgUrl}" alt="${altText}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`
    : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#1a2e1a,#0d3320);display:flex;align-items:center;justify-content:center;"><span style="font-size:3rem;opacity:.4;">\ud83c\udfe0</span></div>`;

  const statsItems = [];
  if (sqft)  statsItems.push(`<span>\ud83d\udcd0 ${Number(sqft).toLocaleString('en-IN')} sq.ft</span>`);
  if (land)  statsItems.push(`<span>\ud83d\udccf ${land}</span>`);
  const statsRow = statsItems.length ? `<div class="cs">${statsItems.join('')}</div>` : '';

  const notesTrunc = notes.length > 200 ? notes.slice(0, 200) + '...' : notes;
  const waMsg = encodeURIComponent(`Hi Bennyz Realty! I'm interested in property ${propId} at ${location}`);

  return `<article class="lc" data-location="${location}" data-tag="${status}" id="l-${propId}">
<div class="ci">${imageBlock}<span class="ct ${tagClass}">${status}</span><span class="cty">${type}</span></div>
<div class="cb"><div class="cp">${priceDisplay}</div>
<h3 class="cl">${SVG_PIN} ${location}</h3>
${statsRow}
<p class="cn">${notesTrunc}</p>
<a href="https://wa.me/916282574974?text=${waMsg}" target="_blank" rel="noopener" class="cc">\ud83d\udcac Enquire on WhatsApp</a></div></article>`;
}

function buildLocationFilters(records) {
  const locations = [...new Set(
    records.map(r => (r.fields[FIELD.location] || '').trim()).filter(Boolean)
  )].sort();
  return [
    `<button class="fb active" data-f="all">All Locations</button>`,
    ...locations.map(loc => `<button class="fb" data-f="${loc}">${loc}</button>`),
  ].join('');
}

async function main() {
  if (!TOKEN) throw new Error('AIRTABLE_TOKEN env var is not set');
  console.log('Fetching records from Airtable...');
  const records = await fetchAllRecords();
  console.log(`  -> ${records.length} records fetched`);

  const cardsHtml = records.map(buildCard).join('\n');
  const locationBtns = buildLocationFilters(records);

  let html = fs.readFileSync(INDEX, 'utf8');

  html = html.replace(
    /(<div class="lg" id="grid">)([\s\S]*?)(<\/div>\s*<div class="nr")/,
    `$1\n${cardsHtml}\n$3`
  );

  html = html.replace(
    /(<p class="lco" id="lc">Showing <strong>)\d+(<\/strong> properties<\/p>)/,
    `$1${records.length}$2`
  );

  html = html.replace(
    /(<div class="fs" id="lf">)([\s\S]*?)(<\/div>)/,
    `$1${locationBtns}$3`
  );

  fs.writeFileSync(INDEX, html, 'utf8');
  console.log(`Done: index.html updated with ${records.length} listings`);
}

main().catch(err => { console.error(err); process.exit(1); });
