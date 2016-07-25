'use strict';

const Interceptor = require('./lib/interceptor');

module.exports = config => new Interceptor(config);
