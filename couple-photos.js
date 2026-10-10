(() => {
  'use strict';
  const imageStates = new WeakMap();
  function watchImage(img) {
    const state = {
      src: img.getAttribute('src') || img.dataset.src,
      srcset: img.getAttribute('srcset') || img.dataset.srcset,
      retries: 0, failed: false, waiters: []
    };
    imageStates.set(img, state);
    function finish(error) {
      state.failed = Boolean(error);
      state.waiters.splice(0).forEach(([resolve, reject]) => error ? reject(error) : resolve());
    }
    function retry() {
      // A missing src on an unopened back is intentional; never load it here.
      const current = img.currentSrc || img.getAttribute('src');
      if (!current) return;
      if (state.retries === 0) {
        state.retries = 1;
        const url = new URL(current, document.baseURI);
        url.searchParams.set('image_retry', '1');
        img.src = url.href;
        img.removeAttribute('srcset');
      } else if (state.retries === 1 && img.dataset.originalSrc) {
        state.retries = 2;
        img.src = img.dataset.originalSrc;
        img.removeAttribute('srcset');
      } else {
        finish(new Error('Image could not be loaded'));
      }
    }
    img.addEventListener('load', () => finish());
    img.addEventListener('error', retry);
    if (img.getAttribute('src') && img.complete && !img.naturalWidth) retry();
  }
  document.querySelectorAll('img[data-original-src]').forEach(watchImage);

  function readyImage(img) {
    if (img.complete && img.naturalWidth) return Promise.resolve();
    const state = imageStates.get(img);
    return new Promise((resolve, reject) => {
      state.waiters.push([resolve, reject]);
      if (!img.getAttribute('src') || state.failed) {
        state.retries = 0;
        state.failed = false;
        img.loading = 'eager';
        if (state.srcset) img.srcset = state.srcset;
        img.src = state.src;
      }
    });
  }
  document.querySelectorAll('.couple-album .photo-flip-button').forEach(button => {
    const front = button.querySelector('.photo-face-front');
    const back = button.querySelector('.photo-face-back');
    // Optimized dimensions already account for orientation. Prefer them to
    // density-rounded natural dimensions so every srcset keeps the same ratio.
    [[front, '--photo-front-ratio'], [back, '--photo-back-ratio']].forEach(([face, property]) => {
      const img = face.querySelector('img');
      const updateRatio = () => {
        const width = Number(img.getAttribute('width')) || img.naturalWidth;
        const height = Number(img.getAttribute('height')) || img.naturalHeight;
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
        const frontImage = front.querySelector('img');
        if (!frontImage.complete || !frontImage.naturalWidth) {
          await readyImage(frontImage);
          button.removeAttribute('title');
          showBack(false);
          return;
        }
        // load events also work in browsers without HTMLImageElement.decode().
        // Automatic retries must finish before we reveal the back.
        await readyImage(img);
        button.removeAttribute('title');
        showBack(true);
      } catch (_) {
        // Keep the front visible and permit another click to retry.
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
