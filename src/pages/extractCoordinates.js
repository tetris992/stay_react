// frontend/src/pages/extractCoordinates.js
import axios from 'axios';

const extractCoordinates = async (address, language = 'kor') => {
  if (!address) {
    throw new Error(
      language === 'kor'
        ? '주소를 먼저 입력해주세요.'
        : 'Please enter the address first.'
    );
  }

  const googleApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  console.log('Google API Key:', googleApiKey); // 디버깅 로그 추가
  if (!googleApiKey) {
    throw new Error(
      language === 'kor'
        ? 'Google Maps API 키가 설정되지 않았습니다.'
        : 'Google Maps API key is not set.'
    );
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address,
          key: googleApiKey,
        },
      }
    );

    const data = response.data;
    console.log('Geocoding API Response:', data); // 디버깅 로그 추가
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
      };
    } else {
      throw new Error(
        language === 'kor'
          ? '주소로부터 좌표를 가져올 수 없습니다. 주소를 확인해주세요.'
          : 'Unable to retrieve coordinates from the address. Please check the address.'
      );
    }
  } catch (error) {
    throw new Error(
      language === 'kor'
        ? `좌표 추출 실패: ${error.message}`
        : `Failed to extract coordinates: ${error.message}`
    );
  }
};

export default extractCoordinates;
