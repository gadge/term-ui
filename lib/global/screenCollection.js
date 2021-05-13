/**
 * https://github.com/chjj/blessed
 */


const SIGNAL_COLLECTION = [ 'SIGTERM', 'SIGINT', 'SIGQUIT' ]
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
    process.on('uncaughtException', ScreenCollection._exceptionHandler = err => {
      if (process.listeners('uncaughtException').length > 1) return
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
    process.on('exit', ScreenCollection._exitHandler = () => {
      ScreenCollection.instances.slice().forEach(screen => {
        screen.destroy()
      })
    })
  }
}

module.exports = ScreenCollection