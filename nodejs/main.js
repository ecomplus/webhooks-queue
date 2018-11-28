'use strict'

/**
 * @file Service to store and run webhooks with Node.js and Cassandra
 * @copyright E-Com Club. All rights reserved. Since 2016
 * <br>E-COM CLUB SOFTWARES PARA E-COMMERCE LTDA / CNPJ: 24.356.660/0001-78
 * @license MIT
 * @author E-Com Club
 */

// debug errors in files
// require logger module first of any code
require('console-files')

// web application
// recieve requests from Nginx by reverse proxy
require('./bin/web.js')

// local application
// executable server side only
require('./bin/local.js')
