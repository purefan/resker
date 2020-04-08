const db = require('../lib/db')

exports.fetch = async () => {
    const db_conn = await db.connect()
    const collection = db_conn.collection('position')

    return {
        to_do: await collection.count({ status: 0 }),
        processing: await collection.count({ status: 1 }),
        completed: await collection.count({ status: 2 })
    }
}