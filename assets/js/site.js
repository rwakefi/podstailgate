/* PODS Tailgate — shared site logic.
   Loads JSON from /data and renders whatever hooks exist on the current page. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function getJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

function el(id) {
  return document.getElementById(id);
}

function parseDate(str) {
  // treat YYYY-MM-DD as local noon to avoid timezone slips
  const [y, m, d] = String(str).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}

function fmtDate(str) {
  const dt = parseDate(str);
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}

function nextGame(games) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // soonest game that isn't final and whose date hasn't passed (game day counts)
  const upcoming = games
    .filter((g) => g.status !== "final" && parseDate(g.date) >= today)
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));
  return upcoming[0] || null;
}

/* "Game day!", "Tomorrow", "12 days out" */
function countdownLabel(dateStr) {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const days = Math.round((parseDate(dateStr) - now) / 86400000);
  if (days <= 0) return "Game day!";
  if (days === 1) return "Tomorrow";
  return `${days} days out`;
}

/* ---------- mobile nav ---------- */
function initNav() {
  const toggle = document.querySelector(".nav__toggle");
  const nav = document.querySelector(".nav");
  if (!toggle || !nav) return;
  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) {
      setOpen(false);
      toggle.focus();
    }
  });
}

/* ---------- footer year ---------- */
function initYear() {
  document.querySelectorAll("[data-year]").forEach((n) => {
    n.textContent = new Date().getFullYear();
  });
}

/* ---------- hero (home) ---------- */
function renderHero(site) {
  const mount = el("hero");
  if (!mount || !site.hero) return;
  const h = site.hero;
  if (h.eyebrow) mount.querySelector("[data-hero='eyebrow']").textContent = h.eyebrow;
  if (h.title) mount.querySelector("[data-hero='title']").textContent = h.title;
  if (h.text) mount.querySelector("[data-hero='text']").textContent = h.text;
}

/* ---------- announcement bar ---------- */
function renderAnnounce(site, schedule) {
  const bar = el("announce");
  if (!bar) return;
  let text = (site.announcement || "").trim();
  if (!text && site.announcementFallbackFromSchedule && schedule) {
    const ng = nextGame(schedule.games || []);
    if (ng && ng.menu) text = `This week: ${ng.menu} — Arkansas vs. ${ng.opponent}`;
  }
  bar.textContent = text;
}

/* preview: a string or an array of paragraphs */
function renderPreview(preview) {
  if (!preview) return "";
  const paras = Array.isArray(preview) ? preview : [preview];
  return `<div class="gamecard__preview">${paras
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join("")}</div>`;
}

/* ---------- this-week game card (home) ---------- */
function renderThisWeek(site, schedule) {
  const mount = el("this-week");
  if (!mount) return;
  const ng = nextGame(schedule.games || []);
  if (!ng) {
    mount.innerHTML = `
      <div class="gamecard">
        <div class="gamecard__body">
          <p class="eyebrow">Off Season</p>
          <p class="gamecard__matchup">See you next fall</p>
          <p class="muted">The schedule for the next season is being set. Check back soon, and browse the <a href="photos.html">photos</a> in the meantime.</p>
        </div>
      </div>`;
    return;
  }
  const homeAway = ng.home ? "Home — Razorback Gardens" : "Away";
  const loc = ng.home ? site.location.short : "";
  const when = [
    `${DAYS[parseDate(ng.date).getDay()]}, ${fmtDate(ng.date)}`,
    ng.time && ng.time !== "TBD" ? ng.time : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const vid = site.video && site.video.youtubeId
    ? `<div class="video-wrap">
         <iframe src="https://www.youtube-nocookie.com/embed/${site.video.youtubeId}"
           title="${site.video.title || "PODS Tailgate"}" loading="lazy"
           allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
           allowfullscreen></iframe>
       </div>`
    : "";
  mount.innerHTML = `
    <div class="gamecard">
      <div class="gamecard__top">
        <span>Next Tailgate</span>
        <span>${when} &middot; ${homeAway}</span>
      </div>
      <div class="gamecard__body">
        <span class="pill">${countdownLabel(ng.date)}</span>
        <p class="gamecard__matchup">Arkansas <em>vs.</em> ${ng.opponent}</p>
        ${ng.menu ? `<p class="gamecard__menu">Menu: ${ng.menu}${ng.chef ? ` <span>by ${ng.chef}</span>` : ""}</p>` : ""}
        ${renderPreview(ng.preview)}
        ${loc ? `<p class="muted">${loc}</p>` : ""}
        <a class="btn" href="schedule.html">Full schedule &amp; menus</a>
        ${vid}
      </div>
    </div>`;
}

/* ---------- schedule page ---------- */
function renderSchedule(schedule) {
  const mount = el("schedule-list");
  if (!mount) return;
  const ng = nextGame(schedule.games || []);
  const games = [...(schedule.games || [])].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  if (!games.length) {
    mount.innerHTML = `<p class="muted">Schedule coming soon.</p>`;
    return;
  }
  mount.innerHTML = games
    .map((g) => {
      const dt = parseDate(g.date);
      const isNext = ng && g.date === ng.date && g.opponent === ng.opponent;
      const tag = g.result
        ? g.result
        : g.status === "final"
        ? "Final"
        : g.home
        ? "Home"
        : "Away";
      const gallery = g.gallery
        ? `<a href="photos.html#${g.gallery}">View photos &rarr;</a>`
        : "";
      const isPast = g.status === "final";
      return `
        <div class="game-row${isNext ? " game-row--next" : ""}${isPast ? " game-row--past" : ""}">
          <div class="game-row__date">
            <span>${MONTHS[dt.getMonth()]}</span>
            <b>${dt.getDate()}</b>
            <span>${dt.getFullYear()}</span>
          </div>
          <div class="game-row__main">
            <b>Arkansas vs. ${g.opponent}</b>
            <span>${g.time && g.time !== "TBD" ? `${g.time} &middot; ` : ""}${g.menu ? `Menu: ${g.menu}` : "Menu TBA"}${g.chef ? ` &middot; by ${g.chef}` : ""}</span>
          </div>
          <div class="game-row__tag">${isNext ? `<span class="pill">Next up</span>` : tag}${gallery ? `<br>${gallery}` : ""}</div>
        </div>`;
    })
    .join("");
}

/* ---------- FAQ ---------- */
function renderFAQ(faq) {
  const full = el("faq");
  const home = el("faq-home");
  const build = (items) =>
    items
      .map(
        (it) => `
      <details>
        <summary>${it.q}</summary>
        <p>${it.a}</p>
        ${it.image ? `<img src="${it.image}" alt="" loading="lazy">` : ""}
      </details>`
      )
      .join("");
  if (full) full.innerHTML = build(faq.items || []);
  if (home) home.innerHTML = build(faq.items || []);
}

/* ---------- Find Us / logistics (home + about) ---------- */
function renderLogistics(site) {
  const mount = el("logistics");
  if (!mount) return;
  mount.innerHTML = `
    <div class="card stack">
      <h3>Parking</h3>
      <p><b>With a pass:</b> ${site.parking.withPass}</p>
      <p><b>Without a pass:</b> ${site.parking.withoutPass}</p>
      ${site.parking.image ? `<img src="${site.parking.image}" alt="Parking map" loading="lazy">` : ""}
    </div>
    <div class="card stack">
      <h3>Where we set up</h3>
      <p>${site.location.long}</p>
      <img src="${site.location.mapImage}" alt="Map of the PODS tailgate in the Razorback Gardens" loading="lazy">
      <p><a class="btn btn--ghost" href="${site.location.mapLink}" target="_blank" rel="noopener">Open in Maps</a></p>
    </div>`;
}

/* ---------- support / venmo ---------- */
function renderSupport(site) {
  const mount = el("support");
  if (!mount) return;
  const v = site.venmo;
  const a = site.award || {};
  const badge = a.image
    ? `<figure class="support-badge">
         <img src="${a.image}" alt="${a.caption || "Award badge"}" loading="lazy">
         ${a.caption ? `<figcaption>${a.caption}</figcaption>` : ""}
       </figure>`
    : "";
  mount.innerHTML = `
    <div class="support-layout">
      ${badge}
      <div class="support-main">
        <p class="eyebrow">Support the Tailgate</p>
        <h2 class="section__title">Want to <span>Chip In?</span></h2>
        <p class="muted" style="max-width:520px;margin-inline:auto">${v.suggested}</p>
        ${v.qr ? `<img class="venmo-qr" src="${v.qr}" alt="Venmo QR code for ${v.handle}" loading="lazy">` : ""}
        <p style="margin-top:18px"><a class="btn" href="${v.url}" target="_blank" rel="noopener">Venmo ${v.handle}</a></p>
      </div>
    </div>`;
}

/* ---------- sponsor bar (site-wide, under header) ---------- */
function renderSponsors(site) {
  const mount = el("sponsorbar");
  if (!mount) return;
  const list = site.sponsors || [];
  if (!list.length) {
    mount.hidden = true;
    return;
  }
  const tile = (s) => {
    const safe = s.name.replace(/"/g, "&quot;").replace(/'/g, "\\'");
    const inner = s.image
      ? `<img src="${s.image}" alt="${safe}" loading="lazy"
           onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'sponsorbar__name',textContent:'${safe}'}))">`
      : `<span class="sponsorbar__name">${safe}</span>`;
    return s.url
      ? `<a class="sponsorbar__item" href="${s.url}" target="_blank" rel="noopener">${inner}</a>`
      : `<span class="sponsorbar__item">${inner}</span>`;
  };
  mount.innerHTML = `
    ${site.sponsorsLabel ? `<span class="sponsorbar__label">${site.sponsorsLabel}</span>` : ""}
    <div class="sponsorbar__logos">${list.map(tile).join("")}</div>`;
}

/* ---------- boot ---------- */
(async function boot() {
  initNav();
  initYear();

  const needs = (document.body.dataset.needs || "").split(/\s+/).filter(Boolean);
  const want = (n) => needs.includes(n);

  try {
    const [site, schedule, faq] = await Promise.all([
      want("site") ? getJSON("data/site.json") : null,
      want("schedule") ? getJSON("data/schedule.json") : null,
      want("faq") ? getJSON("data/faq.json") : null,
    ]);

    if (site) {
      renderHero(site);
      renderAnnounce(site, schedule);
      renderThisWeek(site, schedule);
      renderLogistics(site);
      renderSupport(site);
      renderSponsors(site);
    }
    if (schedule) renderSchedule(schedule);
    if (faq) renderFAQ(faq);
  } catch (err) {
    console.error("[PODS] failed to load site data", err);
  }
})();
