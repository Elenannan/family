(() => {
  'use strict';
  document.querySelectorAll('.couple-album .photo-flip-button').forEach(button => {
    const front = button.querySelector('.photo-face-front');
    const back = button.querySelector('.photo-face-back');
    function showBack(flipped) {
      button.setAttribute('aria-pressed', String(flipped));
      button.setAttribute('aria-label', button.dataset.photoName + (flipped ? '：当前为原图，点击翻回拍立得' : '：点击翻到原图'));
      front.setAttribute('aria-hidden', String(flipped));
      back.setAttribute('aria-hidden', String(!flipped));
    }
    showBack(false);
    button.addEventListener('click', () => showBack(button.getAttribute('aria-pressed') !== 'true'));
  });
  document.getElementById('file-location')?.addEventListener('click', () => {
    let path = location.pathname;
    try { path = decodeURIComponent(path); } catch {}
    const status = document.getElementById('editor-status');
    const folder = document.getElementById('main')?.dataset.photoFolder || '二人照片';
    if (status) status.textContent = '当前文件：' + path + '。照片位于同目录的“' + folder + '”文件夹。';
  });
})();
