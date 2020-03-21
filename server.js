#!/bin/node

/**
 * The purpose of this file is to separate the actual express server
 * so we can properly unit test
 * */



const express = require('express')
const app = express()
const debug = require('debug')('resker-app')
const controller = require('./controller')
const middleware = require('./middleware')
const join = require('path').join

const osprey = require('osprey')
const path = join(__dirname, 'assets', 'raml', 'api.raml')

module.exports = prepare

/**
 *
 */
async function prepare() {
    const raw_app = await prepare_raw()
    // prepare error handler for raml fails
    raw_app.use(function (err, req, res, next) {
        // logic
        if (err.message == 'request entity too large') {
            return res
                .status(413)
                .send('Payload Too Large')
        }
        if (err.message) {
            return res
                .set('status', 400)
                .status(400)
                .send({ errors: 'Request failed to validate' })
        }
        next()
    })

    return raw_app
}

/**
 *
 */
async function prepare_raw() {
    const osprey_middleware = await osprey.loadFile(path, {
        security: middleware.auth,
        disableErrorInterception: true,
        rejectOnErrors: true,
        server: {
            notFoundHandler: false
        },
        strict: true
    })
    app.use(express.json({ limit: '15mb' }))
    app.use(express.urlencoded({ limit: '15mb', extended: true }))
    app.disable('x-powered-by')
    app.use(osprey_middleware)
    app.use(controller.position)
    app.use(controller.client)
    app.use(error_handler)

    return app
}

// eslint-disable-next-line no-unused-vars
/**
 *
 * @param {*} err
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
function error_handler(err, req, res) {
    const log = debug.extend('error_hander')
    log('Error function \n%O --> %s', err, err.message)
    if (err.message && err.message.includes('Request failed to validate against RAML')) {
        const body = {
            errors: err.requestErrors.map(failed => ({ field: failed.dataPath, message: failed.message }))
        }
        log('Sending error to client %O', body)
        log('%s request body:\n%O\nRequest headers:\n%O', `${req.method} ${req.path}`, req.body, req.headers)
        return res.status(400).send(body)
    }
    if (err.message && err.message.includes('Unsupported content-type')) {
        log('Unsupported content-type, probably forgot application/json')
        return res.status(400).send('Unsupported content-type')
    }

    if (err.message && err.message.includes('request entity too large')) {
        log('Entity request too large')
        return res.status(413)
    }

    log('Did not identify the type of error %O', Object.keys(err))
    res.status(500).send('Internal server error')
}
