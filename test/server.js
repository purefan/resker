/**
 * Makes sure that the express server is running
 */



const server = require('../server')
let app
let is_running = false

/**
 *
 */
module.exports = async function prepare() {
    if (is_running) {
        return app
    }
    return new Promise(resolve => {
        server().then(app => {
            app.listen(process.env.HTTP_PORT, () => {
                is_running = true
                resolve(app)
            })
        })
    })
}