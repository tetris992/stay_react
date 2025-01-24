// src/api/api.js

import axios from 'axios';
// import ApiError from '../utils/ApiError.js';

// 환경 변수에서 백엔드 서버 URL 가져오기
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: BASE_URL, // 백엔드 서버 URL로 변경
  withCredentials: true, // 쿠키 전송 허용 (리프레시 토큰을 쿠키에 저장)
});

// 요청 인터셉터: accessToken을 헤더에 추가
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터 설정 (토큰 만료 시 갱신 시도)
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// 요청 인터셉터: accessToken을 헤더에 추가 (기본설정에서만 잘 작동함)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 에러 응답이 있고 401이며, 요청 URL이 /auth/login이 아닌 경우에만 토큰 갱신 시도
    if (
      error.response &&
      error.response.status === 401 &&
      originalRequest.url !== '/auth/login' && // 로그인 요청이 아니라면
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        // 이미 토큰 갱신 중이면 큐에 대기
        try {
          const token = await new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
          originalRequest.headers.Authorization = 'Bearer ' + token;
          return api(originalRequest);
        } catch (err) {
          return Promise.reject(err);
        }
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh-token');
        const { accessToken } = data;
        localStorage.setItem('accessToken', accessToken);
        originalRequest.headers.Authorization = 'Bearer ' + accessToken;
        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // /auth/login 요청에서 401 에러가 발생한 경우, 토큰 갱신 시도 없이 바로 reject
    return Promise.reject(error);
  }
);

// 여기서부터 ApiError 변환은 오로지 loginUser(또는 다른 API 함수)에서만 수행

export const loginUser = async (credentials) => {
  try {
    const response = await api.post('/auth/login', credentials);
    const { accessToken, isRegistered } = response.data;

    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('hotelId', credentials.hotelId);
      return { accessToken, isRegistered };
    } else {
      throw new ApiError(500, '로그인에 실패했습니다.');
    }
  } catch (error) {
    // 여기서 모든 에러 처리 (ApiError로 변환)
    let errorMessage = '로그인에 실패했습니다.';
    let statusCode = 500;

    if (error.response) {
      statusCode = error.response.status;
      if (error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message; // 서버에서 준 구체적 메시지
      }
    } else if (error.request) {
      errorMessage = '서버 응답이 없습니다. 네트워크 상태를 확인해주세요.';
    }

    throw new ApiError(statusCode, errorMessage);
  }
};

// 사용자 등록 API
export const registerUser = async (userData) => {
  try {
    const response = await api.post('/auth/register', userData);
    return response.data;
  } catch (error) {
    console.error('유저 등록 실패:', error);

    // 구체적인 오류 메시지 추출
    let errorMessage = '회원가입 중 오류가 발생했습니다.';
    let statusCode = 500;

    if (error.response && error.response.data && error.response.data.message) {
      // 서버에서 전달한 구체적인 메시지
      errorMessage = error.response.data.message;
      statusCode = error.response.status;
    } else if (error.message) {
      // 기타 네트워크 또는 클라이언트 오류
      errorMessage = error.message;
    }

    // 표준 Error 인스턴스로 변환하여 throw
    const standardError = new Error(errorMessage);
    standardError.status = statusCode;
    throw standardError;
  }
};

// 호텔 설정 관련 API
export const registerHotel = async (hotelData) => {
  try {
    const response = await api.post('/hotel-settings', hotelData);
    return response.data;
  } catch (error) {
    console.error('호텔 계정 등록 실패:', error);
    throw error.response?.data || error;
  }
};

export const fetchHotelSettings = async (hotelId) => {
  try {
    const response = await api.get('/hotel-settings', { params: { hotelId } });
    return response.data.data;
  } catch (error) {
    console.error('호텔 설정 불러오기 실패:', error);
    throw error.response?.data || error;
  }
};

export const saveHotelSettings = async (settings) => {
  try {
    const response = await api.post('/hotel-settings', settings);
    return response.data.data;
  } catch (error) {
    console.error('호텔 설정 저장 실패:', error);
    throw error.response?.data || error;
  }
};

export const updateHotelSettings = async (hotelId, settings) => {
  try {
    const response = await api.patch(`/hotel-settings/${hotelId}`, settings);
    return response.data.data;
  } catch (error) {
    console.error('호텔 설정 업데이트 실패:', error);
    throw error.response?.data || error;
  }
};

// 예약 관련 API
export const fetchReservations = async (hotelId) => {
  try {
    const response = await api.get('/reservations', { params: { hotelId } });
    return response.data;
  } catch (error) {
    console.error('예약 정보 불러오기 실패:', error);
    throw error.response?.data || error;
  }
};

// 예약 삭제 API 함수
export const deleteReservation = async (reservationId, hotelId, siteName) => {
  try {
    const response = await api.delete(
      `/reservations/${encodeURIComponent(reservationId)}`,
      {
        params: { hotelId, siteName }, // 쿼리 파라미터로 호텔 ID와 사이트 이름 전달
      }
    );
    return response.data;
  } catch (error) {
    console.error(`예약 삭제 실패 (${reservationId}):`, error);
    throw error.response?.data || error;
  }
};

// 예약 확정 API 함수
export const confirmReservation = async (reservationId, hotelId) => {
  try {
    const encodedReservationId = encodeURIComponent(reservationId);
    console.log(`Confirming reservation with ID: ${encodedReservationId}`);
    const response = await api.post(
      `/reservations/${encodedReservationId}/confirm`,
      {
        hotelId, // siteName 제거
      }
    );
    return response.data;
  } catch (error) {
    console.error(`예약 확정 실패 (${reservationId}):`, error);
    const errorMessage =
      error.response?.data?.message || '예약 확정에 실패했습니다.';
    // throw new Error(errorMessage); //아고다 가격문제로 인한 예약확정 실패문제가 있음.
    console.log(errorMessage);
  }
};

// 예약 수정 API 함수
export const updateReservation = async (reservationId, updateData, hotelId) => {
  try {
    const response = await api.patch(
      `/reservations/${encodeURIComponent(reservationId)}`,
      {
        ...updateData,
        hotelId,
      }
    );
    return response.data;
  } catch (error) {
    console.error('예약 업데이트 실패:', error);
    throw error.response?.data || error;
  }
};

// 현장 예약 저장
export const saveOnSiteReservation = async (reservationData) => {
  try {
    const response = await api.post('/reservations', reservationData);
    return response.data;
  } catch (error) {
    console.error('현장 예약 저장 실패:', error);
    throw error.response?.data || error;
  }
};

// 로그아웃 API 호출 함수
export const logoutUser = async () => {
  try {
    const response = await api.post('/auth/logout');
    return response.data;
  } catch (error) {
    console.error('로그아웃 실패:', error);
    throw error.response?.data || error;
  }
};

// 사용자 정보 불러오기
export const fetchUserInfo = async (hotelId) => {
  try {
    const response = await api.get(`/auth/users/${hotelId}`);
    return response.data.data;
  } catch (error) {
    console.error('사용자 정보 불러오기 실패:', error);
    throw error.response?.data || error;
  }
};

// 사용자 정보 업데이트
export const updateUser = async (hotelId, userData) => {
  try {
    const response = await api.patch(`/auth/users/${hotelId}`, userData);
    return response.data.data;
  } catch (error) {
    console.error('사용자 정보 업데이트 실패:', error);
    throw error.response?.data || error;
  }
};

// 스크랩 작업 enqueue API 함수 (추가)
export const enqueueScrapeTasks = async (hotelId, otaNames) => {
  try {
    const response = await api.post('/api/scrape/instant', {
      hotelId,
      otaNames,
    });
    return response.data;
  } catch (error) {
    console.error('스크랩 작업 enqueue 실패:', error);
    throw error.response?.data || error;
  }
};

// 디버깅 Chrome 상태 가져오기
export const fetchDebuggerStatus = async () => {
  try {
    const response = await api.get('/status/debugger'); // 디버깅 상태를 위한 엔드포인트 호출
    return response.data;
  } catch (error) {
    console.error('디버깅 상태 가져오기 실패:', error);
    throw error.response?.data || error;
  }
};

// OTA 로그인 상태 가져오기
export const fetchOTAStatus = async (hotelId) => {
  try {
    const response = await api.get('/status/ota', {
      params: { hotelId }, // 호텔 ID를 쿼리 파라미터로 전달
    });
    return response.data;
  } catch (error) {
    console.error('OTA 상태 가져오기 실패:', error);
    throw error.response?.data || error;
  }
};

// 취소된 예약 불러오기 함수 추가
export const fetchCanceledReservations = async (hotelId) => {
  console.log('fetchCanceledReservations called with hotelId:', hotelId);
  try {
    const response = await api.get('/reservations/canceled', {
      params: { hotelId },
    });
    console.log('fetchCanceledReservations response:', response.data);
    return response.data;
  } catch (error) {
    console.error('취소된 예약 불러오기 실패:', error);
    throw error.response?.data || error;
  }
};

// 비밀번호 재설정 요청 함수
export const resetPasswordRequest = async (email) => {
  try {
    const response = await api.post('/auth/reset-password-request', { email });
    return response.data;
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || '비밀번호 재설정 요청에 실패했습니다.';
    throw new Error(errorMessage);
  }
};

// 실제 비밀번호 재설정 함수
export const resetPassword = async (token, newPassword) => {
  try {
    const response = await api.post(`/auth/reset-password/${token}`, {
      newPassword,
    });
    return response.data;
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || '비밀번호 재설정에 실패했습니다.';
    throw new Error(errorMessage);
  }
};

export default api;
