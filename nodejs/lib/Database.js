'use strict'

// log on files
// const logger = require('console-files')

const cassandra = require('cassandra-driver')
// global connection object
// one Cassandra connection can perform up to 128 simultaneous requests
// does not need a pool
let conn

function setConn () {
  conn = new cassandra.Client({
    contactPoints: [ 'localhost' ],
    keyspace: 'webhooks'
  })
}
setConn()

conn.on('log', function (level, className, message, furtherInfo) {
  if (level === 'error' && !conn) {
    // force reconnect
    try {
      conn.shutdown()
    } catch (e) {
      // ignore
    } finally {
      setConn()
    }
  }
})

function connect (_obj, callback) {
  if (typeof callback === 'function') {
    // return active conection
    callback(null, _obj, conn)
  }
}

module.exports = connect
