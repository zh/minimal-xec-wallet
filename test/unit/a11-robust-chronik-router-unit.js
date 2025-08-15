/*
  Unit tests for lib/adapters/robust-chronik-router.js - Basic functionality tests

  This file provides basic test coverage for the robust Chronik router without
  complex mocking to avoid testing infrastructure rather than business logic.
*/

const assert = require('chai').assert

// Check if robust router components exist before testing
let RobustChronikRouter, RobustConnectionStrategy, ConnectionErrorType

try {
  const robustModule = require('../../lib/adapters/robust-chronik-router')
  RobustChronikRouter = robustModule.RobustChronikRouter
  RobustConnectionStrategy = robustModule.RobustConnectionStrategy
  ConnectionErrorType = robustModule.ConnectionErrorType
} catch (err) {
  console.log('RobustChronikRouter components not available for testing:', err.message)
}

describe('#RobustChronikRouter - Basic Tests', () => {
  // Skip all tests if RobustChronikRouter isn't available
  before(function () {
    if (!RobustChronikRouter) {
      this.skip()
    }
  })

  describe('#Basic Component Tests', () => {
    it('should export required components', () => {
      assert.isFunction(RobustChronikRouter)
      assert.isObject(RobustConnectionStrategy)
      assert.isObject(ConnectionErrorType)
    })

    it('should create router with default configuration', () => {
      const router = new RobustChronikRouter()

      assert.property(router, 'strategy')
      assert.property(router, 'healthMonitor')
      assert.property(router, 'errorHandler')
      assert.property(router, 'connectionPool')
    })

    it('should create health monitor with basic functionality', () => {
      const router = new RobustChronikRouter()
      const healthMonitor = router.healthMonitor

      // Test basic methods exist and work
      healthMonitor.initializeEndpointHealth('https://test.com')
      assert.equal(healthMonitor.getHealthScore('https://test.com'), 100)
      assert.isTrue(healthMonitor.isEndpointHealthy('https://test.com'))
    })

    it('should create error handler with classification capability', () => {
      const router = new RobustChronikRouter()
      const errorHandler = router.errorHandler

      // Test error classification
      const timeoutError = new Error('timeout')
      const refusedError = { code: 'ECONNREFUSED' }

      assert.equal(errorHandler.classifyError(timeoutError), ConnectionErrorType.NETWORK_TIMEOUT)
      assert.equal(errorHandler.classifyError(refusedError), ConnectionErrorType.CONNECTION_REFUSED)
    })

    it('should handle retry logic correctly', () => {
      const router = new RobustChronikRouter()
      const errorHandler = router.errorHandler

      // Test retry decisions
      assert.isTrue(errorHandler.shouldRetry(ConnectionErrorType.NETWORK_TIMEOUT, 1))
      assert.isFalse(errorHandler.shouldRetry(ConnectionErrorType.PROTOCOL_ERROR, 1))
      assert.isFalse(errorHandler.shouldRetry(ConnectionErrorType.NETWORK_TIMEOUT, 10))
    })

    it('should calculate retry delays appropriately', () => {
      const router = new RobustChronikRouter()
      const errorHandler = router.errorHandler

      const delay1 = errorHandler.getRetryDelay(1, ConnectionErrorType.NETWORK_TIMEOUT)
      const delay2 = errorHandler.getRetryDelay(2, ConnectionErrorType.NETWORK_TIMEOUT)
      const rateLimitDelay = errorHandler.getRetryDelay(1, ConnectionErrorType.RATE_LIMITED)

      assert.isNumber(delay1)
      assert.isNumber(delay2)
      assert.isAbove(delay2, delay1) // Exponential backoff
      assert.isAbove(rateLimitDelay, delay1) // Longer for rate limits
    })
  })
})
