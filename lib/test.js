const debug = require('debug')('resker:lib:test')

/**
 * Utilities to help in testing
 */
function TestClientUtils() {
    const clients_manager = new ClientsManager()

    return {
        clients_manager,
        TestClient
    }
}

module.exports = TestClientUtils

/**
 * Represents a unique stocto client with helper functions
 * @typedef TestClient
 * @property {String} client_name
 * @property {String} id
 */
class TestClient {
    constructor(params) {
        this.debug = debug.extend('TestClient')
        if (params.x_api_key) {
            params[ 'x-api-key' ] = params.x_api_key
        }
        this.data = Object.assign({
            client_name: 'stocto-client-' + Math.ceil(Math.random() * 9999)
        }, params)
    }

    get(name) {
        const log = this.debug.extend('get')
        if (name == 'headers') {
            return {
                'x-api-key': this.data[ 'x-api-key' ],
                resker_client: this.data.client_name
            }
        }
        return this.data[ name ]
    }

    set(name, value) {
        this.data[ name ] = value
    }

    toString() {
        return this.client_name
    }



}

class ClientsManager {
    constructor() {
        this.data = []
        this.log = debug.extend('ClientsManager')
    }

    /**
     *
     * @param {TestClient} client
     */
    add(client) {
        this.data.push(client)
    }

    clear() {
        this.data = []
    }

    /**
     *
     * @param {Object} param
     * @param {String} param.id
     * @param {String} param.x_api_key
     */
    make(param) {
        const new_client = new TestClient(param)
        this.add(new_client)
        return new_client
    }

    get(position) {
        if (position == 'first') {
            return this.data[ 0 ]
        }
        if (Number.isInteger(position) && this.data[ position ]) {
            return this.data[ position ]
        }
        throw new Error('Invalid position')
    }

    set(position, client) {
        this.data[ position ] = client
    }

    /**
     *
     * @param {String} value Can be client id or client name
     */
    find(value) {
        return this.data.find(client => client.client_name == value || client.id == value)
    }
}