const { createRemoteFileNode } = require('gatsby-source-filesystem')

const PrintfulClient = require('./lib/printful')
const { parseNameForSlug, parsePriceString } = require('./lib/utils')

exports.sourceNodes = async (
  { actions: { createNode }, cache, createContentDigest, createNodeId, store },
  { apiKey }
) => {
  const printful = new PrintfulClient({
    apiKey
  })

  const { result } = await printful.get('products')
  const products = await Promise.all(
    result.map(async ({ id }) => await printful.get(`products/${id}`))
  )

  const processProduct = async ({ product, variantIds }) => {
    const { external_id, variants, ...rest } = product

    let productImageNode

    try {
      const { id } = await createRemoteFileNode({
        url: product.thumbnail_url,
        parentNodeId: product.external_id,
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
      variants___NODE: variantIds,
      productImage___NODE: productImageNode,
      id: product.external_id,
      internal: {
        type: `PrintfulProduct`,
        contentDigest: createContentDigest(product)
      }
    }

    return nodeData
  }

  const processVariant = async ({ variant }) => {
    const { external_id, variant_id, ...rest } = variant
    const previewFile = variant.files.find(file => file.type === `preview`)

    let variantImageNode

    try {
      const { id } = await createRemoteFileNode({
        url: previewFile.preview_url,
        parentNodeId: variant.external_id,
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
      ...rest,
      slug: parseNameForSlug(variant.name),
      retail_price: parsePriceString(variant.retail_price),
      variantImage___NODE: variantImageNode,
      id: variant.external_id,
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
        await variants.map(async variant =>
          createNode(await processVariant({ variant }))
        )

        const variantIds = variants.map(({ external_id: id }) => id)

        createNode(await processProduct({ product, variantIds }))
      }
    )
  )
}
