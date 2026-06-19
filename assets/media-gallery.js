import { Component } from '@theme/component';
import { ThemeEvents, VariantUpdateEvent, ZoomMediaSelectedEvent } from '@theme/events';

/**
 * A custom element that renders a media gallery.
 *
 * @typedef {object} Refs
 * @property {import('./zoom-dialog').ZoomDialog} [zoomDialogComponent] - The zoom dialog component.
 * @property {import('./slideshow').Slideshow} [slideshow] - The slideshow component.
 * @property {HTMLElement[]} [media] - The media elements.
 *
 * @extends Component<Refs>
 */
export class MediaGallery extends Component {
  connectedCallback() {
    super.connectedCallback();

    const { signal } = this.#controller;
    const target = this.closest('.shopify-section, dialog');

    target?.addEventListener(ThemeEvents.variantUpdate, this.#handleVariantUpdate, { signal });
    this.refs.zoomDialogComponent?.addEventListener(ThemeEvents.zoomMediaSelected, this.#handleZoomMediaSelected, {
      signal,
    });
  }

  #controller = new AbortController();

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#controller.abort();
  }

  /**
   * Handles a variant update event by replacing the current media gallery with a new one.
   *
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  #handleVariantUpdate = (event) => {
    const source = event.detail.data.html;

    if (!source) return;
    const newMediaGallery = source.querySelector('media-gallery');

    if (!newMediaGallery) return;

    this.replaceWith(newMediaGallery);
  };

  /**
   * Handles the 'zoom-media:selected' event.
   * @param {ZoomMediaSelectedEvent} event - The zoom-media:selected event.
   */
  #handleZoomMediaSelected = async (event) => {
    const galleryIndex = this.#findGalleryIndexByMediaId(
      this.#getMediaIdFromZoomIndex(event.detail.index)
    );

    if (galleryIndex === -1) return;

    this.slideshow?.select(galleryIndex, undefined, { animate: false });
  };

  /**
   * Resolves a zoom-dialog media id from a zoom lightbox index.
   * @param {number} zoomIndex
   * @returns {string | undefined}
   */
  #getMediaIdFromZoomIndex(zoomIndex) {
    const zoomItem = this.refs.zoomDialogComponent?.refs.media[zoomIndex];
    if (!(zoomItem instanceof HTMLElement)) return undefined;

    return zoomItem.dataset.mediaId || zoomItem.querySelector('[data-media-id]')?.dataset.mediaId;
  }

  /**
   * Finds the main gallery index for a media id (variant-filtered gallery may omit some images).
   * @param {string | undefined} mediaId
   * @returns {number}
   */
  #findGalleryIndexByMediaId(mediaId) {
    if (!mediaId) return -1;

    if (this.presentation === 'carousel') {
      const slides = this.slideshow?.slides ?? [];

      return slides.findIndex(
        (slide) =>
          slide instanceof HTMLElement &&
          (slide.dataset.mediaId === mediaId || slide.querySelector(`[data-media-id="${mediaId}"]`))
      );
    }

    const items = this.refs.media ?? [];

    return items.findIndex(
      (item) =>
        item instanceof HTMLElement &&
        (item.dataset.mediaId === mediaId || item.querySelector(`[data-media-id="${mediaId}"]`))
    );
  }

  /**
   * Zooms the media gallery.
   *
   * @param {number} index - The index of the media to zoom.
   * @param {PointerEvent} event - The pointer event.
   */
  zoom(index, event) {
    this.refs.zoomDialogComponent?.open(index, event);
  }

  /**
   * Preloads an image.
   * @param {number} index - The index of the media to preload.
   */
  preloadImage(index) {
    const zoomDialogMedia = this.refs.zoomDialogComponent?.refs.media[index];
    if (!zoomDialogMedia) return;

    this.refs.zoomDialogComponent?.loadHighResolutionImage(zoomDialogMedia);
  }

  get slideshow() {
    return this.refs.slideshow;
  }

  get media() {
    return this.refs.media;
  }

  get presentation() {
    return this.dataset.presentation;
  }
}

if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', MediaGallery);
}
