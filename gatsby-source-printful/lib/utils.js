exports.base64Encode = (string) => Buffer.from(string).toString('base64')

exports.parseNameForSlug = (name) => name.replace(/[\s-]+/g, '-').toLowerCase()

exports.parsePriceString = (price) => parseFloat(price)
