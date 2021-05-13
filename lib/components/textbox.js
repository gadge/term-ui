/**
 * textbox.js - textbox element for blessed
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
const Node = require('./node')
const Textarea = require('./textarea')

/**
 * Textbox
 */

function Textbox(options) {
  if (!(this instanceof Node)) { return new Textbox(options) }

  options = options || {}

  options.scrollable = false

  Textarea.call(this, options)

  this.secret = options.secret
  this.censor = options.censor
}

Textbox.prototype.__proto__ = Textarea.prototype

Textbox.prototype.type = 'textbox'

Textbox.prototype.__olistener = Textbox.prototype._listener
Textbox.prototype._listener = function (ch, key) {
  if (key.name === 'enter') {
    this._done(null, this.value)
    return
  }
  return this.__olistener(ch, key)
}

Textbox.prototype.setValue = function (value) {
  let visible, val
  if (value == null) {
    value = this.value
  }
  if (this._value !== value) {
    value = value.replace(/\n/g, '')
    this.value = value
    this._value = value
    if (this.secret) {
      this.setContent('')
    }
    else if (this.censor) {
      this.setContent(Array(this.value.length + 1).join('*'))
    }
    else {
      visible = -(this.width - this.iwidth - 1)
      val = this.value.replace(/\t/g, this.screen.tabc)
      this.setContent(val.slice(visible))
    }
    this._updateCursor()
  }
}

Textbox.prototype.submit = function () {
  if (!this.__listener) return
  return this.__listener('\r', { name: 'enter' })
}

/**
 * Expose
 */

module.exports = Textbox
