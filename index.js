const server = require('./server')
const debug = require('resker-debug')('resker:main')
const port = process.env.HTTP_PORT || 8001

server().then(app => {
    app.listen(port, () => { debug(`Listening on ${port}`) })
})