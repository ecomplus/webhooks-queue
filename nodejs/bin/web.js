'use strict'

// log on files
const logger = require('./../lib/Logger.js')
// connect to database
const db = require('./../lib/Database.js')

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
  db({}, function (err, _obj, conn) {
    if (err) {
      errorResponse(res, 10, 500)
      logger.error(err)
    } else {
      // connected
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

          // mount query
          let cql = 'INSERT INTO queue (trigger_id, store_id, uri'
          let escape = [ triggerId, storeId, uri ]
          for (let prop in req.body) {
            if (req.body.hasOwnProperty(prop)) {
              let value = req.body[prop]
              let valid = true

              // test valid table columns
              switch (prop) {
                case 'method':
                  // should be string
                  // just continue
                  break
                case 'headers':
                case 'body':
                  // can come as object
                  if (typeof value === 'object') {
                    // convert to string
                    value = JSON.stringify(value)
                  }
                  break
                default:
                  valid = false
              }

              if (valid === true && typeof value === 'string') {
                // complete cql query string
                cql += ', ' + prop
                // add param
                escape.push(value)
              }
            }
          }
          cql += ', retry, date_time) VALUES(?'
          for (let i = 0; i < escape.length - 1; i++) {
            cql += ', ?'
          }
          cql += ', 0, toTimestamp(now())) IF NOT EXISTS'

          // insert on database
          conn.execute(cql, escape, { prepare: true }, function (err) {
            if (err) {
              errorResponse(res, 11, 500)
              logger.error(err)
            } else {
              // end request
              res.status(201)
              res.json({
                'ok': true
              })
            }
          })
        } else {
          errorResponse(res, 12, 400)
        }
      } else {
        errorResponse(res, 13, 400)
      }
    }
  })
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
