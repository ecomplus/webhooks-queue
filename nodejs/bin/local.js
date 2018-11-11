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
    } else if (typeof callback === 'function') {
      callback(results)
    }
  })
}

function saveToHistory (conn, whk, response, error) {
  let cql, params
  // select current row id
  cql = 'SELECT MAX(id) FROM history WHERE store_id = ?'
  params = [ whk.store_id ]
  query(conn, cql, params, (results) => {
    let id
    if (results.rows.length) {
      // id is a counter
      id = results.rows[0]['MAX(id)'] + 1
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
      params.push(error.message)
    }

    cql += ', date_time) VALUES(?'
    for (let i = 0; i < escape.length - 1; i++) {
      cql += ', ?'
    }
    cql += ', toTimestamp(now())) IF NOT EXISTS'

    // insert on database
    query(conn, cql, params)
  })
}

function removeFromQueue (conn, whk) {
  // remove webhook from queue
  let cql = 'DELETE FROM queue WHERE trigger_id = ? AND date_time = ?'
  let params = [ whk.trigger_id, whk.date_time ]
  query(conn, cql, params)
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
    axios(options)

    .then(function (response) {
      // successful
      // perform database operations
      removeFromQueue(conn, whk)
      saveToHistory(conn, whk, response)
    })

    .catch(function (error) {
      let response = error.response
      if (response && response.status >= 500 && response.status < 600 && whk.retry < 3) {
        // retry
        // keep webhook on queue
        let cql = 'UPDATE queue SET retry = ? WHERE trigger_id = ? AND date_time = ?'
        let params = [ whk.retry + 1, whk.trigger_id, whk.date_time ]
        query(conn, cql, params)
      } else {
        removeFromQueue(conn, whk)
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
      query(conn, 'SELECT * FROM queue', [], function (results) {
        for (let i = 0; i < results.rows.length; i++) {
          let whk = results.rows[i]
          sendRequest(conn, whk)
        }
      })
    }
  })
}, 40000)
