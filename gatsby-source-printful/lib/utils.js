exports.parseNameForSlug = (name) => name.replace(/[\s-]+/g, '-').toLowerCase()

exports.parsePriceString = (price) => parseFloat(price)
