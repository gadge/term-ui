/**
 * radiobutton.js - radio button element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

const { CHECK } = require('@pres/enum-events'),
      Node      = require('./node'),
      Checkbox  = require('./checkbox')

/**
 * RadioButton
 */

function RadioButton(options = {}) {
  const self = this

  if (!(this instanceof Node)) { return new RadioButton(options) }

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
