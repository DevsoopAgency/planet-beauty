/**
 * Planet Beauty — ADA patches for app-injected markup (Boost, Rebuy, UserWay).
 * Theme liquid cannot name those nodes; this observer labels them after render.
 * Does not touch #rebuy-cart / .rebuy-cart (Rebuy cart is configured in Rebuy).
 * Safe to remove with pb-a11y.css.
 */
(function () {
  var QUICK_VIEW = 'Quick view';
  var NEXT_PAGE = 'Next page';
  var PREV_PAGE = 'Previous page';

  function inRebuyCart(el) {
    return !!(el && el.closest && el.closest('#rebuy-cart, .rebuy-cart'));
  }

  function name(el, label) {
    if (!el || el.getAttribute('aria-label')) return;
    el.setAttribute('aria-label', label);
  }

  function decorate(root) {
    var scope = root && root.querySelectorAll ? root : document;

    scope.querySelectorAll('.boost-sd__btn-quick-view').forEach(function (btn) {
      name(btn, QUICK_VIEW);
    });

    scope.querySelectorAll('.boost-sd__pagination-button--next').forEach(function (btn) {
      name(btn, NEXT_PAGE);
    });

    scope.querySelectorAll('.boost-sd__pagination-button--previous, .boost-sd__pagination-button--prev').forEach(function (btn) {
      name(btn, PREV_PAGE);
    });

    scope.querySelectorAll('.boost-sd__product-image-img--second').forEach(function (img) {
      if (img.getAttribute('alt')) img.setAttribute('alt', '');
    });

    /* Filename-like alts (F30): Marvis_Whitening_Mint_Toothpaste_75ml */
    scope.querySelectorAll('img[alt]').forEach(function (img) {
      var alt = img.getAttribute('alt') || '';
      if (!alt || /\s/.test(alt)) return;
      if (alt.indexOf('_') === -1 && !/\.(jpe?g|png|gif|webp|svg)$/i.test(alt)) return;
      img.setAttribute(
        'alt',
        alt.replace(/_/g, ' ').replace(/\.(jpe?g|png|gif|webp|svg)$/i, '').trim()
      );
    });

    /* UserWay decorative wheel: alt="" + role=presentation is invalid. */
    scope.querySelectorAll('img[data-uw-rm-ignore][alt=""][role]').forEach(function (img) {
      img.removeAttribute('role');
    });

    /* listbox cannot have aria-expanded */
    scope.querySelectorAll('.predictive-search-dropdown[aria-expanded]').forEach(function (el) {
      el.removeAttribute('aria-expanded');
    });

    /* Hidden slideshow slides were aria-hidden but still tabbable. */
    document.querySelectorAll('slideshow-slide').forEach(function (slide) {
      if (slide.getAttribute('aria-hidden') === 'true') {
        slide.setAttribute('inert', '');
      } else {
        slide.removeAttribute('inert');
      }
    });

    /* Rebuy homepage cards: aria-label on a generic div. Skip cart. */
    scope.querySelectorAll('.rebuy-product-block[aria-label]').forEach(function (el) {
      if (inRebuyCart(el)) return;
      el.setAttribute('role', 'group');
    });

    scope.querySelectorAll('.rebuy-checkbox-label').forEach(function (label) {
      if (inRebuyCart(label) || label.textContent.trim()) return;
      var block = label.closest('.rebuy-product-block');
      var title = block && block.querySelector('.rebuy-product-title');
      var span = document.createElement('span');
      span.className = 'visually-hidden';
      span.textContent = title ? 'Include ' + title.textContent.trim() : 'Include this item';
      label.appendChild(span);
    });

    scope.querySelectorAll('select.rebuy-select').forEach(function (select) {
      if (inRebuyCart(select)) return;
      if (select.id && document.querySelector('label[for="' + select.id + '"]')) return;
      if (select.getAttribute('aria-label')) return;
      var block = select.closest('.rebuy-product-block');
      var title = block && block.querySelector('.rebuy-product-title');
      select.setAttribute('aria-label', title ? 'Variant for ' + title.textContent.trim() : 'Product variant');
    });

    scope.querySelectorAll('label.rebuy-color-label').forEach(function (label) {
      if (inRebuyCart(label) || label.textContent.trim()) return;
      var text = label.getAttribute('title') || label.getAttribute('aria-label');
      if (!text) return;
      var span = document.createElement('span');
      span.className = 'visually-hidden';
      span.textContent = text;
      label.appendChild(span);
    });

    scope.querySelectorAll('.flickity-prev-next-button, .flickity-button').forEach(function (btn) {
      if (inRebuyCart(btn) || btn.getAttribute('aria-label')) return;
      if (btn.classList.contains('previous')) name(btn, 'Previous');
      else if (btn.classList.contains('next')) name(btn, 'Next');
    });
  }

  function run() {
    decorate(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  if (window.MutationObserver) {
    var scheduled = false;
    new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        run();
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
