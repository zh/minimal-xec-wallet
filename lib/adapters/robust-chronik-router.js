/*
  Robust Chronik Router with intelligent failover, health monitoring, and connection pooling.
  Based on Bitcoin-ABC chronik-client patterns with enhanced reliability features.
*/

const { ChronikClient } = require('chronik-client')

// Connection error types for intelligent error handling
const ConnectionErrorType = {
  NETWORK_TIMEOUT: 'network_timeout',
  SERVER_UNAVAILABLE: 'server_unavailable',
  SERVER_INDEXING: 'server_indexing',
  PROTOCOL_ERROR: 'protocol_error',
  RATE_LIMITED: 'rate_limited',
  CONNECTION_REFUSED: 'connection_refused'
}

// Connection strategies available
const RobustConnectionStrategy = {
  CLOSEST_FIRST: 'ClosestFirst',
  ROUND_ROBIN: 'RoundRobin',
  PRIORITY_BASED: 'PriorityBased',
  LOAD_BALANCED: 'LoadBalanced'
}

class EndpointHealthMonitor {
  constructor (config = {}) {
    this.healthCheckInterval = config.healthCheckInterval || 30000 // 30 seconds
    this.maxLatencyHistory = config.maxLatencyHistory || 10
    this.healthCheckTimeout = config.healthCheckTimeout || 5000

    // Health tracking data
    this.healthScores = new Map()
    this.latencyHistory = new Map()
    this.failureCount = new Map()
    this.lastHealthCheck = new Map()
    this.isMonitoring = false
    this.healthCheckTimer = null
  }

  async startMonitoring (endpoints) {
    if (this.isMonitoring) return

    this.isMonitoring = true

    // Initialize health data for all endpoints
    for (const endpoint of endpoints) {
      this.initializeEndpointHealth(endpoint.url)
    }

    // Start periodic health checks
    this.healthCheckTimer = setInterval(() => {
      this._performHealthChecks(endpoints)
    }, this.healthCheckInterval)

    // Perform initial health check
    await this._performHealthChecks(endpoints)
  }

  stopMonitoring () {
    this.isMonitoring = false
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }

  initializeEndpointHealth (url) {
    this.healthScores.set(url, 100) // Start with perfect health
    this.latencyHistory.set(url, [])
    this.failureCount.set(url, 0)
    this.lastHealthCheck.set(url, 0)
  }

  async _performHealthChecks (endpoints) {
    const healthCheckPromises = endpoints.map(endpoint =>
      this._checkSingleEndpoint(endpoint).catch(err => {
        console.warn(`Health check failed for ${endpoint.url}:`, err.message)
        return false
      })
    )

    await Promise.allSettled(healthCheckPromises)
  }

  async _checkSingleEndpoint (endpoint) {
    const startTime = Date.now()

    try {
      // Use chronik's blockchain info as a lightweight health check
      const chronik = new ChronikClient(endpoint.url)
      await Promise.race([
        chronik.blockchainInfo(),
        new Promise((resolve, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), this.healthCheckTimeout)
        )
      ])

      const latency = Date.now() - startTime
      this._recordSuccess(endpoint.url, latency)
      return true
    } catch (err) {
      this._recordFailure(endpoint.url)
      return false
    }
  }

  _recordSuccess (url, latency) {
    // Update latency history
    const history = this.latencyHistory.get(url) || []
    history.push(latency)
    if (history.length > this.maxLatencyHistory) {
      history.shift()
    }
    this.latencyHistory.set(url, history)

    // Reset failure count on success
    this.failureCount.set(url, 0)

    // Improve health score
    const currentScore = this.healthScores.get(url) || 0
    const newScore = Math.min(100, currentScore + 10)
    this.healthScores.set(url, newScore)

    this.lastHealthCheck.set(url, Date.now())
  }

  _recordFailure (url) {
    const failures = (this.failureCount.get(url) || 0) + 1
    this.failureCount.set(url, failures)

    // Reduce health score based on consecutive failures
    const currentScore = this.healthScores.get(url) || 100
    const penalty = Math.min(30, failures * 10)
    const newScore = Math.max(0, currentScore - penalty)
    this.healthScores.set(url, newScore)

    this.lastHealthCheck.set(url, Date.now())
  }

  getHealthScore (url) {
    return this.healthScores.get(url) || 0
  }

  getAverageLatency (url) {
    const history = this.latencyHistory.get(url) || []
    if (history.length === 0) return Infinity

    const sum = history.reduce((a, b) => a + b, 0)
    return sum / history.length
  }

  getHealthiestEndpoints (endpoints) {
    return endpoints
      .filter(endpoint => this.getHealthScore(endpoint.url) > 20) // Only consider reasonably healthy endpoints
      .sort((a, b) => {
        const scoreA = this.getHealthScore(a.url)
        const scoreB = this.getHealthScore(b.url)
        const latencyA = this.getAverageLatency(a.url)
        const latencyB = this.getAverageLatency(b.url)

        // Prioritize health score, then latency
        if (scoreA !== scoreB) {
          return scoreB - scoreA // Higher score is better
        }
        return latencyA - latencyB // Lower latency is better
      })
  }

  isEndpointHealthy (url, minScore = 30) {
    const score = this.getHealthScore(url)
    const failures = this.failureCount.get(url) || 0
    return score >= minScore && failures < 3
  }
}

class ConnectionErrorHandler {
  constructor () {
    this.maxRetries = 3
    this.baseRetryDelay = 1000 // 1 second
    this.maxRetryDelay = 30000 // 30 seconds
  }

  classifyError (error) {
    const errorMsg = error.message?.toLowerCase() || ''
    const errorCode = error.code?.toLowerCase() || ''

    // Network-level errors
    if (errorCode === 'econnrefused' || errorMsg.includes('connection refused')) {
      return ConnectionErrorType.CONNECTION_REFUSED
    }

    if (errorCode === 'etimedout' || errorMsg.includes('timeout')) {
      return ConnectionErrorType.NETWORK_TIMEOUT
    }

    // Server-level errors
    if (errorMsg.includes('indexing') || errorMsg.includes('error state')) {
      return ConnectionErrorType.SERVER_INDEXING
    }

    if (errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
      return ConnectionErrorType.RATE_LIMITED
    }

    if (errorMsg.includes('server unavailable') || errorMsg.includes('503')) {
      return ConnectionErrorType.SERVER_UNAVAILABLE
    }

    // Default to protocol error for chronik-specific errors
    return ConnectionErrorType.PROTOCOL_ERROR
  }

  shouldRetry (errorType, attemptNumber) {
    if (attemptNumber >= this.maxRetries) return false

    switch (errorType) {
      case ConnectionErrorType.NETWORK_TIMEOUT:
      case ConnectionErrorType.CONNECTION_REFUSED:
      case ConnectionErrorType.SERVER_UNAVAILABLE:
        return true
      case ConnectionErrorType.SERVER_INDEXING:
        return attemptNumber < 2 // Only retry once for indexing servers
      case ConnectionErrorType.RATE_LIMITED:
        return true
      case ConnectionErrorType.PROTOCOL_ERROR:
        return false // Don't retry protocol errors
      default:
        return false
    }
  }

  getRetryDelay (attemptNumber, errorType) {
    const baseDelay = this.baseRetryDelay

    // Adjust base delay based on error type
    let multiplier = 1
    switch (errorType) {
      case ConnectionErrorType.RATE_LIMITED:
        multiplier = 3 // Longer delay for rate limiting
        break
      case ConnectionErrorType.SERVER_INDEXING:
        multiplier = 5 // Much longer delay for indexing servers
        break
      case ConnectionErrorType.NETWORK_TIMEOUT:
        multiplier = 2
        break
      default:
        multiplier = 1
    }

    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * multiplier * Math.pow(2, attemptNumber - 1)
    const jitter = Math.random() * 0.1 * exponentialDelay // 10% jitter
    const finalDelay = Math.min(exponentialDelay + jitter, this.maxRetryDelay)

    return Math.floor(finalDelay)
  }
}

class RobustChronikRouter {
  constructor (config = {}) {
    this.strategy = config.strategy || RobustConnectionStrategy.CLOSEST_FIRST
    this.endpoints = []
    this.currentEndpointIndex = 0
    this.healthMonitor = new EndpointHealthMonitor(config.healthMonitor || {})
    this.errorHandler = new ConnectionErrorHandler()
    this.connectionPool = new Map()
    this.maxConnectionsPerEndpoint = config.maxConnectionsPerEndpoint || 3
    this.connectionTimeout = config.connectionTimeout || 10000
    this.isInitialized = false

    // Statistics
    this.stats = {
      requestCount: 0,
      failoverCount: 0,
      totalLatency: 0,
      errorsByType: new Map()
    }
  }

  async initialize (urls, strategyOptions = {}) {
    try {
      if (this.isInitialized) {
        await this.cleanup()
      }

      // Validate and prepare endpoints
      this.endpoints = this._prepareEndpoints(urls)

      // Initialize health monitoring
      await this.healthMonitor.startMonitoring(this.endpoints)

      // Try to establish initial connection using chosen strategy
      await this._initializeWithStrategy(strategyOptions)

      this.isInitialized = true
      console.log(`RobustChronikRouter initialized with ${this.endpoints.length} endpoints using ${this.strategy} strategy`)
    } catch (err) {
      throw new Error(`Router initialization failed: ${err.message}`)
    }
  }

  _prepareEndpoints (urls) {
    const urlArray = Array.isArray(urls) ? urls : [urls]

    if (urlArray.length === 0) {
      throw new Error('At least one endpoint URL is required')
    }

    return urlArray.map((url, index) => ({
      url: this._normalizeUrl(url),
      priority: index, // Lower index = higher priority
      isActive: true,
      createdAt: Date.now()
    }))
  }

  _normalizeUrl (url) {
    if (!url || typeof url !== 'string') {
      throw new Error('URL must be a non-empty string')
    }

    // Remove trailing slash
    const cleanUrl = url.replace(/\/$/, '')

    // Validate URL format
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      throw new Error(`Invalid URL format: ${url}`)
    }

    return cleanUrl
  }

  async _initializeWithStrategy (options) {
    switch (this.strategy) {
      case RobustConnectionStrategy.CLOSEST_FIRST:
        await this._initializeClosestFirst()
        break
      case RobustConnectionStrategy.PRIORITY_BASED:
        this._initializePriorityBased()
        break
      case RobustConnectionStrategy.ROUND_ROBIN:
        this._initializeRoundRobin()
        break
      default:
        this._initializePriorityBased() // Default fallback
    }
  }

  async _initializeClosestFirst () {
    // Wait for initial health checks to complete
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Sort endpoints by health and latency
    const healthyEndpoints = this.healthMonitor.getHealthiestEndpoints(this.endpoints)

    if (healthyEndpoints.length > 0) {
      this.currentEndpointIndex = this.endpoints.indexOf(healthyEndpoints[0])
    } else {
      console.warn('No healthy endpoints found, using first endpoint')
      this.currentEndpointIndex = 0
    }
  }

  _initializePriorityBased () {
    // Sort by priority (lower number = higher priority)
    this.endpoints.sort((a, b) => a.priority - b.priority)
    this.currentEndpointIndex = 0
  }

  _initializeRoundRobin () {
    this.currentEndpointIndex = 0
  }

  async executeWithFailover (operation, maxAttempts = null) {
    const attempts = maxAttempts || this.endpoints.length * this.errorHandler.maxRetries
    let lastError = null

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const endpoint = this._getCurrentEndpoint()

      try {
        this.stats.requestCount++
        const startTime = Date.now()

        const result = await this._executeWithTimeout(operation, endpoint)

        // Record success metrics
        this.stats.totalLatency += Date.now() - startTime

        return result
      } catch (err) {
        lastError = err
        const errorType = this.errorHandler.classifyError(err)

        // Update error statistics
        const errorCount = this.stats.errorsByType.get(errorType) || 0
        this.stats.errorsByType.set(errorType, errorCount + 1)

        // Check if we should retry
        if (!this.errorHandler.shouldRetry(errorType, attempt) || attempt === attempts) {
          throw err
        }

        // Move to next endpoint
        await this._rotateToNextHealthyEndpoint()
        this.stats.failoverCount++

        // Wait before retry
        const retryDelay = this.errorHandler.getRetryDelay(attempt, errorType)
        console.warn(`Endpoint ${endpoint.url} failed (${errorType}), retrying in ${retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }

    throw lastError || new Error('All failover attempts exhausted')
  }

  async _executeWithTimeout (operation, endpoint) {
    const timeoutPromise = new Promise((resolve, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), this.connectionTimeout)
    )

    return Promise.race([
      operation(endpoint),
      timeoutPromise
    ])
  }

  _getCurrentEndpoint () {
    if (this.currentEndpointIndex >= this.endpoints.length) {
      this.currentEndpointIndex = 0
    }
    return this.endpoints[this.currentEndpointIndex]
  }

  async _rotateToNextHealthyEndpoint () {
    const startIndex = this.currentEndpointIndex
    let attempts = 0

    do {
      this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length
      attempts++

      const endpoint = this.endpoints[this.currentEndpointIndex]

      // Check if this endpoint is healthy
      if (this.healthMonitor.isEndpointHealthy(endpoint.url)) {
        return
      }
    } while (this.currentEndpointIndex !== startIndex && attempts < this.endpoints.length)

    // If no healthy endpoints found, use current anyway (last resort)
    console.warn('No healthy endpoints available, continuing with current endpoint')
  }

  async getConnection () {
    if (!this.isInitialized) {
      throw new Error('Router not initialized. Call initialize() first.')
    }

    const endpoint = this._getCurrentEndpoint()

    // Try to reuse existing connection from pool
    const poolKey = endpoint.url
    if (this.connectionPool.has(poolKey)) {
      return this.connectionPool.get(poolKey)
    }

    // Create new connection
    const chronik = new ChronikClient(endpoint.url)
    this.connectionPool.set(poolKey, chronik)

    return chronik
  }

  getStats () {
    const avgLatency = this.stats.requestCount > 0
      ? this.stats.totalLatency / this.stats.requestCount
      : 0

    return {
      ...this.stats,
      averageLatency: Math.round(avgLatency),
      currentEndpoint: this._getCurrentEndpoint().url,
      healthyEndpoints: this.endpoints.filter(ep =>
        this.healthMonitor.isEndpointHealthy(ep.url)
      ).length,
      totalEndpoints: this.endpoints.length
    }
  }

  async cleanup () {
    this.healthMonitor.stopMonitoring()
    this.connectionPool.clear()
    this.isInitialized = false
  }
}

module.exports = {
  RobustChronikRouter,
  EndpointHealthMonitor,
  ConnectionErrorHandler,
  RobustConnectionStrategy,
  ConnectionErrorType
}
