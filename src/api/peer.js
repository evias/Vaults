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
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import Logger from './log'
import config from '../../config/default.json'

export default class Peer {
  /**
   *
   */
  dataPath = Pear.config.storage + '/data'

  /**
   *
   */
  constructor() {
    // Assign log level from config
    const logLevel = config.debug
      ? 'debug'
      : (config.quiet ? 'error' : 'info')

    // Initializes a logger instance
    this.logger = new Logger({
      label: `Peer`,
      level: logLevel
    })

    this.logger.info(`Starting Vaults v${config.version}`)

    // Initializes peer functionality
    this.swarm = new Hyperswarm()
    this.store = new Corestore(this.dataPath)

    // booted = built/configured/prepared
    this.booted  = true
    this.bootedAt = new Date().valueOf()

    // started = ready
    this.started = false
    this.startedAt = null

    this.appstore = null
    this.peers = new Map()
    this.publicKeys = new Map()
  }

  /**
   *
   */
  async _teardown() {
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
    this.appstore = this.store.get({ name: 'vaults', valueEncoding: 'json' })
    await this.appstore.ready()

    // Save the created pair of keys
    this.publicKeys.set('vaults', this.appstore.key)
    this.publicKeys.set('discovery', this.appstore.discoveryKey)

    // Useful log of runtime results
    this.logger.info(`Vaults main core key => ${b4a.toString(this.appstore.key, 'hex')}`)
    this.logger.info(`Vaults discovery key => ${b4a.toString(this.appstore.discoveryKey, 'hex')}`)

    // Join the swarm using the discovery key
    this.swarm.join(this.appstore.discoveryKey)

    // Handle networking, messages and replication
    this.swarm.on('connection', (conn) => {
      // Print connection information
      const publicKey = b4a.toString(conn.remotePublicKey, 'hex')
      this.logger.info(`* Connection established with ${publicKey}`)

      // Stores the socket in memory
      this.peers.set(publicKey, conn)

      // Handle incoming messages (operations)
      conn.on('data', data => this.logger.debug(`Intercepted call data: ${JSON.stringify(data)}`))

      // Handle disconnection and errors from client
      conn.once('close', () => {
        this.logger.info(`! Connection closed with ${publicKey}`)
        this.peers.delete(publicKey)
      })

      conn.on('error', e => this.logger.error(`Connection error: ${e}`))

      // Replicate every loaded core (discovery)
      this.appstore.replicate(conn)
    })

    // Bootstrap done, node is now ready
    this.started = true
    this.startedAt = new Date().valueOf()

    this.logger.info(`Your node public key => ${b4a.toString(this.swarm.keyPair.publicKey, 'hex')}`)
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
}
