/* eslint-disable require-jsdoc */

const debug = require('resker-debug')('resker:lib')

let db = null

if (!process.env.MONGO_HOST || process.env.MONGO_HOST.length < 5) {
    throw new Error('MONGO_HOST is not set')
}

module.exports = {
    connect: async () => {
        if (process.env.NODE_ENV == 'development') {
            return connect_to_mock()
        }
        return connect_to_mongo()
    },
    to_array: cursor => {
        return new Promise((resolve, reject) => {
            cursor.toArray((err, docs) => {
                if (err) {
                    return reject(err)
                }
                resolve(docs)
            })
        })
    }
}

async function connect_to_mongo() {
    const { MongoClient } = require('mongodb')
    const log = debug.extend('connect')
    if (db) {
        return db
    }
    try {
        const connection_string = `mongodb://${process.env.MONGO_HOST}:27017`
        const connection = await MongoClient.connect(connection_string, { useNewUrlParser: true, useUnifiedTopology: true })
        db = connection.db('resker')
        log('MongoClient Connection successful.')
        return db
    }
    catch (ex) {
        log('Error caught %O', ex)
        return false
    }
}

async function connect_to_mock() {
    const log = debug.extend('connect:mock')
    const mongodb = require('mongo-mock')
    const MongoClient = mongodb.MongoClient
    const connection_string = `mongodb://${process.env.MONGO_HOST}:27017/`
    const connection = await MongoClient.connect(connection_string, { useNewUrlParser: true, useUnifiedTopology: true })
    db = connection.db('resker')
    log('MongoClient Connection successful.')
    return db
}