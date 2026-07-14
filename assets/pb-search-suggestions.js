/**
 * pb: live-parity inline predictive search (suggest.json).
 * Opens/closes the shared #pb-search-panel; fetches grouped suggestions.
 */
(function () {
  'use strict';

  if (window.__pbSearchSuggestionsInit) return;
  window.__pbSearchSuggestionsInit = true;

  var DEBOUNCE_MS = 200;
  var GROUP_ORDER = ['products', 'pages', 'articles', 'collections'];
  var SELECTED_CLASS = 'selected-item';

  var panel = null;
  var input = null;
  var resultsEl = null;
  var debounceTimer = null;
  var abortController = null;
  var selectedIndex = -1;
  var isOpen = false;

  function shopifyRoot() {
    if (window.Shopify && Shopify.routes && Shopify.routes.root) {
      return Shopify.routes.root;
    }
    return '/';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getItemImageUrl(item) {
    if (!item) return '';
    if (item.featured_image && typeof item.featured_image === 'object' && item.featured_image.url) {
      return item.featured_image.url;
    }
    if (typeof item.featured_image === 'string' && item.featured_image) return item.featured_image;
    if (item.image && typeof item.image === 'object' && item.image.url) return item.image.url;
    if (typeof item.image === 'string' && item.image) return item.image;
    return '';
  }

  function getItemImageAlt(item) {
    if (!item) return '';
    if (item.featured_image && item.featured_image.alt) return item.featured_image.alt;
    if (item.image && item.image.alt) return item.image.alt;
    return '';
  }

  function getItems() {
    if (!resultsEl) return [];
    return Array.prototype.slice.call(
      resultsEl.querySelectorAll('[data-pb-search-suggestions-item]')
    );
  }

  function clearSelection() {
    selectedIndex = -1;
    getItems().forEach(function (el) {
      el.classList.remove(SELECTED_CLASS);
      el.removeAttribute('data-selected-item');
    });
  }

  function setSelectedIndex(index) {
    var items = getItems();
    if (!items.length) {
      clearSelection();
      return;
    }

    if (index < 0) index = items.length - 1;
    if (index >= items.length) index = 0;
    selectedIndex = index;

    items.forEach(function (el, i) {
      if (i === selectedIndex) {
        el.classList.add(SELECTED_CLASS);
        el.setAttribute('data-selected-item', '');
        ensureItemVisible(el);
      } else {
        el.classList.remove(SELECTED_CLASS);
        el.removeAttribute('data-selected-item');
      }
    });
  }

  function ensureItemVisible(item) {
    if (!resultsEl || !item) return;
    var top = resultsEl.scrollTop;
    var bottom = top + resultsEl.clientHeight;
    var itemTop = item.offsetTop;
    var itemBottom = itemTop + item.offsetHeight;
    if (itemTop < top) {
      resultsEl.scrollTop = itemTop;
    } else if (itemBottom > bottom) {
      resultsEl.scrollTop = itemBottom - resultsEl.clientHeight;
    }
  }

  function hideResults() {
    if (!resultsEl) return;
    resultsEl.innerHTML = '';
    resultsEl.classList.remove('active');
    resultsEl.setAttribute('aria-hidden', 'true');
    clearSelection();
  }

  function showResults(html) {
    if (!resultsEl) return;
    if (!html) {
      hideResults();
      return;
    }
    resultsEl.innerHTML = html;
    resultsEl.classList.add('active');
    resultsEl.setAttribute('aria-hidden', 'false');
    clearSelection();
  }

  function renderGroup(key, items) {
    if (!items || !items.length) return '';

    var rows = items
      .map(function (item) {
        var url = escapeHtml(item.url || '#');
        var title = escapeHtml(item.title || '');
        var imageUrl = getItemImageUrl(item);
        var imageHtml = imageUrl
          ? '<img class="pb-search-suggestions-item__image" src="' +
            escapeHtml(imageUrl) +
            '" alt="' +
            escapeHtml(getItemImageAlt(item)) +
            '" loading="lazy" width="40" height="40">'
          : '';

        return (
          '<li class="pb-search-suggestions-item" data-pb-search-suggestions-item>' +
          '<a class="pb-search-suggestions-item__link" href="' +
          url +
          '" tabindex="-1" data-pb-search-suggestions-item-link>' +
          '<div class="pb-search-suggestions-item__image-wrapper">' +
          imageHtml +
          '</div>' +
          '<div class="pb-search-suggestions-item__text-wrapper">' +
          '<span class="pb-search-suggestions-item__title">' +
          title +
          '</span>' +
          '</div>' +
          '</a>' +
          '</li>'
        );
      })
      .join('');

    return (
      '<div class="pb-search-suggestions">' +
      '<div class="pb-search-suggestions__title">' +
      escapeHtml(key) +
      '</div>' +
      '<ul class="pb-search-suggestions__results">' +
      rows +
      '</ul>' +
      '</div>'
    );
  }

  function renderResults(results) {
    if (!results) return '';
    return GROUP_ORDER.map(function (key) {
      return renderGroup(key, results[key]);
    }).join('');
  }

  function fetchSuggestions(term) {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }

    if (!term) {
      hideResults();
      return;
    }

    var root = shopifyRoot();
    var url =
      root +
      'search/suggest.json?q=' +
      encodeURIComponent(term) +
      '&resources[type]=product,page,article,collection' +
      '&resources[limit]=4' +
      '&resources[options][unavailable_products]=last';

    abortController = new AbortController();
    var signal = abortController.signal;

    fetch(url, { signal: signal })
      .then(function (response) {
        if (!response.ok) throw new Error('suggest failed');
        return response.json();
      })
      .then(function (data) {
        if (!isOpen) return;
        var results = data && data.resources && data.resources.results;
        showResults(renderResults(results));
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
        hideResults();
      });
  }

  function scheduleFetch() {
    clearTimeout(debounceTimer);
    var term = (input && input.value ? input.value : '').trim();
    debounceTimer = setTimeout(function () {
      fetchSuggestions(term);
    }, DEBOUNCE_MS);
  }

  var activeTrigger = null;
  var positionRaf = null;

  function setTriggersExpanded(expanded) {
    document.querySelectorAll('[data-pb-search-open]').forEach(function (btn) {
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  function isVisible(el) {
    return !!(el && el.getClientRects && el.getClientRects().length);
  }

  function getAnchorForTrigger(trigger) {
    if (!trigger) return null;
    var action = trigger.closest('.search-action');
    if (action) {
      var field = action.querySelector('.search-action__field');
      if (field && isVisible(field)) return field;
      if (isVisible(action)) return action;
    }
    return isVisible(trigger) ? trigger : null;
  }

  function clearPanelPosition() {
    if (!panel) return;
    panel.style.top = '';
    panel.style.left = '';
    panel.style.width = '';
    panel.style.minHeight = '';
    panel.classList.remove('pb-search-panel--mobile-row');
  }

  // Live parity: sit on the search field (desktop) / cover the header row (mobile).
  function positionPanel() {
    if (!panel || !isOpen) return;

    var trigger = activeTrigger;
    if (!trigger || !isVisible(trigger)) {
      var triggers = document.querySelectorAll('[data-pb-search-open]');
      for (var i = 0; i < triggers.length; i++) {
        if (isVisible(triggers[i])) {
          trigger = triggers[i];
          break;
        }
      }
    }
    if (!trigger) return;

    var isMobileTrigger =
      trigger.classList.contains('pb-mobile-search') || window.matchMedia('(max-width: 749px)').matches;

    if (isMobileTrigger) {
      var headerRow =
        document.querySelector('#header-component .header__row') ||
        document.querySelector('#header-component') ||
        document.querySelector('header-component');
      if (!headerRow) return;
      var hRect = headerRow.getBoundingClientRect();
      panel.classList.add('pb-search-panel--mobile-row');
      panel.style.top = Math.max(0, hRect.top) + 'px';
      panel.style.left = hRect.left + 'px';
      panel.style.width = hRect.width + 'px';
      panel.style.minHeight = hRect.height + 'px';
      return;
    }

    var anchor = getAnchorForTrigger(trigger);
    if (!anchor) return;

    var rect = anchor.getBoundingClientRect();
    var minWidth = 340;
    var width = Math.max(rect.width, minWidth);
    var left = rect.right - width;
    var gutter = 16;
    if (left < gutter) left = gutter;
    if (left + width > window.innerWidth - gutter) {
      width = Math.max(rect.width, window.innerWidth - gutter - left);
    }

    // Vertically center the ~42px input on the field
    var inputHeight = 42;
    var top = rect.top + (rect.height - inputHeight) / 2;
    if (top < 4) top = 4;

    panel.classList.remove('pb-search-panel--mobile-row');
    panel.style.top = top + 'px';
    panel.style.left = left + 'px';
    panel.style.width = width + 'px';
    panel.style.minHeight = '';
  }

  function schedulePosition() {
    if (positionRaf) cancelAnimationFrame(positionRaf);
    positionRaf = requestAnimationFrame(function () {
      positionRaf = null;
      positionPanel();
    });
  }

  function openPanel(trigger) {
    if (!panel || !input) return;
    activeTrigger = trigger || null;
    panel.classList.add('is-open');
    panel.removeAttribute('hidden');
    panel.setAttribute('aria-hidden', 'false');
    isOpen = true;
    document.documentElement.classList.add('pb-search-open');
    setTriggersExpanded(true);
    positionPanel();
    input.focus();
    if ((input.value || '').trim()) scheduleFetch();
  }

  function closePanel() {
    if (!panel) return;
    clearTimeout(debounceTimer);
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    hideResults();
    panel.classList.remove('is-open');
    panel.setAttribute('hidden', '');
    panel.setAttribute('aria-hidden', 'true');
    isOpen = false;
    activeTrigger = null;
    clearPanelPosition();
    document.documentElement.classList.remove('pb-search-open');
    setTriggersExpanded(false);
  }

  function onDocumentClick(event) {
    if (!isOpen || !panel) return;
    var target = event.target;
    if (panel.contains(target)) return;
    if (target.closest && target.closest('[data-pb-search-open]')) return;
    closePanel();
  }

  function onKeyDown(event) {
    if (!isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
      return;
    }

    if (!input || document.activeElement !== input) return;

    var items = getItems();
    if (event.key === 'ArrowDown') {
      if (!items.length) return;
      event.preventDefault();
      setSelectedIndex(selectedIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      if (!items.length) return;
      event.preventDefault();
      setSelectedIndex(selectedIndex - 1);
      return;
    }

    if (event.key === 'Enter' && selectedIndex >= 0 && items[selectedIndex]) {
      var link = items[selectedIndex].querySelector('[data-pb-search-suggestions-item-link]');
      if (link && link.href) {
        event.preventDefault();
        window.location.href = link.href;
      }
    }
  }

  function bind() {
    panel = document.querySelector('[data-pb-search-panel]');
    if (!panel) return;

    // Reparent so fixed panel isn't trapped in a display:none header slot
    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }

    input = panel.querySelector('[data-pb-search-input]');
    resultsEl = panel.querySelector('[data-pb-search-results]');

    document.querySelectorAll('[data-pb-search-open]').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        if (isOpen) {
          closePanel();
        } else {
          openPanel(btn);
        }
      });
    });

    panel.querySelectorAll('[data-pb-search-close]').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        closePanel();
      });
    });

    if (input) {
      input.addEventListener('input', scheduleFetch);
      input.addEventListener('keydown', function (event) {
        // Keep arrows from moving caret when navigating results
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          if (getItems().length) event.preventDefault();
        }
      });
    }

    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', function () {
      if (isOpen) schedulePosition();
    });
    window.addEventListener(
      'scroll',
      function () {
        if (isOpen) schedulePosition();
      },
      true
    );
  }

  function init() {
    bind();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
