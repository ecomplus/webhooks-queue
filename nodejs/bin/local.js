'use strict'

// log on files
const logger = require('./../lib/Logger.js')
// connect to database
const db = require('./../lib/Database.js')

// axios HTTP client
// https://github.com/axios/axios
const axios = require('axios')

// read and run webhooks queue
setInterval(() => {
  db({}, function (err, _obj, conn) {
    if (err) {
      logger.error(err)
    } else {
      // connected
      conn.execute('SELECT * FROM queue', [], { prepare: true }, function (err, results) {
        if (err) {
          logger.error(err)
        } else {
          for (let i = 0; i < results.rows.length; i++) {
            let whk = results.rows[i]
            // preset axios options
            let options = {
              'maxRedirects': 3,
              'responseType': 'text',
              // max 30s, 5kb
              'timeout': 30000,
              'maxContentLength': 5000
            }

            options.url = whk.uri
            if (whk.method && whk.method !== '') {
              options.method = whk.method
              if (whk.body && whk.body !== '') {
                options.data = whk.data
              }
            }

            if (whk.headers) {
              try {
                options.headers = JSON.parse(whk.headers)
              } catch (e) {
                // reset
                options.headers = {}
              }
            } else {
              options.headers = {}
            }
            options.headers['X-Store-ID'] = whk.store_id
            options.headers['X-Trigger-Object-ID'] = whk.trigger_id

            // send request
            axios(options)
            .then(function (res) {
              // success
            })
            .catch(function (error) {
              if (error.response) {
                if (error.response.status >= 500 && error.response.status < 600) {
                  // retry
                }
              } else if (error.request) {
              } else {
              }
            })
          }
        }
      })
    }
  })
}, 10000)
