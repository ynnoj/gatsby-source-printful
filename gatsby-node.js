const { createRemoteFileNode } = require('gatsby-source-filesystem')

const PrintfulClient = require('./lib/printful')
const { parseNameForSlug, parsePriceString } = require('./lib/utils')

exports.sourceNodes = async (
  { actions: { createNode }, createContentDigest },
  { apiKey }
) => {
  const printful = new PrintfulClient({
    apiKey
  })

  const { result: products } = await printful.get('products')

  const processProduct = async ({ product, variantIds }) => {
    const nodeContent = JSON.stringify(product)

    const nodeData = {
      ...product,
      slug: parseNameForSlug(product.name),
      variantIds,
      id: product.external_id,
      parent: null,
      children: [],
      internal: {
        type: `PrintfulProduct`,
        content: nodeContent,
        contentDigest: createContentDigest(product)
      }
    }

    return nodeData
  }

  const processVariant = async ({ variant }) => {
    const nodeContent = JSON.stringify(variant)

    const nodeData = {
      ...variant,
      retail_price: parsePriceString(variant.retail_price),
      slug: parseNameForSlug(variant.name),
      id: variant.external_id,
      parent: null,
      children: [],
      internal: {
        type: `PrintfulVariant`,
        content: nodeContent,
        contentDigest: createContentDigest(variant)
      }
    }

    return nodeData
  }

  await Promise.all(
    products.map(async ({ id }) => {
      const {
        result: { sync_product: product, sync_variants }
      } = await printful.get(`products/${id}`)

      await sync_variants.map(async variant =>
        createNode(await processVariant({ variant }))
      )

      const variantIds = sync_variants.map(({ external_id: id }) => id)

      createNode(await processProduct({ product, variantIds }))
    })
  )
}

exports.onCreateNode = async ({
  node,
  actions: { createNode },
  store,
  cache,
  createNodeId,
  getNode
}) => {
  const createNodeFromURL = async url => {
    return await createRemoteFileNode({
      url,
      store,
      cache,
      createNode,
      createNodeId
    })
  }

  if (node.internal.type === `PrintfulProduct`) {
    let productImageNode

    try {
      productImageNode = await createNodeFromURL(node.thumbnail_url)
    } catch (e) {
      console.error('gatsby-source-printful: ERROR', e)
    }

    if (productImageNode) node.productImage___NODE = productImageNode.id

    const getVariantNodes = async () => {
      let variantNodes = []

      await node.variantIds.map(async variantId => {
        const variantNode = await getNode(variantId)

        if (variantNode) variantNodes.push(variantNode.id)
      })

      return variantNodes
    }

    node.variants___NODE = await getVariantNodes()
  }

  if (node.internal.type === `PrintfulVariant`) {
    const previewFile = node.files.find(file => file.type === `preview`)

    let variantImageNode

    try {
      variantImageNode = await createNodeFromURL(previewFile.preview_url)
    } catch (e) {
      console.error('gatsby-source-printful: ERROR', e)
    }

    if (variantImageNode) node.variantImage___NODE = variantImageNode.id
  }
}
