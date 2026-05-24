import axios from 'axios';

/**
 * Shared axios instance for all parkrun HTTP requests.
 * Parkrun requires a browser-like User-Agent; without it some pages return 403.
 */
const http = axios.create({
  baseURL: 'https://www.parkrun.org.uk',
  timeout: 10_000,
  maxRedirects: 5,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
  },
});

export default http;
