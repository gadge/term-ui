/**
 * prompt.js - prompt element for blessed
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
const Textbox = require('./textbox')

/**
 * Prompt
 */

function Prompt(options) {
  if (!(this instanceof Node)) { return new Prompt(options) }

  options = options || {}

  options.hidden = true

  Box.call(this, options)

  this._.input = new Textbox({
    parent: this,
    top: 3,
    height: 1,
    left: 2,
    right: 2,
    bg: 'black'
  })

  this._.okay = new Button({
    parent: this,
    top: 5,
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
    parent: this,
    top: 5,
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

Prompt.prototype.__proto__ = Box.prototype

Prompt.prototype.type = 'prompt'

Prompt.prototype.input =
  Prompt.prototype.setInput =
    Prompt.prototype.readInput = function (text, value, callback) {
      const self = this
      let okay, cancel

      if (!callback) {
        callback = value
        value = ''
      }

      // Keep above:
      // var parent = this.parent;
      // this.detach();
      // parent.append(this);

      this.show()
      this.setContent(' ' + text)

      this._.input.value = value

      this.screen.saveFocus()

      this._.okay.on(PRESS, okay = function () {
        self._.input.submit()
      })

      this._.cancel.on(PRESS, cancel = function () {
        self._.input.cancel()
      })

      this._.input.readInput(function (err, data) {
        self.hide()
        self.screen.restoreFocus()
        self._.okay.removeListener(PRESS, okay)
        self._.cancel.removeListener(PRESS, cancel)
        return callback(err, data)
      })

      this.screen.render()
    }

/**
 * Expose
 */

module.exports = Prompt
