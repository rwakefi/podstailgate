function fillGallery(id, urls) {
  const root = document.getElementById(id);
  if (!root) return;
  urls.forEach((src) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("click", () => openLightbox(src));
    root.appendChild(img);
  });
}

function openLightbox(src) {
  const box = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-img");
  img.src = src;
  box.classList.add("open");
}

function closeLightbox() {
  document.getElementById("lightbox").classList.remove("open");
}

document.addEventListener("DOMContentLoaded", () => {
  const photos = window.PODS_PHOTOS || { tennessee: [], vault: [] };
  fillGallery("tennessee-gallery", photos.tennessee);
  fillGallery("vault-gallery", photos.vault);
  document.getElementById("lightbox").addEventListener("click", closeLightbox);
});
