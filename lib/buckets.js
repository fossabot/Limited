'use strict';

const buckets = {
	'channel-follow': {
		methods: ['PUT', 'DELETE'],
		paths: [
			'channels/*/follow',
		],
	},
	'channel-read': {
		methods: ['GET'],
		paths: [
			'channels',
			'channels/*',
			'channels/*/follow',
			'channels/*/emoticons',
			'channels/*/hostee',
			'channels/*/hosters',
			'channels/*/manifest.*',
			'channels/*/partnership/app',
			'channels/*/partnership/codes',
			'channels/*/related',
			'users/*/follows',
		],
	},
	'channel-write': {
		methods: ['PUT', 'PATCH', 'DELETE'],
		paths: [
			'channels/*',
			'channels/*/emoticons',
			'channels/*/hostee',
			'channels/*/partnership/app',
			'channels/*/streamKey',
		],
	},
	chats: {
		methods: ['GET'],
		paths: [
			'chats/*/friends',
		],
	},
	upload: {
		methods: ['POST'],
		paths: [
			'channels/*/badge',
			'channels/*/thumbnail',
			'users/*/changeAvatar',
			'tetris/games/*/cover',
		],
	},
	'user-email': {
		methods: ['POST', 'PUT', 'PATCH'],
		paths: [
			'users/changeEmail',
			'users/reset',
		],
	},
	'user-login': {
		methods: ['POST'],
		paths: [
			'users/login',
		],
	},
	'user-read': {
		methods: ['GET'],
		paths: [
			'users/current',
			'users/*/sessions',
		],
	},
	'user-register': {
		methods: ['POST'],
		paths: [],
	},
	'user-write': {
		methods: ['GET', 'DELETE'],
		paths: [
			'users',
			'users/current',
			'users/*/changename',
		],
	},
	analytics: { // This isn't documented properly, could be wrong.
		methods: ['GET'],
		paths: [
			'channels/*/analytics/tsdb/*',
		],
	},
};

Object.keys(buckets).forEach(bucket => {
	buckets[bucket].patterns = [];
	buckets[bucket].paths.forEach(path => {
		const pattern = path
			.replace(/\//g, '\\/')
			.replace(/\*\*/g, '(.*)')
			.replace(/\*/g, '([a-z0-9\\_]+)');
		buckets[bucket].patterns.push(new RegExp(`^/api/v1/${pattern}`, 'i'));
	});
});

module.exports = class Bucket {
	static getBucketByEndpoint(path, method) {
		const keys = Object.keys(buckets);
		const tested = path.split('?')[0];
		for (let i = 0; i < keys.length; i++) {
			const name = keys[i];
			const bucket = buckets[name];
			if (bucket.methods.indexOf(method.toUpperCase()) === -1) {
				continue;
			}
			const patterns = bucket.patterns;
			for (let j = 0; j < patterns.length; j++) {
				if (patterns[j].test(tested)) {
					return name;
				}
			}
		}
		return null;
	}
};
