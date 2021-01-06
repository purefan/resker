const debug = require('resker-debug')('resker:model:game')
const db = require('../lib/db')
const { Chess } = require('chess.js')
const util = require('util')
const snappy = require('snappy')
const compress = util.promisify(snappy.compress)

/**
 * @typedef {Object} Game
 * @description Object as stored in the db holding information about a Game
 * @property {String} _id Auto-generated id by mongodb
 */
const GAMES_PER_PAGE = 30

/**
  * Utility functions to interact with Client objects in the database
  */
async function Game() {
    const db_conn = await db.connect()
    const collection = db_conn.collection('game')
    await collection.createIndex({reference_id: 1}, {unique: true})

    /**
     * Adding a game also creates a unique reference id besides the game id. Both properties have a different purpose though
     * the _id that mongodb creates is sequential and works towards pagination. The field reference_id that we create here
     * with the help of snappy works towards minimizing duplicity.
     * This function intentionally does not use bcrypt (as the auth routine) because bcrypt uses only the first 72 bytes and
     * (perhaps incorrectly) I fear the stringification of a game object might match up to that point resulting in duplicates.
     * @param {Object} param
     * @param {String} param.white_player_name
     * @returns {Object} The game as stored in the collection
     */
    async function add_game(param) {
        const log = debug.extend('add_game')
        const canonical_fields = {
            white_player_name: param.white_player_name,
            black_player_name: param.black_player_name,
            white_player_elo: Math.ceil(Number(param.white_player_elo)),
            black_player_elo: Math.ceil(Number(param.black_player_elo)),
            result: param.game_result,
            event: param.event,
            game_date: new Date(param.game_date).getTime(),
            moves: make_moves(param.moves)
        }

        const insert_query = {
            $setOnInsert: Object.assign({}, canonical_fields, {
                client: param.client_name || param.client, // backwards compat
                created: Date.now()
                , reference_id: (await compress(JSON.stringify(canonical_fields))).toString('utf-8')
            }) // Adding $set here would make this an update instead of an insert
        }
        log('Inserting %O', Object.assign({}, insert_query, {moves: '...'}))
        const upserted = await collection.updateOne(
            { _id: param.fen },
            insert_query,
            { upsert: true }
        )
        log('Checking %O', (await fetch({ _id: upserted.upsertedId._id })))
        log('Added Game')
        return Object.assign({}, insert_query.$setOnInsert, upserted.upsertedId)
    }

    /**
     * Fetches one or more games from the db
     * @param {Object} param
     * @returns {Array} Always always returns an array
     */
    async function fetch(param) {
        const log = debug.extend('fetch')
        log('Fetching', param)
        if (param.game_id) {
            return fetch_by_id(param)
        }
        // if not searching by specific id, the user is filtering games
        // then, lets build the query document
        const query_document = Object.assign({},
            make_filter_for_players(param)
            , make_filter_for_result(param)
            , make_filter_for_date(param)
            , make_filter_for_pagination(param)
        )
        const query_option = Object.assign({},
            make_sort_option(param)
            , make_limit_option(param)
        )
        const query_projection = {}
        log('Query %j', query_document)
        log('Options %O', query_option)
        const fetched = await db.to_array(await collection.find(query_document, query_projection, query_option))
        log('Found', fetched.map(game => Object.assign({}, game, {moves: '...'})))
        return fetched
    }

    /**
     * Fetches a single game given its mongo _id and returns an array containing maximum 1 object
     * @param {Object} param
     * @param {String} param._id The mongodb generated id
     * @returns {Object[]}
     */
    async function fetch_by_id(param) {
        return [await collection.findOne({ _id: param.game_id })]
    }
    return { add_game, fetch }
}

/**
 * Makes the sorting object for all game fetching queries
 * @returns {{sort: Object}}
 */
function make_sort_option() {
    return {
        sort: { _id: 1 }
    }
}

/**
 * Makes the limit part of the options, the default limit is 30 games "per page" (we dont really do pages)
 * @returns {Object<limit: Number>}
 */
function make_limit_option() {
    return {
        limit: GAMES_PER_PAGE
    }
}

/**
 * In order to paginate, the client must send the id of the last game received
 * This filter will given the ObjectID which has natural ordering
 * @param {Object} param
 * @param {String|undefined} [param.last_game_id]
 * @returns {Object}
 */
function make_filter_for_pagination(param) {
    const filter = {}
    if (param.last_game_id) {
        filter._id = { '$gt': param.last_game_id }
    }
    return filter
}

/**
 * Makes the part of the query document related to players
 * @param {Object} param
 * @param {String} [param.player_relation]
 * @return {Object}
 */
function make_filter_for_players(param) {
    const log = debug.extend('make_filter_for_player')
    const filter = {}
    if (!param.player_relation || !['or', 'and'].includes(param.player_relation.toLowerCase())) {
        param.player_relation = 'OR'
    }

    // Only looking for the white player
    if (param.white_player_name) {
        filter.white_player_name = param.white_player_name
    }

    // Only looking for the black player
    if (param.black_player_name) {
        filter.black_player_name = param.black_player_name
    }

    log('filter', filter)
    return filter
}

/**
 * Makes the filter for result. Valid values as described in the raml document are:
 * - 1-0
 * - 0-1
 * - 1/2
 * - 1-1 Either one wins, meaning, not a draw
 * - 1/0 White wins or is a draw
 * - 0/1 Black wins or is a draw
 * - * any result, invalidates this filter
 * @param {Object} param
 * @param {String} [param.result]
 * @returns {Object}
 */
function make_filter_for_result(param) {
    const valid_results = ['1-0', '0-1', '1/2', '1-1', '1/0', '0/1']
    if (!param.result || param.result == '*') {
        return {}
    }

    if (!valid_results.includes(param.result)) {
        throw new Error('Invalid result: ' + param.result)
    }

    return {
        result: param.result
    }
}

/**
 * Makes the filter for dates
 * @param {Object} param
 * @param {Number} [param.game_date_start]
 * @param {Number} [param.game_date_end]
 * @returns {Object}
 */
function make_filter_for_date(param) {
    const log = debug.extend('make_filter_for_date')
    log('Params', param)
    const filter = {}
    if (param.game_date_start) {
        filter.game_date = { $gte: new Date(Number(param.game_date_start)).getTime()}
    }

    if (param.game_date_end) {
        filter.game_date = Object.assign({}, filter.game_date, { $lte: new Date(Number(param.game_date_end)).getTime()})
    }

    log('filter', filter)
    return filter
}

/**
 *
 * Makes the move objects that represent the state of a position including resulting FEN, half move and SAN
 * @param {Array<Object>} moves
 * @returns {{fen:String, san: String, half_move: Number}[]}
 */
function make_moves(moves) {
    const log = debug.extend('make_moves')
    const chess = new Chess()

    log('Making moves for ', moves)
    const moves_to_db = moves.map(move_from_client => {
        const move = chess.move(move_from_client.san)
        return {
            fen: chess.fen(),
            san: move.san,
            half_move: move_from_client.half_move
        }
    })

    if (moves_to_db.find(el => el === null)) {
        const error = new Error('At least one move is invalid')
        error.status_code = 400
        error.status_message = 'At least one move is invalid'
        throw error
    }

    return moves_to_db
}
module.exports = Game