/* global chrome */
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom';

import Header from './components/Header.js';
import SideBar from './components/SideBar.js';
import RoomGrid from './components/RoomGrid.js';
import CanceledReservationsModal from './components/CanceledReservationsModal.js';
import MonthlyCalendar from './components/MonthlyCalendar';
import GuestFormModal from './components/GuestFormModal';
import Login from './components/Login';
import Register from './components/Register';
import ResetPassword from './components/ResetPassword';
import PrivacyConsent from './components/PrivacyConsentModal.js';

import DetailPanel from './components/DetailPanel';
import { parseDate } from './utils/dateParser.js';
import HotelSettingsPage from './pages/HotelSettingsPage.js';
import {
  format,
  startOfMonth,
  addDays,
  endOfMonth,
  differenceInCalendarDays,
  startOfDay,
} from 'date-fns';

import { defaultRoomTypes } from './config/defaultRoomTypes';
import availableOTAs from './config/availableOTAs';
import SalesModal from './components/DailySalesModal.js';
import { isCancelledStatus } from './utils/isCancelledStatus.js';
import UnassignedReservationsPanel from './components/UnassignedReservationsPanel';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

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
    labels.push(format(d, 'MM-dd'));
  }
  const categories = new Set([...availableOTAs, '현장예약', '대실', '기타']);
  const dailySalesByOTA = {};
  categories.forEach((cat) => {
    dailySalesByOTA[cat] = new Array(numDays).fill(0);
  });
  reservations.forEach((res) => {
    if (isCancelledStatus(res.reservationStatus, res.customerName)) return;
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
  // const [isLayoutEditorOpen, setIsLayoutEditorOpen] = useState(false);
  const [otaToggles, setOtaToggles] = useState(
    availableOTAs.reduce((acc, ota) => ({ ...acc, [ota]: false }), {})
  );
  const [selectedReservation, setSelectedReservation] = useState(null);
  // const [sortOrder, setSortOrder] = useState('newest');
  const navigate = useNavigate();

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

  // 드래그 범위 선택 후, 현장예약 모달을 오픈하는 함수
  const onQuickCreateRange = (start, end, roomType) => {
    const now = new Date();
    // 선택된 날짜 중 가장 빠른 날짜를 체크인, 가장 늦은 날짜를 체크아웃으로 지정합니다.
    const checkInDate = format(start, 'yyyy-MM-dd');
    const checkOutDate = format(end, 'yyyy-MM-dd');
    const defaultCheckInTime = '16:00'; // 기본 체크인 시간
    const defaultCheckOutTime = '11:00'; // 기본 체크아웃 시간

    // 예약번호는 현재 시간 기반으로 생성 (예시)
    const reservationNo = `${Date.now()}`;
    // 기본 예약자명은 빈 값 혹은 자동생성 이름 (원하는대로 수정)
    const customerName = `현장:${format(now, 'HH:mm:ss')}`;

    // GuestFormModal에 전달할 초기 데이터를 구성합니다.
    const guestData = {
      reservationNo,
      customerName,
      phoneNumber: '',
      checkInDate,
      checkInTime: defaultCheckInTime,
      checkOutDate,
      checkOutTime: defaultCheckOutTime,
      reservationDate: format(new Date(), 'yyyy-MM-dd HH:mm'),
      roomInfo: roomType,
      price: '', // 가격은 추후 수동 입력 혹은 계산할 수 있습니다.
      paymentMethod: 'Pending',
      specialRequests: '',
      checkIn: `${checkInDate}T${defaultCheckInTime}:00`,
      checkOut: `${checkOutDate}T${defaultCheckOutTime}:00`,
    };

    // GuestFormModal을 오픈
    setGuestFormData(guestData);
    setShowGuestForm(true);
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

  const filterReservationsByDate = useCallback(
    (reservationsData, date) => {
      const selectedDateString = format(date, 'yyyy-MM-dd');
      console.log(`Filtering reservations for date: ${selectedDateString}`);
      const selectedDateReservations = reservationsData.filter(
        (reservation) => {
          const checkInDate = reservation.parsedCheckInDate;
          const checkOutDate = reservation.parsedCheckOutDate;
          if (!checkInDate || !checkOutDate) return false;
          const checkInDateOnly = new Date(
            checkInDate.getFullYear(),
            checkInDate.getMonth(),
            checkInDate.getDate()
          );
          const checkOutDateOnly = new Date(
            checkOutDate.getFullYear(),
            checkOutDate.getMonth(),
            checkOutDate.getDate()
          );
          const isIncluded =
            selectedDateString >= format(checkInDateOnly, 'yyyy-MM-dd') &&
            selectedDateString < format(checkOutDateOnly, 'yyyy-MM-dd');
          const isSameDayStay =
            format(checkInDateOnly, 'yyyy-MM-dd') ===
              format(checkOutDateOnly, 'yyyy-MM-dd') &&
            selectedDateString === format(checkInDateOnly, 'yyyy-MM-dd');
          const finalIncluded = isIncluded || isSameDayStay;
          if (finalIncluded) {
            // console.log(
            //   `Including reservation from ${format(
            //     checkInDate,
            //     'yyyy-MM-dd HH:mm'
            //   )} to ${format(
            //     checkOutDate,
            //     'yyyy-MM-dd HH:mm'
            //   )} on ${selectedDateString}`
            // );
          }
          return finalIncluded;
        }
      );
      setActiveReservations(selectedDateReservations);

      // 선택된 날짜의 일 매출 계산 및 세부 내역 생성
      const breakdown = selectedDateReservations.map((reservation) => {
        let pricePerNight;
        if (reservation.nightlyRates && reservation.nightlyRates.length > 0) {
          pricePerNight = reservation.nightlyRates[0].rate;
        } else {
          // nightlyRates가 없으므로 1박짜리 예약이거나 대실
          pricePerNight = reservation.totalPrice || 0;
        }
        return pricePerNight;
      });

      setDailyBreakdown(breakdown);
      const dailyTotalAmount = breakdown.reduce((sum, price) => sum + price, 0);
      setDailyTotal(Math.floor(dailyTotalAmount));
      const firstDayOfMonth = startOfMonth(date);
      const lastDayOfMonth = selectedDate;
      const monthlyReservations = reservationsData.filter((reservation) => {
        if (
          isCancelledStatus(
            reservation.reservationStatus || '',
            reservation.customerName || ''
          )
        )
          return false;
        const checkInDate = reservation.checkIn
          ? parseDate(reservation.checkIn)
          : null;
        const checkOutDate = reservation.checkOut
          ? parseDate(reservation.checkOut)
          : null;
        if (!checkInDate || !checkOutDate) return false;
        return (
          checkOutDate > firstDayOfMonth &&
          checkInDate < addDays(lastDayOfMonth, 1)
        );
      });

      let monthlyTotalAmount = 0;
      monthlyReservations.forEach((reservation) => {
        if (reservation.nightlyRates) {
          reservation.nightlyRates.forEach((nightlyRate) => {
            const rateDate = parseDate(nightlyRate.date);
            if (rateDate >= firstDayOfMonth && rateDate <= lastDayOfMonth) {
              monthlyTotalAmount += Number(nightlyRate.rate);
            }
          });
        }
      });
      monthlyTotalAmount = Math.max(0, Math.round(monthlyTotalAmount));
      setMonthlyTotal(monthlyTotalAmount);
      console.log(
        `Calculated Monthly Total: ₩${monthlyTotalAmount.toLocaleString()}`
      );

      let totalRoomsSold = 0;
      monthlyReservations.forEach((reservation) => {
        if (reservation.nightlyRates) {
          const nightsInMonth = reservation.nightlyRates.filter(
            (nightlyRate) => {
              const rateDate = parseDate(nightlyRate.date);
              return rateDate >= firstDayOfMonth && rateDate <= lastDayOfMonth;
            }
          ).length;
          totalRoomsSold += nightsInMonth;
        } else {
          totalRoomsSold += 1;
        }
      });
      setMonthlySoldRooms(totalRoomsSold);

      const avgPrice =
        totalRoomsSold > 0
          ? Math.floor(monthlyTotalAmount / totalRoomsSold)
          : 0;

      setAvgMonthlyRoomPrice(avgPrice);
      setRoomsSold(selectedDateReservations.length);
      setLoadedReservations(selectedDateReservations.map((res) => res._id));
    },
    [selectedDate]
  );

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
      const { price, isDefault } = extractPrice(res.priceString || res.price);
      let totalPrice = price;
      let isDefaultPriceFlag = isDefault;
      if (!isOtaReservation(res) && totalPrice <= 0) {
        const roomType = matchRoomType(res.roomInfo);
        totalPrice = roomType?.price || 0;
        isDefaultPriceFlag = false;
      }
      const parsedCheckInDate = new Date(res.checkIn);
      const parsedCheckOutDate = new Date(res.checkOut);
      let nightlyRates = [];
      let finalTotalPrice = 0;
      if (
        parsedCheckInDate &&
        parsedCheckOutDate &&
        parsedCheckOutDate > parsedCheckInDate
      ) {
        const checkInDateOnly = new Date(
          parsedCheckInDate.getFullYear(),
          parsedCheckInDate.getMonth(),
          parsedCheckInDate.getDate()
        );
        const checkOutDateOnly = new Date(
          parsedCheckOutDate.getFullYear(),
          parsedCheckOutDate.getMonth(),
          parsedCheckOutDate.getDate()
        );
        const days = Math.floor(
          (checkOutDateOnly - checkInDateOnly) / (1000 * 60 * 60 * 24)
        );
        const nights = days > 0 ? days : 1;
        if (isDefaultPriceFlag) {
          totalPrice = 100000;
        }
        const perNightPriceCalculated = calculatePerNightPrice(
          res,
          totalPrice,
          nights
        );
        // console.log(
        //   `Testing perNightPriceCalculated for ${res._id}: ${perNightPriceCalculated} (should be per-night value)`
        // );
        for (let i = 0; i < nights; i++) {
          const date = new Date(checkInDateOnly);
          date.setDate(checkInDateOnly.getDate() + i);
          nightlyRates.push({
            date: format(date, 'yyyy-MM-dd'),
            rate: perNightPriceCalculated,
          });
        }
        finalTotalPrice = nightlyRates.reduce((sum, nr) => sum + nr.rate, 0);
        // console.log(
        //   `Total Price for ${res._id} (recalculated): ${finalTotalPrice}`
        // );
      } else {
        if (isDefaultPriceFlag) {
          totalPrice = 100000;
        }
        finalTotalPrice = totalPrice;
      }
      return {
        ...res,
        reservationNo: res.reservationNo || res._id,
        nightlyRates: nightlyRates.length > 0 ? nightlyRates : undefined,
        isDefaultPrice: isDefaultPriceFlag,
        totalPrice: finalTotalPrice,
        parsedCheckInDate,
        parsedCheckOutDate,
      };
    },
    [calculatePerNightPrice]
  );

  const loadHotelSettings = useCallback(
    async (inputHotelId) => {
      try {
        const settings = await fetchHotelSettings(inputHotelId);
        console.log(
          'Fetched settings from API:',
          JSON.stringify(settings, null, 2)
        ); // API 반환 데이터 전체 출력

        if (settings) {
          const isNewDoc = !settings._id;
          console.log(
            `Has _id? ${!!settings._id} => ${
              isNewDoc ? 'New setup' : 'Existing doc'
            }`
          );
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

          console.log(
            'Processed hotelSettings:',
            JSON.stringify(updatedSettings, null, 2)
          ); // 설정된 데이터 디버깅
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

  const loadReservations = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const data = await fetchReservations(hotelId);
      const reservationsArray = Array.isArray(data) ? data : [];
      const processedReservations = reservationsArray
        .map(processReservation)
        .filter((res) => res !== null);
      setAllReservations(processedReservations);
      filterReservationsByDate(processedReservations, selectedDate);
      console.log('Reservations Loaded:', processedReservations);
    } catch (error) {
      console.error('Failed to load reservations:', error);
    }
    setLoading(false);
  }, [filterReservationsByDate, selectedDate, hotelId, processReservation]);

  const today = useCallback(() => {
    const currentDate = new Date();
    setSelectedDate(currentDate);
    filterReservationsByDate(allReservations, currentDate);
    console.log('Moved to Today:', currentDate);
  }, [allReservations, filterReservationsByDate]);

  const handleDelete = useCallback(
    async (reservationId, hotelIdParam, siteName) => {
      try {
        await deleteReservation(reservationId, hotelIdParam, siteName);
        await loadReservations();
        console.log(
          `Reservation ${reservationId} deleted for site ${siteName}`
        );
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
        // 사용자 알림 추가
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
        const updatedReservation = await updateReservation(
          reservationId,
          {
            roomNumber: newRoomNumber,
            roomInfo: newRoomInfo,
            price: currentPrice || currentReservation.totalPrice, // 현재 가격 유지
          },
          hotelId
        );

        setAllReservations((prevReservations) => {
          const updatedReservations = prevReservations.map((res) =>
            res._id === reservationId ? { ...res, ...updatedReservation } : res
          );
          console.log(
            '[handleRoomChangeAndSync] Updated reservations:',
            updatedReservations
          );
          filterReservationsByDate(updatedReservations, selectedDate);
          return updatedReservations;
        });

        console.log(
          `Reservation ${reservationId} moved to room ${newRoomNumber} with type ${newRoomInfo}`
        );
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

  const handlePartialUpdate = useCallback(
    async (reservationId, updatedData) => {
      const currentReservation = allReservations.find(
        (res) => res._id === reservationId
      );
      if (!currentReservation) return;

      const checkInChanged =
        new Date(currentReservation.checkIn).getTime() !==
        new Date(updatedData.checkIn).getTime();
      const checkOutChanged =
        new Date(currentReservation.checkOut).getTime() !==
        new Date(updatedData.checkOut).getTime();

      const hasOtherChanges =
        currentReservation.customerName !== updatedData.customerName ||
        currentReservation.phoneNumber !== updatedData.phoneNumber ||
        currentReservation.price !== updatedData.price ||
        checkInChanged ||
        checkOutChanged ||
        currentReservation.paymentMethod !== updatedData.paymentMethod ||
        currentReservation.specialRequests !== updatedData.specialRequests;

      if (!hasOtherChanges) {
        console.log('변경된 세부 정보가 없습니다. 업데이트를 생략합니다.');
        return;
      }

      try {
        const newCheckIn = updatedData.checkIn || currentReservation.checkIn;
        const newCheckOut = updatedData.checkOut || currentReservation.checkOut;
        const newParsedCheckInDate = new Date(newCheckIn);
        const newParsedCheckOutDate = new Date(newCheckOut);

        const updatedReservation = await updateReservation(
          reservationId,
          {
            ...updatedData,
            checkIn: newCheckIn,
            checkOut: newCheckOut,
            parsedCheckInDate: newParsedCheckInDate,
            parsedCheckOutDate: newParsedCheckOutDate,
            roomInfo: currentReservation.roomInfo,
            roomNumber: updatedData.roomNumber || currentReservation.roomNumber,
            price: updatedData.price || currentReservation.totalPrice,
            totalPrice: updatedData.price || currentReservation.totalPrice,
          },
          hotelId
        );

        setAllReservations((prev) => {
          const updated = prev.map((res) =>
            res._id === reservationId ? { ...res, ...updatedReservation } : res
          );
          filterReservationsByDate(updated, selectedDate);
          return updated;
        });

        setUpdatedReservationId(reservationId);
        setTimeout(() => {
          setUpdatedReservationId(null); // 10초 후 리셋
        }, 10000);

        console.log(`예약 ${reservationId}가 부분 업데이트되었습니다.`);
      } catch (error) {
        console.error(`예약 ${reservationId} 부분 업데이트 실패:`, error);
        setAllReservations((prev) =>
          prev.map((res) =>
            res._id === reservationId ? { ...res, ...currentReservation } : res
          )
        );
        alert('예약 수정에 실패했습니다. 다시 시도해주세요.');
        await loadReservations();
      }
    },
    [allReservations, hotelId, loadReservations, selectedDate, filterReservationsByDate]
  );

  const handleEdit = useCallback(
    async (reservationId, updatedData) => {
      const currentReservation = allReservations.find(
        (res) => res._id === reservationId
      );

      if (
        currentReservation &&
        availableOTAs.includes(currentReservation.siteName)
      ) {
        if (!updatedData.manualAssignment) {
          updatedData.roomNumber = '';
          updatedData.price = currentReservation.price;
        } else {
          updatedData.price = currentReservation.price;
        }
      }

      if (
        currentReservation &&
        currentReservation.roomInfo === updatedData.roomInfo &&
        currentReservation.roomNumber === updatedData.roomNumber
      ) {
        return;
      }

      try {
        const newCheckIn = updatedData.checkIn || currentReservation.checkIn;
        const newCheckOut = updatedData.checkOut || currentReservation.checkOut;
        const newParsedCheckInDate = new Date(newCheckIn);
        const newParsedCheckOutDate = new Date(newCheckOut);

        if (updatedData.roomNumber !== currentReservation.roomNumber) {
          await handleRoomChangeAndSync(reservationId, updatedData.roomNumber);
        }

        const updatedReservation = await updateReservation(
          reservationId,
          {
            ...updatedData,
            checkIn: newCheckIn,
            checkOut: newCheckOut,
            parsedCheckInDate: newParsedCheckInDate,
            parsedCheckOutDate: newParsedCheckOutDate,
            roomInfo: currentReservation.roomInfo,
            roomNumber: updatedData.roomNumber || currentReservation.roomNumber,
            price: updatedData.price || currentReservation.totalPrice,
          },
          hotelId
        );

        // 서버 응답 반영 및 즉시 UI 갱신
        setAllReservations((prev) => {
          const updated = prev.map((res) =>
            res._id === reservationId ? { ...res, ...updatedReservation } : res
          );
          filterReservationsByDate(updated, selectedDate); // activeReservations 갱신
          return updated;
        });

        console.log(
          `Reservation ${reservationId} updated for hotel ${hotelId}`
        );
      } catch (error) {
        console.error(`Failed to update reservation ${reservationId}:`, error);
        const message =
          error.status === 403
            ? 'CSRF 토큰 오류: 페이지를 새로고침 후 다시 시도해주세요.'
            : '예약 수정에 실패했습니다.';
        console.info(message);
        await loadReservations();
      }
    },
    [
      allReservations,
      hotelId,
      loadReservations,
      handleRoomChangeAndSync,
      selectedDate,
      filterReservationsByDate,
    ]
  );

  const handlePrevDay = useCallback(() => {
    setSelectedDate((prevDate) => {
      const newDate = addDays(prevDate, -1);
      filterReservationsByDate(allReservations, newDate);
      console.log('Moved to Previous Day:', newDate);
      return newDate;
    });
  }, [filterReservationsByDate, allReservations]);

  const handleNextDay = useCallback(() => {
    setSelectedDate((prevDate) => {
      const newDate = addDays(prevDate, 1);
      filterReservationsByDate(allReservations, newDate);
      console.log('Moved to Next Day:', newDate);
      return newDate;
    });
  }, [filterReservationsByDate, allReservations]);

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

  const handleFormSave = useCallback(
    async (reservationId, data) => {
      if (reservationId) {
        try {
          await handleEdit(reservationId, data, hotelId);
          console.log('예약이 성공적으로 수정되었습니다.');
        } catch (error) {
          console.error('예약 수정 실패:', error);
          alert(
            '예약 수정에 실패했습니다: ' + (error.message || '알 수 없는 오류')
          );
        }
      } else {
        try {
          const reservationData = {
            siteName: '현장예약',
            reservations: [data],
            hotelId,
          };
          console.log('handleFormSave:', reservationId, data);
          const newReservation = await saveOnSiteReservation(reservationData);
          if (
            newReservation &&
            Array.isArray(newReservation.createdReservationIds) &&
            newReservation.createdReservationIds.length > 0
          ) {
            const newlyCreatedIdFromServer =
              newReservation.createdReservationIds[0];
            console.log('🔔 새 예약 ID:', newlyCreatedIdFromServer);
            if (data.checkIn) {
              const parsedDate = parseDate(data.checkIn);
              setSelectedDate(parsedDate);
            }
            setNewlyCreatedId(newlyCreatedIdFromServer);
            // 10초 후 newlyCreatedId 리셋
            setTimeout(() => {
              setNewlyCreatedId(null);
            }, 10000);
          }
          console.log('Guest Form saved =>', newReservation);
          setShowGuestForm(false);
          await loadReservations();
          if (newReservation && newReservation._id) {
            if (newReservation.checkIn) {
              const parsedDate = parseDate(newReservation.checkIn);
              setSelectedDate(parsedDate);
            }
            setNewlyCreatedId(newReservation._id);
            // 10초 후 newlyCreatedId 리셋 (중복 호출 방지)
            setTimeout(() => {
              setNewlyCreatedId(null);
            }, 10000);
          }
        } catch (error) {
          console.error('Error saving 현장예약:', error);
          const message =
            error.status === 403
              ? 'CSRF 토큰 오류: 페이지를 새로고침 후 다시 시도해주세요.'
              : error.message || '현장 예약 저장에 실패했습니다.';
          alert(message);
        }
      }
    },
    [hotelId, loadReservations, handleEdit]
  );

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
        const checkInDate = parseDate(firstResult.checkIn);
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
      // 현재 환경이 GitHub Pages 또는 로컬인지 확인
      const isGitHubPages = window.location.hostname === 'staysync.me';
      const basePath = isGitHubPages ? '/login' : '/login';

      if (response && response.redirect) {
        // 클라이언트 사이드 라우팅으로만 이동
        navigate(response.redirect || basePath, { replace: true });
      } else {
        // 기본적으로 /login으로 이동 (현재 도메인 내에서만)
        navigate(basePath, { replace: true });
      }
    } catch (error) {
      console.error('백엔드 로그아웃 실패:', error);
      // 오류 발생 시도 현재 도메인 내에서만 /login으로 이동
      const isGitHubPages = window.location.hostname === 'staysync.me';
      const basePath = isGitHubPages ? '/login' : '/login';
      navigate(basePath, { replace: true });
    }
    // 로컬 스토리지 및 쿠키 정리 유지
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

  useEffect(() => {
    if (isAuthenticated && hotelId && !isLoading) {
      loadReservations();
      const intervalId = setInterval(() => {
        loadReservations();
      }, 120 * 60 * 1000);
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated, hotelId, loadReservations, isLoading]);

  const occupancyRate =
    totalRooms > 0 ? Math.round((roomsSold / totalRooms) * 100) : 0;

  // App.js (openOnSiteReservationForm 함수 수정)
  const openOnSiteReservationForm = () => {
    const now = new Date();
    const todayStart = startOfDay(now);

    const effectiveDate = selectedDate < todayStart ? todayStart : selectedDate;

    const checkIn = new Date(effectiveDate);
    checkIn.setHours(16, 0, 0, 0);
    const checkOut = addDays(checkIn, 1);
    checkOut.setHours(11, 0, 0, 0);

    // "현장: 시간:분:초" 형식으로 자동 생성
    const customerName = `현장:${format(now, 'HH:mm:ss')}`;

    setGuestFormData({
      reservationNo: `${Date.now()}`,
      customerName,
      phoneNumber: '',
      checkInDate: format(checkIn, 'yyyy-MM-dd'),
      checkInTime: '16:00',
      checkOutDate: format(checkOut, 'yyyy-MM-dd'),
      checkOutTime: '11:00',
      reservationDate: format(new Date(), 'yyyy-MM-dd HH:mm'),
      roomInfo: roomTypes[0]?.roomInfo || 'Standard',
      price: roomTypes[0]?.price.toString() || '',
      paymentMethod: 'Pending',
      specialRequests: '',
      checkIn: format(checkIn, "yyyy-MM-dd'T'HH:mm:ss"),
      checkOut: format(checkOut, "yyyy-MM-dd'T'HH:mm:ss"),
      _id: null, // 신규 생성임을 명확히 나타냄
    });
    setShowGuestForm(true);
  };
  // App.js (onQuickCreate 함수 수정)
  const onQuickCreate = (type) => {
    let checkInDate, checkInTime, checkOutDate, checkOutTime, customerName;
    const now = new Date();
    // 오늘 자정 계산 (오늘 날짜 기준)
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    // 선택된 날짜가 과거라면 오늘 날짜로 대체
    const effectiveDate = selectedDate < todayStart ? todayStart : selectedDate;

    if (type === '대실') {
      // 대실은 현재 시각을 기준으로 예약 생성 (대실은 당일 기준으로 처리하는 경우)
      checkInDate = format(now, 'yyyy-MM-dd');
      checkInTime = format(now, 'HH:mm');
      const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      checkOutDate = format(fourHoursLater, 'yyyy-MM-dd');
      checkOutTime = format(fourHoursLater, 'HH:mm');
      customerName = `현장:${format(now, 'HH:mm:ss')}`;
      const basePrice = roomTypes[0].price;
      const price = Math.floor(basePrice * 0.5);
      const checkInISO = `${checkInDate}T${checkInTime}:00`;
      const checkOutISO = `${checkOutDate}T${checkOutTime}:00`;
      setGuestFormData({
        reservationNo: `${Date.now()}`,
        customerName,
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        reservationDate: format(new Date(), 'yyyy-MM-dd HH:mm'),
        roomInfo: roomTypes[0].roomInfo,
        price: price.toString(),
        paymentMethod: 'Pending',
        specialRequests: '',
        checkIn: checkInISO,
        checkOut: checkOutISO,
      });
    } else {
      // 퀵예약(현장예약) 일반 예약의 경우 effectiveDate(선택 날짜가 과거이면 오늘로 대체)를 기준으로 진행
      const baseDate = new Date(effectiveDate);
      baseDate.setHours(16, 0, 0, 0); // 기본 체크인 시간: 오후 4시
      checkInDate = format(baseDate, 'yyyy-MM-dd');
      checkInTime = '16:00';
      checkOutTime = '11:00';
      let nights = 1;
      if (type === '2박') nights = 2;
      else if (type === '3박') nights = 3;
      else if (type === '4박') nights = 4;
      const checkInObj = new Date(baseDate);
      const checkOutObj = new Date(
        checkInObj.getTime() + nights * 24 * 60 * 60 * 1000
      );
      checkOutDate = format(checkOutObj, 'yyyy-MM-dd');
      customerName = `현장:${format(now, 'HH:mm:ss')}`;
      const basePrice = roomTypes[0].price * nights;
      const checkInISO = `${checkInDate}T${checkInTime}:00`;
      const checkOutISO = `${checkOutDate}T${checkOutTime}:00`;
      setGuestFormData({
        reservationNo: `${Date.now()}`,
        customerName,
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        reservationDate: format(new Date(), 'yyyy-MM-dd HH:mm'),
        roomInfo: roomTypes[0].roomInfo,
        price: basePrice.toString(),
        paymentMethod: 'Pending',
        specialRequests: '',
        checkIn: checkInISO,
        checkOut: checkOutISO,
      });
    }
    setShowGuestForm(true);
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
        checkInCheckOut: `${reservation.checkIn || '정보 없음'} ~ ${
          reservation.checkOut || '정보 없음'
        }`,
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

  // guestAvailability 계산 시 'none' 제외
  const guestAvailability = useMemo(() => {
    if (!guestFormData) return {};
    const checkIn = parseDate(
      `${guestFormData.checkInDate}T${guestFormData.checkInTime}:00`
    );
    const checkOut = parseDate(
      `${guestFormData.checkOutDate}T${guestFormData.checkOutTime}:00`
    );
    if (!checkIn || !checkOut) return {};
    return calculateRoomAvailability(
      allReservations,
      finalRoomTypes,
      checkIn,
      checkOut,
      hotelSettings?.gridSettings
    );
  }, [guestFormData, allReservations, finalRoomTypes, hotelSettings]);

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
                              handleRoomChangeAndSync={handleRoomChangeAndSync}
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

                      {showGuestForm && (
                        <GuestFormModal
                          initialData={guestFormData}
                          roomTypes={
                            hotelSettings?.roomTypes || defaultRoomTypes
                          }
                          onClose={() => setShowGuestForm(false)}
                          onSave={handleFormSave}
                          availabilityByDate={guestAvailability}
                        />
                      )}
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
