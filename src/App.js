/* global chrome */
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client'; // WebSocket 클라이언트 임포트
import { getAccessToken } from './api/api.js'; // 토큰 관리 함수 임포트

import Header from './components/Header.js';
import SideBar from './components/SideBar.js';
import RoomGrid from './components/RoomGrid.js';
import CanceledReservationsModal from './components/CanceledReservationsModal.js';
import MonthlyCalendar from './components/MonthlyCalendar';
import GuestFormModal from './components/GuestFormModal';
import DayUseFormModal from './components/DayUseFormModal.js';
import QuickRangeModal from './components/QuickRangeModal';
import Login from './components/Login';
import Register from './components/Register';
import ResetPassword from './components/ResetPassword';
import PrivacyConsent from './components/PrivacyConsentModal.js';

import DetailPanel from './components/DetailPanel';
import { parseDate, formatDate } from './utils/dateParser.js';
import HotelSettingsPage from './pages/HotelSettingsPage.js';
import {
  format,
  startOfMonth,
  addDays,
  endOfMonth,
  differenceInCalendarDays,
  startOfDay,
  addHours,
  // addMonths,
} from 'date-fns';

import { defaultRoomTypes } from './config/defaultRoomTypes';
import availableOTAs from './config/availableOTAs';
import SalesModal from './components/DailySalesModal.js';
// import { isCancelledStatus } from './utils/isCancelledStatus.js';
import UnassignedReservationsPanel from './components/UnassignedReservationsPanel';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';

// * Refactored: API 관련 함수들을 한 번에 import (중복 제거)
import api, {
  fetchReservations,
  deleteReservation,
  confirmReservation,
  updateReservation,
  saveOnSiteReservation,
  fetchHotelSettings,
  saveHotelSettings,
  updateHotelSettings,
  logoutUser,
} from './api/api.js';
import './App.css';
import './i18n';

import { matchRoomType } from './utils/matchRoomType.js';
import { extractPrice } from './utils/extractPrice.js';
import { computeRemainingInventory } from './utils/computeRemainingInventory';
import { calculateRoomAvailability } from './utils/availability';

// BASE_URL 정의 (api.js와 동일하게 설정)
const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3004';

/* ============================================================================
   HELPER FUNCTIONS (추후 별도 유틸 파일로 분리 가능)
   ============================================================================ */
// * Refactored: 매출 집계 및 날짜 관련 헬퍼 함수들을 컴포넌트 외부로 이동하여
function buildDailySalesByOTA(reservations, targetDate) {
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);
  const numDays = differenceInCalendarDays(monthEnd, monthStart) + 1;
  const labels = [];
  for (let i = 0; i < numDays; i++) {
    const d = addDays(monthStart, i);
    labels.push(formatDate(d, 'MM-dd')); // KST 기준 포맷팅
  }
  const categories = new Set([...availableOTAs, '현장예약', '대실', '기타']);
  const dailySalesByOTA = {}; // 수정: 공백 제거
  categories.forEach((cat) => {
    dailySalesByOTA[cat] = new Array(numDays).fill(0);
  });
  reservations.forEach((res) => {
    let category = '기타';
    if (res.siteName === '현장예약') {
      category = '현장예약';
    } else if (res.customerName?.includes('대실')) {
      category = '대실';
    } else if (availableOTAs.includes(res.siteName)) {
      category = res.siteName;
    }
    if (!res.parsedCheckInDate || !res.parsedCheckOutDate) return;
    const checkInDay = new Date(
      res.parsedCheckInDate.getFullYear(),
      res.parsedCheckInDate.getMonth(),
      res.parsedCheckInDate.getDate()
    );
    const checkOutDay = new Date(
      res.parsedCheckOutDate.getFullYear(),
      res.parsedCheckOutDate.getMonth(),
      res.parsedCheckOutDate.getDate()
    );
    let cursor = checkInDay;
    while (cursor < checkOutDay) {
      if (cursor < monthStart) {
        cursor = addDays(cursor, 1);
        continue;
      }
      if (cursor > monthEnd) break;
      const dayIndex = differenceInCalendarDays(cursor, monthStart);
      if (dayIndex >= 0 && dayIndex < numDays) {
        dailySalesByOTA[category][dayIndex]++;
      }
      cursor = addDays(cursor, 1);
    }
  });
  return { labels, dailySalesByOTA };
}

function buildMonthlyDailyBreakdown(reservations, targetDate) {
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);
  const totalDays = differenceInCalendarDays(monthEnd, monthStart) + 1;
  const dailyTotals = new Array(totalDays).fill(0);
  reservations.forEach((res) => {
    if (!res.nightlyRates) return;
    res.nightlyRates.forEach((nr) => {
      const rateDate = parseDate(nr.date);
      if (rateDate >= monthStart && rateDate <= monthEnd) {
        const dayIndex = differenceInCalendarDays(rateDate, monthStart);
        dailyTotals[dayIndex] += nr.rate;
      }
    });
  });
  return dailyTotals;
}

function sendOtaTogglesToExtension(otaToggles) {
  if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
    const EXTENSION_ID = process.env.REACT_APP_EXTENSION_ID;
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        action: 'SET_OTA_TOGGLES',
        toggles: otaToggles,
      },
      (response) => {
        console.log('[App] Sent otaToggles to extension:', response);
      }
    );
  }
}

/* ================================
   (★ 추가) roomTypes에 roomNumbers 채워주는 함수
   ================================ */
function buildRoomTypesWithNumbers(roomTypes, containers) {
  console.log('[buildRoomTypesWithNumbers] 시작');
  console.log('기존 roomTypes:', roomTypes);
  console.log('gridSettings.containers:', containers);

  // 1) roomTypes를 복제하면서, roomNumbers 필드를 빈 배열로 초기화
  const cloned = roomTypes.map((rt) => ({
    ...rt,
    roomNumbers: [],
  }));

  // 2) 각 container를 순회하며, container.roomInfo와 일치하는 roomType에 roomNumber를 등록
  containers.forEach((cont) => {
    const tKey = (cont.roomInfo || '').toLowerCase();
    const found = cloned.find(
      (rt) => (rt.roomInfo || '').toLowerCase() === tKey
    );
    if (found && cont.roomNumber) {
      found.roomNumbers.push(cont.roomNumber);
    }
  });

  console.log('[buildRoomTypesWithNumbers] 최종 roomTypes:', cloned);
  return cloned;
}

/* ============================================================================
   APP COMPONENT
   ============================================================================ */
const App = () => {
  // * Refactored: 상태 선언 부분 그룹화
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hotelId, setHotelId] = useState('');
  const [allReservations, setAllReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadedReservations, setLoadedReservations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeReservations, setActiveReservations] = useState([]);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [memos, setMemos] = useState({});
  const [hotelSettings, setHotelSettings] = useState({
    hotelAddress: '',
    phoneNumber: '',
    email: '',
    totalRooms: 0, // 필요 시 추가
    roomTypes: [], // 필요 시 추가
    gridSettings: {}, // 필요 시 추가
  });

  const [isNewSetup, setIsNewSetup] = useState(true);
  const [roomsSold, setRoomsSold] = useState(0);
  const [monthlySoldRooms, setMonthlySoldRooms] = useState(0);
  const [avgMonthlyRoomPrice, setAvgMonthlyRoomPrice] = useState(0);
  const dailyAverageRoomPrice =
    roomsSold > 0 ? Math.floor(dailyTotal / roomsSold) : 0;
  const [guestFormData, setGuestFormData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // const [hotelAddress, setHotelAddress] = useState('주소 정보 없음');
  // const [phoneNumber, setPhoneNumber] = useState('전화번호 정보 없음');
  // const [email, setEmail] = useState('이메일 정보 없음');
  const totalRooms = hotelSettings?.totalRooms || 0;
  const remainingRooms = totalRooms - roomsSold;
  // Use useMemo to memoize it:
  const roomTypes = useMemo(() => {
    return hotelSettings?.roomTypes || [];
  }, [hotelSettings]);

  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [newlyCreatedId, setNewlyCreatedId] = useState(null);
  const [updatedReservationId, setUpdatedReservationId] = useState(null);
  const [highlightedReservationIds, setHighlightedReservationIds] = useState(
    []
  );
  const [isSearching, setIsSearching] = useState(false);
  const highlightTimeoutRef = useRef(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [showCanceledModal, setShowCanceledModal] = useState(false);
  const [showQuickRangeModal, setShowQuickRangeModal] = useState(false);
  const [otaToggles, setOtaToggles] = useState(
    availableOTAs.reduce((acc, ota) => ({ ...acc, [ota]: false }), {})
  );
  const [selectedReservation, setSelectedReservation] = useState(null);
  // const [sortOrder, setSortOrder] = useState('newest');
  const navigate = useNavigate();

  const [isMonthlyView, setIsMonthlyView] = useState(false);

  const toggleMonthlyView = () => setIsMonthlyView((prev) => !prev);

  const handleReservationSelect = useCallback((res) => {
    setSelectedReservation(res);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedReservation(null);
  }, []);

  const handleDetailSave = (updatedData) => {
    // reservationId를 updatedData에서 추출 후 handleEdit 호출
    handleEdit(updatedData.reservationNo, updatedData, hotelId);
    setSelectedReservation(null);
  };

  const [isShining, setIsShining] = useState(false);
  const handleSync = useCallback(() => {
    setIsShining(true);
    setTimeout(() => setIsShining(false), 5000);
  }, []);

  const [labelsForOTA, setLabelsForOTA] = useState([]);
  const [dailySalesByOTA, setDailySalesByOTA] = useState({});
  const MAX_LOGS = 1000; // 최대 로그 개수

  const [logs, setLogs] = useState(() => {
    try {
      const stored = localStorage.getItem('logs');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('로그 파싱 실패:', e);
      return [];
    }
  });
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  const lastLogRef = useRef('');

  // 로그 수집 함수: 마지막 메시지와 동일하면 기록하지 않음, 배열 길이 제한 적용
  const logMessage = useCallback(
    (message) => {
      // 개발 환경에서만 로그 수집
      if (process.env.NODE_ENV !== 'development') return;
      if (message === lastLogRef.current) return;
      lastLogRef.current = message;
      const timestamp = new Date().toISOString();
      setLogs((prev) => {
        const newLogs = [
          ...prev,
          {
            timestamp,
            message,
            selectedDate: format(selectedDate, 'yyyy-MM-dd'),
          },
        ];
        // 최대 로그 개수 제한: 오래된 로그 삭제
        if (newLogs.length > MAX_LOGS) {
          return newLogs.slice(newLogs.length - MAX_LOGS);
        }
        return newLogs;
      });
    },
    [selectedDate]
  );

  // logs 상태 변경 시 localStorage에 저장
  useEffect(() => {
    try {
      localStorage.setItem('logs', JSON.stringify(logs));
    } catch (e) {
      console.error('로그 저장 실패:', e);
    }
  }, [logs]);

  // 콘솔 로그 오버라이드: 개발 환경에서만 적용
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      const msg = args.join(' ');
      if (
        msg.includes('Successfully moved') ||
        msg.toLowerCase().includes('deleted') ||
        msg.includes('Successfully created') ||
        msg.includes('Room created') ||
        msg.includes('새 예약')
      ) {
        logMessage(msg);
      }
      originalConsoleLog(...args);
    };
    return () => {
      console.log = originalConsoleLog;
    };
  }, [logMessage]);

  // 로그 뷰어 열기/닫기 함수
  const openLogViewer = () => setIsLogViewerOpen(true);
  const closeLogViewer = () => setIsLogViewerOpen(false);

  useEffect(() => {
    if (allReservations.length > 0 && selectedDate) {
      const { labels, dailySalesByOTA } = buildDailySalesByOTA(
        allReservations,
        selectedDate
      );
      setLabelsForOTA(labels);
      setDailySalesByOTA(dailySalesByOTA);
    }
  }, [allReservations, selectedDate]);

  useEffect(() => {
    const savedToggles = JSON.parse(localStorage.getItem('otaToggles'));
    if (savedToggles) setOtaToggles(savedToggles);
  }, []);

  const [flipAllMemos, setFlipAllMemos] = useState(false);
  const handleMemoButtonClick = useCallback(() => {
    setFlipAllMemos((prev) => !prev);
  }, []);

  const calculatePerNightPrice = useCallback(
    (reservation, totalPrice, nights) => {
      const priceNumber = Number(totalPrice); // totalPrice를 숫자로 변환
      if (nights > 0) {
        const perNightPrice = priceNumber / nights;
        // console.log(`(Revised) Per night price: ${perNightPrice}`);
        return Math.round(perNightPrice); // 정수 반환
      }
      return Math.round(priceNumber);
    },
    []
  );

  const onQuickCreateRange = (start, end, roomType) => {
    console.log('[onQuickCreateRange] Received:', { start, end, roomType });
    if (!start || !end || !roomType) {
      console.error('[onQuickCreateRange] Invalid arguments:', {
        start,
        end,
        roomType,
      });
      return;
    }

    const checkInTime = hotelSettings.checkInTime || '16:00';
    const checkOutTime = hotelSettings.checkOutTime || '11:00';

    const checkIn = `${format(start, 'yyyy-MM-dd')}T${checkInTime}:00+09:00`;
    const checkOut = `${format(end, 'yyyy-MM-dd')}T${checkOutTime}:00+09:00`;

    const guestData = {
      reservationNo: `현장예약-${uuidv4()}`,
      customerName: `현장:${format(new Date(), 'HH:mm:ss')}`,
      phoneNumber: '',
      checkInDate: format(start, 'yyyy-MM-dd'),
      checkInTime,
      checkOutDate: format(end, 'yyyy-MM-dd'),
      checkOutTime,
      reservationDate: format(new Date(), 'yyyy-MM-dd HH:mm'),
      roomInfo: roomType,
      price: '',
      paymentMethod: '미결제',
      specialRequests: '',
      checkIn, // 문자열
      checkOut, // 문자열
    };

    setGuestFormData(guestData);
    // 라우트를 일간 예약 화면으로 전환하여 월간 달력을 닫습니다.
    navigate('/');
    setShowQuickRangeModal(true);
  };

  // roomTypes와 activeReservations가 업데이트될 때마다 남은 재고 계산

  const remainingInventory = useMemo(() => {
    return computeRemainingInventory(roomTypes, activeReservations);
  }, [roomTypes, activeReservations]);

  // 남은 재고가 1 이하인 객실타입이 하나라도 있으면 true
  const hasLowStock = useMemo(() => {
    return Object.values(remainingInventory).some(
      (remaining) => remaining <= 1
    );
  }, [remainingInventory]);

  // 남은 재고가 1 이하인 객실 타입의 이름 배열을 계산
  const lowStockRoomTypes = useMemo(() => {
    return Object.entries(remainingInventory)
      .filter(([roomType, remaining]) => remaining <= 1)
      .map(([roomType]) => roomType);
  }, [remainingInventory]);

  const filterReservationsByDate = useCallback((reservationsData, date) => {
    if (!Array.isArray(reservationsData)) {
      console.warn('reservationsData가 배열이 아닙니다:', reservationsData);
      return [];
    }
    const selectedDateString = format(date, 'yyyy-MM-dd');
    const filtered = reservationsData
      .filter((reservation) => {
        if (!reservation || !reservation.checkIn || !reservation.checkOut) {
          console.warn('Invalid reservation data filtered out:', {
            _id: reservation?._id || 'unknown',
            reservation,
          });
          return false;
        }
        const checkInDate = new Date(reservation.checkIn);
        const checkOutDate = new Date(reservation.checkOut);
  
        if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
          console.warn('Invalid date parsing for reservation:', {
            _id: reservation?._id || 'unknown',
            checkIn: reservation.checkIn,
            checkOut: reservation.checkOut,
          });
          return false;
        }
        const checkInDateOnly = startOfDay(checkInDate);
        const checkOutDateOnly = startOfDay(checkOutDate);
        const isIncluded =
          selectedDateString >= format(checkInDateOnly, 'yyyy-MM-dd') &&
          selectedDateString < format(checkOutDateOnly, 'yyyy-MM-dd');
        const isSameDayStay =
          format(checkInDateOnly, 'yyyy-MM-dd') ===
            format(checkOutDateOnly, 'yyyy-MM-dd') &&
          selectedDateString === format(checkInDateOnly, 'yyyy-MM-dd');
        return isIncluded || isSameDayStay;
      })
      .filter((res) => res !== null);
    setActiveReservations(filtered);
    const breakdown = filtered.map((reservation) => {
      return reservation.nightlyRates?.[0]?.rate || reservation.totalPrice || 0;
    });
    setDailyBreakdown(breakdown);
    const dailyTotalAmount = breakdown.reduce((sum, price) => sum + price, 0);
    setDailyTotal(Math.floor(dailyTotalAmount));
    const firstDayOfMonth = startOfMonth(date);
    const lastDayOfMonth = date;
    const monthlyReservations = reservationsData.filter((reservation) => {
      if (!reservation.checkIn || !reservation.checkOut) return false;
      const checkInDate = new Date(reservation.checkIn);
      const checkOutDate = new Date(reservation.checkOut);
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()))
        return false;
      return (
        checkOutDate > firstDayOfMonth &&
        checkInDate < addDays(lastDayOfMonth, 1)
      );
    });
    let monthlyTotalAmount = 0;
    monthlyReservations.forEach((reservation) => {
      if (reservation.nightlyRates) {
        reservation.nightlyRates.forEach((nightlyRate) => {
          const rateDate = new Date(nightlyRate.date);
          if (rateDate >= firstDayOfMonth && rateDate <= lastDayOfMonth) {
            monthlyTotalAmount += Number(nightlyRate.rate || 0);
          }
        });
      }
    });
    monthlyTotalAmount = Math.max(0, Math.round(monthlyTotalAmount));
    setMonthlyTotal(monthlyTotalAmount); // 수정: setMonthlyTotal로 변경 및 세미콜론 추가
    let totalRoomsSold = 0;
    monthlyReservations.forEach((reservation) => {
      if (reservation.nightlyRates) {
        totalRoomsSold += reservation.nightlyRates.filter((nightlyRate) => {
          const rateDate = new Date(nightlyRate.date);
          return rateDate >= firstDayOfMonth && rateDate <= lastDayOfMonth;
        }).length;
      } else {
        totalRoomsSold += 1;
      }
    });
    setMonthlySoldRooms(totalRoomsSold);
    const avgPrice =
      totalRoomsSold > 0 ? Math.floor(monthlyTotalAmount / totalRoomsSold) : 0;
    setAvgMonthlyRoomPrice(avgPrice);
    setRoomsSold(filtered.length);
    setLoadedReservations(filtered.map((res) => res._id));
    return filtered;
  }, []);

  const [monthlyDailyBreakdown, setMonthlyDailyBreakdown] = useState([]);
  useEffect(() => {
    if (allReservations.length > 0 && selectedDate) {
      const breakdown = buildMonthlyDailyBreakdown(
        allReservations,
        selectedDate
      );
      setMonthlyDailyBreakdown(breakdown);
      console.log('Monthly Daily Breakdown:', breakdown);
    }
  }, [allReservations, selectedDate]);

  function isOtaReservation(reservation) {
    return availableOTAs.includes(reservation.siteName);
  }

  const processReservation = useCallback(
    (res) => {
      if (!res) {
        console.warn('예약 데이터가 없습니다.');
        return null;
      }
      if (!res.checkIn || !res.checkOut) {
        console.warn(
          `예약 ${res._id || 'unknown'}에 필수 날짜가 없습니다.`,
          res
        );
        return null;
      }
      const checkInDate = new Date(res.checkIn);
      const checkOutDate = new Date(res.checkOut);
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        console.warn('예약 날짜 파싱 오류:', {
          _id: res._id,
          checkIn: res.checkIn,
          checkOut: res.checkOut,
        });
        return null;
      }
      const { price, isDefault } = extractPrice(
        res.priceString || res.price || '0'
      );
      let totalPrice = price;
      let isDefaultPriceFlag = isDefault;
      if (!isOtaReservation(res) && totalPrice <= 0) {
        const roomType = matchRoomType(res.roomInfo);
        const basePrice = roomType?.price || 0;
        if (res.type === 'dayUse' && res.durationHours) {
          totalPrice = (basePrice / 2) * res.durationHours; // 대실 기본 단가 계산
        } else {
          totalPrice = basePrice;
        }
        isDefaultPriceFlag = false;
      }
      let nightlyRates = [];
      const checkInDateOnly = startOfDay(checkInDate);
      const checkOutDateOnly = startOfDay(checkOutDate);
      const days = Math.floor(
        (checkOutDateOnly - checkInDateOnly) / (1000 * 60 * 60 * 24)
      );
      const nights = res.type === 'dayUse' ? 1 : days > 0 ? days : 1;
      if (isDefaultPriceFlag) {
        totalPrice = 100000;
      }
      const perNightPriceCalculated = calculatePerNightPrice(
        res,
        totalPrice,
        nights
      );
      for (let i = 0; i < nights; i++) {
        const date = addDays(checkInDateOnly, i);
        nightlyRates.push({
          date: format(date, 'yyyy-MM-dd'),
          rate: perNightPriceCalculated,
        });
      }
      const finalTotalPrice = nightlyRates.reduce(
        (sum, nr) => sum + nr.rate,
        0
      );
      return {
        ...res,
        type: res.type || 'stay',
        duration: res.type === 'dayUse' ? res.durationHours || 3 : undefined,
        reservationNo: res.reservationNo || res._id,
        nightlyRates: nightlyRates.length > 0 ? nightlyRates : undefined,
        isDefaultPrice: isDefaultPriceFlag,
        totalPrice: res.type === 'dayUse' ? totalPrice : finalTotalPrice,
        checkIn: res.checkIn,
        checkOut: res.checkOut,
        paymentMethod: res.paymentMethod,
      };
    },
    [calculatePerNightPrice]
  );

  const loadHotelSettings = useCallback(
    async (inputHotelId) => {
      try {
        const settings = await fetchHotelSettings(inputHotelId);
        // console.log(
        //   'Fetched settings from API:',
        //   JSON.stringify(settings, null, 2)
        // ); // API 반환 데이터 전체 출력

        if (settings) {
          const isNewDoc = !settings._id;
          setIsNewSetup(isNewDoc);

          // 필드명 매핑 확장 및 기본값 보장
          const updatedSettings = {
            ...settings,
            hotelAddress:
              settings.address || settings.hotelAddress || '주소 정보 없음',
            phoneNumber:
              settings.phoneNumber ||
              settings.contactPhone ||
              '전화번호 정보 없음',
            email:
              settings.email || settings.contactEmail || '이메일 정보 없음',
            totalRooms:
              settings.totalRooms ||
              defaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0),
            roomTypes: settings.roomTypes || defaultRoomTypes,
            gridSettings: settings.gridSettings || {},
          };
          setHotelSettings(updatedSettings);

          // OTA 토글 초기화
          const initialOTAToggles = (settings.otas || []).reduce((acc, ota) => {
            acc[ota.name] = ota.isActive;
            return acc;
          }, {});
          availableOTAs.forEach((ota) => {
            if (!(ota in initialOTAToggles)) initialOTAToggles[ota] = false;
          });
          console.log('Initial OTA Toggles:', initialOTAToggles);
          setOtaToggles(initialOTAToggles);

          return updatedSettings;
        } else {
          console.warn(
            'No settings returned from fetchHotelSettings, using defaults'
          );
          const defaultOTAToggles = availableOTAs.reduce(
            (acc, ota) => ({ ...acc, [ota]: false }),
            {}
          );
          const defaultSettings = {
            hotelId: inputHotelId,
            hotelAddress: '주소 정보 없음',
            phoneNumber: '전화번호 정보 없음',
            email: '이메일 정보 없음',
            totalRooms: defaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0),
            roomTypes: defaultRoomTypes,
            gridSettings: {},
            otas: availableOTAs.map((ota) => ({ name: ota, isActive: false })),
          };
          setHotelSettings(defaultSettings);
          setIsNewSetup(true);
          setOtaToggles(defaultOTAToggles);
          return defaultSettings;
        }
      } catch (error) {
        console.error('Failed to load hotel settings:', error);
        if (error.response) {
          console.log(
            'Error response:',
            JSON.stringify(error.response.data, null, 2)
          ); // API 오류 상세 출력
        } else {
          console.log('Error details:', error.message); // 네트워크 오류 등 상세 출력
        }

        // 기본값으로 설정 초기화
        const defaultOTAToggles = availableOTAs.reduce(
          (acc, ota) => ({ ...acc, [ota]: false }),
          {}
        );
        const defaultSettings = {
          hotelId: inputHotelId,
          hotelAddress: '주소 정보 없음',
          phoneNumber: '전화번호 정보 없음',
          email: '이메일 정보 없음',
          totalRooms: defaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0),
          roomTypes: defaultRoomTypes,
          gridSettings: {},
          otas: availableOTAs.map((ota) => ({ name: ota, isActive: false })),
        };
        setHotelSettings(defaultSettings);
        setIsNewSetup(true);
        setOtaToggles(defaultOTAToggles);
        return defaultSettings;
      }
    },
    [] // 빈 배열로 변경
  );

  // 예약 로드 통합
  const loadReservations = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const data = await fetchReservations(hotelId);
      const processedReservations = data
        .map(processReservation)
        .filter((r) => r);
      setAllReservations(processedReservations);
      filterReservationsByDate(processedReservations, selectedDate);
    } catch (error) {
      console.error('Failed to load reservations:', error);
    }
    setLoading(false);
  }, [filterReservationsByDate, selectedDate, hotelId, processReservation]);

  const today = useCallback(() => {
    const currentDate = parseDate(new Date().toISOString()); // KST로 파싱
    setSelectedDate(currentDate);
    filterReservationsByDate(allReservations, currentDate);
    console.log('Moved to Today:', currentDate);
    return currentDate;
  }, [allReservations, filterReservationsByDate]);

  const handleDelete = useCallback(
    async (reservationId, hotelIdParam, siteName) => {
      try {
        await deleteReservation(reservationId, hotelIdParam, siteName);
        await loadReservations();
      } catch (error) {
        console.error(`Failed to delete reservation ${reservationId}:`, error);
        throw error;
      }
    },
    [loadReservations]
  );

  const sendMessageAsync = (id, message) =>
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(id, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });

  const handleLogin = useCallback(
    async (accessToken, hotelIdParam) => {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('hotelId', hotelIdParam);
      setIsAuthenticated(true);
      setHotelId(hotelIdParam);
      try {
        const EXTENSION_ID = process.env.REACT_APP_EXTENSION_ID;
        if (
          window.chrome &&
          chrome.runtime &&
          chrome.runtime.sendMessage &&
          EXTENSION_ID
        ) {
          const refreshToken = localStorage.getItem('refreshToken');
          const csrfToken = localStorage.getItem('csrfToken');

          await sendMessageAsync(EXTENSION_ID, {
            action: 'SET_TOKEN',
            token: accessToken,
            refreshToken,
            csrfToken,
          }).then((response) =>
            console.log('[handleLogin] Sent tokens to extension:', response)
          );

          await sendMessageAsync(EXTENSION_ID, {
            action: 'SET_OTA_TOGGLES',
            toggles: otaToggles,
          }).then((response) =>
            console.log(
              '[handleLogin] Sent OTA toggles to extension:',
              response
            )
          );
        }
        await loadHotelSettings(hotelIdParam);
        await loadReservations();
      } catch (error) {
        console.error('Failed to load hotel settings after login:', error);
        alert('로그인 후 설정 로드에 실패했습니다. 다시 시도해 주세요.');
      }
    },
    [loadHotelSettings, loadReservations, otaToggles]
  );

  const handleConfirm = useCallback(
    async (reservationId, hotelIdParam) => {
      try {
        await confirmReservation(reservationId, hotelIdParam);
        await loadReservations();
        console.log(
          `Reservation ${reservationId} confirmed for hotel ${hotelIdParam}`
        );
      } catch (error) {
        console.error(`Failed to confirm reservation ${reservationId}:`, error);
        alert('예약 확정에 실패했습니다. 다시 시도해주세요.');
      }
    },
    [loadReservations]
  );

  const handleRoomChangeAndSync = useCallback(
    async (reservationId, newRoomNumber, newRoomInfo, currentPrice) => {
      try {
        const currentReservation = allReservations.find(
          (res) => res._id === reservationId
        );
        if (!currentReservation) {
          console.warn(`No reservation found for ID: ${reservationId}`);
          return;
        }

        if (
          currentReservation.roomNumber === newRoomNumber &&
          currentReservation.roomInfo === newRoomInfo
        ) {
          console.log(`No change in room assignment for ${reservationId}`);
          return;
        }

        // 이전 객실 번호가 없으면 '미배정'으로 표기
        const oldRoom = currentReservation.roomNumber || '미배정';

        const isOTA = availableOTAs.includes(currentReservation.siteName);
        const checkInTime = hotelSettings?.checkInTime || '16:00';
        const checkOutTime = hotelSettings?.checkOutTime || '11:00';

        const updatedData = {
          roomNumber: newRoomNumber,
          roomInfo: newRoomInfo,
          price: currentPrice || currentReservation.totalPrice,
          checkIn: isOTA
            ? currentReservation.checkIn // OTA는 원본 문자열 유지
            : currentReservation.type === 'dayUse'
            ? currentReservation.checkIn // 대실은 원본 유지
            : `${format(
                new Date(currentReservation.checkIn),
                'yyyy-MM-dd'
              )}T${checkInTime}:00+09:00`,
          checkOut: isOTA
            ? currentReservation.checkOut // OTA는 원본 문자열 유지
            : currentReservation.type === 'dayUse'
            ? currentReservation.checkOut // 대실은 원본 유지
            : `${format(
                new Date(currentReservation.checkOut),
                'yyyy-MM-dd'
              )}T${checkOutTime}:00+09:00`,
        };

        const updatedReservation = await updateReservation(
          reservationId,
          updatedData,
          hotelId
        );

        setAllReservations((prevReservations) => {
          const updatedReservations = prevReservations.map((res) =>
            res._id === reservationId ? { ...res, ...updatedReservation } : res
          );
          filterReservationsByDate(updatedReservations, selectedDate);
          setUpdatedReservationId(reservationId);
          setTimeout(() => setUpdatedReservationId(null), 10000);

          const logMsg = `[handleRoomChangeAndSync] Successfully moved reservation ${reservationId} from ${oldRoom} to ${newRoomNumber}`;
          console.log(logMsg, updatedReservation);
          return updatedReservations;
        });
      } catch (error) {
        console.error('객실 이동 후 실시간 업데이트 실패:', error);
        alert('객실 이동 후 업데이트에 실패했습니다.');
        await loadReservations();
      }
    },
    [
      hotelId,
      selectedDate,
      filterReservationsByDate,
      loadReservations,
      allReservations,
      hotelSettings,
    ]
  );

  // finalRoomTypes에서 'none' 제외
  const finalRoomTypes = useMemo(() => {
    const { roomTypes = [], gridSettings = {} } = hotelSettings || {};
    const containers = gridSettings.floors
      ? gridSettings.floors.flatMap((floor) => floor.containers || [])
      : [];
    if (!roomTypes.length) return [];
    const merged = buildRoomTypesWithNumbers(roomTypes, containers);
    return merged.filter((rt) => rt.roomInfo.toLowerCase() !== 'none');
  }, [hotelSettings]);

  const availabilityByDate = useMemo(() => {
    if (!allReservations || !finalRoomTypes) {
      console.warn('Reservations or roomTypes is missing in App.js');
      return {};
    }

    const safeSelectedDate =
      selectedDate instanceof Date && !isNaN(selectedDate)
        ? parseDate(selectedDate.toISOString()) // KST로 파싱
        : parseDate(new Date().toISOString());

    const calcFromDate = startOfDay(safeSelectedDate); // 선택된 날짜로 변경
    const calcToDate = startOfDay(addDays(safeSelectedDate, 1)); // 다음 날까지
    const selectedDates = [
      format(addDays(safeSelectedDate, -1), 'yyyy-MM-dd'),
      format(safeSelectedDate, 'yyyy-MM-dd'),
      format(addDays(safeSelectedDate, 1), 'yyyy-MM-dd'),
    ];

    console.log(
      '[App.js] Calculating availabilityByDate for selectedDate:',
      format(safeSelectedDate, 'yyyy-MM-dd'),
      'with selectedDates:',
      selectedDates
    );

    return calculateRoomAvailability(
      allReservations,
      finalRoomTypes,
      calcFromDate,
      calcToDate,
      hotelSettings?.gridSettings || {},
      selectedDates
    );
  }, [allReservations, finalRoomTypes, hotelSettings, selectedDate]);

  const handlePartialUpdate = useCallback(
    async (reservationId, updatedData) => {
      const currentReservation = allReservations.find(
        (res) => res._id === reservationId
      );
      if (!currentReservation) return;

      const currentPrice = String(currentReservation.price ?? '');
      const updatedPrice = String(updatedData.price ?? '');
      const currentCheckOut = formatDate(
        parseDate(currentReservation.checkOut),
        "yyyy-MM-dd'T'HH:mm:ss"
      );
      const updatedCheckOut = formatDate(
        parseDate(updatedData.checkOut || currentReservation.checkOut),
        "yyyy-MM-dd'T'HH:mm:ss"
      );
      const currentSpecialReq = (
        currentReservation.specialRequests ?? ''
      ).trim();
      const updatedSpecialReq = (updatedData.specialRequests ?? '').trim();

      let changes = [];
      if (currentPrice !== updatedPrice) {
        changes.push(`가격: ${currentPrice} -> ${updatedPrice}`);
      }
      if (currentCheckOut !== updatedCheckOut) {
        changes.push(`체크아웃: ${currentCheckOut} -> ${updatedCheckOut}`);
      }
      if ((currentSpecialReq || '없음') !== (updatedSpecialReq || '없음')) {
        changes.push(
          `특별요청: ${currentSpecialReq || '없음'} -> ${
            updatedSpecialReq || '없음'
          }`
        );
      }
      const currentPayment = currentReservation.paymentMethod || '미결제';
      const updatedPayment = updatedData.paymentMethod || '미결제';
      if (currentPayment !== updatedPayment) {
        changes.push(`결제방법: ${currentPayment} -> ${updatedPayment}`);
      }

      if (changes.length === 0) {
        console.log('변경된 세부 정보가 없습니다. 업데이트를 생략합니다.');
        return;
      }

      const changeLog = `예약 ${reservationId} 부분 업데이트됨:\n${changes.join(
        '\n'
      )}`;

      try {
        const newCheckIn = updatedData.checkIn || currentReservation.checkIn;
        const newCheckOut = updatedData.checkOut || currentReservation.checkOut;
        const newParsedCheckInDate = parseDate(newCheckIn);
        const newParsedCheckOutDate = parseDate(newCheckOut);

        await updateReservation(
          reservationId,
          {
            ...updatedData,
            checkIn: formatDate(newParsedCheckInDate, "yyyy-MM-dd'T'HH:mm:ss"),
            checkOut: formatDate(
              newParsedCheckOutDate,
              "yyyy-MM-dd'T'HH:mm:ss"
            ),
            parsedCheckInDate: newParsedCheckInDate,
            parsedCheckOutDate: newParsedCheckOutDate,
            roomInfo: currentReservation.roomInfo,
            roomNumber: updatedData.roomNumber || currentReservation.roomNumber,
            price: updatedData.price || currentReservation.totalPrice,
            totalPrice: updatedData.price || currentReservation.totalPrice,
            paymentMethod:
              updatedData.paymentMethod ||
              currentReservation.paymentMethod ||
              '미결제', // 명시적 보장
          },
          hotelId
        );

        setUpdatedReservationId(reservationId);
        setTimeout(() => setUpdatedReservationId(null), 10000);
        console.log(changeLog);
        logMessage(changeLog);
      } catch (error) {
        console.error(`예약 ${reservationId} 부분 업데이트 실패:`, error);
        alert('예약 수정에 실패했습니다. 다시 시도해주세요.');
        await loadReservations();
      }
    },
    [allReservations, hotelId, loadReservations, logMessage]
  );


  const handleEdit = useCallback(
    async (reservationId, updatedData) => {
      const currentReservation = allReservations.find(
        (res) => res._id === reservationId
      );
      if (!currentReservation) return;
  
      try {
        const isOTA = availableOTAs.includes(currentReservation.siteName);
        if (isOTA && !updatedData.manualAssignment) {
          updatedData.roomNumber = '';
          updatedData.price = currentReservation.price;
        }
        const roomChange =
          updatedData.roomNumber !== currentReservation.roomNumber;
        if (roomChange) {
          await handleRoomChangeAndSync(
            reservationId,
            updatedData.roomNumber,
            updatedData.roomInfo || currentReservation.roomInfo,
            updatedData.price || currentReservation.totalPrice
          );
        }
  
        // checkOut이 null인 경우 기본값 설정
        if (!updatedData.checkOut) {
          console.warn('checkOut is null, setting default value');
          updatedData.checkOut = format(
            addHours(new Date(), 3),
            "yyyy-MM-dd'T'HH:mm:ss+09:00"
          );
          updatedData.checkOutDate = format(
            new Date(updatedData.checkOut),
            'yyyy-MM-dd'
          );
          updatedData.checkOutTime = format(
            new Date(updatedData.checkOut),
            'HH:mm'
          );
        }
  
        // 대실의 경우 durationHours 변경에 따른 가격 재계산
        if (currentReservation.type === 'dayUse' && updatedData.durationHours) {
          const roomType = matchRoomType(currentReservation.roomInfo) || finalRoomTypes[0];
          const basePricePerHour = (roomType?.price || 0) / 2; // 대실 기본 단가 (룸타입 가격의 절반)
          const priceIncreasePerHour = 10000; // 1시간당 추가 요금
          const newDurationHours = parseInt(updatedData.durationHours, 10) || 3;
          const oldDurationHours = currentReservation.durationHours || 3;
  
          // 새로운 총 가격 계산: 기본 단가 * 시간 + 추가 요금
          const newBasePrice = basePricePerHour * newDurationHours;
          const oldBasePrice = basePricePerHour * oldDurationHours;
          const priceDifference = (newBasePrice - oldBasePrice) + (priceIncreasePerHour * (newDurationHours - oldDurationHours));
          updatedData.price = String(parseInt(currentReservation.price || newBasePrice) + priceDifference);
          updatedData.totalPrice = updatedData.price; // 대실은 nightlyRates 없이 totalPrice 사용
  
          // 체크아웃 시간 업데이트
          updatedData.checkOut = format(
            addHours(new Date(updatedData.checkIn), newDurationHours),
            "yyyy-MM-dd'T'HH:mm:ss+09:00"
          );
          updatedData.checkOutDate = format(
            addHours(new Date(updatedData.checkIn), newDurationHours),
            'yyyy-MM-dd'
          );
          updatedData.checkOutTime = format(
            addHours(new Date(updatedData.checkIn), newDurationHours),
            'HH:mm'
          );
        }
  
        // 수정 모달 열기
        setGuestFormData(updatedData);
        setShowGuestForm(true);
  
        const updatedReservationData = {
          ...updatedData,
          type: updatedData.type || currentReservation.type || 'stay',
          duration:
            updatedData.type === 'dayUse'
              ? updatedData.durationHours || currentReservation.durationHours || 3
              : undefined,
        };
        await updateReservation(reservationId, updatedReservationData, hotelId);
  
        // 상태 업데이트 최적화: 동일한 데이터면 업데이트 생략
        setAllReservations((prev) => {
          const processedUpdatedReservation = processReservation(
            updatedReservationData
          );
          const existingReservation = prev.find(
            (res) => res._id === reservationId
          );
          if (
            JSON.stringify(existingReservation) ===
            JSON.stringify(processedUpdatedReservation)
          ) {
            return prev; // 동일하면 업데이트 생략
          }
          return prev.map((res) =>
            res._id === reservationId ? processedUpdatedReservation : res
          );
        });
  
        const changes = [];
        if (currentReservation.price !== updatedData.price)
          changes.push(
            `가격: ${currentReservation.price} -> ${updatedData.price}`
          );
        if (currentReservation.checkOut !== updatedData.checkOut)
          changes.push(
            `체크아웃: ${currentReservation.checkOut} -> ${updatedData.checkOut}`
          );
        if (changes.length > 0) {
          const updateLog = `예약 ${reservationId} 수정됨:\n${changes.join(
            '\n'
          )}`;
          console.log(updateLog);
          logMessage(updateLog);
        }
      } catch (error) {
        console.error(`Failed to update reservation ${reservationId}:`, error);
        alert(
          error.status === 403
            ? 'CSRF 토큰 오류: 페이지를 새로고침 후 다시 시도해주세요.'
            : '예약 수정에 실패했습니다.'
        );
        await loadReservations();
      }
    },
    [
      allReservations,
      hotelId,
      loadReservations,
      handleRoomChangeAndSync,
      processReservation,
      logMessage,
      finalRoomTypes,
    ]
  );

  const socketRef = useRef(null);
  const [isJoinedHotel, setIsJoinedHotel] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false); // 연결 시도 상태 추가
  
  // 이벤트 핸들러 정의 (useCallback으로 최적화)
  const handleReservationCreated = useCallback(
    (data, callback) => {
      console.log(`Received reservationCreated: ${data.reservation?._id || 'unknown'}`);
      const newReservation = processReservation(data.reservation);
      if (newReservation && isJoinedHotel) {
        setAllReservations((prev) => {
          const updated = [...prev, newReservation];
          const filtered = filterReservationsByDate(updated, selectedDate);
          setActiveReservations(filtered);
          return updated;
        });
        callback?.({ success: true });
      } else {
        console.error(
          'Invalid reservation data from WebSocket or not joined:',
          data.reservation
        );
        callback?.({
          success: false,
          error: isJoinedHotel ? 'Invalid reservation data' : 'Not joined to hotel room',
        });
      }
    },
    [processReservation, isJoinedHotel, filterReservationsByDate, selectedDate]
  );
  
  const handleReservationUpdated = useCallback(
    (data, callback) => {
      console.log(
        `Received reservationUpdated: ${
          data.reservation?._id
        } at ${new Date().toISOString()}, data:`,
        JSON.stringify(data, null, 2)
      );
      const updatedReservation = processReservation(data.reservation);
      if (updatedReservation && isJoinedHotel) {
        setAllReservations((prev) => {
          const existingIndex = prev.findIndex(
            (res) => res._id === updatedReservation._id
          );
          if (
            existingIndex !== -1 &&
            prev[existingIndex].updatedAt === updatedReservation.updatedAt
          ) {
            console.log(`Duplicate update skipped for ${updatedReservation._id}`);
            callback?.({ success: true });
            return prev;
          }
          const updated = prev.map((res) =>
            res._id === updatedReservation._id ? updatedReservation : res
          );
          const filtered = filterReservationsByDate(updated, selectedDate);
          setActiveReservations(filtered);
          setUpdatedReservationId(updatedReservation._id);
          setTimeout(() => setUpdatedReservationId(null), 10000);
          callback?.({ success: true });
          return updated;
        });
      } else {
        callback?.({
          success: false,
          error: isJoinedHotel ? 'Invalid reservation data' : 'Not joined to hotel room',
        });
      }
    },
    [processReservation, isJoinedHotel, filterReservationsByDate, selectedDate]
  );
  
  const handleReservationDeleted = useCallback(
    (data, callback) => {
      console.log(`Received reservationDeleted: ${data.reservationId}`);
      if (isJoinedHotel) {
        setAllReservations((prev) => {
          const updated = prev.filter((res) => res._id !== data.reservationId);
          const filtered = filterReservationsByDate(updated, selectedDate);
          setActiveReservations(filtered);
          callback?.({ success: true });
          return updated;
        });
      } else {
        callback?.({ success: false, error: 'Not joined to hotel room' });
      }
    },
    [isJoinedHotel, filterReservationsByDate, selectedDate]
  );
  
  const handleForceLogout = useCallback(
    (data, callback) => {
      console.log('Force logout received:', data.message);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      localStorage.removeItem('accessToken');
      localStorage.removeItem('hotelId');
      localStorage.removeItem('csrfToken');
      document.cookie = '_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      document.cookie =
        'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      setIsAuthenticated(false);
      setHotelId('');
      setHotelSettings(null);
      setAllReservations([]);
      setActiveReservations([]);
      setRoomsSold(0);
      setMonthlySoldRooms(0);
      setAvgMonthlyRoomPrice(0);
      setSelectedDate(new Date());
      setDailyTotal(0);
      setOtaToggles(
        availableOTAs.reduce((acc, ota) => ({ ...acc, [ota]: false }), {})
      );
      navigate('/login', { replace: true });
      alert(data.message);
      callback?.({ success: true });
      setIsJoinedHotel(false);
    },
    [navigate]
  );
  
  // WebSocket 통합 로직
  useEffect(() => {
    let socketCleanup = () => {};
  
    const initializeAndManageSocket = () => {
      // 인증되지 않았거나 hotelId가 없으면 연결 해제
      if (!isAuthenticated || !hotelId) {
        if (socketRef.current) {
          socketRef.current.disconnect();
          setIsJoinedHotel(false);
          setIsConnecting(false);
        }
        return;
      }
  
      // WebSocket 인스턴스 초기화 (한 번만 생성)
      if (!socketRef.current) {
        socketRef.current = io(BASE_URL, {
          withCredentials: true,
          query: { hotelId, accessToken: getAccessToken() },
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 500,
          reconnectionDelayMax: 3000,
          randomizationFactor: 0.5,
          timeout: 10000,
          autoConnect: false,
          transports: ['websocket'],
        });
        console.log('[WebSocket] Initialized new socket instance');
      }
  
      // WebSocket 상태 관리 함수
      const manageConnection = () => {
        setIsConnecting(true);
  
        const handleConnect = () => {
          console.log('WebSocket connected at:', new Date().toISOString());
          setIsConnecting(false);
          setIsJoinedHotel(false); // 초기화
          socketRef.current.emit('joinHotel', hotelId, (ack) => {
            if (ack && ack.success) {
              console.log(`Successfully joined hotel room: ${hotelId}`);
              setIsJoinedHotel(true);
            } else {
              console.warn('Failed to join hotel room:', ack?.error || 'No ack');
              setIsJoinedHotel(false);
            }
          });
        };
  
        const handleConnectError = (error) => {
          console.error('WebSocket connection error:', error.message);
          setIsConnecting(false);
          setIsJoinedHotel(false);
          // 사용자에게 연결 실패 알림 (필요 시 추가)
          // alert('WebSocket 연결에 실패했습니다. 네트워크 상태를 확인해주세요.');
        };
  
        const handleDisconnect = (reason) => {
          console.log(
            'WebSocket disconnected at:',
            new Date().toISOString(),
            'Reason:',
            reason
          );
          setIsJoinedHotel(false);
          setIsConnecting(false);
        };
  
        const handleReconnect = (attemptNumber) => {
          console.log(
            `WebSocket reconnected after attempt ${attemptNumber} at:`,
            new Date().toISOString()
          );
          setIsJoinedHotel(false);
          socketRef.current.emit('joinHotel', hotelId, (ack) => {
            if (ack && ack.success) {
              console.log(`Rejoined hotel room: ${hotelId} after reconnect`);
              setIsJoinedHotel(true);
            } else {
              console.warn('Failed to rejoin hotel room:', ack?.error || 'No ack');
              setIsJoinedHotel(false);
            }
          });
        };
  
        const handleReconnectAttempt = (attemptNumber) => {
          console.log(
            `Reconnection attempt #${attemptNumber} at:`,
            new Date().toISOString()
          );
        };
  
        const handleReconnectFailed = () => {
          console.error('WebSocket reconnection failed after all attempts');
          setIsConnecting(false);
          setIsJoinedHotel(false);
          loadReservations().catch((error) =>
            console.error('Fallback load failed:', error)
          );
          // 사용자에게 재연결 실패 알림 (필요 시 추가)
          // alert('WebSocket 재연결에 실패했습니다. 예약 데이터를 새로고침합니다.');
        };
  
        // 이벤트 리스너 등록
        socketRef.current.on('connect', handleConnect);
        socketRef.current.on('connect_error', handleConnectError);
        socketRef.current.on('disconnect', handleDisconnect);
        socketRef.current.on('reconnect', handleReconnect);
        socketRef.current.on('reconnect_attempt', handleReconnectAttempt);
        socketRef.current.on('reconnect_failed', handleReconnectFailed);
        socketRef.current.on('reservationCreated', handleReservationCreated);
        socketRef.current.on('reservationUpdated', handleReservationUpdated);
        socketRef.current.on('reservationDeleted', handleReservationDeleted);
        socketRef.current.on('forceLogout', handleForceLogout);
  
        // 수동 연결 시작
        if (!socketRef.current.connected && !isConnecting) {
          socketRef.current.connect();
        }
  
        // 클린업 함수
        socketCleanup = () => {
          if (socketRef.current) {
            socketRef.current.off('connect', handleConnect);
            socketRef.current.off('connect_error', handleConnectError);
            socketRef.current.off('disconnect', handleDisconnect);
            socketRef.current.off('reconnect', handleReconnect);
            socketRef.current.off('reconnect_attempt', handleReconnectAttempt);
            socketRef.current.off('reconnect_failed', handleReconnectFailed);
            socketRef.current.off('reservationCreated', handleReservationCreated);
            socketRef.current.off('reservationUpdated', handleReservationUpdated);
            socketRef.current.off('reservationDeleted', handleReservationDeleted);
            socketRef.current.off('forceLogout', handleForceLogout);
            socketRef.current.disconnect();
            console.log(
              'WebSocket cleanup and disconnected at:',
              new Date().toISOString()
            );
          }
          setIsJoinedHotel(false);
          setIsConnecting(false);
        };
      };
  
      manageConnection();
    };
  
    initializeAndManageSocket();
  
    return socketCleanup;
  }, [
    isAuthenticated,
    hotelId,
    processReservation,
    navigate,
    filterReservationsByDate,
    selectedDate,
    loadReservations,
    handleReservationCreated,
    handleReservationUpdated,
    handleReservationDeleted,
    handleForceLogout,
    isConnecting,
  ]);

  const handlePrevDay = useCallback(() => {
    setSelectedDate((prevDate) => {
      const newDate = addDays(prevDate, -1);
      loadReservations().then(() =>
        filterReservationsByDate(allReservations, newDate)
      );
      console.log('Moved to Previous Day:', newDate);
      return newDate;
    });
  }, [filterReservationsByDate, allReservations, loadReservations]);

  const handleNextDay = useCallback(() => {
    setSelectedDate((prevDate) => {
      const newDate = addDays(prevDate, 1);
      loadReservations().then(() =>
        filterReservationsByDate(allReservations, newDate)
      );
      console.log('Moved to Next Day:', newDate);
      return newDate;
    });
  }, [filterReservationsByDate, allReservations, loadReservations]);

  useEffect(() => {
    let lastKeyTime = 0;
    function handleKeyDown(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const ignoreTags = ['INPUT', 'TEXTAREA', 'SELECT'];
      if (ignoreTags.includes(e.target.tagName)) return;
      const now = Date.now();
      if (now - lastKeyTime < 300) return;
      if (e.key === 'ArrowLeft') handlePrevDay();
      else handleNextDay();
      lastKeyTime = now;
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePrevDay, handleNextDay]);

  const handleToggleOTA = useCallback(
    async (ota) => {
      if (!availableOTAs.includes(ota)) {
        console.warn(`Unsupported OTA: ${ota}`);
        return;
      }
      setOtaToggles((prevOtaToggles) => {
        const updatedOtaToggles = {
          ...prevOtaToggles,
          [ota]: !prevOtaToggles[ota],
        };
        updateHotelSettings(hotelId, {
          otas: availableOTAs.map((name) => ({
            name,
            isActive: updatedOtaToggles[name],
          })),
        })
          .then(() => {
            sendOtaTogglesToExtension(updatedOtaToggles);
            console.log(`OTA ${ota} 상태가 변경되었습니다.`);
          })
          .catch((error) => {
            console.error(`OTA ${ota} 상태 업데이트 실패:`, error);
            setOtaToggles((prev) => ({
              ...prev,
              [ota]: !prev[ota],
            }));
          });
        return updatedOtaToggles;
      });
    },
    [hotelId]
  );

  const handleFormSave = async (reservationId, data) => {
    console.log('[handleFormSave] Received data:', data);
    try {
      const reservationData = {
        siteName: '현장예약',
        reservations: [
          {
            ...data,
            type: data.type || 'stay', // 기본값 'stay'
            duration:
              data.type === 'dayUse' ? data.durationHours || 3 : undefined, // 대실일 경우 duration 설정
          },
        ],
        hotelId,
      };
      if (reservationId) {
        await updateReservation(
          reservationId,
          reservationData.reservations[0],
          hotelId
        );
        console.log(
          `${data.type === 'dayUse' ? '대실' : '숙박'} 예약이 수정되었습니다.`
        );
      } else {
        const response = await saveOnSiteReservation(reservationData);
        console.log('[handleFormSave] API Response:', response);
        if (
          response &&
          Array.isArray(response.createdReservationIds) &&
          response.createdReservationIds.length > 0
        ) {
          const newlyCreatedIdFromServer = response.createdReservationIds[0];
          const createdReservationDetails = `예약 생성됨:
    예약 ID: ${newlyCreatedIdFromServer}
    고객명: ${data.customerName || '정보 없음'}
    룸타입: ${data.roomInfo || '정보 없음'}
    가격: ${data.price || '정보 없음'}
    체크인: ${data.checkIn || '정보 없음'}
    체크아웃: ${data.checkOut || '정보 없음'}
    타입: ${data.type || 'stay'}`;
          logMessage(createdReservationDetails);
          if (data.checkIn) {
            const parsedDate = parseDate(data.checkIn);
            setSelectedDate(parsedDate);
          }
          setNewlyCreatedId(newlyCreatedIdFromServer);
          setTimeout(() => setNewlyCreatedId(null), 10000);
        } else {
          throw new Error('예약 ID가 반환되지 않았습니다.');
        }
      }
      setShowGuestForm(false);
      await loadReservations();
    } catch (error) {
      console.error('[handleFormSave] Error saving reservation:', error);
      const message =
        error.response?.status === 403
          ? 'CSRF 토큰 오류: 페이지를 새로고침 후 다시 시도해주세요.'
          : error.response?.data?.message ||
            error.message ||
            '현장 예약 저장에 실패했습니다.';
      alert(message);
    }
  };

  const [searchCriteria, setSearchCriteria] = useState({
    name: '',
    reservationNo: '',
    checkInDate: '',
    checkOutDate: '',
  });

  const handleVoiceResult = (transcript) => {
    setSearchCriteria({ ...searchCriteria, name: transcript });
    setTimeout(() => {
      executeSearch(transcript);
    }, 1000);
  };

  const executeSearch = useCallback(
    (searchTerm) => {
      const trimmedSearchTerm = searchTerm.trim();
      if (trimmedSearchTerm.length < 2) {
        alert('검색어는 최소 2자 이상 입력해야 합니다.');
        return;
      }
      const lowerCaseSearchTerm = trimmedSearchTerm.toLowerCase();
      const results = allReservations.filter((reservation) => {
        const nameMatch = reservation.customerName
          ?.toLowerCase()
          .includes(lowerCaseSearchTerm);
        const reservationNoMatch = reservation.reservationNo
          ?.toLowerCase()
          .includes(lowerCaseSearchTerm);
        const memoText = memos[reservation._id]?.text || '';
        const memoMatch = memoText.toLowerCase().includes(lowerCaseSearchTerm);
        return nameMatch || reservationNoMatch || memoMatch;
      });
      if (results.length > 0) {
        setIsSearching(true);
        const limitedResults = results.slice(0, 5);
        const reservationIds = limitedResults.map((res) => res._id);
        setHighlightedReservationIds(reservationIds);
        const firstResult = limitedResults[0];
        const checkInDate = parseDate(firstResult.checkIn); // KST로 파싱
        if (checkInDate) {
          setSelectedDate(checkInDate);
          filterReservationsByDate(allReservations, checkInDate);
        }
        // 스크롤하여 첫 번째 결과를 보여줌
        setTimeout(() => {
          const card = document.querySelector(
            `.room-card[data-id="${firstResult._id}"]`
          );
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedReservationIds([]);
          setIsSearching(false);
        }, 5000);
      } else {
        alert('검색 결과가 없습니다.');
        setHighlightedReservationIds([]);
        setIsSearching(false);
      }
    },
    [allReservations, filterReservationsByDate, memos]
  );

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const handleDateChange = useCallback(
    (date) => {
      const newDate = new Date(date);
      setSelectedDate(newDate);
      filterReservationsByDate(allReservations, newDate);
      console.log('Date Changed to:', newDate);
      setHighlightedReservationIds([]);
      setIsSearching(false);
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    },
    [filterReservationsByDate, allReservations]
  );

  // App.js 내 handleSaveSettings 수정
  const handleSaveSettings = useCallback(
    async (newSettings) => {
      console.log('Saving settings. isNewSetup:', isNewSetup);
      try {
        const {
          hotelId: newHotelId,
          hotelName,
          totalRooms,
          roomTypes: newRoomTypes,
          email: newEmail,
          address,
          phoneNumber: newPhoneNumber,
          otas,
          gridSettings,
          _id,
        } = newSettings;

        // 'none' 객실 제외한 roomTypes 필터링 (백엔드에 전달 전에 처리)
        const filteredRoomTypes = newRoomTypes.filter(
          (rt) => rt.roomInfo.toLowerCase() !== 'none'
        );

        // 층별 객실 정보에서 'none' 제외
        const filteredFloors = gridSettings.floors.map((floor) => ({
          floorNum: floor.floorNum,
          containers: floor.containers.filter(
            (cont) => cont.roomInfo.toLowerCase() !== 'none'
          ),
        }));

        const hotelSettingsData = {
          hotelId: newHotelId,
          hotelName,
          totalRooms,
          roomTypes: filteredRoomTypes,
          gridSettings: { floors: filteredFloors },
          otas:
            otas && Array.isArray(otas)
              ? otas
              : availableOTAs.map((ota) => ({ name: ota, isActive: false })),
          address, // 백엔드에서 address 필드명 확인
          phoneNumber: newPhoneNumber, // 백엔드에서 phoneNumber 필드명 확인
          email: newEmail, // 백엔드에서 email 필드명 확인
        };

        console.log('Saving hotelSettingsData:', hotelSettingsData); // 저장 데이터 디버깅

        // 백엔드 API 호출
        if (_id) {
          console.log('We have _id => Using updateHotelSettings (PATCH)');
          await updateHotelSettings(newHotelId, hotelSettingsData);
        } else if (isNewSetup) {
          console.log('No _id + isNewSetup => Using saveHotelSettings (POST)');
          await saveHotelSettings(hotelSettingsData);
        } else {
          console.log(
            'No _id but isNewSetup==false => fallback to update (PATCH)'
          );
          await updateHotelSettings(newHotelId, hotelSettingsData);
        }

        // 상태 업데이트 (최신 hotelSettings로 갱신)
        setHotelSettings({
          ...hotelSettingsData,
          hotelAddress: address || '주소 정보 없음',
          phoneNumber: newPhoneNumber || '전화번호 정보 없음',
          email: newEmail || '이메일 정보 없음',
        });
        setHotelId(newHotelId);
        setIsNewSetup(false);
        console.log('Hotel Settings Saved:', hotelSettingsData);

        // 최신 설정을 다시 로드하여 반영
        await loadHotelSettings(newHotelId);
      } catch (error) {
        console.error('Failed to save hotel settings:', error);
        console.log('Error response:', error.response?.data); // API 오류 디버깅
      }
    },
    [isNewSetup, loadHotelSettings]
  );

  const handleLogout = useCallback(async () => {
    try {
      const response = await logoutUser();
      console.log('Logout response:', response);
      const isGitHubPages = window.location.hostname === 'staysync.me';
      const basePath = isGitHubPages ? '/login' : '/login';

      if (response && response.redirect) {
        navigate(response.redirect || basePath, { replace: true });
      } else {
        navigate(basePath, { replace: true });
      }
    } catch (error) {
      console.error('백엔드 로그아웃 실패:', error);
      const isGitHubPages = window.location.hostname === 'staysync.me';
      const basePath = isGitHubPages ? '/login' : '/login';
      navigate(basePath, { replace: true });
    }
    // WebSocket 연결 종료
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('hotelId');
    localStorage.removeItem('csrfToken');
    document.cookie = '_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    document.cookie =
      'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    setIsAuthenticated(false);
    setHotelId('');
    setHotelSettings(null);
    setAllReservations([]);
    setActiveReservations([]);
    setRoomsSold(0);
    setMonthlySoldRooms(0);
    setAvgMonthlyRoomPrice(0);
    setSelectedDate(parseDate(new Date().toISOString())); // KST로 파싱
    setDailyTotal(0);
    setOtaToggles(
      availableOTAs.reduce((acc, ota) => ({ ...acc, [ota]: false }), {})
    );
    sendOtaTogglesToExtension(
      availableOTAs.reduce((acc, ota) => ({ ...acc, [ota]: false }), {})
    );
  }, [navigate]);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      const storedHotelId = localStorage.getItem('hotelId');
      if (storedToken && storedHotelId) {
        try {
          // 토큰 유효성 검증 (간단한 GET 요청)
          await api.get('/api/auth/validate', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          console.log('Initializing auth with hotelId:', storedHotelId);
          setIsAuthenticated(true);
          setHotelId(storedHotelId);
          await loadHotelSettings(storedHotelId);
          await loadReservations();
        } catch (error) {
          console.error('토큰 유효성 검증 실패:', error);
          if (
            error.response?.status === 401 ||
            error.response?.status === 403
          ) {
            // 유효하지 않은 토큰 처리
            localStorage.removeItem('accessToken');
            localStorage.removeItem('hotelId');
            localStorage.removeItem('csrfToken');
            document.cookie =
              '_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            document.cookie =
              'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            setIsAuthenticated(false);
            navigate('/login');
          }
        }
        setIsLoading(false);
      } else {
        console.log('저장된 세션이 없습니다. 로그인 해주세요.');
        setIsLoading(false);
      }
    };
    initializeAuth();
  }, [loadHotelSettings, loadReservations, navigate]);

  const occupancyRate =
    totalRooms > 0 ? Math.round((roomsSold / totalRooms) * 100) : 0;

  const openOnSiteReservationForm = () => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const effectiveDate = selectedDate < todayStart ? todayStart : selectedDate;

    const checkInTime = hotelSettings.checkInTime || '16:00';
    const checkOutTime = hotelSettings.checkOutTime || '11:00';

    const checkIn = `${format(
      effectiveDate,
      'yyyy-MM-dd'
    )}T${checkInTime}:00+09:00`;
    const checkOut = `${format(
      addDays(effectiveDate, 1),
      'yyyy-MM-dd'
    )}T${checkOutTime}:00+09:00`;

    const customerName = `현장:${format(now, 'HH:mm:ss')}`;

    setGuestFormData({
      reservationNo: `${Date.now()}`,
      customerName,
      phoneNumber: '',
      checkInDate: format(effectiveDate, 'yyyy-MM-dd'),
      checkInTime,
      checkOutDate: format(addDays(effectiveDate, 1), 'yyyy-MM-dd'),
      checkOutTime,
      reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
      roomInfo: roomTypes[0]?.roomInfo || 'Standard',
      price: roomTypes[0]?.price.toString() || '',
      paymentMethod: '미결제',
      specialRequests: '',
      checkIn, // 문자열로 저장
      checkOut, // 문자열로 저장
      _id: null,
    });
    setShowGuestForm(true);
  };
  // onQuickCreate 함수 분리
  const createStayReservation = (nights) => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const effectiveDate = selectedDate < todayStart ? todayStart : selectedDate;

    const checkInTime = hotelSettings.checkInTime || '16:00';
    const checkOutTime = hotelSettings.checkOutTime || '11:00';

    const checkIn = `${format(
      effectiveDate,
      'yyyy-MM-dd'
    )}T${checkInTime}:00+09:00`;
    const checkOut = `${format(
      addDays(effectiveDate, nights),
      'yyyy-MM-dd'
    )}T${checkOutTime}:00+09:00`;

    const customerName = `현장:${format(now, 'HH:mm:ss')}`;
    const basePrice = (finalRoomTypes[0]?.price || 0) * nights;

    setGuestFormData({
      reservationNo: `${uuidv4()}`,
      customerName,
      checkInDate: format(effectiveDate, 'yyyy-MM-dd'),
      checkInTime,
      checkOutDate: format(addDays(effectiveDate, nights), 'yyyy-MM-dd'),
      checkOutTime,
      reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
      roomInfo: finalRoomTypes[0]?.roomInfo || 'Standard',
      price: basePrice.toString(),
      paymentMethod: '미결제',
      specialRequests: '',
      checkIn,
      checkOut,
      type: 'stay',
    });
    setShowGuestForm(true);
  };

  const createDayUseReservation = () => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const effectiveDate = selectedDate < todayStart ? todayStart : selectedDate;

    const checkInDateStr = format(effectiveDate, 'yyyy-MM-dd');
    const customerName = `현장대실:${format(now, 'HH:mm:ss')}`;
    const basePrice = finalRoomTypes[0]?.price || 0;
    const price = Math.floor(basePrice * 0.5);

    const checkIn = `${checkInDateStr}T${format(now, 'HH:mm')}:00+09:00`;
    const checkOut = format(
      addHours(new Date(checkIn), 3), // 기본 3시간
      "yyyy-MM-dd'T'HH:mm:ss+09:00"
    );

    setGuestFormData({
      reservationNo: `${uuidv4()}`,
      customerName,
      checkInDate: checkInDateStr,
      checkInTime: format(now, 'HH:mm'),
      checkOutDate: format(new Date(checkOut), 'yyyy-MM-dd'),
      checkOutTime: format(new Date(checkOut), 'HH:mm'),
      reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
      roomInfo: finalRoomTypes[0]?.roomInfo || 'Standard',
      price: price.toString(),
      paymentMethod: '미결제',
      specialRequests: '',
      checkIn,
      checkOut,
      type: 'dayUse',
      durationHours: 3, // 기본 3시간
    });
    setShowGuestForm(true);
  };

  const onQuickCreate = (type) => {
    if (type === '대실') {
      createDayUseReservation();
    } else {
      const nights = parseInt(type.replace('박', '')) || 1;
      createStayReservation(nights);
    }
  };

  const combinedSync = () => {
    today();
    handleSync();
  };

  const openSalesModal = () => {
    setIsSalesModalOpen(true);
  };

  const closeSalesModal = () => {
    setIsSalesModalOpen(false);
  };

  const dailySalesReport = useMemo(() => {
    return activeReservations.map((reservation, index) => {
      let pricePerNight;
      if (reservation.nightlyRates && reservation.nightlyRates.length > 0) {
        pricePerNight = reservation.nightlyRates[0].rate;
      } else {
        pricePerNight = reservation.totalPrice || 0;
      }
      return {
        reservationId: reservation._id || reservation.reservationNo,
        roomNumber: `No.${index + 1}`,
        customerName: reservation.customerName || '정보 없음',
        roomInfo: reservation.roomInfo || '정보 없음',
        checkInCheckOut: `${format(
          new Date(reservation.checkIn),
          'yyyy-MM-dd HH:mm'
        )} ~ ${format(new Date(reservation.checkOut), 'yyyy-MM-dd HH:mm')}`,
        price: pricePerNight,
        siteInfo: reservation.siteName
          ? reservation.siteName === '현장예약'
            ? '현장예약'
            : 'OTA'
          : '정보 없음',
        paymentMethod:
          reservation.siteName && reservation.siteName !== '현장예약'
            ? 'OTA'
            : reservation.paymentMethod || '정보 없음',
      };
    });
  }, [activeReservations]);

  const monthlySales = useMemo(() => {
    return monthlyTotal > 0 ? Math.floor(monthlyTotal * 0.9) : 0;
  }, [monthlyTotal]);

  const handleConsentComplete = useCallback(() => {
    // userInfo 관련 호출 제거 – 호텔 설정 페이지에서는 userInfo를 다루지 않습니다.
    setNeedsConsent(false);
  }, []);

  const guestAvailability = useMemo(() => {
    if (!guestFormData) {
      const safeSelectedDate =
        selectedDate instanceof Date && !isNaN(selectedDate)
          ? selectedDate
          : new Date();
      const viewingDateStart = startOfDay(safeSelectedDate);
      const viewingDateEnd = addDays(viewingDateStart, 1);
      const selectedDates = [
        format(addDays(safeSelectedDate, -1), 'yyyy-MM-dd'),
        format(safeSelectedDate, 'yyyy-MM-dd'),
        format(addDays(safeSelectedDate, 1), 'yyyy-MM-dd'),
      ];
      return calculateRoomAvailability(
        allReservations,
        finalRoomTypes,
        viewingDateStart,
        viewingDateEnd,
        hotelSettings?.gridSettings,
        selectedDates
      );
    }

    const checkIn = guestFormData.checkIn; // 문자열 사용
    const checkOut =
      guestFormData.type === 'dayUse'
        ? format(
            addHours(
              new Date(checkIn),
              parseInt(guestFormData.durationHours || 4)
            ),
            "yyyy-MM-dd'T'HH:mm:ss+09:00"
          )
        : guestFormData.checkOut;

    const viewingDateStart = startOfDay(new Date(checkIn));
    const viewingDateEnd = addDays(startOfDay(new Date(checkOut)), 1);
    const selectedDates = [
      format(addDays(new Date(checkIn), -1), 'yyyy-MM-dd'),
      format(new Date(checkIn), 'yyyy-MM-dd'),
      format(addDays(new Date(checkIn), 1), 'yyyy-MM-dd'),
    ];
    return calculateRoomAvailability(
      allReservations,
      finalRoomTypes,
      viewingDateStart,
      viewingDateEnd,
      hotelSettings?.gridSettings,
      selectedDates
    );
  }, [
    guestFormData,
    allReservations,
    finalRoomTypes,
    selectedDate,
    hotelSettings,
  ]);

  // showQuickRangeModal이 true로 변경될 때 isMonthlyView를 false로 설정
  useEffect(() => {
    if (showQuickRangeModal) {
      setIsMonthlyView(false);
    }
  }, [showQuickRangeModal]);

  return (
    <div
      className={`app-layout ${!isAuthenticated ? 'logged-out' : ''}`}
      style={{ display: 'flex' }}
    >
      {isLoading ? (
        <div className="loading-spinner">로딩 중...</div>
      ) : (
        <Routes>
          {!isAuthenticated ? (
            <>
              <Route path="/login" element={<Login onLogin={handleLogin} />} />
              <Route
                path="/register"
                element={
                  <Register
                    onRegisterSuccess={() => {
                      window.location.href = '/login';
                    }}
                    onSwitchToLogin={() => {
                      window.location.href = '/login';
                    }}
                  />
                }
              />
              <Route
                path="/reset-password/:token"
                element={<ResetPassword />}
              />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            <>
              <Route
                path="/consent"
                element={
                  <PrivacyConsent
                    onConsentComplete={handleConsentComplete}
                    onClose={() => navigate(-1)}
                  />
                }
              />

              <Route
                path="/hotel-settings"
                element={<HotelSettingsPage />} // <-- 추가
              />

              {/* ★ 월간 달력 페이지 라우트 */}
              <Route
                path="/monthly-calendar"
                element={
                  <MonthlyCalendar
                    reservations={allReservations}
                    roomTypes={finalRoomTypes}
                    availabilityByDate={availabilityByDate} // 추가
                    gridSettings={hotelSettings?.gridSettings || {}} // 추가
                    currentDate={selectedDate}
                    onRangeSelect={onQuickCreateRange}
                    onReturnView={() => navigate('/')}
                    onDateNavigate={(date) => {
                      setSelectedDate(date);
                      navigate('/'); // 일간 화면(루트 경로)으로 이동
                    }}
                  />
                }
              />

              {/* 기존 일간예약 화면 라우트 */}
              <Route
                path="/"
                element={
                  <>
                    <Header
                      selectedDate={selectedDate}
                      onPrevDay={handlePrevDay}
                      onNextDay={handleNextDay}
                      onQuickCreate={onQuickCreate}
                      onLogout={handleLogout}
                      isShining={isShining}
                      otaToggles={otaToggles}
                      onToggleOTA={handleToggleOTA}
                      // onSort={handleSort}
                      onDateChange={handleDateChange}
                      onMemo={handleMemoButtonClick}
                      flipAllMemos={flipAllMemos}
                      // sortOrder={sortOrder}
                      hasLowStock={hasLowStock}
                      lowStockRoomTypes={lowStockRoomTypes}
                      isMonthlyView={isMonthlyView}
                      toggleMonthlyView={toggleMonthlyView}
                      onViewLogs={openLogViewer}
                    />
                    <SideBar
                      loading={loading}
                      onSync={combinedSync}
                      isShining={isShining}
                      setIsShining={setIsShining}
                      dailyTotal={dailyTotal}
                      monthlyTotal={monthlyTotal}
                      occupancyRate={occupancyRate}
                      selectedDate={selectedDate}
                      onDateChange={handleDateChange}
                      hotelId={hotelId}
                      hotelSettings={hotelSettings}
                      handleSaveSettings={handleSaveSettings}
                      loadHotelSettings={loadHotelSettings}
                      totalRooms={totalRooms}
                      remainingRooms={remainingRooms}
                      roomTypes={roomTypes}
                      roomsSold={roomsSold}
                      monthlySoldRooms={monthlySoldRooms}
                      avgMonthlyRoomPrice={avgMonthlyRoomPrice}
                      onLogout={handleLogout}
                      dailyBreakdown={dailyBreakdown}
                      openSalesModal={openSalesModal}
                      onToggleOTA={handleToggleOTA}
                      otaToggles={otaToggles}
                      searchCriteria={searchCriteria}
                      setSearchCriteria={setSearchCriteria}
                      handleVoiceResult={handleVoiceResult}
                      executeSearch={executeSearch}
                      onShowCanceledModal={() => setShowCanceledModal(true)}
                      memos={memos}
                      setMemos={setMemos}
                      onOnsiteReservationClick={openOnSiteReservationForm}
                      needsConsent={needsConsent}
                      monthlyDailyBreakdown={monthlyDailyBreakdown}
                      labelsForOTA={labelsForOTA}
                      dailySalesByOTA={dailySalesByOTA}
                      activeReservations={activeReservations}
                      onMonthlyView={() => navigate('/monthly-calendar')}
                    />
                    <div className="main-content" style={{ flex: '1' }}>
                      {/* 고정 영역으로 미배정 예약 패널 렌더링 */}
                      <UnassignedReservationsPanel
                        reservations={allReservations}
                      />
                      <div className="split-view-layout">
                        <div className="left-pane">
                          <DndProvider backend={HTML5Backend}>
                            <RoomGrid
                              reservations={activeReservations}
                              fullReservations={allReservations}
                              onDelete={handleDelete}
                              onConfirm={handleConfirm}
                              onEdit={handleEdit}
                              onPartialUpdate={handlePartialUpdate}
                              onReservationSelect={handleReservationSelect}
                              loadedReservations={loadedReservations}
                              hotelId={hotelId}
                              hotelSettings={hotelSettings} // 호텔 설정 전체 전달
                              hotelAddress={
                                hotelSettings?.hotelAddress ||
                                (console.warn(
                                  'Hotel address not found in hotelSettings'
                                ),
                                '주소 정보 없음')
                              } // 호텔 주소 전달, 디버깅 로깅 추가
                              phoneNumber={
                                hotelSettings?.phoneNumber ||
                                (console.warn(
                                  'Phone number not found in hotelSettings'
                                ),
                                '전화번호 정보 없음')
                              } // 전화번호 전달, 디버깅 로깅 추가
                              email={
                                hotelSettings?.email ||
                                (console.warn(
                                  'Email not found in hotelSettings'
                                ),
                                '이메일 정보 없음')
                              } // 이메일 전달, 디버깅 로깅 추가
                              roomTypes={finalRoomTypes}
                              memos={memos}
                              setMemos={setMemos}
                              searchCriteria={searchCriteria}
                              isSearching={isSearching}
                              highlightedReservationIds={
                                highlightedReservationIds
                              }
                              headerHeight={140}
                              newlyCreatedId={newlyCreatedId}
                              updatedReservationId={updatedReservationId} // 추가
                              flipAllMemos={flipAllMemos}
                              needsConsent={needsConsent}
                              monthlyDailyBreakdown={monthlyDailyBreakdown}
                              selectedDate={selectedDate}
                              setSelectedDate={setSelectedDate} // 추가
                              handleRoomChangeAndSync={handleRoomChangeAndSync}
                              setAllReservations={setAllReservations} // 추가
                              filterReservationsByDate={
                                filterReservationsByDate
                              }
                              isMonthlyView={isMonthlyView} // 추가
                              setIsMonthlyView={setIsMonthlyView} // 추가
                              toggleMonthlyView={toggleMonthlyView} // 추가
                              onQuickCreateRange={onQuickCreateRange}
                              logs={logs}
                              isLogViewerOpen={isLogViewerOpen} // 로그 뷰어 상태 전달
                              onCloseLogViewer={closeLogViewer} // 로그 뷰어 닫기 함수 전달
                            />
                          </DndProvider>
                        </div>
                        <div className="right-pane">
                          {selectedReservation && (
                            <DetailPanel
                              reservation={selectedReservation}
                              onClose={handleCloseDetail}
                              onSave={handleDetailSave}
                              onEdit={(id, data) =>
                                handleEdit(id, data, hotelId)
                              }
                            />
                          )}
                        </div>
                      </div>
                      {showGuestForm &&
                        (guestFormData.type === 'stay' ? (
                          <GuestFormModal
                            initialData={guestFormData}
                            roomTypes={
                              hotelSettings?.roomTypes || defaultRoomTypes
                            }
                            onClose={() => setShowGuestForm(false)}
                            onSave={handleFormSave}
                            availabilityByDate={guestAvailability}
                            selectedDate={selectedDate} // 추가
                          />
                        ) : (
                          <DayUseFormModal
                            initialData={guestFormData}
                            roomTypes={finalRoomTypes}
                            onClose={() => setShowGuestForm(false)}
                            onSave={handleFormSave}
                            availabilityByDate={guestAvailability}
                            hotelSettings={hotelSettings}
                            selectedDate={selectedDate}
                            allReservations={allReservations} // 추가: 점유 계산에 필요
                          />
                        ))}
                      {showQuickRangeModal &&
                        (console.log(
                          '[App.js] Rendering QuickRangeModal with:',
                          guestFormData
                        ),
                        (
                          <QuickRangeModal
                            initialData={guestFormData}
                            roomTypes={finalRoomTypes}
                            availabilityByDate={availabilityByDate}
                            onClose={() => setShowQuickRangeModal(false)}
                            onSave={handleFormSave}
                          />
                        ))}
                    </div>
                    <SalesModal
                      isOpen={isSalesModalOpen}
                      onRequestClose={closeSalesModal}
                      dailySalesReport={dailySalesReport}
                      dailySales={{ labels: labelsForOTA, values: [] }}
                      dailyTotal={dailyTotal}
                      monthlySales={monthlySales}
                      selectedDate={selectedDate}
                      totalRooms={totalRooms}
                      remainingRooms={remainingRooms}
                      occupancyRate={occupancyRate}
                      avgMonthlyRoomPrice={avgMonthlyRoomPrice}
                      dailyAverageRoomPrice={dailyAverageRoomPrice}
                      roomTypes={hotelSettings?.roomTypes || defaultRoomTypes}
                      monthlyDailyBreakdown={monthlyDailyBreakdown}
                      dailySalesByOTA={dailySalesByOTA}
                    />
                    {showCanceledModal && (
                      <CanceledReservationsModal
                        isOpen={showCanceledModal}
                        onRequestClose={() => setShowCanceledModal(false)}
                        hotelId={hotelId}
                      />
                    )}
                  </>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      )}
    </div>
  );
};

export default App;
