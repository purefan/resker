#!/bin/node
const osprey = require('osprey')
const express = require('express')
const join = require('path').join
const app = express()
const debug = require('debug')('resker')
const Position = require('./lib/db/position')
/**
 *
 */
function handler() {
    /**
     *
     */
    return function (req, res, next) {
        const log = debug.extend('validator')
        log('validator handler %O %s', req.headers, req.originalUrl)
        if (!req.headers[ 'x-api-key' ]) {
            return res.status(401).send('No key')
        }

        // Check with the database and see if the token is valid.
        setTimeout(function () {
            return next()
        }, 1000)
    }
}

(async function () {
    if (!process.env.MONGO_HOST || process.env.MONGO_HOST.length < 5) {
        throw new Error('MONGO_HOST is not set')
    }
    const path = join(__dirname, 'assets', 'api.raml')
    const security_definition = {
        api_key: function () {
            return { handler }
        }
    }
    const middleware = await osprey.loadFile(path, {
        security: security_definition,
        disableErrorInterception: true,
        rejectOnErrors: true,
        strict: true
    })
    app.post('/position', middleware, post_position)
    app.post('/position/analysis', middleware, post_position_analysis)
    app.put('/position/status', middleware, put_position_status)
    app.get('/position', middleware, get_position)
    app.get('/position/analysis/queue', middleware, get_position_analysis_queue)

    // eslint-disable-next-line no-unused-vars
    app.use(function error_handler(err, req, res, next) {
        const log = debug.extend('error_hander')
        log('error function \n%O --> %s', err, err.message)
        if (err.message && err.message.includes('Request failed to validate against RAML')) {
            const body = { errors: err.requestErrors.map(failed => ({ field: failed.dataPath, message: failed.message })) }
            log('Sending error to client %O', body)
            return res.status(400).send(body)
        }
        if (err.message && err.message.includes('Unsupported content-type')) {
            log('Unsupported content-type, probably forgot application/json')
            return res.status(400).send('Unsupported content-type')
        }

        log('Did not identify the type of error %O', Object.keys(err))
        res.status(500).send('Internal server error')
    })

    app.listen(8001, () => { console.log('Listening on 8001') })
})()

/**
 *
 * @param {*} req
 * @param {*} res
 */
async function post_position_analysis(req, res) {
    const log = debug.extend('post_position_analysis')
    log('req %O', req.route)
    try {
        const position = new Position(req.body.fen)
        await position.add_eval(req.body)
        log('All good')
        return res.status(200).send()
    } catch (error) {
        log('Error %O', error)
        return res.status(404).send('my fake not found')
    }

}


/**
 *
 * @param {*} req
 * @param {*} res
 */
async function get_position_analysis_queue(req, res) {
    const log = debug.extend('get_position_ana...')
    try {
        const position = new Position()
        const queued = await position.get_top_queued()
        log('Queued %O', queued)
        return res.status(200).send(queued)
    } catch (error) {
        return res.status(error.status_code || 400).send(error.message || '')
    }

}
/**
 *
 * @param {*} req
 * @param {*} res
 */
async function get_position(req, res) {
    const log = debug.extend('get_position')
    log('Getting Position %O', req.headers)
    const position = new Position(req.headers.fen)
    const body = await position.fetch()
    log('%O', body)
    return res.status(200).send(body)
}

/**
 * Updates the status of a position, useful to reserve its analysis
 * or return it to the queue
 * @param {*} req
 * @param {*} res
 */
async function put_position_status(req, res) {
    const position = new Position(req.body.fen)
    try {
        await position.set_status(req.body.status)
        res.status(200).send()
    } catch (error) {
        res.status(400).send(error)
    }
}

/**
 * Adds a position to be analyzed
 * @param {*} req
 * @param {*} res
 */
async function post_position(req, res) {
    console.log('location %O %O', req.body)
    const position = new Position(req.body.fen)
    await position.connect()
    try {
        await position.add({
            depth_goal: req.body.depth_goal,
            priority: req.body.priority
        })
        res.status(200).send()
    } catch (error) {
        console.log('Error %O', error)
        res.status(400).send(error.errmsg || error.message || error)
    }
}