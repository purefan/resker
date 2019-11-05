const shell = require('shelljs')
const fs = require('fs')
const util = require('util')
const appendFile = util.promisify(fs.appendFile)
const config = require('../config')
const path = require('path')
const Game = require('../lib/db/game')

/**
 * Continually provides a pgn file to import
 */
function* get_next_pgn() {
    for (const filename of fs.readdirSync(config.path.source)) {
        yield filename
    }
}

/**
 *Imports all the pgn files inside config.path.source
 */
async function process() {
    const game = new Game()
    for (const filename of get_next_pgn()) {
        const source = path.join(config.path.source, filename)
        const success = path.join(config.path.success, filename)
        try {
            console.log('Reading ' + filename)
            await game.reset()
            await game.read_pgn_file(source)
            await game.prepare_for_insert()
            await game.save()
            shell.mv(source, success)
        } catch (error) {
            await appendFile(path.join(__dirname, 'error.log'), 'Failed to process ' + source + error)
            shell.mv(source, path.join(config.path.failed, filename))
        }
    }
}

module.exports = process