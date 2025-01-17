var blessed = require('../../lib/blessed')
  , screen;

screen = blessed.screen({
  dump: __dirname + '/logs/widget.logs',
  title: 'widget test',
  resizeTimeout: 300,
  dockBorders: true,
  cursor: {
    artificial: true,
    shape: 'line',
    blink: true,
    color: null
  },
  debug: true,
  warnings: true
});

screen.debugLog.parseTags = true;
var logs = '';
require('./tail')(__dirname + '/logs/widget.logs').on('line', function(line) {
  // if (!screen.debugLog.hidden) return;
  logs += line + '\n';
});
screen.debugLog.on('show', function() {
  if (logs) {
    screen.debug(logs);
    logs = '';
  }
  screen.render();
});

screen.on('event', function(event, el) {
  var type = (el && el.type) || Object.prototype.toString.call(el).slice(8, -1);
  screen.program.log('emit("%s", {%s})', event, type);
});

screen.append(blessed.text({
  top: 0,
  left: 2,
  width: '100%',
  //bg: 'blue',
  content: '{green-fg}Welcome{/green-fg} to my {red-fg,ul}program{/red-fg,ul}',
  style: {
    bg: '#0000ff'
  },
  // bg: blessed.colors.match('#0000ff'),
  tags: true,
  align: 'center'
}));

screen.append(blessed.line({
  orientation: 'horizontal',
  top: 1,
  left: 0,
  right: 0
}));

var list = blessed.list({
  align: 'center',
  mouse: true,
  label: ' My list ',
  border: 'line',
  style: {
    fg: 'blue',
    bg: 'default',
    border: {
      fg: 'default',
      bg: 'default'
    },
    selected: {
      bg: 'green'
    }
  },
  width: '50%',
  height: '50%',
  top: 'center',
  left: 'center',
  tags: true,
  invertSelected: false,
  items: [
    'one',
    '{red-fg}two{/red-fg}',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten'
  ],
  scrollbar: {
    ch: ' ',
    track: {
      bg: 'yellow'
    },
    style: {
      inverse: true
    }
  }
});

screen.append(list);
list.select(0);

list.items.forEach(function(item) {
  item.setHover(item.getText().trim());
});

var item = list.items[1];
list.removeItem(list.items[1]);
list.insertItem(1, item.getContent());

list.on('keypress', function(ch, key) {
  if (key.name === 'up' || key.name === 'k') {
    list.up();
    screen.render();
    return;
  } else if (key.name === 'down' || key.name === 'j') {
    list.down();
    screen.render();
    return;
  }
});

list.on('select', function(item, select) {
  list.setLabel(' ' + item.getText() + ' ');
  screen.render();
});

var progress = blessed.progressbar({
  border: 'line',
  style: {
    fg: 'blue',
    bg: 'default',
    bar: {
      bg: 'default',
      fg: 'blue'
    },
    border: {
      fg: 'default',
      bg: 'default'
    }
  },
  ch: ':',
  //orientation: 'vertical',
  //height: 10,
  //width: 3,
  width: '50%',
  height: 3,
  right: 0,
  bottom: 0,
  filled: 50
});

screen.append(progress);

var lorem = 'Lorem ipsum \x1b[41mdolor sit amet, \nconsectetur adipisicing elit, \x1b[43msed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';

var lorem = require('fs').readFileSync(__dirname + '/git.diff', 'utf8');

//lorem = lorem.replace(/\x1b[^m]*m/g, '');

var stext = blessed.scrollabletext({
  //padding: 1,
  mouse: true,
  content: lorem,
  border: 'line',
  style: {
    fg: 'blue',
    bg: 'black',
    border: {
      fg: 'default',
      bg: 'default'
    }
  },
  width: '50%',
  //height: 4,
  height: 6,
  left: 0,
  bottom: 0,
  scrollbar: {
    inverse: true
  }
});

setTimeout(function() {
  stext.width = 0;
  screen.render();
  setTimeout(function() {
    stext.width = '50%';
    screen.render();
    setTimeout(function() {
      stext.height = 0;
      screen.render();
      setTimeout(function() {
        stext.height = 6;
        screen.render();
        setTimeout(function() {
          stext.width = 0;
          stext.height = 0;
          screen.render();
          setTimeout(function() {
            stext.width = '50%';
            stext.height = 6;
            screen.render();
          }, 1000);
        }, 1000);
      }, 1000);
    }, 1000);
  }, 1000);
}, 1000);

screen.append(stext);
stext.on('keypress', function(ch, key) {
  if (key.name === 'up' || key.name === 'k') {
    stext.scroll(-1);
    screen.render();
    return;
  } else if (key.name === 'down' || key.name === 'j') {
    stext.scroll(1);
    screen.render();
    return;
  }
});

screen.on('element focus', function(cur, old) {
  if (old.border) old.style.border.fg = 'default';
  if (cur.border) cur.style.border.fg = 'green';
  screen.render();
});

var input = blessed.textbox({
  label: ' My Input ',
  content: '',
  border: 'line',
  style: {
    fg: 'blue',
    bg: 'default',
    bar: {
      bg: 'default',
      fg: 'blue'
    },
    border: {
      fg: 'default',
      bg: 'default'
    }
  },
  width: '30%',
  height: 3,
  right: 0,
  top: 2,
  keys: true,
  vi: true,
  mouse: true
  //inputOnFocus: true
});

input.on('submit', function(value) {
  if (value) screen.children[0].setContent(value);
  input.clearInput();
  screen.render();
});

screen.append(input);

var button = blessed.button({
  //content: 'Click me!',
  content: 'Click\nme!',
  shrink: true,
  mouse: true,
  border: 'line',
  style: {
    fg: 'red',
    bg: 'blue'
  },
  //height: 3,
  right: 4,
  //bottom: 6,
  bottom: 2,
  padding: 0
});

button.on('press', function() {
  button.setContent('Clicked!');
  screen.render();
});

screen.append(button);

screen.key('S-s', function() {
  var rand = function(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  };
  var xi = rand(0, screen.cols - (stext.width - stext.iwidth));
  var xl = xi + stext.width - stext.iwidth;
  var yi = rand(0, screen.rows - (stext.height - stext.iheight));
  var yl = yi + stext.height - stext.iheight;
  stext.wrap = false;
  stext.setContent(screen.screenshot(xi, xl, yi, xl));
  screen.render();
});

screen.on('keypress', function(ch, key) {
  if (key.name === 'tab') {
    return key.shift
      ? screen.focusPrevious()
      : screen.focusNext();
  }
  if (key.name === 'escape' || key.name === 'q') {
    return process.exit(0);
  }
});

screen.key('C-z', function() {
  screen.sigtstp();
});

list.focus();

screen.render();

setInterval(function() {
  progress.toggle();
  screen.render();
}, 2000);

(function fill() {
  if (progress.filled === 100) {
    progress.reset();
  }
  progress.progress(2);
  progress.atop -= 2;
  screen.render();
  setTimeout(fill, 300);
})();
