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

    /* Boost titles are lowercase + inline text-transform: capitalize, so the
       code after "Item No." renders as "Babntchv15". Uppercase the code only.
       Edits the text node in place so Boost's React tree stays intact. */
    scope.querySelectorAll('.boost-sd__product-title').forEach(function (title) {
      title.childNodes.forEach(function (node) {
        if (node.nodeType !== 3) return;
        var fixed = node.data.replace(/(item\s+no\.?\s*)([a-z0-9][a-z0-9\-\/.]*)/gi, function (m, label, code) {
          return label + code.toUpperCase();
        });
        if (fixed !== node.data) node.data = fixed;
      });
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

    /* Hidden slideshow slides were aria-hidden but still tabbable.
       Resource-list cards (Shop by Category) stay clickable while peeking —
       the last slide never clears the slideshow's 70% visibility bar. */
    document.querySelectorAll('slideshow-slide').forEach(function (slide) {
      if (slide.closest('.resource-list__carousel')) {
        if (slide.getAttribute('aria-hidden') !== 'true') slide.removeAttribute('inert');
        return;
      }
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

/* ==========================================================================
   ADA Step 1 (Oct 26, 2026) — built on the duplicate theme only.
   #1 Rebuy cart drawer inert when closed, #3 variant change announced,
   #4 Boost card links/buttons name the product, #5 Boost sale/regular price
   labels, #10 Boost filter toggles expose open/closed, #11 cart count announced.
   Rollback: restore the previous pb-a11y.js (saved as orig/pb-a11y.js).
   ========================================================================== */
(function () {
  if (window.__pbAdaStep1) return;
  window.__pbAdaStep1 = true;

  /* ---------- shared polite live region ---------- */
  var live;
  function liveRegion() {
    if (live && document.body.contains(live)) return live;
    live = document.createElement('div');
    live.id = 'pb-a11y-status';
    live.className = 'visually-hidden';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    document.body.appendChild(live);
    return live;
  }
  var announceTimer;
  function announce(msg) {
    if (!msg) return;
    var el = liveRegion();
    clearTimeout(announceTimer);
    el.textContent = '';
    announceTimer = setTimeout(function () { el.textContent = msg; }, 120);
  }
  function srSpan(text) {
    var s = document.createElement('span');
    s.className = 'visually-hidden pb-sr';
    s.textContent = text;
    return s;
  }
  function clean(t) {
    return (t || '').replace(/\s+/g, ' ').replace(/\s*\(\$[\d,.]+\s*value\)/i, '').trim();
  }

  /* ---------- #4 + #5 Boost product cards ---------- */
  function fixBoostCards(scope) {
    scope.querySelectorAll('.boost-sd__product-item').forEach(function (card) {
      var img = card.querySelector('.boost-sd__product-image-img--main');
      var alt = img && img.getAttribute('alt');
      var tEl = card.querySelector('.boost-sd__product-title');
      var title = clean(alt && !/_/.test(alt) ? alt.split(' / ')[0] : (tEl && tEl.textContent));
      if (!title) return;
      var imgLink = card.querySelector('a.boost-sd__product-link-image');
      if (imgLink && imgLink.getAttribute('aria-label') !== title) imgLink.setAttribute('aria-label', title);
      var atc = card.querySelector('.boost-sd__btn-add-to-cart');
      if (atc) {
        var a = 'Add ' + title + ' to cart';
        if (atc.getAttribute('aria-label') !== a) atc.setAttribute('aria-label', a);
      }
      var qv = card.querySelector('.boost-sd__btn-quick-view');
      if (qv) {
        var q = 'Quick view: ' + title;
        if (qv.getAttribute('aria-label') !== q) qv.setAttribute('aria-label', q);
      }
      var priceWrap = card.querySelector('.boost-sd__product-price-content');
      if (priceWrap) {
        var compare = priceWrap.querySelector('.boost-sd__format-currency--price-compare');
        if (compare) {
          if (!compare.querySelector('.pb-sr')) compare.insertBefore(srSpan('Regular price '), compare.firstChild);
          var sale = [].filter.call(priceWrap.querySelectorAll('.boost-sd__format-currency'), function (n) {
            return !n.classList.contains('boost-sd__format-currency--price-compare');
          })[0];
          if (sale && !sale.querySelector('.pb-sr')) sale.insertBefore(srSpan('Sale price '), sale.firstChild);
        }
      }
    });
  }

  /* ---------- #10 Boost filter toggles ---------- */
  function fixBoostFilters(scope) {
    scope.querySelectorAll('.boost-sd__filter-option-title').forEach(function (btn) {
      var label = btn.closest('.boost-sd__filter-option-label');
      if (!label) return;
      var open = !label.classList.contains('boost-sd__filter-option-label--collapsed');
      var v = open ? 'true' : 'false';
      if (btn.getAttribute('aria-expanded') !== v) btn.setAttribute('aria-expanded', v);
    });
  }

  /* ---------- #1 Rebuy cart drawer: not reachable by Tab while closed ---------- */
  function rebuyOpen(el) {
    if (el.getAttribute('aria-hidden') === 'false') return true;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return /\b(is-visible|visible|rebuy-cart--open|open)\b/.test(el.className);
  }
  function fixRebuyDrawer() {
    var el = document.getElementById('rebuy-cart');
    if (!el) return;
    if (rebuyOpen(el)) {
      if (el.hasAttribute('inert')) el.removeAttribute('inert');
    } else if (!el.hasAttribute('inert')) {
      el.setAttribute('inert', '');
    }
  }

  /* ---------- #11 cart count announced ---------- */
  var lastCount = null;
  function readCartCount() {
    var el = document.querySelector('[ref="cartBubbleCount"]');
    if (!el) return null;
    var n = parseInt((el.textContent || '').trim(), 10);
    if (isNaN(n)) n = parseInt(el.getAttribute('data-minicart-count') || '0', 10) || 0;
    return n;
  }
  function watchCartCount() {
    var n = readCartCount();
    if (n === null) return;
    if (lastCount === null) { lastCount = n; return; }
    if (n !== lastCount) {
      lastCount = n;
      announce('Cart updated: ' + n + (n === 1 ? ' item' : ' items'));
    }
  }

  /* ---------- #3 variant change announced (price + stock) ---------- */
  document.addEventListener('variant:update', function (e) {
    var section = (e.target && e.target.closest && e.target.closest('.shopify-section')) || document;
    var variant = e.detail && e.detail.resource;
    setTimeout(function () {
      var price = section.querySelector('[ref="priceContainer"]');
      var text = '';
      if (price) {
        var c = price.cloneNode(true);
        c.querySelectorAll('.price__hidden, .volume-pricing-note').forEach(function (n) { n.remove(); });
        text = c.textContent.replace(/\s+/g, ' ').trim();
      }
      var stock = '';
      if (variant && typeof variant.available === 'boolean') stock = variant.available ? 'In stock' : 'Sold out';
      var inv = section.querySelector('.product-inventory__status, [class*="product-inventory"]');
      if (inv && inv.textContent.trim()) stock = inv.textContent.replace(/\s+/g, ' ').trim();
      announce([text, stock].filter(Boolean).join('. '));
    }, 350);
  });

  /* ---------- run + observe ---------- */
  function runAll() {
    fixBoostCards(document);
    fixBoostFilters(document);
    fixRebuyDrawer();
    watchCartCount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runAll);
  else runAll();
  if (window.MutationObserver) {
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; runAll(); });
    }).observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['class', 'aria-hidden']
    });
  }
})();
