/**
 * loading.js - loading element for blessed
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
const Text = require('./text')

/**
 * Loading
 */

function Loading(options) {
  if (!(this instanceof Node)) { return new Loading(options) }

  options = options || {}

  Box.call(this, options)

  this._.icon = new Text({
    parent: this,
    align: 'center',
    top: 2,
    left: 1,
    right: 1,
    height: 1,
    content: '|'
  })
}

Loading.prototype.__proto__ = Box.prototype

Loading.prototype.type = 'loading'

Loading.prototype.load = function (text) {
  const self = this

  // XXX Keep above:
  // var parent = this.parent;
  // this.detach();
  // parent.append(this);

  this.show()
  this.setContent(text)

  if (this._.timer) {
    this.stop()
  }

  this.screen.lockKeys = true

  this._.timer = setInterval(function () {
    if (self._.icon.content === '|') {
      self._.icon.setContent('/')
    }
    else if (self._.icon.content === '/') {
      self._.icon.setContent('-')
    }
    else if (self._.icon.content === '-') {
      self._.icon.setContent('\\')
    }
    else if (self._.icon.content === '\\') {
      self._.icon.setContent('|')
    }
    self.screen.render()
  }, 200)
}

Loading.prototype.stop = function () {
  this.screen.lockKeys = false
  this.hide()
  if (this._.timer) {
    clearInterval(this._.timer)
    delete this._.timer
  }
  this.screen.render()
}

/**
 * Expose
 */

module.exports = Loading
