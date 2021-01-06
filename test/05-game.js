const supertest = require('supertest')
const request = supertest(`localhost:${process.env.HTTP_PORT}`)
const TestUtils = require('../lib/test')()
const server = require('./server')
const { Chess } = require('chess.js')

const headers = {
    'resker_client': TestUtils.clients_manager.make(
        {
            client_name: `Supertest for 05-game.js - ${Math.ceil(Math.random() * 99999)}`,
            'x-api-key': process.env.X_API_KEY
        }
    ),
    'x-api-key': process.env.X_API_KEY
}

/**
 * 4 - Stats
 */

describe('5 - Game', function () {
    before('Prepare express', server)
    before('Create a client', () => {
        const body = {
            client_name: '5.0.0-client',
            api_key: 'api_key_for_client_4.0.0'
        }
        return make_client(body)
            .then(res => {
                if (!res.body.id) { throw new Error('Missing id when creating client') }
                return TestUtils.clients_manager.make({
                    client_name: body.client_name,
                    'x_api_key': body.api_key,
                    id: res.body.id,
                    last_active: res.body.last_active
                })
            })
    })

    describe('5.1 - POST /game', function () {
        let inserted_game = generate_game()

        before('Insert', async function () {
            inserted_game = Object.assign({}, inserted_game, await add_game({ game: inserted_game }) )
            if (!inserted_game.body._id) {
                throw new Error('Failed to insert game')
            }
        })

        it('Confirms the game was inserted', async function () {
            const fetched_game = await fetch_game({ id: inserted_game.body._id })
            // check that the game inserted's properties match the fetched game
            Object.keys(inserted_game.body).map(inserted_key => {

                let original_value = inserted_game.body[inserted_key]
                let fetched_value = fetched_game.body[0][inserted_key]

                if (typeof original_value == 'object') {
                    original_value = JSON.stringify(original_value)
                    fetched_value = JSON.stringify(fetched_value)
                }

                if (!fetched_value || fetched_value != original_value) {
                    throw new Error('Incompatible objects: ' + inserted_key)
                }
            })
        })
    })

    describe('5.2 - GET /game', function () {
        before('Insert games', before_5_2)
        describe('5.2.1 - Filter by players', function filter_by_players() {
            it('5.2.1.1 - Valid filter by player with white pieces', filter_by_white_pieces)
            it('5.2.1.2 - Valid filter by player without color', filter_by_uncolored_player)
            it('5.2.1.3 - Valid filter by player with black pieces', filter_by_black_pieces)
            it('5.2.1.4 - Valid filter by both players', filter_by_white_and_black)
            it('5.2.1.5 - Invalid filter by player with white pieces', failed_filter_by_white)
        })
        it('5.2.5 - Valid filter by position from a game', filter_by_position)
        describe('5.2.6 - Valid filter by result', function describe_filter_by_result() {
            before('Insert games', prepare_filter_by_result)
            it('5.2.6.1 - Filter by 1-0', filter_by_result_1_0)
            it('5.2.6.2 - Filter by 0-1', filter_by_result_0_1)
            it('5.2.6.3 - Filter by 1/2', filter_by_result_1_2)
            it('5.2.6.4 - Filter by *', filter_by_result_any)
            it('5.2.6.5 - Filter by both win', filter_by_result_both_win)
            it('5.2.6.6 - Filter by white wins or draw', filter_by_result_win_draw)
            it('5.2.6.7 - Filter by white loses or draw', filter_by_result_lose_draw)
            it('5.2.6.8 - Filter by wrong result errors', filter_by_wrong_result)
        })
        it('5.2.7 - Valid filter by date earliest', filter_by_earliest_date)
        it('5.2.8 - Valid filter by latest date', filter_by_latest_date)
        it('5.2.9 - Valid filter by date range', filter_by_date_range)
        describe('5.2.10 - Pagination', function pagination() {
            before('Insert games', before_pagination)
            it('5.2.10.1 - Page 1', pagination_page_one)
            it('5.2.10.2 - Page 2', pagination_page_two)
        })
        describe('5.2.11 - Multiple filters', function describes_multiple_filters() {
            before('Prepare', prepare_multiple_filters)
            it('5.2.11.1 - Multiple filters', multiple_filters)
        })
    })
})

/**
 *
 */
async function filter_by_wrong_result() {
    return request
        .get('/game')
        .set(headers)
        .query({ result: 'something else' })
        .expect(400)
}

/**
 *
 * @returns {Promise}
 */
async function filter_by_result_any() {
    return request
        .get('/game')
        .set(headers)
        .query({ result: '*' })
        .expect(200)
        .expect(is_body_array)
        .expect(res => {
            // Must find all possible results
            const possible_results = {
                '1-0': false
                , '0-1': false
                , '1/2': false
                , '1-1': false // both win
                , '1/0': false // 1-0 or draw
                , '0/1': false // 0-1 or draw
            }

            res.body.forEach(game => possible_results[game.result] = true)
            const false_result = Object.values(possible_results).find(val => val != true)
            if (false_result) return new Error('Not all results were found')
        })
}

/**
 * Utility function that checks different properties in the res.body Array<Object>
 * @param {Object} param
 * @returns {Function}
 */
function body_has(param) {
    if (param.white_player_name) {
        return function body_has_player(res) {
            const right = res.body.find(game => game.white_player_name == param.white_player)
            if (!right) throw new Error('Missing white player')
        }
    }

    if (param.result) {
        return function body_has_result(res) {
            const right = res.body.find(game => game.result == param.result)
            if (!right) throw new Error('Missing result')
        }
    }
}

/**
 *
 */
async function filter_by_result_lose_draw() {
    return request
        .get('/game')
        .set(headers)
        .query({ result: '0/1' })
        .expect(200)
        .expect(is_body_array)
        .expect(body_has({result: '0/1'}))
}

/**
 *
 */
async function filter_by_result_win_draw() {
    return request
        .get('/game')
        .set(headers)
        .query({ result: '1/0' })
        .expect(200)
        .expect(is_body_array)
        .expect(body_has({result: '1/0'}))
}

/**
 *
 */
async function filter_by_result_both_win() {
    return request
        .get('/game')
        .set(headers)
        .query({ result: '1-1' })
        .expect(200)
        .expect(is_body_array)
        .expect(body_has({result: '1-1'}))
}

/**
 *
 * @returns {Promise}
 */
async function filter_by_result_1_0() {
    return request
        .get('/game')
        .set(headers)
        .query({ result: '1-0' })
        .expect(200)
        .expect(is_body_array)
        .expect(body_has({result: '1-0'}))
}

/**
 *
 * @returns {Promise}
 */
async function filter_by_result_0_1() {
    return request
        .get('/game')
        .set(headers)
        .query({ result: '0-1' })
        .expect(200)
        .expect(is_body_array)
        .expect(body_has({result: '0-1'}))
}

/**
 *
 * @returns {Promise}
 */
async function filter_by_result_1_2() {
    return request
        .get('/game')
        .set(headers)
        .query({ result: '1/2' })
        .expect(200)
        .expect(is_body_array)
        .expect(body_has({result: '1/2'}))
}

/**
 * Inserts 6 games to test filtering by result
 */
async function prepare_filter_by_result() {
    const promises = [
        add_game({ game: generate_game({ white: 'marked_player_526', result: '1-0' }) })
        , add_game({ game: generate_game({ white: 'marked_player_526', result: '1-0' }) })
        , add_game({ game: generate_game({ white: 'marked_player_526', result: '0-1' }) })
        , add_game({ game: generate_game({ white: 'marked_player_526', result: '0-1' }) })
        , add_game({ game: generate_game({ white: 'marked_player_526', result: '1/2' }) })
        , add_game({ game: generate_game({ white: 'marked_player_526', result: '1/2' }) })
        , add_game({ game: generate_game({ white: 'marked_player_526', result: '1-1' }) })
        , add_game({ game: generate_game({ white: 'marked_player_526', result: '1-1' }) })
        , add_game({ game: generate_game({ white: 'marked_player_526', result: '1/0' }) })
        , add_game({ game: generate_game({ white: 'marked_player_526', result: '1/0' }) })
        , add_game({ game: generate_game({ white: 'marked_player_526', result: '0/1' }) })
        , add_game({ game: generate_game({ white: 'marked_player_526', result: '0/1' }) })
    ]
    return await Promise.all(promises)
}

/**
 *
 */
async function prepare_multiple_filters() {
    const promises = [
        add_game({ game: generate_game({ white: 'marked_player_5211', result: '1/2', game_date: new Date(2010, 1, 2).getTime() }) })
        , add_game({ game: generate_game({ white: 'marked_player_5211', black: 'opposed_player_5211', result: '1-0', game_date: new Date(2010, 1, 3).getTime() }) })
        , add_game({ game: generate_game({ white: 'marked_player_5211', event: 'event_5211', black: 'opposed_player_5211', result: '0-1', game_date: new Date(2010, 1, 4).getTime() }) })
        , add_game({ game: generate_game({ white: 'marked_player_5211', event: 'event_5211', black: 'opposed_player_5211', result: '0-1', game_date: new Date(2010, 1, 5).getTime() }) })
    ]
    return await Promise.all(promises)
}

/**
 * Only before_5_2 has ran before this triggers
 */
async function multiple_filters() {
    const white_player_name = 'marked_player_5211'
    const result = '0-1'
    const black_player_name = 'opposed_player_5211'
    const game_date_start = new Date(2009, 1, 2).getTime()
    const game_date_end = new Date(2011, 2, 4).getTime()
    const event = 'event_5211'

    return request
        .get('/game')
        .set(headers)
        .query({
            white_player_name
            , result
            , black_player_name
            , game_date_start
            , game_date_end
            , event
        })
        .expect(200)
        .expect(is_body_array)
        .expect(res => {
            if (res.body.length < 1) {
                return new Error('Too few games')
            }
            for (const idx in res.body) {
                const game = res.body[idx]
                if (
                    game.white_player_name != white_player_name
                    || game.black_player_name != black_player_name
                    || game.result != result
                    || game.game_date < game_date_start
                    || game.game_date > game_date_end
                    || game.event != event
                )
                {
                    return new Error('Something wrong in here')
                }
            }
        })
}

/**
 *
 */
async function pagination_page_two() {
    const page_1 = await pagination_page_one()
    page_1.body.sort((a,b) => b._id - a._id)
    const last_game = page_1.body.pop()
    return request
        .get('/game')
        .set(headers)
        .query({ white_player_name: 'player', last_game_id: last_game.id })
        .expect(200)
        .expect(is_body_array)
        .expect(res => {
            const page_1_ids = page_1.body.map(game => game._id)
            // None of the ids in this page can exist in the previous one
            const wrong_game = res.body.find(game => page_1_ids.includes(game._id))
            if (wrong_game) {
                return new Error('Found a duplicated game')
            }
        })
}

/**
 * This test should get 50 games exactly, with the black player == 'player page 1'
 * @returns {Promise<Object<body:Array>>}
 */
async function pagination_page_one() {
    return request
        .get('/game')
        .set(headers)
        .query({ white_player_name: 'player' })
        .expect(200)
        .expect(is_body_array)
        .expect(res => res.body.length == 30 ? '' : new Error('Wrong number of items in page 1: ' + res.body.length))
        .expect(res => {
            const wrong_game = res.body.find(game => game.black_player_name != 'player page 1')
            if (wrong_game) {
                return new Error('Out of bounds because of player with name: ' + wrong_game.black_player_name)
            }
        })
}

/**
 *
 */
async function before_pagination() {
    const promises = []
    const marked_player = 'player'
    const player_page_1 = 'player page 1'
    const player_page_2 = 'player page 2'

    for (let idx = 0; idx < 50; idx++) {
        promises.push(add_game({ game: generate_game({ white: marked_player, black: player_page_1, game_date: new Date(2010, 1, idx).getTime() }) }))
    }
    await Promise.all(promises)
    for (let idx = 0; idx < 50; idx++) {
        promises.push(add_game({ game: generate_game({ white: marked_player, black: player_page_2, game_date: new Date(2020, 6, idx).getTime() }) }))
    }
    return Promise.all(promises)
}

/**
 *
 */
async function failed_filter_by_white() {
    return request
        .get('/game')
        .set(headers)
        .query({ white_player_name: 'made up name' })
        .expect(200)
        .expect(is_body_array)
        .expect(res => res.body.length < 1 ? '' : new Error('Too many games'))
}

/**
 *
 */
async function filter_by_date_range() {
    const early_date = new Date(2020, 1, 2).getTime()
    const late_date = new Date(2020, 1, 4).getTime()

    return request
        .get('/game')
        .set(headers)
        .query({ game_date_start: early_date, game_date_end: late_date })
        .expect(200)
        .expect(is_body_array)
        .expect(res => {
            const wrong_game = res.body.find(game => {
                const game_date = new Date(game.game_date)
                return game_date.getTime() > late_date || game_date.getTime() < early_date
            })
            if (wrong_game) {
                return new Error('The filter returned games outside the range')
            }
        })
}

/**
 *
 * @param {*} res
 */
function is_body_array(res) {
    if (!Array.isArray(res.body)) {
        throw new Error('Body is not an array')
    }
}

/**
 *
 */
async function filter_by_latest_date() {
    const date_to_check = new Date(2020, 1, 2).getTime()
    return request
        .get('/game')
        .set(headers)
        .query({ game_date_end: date_to_check })
        .expect(200)
        .expect(is_body_array)
        .expect(res => {
            const wrong_game = res.body.find(game => {
                const game_date = new Date(game.game_date)
                return game_date.getTime() > date_to_check
            })
            if (wrong_game) {
                return new Error('Filter gave newer games than requested')
            }
        })
}

/**
 *
 */
async function filter_by_earliest_date() {
    const date_to_check = new Date(2020, 1, 3).getTime()
    return request
        .get('/game')
        .set(headers)
        .query({ game_date_start: date_to_check })
        .expect(200)
        .expect(is_body_array)
        .expect(res => {
            const wrong_game = res.body.find(game => {
                const game_date = new Date(game.game_date)
                return game_date.getTime() < date_to_check
            })
            if (wrong_game) {
                return new Error('Filter gave older games than request: ' + JSON.stringify(wrong_game, null, 2))
            }
        })
}



/**
 *
 */
async function filter_by_position() {
    return request
        .get('/position')
        .set(headers)
        .set('fen', 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq d6 0 2')
        .expect(200)
}

/**
 *
 */
async function filter_by_white_and_black() {
    return request
        .get('/game')
        .set(headers)
        .query({
            black_player_name: 'player5.2we2'
            , white_player_name: 'player5.2we1'
            , players_relation: 'AND'
        })
        .expect(200)
        .expect(res => !Array.isArray(res.body) || res.body.length != 1 ? new Error('Wrong number of results') : '')
        .expect(res => res.body[ 0 ].black_player_name != 'player5.2we2' ? new Error('Wrong black player') : '')
        .expect(res => res.body[ 0 ].white_player_name != 'player5.2we1' ? new Error('Wrong white player') : '')

}

/**
 * Prepares and adds the games needed to test the filters
 */
async function before_5_2() {
    const base_moves = [
        {
            fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1'
            , san: 'd4'
            , half_move: 1
        }
        , {
            fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq d6 0 2'
            , san: 'd5'
            , half_move: 2
        }
    ]

    const promises = [
        add_game({ game: generate_game({ white: 'player5.2w', game_date: new Date(2020, 1, 1) }) })
        , add_game({ game: generate_game({ white: 'player5.2wb', black: 'player5.2wb', game_date: new Date(2020, 1, 2) }) })
        , add_game({ game: generate_game({ result: '1-0', game_date: new Date(2020, 1, 3) }) })
        , add_game({ game: generate_game({ result: '1-0', game_date: new Date(2020, 1, 1) }) })
        , add_game({ game: generate_game({ white: 'player5.2we1', black: 'player5.2we2', game_date: new Date(2020, 1, 1) }) })
        , add_game({ game: generate_game({ white: 'player5.2wf1', black: 'player5.2wf2', game_date: new Date(2020, 1, 3) }) })
        , add_game({ game: generate_game({ white: 'player5.2wg1', moves: base_moves, game_date: new Date(2020, 1, 4) }) })
        , add_game({ game: generate_game({ white: 'player5.2wh1', result: '1-0', moves: base_moves, game_date: new Date(2020, 1, 5) }) })
    ]
    await Promise.all(promises)
}

/**
 *
 */
async function filter_by_black_pieces() {
    return request
        .get('/game')
        .set(headers)
        .query({
            black_player_name: 'player5.2we2'
        })
        .expect(200)
        .expect(res => !Array.isArray(res.body) || res.body.length != 1 ? new Error('Wrong number of results') : '')
        .expect(res => res.body[ 0 ].black_player_name != 'player5.2we2' ? new Error('Wrong black player') : '')
        .expect(res => res.body[ 0 ].white_player_name != 'player5.2we1' ? new Error('Wrong white player') : '')
}

/**
 *
 */
async function filter_by_white_pieces() {
    return request
        .get('/game')
        .set(headers)
        .query({
            white_player_name: 'player5.2w'
        })
        .expect(200)
        .expect(res => !Array.isArray(res.body) || res.body.length != 1 ? new Error('Wrong number of results: ' + res.body) : '')
        .expect(res => res.body[ 0 ].white_player_name != 'player5.2w' ? new Error('Wrong white player') : '')
}

/**
 *
 */
async function filter_by_uncolored_player() {
    return request
        .get('/game')
        .set(headers)
        .query({
            players_relation: 'OR'
            , white_player_name: 'player5.2wb'
        })
        .expect(200)
        .expect(res => {
            if (!Array.isArray(res.body)) return new Error('Is not a list')
            if (res.body.length != 1) return new Error('Is a wrong amount')
            if (res.body[ 0 ].white_player_name != res.body[ 0 ].black_player_name) return new Error('Different players')
            if (res.body[ 0 ].white_player_name != 'player5.2wb') return new Error('Wrong player')
        })
}

/**
 * Create a client
 * @param {Object} body
 * @returns {Promise<Object>}
 */
function make_client(body) {
    return request
        .post('/client')
        .set({ 'x-api-key': process.env.X_API_KEY })
        .send(body)
        .expect(200)
}

/**
 *
 * @param {Object} [param]
 * @param {Array<Object.<fen:String, san: String, half_move:Number>} [param.moves]
 */
function generate_game(param) {
    param = param || {}
    if (!param.moves) {
        const chess = new Chess()
        param.moves = []
        let max_moves = 7
        while (!chess.game_over() && max_moves > 0) {
            const moves = chess.moves()
            const chosen_move = moves[ Math.floor(Math.random() * moves.length) ]
            const move = chess.move(chosen_move)
            move.fen = chess.fen()
            param.moves.push({
                fen: move.fen,
                san: move.san,
                half_move: param.moves.length
            })
            max_moves--
        }
    }
    const game_tags = {
        event: param.event || `event-${Math.ceil(Math.random() * 100)}`,
        site: param.site || `site-${Math.ceil(Math.random() * 100)}`,
        game_date: new Date(param.game_date || new Date().toISOString().substr(0, 10)).getTime(),
        round: param.round || Math.ceil(Math.random() * 100),
        white_player_name: param.white || `white-${Math.ceil(Math.random() * 100)}`,
        black_player_name: param.black || `black-${Math.ceil(Math.random() * 100)}`,
        source: param.source || `source-${Math.ceil(Math.random() * 100)}`,
        external_id: param.external_id || `external_id-${Math.ceil(Math.random() * 100)}`,
        game_result: param.result || '1/2',
        white_player_elo: param.white_elo || Math.ceil(Math.random() * 2700),
        black_player_elo: param.black_elo || Math.ceil(Math.random() * 2700),
        moves: param.moves
    }

    game_tags.raw = `[White "${game_tags.white_player_name}"]\n[Black "${game_tags.black_player_name}"]\n\n1.d4 d5`
    return game_tags
}

/**
 *
 * @param {Object} param
 * @param {Object} param.game
 * @param {Number} [param.expected_status]
 */
function add_game(param) {
    return request
        .post('/game')
        .set(headers)
        .send(param.game)
        .expect(param.expected_status || 200)
}

/**
 *
 * @param {Object} param
 * @param {String} param.id
 * @param {Number} [param.expected_status]
 */
function fetch_game(param) {
    return request
        .get(`/game/${param.id}`)
        .set({ 'x-api-key': process.env.X_API_KEY })
        .expect(param.expected_status || 200)
}