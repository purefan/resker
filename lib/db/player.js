const debug = require('resker-debug')('lib:db:player')


class Player {
    constructor(params) {
        this.db = false
        if (params && params.player_name) {
            this.player_name = params.player_name.trim()
        }
    }

    async get_player_id() {
        if (this.player_id) {
            return this.player_id
        }
        this.player_id = await this.fetch_player_id()
        if (!this.player_id) {
            await this.insert_player()
        }
        return this.player_id
    }

    async fetch_player_id() {
        const log = debug.extend('fetch_player_id')
        return new Promise((resolve, reject) => {
            this.db.then(client => {
                this.collection = client.collection('player')
                this.collection.findOne({ player_name: this.player_name }, (err, item) => {
                    if (err) {
                        log('fetch_player_id err %O', err)
                        return reject(err)
                    }
                    if (!item || !item._id) {
                        return resolve()
                    }
                    log('fetch_player_id %O ', item)
                    resolve(item._id)
                })
            })

        })
    }

    async insert_player() {
        const log = debug.extend('insert_player')
        this.player_id = await this.collection.insertOne({ player_name: this.player_name })
        this.player_id = this.player_id.insertedId
        log('Inserted player with id %s', this.player_id)
        return this.player_id.insertedId
    }
}

module.exports = Player