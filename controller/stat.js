const express = require('express')
const router = express.Router()
const model = require('../model')

router.get('/stats', async (req, res) => {
    const stats = await model.stats.fetch()
    res.setHeader('Cache-Control', 'public, max-age=3600') // 1 hr
    res.send(stats)
})

module.exports = router