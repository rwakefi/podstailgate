/* PODS Tailgate — photo galleries, fan album uploads, lightbox */

(async function () {
  const albumRoot = document.getElementById("photo-album");
  const galleriesMount = document.getElementById("galleries");
  const navMount = document.getElementById("gallery-nav");
  const fanMount = document.getElementById("fan-gallery");
  const fanBlurb = document.getElementById("fan-blurb");
  if (!galleriesMount || !albumRoot) return;

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmt = (s) => {
    if (!s) return "";
    const [y, m, d] = s.split("-").map(Number);
    return `${MONTHS[(m || 1) - 1]} ${d}, ${y}`;
  };

  const EXT_OK = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
  const MIME_OK = /^image\/(jpeg|jpg|pjpeg|png|webp|gif|heic|heif)$/i;

  let galleriesData;
  let albumCfg = null;
  try {
    const [gRes, aRes] = await Promise.all([
      fetch("data/galleries.json", { cache: "no-cache" }),
      fetch("data/album.json", { cache: "no-cache" }),
    ]);
    if (!gRes.ok) throw new Error("galleries.json " + gRes.status);
    galleriesData = await gRes.json();
    if (aRes.ok) albumCfg = await aRes.json();
  } catch (err) {
    console.error("[PODS] gallery load failed", err);
    galleriesMount.innerHTML = '<p class="muted">Photos are taking a break. Check back soon.</p>';
    return;
  }

  const galleries = (galleriesData.galleries || []).filter((g) => (g.photos || []).length);
  const maxMB = Number(albumCfg && albumCfg.maxMB) || 12;
  const maxFiles = Number(albumCfg && albumCfg.maxFiles) || 8;
  const albumReady = !!(
    albumCfg &&
    albumCfg.cloudName &&
    albumCfg.uploadPreset &&
    albumCfg.cloudName !== "YOUR_CLOUD_NAME"
  );

  if (fanBlurb && albumCfg && albumCfg.blurb) fanBlurb.innerHTML = albumCfg.blurb;

  /* ----- fan album from Cloudinary ----- */
  function thumbUrl(publicId, version) {
    const v = version ? `v${version}/` : "";
    return `https://res.cloudinary.com/${albumCfg.cloudName}/image/upload/c_limit,w_720,q_auto,f_auto/${v}${publicId}`;
  }
  function fullUrl(publicId, version) {
    const v = version ? `v${version}/` : "";
    return `https://res.cloudinary.com/${albumCfg.cloudName}/image/upload/c_limit,w_1800,q_auto,f_auto/${v}${publicId}`;
  }

  function fanImgEl(resource, i) {
    const img = document.createElement("img");
    img.src = thumbUrl(resource.public_id, resource.version);
    img.dataset.full = fullUrl(resource.public_id, resource.version);
    img.alt = `Tailgate photo ${i + 1}`;
    img.loading = "lazy";
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    return img;
  }

  function setFanEmpty(show) {
    if (!fanMount) return;
    let empty = fanMount.querySelector(".album-empty");
    if (show && !fanMount.querySelector("img")) {
      if (!empty) {
        empty = document.createElement("p");
        empty.className = "muted album-empty";
        empty.textContent = "No tailgate photos yet. Be the first.";
        fanMount.appendChild(empty);
      }
    } else if (empty) {
      empty.remove();
    }
  }

  function prependFan(resource) {
    if (!fanMount) return;
    setFanEmpty(false);
    const count = fanMount.querySelectorAll("img").length;
    fanMount.prepend(fanImgEl(resource, count));
    updateFanCount();
  }

  function renderFanList(resources) {
    if (!fanMount) return;
    fanMount.innerHTML = "";
    resources.forEach((r, i) => fanMount.appendChild(fanImgEl(r, i)));
    setFanEmpty(resources.length === 0);
    updateFanCount();
  }

  function updateFanCount() {
    if (!fanBlurb || !albumCfg) return;
    const n = fanMount ? fanMount.querySelectorAll("img").length : 0;
    const base = albumCfg.blurb || "Pictures from the people who were there.";
    fanBlurb.innerHTML = n ? `${base} <span class="album-count">${n} photo${n === 1 ? "" : "s"}</span>` : base;
  }

  async function loadFanPhotos() {
    if (!albumReady || !fanMount) {
      setFanEmpty(true);
      return;
    }
    const tag = encodeURIComponent(albumCfg.tag || "pods-fan");
    const url = `https://res.cloudinary.com/${albumCfg.cloudName}/image/list/${tag}.json`;
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) {
        setFanEmpty(true);
        return;
      }
      const json = await res.json();
      const resources = (json.resources || []).slice().sort((a, b) => {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
      renderFanList(resources);
    } catch (err) {
      console.warn("[PODS] fan album list failed", err);
      setFanEmpty(true);
    }
  }

  /* ----- static galleries ----- */
  if (navMount) {
    const links = [`<a href="#tailgate-photos">${(albumCfg && albumCfg.title) || "Tailgate Photos"}</a>`].concat(
      galleries.map((g) => `<a href="#${g.slug}">${g.title}</a>`)
    );
    navMount.innerHTML = links.join("");
  }

  galleriesMount.innerHTML = galleries
    .map((g) => {
      const imgs = (g.photos || [])
        .map((src, i) => {
          return `<img src="${src}" alt="${g.title} — photo ${i + 1}" loading="lazy" tabindex="0" role="button">`;
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

  await loadFanPhotos();

  /* ----- lightbox (live query so new uploads join the album) ----- */
  const box = document.getElementById("lightbox");
  const boxImg = document.getElementById("lightbox-img");
  const closeBtn = box.querySelector(".lightbox__close");
  let current = -1;
  let opener = null;

  function albumPhotos() {
    return [...albumRoot.querySelectorAll(".gallery img")];
  }
  function photoSrc(img) {
    return img.dataset.full || img.src;
  }
  function show(i) {
    const photos = albumPhotos();
    if (i < 0 || i >= photos.length) return;
    current = i;
    const img = photos[i];
    boxImg.src = photoSrc(img);
    boxImg.alt = img.alt || "Game day photo";
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
  function openFrom(img) {
    const i = albumPhotos().indexOf(img);
    if (i >= 0) show(i);
  }

  albumRoot.addEventListener("click", (e) => {
    const t = e.target;
    if (t.tagName === "IMG" && t.closest(".gallery")) openFrom(t);
  });
  albumRoot.addEventListener("keydown", (e) => {
    const t = e.target;
    if ((e.key === "Enter" || e.key === " ") && t.tagName === "IMG" && t.closest(".gallery")) {
      e.preventDefault();
      openFrom(t);
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

  /* ----- uploads ----- */
  const drop = document.getElementById("album-drop");
  const fileInput = document.getElementById("album-file");
  const cameraInput = document.getElementById("album-camera-input");
  const pickBtn = document.getElementById("album-pick");
  const cameraBtn = document.getElementById("album-camera");
  const statusEl = document.getElementById("album-status");
  const queueEl = document.getElementById("album-queue");
  const metaEl = document.getElementById("album-meta");

  function setStatus(msg, kind) {
    if (!statusEl) return;
    if (!msg) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      statusEl.className = "album-status";
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.className = "album-status" + (kind ? " is-" + kind : "");
  }

  if (!albumReady) {
    if (drop) drop.classList.add("is-pending");
    if (pickBtn) pickBtn.disabled = true;
    if (cameraBtn) cameraBtn.disabled = true;
    if (metaEl) {
      metaEl.textContent = "The shared album is almost ready — browse the galleries below in the meantime.";
    }
  } else if (metaEl) {
    metaEl.textContent = `JPG, PNG, or HEIC · up to ${maxMB} MB each · ${maxFiles} at a time`;
  }

  function fileOk(file) {
    const named = file.name || "photo";
    if (file.type && !MIME_OK.test(file.type) && !file.type.startsWith("image/")) {
      return `${named}: not an image`;
    }
    if (!file.type && !EXT_OK.test(named)) return `${named}: not an image`;
    if (file.size > maxMB * 1024 * 1024) return `${named}: over ${maxMB} MB`;
    return "";
  }

  async function uploadOne(file) {
    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", albumCfg.uploadPreset);
    body.append("tags", albumCfg.tag || "pods-fan");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${albumCfg.cloudName}/image/upload`, {
      method: "POST",
      body,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json.error && json.error.message ? json.error.message : "upload failed";
      throw new Error(msg);
    }
    return json;
  }

  function chip(label, kind) {
    const el = document.createElement("span");
    el.className = "album-chip" + (kind ? " is-" + kind : "");
    el.textContent = label;
    return el;
  }

  async function handleFiles(list) {
    if (!albumReady) {
      setStatus("The shared album isn't connected yet. Hang tight.", "err");
      return;
    }
    const files = [...list].slice(0, maxFiles);
    if (!files.length) return;

    const ok = [];
    const skipped = [];
    files.forEach((f) => {
      const reason = fileOk(f);
      if (reason) skipped.push(reason);
      else ok.push(f);
    });

    if (queueEl) {
      queueEl.hidden = false;
      queueEl.innerHTML = "";
      ok.forEach((f) => queueEl.appendChild(chip(f.name || "photo", "wait")));
    }

    drop.classList.add("is-busy");
    setStatus(ok.length ? `Uploading ${ok.length} photo${ok.length === 1 ? "" : "s"}…` : "", ok.length ? "" : "err");

    let done = 0;
    let failed = 0;
    const chips = queueEl ? [...queueEl.children] : [];

    for (let i = 0; i < ok.length; i++) {
      try {
        const resource = await uploadOne(ok[i]);
        prependFan(resource);
        done += 1;
        if (chips[i]) {
          chips[i].className = "album-chip is-ok";
          chips[i].textContent = (ok[i].name || "photo") + " added";
        }
      } catch (err) {
        failed += 1;
        if (chips[i]) {
          chips[i].className = "album-chip is-err";
          chips[i].textContent = (ok[i].name || "photo") + " failed";
        }
        console.warn("[PODS] upload failed", err);
      }
    }

    drop.classList.remove("is-busy");
    const bits = [];
    if (done) bits.push(`${done} added to the album`);
    if (failed) bits.push(`${failed} didn't go through`);
    if (skipped.length) bits.push(skipped[0]);
    setStatus(bits.join(". ") + ".", done && !failed ? "ok" : failed ? "err" : "");
    if (fileInput) fileInput.value = "";
    if (cameraInput) cameraInput.value = "";
  }

  if (pickBtn && fileInput) pickBtn.addEventListener("click", () => fileInput.click());
  if (cameraBtn && cameraInput) cameraBtn.addEventListener("click", () => cameraInput.click());
  if (fileInput) fileInput.addEventListener("change", () => handleFiles(fileInput.files || []));
  if (cameraInput) cameraInput.addEventListener("change", () => handleFiles(cameraInput.files || []));

  if (drop) {
    ["dragenter", "dragover"].forEach((ev) => {
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.add("is-drag");
      });
    });
    ["dragleave", "drop"].forEach((ev) => {
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.remove("is-drag");
      });
    });
    drop.addEventListener("drop", (e) => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) handleFiles(files);
    });
  }

  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView();
  }
})();
