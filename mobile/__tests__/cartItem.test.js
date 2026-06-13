import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../src/context/ShopContext', () => ({
  useShop: () => ({ formatCurrency: (n) => `XAF ${n}` }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

import CartItem from '../src/screens/pos/CartItem';

const makeItem = (overrides = {}) => ({
  cartKey: 'prod-1',
  product: { id: 'prod-1', name: 'Nescafé 500g', price: 1500 },
  variant: null,
  quantity: 2,
  ...overrides,
});

describe('CartItem', () => {
  test('renders product name and computed subtotal', () => {
    const { getByText, getByTestId } = render(
      <CartItem item={makeItem()} onRemove={jest.fn()} onChangeQty={jest.fn()} />
    );
    expect(getByText('Nescafé 500g')).toBeTruthy();
    expect(getByTestId('cart-qty').props.children).toBe(2);
    expect(getByTestId('cart-subtotal').props.children).toBe('XAF 3000');
  });

  test('calls onChangeQty with qty+1 when + is pressed', () => {
    const onChangeQty = jest.fn();
    const { getByTestId } = render(
      <CartItem item={makeItem({ quantity: 2 })} onRemove={jest.fn()} onChangeQty={onChangeQty} />
    );
    fireEvent.press(getByTestId('cart-plus'));
    expect(onChangeQty).toHaveBeenCalledWith('prod-1', 3);
  });

  test('calls onRemove when quantity is 1 and minus is pressed', () => {
    const onRemove = jest.fn();
    const { getByTestId } = render(
      <CartItem item={makeItem({ quantity: 1 })} onRemove={onRemove} onChangeQty={jest.fn()} />
    );
    fireEvent.press(getByTestId('cart-minus'));
    expect(onRemove).toHaveBeenCalledWith('prod-1');
  });

  test('calls onChangeQty with qty-1 when minus is pressed and qty > 1', () => {
    const onChangeQty = jest.fn();
    const { getByTestId } = render(
      <CartItem item={makeItem({ quantity: 3 })} onRemove={jest.fn()} onChangeQty={onChangeQty} />
    );
    fireEvent.press(getByTestId('cart-minus'));
    expect(onChangeQty).toHaveBeenCalledWith('prod-1', 2);
  });

  test('renders variant tag when variant is set', () => {
    const item = makeItem({ variant: { id: 'v1', name: 'Large', price: 2000 } });
    const { getByText } = render(
      <CartItem item={item} onRemove={jest.fn()} onChangeQty={jest.fn()} />
    );
    expect(getByText('Large')).toBeTruthy();
  });
});
