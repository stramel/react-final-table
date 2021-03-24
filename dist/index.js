
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./react-final-table.cjs.production.min.js')
} else {
  module.exports = require('./react-final-table.cjs.development.js')
}
