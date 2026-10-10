(() => {
  'use strict';
  document.querySelectorAll('.couple-album .photo-flip-button').forEach(button => {
    const front = button.querySelector('.photo-face-front');
    const back = button.querySelector('.photo-face-back');
    // Browser dimensions account for the image's orientation metadata.
    [[front, '--photo-front-ratio'], [back, '--photo-back-ratio']].forEach(([face, property]) => {
      const img = face.querySelector('img');
      const updateRatio = () => {
        const width = img.naturalWidth || Number(img.getAttribute('width'));
        const height = img.naturalHeight || Number(img.getAttribute('height'));
        if (width > 0 && height > 0) button.style.setProperty(property, `${width} / ${height}`);
      };
      img.addEventListener('load', updateRatio);
      updateRatio();
    });
    function showBack(flipped) {
      button.setAttribute('aria-pressed', String(flipped));
      button.setAttribute('aria-label', button.dataset.photoName + (flipped ? '：当前为原图，点击翻回拍立得' : '：点击翻到原图'));
      front.setAttribute('aria-hidden', String(flipped));
      back.setAttribute('aria-hidden', String(!flipped));
    }
    showBack(false);
    let loading = false;
    button.addEventListener('click', async () => {
      if (loading) return;
      if (button.getAttribute('aria-pressed') === 'true') {
        showBack(false);
        return;
      }
      const img = back.querySelector('img');
      loading = true;
      button.setAttribute('aria-busy', 'true');
      try {
        if (!img.getAttribute('src')) {
          // No back-face request until this photo is explicitly flipped.
          img.loading = 'eager';
          img.srcset = img.dataset.srcset;
          img.src = img.dataset.src;
        }
        await img.decode();
        button.removeAttribute('title');
        showBack(true);
      } catch (_) {
        // Keep the front visible and permit another click to retry.
        img.removeAttribute('srcset');
        img.removeAttribute('src');
        button.title = '原图暂未加载成功，请再点一次重试';
        button.setAttribute('aria-label', button.dataset.photoName + '：原图暂未加载成功，请再点一次重试');
      } finally {
        loading = false;
        button.removeAttribute('aria-busy');
      }
    });
  });
  document.getElementById('file-location')?.addEventListener('click', () => {
    let path = location.pathname;
    try { path = decodeURIComponent(path); } catch {}
    const status = document.getElementById('editor-status');
    const folder = document.getElementById('main')?.dataset.photoFolder || '二人照片';
    if (status) status.textContent = '当前文件：' + path + '。照片位于同目录的“' + folder + '”文件夹。';
  });
})();
