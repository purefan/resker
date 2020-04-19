const debug = require('debug')
const default_log = debug.log
const fs = require('fs')
const util = require('util')

const file_path = `${process.cwd()}/assets/logs/resker.log`
const file = fs.createWriteStream(file_path, { flags: 'a' })

debug.log = (...args) => {
    default_log(...args)

    const line = util
        .format(...args)
        // eslint-disable-next-line no-control-regex
        .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')

    let d = new Date(Date.now() + 28800000)
        .toJSON() //to 2019-04-20T06:20:54.513Z
        .replace('T', ' ')
        .substring(0, 23)
        .split(/[-]/)
        .join('') //time fromat: 20190704 21:30:02.489

    file.write(d + ' ' + line + '\n')

}

module.exports = debug