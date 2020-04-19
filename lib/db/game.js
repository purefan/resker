const { Chess } = require('chess.js')
const { MongoClient } = require('mongodb')
const fs = require('fs')
const Player = require('./player')
const debug = require('resker-debug')('lib:db:game')
class Game {
    /**
     *
     * @param {Object} param
     * @param {String} pgn_text PGN string to be parsed
     */
    constructor(param) {
        this.db = false
        this.reset()
        if (param && param.pgn_text) {
            this.load_pgn(param.pgn_text)
        }
        if (param && param.pgn_path) {
            this.pgn_path = param.pgn_path
            this.read_pgn_file(param.pgn_path)
        }
    }

    async connect() {
        const log = debug.extend('connect')
        try {
            const connection = await MongoClient.connect(process.env.MONGO_HOST, { useNewUrlParser: true, useUnifiedTopology: true })
            this.db = connection.db('resker')
            log('MongoClient Connection successful.')
            return true
        }
        catch (ex) {
            log('Error caught %O', ex)
            return false
        }
    }

    async reset() {
        this.chess = new Chess()
    }

    load_pgn(pgn_text) {
        this.chess.load_pgn(pgn_text)
        this.chess.game_moves = pgn_text.split('\n\n')[ 1 ].replace(/\r?\n|\r/g, '')
    }

    /**
     *
     * @param {String} pgn_path
     */
    read_pgn_file(pgn_path) {
        this.pgn_path = pgn_path
        const pgn_text = fs.readFileSync(pgn_path, 'utf-8')
        this.load_pgn(pgn_text)
    }

    get_moves() {
        const chess = new Chess()
        const all_moves = Object.assign(this.chess.history()).reverse()
        let san
        const full_moves = []
        let move_number = 1
        while (all_moves.length > 0) {
            san = all_moves.pop()
            chess.move(san)
            full_moves.push({
                san: san,
                fen: chess.fen(),
                move_number: move_number
            })
            move_number++
        }
        return full_moves
    }

    /**
     * Complies with the game structure and finds or creates players
     */
    async prepare_for_insert() {
        const white_player = new Player({ player_name: this.chess.header().White })
        const black_player = new Player({ player_name: this.chess.header().Black })
        this.to_insert = {
            source_file_name: this.pgn_path || 'unknown',
            black_player: {
                player_id: await black_player.get_player_id(),
                elo: this.chess.header().BlackElo || 0
            },
            status: 0,
            white_player: {
                player_id: await white_player.get_player_id(),
                elo: this.chess.header().WhiteElo || 0
            },
            result: (this.chess.header().Result || '*').substr(0, 3),
            game_date: new Date(this.chess.header().EventDate || this.chess.header().SourceDate),
            source: this.chess.header().Source || 'unknown',
            event: {
                site: this.chess.header().Site || 'unknown',
                event: this.chess.header().Event || 'unknown',
                round: parseFloat(this.chess.header().Round) || 0.0
            },
            type: 0,
            moves: this.get_moves(),
            insert_date: new Date,
            last_updated: new Date
        }
    }

    /**
     * Stores this game into the database
     */
    async save() {
        const log = debug.extend('save')
        log('Saving')
        log('to insert %O', this.to_insert)
        const game = await this.collection.insertOne(this.to_insert)
        this.game_id = game.insertedId
        log('game id %s', game.insertedId)
        return game.insertedId
    }
}

module.exports = Game