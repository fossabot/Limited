# limited

[![Build Status](https://travis-ci.org/StreamJar/Limited.svg?branch=master)](https://travis-ci.org/StreamJar/Limited) [![Coverage Status](https://coveralls.io/repos/github/StreamJar/Limited/badge.svg?branch=master)](https://coveralls.io/github/StreamJar/Limited?branch=master)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FStreamJar%2FLimited.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2FStreamJar%2FLimited?ref=badge_shield)

Limited is a module that can be dropped in to handle Mixer's rate limits. If a specific IP address hits any one of a group of endpoints (with the same rate limit "bucket") too many times, the request will be blocked until your number of requests resets. This is to ensure that people don't needlessly hit the API too hard.

You can find a full list of [all Beam's rate limits on their Developer Docs](https://dev.mixer.com/rest.html).

Beam uses [yaral](https://github.com/mixer/yaral) and [limitus](https://github.com/mixer/limitus) to do their rate limiting.

Our current system would send a HTTP request, see the bad *Too Many Requests* status code, complain to us, and then re-attempt whatever it was doing a few minutes later. I imagine it'll get pretty bad with so many channels. Continually retrying blocks of code until we don't get a 429 status code isn't sustainable, and is likely to carry lots of bugs or weird delays.

## What it is

In short, it's designed to be the easiest way to handle Mixer's rate limiting. Every time you make a HTTP request, it will listen for Mixer's rate limiting headers. If your HTTP request is going to get hit by the rate limit, the request will automatically stall. Requests will queue up, one after the other, once the rate limit is lifted.

As an example, lets say we were querying many endpoints that all fell under the same rate limiting "bucket". That imaginary bucket allows for 100 queries in 60 seconds. So, let's say we make 200 normal HTTP requests to these endpoints through Node. The first 100 requests will be executed instantly, as normal. The other 100 will automatically wait until the rate limit resets. When it does reset, requests will be executed, one after the other, with 1 second between each one.

Where possible, the library will also automatically make your queries more efficient. For example, if you queried `/channels/StreamJar` and `/channels/BlipBot` within the same second, only one request would be sent to `/channels?limit=100&where=token:in:StreamJar;BlipBot`, invisibly to your application. This means that you will actually hit your rate limit more slowly, because you will be using fewer requests.

## Installation

```
npm install --save node-limited
```

## Usage

It requires absolutely no changes to your code.

Okay, I lied, there is one line. Put this at the top.
```js
require('node-limited')();
```

That's it! It works no matter how you're making your API requests, whether it's through the standard "http" module, through "request", or Beam's "beam-client-node" module. It hooks into all of it.

However, remember that the library keeps track of requests in order to predict when it's about to get rate limited. If we're running multiple instances from the same outbound IP address, that might be a problem, so we can use Redis to store the data instead.

```js
require('node-limited')({ redis: { host: '127.0.0.1', port: 6379 } });
```

The library uses `ioredis` for your connection. That means that any options you can provide to `ioredis` can also be provided in the `redis` object above. Alternatively, if your project also uses `ioredis` too, you can just pass your connection instead.

```js
const pub = new Redis({ host: '127.0.0.1', port: 6379 });
const sub = new Redis({ host: '127.0.0.1', port: 6379 });
require('node-limited')({ redis: { pub, sub } });
```

## Advanced usage

If you would like to log what Limited is doing, you can hook into its events.

```js
const limited = require('node-limited')();
limited.on('request', result => {
	console.log(`Query to ${result.bucket} bucket delayed by ${result.wait}ms.`);
});
limited.on('rewritten', result => {
	console.log(`Rewritten query to ${result.path}.`);
});
```


## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FStreamJar%2FLimited.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FStreamJar%2FLimited?ref=badge_large)