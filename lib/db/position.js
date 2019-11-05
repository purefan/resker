const Chess = require('chess.js').Chess
const config = require('../../config')
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

    async fetch() {
        await this.connect()
        console.log('---> fetching')
        return await this.db.collection('position').findOne({ _id: this.fen })
    }

    async fetch_all() {
        return await this.db.collection('position').find({}).toArray()
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
     *
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

    async set_status(new_value) {
        const log = debug.extend('set_status')
        await this.connect()
        log('Updating %s to status %d', this.fen, new_value)
        await this.db.collection('position').updateOne({
            _id: this.fen
        },
        {
            $set: {
                status: new_value
            }
        }
        )
        return true
    }

    async add(position) {
        const log = debug.extend('add')
        const insert_params = structure('position', 'position', position)
        await this.connect()
        log('Adding %O ', insert_params)
        await this.db.collection('position').updateOne(
            { _id: this.fen },
            {
                $setOnInsert: {
                    _id: this.fen,
                    status: 0,
                    depth_goal: insert_params.depth_goal || 30,
                    priority: insert_params.priority || 5,
                    created: Date.now
                }
            },
            { upsert: true }
        )
        log('Added position')
        return true
    }

    async connect() {
        const log = debug.extend('connect')
        if (this.db) {
            log('Already connected')
            return true
        }
        try {
            const connection = await MongoClient.connect(config.mongo.url, { useNewUrlParser: true, useUnifiedTopology: true })
            this.db = connection.db(config.mongo.name)
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
