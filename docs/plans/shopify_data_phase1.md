# Shopify Data Collection - Phase 1 Implementation Plan
## Prompt
### Requirement
1. Given a shopify website, poll the product data into the database in raw data
2. Raw data will later be transformed to support complext query

### Example URL
- https://www.mous.co/

### Tips
- The product data is in the {URL}/products.json?limit={Integer}&page={Integer}, example https://www.mous.co/products.json?limit=250&page=1
- Write very simple, minimum code that only implement the requirement


## Overview
Poll Shopify product data from multiple stores and save data to document database with embedded price history.

## Database Schema (Document Database - MongoDB)

### Stores Collection
```javascript
{
  _id: ObjectId,
  store_url: "https://mous.co",
  store_name: "Mous",
  active: true,
  polling_interval: 60,  // seconds
  created_at: ISODate,
  last_polled_at: ISODate
}

// Indexes
db.stores.createIndex({ "store_url": 1 }, { unique: true })
db.stores.createIndex({ "active": 1, "last_polled_at": 1 })
```

### Products Collection
```javascript
{
  _id: ObjectId,
  product_id: 6655824986170,  // Shopify product ID
  store_id: ObjectId,          // Reference to stores collection
  handle: "iphone-15-pro-max-case",
  title: "iPhone 15 Pro Max Case",
  product_type: "Phone Cases",
  vendor: "Mous",
  tags: ["iPhone", "Case", "Pro Max"],
  main_image_url: "https://...",
  created_at: ISODate,         // When product was created in Shopify
  updated_at: ISODate,         // Last updated in Shopify
  last_polled_at: ISODate,     // Last time we fetched this product

  // Embedded variants with price history
  variants: [
    {
      variant_id: 39491972595770,  // Shopify variant ID
      variant_title: "Black - Aramid Fibre",
      current_price: 49.99,
      image_url: "https://...",

      // Embedded price history (append-only array)
      price_history: [
        {
          price: 59.99,
          recorded_at: ISODate("2025-01-01T10:00:00Z")
        },
        {
          price: 54.99,
          recorded_at: ISODate("2025-01-15T10:00:00Z")
        },
        {
          price: 49.99,
          recorded_at: ISODate("2025-02-01T10:00:00Z")
        }
      ]
    },
    {
      variant_id: 39491972628538,
      variant_title: "Blue - Aramid Fibre",
      current_price: 49.99,
      image_url: "https://...",
      price_history: [
        {
          price: 59.99,
          recorded_at: ISODate("2025-01-01T10:00:00Z")
        },
        {
          price: 49.99,
          recorded_at: ISODate("2025-01-15T10:00:00Z")
        }
      ]
    }
  ],

  // Full raw JSON from Shopify API
  raw_data: { /* complete Shopify product JSON */ }
}

// Indexes
db.products.createIndex({ "product_id": 1, "store_id": 1 }, { unique: true })
db.products.createIndex({ "store_id": 1, "last_polled_at": -1 })
db.products.createIndex({ "variants.variant_id": 1 })
db.products.createIndex({ "handle": 1, "store_id": 1 })
db.products.createIndex({ "vendor": 1, "store_id": 1 })
db.products.createIndex({ "product_type": 1, "store_id": 1 })
```

**Design Notes:**
- **Embedded Design**: Variants and price history embedded in product document
- **Price History**: Append-only array within each variant (use `$push` operator)
- **Current State**: `current_price` field tracks latest price for quick access
- **Simple Updates**: Single document update per product (no joins needed)
- **Efficient Reads**: All product data in one document - no joins required
- **Scalability**: Each product is independent - easy to shard by product_id or store_id
- **Raw Data**: Full Shopify JSON preserved for future needs
- **Trade-off**: Larger documents but simpler queries and faster reads

## Data Extraction

### API Endpoint
`{store_url}/products.json?limit=250&page={page}`

Example: `https://mous.co/products.json?limit=250&page=1`

### Fields to Extract

**From Product:**
- `id` → product_id
- `handle` → handle
- `title` → title
- `product_type` → product_type
- `vendor` → vendor
- `tags` → tags
- `images[0].src` → main_image_url
- `created_at` → created_at
- `updated_at` → updated_at
- Full JSON → raw_data

**From Variants (to product_variants table):**
- `variants[].id` → variant_id
- `variants[].product_id` → product_id (links to parent product)
- `variants[].title` → variant_title
- `variants[].price` → price
- `variants[].featured_image.src` → image_url (or null if no featured image)
- Current timestamp → polled_at
- Store ID → store_id

## Implementation Components

### 1. Fetcher Function
```
fetch_products(store_url):
  - Build URL: {store_url}/products.json?limit=250&page={page}
  - Loop through pages (page 1, 2, 3...) until empty response
  - Return all products from all pages
  - Handle HTTP errors gracefully
```

### 2. Parser Function
```
parse_product(product_json, store_id):
  Product data:
  - Extract product_id, handle, title, product_type, vendor, tags
  - Extract main_image_url from images[0].src (or null if no images)
  - Extract created_at, updated_at timestamps
  - Keep full raw_data as JSONB
  - Add current timestamp as polled_at
  - Add store_id

  Variant data (for each variant):
  - Extract variant_id from variants[].id
  - Extract product_id (parent product)
  - Extract variant_title from variants[].title
  - Extract price from variants[].price
  - Extract image_url from variants[].featured_image.src
  - Add current timestamp as polled_at
  - Add store_id

  Return: {product_data, variants_data[]}
```

### 3. Main Polling Loop
```
poll_all_stores():
  - stores = get_active_stores()
  - For each store:
    1. products = fetch_products(store.store_url)
    2. For each product:
       - {product_data, variants_data} = parse_product(product, store.store_id)
       - save_to_db(product_data, variants_data)
    3. update_last_polled(store.store_id)
  - Sleep until next interval
  - Repeat
```

## File Structure

```
/src
  /database
    - connection.js       (MongoDB connection)
    - models.js           (document schemas and indexes)
    - operations.js       (upsert, query operations)
  /services
    - fetcher.js          (HTTP client + pagination)
    - parser.js           (extract and transform data)
    - poller.js           (main polling orchestration)
  /config
    - config.js           (MongoDB URI, database name, intervals)
  - main.js               (entry point, scheduler)
```

## Implementation Order

1. **Database Setup**
   - Set up MongoDB connection
   - Create indexes
   - Write upsert operations

2. **Fetcher**
   - HTTP client for products.json
   - Pagination logic
   - Error handling

3. **Parser**
   - Field extraction logic
   - Data transformation

4. **Storage**
   - Document upsert implementation
   - Price history append logic
   - Store management functions

5. **Main Loop**
   - Polling orchestration
   - Scheduler/cron

## Example Usage

### Seed Initial Store
```javascript
db.stores.insertOne({
  store_url: "https://mous.co",
  store_name: "Mous",
  active: true,
  polling_interval: 60,
  created_at: new Date(),
  last_polled_at: null
})
```

### Run Poller
```bash
npm start
```

## Key Principles

- **Keep it simple**: ~150-200 lines of code total
- **Store raw data**: Full JSON preserved in raw_data field for future needs
- **Embedded design**: Variants and price history in single document for fast reads
- **Append-only history**: Price history array grows over time (use `$push`)
- **Denormalized**: All product data in one document - no joins needed
- **Multi-store support**: Scale to monitor multiple Shopify stores
- **Error resilient**: Handle API failures without crashing
- **Document size**: Monitor document size (MongoDB 16MB limit - unlikely to hit with price data)

## Next Phase (Future)

- Transform raw data for complex queries
- Add analytics/reporting
- Webhook support for real-time updates
- Price drop alerts/notifications
