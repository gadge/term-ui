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
  options.scrollbar = true
  if (!(this instanceof Node)) { return new ScrollableBox(options) }
  Box.call(this, options)
}

module.exports = ScrollableBox
