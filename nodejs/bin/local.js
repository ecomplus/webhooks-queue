'use strict'

// log on files
const logger = require('./../lib/Logger.js')
// connect to database
const db = require('./../lib/Database.js')

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
  let cql, params
  // select current row id
  cql = 'SELECT MAX(id) AS prev FROM history WHERE store_id = ?'
  params = [ whk.store_id ]
  query(conn, cql, params, (results) => {
    let id
    if (results.rows.length) {
      // id is a counter
      // bigint is returned as string
      id = parseInt(results.rows[0]['prev'], 10) + 1
    } else {
      id = 1
    }

    cql = 'INSERT INTO history (id'
    params = [ id ]
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
            params.push(whk[prop])
        }
      }
    }
    // store response
    if (response) {
      cql += ', status_code, response'
      params.push(response.status, response.data)
    }
    if (error && error.message) {
      cql += ', error'
      params.push(error.message + '; code ' + error.code)
    }

    cql += ', date_time) VALUES(?'
    for (let i = 0; i < params.length - 1; i++) {
      cql += ', ?'
    }
    cql += ', toTimestamp(now())) IF NOT EXISTS'

    // insert on database
    query(conn, cql, params)
  })
}

function sendRequest (conn, whk) {
  // wait 5 minutes per attempt
  let delay = whk.retry * 300000
  setTimeout(() => {
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
        options.data = whk.body
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
        // reinsert webhook on queue
        let cql = 'INSERT INTO queue ('
        let params = []
        for (let column in whk) {
          if (whk.hasOwnProperty(column)) {
            cql += column + ', '
            params.push(whk[column])
          }
        }
        // remove last comma and complete CQL string
        cql = cql.slice(0, -2) + ' VALUES(?'
        for (let i = 1; i < params.length; i++) {
          cql += ', ?'
        }
        cql += ') IF NOT EXISTS'
        query(conn, cql, params)
      }

      // debug unexpected connection error
      if (error.code === 'ECONNRESET') {
        logger.error('Axios failed\n' + JSON.stringify(options, null, 2))
      }
      saveToHistory(conn, whk, response, error)
    })
  }, delay)
}

// read and run webhooks queue
setInterval(() => {
  db({}, function (err, _obj, conn) {
    if (err) {
      logger.error(err)
    } else {
      // connected
      query(conn, 'SELECT * FROM queue', [], (results) => {
        let whk
        for (let i = 0; i < results.rows.length; i++) {
          whk = results.rows[i]
          sendRequest(conn, whk)
        }
        // delete readed webhooks until last timestamp
        query(conn, 'DELETE FROM queue WHERE date_time <= ?', [ whk.date_time ])
      })
    }
  })
}, 3000)
