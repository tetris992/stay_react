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
import GuestFormModal from './components/GuestFormModal';
import HotelSettings from './components/HotelSettings';
import Login from './components/Login';
import Register from './components/Register';
import ResetPassword from './components/ResetPassword';
import PrivacyConsent from './components/PrivacyConsentModal.js';
import DetailPanel from './components/DetailPanel';
import { parseDate } from './utils/dateParser.js';
import {
  format,
  startOfMonth,
  addDays,
  endOfMonth,
  differenceInCalendarDays,
} from 'date-fns';
import { defaultRoomTypes } from './config/defaultRoomTypes';
import availableOTAs from './config/availableOTAs';
import SalesModal from './components/DailySalesModal.js';
import { isCancelledStatus } from './utils/isCancelledStatus.js';
// * Refactored: API 관련 함수들을 한 번에 import (중복 제거)
import api, {
  fetchUserInfo,
  updateUser,
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

/* ============================================================================
   HELPER FUNCTIONS (추후 별도 유틸 파일로 분리 가능)
   ============================================================================ */
// * Refactored: 매출 집계 및 날짜 관련 헬퍼 함수들을 컴포넌트 외부로 이동하여
//            렌더링 시 재생성 비용을 줄이고 재사용하도록 함.
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
    const EXTENSION_ID = 'ohekbjnbdpnkbahggohidddlgdbbggph';
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
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [memos, setMemos] = useState({});
  const [hotelSettings, setHotelSettings] = useState({
    hotelAddress: '',
    phoneNumber: '',
    email: '',
  });
  const [isNewSetup, setIsNewSetup] = useState(true);
  const [roomsSold, setRoomsSold] = useState(0);
  const [monthlySoldRooms, setMonthlySoldRooms] = useState(0);
  const [avgMonthlyRoomPrice, setAvgMonthlyRoomPrice] = useState(0);
  const dailyAverageRoomPrice =
    roomsSold > 0 ? Math.floor(dailyTotal / roomsSold) : 0;
  const [guestFormData, setGuestFormData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);
  const [hotelAddress, setHotelAddress] = useState('주소 정보 없음');
  const [phoneNumber, setPhoneNumber] = useState('전화번호 정보 없음');
  const [email, setEmail] = useState('이메일 정보 없음');
  const totalRooms = hotelSettings?.totalRooms || 0;
  const remainingRooms = totalRooms - roomsSold;
  const roomTypes = hotelSettings?.roomTypes || [];
  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [newlyCreatedId, setNewlyCreatedId] = useState(null);
  const [highlightedReservationIds, setHighlightedReservationIds] = useState(
    []
  );
  const [isSearching, setIsSearching] = useState(false);
  const highlightTimeoutRef = useRef(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [showCanceledModal, setShowCanceledModal] = useState(false);
  const [otaToggles, setOtaToggles] = useState(
    availableOTAs.reduce((acc, ota) => ({ ...acc, [ota]: false }), {})
  );
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [sortOrder, setSortOrder] = useState('newest');
  const navigate = useNavigate();

  // * Refactored: useCallback 및 useMemo로 함수 재생성 최소화
  const handleSort = useCallback(() => {
    setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'));
  }, []);

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

  const openSettingsModal = useCallback(() => {
    setShowSettingsModal(true);
  }, []);

  const closeSettingsModal = useCallback(() => {
    setShowSettingsModal(false);
  }, []);

  const [flipAllMemos, setFlipAllMemos] = useState(false);
  const handleMemoButtonClick = useCallback(() => {
    setFlipAllMemos((prev) => !prev);
  }, []);

  useEffect(() => {
    if (hotelSettings && hotelSettings.address) {
      console.log(
        'Setting hotelAddress from hotelSettings:',
        hotelSettings.address
      );
      setHotelAddress(hotelSettings.address);
    } else {
      setHotelAddress('주소 정보 없음');
    }
  }, [hotelSettings]);

  const calculatePerNightPrice = useCallback(
    (reservation, totalPrice, nights) => {
      if (nights > 0) {
        const perNightPrice = totalPrice / nights;
        // console.log(`(Revised) Per night price: ${perNightPrice}`);
        return Math.floor(perNightPrice);
      }
      return Math.floor(totalPrice);
    },
    []
  );

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
            console.log(
              `Including reservation from ${format(
                checkInDate,
                'yyyy-MM-dd HH:mm'
              )} to ${format(
                checkOutDate,
                'yyyy-MM-dd HH:mm'
              )} on ${selectedDateString}`
            );
          }
          return finalIncluded;
        }
      );
      setActiveReservations(selectedDateReservations);
      const breakdown = selectedDateReservations.map((reservation) => {
        let pricePerNight;
        if (reservation.nightlyRates && reservation.nightlyRates.length > 0) {
          pricePerNight = reservation.nightlyRates[0].rate;
        } else {
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
              monthlyTotalAmount += nightlyRate.rate;
            }
          });
        }
      });
      monthlyTotalAmount = Math.max(0, Math.floor(monthlyTotalAmount));
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

  const processReservation = useCallback(
    (res) => {
      const { price, isDefault } = extractPrice(res.priceString || res.price);
      let totalPrice = price;
      let isDefaultPriceFlag = isDefault;
      if (totalPrice <= 0) {
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

  const loadHotelSettings = useCallback(async (inputHotelId) => {
    try {
      const settings = await fetchHotelSettings(inputHotelId);
      console.log('Fetched settings:', settings);
      if (settings) {
        setHotelSettings(settings);
        setIsNewSetup(false);
        const initialOTAToggles = settings.otas.reduce((acc, ota) => {
          acc[ota.name] = ota.isActive;
          return acc;
        }, {});
        availableOTAs.forEach((ota) => {
          if (!(ota in initialOTAToggles)) {
            initialOTAToggles[ota] = false;
          }
        });
        console.log('Initial OTA Toggles:', initialOTAToggles);
        setOtaToggles(initialOTAToggles);
        setHotelAddress(settings.address || '주소 정보 없음');
        setPhoneNumber(settings.phoneNumber || '전화번호 정보 없음');
        setEmail(settings.email || '이메일 정보 없음');
      } else {
        const defaultOTAToggles = availableOTAs.reduce(
          (acc, ota) => ({ ...acc, [ota]: false }),
          {}
        );
        setHotelSettings({
          hotelId: inputHotelId,
          roomTypes: defaultRoomTypes,
          totalRooms: defaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0),
          otas: availableOTAs.map((ota) => ({ name: ota, isActive: false })),
        });
        setIsNewSetup(true);
        setOtaToggles(defaultOTAToggles);
        setHotelAddress('주소 정보 없음');
        setPhoneNumber('전화번호 정보 없음');
        setEmail('이메일 정보 없음');
      }
    } catch (error) {
      console.error('Failed to load hotel settings:', error);
      const defaultOTAToggles = availableOTAs.reduce(
        (acc, ota) => ({ ...acc, [ota]: false }),
        {}
      );
      setIsNewSetup(true);
      setHotelSettings({
        hotelId: inputHotelId,
        roomTypes: defaultRoomTypes,
        totalRooms: defaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0),
        otas: availableOTAs.map((ota) => ({ name: ota, isActive: false })),
      });
      setOtaToggles(defaultOTAToggles);
      setHotelAddress('주소 정보 없음');
      setPhoneNumber('전화번호 정보 없음');
      setEmail('이메일 정보 없음');
    }
  }, []);

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

  // * Refactored: handleLogin 함수에 의존성 otaToggles 추가 및 간결하게 정리
  const handleLogin = useCallback(
    async (accessToken, hotelIdParam) => {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('hotelId', hotelIdParam);
      setIsAuthenticated(true);
      setHotelId(hotelIdParam);
      try {
        if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
          const EXTENSION_ID = 'bhfggeheelkddgmlegkppgpkmioldfkl';
          chrome.runtime.sendMessage(
            EXTENSION_ID,
            { action: 'SET_TOKEN', token: accessToken },
            (response) => {
              console.log('[handleLogin] Sent token to extension:', response);
            }
          );
          chrome.runtime.sendMessage(
            EXTENSION_ID,
            { action: 'SET_OTA_TOGGLES', toggles: otaToggles },
            (response) => {
              console.log(
                '[handleLogin] Sent OTA toggles to extension:',
                response
              );
            }
          );
        }
        await loadHotelSettings(hotelIdParam);
        await loadReservations();
        const userInfoData = await fetchUserInfo(hotelIdParam);
        setUserInfo(userInfoData);
        const fetchedHotelSettings = await fetchHotelSettings(hotelIdParam);
        setHotelAddress(fetchedHotelSettings?.address || '주소 정보 없음');
      } catch (error) {
        console.error('Failed to load hotel settings after login:', error);
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

  const handleEdit = useCallback(
    async (reservationId, updatedData, hotelIdParam) => {
      try {
        await updateReservation(reservationId, updatedData, hotelId);
        await loadReservations();
        console.log(
          `Reservation ${reservationId} updated for hotel ${hotelIdParam}`
        );
      } catch (error) {
        console.error(`Failed to update reservation ${reservationId}:`, error);
        alert('예약 수정에 실패했습니다. 다시 시도해주세요.');
      }
    },
    [loadReservations, hotelId]
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
          }
        } catch (error) {
          console.error('Error saving 현장예약:', error);
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

  const handleSaveSettings = useCallback(
    async (newSettings) => {
      console.log('Saving settings. isNewSetup:', isNewSetup);
      try {
        const {
          hotelId: newHotelId,
          hotelName,
          totalRooms,
          roomTypes,
          email: newEmail,
          address,
          phoneNumber: newPhoneNumber,
          otas,
        } = newSettings;
        const hotelSettingsData = {
          hotelId: newHotelId,
          hotelName: hotelName,
          totalRooms,
          roomTypes,
          otas:
            otas && Array.isArray(otas)
              ? otas
              : availableOTAs.map((ota) => ({ name: ota, isActive: false })),
        };
        const userSettings = {
          email: newEmail,
          address,
          phoneNumber: newPhoneNumber,
        };
        if (isNewSetup) {
          console.log('Using saveHotelSettings (POST)');
          await saveHotelSettings(hotelSettingsData);
        } else {
          console.log('Using updateHotelSettings (PATCH)');
          await updateHotelSettings(newHotelId, hotelSettingsData);
        }
        const userId = userInfo?.id || userInfo?._id;
        if (userId) {
          console.log('Updating user info');
          try {
            await updateUser(userId, userSettings);
            setUserInfo((prev) => ({
              ...prev,
              email: newEmail,
              address,
              phoneNumber: newPhoneNumber,
              hotelName: hotelName,
            }));
            localStorage.setItem(
              'userInfo',
              JSON.stringify({
                ...userInfo,
                email: newEmail,
                address,
                phoneNumber: newPhoneNumber,
                hotelName: hotelName,
              })
            );
          } catch (err) {
            if (err.message && err.message.includes('권한이 없습니다')) {
              console.warn(
                'User update failed (403 - 권한이 없습니다), but settings saved.'
              );
            } else {
              throw err;
            }
          }
        } else {
          console.warn('User ID not found. Skipping user update.');
        }
        setHotelSettings(hotelSettingsData);
        setHotelAddress(address || '주소 정보 없음');
        setPhoneNumber(newPhoneNumber || '전화번호 정보 없음');
        setEmail(newEmail || '이메일 정보 없음');
        setHotelId(newHotelId);
        setIsNewSetup(false);
        setShowSettingsModal(false);
        console.log('Hotel Settings and User Info Saved:', {
          ...hotelSettingsData,
          ...userInfo,
        });
      } catch (error) {
        console.error('Failed to save hotel settings or user info:', error);
        const errorMessage = error.response?.data?.message || error.message;
        alert(`설정 저장 실패: ${errorMessage}`);
      }
    },
    [isNewSetup, userInfo]
  );

  useEffect(() => {
    async function fetchCsrf() {
      try {
        const { data } = await api.get('/csrf-token');
        localStorage.setItem('csrfToken', data.csrfToken);
      } catch (e) {
        console.error('CSRF 토큰 요청 실패:', e);
      }
    }
    fetchCsrf();
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      const storedHotelId = localStorage.getItem('hotelId');
      if (storedToken && storedHotelId) {
        setIsAuthenticated(true);
        setHotelId(storedHotelId);
        try {
          await loadHotelSettings(storedHotelId);
          await loadReservations();
          const userInfoData = await fetchUserInfo(storedHotelId);
          setUserInfo(userInfoData);
          const fetchedHotelSettings = await fetchHotelSettings(storedHotelId);
          setHotelAddress(fetchedHotelSettings?.address || '주소 정보 없음');
        } catch (error) {
          console.error('초기 인증 및 데이터 로딩 실패:', error);
          if (error.response && error.response.status === 403) {
            const errorMessage = error.response.data.message;
            if (errorMessage === '개인정보 동의가 필요합니다.') {
              setNeedsConsent(true);
            }
          }
        }
      } else {
        console.log('저장된 세션이 없습니다. 로그인 해주세요.');
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, [loadHotelSettings, loadReservations]);

  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error('백엔드 로그아웃 실패:', error);
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('hotelId');
    localStorage.removeItem('hotelSettings');
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
  }, []);

  useEffect(() => {
    if (isAuthenticated && hotelId && !isLoading) {
      loadReservations();
      const intervalId = setInterval(() => {
        loadReservations();
      }, 5 * 60 * 1000);
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated, hotelId, loadReservations, isLoading]);

  const occupancyRate =
    totalRooms > 0 ? Math.round((roomsSold / totalRooms) * 100) : 0;

  // * Refactored: 현장 예약 생성용 함수 정리
  const openOnSiteReservationForm = () => {
    const now = new Date();
    // 오늘 자정 계산
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    // 선택된 날짜가 오늘 이전이면 오늘 날짜로 조정
    const effectiveDate = selectedDate < todayStart ? todayStart : selectedDate;

    // effectiveDate를 기준으로 체크인/체크아웃 시간을 설정
    const checkInObj = new Date(effectiveDate);
    checkInObj.setHours(16, 0, 0, 0);
    const checkOutObj = new Date(checkInObj.getTime() + 19 * 60 * 60 * 1000);

    const checkInDate = format(checkInObj, 'yyyy-MM-dd');
    const checkInTime = format(checkInObj, 'HH:mm');
    const checkOutDate = format(checkOutObj, 'yyyy-MM-dd');
    const checkOutTime = format(checkOutObj, 'HH:mm');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const customerName = `현장숙박${rand}`;

    setGuestFormData({
      reservationNo: `${Date.now()}`,
      customerName,
      phoneNumber: '',
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      reservationDate: format(new Date(), 'yyyy-MM-dd HH:mm'),
      roomInfo: roomTypes[0]?.type || 'Standard',
      price: roomTypes[0]?.price?.toString() || '0',
      paymentMethod: 'Pending',
      specialRequests: '',
      checkIn: `${checkInDate}T${checkInTime}:00`,
      checkOut: `${checkOutDate}T${checkOutTime}:00`,
    });
    setShowGuestForm(true);
  };

  // * Refactored: 간편 예약 입력 함수 통합
  const onQuickCreate = (type) => {
    let checkInDate, checkInTime, checkOutDate, checkOutTime, customerName;
    const rand = Math.floor(1000 + Math.random() * 9000);
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
      customerName = `현장대실${rand}`;
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
        roomInfo: roomTypes[0].type,
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
      customerName = `현장숙박${rand}`;
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
        roomInfo: roomTypes[0].type,
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
    fetchUserInfo(hotelId)
      .then((data) => {
        setUserInfo(data);
        setNeedsConsent(false);
      })
      .catch((error) => {
        console.error('Failed to fetch user info after consent:', error);
      });
  }, [hotelId]);

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
                      onSort={handleSort}
                      onDateChange={handleDateChange}
                      onMemo={handleMemoButtonClick}
                      flipAllMemos={flipAllMemos}
                      sortOrder={sortOrder}
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
                      openSettingsModal={openSettingsModal}
                      dailyBreakdown={dailyBreakdown}
                      phoneNumber={phoneNumber}
                      email={email}
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
                    />
                    <div className="main-content" style={{ flex: '1' }}>
                      <div className="split-view-layout">
                        <div className="left-pane">
                          <RoomGrid
                            reservations={activeReservations}
                            onDelete={handleDelete}
                            onConfirm={handleConfirm}
                            onEdit={handleEdit}
                            onReservationSelect={handleReservationSelect}
                            loadedReservations={loadedReservations}
                            hotelId={hotelId}
                            highlightFirstCard={true}
                            hotelAddress={hotelAddress}
                            phoneNumber={phoneNumber}
                            email={email}
                            roomTypes={roomTypes}
                            memos={memos}
                            setMemos={setMemos}
                            searchCriteria={searchCriteria}
                            isSearching={isSearching}
                            highlightedReservationIds={
                              highlightedReservationIds
                            }
                            headerHeight={140}
                            newlyCreatedId={newlyCreatedId}
                            flipAllMemos={flipAllMemos}
                            sortOrder={sortOrder}
                            needsConsent={needsConsent}
                            monthlyDailyBreakdown={monthlyDailyBreakdown}
                          />
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
                        />
                      )}
                    </div>
                    {showSettingsModal && (
                      <HotelSettings
                        onClose={closeSettingsModal}
                        onSave={handleSaveSettings}
                        existingSettings={{
                          ...hotelSettings,
                          hotelName: hotelSettings?.hotelName,
                          ...userInfo,
                          otas:
                            hotelSettings?.otas ||
                            availableOTAs.map((ota) => ({
                              name: ota,
                              isActive: false,
                            })),
                        }}
                      />
                    )}
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
