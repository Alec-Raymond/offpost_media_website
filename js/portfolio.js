document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('album-grid');
  if (!grid) return;

  try {
    const response = await fetch('albums.json');
    const data = await response.json();
    const albums = data.albums || [];

    if (albums.length === 0) {
      grid.innerHTML = '<p class="empty-state">No albums yet.</p>';
      return;
    }

    grid.innerHTML = ''; // Clear loading state

    albums.forEach((album, i) => {
      let coverPhoto = 'default';
      
      if (album.photos && album.photos.length > 0) {
        const firstPhoto = album.photos[0];
        // Decap saves path as: assets/portfolio/ALBUM_ID/raw/IMAGE.jpg
        const photoPath = typeof firstPhoto === 'object' ? firstPhoto.photo : firstPhoto;
        const parts = photoPath.split('/');
        // The photo name is the last part before the extension, properly sanitized to match the build script
        coverPhoto = parts.pop().split('.')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      }

      const albumEl = document.createElement('a');
      albumEl.className = 'album-cover';
      albumEl.href = `album.html?id=${album.id}`;
      albumEl.dataset.index = i;

      albumEl.innerHTML = `
        <picture>
          <source type="image/avif" srcset="assets/portfolio/thumbs/${coverPhoto}.avif 200w, assets/portfolio/medium/${coverPhoto}.avif 1200w" sizes="(max-width: 1024px) 50vw, 33vw">
          <source type="image/webp" srcset="assets/portfolio/thumbs/${coverPhoto}.webp 200w, assets/portfolio/medium/${coverPhoto}.webp 1200w" sizes="(max-width: 1024px) 50vw, 33vw">
          <img src="assets/portfolio/thumbs/${coverPhoto}.jpg" alt="${album.title || album.id}" loading="lazy">
        </picture>
        ${album.showTitle && album.title ? `<div class="album-cover-title">${album.title}</div>` : ''}
      `;

      grid.appendChild(albumEl);
    });

    // Run entrance animations
    animateGrid();

  } catch (err) {
    console.error('Failed to load albums:', err);
    grid.innerHTML = '<p class="empty-state">Error loading portfolio. Please try again later.</p>';
  }
});

function animateGrid() {
  const covers = Array.from(document.querySelectorAll('.album-cover'));
  const shuffled = [...covers].sort(() => Math.random() - 0.5);

  let delay = 200;
  shuffled.forEach((cover) => {
    setTimeout(() => cover.classList.add('box-visible'), delay);
    setTimeout(() => cover.classList.add('photo-visible'), delay + 400);
    delay += 150;
  });
}
