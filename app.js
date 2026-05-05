/* =====================================================
   myArriva myPay — Application Logic
   ===================================================== */

/* ─────────────── State ─────────────── */
const state = {
  tickets:        [],
  activeIntervals: {},
  currentScreen:  'home',
  activeOverlayId: null,
  acquistiTab:    'disponibili',
};

const STORAGE_KEY = 'myArriva_tickets';

/* ─────────────── Persistence ─────────────── */

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tickets));
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    state.tickets = JSON.parse(stored).map(t => ({
      ...t,
      issuedAt:    t.issuedAt    ? new Date(t.issuedAt)    : null,
      activatedAt: t.activatedAt ? new Date(t.activatedAt) : null,
      expiresAt:   t.expiresAt   ? new Date(t.expiresAt)   : null,
    }));
  } catch (e) {
    console.error('Could not load state', e);
  }
}

/* ─────────────── Helpers ─────────────── */

/** ASF logo img tag */
const asfSVG = (h = 24) =>
  `<img src="FOTO/logos/asf-logo.png" alt="ASF" style="height:${h}px;width:auto;border-radius:4px">`;

/** LDS Spinner HTML generator */
function spinnerHTML(colorClass = 'teal', sizeClass = '') {
  return `<div class="lds-spinner ${colorClass} ${sizeClass} is-spinning">
    <div></div><div></div><div></div><div></div>
    <div></div><div></div><div></div><div></div>
  </div>`;
}

/** Format ms remaining as human-readable string */
function formatRemaining(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return '< 1 min';
}

/** Format Date as dd/mm/yyyy - HH:MM */
function fmtDate(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} - ${hh}:${mi}`;
}

function getAppVersion() {
  const year  = new Date().getFullYear();
  const patch = 7 + Math.floor(Math.random() * 3);
  return `Versione 17.2.${patch} (17.2.${patch}) - ${year}`;
}

function renderAppVersion() {
  const el = document.getElementById('app-version');
  if (el) el.textContent = getAppVersion();
}

/* ─────────────── Navigation ─────────────── */

function navigateTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('screen-' + screenId).classList.remove('hidden');

  document.querySelectorAll('#bottom-nav .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.target === screenId);
  });

  state.currentScreen = screenId;

  if (screenId === 'acquisti') {
    triggerAcquistiEntrance();
  } else if (screenId === 'home') {
    renderAppVersion();
  }

  lucide.createIcons();
}

/* ─────────────── Purchase ─────────────── */

function acquista() {
  // Prevent buying while a ticket is already active
  if (state.tickets.some(t => t.status === 'active')) {
    const btn = document.getElementById('btn-acquista');
    if (!btn) return;
    btn.textContent = 'Acquisto limitato';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = 'Acquista'; btn.disabled = false; }, 1500);
    return;
  }

  const btn = document.getElementById('btn-acquista');
  if (!btn) return;

  btn.textContent = 'Elaborazione...';
  btn.disabled = true;

  setTimeout(() => {
    btn.textContent = 'Acquista';
    btn.disabled = false;

    const now = Date.now();
    const ticket = {
      id:         now.toString(),
      name:       "RETE URBANA 75'",
      subtitle:   "Titolo di viaggio Integrato valido su tutte le linee con percorrenza urbana per 75'",
      status:     'active',
      issuedAt:   new Date(),
      activatedAt: new Date(now - 15 * 60 * 1000),
      expiresAt:  new Date(now + 60 * 60 * 1000),
      price:      1.50,
      lockCode:   Math.floor(600  + Math.random() * 200),
      ticketCode: '7325/' + Math.floor(1000000 + Math.random() * 9000000),
      operator:   'ASF Autolinee Srl',
      vat:        '02660190139',
    };

    state.tickets.push(ticket);
    state.activeIntervals[ticket.id] = setInterval(() => checkActiveTicket(ticket.id), 1000);
    saveState();
  }, 1200);
}

/* ─────────────── Acquisti tab switching ─────────────── */

function switchAcquistiTab(tab) {
  state.acquistiTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  renderAcquisti();
}

/* ─────────────── Render acquisti ─────────────── */

function renderAcquisti() {
  const el = document.getElementById('acquisti-content');
  if (!el) return;

  if (state.acquistiTab === 'scaduti') {
    el.innerHTML = '';
    return;
  }

  const active = state.tickets.filter(t => t.status === 'active');

  if (!active.length) {
    el.innerHTML = `<div class="empty-state">
      <p class="empty-title">Non ci sono biglietti disponibili.</p>
    </div>`;
    lucide.createIcons();
    return;
  }

  let html = '<div class="list-label">Ticket attivi</div>';
  html += active.map(buildActiveListCard).join('');
  el.innerHTML = html;
  lucide.createIcons();

  // Restart live countdowns
  active.forEach(t => updateListCountdown(t.id, t.expiresAt - Date.now()));
}

/* ─────────────── List card builders ─────────────── */

function buildActiveListCard(t) {
  return `
    <div class="ticket-list-card" onclick="openTicketDetail('${t.id}')">
      <div class="tlc-header">
        <div style="margin-left:14px">${asfSVG(28)}</div>
        <span class="badge badge--active">Attivo</span>
      </div>
      <p class="tlc-name">RETE URBANA 75'</p>
      <hr class="tlc-divider">
      <div class="tlc-row">
        <i data-lucide="clock" style="width:18px;height:18px;color:#000;stroke-width:2.5px"></i>
        <span style="color:var(--text)">Valido per altri <strong id="list-cd-${t.id}"></strong></span>
      </div>
      <hr class="tlc-divider" style="margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="color:var(--text);font-weight:500">Costo</span>
        <span class="tlc-price" style="font-size:0.875rem">1,50 €</span>
      </div>
    </div>`;
}

function buildExpiredCard(t) {
  return `
    <div class="ticket-list-card" style="opacity:0.6;cursor:default">
      <div class="tlc-header">
        <div style="margin-left:14px">${asfSVG(28)}</div>
        <span class="badge badge--expired">Scaduto</span>
      </div>
      <p class="tlc-name">RETE URBANA 75'</p>
      <hr class="tlc-divider">
      <div class="tlc-row">
        <i data-lucide="clock" style="width:18px;height:18px;color:#000;stroke-width:2.5px"></i>
        <span style="color:var(--text);font-weight:600">Scaduto</span>
      </div>
      <hr class="tlc-divider" style="margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="color:var(--text);font-weight:500">Costo</span>
        <span class="tlc-price" style="font-size:0.875rem">1,50 €</span>
      </div>
    </div>`;
}

/* ─────────────── Ticket lifecycle ─────────────── */

function checkActiveTicket(id) {
  const t = state.tickets.find(x => x.id === id);
  if (!t || t.status !== 'active') return;

  const rem = t.expiresAt - Date.now();

  if (rem <= 0) {
    t.status = 'expired';
    clearInterval(state.activeIntervals[id]);
    delete state.activeIntervals[id];
    saveState();
    if (state.activeOverlayId === id) closeOverlay();
    if (state.currentScreen === 'acquisti') renderAcquisti();
  } else {
    updateListCountdown(id, rem);
    if (state.activeOverlayId === id) updateDetailCountdown(rem);
  }
}

function attivaTicket(id) {
  const t = state.tickets.find(x => x.id === id);
  if (!t || t.status !== 'inactive') return;

  t.status      = 'active';
  t.activatedAt = new Date(Date.now() - 15 * 60 * 1000);
  t.expiresAt   = new Date(Date.now() + 60 * 60 * 1000);
  saveState();
  renderAcquisti();
  state.activeIntervals[id] = setInterval(() => checkActiveTicket(id), 1000);

  if (state.activeOverlayId === id) {
    closeOverlay();
    setTimeout(() => openTicketDetail(id), 100);
  }
}

function terminateTicket(id) {
  const t = state.tickets.find(x => x.id === id);
  if (t && t.status === 'active') {
    t.expiresAt = new Date(0);
    checkActiveTicket(id);
  }
}

/* ─────────────── Countdown display ─────────────── */

function updateListCountdown(id, ms) {
  const el = document.getElementById('list-cd-' + id);
  if (el) el.textContent = formatRemaining(ms);
}

function updateDetailCountdown(ms) {
  const el = document.getElementById('detail-remaining');
  if (el) el.textContent = formatRemaining(ms);
}

/* ─────────────── Overlay – open / close ─────────────── */

function openTicketDetail(id) {
  const t = state.tickets.find(x => x.id === id);
  if (!t) return;

  state.activeOverlayId = id;
  const overlay = document.getElementById('overlay-ticket');
  overlay.innerHTML = buildActiveOverlay(t);
  overlay.scrollTop = 0;
  overlay.classList.remove('hidden');

  lucide.createIcons();

  if (t.status === 'active') {
    renderQR('qr-container', t.ticketCode);
    startClockInterval();
    initTicketPullToRefresh();
  }
}

function closeOverlay() {
  document.getElementById('overlay-ticket').classList.add('hidden');
  state.activeOverlayId = null;
  stopClockInterval();

  renderAcquisti();
}

/* ─────────────── Overlay HTML builders ─────────────── */

function buildInactiveOverlay(t) {
  return `
    <div class="overlay-inactive">
      <div class="overlay-header" style="padding-bottom:48px">
        <button class="btn-back" style="color:#000" onclick="closeOverlay()">
          <i data-lucide="chevron-left" style="width:24px;height:24px"></i>
        </button>
        <h1 style="color:#000;font-weight:700;font-size:1.25rem">Ticket non attivo</h1>
        <div class="spacer"></div>
      </div>
      <div class="overlay-content">
        <div class="detail-card">
          <div style="margin-left:28px;margin-bottom:12px">${asfSVG(24)}</div>
          <p class="detail-card__name">${t.name}</p>
          <p class="detail-card__sub">${t.subtitle}</p>
          <div class="inactive-banner">
            <p>Valido <strong>75 minuti</strong><br><strong>Titolo non attivo</strong></p>
          </div>
          <p class="detail-issued">Emesso il:</p>
          <p class="detail-date">${fmtDate(t.issuedAt)}</p>
          <div class="detail-cost"><span>Costo</span><span>1,50 €</span></div>
          <hr class="detail-divider">
          <div class="accordion-toggle" onclick="toggleAccordion(this)">
            <span style="font-weight:700">Dettagli</span>
            <span class="accordion-link">Leggi tutto <i data-lucide="chevron-down" style="width:28px;height:28px;color:var(--teal)"></i></span>
          </div>
          <div class="accordion-body" style="margin-bottom:24px">
            <p class="accordion-text">La validità inizia dal momento della convalida e il titolo sarà valido per 75 minuti.
            Il biglietto potrà essere utilizzato per viaggiare su tutte le linee con percorrenza urbana a Como,
            salvo fatte le corse effettuate da BUS che espongono la lettera U barrata.
            ${t.operator}<br><br>&middot; P.IVA ${t.vat}</p>
          </div>
          <div class="detail-code" style="margin-bottom:24px">
            <span>Codice Ticket:</span><span>${t.ticketCode}</span>
          </div>
        </div>
      </div>
      <div style="padding:24px 0 48px;display:flex;justify-content:center">
        <button class="btn-attiva-full" onclick="attivaTicket('${t.id}')">Attiva</button>
      </div>
    </div>`;
}

function buildActiveOverlay(t) {
  const rem = t.expiresAt - Date.now();

  return `
    <div class="overlay-active">

      <!-- Sticky header -->
      <div class="overlay-header"
           style="position:sticky;top:0;z-index:50;
                  padding-bottom:36px;background:var(--green)">
        <button class="btn-back" onclick="closeOverlay()">
          <i data-lucide="chevron-left" style="width:24px;height:24px"></i>
        </button>
        <h1 style="font-weight:900;font-size:1.25rem">Ticket attivo</h1>
        <div class="spacer"></div>
      </div>

      <!-- Spinner area BEHIND the card (z-index: 1) -->
      <div id="ticket-spinner-wrap">
        <div class="lds-spinner white lds-spinner-lg is-spinning" id="ticket-lds-spinner">
          <div></div><div></div><div></div><div></div>
          <div></div><div></div><div></div><div></div>
        </div>
      </div>

      <!-- Card container ABOVE the spinner (z-index: 10) -->
      <div id="ticket-card-wrap">
        <div class="overlay-content" id="ticket-scroll-content">
          <div class="detail-card active-ticket-card">

            <!-- ASF logo (tap to terminate — dev shortcut) -->
            <div style="margin-left:28px;margin-bottom:12px;cursor:pointer"
                 onclick="terminateTicket('${t.id}')">${asfSVG(24)}</div>

            <p class="detail-card__name">${t.name}</p>
            <p class="detail-card__sub">${t.subtitle}</p>

            <!-- QR / validation section -->
            <div class="validation-section" style="border-bottom:none;border-bottom-left-radius:0;border-bottom-right-radius:0;margin-bottom:0">
              <div class="validation-header" onclick="toggleValidation(this)"
                   style="padding-top:20px;padding-bottom:20px">
                <img src="FOTO/logos/biglietti_tariffa.png" style="width:28px;height:28px;object-fit:contain;margin-right:12px">
                <span style="color:var(--text);font-weight:600;font-size:0.9375rem">Controllo e validazione</span>
                <i data-lucide="chevron-up" class="val-chevron"
                   style="width:32px;height:32px;margin-left:auto;color:var(--teal);transition:transform 0.3s"></i>
              </div>
              <div class="validation-body" style="overflow:hidden;transition:max-height 0.3s ease;max-height:500px">
                <div class="qr-wrap" style="padding-top: 12px; padding-bottom: 8px;">
                  <div id="qr-container"></div>
                  <button class="qr-enlarge" style="margin-top:8px" onclick="openQRModal('${t.ticketCode}')">Ingrandisci QRCode</button>
                </div>
                <div class="qr-footer">
                  <span class="qr-clock">
                    <i data-lucide="clock" style="width:26px;height:26px"></i>
                    <span id="detail-clock" style="margin-top:2px;line-height:1">${new Date().toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</span>
                  </span>
                  <span class="qr-lock">
                    <i data-lucide="lock" style="width:18px;height:18px"></i> ${t.lockCode}
                  </span>
                </div>
              </div>
            </div>

            <!-- Animated zigzag separator -->
            <div class="wave-strip" style="margin-bottom:var(--s4)"></div>

            <!-- Time remaining banner -->
            <div class="active-banner">
              <p class="timer">Tempo restante:
                <span id="detail-remaining" style="font-weight:700">${formatRemaining(rem)}</span>
              </p>
              <p class="activ">Attivato il: <strong>${fmtDate(t.activatedAt)}</strong></p>
            </div>

            <p class="detail-issued" style="margin-top:8px">Emesso il:</p>
            <p class="detail-date">${fmtDate(t.issuedAt)}</p>
            <div class="detail-cost"><span>Costo</span><span>1,50 €</span></div>
            <hr class="detail-divider">

            <!-- Collapsible details -->
            <div class="accordion-toggle" onclick="toggleAccordion(this)" style="padding:var(--s2) 0">
              <span style="font-weight:700">Dettagli</span>
              <span class="accordion-link">Leggi tutto
                <i data-lucide="chevron-down" style="width:28px;height:28px;color:var(--teal)"></i>
              </span>
            </div>
            <div class="accordion-body" style="margin-bottom:24px">
              <p class="accordion-text">La validità inizia dal momento della convalida e il titolo sarà valido per 75 minuti.
              Il biglietto potrà essere utilizzato per viaggiare su tutte le linee con percorrenza urbana a Como,
              salvo fatte le corse effettuate da BUS che espongono la lettera U barrata.
              ${t.operator}<br><br>&middot; P.IVA ${t.vat}</p>
            </div>

            <div class="detail-code" style="margin-bottom:24px">
              <span>Codice Ticket:</span><span>${t.ticketCode}</span>
            </div>
          </div>
        </div>
      </div><!-- /ticket-card-wrap -->

      <!-- Sticky bottom bar -->
      <div style="position:fixed;bottom:0;left:0;right:0;width:100%;max-width:480px;margin:0 auto;
                  background:white;border-top:1px solid rgba(0,0,0,0.05);
                  height:calc(15px + env(safe-area-inset-bottom));z-index:60;
                  display:flex;align-items:center;justify-content:center">
      </div>

    </div>`;
}

/* ─────────────── Accordion & validation toggles ─────────────── */

function toggleAccordion(el) {
  const body   = el.nextElementSibling;
  const isOpen = body.classList.toggle('open');
  const icon   = el.querySelector('.accordion-link svg, .accordion-link i');
  if (icon) {
    icon.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    icon.style.transition = 'transform 0.3s ease';
  }
}

function toggleValidation(el) {
  const body    = el.nextElementSibling;
  const chevron = el.querySelector('.val-chevron');
  const isOpen  = !body.style.maxHeight || body.style.maxHeight !== '0px';
  body.style.maxHeight      = isOpen ? '0px'   : '500px';
  chevron.style.transform   = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

/* ─────────────── QR Code ─────────────── */

function renderQR(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  new QRCode(el, {
    text: data, width: 240, height: 240,
    colorDark: '#000', colorLight: '#fff',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

function openQRModal(ticketCode) {
  const modal = document.createElement('div');
  modal.className = 'qr-modal';
  modal.innerHTML = `
    <button class="close-btn" onclick="this.parentElement.remove()">
      <svg width="24" height="24" viewBox="0 0 24 24" stroke="#1A1A2E" fill="none" stroke-width="2">
        <line x1="18" y1="6"  x2="6"  y2="18"/>
        <line x1="6"  y1="6"  x2="18" y2="18"/>
      </svg>
    </button>
    <div id="qr-modal-container"></div>`;
  document.body.appendChild(modal);
  new QRCode(document.getElementById('qr-modal-container'), {
    text: ticketCode, width: 320, height: 320,
    colorDark: '#000', colorLight: '#fff',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

/* ─────────────── Live clock (active ticket overlay) ─────────────── */

let clockInterval = null;

function startClockInterval() {
  stopClockInterval();
  clockInterval = setInterval(() => {
    const el = document.getElementById('detail-clock');
    if (el) el.textContent = new Date().toLocaleTimeString('it-IT', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }, 1000);
}

function stopClockInterval() {
  if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
}

/* ─────────────── Entrance animation (acquisti screen) ─────────────── */
function triggerAcquistiEntrance() {
  const pullZone = document.getElementById('acquisti-pull-zone');
  const body = document.getElementById('acquisti-body');
  if (!pullZone || !body) return;

  // Pre-render content
  renderAcquisti();

  const SPIN_DURATION = 500;

  // Show spinner (expands from zero height)
  pullZone.style.height = '80px';
  const spinner = pullZone.querySelector('.lds-spinner');
  if (spinner) spinner.classList.add('is-spinning');

  // After delay, hide spinner and snap content back up
  setTimeout(() => {
    pullZone.style.height = '0';
    body.style.transform = '';
    if (spinner) {
      setTimeout(() => spinner.classList.remove('is-spinning'), 300);
    }
  }, SPIN_DURATION);
}

/* ─────────────── Pull-to-refresh — Acquisti Screen ─────────────── */
function initAcquistiPullToRefresh() {
  const screen = document.getElementById('screen-acquisti');
  const pullZone = document.getElementById('acquisti-pull-zone');
  const body = document.getElementById('acquisti-body');
  if (!screen || !pullZone || !body) return;

  const spinner = pullZone.querySelector('.lds-spinner');
  const spikes = spinner ? spinner.querySelectorAll('div') : [];
  let startY = 0;
  let pulling = false;
  let hitThreshold = false;
  const MAX_PULL = 100;
  const THRESHOLD = 60;

  screen.addEventListener('touchstart', e => {
    if (state.currentScreen !== 'acquisti' || state.activeOverlayId || screen.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
    hitThreshold = false;
    pullZone.style.transition = 'none';
    body.style.transform = '';
    body.style.transition = 'none';
    if (spinner) {
      spinner.classList.remove('is-spinning');
      spinner.style.rotate = '';
    }
    // Reset spike opacity
    spikes.forEach(s => s.style.opacity = '');
  }, { passive: true });

  let pullRAF = null;

  screen.addEventListener('touchmove', e => {
    if (!pulling) return;
    const delta = e.touches[0].clientY - startY;
    if (delta <= 0) {
      if (pullRAF) cancelAnimationFrame(pullRAF);
      pulling = false;
      pullZone.style.height = '0';
      return;
    }

    if (pullRAF) cancelAnimationFrame(pullRAF);
    pullRAF = requestAnimationFrame(() => {
      const move = Math.min(delta * 0.35, MAX_PULL);
      pullZone.style.height = move + 'px';
      body.style.transform = '';
      
      if (move >= THRESHOLD) {
        if (!hitThreshold) {
          hitThreshold = true;
          if (spinner) {
            spinner.classList.add('is-spinning');
            spikes.forEach(s => s.style.opacity = '');
          }
        }
      } else {
        if (hitThreshold) {
          hitThreshold = false;
          if (spinner) spinner.classList.remove('is-spinning');
        }
        // Spike-by-spike appearance
        const offsetIndex = Math.floor((move / THRESHOLD) * spikes.length * 2) % spikes.length;
        spikes.forEach((spike, i) => {
          const dist = (i - offsetIndex + spikes.length) % spikes.length;
          const op = Math.max(0.15, 1 - (dist / spikes.length));
          spike.style.opacity = op;
        });
        // Slow rotation
        if (spinner) spinner.style.rotate = `${move * 2}deg`;
      }
    });
  }, { passive: true });

  screen.addEventListener('touchend', () => {
    if (!pulling) return;
    pulling = false;
    
    pullZone.style.transition = 'height 0.3s ease';
    
    if (parseInt(pullZone.style.height) > THRESHOLD) {
      pullZone.style.height = '80px';
      if (spinner) {
        spinner.classList.add('is-spinning');
        spikes.forEach(s => s.style.opacity = '');
      }
      
      setTimeout(() => {
        renderAcquisti();
        pullZone.style.height = '0';
        if (spinner) {
          setTimeout(() => {
            spinner.classList.remove('is-spinning');
            spinner.style.rotate = '';
          }, 300);
        }
      }, 800);
    } else {
      pullZone.style.height = '0';
      if (spinner) spinner.style.rotate = '';
    }
  });
}

/* ─────────────── Pull-to-refresh — Active Ticket Overlay ─────────────── */
function initTicketPullToRefresh() {
  const overlay = document.getElementById('overlay-ticket');
  const cardWrap = document.getElementById('ticket-card-wrap');
  const spinnerWrap = document.getElementById('ticket-spinner-wrap');
  const spinner = document.getElementById('ticket-lds-spinner');
  if (!overlay || !cardWrap || !spinnerWrap || !spinner) return;

  const spikes = spinner.querySelectorAll('div');
  let startY = 0;
  let pulling = false;
  let hitThreshold = false;
  const THRESHOLD = 80;
  const MAX_PULL = 140;

  overlay.addEventListener('touchstart', e => {
    if (overlay.scrollTop > 2) return;
    startY = e.touches[0].clientY;
    pulling = true;
    hitThreshold = false;
    cardWrap.style.transition = 'none';
    spinnerWrap.style.transition = 'none';
    spinner.classList.remove('is-spinning');
    spinner.style.rotate = '';
    // Reset spike opacity
    spikes.forEach(s => s.style.opacity = '');
  }, { passive: true });

  overlay.addEventListener('touchmove', e => {
    if (!pulling) return;

    const deltaY = e.touches[0].clientY - startY;

    // Upward swipe = normal scroll, cancel pull
    if (deltaY <= 0) {
      pulling = false;
      cardWrap.style.transform = '';
      spinnerWrap.style.height = '0';
      spinner.classList.remove('is-spinning');
      spinner.style.rotate = '';
      spikes.forEach(s => s.style.opacity = '');
      return;
    }

    // If scrolled down while pulling, cancel
    if (overlay.scrollTop > 2) {
      pulling = false;
      return;
    }

    e.preventDefault();

    const move = Math.min(deltaY * 0.35, MAX_PULL);
    cardWrap.style.transform = `translateY(${move}px)`;
    spinnerWrap.style.height = move + 'px';

    if (move >= THRESHOLD) {
      if (!hitThreshold) {
        hitThreshold = true;
        if (navigator.vibrate) navigator.vibrate(10);
        spinner.classList.add('is-spinning');
        spikes.forEach(s => s.style.opacity = '');
      }
    } else {
      if (hitThreshold) {
        hitThreshold = false;
        spinner.classList.remove('is-spinning');
      }
      // Spike-by-spike appearance during pull
      const offsetIndex = Math.floor((move / THRESHOLD) * spikes.length * 2) % spikes.length;
      spikes.forEach((spike, i) => {
        const dist = (i - offsetIndex + spikes.length) % spikes.length;
        const op = Math.max(0.15, 1 - (dist / spikes.length));
        spike.style.opacity = op;
      });

      // Keep scale fixed, only rotate
      spinner.style.rotate = `${move * 1.5}deg`;
    }
  }, { passive: false });

  overlay.addEventListener('touchend', () => {
    if (!pulling) return;
    pulling = false;

    // Add transition for snap-back
    cardWrap.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
    spinnerWrap.style.transition = 'height 0.4s cubic-bezier(0.25, 1, 0.5, 1)';

    // Always snap back up
    cardWrap.style.transform = 'translateY(0)';
    spinnerWrap.style.height = '0';
    spinner.style.rotate = '';
    
    // Stop spinner after snap animation
    setTimeout(() => {
      spinner.classList.remove('is-spinning');
      spikes.forEach(s => s.style.opacity = '');
    }, 400);
  });
}

/* ─────────────── Initialisation ─────────────── */

window.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  // Wire up bottom nav tabs
  document.querySelectorAll('#bottom-nav .tab').forEach(tab => {
    tab.addEventListener('click', () => navigateTo(tab.dataset.target));
  });

  // Restore persisted tickets
  loadState();

  // Resume or expire tickets from previous session
  state.tickets.forEach(t => {
    if (t.status === 'active') {
      if (Date.now() >= t.expiresAt) {
        t.status = 'expired';
      } else {
        state.activeIntervals[t.id] = setInterval(() => checkActiveTicket(t.id), 1000);
      }
    }
  });

  navigateTo('home');
  renderAppVersion();

  // Initialize pull-to-refresh for acquisti screen
  initAcquistiPullToRefresh();
});