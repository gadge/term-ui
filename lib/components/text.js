/**
 * text.js - text element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

const Node    = require('./node'),
      Element = require('./element')

/**
 * Text
 */

function Text(options = {}) {
  if (!(this instanceof Node)) { return new Text(options) }
    options.shrink = true
  Element.call(this, options)
}

Text.prototype.__proto__ = Element.prototype

Text.prototype.type = 'text'

/**
 * Expose
 */

module.exports = Text
