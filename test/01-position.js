const supertest = require('supertest')
const request = supertest('localhost:8001')
const position = [ 'r2q1k1r/p2p1pp1/2n4p/2pQP1b1/2N5/2N5/PP3PPP/R3K2R w KQ - 1 16' ]
const { MongoClient } = require('mongodb')

const api_key = process.env.X_API_KEY || '894hmt3x489ht89p3x'

/**
 *
 * @param {string} name
 */
async function drop_collection(name) {
    const connection = await MongoClient.connect(process.env.MONGO_HOST, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    const db = connection.db('resker')
    try {
        await db.collection(name).drop({})
    } catch (err) {
        return true
    } finally {
        connection.close()
    }
}
describe('1 - Position', function () {
    before('Clean slate', async function () {
        await drop_collection('position')
        await drop_collection('player')
        await drop_collection('game')
    })

    it('1.0 - Requires a key', function () {
        return request
            .post('/position')
            .send({
                fen: position[ 0 ],
                depth_goal: 40,
                priority: 10
            })
            .expect(401)
    })

    describe('1.1 - Queue', function () {
        it('1.1.1 - Queue position', function () {
            return request
                .post('/position')
                .set('x-api-key', api_key)
                .send({
                    fen: position[ 0 ],
                    depth_goal: 30,
                    priority: 10
                })
                .expect(200)
        })

        it('1.1.2 - Get queued position', function () {
            return request
                .get('/position/analysis/queue')
                .set('x-api-key', api_key)
                .expect(200)
                .expect(res => {
                    if (res.body.depth_goal != 30) throw new Error('Wrong depth')
                })
        })

        it('1.1.3 - Store position with higher depth goal', function () {
            return request
                .post('/position')
                .set('x-api-key', api_key)
                .send({
                    fen: position[ 0 ],
                    depth_goal: 40,
                    priority: 8
                })
                .expect(200)
        })

        it('1.1.4 - Confirm position has the highest values', function () {
            return request
                .get('/position')
                .set('x-api-key', api_key)
                .set('fen', position[ 0 ])
                .expect(200)
                .expect(res => {
                    if (res.body.depth_goal != 40) throw new Error('Wrong position depth')
                    if (res.body.priority != 10) throw new Error('Wrong priority')
                })
        })
    })

    describe('1.2 - Analysis', function () {
        it('1.2.1 - Start an analysis', function () {
            return request
                .put('/position/status')
                .set('x-api-key', api_key)
                .send({ status: 1, fen: position[ 0 ] })
                .expect(200)
        })

        it('1.2.2 - Position has correct status', function () {
            return request
                .get('/position')
                .set('x-api-key', api_key)
                .set('fen', position[ 0 ])
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
                .set('x-api-key', api_key)
                .send({
                    fen: position[ 0 ],
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
                .set('x-api-key', api_key)
                .send({
                    fen: position[ 0 ],
                    best_move: 'd2d4',
                    depth: 40,
                    nodes: 3260129921,
                    pv: 'd2d4 e5e4',
                    multipv: 1,
                    score: 1.2,
                    engine_name: 'Migue 1.6'
                })
                .expect(200)
        })

        it('1.2.5 - Confirm the analysis was stored', function () {
            return request
                .get('/position')
                .set('x-api-key', api_key)
                .set('fen', position[ 0 ])
                .expect(200)
                .expect(res => {
                    if (!res.body.analysis) throw new Error('Missing analysis')
                    if (!res.body.analysis.find(x => x.engine_name == 'Migue 1.6')) throw new Error('Did not find 1.6 engine')
                })
        })

        it('1.2.6 - Add second analysis', function () {
            return request
                .post('/position/analysis')
                .set('x-api-key', api_key)
                .send({
                    fen: position[ 0 ],
                    best_move: 'd2d5',
                    depth: 40,
                    nodes: 3260129921,
                    pv: 'd2d54 e5e4',
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
                .set('fen', position[ 0 ])
                .expect(200)
                .expect(res => {
                    if (!res.body.analysis) throw new Error('Missing analysis')
                    if (!res.body.analysis.find(x => x.engine_name == 'Migue 1.6')) throw new Error('Did not find 1.6 engine')
                    if (!res.body.analysis.find(x => x.engine_name == 'Migue 1.8')) throw new Error('Did not find 1.8 engine')
                })
        })

        it('1.2.8 - Try to insert analysis for a new position', function () {
            return request
                .post('/position/analysis')
                .set('x-api-key', api_key)
                .send({
                    fen: 'r2q1k1r/p2p1pp1/2n4p/2pQP1b1/2N5/2N5/PP3PPP/R3K2R w KQ - 2 16',
                    best_move: 'd2d5',
                    depth: 40,
                    nodes: 3260129921,
                    pv: 'd2d54 e5e4',
                    multipv: 1,
                    score: 1.2,
                    engine_name: '1.10'
                })
                .expect(200)
        })

        describe('1.2.9 - Try to insert an analysis with too many params', function () {
            before('Prepare', function () {
                return request
                    .post('/position/analysis')
                    .set('x-api-key', api_key)
                    .send({
                        fen: 'r2q1k1r/p2p1pp1/2n4p/2pQP1b1/2N5/2N5/PP3PPP/R3K2R w KQ - 2 16',
                        best_move: 'd2d5',
                        depth: 40,
                        nodes: 3260129921,
                        pv: 'd2d54 e5e4',
                        multipv: 1,
                        score: 1.2,
                        engine_name: '1.10',
                        extra_param: 1234
                    })
                    .expect(200)
            })

            it('1.2.9 - Confirm', function () {
                return request
                    .get('/position')
                    .set('x-api-key', api_key)
                    .set('fen', position[ 0 ])
                    .expect(200)
                    .expect(res => {
                        if (!res.body.analysis) throw new Error('Missing analysis')
                        if (res.body.analysis.find(x => x.extra_param)) throw new Error('Found extra param')
                    })
            })
        })
    })



})