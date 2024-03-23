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

// external dependencies
/* global Pear */
import b4a from 'b4a'
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'

// internal dependencies
import Logger from './log'
import Consumer from './consumer'

// configuration imports
import config from '../../config/default.json'

export default class Peer {
  /**
   *
   */
  dataPath = Pear.config.storage + '/data'

  /**
   *
   */
  constructor(networkKey) {
    // Initializes a logger instance
    this.logger = new Logger({
      label: `Peer`,
      debug: config.debug,
      quiet: config.quiet,
    })

    this.logger.info(`Starting Vaults v${config.version}`)

    // Initializes peer functionality
    this.swarm = new Hyperswarm()
    this.store = new Corestore(this.dataPath)
    this.consumer = new Consumer()

    // Initialize a session by name (writable)
    this.storeConf = { name: 'vaults', valueEncoding: 'json' }

    // If we have a network key, initialize by key
    if (networkKey !== null && networkKey.length === 32) {
      this.storeConf = { key: networkKey, valueEncoding: 'json' }
    }

    // Booted means built/configured/prepared
    this.booted  = true
    this.bootedAt = new Date().valueOf()

    // Started means ready
    this.started = false
    this.startedAt = null

    // Empty properties
    this.vaults = null
    this.peers = new Map()
    this.publicKeys = new Map()
  }

  /**
   *
   */
  async _teardown() {
    this.destroying = true

    // Destroy the Hyperswarm instance
    this.swarm.destroy()
  }

  /**
   *
   */
  async ready()
  {
    // Unannounce the public key before exiting to avoid DHT pollution
    Pear.teardown(() => this._teardown())

    // Starts the main store
    this.vaults = this.store.get(this.storeConf)
    await this.vaults.ready()

    // Save the created pair of keys
    this.publicKeys.set('self', this.swarm.keyPair.publicKey)
    this.publicKeys.set('vaults', this.vaults.key)
    this.publicKeys.set('discovery', this.vaults.discoveryKey)

    // Useful log of runtime results
    this.logger.info(`Vaults main core key => ${b4a.toString(this.publicKeys.get('vaults'), 'hex')}`)
    this.logger.info(`Vaults discovery key => ${b4a.toString(this.publicKeys.get('discovery'), 'hex')}`)
    this.logger.info(`Peer node public key => ${b4a.toString(this.publicKeys.get('self'), 'hex')}`)

    // Join the swarm using the discovery key
    this.swarm.join(this.vaults.discoveryKey)

    // Handle networking, messages and replication
    this.swarm.on('connection', (conn/* : NoiseSecretStream */) => {
      // Print connection information
      const publicKey = b4a.toString(conn.remotePublicKey, 'hex')
      this.logger.info(`* Connection established with ${publicKey}`)

      // Stores the socket in memory
      this.peers.set(publicKey, conn)

      // Handle incoming messages (operations)
      conn.on('data', data => this.consume(conn, data))

      // Handle disconnection and errors from client
      conn.once('close', () => {
        if (this.destroying) {
          return;
        }

        this.logger.info(`! Connection closed with ${publicKey}`)
        this.peers.delete(publicKey)
      })

      conn.on('error', e => {
        if (! /Error: connection reset by peer/.test(e))
          this.logger.error(`Connection error: ${e}`)
      })

      // Replicate every loaded core (discovery)
      this.vaults.replicate(conn)
    })

    // Talk to neighbours and update hypercore
    await this.swarm.flush()
    await this.vaults.update()

    // Bootstrap done, node is now ready
    this.started = true
    this.startedAt = new Date().valueOf()

    this.logger.debug(`Vaults application startup took ${this.startedAt - this.bootedAt}ms`)
  }

  /**
   *
   */
  async broadcast(data)
  {
    // Contains PeerInfo objects
    const peers = [...this.swarm.connections]
    const startedAt = new Date().valueOf()
    this.logger.debug(`Broadcasting data to ${peers.length} connected peers.`)

    // Broadcast the data peer by peer
    for (const peer of peers) {
      peer.write(data)
    }

    // Debug timing information
    const endedAt = new Date().valueOf()
    this.logger.debug(`Broadcasting to all peers took ${endedAt - startedAt}ms`)
  }

  /**
   *
   */
  consume(socket, data)
  {
    // Nothing to do with empty dataset
    if (data === undefined || !data.length) {
      return ;
    }

    // Determine the initiator using the socket
    const initiatorPubKey = socket.remotePublicKey

    // No need to handle data if we are the initiator
    if (initiatorPubKey.equals(this.publicKeys.get('self'))) {
      return ;
    }

    // Use consumer to interpret the message(s)
    return this.consumer.handle(initiatorPubKey, data)
  }
}
