'use strict';

const EventEmitter = require('events').EventEmitter;

module.exports = class FakeClientRequest extends EventEmitter {
	constructor(opts, cb) {
		super();
		this.opts = opts;
		this.cb = cb;
		this.queue = [];

		[
			'abort',
			'end',
			'flushHeaders',
			'setNoDelay',
			'setSocketKeepAlive',
			'setTimeout',
			'write',
		].forEach(fn => {
			this[fn] = (arg1, arg2, arg3) => {
				this.queue.push(req => {
					req[fn](arg1, arg2, arg3);
				});
			};
		});
	}

	getRealClientRequest(request) {
		const req = request(this.opts, this.cb);
		this.queue.forEach(fn => {
			fn(req);
		});
		const events = this._events; // eslint-disable-line no-underscore-dangle
		Object.keys(events).forEach(event => {
			let fns = events[event];
			if (!(fns instanceof Array)) {
				fns = [fns];
			}
			fns.forEach(fn => {
				req.on(event, fn);
			});
		});
		return req;
	}
};
