const core = require("@actions/core");
const { request, METHOD_POST } = require('./httpClient');
const { GithubActions } = require('./githubActions');

let auth = undefined
let customHeaders = {}

if (!!core.getInput('customHeaders')) {
  try {
    customHeaders = JSON.parse(core.getInput('customHeaders'));
  } catch(error) {
    core.error('Could not parse customHeaders string value')
  }
}

const requestContentType = core.getInput('contentType')
const headers = { 'Content-Type': requestContentType || 'application/json' }

if (!!core.getInput('username') || !!core.getInput('password')) {
  core.debug('Add BasicHTTP Auth config')

  auth = {
    username: core.getInput('username'),
    password: core.getInput('password')
  }
}

if (!!core.getInput('bearerToken')) {
  headers['Authorization'] = `Bearer ${core.getInput('bearerToken')}`;
}

const instanceConfig = {
  baseURL: core.getInput('url', { required: true }),
  timeout: parseInt(core.getInput('timeout') || 5000, 10),
  headers: { ...headers, ...customHeaders }
}

const data = core.getInput('data') || '{}';
const files = core.getInput('files') || '{}';
const method = core.getInput('method') || METHOD_POST;
const preventFailureOnNoResponse = core.getInput('preventFailureOnNoResponse') === 'true';
const escapeData = core.getInput('escapeData') === 'true';

const ignoreStatusCodes = core.getInput('ignoreStatusCodes')
let ignoredCodes = []

if (typeof ignoreStatusCodes === 'string' && ignoreStatusCodes.length > 0) {
  ignoredCodes = ignoreStatusCodes.split(',').map(statusCode => parseInt(statusCode.trim()))
}

request({ data, requestContentType, method, instanceConfig, auth, preventFailureOnNoResponse, escapeData, files, ignoredCodes, actions: new GithubActions() })
