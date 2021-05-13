/**
 * checkbox.js - checkbox element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

const { BLUR, CHECK, CLICK, FOCUS, KEYPRESS, UNCHECK } = require('@pres/enum-events'),
      Node                                             = require('./node'),
      Input                                            = require('./input')

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

  this.on(KEYPRESS, function (ch, key) {
    if (key.name === 'enter' || key.name === 'space') {
      self.toggle()
      self.screen.render()
    }
  })

  if (options.mouse) {
    this.on(CLICK, function () {
      self.toggle()
      self.screen.render()
    })
  }

  this.on(FOCUS, function () {
    const lpos = self.lpos
    if (!lpos) return
    self.screen.program.lsaveCursor('checkbox')
    self.screen.program.cup(lpos.yi, lpos.xi + 1)
    self.screen.program.showCursor()
  })

  this.on(BLUR, function () {
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
  this.emit(CHECK)
}

Checkbox.prototype.uncheck = function () {
  if (!this.checked) return
  this.checked = this.value = false
  this.emit(UNCHECK)
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
