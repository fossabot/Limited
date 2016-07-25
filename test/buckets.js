'use strict';

const expect = require('chai').expect;
const Buckets = require('../lib/buckets');

describe('Buckets', () => {
	it('looks up bucket by path and method', () => {
		expect(Buckets.getBucketByEndpoint('/api/v1/channels/Ethan_', 'GET')).to.equal('channel-read');
	});

	it('returns null if unknown path', () => {
		expect(Buckets.getBucketByEndpoint('/unknown', 'GET')).to.equal(null);
	});
});
