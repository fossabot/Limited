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

	it('removes dead servers', () =>
		store.redis.hincrby('ratelimit:buckets:user-register:servers', 'dead', 1).then(() =>
			store.redis.set('ratelimit:buckets:user-register:pending', 1)
		)
		.then(() =>
			store.sendPulse(1)
		)
		.then(() =>
			store.redis.get('ratelimit:buckets:user-register:pending')
		)
		.then(pending => {
			expect(pending).to.equal('0');
		})
	);

	it('answers pulse ping', done => {
		let called = false;
		store.pulsing = true;
		store.knownServers = [];
		store.sub.on('message', channel => {
			if (!called && channel === 'ratelimit:servers:pong') {
				called = true;
				expect(store.knownServers).to.have.length(1);
				done();
			}
		});
		store.redis.publish('ratelimit:servers:ping', 'test');
	});

	it('also accepts ioredis object', () => {
		const pub = new Redis({ host: '127.0.0.1', port: 6379 });
		const sub = new Redis({ host: '127.0.0.1', port: 6379 });
		expect(limited({ redis: { pub, sub } }).store.redis).to.deep.equal(pub);
	});
});
