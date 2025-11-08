/**
 * Fetch all products from a Shopify store
 * Uses pagination to get all products (limit 250 per page)
 */
export async function fetchProducts(storeUrl) {
  const allProducts = [];
  let page = 1;
  let hasMoreProducts = true;

  console.log(`Fetching products from ${storeUrl}...`);

  while (hasMoreProducts) {
    try {
      const url = `${storeUrl}/products.json?limit=250&page=${page}`;
      console.log(`  Fetching page ${page}...`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.products && data.products.length > 0) {
        allProducts.push(...data.products);
        console.log(`  ✓ Page ${page}: ${data.products.length} products`);
        page++;
      } else {
        hasMoreProducts = false;
      }
    } catch (error) {
      console.error(`  ✗ Error fetching page ${page}:`, error.message);
      throw error;
    }
  }

  console.log(`✓ Total products fetched: ${allProducts.length}`);
  return allProducts;
}
