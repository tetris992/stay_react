// src/utils/getPriceForDisplay.js

import { extractPrice } from './extractPrice.js';
import { matchRoomType } from './matchRoomType.js';

/**
 * Generates a formatted total price string for a reservation.
 *
 * @param {Object} reservation - The reservation object.
 * @returns {string} - The formatted total price string.
 */
export const getPriceForDisplay = (reservation) => {
  if (!reservation) return '0원';

  const { price, isDefault } = extractPrice(
    reservation.priceString || reservation.price
  );

  let totalPrice = price;
  let isDefaultPriceFlag = false;

  // Apply default price if flagged
  if (isDefault) {
    totalPrice = 100000; // 기본값 적용 (100,000원)
    isDefaultPriceFlag = true;
  }

  // If total price is zero or negative, use room type's default price
  if (totalPrice <= 0) {
    const roomType = matchRoomType(reservation.roomInfo);
    totalPrice = roomType?.price || 0;
  }

  return isDefaultPriceFlag
    ? `${totalPrice.toLocaleString()}원 (기본값)`
    : `${totalPrice.toLocaleString()}원`;
};
