#!/usr/bin/env node

const
  blessed = require('../'),
  argv = process.argv.slice(2),
  cmd = argv.shift()

const tput = blessed.tput({
  terminal: process.env.TERM,
  termcap: !!process.env.USE_TERMCAP,
  extended: true
})

if (tput[cmd]) process.stdout.write(tput[cmd].apply(tput, argv))
