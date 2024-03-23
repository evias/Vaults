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

/* global Pear */
import b4a from 'b4a'
import Logger from './log'
import config from '../../config/default.json'

const MSG_HYPERCORE_ALPHA = '0001010f6879706572636f72652f616c706861' // in utf8: "\x00hypercore/alpha"
const MSG_END_OF_MESSAGE = '0000010500070000' // in utf8: "\x00\x00\x00\x00"

export default class Consumer {
  /**
   *
   */
  constructor() {
    // Initializes a logger instance
    this.logger = new Logger({
      label: `Consumer`,
      debug: config.debug,
      quiet: config.quiet,
    })
  }

  /**
   *
   */
  handle(initiator, data)
  {
    // Create human-readable peer identifier
    const peerIdentifier = initiator.subarray(0, 8)

    // Find first space after initial null byte,
    // to determine the "message prefix", if any
    const nullByte = '\x00'
    const spacesAt = data.indexOf(' ', nullByte.length)

    // Tries to extract the message prefix
    const messageId = data.subarray(0, spacesAt)
    const message = data.subarray(spacesAt + 1)

    // Identify the message prefix if possible
    if (messageId.equals(b4a.from(MSG_HYPERCORE_ALPHA, 'hex'))) {
      // e.g.: hypercore/alpha [TOPIC_32_BYTES_HEX][CONN_DATA]
      const topicHex = message.subarray(0, 32).toString('hex')
      const publicKey = peerIdentifier.toString('hex')
      this.logger.debug(
        `* Received handshake from ${publicKey} for topic ${topicHex}`
      )
      return ;
    }
    else if (messageId.equals(b4a.from(MSG_END_OF_MESSAGE, 'hex'))) {
      // "EOM" / end of message / empty bytes intercepted
      // Nothing to do
      return ;
    }

    //XXX else implement Protomux

    // Unknown data / Not yet implemented
    this.logger.debug(`? Received unknown data sequence: ${b4a.toString(data, 'hex')}`)
  }
}
