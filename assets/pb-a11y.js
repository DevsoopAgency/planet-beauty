/**
 * Planet Beauty — ADA patches for app-injected markup (Boost, Rebuy, OneTrust).
 * Theme liquid cannot name those nodes; this observer labels them after render.
 * Safe to remove with pb-a11y.css.
 */
(function () {
  var QUICK_VIEW = 'Quick view';
  var NEXT_PAGE = 'Next page';
  var PREV_PAGE = 'Previous page';

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

    /* Hover/swap image duplicates the main product alt — decorative. */
    scope.querySelectorAll('.boost-sd__product-image-img--second').forEach(function (img) {
      if (img.getAttribute('alt')) img.setAttribute('alt', '');
    });

    /* Rebuy FBT: empty checkbox / swatch labels and unlabeled variant <select>. */
    scope.querySelectorAll('.rebuy-checkbox-label').forEach(function (label) {
      if (label.textContent.trim()) return;
      var block = label.closest('.rebuy-product-block');
      var title = block && block.querySelector('.rebuy-product-title');
      var span = document.createElement('span');
      span.className = 'visually-hidden';
      span.textContent = title ? 'Include ' + title.textContent.trim() : 'Include this item';
      label.appendChild(span);
    });

    scope.querySelectorAll('select.rebuy-select').forEach(function (select) {
      if (select.id && document.querySelector('label[for="' + select.id + '"]')) return;
      if (select.getAttribute('aria-label')) return;
      var block = select.closest('.rebuy-product-block');
      var title = block && block.querySelector('.rebuy-product-title');
      select.setAttribute('aria-label', title ? 'Variant for ' + title.textContent.trim() : 'Product variant');
    });

    scope.querySelectorAll('label.rebuy-color-label').forEach(function (label) {
      if (label.textContent.trim()) return;
      var text = label.getAttribute('title') || label.getAttribute('aria-label');
      if (!text) return;
      var span = document.createElement('span');
      span.className = 'visually-hidden';
      span.textContent = text;
      label.appendChild(span);
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
