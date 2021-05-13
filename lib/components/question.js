/**
 * question.js - question element for blessed
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
const Box = require('./box')
const Button = require('./button')

/**
 * Question
 */

function Question(options) {
  if (!(this instanceof Node)) { return new Question(options) }

  options = options || {}
  options.hidden = true

  Box.call(this, options)

  this._.okay = new Button({
    screen: this.screen,
    parent: this,
    top: 2,
    height: 1,
    left: 2,
    width: 6,
    content: 'Okay',
    align: 'center',
    bg: 'black',
    hoverBg: 'blue',
    autoFocus: false,
    mouse: true
  })

  this._.cancel = new Button({
    screen: this.screen,
    parent: this,
    top: 2,
    height: 1,
    shrink: true,
    left: 10,
    width: 8,
    content: 'Cancel',
    align: 'center',
    bg: 'black',
    hoverBg: 'blue',
    autoFocus: false,
    mouse: true
  })
}

Question.prototype.__proto__ = Box.prototype

Question.prototype.type = 'question'

Question.prototype.ask = function (text, callback) {
  const self = this
  let press, okay, cancel

  // Keep above:
  // var parent = this.parent;
  // this.detach();
  // parent.append(this);

  this.show()
  this.setContent(' ' + text)

  this.onScreenEvent(KEYPRESS, press = function (ch, key) {
    if (key.name === MOUSE) return
    if (key.name !== 'enter'
      && key.name !== 'escape'
      && key.name !== 'q'
      && key.name !== 'y'
      && key.name !== 'n') {
      return
    }
    done(null, key.name === 'enter' || key.name === 'y')
  })

  this._.okay.on('press', okay = function () {
    done(null, true)
  })

  this._.cancel.on('press', cancel = function () {
    done(null, false)
  })

  this.screen.saveFocus()
  this.focus()

  function done(err, data) {
    self.hide()
    self.screen.restoreFocus()
    self.removeScreenEvent(KEYPRESS, press)
    self._.okay.removeListener('press', okay)
    self._.cancel.removeListener('press', cancel)
    return callback(err, data)
  }

  this.screen.render()
}

/**
 * Expose
 */

module.exports = Question
