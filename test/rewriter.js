'use strict';

const nock = require('nock');
const request = require('request-promise');
const errors = require('request-promise/errors');
const expect = require('chai').expect;
const https = require('https');
const _ = require('lodash');
const lib = require('../');

describe('Rewriter', () => {
	let limited;
	let original;
	before(() => {
		original = https.request;
		https.limitedIntercepted = false;
		limited = lib({ flushTime: 1 });
	});

	after(() => {
		https.request = original;
	});

	it('rewrites channel lookups by id', done => {
		nock('https://beam.pro')
			.get('/api/v1/channels?limit=100&where=id.in.123;456')
			.reply(200, [
				{
					id: 123,
					token: 'One',
				},
				{
					id: 456,
					token: 'Two',
				},
			]);
		request.get('https://beam.pro/api/v1/channels/123', { json: true }).then(res => {
			expect(res).to.deep.equal({ id: 123, token: 'One' });
			done();
		});
		request.get('https://beam.pro/api/v1/channels/456');
	});

	it('rewrites channel lookups by token', done => {
		nock('https://beam.pro')
			.get('/api/v1/channels?limit=100&where=token.in.One;Two')
			.reply(200, [
				{
					id: 123,
					token: 'One',
				},
				{
					id: 456,
					token: 'Two',
				},
			]);
		request.get('https://beam.pro/api/v1/channels/One', { json: true }).then(res => {
			expect(res).to.deep.equal({ id: 123, token: 'One' });
			done();
		});
		request.get('https://beam.pro/api/v1/channels/Two');
	});

	it('generates a fake 404 when required', done => {
		nock('https://beam.pro')
			.get('/api/v1/channels?limit=100&where=id.in.123;456')
			.reply(200, [
				{
					id: 456,
					token: 'Two',
				},
			]);
		request.get('https://beam.pro/api/v1/channels/123', { json: true }).catch(errors.StatusCodeError, res => {
			expect(res.statusCode).to.equal(404);
			done();
		});
		request.get('https://beam.pro/api/v1/channels/456');
	});

	it('returns full response if receives invalid JSON', done => {
		nock('https://beam.pro')
			.get('/api/v1/channels?limit=100&where=id.in.123;456')
			.reply(200, 'Something that is not JSON');
		request.get('https://beam.pro/api/v1/channels/123', { json: true }).then(res => {
			expect(res).to.equal('Something that is not JSON');
			done();
		});
		request.get('https://beam.pro/api/v1/channels/456');
	});

	it('returns full response if receives a bad status code', done => {
		nock('https://beam.pro')
			.get('/api/v1/channels?limit=100&where=id.in.123;456')
			.reply(400, { status: false });
		request.get('https://beam.pro/api/v1/channels/123', { json: true }).catch(errors.StatusCodeError, res => {
			expect(res.statusCode).to.equal(400);
			done();
		});
		request.get('https://beam.pro/api/v1/channels/456').catch(() => {});
	});

	it('returns full response if receives a non-array', done => {
		nock('https://beam.pro')
			.get('/api/v1/channels?limit=100&where=id.in.123;456')
			.reply(200, { status: false });
		request.get('https://beam.pro/api/v1/channels/123', { json: true }).then(res => {
			expect(res).to.deep.equal({ status: false });
			done();
		});
		request.get('https://beam.pro/api/v1/channels/456');
	});

	it('does multiple requests if exceeds maximum of 100', done => {
		limited.rewriter.flushTime = 2000;
		let i = 0;
		const numbers = _.times(101, () => {
			i++;
			return i;
		});

		nock('https://beam.pro')
			.get(`/api/v1/channels?limit=100&where=id.in.${numbers.slice(0, 100).join(';')}`)
			.reply(200);
		nock('https://beam.pro')
			.get('/api/v1/channels?limit=100&where=id.in.101')
			.reply(200, () => {
				done();
			});
		numbers.forEach(number => {
			if (number === 101) {
				limited.rewriter.flushTime = 1;
			}
			request.get(`https://beam.pro/api/v1/channels/${number}`, { json: true });
		});
	});
});
