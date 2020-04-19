const debug = require('resker-debug')('resker:model:client')
const db = require('../lib/db')

/**
 * @typedef {Object} Client
 * @description Object as stored in the db holding information about a client
 * @property {String} _id Auto-generated id by mongodb
 */

/**
  * Utility functions to interact with Client objects in the database
  */
async function Client() {
    const db_conn = await db.connect()
    const collection = db_conn.collection('stocto_client')

    /**
     * Adds a client to the collection
     * @param {Object} param
     * @param {String} param.client_name
     * @param {String} param.hash
     * @return {Object} {id: <String>}
     */
    async function add_client(param) {
        const log = debug.extend('add_client')
        if (typeof param.hash != 'string' || param.hash.length < 5) {
            throw new Error('Client must have an api key')
        }
        log('params: %O', param)
        await collection.createIndex({ client_name: 1 })
        log('ready')
        const insert_param = {
            client_name: param.client_name,
            hash: param.hash,
            last_active: Date.now(),
            is_active: true
        }
        const res = await collection.insertOne(insert_param)
        log('res', res.result)
        log('insert_param', insert_param)
        const confirm = await collection.findOne({ client_name: param.client_name })
        log('Confirm', confirm)
        return fix_id(confirm)
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
        log('Fetched\n%O', clients)
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
        const log = debug.extend('fix_id')
        log('Fixing ', client)
        let fixed = Object.assign({}, { id: client._id }, client)
        delete fixed._id
        return fixed
    }

    /**
     *
     * @param {Object} param
     * @param {Boolean} param.is_active
     * @param {String} param.id
     */
    function set_client_active(param) {
        return collection.update(
            { _id: param.id },
            { is_active: !!param.is_active },
            { upsert: true })
    }

    /**
     *
     * @param {*} id
     */
    function fetch_client_by_id(id) {
        return collection.find({ _id: id })
    }
    return {
        fetch_all_clients,
        set_last_active,
        add_client,
        set_client_active,
        fetch_client_by_id
    }
}

module.exports = Client