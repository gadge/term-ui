/**
 * input.js - abstract input element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

const Node = require('./node'),
      Box  = require('./box')

/**
 * Input
 */

function Input(options = {}) {
  if (!(this instanceof Node)) { return new Input(options) }
    Box.call(this, options)
}

Input.prototype.__proto__ = Box.prototype

Input.prototype.type = 'input'

/**
 * Expose
 */

module.exports = Input
