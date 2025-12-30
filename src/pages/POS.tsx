import React, { useState, useEffect, useMemo } from 'react';
import { Search, Grid, List, Trash2, Plus, Minus, CreditCard, Banknote, QrCode, AlertCircle, Clock } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { Product, OrderType, PaymentMethod } from '@/types';
import { productAPI, categoryAPI } from '@/src/api/api';

const POS: React.FC = () => {
  const { inventory, cart, addToCart, removeFromCart, updateCartQuantity, clearCart, placeOrder, currentTime } = useStore();
  const [products, setProducts] = useState();
  const [categories, setCategories] = useState();

  const fetchProducts = async () => {
  try {
    const res = await productAPI.getAllProducts();
    setProducts(res.data || []);
  } catch (error) {
  }
};

const fetchCategories = async () => {
  try {
    const res = await categoryAPI.getAllCategories();
    setCategories(res.data || []);
  } catch (error) {
  }
};

useEffect(() => {
  fetchProducts();
  fetchCategories();
}, []);

  // Local State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [orderType, setOrderType] = useState<OrderType>('takeaway');

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  // Default and only option is cash
  const paymentMethod: PaymentMethod = 'cash';
  const [isProcessing, setIsProcessing] = useState(false);

  // Time Logic
  const currentHour = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();

  const isAlcoholAllowed = currentHour >= 17;
  const isEatInAllowed = currentHour < 20 || (currentHour === 20 && currentMinutes < 30);

  // Auto-switch to Takeaway if Eat-in is disabled
  useEffect(() => {
    if (!isEatInAllowed && orderType === 'eat-in') {
      setOrderType('takeaway');
    }
  }, [isEatInAllowed, orderType]);

  // Derived State
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];

    return products.filter(p => {
      const matchesSearch =
        p.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all'
          ? true
          : String(p.category_id) === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);




  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Handlers
  const handleProductClick = (product: Product) => {
    if (product.is_alcoholic && !isAlcoholAllowed) {
      alert('アルコール類は17:00以降のみ販売可能です。');
      return;
    }

    // Check inventory ONLY for food/merchandise
    const isStockManaged = product.type !== 'drink' && product.type !== 'alcohol';

    if (isStockManaged) {
      const inv = inventory.find(i => i.product_id === product.product_id);
      if (!inv || inv.current_quantity <= 0) {
        alert('在庫切れです (Out of Stock)');
        return;
      }
    }
    addToCart(product);
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    // Direct payment assumes exact amount received
    const received = totalAmount;

    // Simulate API delay
    setTimeout(async () => {
      const success = await placeOrder(orderType, paymentMethod, received);
      if (success) {
        setIsPaymentModalOpen(false);
        // Show success feedback logic could go here
      }
      setIsProcessing(false);
    }, 800);
  };

  return (
    <div className="flex h-full">
      {/* LEFT: Product Catalog */}
      <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
        {/* Header: Search & Category */}
        <div className="p-4 bg-white border-b border-gray-200 shadow-sm z-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">商品一覧</h2>
            <div className="flex items-center text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              <Clock className="w-4 h-4 mr-2" />
              {currentTime.toLocaleDateString('ja-JP')} {currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div className="flex space-x-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="商品を検索..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium ${selectedCategory === 'all'
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600'
                }`}
            >
              すべて
            </button>

            {Array.isArray(categories) && categories.map(cat => (
              <button
                key={cat.category_id}
                onClick={() => setSelectedCategory(String(cat.category_id))}
                className={`px-4 py-2 rounded-full text-sm font-medium ${selectedCategory === String(cat.category_id)
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600'
                  }`}
              >
                {cat.name}
              </button>
            ))}



          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
            {filteredProducts.map(product => {
              const stock = inventory.find(i => i.product_id === product.product_id)?.current_quantity || 0;
              const isStockManaged = product.type !== 'drink' && product.type !== 'alcohol';

              const isOutOfStock = isStockManaged && stock <= 0;
              const isAlcoholRestricted = product.is_alcoholic && !isAlcoholAllowed;

              return (
                <div
                  key={product.product_id}
                  onClick={() => !isOutOfStock && !isAlcoholRestricted && handleProductClick(product)}
                  className={`
                    relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer transition-transform active:scale-95
                    ${(isOutOfStock || isAlcoholRestricted) ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:shadow-md hover:border-brand-300'}
                  `}
                >
                  <div className="aspect-square bg-gray-100 relative">
                    <img src={`${import.meta.env.VITE_BASE_URL}/${product.image}`} alt={product.name} className="w-full h-full object-cover" />
                      
                    {isStockManaged && stock > 0 && (
                      <span className={`absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-full shadow-sm z-10 ${stock <= 5 ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-800 border border-gray-200 backdrop-blur-sm'}`}>
                        {stock <= 5 ? `残り ${stock}` : `在庫: ${stock}`}
                      </span>
                    )}
                    {isAlcoholRestricted && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">17:00~ 販売</span>
                      </div>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">SOLD OUT</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-gray-800 text-sm truncate">{product.name}</h3>
                    <p className="text-brand-600 font-bold mt-1">¥{product.price.toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT: Cart & Checkout */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg z-20">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex rounded-lg bg-gray-200 p-1 mb-4">
            <button
              onClick={() => isEatInAllowed && setOrderType('eat-in')}
              disabled={!isEatInAllowed}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${orderType === 'eat-in' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'} ${!isEatInAllowed ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              店内 (Eat-in)
              {!isEatInAllowed && <span className="block text-[10px] text-red-500">20:30終了</span>}
            </button>
            <button
              onClick={() => setOrderType('takeaway')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${orderType === 'takeaway' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}
            >
              持ち帰り (Takeaway)
            </button>
          </div>
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg text-gray-700">現在の注文</h2>
            <button onClick={clearCart} className="text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
              <Grid className="w-16 h-16 mb-2" />
              <p>カートは空です</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product_id} className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800 text-sm">{item.name}</h4>
                  <p className="text-brand-600 text-sm font-bold"> ¥{item.price.toLocaleString()}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button onClick={() => updateCartQuantity(item.product_id, -1)} className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-gray-700 w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateCartQuantity(item.product_id, 1)} className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between mb-2 text-gray-600">
            <span>小計 ({totalItems}点)</span>
            <span>¥{(totalAmount).toLocaleString()}</span>
          </div>

          <div className="flex justify-between mb-6 pt-4 border-t border-dashed border-gray-300">
            <span className="text-xl font-bold text-gray-800">合計</span>
            <span className="text-2xl font-bold text-brand-600">¥{totalAmount.toLocaleString()}</span>
          </div>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            disabled={cart.length === 0}
            className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            会計に進む
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">お支払い (現金のみ)</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-6 space-y-6">
              <div className="text-center mb-6">
                <p className="text-gray-500 mb-1">お支払い合計</p>
                <p className="text-4xl font-extrabold text-gray-800">¥{totalAmount.toLocaleString()}</p>
              </div>

              <div className="bg-brand-50 p-6 rounded-xl border border-brand-100 text-center">
                <p className="text-brand-800 font-medium mb-2">会計内容を確認して完了してください</p>
                <p className="text-sm text-gray-500">＿＿＿＿＿</p>
              </div>

            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50">
              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-lg shadow-md hover:bg-brand-700 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
              >
                {isProcessing ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : null}
                {isProcessing ? '処理中...' : '会計を完了する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;