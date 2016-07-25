'use strict';

const Promise = require('bluebird');
const uuid = require('uuid');
const Buckets = require('./buckets');

module.exports = class RequestHandler {
	constructor(path, method, store) {
		this.path = path;
		this.method = method;
		this.store = store;
	}

	delay() {
		const buckets = ['global'];
		this.bucket = Buckets.getBucketByEndpoint(this.path, this.method);
		if (this.bucket !== undefined) {
			buckets.push(this.bucket);
		}

		const id = uuid.v4();
		let wait = 0;
		return Promise.each(buckets, bucket => this.getWaitTime(bucket, id).then(time => {
			wait = Math.max(wait, time);
		})).then(() => new Promise(resolve => {
			setTimeout(() => {
				buckets.forEach(bucket => {
					this.store.removeFromQueue(bucket, id);
				});
				resolve();
			}, wait);
		}));
	}

	getWaitTime(bucket, id) {
		return this.store.getBucketProperties(bucket).then(res => {
			if (!res || res.remaining !== 0 || res.reset < new Date().getTime()) {
				return 0;
			}

			return this.store.addToQueue(bucket, id).then(position =>
				this.calculateTimeToWait(res.reset, position)
			);
		});
	}

	calculateTimeToWait(resetTime, position) {
		return Math.max(0, resetTime - new Date().getTime()) + (1000 * (position - 1));
	}

	handleHeaders(headers) {
		if (headers) {
			const limit = headers['x-rate-limit'];
			const remaining = headers['x-ratelimit-remaining'];
			const reset = headers['x-ratelimit-reset'];
			if (!limit && !remaining && !reset && !this.bucket) {
				return;
			}
			this.store.setBucketProperties(this.bucket, limit, remaining, reset);
		}
	}
};
