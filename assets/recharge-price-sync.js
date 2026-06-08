import { ThemeEvents } from '@theme/events';

/** @type {WeakSet<HTMLElement>} */
const boundWidgets = new WeakSet();

/**
 * @param {string} text
 * @returns {string}
 */
function extractPrice(text) {
  const match = text.match(/\$[\d,]+(?:\.\d{2})?/);
  return match ? match[0] : text.trim();
}

/**
 * @param {Element} widget
 */
function getRechargePrices(widget) {
  const subscriptionInput = widget.querySelector('input[name="purchaseOption"][value="subscription"]');
  const isSubscription = subscriptionInput instanceof HTMLInputElement && subscriptionInput.checked;

  const onetimeLabel = widget.querySelector('.onetime-radio .rc-radio__label');
  const subscriptionPriceEl = widget.querySelector('.subscription-radio .rc-radio__price');

  const onetime = extractPrice(onetimeLabel?.textContent ?? '');
  const subscription = extractPrice(subscriptionPriceEl?.textContent ?? '');

  return { isSubscription, onetime, subscription };
}

/**
 * @param {Element} priceContainer
 * @param {string} price
 * @param {string | null} compareAt
 */
function applyPriceToContainer(priceContainer, price, compareAt = null) {
  const regularBlock = priceContainer.querySelector('.price__regular');
  const saleBlock = priceContainer.querySelector('.price__sale');

  if (compareAt) {
    regularBlock?.classList.add('price__hidden');
    saleBlock?.classList.remove('price__hidden');

    const salePrice = saleBlock?.querySelector('.price-item--sale.price, .price');
    const comparePrice = saleBlock?.querySelector('.compare-at-price');

    if (salePrice) salePrice.textContent = price;
    if (comparePrice) comparePrice.textContent = compareAt;
    return;
  }

  saleBlock?.classList.add('price__hidden');
  regularBlock?.classList.remove('price__hidden');

  const priceEl = regularBlock?.querySelector('.price');
  if (priceEl) priceEl.textContent = price;
}

/**
 * @param {Element} section
 * @param {string} price
 * @param {string | null} compareAt
 */
function updateSectionPrices(section, price, compareAt = null) {
  const containers = section.querySelectorAll(
    'product-price [ref="priceContainer"], .sticky-add-to-cart__price [ref="priceContainer"]'
  );

  containers.forEach((priceContainer) => {
    if (priceContainer.querySelector('.volume-pricing-note')) return;
    applyPriceToContainer(priceContainer, price, compareAt);
  });
}

/**
 * @param {Element} widget
 */
function syncPricesForWidget(widget) {
  const section = widget.closest('.shopify-section');
  if (!section) return;

  const { isSubscription, onetime, subscription } = getRechargePrices(widget);

  if (isSubscription && subscription) {
    updateSectionPrices(section, subscription, onetime || null);
    return;
  }

  if (onetime) {
    updateSectionPrices(section, onetime, null);
  }
}

/**
 * @param {Element} widget
 */
function bindRechargeWidget(widget) {
  if (boundWidgets.has(/** @type {HTMLElement} */ (widget))) return;
  boundWidgets.add(/** @type {HTMLElement} */ (widget));

  widget.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.name !== 'purchaseOption') return;
    syncPricesForWidget(widget);
  });

  widget.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('.rc-radio')) return;
    requestAnimationFrame(() => syncPricesForWidget(widget));
  });

  syncPricesForWidget(widget);
}

function initRechargeWidgets() {
  document.querySelectorAll('.rc-widget, [id^="RechargeWidget_"]').forEach((widget) => {
    bindRechargeWidget(widget);
  });
}

function handleVariantUpdate(event) {
  const section =
    event.target instanceof Element ? event.target.closest('.shopify-section') : null;
  if (!section) return;

  window.setTimeout(() => {
    section.querySelectorAll('.rc-widget, [id^="RechargeWidget_"]').forEach((widget) => {
      syncPricesForWidget(widget);
    });
  }, 150);
}

initRechargeWidgets();

const widgetObserver = new MutationObserver(() => {
  initRechargeWidgets();
});
widgetObserver.observe(document.body, { childList: true, subtree: true });

document.addEventListener(ThemeEvents.variantUpdate, handleVariantUpdate);
