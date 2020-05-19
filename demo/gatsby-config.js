require('dotenv').config()

module.exports = {
  plugins: [
    {
      resolve: 'gatsby-source-printful',
      options: {
        apiKey: process.env.PRINTFUL_API_KEY,
        paginationLimit: 100
      }
    },
    'gatsby-plugin-sharp',
    'gatsby-transformer-sharp'
  ]
}
