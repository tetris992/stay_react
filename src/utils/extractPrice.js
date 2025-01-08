// src/utils/extractPrice.js

export function extractPrice(priceString) {
  if (priceString == null) {
    return { price: 100000, isDefault: true }; // 가격 정보 없음, 기본값 적용
  }

  if (typeof priceString === 'number') {
    return { price: priceString, isDefault: false };
  }

  if (typeof priceString !== 'string') {
    console.error(
      `extractPrice: priceString이 문자열이 아닙니다. ${priceString}`
    );
    return { price: 100000, isDefault: true }; // 유효하지 않은 가격 정보, 기본값 적용
  }

  // "판매가 153,000원" 형태에서 숫자 추출
  const salePriceMatch = priceString.match(/판매가\s*([\d,]+)/);
  if (salePriceMatch && salePriceMatch[1]) {
    const price = parseInt(salePriceMatch[1].replace(/,/g, ''), 10);
    return { price, isDefault: false };
  }

  // "KRW 153,000" 형태에서 숫자 추출
  const krwPriceMatch = priceString.match(/KRW\s*([\d,]+)/);
  if (krwPriceMatch && krwPriceMatch[1]) {
    const price = parseInt(krwPriceMatch[1].replace(/,/g, ''), 10);
    return { price, isDefault: false };
  }

  // "Agoda Collect"인 경우 기본값 적용
  if (/Agoda Collect/i.test(priceString)) {
    return { price: 100000, isDefault: true };
  }

  // 숫자만 포함된 경우 가장 큰 숫자 선택
  const matches = priceString.match(/[\d,]+/g);
  if (matches && matches.length > 0) {
    const numbers = matches.map((s) => parseInt(s.replace(/,/g, ''), 10));
    const maxNumber = Math.max(...numbers);
    return { price: maxNumber, isDefault: false };
  }

  console.error('가격 정보를 추출할 수 없습니다:', priceString);
  return { price: 100000, isDefault: true }; // 유효하지 않은 가격 정보, 기본값 적용
}
