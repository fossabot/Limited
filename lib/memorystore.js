'use strict';

const Promise = require('bluebird');

module.exports = class MemoryStore {
	constructor() {
		this.properties = {};
		this.requests = {};
	}

	getBucketProperties(bucket) {
		return Promise.resolve(this.properties[bucket]);
	}

	setBucketProperties(bucket, limit, remaining, reset) {
		this.properties[bucket] = { limit, remaining, reset };
		return Promise.resolve();
	}

	addToQueue(bucket, id) {
		if (this.requests[bucket] === undefined) {
			this.requests[bucket] = [];
		}
		this.requests[bucket].push(id);
		return Promise.resolve(this.requests[bucket].length);
	}

	removeFromQueue(bucket, id) {
		if (this.requests[bucket] === undefined) {
			this.requests[bucket] = [];
		}
		const index = this.requests[bucket].indexOf(id);
		if (index !== -1) {
			this.requests[bucket].splice(index, 1);
		}
		return Promise.resolve();
	}

	clear(bucket) {
		delete this.properties[bucket];
		delete this.requests[bucket];
	}
};
