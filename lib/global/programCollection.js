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
    ProgramCollection.unshiftEvent(process, 'exit', ProgramCollection._exitHandler)
  }

  static _exitHandler() {
    ProgramCollection.instances.forEach(program => {
      program.flush()  // Ensure the buffer is flushed (it should always be at this point, but who knows).
      program._exiting = true // Ensure _exiting is set (could technically  use process._exiting).
    })
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

module.exports = ProgramCollection


