/**
 * helpers.js - helpers for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */


/**
 * Modules
 */
const fs = require('fs')
const unicode = require('./unicode')

/**
 * Helpers
 * @property {Function} slice
 */
const helpers = exports

/**
 * @function
 * @type {Function}
 */
helpers.slice = Function.prototype.call.bind(Array.prototype.slice)
helpers.nextTick = global.setImmediate || process.nextTick.bind(process)
helpers.merge = function (a, b) {
  Object.keys(b).forEach(function (key) {
    a[key] = b[key]
  })
  return a
}

helpers.asort = function (obj) {
  return obj.sort(function (a, b) {
    a = a.name.toLowerCase()
    b = b.name.toLowerCase()

    if (a[0] === '.' && b[0] === '.') {
      a = a[1]
      b = b[1]
    }
    else {
      a = a[0]
      b = b[0]
    }

    return a > b ? 1 : (a < b ? -1 : 0)
  })
}

helpers.hsort = function (obj) {
  return obj.sort(function (a, b) {
    return b.index - a.index
  })
}

helpers.findFile = function (start, target) {
  return (function read(dir) {
    let files, file, stat, out

    if (dir === '/dev' || dir === '/sys' || 
       dir === '/proc' || dir === '/net') {
      return null
    }

    try {
      files = fs.readdirSync(dir)
    } catch (e) {
      files = []
    }

    for (let i = 0; i < files.length; i++) {
      file = files[i]

      if (file === target) {
        return (dir === '/' ? '' : dir) + '/' + file
      }

      try {
        stat = fs.lstatSync((dir === '/' ? '' : dir) + '/' + file)
      } catch (e) {
        stat = null
      }

      if (stat && stat.isDirectory() && !stat.isSymbolicLink()) {
        out = read((dir === '/' ? '' : dir) + '/' + file)
        if (out) return out
      }
    }

    return null
  })(start)
}

// Escape text for tag-enabled elements.
helpers.escape = function (text) {
  return text.replace(/[{}]/g, function (ch) {
    return ch === '{' ? '{open}' : '{close}'
  })
}

helpers.parseTags = function (text, screen) {
  return helpers.Element.prototype._parseTags.call(
    { parseTags: true, screen: screen || helpers.Screen.global }, text)
}

helpers.generateTags = function (style, text) {
  let open  = '',
      close = ''

  Object.keys(style || {}).forEach(function (key) {
    let val = style[key]
    if (typeof val === 'string') {
      val = val.replace(/^light(?!-)/, 'light-')
      val = val.replace(/^bright(?!-)/, 'bright-')
      open = '{' + val + '-' + key + '}' + open
      close += '{/' + val + '-' + key + '}'
    }
    else {
      if (val === true) {
        open = '{' + key + '}' + open
        close += '{/' + key + '}'
      }
    }
  })

  if (text != null) {
    return open + text + close
  }

  return {
    open: open,
    close: close
  }
}

helpers.attrToBinary = function (style, element) {
  return helpers.Element.prototype.sattr.call(element || {}, style)
}

helpers.stripTags = function (text) {
  if (!text) return ''
  return text
    .replace(/{(\/?)([\w\-,;!#]*)}/g, '')
    .replace(/\x1b\[[\d;]*m/g, '')
}

helpers.cleanTags = function (text) {
  return helpers.stripTags(text).trim()
}

helpers.dropUnicode = function (text) {
  if (!text) return ''
  return text
    .replace(unicode.chars.all, '??')
    .replace(unicode.chars.combining, '')
    .replace(unicode.chars.surrogate, '?')
}

helpers.__defineGetter__('Screen', function () {
  if (!helpers._screen) {
    helpers._screen = require('./components/screen')
  }
  return helpers._screen
})

helpers.__defineGetter__('Element', function () {
  if (!helpers._element) {
    helpers._element = require('./components/element')
  }
  return helpers._element
})
