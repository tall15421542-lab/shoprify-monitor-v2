/**
 * Parse a single product from Shopify JSON format
 * Extracts product data and variants data
 */
export function parseProduct(productJson) {
  // Extract product data
  const productData = {
    product_id: productJson.id,
    handle: productJson.handle,
    title: productJson.title,
    product_type: productJson.product_type || '',
    vendor: productJson.vendor || '',
    tags: productJson.tags || [],
    main_image_url: productJson.images && productJson.images.length > 0
      ? productJson.images[0].src
      : null,
    created_at: productJson.created_at ? new Date(productJson.created_at) : new Date(),
    updated_at: productJson.updated_at ? new Date(productJson.updated_at) : new Date(),
    raw_data: productJson
  };

  // Extract variants data
  const variantsData = (productJson.variants || []).map(variant => ({
    variant_id: variant.id,
    variant_title: variant.title,
    price: parseFloat(variant.price),
    image_url: variant.featured_image?.src || null
  }));

  return {
    productData,
    variantsData
  };
}
