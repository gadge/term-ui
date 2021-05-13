

/**
 * Modules
 */
const Node = require('./node')
const ScrollableBox = require('./scrollablebox')

/**
 * ScrollableText
 */

function ScrollableText(options) {
  if (!(this instanceof Node)) { return new ScrollableText(options) }
  options = options || {}
  options.alwaysScroll = true
  ScrollableBox.call(this, options)
}

ScrollableText.prototype.__proto__ = ScrollableBox.prototype

ScrollableText.prototype.type = 'scrollable-text'

/**
 * Expose
 */

module.exports = ScrollableText
