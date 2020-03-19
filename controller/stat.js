const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const model = require('../model')

router.get('/stats', (req, res) => {
    const stats = model.stats.fetch()
    console.log('stats', stats)
    res.send(stats)
})

module.exports = router