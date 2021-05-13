/**
 * https://github.com/chjj/blessed
 */
const {
        ACTION, ADD_ITEM, ADOPT, ATTACH, BLUR, BTNDOWN, BTNUP, CANCEL, CD, CHECK, CLICK, CLOSE, COMPLETE, CONNECT,
        CREATE_ITEM, DATA, DBLCLICK, DESTROY, DETACH, DRAG, ELEMENT_CLICK, ELEMENT_FOCUS, ELEMENT_KEYPRESS,
        ELEMENT_MOUSEOUT, ELEMENT_MOUSEOVER, ELEMENT_MOUSEUP, ELEMENT_WHEELDOWN, ELEMENT_WHEELUP, ERROR, EVENT, EXIT,
        FILE, FOCUS, HIDE, INSERT_ITEM, KEY, KEYPRESS, LOG, MOUSE, MOUSEDOWN, MOUSEMOVE, MOUSEOUT, MOUSEOVER, MOUSEUP,
        MOUSEWHEEL, MOVE, NEW_LISTENER, ON, PARSED_CONTENT, PASSTHROUGH, PRERENDER, PRESS, REFRESH, REMOVE, REMOVE_ITEM,
        REMOVE_LISTENER, RENDER, REPARENT, RESET, RESIZE, RESPONSE, SCROLL, SELECT, SELECT_ITEM, SELECT_TAB,
        SET_CONTENT, SET_ITEMS, SHOW, SIZE, SUBMIT, TITLE, UNCAUGHT_EXCEPTION, UNCHECK,
        WARNING, WHEELDOWN, WHEELUP
      } = require('@pres/enum-events')
const { SIGTERM, SIGINT, SIGQUIT } = require('@geia/enum-signals')

const SIGNAL_COLLECTION = [ SIGTERM, SIGINT, SIGQUIT ]
const nextTick = global.setImmediate || process.nextTick.bind(process)

class ScreenCollection {
  static global = null
  static total = 0
  static instances = []
  static _bound = false
  static journal = true
  // static _exceptionHandler = null
  // static _exitHandler = null

  static initialize(screen) {
    if (!ScreenCollection.global) ScreenCollection.global = screen
    if (!~ScreenCollection.instances.indexOf(screen)) {
      ScreenCollection.instances.push(screen)
      screen.index = ScreenCollection.total
      ScreenCollection.total++
    }
    console.log('>> [ScreenCollection.initialize]', '[index]', screen.index, '[total]', ScreenCollection.total)
    if (ScreenCollection._bound) return
    ScreenCollection._bound = true
    process.on(UNCAUGHT_EXCEPTION, ScreenCollection._exceptionHandler = err => {
      if (process.listeners(UNCAUGHT_EXCEPTION).length > 1) return
      ScreenCollection.instances.slice().forEach(screen => screen.destroy())
      err = err || new Error('Uncaught Exception.')
      console.error(err.stack ? err.stack + '' : err + '')
      nextTick(() => process.exit(1))
    })
    SIGNAL_COLLECTION.forEach(signal => {
      const name = '_' + signal.toLowerCase() + 'Handler'
      process.on(signal, ScreenCollection[name] = () => {
        if (process.listeners(signal).length > 1) return void 0
        nextTick(() => process.exit(0))
      })
    })
    process.on(EXIT, ScreenCollection._exitHandler = () => {
      ScreenCollection.instances.slice().forEach(screen => {
        screen.destroy()
      })
    })
  }
}

module.exports = ScreenCollection