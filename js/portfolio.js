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
      // The CMS saves paths as "assets/portfolio/ID/raw/name.jpg"
      // We need just the base name for our thumb/medium/full folders
      let coverPhoto = 'default';
      if (album.photos && album.photos.length > 0) {
        const firstPhoto = album.photos[0];
        // Handle both string names and Decap CMS path objects
        const photoPath = typeof firstPhoto === 'object' ? firstPhoto.photo : firstPhoto;
        coverPhoto = photoPath.split('/').pop().split('.')[0];
      }

      const albumEl = document.createElement('a');
      albumEl.className = 'album-cover';
      albumEl.href = `album.html?id=${album.id}`;
      albumEl.dataset.index = i;

      albumEl.innerHTML = `
        <picture>
          <source type="image/avif" srcset="assets/portfolio/${album.id}/thumbs/${coverPhoto}.avif 200w, assets/portfolio/${album.id}/medium/${coverPhoto}.avif 1200w" sizes="(max-width: 1024px) 50vw, 33vw">
          <source type="image/webp" srcset="assets/portfolio/${album.id}/thumbs/${coverPhoto}.webp 200w, assets/portfolio/${album.id}/medium/${coverPhoto}.webp 1200w" sizes="(max-width: 1024px) 50vw, 33vw">
          <img src="assets/portfolio/${album.id}/thumbs/${coverPhoto}.jpg" alt="${album.title || album.id}" loading="lazy">
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
