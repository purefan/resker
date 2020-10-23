/**
 * For some reason, express ignores many headers sometimes, so this is to make sure we have what we need
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
module.exports = function resker_headers(req, res, next) {
    req.resker_headers = req.rawHeaders.reduce((acc,curr, idx) => {
        if (idx == 0 || idx % 2 == 0) {
            acc[curr] = req.rawHeaders[idx + 1]
        }
        return acc
    }, {})
    next()
}