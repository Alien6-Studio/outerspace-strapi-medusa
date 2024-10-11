import axios from 'axios';
import axiosRetry from 'axios-retry';

let strapiRetryDelay: number;

axiosRetry(axios as any, {
	retries: 100,
	retryDelay: (retryCount, error: any) => {
		error.response &&
			error.response.status === 429 &&
			// Use X-Retry-After rather than Retry-After, and cap retry delay at 60 seconds
			error.response.headers['x-retry-after'] &&
			parseInt(error.response.headers['x-retry-after']) <= 60;
		let retryHeaderDelay = parseInt(error.response.headers['x-retry-after'].toString());
		const rateLimitResetTime = parseInt(error.response.headers['x-ratelimit-reset'].toString());

		if (!retryHeaderDelay && !rateLimitResetTime) {
			/** @todo change from fixed back off to exponential backoff */
			// axiosRetry.exponentialDelay(retryCount)*1000
			return 400e3;
		}
		if (!retryHeaderDelay) {
			const currentTime = Date.now();
			const timeDiffms = Math.abs(parseInt(rateLimitResetTime.toString()) - Math.floor(currentTime / 1000)) + 2;
			retryHeaderDelay = timeDiffms * 1000;
			strapiRetryDelay = retryHeaderDelay;
		} else {
			strapiRetryDelay = retryCount * 1000 * retryHeaderDelay;
		}
		console.log(`retrying after ${strapiRetryDelay}`);
		return strapiRetryDelay;
	},
	shouldResetTimeout: false,
	onRetry: (retryCount, error: any) => {
		console.info(`retring request ${retryCount}` + ` because of ${error.response.status}  ${error.request.path}`);
	},
	retryCondition: async (error: any) => {
		return error.response.status === 429;
	},
});