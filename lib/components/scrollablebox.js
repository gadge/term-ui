
const
  /**
   * Modules
   */
  Node = require('./node'),
  Box  = require('./box')

function ScrollableBox(options = {}) {
  options.scrollable = true
  if (!(this instanceof Node)) { return new ScrollableBox(options) }
  Box.call(this, options)
}

ScrollableBox.prototype.__proto__ = Box.prototype
ScrollableBox.prototype.type = 'scrollable-box'

module.exports = ScrollableBox
