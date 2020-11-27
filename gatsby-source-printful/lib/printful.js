const fetch = require('isomorphic-unfetch')

const { base64Encode } = require('./utils')

class PrintfulClient {
  constructor({ apiKey }) {
    this.printfulApiKey = apiKey
  }

  async request(method, path) {
    const uri = `https://api.printful.com/${path}`

    const response = await fetch(uri, {
      method,
      headers: {
        Authorization: `Basic ${base64Encode(this.printfulApiKey)}`
      }
    })

    if (!response.ok)
      throw new Error(
        `Printful API: [${response.status}] ${response.statusText}`
      )

    const json = await response.json()

    return json
  }

  get(path) {
    return this.request('GET', path)
  }
}

module.exports = PrintfulClient
