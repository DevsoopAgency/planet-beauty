if (!customElements.get('grid-slider-component')) {
  class GridSliderComponent extends HTMLElement {
    #track = null;
    #inner = null;
    #arrows = null;
    #prevBtn = null;
    #nextBtn = null;
    #mqs = {};
    #onScroll = null;
    #onChange = null;

    connectedCallback() {
      this.#track = this.querySelector('[data-gs-ref="track"]');
      this.#inner = this.querySelector('[data-gs-ref="inner"]');
      this.#arrows = this.querySelector('[data-gs-ref="arrows"]');
      this.#prevBtn = this.querySelector('[data-gs-ref="prevBtn"]');
      this.#nextBtn = this.querySelector('[data-gs-ref="nextBtn"]');

      if (!this.#track) return;

      this.#prevBtn?.addEventListener('click', () => this.#scrollBy('prev'));
      this.#nextBtn?.addEventListener('click', () => this.#scrollBy('next'));

      this.#onScroll = () => this.#updateButtons();
      this.#track.addEventListener('scroll', this.#onScroll, { passive: true });

      this.#mqs = {
        mobile: window.matchMedia('(max-width: 749px)'),
        tablet: window.matchMedia('(min-width: 750px) and (max-width: 1199px)'),
        desktop: window.matchMedia('(min-width: 1200px)'),
      };

      this.#onChange = () => this.#update();
      Object.values(this.#mqs).forEach((mq) => mq.addEventListener('change', this.#onChange));

      this.#update();
    }

    disconnectedCallback() {
      Object.values(this.#mqs).forEach((mq) => mq.removeEventListener('change', this.#onChange));
      this.#track?.removeEventListener('scroll', this.#onScroll);
    }

    #isSliderActive() {
      return (
        (this.#mqs.mobile?.matches && this.hasAttribute('mobile-slider')) ||
        (this.#mqs.tablet?.matches && this.hasAttribute('tablet-slider')) ||
        (this.#mqs.desktop?.matches && this.hasAttribute('desktop-slider'))
      );
    }

    #update() {
      const active = this.#isSliderActive();
      const hasGutters = this.hasAttribute('has-gutters');

      this.#track.classList.toggle('grid-slider__track--slider', active);
      this.#inner?.classList.toggle('grid-slider__inner--full-bleed', active && hasGutters);
      this.#arrows?.classList.toggle('grid-slider__arrows--visible', active);

      if (active) {
        this.#updateButtons();
      } else {
        // Snap back to start when switching from slider → grid
        this.#track.scrollLeft = 0;
        if (this.#prevBtn) this.#prevBtn.disabled = true;
        if (this.#nextBtn) this.#nextBtn.disabled = false;
      }
    }

    #scrollBy(direction) {
      // Scroll by one "page" — the visible width of the track
      const amount = this.#track.offsetWidth;
      this.#track.scrollBy({
        left: direction === 'next' ? amount : -amount,
        behavior: 'smooth',
      });
    }

    #updateButtons() {
      if (!this.#isSliderActive()) return;
      const { scrollLeft, scrollWidth, offsetWidth } = this.#track;
      if (this.#prevBtn) this.#prevBtn.disabled = scrollLeft <= 1;
      if (this.#nextBtn) this.#nextBtn.disabled = scrollLeft >= scrollWidth - offsetWidth - 1;
    }
  }

  customElements.define('grid-slider-component', GridSliderComponent);
}
