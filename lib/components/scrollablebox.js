/**
 * scrollablebox.js - scrollable box element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */
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
