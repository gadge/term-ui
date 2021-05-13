/**
 * checkbox.js - checkbox element for blessed
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
const Input = require('./input')

/**
 * Checkbox
 */

function Checkbox(options) {
  const self = this

  if (!(this instanceof Node)) return new Checkbox(options)

  options = options || {}

  Input.call(this, options)

  this.text = options.content || options.text || ''
  this.checked = this.value = options.checked || false

  this.on('keypress', function (ch, key) {
    if (key.name === 'enter' || key.name === 'space') {
      self.toggle()
      self.screen.render()
    }
  })

  if (options.mouse) {
    this.on('click', function () {
      self.toggle()
      self.screen.render()
    })
  }

  this.on('focus', function () {
    const lpos = self.lpos
    if (!lpos) return
    self.screen.program.lsaveCursor('checkbox')
    self.screen.program.cup(lpos.yi, lpos.xi + 1)
    self.screen.program.showCursor()
  })

  this.on('blur', function () {
    self.screen.program.lrestoreCursor('checkbox', true)
  })
}

Checkbox.prototype.__proto__ = Input.prototype

Checkbox.prototype.type = 'checkbox'

Checkbox.prototype.render = function () {
  this.clearPos(true)
  this.setContent('[' + (this.checked ? 'x' : ' ') + '] ' + this.text, true)
  return this._render()
}

Checkbox.prototype.check = function () {
  if (this.checked) return
  this.checked = this.value = true
  this.emit('check')
}

Checkbox.prototype.uncheck = function () {
  if (!this.checked) return
  this.checked = this.value = false
  this.emit('uncheck')
}

Checkbox.prototype.toggle = function () {
  return this.checked
    ? this.uncheck()
    : this.check()
}

/**
 * Expose
 */

module.exports = Checkbox
