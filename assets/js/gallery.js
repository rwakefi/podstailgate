/* PODS Tailgate — photo galleries + lightbox */

(async function () {
  const mount = document.getElementById("galleries");
  const navMount = document.getElementById("gallery-nav");
  if (!mount) return;

  let data;
  try {
    const res = await fetch("data/galleries.json", { cache: "no-cache" });
    data = await res.json();
  } catch (err) {
    console.error("[PODS] gallery load failed", err);
    mount.innerHTML = '<p class="muted">Photos are taking a break. Check back soon.</p>';
    return;
  }

  const galleries = (data.galleries || []).filter((g) => (g.photos || []).length);
  const flat = []; // {src, group} for lightbox navigation

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmt = (s) => {
    if (!s) return "";
    const [y, m, d] = s.split("-").map(Number);
    return `${MONTHS[(m || 1) - 1]} ${d}, ${y}`;
  };

  if (navMount) {
    navMount.innerHTML = galleries
      .map((g) => `<a href="#${g.slug}">${g.title}</a>`)
      .join("");
  }

  mount.innerHTML = galleries
    .map((g) => {
      const imgs = g.photos
        .map((src, i) => {
          const idx = flat.push({ src, alt: `${g.title} — photo ${i + 1}` }) - 1;
          return `<img src="${src}" alt="${g.title} — photo ${i + 1}" loading="lazy" data-idx="${idx}" tabindex="0" role="button">`;
        })
        .join("");
      return `
        <section class="gallery-group" id="${g.slug}">
          <h2>${g.title}</h2>
          ${g.date || g.blurb ? `<p class="muted">${[fmt(g.date), g.blurb].filter(Boolean).join(" &middot; ")}</p>` : ""}
          <div class="gallery">${imgs}</div>
        </section>`;
    })
    .join("");

  /* lightbox */
  const box = document.getElementById("lightbox");
  const boxImg = document.getElementById("lightbox-img");
  const closeBtn = box.querySelector(".lightbox__close");
  let current = -1;
  let opener = null; // element to return focus to

  function show(i) {
    if (i < 0 || i >= flat.length) return;
    current = i;
    boxImg.src = flat[i].src;
    boxImg.alt = flat[i].alt || "Game day photo";
    if (box.hidden) {
      opener = document.activeElement;
      box.hidden = false;
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    }
  }
  function close() {
    box.hidden = true;
    boxImg.src = "";
    document.body.style.overflow = "";
    if (opener && opener.focus) opener.focus();
    opener = null;
  }

  mount.addEventListener("click", (e) => {
    const t = e.target;
    if (t.tagName === "IMG" && t.dataset.idx) show(Number(t.dataset.idx));
  });
  mount.addEventListener("keydown", (e) => {
    const t = e.target;
    if ((e.key === "Enter" || e.key === " ") && t.tagName === "IMG" && t.dataset.idx) {
      e.preventDefault();
      show(Number(t.dataset.idx));
    }
  });
  box.addEventListener("click", (e) => {
    if (e.target === box || e.target.classList.contains("lightbox__close")) close();
    if (e.target.classList.contains("lightbox__prev")) show(current - 1);
    if (e.target.classList.contains("lightbox__next")) show(current + 1);
  });
  document.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });

  /* jump to hash target after render */
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView();
  }
})();
