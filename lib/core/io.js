const {
        BLUR, BTNDOWN, BTNUP, DATA, DESTROY, DRAG, ERROR, EXIT,
        FOCUS, KEY, KEYPRESS, MOUSE, MOUSEDOWN, MOUSEMOVE, MOUSEUP,
        MOUSEWHEEL, MOVE, NEW_LISTENER, RESIZE, RESPONSE, WARNING, WHEELDOWN, WHEELUP
      }                 = require('@pres/enum-events'),
      { FUN }           = require('@typen/enum-data-types'),
      { EventEmitter }  = require('events'),
      { StringDecoder } = require('string_decoder'),
      ProgramCollection = require('../global/programCollection'),
      cp                = require('child_process'),
      util              = require('util'),
      fs                = require('fs'),
      Tput              = require('../tput')

const nextTick = global.setImmediate || process.nextTick.bind(process)

class IO extends EventEmitter {
  constructor(options) {
    super(options)
    if (!(this instanceof IO)) return new IO(options)
    // EventEmitter.call(this, options)
  }
  configIO(options) {
    const self = this
    if (!options || options.__proto__ !== Object.prototype) options = {
      input: arguments[0],
      output: arguments[1]
    } // io
    this.options = options // io
    this.input = options.input || process.stdin // io
    this.output = options.output || process.stdout // io
    options.log = options.log || options.dump // io
    if (options.log) {
      this._logger = fs.createWriteStream(options.log)
      if (options.dump) this.setupDump()
    } // io
    this.zero = options.zero !== false
    this.useBuffer = options.buffer // io
    this._terminal = options.terminal || options.term || process.env.TERM || (process.platform === 'win32' ? 'windows-ansi' : 'xterm') // io
    this._terminal = this._terminal.toLowerCase() // io
    this.tmux = !!process.env.TMUX // io
    this.tmuxVersion = (function () {
      if (!self.tmux) return 2
      try {
        const version = cp.execFileSync('tmux', [ '-V' ], { encoding: 'utf8' })
        return +/^tmux ([\d.]+)/i.exec(version.trim().split('\n')[0])[1]
      } catch (e) {
        return 2
      }
    })() // io
    this._buf = '' // io
    this._flush = this.flush.bind(this) // io
    if (options.tput !== false) this.setupTput() // io
    console.log(`>> [Program.configIO] [terminal] ${this._terminal} [tmux] ${this.tmux}`)
  }
  log() { return this._log('LOG', util.format.apply(util, arguments)) }
  debug() { if (this.options.debug) { return this._log('DEBUG', util.format.apply(util, arguments)) } }
  _log(pre, msg) { if (this._logger) { return this._logger.write(pre + ': ' + msg + '\n-\n') } }
  setupDump() {
    const self    = this,
          write   = this.output.write,
          decoder = new StringDecoder('utf8')

    function stringify(data) {
      return caret(data
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t'))
        .replace(/[^ -~]/g, ch => {
          if (ch.charCodeAt(0) > 0xff) return ch
          ch = ch.charCodeAt(0).toString(16)
          if (ch.length > 2) {
            if (ch.length < 4) ch = '0' + ch
            return '\\u' + ch
          }
          if (ch.length < 2) ch = '0' + ch
          return '\\x' + ch
        })
    }

    function caret(data) {
      return data.replace(/[\0\x80\x1b-\x1f\x7f\x01-\x1a]/g, function (ch) {
        if (ch === '\0' || ch === '\x80') {
          ch = '@'
        }
        else if (ch === '\x1b') {
          ch = '['
        }
        else if (ch === '\x1c') {
          ch = '\\'
        }
        else if (ch === '\x1d') {
          ch = ']'
        }
        else if (ch === '\x1e') {
          ch = '^'
        }
        else if (ch === '\x1f') {
          ch = '_'
        }
        else if (ch === '\x7f') {
          ch = '?'
        }
        else {
          ch = ch.charCodeAt(0)
          // From ('A' - 64) to ('Z' - 64).
          if (ch >= 1 && ch <= 26) {
            ch = String.fromCharCode(ch + 64)
          }
          else {
            return String.fromCharCode(ch)
          }
        }
        return '^' + ch
      })
    }

    this.input.on(DATA, data => { self._log('IN', stringify(decoder.write(data))) })

    this.output.write = function (data) { return self._log('OUT', stringify(data)), write.apply(this, arguments) }
  }
  setupTput() {
    if (this._tputSetup) return
    this._tputSetup = true

    const self    = this,
          options = this.options,
          write   = this.wr.bind(this)

    const tput = this.tput = new Tput({
      terminal: this.terminal,
      padding: options.padding,
      extended: options.extended,
      printf: options.printf,
      termcap: options.termcap,
      forceUnicode: options.forceUnicode
    })

    if (tput.error) { nextTick(() => self.emit(WARNING, tput.error.message)) }
    if (tput.padding) { nextTick(() => self.emit(WARNING, 'Terminfo padding has been enabled.')) }

    this.put = function (...args) {
      const cap = args.shift()
      if (tput[cap]) return this.wr(tput[cap].apply(tput, args))
    }

    Object.keys(tput).forEach(key => {
      if (self[key] == null) self[key] = tput[key]
      if (typeof tput[key] !== FUN) return void (self.put[key] = tput[key])
      self.put[key] = tput.padding
        ? function () { return tput._print(tput[key].apply(tput, arguments), write) }
        : function () { return self.wr(tput[key].apply(tput, arguments)) }
    })
  }
  setTerminal(terminal) {
    this._terminal = terminal.toLowerCase()
    delete this._tputSetup
    this.setupTput()
  }
  has(name) { return this.tput ? this.tput.has(name) : false }
  term(is) { return this.terminal.indexOf(is) === 0 }
  out(name, ...args) {
    this.ret = true
    const out = this[name].apply(this, args)
    this.ret = false
    return out
  }
  _owrite(text) { if (this.output.writable) { return this.output.write(text) } }
  write(text) { if (this.output.writable) { return this.output.write(text) } }
  ow(text) { if (this.output.writable) { return this.output.write(text) } }
  _buffer(text) {
    if (this._exiting) return void (this.flush(), this.ow(text))
    if (this._buf) return void (this._buf += text)
    this._buf = text
    nextTick(this._flush)
    return true
  }
  _write(text) { return this.ret ? text : this.useBuffer ? this._buffer(text) : this.ow(text) }
  wr(text) { return this.ret ? text : this.useBuffer ? this._buffer(text) : this.ow(text) }
  _twrite(data) {
    const self = this
    let iterations = 0,
        timer
    if (this.tmux) {
      // Replace all STs with BELs so they can be nested within the DCS code.
      data = data.replace(/\x1b\\/g, '\x07')
      // Wrap in tmux forward DCS:
      data = '\x1bPtmux;\x1b' + data + '\x1b\\'
      // If we've never even flushed yet, it means we're still in
      // the normal buffer. Wait for alt screen buffer.
      if (this.output.bytesWritten === 0) {
        timer = setInterval(() => {
          if (self.output.bytesWritten > 0 || ++iterations === 50) {
            clearInterval(timer)
            self.flush()
            self.ow(data)
          }
        }, 100)
        return true
      }
      // NOTE: Flushing the buffer is required in some cases.
      // The DCS code must be at the start of the output.
      this.flush()
      // Write out raw now that the buffer is flushed.
      return this.ow(data)
    }
    return this.wr(data)
  }
  tw(data) {
    const self = this
    let iterations = 0,
        timer
    if (this.tmux) {
      // Replace all STs with BELs so they can be nested within the DCS code.
      data = data.replace(/\x1b\\/g, '\x07')
      // Wrap in tmux forward DCS:
      data = '\x1bPtmux;\x1b' + data + '\x1b\\'
      // If we've never even flushed yet, it means we're still in
      // the normal buffer. Wait for alt screen buffer.
      if (this.output.bytesWritten === 0) {
        timer = setInterval(() => {
          if (self.output.bytesWritten > 0 || ++iterations === 50) {
            clearInterval(timer)
            self.flush()
            self.ow(data)
          }
        }, 100)
        return true
      }
      // NOTE: Flushing the buffer is required in some cases.
      // The DCS code must be at the start of the output.
      this.flush()
      // Write out raw now that the buffer is flushed.
      return this.ow(data)
    }
    return this.wr(data)
  }
  echo(text, attr) { this.wr(attr ? this.text(text, attr) : text) }
  print(text, attr) { this.wr(attr ? this.text(text, attr) : text) }
  flush() {
    if (!this._buf) return
    this.ow(this._buf)
    this._buf = ''
  }
  get terminal() { return this._terminal }
  set terminal(terminal) { return this.setTerminal(terminal), this.terminal }

  listen() {
    const self = this

    // Potentially reset window title on exit:
    // if (!this.isRxvt) {
    //   if (!this.isVTE) this.setTitleModeFeature(3);
    //   this.manipulateWindow(21, function(err, data) {
    //     if (err) return;
    //     self._originalTitle = data.text;
    //   });
    //  }

    // Listen for keys/mouse on input
    if (!this.input._blessedInput) {
      this.input._blessedInput = 1
      this._listenInput()
    }
    else {
      this.input._blessedInput++
    }

    this.on(NEW_LISTENER, this._newHandler = function newHandler(type) {
      if (type === KEYPRESS || type === MOUSE) {
        self.off(NEW_LISTENER, newHandler)
        if (self.input.setRawMode && !self.input.isRaw) {
          self.input.setRawMode(true)
          self.input.resume()
        }
      }
    })

    this.on(NEW_LISTENER, function handler(type) {
      if (type === MOUSE) {
        self.off(NEW_LISTENER, handler)
        self.bindMouse()
      }
    })

    // Listen for resize on output
    if (!this.output._blessedOutput) {
      this.output._blessedOutput = 1
      this._listenOutput()
    }
    else {
      this.output._blessedOutput++
    }
  }

  _listenInput() {
    const keys = require('../keys'),
          self = this

    // Input
    this.input.on(KEYPRESS, this.input._keypressHandler = function (ch, key) {
      key = key || { ch: ch }
      if (key.name === 'undefined' && (key.code === '[M' || key.code === '[I' || key.code === '[O')) return void 0
      if (key.name === 'undefined') return void 0
      if (key.name === 'enter') if (key.sequence === '\n') key.name = 'linefeed'
      if (key.name === 'return' && key.sequence === '\r') self.input.emit(KEYPRESS, ch, merge({}, key, { name: 'enter' }))
      const name = (key.ctrl ? 'C-' : '') + (key.meta ? 'M-' : '') + (key.shift && key.name ? 'S-' : '') + (key.name || ch)
      key.full = name
      ProgramCollection.instances.forEach(function (program) {
        if (program.input !== self.input) return
        program.emit(KEYPRESS, ch, key)
        program.emit(KEY + SP + name, ch, key)
      })
    })

    this.input.on(DATA, this.input._dataHandler = function (data) {
      ProgramCollection.instances.forEach(function (program) {
        if (program.input !== self.input) return
        program.emit(DATA, data)
      })
    })

    keys.emitKeypressEvents(this.input)
  }

  _listenOutput() {
    const self = this
    if (!this.output.isTTY) nextTick(() => self.emit(WARNING, 'Output is not a TTY'))

    // Output
    function resize() {
      ProgramCollection.instances.forEach(function (program) {
        if (program.output !== self.output) return
        program.cols = program.output.columns
        program.rows = program.output.rows
        program.emit(RESIZE)
      })
    }

    this.output.on(RESIZE, this.output._resizeHandler = function () {
      ProgramCollection.instances.forEach(function (program) {
        if (program.output !== self.output) return
        if (!program.options.resizeTimeout) {
          return resize()
        }
        if (program._resizeTimer) {
          clearTimeout(program._resizeTimer)
          delete program._resizeTimer
        }
        const time = typeof program.options.resizeTimeout === NUM
          ? program.options.resizeTimeout
          : 300
        program._resizeTimer = setTimeout(resize, time)
      })
    })
  }
}


module.exports = IO