const supertest = require('supertest')
const request = supertest(`localhost:${process.env.HTTP_PORT}`)
const server = require('./server')
const mock = require('./mock')


const api_key = process.env.X_API_KEY || '374ct7sn4c743n3c4'
const client = `client tester ${Math.ceil(Math.random() * 99999)}`

describe('0 - Access', function () {
    before('Port must be set', async function () {
        if (!process.env.HTTP_PORT) {
            return Promise.reject('HTTP_PORT envvar not set')
        }
        return Promise.resolve()
    })

    before('Make sure express is running', server)

    it('0.1 - Requires a key', function () {
        return request
            .post('/position')
            .set('client_name', client)
            .send({
                fen: mock.gen_fen(),
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
            .set('client_name', client)
            .set('x-api-key', api_key)
            .expect(200)
            .expect(res => {
                if (res.text != '0.9') throw new Error('Version check failed')
            })
            .expect(res => {
                if (res.headers[ 'x-powered-by' ]) throw new Error('x-powered-by is present')
            })
    })
})