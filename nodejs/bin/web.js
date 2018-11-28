'use strict'

// log on files
const logger = require('console-files')
// connect to database
// const db = require('./../lib/Database.js')
// setup redis client
const redis = require('redis')
const client = redis.createClient()

// Express web framework
// https://www.npmjs.com/package/express
const Express = require('express')
// body parsing middleware
const bodyParser = require('body-parser')

// port is an argument passed by command line
let httpPort = process.argv[2]
if (typeof httpPort === 'string') {
  httpPort = parseInt(httpPort, 10)
}
if (typeof httpPort !== 'number' || isNaN(httpPort)) {
  // default port
  httpPort = 3000
}

// new Express application
let app = Express()

app.use(bodyParser.json())

function errorResponse (res, errorCode, status) {
  // default request error response
  if (!status) {
    status = 500
  }
  res.status(status)
  res.json({
    'error_code': errorCode,
    'status': status
  })
}

// RegEx to validate URL
const uriPattern = /^https?:\/\/[\w-.]+[a-z](:[0-9]+)?(\/([\w-.~:/#[\]@!$&'()*+,;=`.]+)?)?(\?.*)?$/i

app.post('/add-to-queue.json', (req, res) => {
  // first check on body
  if (typeof req.body === 'object' && req.body !== null) {
    // URI is needed
    let uri = req.body.uri
    if (typeof uri === 'string' && uriPattern.test(uri)) {
      // mount row data
      let storeId = req.body.store_id
      if (typeof storeId === 'string') {
        storeId = parseInt(storeId, 10)
      }
      if (typeof storeId !== 'number' || isNaN(storeId)) {
        // Store ID cannot be null
        // random number
        storeId = Math.floor(Math.random() * 1000)
      }

      let triggerId = req.body.trigger_id
      if (typeof triggerId !== 'string') {
        // default arbitrary trigger ID
        triggerId = 't'
      }

      // mount webhook object
      let webhook = {
        trigger_id: triggerId,
        store_id: storeId,
        uri: uri,
        date_time: Date.now()
      }
      for (let prop in req.body) {
        if (req.body.hasOwnProperty(prop)) {
          let value = req.body[prop]
          // test valid webhook properties
          switch (prop) {
            case 'method':
            case 'headers':
            case 'body':
              webhook[prop] = value
              break
          }
        }
      }

      // insert on Redis list
      // https://redis.io/commands/rpush
      client.rpush('queue', JSON.stringify(webhook), err => {
        if (!err) {
          // end request
          res.status(201)
          res.json({
            'ok': true
          })
        } else {
          errorResponse(res, 11, 500)
          logger.error(err)
        }
      })
    } else {
      errorResponse(res, 12, 400)
    }
  } else {
    errorResponse(res, 13, 400)
  }
})

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
  // write error on file
  logger.error(err)

  let status
  if (err.status) {
    status = err.status
  } else {
    status = 500
  }
  res.status(status)
  res.json({
    'status': status
  })
})

app.listen(httpPort, () => {
  logger.log('Running Express server on port ' + httpPort)
})
