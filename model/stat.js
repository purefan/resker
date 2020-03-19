const db = require('../lib/db').connect()

exports.fetch = async () => {
    return {
        new: db.collection('position').count({ status: 0 }),
        in_process: db.collection('position').count({ status: 1 }),
        completed: db.collection('position').count({ status: 2 })
    }
}