var blessed = require('../../lib/blessed');

var screen = blessed.screen({
  dump: __dirname + '/logs/play.logs',
  smartCSR: true,
  warnings: true
});

var frames = require(__dirname + '/frames.json');

var timer = setInterval(function() {
  if (!frames.length) {
    clearInterval(timer);
    return screen.destroy();
  }
  process.stdout.write(frames.shift());
}, 100);
