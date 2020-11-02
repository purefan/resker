const debug = require('resker-debug')('resker:lib:test')

/**
 * Utilities to help in testing
 */
function TestClientUtils() {
    const clients_manager = new ClientsManager()

    /**
     *
     */
    async function clean_mock_mongo() {
        const log = debug.extend('connect:mock')
        const mongodb = require('mongo-mock')
        const MongoClient = mongodb.MongoClient
        const connection_string = `mongodb://${process.env.MONGO_HOST}:27017/`
        const connection = await MongoClient.connect(connection_string, { useNewUrlParser: true, useUnifiedTopology: true })
        const db = connection.db('resker')
        const dataset = db.collection('position').toJSON()
        log('Cleaning mock db, collection position now has', dataset)
        dataset.documents.length = 0
        log('Cleaning mockdb position now has', dataset)
    }

    return {
        clients_manager,
        TestClient
        , clean_mock_mongo
    }
}

module.exports = TestClientUtils

/**
 * Represents a unique stocto client with helper functions
 * @property {Object} data
 * @property {String} data.client_name
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
        return this.data.client_name
    }

    /**
     * @param {Object} [param]
     * @param {Number} [param.half_move]
     * @returns {String}
     */
    make_random_fen(param) {
        const pieces = ['r','n','b','q']
        /**
         * @returns {String}
         */
        function get_random_piece() {
            return pieces[Math.floor(Math.random()*pieces.length)]
        }
        // r2q1k1r/p2p1pp1/2n4p/2pQP1b1/2N5/2N5/PP3PPP/R3K2R w KQ - 1 ${param.half_move}

        // back rank
        const pieces_placement = [
            (
                new Array(4).fill('1').map( () => get_random_piece().toLowerCase()))
                .concat(['k'])
                .concat((
                    new Array(3).fill(1).map( () => get_random_piece().toLowerCase()))).join(''),
            (new Array(8).fill('p').join('')),
            '8', '8', '8', '8',
            (new Array(8).fill('P').join('')),
            (new Array(4).fill('1').map(() => get_random_piece().toUpperCase()))
                .concat(['K'])
                .concat((
                    new Array(3).fill(get_random_piece().toUpperCase()))).join('')
        ]

        return `${pieces_placement.join('/')} w KQ - 1 ${param.half_move || Math.ceil(Math.random() * 100) + 1}`
    }


}

/**
 * @typedef ClientConstructor
 * @property {String} x-api-key
 * @property {String} [id]
 * @property {String} [client_name]
 * @property {String} [last_active]
 */

class ClientsManager {
    constructor() {
        this.data = []
        this.log = debug.extend('ClientsManager')
        this.id = `client-${Math.ceil(Math.random() * 1000)}`
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
     * @param {ClientConstructor} param
     */
    make(param) {
        const new_client = new TestClient(param)
        this.add(new_client)
        return new_client
    }

    /**
     *
     * @param {String} position
     * @returns {TestClient}
     */
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