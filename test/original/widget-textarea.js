var blessed = require('../../lib/blessed')
  , screen;

screen = blessed.screen({
  dump: __dirname + '/logs/textarea.logs',
  fullUnicode: true,
  warnings: true
});

var box = blessed.textarea({
  parent: screen,
  // Possibly support:
  // align: 'center',
  style: {
    bg: 'blue'
  },
  height: 'half',
  width: 'half',
  top: 'center',
  left: 'center',
  tags: true
});

screen.render();

screen.key('q', function() {
  screen.destroy();
});

screen.key('i', function() {
  box.readInput(function() {});
});

screen.key('e', function() {
  box.readEditor(function() {});
});
