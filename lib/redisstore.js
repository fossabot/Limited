'use strict';

const Redis = require('ioredis');

module.exports = class RedisStore {
	constructor(config) {
		if (config instanceof Redis) {
			this.redis = config;
		} else {
			this.redis = new Redis(config);
		}
	}

	getBucketProperties(bucket) {
		return this.redis.hgetall(`ratelimit:buckets:${bucket}:properties`).then(properties => ({
			limit: parseInt(properties.limit, 10),
			remaining: parseInt(properties.remaining, 10),
			reset: parseInt(properties.reset, 10),
		}));
	}

	setBucketProperties(bucket, limit, remaining, reset) {
		return this.redis.hmset(`ratelimit:buckets:${bucket}:properties`, { limit, remaining, reset });
	}

	addToQueue(bucket, id) {
		const key = `ratelimit:buckets:${bucket}:requests`;
		return this.redis.multi().zadd(key, id, 1).zcard(key).exec()
			.then(res => res[1][1]);
	}

	removeFromQueue(bucket, id) {
		return this.redis.zrem(`ratelimit:buckets:${bucket}:requests`, id);
	}

	clear(bucket) {
		return this.redis.del(`ratelimit:buckets:${bucket}:properties`).then(() =>
			this.redis.del(`ratelimit:buckets:${bucket}:requests`)
		);
	}
};
