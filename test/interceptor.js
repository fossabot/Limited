'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const nock = require('nock');
const https = require('https');
const request = require('request-promise');
const Beam = require('beam-client-node');
const lib = require('../');

describe('Interceptor', () => {
	let limited;
	let original;
	before(() => {
		original = https.request;
		https.limitedIntercepted = false;
		limited = lib({ flushTime: 1 });
	});

	after(() => {
		https.request = original;
		https.limitedIntercepted = false;
	});

	it('predicts when rate limits shall be hit', done => {
		nock('https://beam.pro')
			.get('/api/v1/users/current')
			.reply(200, {}, {
				'X-Rate-Limit': 100,
				'X-RateLimit-Remaining': 0,
				'X-RateLimit-Reset': new Date().getTime() + 1000,
			});
		limited.once('request', obj => {
			expect(obj).to.have.keys('bucket', 'wait');
		});
		return request.get('https://beam.pro/api/v1/users/current').then(() => {
			const stub = sinon.stub(global, 'setTimeout', (fn, wait) => {
				stub.restore();
				expect(wait).to.be.above(800).and.below(1200);
				done();
			});
			request.get('https://beam.pro/api/v1/users/current');
		});
	});

	it('passes through other requests', () => {
		nock('https://google.com')
			.get('/')
			.reply(200, 'Success');
		return request.get('https://google.com/').then(res => {
			expect(res).to.equal('Success');
		});
	});

	describe('Compatibility', () => {
		const testHeaders = {
			'X-Rate-Limit': 100,
			'X-RateLimit-Remaining': 99,
			'X-RateLimit-Reset': 0,
		};

		before(() =>
			limited.store.setBucketProperties('user-read', 0, 0, 0)
		);

		afterEach(() =>
			limited.store.setBucketProperties('user-read', 0, 0, 0)
		);

		it('stores rate limit information with https', done => {
			nock('https://beam.pro')
				.get('/api/v1/users/current')
				.reply(200, {}, testHeaders);
			https.request('https://beam.pro/api/v1/users/current', () => {
				limited.store.getBucketProperties('user-read').then(properties => {
					expect(properties).to.deep.equal({ limit: 100, remaining: 99, reset: 0 });
					done();
				});
			}).end();
		});

		it('stores rate limit information with requestjs', () => {
			nock('https://beam.pro')
				.get('/api/v1/users/current')
				.reply(200, {}, testHeaders);
			return request.get('https://beam.pro/api/v1/users/current').then(() =>
				limited.store.getBucketProperties('user-read').then(properties => {
					expect(properties).to.deep.equal({ limit: 100, remaining: 99, reset: 0 });
				})
			);
		});

		it('stores rate limit information with beam-client-node', () => {
			nock('https://beam.pro')
				.get('/api/v1/users/current')
				.reply(200, {}, testHeaders);
			const beam = new Beam();
			return beam.channel.makeHandled('get', '/users/current').then(() =>
				limited.store.getBucketProperties('user-read').then(properties => {
					expect(properties).to.deep.equal({ limit: 100, remaining: 99, reset: 0 });
				})
			);
		});
	});
});
