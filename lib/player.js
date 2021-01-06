const db = require('../lib/db')
const debug = require('debug')('resker:lib:player')

/**
 * @property {String} player_name
 * @property {String} _id Mongodb unique id
 * @property {Mongodb.collection} collection
 */
class Player {
    constructor(param) {
        this.player_name = param.name
        this._id = param.player_id || false
        db.connect().then(db_conn => this.collection = db_conn.collection('position'))
    }

    /**
     * Fetches the player from the database
     * @returns {Promise<PlayerRecord>}
     */
    async fetch_player() {
        const log = debug.extend('fetch_player')
        log('Fetching ', this.player_name)
        const record = this.collection.findOne({player_id: this.player_name})
        this._id = record._id
        log('Found', record)
        return record
    }

    /**
     * Updates or inserts a new player in the database
     */
    async save_in_db() {
        const log = debug.extend('save_in_db')
        const params = {
            player_name: this.player_name.toLowerCase()
        }
        const result = await this.collection.insert(params)
        log('Saved', result)
    }

    /**
     * Makes sure the player exists in the database
     */
    async make_sure_it_exists() {

    }
}


/**
 * @typedef PlayerRecord
 * @property {String} _id
 * @property {String} player_name
 *
 */

module.exports = Player