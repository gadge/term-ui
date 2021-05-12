/**
 * box.js - box element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */


const Node    = require('./node'),
      Element = require('./element'),
      mixin   = require('@ject/mixin'),
      Scroll  = require('./scroll')

/**
 * Box
 */

function Box(options = {}) {
  if (!(this instanceof Node)) return new Box(options)
  Element.call(this, options)
  if (options.scrollable) {
    mixin.assign(this, Scroll.prototype)
    Scroll.prototype.config.call(this, options)
  }
}

Box.prototype.__proto__ = Element.prototype

Box.prototype.type = 'box'

/**
 * Expose
 */

module.exports = Box
