'use strict';

const Redis = require('ioredis');
const expect = require('chai').expect;
const limited = require('../');
const store = limited({ redis: { host: '127.0.0.1', port: 6379 } }).store;

describe('Redis Store', () => {
	after(() => {
		store.clear('bucket');
	});

	it('gets and sets bucket properties', () =>
		store.setBucketProperties('bucket', 1, 2, 3).then(() =>
			store.getBucketProperties('bucket')
		).then(properties => {
			expect(properties).to.deep.equal({
				limit: 1,
				remaining: 2,
				reset: 3,
			});
		})
	);

	it('adds to queue', () =>
		store.addToQueue('bucket', 1, () =>
			store.addToQueue('bucket', 2, res => {
				expect(res).to.equal(2);
			})
		)
	);

	it('removes from queue', () =>
		store.removeFromQueue('bucket', 1)
	);

	it('also accepts ioredis object', () => {
		const redis = new Redis({ host: '127.0.0.1', port: 6379 });
		expect(limited({ redis }).store.redis).to.deep.equal(redis);
	});
});
