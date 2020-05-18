import React from 'react'
import { graphql, useStaticQuery } from 'gatsby'
import Img from 'gatsby-image'

const pageQuery = graphql`
  {
    products: allPrintfulProduct {
      nodes {
        id
        name
        productImage {
          childImageSharp {
            fluid(maxWidth: 560) {
              ...GatsbyImageSharpFluid
            }
          }
        }
        slug
        variants {
          retail_price
        }
      }
    }
  }
`

const IndexPage = () => {
  const { products } = useStaticQuery(pageQuery)

  return products.nodes.map((product) => (
    <article key={product.id}>
      <Img
        fluid={product.productImage.childImageSharp.fluid}
        style={{ width: '260px' }}
      />
      <h2>{product.name}</h2>
    </article>
  ))
}

export default IndexPage
