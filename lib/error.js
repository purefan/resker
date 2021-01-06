/**
 * Specific errors containing more useful information
 * Good to bubble them
 */

const not_found = Object.create(Error.prototype, {
    constructor: { value: 'Not found'}
})

not_found.status_code = 404
not_found.status_message = 'Not found'

module.exports = {
    not_found
}