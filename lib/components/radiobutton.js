/**
 * radiobutton.js - radio button element for blessed
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
const Checkbox = require('./checkbox')

/**
 * RadioButton
 */

function RadioButton(options) {
  const self = this

  if (!(this instanceof Node)) { return new RadioButton(options) }

  options = options || {}

  Checkbox.call(this, options)

  this.on(CHECK, function () {
    let el = self
    while (el = el.parent) {
      if (el.type === 'radio-set'
        || el.type === 'form') break
    }
    el = el || self.parent
    el.forDescendants(function (el) {
      if (el.type !== 'radio-button' || el === self) {
        return
      }
      el.uncheck()
    })
  })
}

RadioButton.prototype.__proto__ = Checkbox.prototype

RadioButton.prototype.type = 'radio-button'

RadioButton.prototype.render = function () {
  this.clearPos(true)
  this.setContent('(' + (this.checked ? '*' : ' ') + ') ' + this.text, true)
  return this._render()
}

RadioButton.prototype.toggle = RadioButton.prototype.check

/**
 * Expose
 */

module.exports = RadioButton
