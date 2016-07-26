'use strict';

const https = require('https');
const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');

module.exports = class Rewriter extends EventEmitter {
	constructor(flushTime) {
		super();
		this.flushTime = flushTime || 1000;
		this.clearCache();
	}

	rewrite(options, req) {
		if (options.method !== 'GET') {
			return false;
		}
		const channelById = options.path.match(/^\/api\/v1\/channels\/([0-9]+)\/?$/i);
		if (channelById) {
			this.addCache('channelById', channelById[1], options, req);
			return true;
		}
		const channelByToken = options.path.match(/^\/api\/v1\/channels\/([a-z0-9_]+)\/?$/i);
		if (channelByToken) {
			this.addCache('channelByToken', channelByToken[1], options, req);
			return true;
		}
		return false;
	}

	addCache(name, value, options, req) {
		const cache = this.cache[name];
		// const headersEqual = _.isEqual(options.headers, cache.headers || {});
		// if (cache.values.length && (!headersEqual || cache.values[value] !== undefined)) {
		// 	return;
		// }
		this.cache[name].headers = options.headers;
		this.cache[name].values[value] = req;
		if (Object.keys(cache.values).length >= 100) {
			this.flush();
		} else {
			this.prepareFlush();
		}
	}

	prepareFlush() {
		clearTimeout(this.timeout);
		this.timeout = setTimeout(this.flush.bind(this), this.flushTime);
	}

	flush() {
		clearTimeout(this.timeout);
		this.processCache('channelById', 'channels', 'id');
		this.processCache('channelByToken', 'channels', 'token');
	}

	processCache(cache, url, key) {
		const cached = this.cache[cache];
		this.cache[cache] = { values: {}, headers: {} };
		if (!Object.keys(cached.values).length) {
			return;
		}
		const path = `/api/v1/${url}?limit=100&where=${key}.in.${Object.keys(cached.values).join(';')}`;
		this.emit('rewritten', { path });
		const req = https.request({
			host: 'beam.pro',
			method: 'GET',
			path,
			headers: cached.headers,
			rewrite: false,
		}, res => {
			let data = '';
			res.on('data', chunk => {
				data += chunk;
			});
			res.on('end', () => {
				const values = cached.values;
				const vals = Object.keys(values);
				if (res.statusCode !== 200) {
					vals.forEach(val => {
						this.sendFakeResponse(values[val], res.statusCode, data);
					});
				}
				let json;
				try {
					json = JSON.parse(data);
					if (!(json instanceof Array)) {
						throw new Error('response from grouped Beam request is not an array');
					}
				} catch (err) {
					vals.forEach(val => {
						this.sendFakeResponse(values[val], res.statusCode, data);
					});
					return;
				}
				vals.forEach(val => {
					const search = {};
					search[key] = parseInt(val, 10) || val;
					const item = _.find(json, search);
					if (item === undefined) {
						this.sendFakeResponse(values[val], 404, {
							statusCode: 404,
							error: 'Not Found',
							message: 'Could not find in grouped request.',
						});
					} else {
						this.sendFakeResponse(values[val], 200, item, res);
					}
				});
			});
		});
		req.end();
	}

	sendFakeResponse(request, status, data, res) {
		const req = request;
		const resp = res || { headers: {} };
		const incoming = new EventEmitter();
		incoming.statusCode = status;
		incoming.headers = resp.headers;

		req.cb(incoming);
		request.emit('response', incoming);

		if (typeof data === 'string') {
			incoming.emit('data', data);
		} else {
			incoming.emit('data', JSON.stringify(data));
		}
		incoming.emit('end');
	}

	clearCache() {
		this.cache = {
			channelById: { values: {}, headers: {} },
			channelByToken: { values: {}, headers: {} },
		};
	}
};
