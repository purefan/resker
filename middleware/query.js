module.exports = function set_resker_query_url(req, res, next) {
    const resker_query_url = {}
    const original_query_url = req.originalUrl.split('?')
    if (original_query_url[1]) {
        const parts = original_query_url[1].split('&')
        parts.map(part => {
            const key_val = part.split('=')

            // All queries must be urldecoded
            resker_query_url[key_val[0]] = decodeURIComponent(key_val[1])
        })
    }



    // Any date query must be a number
    const date_queries = Object.keys(resker_query_url).filter(key => key.toLowerCase().includes('date'))
    for (const idx in date_queries) {
        const key = date_queries[idx]
        if (Object.hasOwnProperty.call(date_queries, idx)) {
            const element = parseInt(resker_query_url[key])
            if (isNaN(element)) {
                const error = new Error(`The query ${key} must be a number`)
                error.status_code = 400
                error.status_message = `The query ${key} must be a number`
                return next(error)
            }
        }
    }

    req.resker_query_url = resker_query_url
    next()
}