const supertest = require('supertest')
const request = supertest(`localhost:${process.env.HTTP_PORT}`)
const mock = require('./mock')

const api_key = process.env.X_API_KEY || '374ct7n4c743n3c4'
const client = `client tester 3 - ${Math.ceil(Math.random() * 99999)}`
const server = require('./server')
const headers = {
    'resker_client': client,
    'x-api-key': api_key
}

let cached_clients = {}
let cached_positions = []

describe('3 - Client', function () {
    before('Prepare express', server)
    describe('3.1 - Active Clients', function () {
        before('3.1.0 - Make sure there is one active client', function () {
            cached_positions.push(mock.gen_fen())
            return request
                .post('/position')
                .set(headers)
                .send({
                    fen: cached_positions[ cached_positions.length - 1 ],
                    depth_goal: 30,
                    multipv_goal: 4,
                    priority: 10
                })
                .expect(200)
        })

        it('3.1.1 - Get active clients', get_active_clients)

        describe('3.1.2 - The last active gets updated', function () {
            before('Store a client for comparison', get_active_clients)
            before('Reserve position', function () {
                return request
                    .put('/position/status')
                    .set(headers)
                    .send({ status: 1, fen: cached_positions[ cached_positions.length - 1 ] })
                    .expect(200)
            })

            it('3.1.2 - Confirm the last active value changed', function () {
                return request
                    .get('/client/active')
                    .set(headers)
                    .expect(200)
                    .expect(res => {
                        // find the same client
                        const found_client = res.body.clients.find(client => client.id == Object.keys(cached_clients)[ 0 ])
                        if (!found_client) {
                            throw new Error('Internal testing error')
                        }
                        if (found_client.last_active <= cached_clients[ found_client.id ].last_active) {
                            throw new Error('The last active was not updated')
                        }
                    })
            })
        })
    })
})

/**
 *
 */
function get_active_clients() {
    return request
        .get('/client/active')
        .set(headers)
        .expect(200)
        .expect(res => {
            if (!res.body.clients || !Array.isArray(res.body.clients) || res.body.clients.length < 1) {
                throw new Error('Missing clients')
            }

            // all clients must have an id
            const bad_clients = res.body.clients.filter(client => !client.id)
            if (bad_clients.length > 0) {
                throw new Error('All clients must have an id')
            }
            res.body.clients.map(client => cached_clients[ client.id ] = client)
            return res
        })
}