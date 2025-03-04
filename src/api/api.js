// src/api/api.js

/* global chrome */

import axios from 'axios';
import ApiError from '../utils/ApiError.js';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3004';
console.log('[api.js] BASE_URL:', BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    console.log('[api.js] Request URL:', `${BASE_URL}${config.url}`);
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
      const { data } = await api.get('/api/csrf-token', { skipCsrf: true });
      config.headers['X-CSRF-Token'] = data.csrfToken;
      localStorage.setItem('csrfToken', data.csrfToken);
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

    // ✅ 수정된 부분 (비동기 전송, 실패 무시)
    if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
      const EXTENSION_ID =
        process.env.REACT_APP_EXTENSION_ID ||
        'bhfggeheelkddgmlegkppgpkmioldfkl';
      console.log('[api.js] Sending tokens to extension ID:', EXTENSION_ID);

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { action: 'SET_TOKEN', token: accessToken, csrfToken },
        (response) => {
          if (chrome.runtime.lastError) {
            // ⚠️ 실패해도 로그만 찍고 로그인 자체는 정상 진행
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

export const logoutUser = async () => {
  try {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      console.warn('로그인 상태가 아닙니다.');
      return { redirect: '/login' }; // 로그인 상태가 없으면 클라이언트에 리다이렉션 경로 반환
    }

    const csrfResponse = await api.get('/api/csrf-token', { skipCsrf: true });
    const csrfToken = csrfResponse.data.csrfToken;
    const response = await api.post(
      '/api/auth/logout',
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-CSRF-Token': csrfToken,
        },
      }
    );
    return { redirect: '/login', ...response.data }; // 백엔드 응답과 함께 리다이렉션 경로 반환
  } catch (error) {
    console.error('로그아웃 실패:', error);
    return { error: error.message, redirect: '/login' }; // 오류 발생 시도 리다이렉션 경로 반환
  } finally {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('hotelId');
    localStorage.removeItem('csrfToken');
    // window.location.href 제거, 클라이언트에서 처리하도록 변경
  }
};

export const registerUser = async (userData) => {
  try {
    const csrfResponse = await api.get('/api/csrf-token', { skipCsrf: true });
    const csrfToken = csrfResponse.data.csrfToken;
    const response = await api.post('/api/auth/register', userData, {
      headers: { 'X-CSRF-Token': csrfToken },
    });
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
    const standardError = new Error(errorMessage);
    standardError.status = statusCode;
    throw standardError;
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
  }
};

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
      // 백엔드에서 반환된 상세 메시지를 alert로 표시
      const conflictMessage =
        error.response.data.message ||
        '이미 해당 객실에 중복된 예약이 있습니다.';
      alert(conflictMessage);
    } else {
      console.error('예약 업데이트 실패:', error);
    }
    throw error.response?.data || error;
  }
};

export const saveOnSiteReservation = async (reservationData) => {
  try {
    const response = await api.post('/api/reservations', {
      ...reservationData,
      customerName: reservationData.customerName, // 명시적으로 customerName 포함
      phoneNumber: reservationData.phoneNumber, // 명시적으로 phoneNumber 포함
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

export default api;
