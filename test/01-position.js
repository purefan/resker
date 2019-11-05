const supertest = require('supertest')
const request = supertest('localhost:10001')
const position = [ 'r2q1k1r/p2p1pp1/2n4p/2pQP1b1/2N5/2N5/PP3PPP/R3K2R w KQ - 1 16' ]
const config = require('../config')
const { MongoClient } = require('mongodb')

/**
 *
 * @param {string} name
 */
async function drop_collection(name) {
    const connection = await MongoClient.connect(config.mongo.url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    const db = connection.db(config.mongo.name)
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

    it('1.1 - Queue position', function () {
        return request
            .post('/position')
            .set('x-api-key', config.api_keys[ 0 ])
            .send({
                fen: position[ 0 ],
                depth_goal: 40,
                priority: 10
            })
            .expect(200)
    })

    it('1.2 - Get queued position', function () {
        return request
            .get('/position/analysis/queue')
            .set('x-api-key', config.api_keys[ 0 ])
            .expect(200)
    })

    it('1.3 - Start an analysis', function () {
        return request
            .put('/position/status')
            .set('x-api-key', config.api_keys[ 0 ])
            .send({ status: 1, fen: position[ 0 ] })
            .expect(200)
    })

    it('1.4 - Position has correct status', function () {
        return request
            .get('/position')
            .set('x-api-key', config.api_keys[ 0 ])
            .set('fen', position[ 0 ] || 'dsds')
            .expect(200)
            .expect(res => {
                if (res.body.status != 1) {
                    throw new Error('Wrong status')
                }
            })
    })

    it('1.5 - Store incomplete analysis', function () {
        return request
            .post('/position/analysis')
            .set('x-api-key', config.api_keys[ 0 ])
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

    it('1.6 - Store complete analysis', function () {
        return request
            .post('/position/analysis')
            .set('x-api-key', config.api_keys[ 0 ])
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

    it('1.7 - Confirm the analysis was stored', function () {
        return request
            .get('/position')
            .set('x-api-key', config.api_keys[ 0 ])
            .set('fen', position[ 0 ])
            .expect(200)
            .expect(res => {
                if (!res.body.analysis) throw new Error('Missing analysis')
                if (!res.body.analysis.find(x => x.engine_name == 'Migue 1.6')) throw new Error('Did not find 1.6 engine')
            })
    })

    it('1.8 - Add second analysis', function () {
        return request
            .post('/position/analysis')
            .set('x-api-key', config.api_keys[ 0 ])
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

    it('1.9 - Confirm that both analysis were stored', function () {
        return request
            .get('/position')
            .set('x-api-key', config.api_keys[ 0 ])
            .set('fen', position[ 0 ])
            .expect(200)
            .expect(res => {
                if (!res.body.analysis) throw new Error('Missing analysis')
                if (!res.body.analysis.find(x => x.engine_name == 'Migue 1.6')) throw new Error('Did not find 1.6 engine')
                if (!res.body.analysis.find(x => x.engine_name == 'Migue 1.8')) throw new Error('Did not find 1.8 engine')
            })
    })

    it('1.10 - Try to insert analysis for a new position', function () {
        return request
            .post('/position/analysis')
            .set('x-api-key', config.api_keys[ 0 ])
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

    describe('1.11 - Try to insert an analysis with too many params', function () {
        before('Prepare', function () {
            return request
                .post('/position/analysis')
                .set('x-api-key', config.api_keys[ 0 ])
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

        it('Confirm', function () {
            return request
                .get('/position')
                .set('x-api-key', config.api_keys[ 0 ])
                .set('fen', position[ 0 ])
                .expect(200)
                .expect(res => {
                    if (!res.body.analysis) throw new Error('Missing analysis')
                    if (res.body.analysis.find(x => x.extra_param)) throw new Error('Found extra param')
                })
        })

    })
})