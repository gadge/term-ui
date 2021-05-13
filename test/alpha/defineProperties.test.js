function Point(x) {
  this.x = x
  this.y = y
  this.program = { title: null, terminal: null }
}

Point.prototype.setTerminal = function (terminal) {this.program.terminal = terminal}

Object.defineProperties(Point.prototype, {
  title: {
    get() { return this.program.title },
    set(title) { return this.program.title = title }
  },
  terminal: {
    get() { return this.program.terminal },
    set(terminal) { return this.setTerminal(terminal), this.program.terminal }
  }
})