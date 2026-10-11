/* M///Division Lighting — shared site logic (cart, checkout, fitment, reviews) */

// ---- Launch pricing ----
const LAUNCH_START = new Date("2026-10-12T12:00:00-07:00").getTime(); // Monday 12:00pm Pacific
const LAUNCH_END = new Date("2026-10-19T12:00:00-07:00").getTime();   // 7 days later
function launchActive(){ const now = Date.now(); return now >= LAUNCH_START && now < LAUNCH_END; }
const PRICES = launchActive() ? { '2pc': 29.99, '4pc': 49.99 } : { '2pc': 39.99, '4pc': 59.99 };
const WAS_PRICES = { '2pc': 39.99, '4pc': 59.99 };
const KIT_LABELS = { '2pc': '2-Piece Kit (Front Doors)', '4pc': '4-Piece Kit (All Doors)' };

// ---- Badge catalog: single source of truth for shop / badges / cart previews ----
const BADGES = [
  { key:'M2 (F87)', name:'M2', chassis:'F87', group:'F-Chassis', img:'images/badges/m2-f87.jpg' },
  { key:'M2 Competition (F87)', name:'M2 Competition', chassis:'F87', group:'F-Chassis', img:'images/badges/m2-competition-f87.jpg' },
  { key:'M3 (F80)', name:'M3', chassis:'F80', group:'F-Chassis', img:'images/badges/m3-f80.jpg' },
  { key:'M3 Competition (F80)', name:'M3 Competition', chassis:'F80', group:'F-Chassis', img:'images/badges/m3-competition-f80.jpg' },
  { key:'M4 (F82)', name:'M4', chassis:'F82 · F83', group:'F-Chassis', img:'images/badges/m4-f82.jpg' },
  { key:'M4 Competition (F82)', name:'M4 Competition', chassis:'F82 · F83', group:'F-Chassis', img:'images/badges/m4-competition-f82.jpg' },
  { key:'M5 Competition (F90)', name:'M5 Competition', chassis:'F90', group:'F-Chassis', img:'images/badges/m5-competition-f90.jpg' },
  { key:'M8 Competition (F92)', name:'M8 Competition', chassis:'F92 · F93', group:'F-Chassis', img:'images/badges/m8-competition-f92.jpg' },
  { key:'M2 (G87)', name:'M2', chassis:'G87', group:'G-Chassis', img:'images/badges/m2-f87.jpg' },
  { key:'M3 Competition (G80)', name:'M3 Competition', chassis:'G80', group:'G-Chassis', img:'images/badges/m3-competition-f80.jpg' },
  { key:'M4 Competition (G82)', name:'M4 Competition', chassis:'G82 · G83', group:'G-Chassis', img:'images/badges/m4-competition-f82.jpg' },
  { key:'M Performance', name:'M Performance', chassis:'For non-M models', group:'Universal', img:'images/badges/m-performance.jpg' },
  { key:'M Performance (wordmark)', name:'M Performance Wordmark', chassis:'Wordmark version', group:'Universal', img:'images/badges/m-performance-wordmark.jpg' },
  { key:'M Performance (colorwash)', name:'M Performance Colorwash', chassis:'Full-colour sweep', group:'Universal', img:'images/badges/m-performance-colorwash.jpg' },
];
function badgeByKey(k){ return BADGES.find(b => b.key === k) || BADGES[0]; }

// ---- Fitment data ----
const FITMENT = {
  yes: [
    ['2 Series','F22/F23/F87/G42/G87'],['3 Series','E90/E92/F30/F80/G20/G80'],
    ['4 Series','F32/F82/G22/G82'],['5 Series','F10/F90/G30'],['8 Series','F92'],
    ['X1','E84/F48/U11'],['X2','F39/U10'],['X3','E83/F25/G01'],['X4','F26/G02'],
    ['X5','E70/F15/G05'],['X6','E71/E72/F16/G06'],['X7','G07'],
  ],
  no: [['1 Series','—'],['6 Series','—'],['7 Series','—'],['Z4','—'],['i4 / iX (electric)','—']],
};

// ---- Fitment checker: dropdown-driven, instant result (no typing required) ----
function selectFitment(selectEl, targetId){
  const resultEl = document.getElementById(targetId || 'fitmentResult');
  if (!resultEl) return;
  const status = selectEl.value;
  const opt = selectEl.options[selectEl.selectedIndex];
  const modelName = opt.text;
  const codes = opt.dataset.codes || '';
  if (!status){ resultEl.className = 'fitment-result'; resultEl.innerHTML = ''; return; }
  if (status === 'yes'){
    resultEl.className = 'fitment-result yes';
    resultEl.innerHTML = `<b>Compatible &middot; ${modelName}${codes ? ' ('+codes+')' : ''}</b><br>Uses the factory OEM 2-pin door puddle-light harness, so every kit is a direct plug-and-play fit.`;
  } else {
    resultEl.className = 'fitment-result no';
    resultEl.innerHTML = `<b>Not compatible yet &middot; ${modelName}</b><br>This model uses a different factory harness. Message us &mdash; if enough people ask, we'll look at adding it.`;
  }
}

// ---- Cart (localStorage-backed, shared across every page) ----
let cart = [];
try { const saved = localStorage.getItem('mdl_cart'); if (saved) cart = JSON.parse(saved); } catch(e){}
function saveCart(){ try { localStorage.setItem('mdl_cart', JSON.stringify(cart)); } catch(e){} }

function addToCart(kitKey, badgeKey){
  const existing = cart.find(i => i.key === kitKey && i.badge === badgeKey);
  if (existing) existing.qty += 1;
  else cart.push({ key: kitKey, badge: badgeKey, qty: 1 });
  saveCart(); renderCartEverywhere();
  openCart();
  showToast('Added to cart');
}
function changeQty(idx, delta){
  if (!cart[idx]) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  saveCart(); renderCartEverywhere();
}
function removeItem(idx){ cart.splice(idx,1); saveCart(); renderCartEverywhere(); }
function cartCount(){ return cart.reduce((n,i) => n + i.qty, 0); }
function cartSubtotal(){ return cart.reduce((s,i) => s + (PRICES[i.key]||0) * i.qty, 0); }

function renderCartEverywhere(){
  document.querySelectorAll('.cart-count').forEach(el => el.textContent = cartCount());
  const itemsEl = document.getElementById('cartItems');
  const footEl = document.getElementById('cartFoot');
  if (!itemsEl) return;
  if (cart.length === 0){
    itemsEl.innerHTML = '<div class="cart-empty">Your cart is empty.</div>';
    if (footEl) footEl.innerHTML = '';
    return;
  }
  itemsEl.innerHTML = cart.map((item, idx) => {
    const b = badgeByKey(item.badge);
    const price = (PRICES[item.key] || 0) * item.qty;
    return `<div class="cart-item">
      <img src="${b.img}" alt="${b.name}">
      <div class="ci-info">
        <b>${KIT_LABELS[item.key] || item.key}</b>
        <div class="meta">${b.name}</div>
        <div class="qty-ctrl">
          <button onclick="changeQty(${idx},-1)">&minus;</button>
          <span>${item.qty}</span>
          <button onclick="changeQty(${idx},1)">&plus;</button>
          <button onclick="removeItem(${idx})" style="margin-left:8px;color:var(--text-faint);border:none;background:none;cursor:pointer;">Remove</button>
        </div>
      </div>
      <div style="font-weight:700;font-size:14px;">$${price.toFixed(2)}</div>
    </div>`;
  }).join('');
  if (footEl){
    footEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:14px;font-size:15px;">
        <span style="color:var(--text-dim);">Subtotal</span><b>$${cartSubtotal().toFixed(2)}</b>
      </div>
      <button class="btn btn-primary btn-block" onclick="openCheckout()">Checkout</button>
      <div style="text-align:center;margin-top:10px;font-size:11.5px;color:var(--text-faint);">All prices in USD</div>`;
  }
}

function openCart(){
  document.getElementById('cartOverlay')?.classList.add('open');
  document.getElementById('cartDrawer')?.classList.add('open');
}
function closeCart(){
  document.getElementById('cartOverlay')?.classList.remove('open');
  document.getElementById('cartDrawer')?.classList.remove('open');
}
function closeAllModals(){
  closeCart();
  document.getElementById('checkoutOverlay')?.classList.remove('open');
}

// ---- Checkout ----
const BACKEND_URL = '/api/create-checkout-session';
const SPOTS_URL = '/api/install-spots';
const REVIEWS_URL = '/api/reviews';
const NA_COUNTRIES = ['United States','Canada','Mexico'];
const COUNTRY_CODES = { 'United States':'US','Canada':'CA','Mexico':'MX','United Kingdom':'GB','Germany':'DE','France':'FR','Australia':'AU','Other':'XX' };
const INTL_RATES = { 'United Kingdom':12, 'Germany':14, 'Australia':18, 'France':14, 'Other':20 };
window._shipData = { pickup:false, freeInstallOptIn:false, country:'United States' };

function openCheckout(){
  if (cart.length === 0) return;
  const overlay = document.getElementById('checkoutOverlay');
  if (!overlay) return;
  renderCheckoutStep1();
  overlay.classList.add('open');
}

async function refreshInstallSpots(){
  const el = document.getElementById('ckInstallSpots');
  if (!el) return;
  try {
    const res = await fetch(SPOTS_URL);
    const data = await res.json();
    const left = Math.max(0, 10 - (data.claimed || 0));
    el.textContent = `(${left} of 10 spots left)`;
    const offer = document.getElementById('installOffer');
    const full = document.getElementById('installFull');
    if (left <= 0){ if (offer) offer.style.display='none'; if (full) full.style.display='block'; }
  } catch(e){ el.textContent = ''; }
}

function togglePickup(){
  const pickup = document.getElementById('ck-pickup').checked;
  window._shipData.pickup = pickup;
  document.getElementById('shipFields').style.display = pickup ? 'none' : 'block';
  document.getElementById('installOffer').style.display = pickup ? 'block' : 'none';
  if (pickup) refreshInstallSpots();
  updateShipEstimate();
}

function updateShipEstimate(){
  const countrySel = document.getElementById('ck-country');
  const country = countrySel ? countrySel.value : 'United States';
  window._shipData.country = country;
  const pickup = window._shipData.pickup;
  const sub = cartSubtotal();
  let ship = 0;
  if (!pickup){ ship = NA_COUNTRIES.includes(country) ? 0 : (INTL_RATES[country] || 20); }
  const box = document.getElementById('shipEstimateBox');
  if (box){
    box.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:14px;color:var(--text-dim);margin-top:6px;">
      <span>${pickup ? 'Local pickup (Vancouver, BC)' : 'Shipping ('+country+')'}</span>
      <span>${ship===0?'FREE':'$'+ship.toFixed(2)}</span></div>`;
  }
}

function renderCheckoutStep1(){
  const modal = document.getElementById('checkoutModal');
  modal.innerHTML = `
    <button onclick="closeAllModals()" style="float:right;background:none;border:none;color:var(--text-dim);font-size:22px;cursor:pointer;">&times;</button>
    <h3 style="margin-bottom:4px;">Checkout</h3>
    <div style="color:var(--text-faint);font-size:13px;margin-bottom:20px;">Step 1 of 2 &middot; Shipping details &middot; All prices in USD</div>
    <div class="field"><label>Full Name</label><input id="ck-name" placeholder="Jordan Smith"></div>
    <div class="field"><label>Email</label><input id="ck-email" type="email" placeholder="you@email.com"></div>
    <div class="field"><label>Phone</label><input id="ck-phone" placeholder="(555) 555-5555"></div>
    <div class="field" style="display:flex;align-items:center;gap:10px;">
      <input type="checkbox" id="ck-pickup" style="width:auto;" onchange="togglePickup()">
      <label style="margin:0;">I'll pick this up locally in Vancouver, BC instead of shipping</label>
    </div>
    <div id="shipFields">
      <div class="field"><label>Street Address</label><input id="ck-address" placeholder="123 Autobahn Ave"></div>
      <div class="field"><label>City</label><input id="ck-city" placeholder="City"></div>
      <div class="field"><label>Postal Code</label><input id="ck-zip" placeholder="ZIP / Postal"></div>
      <div class="field">
        <label>Country</label>
        <select id="ck-country" onchange="updateShipEstimate()">
          <option>United States</option><option>Canada</option><option>Mexico</option>
          <option>United Kingdom</option><option>Germany</option><option>France</option><option>Australia</option><option>Other</option>
        </select>
      </div>
    </div>
    <div id="installOffer" style="display:none;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;margin-bottom:16px;">
      <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;">
        <input type="checkbox" id="ck-install" style="width:auto;margin-top:2px;" onchange="window._shipData.freeInstallOptIn=this.checked">
        <span style="font-size:13px;color:var(--text-dim);"><b style="color:var(--text);">Free install for our first 10 customers</b> <span id="ckInstallSpots"></span>. We'll film a short clip for our page and email you to set a time and meeting spot.</span>
      </label>
    </div>
    <div id="installFull" style="display:none;font-size:13px;color:var(--text-faint);margin-bottom:16px;">All 10 free install spots are taken — you can still pick up locally, just without the free install.</div>
    <div id="shipEstimateBox"></div>
    <button class="btn btn-primary btn-block" style="margin-top:18px;" onclick="goToPayment()">Continue to Payment</button>
  `;
  updateShipEstimate();
}

function goToPayment(){
  window._shipData.name = document.getElementById('ck-name').value;
  window._shipData.email = document.getElementById('ck-email').value;
  window._shipData.phone = document.getElementById('ck-phone').value;
  if (!window._shipData.pickup){
    window._shipData.address = document.getElementById('ck-address').value;
    window._shipData.city = document.getElementById('ck-city').value;
    window._shipData.zip = document.getElementById('ck-zip').value;
  }
  renderCheckoutStep2();
}

function renderCheckoutStep2(){
  const modal = document.getElementById('checkoutModal');
  const sub = cartSubtotal();
  const pickup = window._shipData.pickup;
  const country = window._shipData.country || 'United States';
  const ship = pickup ? 0 : (NA_COUNTRIES.includes(country) ? 0 : (INTL_RATES[country] || 20));
  const itemsHtml = cart.map(i => `<div style="display:flex;justify-content:space-between;font-size:13.5px;color:var(--text-dim);margin-bottom:6px;">
      <span>${KIT_LABELS[i.key]||i.key} &times; ${i.qty} &mdash; ${badgeByKey(i.badge).name}</span>
      <span>$${((PRICES[i.key]||0)*i.qty).toFixed(2)}</span></div>`).join('');
  modal.innerHTML = `
    <button onclick="closeAllModals()" style="float:right;background:none;border:none;color:var(--text-dim);font-size:22px;cursor:pointer;">&times;</button>
    <h3 style="margin-bottom:4px;">Review &amp; Pay</h3>
    <div style="color:var(--text-faint);font-size:13px;margin-bottom:20px;">Step 2 of 2 &middot; All prices in USD</div>
    ${itemsHtml}
    <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:10px;">
      <span>${pickup ? 'Local Pickup (Vancouver, BC)' : 'Shipping to '+country}</span><span>${ship===0?'FREE':'$'+ship.toFixed(2)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;margin-top:14px;padding-top:14px;border-top:1px solid var(--border-soft);">
      <span>Total</span><span>$${(sub+ship).toFixed(2)}</span>
    </div>
    <div style="font-size:12px;color:var(--text-faint);margin:14px 0;">You'll pay through Stripe's secure checkout. Your card details never touch this site. Card &middot; Apple Pay &middot; Google Pay</div>
    <button class="btn btn-primary btn-block" id="payBtn" onclick="proceedToPayment()">Continue to Payment: $${(sub+ship).toFixed(2)}</button>
    <div style="text-align:center;margin-top:12px;"><button onclick="renderCheckoutStep1()" style="background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:13px;">&larr; Back to shipping</button></div>
    <div id="setupBanner" style="display:none;margin-top:14px;font-size:12.5px;color:var(--accent-red);"></div>
  `;
}

async function proceedToPayment(){
  const btn = document.getElementById('payBtn');
  const banner = document.getElementById('setupBanner');
  btn.disabled = true; btn.textContent = 'Redirecting to secure checkout…';
  banner.style.display = 'none';
  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        cart,
        country: COUNTRY_CODES[window._shipData.country] || 'XX',
        shipData: window._shipData,
      }),
    });
    const data = await res.json();
    if (data && data.url){ window.location.href = data.url; }
    else { throw new Error((data && data.error) || 'No checkout URL returned'); }
  } catch(err){
    btn.disabled = false;
    btn.textContent = 'Continue to Payment';
    banner.style.display = 'block';
    banner.textContent = "Couldn't reach checkout — please try again in a moment.";
  }
}

// ---- Fitment checker (fact table, not AI) ----
function checkFitment(query){
  const q = (query || '').trim().toLowerCase();
  const resultEl = document.getElementById('fitmentResult');
  if (!resultEl) return;
  if (!q){ resultEl.className = 'fitment-result'; resultEl.innerHTML=''; return; }
  const hit = FITMENT.yes.find(([model, codes]) => model.toLowerCase().includes(q) || codes.toLowerCase().includes(q));
  const miss = FITMENT.no.find(([model]) => model.toLowerCase().includes(q));
  if (hit){
    resultEl.className = 'fitment-result yes';
    resultEl.innerHTML = `<b>Compatible &middot; ${hit[0]} (${hit[1]})</b><br>Uses the factory OEM 2-pin door puddle-light harness, so every kit is a direct plug-and-play fit.`;
  } else if (miss){
    resultEl.className = 'fitment-result no';
    resultEl.innerHTML = `<b>Not compatible yet &middot; ${miss[0]}</b><br>This model uses a different factory harness. Message us — if enough people ask, we'll look at adding it.`;
  } else {
    resultEl.className = 'fitment-result no';
    resultEl.innerHTML = `<b>Let's double check</b><br>Message us your exact chassis code (e.g. F80, G20) and we'll confirm fitment before you order.`;
  }
}

// ---- Reviews ----
async function loadReviews(){
  const el = document.getElementById('reviewsList');
  if (!el) return;
  try {
    const res = await fetch(REVIEWS_URL);
    const data = await res.json();
    const reviews = (data && data.reviews) || [];
    if (reviews.length === 0){
      el.innerHTML = '<p style="color:var(--text-faint);">Real customer cars, real installs. Written reviews are on the way.</p>';
      return;
    }
    el.innerHTML = reviews.map(r => `<div class="step" style="margin-bottom:14px;">
      <b>${escHtml(r.name||'Verified buyer')}</b> &middot; <span style="color:var(--text-faint);">${escHtml(r.badge||'')}</span>
      <p style="margin-top:8px;">${escHtml(r.text||'')}</p></div>`).join('');
  } catch(e){
    el.innerHTML = '<p style="color:var(--text-faint);">Real customer cars, real installs. Written reviews are on the way.</p>';
  }
}
function escHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
async function submitReview(){
  const btn = document.getElementById('reviewSubmitBtn');
  const name = document.getElementById('rv-name')?.value.trim();
  const email = document.getElementById('rv-email')?.value.trim();
  const rating = document.getElementById('rv-rating')?.value;
  const badge = document.getElementById('rv-badge')?.value;
  const text = document.getElementById('rv-text')?.value.trim();
  const statusEl = document.getElementById('reviewStatus');
  if (!name || !email || !rating || !text){
    if (statusEl){ statusEl.textContent = 'Please fill in your name, order email, rating, and review.'; statusEl.style.color = 'var(--accent-red)'; }
    return;
  }
  btn.disabled = true; btn.textContent = 'Submitting…';
  try {
    const res = await fetch(REVIEWS_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name, orderEmail: email, rating, badge, text }),
    });
    if (!res.ok) throw new Error('failed');
    if (statusEl){ statusEl.textContent = "Thanks — your review is in for approval."; statusEl.style.color = 'var(--text-dim)'; }
    document.getElementById('rv-name').value = '';
    document.getElementById('rv-email').value = '';
    document.getElementById('rv-text').value = '';
  } catch(e){
    if (statusEl){ statusEl.textContent = "Couldn't submit right now — please try again shortly."; statusEl.style.color = 'var(--accent-red)'; }
  } finally {
    btn.disabled = false; btn.textContent = 'Submit Review';
  }
}

// ---- Install spots badge (shown on home / shop) ----
async function loadInstallSpotsBadge(){
  const el = document.getElementById('spotsLeft');
  if (!el) return;
  try {
    const res = await fetch(SPOTS_URL);
    const data = await res.json();
    el.textContent = Math.max(0, 10 - (data.claimed || 0));
  } catch(e){ el.textContent = '10'; }
}

// ---- FAQ accordion ----
function initFaq(){
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', () => item.classList.toggle('open'));
  });
}

// ---- Nav / mobile toggle ----
function initNav(){
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links){ toggle.addEventListener('click', () => links.classList.toggle('open')); }
  document.querySelectorAll('.cart-btn').forEach(btn => btn.addEventListener('click', openCart));
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);
  document.getElementById('checkoutOverlay')?.addEventListener('click', (e) => { if (e.target.id === 'checkoutOverlay') closeAllModals(); });
}

// ---- Toast ----
let toastTimer;
function showToast(msg){
  let t = document.getElementById('toast');
  if (!t){
    t = document.createElement('div');
    t.id = 'toast'; t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---- Scroll reveal (fade/slide up as sections enter view) ----
function initScrollReveal(){
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)){ els.forEach(el => el.classList.add('in-view')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('in-view'); });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
}

// ---- Hero image mouse parallax (cursor-tracked tilt) ----
function initHeroParallax(){
  const outer = document.querySelector('.hero-img-outer');
  const wrap = document.querySelector('.hero-img-wrap');
  const img = wrap ? wrap.querySelector('img') : null;
  if (!outer || !wrap || !img) return;
  if (window.matchMedia && window.matchMedia('(hover: none)').matches) return; // skip on touch devices
  outer.addEventListener('mousemove', (e) => {
    const rect = outer.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    wrap.style.transform = `rotateY(${px * 10}deg) rotateX(${-py * 10}deg)`;
    img.style.transform = `scale(1.06) translate(${px * -10}px, ${py * -10}px)`;
  });
  outer.addEventListener('mouseleave', () => {
    wrap.style.transform = 'rotateY(0deg) rotateX(0deg)';
    img.style.transform = 'scale(1) translate(0,0)';
  });
}

// ---- Install section: scroll-linked countdown timer + active step ----
// Scoped per-section (not by a single global id) so this works correctly
// even when more than one install-scroll section exists in the same document.
function initInstallScroll(){
  const sections = document.querySelectorAll('.install-scroll');
  if (!sections.length) return;
  const TOTAL_SECONDS = 300; // 5:00, counts down to 0:00 as you scroll through the section
  sections.forEach(section => {
    const timerEl = section.querySelector('.install-timer');
    const fillEl = section.querySelector('.install-progress-fill');
    const cards = section.querySelectorAll('.install-step-card');
    if (!timerEl) return;
    let ticking = false;
    function update(){
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      const progress = Math.min(1, Math.max(0, scrollable > 0 ? scrolled / scrollable : 0));
      const secondsLeft = Math.round(TOTAL_SECONDS * (1 - progress));
      const mm = Math.floor(secondsLeft / 60);
      const ss = (secondsLeft % 60).toString().padStart(2, '0');
      timerEl.textContent = `${mm}:${ss}`;
      if (fillEl) fillEl.style.width = (progress * 100) + '%';
      const stepIndex = progress >= 1 ? 2 : Math.min(2, Math.floor(progress * 3));
      cards.forEach((el, i) => el.classList.toggle('active', i === stepIndex));
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking){ requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  });
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initFaq();
  initScrollReveal();
  initHeroParallax();
  initInstallScroll();
  renderCartEverywhere();
  loadInstallSpotsBadge();
  loadReviews();

  // Successful Stripe redirect (always lands on root) clears the cart for real.
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') === 'true'){
    cart = []; saveCart(); renderCartEverywhere();
    history.replaceState(null, '', window.location.pathname);
    const o = document.createElement('div');
    o.className = 'modal-overlay open';
    o.innerHTML = `<div class="modal-box" style="text-align:center;">
      <div style="width:56px;height:56px;border-radius:50%;background:var(--accent-blue);color:#fff;font-size:28px;line-height:56px;margin:0 auto 16px;">&#10003;</div>
      <h3>Order Confirmed</h3>
      <p>Thanks for your order! A confirmation has been sent to your email. We'll reach out soon with shipping or pickup details.</p>
      <button class="btn btn-primary btn-block" onclick="this.closest('.modal-overlay').remove()">Done</button>
    </div>`;
    document.body.appendChild(o);
  }
});
