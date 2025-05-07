import WebSocket from 'ws';
import crypto from 'crypto';
import { ENV } from '../../../config/env.js';

/**
 * SimpleHiveP2P - A lightweight P2P networking service for Apollo HIVE mind
 * Enables agents to share knowledge and collaborate on queries
 */
class SimpleHiveP2P {
  constructor() {
    this.peers = new Map(); // peerId -> WebSocket connection
    this.server = null;
    this.clientId = crypto.randomBytes(8).toString('hex'); // Simple ID
    this.knowledgeManager = null;
    this.port = ENV.HIVE_PORT;
    this.timeout = ENV.HIVE_TIMEOUT;
    this.shareCategories = ENV.HIVE_SHARE_CATEGORIES;
    this.pendingQueries = new Map(); // queryId -> { resolve, reject, timer }
    
    // Discovery and matchmaking properties
    this.discoveryServer = null;        // Connection to discovery server if used
    this.discoveryServerUrl = ENV.HIVE_DISCOVERY_SERVER || null;
    this.inMatchmakingQueue = false;    // Whether we're currently in queue
    this.peerCategories = {};           // Track peer expertise categories
    this.expertiseProfile = {};         // Our expertise profile
    this.useAutoDiscovery = ENV.HIVE_AUTO_DISCOVERY === 'true';
  }
  
  /**
   * Initialize the HIVE P2P service
   * @param {Object} knowledgeManager - The knowledge manager instance
   * @returns {String} - The client ID
   */
  async initialize(knowledgeManager) {
    this.knowledgeManager = knowledgeManager;
    
    try {
      // Check if we should skip server creation (because one is already running)
      const skipServerCreation = ENV.HIVE_SKIP_SERVER_CREATION === true;
      
      if (!skipServerCreation) {
        // Start WebSocket server only if not skipping server creation
        this.server = new WebSocket.Server({ port: this.port });
        
        this.server.on('connection', (ws) => {
          // Handle new peer connection
          ws.on('message', (message) => {
            try {
              const data = JSON.parse(message);
              this.handleMessage(data, ws);
            } catch (error) {
              console.error('Error processing HIVE message:', error);
            }
          });
          
          ws.on('close', () => {
            if (ws.peerId) {
              this.peers.delete(ws.peerId);
              console.log(`HIVE peer disconnected: ${ws.peerId}`);
            }
          });
        });
        
        console.log(`HIVE server started on port ${this.port} with client ID: ${this.clientId}`);
      } else {
        console.log(`Skipping HIVE server creation - connecting as client only with ID: ${this.clientId}`);
      }
      
      // Build expertise profile for matchmaking
      await this.buildExpertiseProfile();
      
      // Connect to explicitly defined known peers
      const explicitPeersConnected = await this.connectToKnownPeers();
      
      // If auto-discovery is enabled and we have no explicit connections, try discovery
      if (this.useAutoDiscovery && explicitPeersConnected === 0) {
        await this.connectToDiscoveryServer();
      }
      
      return this.clientId;
    } catch (error) {
      console.error('Failed to initialize HIVE service:', error);
      throw error;
    }
  }
  
  /**
   * Build expertise profile based on knowledge manager data
   */
  async buildExpertiseProfile() {
    try {
      // Get entity counts by category
      this.expertiseProfile = {
        categories: this.knowledgeManager.entityCountByCategory,
        clientId: this.clientId,
        port: this.port,
        shareCategories: this.shareCategories
      };
      
      console.log('Built expertise profile for matchmaking:', 
        Object.entries(this.expertiseProfile.categories)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      );
    } catch (error) {
      console.error('Error building expertise profile:', error);
      this.expertiseProfile = {
        categories: {},
        clientId: this.clientId,
        port: this.port,
        shareCategories: this.shareCategories
      };
    }
  }
  
  /**
   * Connect to discovery server for automatic peer matching
   */
  async connectToDiscoveryServer() {
    // If no discovery server URL is provided, we can't proceed
    if (!this.discoveryServerUrl) {
      console.log('No discovery server URL configured. Auto-discovery disabled.');
      return false;
    }
    
    try {
      console.log(`Connecting to HIVE discovery server: ${this.discoveryServerUrl}`);
      
      this.discoveryServer = new WebSocket(this.discoveryServerUrl);
      
      this.discoveryServer.on('open', () => {
        console.log('Connected to HIVE discovery server');
        // The server will send a welcome message, and we'll respond in handleDiscoveryMessage
      });
      
      this.discoveryServer.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          await this.handleDiscoveryMessage(data);
        } catch (error) {
          console.error('Error handling discovery server message:', error);
        }
      });
      
      this.discoveryServer.on('close', () => {
        console.log('Disconnected from HIVE discovery server');
        this.discoveryServer = null;
        
        // Try to reconnect after a delay
        setTimeout(() => {
          if (this.useAutoDiscovery) {
            this.connectToDiscoveryServer();
          }
        }, 30000); // 30 second reconnection delay
      });
      
      this.discoveryServer.on('error', (error) => {
        console.error('Discovery server connection error:', error.message);
        this.discoveryServer = null;
      });
      
      return true;
    } catch (error) {
      console.error('Failed to connect to discovery server:', error);
      return false;
    }
  }
  
  /**
   * Handle messages from the discovery server
   */
  async handleDiscoveryMessage(data) {
    console.log('Received message from discovery server:', data.type);
    
    switch (data.type) {
      case 'welcome':
        // Handle the welcome message and peerId assignment
        console.log(`Received welcome from discovery server with assigned peerId: ${data.peerId}`);
        
        // Send expertise profile now that we're connected
        console.log('Sending expertise profile to discovery server');
        this.discoveryServer.send(JSON.stringify({
          type: 'register_expertise',
          clientId: this.clientId,
          categories: this.expertiseProfile.categories
        }));
        
        // Join matchmaking queue if auto-discovery is enabled
        if (this.useAutoDiscovery) {
          this.joinMatchmakingQueue();
        }
        break;
        
      case 'peer-match':
        // We've been matched with a peer
        console.log(`Matched with HIVE peer: ${data.peerId}`);
        
        if (data.connectInfo && data.connectInfo.host && data.connectInfo.port) {
          const peerUrl = `ws://${data.connectInfo.host}:${data.connectInfo.port}`;
          await this.connectToPeer(peerUrl);
        }
        break;
        
      case 'matchmaking_status':
        // Update on our queue status
        console.log(`HIVE matchmaking queue status: ${data.status}`);
        this.inMatchmakingQueue = data.inQueue === true;
        break;
        
      case 'peer_suggestions':
        // Discovery server has suggested peers
        console.log(`Received ${data.peers.length} peer suggestions from discovery server`);
        
        // Connect to suggested peers
        for (const peer of data.peers) {
          if (peer.connectInfo && peer.connectInfo.host && peer.connectInfo.port) {
            const peerUrl = `ws://${peer.connectInfo.host}:${peer.connectInfo.port}`;
            console.log(`Connecting to suggested peer: ${peerUrl}`);
            await this.connectToPeer(peerUrl);
          }
        }
        break;
        
      case 'peer-suggestion':
        // Discovery server is suggesting a peer we might want to connect to
        console.log(`Received peer suggestion: ${data.peerId}`);
        
        if (data.connectInfo && data.connectInfo.host && data.connectInfo.port) {
          const peerUrl = `ws://${data.connectInfo.host}:${data.connectInfo.port}`;
          
          // If compatibility score is high enough, connect automatically
          if (data.compatibilityScore >= 0.7) {
            console.log(`Auto-connecting to suggested peer (compatibility: ${data.compatibilityScore})`);
            await this.connectToPeer(peerUrl);
          } else {
            console.log(`Peer suggestion available (compatibility: ${data.compatibilityScore})`);
            // In a real UI, you might ask the user if they want to connect
          }
        }
        break;
        
      case 'registered':
        // Successfully registered with discovery server
        console.log('Successfully registered with HIVE discovery server');
        break;
        
      default:
        console.log(`Unhandled discovery server message type: ${data.type}`);
        break;
    }
  }
  
  /**
   * Join the matchmaking queue on the discovery server
   */
  joinMatchmakingQueue() {
    if (!this.discoveryServer || this.inMatchmakingQueue) {
      return false;
    }
    
    try {
      console.log('Joining HIVE matchmaking queue...');
      
      this.discoveryServer.send(JSON.stringify({
        type: 'join_matchmaking',
        clientId: this.clientId,
        expertiseProfile: this.expertiseProfile,
        preferences: {
          // Preferences for matchmaking - use server's expected key names
          preferRandom: ENV.HIVE_PREFER_RANDOM === 'true',
          preferComplementary: ENV.HIVE_PREFER_COMPLEMENTARY === 'true',
          maxPeers: parseInt(ENV.HIVE_MAX_PEERS || '3', 10)
        }
      }));
      
      this.inMatchmakingQueue = true;
      return true;
    } catch (error) {
      console.error('Error joining matchmaking queue:', error);
      return false;
    }
  }
  
  /**
   * Leave the matchmaking queue
   */
  leaveMatchmakingQueue() {
    if (!this.discoveryServer || !this.inMatchmakingQueue) {
      return false;
    }
    
    try {
      console.log('Leaving HIVE matchmaking queue');
      
      this.discoveryServer.send(JSON.stringify({
        type: 'leave_matchmaking',
        clientId: this.clientId
      }));
      
      this.inMatchmakingQueue = false;
      return true;
    } catch (error) {
      console.error('Error leaving matchmaking queue:', error);
      return false;
    }
  }
  
  /**
   * Handle incoming messages from peers
   * @param {Object} data - The message data
   * @param {WebSocket} ws - The WebSocket connection
   */
  handleMessage(data, ws) {
    switch (data.type) {
      case 'handshake':
        // Register the peer
        this.peers.set(data.clientId, ws);
        ws.peerId = data.clientId;
        console.log(`HIVE peer connected: ${data.clientId}`);
        
        // Store expertise profile if provided
        if (data.expertiseProfile) {
          this.peerCategories[data.clientId] = data.expertiseProfile.categories || {};
        }
        
        // Respond with acknowledgment
        ws.send(JSON.stringify({
          type: 'handshake-ack',
          clientId: this.clientId,
          expertiseProfile: this.expertiseProfile
        }));
        break;
        
      case 'handshake-ack':
        // Handshake acknowledged
        console.log(`HIVE connection established with peer: ${data.clientId}`);
        
        // Store expertise profile if provided
        if (data.expertiseProfile) {
          this.peerCategories[data.clientId] = data.expertiseProfile.categories || {};
        }
        break;
        
      case 'knowledge-request':
        // Handle request for knowledge
        this.handleKnowledgeRequest(data, ws);
        break;
        
      case 'knowledge-response':
        // Handle knowledge response
        this.handleKnowledgeResponse(data);
        break;
        
      case 'query':
        // Handle collaborative query
        this.handleQuery(data, ws);
        break;
        
      case 'query-response':
        // Handle response to a query
        this.handleQueryResponse(data);
        break;
        
      case 'new-entity':
        // Handle new entity shared by peer
        this.handleNewEntity(data);
        break;
    }
  }
  
  /**
   * Connect to all known peers defined in configuration
   * @returns {Number} - Number of peers successfully connected
   */
  async connectToKnownPeers() {
    const knownPeers = ENV.HIVE_KNOWN_PEERS || [];
    let connectedCount = 0;
    let attemptedCount = 0;
    
    console.log(`Attempting to connect to ${knownPeers.length} known HIVE peer(s)...`);
    
    for (const peerAddress of knownPeers) {
      if (!peerAddress || peerAddress.trim() === '') continue;
      
      attemptedCount++;
      console.log(`Connecting to peer: ${peerAddress}`);
      
      try {
        const success = await this.connectToPeer(peerAddress);
        if (success) {
          connectedCount++;
          console.log(`Successfully connected to peer: ${peerAddress}`);
        } else {
          console.log(`Failed to establish connection with peer: ${peerAddress}`);
        }
      } catch (error) {
        console.warn(`Failed to connect to HIVE peer ${peerAddress}:`, error.message);
      }
    }
    
    if (attemptedCount > 0) {
      console.log(`Connected to ${connectedCount}/${attemptedCount} known HIVE peers`);
    } else {
      console.log(`No known HIVE peers to connect to`);
    }
    
    return connectedCount;
  }
  
  /**
   * Connect to a specific peer
   * @param {String} address - The WebSocket address of the peer
   * @returns {Promise<Boolean>} - Whether connection was successful
   */
  async connectToPeer(address) {
    // Don't connect to invalid addresses
    if (!address || address.trim() === '') {
      return false;
    }
    
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(address);
        
        ws.on('open', () => {
          // Send handshake
          ws.send(JSON.stringify({
            type: 'handshake',
            clientId: this.clientId,
            expertiseProfile: this.expertiseProfile
          }));
          
          resolve(true);
        });
        
        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message);
            this.handleMessage(data, ws);
          } catch (error) {
            console.error('Error processing HIVE message:', error);
          }
        });
        
        ws.on('error', (error) => {
          console.warn(`Error connecting to HIVE peer ${address}:`, error.message);
          resolve(false);
        });
        
        // Set connection timeout
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.terminate();
            resolve(false);
          }
        }, 5000);
      } catch (error) {
        console.error(`Failed to connect to HIVE peer ${address}:`, error);
        resolve(false);
      }
    });
  }
  
  /**
   * Find the best peer for a specific query or knowledge category
   * @param {String} category - The knowledge category
   * @returns {String|null} - The best peer ID or null if none found
   */
  findBestPeerForCategory(category) {
    // If no peers, return null
    if (this.peers.size === 0) {
      return null;
    }
    
    let bestPeerId = null;
    let bestScore = -1;
    
    // Check each peer's expertise
    for (const [peerId, _] of this.peers.entries()) {
      const peerCategories = this.peerCategories[peerId] || {};
      const categoryCount = peerCategories[category] || 0;
      
      // Simple scoring - just use the count for now
      const score = categoryCount;
      
      if (score > bestScore) {
        bestScore = score;
        bestPeerId = peerId;
      }
    }
    
    return bestPeerId;
  }
  
  /**
   * Select a random peer
   * @returns {String|null} - Random peer ID or null if none available
   */
  getRandomPeer() {
    const peerIds = Array.from(this.peers.keys());
    if (peerIds.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * peerIds.length);
    return peerIds[randomIndex];
  }
  
  /**
   * Handle incoming knowledge request
   * @param {Object} data - The request data
   * @param {WebSocket} ws - The WebSocket connection
   */
  async handleKnowledgeRequest(data, ws) {
    const { categories, query } = data;
    
    try {
      // Only share knowledge in allowed categories
      const allowedCategories = categories.filter(
        cat => this.shareCategories.includes(cat)
      );
      
      if (allowedCategories.length === 0) {
        ws.send(JSON.stringify({
          type: 'knowledge-response',
          requestId: data.requestId,
          entities: []
        }));
        return;
      }
      
      // Get relevant knowledge
      const knowledge = await this.knowledgeManager.getKnowledgeByCategories(
        allowedCategories, 
        query
      );
      
      // Send response
      ws.send(JSON.stringify({
        type: 'knowledge-response',
        requestId: data.requestId,
        entities: knowledge
      }));
    } catch (error) {
      console.error('Error handling knowledge request:', error);
      ws.send(JSON.stringify({
        type: 'knowledge-response',
        requestId: data.requestId,
        error: 'Failed to retrieve knowledge',
        entities: []
      }));
    }
  }
  
  /**
   * Handle knowledge response from a peer
   * @param {Object} data - The response data
   */
  async handleKnowledgeResponse(data) {
    const { requestId, entities, error } = data;
    
    const pendingRequest = this.pendingQueries.get(requestId);
    if (!pendingRequest) return; // No pending request with this ID
    
    const { resolve, timer } = pendingRequest;
    
    // Clear the timeout timer
    clearTimeout(timer);
    
    // Remove from pending queries
    this.pendingQueries.delete(requestId);
    
    if (error) {
      console.warn(`HIVE peer reported error for request ${requestId}:`, error);
    }
    
    // Resolve the promise with the received entities
    resolve(entities || []);
  }
  
  /**
   * Handle collaborative query from a peer
   * @param {Object} data - The query data
   * @param {WebSocket} ws - The WebSocket connection
   */
  async handleQuery(data, ws) {
    const { queryId, content, categories } = data;
    
    try {
      // Check if we can help with this query
      const allowedCategories = categories.filter(
        cat => this.shareCategories.includes(cat)
      );
      
      if (allowedCategories.length === 0) {
        ws.send(JSON.stringify({
          type: 'query-response',
          queryId,
          result: null,
          error: 'No shared categories'
        }));
        return;
      }
      
      // Process the query with our knowledge
      const result = await this.knowledgeManager.processQuery(content, allowedCategories);
      
      // Send response
      ws.send(JSON.stringify({
        type: 'query-response',
        queryId,
        result
      }));
    } catch (error) {
      console.error('Error handling collaborative query:', error);
      ws.send(JSON.stringify({
        type: 'query-response',
        queryId,
        result: null,
        error: 'Failed to process query'
      }));
    }
  }
  
  /**
   * Handle query response from a peer
   * @param {Object} data - The response data
   */
  async handleQueryResponse(data) {
    const { queryId, result, error } = data;
    
    const pendingQuery = this.pendingQueries.get(queryId);
    if (!pendingQuery) return; // No pending query with this ID
    
    const { resolve, timer } = pendingQuery;
    
    // Clear the timeout timer
    clearTimeout(timer);
    
    // Remove from pending queries
    this.pendingQueries.delete(queryId);
    
    if (error) {
      console.warn(`HIVE peer reported error for query ${queryId}:`, error);
      resolve(null);
      return;
    }
    
    // Resolve the promise with the query result
    resolve(result);
  }
  
  /**
   * Handle new entity shared by a peer
   * @param {Object} data - The entity data
   */
  async handleNewEntity(data) {
    const { entity, sourceId } = data;
    
    try {
      if (!entity || !entity.type || !entity.value) {
        console.warn('Received invalid entity from HIVE peer:', sourceId);
        return;
      }
      
      // Check if entity category is allowed to be shared
      if (!this.isEntityTypeAllowed(entity.type)) {
        return;
      }
      
      // Process and store the entity
      await this.knowledgeManager.processSharedEntity(entity, sourceId);
    } catch (error) {
      console.error('Error handling shared entity:', error);
    }
  }
  
  /**
   * Check if entity type is allowed to be shared
   * @param {String} entityType - The entity type
   * @returns {Boolean} - Whether the entity type is allowed
   */
  isEntityTypeAllowed(entityType) {
    // Map entity types to share categories
    const typeToCategory = {
      'token': 'tokens',
      'wallet': 'wallets',
      'project': 'projects',
      'exchange': 'exchanges',
      'market_event': 'market_events',
      'concept': 'concepts'
    };
    
    const category = typeToCategory[entityType] || entityType;
    return this.shareCategories.includes(category);
  }
  
  /**
   * Request knowledge from HIVE peers
   * @param {Array} categories - Categories of knowledge to request
   * @param {String} query - Optional query to filter relevant knowledge
   * @returns {Promise<Array>} - Array of entities from peers
   */
  async requestKnowledge(categories = [], query = '') {
    if (this.peers.size === 0) {
      // If no peers and auto-discovery is enabled, try to find peers
      if (this.useAutoDiscovery && this.discoveryServer) {
        await this.joinMatchmakingQueue();
        // Wait a bit to see if we get matched
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // If still no peers, return empty
        if (this.peers.size === 0) {
          return [];
        }
      } else {
        return []; // No connected peers
      }
    }
    
    // Filter to only allowed categories
    const allowedCategories = categories.filter(
      cat => this.shareCategories.includes(cat)
    );
    
    if (allowedCategories.length === 0) {
      return []; // No allowed categories
    }
    
    // Generate request ID
    const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Create message
    const message = JSON.stringify({
      type: 'knowledge-request',
      requestId,
      categories: allowedCategories,
      query
    });
    
    // If categories have specific expertise requirements, target the best peers
    let targetPeers = new Map();
    
    // For each category, find the best peer if possible
    for (const category of allowedCategories) {
      const bestPeerId = this.findBestPeerForCategory(category);
      if (bestPeerId && this.peers.has(bestPeerId)) {
        targetPeers.set(bestPeerId, this.peers.get(bestPeerId));
      }
    }
    
    // If no specific peers found, use all or random
    if (targetPeers.size === 0) {
      // Get a random peer if preference is set
      if (ENV.HIVE_PREFER_RANDOM === 'true') {
        const randomPeerId = this.getRandomPeer();
        if (randomPeerId) {
          targetPeers.set(randomPeerId, this.peers.get(randomPeerId));
        }
      } else {
        // Otherwise use all peers
        targetPeers = this.peers;
      }
    }
    
    // Send to all target peers
    let responsesReceived = 0;
    const allEntities = [];
    
    // Create an array of promises for each peer
    const peerPromises = Array.from(targetPeers.entries()).map(([peerId, ws]) => {
      return new Promise((resolve) => {
        if (ws.readyState !== WebSocket.OPEN) {
          resolve([]); // Skip non-open connections
          return;
        }
        
        // Setup timeout for this request
        const timer = setTimeout(() => {
          // Remove the pending query if it hasn't been handled already
          const pendingQuery = this.pendingQueries.get(requestId);
          if (pendingQuery) {
            this.pendingQueries.delete(requestId);
            resolve([]); // Resolve with empty array on timeout
          }
        }, this.timeout);
        
        // Create a promise to handle the response
        const responsePromise = new Promise((resolveResponse) => {
          this.pendingQueries.set(requestId, {
            resolve: (entities) => {
              responsesReceived++;
              resolveResponse(entities);
            },
            timer
          });
        });
        
        // Send the request
        ws.send(message);
        
        // Return the response promise
        return responsePromise;
      });
    });
    
    // Wait for all peer responses or timeouts
    const results = await Promise.all(peerPromises);
    
    // Combine all entities from all peers
    for (const entities of results) {
      if (Array.isArray(entities)) {
        allEntities.push(...entities);
      }
    }
    
    console.log(`Received ${allEntities.length} entities from ${responsesReceived} HIVE peers`);
    return allEntities;
  }
  
  /**
   * Send a collaborative query to HIVE peers
   * @param {String} content - The query content
   * @param {Array} categories - Categories relevant to the query
   * @returns {Promise<Array>} - Array of query results from peers
   */
  async sendCollaborativeQuery(content, categories = []) {
    if (this.peers.size === 0) {
      // If no peers and auto-discovery is enabled, try to find peers
      if (this.useAutoDiscovery && this.discoveryServer) {
        await this.joinMatchmakingQueue();
        // Wait a bit to see if we get matched
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // If still no peers, return empty
        if (this.peers.size === 0) {
          return [];
        }
      } else {
        return []; // No connected peers
      }
    }
    
    // Filter to only allowed categories
    const allowedCategories = categories.filter(
      cat => this.shareCategories.includes(cat)
    );
    
    if (allowedCategories.length === 0) {
      return []; // No allowed categories
    }
    
    // Generate query ID
    const queryId = `query_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Create message
    const message = JSON.stringify({
      type: 'query',
      queryId,
      content,
      categories: allowedCategories
    });
    
    // If categories have specific expertise requirements, target the best peers
    let targetPeers = new Map();
    
    // For each category, find the best peer if possible
    for (const category of allowedCategories) {
      const bestPeerId = this.findBestPeerForCategory(category);
      if (bestPeerId && this.peers.has(bestPeerId)) {
        targetPeers.set(bestPeerId, this.peers.get(bestPeerId));
      }
    }
    
    // If no specific peers found, use all or random
    if (targetPeers.size === 0) {
      // Get a random peer if preference is set
      if (ENV.HIVE_PREFER_RANDOM === 'true') {
        const randomPeerId = this.getRandomPeer();
        if (randomPeerId) {
          targetPeers.set(randomPeerId, this.peers.get(randomPeerId));
        }
      } else {
        // Otherwise use all peers
        targetPeers = this.peers;
      }
    }
    
    // Send to all target peers
    let responsesReceived = 0;
    const allResults = [];
    
    // Create an array of promises for each peer
    const peerPromises = Array.from(targetPeers.entries()).map(([peerId, ws]) => {
      return new Promise((resolve) => {
        if (ws.readyState !== WebSocket.OPEN) {
          resolve(null); // Skip non-open connections
          return;
        }
        
        // Setup timeout for this query
        const timer = setTimeout(() => {
          // Remove the pending query if it hasn't been handled already
          const pendingQuery = this.pendingQueries.get(queryId);
          if (pendingQuery) {
            this.pendingQueries.delete(queryId);
            resolve(null); // Resolve with null on timeout
          }
        }, this.timeout);
        
        // Create a promise to handle the response
        const responsePromise = new Promise((resolveResponse) => {
          this.pendingQueries.set(queryId, {
            resolve: (result) => {
              if (result) {
                responsesReceived++;
                resolveResponse({
                  peerId,
                  result
                });
              } else {
                resolveResponse(null);
              }
            },
            timer
          });
        });
        
        // Send the query
        ws.send(message);
        
        // Return the response promise
        return responsePromise;
      });
    });
    
    // Wait for all peer responses or timeouts
    const results = await Promise.all(peerPromises);
    
    // Combine all valid results from peers
    for (const result of results) {
      if (result) {
        allResults.push(result);
      }
    }
    
    console.log(`Received ${allResults.length} results from ${responsesReceived} HIVE peers for query`);
    return allResults;
  }
  
  /**
   * Share a new entity with HIVE peers
   * @param {Object} entity - The entity to share
   * @returns {Promise<number>} - Number of peers the entity was shared with
   */
  async shareEntity(entity) {
    // Check if entity type is allowed to be shared
    if (!this.isEntityTypeAllowed(entity.type)) {
      return 0;
    }
    
    // Create message
    const message = JSON.stringify({
      type: 'new-entity',
      entity,
      sourceId: this.clientId,
      timestamp: Date.now()
    });
    
    // Send to all peers
    let sharedCount = 0;
    
    for (const [peerId, ws] of this.peers.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
          sharedCount++;
        } catch (error) {
          console.warn(`Failed to share entity with peer ${peerId}:`, error.message);
        }
      }
    }
    
    return sharedCount;
  }
  
  /**
   * Close the HIVE P2P service
   */
  async close() {
    // Leave matchmaking queue if we're in it
    if (this.inMatchmakingQueue && this.discoveryServer) {
      this.leaveMatchmakingQueue();
    }
    
    // Close discovery server connection
    if (this.discoveryServer) {
      try {
        this.discoveryServer.close();
        console.log('Closed discovery server connection');
      } catch (error) {
        console.warn('Error closing discovery server connection:', error.message);
      }
      this.discoveryServer = null;
    }
    
    // Close all peer connections
    for (const [peerId, ws] of this.peers.entries()) {
      try {
        ws.close();
      } catch (error) {
        console.warn(`Error closing connection to peer ${peerId}:`, error.message);
      }
    }
    
    // Clear the peers map
    this.peers.clear();
    
    // Close the server only if we created one
    if (this.server) {
      try {
        this.server.close();
        console.log('HIVE server closed');
      } catch (error) {
        console.error('Error closing HIVE server:', error);
      }
    }
  }
}

export const hiveP2P = new SimpleHiveP2P(); 