/* global chrome */

import axios from 'axios';
import ApiError from '../utils/ApiError.js';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3004';
console.log('[api.js] BASE_URL:', BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // HttpOnly 쿠키를 사용하기 위해 필수
});

// 토큰 가져오기 함수
const getAccessToken = () => localStorage.getItem('accessToken');
const getCsrfToken = () => localStorage.getItem('csrfToken');
const getCsrfTokenId = () => localStorage.getItem('csrfTokenId');

// GET 요청 캐싱 설정
const GET_CACHE_TTL = 5_000; // 5초 TTL
const MAX_CACHE_SIZE = 1000; // 최대 캐시 항목 수
const getCache = new Map();

// 원래 axios.get 참조
const originalGet = api.get.bind(api);

api.get = (url, config = {}) => {
  // 캐싱 제외 요청
  const excludeUrls = [
    '/api/csrf-token',
    '/api/health',
    '/api/status/debugger',
    '/api/reservations',
    '/api/reservations/canceled',
  ];
  if (
    excludeUrls.includes(url) ||
    url.startsWith('/api/auth') ||
    url.startsWith('/api/hotel-settings')
  ) {
    return originalGet(url, config);
  }

  const key = url + JSON.stringify(config.params || {});

  if (getCache.size > MAX_CACHE_SIZE) {
    getCache.clear();
  }

  const cached = getCache.get(key);

  if (cached && Date.now() - cached.ts < GET_CACHE_TTL) {
    console.log(`[api.js] Cache hit for GET ${url}`);
    return Promise.resolve(cached.res);
  }

  if (cached && cached.promise) {
    console.log(`[api.js] Deduplicated GET ${url}`);
    return cached.promise;
  }

  const p = originalGet(url, config)
    .then((res) => {
      getCache.set(key, { res, ts: Date.now() });
      return res;
    })
    .catch((err) => {
      getCache.delete(key);
      throw err;
    })
    .finally(() => {
      const entry = getCache.get(key);
      if (entry && entry.promise) {
        delete entry.promise;
        if (!entry.res) {
          getCache.delete(key);
        } else {
          getCache.set(key, entry);
        }
      }
    });

  getCache.set(key, { promise: p, ts: Date.now() });
  return p;
};

// 요청 인터셉터
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const skipMethods = ['get', 'head'];
    const skipUrls = ['/api/csrf-token', '/api/auth/refresh-token'];
    if (
      !skipMethods.includes(config.method.toLowerCase()) &&
      !skipUrls.some((u) => config.url.startsWith(u)) &&
      !config.skipCsrf
    ) {
      let csrfToken = localStorage.getItem('csrfToken');
      let csrfTokenId = localStorage.getItem('csrfTokenId');
      if (!csrfToken || !csrfTokenId) {
        const { data } = await api.get('/api/csrf-token', { skipCsrf: true });
        csrfToken = data.csrfToken;
        csrfTokenId = data.tokenId;
        localStorage.setItem('csrfToken', csrfToken);
        localStorage.setItem('csrfTokenId', csrfTokenId);
      }
      config.headers['X-CSRF-Token'] = csrfToken;
      config.headers['X-CSRF-Token-Id'] = csrfTokenId;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        '[api.js] Request:',
        config.method.toUpperCase(),
        config.url,
        config.data
      );
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// ← 수정 후 →
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // CSRF 토큰 에러 처리 (403 → 토큰 재발급 후 재요청)
    if (error.response?.status === 403 && !originalRequest._retryCsrf) {
      originalRequest._retryCsrf = true;
      try {
        const { data } = await api.get('/api/csrf-token', {
          skipCsrf: true,
          timeout: 10000,
        });
        const { csrfToken, tokenId } = data;
        localStorage.setItem('csrfToken', csrfToken);
        localStorage.setItem('csrfTokenId', tokenId);
        originalRequest.headers['X-CSRF-Token'] = csrfToken;
        originalRequest.headers['X-CSRF-Token-Id'] = tokenId;
        return api(originalRequest);
      } catch (csrfError) {
        console.error('[api.js] CSRF 토큰 재발급 실패:', csrfError);
        throw new ApiError(
          403,
          'CSRF 토큰 갱신에 실패했습니다. 로그아웃 후 다시 로그인해주세요.'
        );
      }
    }

    // 401 에러 처리 (액세스 토큰 재발급 → 재요청)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.endsWith('/login')
    ) {
      if (isRefreshing) {
        // 재발급 중인 다른 요청 큐에 보관
        const token = await new Promise((res, rej) =>
          failedQueue.push({ res, rej })
        );
        originalRequest.headers.Authorization = 'Bearer ' + token;
        return api(originalRequest);
      }

      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const { data } = await api.post(
          '/api/auth/refresh-token',
          {},
          { timeout: 10000 }
        );
        const { accessToken } = data;
        localStorage.setItem('accessToken', accessToken);
        originalRequest.headers.Authorization = 'Bearer ' + accessToken;
        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
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
    const csrfTokenId = csrfResponse.data.tokenId;
    localStorage.setItem('csrfToken', csrfToken);
    localStorage.setItem('csrfTokenId', csrfTokenId);

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

// refreshToken
export const refreshToken = async () => {
  try {
    const response = await api.post('/api/auth/refresh-token'); // HttpOnly 쿠키로 처리, 바디 없이 요청
    const { accessToken } = response.data;
    localStorage.setItem('accessToken', accessToken);

    const csrfResponse = await api.get('/api/csrf-token', { skipCsrf: true });
    const csrfToken = csrfResponse.data.csrfToken;
    const csrfTokenId = csrfResponse.data.tokenId;
    localStorage.setItem('csrfToken', csrfToken);
    localStorage.setItem('csrfTokenId', csrfTokenId);

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

// logoutUser
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
    localStorage.removeItem('csrfToken');
    localStorage.removeItem('csrfTokenId');
    localStorage.removeItem('refreshToken'); // 추가: refreshToken 제거
    // HttpOnly 쿠키는 서버에서 제거 처리 (예: Set-Cookie: refreshToken=; Expires=...)
  }
};

// registerUser
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
      errorMessage +=
        ' 서버에서 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }
    const standardError = new Error(errorMessage);
    standardError.status = statusCode;
    throw standardError;
  }
};

// updateReservation
export const updateReservation = async (reservationId, updateData, hotelId) => {
  try {
    const response = await api.patch(
      `/api/reservations/${encodeURIComponent(reservationId)}`,
      {
        ...updateData,
        hotelId,
      }
    );
    // 캐시 무효화
    const cacheKey = `/api/reservations${JSON.stringify({ hotelId })}`;
    getCache.delete(cacheKey);
    console.log(`[api.js] Cache invalidated for ${cacheKey}`);
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

// 호텔 설정 관련 API
export const fetchHotelSettings = async (hotelId) => {
  try {
    const response = await api.get('/api/hotel-settings', {
      params: { hotelId },
    });
    console.log('[fetchHotelSettings] Response:', response.data);
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

// 예약 관련 API
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
    const cacheKey = `/api/reservations${JSON.stringify({ hotelId })}`;
    getCache.delete(cacheKey);
    console.log(`[api.js] Cache invalidated for ${cacheKey}`);
    return response.data;
  } catch (error) {
    console.error(`예약 삭제 실패 (${reservationId}):`, error);
    throw error.response?.data || error;
  }
};

export const saveOnSiteReservation = async (reservationData) => {
  try {
    const response = await api.post('/api/reservations', {
      ...reservationData,
      customerName: reservationData.customerName,
      phoneNumber: reservationData.phoneNumber,
    });
    const cacheKey = `/api/reservations${JSON.stringify({
      hotelId: reservationData.hotelId,
    })}`;
    getCache.delete(cacheKey);
    console.log(`[api.js] Cache invalidated for ${cacheKey}`);
    return response.data;
  } catch (error) {
    console.error('현장 예약 저장 실패:', error);
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
    const cacheKey = `/api/reservations${JSON.stringify({ hotelId })}`;
    getCache.delete(cacheKey);
    console.log(`[api.js] Cache invalidated for ${cacheKey}`);
    return response.data;
  } catch (error) {
    console.error(`예약 확정 실패 (${reservationId}):`, error);
    const errorMessage =
      error.response?.data?.message || '예약 확정에 실패했습니다.';
    console.log(errorMessage);
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

// 사용자 정보
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

// 그 외 유틸 API
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

// 비밀번호 재설정
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

// 결제 관련 API
export const payPerNight = async (reservationId, hotelId, amount, method) => {
  try {
    const response = await api.post(
      `/api/reservations/pay-per-night/${reservationId}`,
      {
        hotelId,
        amount: Number(amount),
        method: method || 'Cash',
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

export const payPartial = async (reservationId, hotelId, payments) => {
  try {
    if (!Array.isArray(payments) || payments.length === 0) {
      throw new ApiError(400, '결제 항목이 비어있거나 유효하지 않습니다.');
    }
    const response = await api.post(
      `/api/reservations/${reservationId}/pay-partial`,
      {
        hotelId,
        payments,
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

// 고객 관련 API
export const searchCustomers = async (
  hotelId,
  { query, minVisits, maxVisits, lastVisitDate, limit, skip }
) => {
  try {
    const response = await api.get(
      `/api/hotel-settings/${hotelId}/customers/search`,
      { params: { query, minVisits, maxVisits, lastVisitDate, limit, skip } }
    );
    if (process.env.NODE_ENV !== 'production') {
      console.log('[searchCustomers] Response:', response.data);
    }
    return {
      customers: response.data.customers || [],
      totalCount: response.data.totalCount || 0,
    };
  } catch (error) {
    console.error('고객 검색 실패:', error);
    const errorMessage =
      error.response?.data?.message || '고객 검색에 실패했습니다.';
    throw new ApiError(error.response?.status || 500, errorMessage);
  }
};

export const issueTargetedCoupon = async (
  hotelId,
  customerId,
  { templateUuid, couponUuid }
) => {
  try {
    if (!templateUuid && !couponUuid) {
      throw new ApiError(400, 'templateUuid 또는 couponUuid가 필요합니다.');
    }
    const payload = templateUuid ? { templateUuid } : { couponUuid };
    const response = await api.post(
      `/api/hotel-settings/${hotelId}/customers/${customerId}/issue-targeted-coupon`,
      payload
    );
    if (process.env.NODE_ENV !== 'production') {
      console.log('[issueTargetedCoupon] Response:', response.data);
    }
    return response.data.coupon;
  } catch (error) {
    console.error('쿠폰 발행 실패:', error);
    const errorMessage =
      error.response?.data?.message || '쿠폰 발행에 실패했습니다.';
    throw new ApiError(error.response?.status || 500, errorMessage);
  }
};

export const pushCouponToCustomer = async (hotelId, customerId, couponUuid) => {
  try {
    const response = await api.post(
      `/api/hotel-settings/${hotelId}/customers/${customerId}/push-coupon`,
      { couponUuid }
    );
    if (process.env.NODE_ENV !== 'production') {
      console.log('[pushCouponToCustomer] Response:', response.data);
    }
    return response.data.coupon;
  } catch (error) {
    console.error('쿠폰 푸시 실패:', error);
    const errorMessage =
      error.response?.data?.message || '쿠폰 푸시에 실패했습니다.';
    throw new ApiError(error.response?.status || 500, errorMessage);
  }
};

export const fetchUsedCoupons = async (hotelId) => {
  try {
    const response = await api.get(
      `/api/hotel-settings/${hotelId}/used-coupons`
    );
    if (process.env.NODE_ENV !== 'production') {
      console.log('[fetchUsedCoupons] Response:', response.data);
    }
    return response.data.usedCoupons || [];
  } catch (error) {
    console.error('[fetchUsedCoupons] Error:', error);
    const errorMessage =
      error.response?.data?.message ||
      '사용된 쿠폰 목록을 가져오지 못했습니다.';
    throw new ApiError(error.response?.status || 500, errorMessage);
  }
};

export const deleteExpiredCoupons = async (hotelId) => {
  try {
    const response = await api.delete(
      `/api/hotel-settings/${hotelId}/expired-coupons`
    );
    if (process.env.NODE_ENV !== 'production') {
      console.log('[deleteExpiredCoupons] Response:', response.data);
    }
    return response.data;
  } catch (error) {
    console.error('[deleteExpiredCoupons] Error:', error);
    const errorMessage =
      error.response?.data?.message || '만료된 쿠폰 삭제에 실패했습니다.';
    throw new ApiError(error.response?.status || 500, errorMessage);
  }
};

// 로열티 및 최초 방문 쿠폰 API
export const fetchLoyaltyCoupons = async (hotelId) => {
  try {
    const { data } = await api.get(
      `/api/hotel-settings/${hotelId}/loyalty-coupons`
    );
    if (process.env.NODE_ENV !== 'production') {
      console.log('[fetchLoyaltyCoupons] Response:', data);
    }
    return data.loyaltyCoupons || [];
  } catch (error) {
    console.error('[fetchLoyaltyCoupons] Error:', error);
    const errorMessage =
      error.response?.data?.message ||
      '로열티 쿠폰 설정을 가져오지 못했습니다.';
    throw new ApiError(error.response?.status || 500, errorMessage);
  }
};

export const saveLoyaltyCoupons = async (hotelId, loyaltyCoupons) => {
  try {
    const payload = { loyaltyCoupons };
    const { data } = await api.put(
      `/api/hotel-settings/${hotelId}/loyalty-coupons`,
      payload
    );
    if (process.env.NODE_ENV !== 'production') {
      console.log('[saveLoyaltyCoupons] Response:', data);
    }
    return data.loyaltyCoupons;
  } catch (error) {
    console.error('[saveLoyaltyCoupons] Error:', error);
    const errorMessage =
      error.response?.data?.message || '로열티 쿠폰 설정 저장에 실패했습니다.';
    throw new ApiError(error.response?.status || 500, errorMessage);
  }
};

export const fetchFirstVisitCoupons = async (hotelId) => {
  try {
    const { data } = await api.get(
      `/api/hotel-settings/${hotelId}/first-visit-coupons`
    );
    if (process.env.NODE_ENV !== 'production') {
      console.log('[fetchFirstVisitCoupons] Response:', data);
    }
    return (
      data.firstVisitCoupons || {
        discountType: 'percentage',
        discountValue: 10,
        couponCount: 1,
      }
    );
  } catch (error) {
    console.error('[fetchFirstVisitCoupons] Error:', error);
    const errorMessage =
      error.response?.data?.message ||
      '최초 방문 쿠폰 설정을 가져오지 못했습니다.';
    throw new ApiError(error.response?.status || 500, errorMessage);
  }
};

// 호텔 사진 업로드
export const uploadHotelPhotos = async (formData) => {
  const response = await api.post('/api/hotel-settings/photos', formData);
  return response.data;
};

// 룸 컨테이너 추가
export const addRoomContainer = async (
  hotelId,
  roomInfo,
  roomNumber,
  floorNum
) => {
  try {
    const response = await api.post(
      `/api/hotel-settings/${hotelId}/containers`,
      { roomInfo, roomNumber, floorNum },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return response.data.container;
  } catch (error) {
    console.error('Error adding room container:', error);
    throw error.response?.data || error;
  }
};

// 토큰 관리 함수 공개
export { getAccessToken, getCsrfToken, getCsrfTokenId };

export default api;
