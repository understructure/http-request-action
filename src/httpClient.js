const axios = require("axios");
const FormData = require('form-data')
const fs = require('fs')

const METHOD_GET = 'GET'
const METHOD_POST = 'POST'

/**
 * @param {Object} param0
 * @param {string} param0.method HTTP Method
 * @param {{ baseURL: string; timeout: number; headers: { [name: string]: string } }} param0.instanceConfig
 * @param {string} param0.data Request Body as string, default {}
 * @param {string} param0.files Map of Request Files (name: absolute path) as JSON String, default: {}
 * @param {{ username: string; password: string }|undefined} param0.auth Optional HTTP Basic Auth
 * @param {*} param0.actions 
 * @param {number[]} param0.ignoredCodes Prevent Action to fail if the API response with one of this StatusCodes
 * @param {boolean} param0.preventFailureOnNoResponse Prevent Action to fail if the API respond without Response
 * @param {boolean} param0.escapeData Escape unescaped JSON content in data
 *
 * @returns {void}
 */
const request = async({ method, requestContentType, instanceConfig, data, files, auth, actions, ignoredCodes, preventFailureOnNoResponse, escapeData }) => {
  try {
    if (escapeData) {
      data = data.replace(/"[^"]*"/g, (match) => { 
        return match.replace(/[\n\r]\s*/g, "\\n");
      }); 
    }

    if (method === METHOD_GET) {
      data = undefined;
    }

    if ((files && files !== '{}') || requestContentType === "application/x-www-form-urlencoded") {
      core.debug("attempting to convert JSON data to form-urlencoded")
      filesJson = convertToJSON(files)
      dataJson = convertToJSON(data)

      if (Object.keys(filesJson).length > 0 || requestContentType === "application/x-www-form-urlencoded") {
        try {
          data = convertToFormData(dataJson, filesJson)
          instanceConfig = await updateConfig(instanceConfig, data, actions)
        } catch(error) {
          actions.setFailed({ message: `Unable to convert Data and Files into FormData: ${error.message}`, data: dataJson, files: filesJson })
          return
        }
      }
    }

    const requestData = {
      auth,
      method,
      data,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    }

    actions.debug('Instance Configuration: ' + JSON.stringify(instanceConfig))
    
    const instance = axios.create(instanceConfig);

    actions.debug('Request Data: ' + JSON.stringify(requestData))

    const response = await instance.request(requestData)

    actions.setOutput('response', JSON.stringify(response.data))
  } catch (error) {
    if (error.toJSON) {
      actions.setOutput('requestError', JSON.stringify(error.toJSON()));
    }

    if (error.response && ignoredCodes.includes(error.response.status)) {
      actions.warning(JSON.stringify({ code: error.response.status, message: error.response.data }))
    } else if (error.response) {
      actions.setFailed(JSON.stringify({ code: error.response.status, message: error.response.data }))
    } else if (error.request && !preventFailureOnNoResponse) {
      actions.setFailed(JSON.stringify({ error: "no response received" }));
    } else if (error.request && preventFailureOnNoResponse) {
      actions.warning(JSON.stringify(error));
    } else {
      actions.setFailed(JSON.stringify({ message: error.message, data }));
    }
  }
}

/**
 * @param {string} value
 *
 * @returns {Object}
 */
const convertToJSON = (value) => {
  try {
    return JSON.parse(value)
  } catch(e) {
    return {}
  }
}

/**
 * @param {Object} data
 * @param {Object} files
 *
 * @returns {FormData}
 */
const convertToFormData = (data, files) => {
  formData = new FormData()

  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value)
  }

  for (const [key, value] of Object.entries(files)) {
    formData.append(key, fs.createReadStream(value))
  }

  return formData
}

/**
 * @param {{ baseURL: string; timeout: number; headers: { [name: string]: string } }} instanceConfig
 * @param {FormData} formData
 * @param {*} actions
 *
 * @returns {{ baseURL: string; timeout: number; headers: { [name: string]: string } }}
 */
const updateConfig = async (instanceConfig, formData, actions) => {
  try {
    const formHeaders = formData.getHeaders()
    const contentType = formHeaders['content-type']

    delete formHeaders['content-type']

    return { 
      ...instanceConfig, 
      headers: { 
        ...instanceConfig.headers, 
        ...formHeaders,
        'Content-Length': await contentLength(formData),
        'Content-Type': contentType
      }
    }
  } catch(error) {
    actions.setFailed({ message: `Unable to read Content-Length: ${error.message}`, data, files })
  }
}

/**
 * @param {FormData} formData
 *
 * @returns {Promise<number>}
 */
const contentLength = (formData) => new Promise((resolve, reject) => {
  formData.getLength((err, length) => {
    if (err) {
      reject (err)
      return
    }

    resolve(length)
  })
})

module.exports = {
  request,
  METHOD_POST,
  METHOD_GET,
}
