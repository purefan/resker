const supertest = require('supertest')
const request = supertest(`localhost:${process.env.HTTP_PORT}`)
const mock = require('./mock')
const TestUtils = require('../lib/test')()
const server = require('./server')

const headers = {
    'resker_client': TestUtils.clients_manager.make(
        {
            client_name: `client tester made by hand 3 - ${Math.ceil(Math.random() * 99999)}`,
            'x-api-key': process.env.X_API_KEY || '374ct7n4c743n3c4'
        }
    ),
    'x-api-key': process.env.X_API_KEY || '374ct7n4c743n3c4'
}

let cached_positions = []

/**
 * 3 - Client
 * 3.1 - Active Clients
 * 3.1.1 -
 */

describe('3 - Client', function () {
    before('Prepare express', server)

    describe('3.0 - Client management', function () {
        it('3.0.0 - Can create a client', () => create_client({
            x_api_key: '3.0.0-can-create-a-client',
            headers: {
                'x-api-key': process.env.X_API_KEY
            }
        }))
    })

    describe('3.1 - Active Clients', function () {
        describe('3.1.0 - Adding a position registers an active client', function () {
            before('Register a position', () => register_a_position())

            it('3.1.0 - Get active clients', () => get_active_clients())
        })


        describe('3.1.1 - The last active gets updated on status change', function () {
            before('Create a client', async () => {
                const this_api_key = '311-311-311-311'
                const client_name = 'client-3.1.1'
                return request
                    .post('/client')
                    .set(headers) // Super user that can create clients
                    .send({
                        client_name,
                        api_key: this_api_key
                    })
                    .expect(200)
                    .then(res => {
                        const new_client = TestUtils.clients_manager.make({
                            x_api_key: this_api_key,
                            id: res.body.id,
                            last_active: res.body.last_active,
                            client_name
                        })
                        TestUtils.clients_manager.set(311, new_client)
                    })
            })

            before('Reserve position', function () {
                return request
                    .put('/position/status')
                    .set(TestUtils.clients_manager.get(311).get('headers'))
                    .send({ status: 1, fen: mock.gen_fen() })
                    .expect(200)
            })

            it('Confirm the last active value changed when changing status', function () {
                return request
                    .get(`/client/${TestUtils.clients_manager.get(311).get('id')}`)
                    .set(TestUtils.clients_manager.get(311).get('headers'))
                    .expect(200)
                    .then(res => {
                        if (TestUtils.clients_manager.get(311).get('last_active') >= res.body.last_active) {
                            throw new Error('Did not update the last_active value')
                        }
                    })
            })
        })

        describe('3.1.2 - Can disable a client', function () {
            before('Create a client', () => create_client({ headers, x_api_key: 'client-3.1.2-first', client_name: 'client-3.1.2-first' }).then(new_client => TestUtils.clients_manager.set(312, new_client)))
            before('Create a client', () => create_client({ headers, x_api_key: 'client-3.1.2-second', client_name: 'client-3.1.2-second' }).then(new_client => TestUtils.clients_manager.set(3121, new_client)))
            // No need to insert a position because the status codes are different 401 != 400 != 200
            before('Make sure the client can get the top position', () => {
                const headers_for_312 = TestUtils.clients_manager.get(312)
                return request
                    .get('/position/analysis/queue')
                    .set(headers_for_312.get('headers'))
                    .then(res => {
                        if (res.status == 401) {
                            throw new Error('Not authorized, but should have')
                        }
                    })
            })

            before('Disable this client', () => {
                return request
                    .put(`/client/${TestUtils.clients_manager.get(312).get('id')}`)
                    .set(TestUtils.clients_manager.get(3121).get('headers'))
                    .send({ is_active: false })
                    .expect(200)
            })

            it('312 - Disabled clients do not get positions', () => {
                return request
                    .get('/position/analysis/queue')
                    .set(TestUtils.clients_manager.get(312).get('headers'))
                    .expect(401)
            })
        })

        describe('3.1.3 - Can enable a client', function () {
            before('Create a client', () => create_client({ x_api_key: 'super_key for 313', headers, client_name: 'client-3.1.3' }).then(new_client => TestUtils.clients_manager.set(313, new_client)))
            //before('Register a position', () => register_a_position({ client: TestUtils.clients_manager.get(313) }))
            before('Make sure the client can get the top position', () => {
                return request
                    .get('/position/analysis/queue')
                    .set(TestUtils.clients_manager.get(313).get('headers'))
                    .then(res => {
                        if (res.status == 401) {
                            throw new Error('Not authorized, but should have')
                        }
                    })
            })
            before('Disable this client', () => {
                return request
                    .put(`/client/${TestUtils.clients_manager.get(313).get('id')}`)
                    .set(TestUtils.clients_manager.get(313).get('headers'))
                    .send({ is_active: false })
                    .expect(200)
            })

            before('313 - Disabled clients do not get positions', () => {
                return request
                    .get('/position/analysis/queue')
                    .set(TestUtils.clients_manager.get(313).get('headers'))
                    .expect(401)
            })

            before('Lets enable this client again', function () {
                return request
                    .put(`/client/${TestUtils.clients_manager.get(313).get('id')}`)
                    .set(TestUtils.clients_manager.get('first').get('headers'))
                    .send({ is_active: true })
                    .expect(200)
            })
            it('Test that this client can get positions again', function () {
                return request
                    .get('/position/analysis/queue')
                    .set(TestUtils.clients_manager.get(313).get('headers'))
                    .expect(200)
            })
        })
    })
})

/**
 *
 */
function register_a_position(param) {
    cached_positions.push(mock.gen_fen())
    return add_position(param)
}

/**
 * @param {Object} param
 * @param {Boolean} param.clear Remove existing clients
 * @param {String} param.client_name
 * @param {Object} param.headers
 * @param {String} param.headers.x_api_key
 * @param {String} param.x_api_key
 */
function create_client(param) {
    param = Object.assign({ headers: {} }, param)
    const body = {
        client_name: param.client_name || '3-create-client',
        api_key: param.x_api_key
    }
    return request
        .post('/client')
        .set({ 'x-api-key': param.headers[ 'x-api-key' ] })
        .send(body)
        .expect(200)
        .then(res => {
            if (!res.body.id) { throw new Error('Missing id when creating client') }
            if (param.clear == true) { TestUtils.clients_manager.clear() }
            return TestUtils.clients_manager.make({
                client_name: param.client_name || '3-create-client',
                'x-api-key': `${param.x_api_key}`,
                id: res.body.id,
                last_active: res.body.last_active
            })
        })
}


/**
 *
 */
function get_active_clients(param) {
    param = Object.assign({}, param)
    return request
        .get('/client/active')
        .set(param.headers || headers)
        .expect(200)
        .then(res => {
            if (!res.body.clients || !Array.isArray(res.body.clients) || res.body.clients.length < 1) {
                throw new Error('Missing clients')
            }

            // all clients must have an id
            const bad_clients = res.body.clients.filter(client => !client.id)
            if (bad_clients.length > 0) {
                throw new Error('All clients must have an id')
            }
            if (!param.store_client || param.store_client == true) {
                res.body.clients.map(client => TestUtils.clients_manager.make(client))
            }
            return res
        })
}

/**
 * @param {Object} param
 * @param {TestClient} param.client
*/
function add_position(param) {
    param = Object.assign({}, param)
    const client = param.client || TestUtils.clients_manager.get('first')
    return request
        .post('/position')
        .set(client.get('headers'))
        .send({
            fen: cached_positions[ cached_positions.length - 1 ],
            depth_goal: 30,
            multipv_goal: 4,
            priority: 10
        })
        .expect(200)
}