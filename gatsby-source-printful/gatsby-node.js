const { createRemoteFileNode } = require('gatsby-source-filesystem')

const PrintfulClient = require('./lib/printful')
const { parseNameForSlug, parsePriceString } = require('./lib/utils')

exports.sourceNodes = async (
  {
    actions: { createNode },
    cache,
    createContentDigest,
    createNodeId,
    store,
    reporter
  },
  { apiKey, paginationLimit = 20 }
) => {
  if (!apiKey)
    return reporter.panic(
      'gatsby-source-printful: You must provide your Printful API key'
    )

  if (
    !paginationLimit ||
    !Number.isInteger(paginationLimit) ||
    paginationLimit > 100
  )
    return reporter.panic(
      'gatsby-source-printful: `paginationLimit` must be an integer, no greater than 100'
    )

  const printful = new PrintfulClient({
    apiKey
  })

  const getAllProducts = async () => {
    let records = []
    let keepGoing = true
    let offset = 0

    while (keepGoing) {
      const { paging, result } = await printful.get(
        `sync/products?limit=${paginationLimit}&offset=${offset}`
      )

      records = [...records, ...result]
      offset += paginationLimit

      if (result.length < paginationLimit || paging.total === records.length) {
        keepGoing = false

        return records
      }
    }
  }

  const result = await getAllProducts()
  const products = await Promise.all(
    result.map(async ({ id }) => await printful.get(`sync/products/${id}`))
  )
  const { result: countries } = await printful.get(`countries`)

  const processCountry = async (country) => {
    const nodeData = {
      ...country,
      id: `country-${country.code}`,
      internal: {
        type: `PrintfulCountry`,
        contentDigest: createContentDigest(country)
      }
    }

    return nodeData
  }

  const processProduct = async ({ product, variants }) => {
    const { variants, ...rest } = product

    let productImageNode

    try {
      const { id } = await createRemoteFileNode({
        url: product.thumbnail_url,
        parentNodeId: product.id,
        store,
        cache,
        createNode,
        createNodeId
      })

      productImageNode = id
    } catch (e) {
      console.error('gatsby-source-printful:', e)
    }

    const nodeData = {
      ...rest,
      slug: parseNameForSlug(product.name),
      variants___NODE: variants.map(({ id }) => id),
      productImage___NODE: productImageNode,
      internal: {
        type: `PrintfulProduct`,
        contentDigest: createContentDigest(product)
      }
    }

    return nodeData
  }

  const processVariant = async ({ variant, product }) => {
    const previewFile = variant.files.find((file) => file.type === `preview`)

    let variantImageNode

    if (previewFile) {
      try {
        const { id } = await createRemoteFileNode({
          url: previewFile.preview_url,
          parentNodeId: variant.id,
          store,
          cache,
          createNode,
          createNodeId
        })

        variantImageNode = id
      } catch (e) {
        console.error('gatsby-source-printful:', e)
      }
    }

    const nodeData = {
      ...variant,
      slug: parseNameForSlug(variant.name),
      retail_price: parsePriceString(variant.retail_price),
      parentProduct___NODE: product.id,
      variantImage___NODE: variantImageNode,
      internal: {
        type: `PrintfulVariant`,
        contentDigest: createContentDigest(variant)
      }
    }

    return nodeData
  }

  await Promise.all(
    products.map(
      async ({
        result: { sync_product: product, sync_variants: variants }
      }) => {
        await variants.map(async (variant) =>
          createNode(await processVariant({ variant, product }))
        )

        createNode(await processProduct({ product, variants }))
      }
    )
  )

  await Promise.all(
    countries.map(async (country) => createNode(await processCountry(country)))
  )
}
