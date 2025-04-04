/* global chrome */

import axios from 'axios';
import ApiError from '../utils/ApiError.js';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3004';
console.log('[api.js] BASE_URL:', BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// 토큰 가져오기 함수
const getAccessToken = () => localStorage.getItem('accessToken');
const getCsrfToken = () => localStorage.getItem('csrfToken');

api.interceptors.request.use(
  (config) => {
    console.log('[api.js] Request URL:', `${BASE_URL}${config.url}`);
    console.log('[api.js] Request Body:', config.data); // 요청 본문 로그 추가
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.request.use(
  async (config) => {
    const isGetRequest = config.method === 'get';
    const isCsrfTokenRequest = config.url === '/api/csrf-token';
    const isRefreshTokenRequest = config.url === '/api/auth/refresh-token';
    const skipCsrf = config.skipCsrf || false;

    if (
      !isGetRequest &&
      !isCsrfTokenRequest &&
      !isRefreshTokenRequest &&
      !skipCsrf
    ) {
      try {
        const { data } = await api.get('/api/csrf-token', { skipCsrf: true });
        config.headers['X-CSRF-Token'] = data.csrfToken;
        config.headers['X-CSRF-Token-Id'] = data.tokenId;
        localStorage.setItem('csrfToken', data.csrfToken);
        localStorage.setItem('csrfTokenId', data.tokenId);
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
        throw new ApiError(
          error.response?.status || 500,
          'CSRF 토큰을 가져오지 못했습니다. 페이지를 새로고침 후 다시 시도해주세요.'
        );
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response &&
      error.response.status === 401 &&
      originalRequest.url !== '/api/auth/login' &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
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
        const { data } = await api.post('/api/auth/refresh-token');
        const { accessToken } = data;
        localStorage.setItem('accessToken', accessToken);
        originalRequest.headers.Authorization = 'Bearer ' + accessToken;
        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('hotelId');
        localStorage.removeItem('csrfToken');
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// loginUser 수정
export const loginUser = async (credentials) => {
  try {
    const response = await api.post('/api/auth/login', credentials);
    const { accessToken, isRegistered } = response.data;
    if (!accessToken) throw new ApiError(500, '로그인에 실패했습니다.');

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('hotelId', credentials.hotelId);

    const csrfResponse = await api.get('/api/csrf-token', { skipCsrf: true });
    const csrfToken = csrfResponse.data.csrfToken;
    localStorage.setItem('csrfToken', csrfToken);

    if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
      const EXTENSION_ID =
        process.env.REACT_APP_EXTENSION_ID ||
        'cnoicicjafgmfcnjclhlehfpojfaelag';
      console.log('[api.js] Sending tokens to extension ID:', EXTENSION_ID);

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { action: 'SET_TOKEN', token: accessToken, csrfToken },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              '[api.js] SendMessage failed:',
              chrome.runtime.lastError
            );
          } else {
            console.log('[api.js] SendMessage succeeded:', response);
          }
        }
      );
    }

    return { accessToken, isRegistered };
  } catch (error) {
    let errorMessage = '로그인에 실패했습니다.';
    let statusCode = 500;
    if (error.response) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.message || errorMessage;
      if (statusCode === 401) {
        const remainingAttempts = error.response.data.remainingAttempts || 0;
        const err = new ApiError(statusCode, errorMessage);
        err.remainingAttempts = remainingAttempts;
        err.userNotFound = error.response.data.userNotFound || false;
        throw err;
      }
    } else if (error.request) {
      errorMessage = '서버 응답이 없습니다.';
    }
    throw new ApiError(statusCode, errorMessage);
  }
};

// refreshToken 수정
export const refreshToken = async () => {
  try {
    const response = await api.post('/api/auth/refresh-token');
    const { accessToken } = response.data;
    localStorage.setItem('accessToken', accessToken);

    const csrfResponse = await api.get('/api/csrf-token', { skipCsrf: true });
    const csrfToken = csrfResponse.data.csrfToken;
    localStorage.setItem('csrfToken', csrfToken);

    if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
      const EXTENSION_ID =
        process.env.REACT_APP_EXTENSION_ID ||
        'cnoicicjafgmfcnjclhlehfpojfaelag';
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          { action: 'SET_TOKEN', token: accessToken, csrfToken },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                '[api.js] Refresh token sendMessage error:',
                chrome.runtime.lastError
              );
              reject(chrome.runtime.lastError);
            } else {
              console.log(
                '[api.js] Refreshed tokens sent to extension:',
                response
              );
              resolve(response);
            }
          }
        );
      });
    }
    return response.data;
  } catch (error) {
    throw new ApiError(401, '토큰 갱신 실패');
  }
};

// logoutUser 수정
export const logoutUser = async () => {
  try {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      console.warn('로그인 상태가 아닙니다.');
      return { redirect: '/login' };
    }

    const response = await api.post(
      '/api/auth/logout',
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return { redirect: '/login', ...response.data };
  } catch (error) {
    console.error('로그아웃 실패:', error);
    return { error: error.message, redirect: '/login' };
  } finally {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('hotelId');
    localStorage.removeItem('csrfToken');
  }
};

// registerUser 수정
export const registerUser = async (userData) => {
  try {
    const response = await api.post('/api/auth/register', userData);
    return response.data;
  } catch (error) {
    console.error('유저 등록 실패:', error);
    let errorMessage = '회원가입 중 오류가 발생했습니다.';
    let statusCode = 500;
    if (error.response && error.response.data && error.response.data.message) {
      errorMessage = error.response.data.message;
      statusCode = error.response.status;
    } else if (error.message) {
      errorMessage = error.message;
    }
    if (statusCode === 500) {
      errorMessage += ' 서버에서 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }
    const standardError = new Error(errorMessage);
    standardError.status = statusCode;
    throw standardError;
  }
};
// updateReservation 수정
export const updateReservation = async (reservationId, updateData, hotelId) => {
  try {
    const response = await api.patch(
      `/api/reservations/${encodeURIComponent(reservationId)}`,
      {
        ...updateData,
        hotelId,
      }
    );
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 409) {
      const conflictMessage =
        error.response.data.message ||
        '이미 해당 객실에 중복된 예약이 있습니다.';
      alert(conflictMessage);
    } else if (error.response && error.response.status === 403) {
      console.error('CSRF 토큰 오류:', error);
      alert(
        'CSRF 토큰 오류가 발생했습니다. 페이지를 새로고침 후 다시 시도해주세요.'
      );
    } else {
      console.error('예약 업데이트 실패:', error);
      alert('예약 업데이트에 실패했습니다. 다시 시도해주세요.');
    }
    throw error.response?.data || error;
  }
};

// ============== 호텔 설정 관련 API ==============
export const fetchHotelSettings = async (hotelId) => {
  try {
    const response = await api.get('/api/hotel-settings', {
      params: { hotelId },
    });
    return response.data.data;
  } catch (error) {
    console.error('호텔 설정 불러오기 실패:', error);
    throw error.response?.data || error;
  }
};

export const updateHotelSettings = async (hotelId, settings) => {
  try {
    const response = await api.patch(
      `/api/hotel-settings/${hotelId}`,
      settings
    );
    return response.data.data;
  } catch (error) {
    console.error('호텔 설정 업데이트 실패:', error);
    throw error.response?.data || error;
  }
};

export const saveHotelSettings = async (settings) => {
  try {
    const response = await api.post('/api/hotel-settings', settings);
    return response.data.data;
  } catch (error) {
    console.error('호텔 설정 저장 실패:', error);
    throw error.response?.data || error;
  }
};

export const registerHotel = async (hotelData) => {
  try {
    const response = await api.post('/api/hotel-settings', hotelData);
    return response.data;
  } catch (error) {
    console.error('호텔 계정 등록 실패:', error);
    throw error.response?.data || error;
  }
};

// ============== 예약 관련 API ==============
export const fetchReservations = async (hotelId) => {
  try {
    const response = await api.get('/api/reservations', {
      params: { hotelId },
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('예약 정보 불러오기 실패:', error);
    if (error.response && error.response.status === 404) {
      return [];
    }
    throw error.response?.data || error;
  }
};

export const deleteReservation = async (reservationId, hotelId, siteName) => {
  try {
    const response = await api.delete(
      `/api/reservations/${encodeURIComponent(reservationId)}`,
      { params: { hotelId, siteName } }
    );
    return response.data;
  } catch (error) {
    console.error(`예약 삭제 실패 (${reservationId}):`, error);
    throw error.response?.data || error;
  }
};

export const confirmReservation = async (reservationId, hotelId) => {
  try {
    const encodedReservationId = encodeURIComponent(reservationId);
    console.log(`Confirming reservation with ID: ${encodedReservationId}`);
    const response = await api.post(
      `/api/reservations/${encodedReservationId}/confirm`,
      { hotelId }
    );
    return response.data;
  } catch (error) {
    console.error(`예약 확정 실패 (${reservationId}):`, error);
    const errorMessage =
      error.response?.data?.message || '예약 확정에 실패했습니다.';
    console.log(errorMessage);
    throw error.response?.data || error; // 에러를 호출자에게 전달
  }
};

// syncReservation 함수 제거 (WebSocket으로 대체됨)

export const saveOnSiteReservation = async (reservationData) => {
  try {
    const response = await api.post('/api/reservations', {
      ...reservationData,
      customerName: reservationData.customerName,
      phoneNumber: reservationData.phoneNumber,
    });
    return response.data;
  } catch (error) {
    console.error('현장 예약 저장 실패:', error);
    throw error.response?.data || error;
  }
};

export const fetchCanceledReservations = async (hotelId) => {
  console.log('fetchCanceledReservations called with hotelId:', hotelId);
  try {
    const response = await api.get('/api/reservations/canceled', {
      params: { hotelId },
    });
    console.log('fetchCanceledReservations response:', response.data);
    return response.data;
  } catch (error) {
    console.error('취소된 예약 불러오기 실패:', error);
    throw error.response?.data || error;
  }
};

// ============== 사용자 정보 ==============
export const fetchUserInfo = async (hotelId) => {
  try {
    const response = await api.get(`/api/auth/users/${hotelId}`);
    return response.data.data;
  } catch (error) {
    console.error('사용자 정보 불러오기 실패:', error);
    throw error.response?.data || error;
  }
};

export const updateUser = async (hotelId, userData) => {
  try {
    const response = await api.patch(`/api/auth/users/${hotelId}`, userData);
    return response.data.data;
  } catch (error) {
    console.error('사용자 정보 업데이트 실패:', error);
    throw error.response?.data || error;
  }
};

// ============== 그 외 유틸 API ==============
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

export const fetchDebuggerStatus = async () => {
  try {
    const response = await api.get('/api/status/debugger');
    return response.data;
  } catch (error) {
    console.error('디버깅 상태 가져오기 실패:', error);
    throw error.response?.data || error;
  }
};

export const fetchOTAStatus = async (hotelId) => {
  try {
    const response = await api.get('/api/status/ota', {
      params: { hotelId },
    });
    return response.data;
  } catch (error) {
    console.error('OTA 상태 가져오기 실패:', error);
    throw error.response?.data || error;
  }
};

// ============== 비밀번호 재설정 ==============
export const resetPasswordRequest = async (email) => {
  try {
    const response = await api.post('/api/auth/reset-password-request', {
      email,
    });
    return response.data;
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || '비밀번호 재설정 요청에 실패했습니다.';
    throw new Error(errorMessage);
  }
};

export const resetPassword = async (token, newPassword) => {
  try {
    const response = await api.post(`/api/auth/reset-password/${token}`, {
      newPassword,
    });
    return response.data;
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || '비밀번호 재설정에 실패했습니다.';
    throw new Error(errorMessage);
  }
};

export const consentUser = async (hotelId) => {
  try {
    const response = await api.post(`/api/auth/consent?hotelId=${hotelId}`, {});
    return response.data;
  } catch (error) {
    console.error('개인정보 동의 실패:', error);
    throw error;
  }
};

export const setCsrfToken = (token) => {
  localStorage.setItem('csrfToken', token);
};

// 토큰 관리 함수 공개
export { getAccessToken, getCsrfToken };

// payPerNight API 함수 추가
export const payPerNight = async (reservationId, hotelId, amount, method) => {
  try {
    const response = await api.post(
      `/api/reservations/pay-per-night/${reservationId}`,
      {
        hotelId,
        amount: Number(amount), // 금액을 숫자로 보장
        method: method || 'Cash', // 결제 방법 기본값 설정
      }
    );
    console.log(
      `[payPerNight] Success for reservation ${reservationId}:`,
      response.data
    );
    return response.data;
  } catch (error) {
    console.error(
      `[payPerNight] Failed for reservation ${reservationId}:`,
      error
    );
    const errorMessage =
      error.response?.data?.message || '1박 결제에 실패했습니다.';
    throw new ApiError(error.response?.status || 500, errorMessage);
  }
};

// 다중결제 방식을 처리하는 API
export const payPartial = async (reservationId, hotelId, payments) => {
  try {
    if (!Array.isArray(payments) || payments.length === 0) {
      throw new ApiError(400, '결제 항목이 비어있거나 유효하지 않습니다.');
    }
    const response = await api.post(
      `/api/reservations/${reservationId}/pay-partial`,
      {
        hotelId,
        payments, // [{ amount, method }, ...] 형식
      }
    );
    console.log(
      `[payPartial] Success for reservation ${reservationId}:`,
      response.data
    );
    return response.data;
  } catch (error) {
    console.error(
      `[payPartial] Failed for reservation ${reservationId}:`,
      error
    );
    const errorMessage =
      error.response?.data?.message || '부분 결제에 실패했습니다.';
    throw new ApiError(error.response?.status || 500, errorMessage);
  }
};

export default api;
