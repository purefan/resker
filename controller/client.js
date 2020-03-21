const router = require('express').Router()
const model = require('../model')
const debug = require('debug')('resker:controller:client')

router.get('/client/active', get_active_client)


module.exports = router

/**
 *
 */
async function get_active_client(req, res) {
    const log = debug.extend('get_active_client')
    const client = await model.client()
    const clients = await client.fetch_all_clients()
    log('Clients', clients)
    res.status(200).send({ clients })
}