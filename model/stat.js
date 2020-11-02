const db = require('../lib/db')
require('./position')
require('../lib/structure')

/**
 *  Fetches positions from the DB and generates some statistics
  ** returns {Promise<import('../lib/structure').Stat>}
  * @returns {Promise<Stat>}
  */
exports.fetch = async () => {
    const db_conn = await db.connect()
    const collection = db_conn.collection('position')

    return {
        to_do: await db.to_array(await collection.find({ status: 0 })),
        processing: await db.to_array(await collection.find({ status: 1 })),
        completed: await collection.count({ status: 2 })
    }
}

/**
 * @typedef Stat
 * @property {Array} to_do
 * @property {Array} processing
 * @property {Number} completed
 */