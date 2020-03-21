const debug = require('debug')('resker:model:client')
const db = require('../lib/db')

/**
 *
 */
async function Client() {
    const db_conn = await db.connect()
    const collection = db_conn.collection('stocto_client')

    /**
     * Adds a client to the collection
     * @param {Object} param
     * @param {String} param.client_name
     */
    async function add_client(param) {

    }

    /**
     * Updates a client's record to show when was it last active
     * Triggered internally when a stocto client:
     * - Finishes analyzing
     * - Reserves a position
     * - Adds a position
     * @param {Object} param
     * @param {String} param.client_name
     */
    async function set_last_active(param) {
        const log = debug.extend('set_last_active')
        if (!param.client_name) {
            throw new Error('Missing client_name')
        }
        const now = Date.now()
        log('Setting client "%s" last active to %d', param.client_name, now)
        await collection.update(
            { client_name: param.client_name },
            { last_active: now },
            { upsert: true })
        log('Checking', await fetch_client(param))
        return true
    }

    /**
     * Fetches all the clients in the collection
     */
    async function fetch_all_clients() {
        const log = debug.extend('fetch_all_clients')
        log('Fetching all clients')
        const clients = (await (await collection.find({})).toArray()).map(fix_id)
        log('Fetched', clients, Array.isArray(clients))
        return clients
    }

    /**
     *
     * @param {Object} param
     */
    async function fetch_client_by_name(param) {
        const log = debug.extend('fetch_client_by_name')

        const client = (await (await collection.find({ client_name: param.client_name }))
            .toArray())
            .map(fix_id)
        log('Finding client %s %O', param.client_name, client)
        return client
    }

    /**
     *
     * @param {Object} param
     * @param {String} [param.id] Client id to fetch a single record
     * @param {String} [param.client_name]
     */
    async function fetch_client(param) {
        let clients = []
        if (param.client_name) {
            clients = await fetch_client_by_name(param)
        }
        if (!param.id) {
            clients = await fetch_all_clients()
        }
        return clients.map(fix_id)
    }

    /**
     *
     * @param {Object} client
     */
    function fix_id(client) {
        return Object.assign({}, client, { id: client._id, _id: undefined })
    }

    return {
        fetch_all_clients,
        set_last_active
    }
}

module.exports = Client