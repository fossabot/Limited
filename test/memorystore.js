'use strict';

const expect = require('chai').expect;
const store = require('../')({}).store;

describe('Memory Store', () => {
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
});
