const router = require('express').Router()
const model = require('../model')
const debug = require('debug')('resker:controller:position')

router.post('/position', post_position)
router.post('/position/analysis', post_position_analysis)
router.put('/position/status', put_position_status)
router.get('/position', get_position)
router.get('/position/analysis/queue', get_position_analysis_queue)
router.get('/version', function get_version(req, res) {
    res.status(200).send('0.9')
})


module.exports = router

/**
 *
 * @param {*} req
 * @param {*} res
 */
async function post_position_analysis(req, res) {
    const log = debug.extend('post_position_analysis')
    log('req headers %O', req.headers)
    try {
        const position_model = await model.position()
        await position_model.add_analysis({
            fen: req.body.fen,
            analysis: req.body
        })
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
    const log = debug.extend('get_position_analysis_queue')
    try {
        const position = await model.position()
        const queued = await position.get_top_queued()
        log('Queued %O', queued)
        return res.status(200).send(queued)
    } catch (error) {
        log('Error', error)
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
    const pos_model = await model.position()
    const position = await pos_model.fetch({ fen: req.headers.fen })
    // const body = await position.fetch()
    log('%O', position)
    return res.status(200).send(position)
}

/**
 * Updates the status of a position, useful to reserve its analysis
 * or return it to the queue
 * @param {*} req
 * @param {*} res
 */
async function put_position_status(req, res) {
    const position = await model.position()
    try {
        await position.set_status({
            fen: req.body.fen,
            client: req.headers.resker_client,
            status: req.body.status
        })
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
    const log = debug.extend('post_position')
    try {
        const position = await model.position()
        const to_add = {
            fen: req.body.fen,
            client: req.headers.resker_client,
            depth_goal: req.body.depth_goal,
            priority: req.body.priority,
            multipv_goal: req.body.multipv_goal
        }
        log('position', to_add)
        await position.add_position(to_add)
        res.status(200).send()

    } catch (error) {
        log('Error', error)
        res.status(400).send(error.errmsg || error.message || error)
    }
}