'use strict';

const Redis = require('ioredis');
const Promise = require('bluebird');
const uuid = require('uuid');
const _ = require('lodash');
const Buckets = require('./buckets');

const server = uuid.v4();

module.exports = class RedisStore {
	constructor(config) {
		if (config.pub !== undefined && config.sub !== undefined) {
			this.redis = config.pub;
			this.sub = config.sub;
		} else {
			this.redis = new Redis(config);
			this.sub = new Redis(config);
		}

		this.sub.subscribe('ratelimit:servers:ping');
		this.sub.subscribe('ratelimit:servers:pong');
		this.sub.on('message', (channel, message) => {
			if (channel === 'ratelimit:servers:ping') {
				this.redis.publish('ratelimit:servers:pong', server);
			} else if (channel === 'ratelimit:servers:pong' && this.pulsing) {
				this.knownServers.push(message);
			}
		});
		this.sendPulse();
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

	addToQueue(bucket) {
		return this.redis.multi().hincrby(`ratelimit:buckets:${bucket}:servers`, server, 1)
			.incr(`ratelimit:buckets:${bucket}:pending`).exec()
			.then(res => res[1][1]);
	}

	removeFromQueue(bucket) {
		return this.redis.multi().hincrby(`ratelimit:buckets:${bucket}:servers`, server, 1)
			.decr(`ratelimit:buckets:${bucket}:pending`).exec();
	}

	clear(bucket) {
		return this.redis.del(`ratelimit:buckets:${bucket}:properties`).then(() =>
			this.redis.del(`ratelimit:buckets:${bucket}:servers`)
		).then(() =>
			this.redis.del(`ratelimit:buckets:${bucket}:pending`)
		);
	}

	sendPulse(timeout) {
		this.pulsing = true;
		this.knownServers = [];
		this.redis.publish('ratelimit:servers:ping', server);
		return Promise.delay(timeout || 6000).then(() =>
			Promise.each(Buckets.getBucketNames(), bucket =>
				this.redis.hgetall(`ratelimit:buckets:${bucket}:servers`).then(servers =>
					Promise.each(_.difference(Object.keys(servers), this.knownServers), name =>
						this.redis.hdel(`ratelimit:buckets:${bucket}:servers`, name).then(() =>
							this.redis.decrby(`ratelimit:buckets:${bucket}:pending`, servers[name])
						)
					)
				)
			)
		).then(() => {
			this.pulsing = false;
		});
	}
};
