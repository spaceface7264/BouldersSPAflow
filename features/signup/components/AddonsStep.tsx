import React, { useState } from 'react';
import { useSignupStore } from '../state';
import { BaseStep } from './BaseStep';
import { Card, CardContent, Button } from '../../../shared/ui';
import { ADDON_PRODUCTS } from '../../../shared/constants';
import type { AddonSelection } from '../../../shared/types';

export const AddonsStep: React.FC = () => {
  const { draft, updateDraft, nextStep } = useSignupStore();
  const [selectedAddons, setSelectedAddons] = useState<AddonSelection[]>(
    draft.addons || []
  );

  const handleAddonToggle = (product: typeof ADDON_PRODUCTS[0]) => {
    const existingIndex = selectedAddons.findIndex(addon => addon.id === product.id);
    
    if (existingIndex >= 0) {
      // Remove addon
      const newAddons = selectedAddons.filter((_, index) => index !== existingIndex);
      setSelectedAddons(newAddons);
      updateDraft({ addons: newAddons });
    } else {
      // Add addon
      const newAddon: AddonSelection = {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
      };
      const newAddons = [...selectedAddons, newAddon];
      setSelectedAddons(newAddons);
      updateDraft({ addons: newAddons });
    }
  };

  const handleQuantityChange = (addonId: string, quantity: number) => {
    const newAddons = selectedAddons.map(addon =>
      addon.id === addonId ? { ...addon, quantity } : addon
    );
    setSelectedAddons(newAddons);
    updateDraft({ addons: newAddons });
  };

  const handleNext = () => {
    nextStep();
  };

  const isAddonSelected = (productId: string) => {
    return selectedAddons.some(addon => addon.id === productId);
  };

  const getAddonQuantity = (productId: string) => {
    const addon = selectedAddons.find(addon => addon.id === productId);
    return addon?.quantity || 0;
  };

  return (
    <BaseStep
      stepId="addons"
      canProceed={true}
      onNext={handleNext}
      nextButtonText="Continue to Review"
    >
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-gray-600">
            All items are available at special member prices and can be added to your order.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ADDON_PRODUCTS.map((product) => {
            const isSelected = isAddonSelected(product.id);
            const quantity = getAddonQuantity(product.id);

            return (
              <Card
                key={product.id}
                isClickable
                isSelected={isSelected}
                onClick={() => handleAddonToggle(product)}
                className="h-full"
              >
                <CardContent className="h-full flex flex-col">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{product.name}</h3>
                    <p className="text-gray-600 mb-4">{product.description}</p>
                    
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-purple-600">
                        {product.price}kr
                      </span>
                      {product.originalPrice && (
                        <span className="text-lg text-gray-400 line-through ml-2">
                          {product.originalPrice}kr
                        </span>
                      )}
                    </div>

                    <ul className="space-y-2 mb-6">
                      {product.features.map((feature: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <svg
                            className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="text-sm text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {isSelected && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity
                      </label>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (quantity > 1) {
                              handleQuantityChange(product.id, quantity - 1);
                            }
                          }}
                          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                        >
                          -
                        </button>
                        <span className="w-12 text-center font-medium">{quantity}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (quantity < 10) {
                              handleQuantityChange(product.id, quantity + 1);
                            }
                          }}
                          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Total: {product.price * quantity}kr
                      </div>
                    </div>
                  )}

                  <Button
                    variant={isSelected ? 'primary' : 'outline'}
                    className="w-full"
                  >
                    {isSelected ? 'Remove from Cart' : 'Add to Cart'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {selectedAddons.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Selected Add-ons</h4>
            <div className="space-y-2">
              {selectedAddons.map((addon) => (
                <div key={addon.id} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">
                    {addon.name} × {addon.quantity}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {addon.price * addon.quantity}kr
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between items-center font-medium">
                  <span>Total Add-ons</span>
                  <span>
                    {selectedAddons.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0)}kr
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </BaseStep>
  );
};
