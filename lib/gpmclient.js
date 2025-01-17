/**
 * gpmclient.js - support the gpm mouse protocol
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */
const {
        BTNDOWN, BTNUP, CLICK, CONNECT, DATA, DBLCLICK, DRAG, ERROR, MOUSEWHEEL, MOVE
      } = require('@pres/enum-events')
const net = require('net')
const fs = require('fs')
const EventEmitter = require('events').EventEmitter

const GPM_USE_MAGIC = false

const GPM_MOVE = 1,
      GPM_DRAG = 2,
      GPM_DOWN = 4,
      GPM_UP   = 8

const GPM_DOUBLE = 32,
      GPM_MFLAG  = 128

const GPM_REQ_NOPASTE = 3,
      GPM_HARD        = 256

const GPM_MAGIC = 0x47706D4C
const GPM_SOCKET = '/dev/gpmctl'

// typedef struct Gpm_Connect {
//   unsigned short eventMask, defaultMask;
//   unsigned short minMod, maxMod;
//   int pid;
//   int vc;
// } Gpm_Connect;

function send_config(socket, Gpm_Connect, callback) {
  let buffer
  if (GPM_USE_MAGIC) {
    buffer = new Buffer(20)
    buffer.writeUInt32LE(GPM_MAGIC, 0)
    buffer.writeUInt16LE(Gpm_Connect.eventMask, 4)
    buffer.writeUInt16LE(Gpm_Connect.defaultMask, 6)
    buffer.writeUInt16LE(Gpm_Connect.minMod, 8)
    buffer.writeUInt16LE(Gpm_Connect.maxMod, 10)
    buffer.writeInt16LE(process.pid, 12)
    buffer.writeInt16LE(Gpm_Connect.vc, 16)
  }
  else {
    buffer = new Buffer(16)
    buffer.writeUInt16LE(Gpm_Connect.eventMask, 0)
    buffer.writeUInt16LE(Gpm_Connect.defaultMask, 2)
    buffer.writeUInt16LE(Gpm_Connect.minMod, 4)
    buffer.writeUInt16LE(Gpm_Connect.maxMod, 6)
    buffer.writeInt16LE(Gpm_Connect.pid, 8)
    buffer.writeInt16LE(Gpm_Connect.vc, 12)
  }
  socket.write(buffer, function () {
    if (callback) callback()
  })
}

// typedef struct Gpm_Event {
//   unsigned char buttons, modifiers;  // try to be a multiple of 4
//   unsigned short vc;
//   short dx, dy, x, y; // displacement x,y for this event, and absolute x,y
//   enum Gpm_Etype type;
//   // clicks e.g. double click are determined by time-based processing
//   int clicks;
//   enum Gpm_Margin margin;
//   // wdx/y: displacement of wheels in this event. Absolute values are not
//   // required, because wheel movement is typically used for scrolling
//   // or selecting fields, not for cursor positioning. The application
//   // can determine when the end of file or form is reached, and not
//   // go any further.
//   // A single mouse will use wdy, "vertical scroll" wheel.
//   short wdx, wdy;
// } Gpm_Event;

function parseEvent(raw) {
  const event = {}
  event.buttons = raw[0]
  event.modifiers = raw[1]
  event.vc = raw.readUInt16LE(2)
  event.dx = raw.readInt16LE(4)
  event.dy = raw.readInt16LE(6)
  event.x = raw.readInt16LE(8)
  event.y = raw.readInt16LE(10)
  event.type = raw.readInt16LE(12)
  event.clicks = raw.readInt32LE(16)
  event.margin = raw.readInt32LE(20)
  event.wdx = raw.readInt16LE(24)
  event.wdy = raw.readInt16LE(26)
  return event
}

function GpmClient(options = {}) {
  if (!(this instanceof GpmClient)) return new GpmClient(options)

  EventEmitter.call(this)

  const pid = process.pid

  // check tty for /dev/tty[n]
  let path
  try {
    path = fs.readlinkSync('/proc/' + pid + '/fd/0')
  } catch (e) {

  }
  let tty = /tty[0-9]+$/.exec(path)
  if (tty === null) {
    // TODO: should  also check for /dev/input/..
  }

  let vc
  if (tty) {
    tty = tty[0]
    vc = +/[0-9]+$/.exec(tty)[0]
  }

  const self = this

  if (tty) {
    fs.stat(GPM_SOCKET, function (err, stat) {
      if (err || !stat.isSocket()) {
        return
      }

      const conf = {
        eventMask: 0xffff,
        defaultMask: GPM_MOVE | GPM_HARD,
        minMod: 0,
        maxMod: 0xffff,
        pid: pid,
        vc: vc
      }

      const gpm = net.createConnection(GPM_SOCKET)
      this.gpm = gpm

      gpm.on(CONNECT, function () {
        send_config(gpm, conf, function () {
          conf.pid = 0
          conf.vc = GPM_REQ_NOPASTE
          //send_config(gpm, conf);
        })
      })

      gpm.on(DATA, function (packet) {
        const evnt = parseEvent(packet)
        switch (evnt.type & 15) {
          case GPM_MOVE:
            if (evnt.dx || evnt.dy) {
              self.emit(MOVE, evnt.buttons, evnt.modifiers, evnt.x, evnt.y)
            }
            if (evnt.wdx || evnt.wdy) {
              self.emit(MOUSEWHEEL,
                evnt.buttons, evnt.modifiers,
                evnt.x, evnt.y, evnt.wdx, evnt.wdy)
            }
            break
          case GPM_DRAG:
            if (evnt.dx || evnt.dy) {
              self.emit(DRAG, evnt.buttons, evnt.modifiers, evnt.x, evnt.y)
            }
            if (evnt.wdx || evnt.wdy) {
              self.emit(MOUSEWHEEL,
                evnt.buttons, evnt.modifiers,
                evnt.x, evnt.y, evnt.wdx, evnt.wdy)
            }
            break
          case GPM_DOWN:
            self.emit(BTNDOWN, evnt.buttons, evnt.modifiers, evnt.x, evnt.y)
            if (evnt.type & GPM_DOUBLE) {
              self.emit(DBLCLICK, evnt.buttons, evnt.modifiers, evnt.x, evnt.y)
            }
            break
          case GPM_UP:
            self.emit(BTNUP, evnt.buttons, evnt.modifiers, evnt.x, evnt.y)
            if (!(evnt.type & GPM_MFLAG)) {
              self.emit(CLICK, evnt.buttons, evnt.modifiers, evnt.x, evnt.y)
            }
            break
        }
      })

      gpm.on(ERROR, function () {
        self.stop()
      })
    })
  }
}

GpmClient.prototype.__proto__ = EventEmitter.prototype

GpmClient.prototype.stop = function () {
  if (this.gpm) {
    this.gpm.end()
  }
  delete this.gpm
}

GpmClient.prototype.ButtonName = function (btn) {
  if (btn & 4) return 'left'
  if (btn & 2) return 'middle'
  if (btn & 1) return 'right'
  return ''
}

GpmClient.prototype.hasShiftKey = function (mod) {
  return (mod & 1) ? true : false
}

GpmClient.prototype.hasCtrlKey = function (mod) {
  return (mod & 4) ? true : false
}

GpmClient.prototype.hasMetaKey = function (mod) {
  return (mod & 8) ? true : false
}

module.exports = GpmClient
