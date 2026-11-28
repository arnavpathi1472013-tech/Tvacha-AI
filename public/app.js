const $ = s => document.querySelector(s), OK = ['image/jpeg', 'image/png', 'image/webp'];
let imgB64 = null;
let selectedFile = null;
let establishedRegistryPromise = null;
let quota = null;

const show = id => { document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== id); scrollTo(0, 0); };
document.addEventListener('click', e => { const t = e.target.closest('[data-go]'); if (t && !t.disabled) show(t.dataset.go); });
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined && text !== null && text !== '') n.textContent = text; if (cls) n.className = cls; return n; };
const sync = () => { $('#status').hidden = navigator.onLine; };
addEventListener('online', () => { sync(); if (!$('#offline').hidden) show('home'); });
addEventListener('offline', sync);
sync();

// --- Established Results: exact-file reference matching only ---
async function sha256(blob) {
  if (!globalThis.crypto?.subtle) throw new Error('secure_crypto_unavailable');
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function loadEstablishedRegistry() {
  if (!establishedRegistryPromise) {
    establishedRegistryPromise = (async () => {
      const response = await fetch('/established-results/index.json');
      if (!response.ok) throw new Error('registry_unavailable');
      const registry = await response.json();
      if (registry.version !== 1 || !Array.isArray(registry.samples)) throw new Error('invalid_registry');
      return registry.samples.filter(s =>
        s && typeof s.id === 'string' &&
        typeof s.image === 'string' &&
        typeof s.result === 'string' &&
        !s.image.startsWith('/') && !s.result.startsWith('/') &&
        !s.image.includes('..') && !s.result.includes('..')
      );
    })().catch(error => {
      establishedRegistryPromise = null;
      throw error;
    });
  }
  return establishedRegistryPromise;
}

async function matchEstablishedResult(file) {
  if (!file) return null;
  const uploadedHash = await sha256(file);
  const samples = await loadEstablishedRegistry();

  for (const sample of samples) {
    const imageURL = new URL(`/established-results/${sample.image}`, location.origin);
    const resultURL = new URL(`/established-results/${sample.result}`, location.origin);
    if (imageURL.origin !== location.origin || resultURL.origin !== location.origin) continue;

    const imageResponse = await fetch(imageURL.href);
    if (!imageResponse.ok) continue;
    const referenceImage = await imageResponse.blob();
    if (!OK.includes(referenceImage.type)) continue;

    if (await sha256(referenceImage) !== uploadedHash) continue;

    const resultResponse = await fetch(resultURL.href);
    if (!resultResponse.ok) continue;
    const result = await resultResponse.json();
    if (result.id !== sample.id || typeof result.title !== 'string' ||
        typeof result.explanation !== 'string' || typeof result.disclaimer !== 'string') continue;

    return result;
  }
  return null;
}

function pill(text, cls, note) {
  const w = el('div', '', 'pill-row');
  w.append(el('span', text, 'pill ' + cls));
  if (note) w.append(el('p', note, 'pill-note'));
  return w;
}
function renderEstablishedResult(r) {
  const b = $('#reportBody');
  b.replaceChildren();
  b.append(pill('Established reference match', 'pill-green',
    'This is dermatologist-reviewed information attached to an identical reference image file. It is not a diagnosis of the uploaded person.'));
  b.append(sec('Reference information', el('p', r.title)));
  if (r.referenceCondition) b.append(sec('Condition described in the reference', el('p', r.referenceCondition)));
  if (Array.isArray(r.observations) && r.observations.length)
    b.append(sec('Reference-image observations', list(r.observations)));
  b.append(sec('Dermatologist-reviewed explanation', el('p', r.explanation)));
  if (r.medicalAttention) b.append(sec('Medical attention', el('p', r.medicalAttention)));
  b.append(sec('Important limitation', el('p', r.disclaimer)));
  if (r.review?.reviewerRole || r.review?.reviewDate || r.review?.source) {
    const details = [];
    if (r.review.reviewerRole) details.push('Reviewer: ' + r.review.reviewerRole);
    if (r.review.reviewDate) details.push('Review date: ' + r.review.reviewDate);
    if (r.review.source) details.push('Source: ' + r.review.source);
    b.append(sec('Review details', list(details)));
  }
}

// --- Daily usage counter (server-enforced; this only displays it) ---
const fmtWait = ms => { const m = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(m / 60); return h ? h + ' h ' + (m % 60) + ' min' : m + ' min'; };
function renderQuota() {
  const n = $('#quotaLine');
  if (!n) return;
  if (!quota || quota.enabled === false || typeof quota.remaining !== 'number') { n.hidden = true; return; }
  n.hidden = false;
  n.classList.toggle('out', quota.remaining === 0);
  n.textContent = quota.remaining > 0
    ? quota.remaining + ' of ' + quota.limit + ' free AI analyses left today'
    : 'No free analyses left. Resets in ' + fmtWait(quota.resetAt - Date.now()) + '.';
}
async function refreshQuota() {
  try {
    const r = await fetch('/api/quota', { cache: 'no-store' });
    if (r.ok) { quota = await r.json(); renderQuota(); }
  } catch { /* counter simply stays hidden */ }
}
const quotaSpent = () => quota && quota.remaining === 0 && quota.resetAt && quota.resetAt > Date.now();
function renderLimit() {
  const b = $('#reportBody');
  b.replaceChildren();
  const c = el('div', '', 'card quota-card');
  const wait = quota && quota.resetAt ? fmtWait(quota.resetAt - Date.now()) : 'a while';
  const up = el('button', 'Upgrade'); up.dataset.go = 'plans';
  const lib = el('button', 'Educational library', 'alt'); lib.dataset.go = 'library';
  const row = el('div', '', 'row'); row.append(up, lib);
  c.append(
    el('h2', 'Daily limit reached'),
    el('p', "You've used all " + (quota && quota.limit ? quota.limit + ' ' : '') + 'free AI analyses for today. Come back in ' + wait + ', or upgrade for more.'),
    el('p', 'If you have urgent symptoms, do not wait: seek medical care now (India: 112).', 'hint'),
    row
  );
  b.append(c);
}
document.addEventListener('click', e => { if (e.target.closest('[data-plan]')) $('#planMsg').textContent = "Subscriptions aren't open yet. Thank you for your interest!"; });
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshQuota(); });
setInterval(() => { if (quota && quota.remaining === 0 && quota.resetAt && Date.now() >= quota.resetAt) refreshQuota(); else renderQuota(); }, 30000);
refreshQuota();

// --- Step 1: image ---
$('#bCam').onclick = () => $('#cam').click();
$('#bGal').onclick = () => $('#gal').click();
$('#cam').onchange = $('#gal').onchange = e => handleFile(e.target.files[0]);

async function handleFile(f) {
  if (!f) return;
  const msg = $('#imgMsg');
  msg.textContent = '';
  if (!OK.includes(f.type)) return msg.textContent = 'Unsupported file. Use JPG, PNG or WebP.';
  if (f.size > 15e6) return msg.textContent = 'File too large (max 15 MB).';

  try {
    const bmp = await createImageBitmap(f);
    if (Math.min(bmp.width, bmp.height) < 300) return msg.textContent = 'Image too small; move closer and retake.';
    const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = bmp.width * k;
    c.height = bmp.height * k;
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) { s += d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; n++; }
    const avg = s / n;
    if (avg < 40) msg.textContent = 'Warning: image looks very dark.';
    else if (avg > 225) msg.textContent = 'Warning: image looks overexposed.';
    const url = c.toDataURL('image/jpeg', .85);
    imgB64 = url.split(',')[1];
    selectedFile = f;
    $('#preview').src = url;
    $('#preview').hidden = $('#bRemove').hidden = false;
    $('#bNext').disabled = false;
  } catch {
    selectedFile = null;
    msg.textContent = 'Could not read this image. Try another.';
  }
}

$('#bRemove').onclick = () => {
  imgB64 = null;
  selectedFile = null;
  $('#preview').hidden = $('#bRemove').hidden = true;
  $('#bNext').disabled = true;
  $('#cam').value = $('#gal').value = '';
};

// --- Step 2: context + safety ---
const URGENT = ['Difficulty breathing', 'Swelling of face, lips, tongue or throat', 'Rapidly worsening rash with fever', 'Severe or unbearable pain'];
URGENT.forEach(t => {
  const l = el('label', '', 'chk'), i = el('input');
  i.type = 'checkbox';
  i.value = t;
  l.append(i, ' ' + t);
  $('#urgent').append(l);
});
$('#consent').onchange = e => $('#bGo').disabled = !e.target.checked;
$('#bGo').onclick = async () => {
  const ctx = {};
  ['sensation', 'duration', 'change', 'treatment', 'notes'].forEach(k => {
    const v = $('#' + k).value.trim();
    if (v) ctx[k] = v;
  });
  const ticked = [...document.querySelectorAll('#urgent input:checked')].map(i => i.value);
  const hits = Safety.check(ctx.notes, ticked);
  if (hits.length) return emergency(hits, ctx);
  analyse(ctx);
};

function emergency(hits, ctx) {
  const b = $('#reportBody');
  b.replaceChildren();
  const c = el('div', '', 'card banner emerg');
  c.append(
    el('h2', 'Seek urgent medical care'),
    el('p', 'You reported: ' + hits.join('; ') + '. Contact local emergency services or go to the nearest emergency department now (India: 112).')
  );
  const go = el('button', 'Continue to routine analysis anyway');
  go.className = 'alt';
  go.onclick = () => analyse(ctx);
  c.append(go);
  b.append(c);
  show('report');
}

// --- Step 3: analysis ---
async function analyse(ctx) {
  show('loading');
  try {
    if (selectedFile) {
      try {
        const established = await matchEstablishedResult(selectedFile);
        if (established) {
          renderEstablishedResult(established);
          show('report');
          return;
        }
      } catch (error) {
        console.warn('Established Results lookup unavailable; continuing to normal analysis.', error);
      }
    }

    if (quotaSpent()) { renderLimit(); show('report'); return; }

    if (!navigator.onLine) return show('offline');

    const stages = ['Examining image quality…', 'Analysing visible characteristics…', 'Considering supplied symptoms…', 'Preparing the assessment…'];
    let i = 0;
    const t = setInterval(() => $('#stage').textContent = stages[++i % 4], 4000);
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 50000);
    try {
      const r = await fetch('/api/analyze', {
        method: 'POST',
        signal: ac.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: imgB64, context: ctx, consent: true })
      });
      if (r.status === 429) {
        const e = await r.json().catch(() => ({}));
        if (e.error === 'quota_exceeded') { quota = { enabled: true, limit: e.limit, remaining: 0, resetAt: e.resetAt }; renderQuota(); renderLimit(); return; }
        if (e.error === 'rate_limited') { $('#reportBody').replaceChildren(el('div', 'Too many requests in a short time. Please wait a minute and try again.', 'card banner')); return; }
        throw new Error();
      }
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (data.quota) { quota = { enabled: true, ...data.quota }; renderQuota(); }
      if (!data.report?.overview?.summary || !Array.isArray(data.report.possibilities)) throw new Error();
      render(data);
    } catch {
      $('#reportBody').replaceChildren(el('div', 'Analysis failed or timed out. Check your connection and try again.', 'card banner'));
    } finally {
      clearInterval(t);
      clearTimeout(to);
      show('report');
    }
  } catch {
    $('#reportBody').replaceChildren(el('div', 'Could not complete the assessment. Please try again.', 'card banner'));
    show('report');
  }
}

const list = a => {
  const u = el('ul');
  (a || []).forEach(x => u.append(el('li', x)));
  return u;
};
function sec(title, ...kids) {
  const c = el('div', '', 'card');
  c.append(el('h3', title), ...kids);
  return c;
}
function render({ mode, report: r }) {
  const b = $('#reportBody');
  b.replaceChildren();
  if (mode === 'demo') b.append(el('div', 'DEMONSTRATION MODE: sample data, NOT real AI analysis of your photo.', 'banner emerg'));
  b.append(pill('AI-generated observations', 'pill-magenta', 'Not a diagnosis.'));
  b.append(sec('Assessment overview', el('p', r.overview.summary), list(r.overview.visible_features)));
  b.append(sec('Image observations', list(Object.entries(r.observations || {}).map(([k, v]) => k + ': ' + v))));
  b.append(sec('Possible conditions', ...r.possibilities.flatMap(p => [
    el('h4', p.name), el('p', p.explanation),
    el('p', 'Supporting: ' + (p.supporting || []).join('; ')),
    el('p', 'Distinguishing: ' + (p.distinguishing || []).join('; ')),
    el('p', 'Missing info: ' + (p.missing || []).join('; '))
  ])));
  b.append(sec('Contextual findings', el('p', r.context_findings || 'None provided.')));
  b.append(sec('Recommended care', list(r.care?.guidance), el('h4', 'May aggravate'), list(r.care?.avoid), el('h4', 'Next steps'), list(r.care?.next_steps)));
  const lv = { routine: 'Routine consultation', prompt: 'Prompt medical assessment', emergency: 'Emergency medical attention' }[r.attention?.level];
  const m = sec('Medical attention', el('p', lv + ' — ' + (r.attention?.reason || '')));
  if (r.attention?.level === 'emergency') m.classList.add('emerg');
  b.append(m);
  b.append(sec('Important considerations', list(r.considerations), el('p', 'Photograph-based assessment has real limits; a clinician can examine and test.')));
}

// --- Library (cached, works offline) ---
(async () => {
  try {
    await Safety.load();
    const d = await (await fetch('/data/conditions.json')).json();
    d.conditions.forEach(c => $('#libBody').append(sec(c.name, el('p', c.description), el('p', 'Looks like: ' + c.visual), el('p', 'Distinguishing: ' + c.distinguishing), el('p', 'Warning signs: ' + c.warning_signs), el('small', 'Review status: ' + c.review_status))));
    const g = await (await fetch('/data/skincare-guidelines.json')).json();
    g.guidelines.forEach(x => $('#libBody').append(sec(x.title, list(x.points), el('small', 'Review status: ' + x.review_status))));
    Safety.signs.emergency.forEach(x => $('#offlineSigns').append(el('li', x.label)));
  } catch {
    $('#libBody').textContent = 'Library unavailable.';
  }
})();

// --- Splash slideshow: shows whichever of these files exist, one by one ---
(() => {
  const bg = $('#splashBg'), slides = [];
  let i = 0;
  ['splash1.jpg', 'splash2.jpg', 'splash3.jpg', 'splash4.jpg', 'splash5.JPG'].forEach(name => {
    const im = new Image();
    im.className = 'slide'; im.alt = ''; im.decoding = 'async';
    im.onload = () => { bg.append(im); slides.push(im); if (slides.length === 1) im.classList.add('on'); };
    im.src = '/images/' + name;
  });
  setInterval(() => {
    if (slides.length < 2 || $('#splash').hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    slides[i].classList.remove('on');
    i = (i + 1) % slides.length;
    slides[i].classList.add('on');
  }, 5500);
})();

// --- Admin: reset my counter (open the site with #admin on the end of the address) ---
$('#adminReset').onclick = async () => {
  const msg = $('#adminMsg');
  msg.textContent = 'Resetting…';
  try {
    const r = await fetch('/api/admin/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: $('#adminPw').value }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      quota = { enabled: true, limit: d.limit, remaining: d.remaining, resetAt: d.resetAt };
      renderQuota();
      $('#adminPw').value = '';
      msg.textContent = 'Done. ' + d.remaining + ' of ' + d.limit + ' analyses available.';
    } else {
      msg.textContent = { 403: 'Wrong password.', 404: 'Admin reset is not enabled on this server.', 429: 'Too many attempts. Wait a minute.' }[r.status] || 'Could not reset.';
    }
  } catch { msg.textContent = 'Network error.'; }
};
const routeHash = () => { if (location.hash === '#admin') show('admin'); };
addEventListener('hashchange', routeHash);
routeHash();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
