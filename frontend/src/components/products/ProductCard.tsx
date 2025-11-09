import { useState } from 'react';
import { Package } from 'lucide-react';
import type { Product } from '../../types';
import { formatPrice } from '../../utils/price';
import PriceChange from './PriceChange';
import PriceHistoryModal from './PriceHistoryModal';

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);

  const imageSrc = product.images[0]?.src || '';
  const hasImage = !!imageSrc;
  const hasPriceChange = product.previousPrice && product.priceChange !== undefined;

  return (
    <>
      <div
        onClick={() => setIsHistoryModalOpen(true)}
        className="card hover:shadow-lg transition-all cursor-pointer border border-gray-200 relative"
      >
        {/* Price Change Status Badges */}
        {(product.hasVariantPriceUp || product.hasVariantPriceDown) && (
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 items-end">
            {product.hasVariantPriceUp && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                📈 Price Up
              </span>
            )}
            {product.hasVariantPriceDown && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                📉 Price Down
              </span>
            )}
          </div>
        )}
        
        {/* Product Image */}
        <div className="mb-4 bg-gray-100 rounded-lg overflow-hidden aspect-square flex items-center justify-center">
          {hasImage ? (
            <img
              src={imageSrc}
              alt={product.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = `
                  <div class="flex items-center justify-center w-full h-full">
                    <svg class="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21 16V8c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM5 8h14v8H5V8zm7 7c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
                    </svg>
                  </div>
                `;
              }}
            />
          ) : (
            <Package className="w-16 h-16 text-gray-400" />
          )}
        </div>

        {/* Product Info */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2" title={product.title}>
            {product.title}
          </h3>

          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold text-gray-900">
              {formatPrice(product.currentPrice)}
            </span>
            {hasPriceChange && product.priceChange !== 0 && (
              <PriceChange
                change={product.priceChange!}
                changePercent={product.priceChangePercent!}
              />
            )}
          </div>

          {product.vendor && (
            <p className="text-sm text-gray-600 mb-2">by {product.vendor}</p>
          )}

          {product.productType && (
            <div className="mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {product.productType}
              </span>
            </div>
          )}

          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {(showAllTags ? product.tags : product.tags.slice(0, 3)).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                >
                  {tag}
                </span>
              ))}
              {product.tags.length > 3 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllTags(!showAllTags);
                  }}
                  className="px-2 py-1 bg-primary-100 text-primary-700 hover:bg-primary-200 text-xs rounded font-medium transition-colors"
                >
                  {showAllTags ? 'Show less' : `+${product.tags.length - 3}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <PriceHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        product={product}
      />
    </>
  );
}

export default ProductCard;

