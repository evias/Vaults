/**
 * This file is part of Vaults by re:Software S.L. shared under LGPL-3.0
 * Copyright (C) 2024-present re:Software S.L. (www.resoftware.es),
 * All rights reserved.
 *
 * @package     Vaults
 * @subpackage  API
 * @author      re:Software S.L. <devs@resoftware.es>
 * @license     LGPL-3.0
 */

import fs from 'bare-fs'

export default class Logger {
  /**
   *
   */
  logsPath = Pear.config.storage + '/logs'

  /**
   *
   */
  LEVELS = {
    'error': 0,
    'warn': 1,
    'info': 2,
    'debug': 3
  }

  /**
   *
   */
  constructor(opts) {
    this._EOL   = !!opts ? (opts.EOL ?? '\n') : '\n'
    this._label = !!opts ? opts.label : null
    this._level = !!opts ? opts.level : null

    // Uses "debug" and "quiet" to determine level
    if (!!opts && null === this._level) {
      this._level = opts.debug
        ? 'debug'
        : (opts.quiet ? 'error' : 'info')
    }

    if (! fs.existsSync(this.logsPath)) {
      fs.mkdirSync(this.logsPath)

      this.debug(`Created logs folder at ${this.logsPath}`)
    }
  }

  timestamp()
  {
    return new Date().toUTCString()
  }

  label()
  {
    if (this._label === null) return 'default'
    return this._label
  }

  level()
  {
    if (this._level === null) return 'info'
    return this._level
  }

  print(level = 'info', message, opts)
  {
    // ignoring by level
    if (undefined !== this.LEVELS[level] && this.LEVELS[level] > this.LEVELS[this.level()])
      return ;

    // prepare additional information
    const padLevel = level.toUpperCase().padStart('DEBUG'.length, ' ')
    const format = `${this.timestamp()} [${this.label()}] ${padLevel}: ${message}`

    if (opts !== undefined) {
      console.log(format, opts)
    }
    else {
      console.log(format)
    }

    // and persist to file
    fs.appendFileSync(this.logsPath + '/vfunctions.log', format + this._EOL)

    // if it's an error or warning, also save to error.log
    if (this.LEVELS[level] <= this.LEVELS['warn']) {
      fs.appendFileSync(this.logsPath + '/error.log', format + this._EOL)
    }
  }

  log(message, opts)
  {
    this.print('info', message, opts)
  }

  info(message, opts)
  {
    this.print('info', message, opts)
  }

  warn(message, opts)
  {
    this.print('warn', message, opts)
  }

  error(message, opts)
  {
    this.print('error', message, opts)
  }

  debug(message, opts)
  {
    this.print('debug', message, opts)
  }
}
