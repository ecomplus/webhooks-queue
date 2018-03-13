'use strict'

// log on files
const logger = require('./../lib/Logger.js')

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
if (typeof httpPort === 'number' || !isNaN(httpPort)) {
  // default port
  httpPort = 3000
}

// new Express application
let app = Express()

app.use(bodyParser.json())

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
