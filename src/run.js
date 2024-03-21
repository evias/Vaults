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

import Peer from './api/peer'
import process from 'bare-process'

(
  async () => {
    // initialize the peer and join the swarm
    // discovery channel to replicate on connection
    const peer = new Peer()
    await peer.ready()

    process.on('SIGINT', () => peer._teardown())
  }
)();
