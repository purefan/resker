const debug = require('debug')('resker:middleware:auth')
const { Chess } = require('chess.js')
const chess = new Chess()

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
    return function (req, res, next) {
        if (!req.headers[ 'x-api-key' ]) {
            return res.status(401).send('No api key.')
        }
        if (req.headers[ 'x-api-key' ] != process.env.X_API_KEY) {
            return res.status(401).send('Wrong api key.')
        }
        if (!req.headers.resker_client || req.headers.resker_client == null || req.headers.resker_client.length < 5) {
            return res.status(400).send('Invalid client')
        }

        if (req.body.fen && !chess.load(req.body.fen)) {
            return res.status(400).send({ errors: 'Invalid fen' })
        }
        debug('SecHandler %s %o', `${req.method} ${req.path}`, req.headers)

        return next()
    }
}


const security_definition = {
    api_key: function api_key_handler() {
        return { handler }
    }
}

module.exports = security_definition