/**
 * message.js - message element for blessed
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

/**
 * Message / Error
 */

function Message(options) {
  if (!(this instanceof Node)) { return new Message(options) }

  options = options || {}
  options.tags = true

  Box.call(this, options)
}

Message.prototype.__proto__ = Box.prototype

Message.prototype.type = 'message'

Message.prototype.log =
  Message.prototype.display = function (text, time, callback) {
    const self = this

    if (typeof time === 'function') {
      callback = time
      time = null
    }

    if (time == null) time = 3

    // Keep above:
    // var parent = this.parent;
    // this.detach();
    // parent.append(this);

    if (this.scrollable) {
      this.screen.saveFocus()
      this.focus()
      this.scrollTo(0)
    }

    this.show()
    this.setContent(text)
    this.screen.render()

    if (time === Infinity || time === -1 || time === 0) {
      const end = function () {
        if (end.done) return
        end.done = true
        if (self.scrollable) {
          try {
            self.screen.restoreFocus()
          } catch (e) {

          }
        }
        self.hide()
        self.screen.render()
        if (callback) callback()
      }

      setTimeout(function () {
        self.onScreenEvent(KEYPRESS, function fn(ch, key) {
          if (key.name === MOUSE) return
          if (self.scrollable) {
            if ((key.name === 'up' || (self.options.vi && key.name === 'k'))
              || (key.name === 'down' || (self.options.vi && key.name === 'j'))
              || (self.options.vi && key.name === 'u' && key.ctrl)
              || (self.options.vi && key.name === 'd' && key.ctrl)
              || (self.options.vi && key.name === 'b' && key.ctrl)
              || (self.options.vi && key.name === 'f' && key.ctrl)
              || (self.options.vi && key.name === 'g' && !key.shift)
              || (self.options.vi && key.name === 'g' && key.shift)) {
              return
            }
          }
          if (self.options.ignoreKeys && ~self.options.ignoreKeys.indexOf(key.name)) {
            return
          }
          self.removeScreenEvent(KEYPRESS, fn)
          end()
        })
        // XXX May be affected by new element.options.mouse option.
        if (!self.options.mouse) return
        self.onScreenEvent(MOUSE, function fn(data) {
          if (data.action === MOUSEMOVE) return
          self.removeScreenEvent(MOUSE, fn)
          end()
        })
      }, 10)

      return
    }

    setTimeout(function () {
      self.hide()
      self.screen.render()
      if (callback) callback()
    }, time * 1000)
  }

Message.prototype.error = function (text, time, callback) {
  return this.display('{red-fg}Error: ' + text + '{/red-fg}', time, callback)
}

/**
 * Expose
 */

module.exports = Message
