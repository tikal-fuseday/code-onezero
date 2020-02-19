import {html, LitElement} from 'https://unpkg.com/lit-element@2.2.1/lit-element.js?module';
import './results.js';

const getData = async (query) => {
    console.log(query);
    const r = await fetch('https://tikal-code-wiki.herokuapp.com/rpc/fn_search', {
        body: JSON.stringify({
            search_term: query.trim(),
        }),
        headers: {
            'Content-Type': 'application/json'
        },
        method: 'POST',
    });
    return await r.json();
}

class Ortal extends LitElement {
    constructor() {
        super();
        this.items = [];
    }

    static get properties() {
        return {
            query: {
                type: String,
                reflect: true
            },
            items: {
                type: Array,
                reflect: false
            }
        };
    }

    doSearch(value) {
        this.query = value;
        
        // const returnObject = [
        //     {
        //         fileName: 'fileName1',
        //         repName: 'repName',
        //         comment: 'comment',
        //         line: 'line',
        //         tags: ['tag1', 'tag2', 'tag3'],
        //         type: 'function',
        //         score: 1
        //     },
        //     {
        //         fileName: 'fileName2',
        //         repName: 'repName',
        //         comment: 'comment',
        //         line: 'line',
        //         tags: ['tag1', 'tag2', 'tag3'],
        //         type: 'class',
        //         score: 5
        //     },
        //     {
        //         fileName: 'fileName3',
        //         repName: 'repName',
        //         comment: 'comment',
        //         line: 'line',
        //         tags: ['tag1', 'tag2', 'tag3'],
        //         type: 'class',
        //         score: 3
        //     },
        //     {
        //         fileName: 'fileName4',
        //         repName: 'repName',
        //         comment: 'comment',
        //         line: 'line',
        //         tags: ['tag1', 'tag2', 'tag3'],
        //         type: 'class',
        //         score: 2
        //     }
        // ];
        getData(value).then((items) => this.items = items);
        // returnObject.sort((a, b) => {
        //     return a.score - b.score;
        //   });
        // this.items = returnObject;
    }

    render() {
        return html`
        <style>
        @import url(style.css);
        :host {
            display: block;
        }
    </style>
            <h1>Code OneZero</h1>
            <h2>By: Avichay, Ortal, Nitzan, Alex, Stav, Moti</h2>
            <input
                @change=${e => this.doSearch(e.target.value)}
                type="search">
                ${this.query && html`<div class='resultFor'>${this.items.length} Results for "${this.query}"</div>`}
                <my-results .items=${this.items} />
        `;
    }

    updated(changes) {
        console.log('changed', changes, this.items);
    }
}

customElements.define('onezero-app', Ortal);