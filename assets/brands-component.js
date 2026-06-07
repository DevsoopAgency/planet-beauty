/**
 * Brands component
 * 
 * @module brands
 * @version 1.0.0
 * @extends HTMLElement
 */
class brandsComponent extends HTMLElement {

    /**
     * Brands web component.
     * 
     * @constructor
     */
    constructor() {

        super();

        this.initEvents();
    }

    /**
     * Init brands events.
     * 
     * @returns {undefined}
     */
     initEvents() {

        this.querySelectorAll('[data-letter-link]').forEach(letter => {
            letter.addEventListener('click', (event) => {
                event.preventDefault();

                var letterLink = event.target.getAttribute('data-letter-link');
                var element = this.querySelector('[data-letter-group=' + letterLink + ']');

                if(letterLink && element) {

                    var header = document.querySelector('header');

                    if(header) {
                        var top = element.offsetTop - header.offsetHeight - 10;
                        this.scrollToElement(top);
                    }
                }
            });
        });

    }

    /**
     * Scroll event.
     * 
     * @param {object} top value to scroll to.
     * 
     * @returns {undefined}
     */
     scrollToElement(top) {

        window.scrollTo({
            top: top,
            behavior: 'smooth'
        });
    }
}

customElements.define('brands-component', brandsComponent);
