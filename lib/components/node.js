/**
 * node.js - base abstract node for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */
const { ADOPT, ATTACH, DESTROY, DETACH, REMOVE, REPARENT } = require('@pres/enum-events'),
      { EventEmitter }                                     = require('../events'),
      NodeCollection                                       = require('../global/nodeCollection'),
      ScreenCollection                                     = require('../global/screenCollection'),
      { last }                                             = require('@vect/vector-index'),
      { AEU }                                              = require('@texting/enum-chars')


/**
 * Node
 */
function Node(options = {}, lazy) {
  // const Screen = require('./screen')
  if (!(this instanceof Node)) { return new Node(options) }
  EventEmitter.call(this)
  if (lazy) return this
  this.setup(options)
}

Node.prototype.__proto__ = EventEmitter.prototype

Node.prototype.type = 'node'

Node.prototype.setup = function (options) {
  this.options = options
  this.name = options.name
  this.sku = options.sku
  this.configScreen(options)
  const sup = options.sup || options.parent,
        sub = options.sub || options.children
  this.sup = sup ?? null
  this.sub = []

  this.$ = this._ = this.data = {}
  this.uid = NodeCollection.uid++
  this.index = this.index ?? -1
  if (this.type !== 'screen') this.detached = true

  this.sup?.append(this)
  sub?.forEach(el => this.append(el))

  if (ScreenCollection.journal) console.log('>> [new node]', this.codename, '∈',
    this.parent?.codename ?? this.screen?.codename ?? AEU)
}

Object.defineProperties(Node.prototype, {
  parent: {
    get() { return this.sup },
    set(value) { this.sup = value }
  },
  children: {
    get() { return this.sub },
    set(value) { this.sub = value }
  },
  codename: {
    get() {
      const _name = `${this.sku ?? this.type ?? ''}.${this.uid ?? 'NA'}`
      return this.name ? `${this.name}(${_name})` : _name
    }
  }
})

Node.prototype.configScreen = function (options) {
  this.screen = this.screen || options.screen
  if (!this.screen) {
    const self = this
    if (this.type === 'screen') this.screen = this
    else if (ScreenCollection.total === 1) this.screen = ScreenCollection.global
    else if (options.parent) {
      this.screen = options.parent
      while (this.screen?.type !== 'screen') this.screen = this.screen.parent
    }
    else if (ScreenCollection.total) {
      // This _should_ work in most cases as long as the element is appended
      // synchronously after the screen's creation. Throw error if not.
      this.screen = last(ScreenCollection.instances)
      process.nextTick(() => {
        if (!self.parent) throw new Error(
          'Element (' + self.type + ') was not appended synchronously after the screen\'s creation. ' +
          'Please set a \'parent\' or \'screen\' option in the element\'s constructor ' +
          'if you are going to use multiple screens and append the element later.'
        )
      })
    }
    else {
      throw new Error('No active screen.')
    }
  }
}


Node.prototype.insert = function (element, i) {
  const self = this

  if (element.screen && element.screen !== this.screen) throw new Error('Cannot switch a node\'s screen.')

  element.detach()
  element.parent = this
  element.screen = this.screen

  i === 0 ? this.sub.unshift(element) : i === this.sub.length ? this.sub.push(element) : this.sub.splice(i, 0, element)

  element.emit(REPARENT, this)
  this.emit(ADOPT, element);

  (function emit(el) {
    const n = el.detached !== self.detached
    el.detached = self.detached
    if (n) el.emit(ATTACH)
    el.sub.forEach(emit)
  })(element)

  if (!this.screen.focused) this.screen.focused = element
}

Node.prototype.prepend = function (element) { this.insert(element, 0) }

Node.prototype.append = function (element) { this.insert(element, this.sub.length) }

Node.prototype.insertBefore = function (element, other) {
  const i = this.sub.indexOf(other)
  if (~i) this.insert(element, i)
}

Node.prototype.insertAfter = function (element, other) {
  const i = this.sub.indexOf(other)
  if (~i) this.insert(element, i + 1)
}

Node.prototype.remove = function (element) {
  if (element.parent !== this) return

  let i = this.sub.indexOf(element)
  if (!~i) return

  element.clearPos()

  element.parent = null

  this.sub.splice(i, 1)

  i = this.screen.clickable.indexOf(element)
  if (~i) this.screen.clickable.splice(i, 1)
  i = this.screen.keyable.indexOf(element)
  if (~i) this.screen.keyable.splice(i, 1)

  element.emit(REPARENT, null)
  this.emit(REMOVE, element);

  (function emit(el) {
    const n = el.detached !== true
    el.detached = true
    if (n) el.emit(DETACH)
    el.sub.forEach(emit)
  })(element)

  if (this.screen.focused === element) this.screen.rewindFocus()
}

Node.prototype.detach = function () { if (this.parent) this.parent.remove(this) }

Node.prototype.free = () => {

}

Node.prototype.destroy = function () {
  this.detach()
  this.forDescendants(el => {
    el.free()
    el.destroyed = true
    el.emit(DESTROY)
  }, this)
}

Node.prototype.forDescendants = function (iter, s) {
  if (s) iter(this)
  this.sub.forEach(function emit(el) {
    iter(el)
    el.sub.forEach(emit)
  })
}

Node.prototype.forAncestors = function (iter, s) {
  let el = this
  if (s) iter(this)
  while (el = el.parent) {
    iter(el)
  }
}

Node.prototype.collectDescendants = function (s) {
  const out = []
  this.forDescendants(el => {
    out.push(el)
  }, s)
  return out
}

Node.prototype.collectAncestors = function (s) {
  const out = []
  this.forAncestors(el => out.push(el), s)
  return out
}

Node.prototype.emitDescendants = function () {
  const args = Array.prototype.slice(arguments)
  let iter

  if (typeof args[args.length - 1] === 'function') { iter = args.pop() }

  return this.forDescendants(el => {
    if (iter) iter(el)
    el.emit.apply(el, args)
  }, true)
}

Node.prototype.emitAncestors = function () {
  const args = Array.prototype.slice(arguments)
  let iter

  if (typeof args[args.length - 1] === 'function') iter = args.pop()

  return this.forAncestors(el => {
    if (iter) iter(el)
    el.emit.apply(el, args)
  }, true)
}

Node.prototype.hasDescendant = function (target) {
  return (function find(el) {
    for (let i = 0; i < el.sub.length; i++) {
      if (el.sub[i] === target) return true
      if (find(el.sub[i]) === true) return true
    }
    return false
  })(this)
}

Node.prototype.hasAncestor = function (target) {
  let el = this
  while ((el = el.parent)) {
    if (el === target) return true
  }
  return false
}

Node.prototype.get = function (name, value) {
  if (this.data.hasOwnProperty(name)) { return this.data[name] }
  return value
}

Node.prototype.set = function (name, value) { return this.data[name] = value }

/**
 * Expose
 */

module.exports = Node
