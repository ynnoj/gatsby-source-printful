<h2 align="center">
  gatsby-source-printful
</h2>

<p align="center">
  Printful store data for your Gatsby projects
</p>

## Getting Started

```sh
yarn add gatsby-source-printful
```

### Configuration

```js
// In your gatsby-config.js
plugins: [
  {
    resolve: `gatsby-source-printful`,
    options: {
      apiKey: '...',
      paginationLimit: 100 // Default value is 20
    },
  },
],
```
