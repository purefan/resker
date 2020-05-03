const router = require('express').Router()
const model = require('../model')
const debug = require('resker-debug')('resker:controller:client')
const auth = require('../middleware/auth')

router.get('/client/active', get_active_client)
router.post('/client', create_client)
router.put('/client/:id', toggle_client)
router.get('/client/:id', get_client)


module.exports = router

/**
 *
 */
async function get_client(req, res) {
    const log = debug.extend('get_client')
    log('Getting "%s"', req.params.id)
    const client = await model.client()
    const fetched_client = (await (await client.fetch_client_by_id(req.params.id)).toArray())[ 0 ]
    log('Found', fetched_client)
    res.status(200).send({
        is_active: fetched_client.is_active,
        client_name: fetched_client.client_name,
        last_active: fetched_client.last_active
    })
}

/**
 *
 * @param {*} req
 * @param {*} res
 */
async function toggle_client(req, res) {
    const log = debug.extend('toggle_client')
    log('Toggling')
    const client = await model.client()
    await client.set_client_active({ id: req.params.id, is_active: req.body.is_active })
    const client_check = (await client.fetch_client_by_id(req.params.id)).toArray()
    log('client check', client_check)
    res.status(200).send()
}

/**
 * Coordinates creating a new client
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
async function create_client(req, res) {
    const log = debug.extend('create_client')
    log('Creating')
    const credentials = await auth.prepare_api_key(req.body.api_key)
    log('We now have', credentials)
    const client = await model.client()
    const new_client = await client.add_client({
        client_name: req.body.client_name,
        hash: credentials.hash
    })
    res.status(200).send({ id: new_client.id, last_active: new_client.last_active })
}

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