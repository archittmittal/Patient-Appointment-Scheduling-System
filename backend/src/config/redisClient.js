const Redis = require('ioredis');
const logger = require('./logger');

let redisPub = null;
let redisSub = null;
let isRedisConfigured = false;

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const redisPort = parseInt(process.env.REDIS_PORT, 10) || 6379;
const redisPassword = process.env.REDIS_PASSWORD || null;

if (redisUrl || redisHost) {
    isRedisConfigured = true;

    const options = {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        retryStrategy(times) {
            // Reconnect delay increases up to a maximum of 3 seconds
            const delay = Math.min(times * 100, 3000);
            return delay;
        }
    };

    if (redisPassword) {
        options.password = redisPassword;
    }

    try {
        if (redisUrl) {
            redisPub = new Redis(redisUrl, options);
            redisSub = new Redis(redisUrl, options);
        } else {
            redisPub = new Redis({ host: redisHost, port: redisPort, ...options });
            redisSub = new Redis({ host: redisHost, port: redisPort, ...options });
        }

        redisPub.on('connect', () => {
            logger.info('Redis Publisher connected successfully.');
        });

        redisPub.on('error', (err) => {
            logger.error('Redis Publisher error: ' + err.message, { error: err });
        });

        redisSub.on('connect', () => {
            logger.info('Redis Subscriber connected successfully.');
        });

        redisSub.on('error', (err) => {
            logger.error('Redis Subscriber error: ' + err.message, { error: err });
        });
    } catch (error) {
        logger.error('Failed to initialize Redis clients: ' + error.message, { error });
        redisPub = null;
        redisSub = null;
        isRedisConfigured = false;
    }
} else {
    logger.info('Redis is not configured. SSE will fallback to in-memory mode.');
}

/**
 * Returns true if Redis is configured and ready to be used.
 */
function isRedisEnabled() {
    return (
        isRedisConfigured &&
        redisPub &&
        redisSub &&
        redisPub.status === 'ready' &&
        redisSub.status === 'ready'
    );
}

module.exports = {
    redisPub,
    redisSub,
    isRedisEnabled
};
