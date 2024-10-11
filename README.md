
# Outerspace Strapi-Medusa Plugins

![Plugin Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Strapi Version](https://img.shields.io/badge/strapi-%3E4.0.0-blue.svg)
![Medusa Version](https://img.shields.io/badge/medusa-%3E2.0.0-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E18.0.0-blue.svg)
![License: CoopyrightCode Light](https://img.shields.io/badge/license-CoopyrightCode_Light_v1.1-blue)


This monorepo contains two plugins designed to integrate **Medusa** and **Strapi**, enabling synchronization and extended management of Medusa objects within Strapi. 
The objective of these plugins is to synchronize Medusa's objects (such as products, categories, and orders) in Strapi, where their attributes can be extended with additional features like *internationalization (i18n)*, *media handling (images)*, and *extended product sheets*.

## Repository Structure

The repository is structured as follows:
- `medusa-outerspace-plugin-strapi/`: A Medusa plugin to communicate and synchronize data from Medusa to Strapi.
- `outerspace-strapi-plugin-medusa/`: A Strapi plugin to pull Medusa objects into Strapi and extend them with additional Strapi capabilities.

## Plugin Objectives

### 1. Medusa Plugin for Strapi (`medusa-outerspace-plugin-strapi`)
This plugin facilitates the communication between Medusa and Strapi. It allows Medusa to send product data, categories, and other objects to Strapi for further manipulation and extension. Medusa remains the source of truth for core ecommerce data (pricing, inventory, etc.), while Strapi enables advanced content management.

#### Key Features:
- Synchronizes Medusa's core objects such as products, categories, and orders into Strapi.
- Enables automatic updates of Strapi content when data changes in Medusa.
- Facilitates the transmission of product-related data from Medusa to Strapi.

### 2. Strapi Plugin for Medusa (`outerspace-strapi-plugin-medusa`)
This plugin pulls data from Medusa into Strapi, where the data can be enriched. Strapi allows for the management of internationalized content (i18n), detailed product descriptions, and media like images, creating a richer and more versatile CMS experience.

#### Key Features:
- Fetches Medusa data into Strapi for extended content management.
- Allows users to manage multilingual content (i18n) for Medusa products.
- Supports handling of images and product media, leveraging Strapi's robust media capabilities.
- Adds custom fields and attributes to Medusa objects within Strapi for enhanced product sheets.

## Use Cases

These plugins are especially useful for ecommerce platforms that:
- Want to use **Medusa** as their ecommerce backend, but require a powerful content management system like **Strapi** for product enrichment, translations, and media management.
- Need to manage multilingual (i18n) product details that are not natively supported in Medusa.
- Require an intuitive way to handle and store product images and other media through Strapi's media library.
- Desire extended content fields and attributes on products, categories, or orders.

## Installation

### Prerequisites
- A running instance of **Medusa**.
- A running instance of **Strapi**.
- Ensure you have Node.js and npm installed on your machine.

### Steps

1. Clone this repository:
   ```bash
   git clone https://github.com/Coopyrightdmin/outerspace-strapi-medusa.git
   ```

2. Navigate to the root of the project:
   ```bash
   cd outerspace-strapi-medusa
   ```

3. Install dependencies for both plugins using Lerna (or another package manager):
   ```bash
   npm install
   ```

4. Configure your Medusa and Strapi instances to include the respective plugins:
   - For **Medusa**, install the `medusa-outerspace-plugin-strapi`.
   - For **Strapi**, install the `outerspace-strapi-plugin-medusa`.


## Configuration

### Medusa Plugin Configuration (`medusa-outerspace-plugin-strapi`)
In your Medusa project, add the following configuration to enable synchronization with Strapi:

```javascript
// medusa-config.js
const config = {
  plugins: [
    // other plugins...
    {
      resolve: `medusa-outerspace-plugin-strapi`,
      options: {
        strapiUrl: `http://localhost:1337`, // Your Strapi instance URL
        apiToken: `YOUR_API_TOKEN`, // Strapi API Token
      },
    },
  ],
};

module.exports = config;
```

### Strapi Plugin Configuration (`outerspace-strapi-plugin-medusa`)
In your Strapi project, add the following configuration to connect with Medusa:

```javascript
// config/plugins.js
module.exports = {
  // other plugins...
  medusa: {
    enabled: true,
    resolve: "./plugins/strapi-plugin-medusa", // Ensure the plugin is correctly referenced
    config: {
      medusaUrl: `http://localhost:9000`, // Your Medusa instance URL
      apiKey: `YOUR_MEDUSA_API_KEY`,
    },
  },
};
```

## Contribution

We welcome contributions to improve and expand this project. Please refer to the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.

## License

This project is released under the **CoopyrightCode Light License v1.1**, which allows for free and open use of the code for non-commercial purposes only - see the [LICENSE](https://www.coopyrightcode.com) file for details. Future versions of the license will incorporate blockchain-based contribution tracking and remuneration mechanisms.

## Contact

For any inquiries or support, please open an issue in this repository or reach out to the maintainers.
