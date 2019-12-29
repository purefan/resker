const Chess = require('chess.js').Chess
const debug = require('debug')('resker:lib:db:position')
const { MongoClient } = require('mongodb')
const structure = require('../structure')

class Position {
    constructor(fen) {
        this.fen = fen
        this.chess = new Chess()
        this.db = false
    }

    is_valid() {
        return this.chess.validate_fen(this.fen)
    }

    /**
     * Fetches this.fen from the database
     */
    async fetch() {
        const log = debug.extend('fetch')
        await this.connect()
        log('Fetching %s', this.fen)
        return await this.db.collection('position').findOne({ _id: this.fen })
    }


    /**
     *
     * @param {Object} analysis
     * @param {String} analysis.fen
     * @param {String} analysis.eval
     * @param {Number} analysis.depth
     * @param {String} analysis.engine_name
     * @see /lib/structure/position.js
     */
    async add_eval(analysis) {
        const log = debug.extend('add_eval')
        const clean_analysis = await structure('position', 'position_analysis', analysis)
        if (!this.fen) {
            throw new Error('FEN required')
        }
        await this.connect()
        let in_db = await this.fetch()
        if (!in_db) {
            log('Position not found, adding it')
            await this.add({})
            in_db = await this.fetch()
        }
        clean_analysis.created = Date.now()
        const update_params = {
            $push: { analysis: clean_analysis }
        }
        if (in_db.depth_goal <= analysis.depth) {
            update_params.$set = { status: 2 }
        }
        log('Update params: %O', clean_analysis)
        await this.db.collection('position')
            .updateOne(
                { _id: this.fen },
                update_params)
        log('Appended')
        return true
    }

    /**
     * Fetches the position with highest priotity that is waiting to
     * be analyzed
     */
    async get_top_queued() {
        const log = debug.extend('get_top_queued')
        await this.connect()
        const position = await this.db.collection('position').findOne({
            status: 0
        }, {
            sort: [ [ 'priority', 'desc' ] ]
        })
        log('Position %O', position)
        if (!position) {
            const err = new Error('No position found')
            err.status_code = 404
            throw err
        }
        return Object.assign(position, { fen: position._id, _id: undefined })
    }

    /**
     *
     * @param {Number} new_value By "convention" 0:New 1:Processing 2:Done but there is no restriction
     */
    async set_status(new_value) {
        const log = debug.extend('set_status')
        await this.connect()
        log('Updating %s to status %d', this.fen, new_value)
        return await this.db.collection('position').updateOne({
            _id: this.fen
        },
        {
            $set: {
                status: new_value
            }
        })
    }

    /**
     * Adds a position to the database.
     * If the position already exists the highest values for depth_goal and priority are kept.
     * @param {Object} position
     * @param {Number} [position.depth_goal=40] How deep should the analysis go
     * @param {Number} [position.priority=5] Determines how quickly this position is fetched
     */
    async add(position) {
        const log = debug.extend('add')
        const insert_params = await structure('position', 'position', position)
        await this.connect()
        log('Adding %O ', insert_params)
        const existing_one = await this.fetch()
        if (existing_one) {
            log('Position already existed: %O', existing_one)
            const update_params = {
                $set: {
                    depth_goal: Math.max(position.depth_goal || 0, existing_one.depth_goal),
                    priority: Math.max(position.priority || 0, existing_one.priority)
                }
            }
            log('Updating because it already existed %O', update_params)
            await this.db.collection('position').update({ _id: this.fen }, update_params)
            log('Edited the position')
        } else {
            const insert_query = {
                $setOnInsert: {
                    _id: this.fen,
                    status: 0,
                    depth_goal: insert_params.depth_goal || 40,
                    priority: insert_params.priority || 5,
                    created: Date.now
                }
            }
            log('Inserting %O', insert_query)
            await this.db.collection('position').updateOne(
                { _id: this.fen },
                insert_query,
                { upsert: true }
            )
            log('Added position')
        }
        return true
    }

    async connect() {
        const log = debug.extend('connect')
        if (this.db) {
            return true
        }
        try {
            const connection_string = `mongodb://${process.env.MONGO_HOST}:27017`
            const connection = await MongoClient.connect(connection_string, { useNewUrlParser: true, useUnifiedTopology: true })
            this.db = connection.db('resker')
            log('MongoClient Connection successful.')
            return true
        }
        catch (ex) {
            log('Error caught %O', ex)
            return false
        }
    }


}

module.exports = Position
