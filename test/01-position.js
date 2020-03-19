const supertest = require('supertest')
const request = supertest(`localhost:${process.env.HTTP_PORT}`)

/**
 * Generates the same position from position[0] with a random ply since last capture
 */
function gen_fen() { return `r2q1k1r/p2p1pp1/2n4p/2pQP1b1/2N5/2N5/PP3PPP/R3K2R w KQ - 1 ${Math.ceil(Math.random() * 9999)}` }

const position = {
    pos1: gen_fen(),
    pos2: gen_fen(),
    pos3: gen_fen(),
    pos4: gen_fen(),
    pos5: gen_fen()
}


const api_key = process.env.X_API_KEY || '374ct7sn4c743n3c4'
const client = `client tester ${Math.ceil(Math.random() * 99999)}`

describe('0 - Access', function () {
    before('Port must be set', async function () {
        if (!process.env.HTTP_PORT) {
            return Promise.reject('HTTP_PORT envvar not set')
        }
        return Promise.resolve()
    })
    const server = require('../server')
    let app
    before('Prepare express', async function () {
        app = await server()
        app.listen(process.env.HTTP_PORT, () => {
        })
    })

    after('Cleanup', async function () {
        const db = require('../lib/db')
        const client = await db.connect()
        client.close()
    })

    it('0.1 - Requires a key', function () {
        return request
            .post('/position')
            .set('resker_client', client)
            .send({
                fen: position.pos1,
                depth_goal: 40,
                priority: 10
            })
            .expect(401)
    })

    it('0.2 - Only the correct key works', function () {
        return request
            .get('/position/analysis/queue')
            .set({
                'x-api-key': Math.ceil(Math.random() * 999), // Random key that should not be valid
                client
            })
            .expect(401)
    })

    it('0.3 - Version and x-powered-by check', function () {
        return request
            .get('/version')
            .set('resker_client', client)
            .set('x-api-key', api_key)
            .expect(200)
            .expect(res => {
                if (res.text != '0.9') throw new Error('Version check failed')
            })
            .expect(res => {
                if (res.headers[ 'x-powered-by' ]) throw new Error('x-powered-by is present')
            })
    })

    it('0.4 - client is required', function () {
        return request
            .get('/position/analysis/queue')
            .set('x-api-key', api_key)
            .expect(400) // should fail because no client
    })
})

describe('1 - Position', function () {
    describe('1.1 - Queue', function () {
        it('1.1.1 - Queue position', function () {
            return request
                .post('/position')
                .set({
                    'resker_client': client,
                    'x-api-key': api_key
                })
                .send({
                    fen: position.pos2,
                    depth_goal: 30,
                    multipv_goal: 4,
                    priority: 10
                })
                .expect(200)
        })

        it('1.1.2 - Get top queued position', function () {
            return request
                .get('/position/analysis/queue')
                .set({
                    'resker_client': client,
                    'x-api-key': api_key
                })
                .expect(200)
                .expect(res => {
                    if (res.body.depth_goal != 30) throw new Error('Wrong depth')
                    if (res.body.multipv_goal != 4) throw new Error('Wrong multipv')
                    if (res.body.client != client) throw new Error('Wrong client')
                })
        })

        it('1.1.3 - Store position with higher depth goal and multipv', function () {
            return request
                .post('/position')
                .set({
                    'resker_client': client,
                    'x-api-key': api_key
                })
                .send({
                    fen: position.pos2,
                    depth_goal: 40,
                    multipv_goal: 5,
                    priority: 8
                })
                .expect(200)
        })

        it('1.1.4 - Confirm position has the highest values', function () {
            return request
                .get('/position')
                .set('x-api-key', api_key)
                .set('fen', position.pos2)
                .set('resker_client', client)
                .expect(200)
                .expect(res => {
                    if (res.body.depth_goal != 40) throw new Error('Wrong position depth')
                    if (res.body.priority != 10) throw new Error('Wrong priority')
                    if (res.body.multipv_goal != 5) throw new Error('Wrong multipv')
                })
        })

        it('1.1.5 - Fen must be valid', function () {
            return request
                .post('/position')
                .set({
                    'resker_client': client,
                    'x-api-key': api_key
                })
                .send({
                    fen: 'I made this up for 1.1.5',
                    depth_goal: 40,
                    multipv_goal: 4
                })
                .expect(400)
                .expect(res => res.body == 'Invalid fen')
        })
    })

    describe('1.2 - Analysis', function () {
        before('1.2.0 - Queue position', function () {
            return request
                .post('/position')
                .set({
                    'resker_client': client,
                    'x-api-key': api_key
                })
                .send({
                    fen: position.pos4,
                    depth_goal: 120,
                    multipv_goal: 4,
                    priority: 10
                })
                .expect(200)
        })
        it('1.2.1 - Start an analysis', function () {
            return request
                .put('/position/status')
                .set({
                    'resker_client': client,
                    'x-api-key': api_key
                })
                .send({ status: 1, fen: position.pos4 })
                .expect(200)
        })

        it('1.2.2 - Position has correct status', function () {
            return request
                .get('/position')
                .set('x-api-key', api_key)
                .set('fen', position.pos4)
                .set('resker_client', client)
                .expect(200)
                .expect(res => {
                    if (res.body.status != 1) {
                        throw new Error('Wrong status')
                    }
                })
        })

        it('1.2.3 - Store incomplete analysis', function () {
            return request
                .post('/position/analysis')
                .set({
                    'resker_client': client,
                    'x-api-key': api_key
                })
                .send({
                    fen: position.pos4,
                    multipv: 1,
                    client,
                    engine_name: '1.2.3',
                    // best_move is missing
                    depth: 40,
                    nodes: 3260129920,
                    pv: 'd2d4',
                    score: 1.2
                })
                .expect(400)
                .expect(res => {
                    if (!res.body.errors) throw new Error('Missing error')
                })
        })

        it('1.2.4 - Store complete analysis', function () {
            return request
                .post('/position/analysis')
                .set({
                    'resker_client': client,
                    'x-api-key': api_key
                })
                .send({
                    fen: position.pos4,
                    best_move: 'd2d4',
                    client,
                    depth: 40,
                    nodes: 3260129921,
                    pv: 'd2d4 e5e4',
                    multipv: 1,
                    score: 1.2,
                    engine_name: 'Migue 1.2.4'
                })
                .expect(200)
        })

        it('1.2.5 - Confirm the analysis was stored', function () {
            return request
                .get('/position')
                .set('x-api-key', api_key)
                .set('fen', position.pos4)
                .set('resker_client', client)
                .expect(200)
                .expect(res => {
                    if (!res.body.analysis) throw new Error('Missing analysis')
                    if (!res.body.analysis.find(x => x.engine_name == 'Migue 1.2.4')) throw new Error('Did not find 1.2.4 engine')
                })
        })

        it('1.2.6 - Add second analysis', function () {
            return request
                .post('/position/analysis')
                .set({
                    'resker_client': client,
                    'x-api-key': api_key
                })
                .send({
                    fen: position.pos4,
                    best_move: 'd2d5',
                    depth: 40,
                    nodes: 3260129921,
                    pv: 'd2d54 e5e4',
                    client,
                    multipv: 1,
                    score: 1.2,
                    engine_name: 'Migue 1.8'
                })
                .expect(200)
        })

        it('1.2.7 - Confirm that both analysis were stored', function () {
            return request
                .get('/position')
                .set('x-api-key', api_key)
                .set('fen', position.pos4)
                .set('resker_client', client)
                .expect(200)
                .expect(res => {
                    if (!res.body.analysis) throw new Error('Missing analysis')
                    if (!res.body.analysis.find(x => x.engine_name == 'Migue 1.2.4')) throw new Error('Did not find 1.2.4 engine')
                    if (!res.body.analysis.find(x => x.engine_name == 'Migue 1.8')) throw new Error('Did not find 1.8 engine')
                })
        })

        it('1.2.8 - Try to insert analysis for a new position', function () {
            return request
                .post('/position/analysis')
                .set({
                    'resker_client': client,
                    'x-api-key': api_key
                })
                .send({
                    fen: 'r2q1k1r/p2p1pp1/2n4p/2pQP1b1/2N5/2N5/PP3PPP/R3K2R w KQ - 2 16',
                    best_move: 'd2d5',
                    depth: 40,
                    nodes: 3260129921,
                    pv: 'd2d54 e5e4',
                    multipv: 1,
                    score: 1.2,
                    client,
                    engine_name: '1.10'
                })
                .expect(200)
        })

        describe('1.2.9 - Try to insert an analysis with too many params', function () {
            before('Prepare', function () {
                return request
                    .post('/position/analysis')
                    .set({
                        'resker_client': client,
                        'x-api-key': api_key
                    })
                    .send({
                        fen: 'r2q1k1r/p2p1pp1/2n4p/2pQP1b1/2N5/2N5/PP3PPP/R3K2R w KQ - 2 16',
                        best_move: 'd2d5',
                        depth: 40,
                        nodes: 3260129921,
                        pv: 'd2d54 e5e4',
                        multipv: 1,
                        score: 1.2,
                        client,
                        engine_name: '1.10',
                        extra_param: 1234
                    })
                    .expect(200)
            })

            it('1.2.9 - Confirm', function () {
                return request
                    .get('/position')
                    .set('x-api-key', api_key)
                    .set('fen', position.pos4)
                    .set('resker_client', client)
                    .expect(200)
                    .expect(res => {
                        if (!res.body.analysis) throw new Error('Missing analysis')
                        if (res.body.analysis.find(x => x.extra_param)) throw new Error('Found extra param')
                    })
            })
        })
    })

    describe('1.3 - Limits', function () {
        it('1.3.1 - Max post size should be 15MB', function () {
            return request
                .post('/position/analysis')
                .set({
                    'resker_client': client,
                    'x-api-key': api_key
                })
                .send({
                    fen: position.pos4,
                    best_move: 'd2d4',
                    client,
                    depth: 40,
                    nodes: 3260129921,
                    pv: 'd2d4 e5e4',
                    multipv: 1,
                    score: 1.2,
                    engine_name: 'Migue 1.3.1',
                    steps: [ '-'.repeat(1000000 * 15) ]
                })
                .expect(200)
        })

        it('1.3.2 - Max post size should be lower than 16MB', function () {
            return request
                .post('/position/analysis')
                .set({
                    'resker_client': client,
                    'x-api-key': api_key
                })
                .send({
                    fen: position.pos4,
                    best_move: 'd2d4',
                    client,
                    depth: 40,
                    nodes: 3260129921,
                    pv: 'd2d4 e5e4',
                    multipv: 1,
                    score: 1.2,
                    engine_name: 'Migue 1.3.2',
                    steps: [ '-'.repeat(1000000 * 17) ]
                })
                .expect(413)
        })
    })
})