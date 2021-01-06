const supertest = require('supertest')
const request = supertest(`localhost:${process.env.HTTP_PORT}`)
const server = require('./server')
const mock = require('./mock')
const Test = require('../lib/test')

const position = {
    pos1: mock.gen_fen(),
    pos2: mock.gen_fen(),
    pos3: mock.gen_fen(),
    pos4: mock.gen_fen(),
    pos5: mock.gen_fen()
}

const headers = {
    resker_client: `client tester ${Math.ceil(Math.random() * 99999)}`,
    'x-api-key': process.env.X_API_KEY || '374ct7sn4c743n3c4'
}
const client = headers.resker_client

describe('1 - Position', function () {
    before('Make sure express is running', server)
    describe('1.1 - Queue', function () {
        it('1.1.1 - Queue position', function () {
            return request
                .post('/position')
                .set(headers)
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
                .set(headers)
                .expect(200)
                .expect(res => {
                    if (res.body.depth_goal != 30) throw new Error('Wrong depth')
                    if (res.body.multipv_goal != 4) throw new Error('Wrong multipv')
                    if (res.body.client != client) throw new Error('Wrong client')
                    if (!res.body.fen) throw new Error('Must include fen')
                })
        })

        it('1.1.3 - Store position with higher depth goal and multipv', function () {
            return request
                .post('/position')
                .set(headers)
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
                .set(headers)
                .set('fen', position.pos2)
                .set('client_name', client)
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
                .set(headers)
                .send({
                    fen: 'I made this up for 1.1.5',
                    depth_goal: 40,
                    multipv_goal: 4
                })
                .expect(400)
                .expect(res => res.body == 'Invalid fen')
        })

        describe('1.1.6 - Avoid abandoning a position', function() {
            const pos1 = mock.gen_fen()
            const pos2 = mock.gen_fen()
            before('Book the positions', async function() {
                await Test().clean_mock_mongo()
                await request
                    .post('/position')
                    .set(headers)
                    .send({
                        fen: pos1,
                        depth_goal:22,
                        multipv_goal: 2,
                        priority:1
                    })

                await request
                    .post('/position')
                    .set(headers)
                    .send({
                        fen: pos2,
                        depth_goal:32,
                        multipv_goal: 4,
                        priority:2
                    })
            })

            before('Get one position', async function () {
                return request
                    .get('/position/analysis/queue')
                    .set(headers)
                    .expect(200)
                    .expect(res => {
                        if (res.body.priority != 2) throw new Error('Wrong position, its not the highest prio')
                    })
            })

            before('Start an analysis', async function () {
                return request
                    .put('/position/status')
                    .set(headers)
                    .send({ status: 1, fen: pos2 })
                    .expect(200)
            })

            before('Add a higher prio position', async function () {
                await request
                    .post('/position')
                    .set(headers)
                    .send({
                        fen: mock.gen_fen(),
                        depth_goal:32,
                        multipv_goal: 4,
                        priority:3
                    })
            })

            it('Requesting the top position', async function () {
                return request
                    .get('/position/analysis/queue')
                    .set(headers)
                    .expect(200)
                    .expect(res => {
                        if (res.body.priority != 2) throw new Error('Wrong position, its not the highest prio')
                    })
            })
        })
    })

    describe('1.2 - Analysis', function () {
        before('1.2.0 - Queue position', function () {
            return request
                .post('/position')
                .set(headers)
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
                .set(headers)
                .send({ status: 1, fen: position.pos4 })
                .expect(200)
        })

        it('1.2.2 - Position has correct status', function () {
            return request
                .get('/position')
                .set(headers)
                .set('fen', position.pos4)
                .set('client_name', client)
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
                .set(headers)
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
                .set(headers)
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
                .set(headers)
                .set('fen', position.pos4)
                .set('client_name', client)
                .expect(200)
                .expect(res => {
                    if (!res.body.analysis) throw new Error('Missing analysis')
                    if (!res.body.analysis.find(x => x.engine_name == 'Migue 1.2.4')) throw new Error('Did not find 1.2.4 engine')
                })
        })

        it('1.2.6 - Add second analysis', function () {
            return request
                .post('/position/analysis')
                .set(headers)
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
                .set(headers)
                .set('fen', position.pos4)
                .set('client_name', client)
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
                .set(headers)
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
                    .set(headers)
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
                    .set(headers)
                    .set('fen', position.pos4)
                    .set('client_name', client)
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
                .set(headers)
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
                    steps: [ '-'.repeat(1.4*10^+7) ]
                })
                .expect(200)
        })

        it('1.3.2 - Max post size should be lower than 16MB', function () {
            return request
                .post('/position/analysis')
                .set(headers)
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