/**
 * osprey does not clean extra fields in the requests
 * this library does exactly that
 */
const path = require('path')
const raml2obj = require('raml2obj')

/**
 * @param {string} type name without extension of the raml file
 * @param {string} name name of the property
 * @param {object} source the original object to filter
 */
module.exports = async function (type, name, source) {
    const result = await raml2obj.parse(path.join(__dirname, '..', '..', 'assets', `${type}.raml`))
    const looking_for = result.types[ name ]
    const clean = {}

    for (const sub_type in looking_for.properties) {
        if (source[ sub_type ] || source[ sub_type.replace('?', '') ]) { // Dont assign empty values
            clean[ sub_type ] = source[ sub_type ] || source[ sub_type.replace('?', '') ]
        }
    }
    return clean
}
