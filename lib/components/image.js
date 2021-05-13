/**
 * image.js - image element for blessed
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
 * Image
 */

function Image(options) {
  if (!(this instanceof Node)) { return new Image(options) }

  options = options || {}
  options.type = options.itype || options.type || 'ansi'

  Box.call(this, options)

  if (options.type === 'ansi' && this.type !== 'ansiimage') {
    const ANSIImage = require('./ansiimage')
    Object.getOwnPropertyNames(ANSIImage.prototype).forEach(function (key) {
      if (key === 'type') return
      Object.defineProperty(this, key,
        Object.getOwnPropertyDescriptor(ANSIImage.prototype, key))
    }, this)
    ANSIImage.call(this, options)
    return this
  }

  if (options.type === 'overlay' && this.type !== 'overlayimage') {
    const OverlayImage = require('./overlayimage')
    Object.getOwnPropertyNames(OverlayImage.prototype).forEach(function (key) {
      if (key === 'type') return
      Object.defineProperty(this, key,
        Object.getOwnPropertyDescriptor(OverlayImage.prototype, key))
    }, this)
    OverlayImage.call(this, options)
    return this
  }

  throw new Error('`type` must either be `ansi` or `overlay`.')
}

Image.prototype.__proto__ = Box.prototype

Image.prototype.type = 'image'

/**
 * Expose
 */

module.exports = Image
