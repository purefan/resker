const debug = require('debug')('resker:model:position')
const db = require('../lib/db')

/**
 *
 */
async function Position() {
    const db_conn = await db.connect()

    /**
     * Fetches param.fen from the database
     * @param {Object} param
     * @param {String} param.fen
     */
    async function fetch(param) {
        const log = debug.extend('fetch')
        log('Fetching %s', param.fen)
        if (!param.fen) {
            throw new Error('fen is required')
        }
        return await db_conn.collection('position').findOne({ _id: param.fen })
    }

    /**
     * Updates a record in mongo
     * @param {Object} param
     */
    async function update(param) {
        const log = debug.extend('update')
        log('Updating position: %O', param)
        const update_params = {
            $set: {
                depth_goal: Math.max(param.depth_goal || 0, param.existing.depth_goal),
                multipv_goal: Math.max(param.multipv_goal || 4, param.existing.multipv_goal),
                status: param.status || 0, // reset so it gets picked up again
                priority: Math.max(param.priority || 0, param.existing.priority),
                client: param.client || param.existing.client,
                updated: Date.now()
            }
        }
        log('Updating because it already existed %O', update_params)
        await db_conn.collection('position').updateOne(
            { _id: param.fen },
            update_params)
        log('Edited the position')
    }

    /**
     *
     * @param {*} param
     */
    async function insert(params) {
        const log = debug.extend('insert')
        const insert_query = {
            $setOnInsert: {
                _id: params.fen,
                status: 0,
                depth_goal: params.depth_goal || 40,
                priority: params.priority || 5,
                multipv_goal: params.multipv_goal || 4,
                client: params.client,
                created: Date.now()
            } // Adding $set here would make this an update instead of an insert
        }
        log('Inserting %O', insert_query)
        await db_conn.collection('position').updateOne(
            { _id: params.fen },
            insert_query,
            { upsert: true }
        )
        log('Checking %O', await db_conn.collection('position').toJSON())
        log('Added position')
    }

    /**
     *
     */
    async function get_top_queued() {
        const log = debug.extend('get_top_queued')
        log('Fetching')
        const position = await db_conn.collection('position')
            .find({ status: 0 })
            .sort({ priority: -1 })
            .limit(1)
        const top_queued = await db.to_array(position)
        log('Position %O', top_queued)
        if (!top_queued || top_queued.length < 1) {
            const err = new Error('No position found')
            err.status_code = 404
            throw err
        }
        return Object.assign(top_queued[ 0 ], { fen: top_queued[ 0 ]._id, _id: undefined })
    }

    /**
     *
     * @param {MongoClient} db
     */
    async function add_position(param) {
        const log = debug.extend('add_position')
        log('Adding position', param)
        param.existing = await fetch(param)
        if (param.existing) {
            log('Position already exists, updating')
            return await update(param)
        }
        log('Inserting new position %O', param)
        return await insert(param)
    }

    /**
     *
     * @param {Object} param
     * @param {String} param.client stocto self reported name
     * @param {Number} param.status 0: not-started, 1: started, 2: finished
     * @param {String} param.fen
     */
    async function set_status(param) {
        const update_params = {
            $set: {
                status: param.status || 0, // reset so it gets picked up again
                client: param.client || 'unknown',
                updated: Date.now()
            }
        }
        await db_conn.collection('position').updateOne(
            { _id: param.fen },
            update_params
        )
    }

    /**
     *
     * @param {Object} param
     * @param {Object} param.analysis
     * @param {String} param.fen
     */
    async function add_analysis(param) {
        const log = debug.extend('add_analysis')
        let in_db = await fetch(param)
        if (!in_db) {
            await insert(param)
            in_db = await fetch(param)
        }
        const update_params = {
            $push: { analysis: param.analysis },
            $set: { updated: Date.now() }
        }
        if (in_db.depth_goal <= param.analysis.depth) {
            update_params.$set.status = 2
        }
        log('Update params: %s', JSON.stringify(param.analysis).substr(0, 300))
        await db_conn.collection('position')
            .updateOne(
                { _id: param.fen },
                update_params)
    }

    return {
        add_analysis,
        add_position,
        get_top_queued,
        fetch,
        set_status
    }
}





module.exports = Position