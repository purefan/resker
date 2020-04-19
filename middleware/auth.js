const debug = require('resker-debug')('resker:middleware:auth')
const { Chess } = require('chess.js')
const chess = new Chess()

const bcrypt = require('bcrypt')
const model = require('../model')

if (!process.env.X_API_KEY || process.env.X_API_KEY.length < 5) {
    throw new Error('X_API_KEY not set')
}

/**
 *
 */
function handler() {
    /**
     *
     */
    return async function (req, res, next) {
        debug('SecHandler %s\n\nheaders:%O\n\nbody: %O', `${req.method} ${req.path}`, req.headers, JSON.stringify(req.body).substr(0, 100))

        if (!req.headers[ 'x-api-key' ]) {
            debug('No api key')
            return res.status(401).send('No api key.')
        }

        const client = await validate_key(req.headers)
        debug('client', client)
        if (!client) {
            debug('Wrong api key', req.headers)
            return res.status(401).send('Wrong api key.')
        }
        if (client && client.is_active == false) {
            debug('Not serving a disabled client', client)
            return res.status(401).send()
        }


        if (req.body.fen && !chess.load(req.body.fen)) {
            debug('Invalid fen')
            return res.status(400).send({ errors: 'Invalid fen' })
        }

        debug('All good')
        return next()
    }
}


const security_definition = {
    api_key: function api_key_handler() {
        return { handler }
    },
    prepare_api_key: prepare_api_key
}

/**
 *
 * @param {*} api_key
 */
async function validate_key(headers) {
    if (headers[ 'x-api-key' ] === process.env.X_API_KEY) {
        debug('Key matches envvar')
        return true
    }
    const client = await model.client()
    const clients = await client.fetch_all_clients()
    debug('validate_key', headers)
    const valid_client = clients.find(client => {
        debug('Checking client', client)
        if (!client.hash) {
            return false
        }
        if (client.is_active === false) {
            debug('Invalid client because its disabled')
            return false
        }
        debug('Comparing "%s" vs "%s" for client %s', headers[ 'x-api-key' ], client.hash, client.client_name)
        const matched = bcrypt.compareSync(headers[ 'x-api-key' ], client.hash)
        return matched
    })
    debug('valid_client', valid_client)
    return valid_client
}

/**
 *
 * @param {String} api_key
 * @returns {Object} { hash: <String>, api_key: <String> }
 */
async function prepare_api_key(api_key) {
    const salt = await bcrypt.genSalt(11)
    const hash = await bcrypt.hash(api_key, salt)
    return {
        hash,
        api_key
    }
}

module.exports = security_definition