## Mock Data CLI

The mock data CLI generates synthetic Shopify product data and writes it into the monitoring database so downstream services can exercise subscription and aggregation flows.

### Usage

```bash
node cli/mock-data-cli.js \
  --poll-url https://mous.co \
  --adjust-price-range 7.5 \
  --ratio-of-mock 0.25 \
  --limit 250 \
  --page 1
```

You can generate data for multiple storefronts in a single run by passing `--poll-url` multiple times or with a comma-separated list:

```bash
node cli/mock-data-cli.js \
  --poll-url https://mous.co \
  --poll-url https://uncrate.com \
  --poll-url https://example-store.myshopify.com

# or

node cli/mock-data-cli.js \
  --poll-url https://mous.co,https://uncrate.com,https://example-store.myshopify.com
```

Alternatively, you can run the npm script:

```bash
npm run mock:data -- --poll-url https://mous.co
```

### Arguments

- `--poll-url` (required, repeatable): Base Shopify store URL. The tool fetches product data from `{poll-url}/products.json`. Provide the flag multiple times or as a comma-separated list to process several stores in sequence.
- `--adjust-price-range` (optional): Maximum absolute delta applied to selected variant prices. Defaults to `5`, representing ±5 currency units.
- `--ratio-of-mock` (optional): Portion of products to adjust. Defaults to `0.2` (20%). Values above `1` are clamped to `1`, and non-positive values fall back to the default.
- `--limit` and `--page` (optional): Pagination options for fetching the product list. Defaults to `limit=250`, `page=1`.
- `--mongo-uri` / `--db-name` (optional): Override the MongoDB connection (defaults match the rest of the project: `mongodb://localhost:27017`, `shopify_monitor`).
- `--aggregate-url` (optional): Trigger endpoint for analytics aggregation. Defaults to `http://localhost:3001/aggregate/current`.

### Behaviour

1. Fetches products from the storefront JSON endpoint.
2. Chooses the configured ratio of products and randomly adjusts their variant prices within the configured range.
3. Aligns timestamps to the next wall-clock hour window to match analytical processing expectations.
4. Upserts product documents into the `products` collection and inserts corresponding entries into `price_snapshots`.
5. Invokes the trigger API aggregate endpoint to rebuild hourly metrics for the affected window.
6. Queries the database to report the total products found for the store, snapshot counts for the new window, and a sample of updated variant prices.

The CLI is self-contained and does not import code from the backend, frontend, or data-processing packages.


