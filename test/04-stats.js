const supertest = require('supertest')
const request = supertest(`localhost:${process.env.HTTP_PORT}`)
const TestUtils = require('../lib/test')()
const server = require('./server')

const headers = {
    'resker_client': TestUtils.clients_manager.make(
        {
            client_name: `Supertest for 04-stats.js - ${Math.ceil(Math.random() * 99999)}`,
            'x-api-key': process.env.X_API_KEY
        }
    ),
    'x-api-key': process.env.X_API_KEY
}

/**
 * 4 - Stats
 */

describe('4 - Stats', function () {
    before('Prepare express', server)
    before('Create a client', () => {
        const body = {
            client_name: '4.0.0-client',
            api_key: 'api_key_for_client_4.0.0'
        }
        return make_client(body)
            .then(res => {
                if (!res.body.id) { throw new Error('Missing id when creating client') }
                return TestUtils.clients_manager.make({
                    client_name: body.client_name,
                    'x-api-key': body.api_key,
                    id: res.body.id,
                    last_active: res.body.last_active
                })
            })
    })
    it('4.1 - Can get statistics', () => {
        return get_stats(TestUtils.clients_manager.get('first').get('headers'))
            .then(assert_stats_object)
            .then(res => {
                if (!Object.prototype.hasOwnProperty.call(res.headers, 'cache-control')) {
                    throw new Error('Missing cache header')
                }
                const match = res.headers[ 'cache-control' ].match(/max-age=(\d+)/i)
                if (match[ 1 ] < 60) {
                    throw new Error('Cache control is too low, must be in seconds')
                }
            })
    })

    describe('4.2 - Stats get updated', () => {
        describe('4.2.1 - Queue a position', function () {
            let stats = {}
            let updated_stats = {}
            before('Fetch initial stats', function () {
                return get_stats(TestUtils.clients_manager.get('first').get('headers'))
                    .then(assert_stats_object)
                    .then(res => {
                        stats = res.body
                    })
            })

            before('Queue a position', function () {
                return add_position({ half_move: 1 })
            })

            it('Counter matches +1', function () {
                return get_stats(TestUtils.clients_manager.get('first').get('headers'))
                    .then(assert_stats_object)
                    .then(res => {
                        if ((stats.to_do + 1) != res.body.to_do) {
                            throw new Error('Queueing a position did not increase the counter')
                        }
                        updated_stats = res.body
                    })
            })

            it('Other counters did not change', function () {
                if (stats.processing != updated_stats.processing) {
                    throw new Error('stats corruption on processing')
                }
                if (stats.completed != updated_stats.completed) {
                    throw new Error('stats corruption on completed')
                }
            })
        })

        /**
         * Tests need to be independent
         */
        describe('4.2.2 - Reserve a position', function () {
            let stats = {}
            let updated_stats = {}
            before('Fetch initial stats', function () {
                return get_stats(TestUtils.clients_manager.get('first').get('headers'))
                    .then(assert_stats_object)
                    .then(res => {
                        stats = res.body
                    })
            })
            before('Queue a position', function () {
                return add_position({ half_move: 2 })
            })

            before('Reserve a position', function () {
                return reserve_position({ half_move: 2 })
            })

            it('Counter matches +1', function () {
                return get_stats(TestUtils.clients_manager.get('first').get('headers'))
                    .then(assert_stats_object)
                    .then(res => {
                        if ((stats.processing + 1) != res.body.processing) {
                            throw new Error('Processing a position did not increase the counter')
                        }

                        updated_stats = res.body
                    })
            })

            it('Other counters did not change', function () {
                if (stats.to_do != updated_stats.to_do) {
                    throw new Error('stats corruption on to_do')
                }
                if (stats.completed != updated_stats.completed) {
                    throw new Error('stats corruption on completed')
                }
            })
        })

        describe('4.2.3 - Complete a position', function () {
            let stats = {}
            let updated_stats = {}
            before('Fetch initial stats', function () {
                return get_stats(TestUtils.clients_manager.get('first').get('headers'))
                    .then(assert_stats_object)
                    .then(res => {
                        stats = res.body
                    })
            })
            before('Queue a position', function () {
                return add_position({ half_move: 3 })
            })

            before('Reserve a position', function () {
                return reserve_position({ half_move: 3 })
            })

            before('Complete a position', function () {
                return complete_analysis({ half_move: 3 })
            })

            it('Counter matches +1', function () {
                return get_stats(TestUtils.clients_manager.get('first').get('headers'))
                    .then(assert_stats_object)
                    .then(res => {
                        if ((stats.completed + 1) != res.body.completed) {
                            throw new Error('Completed + 1 doesnt match')
                        }
                        updated_stats = res.body
                    })
            })
            it('Other counters did not change', function () {
                if (stats.to_do != updated_stats.to_do) {
                    throw new Error('stats corruption on to_do')
                }
                if (stats.processing != updated_stats.processing) {
                    throw new Error('stats corruption on processing')
                }
            })
        })
    })
})

/**
 *
 * @param {Object} param
 */
function complete_analysis(param) {
    return request
        .post('/position/analysis')
        .set(headers)
        .send({
            fen: `r2q1k1r/p2p1pp1/2n4p/2pQP1b1/2N5/2N5/PP3PPP/R3K2R w KQ - 1 ${param.half_move}`,
            best_move: 'd2d4',
            client: 'Dont think this is needed anymore...',
            depth: 40,
            nodes: 3260129921,
            pv: 'd2d4 e5e4',
            multipv: 1,
            score: 1.2,
            engine_name: 'Migue 4.2.3'
        })
        .expect(200)
}

/**
 *
 * @param {Object} param
 */
function reserve_position(param) {
    return request
        .put('/position/status')
        .set(headers)
        .send({ status: 1, fen: `r2q1k1r/p2p1pp1/2n4p/2pQP1b1/2N5/2N5/PP3PPP/R3K2R w KQ - 1 ${param.half_move}` })
        .expect(200)
}

/**
 *
 * @param {object} param
 * @param {number} param.half_move
 */
function add_position(param) {
    return request
        .post('/position')
        .set(headers)
        .send({
            fen: `r2q1k1r/p2p1pp1/2n4p/2pQP1b1/2N5/2N5/PP3PPP/R3K2R w KQ - 1 ${param.half_move}`,
            depth_goal: 30,
            multipv_goal: 4,
            priority: 10
        })
        .expect(200)
}

/**
 * Makes sure that res.body has valid fields for a stats object
 * @param {Object} res
 */
function assert_stats_object(res) {
    if (!Object.prototype.hasOwnProperty.call(res.body, 'to_do')) {
        throw new Error('Missing field "to_do"')
    }
    if (!Object.prototype.hasOwnProperty.call(res.body, 'processing')) {
        throw new Error('Missing field "processing"')
    }
    if (!Object.prototype.hasOwnProperty.call(res.body, 'completed')) {
        throw new Error('Missing field "completed"')
    }
    return res
}

/**
 * Fetches stats
 * @param {Object} headers
 */
function get_stats(headers) {
    return request
        .get('/stats')
        .set(headers)
        .expect(200)
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