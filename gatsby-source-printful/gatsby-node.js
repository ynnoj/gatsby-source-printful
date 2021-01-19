const { createRemoteFileNode } = require('gatsby-source-filesystem')

const PrintfulClient = require('./lib/printful')
const { parseNameForSlug, parsePriceString } = require('./lib/utils')

exports.pluginOptionsSchema = ({ Joi }) => {
  return Joi.object({
    apiKey: Joi.string()
      .required()
      .description('Your Printful API key')
      .messages({
        'any.required': 'You must provide your Printful API key'
      }),
    paginationLimit: Joi.number()
      .integer()
      .max(100)
      .min(10)
      .default(20)
      .description(
        'The number of records to be fetched from Printful in a single API request'
      )
  })
}

exports.sourceNodes = async (
  { actions: { createNode }, cache, createContentDigest, createNodeId, store },
  { apiKey, paginationLimit }
) => {
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

  const catalogProductIds = products
    .map(({ result: { sync_variants: variants } }) =>
      variants.map(({ product }) => product.product_id)
    )
    .flat()

  const uniqueCatalogProductIds = catalogProductIds.reduce(
    (unique, item) => (unique.includes(item) ? unique : [...unique, item]),
    []
  )

  const catalogProducts = await Promise.all(
    uniqueCatalogProductIds.map(
      async (id) => await printful.get(`products/${id}`)
    )
  )

  const { result: countries } = await printful.get(`countries`)
  const { result: storeInformation } = await printful.get(`store`)

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
    const { variants: variantCount, ...rest } = product
    const sync_product_id = product.id.toString()

    let productImageNode

    try {
      const { id } = await createRemoteFileNode({
        url: product.thumbnail_url,
        parentNodeId: sync_product_id,
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
      id: sync_product_id,
      slug: parseNameForSlug(product.name),
      variants___NODE: variants.map(({ id }) => id.toString()),
      productImage___NODE: productImageNode,
      internal: {
        type: `PrintfulProduct`,
        contentDigest: createContentDigest(product)
      }
    }

    return nodeData
  }

  const processVariant = async ({ variant, product }) => {
    const sync_product_id = product.id.toString()
    const sync_variant_id = variant.id.toString()

    const previewFile = variant.files.find((file) => file.type === `preview`)

    let variantImageNode

    if (previewFile) {
      try {
        const { id } = await createRemoteFileNode({
          url: previewFile.preview_url,
          parentNodeId: sync_variant_id,
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
      id: sync_variant_id,
      slug: parseNameForSlug(variant.name),
      retail_price: parsePriceString(variant.retail_price),
      parentProduct___NODE: sync_product_id,
      catalogVariant___NODE: variant.variant_id.toString(),
      catalogProduct___NODE: variant.product.product_id.toString(),
      variantImage___NODE: variantImageNode,
      internal: {
        type: `PrintfulVariant`,
        contentDigest: createContentDigest(variant)
      }
    }

    return nodeData
  }

  const processCatalogProduct = async ({ product: { id, ...product } }) => {
    const product_id = id.toString()

    let productImageNode

    try {
      const { id } = await createRemoteFileNode({
        url: product.image,
        parentNodeId: product_id,
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
      ...product,
      id: product_id,
      productImage___NODE: productImageNode,
      internal: {
        type: `PrintfulCatalogProduct`,
        contentDigest: createContentDigest(product)
      }
    }

    return nodeData
  }

  const processCatalogVariant = async ({
    variant: { id, product_id: productId, ...variant }
  }) => {
    const variant_id = id.toString()
    const product_id = productId.toString()

    let variantImageNode

    try {
      const { id } = await createRemoteFileNode({
        url: variant.image,
        parentNodeId: variant_id,
        store,
        cache,
        createNode,
        createNodeId
      })

      variantImageNode = id
    } catch (e) {
      console.error('gatsby-source-printful:', e)
    }

    const nodeData = {
      ...variant,
      id: variant_id,
      product_id,
      retail_price: parsePriceString(variant.price),
      variantImage___NODE: variantImageNode,
      internal: {
        type: `PrintfulCatalogVariant`,
        contentDigest: createContentDigest(variant)
      }
    }

    return nodeData
  }

  const processStoreInformation = async ({ id, payment_card, ...store }) => ({
    ...store,
    id: id.toString(),
    internal: {
      type: `PrintfulStore`,
      contentDigest: createContentDigest(store)
    }
  })

  await Promise.all(
    catalogProducts.map(async ({ result: { product, variants } }) => {
      createNode(await processCatalogProduct({ product }))

      await Promise.all(
        variants.map(async (variant) =>
          createNode(await processCatalogVariant({ variant }))
        )
      )
    }),
    products.map(
      async ({
        result: { sync_product: product, sync_variants: variants }
      }) => {
        await Promise.all(
          variants.map(async (variant) =>
            createNode(await processVariant({ variant, product }))
          )
        )

        createNode(await processProduct({ product, variants }))
      }
    )
  )

  await Promise.all(
    countries.map(async (country) => createNode(await processCountry(country)))
  )

  await createNode(await processStoreInformation(storeInformation))
}
