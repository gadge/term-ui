/**
 * logs.js - logs element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

const { LOG, SET_CONTENT } = require('@pres/enum-events'),
      util                 = require('util'),
      Node                 = require('./node'),
      ScrollableText       = require('./scrollabletext')

const nextTick = global.setImmediate || process.nextTick.bind(process)

/**
 * Log
 */

function Log(options = {}) {
  const self = this

  if (!(this instanceof Node)) { return new Log(options) }

  ScrollableText.call(this, options)

  this.scrollback = options.scrollback != null
    ? options.scrollback
    : Infinity
  this.scrollOnInput = options.scrollOnInput

  this.on(SET_CONTENT, function () {
    if (!self._userScrolled || self.scrollOnInput) {
      nextTick(function () {
        self.setScrollPerc(100)
        self._userScrolled = false
        self.screen.render()
      })
    }
  })
}

Log.prototype.__proto__ = ScrollableText.prototype

Log.prototype.type = 'log'

Log.prototype.log =
  Log.prototype.add = function () {
    const args = Array.prototype.slice.call(arguments)
    if (typeof args[0] === 'object') {
      args[0] = util.inspect(args[0], true, 20, true)
    }
    const text = util.format.apply(util, args)
    this.emit(LOG, text)
    const ret = this.pushLine(text)
    if (this._clines.fake.length > this.scrollback) {
      this.shiftLine(0, (this.scrollback / 3) | 0)
    }
    return ret
  }

Log.prototype._scroll = Log.prototype.scroll
Log.prototype.scroll = function (offset, always) {
  if (offset === 0) return this._scroll(offset, always)
  this._userScrolled = true
  const ret = this._scroll(offset, always)
  if (this.getScrollPerc() === 100) {
    this._userScrolled = false
  }
  return ret
}

/**
 * Expose
 */

module.exports = Log
