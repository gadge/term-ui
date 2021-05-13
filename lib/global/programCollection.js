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
        SET_CONTENT, SET_ITEMS, SHOW, SIGINT, SIGQUIT, SIGTERM, SIZE, SUBMIT, TITLE, UNCAUGHT_EXCEPTION, UNCHECK,
        WARNING, WHEELDOWN, WHEELUP
      } = require('@pres/enum-events')

class ProgramCollection {
  static global = null
  static total = 0
  static instances = []
  static _bound = false

  static initialize(program) {
    if (!ProgramCollection.global) ProgramCollection.global = program
    if (!~ProgramCollection.instances.indexOf(program)) {
      ProgramCollection.instances.push(program)
      program.index = ProgramCollection.total
      ProgramCollection.total++
    }
    console.log('>> [ProgramCollection.initialize]', '[index]', program.index, '[total]', ProgramCollection.total)
    if (ProgramCollection._bound) return void 0
    ProgramCollection._bound = true
    ProgramCollection.unshiftEvent(process, EXIT, ProgramCollection._exitHandler = createExitHandler())
  }

  // We could do this easier by just manipulating the _events object, or for
  // older versions of node, manipulating the array returned by listeners(), but
  // neither of these methods are guaranteed to work in future versions of node.
  static unshiftEvent(obj, event, listener) {
    const listeners = obj.listeners(event)
    obj.removeAllListeners(event)
    obj.on(event, listener)
    listeners.forEach(listener => obj.on(event, listener))
  }
}

function createExitHandler() {
  return () => {
    ProgramCollection.instances.forEach(program => {
      program.flush()  // Ensure the buffer is flushed (it should always be at this point, but who knows).
      program._exiting = true // Ensure _exiting is set (could technically  use process._exiting).
    })
  }
}

module.exports = ProgramCollection


