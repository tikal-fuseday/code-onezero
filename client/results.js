import {html, LitElement} from 'https://unpkg.com/lit-element@2.2.1/lit-element.js?module';

class results extends LitElement {
    constructor() {
        super();
        this.items = [];
    }
    static get properties() {
        return {
            items: {
                type: Array
            }
        }
    }
    render () {
        return html`
            <style>
                @import url(style.css);
                :host {
                    display: block;
                }
            </style>
            <div class='results'>${this.items && this.items.map(item => {
                return html`<div class='resultContainer'>
                        <div class='resultRow'>
                            <span class='key'>File Name: </span>
                            <span class='value'>${item.filename}</span>
                        </div>
                        <div class='resultRow'>
                            <span class='key'>Repository Name: </span>
                            <span class='value'>${item.repname}</span>
                        </div>


                        <div class='resultRow'>
                        <span class='key'>Comment: </span>
                        <span class='value'>
                            <details>
                                <summary>...
                                </summary>
                                <pre><code>${item.comment}</code></pre>
                            </details>
                            </span>
                        </div>
                        <div class='resultRow'>
                            <span class='key'>Line: </span>
                            <span class='value'>${item.line}</span>
                        </div>
                        <div class='resultRow'>
                            <span class='key'>Type: </span>
                            <span class='value'>${item.type}</span>
                        </div>
                        <div class='resultRow'>
                            <span class='key'>Score: </span>
                            <span class='value'>${item.score}</span>
                        </div>

                    </div>`
            })}</div>`
    }
}

customElements.define('my-results', results);