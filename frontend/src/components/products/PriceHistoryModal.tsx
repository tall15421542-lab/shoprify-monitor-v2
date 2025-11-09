import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import { usePriceHistory } from '../../hooks/useProducts';
import type { Product } from '../../types';
import { formatPrice } from '../../utils/price';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

function PriceHistoryModal({ isOpen, onClose, product }: PriceHistoryModalProps) {
  // Default to last 30 days
  const [dateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  });

  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [showUnchecked, setShowUnchecked] = useState(false);

  const { data: priceHistory, isLoading, error } = usePriceHistory(
    isOpen ? product._id : undefined,
    dateRange.startDate,
    dateRange.endDate
  );

  // Colors for different variants
  const variantColors = [
    '#0ea5e9', // sky-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#84cc16', // lime-500
    '#f97316', // orange-500
    '#14b8a6', // teal-500
    '#a855f7', // purple-500
    '#f43f5e', // rose-500
  ];

  // Analyze price changes for each variant
  const variantPriceStats = useMemo(() => {
    if (!priceHistory?.byVariant) return new Map();
    
    const stats = new Map<string, {
      hasChanged: boolean;
      minPrice: number;
      maxPrice: number;
      currentPrice?: number;
      previousPrice?: number;
      priceChangeCount: number;
      priceDirection?: 'up' | 'down' | 'unchanged';
    }>();
    
    priceHistory.byVariant.forEach(variant => {
      const prices = variant.priceHistory.map(h => h.price);
      const uniquePrices = new Set(prices);
      const hasChanged = uniquePrices.size > 1;
      
      // Determine price direction by comparing last two prices
      let priceDirection: 'up' | 'down' | 'unchanged' = 'unchanged';
      let currentPrice: number | undefined;
      let previousPrice: number | undefined;
      
      if (variant.priceHistory.length >= 2) {
        currentPrice = variant.priceHistory[variant.priceHistory.length - 1].price;
        previousPrice = variant.priceHistory[variant.priceHistory.length - 2].price;
        if (currentPrice > previousPrice) {
          priceDirection = 'up';
        } else if (currentPrice < previousPrice) {
          priceDirection = 'down';
        }
      }
      
      stats.set(variant.variantTitle, {
        hasChanged,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        currentPrice,
        previousPrice,
        priceChangeCount: uniquePrices.size,
        priceDirection,
      });
    });
    
    return stats;
  }, [priceHistory]);

  // Assign unique color to each variant
  const variantsWithColors = useMemo(() => {
    if (!priceHistory?.byVariant) return [];
    
    return priceHistory.byVariant.map((variant, index) => ({
      ...variant,
      color: variantColors[index % variantColors.length],
    })).sort((a, b) => a.currentPrice - b.currentPrice);
  }, [priceHistory]);

  // Set default selected variants - randomly pick up to 3 with different prices
  useMemo(() => {
    if (!priceHistory?.byVariant || selectedVariants.size > 0) return;
    
    // Group variants by their current price
    const priceMap = new Map<number, typeof priceHistory.byVariant[0][]>();
    priceHistory.byVariant.forEach(variant => {
      const existing = priceMap.get(variant.currentPrice) || [];
      priceMap.set(variant.currentPrice, [...existing, variant]);
    });
    
    // Get unique prices
    const uniquePrices = Array.from(priceMap.keys());
    
    // Randomly select up to 3 different prices
    const selectedPrices: number[] = [];
    const shuffledPrices = [...uniquePrices].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < Math.min(3, shuffledPrices.length); i++) {
      selectedPrices.push(shuffledPrices[i]);
    }
    
    // For each selected price, randomly pick one variant
    const defaultVariants = selectedPrices.map(price => {
      const variants = priceMap.get(price)!;
      const randomIndex = Math.floor(Math.random() * variants.length);
      return variants[randomIndex].variantTitle;
    });
    
    setSelectedVariants(new Set(defaultVariants));
  }, [priceHistory, selectedVariants.size]);

  // Create color map for variants
  const variantColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    variantsWithColors.forEach(variant => {
      colorMap.set(variant.variantTitle, variant.color);
    });
    return colorMap;
  }, [variantsWithColors]);

  const chartData = useMemo(() => {
    if (!priceHistory?.byVariant) return [];
    
    // Get all unique timestamps across all variants
    const allTimestamps = new Set<number>();
    priceHistory.byVariant.forEach(variant => {
      variant.priceHistory.forEach(entry => {
        allTimestamps.add(entry.timestamp.getTime());
      });
    });
    
    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort();
    
    // Build chart data with one entry per timestamp
    return sortedTimestamps.map(timestamp => {
      const dataPoint: any = {
        date: new Date(timestamp).toLocaleDateString(),
        time: new Date(timestamp).toLocaleTimeString(),
        timestamp,
      };
      
      // Add price for each variant at this timestamp
      priceHistory.byVariant.forEach(variant => {
        const entry = variant.priceHistory.find(
          e => e.timestamp.getTime() === timestamp
        );
        if (entry) {
          dataPoint[variant.variantTitle] = entry.price;
        }
      });
      
      return dataPoint;
    });
  }, [priceHistory]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Price History: ${product.title}`} size="5xl">
      {isLoading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      )}

      {error && (
        <ErrorMessage message="Failed to load price history. Please try again." />
      )}

      {priceHistory?.byVariant && priceHistory.byVariant.length > 0 ? (
        <div>
          {/* Price Summary Stats */}
          <div className="mb-4 flex items-center justify-between bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Total Variants</p>
              <p className="text-2xl font-bold text-gray-900">{priceHistory.byVariant.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Price Range</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPrice(variantsWithColors[0]?.currentPrice)} - {formatPrice(variantsWithColors[variantsWithColors.length - 1]?.currentPrice)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Selected</p>
              <p className="text-2xl font-bold text-primary-600">{selectedVariants.size}</p>
            </div>
          </div>

          {/* Individual Variants with Selection */}
          {variantsWithColors.length > 0 && (() => {
            const sortedVariants = [...variantsWithColors].sort((a, b) => {
              const aSelected = selectedVariants.has(a.variantTitle);
              const bSelected = selectedVariants.has(b.variantTitle);
              if (aSelected && !bSelected) return -1;
              if (!aSelected && bSelected) return 1;
              return a.currentPrice - b.currentPrice;
            });
            
            const checkedVariants = sortedVariants.filter(v => selectedVariants.has(v.variantTitle));
            const uncheckedVariants = sortedVariants.filter(v => !selectedVariants.has(v.variantTitle));
            
            const renderVariant = (variant: typeof variantsWithColors[0]) => {
              const stats = variantPriceStats.get(variant.variantTitle);
              const hasChanged = stats?.hasChanged || false;
              const isSelected = selectedVariants.has(variant.variantTitle);
              
              return (
                <label
                  key={variant.variantId}
                  className={`flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      const newSelected = new Set(selectedVariants);
                      if (e.target.checked) {
                        newSelected.add(variant.variantTitle);
                      } else {
                        newSelected.delete(variant.variantTitle);
                      }
                      setSelectedVariants(newSelected);
                    }}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: variant.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-900 font-medium truncate">{variant.variantTitle}</span>
                      <span className="text-sm font-semibold text-gray-700">
                        {formatPrice(variant.currentPrice)}
                      </span>
                      {hasChanged && stats && stats.priceDirection === 'up' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
                          📈 Up
                        </span>
                      )}
                      {hasChanged && stats && stats.priceDirection === 'down' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">
                          📉 Down
                        </span>
                      )}
                    </div>
                    {hasChanged && stats && stats.previousPrice !== undefined && stats.currentPrice !== undefined && (
                      <div className="flex items-center gap-2 text-xs mt-1">
                        <span className="text-gray-500">
                          {formatPrice(stats.previousPrice)} → {formatPrice(stats.currentPrice)}
                        </span>
                      </div>
                    )}
                  </div>
                </label>
              );
            };
            
            return (
              <div className="mb-6 border border-gray-200 rounded-lg">
                <div className="p-3 bg-gray-50 border-b border-gray-200">
                  <h4 className="font-semibold text-sm text-gray-700">Select Variants to Display</h4>
                </div>
                <div className="p-3 bg-white space-y-2 max-h-48 overflow-y-auto">
                  {/* Checked variants - always visible */}
                  {checkedVariants.map(renderVariant)}
                  
                  {/* Unchecked variants - collapsible if there are checked variants */}
                  {uncheckedVariants.length > 0 && checkedVariants.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowUnchecked(!showUnchecked)}
                        className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded transition-colors text-sm font-medium text-gray-700"
                      >
                        <span>Other variants ({uncheckedVariants.length})</span>
                        {showUnchecked ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {showUnchecked && uncheckedVariants.map(renderVariant)}
                    </>
                  )}
                  
                  {/* Show all if nothing is checked */}
                  {checkedVariants.length === 0 && uncheckedVariants.map(renderVariant)}
                </div>
              </div>
            );
          })()}

          <div className="h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
                          <p className="font-semibold text-gray-900 mb-1">{label}</p>
                          <p className="text-sm text-gray-600 mb-2">{data.time}</p>
                          <div className="space-y-1">
                            {payload.map((entry: any, index: number) => (
                              <div key={index} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-sm text-gray-600">{entry.name}:</span>
                                </div>
                                <span className="font-bold" style={{ color: entry.color }}>
                                  {formatPrice(entry.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* Only render lines for selected variants */}
                {priceHistory.byVariant
                  .filter(variant => selectedVariants.has(variant.variantTitle))
                  .map((variant) => {
                    const color = variantColorMap.get(variant.variantTitle)!;
                    return (
                      <Line
                        key={variant.variantId}
                        type="monotone"
                        dataKey={variant.variantTitle}
                        name={variant.variantTitle}
                        stroke={color}
                        strokeWidth={2}
                        dot={{ fill: color, r: 4 }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    );
                  })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing price history for the last 30 days
            </p>
            {selectedVariants.size === 0 && (
              <p className="text-sm text-amber-600 font-medium">
                Select at least one variant to view chart
              </p>
            )}
          </div>
        </div>
      ) : (
        !isLoading && !error && (
          <p className="text-gray-600 text-center py-8">
            No price history available for this product yet.
          </p>
        )
      )}
    </Modal>
  );
}

export default PriceHistoryModal;

