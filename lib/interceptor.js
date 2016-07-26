'use strict';

const http = require('http');
const https = require('https');
const url = require('url');
const RequestHandler = require('./requesthandler');
const FakeClientRequest = require('./fakeclientrequest');
const RedisStore = require('./redisstore');
const MemoryStore = require('./memorystore');
const Rewriter = require('./rewriter');

const modules = [http, https];

module.exports = class Interceptor {
	constructor(config) {
		this.config = config || {};

		if (this.config.redis) {
			this.store = new RedisStore(this.config.redis);
		} else {
			this.store = new MemoryStore();
		}

		this.rewriter = new Rewriter(this.config.flushTime);
		modules.forEach(mod => {
			const request = mod.request;
			if (mod.limitedIntercepted) {
				return;
			}
			mod.limitedIntercepted = true; // eslint-disable-line no-param-reassign
			mod.request = (data, cb) => { // eslint-disable-line no-param-reassign
				let options = data;
				if (typeof options === 'string') {
					options = url.parse(options);
				}

				if (!/^(www\.)?beam\.pro$/.test(options.hostname || options.host)) {
					return request(options, cb);
				}

				const handler = new RequestHandler(options.path, options.method || 'GET', this.store);
				const fakeReq = new FakeClientRequest(options, req => {
					handler.handleHeaders(req.headers);
					if (cb) {
						cb(req);
					}
				});

				if (options.rewrite === false || !this.rewriter.rewrite(options, fakeReq)) {
					handler.delay().finally(() => {
						fakeReq.getRealClientRequest(request);
					});
				}
				return fakeReq;
			};
		});
	}
};
