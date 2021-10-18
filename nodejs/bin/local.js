'use strict'

// log on files
const logger = require('console-files')
// connect to database
const db = require('./../lib/Database.js')
// setup redis client
const redis = require('redis')
const client = redis.createClient()

// axios HTTP client
// https://github.com/axios/axios
const axios = require('axios')

function query (conn, cql, params, callback) {
  conn.execute(cql, params, { prepare: true }, function (err, results) {
    if (err) {
      logger.error(err)
      // debug query and params
      let msg = 'Invalid CQL query\n' +
                cql + '\n' +
                JSON.stringify(params, null, 2)
      logger.error(new Error(msg))
    } else if (typeof callback === 'function') {
      callback(results)
    }
  })
}

function saveToHistory (conn, whk, response, error) {
  let cql = 'INSERT INTO history (id'
  let params = [ Date.now() ]
  for (let prop in whk) {
    if (whk.hasOwnProperty(prop)) {
      switch (prop) {
        case 'retry':
        case 'date_time':
          // ignore
          break

        default:
          // complete cql query string
          cql += ', ' + prop
          // add param
          let param = whk[prop]
          if (typeof param === 'object' && param !== null) {
            // headers object ?
            param = JSON.stringify(param)
          }
          params.push(param)
      }
    }
  }

  // store response
  if (response) {
    cql += ', status_code, response'
    let body = response.data
    let resContent = ''
    if (typeof body !== 'string' && body !== null) {
      // parse to string
      // limit 5kb
      resContent = JSON.stringify(body).substring(0, 5000)
    }
    params.push(response.status, resContent)
  }
  // save error message
  if (error && error.message) {
    cql += ', error'
    params.push(error.message + '; code ' + error.code)
  }

  // new timestamp
  cql += ', date_time) VALUES(?'
  for (let i = 0; i < params.length - 1; i++) {
    cql += ', ?'
  }
  cql += ', toTimestamp(now())) IF NOT EXISTS'

  // insert on database
  query(conn, cql, params)
}

function sendRequest (conn, whk) {
  // preset axios options
  let options = {
    'maxRedirects': 3,
    'responseType': 'text',
    // max 30s, 8mb
    'timeout': 30000,
    'maxContentLength': 8000000
  }

  // request full absolute URI
  options.url = whk.uri
  if (whk.method && whk.method !== '') {
    options.method = whk.method
    // check method to send request payload
    if (options.method !== 'GET') {
      if (whk.body && whk.body !== '') {
        options.data = whk.body
      } else if (options.method === 'POST') {
        // must have body data
        options.data = '{}'
      }
    }
  }

  // request headers
  if (typeof whk.headers === 'object' && whk.headers !== null) {
    options.headers = whk.headers
  } else if (typeof whk.headers === 'string') {
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
  axios(options).then(response => {
    // successful
    // perform database operations
    saveToHistory(conn, whk, response)
  })

    .catch(error => {
      let response = error.response
      if (response && response.status >= 500 && response.status < 600 && whk.retry < 3) {
        // retry
        whk.retry++
        // 5 minutes delay per attempt
        whk.date_time = (Date.now() + whk.retry * 300000)
        // reinsert webhook on queue
        addToQueue(JSON.stringify(whk))
      }

      // debug unexpected connection error
      if (error.code === 'ECONNRESET') {
        logger.error('Axios failed\n' + JSON.stringify(options, null, 2))
      }
      saveToHistory(conn, whk, response, error)
    })
}

const addToQueue = json => {
  // insert on Redis list
  // https://redis.io/commands/rpush
  client.rpush('queue', json, err => {
    if (err) {
      logger.error(err)
    }
  })
}

// read and run webhooks queue
const backToQueue = []
let backToQueueTimer = null
setInterval(() => {
  db({}, (err, _obj, conn) => {
    if (err) {
      logger.error(err)
    } else {
      // connected
      // list webhooks limited by current timestamp
      let now = Date.now()

      // get webhook from Redis list
      const get = () => {
        // https://redis.io/commands/lpop
        client.lpop('queue', (err, json) => {
          if (!err) {
            if (json) {
              let whk = JSON.parse(json)
              if (whk.date_time <= now) {
                if (typeof whk.retry !== 'number') {
                  // undefined
                  whk.retry = 0
                }
                sendRequest(conn, whk)
              } else {
                // re-insert to queue
                backToQueue.push(json)
              }
              // next
              get()
            } else if (!backToQueueTimer) {
              // all done
              // back scheduled webhooks to queue
              backToQueueTimer = setTimeout(() => {
                backToQueue.forEach(addToQueue)
                backToQueue.splice(0)
                backToQueueTimer = null
              }, 800)
            }
          } else {
            logger.error(err)
          }
        })
      }
      // start
      get()
    }
  })
}, 1000)
