// src/config/availableOTAs.js

// List of available OTAs (used for reference in backend logic)
const availableOTAs = [
  'YanoljaMotel',
  'GoodHotel',
  'GoodMotel',
  'Agoda',
  'CoolStay',
  'Booking',
  'Expedia',
];

// Mapping of OTA names to Korean display names
const otaDisplayNames = {
  '현장': '현장',
  '단잠': '단잠', // Not an OTA, but included for display purposes
  '대실': '대실',
  'OTA': 'OTA',
  'YanoljaMotel': '야놀자',
  'GoodHotel': '여기어때',
  'GoodMotel': '여기어때',
  'Agoda': '아고다',
  'CoolStay': '쿨스테이',
  'Booking': '부킹닷컴',
  'Expedia': '익스피디아',
};

// Export availableOTAs as the default export for compatibility with HotelSettings.js
export default availableOTAs;

// Export otaDisplayNames as a named export for use in fetchHotelSales
export { otaDisplayNames };