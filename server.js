#!/bin/node

/**
 * The purpose of this file is to separate the actual express server
 * so we can properly unit test
 * */



const express = require('express')
const app = express()
const debug = require('debug')('resker:server')
const controller = require('./controller')
const middleware = require('./middleware')
const join = require('path').join
const bodyParser = require('body-parser')

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
        console.log('ERROR', err.message, err)
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
        /* server: {
                    notFoundHandler: false
                }, */
        strict: true
    })
    app.use(bodyParser.json())
    app.use(osprey_middleware)
    app.use(express.json({ limit: '15mb' }))
    app.use(express.urlencoded({ limit: '15mb', extended: true }))
    app.disable('x-powered-by')

    app.use(middleware.headers)
    app.use(middleware.query_url)
    app.use(controller.position)
    app.use(controller.client)
    app.use(controller.stat)
    app.use(controller.game)
    app.use(error_handler)

    return app
}

/**
 *
 * This will catch any error while processing a request and try to format it properly
 * The parameter next is required for the function to register in express as an error handler
 * @param {*} err
 * @param {*} req
 * @param {*} res
 * @param {function} next
 *
 */
function error_handler(err, req, res, next) {
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
        return res.status(413).send('')
    }

    if (err.status_code && err.status_message) {
        log('Given the error', err.status_code, err.status_message)
        return res.status(err.status_code).send(err.status_message)
    }

    log('Did not identify the type of error %O', Object.keys(err))
    res.status(500).send('Internal server error')
}
