/**
 * program.js - basic curses-like functionality for blessed.
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */


const {
        BLUR, BTNDOWN, BTNUP, DATA, DESTROY, DRAG, ERROR, EXIT,
        FOCUS, KEY, KEYPRESS, MOUSE, MOUSEDOWN, MOUSEMOVE, MOUSEUP,
        MOUSEWHEEL, MOVE, NEW_LISTENER, RESIZE, RESPONSE, WARNING, WHEELDOWN, WHEELUP
      }                 = require('@pres/enum-events'),
      { SP }            = require('@texting/enum-chars'),
      { NUM, STR, FUN } = require('@typen/enum-data-types'),
      { EventEmitter }  = require('events'),
      { StringDecoder } = require('string_decoder'),
      cp                = require('child_process'),
      util              = require('util'),
      fs                = require('fs'),
      Tput              = require('./tput'),
      colors            = require('./colors'),
      ProgramCollection = require('./global/programCollection')
const { SIGTSTP } = require('@geia/enum-signals')
const { SIGCONT } = require('@geia/enum-signals')


const slice    = Array.prototype.slice,
      nextTick = global.setImmediate || process.nextTick.bind(process)


/**
 * Program
 */

function Program(options = {}) {
  if (!(this instanceof Program)) return new Program(options)
  // Program.bind(this)
  ProgramCollection.initialize(this)
  EventEmitter.call(this)
  this.config(options)
}

Program.prototype.__proto__ = EventEmitter.prototype

Program.prototype.type = 'program'

Program.prototype.config = function (options) {
  const self = this
  if (!options || options.__proto__ !== Object.prototype) options = {
    input: arguments[0],
    output: arguments[1]
  }
  this.options = options
  this.input = options.input || process.stdin
  this.output = options.output || process.stdout
  options.log = options.log || options.dump
  if (options.log) {
    this._logger = fs.createWriteStream(options.log)
    if (options.dump) this.setupDump()
  }
  this.zero = options.zero !== false
  this.useBuffer = options.buffer
  this.x = 0
  this.y = 0
  this.savedX = 0
  this.savedY = 0
  this.cols = this.output.columns || 1
  this.rows = this.output.rows || 1
  this.scrollTop = 0
  this.scrollBottom = this.rows - 1
  this._terminal = options.terminal || options.term || process.env.TERM ||
    (process.platform === 'win32' ? 'windows-ansi' : 'xterm')
  this._terminal = this._terminal.toLowerCase()
  // OSX
  this.isOSXTerm = process.env.TERM_PROGRAM === 'Apple_Terminal'
  this.isiTerm2 = process.env.TERM_PROGRAM === 'iTerm.app' || !!process.env.ITERM_SESSION_ID
  // VTE
  // NOTE: lxterminal does not provide an env variable to check for.
  // NOTE: gnome-terminal and sakura use a later version of VTE
  // which provides VTE_VERSION as well as supports SGR events.
  this.isXFCE = /xfce/i.test(process.env.COLORTERM)
  this.isTerminator = !!process.env.TERMINATOR_UUID
  this.isLXDE = false
  this.isVTE = !!process.env.VTE_VERSION || this.isXFCE || this.isTerminator || this.isLXDE
  // xterm and rxvt - not accurate
  this.isRxvt = /rxvt/i.test(process.env.COLORTERM)
  this.isXterm = false
  this.tmux = !!process.env.TMUX
  this.tmuxVersion = (function () {
    if (!self.tmux) return 2
    try {
      const version = cp.execFileSync('tmux', [ '-V' ], { encoding: 'utf8' })
      return +/^tmux ([\d.]+)/i.exec(version.trim().split('\n')[0])[1]
    } catch (e) {
      return 2
    }
  })()
  this._buf = ''
  this._flush = this.flush.bind(this)
  if (options.tput !== false) this.setupTput()
  this.listen()
  console.log(`>> [new program] (${this.rows},${this.cols})`)
}

Object.defineProperties(Program.prototype, {
  terminal: { get() { return this._terminal }, set(terminal) { return this.setTerminal(terminal), this.terminal } },
  title: { get() { return this._title }, set(title) { return this.setTitle(title), this._title } },
})

Program.prototype.log = function () {
  return this._log('LOG', util.format.apply(util, arguments))
}

Program.prototype.debug = function () {
  if (!this.options.debug) return
  return this._log('DEBUG', util.format.apply(util, arguments))
}

Program.prototype._log = function (pre, msg) {
  if (!this._logger) return
  return this._logger.write(pre + ': ' + msg + '\n-\n')
}

Program.prototype.setupDump = function () {
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

  this.input.on(DATA, function (data) {
    self._log('IN', stringify(decoder.write(data)))
  })

  this.output.write = function (data) {
    self._log('OUT', stringify(data))
    return write.apply(this, arguments)
  }
}

Program.prototype.setupTput = function () {
  if (this._tputSetup) return
  this._tputSetup = true

  const self    = this,
        options = this.options,
        write   = this._write.bind(this)

  const tput = this.tput = new Tput({
    terminal: this.terminal,
    padding: options.padding,
    extended: options.extended,
    printf: options.printf,
    termcap: options.termcap,
    forceUnicode: options.forceUnicode
  })

  if (tput.error) {
    nextTick(function () {
      self.emit(WARNING, tput.error.message)
    })
  }

  if (tput.padding) {
    nextTick(function () {
      self.emit(WARNING, 'Terminfo padding has been enabled.')
    })
  }

  this.put = function (...args) {
    const cap  = args.shift()
    if (tput[cap]) return this._write(tput[cap].apply(tput, args))
  }

  Object.keys(tput).forEach(function (key) {
    if (self[key] == null) {
      self[key] = tput[key]
    }

    if (typeof tput[key] !== FUN) {
      self.put[key] = tput[key]
      return
    }

    if (tput.padding) {
      self.put[key] = function () {
        return tput._print(tput[key].apply(tput, arguments), write)
      }
    }
    else {
      self.put[key] = function () {
        return self._write(tput[key].apply(tput, arguments))
      }
    }
  })
}

Program.prototype.setTerminal = function (terminal) {
  this._terminal = terminal.toLowerCase()
  delete this._tputSetup
  this.setupTput()
}

Program.prototype.has = function (name) {
  return this.tput
    ? this.tput.has(name)
    : false
}

Program.prototype.term = function (is) {
  return this.terminal.indexOf(is) === 0
}

Program.prototype.listen = function () {
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
      self.removeListener(NEW_LISTENER, newHandler)
      if (self.input.setRawMode && !self.input.isRaw) {
        self.input.setRawMode(true)
        self.input.resume()
      }
    }
  })

  this.on(NEW_LISTENER, function handler(type) {
    if (type === MOUSE) {
      self.removeListener(NEW_LISTENER, handler)
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

Program.prototype._listenInput = function () {
  const keys = require('./keys'),
        self = this

  // Input
  this.input.on(KEYPRESS, this.input._keypressHandler = function (ch, key) {
    key = key || { ch: ch }

    if (key.name === 'undefined'
      && (key.code === '[M' || key.code === '[I' || key.code === '[O')) {
      // A mouse sequence. The `keys` module doesn't understand these.
      return
    }

    if (key.name === 'undefined') {
      // Not sure what this is, but we should probably ignore it.
      return
    }

    if (key.name === 'enter' && key.sequence === '\n') {
      key.name = 'linefeed'
    }

    if (key.name === 'return' && key.sequence === '\r') {
      self.input.emit(KEYPRESS, ch, merge({}, key, { name: 'enter' }))
    }

    const name = (key.ctrl ? 'C-' : '')
      + (key.meta ? 'M-' : '')
      + (key.shift && key.name ? 'S-' : '')
      + (key.name || ch)

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

Program.prototype._listenOutput = function () {
  const self = this

  if (!this.output.isTTY) {
    nextTick(function () {
      self.emit(WARNING, 'Output is not a TTY')
    })
  }

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

Program.prototype.destroy = function () {
  const index = ProgramCollection.instances.indexOf(this)

  if (~index) {
    ProgramCollection.instances.splice(index, 1)
    ProgramCollection.total--

    this.flush()
    this._exiting = true

    ProgramCollection.global = ProgramCollection.instances[0]

    if (ProgramCollection.total === 0) {
      ProgramCollection.global = null

      process.removeListener(EXIT, ProgramCollection._exitHandler)
      delete ProgramCollection._exitHandler

      delete Program._bound
    }

    this.input._blessedInput--
    this.output._blessedOutput--

    if (this.input._blessedInput === 0) {
      this.input.removeListener(KEYPRESS, this.input._keypressHandler)
      this.input.removeListener(DATA, this.input._dataHandler)
      delete this.input._keypressHandler
      delete this.input._dataHandler

      if (this.input.setRawMode) {
        if (this.input.isRaw) {
          this.input.setRawMode(false)
        }
        if (!this.input.destroyed) {
          this.input.pause()
        }
      }
    }

    if (this.output._blessedOutput === 0) {
      this.output.removeListener(RESIZE, this.output._resizeHandler)
      delete this.output._resizeHandler
    }

    this.removeListener(NEW_LISTENER, this._newHandler)
    delete this._newHandler

    this.destroyed = true
    this.emit(DESTROY)
  }
}

Program.prototype.key = function (key, listener) {
  if (typeof key === 'string') key = key.split(/\s*,\s*/)
  key.forEach(function (key) {
    return this.on(KEY + SP + key, listener)
  }, this)
}

Program.prototype.onceKey = function (key, listener) {
  if (typeof key === STR) key = key.split(/\s*,\s*/)
  key.forEach(function (key) {
    return this.once(KEY + SP + key, listener)
  }, this)
}

Program.prototype.unkey =
  Program.prototype.removeKey = function (key, listener) {
    if (typeof key === STR) key = key.split(/\s*,\s*/)
    key.forEach(function (key) {
      return this.removeListener(KEY + SP + key, listener)
    }, this)
  }

// XTerm mouse events
// http://invisible-island.net/xterm/ctlseqs/ctlseqs.html#Mouse%20Tracking
// To better understand these
// the xterm code is very helpful:
// Relevant files:
//   button.c, charproc.c, misc.c
// Relevant functions in xterm/button.c:
//   BtnCode, EmitButtonCode, EditorButton, SendMousePosition
// send a mouse event:
// regular/utf8: ^[[M Cb Cx Cy
// urxvt: ^[[ Cb ; Cx ; Cy M
// sgr: ^[[ Cb ; Cx ; Cy M/m
// vt300: ^[[ 24(1/3/5)~ [ Cx , Cy ] \r
// locator: CSI P e ; P b ; P r ; P c ; P p & w
// motion example of a left click:
// ^[[M 3<^[[M@4<^[[M@5<^[[M@6<^[[M@7<^[[M#7<
// mouseup, mousedown, mousewheel
// left click: ^[[M 3<^[[M#3<
// mousewheel up: ^[[M`3>
Program.prototype.bindMouse = function () {
  if (this._boundMouse) return
  this._boundMouse = true

  const decoder = new StringDecoder('utf8'),
        self    = this

  this.on(DATA, function (data) {
    const text = decoder.write(data)
    if (!text) return
    self._bindMouse(text, data)
  })
}

Program.prototype._bindMouse = function (s, buf) {
  const self = this
  let key,
      parts,
      b,
      x,
      y,
      mod,
      params,
      down,
      page,
      button

  key = {
    name: undefined,
    ctrl: false,
    meta: false,
    shift: false
  }
  if (Buffer.isBuffer(s)) {
    if (s[0] > 127 && s[1] === undefined) {
      s[0] -= 128
      s = '\x1b' + s.toString('utf-8')
    }
    else {
      s = s.toString('utf-8')
    }
  }

  // if (this.8bit) {
  //   s = s.replace(/\233/g, '\x1b[');
  //   buf = new Buffer(s, 'utf8');
  //  }

  // XTerm / X10 for buggy VTE
  // VTE can only send unsigned chars and no unicode for coords. This limits
  // them to 0xff. However, normally the x10 protocol does not allow a byte
  // under 0x20, but since VTE can have the bytes overflow, we can consider
  // bytes below 0x20 to be up to 0xff + 0x20. This gives a limit of 287. Since
  // characters ranging from 223 to 248 confuse javascript's utf parser, we
  // need to parse the raw binary. We can detect whether the terminal is using
  // a bugged VTE version by examining the coordinates and seeing whether they
  // are a value they would never otherwise be with a properly implemented x10
  // protocol. This method of detecting VTE is only 99% reliable because we
  // can't check if the coords are 0x00 (255) since that is a valid x10 coord
  // technically.
  const bx = s.charCodeAt(4)
  const by = s.charCodeAt(5)
  if (
    buf[0] === 0x1b && buf[1] === 0x5b && buf[2] === 0x4d &&
    (
      this.isVTE ||
      bx >= 65533 || by >= 65533 ||
      (bx > 0x00 && bx < 0x20) ||
      (by > 0x00 && by < 0x20) ||
      (buf[4] > 223 && buf[4] < 248 && buf.length === 6) ||
      (buf[5] > 223 && buf[5] < 248 && buf.length === 6)
    )
  ) {
    b = buf[3]
    x = buf[4]
    y = buf[5]

    // unsigned char overflow.
    if (x < 0x20) x += 0xff
    if (y < 0x20) y += 0xff

    // Convert the coordinates into a
    // properly formatted x10 utf8 sequence.
    s = '\x1b[M'
      + String.fromCharCode(b)
      + String.fromCharCode(x)
      + String.fromCharCode(y)
  }

  // XTerm / X10
  if (parts = /^\x1b\[M([\x00\u0020-\uffff]{3})/.exec(s)) {
    b = parts[1].charCodeAt(0)
    x = parts[1].charCodeAt(1)
    y = parts[1].charCodeAt(2)

    key.name = MOUSE
    key.type = 'X10'

    key.raw = [ b, x, y, parts[0] ]
    key.buf = buf
    key.x = x - 32
    key.y = y - 32

    if (this.zero) key.x--, key.y--

    if (x === 0) key.x = 255
    if (y === 0) key.y = 255

    mod = b >> 2
    key.shift = !!(mod & 1)
    key.meta = !!((mod >> 1) & 1)
    key.ctrl = !!((mod >> 2) & 1)

    b -= 32

    if ((b >> 6) & 1) {
      key.action = b & 1 ? WHEELDOWN : WHEELUP
      key.button = 'middle'
    }
    else if (b === 3) {
      // NOTE: x10 and urxvt have no way
      // of telling which button mouseup used.
      key.action = MOUSEUP
      key.button = this._lastButton || 'unknown'
      delete this._lastButton
    }
    else {
      key.action = MOUSEDOWN
      button = b & 3
      key.button =
        button === 0 ? 'left'
          : button === 1 ? 'middle'
          : button === 2 ? 'right'
            : 'unknown'
      this._lastButton = key.button
    }

    // Probably a movement.
    // The *newer* VTE gets mouse movements comepletely wrong.
    // This presents a problem: older versions of VTE that get it right might
    // be confused by the second conditional in the if statement.
    // NOTE: Possibly just switch back to the if statement below.
    // none, shift, ctrl, alt
    // gnome: 32, 36, 48, 40
    // xterm: 35, _, 51, _
    // urxvt: 35, _, _, _
    // if (key.action === MOUSEDOWN && key.button === 'unknown') {
    if (b === 35 || b === 39 || b === 51 || b === 43 ||
      (this.isVTE && (b === 32 || b === 36 || b === 48 || b === 40))) {
      delete key.button
      key.action = MOUSEMOVE
    }

    self.emit(MOUSE, key)

    return
  }

  // URxvt
  if ((parts = /^\x1b\[(\d+;\d+;\d+)M/.exec(s))) {
    params = parts[1].split(';')
    b = +params[0]
    x = +params[1]
    y = +params[2]

    key.name = MOUSE
    key.type = 'urxvt'

    key.raw = [ b, x, y, parts[0] ]
    key.buf = buf
    key.x = x
    key.y = y

    if (this.zero) key.x--, key.y--

    mod = b >> 2
    key.shift = !!(mod & 1)
    key.meta = !!((mod >> 1) & 1)
    key.ctrl = !!((mod >> 2) & 1)

    // XXX Bug in urxvt after wheelup/down on mousemove
    // NOTE: This may be different than 128/129 depending
    // on mod keys.
    if (b === 128 || b === 129) {
      b = 67
    }

    b -= 32

    if ((b >> 6) & 1) {
      key.action = b & 1 ? WHEELDOWN : WHEELUP
      key.button = 'middle'
    }
    else if (b === 3) {
      // NOTE: x10 and urxvt have no way
      // of telling which button mouseup used.
      key.action = MOUSEUP
      key.button = this._lastButton || 'unknown'
      delete this._lastButton
    }
    else {
      key.action = MOUSEDOWN
      button = b & 3
      key.button =
        button === 0 ? 'left'
          : button === 1 ? 'middle'
          : button === 2 ? 'right'
            : 'unknown'
      // NOTE: 0/32 = mousemove, 32/64 = mousemove with left down
      // if ((b >> 1) === 32)
      this._lastButton = key.button
    }

    // Probably a movement.
    // The *newer* VTE gets mouse movements comepletely wrong.
    // This presents a problem: older versions of VTE that get it right might
    // be confused by the second conditional in the if statement.
    // NOTE: Possibly just switch back to the if statement below.
    // none, shift, ctrl, alt
    // urxvt: 35, _, _, _
    // gnome: 32, 36, 48, 40
    // if (key.action === MOUSEDOWN && key.button === 'unknown') {
    if (b === 35 || b === 39 || b === 51 || b === 43 ||
      (this.isVTE && (b === 32 || b === 36 || b === 48 || b === 40))) {
      delete key.button
      key.action = MOUSEMOVE
    }

    self.emit(MOUSE, key)

    return
  }

  // SGR
  if ((parts = /^\x1b\[<(\d+;\d+;\d+)([mM])/.exec(s))) {
    down = parts[2] === 'M'
    params = parts[1].split(';')
    b = +params[0]
    x = +params[1]
    y = +params[2]

    key.name = MOUSE
    key.type = 'sgr'

    key.raw = [ b, x, y, parts[0] ]
    key.buf = buf
    key.x = x
    key.y = y

    if (this.zero) key.x--, key.y--

    mod = b >> 2
    key.shift = !!(mod & 1)
    key.meta = !!((mod >> 1) & 1)
    key.ctrl = !!((mod >> 2) & 1)

    if ((b >> 6) & 1) {
      key.action = b & 1 ? WHEELDOWN : WHEELUP
      key.button = 'middle'
    }
    else {
      key.action = down
        ? MOUSEDOWN
        : MOUSEUP
      button = b & 3
      key.button = button === 0 ? 'left' : button === 1 ? 'middle' : button === 2 ? 'right' : 'unknown'
    }

    // Probably a movement.
    // The *newer* VTE gets mouse movements comepletely wrong.
    // This presents a problem: older versions of VTE that get it right might
    // be confused by the second conditional in the if statement.
    // NOTE: Possibly just switch back to the if statement below.
    // none, shift, ctrl, alt
    // xterm: 35, _, 51, _
    // gnome: 32, 36, 48, 40
    // if (key.action === MOUSEDOWN && key.button === 'unknown') {
    if (b === 35 || b === 39 || b === 51 || b === 43 ||
      (this.isVTE && (b === 32 || b === 36 || b === 48 || b === 40))) {
      delete key.button
      key.action = MOUSEMOVE
    }

    self.emit(MOUSE, key)

    return
  }

  // DEC
  // The xterm mouse documentation says there is a
  // `<` prefix, the DECRQLP says there is no prefix.
  if ((parts = /^\x1b\[<(\d+;\d+;\d+;\d+)&w/.exec(s))) {
    params = parts[1].split(';')
    b = +params[0]
    x = +params[1]
    y = +params[2]
    page = +params[3]

    key.name = MOUSE
    key.type = 'dec'

    key.raw = [ b, x, y, parts[0] ]
    key.buf = buf
    key.x = x
    key.y = y
    key.page = page

    if (this.zero) key.x--, key.y--

    key.action = b === 3
      ? MOUSEUP
      : MOUSEDOWN

    key.button =
      b === 2 ? 'left'
        : b === 4 ? 'middle'
        : b === 6 ? 'right'
          : 'unknown'

    self.emit(MOUSE, key)

    return
  }

  // vt300
  if ((parts = /^\x1b\[24([0135])~\[(\d+),(\d+)\]\r/.exec(s))) {
    b = +parts[1]
    x = +parts[2]
    y = +parts[3]

    key.name = MOUSE
    key.type = 'vt300'

    key.raw = [ b, x, y, parts[0] ]
    key.buf = buf
    key.x = x
    key.y = y

    if (this.zero) key.x--, key.y--

    key.action = MOUSEDOWN
    key.button =
      b === 1 ? 'left'
        : b === 2 ? 'middle'
        : b === 5 ? 'right'
          : 'unknown'

    self.emit(MOUSE, key)

    return
  }

  if ((parts = /^\x1b\[(O|I)/.exec(s))) {
    key.action = parts[1] === 'I'
      ? FOCUS
      : BLUR

    self.emit(MOUSE, key)
    self.emit(key.action)


  }
}

// gpm support for linux vc
Program.prototype.enableGpm = function () {
  const self = this
  const gpmclient = require('./gpmclient')

  if (this.gpm) return

  this.gpm = gpmclient()

  this.gpm.on(BTNDOWN, function (btn, modifier, x, y) {
    x--, y--

    const key = {
      name: MOUSE,
      type: 'GPM',
      action: MOUSEDOWN,
      button: self.gpm.ButtonName(btn),
      raw: [ btn, modifier, x, y ],
      x: x,
      y: y,
      shift: self.gpm.hasShiftKey(modifier),
      meta: self.gpm.hasMetaKey(modifier),
      ctrl: self.gpm.hasCtrlKey(modifier)
    }

    self.emit(MOUSE, key)
  })

  this.gpm.on(BTNUP, function (btn, modifier, x, y) {
    x--, y--

    const key = {
      name: MOUSE,
      type: 'GPM',
      action: MOUSEUP,
      button: self.gpm.ButtonName(btn),
      raw: [ btn, modifier, x, y ],
      x: x,
      y: y,
      shift: self.gpm.hasShiftKey(modifier),
      meta: self.gpm.hasMetaKey(modifier),
      ctrl: self.gpm.hasCtrlKey(modifier)
    }

    self.emit(MOUSE, key)
  })

  this.gpm.on(MOVE, function (btn, modifier, x, y) {
    x--, y--

    const key = {
      name: MOUSE,
      type: 'GPM',
      action: MOUSEMOVE,
      button: self.gpm.ButtonName(btn),
      raw: [ btn, modifier, x, y ],
      x: x,
      y: y,
      shift: self.gpm.hasShiftKey(modifier),
      meta: self.gpm.hasMetaKey(modifier),
      ctrl: self.gpm.hasCtrlKey(modifier)
    }

    self.emit(MOUSE, key)
  })

  this.gpm.on(DRAG, function (btn, modifier, x, y) {
    x--, y--

    const key = {
      name: MOUSE,
      type: 'GPM',
      action: MOUSEMOVE,
      button: self.gpm.ButtonName(btn),
      raw: [ btn, modifier, x, y ],
      x: x,
      y: y,
      shift: self.gpm.hasShiftKey(modifier),
      meta: self.gpm.hasMetaKey(modifier),
      ctrl: self.gpm.hasCtrlKey(modifier)
    }

    self.emit(MOUSE, key)
  })

  this.gpm.on(MOUSEWHEEL, function (btn, modifier, x, y, dx, dy) {
    const key = {
      name: MOUSE,
      type: 'GPM',
      action: dy > 0 ? WHEELUP : WHEELDOWN,
      button: self.gpm.ButtonName(btn),
      raw: [ btn, modifier, x, y, dx, dy ],
      x: x,
      y: y,
      shift: self.gpm.hasShiftKey(modifier),
      meta: self.gpm.hasMetaKey(modifier),
      ctrl: self.gpm.hasCtrlKey(modifier)
    }

    self.emit(MOUSE, key)
  })
}

Program.prototype.disableGpm = function () {
  if (this.gpm) {
    this.gpm.stop()
    delete this.gpm
  }
}

// All possible responses from the terminal
Program.prototype.bindResponse = function () {
  if (this._boundResponse) return
  this._boundResponse = true

  const decoder = new StringDecoder('utf8'),
        self    = this

  this.on(DATA, function (data) {
    data = decoder.write(data)
    if (!data) return
    self._bindResponse(data)
  })
}
Program.prototype._bindResponse = function (s) {
  const out = {}
  let parts

  if (Buffer.isBuffer(s)) {
    if (s[0] > 127 && s[1] === undefined) {
      s[0] -= 128
      s = '\x1b' + s.toString('utf-8')
    }
    else {
      s = s.toString('utf-8')
    }
  }

  // CSI P s c
  // Send Device Attributes (Primary DA).
  // CSI > P s c
  // Send Device Attributes (Secondary DA).
  if (parts = /^\x1b\[(\?|>)(\d*(?:;\d*)*)c/.exec(s)) {
    parts = parts[2].split(';').map(function (ch) {
      return +ch || 0
    })

    out.event = 'device-attributes'
    out.code = 'DA'

    if (parts[1] === '?') {
      out.type = 'primary-attribute'
      // VT100-style params:
      if (parts[0] === 1 && parts[2] === 2) {
        out.term = 'vt100'
        out.advancedVideo = true
      }
      else if (parts[0] === 1 && parts[2] === 0) {
        out.term = 'vt101'
      }
      else if (parts[0] === 6) {
        out.term = 'vt102'
      }
      else if (parts[0] === 60
        && parts[1] === 1 && parts[2] === 2
        && parts[3] === 6 && parts[4] === 8
        && parts[5] === 9 && parts[6] === 15) {
        out.term = 'vt220'
      }
      else {
        // VT200-style params:
        parts.forEach(function (attr) {
          switch (attr) {
            case 1:
              out.cols132 = true
              break
            case 2:
              out.printer = true
              break
            case 6:
              out.selectiveErase = true
              break
            case 8:
              out.userDefinedKeys = true
              break
            case 9:
              out.nationalReplacementCharsets = true
              break
            case 15:
              out.technicalCharacters = true
              break
            case 18:
              out.userWindows = true
              break
            case 21:
              out.horizontalScrolling = true
              break
            case 22:
              out.ansiColor = true
              break
            case 29:
              out.ansiTextLocator = true
              break
          }
        })
      }
    }
    else {
      out.type = 'secondary-attribute'
      switch (parts[0]) {
        case 0:
          out.term = 'vt100'
          break
        case 1:
          out.term = 'vt220'
          break
        case 2:
          out.term = 'vt240'
          break
        case 18:
          out.term = 'vt330'
          break
        case 19:
          out.term = 'vt340'
          break
        case 24:
          out.term = 'vt320'
          break
        case 41:
          out.term = 'vt420'
          break
        case 61:
          out.term = 'vt510'
          break
        case 64:
          out.term = 'vt520'
          break
        case 65:
          out.term = 'vt525'
          break
      }
      out.firmwareVersion = parts[1]
      out.romCartridgeRegistrationNumber = parts[2]
    }

    // LEGACY
    out.deviceAttributes = out

    this.emit(RESPONSE, out)
    this.emit('response ' + out.event, out)

    return
  }

  // CSI Ps n  Device Status Report (DSR).
  //     Ps = 5  -> Status Report.  Result (``OK'') is
  //   CSI 0 n
  // CSI ? Ps n
  //   Device Status Report (DSR, DEC-specific).
  //     Ps = 1 5  -> Report Printer status as CSI ? 1 0  n  (ready).
  //     or CSI ? 1 1  n  (not ready).
  //     Ps = 2 5  -> Report UDK status as CSI ? 2 0  n  (unlocked)
  //     or CSI ? 2 1  n  (locked).
  //     Ps = 2 6  -> Report Keyboard status as
  //   CSI ? 2 7  ;  1  ;  0  ;  0  n  (North American).
  //   The last two parameters apply to VT400 & up, and denote key-
  //   board ready and LK01 respectively.
  //     Ps = 5 3  -> Report Locator status as
  //   CSI ? 5 3  n  Locator available, if compiled-in, or
  //   CSI ? 5 0  n  No Locator, if not.
  if (parts = /^\x1b\[(\?)?(\d+)(?:;(\d+);(\d+);(\d+))?n/.exec(s)) {
    out.event = 'device-status'
    out.code = 'DSR'

    if (!parts[1] && parts[2] === '0' && !parts[3]) {
      out.type = 'device-status'
      out.status = 'OK'

      // LEGACY
      out.deviceStatus = out.status

      this.emit(RESPONSE, out)
      this.emit('response ' + out.event, out)

      return
    }

    if (parts[1] && (parts[2] === '10' || parts[2] === '11') && !parts[3]) {
      out.type = 'printer-status'
      out.status = parts[2] === '10'
        ? 'ready'
        : 'not ready'

      // LEGACY
      out.printerStatus = out.status

      this.emit(RESPONSE, out)
      this.emit('response ' + out.event, out)

      return
    }

    if (parts[1] && (parts[2] === '20' || parts[2] === '21') && !parts[3]) {
      out.type = 'udk-status'
      out.status = parts[2] === '20'
        ? 'unlocked'
        : 'locked'

      // LEGACY
      out.UDKStatus = out.status

      this.emit(RESPONSE, out)
      this.emit('response ' + out.event, out)

      return
    }

    if (parts[1]
      && parts[2] === '27'
      && parts[3] === '1'
      && parts[4] === '0'
      && parts[5] === '0') {
      out.type = 'keyboard-status'
      out.status = 'OK'

      // LEGACY
      out.keyboardStatus = out.status

      this.emit(RESPONSE, out)
      this.emit('response ' + out.event, out)

      return
    }

    if (parts[1] && (parts[2] === '53' || parts[2] === '50') && !parts[3]) {
      out.type = 'locator-status'
      out.status = parts[2] === '53'
        ? 'available'
        : 'unavailable'

      // LEGACY
      out.locator = out.status

      this.emit(RESPONSE, out)
      this.emit('response ' + out.event, out)

      return
    }

    out.type = ERROR
    out.text = 'Unhandled: ' + JSON.stringify(parts)

    // LEGACY
    out.error = out.text

    this.emit(RESPONSE, out)
    this.emit('response ' + out.event, out)

    return
  }

  // CSI Ps n  Device Status Report (DSR).
  //     Ps = 6  -> Report Cursor Position (CPR) [row;column].
  //   Result is
  //   CSI r ; c R
  // CSI ? Ps n
  //   Device Status Report (DSR, DEC-specific).
  //     Ps = 6  -> Report Cursor Position (CPR) [row;column] as CSI
  //     ? r ; c R (assumes page is zero).
  if (parts = /^\x1b\[(\?)?(\d+);(\d+)R/.exec(s)) {
    out.event = 'device-status'
    out.code = 'DSR'
    out.type = 'cursor-status'

    out.status = {
      x: +parts[3],
      y: +parts[2],
      page: !parts[1] ? undefined : 0
    }

    out.x = out.status.x
    out.y = out.status.y
    out.page = out.status.page

    // LEGACY
    out.cursor = out.status

    this.emit(RESPONSE, out)
    this.emit('response ' + out.event, out)

    return
  }

  // CSI Ps ; Ps ; Ps t
  //   Window manipulation (from dtterm, as well as extensions).
  //   These controls may be disabled using the allowWindowOps
  //   resource.  Valid values for the first (and any additional
  //   parameters) are:
  //     Ps = 1 1  -> Report xterm window state.  If the xterm window
  //     is open (non-iconified), it returns CSI 1 t .  If the xterm
  //     window is iconified, it returns CSI 2 t .
  //     Ps = 1 3  -> Report xterm window position.  Result is CSI 3
  //     ; x ; y t
  //     Ps = 1 4  -> Report xterm window in pixels.  Result is CSI
  //     4  ;  height ;  width t
  //     Ps = 1 8  -> Report the size of the text area in characters.
  //     Result is CSI  8  ;  height ;  width t
  //     Ps = 1 9  -> Report the size of the screen in characters.
  //     Result is CSI  9  ;  height ;  width t
  if (parts = /^\x1b\[(\d+)(?:;(\d+);(\d+))?t/.exec(s)) {
    out.event = 'window-manipulation'
    out.code = ''

    if ((parts[1] === '1' || parts[1] === '2') && !parts[2]) {
      out.type = 'window-state'
      out.state = parts[1] === '1'
        ? 'non-iconified'
        : 'iconified'

      // LEGACY
      out.windowState = out.state

      this.emit(RESPONSE, out)
      this.emit('response ' + out.event, out)

      return
    }

    if (parts[1] === '3' && parts[2]) {
      out.type = 'window-position'

      out.position = {
        x: +parts[2],
        y: +parts[3]
      }
      out.x = out.position.x
      out.y = out.position.y

      // LEGACY
      out.windowPosition = out.position

      this.emit(RESPONSE, out)
      this.emit('response ' + out.event, out)

      return
    }

    if (parts[1] === '4' && parts[2]) {
      out.type = 'window-size-pixels'
      out.size = {
        height: +parts[2],
        width: +parts[3]
      }
      out.height = out.size.height
      out.width = out.size.width

      // LEGACY
      out.windowSizePixels = out.size

      this.emit(RESPONSE, out)
      this.emit('response ' + out.event, out)

      return
    }

    if (parts[1] === '8' && parts[2]) {
      out.type = 'textarea-size'
      out.size = {
        height: +parts[2],
        width: +parts[3]
      }
      out.height = out.size.height
      out.width = out.size.width

      // LEGACY
      out.textAreaSizeCharacters = out.size

      this.emit(RESPONSE, out)
      this.emit('response ' + out.event, out)

      return
    }

    if (parts[1] === '9' && parts[2]) {
      out.type = 'screen-size'
      out.size = {
        height: +parts[2],
        width: +parts[3]
      }
      out.height = out.size.height
      out.width = out.size.width

      // LEGACY
      out.screenSizeCharacters = out.size

      this.emit(RESPONSE, out)
      this.emit('response ' + out.event, out)

      return
    }

    out.type = ERROR
    out.text = 'Unhandled: ' + JSON.stringify(parts)

    // LEGACY
    out.error = out.text

    this.emit(RESPONSE, out)
    this.emit('response ' + out.event, out)

    return
  }

  // rxvt-unicode does not support window manipulation
  //   Result Normal: OSC l/L 0xEF 0xBF 0xBD
  //   Result ASCII: OSC l/L 0x1c (file separator)
  //   Result UTF8->ASCII: OSC l/L 0xFD
  // Test with:
  //   echo -ne '\ePtmux;\e\e[>3t\e\\'
  //   sleep 2 && echo -ne '\ePtmux;\e\e[21t\e\\' & cat -v
  //   -
  //   echo -ne '\e[>3t'
  //   sleep 2 && echo -ne '\e[21t' & cat -v
  if (parts = /^\x1b\](l|L)([^\x07\x1b]*)$/.exec(s)) {
    parts[2] = 'rxvt'
    s = '\x1b]' + parts[1] + parts[2] + '\x1b\\'
  }

  // CSI Ps ; Ps ; Ps t
  //   Window manipulation (from dtterm, as well as extensions).
  //   These controls may be disabled using the allowWindowOps
  //   resource.  Valid values for the first (and any additional
  //   parameters) are:
  //     Ps = 2 0  -> Report xterm window's icon label.  Result is
  //     OSC  L  label ST
  //     Ps = 2 1  -> Report xterm window's title.  Result is OSC  l
  //     label ST
  if (parts = /^\x1b\](l|L)([^\x07\x1b]*)(?:\x07|\x1b\\)/.exec(s)) {
    out.event = 'window-manipulation'
    out.code = ''

    if (parts[1] === 'L') {
      out.type = 'window-icon-label'
      out.text = parts[2]

      // LEGACY
      out.windowIconLabel = out.text

      this.emit(RESPONSE, out)
      this.emit('response ' + out.event, out)

      return
    }

    if (parts[1] === 'l') {
      out.type = 'window-title'
      out.text = parts[2]

      // LEGACY
      out.windowTitle = out.text

      this.emit(RESPONSE, out)
      this.emit('response ' + out.event, out)

      return
    }

    out.type = ERROR
    out.text = 'Unhandled: ' + JSON.stringify(parts)

    // LEGACY
    out.error = out.text

    this.emit(RESPONSE, out)
    this.emit('response ' + out.event, out)

    return
  }

  // CSI Ps ' |
  //   Request Locator Position (DECRQLP).
  //     -> CSI Pe ; Pb ; Pr ; Pc ; Pp &  w
  //   Parameters are [event;button;row;column;page].
  //   Valid values for the event:
  //     Pe = 0  -> locator unavailable - no other parameters sent.
  //     Pe = 1  -> request - xterm received a DECRQLP.
  //     Pe = 2  -> left button down.
  //     Pe = 3  -> left button up.
  //     Pe = 4  -> middle button down.
  //     Pe = 5  -> middle button up.
  //     Pe = 6  -> right button down.
  //     Pe = 7  -> right button up.
  //     Pe = 8  -> M4 button down.
  //     Pe = 9  -> M4 button up.
  //     Pe = 1 0  -> locator outside filter rectangle.
  //   ``button'' parameter is a bitmask indicating which buttons are
  //     pressed:
  //     Pb = 0  <- no buttons down.
  //     Pb & 1  <- right button down.
  //     Pb & 2  <- middle button down.
  //     Pb & 4  <- left button down.
  //     Pb & 8  <- M4 button down.
  //   ``row'' and ``column'' parameters are the coordinates of the
  //     locator position in the xterm window, encoded as ASCII deci-
  //     mal.
  //   The ``page'' parameter is not used by xterm, and will be omit-
  //   ted.
  // NOTE:
  // This is already implemented in the _bindMouse
  // method, but it might make more sense here.
  // The xterm mouse documentation says there is a
  // `<` prefix, the DECRQLP says there is no prefix.
  if (parts = /^\x1b\[(\d+(?:;\d+){4})&w/.exec(s)) {
    parts = parts[1].split(';').map(function (ch) {
      return +ch
    })

    out.event = 'locator-position'
    out.code = 'DECRQLP'

    switch (parts[0]) {
      case 0:
        out.status = 'locator-unavailable'
        break
      case 1:
        out.status = 'request'
        break
      case 2:
        out.status = 'left-button-down'
        break
      case 3:
        out.status = 'left-button-up'
        break
      case 4:
        out.status = 'middle-button-down'
        break
      case 5:
        out.status = 'middle-button-up'
        break
      case 6:
        out.status = 'right-button-down'
        break
      case 7:
        out.status = 'right-button-up'
        break
      case 8:
        out.status = 'm4-button-down'
        break
      case 9:
        out.status = 'm4-button-up'
        break
      case 10:
        out.status = 'locator-outside'
        break
    }

    out.mask = parts[1]
    out.row = parts[2]
    out.col = parts[3]
    out.page = parts[4]

    // LEGACY
    out.locatorPosition = out

    this.emit(RESPONSE, out)
    this.emit('response ' + out.event, out)

    return
  }

  // OSC Ps ; Pt BEL
  // OSC Ps ; Pt ST
  // Set Text Parameters
  if (parts = /^\x1b\](\d+);([^\x07\x1b]+)(?:\x07|\x1b\\)/.exec(s)) {
    out.event = 'text-params'
    out.code = 'Set Text Parameters'
    out.ps = +s[1]
    out.pt = s[2]
    this.emit(RESPONSE, out)
    this.emit('response ' + out.event, out)
  }
}
Program.prototype.response = function (name, text, callback, noBypass) {
  const self = this

  if (arguments.length === 2) {
    callback = text
    text = name
    name = null
  }

  if (!callback) {
    callback = function () { }
  }

  this.bindResponse()

  name = name ? 'response ' + name : RESPONSE

  let onresponse

  this.once(name, onresponse = function (event) {
    if (timeout) clearTimeout(timeout)
    if (event.type === ERROR) {
      return callback(new Error(event.event + ': ' + event.text))
    }
    return callback(null, event)
  })

  var timeout = setTimeout(function () {
    self.removeListener(name, onresponse)
    return callback(new Error('Timeout.'))
  }, 2000)

  return noBypass
    ? this._write(text)
    : this._twrite(text)
}

Program.prototype._owrite =
  Program.prototype.write = function (text) {
    if (!this.output.writable) return
    return this.output.write(text)
  }
Program.prototype._buffer = function (text) {
  if (this._exiting) {
    this.flush()
    this._owrite(text)
    return
  }

  if (this._buf) {
    this._buf += text
    return
  }

  this._buf = text

  nextTick(this._flush)

  return true
}
Program.prototype.flush = function () {
  if (!this._buf) return
  this._owrite(this._buf)
  this._buf = ''
}
Program.prototype._write = function (text) {
  if (this.ret) return text
  if (this.useBuffer) {
    return this._buffer(text)
  }
  return this._owrite(text)
}
Program.prototype._twrite = function (data) {
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
      timer = setInterval(function () {
        if (self.output.bytesWritten > 0 || ++iterations === 50) {
          clearInterval(timer)
          self.flush()
          self._owrite(data)
        }
      }, 100)
      return true
    }

    // NOTE: Flushing the buffer is required in some cases.
    // The DCS code must be at the start of the output.
    this.flush()

    // Write out raw now that the buffer is flushed.
    return this._owrite(data)
  }

  return this._write(data)
}

Program.prototype.echo =
  Program.prototype.print = function (text, attr) {
    return attr
      ? this._write(this.text(text, attr))
      : this._write(text)
  }

Program.prototype._ncoords = function () {
  if (this.x < 0) this.x = 0
  else if (this.x >= this.cols) this.x = this.cols - 1
  if (this.y < 0) this.y = 0
  else if (this.y >= this.rows) this.y = this.rows - 1
}

Program.prototype.setx = function (x) { return this.cursorCharAbsolute(x) }

Program.prototype.sety = function (y) {
  return this.linePosAbsolute(y)
}
Program.prototype.move = function (x, y) {
  return this.cursorPos(y, x)
}
Program.prototype.omove = function (x, y) {
  if (!this.zero) {
    x = (x || 1) - 1
    y = (y || 1) - 1
  }
  else {
    x = x || 0
    y = y || 0
  }
  if (y === this.y && x === this.x) {
    return
  }
  if (y === this.y) {
    if (x > this.x) {
      this.cuf(x - this.x)
    }
    else if (x < this.x) {
      this.cub(this.x - x)
    }
  }
  else if (x === this.x) {
    if (y > this.y) {
      this.cud(y - this.y)
    }
    else if (y < this.y) {
      this.cuu(this.y - y)
    }
  }
  else {
    if (!this.zero) x++, y++
    this.cup(y, x)
  }
}
Program.prototype.rsetx = function (x) {
  // return this.HPositionRelative(x);
  if (!x) return
  return x > 0
    ? this.forward(x)
    : this.back(-x)
}
Program.prototype.rsety = function (y) {
  // return this.VPositionRelative(y);
  if (!y) return
  return y > 0
    ? this.up(y)
    : this.down(-y)
}
Program.prototype.rmove = function (x, y) {
  this.rsetx(x)
  this.rsety(y)
}
Program.prototype.simpleInsert = function (ch, i, attr) {
  return this._write(this.repeat(ch, i), attr)
}
Program.prototype.repeat = function (ch, i) {
  if (!i || i < 0) i = 0
  return Array(i + 1).join(ch)
}


// Specific to iTerm2, but I think it's really cool.
// Example:
//  if (!screen.copyToClipboard(text)) {
//    execClipboardProgram(text);
//   }
Program.prototype.copyToClipboard = function (text) {
  if (this.isiTerm2) {
    this._twrite('\x1b]50;CopyToCliboard=' + text + '\x07')
    return true
  }
  return false
}

// Only XTerm and iTerm2. If you know of any others, post them.
Program.prototype.cursorShape = function (shape, blink) {
  if (this.isiTerm2) {
    switch (shape) {
      case 'block':
        if (!blink) {
          this._twrite('\x1b]50;CursorShape=0;BlinkingCursorEnabled=0\x07')
        }
        else {
          this._twrite('\x1b]50;CursorShape=0;BlinkingCursorEnabled=1\x07')
        }
        break
      case 'underline':
        if (!blink) {
          // this._twrite('\x1b]50;CursorShape=n;BlinkingCursorEnabled=0\x07');
        }
        else {
          // this._twrite('\x1b]50;CursorShape=n;BlinkingCursorEnabled=1\x07');
        }
        break
      case 'line':
        if (!blink) {
          this._twrite('\x1b]50;CursorShape=1;BlinkingCursorEnabled=0\x07')
        }
        else {
          this._twrite('\x1b]50;CursorShape=1;BlinkingCursorEnabled=1\x07')
        }
        break
    }
    return true
  }
  else if (this.term('xterm') || this.term('screen')) {
    switch (shape) {
      case 'block':
        if (!blink) {
          this._twrite('\x1b[0 q')
        }
        else {
          this._twrite('\x1b[1 q')
        }
        break
      case 'underline':
        if (!blink) {
          this._twrite('\x1b[2 q')
        }
        else {
          this._twrite('\x1b[3 q')
        }
        break
      case 'line':
        if (!blink) {
          this._twrite('\x1b[4 q')
        }
        else {
          this._twrite('\x1b[5 q')
        }
        break
    }
    return true
  }
  return false
}

Program.prototype.cursorColor = function (color) {
  if (this.term('xterm') || this.term('rxvt') || this.term('screen')) {
    this._twrite('\x1b]12;' + color + '\x07')
    return true
  }
  return false
}

Program.prototype.cursorReset =
  Program.prototype.resetCursor = function () {
    if (this.term('xterm') || this.term('rxvt') || this.term('screen')) {
      // XXX
      // return this.resetColors();
      this._twrite('\x1b[0 q')
      this._twrite('\x1b]112\x07')
      // urxvt doesnt support OSC 112
      this._twrite('\x1b]12;white\x07')
      return true
    }
    return false
  }

Program.prototype.getTextParams = function (param, callback) {
  return this.response('text-params', '\x1b]' + param + ';?\x07', function (err, data) {
    if (err) return callback(err)
    return callback(null, data.pt)
  })
}

Program.prototype.getCursorColor = function (callback) {
  return this.getTextParams(12, callback)
}

/**
 * Normal
 */

Program.prototype.nul = function () {
  //if (this.has('pad')) return this.put.pad();
  return this._write('\x80')
}

Program.prototype.bell =
  Program.prototype.bel = function () {
    if (this.has('bel')) return this.put.bel()
    return this._write('\x07')
  }

Program.prototype.vtab = function () {
  this.y++
  this._ncoords()
  return this._write('\x0b')
}

Program.prototype.ff =
  Program.prototype.form = function () {
    if (this.has('ff')) return this.put.ff()
    return this._write('\x0c')
  }

Program.prototype.kbs =
  Program.prototype.backspace = function () {
    this.x--
    this._ncoords()
    if (this.has('kbs')) return this.put.kbs()
    return this._write('\x08')
  }

Program.prototype.ht =
  Program.prototype.tab = function () {
    this.x += 8
    this._ncoords()
    if (this.has('ht')) return this.put.ht()
    return this._write('\t')
  }

Program.prototype.shiftOut = function () {
  // if (this.has('S2')) return this.put.S2();
  return this._write('\x0e')
}

Program.prototype.shiftIn = function () {
  // if (this.has('S3')) return this.put.S3();
  return this._write('\x0f')
}

Program.prototype.cr =
  Program.prototype.return = function () {
    this.x = 0
    if (this.has('cr')) return this.put.cr()
    return this._write('\r')
  }

Program.prototype.nel =
  Program.prototype.newline =
    Program.prototype.feed = function () {
      if (this.tput && this.tput.bools.eat_newline_glitch && this.x >= this.cols) {
        return
      }
      this.x = 0
      this.y++
      this._ncoords()
      if (this.has('nel')) return this.put.nel()
      return this._write('\n')
    }

/**
 * Esc
 */

Program.prototype.ind =
  Program.prototype.index = function () {
    this.y++
    this._ncoords()
    if (this.tput) return this.put.ind()
    return this._write('\x1bD')
  }

Program.prototype.ri =
  Program.prototype.reverse =
    Program.prototype.reverseIndex = function () {
      this.y--
      this._ncoords()
      if (this.tput) return this.put.ri()
      return this._write('\x1bM')
    }

Program.prototype.nextLine = function () {
  this.y++
  this.x = 0
  this._ncoords()
  if (this.has('nel')) return this.put.nel()
  return this._write('\x1bE')
}

Program.prototype.reset = function () {
  this.x = this.y = 0
  if (this.has('rs1') || this.has('ris')) {
    return this.has('rs1')
      ? this.put.rs1()
      : this.put.ris()
  }
  return this._write('\x1bc')
}

Program.prototype.tabSet = function () {
  if (this.tput) return this.put.hts()
  return this._write('\x1bH')
}

Program.prototype.sc =
  Program.prototype.saveCursor = function (key) {
    if (key) return this.lsaveCursor(key)
    this.savedX = this.x || 0
    this.savedY = this.y || 0
    if (this.tput) return this.put.sc()
    return this._write('\x1b7')
  }

Program.prototype.rc =
  Program.prototype.restoreCursor = function (key, hide) {
    if (key) return this.lrestoreCursor(key, hide)
    this.x = this.savedX || 0
    this.y = this.savedY || 0
    if (this.tput) return this.put.rc()
    return this._write('\x1b8')
  }

Program.prototype.lsaveCursor = function (key) {
  key = key || 'local'
  this._saved = this._saved || {}
  this._saved[key] = this._saved[key] || {}
  this._saved[key].x = this.x
  this._saved[key].y = this.y
  this._saved[key].hidden = this.cursorHidden
}

Program.prototype.lrestoreCursor = function (key, hide) {
  let pos
  key = key || 'local'
  if (!this._saved || !this._saved[key]) return
  pos = this._saved[key]
  //delete this._saved[key];
  this.cup(pos.y, pos.x)
  if (hide && pos.hidden !== this.cursorHidden) {
    if (pos.hidden) {
      this.hideCursor()
    }
    else {
      this.showCursor()
    }
  }
}

Program.prototype.lineHeight = function () {
  return this._write('\x1b#')
}

Program.prototype.charset = function (val, level) {
  level = level || 0

  // See also:
  // acs_chars / acsc / ac
  // enter_alt_charset_mode / smacs / as
  // exit_alt_charset_mode / rmacs / ae
  // enter_pc_charset_mode / smpch / S2
  // exit_pc_charset_mode / rmpch / S3

  switch (level) {
    case 0:
      level = '('
      break
    case 1:
      level = ')'
      break
    case 2:
      level = '*'
      break
    case 3:
      level = '+'
      break
  }

  const name = typeof val === STR
    ? val.toLowerCase()
    : val

  switch (name) {
    case 'acs':
    case 'scld': // DEC Special Character and Line Drawing Set.
      if (this.tput) return this.put.smacs()
      val = '0'
      break
    case 'uk': // UK
      val = 'A'
      break
    case 'us': // United States (USASCII).
    case 'usascii':
    case 'ascii':
      if (this.tput) return this.put.rmacs()
      val = 'B'
      break
    case 'dutch': // Dutch
      val = '4'
      break
    case 'finnish': // Finnish
      val = 'C'
      val = '5'
      break
    case 'french': // French
      val = 'R'
      break
    case 'frenchcanadian': // FrenchCanadian
      val = 'Q'
      break
    case 'german':  // German
      val = 'K'
      break
    case 'italian': // Italian
      val = 'Y'
      break
    case 'norwegiandanish': // NorwegianDanish
      val = 'E'
      val = '6'
      break
    case 'spanish': // Spanish
      val = 'Z'
      break
    case 'swedish': // Swedish
      val = 'H'
      val = '7'
      break
    case 'swiss': // Swiss
      val = '='
      break
    case 'isolatin': // ISOLatin (actually /A)
      val = '/A'
      break
    default: // Default
      if (this.tput) return this.put.rmacs()
      val = 'B'
      break
  }

  return this._write('\x1b(' + val)
}

Program.prototype.enter_alt_charset_mode =
  Program.prototype.as =
    Program.prototype.smacs = function () {
      return this.charset('acs')
    }

Program.prototype.exit_alt_charset_mode =
  Program.prototype.ae =
    Program.prototype.rmacs = function () {
      return this.charset('ascii')
    }

Program.prototype.setG = function (val) {
  // if (this.tput) return this.put.S2();
  // if (this.tput) return this.put.S3();
  switch (val) {
    case 1:
      val = '~' // GR
      break
    case 2:
      val = 'n' // GL
      val = '}' // GR
      val = 'N' // Next Char Only
      break
    case 3:
      val = 'o' // GL
      val = '|' // GR
      val = 'O' // Next Char Only
      break
  }
  return this._write('\x1b' + val)
}

/**
 * OSC
 */

Program.prototype.setTitle = function (title) {
  this._title = title

  // if (this.term('screen')) {
  //   // Tmux pane
  //   // if (this.tmux) {
  //   //   return this._write('\x1b]2;' + title + '\x1b\\');
  //   //  }
  //   return this._write('\x1bk' + title + '\x1b\\');
  //  }

  return this._twrite('\x1b]0;' + title + '\x07')
}
Program.prototype.resetColors = function (param) {
  if (this.has('Cr')) {
    return this.put.Cr(param)
  }
  return this._twrite('\x1b]112\x07')
  //return this._twrite('\x1b]112;' + param + '\x07');
}
Program.prototype.dynamicColors = function (param) {
  if (this.has('Cs')) {
    return this.put.Cs(param)
  }
  return this._twrite('\x1b]12;' + param + '\x07')
}
Program.prototype.selData = function (a, b) {
  if (this.has('Ms')) {
    return this.put.Ms(a, b)
  }
  return this._twrite('\x1b]52;' + a + ';' + b + '\x07')
}

/**
 * CSI
 */

Program.prototype.cursorUp =
  Program.prototype.up =
    Program.prototype.cuu = function (param) {
      this.y -= param || 1
      this._ncoords()
      if (this.tput) {
        if (!this.tput.strings.parm_up_cursor) {
          return this._write(this.repeat(this.tput.cuu1(), param))
        }
        return this.put.cuu(param)
      }
      return this._write('\x1b[' + (param || '') + 'A')
    }

Program.prototype.cursorDown =
  Program.prototype.down =
    Program.prototype.cud = function (param) {
      this.y += param || 1
      this._ncoords()
      if (this.tput) {
        if (!this.tput.strings.parm_down_cursor) {
          return this._write(this.repeat(this.tput.cud1(), param))
        }
        return this.put.cud(param)
      }
      return this._write('\x1b[' + (param || '') + 'B')
    }

Program.prototype.cursorForward =
  Program.prototype.right =
    Program.prototype.forward =
      Program.prototype.cuf = function (param) {
        this.x += param || 1
        this._ncoords()
        if (this.tput) {
          if (!this.tput.strings.parm_right_cursor) {
            return this._write(this.repeat(this.tput.cuf1(), param))
          }
          return this.put.cuf(param)
        }
        return this._write('\x1b[' + (param || '') + 'C')
      }

Program.prototype.cursorBackward =
  Program.prototype.left =
    Program.prototype.back =
      Program.prototype.cub = function (param) {
        this.x -= param || 1
        this._ncoords()
        if (this.tput) {
          if (!this.tput.strings.parm_left_cursor) {
            return this._write(this.repeat(this.tput.cub1(), param))
          }
          return this.put.cub(param)
        }
        return this._write('\x1b[' + (param || '') + 'D')
      }

Program.prototype.cursorPos =
  Program.prototype.pos =
    Program.prototype.cup = function (row, col) {
      if (!this.zero) {
        row = (row || 1) - 1
        col = (col || 1) - 1
      }
      else {
        row = row || 0
        col = col || 0
      }
      this.x = col
      this.y = row
      this._ncoords()
      if (this.tput) return this.put.cup(row, col)
      return this._write('\x1b[' + (row + 1) + ';' + (col + 1) + 'H')
    }

Program.prototype.eraseInDisplay =
  Program.prototype.ed = function (param) {
    if (this.tput) {
      switch (param) {
        case 'above':
          param = 1
          break
        case 'all':
          param = 2
          break
        case 'saved':
          param = 3
          break
        case 'below':
        default:
          param = 0
          break
      }
      // extended tput.E3 = ^[[3;J
      return this.put.ed(param)
    }
    switch (param) {
      case 'above':
        return this._write('\X1b[1J')
      case 'all':
        return this._write('\x1b[2J')
      case 'saved':
        return this._write('\x1b[3J')
      case 'below':
      default:
        return this._write('\x1b[J')
    }
  }

Program.prototype.clear = function () {
  this.x = 0
  this.y = 0
  if (this.tput) return this.put.clear()
  return this._write('\x1b[H\x1b[J')
}

Program.prototype.eraseInLine =
  Program.prototype.el = function (param) {
    if (this.tput) {
      //if (this.tput.back_color_erase) ...
      switch (param) {
        case 'left':
          param = 1
          break
        case 'all':
          param = 2
          break
        case 'right':
        default:
          param = 0
          break
      }
      return this.put.el(param)
    }
    switch (param) {
      case 'left':
        return this._write('\x1b[1K')
      case 'all':
        return this._write('\x1b[2K')
      case 'right':
      default:
        return this._write('\x1b[K')
    }
  }

Program.prototype.charAttributes =
  Program.prototype.attr =
    Program.prototype.sgr = function (param, val) {
      return this._write(this._attr(param, val))
    }

Program.prototype.text = function (text, attr) {
  return this._attr(attr, true) + text + this._attr(attr, false)
}

Program.prototype.parseAttr =
  Program.prototype._attr = function (param, val) {
    const self = this
    let parts,
        color,
        m

    if (Array.isArray(param)) {
      parts = param
      param = parts[0] || 'normal'
    }
    else {
      param = param || 'normal'
      parts = param.split(/\s*[,;]\s*/)
    }

    if (parts.length > 1) {
      const used = {},
            out  = []

      parts.forEach(function (part) {
        part = self._attr(part, val).slice(2, -1)
        if (part === '') return
        if (used[part]) return
        used[part] = true
        out.push(part)
      })

      return '\x1b[' + out.join(';') + 'm'
    }

    if (param.indexOf('no ') === 0) {
      param = param.substring(3)
      val = false
    }
    else if (param.indexOf('!') === 0) {
      param = param.substring(1)
      val = false
    }

    switch (param) {
      // attributes
      case 'normal':
      case 'default':
        if (val === false) return ''
        return '\x1b[m'
      case 'bold':
        return val === false
          ? '\x1b[22m'
          : '\x1b[1m'
      case 'ul':
      case 'underline':
      case 'underlined':
        return val === false
          ? '\x1b[24m'
          : '\x1b[4m'
      case 'blink':
        return val === false
          ? '\x1b[25m'
          : '\x1b[5m'
      case 'inverse':
        return val === false
          ? '\x1b[27m'
          : '\x1b[7m'
      case 'invisible':
        return val === false
          ? '\x1b[28m'
          : '\x1b[8m'

      // 8-color foreground
      case 'black fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[30m'
      case 'red fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[31m'
      case 'green fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[32m'
      case 'yellow fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[33m'
      case 'blue fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[34m'
      case 'magenta fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[35m'
      case 'cyan fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[36m'
      case 'white fg':
      case 'light grey fg':
      case 'light gray fg':
      case 'bright grey fg':
      case 'bright gray fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[37m'
      case 'default fg':
        if (val === false) return ''
        return '\x1b[39m'

      // 8-color background
      case 'black bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[40m'
      case 'red bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[41m'
      case 'green bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[42m'
      case 'yellow bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[43m'
      case 'blue bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[44m'
      case 'magenta bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[45m'
      case 'cyan bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[46m'
      case 'white bg':
      case 'light grey bg':
      case 'light gray bg':
      case 'bright grey bg':
      case 'bright gray bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[47m'
      case 'default bg':
        if (val === false) return ''
        return '\x1b[49m'

      // 16-color foreground
      case 'light black fg':
      case 'bright black fg':
      case 'grey fg':
      case 'gray fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[90m'
      case 'light red fg':
      case 'bright red fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[91m'
      case 'light green fg':
      case 'bright green fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[92m'
      case 'light yellow fg':
      case 'bright yellow fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[93m'
      case 'light blue fg':
      case 'bright blue fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[94m'
      case 'light magenta fg':
      case 'bright magenta fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[95m'
      case 'light cyan fg':
      case 'bright cyan fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[96m'
      case 'light white fg':
      case 'bright white fg':
        return val === false
          ? '\x1b[39m'
          : '\x1b[97m'

      // 16-color background
      case 'light black bg':
      case 'bright black bg':
      case 'grey bg':
      case 'gray bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[100m'
      case 'light red bg':
      case 'bright red bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[101m'
      case 'light green bg':
      case 'bright green bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[102m'
      case 'light yellow bg':
      case 'bright yellow bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[103m'
      case 'light blue bg':
      case 'bright blue bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[104m'
      case 'light magenta bg':
      case 'bright magenta bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[105m'
      case 'light cyan bg':
      case 'bright cyan bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[106m'
      case 'light white bg':
      case 'bright white bg':
        return val === false
          ? '\x1b[49m'
          : '\x1b[107m'

      // non-16-color rxvt default fg and bg
      case 'default fg bg':
        if (val === false) return ''
        return this.term('rxvt')
          ? '\x1b[100m'
          : '\x1b[39;49m'

      default:
        // 256-color fg and bg
        if (param[0] === '#') {
          param = param.replace(/#(?:[0-9a-f]{3}){1,2}/i, colors.match)
        }

        m = /^(-?\d+) (fg|bg)$/.exec(param)
        if (m) {
          color = +m[1]

          if (val === false || color === -1) {
            return this._attr('default ' + m[2])
          }

          color = colors.reduce(color, this.tput.colors)

          if (color < 16 || (this.tput && this.tput.colors <= 16)) {
            if (m[2] === 'fg') {
              if (color < 8) {
                color += 30
              }
              else if (color < 16) {
                color -= 8
                color += 90
              }
            }
            else if (m[2] === 'bg') {
              if (color < 8) {
                color += 40
              }
              else if (color < 16) {
                color -= 8
                color += 100
              }
            }
            return '\x1b[' + color + 'm'
          }

          if (m[2] === 'fg') {
            return '\x1b[38;5;' + color + 'm'
          }

          if (m[2] === 'bg') {
            return '\x1b[48;5;' + color + 'm'
          }
        }

        if (/^[\d;]*$/.test(param)) {
          return '\x1b[' + param + 'm'
        }

        return null
    }
  }

Program.prototype.setForeground =
  Program.prototype.fg = function (color, val) {
    color = color.split(/\s*[,;]\s*/).join(' fg, ') + ' fg'
    return this.attr(color, val)
  }

Program.prototype.setBackground =
  Program.prototype.bg = function (color, val) {
    color = color.split(/\s*[,;]\s*/).join(' bg, ') + ' bg'
    return this.attr(color, val)
  }

Program.prototype.deviceStatus =
  Program.prototype.dsr = function (param, callback, dec, noBypass) {
    if (dec) {
      return this.response('device-status',
        '\x1b[?' + (param || '0') + 'n', callback, noBypass)
    }
    return this.response('device-status',
      '\x1b[' + (param || '0') + 'n', callback, noBypass)
  }

Program.prototype.getCursor = function (callback) { return this.deviceStatus(6, callback, false, true) }

Program.prototype.saveReportedCursor = function (callback) {
  const self = this
  if (this.tput.strings.user7 === '\x1b[6n' || this.term('screen')) {
    return this.getCursor(function (err, data) {
      if (data) {
        self._rx = data.status.x
        self._ry = data.status.y
      }
      if (!callback) return
      return callback(err)
    })
  }
  if (!callback) return
  return callback()
}

Program.prototype.restoreReportedCursor = function () {
  if (this._rx == null) return
  return this.cup(this._ry, this._rx)
  // return this.nel();
}

/**
 * Additions
 */

Program.prototype.insertChars =
  Program.prototype.ich = function (param) {
    this.x += param || 1
    this._ncoords()
    if (this.tput) return this.put.ich(param)
    return this._write('\x1b[' + (param || 1) + '@')
  }

Program.prototype.cursorNextLine =
  Program.prototype.cnl = function (param) {
    this.y += param || 1
    this._ncoords()
    return this._write('\x1b[' + (param || '') + 'E')
  }

Program.prototype.cursorPrecedingLine =
  Program.prototype.cpl = function (param) {
    this.y -= param || 1
    this._ncoords()
    return this._write('\x1b[' + (param || '') + 'F')
  }

Program.prototype.cursorCharAbsolute =
  Program.prototype.cha = function (param) {
    if (!this.zero) {
      param = (param || 1) - 1
    }
    else {
      param = param || 0
    }
    this.x = param
    this.y = 0
    this._ncoords()
    if (this.tput) return this.put.hpa(param)
    return this._write('\x1b[' + (param + 1) + 'G')
  }

Program.prototype.insertLines =
  Program.prototype.il = function (param) {
    if (this.tput) return this.put.il(param)
    return this._write('\x1b[' + (param || '') + 'L')
  }

Program.prototype.deleteLines =
  Program.prototype.dl = function (param) {
    if (this.tput) return this.put.dl(param)
    return this._write('\x1b[' + (param || '') + 'M')
  }

Program.prototype.deleteChars =
  Program.prototype.dch = function (param) {
    if (this.tput) return this.put.dch(param)
    return this._write('\x1b[' + (param || '') + 'P')
  }

Program.prototype.eraseChars =
  Program.prototype.ech = function (param) {
    if (this.tput) return this.put.ech(param)
    return this._write('\x1b[' + (param || '') + 'X')
  }

Program.prototype.charPosAbsolute =
  Program.prototype.hpa = function (param) {
    this.x = param || 0
    this._ncoords()
    if (this.tput) {
      return this.put.hpa.apply(this.put, arguments)
    }
    param = slice.call(arguments).join(';')
    return this._write('\x1b[' + (param || '') + '`')
  }

Program.prototype.HPositionRelative =
  Program.prototype.hpr = function (param) {
    if (this.tput) return this.cuf(param)
    this.x += param || 1
    this._ncoords()
    // Does not exist:
    // if (this.tput) return this.put.hpr(param);
    return this._write('\x1b[' + (param || '') + 'a')
  }

Program.prototype.sendDeviceAttributes =
  Program.prototype.da = function (param, callback) {
    return this.response('device-attributes',
      '\x1b[' + (param || '') + 'c', callback)
  }

Program.prototype.linePosAbsolute =
  Program.prototype.vpa = function (param) {
    this.y = param || 1
    this._ncoords()
    if (this.tput) {
      return this.put.vpa.apply(this.put, arguments)
    }
    param = slice.call(arguments).join(';')
    return this._write('\x1b[' + (param || '') + 'd')
  }

Program.prototype.VPositionRelative =
  Program.prototype.vpr = function (param) {
    if (this.tput) return this.cud(param)
    this.y += param || 1
    this._ncoords()
    // Does not exist:
    // if (this.tput) return this.put.vpr(param);
    return this._write('\x1b[' + (param || '') + 'e')
  }

Program.prototype.HVPosition =
  Program.prototype.hvp = function (row, col) {
    if (!this.zero) {
      row = (row || 1) - 1
      col = (col || 1) - 1
    }
    else {
      row = row || 0
      col = col || 0
    }
    this.y = row
    this.x = col
    this._ncoords()
    // Does not exist (?):
    // if (this.tput) return this.put.hvp(row, col);
    if (this.tput) return this.put.cup(row, col)
    return this._write('\x1b[' + (row + 1) + ';' + (col + 1) + 'f')
  }

Program.prototype.setMode =
  Program.prototype.sm = function (...args) {
    const param = args.join(';')
    return this._write('\x1b[' + (param || '') + 'h')
  }

Program.prototype.setDecPrivMode =
  Program.prototype.decset = function (...args) {
    const param = args.join(';')
    return this.setMode('?' + param)
  }

Program.prototype.dectcem =
  Program.prototype.cnorm =
    Program.prototype.cvvis =
      Program.prototype.showCursor = function () {
        this.cursorHidden = false
        // NOTE: In xterm terminfo:
        // cnorm stops blinking cursor
        // cvvis starts blinking cursor
        if (this.tput) return this.put.cnorm()
        //if (this.tput) return this.put.cvvis();
        // return this._write('\x1b[?12l\x1b[?25h'); // cursor_normal
        // return this._write('\x1b[?12;25h'); // cursor_visible
        return this.setMode('?25')
      }

Program.prototype.alternate =
  Program.prototype.alternateBuffer =
    Program.prototype.smcup = function () {
      this.isAlt = true
      if (this.tput) return this.put.smcup()
      if (this.term('vt') || this.term('linux')) return
      this.setMode('?47')
      return this.setMode('?1049')
    }

Program.prototype.resetMode =
  Program.prototype.rm = function (...args) {
    const param = args.join(';')
    return this._write('\x1b[' + (param || '') + 'l')
  }

Program.prototype.decrst = function (...args) {
  const param = args.join(';')
  return this.resetMode('?' + param)
}

Program.prototype.hideCursor =
  Program.prototype.cursor_invisible =
    Program.prototype.vi =
      Program.prototype.civis =
        Program.prototype.dectcemh = function () {
          this.cursorHidden = true
          if (this.tput) return this.put.civis()
          return this.resetMode('?25')
        }

Program.prototype.normalBuffer =
  Program.prototype.rmcup = function () {
    this.isAlt = false
    if (this.tput) return this.put.rmcup()
    this.resetMode('?47')
    return this.resetMode('?1049')
  }

Program.prototype.enableMouse = function () {
  if (process.env.BLESSED_FORCE_MODES) {
    const modes = process.env.BLESSED_FORCE_MODES.split(',')
    const options = {}
    for (let n = 0; n < modes.length; ++n) {
      const pair = modes[n].split('=')
      const v = pair[1] !== '0'
      switch (pair[0].toUpperCase()) {
        case 'SGRMOUSE':
          options.sgrMouse = v
          break
        case 'UTFMOUSE':
          options.utfMouse = v
          break
        case 'VT200MOUSE':
          options.vt200Mouse = v
          break
        case 'URXVTMOUSE':
          options.urxvtMouse = v
          break
        case 'X10MOUSE':
          options.x10Mouse = v
          break
        case 'DECMOUSE':
          options.decMouse = v
          break
        case 'PTERMMOUSE':
          options.ptermMouse = v
          break
        case 'JSBTERMMOUSE':
          options.jsbtermMouse = v
          break
        case 'VT200HILITE':
          options.vt200Hilite = v
          break
        case 'GPMMOUSE':
          options.gpmMouse = v
          break
        case 'CELLMOTION':
          options.cellMotion = v
          break
        case 'ALLMOTION':
          options.allMotion = v
          break
        case 'SENDFOCUS':
          options.sendFocus = v
          break
      }
    }
    return this.setMouse(options, true)
  }

  // NOTE:
  // Cell Motion isn't normally need for anything below here, but we'll
  // activate it for tmux (whether using it or not) in case our all-motion
  // passthrough does not work. It can't hurt.

  if (this.term('rxvt-unicode')) {
    return this.setMouse({
      urxvtMouse: true,
      cellMotion: true,
      allMotion: true
    }, true)
  }

  // rxvt does not support the X10 UTF extensions
  if (this.term('rxvt')) {
    return this.setMouse({
      vt200Mouse: true,
      x10Mouse: true,
      cellMotion: true,
      allMotion: true
    }, true)
  }

  // libvte is broken. Older versions do not support the
  // X10 UTF extension. However, later versions do support
  // SGR/URXVT.
  if (this.isVTE) {
    return this.setMouse({
      // NOTE: Could also use urxvtMouse here.
      sgrMouse: true,
      cellMotion: true,
      allMotion: true
    }, true)
  }

  if (this.term('linux')) {
    return this.setMouse({
      vt200Mouse: true,
      gpmMouse: true
    }, true)
  }

  if (this.term('xterm')
    || this.term('screen')
    || (this.tput && this.tput.strings.key_mouse)) {
    return this.setMouse({
      vt200Mouse: true,
      utfMouse: true,
      cellMotion: true,
      allMotion: true
    }, true)
  }
}

Program.prototype.disableMouse = function () {
  if (!this._currentMouse) return

  const obj = {}

  Object.keys(this._currentMouse).forEach(function (key) {
    obj[key] = false
  })

  return this.setMouse(obj, false)
}

// Set Mouse
Program.prototype.setMouse = function (opt, enable) {
  if (opt.normalMouse != null) {
    opt.vt200Mouse = opt.normalMouse
    opt.allMotion = opt.normalMouse
  }

  if (opt.hiliteTracking != null) {
    opt.vt200Hilite = opt.hiliteTracking
  }

  if (enable === true) {
    if (this._currentMouse) {
      this.setMouse(opt)
      Object.keys(opt).forEach(function (key) {
        this._currentMouse[key] = opt[key]
      }, this)
      return
    }
    this._currentMouse = opt
    this.mouseEnabled = true
  }
  else if (enable === false) {
    delete this._currentMouse
    this.mouseEnabled = false
  }

  //     Ps = 9  -> Send Mouse X & Y on button press.  See the sec-
  //     tion Mouse Tracking.
  //     Ps = 9  -> Don't send Mouse X & Y on button press.
  // x10 mouse
  if (opt.x10Mouse != null) {
    if (opt.x10Mouse) this.setMode('?9')
    else this.resetMode('?9')
  }

  //     Ps = 1 0 0 0  -> Send Mouse X & Y on button press and
  //     release.  See the section Mouse Tracking.
  //     Ps = 1 0 0 0  -> Don't send Mouse X & Y on button press and
  //     release.  See the section Mouse Tracking.
  // vt200 mouse
  if (opt.vt200Mouse != null) {
    if (opt.vt200Mouse) this.setMode('?1000')
    else this.resetMode('?1000')
  }

  //     Ps = 1 0 0 1  -> Use Hilite Mouse Tracking.
  //     Ps = 1 0 0 1  -> Don't use Hilite Mouse Tracking.
  if (opt.vt200Hilite != null) {
    if (opt.vt200Hilite) this.setMode('?1001')
    else this.resetMode('?1001')
  }

  //     Ps = 1 0 0 2  -> Use Cell Motion Mouse Tracking.
  //     Ps = 1 0 0 2  -> Don't use Cell Motion Mouse Tracking.
  // button event mouse
  if (opt.cellMotion != null) {
    if (opt.cellMotion) this.setMode('?1002')
    else this.resetMode('?1002')
  }

  //     Ps = 1 0 0 3  -> Use All Motion Mouse Tracking.
  //     Ps = 1 0 0 3  -> Don't use All Motion Mouse Tracking.
  // any event mouse
  if (opt.allMotion != null) {
    // NOTE: Latest versions of tmux seem to only support cellMotion (not
    // allMotion). We pass all motion through to the terminal.
    if (this.tmux && this.tmuxVersion >= 2) {
      if (opt.allMotion) this._twrite('\x1b[?1003h')
      else this._twrite('\x1b[?1003l')
    }
    else {
      if (opt.allMotion) this.setMode('?1003')
      else this.resetMode('?1003')
    }
  }

  //     Ps = 1 0 0 4  -> Send FocusIn/FocusOut events.
  //     Ps = 1 0 0 4  -> Don't send FocusIn/FocusOut events.
  if (opt.sendFocus != null) {
    if (opt.sendFocus) this.setMode('?1004')
    else this.resetMode('?1004')
  }

  //     Ps = 1 0 0 5  -> Enable Extended Mouse Mode.
  //     Ps = 1 0 0 5  -> Disable Extended Mouse Mode.
  if (opt.utfMouse != null) {
    if (opt.utfMouse) this.setMode('?1005')
    else this.resetMode('?1005')
  }

  // sgr mouse
  if (opt.sgrMouse != null) {
    if (opt.sgrMouse) this.setMode('?1006')
    else this.resetMode('?1006')
  }

  // urxvt mouse
  if (opt.urxvtMouse != null) {
    if (opt.urxvtMouse) this.setMode('?1015')
    else this.resetMode('?1015')
  }

  // dec mouse
  if (opt.decMouse != null) {
    if (opt.decMouse) this._write('\x1b[1;2\'z\x1b[1;3\'{')
    else this._write('\x1b[\'z')
  }

  // pterm mouse
  if (opt.ptermMouse != null) {
    if (opt.ptermMouse) this._write('\x1b[>1h\x1b[>6h\x1b[>7h\x1b[>1h\x1b[>9l')
    else this._write('\x1b[>1l\x1b[>6l\x1b[>7l\x1b[>1l\x1b[>9h')
  }

  // jsbterm mouse
  if (opt.jsbtermMouse != null) {
    // + = advanced mode
    if (opt.jsbtermMouse) this._write('\x1b[0~ZwLMRK+1Q\x1b\\')
    else this._write('\x1b[0~ZwQ\x1b\\')
  }

  // gpm mouse
  if (opt.gpmMouse != null) {
    if (opt.gpmMouse) this.enableGpm()
    else this.disableGpm()
  }
}

Program.prototype.setScrollRegion =
  Program.prototype.decstbm =
    Program.prototype.csr = function (top, bottom) {
      if (!this.zero) {
        top = (top || 1) - 1
        bottom = (bottom || this.rows) - 1
      }
      else {
        top = top || 0
        bottom = bottom || (this.rows - 1)
      }
      this.scrollTop = top
      this.scrollBottom = bottom
      this.x = 0
      this.y = 0
      this._ncoords()
      if (this.tput) return this.put.csr(top, bottom)
      return this._write('\x1b[' + (top + 1) + ';' + (bottom + 1) + 'r')
    }

Program.prototype.saveCursorA =
  Program.prototype.scA =
    Program.prototype.scosc = function () {
      this.savedX = this.x
      this.savedY = this.y
      if (this.tput) return this.put.sc()
      return this._write('\x1b[s')
    }

Program.prototype.restoreCursorA =
  Program.prototype.rcA =
    Program.prototype.scorc = function () {
      this.x = this.savedX || 0
      this.y = this.savedY || 0
      if (this.tput) return this.put.rc()
      return this._write('\x1b[u')
    }

/**
 * Lesser Used
 */

Program.prototype.cursorForwardTab =
  Program.prototype.cht = function (param) {
    this.x += 8
    this._ncoords()
    if (this.tput) return this.put.tab(param)
    return this._write('\x1b[' + (param || 1) + 'I')
  }

Program.prototype.scrollUp =
  Program.prototype.su = function (param) {
    this.y -= param || 1
    this._ncoords()
    if (this.tput) return this.put.parm_index(param)
    return this._write('\x1b[' + (param || 1) + 'S')
  }

Program.prototype.scrollDown =
  Program.prototype.sd = function (param) {
    this.y += param || 1
    this._ncoords()
    if (this.tput) return this.put.parm_rindex(param)
    return this._write('\x1b[' + (param || 1) + 'T')
  }

Program.prototype.initMouseTracking =
  Program.prototype.xthimouse = function (...args) { return this._write('\x1b[' + args.join(';') + 'T') }

Program.prototype.resetTitleModes =
  Program.prototype.xtrmtitle = function (...args) { return this._write('\x1b[>' + args.join(';') + 'T') }

Program.prototype.cursorBackwardTab =
  Program.prototype.cbt = function (param) {
    this.x -= 8
    this._ncoords()
    return this.tput ? this.put.cbt(param) : this._write('\x1b[' + (param || 1) + 'Z')
  }

Program.prototype.repeatPrecedingCharacter =
  Program.prototype.rep = function (param) {
    this.x += param || 1
    this._ncoords()
    return this.tput ? this.put.rep(param) : this._write('\x1b[' + (param || 1) + 'b')
  }

Program.prototype.tabClear =
  Program.prototype.tbc = function (param) {return this.tput ? this.put.tbc(param) : this._write('\x1b[' + (param || 0) + 'g') }

Program.prototype.mediaCopy =
  Program.prototype.mc = function (...args) { return this._write('\x1b[' + args.join(';') + 'i') }

Program.prototype.print_screen =
  Program.prototype.mc0 =
    Program.prototype.ps = function () { return this.tput ? this.put.mc0() : this.mc('0') }

Program.prototype.prtr_on =
  Program.prototype.mc5 =
    Program.prototype.po = function () { return this.tput ? this.put.mc5() : this.mc('5') }

Program.prototype.prtr_off =
  Program.prototype.mc4 =
    Program.prototype.pf = function () { return this.tput ? this.put.mc4() : this.mc('4') }

Program.prototype.prtr_non =
  Program.prototype.mc5p =
    Program.prototype.pO = function () { return this.tput ? this.put.mc5p() : this.mc('?5') }

Program.prototype.setResources =
  Program.prototype.xtmodkeys = function (...args) { return this._write('\x1b[>' + args.join(';') + 'm') }

Program.prototype.disableModifiers =
  Program.prototype.xtunmodkeys = function (param) {return this._write('\x1b[>' + (param || '') + 'n') }

Program.prototype.setPointerMode =
  Program.prototype.xtsmpointer = function (param) {return this._write('\x1b[>' + (param || '') + 'p') }

Program.prototype.decstr =
  Program.prototype.rs2 =
    Program.prototype.softReset = function () {
      //if (this.tput) return this.put.init_2string();
      //if (this.tput) return this.put.reset_2string();
      if (this.tput) return this.put.rs2()
      //return this._write('\x1b[!p');
      //return this._write('\x1b[!p\x1b[?3;4l\x1b[4l\x1b>'); // init
      return this._write('\x1b[!p\x1b[?3;4l\x1b[4l\x1b>') // reset
    }

Program.prototype.requestAnsiMode =
  Program.prototype.decrqm = function (param) {return this._write('\x1b[' + (param || '') + '$p') }

Program.prototype.requestPrivateMode =
  Program.prototype.decrqmp = function (param) {return this._write('\x1b[?' + (param || '') + '$p') }

Program.prototype.setConformanceLevel =
  Program.prototype.decscl = function (...args) { return this._write('\x1b[' + args.join(';') + '"p') }

Program.prototype.loadLEDs =
  Program.prototype.decll = function (param) {return this._write('\x1b[' + (param || '') + 'q') }

Program.prototype.setCursorStyle =
  Program.prototype.decscusr = function (param) {
    switch (param) {
      case 'blinking block':
        param = 1
        break
      case 'block':
      case 'steady block':
        param = 2
        break
      case 'blinking underline':
        param = 3
        break
      case 'underline':
      case 'steady underline':
        param = 4
        break
      case 'blinking bar':
        param = 5
        break
      case 'bar':
      case 'steady bar':
        param = 6
        break
    }
    if (param === 2 && this.has('Se')) {return this.put.Se() }
    if (this.has('Ss')) {return this.put.Ss(param) }
    return this._write('\x1b[' + (param || 1) + ' q')
  }

Program.prototype.setCharProtectionAttr =
  Program.prototype.decsca = function (param) { return this._write('\x1b[' + (param || 0) + '"q') }

Program.prototype.restorePrivateValues =
  Program.prototype.xtrestore = function (...args) { return this._write('\x1b[?' + args.join(';') + 'r') }

Program.prototype.setAttrInRectangle =
  Program.prototype.deccara = function (...args) { return this._write('\x1b[' + args.join(';') + '$r') }

Program.prototype.savePrivateValues =
  Program.prototype.xtsave = function (...args) { return this._write('\x1b[?' + args.join(';') + 's') }

Program.prototype.manipulateWindow =
  Program.prototype.xtwinops = function (...args) {
    const callback = typeof args[args.length - 1] === FUN
      ? args.pop()
      : function () { }

    return this.response('window-manipulation',
      '\x1b[' + args.join(';') + 't', callback)
  }

Program.prototype.getWindowSize = function (callback) {return this.manipulateWindow(18, callback) }

Program.prototype.reverseAttrInRectangle =
  Program.prototype.decrara = function (...args) { return this._write('\x1b[' + args.join(';') + '$t') }

Program.prototype.setTitleModeFeature =
  Program.prototype.xtsmtitle = function (...args) { return this._twrite('\x1b[>' + args.join(';') + 't') }

Program.prototype.setWarningBellVolume =
  Program.prototype.decswbv = function (param) {return this._write('\x1b[' + (param || '') + ' t') }

Program.prototype.setMarginBellVolume =
  Program.prototype.decsmbv = function (param) {return this._write('\x1b[' + (param || '') + ' u') }

Program.prototype.copyRectangle =
  Program.prototype.deccra = function (...args) { return this._write('\x1b[' + args.join(';') + '$v') }

Program.prototype.enableFilterRectangle =
  Program.prototype.decefr = function (...args) { return this._write('\x1b[' + args.join(';') + '\'w') }

Program.prototype.requestParameters =
  Program.prototype.decreqtparm = function (param) {return this._write('\x1b[' + (param || 0) + 'x') }

Program.prototype.selectChangeExtent =
  Program.prototype.decsace = function (param) {return this._write('\x1b[' + (param || 0) + 'x') }

Program.prototype.fillRectangle =
  Program.prototype.decfra = function (...args) { return this._write('\x1b[' + args.join(';') + '$x') }

Program.prototype.enableLocatorReporting =
  Program.prototype.decelr = function (...args) { return this._write('\x1b[' + args.join(';') + '\'z') }

Program.prototype.eraseRectangle =
  Program.prototype.decera = function (...args) { return this._write('\x1b[' + args.join(';') + '$z') }

Program.prototype.setLocatorEvents =
  Program.prototype.decsle = function (...args) { return this._write('\x1b[' + args.join(';') + '\'{') }

Program.prototype.selectiveEraseRectangle =
  Program.prototype.decsera = function (...args) { return this._write('\x1b[' + args.join(';') + '${') }

Program.prototype.requestLocatorPosition =
  Program.prototype.req_mouse_pos =
    Program.prototype.reqmp =
      Program.prototype.decrqlp = function (param, callback) {
        // See also:
        // get_mouse / getm / Gm
        // mouse_info / minfo / Mi
        // Correct for tput?
        if (this.has('req_mouse_pos')) {
          const code = this.tput.req_mouse_pos(param)
          return this.response('locator-position', code, callback)
        }
        return this.response('locator-position', '\x1b[' + (param || '') + '\'|', callback)
      }

Program.prototype.insertColumns =
  Program.prototype.decic = function (...args) { return this._write('\x1b[' + args.join(';') + ' }') }

Program.prototype.deleteColumns =
  Program.prototype.decdc = function (...args) { return this._write('\x1b[' + args.join(';') + ' ~') }

Program.prototype.out = function (name) {
  const args = Array.prototype.slice.call(arguments, 1)
  this.ret = true
  const out = this[name].apply(this, args)
  this.ret = false
  return out
}

Program.prototype.sigtstp = function (callback) {
  const resume = this.pause()
  process.once(SIGCONT, () => {
    resume()
    if (callback) callback()
  })
  process.kill(process.pid, SIGTSTP)
}

Program.prototype.pause = function (callback) {
  const self         = this,
        isAlt        = this.isAlt,
        mouseEnabled = this.mouseEnabled

  this.lsaveCursor('pause')
  //this.csr(0, screen.height - 1);
  if (isAlt) this.normalBuffer()
  this.showCursor()
  if (mouseEnabled) this.disableMouse()

  const write = this.output.write
  this.output.write = function () { }
  if (this.input.setRawMode) {
    this.input.setRawMode(false)
  }
  this.input.pause()

  return this._resume = function () {
    delete self._resume

    if (self.input.setRawMode) {
      self.input.setRawMode(true)
    }
    self.input.resume()
    self.output.write = write

    if (isAlt) self.alternateBuffer()
    //self.csr(0, screen.height - 1);
    if (mouseEnabled) self.enableMouse()
    self.lrestoreCursor('pause', true)

    if (callback) callback()
  }
}

Program.prototype.resume = function () { if (this._resume) return this._resume() }

/**
 * Helpers
 */
function merge(out) {
  slice.call(arguments, 1).forEach(function (obj) {
    Object.keys(obj).forEach(function (key) {
      out[key] = obj[key]
    })
  })
  return out
}

/**
 * Expose
 */

module.exports = Program
