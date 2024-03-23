/**
 * This file is part of Vaults by re:Software S.L. shared under LGPL-3.0
 * Copyright (C) 2024-present re:Software S.L. (www.resoftware.es),
 * All rights reserved.
 *
 * @package     Vaults
 * @subpackage  Runtime
 * @author      re:Software S.L. <devs@resoftware.es>
 * @license     LGPL-3.0
 */
import b4a from 'b4a'
import Peer from './api/peer'
import process from 'bare-process'
import config from '../config/default.json'

const networkKey = Pear.config.args.length
  ? b4a.from(Pear.config.args[0], 'hex')
  : b4a.from(config.networkKey ?? '', 'hex');

(
  async () => {
    // initialize the peer and join the swarm
    // discovery channel to replicate on connection
    const peer = new Peer(networkKey)
    await peer.ready()

    // Helper function to gracefully exit process
    const teardown = () => {
      peer._teardown()
      process.exit()
    }

    // SIGINT is supported on all platforms
    process.on('SIGINT', () => teardown())

    // SIGTERM is *not* supported on Windows
    process.on('SIGTERM', () => teardown())
  }
)();
