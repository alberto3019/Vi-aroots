(function () {
  var LB_ID = 'vr-lightbox';
  var CLOSE_MS = 480;

  function ensureLightbox() {
    if (document.getElementById(LB_ID)) return;
    var lb = document.createElement('div');
    lb.id = LB_ID;
    lb.className = 'vr-lightbox';
    lb.setAttribute('aria-hidden', 'true');
    lb.innerHTML =
      '<div class="vr-lightbox__backdrop"></div>' +
      '<button type="button" class="vr-lightbox__close" aria-label="Cerrar">&times;</button>' +
      '<figure class="vr-lightbox__frame"><img alt=""></figure>';
    document.body.appendChild(lb);

    var img = lb.querySelector('.vr-lightbox__frame img');
    var frame = lb.querySelector('.vr-lightbox__frame');
    var backdrop = lb.querySelector('.vr-lightbox__backdrop');
    var btnClose = lb.querySelector('.vr-lightbox__close');

    function close() {
      if (!lb.classList.contains('is-open')) return;
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      window.setTimeout(function () {
        if (!lb.classList.contains('is-open')) {
          img.removeAttribute('src');
          img.removeAttribute('srcset');
          img.alt = '';
        }
      }, CLOSE_MS);
    }

    function openFromThumb(thumbBtn) {
      var sm = thumbBtn.querySelector('img');
      if (!sm || !sm.getAttribute('src')) return;
      img.src = sm.currentSrc || sm.src;
      img.alt = sm.getAttribute('alt') || '';
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          lb.classList.add('is-open');
        });
      });
    }

    backdrop.addEventListener('click', close);
    btnClose.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lb.classList.contains('is-open')) close();
    });

    document.body.addEventListener('click', function (e) {
      var thumb = e.target.closest('.lb-thumb');
      if (!thumb) return;
      e.preventDefault();
      openFromThumb(thumb);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureLightbox);
  } else {
    ensureLightbox();
  }
})();
