const server = require('./server')
const debug = require('debug')('resker:main')
const port = process.env.HTTP_PORT || 8001

server.then(app => {
    app.listen(port, () => { debug(`Listening on ${port}`) })
})