const Player = require('./player')
const debug = require('debug')('vogula:game')
const { Chess } = require('chess.js')

/**
  * @typedef {Object} ParsedPGN
  * @property {PGNHeaders} headers
  * @property {Array<String>} moves Includes possible RAVs and comments. Assumes SAN
  */

/**
   * Represents a single game, includes headers and moves and the object
   * is ready to store/update in the database
   * @property {PGNHeaders} headers
   * @property {Array<Move>} moves
   */
class PGN {

    constructor(param) {
        this.raw_pgn = param.pgn
        this.separate_pgn_parts(this.raw_pgn)
    }

    /**
     * Makes sure that:
     * - The players are complete
     * - The moves are all valid
     * - The event is complete
     */
    async prepare() {
        this.white_player = new Player(this.headers.white)
        this.black_player = new Player(this.headers.black)
        // even if the RAVs are not valid, we care about the main line


    }

    /**
     * Saves a game to the database:
     * - Inserts players if needed
     * - Inserts positions if needed
     * - Inserts a Game object which includes a list of moves and other metadata
     * - Does not add positions that belong to a variation.
     */
    async save_to_db() {
        await this.white_player.make_sure_it_exists()
        await this.black_player.make_sure_it_exists()
    }


    /**
     * Separates the full_pgn and assigns it to the class properties
     * @param {String} full_pgn
     */
    separate_pgn_parts(full_pgn) {
        const match = /([\[\w\W]*)\n\n([\w\W\s]*)/gm.exec(`\n\n${full_pgn}`)
        this.headers = new PGNHeaders() /* {
            WhitePlayer: new Player(),
            BlackPlayer: new Player(),
            Event: '',
            Site: '',
            Result: '',
            Date: new Date(),
            Round: ''

        } */
        if (match[ 1 ]) { // headers
            match[ 1 ].split('\n').map(line => {
                const header_parts = /\[([\w\W]+) "([\w\W]+)"/.exec(line)
                if (header_parts) {
                    this.headers[ header_parts[ 1 ] ] = header_parts[ 2 ]
                }
            })
        }
        this.moves = match[ 2 ]
            .replace(/\r?\n|\r/g, ' ')
            .replace(/\s\s+/g, ' ') // not perfect but 70% of the time works every time
            .replace(/[\d]+[\.]{1,3}\s(\w)/g, '$1') // Remove space after move number 4. d3 --> 4.d3
            .replace(/\(/g, ' ( ') // add a space so we can easily tell when a variation starts
            .replace(/\)/g, ' ) ') // and ends in the for loop
            .replace(/[\d]+\./g, '') // remove numbers
            .split(' ')
            .map(san => san.replace(/\s/g, ''))
            .filter(san => san.length > 0)
    }
}


/**
 * @property {Player} WhitePlayer
 * @property {Player} BlackPlayer
 * @property {String} Event
 * @property {String} Site
 * @property {String} Result 1-0, 0-1, 1/2, *
 * @property {Date} Date
 * @property {String} Round
 */
class PGNHeaders {
    constructor() {
        this.log = debug.extend('PGNHeaders')
    }
    set white(white_name) {
        this.white = new Player(white_name)
    }

    set black(black_name) {
        this.black = new Player(black_name)
    }

    /**
     * @param {Date} when
     */
    set date(when) {
        if (Object.prototype.toString.call(when) === '[object Date]') {
            this.date = new Date(when)
        } else {
            this.date = when
        }
    }

    /**
     * @param {String} points
     */
    set result(points) {
        const log = this.log.extend('result')
        points = points.replace(/o/g,'0')
        points = points.replace(/i/g,'1')
        if (['1-0', '0-1', '1/2', '*'].includes(points.substring(0,3))) {
            log('Result invalid, converting to ???', points)
            points = '???'
        }
        this.result = points
    }
}


module.exports = PGN
