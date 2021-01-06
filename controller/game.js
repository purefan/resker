const router = require('express').Router()
const model = require('../model')
const debug = require('resker-debug')('resker:controller:game')

router.post('/game', post_game)
router.get('/game/:game_id', get_game)
router.get('/game', get_game)
module.exports = router

/**
 *
 * @param {*} req
 * @param {*} res
 */
async function post_game(req, res) {
    const log = debug.extend('post_game')
    log('req headers %O', req.resker_headers)
    try {
        const game_model = await model.game()
        const position_model = await model.position()

        req.body.client_name = req.resker_headers.resker_client
        const new_game = await game_model.add_game(req.body)
        log('Game inserted', new_game)

        // Reference the game to the positions in this game
        for (let idx = 0; idx < new_game.moves.length; idx++) {
            const new_reference = {
                game_id: new_game._id,
                fen: new_game.moves[idx].fen,
                client_name: req.resker_headers.resker_client
            }
            log('new reference', new_reference)
            await position_model.add_position_to_game(new_reference)
        }

        // Update client
        const client_model = await model.client()
        await client_model.set_last_active({ client_name: req.resker_headers.resker_client })
        return res.status(200).send(new_game)
    } catch (error) {
        log('Error %O', error)
        return res.status(error.status_code || 404).send(error.status_message || '')
    }
}

/**
 *
 * @param {*} req
 * @param {*} res
 */
async function get_game(req, res) {
    const log = debug.extend('get_game')
    try {
        const game_model = await model.game()
        log('query query', req.resker_query_url)
        log('query params', req.params)
        const fetched_games = await game_model.fetch(Object.assign({}, req.resker_query_url, req.params))
        log('Fetched so many games: ', fetched_games.length)
        return res.status(200).send(fetched_games)
    } catch (error) {
        log('Error %O', error)
        return res.status(error.status_code || 400).send(error.status_message || '')
    }
}