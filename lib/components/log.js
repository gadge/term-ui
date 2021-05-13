/**
 * logs.js - logs element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

const {
        ACTION, ADD_ITEM, ADOPT, ATTACH, BLUR, BTNDOWN, BTNUP, CANCEL, CD, CHECK, CLICK, CLOSE, COMPLETE, CONNECT,
        CREATE_ITEM, DATA, DBLCLICK, DESTROY, DETACH, DRAG, ELEMENT_CLICK, ELEMENT_FOCUS, ELEMENT_KEYPRESS,
        ELEMENT_MOUSEOUT, ELEMENT_MOUSEOVER, ELEMENT_MOUSEUP, ELEMENT_WHEELDOWN, ELEMENT_WHEELUP, ERROR, EVENT, EXIT,
        FILE, FOCUS, HIDE, INSERT_ITEM, KEY, KEYPRESS, LOG, MOUSE, MOUSEDOWN, MOUSEMOVE, MOUSEOUT, MOUSEOVER, MOUSEUP,
        MOUSEWHEEL, MOVE, NEW_LISTENER, ON, PARSED_CONTENT, PASSTHROUGH, PRERENDER, PRESS, REFRESH, REMOVE, REMOVE_ITEM,
        REMOVE_LISTENER, RENDER, REPARENT, RESET, RESIZE, RESPONSE, SCROLL, SELECT, SELECT_ITEM, SELECT_TAB,
        SET_CONTENT, SET_ITEMS, SHOW, SIGINT, SIGQUIT, SIGTERM, SIZE, SUBMIT, TITLE, UNCAUGHT_EXCEPTION, UNCHECK,
        WARNING, WHEELDOWN, WHEELUP
      } = require('@pres/enum-events')

/**
 * Modules
 */
const util = require('util')

const nextTick = global.setImmediate || process.nextTick.bind(process)

const Node = require('./node')
const ScrollableText = require('./scrollabletext')

/**
 * Log
 */

function Log(options) {
  const self = this

  if (!(this instanceof Node)) { return new Log(options) }

  options = options || {}

  ScrollableText.call(this, options)

  this.scrollback = options.scrollback != null
    ? options.scrollback
    : Infinity
  this.scrollOnInput = options.scrollOnInput

  this.on('set content', function () {
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
