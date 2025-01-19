// src/App.js
/* global chrome */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Header from './components/Header.js';
import SideBar from './components/SideBar.js';
import RoomGrid from './components/RoomGrid.js';
import CanceledReservationsModal from './components/CanceledReservationsModal.js';
import GuestFormModal from './components/GuestFormModal';
import HotelSettings from './components/HotelSettings';
import Login from './components/Login';
import Register from './components/Register';
import ResetPassword from './components/ResetPassword';
import { Routes, Route, Navigate } from 'react-router-dom';
import { fetchUserInfo, updateUser } from './api/api.js';
import DetailPanel from './components/DetailPanel';
import { parseDate } from './utils/dateParser.js';
import {
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
// import { getPriceForDisplay } from './utils/getPriceForDisplay.js';
import { matchRoomType } from './utils/matchRoomType.js';
import { extractPrice } from './utils/extractPrice.js';
import { format, startOfMonth, addDays } from 'date-fns';
import { defaultRoomTypes } from './config/defaultRoomTypes';
import availableOTAs from './config/availableOTAs'; // availableOTAs 임포트
import SalesModal from './components/DailySalesModal.js';
import { isCancelledStatus } from './utils/isCancelledStatus.js';

// === [ADD] 헬퍼 함수: 확장에 OTA 상태를 전달
function sendOtaTogglesToExtension(otaToggles) {
  // 크롬 확장에 메시지를 보내는 함수
  if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
    const EXTENSION_ID = 'ohekbjnbdpnkbahggohidddlgdbbggph'; // 실제 확장 ID로 교체
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

const App = () => {
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

  const toggleGuestForm = () => setShowGuestForm(!showGuestForm);

  const totalRooms = hotelSettings?.totalRooms || 0;
  const remainingRooms = totalRooms - roomsSold;
  const roomTypes = hotelSettings?.roomTypes || [];
  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [newlyCreatedId, setNewlyCreatedId] = useState(null);

  // **수정된 상태: 검색된 예약 ID 저장**
  const [highlightedReservationIds, setHighlightedReservationIds] = useState(
    []
  );
  const [isSearching, setIsSearching] = useState(false);

  const highlightTimeoutRef = useRef(null);

  // 매출 모달 관련 상태 추가
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [showCanceledModal, setShowCanceledModal] = useState(false);

  const [otaToggles, setOtaToggles] = useState(
    availableOTAs.reduce((acc, ota) => ({ ...acc, [ota]: false }), {})
  );

  const [selectedReservation, setSelectedReservation] = useState(null);

  // RoomGrid에 전달할 핸들러
  const handleReservationSelect = (res) => {
    setSelectedReservation(res);
  };

  const handleCloseDetail = () => {
    setSelectedReservation(null);
  };

  // onSave, onEdit 핸들러도 App에서 정의해서 DetailPanel에 전달
  const handleDetailSave = (updatedData) => {
    // reservationId를 updatedData에서 추출 후 handleEdit 호출
    handleEdit(updatedData.reservationNo, updatedData, hotelId);
    setSelectedReservation(null);
  };

  const [isShining, setIsShining] = useState(false);
  const handleSync = () => {
    setIsShining(true);
    setTimeout(() => {
      setIsShining(false);
    }, 5000);
  };

  // 로컬 스토리지에서 토글 상태 불러오기
  useEffect(() => {
    const savedToggles = JSON.parse(localStorage.getItem('otaToggles'));
    if (savedToggles) setOtaToggles(savedToggles);
  }, []);

  // 호텔 설정을 열기 위한 핸들러
  const openSettingsModal = () => {
    setShowSettingsModal(true);
  };

  // 호텔 설정을 닫기 위한 핸들러
  const closeSettingsModal = () => {
    setShowSettingsModal(false);
  };

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

  // 로그인 함수: accessToken과 hotelId를 매개변수로 받아 로컬 스토리지에 저장
  const handleLogin = async (accessToken, hotelIdParam) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('hotelId', hotelIdParam);

    setIsAuthenticated(true);
    setHotelId(hotelIdParam);

    try {
      // (1) Chrome Extension에 토큰 전달 (기존)
      if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
        const EXTENSION_ID = 'bhfggeheelkddgmlegkppgpkmioldfkl'; // 실제 확장 ID

        // 1-1) 토큰 전달
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          {
            action: 'SET_TOKEN',
            token: accessToken,
          },
          (response) => {
            console.log('[handleLogin] Sent token to extension:', response);
          }
        );

        // 1-2) 현재 OTA 토글 상태(react state: otaToggles)도 함께 전달
        //     → 확장 측에서 “어떤 OTA를 활성화할지” 판단 가능
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          {
            action: 'SET_OTA_TOGGLES',
            toggles: otaToggles, // { GoodMotel: true, Yanolja: false, ... }
          },
          (response) => {
            console.log(
              '[handleLogin] Sent OTA toggles to extension:',
              response
            );
          }
        );
      }

      // (2) 호텔 설정 & 예약 정보 로드
      await loadHotelSettings(hotelIdParam);
      await loadReservations();

      // (3) 사용자 정보 불러오기
      const userInfoData = await fetchUserInfo(hotelIdParam);
      setUserInfo(userInfoData);

      // (4) 호텔 주소 설정 (필요 시)
      const fetchedHotelSettings = await fetchHotelSettings(hotelIdParam);
      setHotelAddress(fetchedHotelSettings?.address || '주소 정보 없음');
    } catch (error) {
      console.error('Failed to load hotel settings after login:', error);
    }
  };

  // `calculatePerNightPrice`
  const calculatePerNightPrice = useCallback(
    (reservation, totalPrice, nights) => {
      // totalPrice: 전체 숙박 금액
      // nights: 총 박 수
      if (nights > 0) {
        const perNightPrice = totalPrice / nights;
        console.log(`(Revised) Per night price: ${perNightPrice}`);
        return Math.floor(perNightPrice);
      }
      // nights가 0 이하라면 그냥 totalPrice를 반환(당일 대실 등)
      return Math.floor(totalPrice);
    },
    []
  );

  // 예약 데이터 필터링 및 상태 업데이트 함수
  const filterReservationsByDate = useCallback(
    (reservationsData, date) => {
      const selectedDateString = format(date, 'yyyy-MM-dd');

      console.log(`Filtering reservations for date: ${selectedDateString}`);

      // 선택된 날짜에 맞는 예약 필터링: checkInDate <= selectedDate < checkOutDate
      const selectedDateReservations = reservationsData.filter(
        (reservation) => {
          const checkInDate = reservation.parsedCheckInDate;
          const checkOutDate = reservation.parsedCheckOutDate;

          if (!checkInDate || !checkOutDate) return false;

          // 날짜만 비교하기 위해 시간 부분 제거
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
          // 기존 조건: 선택된 날짜가 체크인 날짜 이상이고 체크아웃 날짜 미만인지 확인
          const isIncluded =
            selectedDateString >= format(checkInDateOnly, 'yyyy-MM-dd') &&
            selectedDateString < format(checkOutDateOnly, 'yyyy-MM-dd');

          // 대실 조건: 체크인과 체크아웃 날짜가 같고, 선택된 날짜가 체크인 날짜인 경우
          const isSameDayStay =
            format(checkInDateOnly, 'yyyy-MM-dd') ===
              format(checkOutDateOnly, 'yyyy-MM-dd') &&
            selectedDateString === format(checkInDateOnly, 'yyyy-MM-dd');

          // 최종 포함 조건: 기존 조건 또는 대실 조건을 만족하는 경우
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

      // 월간 매출 계산을 위해 해당 월의 예약 필터링
      const firstDayOfMonth = startOfMonth(date);
      const lastDayOfMonth = selectedDate; // 수정: 현재 선택된 날짜로 설정

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

      // 월간 매출 계산 - 각 예약의 nightlyRates를 사용하여 합산
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

      // 음수 및 소수점 방지
      monthlyTotalAmount = Math.max(0, Math.floor(monthlyTotalAmount));
      setMonthlyTotal(monthlyTotalAmount);

      console.log(
        `Calculated Monthly Total: ₩${monthlyTotalAmount.toLocaleString()}`
      );

      // 월간 판매 객실 수 계산
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
          // nightlyRates가 없을 경우, 단일 예약으로 간주하여 1 추가
          totalRoomsSold += 1;
        }
      });
      setMonthlySoldRooms(totalRoomsSold);

      // 월 평균 객실 가격 계산
      const avgPrice =
        totalRoomsSold > 0
          ? Math.floor(monthlyTotalAmount / totalRoomsSold)
          : 0;
      setAvgMonthlyRoomPrice(avgPrice);

      // 선택된 날짜의 판매 객실 수 상태 업데이트
      setRoomsSold(selectedDateReservations.length);

      // 로드된 예약 ID 업데이트 (UI 애니메이션 등)
      setLoadedReservations(selectedDateReservations.map((res) => res._id));
    },
    [selectedDate]
  );

  // processReservation 함수 내에서 nights 계산 후 calculatePerNightPrice를 호출
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
        // 날짜만 비교하기 위해 시간 부분을 제거한 날짜 객체 생성
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

        // 순수한 일수 차이 계산
        const days = Math.floor(
          (checkOutDateOnly - checkInDateOnly) / (1000 * 60 * 60 * 24)
        );

        // 0일 차이가 나면 당일 대실로 간주하여 1박으로 처리
        const nights = days > 0 ? days : 1;

        if (isDefaultPriceFlag) {
          totalPrice = 100000; // 기본 가격 적용
        }

        const perNightPriceCalculated = calculatePerNightPrice(
          res,
          totalPrice,
          nights
        );

        console.log(
          `Testing perNightPriceCalculated for ${res._id}: ${perNightPriceCalculated} (should be per-night value)`
        );

        for (let i = 0; i < nights; i++) {
          const date = new Date(checkInDateOnly);
          date.setDate(checkInDateOnly.getDate() + i);
          nightlyRates.push({
            date: format(date, 'yyyy-MM-dd'),
            rate: perNightPriceCalculated,
          });
        }

        finalTotalPrice = nightlyRates.reduce((sum, nr) => sum + nr.rate, 0);
        console.log(
          `Total Price for ${res._id} (recalculated): ${finalTotalPrice}`
        );
      } else {
        // 동일 날짜 숙박 또는 유효하지 않은 날짜의 경우, 1박 가격을 총 가격으로 설정
        if (isDefaultPriceFlag) {
          totalPrice = 100000; // 기본값
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

  const loadReservations = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const data = await fetchReservations(hotelId);
      const processedReservations = data
        .map(processReservation)
        .filter((res) => res !== null); // 유효하지 않은 예약 제외

      setAllReservations(processedReservations);
      filterReservationsByDate(processedReservations, selectedDate);
      console.log('Reservations Loaded:', processedReservations);
    } catch (error) {
      console.error('Failed to load reservations:', error);
    }
    setLoading(false);
  }, [filterReservationsByDate, selectedDate, hotelId, processReservation]);

  // 오늘 날짜로 이동하는 함수
  const today = useCallback(() => {
    const currentDate = new Date();
    setSelectedDate(currentDate);
    filterReservationsByDate(allReservations, currentDate);
    console.log('Moved to Today:', currentDate);
  }, [allReservations, filterReservationsByDate]);

  console.log(activeReservations);

  // 예약 삭제 핸들러
  const handleDelete = useCallback(
    async (reservationId, hotelIdParam, siteName) => {
      // hotelIdParam로 변경
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

  // 예약 확정 핸들러
  const handleConfirm = useCallback(
    async (reservationId, hotelIdParam) => {
      try {
        await confirmReservation(reservationId, hotelIdParam); // API 호출
        await loadReservations(); // 예약 목록 재로드
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

  // 예약 수정 핸들러
  const handleEdit = useCallback(
    async (reservationId, updatedData, hotelIdParam) => {
      try {
        await updateReservation(reservationId, updatedData, hotelId); // API 호출
        await loadReservations(); // 예약 목록 재로드
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

  // 이전 날짜로 이동
  const handlePrevDay = useCallback(() => {
    setSelectedDate((prevDate) => {
      const newDate = addDays(prevDate, -1);
      filterReservationsByDate(allReservations, newDate);
      console.log('Moved to Previous Day:', newDate);
      return newDate;
    });
  }, [filterReservationsByDate, allReservations]);

  // 다음 날짜로 이동
  const handleNextDay = useCallback(() => {
    setSelectedDate((prevDate) => {
      const newDate = addDays(prevDate, 1);
      filterReservationsByDate(allReservations, newDate);
      console.log('Moved to Next Day:', newDate);
      return newDate;
    });
  }, [filterReservationsByDate, allReservations]);

  // ※ 키보드 이벤트 등록 (useEffect)
  useEffect(() => {
    let lastKeyTime = 0; // 마지막으로 키를 처리한 시점 (timestamp)

    function handleKeyDown(e) {
      // ArrowLeft, ArrowRight 키만 처리
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      // input, textarea 등의 포커스 시 무시 (선택사항)
      const ignoreTags = ['INPUT', 'TEXTAREA', 'SELECT'];
      if (ignoreTags.includes(e.target.tagName)) return;

      // 연타 방지: 최소 300ms 간격
      const now = Date.now();
      if (now - lastKeyTime < 300) {
        // 300ms 안에 다시 눌렸다면 무시
        return;
      }
      // 처리: 여기서 날짜 이동 수행
      if (e.key === 'ArrowLeft') handlePrevDay();
      else handleNextDay();

      lastKeyTime = now;
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePrevDay, handleNextDay]);

  // App.js 내 loadHotelSettings 함수 수정
  const loadHotelSettings = useCallback(async (inputHotelId) => {
    try {
      const settings = await fetchHotelSettings(inputHotelId);
      console.log('Fetched settings:', settings);
      if (settings) {
        setHotelSettings(settings);
        setIsNewSetup(false);

        // OTA 토글 상태 설정
        const initialOTAToggles = settings.otas.reduce((acc, ota) => {
          acc[ota.name] = ota.isActive;
          return acc;
        }, {});

        // `availableOTAs`에 포함되지 않은 OTA는 기본값으로 false 설정
        availableOTAs.forEach((ota) => {
          if (!(ota in initialOTAToggles)) {
            initialOTAToggles[ota] = false;
          }
        });

        console.log('Initial OTA Toggles:', initialOTAToggles); // 로그 추가
        setOtaToggles(initialOTAToggles);

        // 호텔 정보 설정
        setHotelAddress(settings.address || '주소 정보 없음');
        setPhoneNumber(settings.phoneNumber || '전화번호 정보 없음');
        setEmail(settings.email || '이메일 정보 없음');
      } else {
        // 기본 설정
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

        // 기본 정보 설정
        setHotelAddress('주소 정보 없음');
        setPhoneNumber('전화번호 정보 없음');
        setEmail('이메일 정보 없음');
      }
    } catch (error) {
      console.error('Failed to load hotel settings:', error);
      // 에러 발생 시 기본 설정
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

      // 기본 정보 설정
      setHotelAddress('주소 정보 없음');
      setPhoneNumber('전화번호 정보 없음');
      setEmail('이메일 정보 없음');
    }
  }, []);

  // OTA 활성화 상태 변경 함수 // 확장은 야놀자를 제외한 나머지만 토글에 영향을 받아야함.
  const handleToggleOTA = useCallback(
    (ota) => {
      if (!availableOTAs.includes(ota)) {
        console.warn(`Unsupported OTA: ${ota}`);
        return;
      }

      setOtaToggles((prev) => {
        const newToggles = { ...prev, [ota]: !prev[ota] };

        // OTA 상태를 서버에 업데이트
        updateHotelSettings(hotelId, {
          otas: Object.entries(newToggles).map(([name, isActive]) => ({
            name,
            isActive,
          })),
        })
          .then((updatedSettings) => {
            // 1) HotelSettings를 set
            setHotelSettings(updatedSettings);

            // 2) updatedSettings.otas로부터 최신 상태의 otaToggles 계산
            const newTogglesFromServer = updatedSettings.otas.reduce(
              (acc, otaObj) => {
                acc[otaObj.name] = otaObj.isActive;
                return acc;
              },
              {}
            );

            // 3) 만약 availableOTAs 중 누락된 게 있다면 false로 채우는 로직
            availableOTAs.forEach((otaName) => {
              if (!(otaName in newTogglesFromServer)) {
                newTogglesFromServer[otaName] = false;
              }
            });

            // 4) 최종적으로 setOtaToggles
            setOtaToggles(newTogglesFromServer);

            console.log(
              `OTA ${ota} 상태가 ${
                newToggles[ota] ? '활성화' : '비활성화'
              }되었습니다.`
            );
            sendOtaTogglesToExtension(newTogglesFromServer);
          })
          .catch((error) => {
            console.error(`OTA ${ota} 상태 업데이트 실패:`, error);
            // 롤백
            setOtaToggles((prevToggle) => ({
              ...prevToggle,
              [ota]: !newToggles[ota],
            }));
          });
        return newToggles;
      });
    },
    [hotelId]
  );

  // 예약 저장 후 데이터 갱신
  const handleFormSave = useCallback(
    async (reservationId, data) => {
      if (reservationId) {
        // (수정 모드)
        try {
          await handleEdit(reservationId, data, hotelId);
          console.log('예약이 성공적으로 수정되었습니다.');
        } catch (error) {
          console.error('예약 수정 실패:', error);
        }
      } else {
        // (생성 모드)
        try {
          const reservationData = {
            siteName: '현장예약',
            reservations: [data],
            hotelId,
          };
          console.log('handleFormSave:', reservationId, data);
          const newReservation = await saveOnSiteReservation(reservationData);
          console.log('Guest Form Saveddddddddddddddddd:', newReservation);

          /* 수정부분 시작: 새 예약의 _id를 newlyCreatedId에 세팅 */
          if (newReservation && newReservation._id) {
            setNewlyCreatedId(newReservation._id);
          }
          /* 수정부분 끝 */

          // 나머지 로직(모달닫기, 재로딩 등)
          setShowGuestForm(false);
          await loadReservations();
          console.log('예약 목록 다시 로드됨');
        } catch (error) {
          console.error('Error saving 현장예약:', error);
        }
      }
    },
    [hotelId, loadReservations, handleEdit]
  );

  // 검색 상태 및 핸들러 추가 (수정된 부분)
  const [searchCriteria, setSearchCriteria] = useState({
    name: '',
    reservationNo: '',
    checkInDate: '',
    checkOutDate: '',
  });

  // 음성 검색 결과 처리 함수
  const handleVoiceResult = (transcript) => {
    setSearchCriteria({ ...searchCriteria, name: transcript });

    // 1초 후에 executeSearch 호출하면서 검색어 직접 전달
    setTimeout(() => {
      executeSearch(transcript);
    }, 1000);
  };

  // 예약 검색 함수
  const executeSearch = useCallback(
    (searchTerm) => {
      const trimmedSearchTerm = searchTerm.trim();

      // 검색어 유효성 검사: 최소 2자 이상
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

        // 메모 내용 검색: reservation._id를 사용해 memos를 참조
        const memoText = memos[reservation._id]?.text || '';
        const memoMatch = memoText.toLowerCase().includes(lowerCaseSearchTerm);

        return nameMatch || reservationNoMatch || memoMatch;
      });

      if (results.length > 0) {
        setIsSearching(true); // 검색 중 상태 활성화

        // 최대 5개의 결과로 제한
        const limitedResults = results.slice(0, 5);

        const reservationIds = limitedResults.map((res) => res._id);
        setHighlightedReservationIds(reservationIds);

        // 날짜 설정 (첫 번째 결과의 체크인 날짜)
        const firstResult = limitedResults[0];
        const checkInDate = parseDate(firstResult.checkIn);
        if (checkInDate) {
          setSelectedDate(checkInDate);
          filterReservationsByDate(allReservations, checkInDate);
        }

        // 기존 타이머가 있다면 클리어
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }

        // 5초 후에 강조 상태를 제거하는 타이머 설정
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedReservationIds([]);
          setIsSearching(false);
        }, 5000); // 5000ms = 5초
      } else {
        alert('검색 결과가 없습니다.');
        setHighlightedReservationIds([]);
        setIsSearching(false);
      }
    },
    [allReservations, filterReservationsByDate, memos]
  );

  // 컴포넌트 언마운트 시 타이머 클리어
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // 날짜 변경 시 검색 상태 초기화
  const handleDateChange = useCallback(
    (date) => {
      const newDate = new Date(date);
      setSelectedDate(newDate);
      filterReservationsByDate(allReservations, newDate);
      console.log('Date Changed to:', newDate);
      // 날짜를 변경하면 검색 상태 초기화
      setHighlightedReservationIds([]);
      setIsSearching(false);

      // 기존 타이머가 있다면 클리어
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    },
    [filterReservationsByDate, allReservations]
  );

  // 호텔 설정 저장
  const handleSaveSettings = useCallback(
    async (newSettings) => {
      console.log('Saving settings. isNewSetup:', isNewSetup);
      try {
        const {
          hotelId: newHotelId,
          totalRooms,
          roomTypes,
          email: newEmail,
          address,
          phoneNumber: newPhoneNumber,
          otas,
        } = newSettings;

        const hotelSettingsData = {
          hotelId: newHotelId,
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
          const updatedUserInfo = await updateUser(userId, userSettings);
          setUserInfo(updatedUserInfo);

          // 로컬 스토리지에 userInfo 저장
          localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
        } else {
          console.warn('User ID not found. Skipping user update.');
        }

        // 상태 업데이트
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

  // 초기 로그인 상태 확인 및 설정 로드
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      const storedHotelId = localStorage.getItem('hotelId');

      if (storedToken && storedHotelId) {
        setIsAuthenticated(true);
        setHotelId(storedHotelId);

        // try {
        //   // 호텔 설정 로드
        //   const settings = await loadHotelSettings(storedHotelId);
        //   await loadReservations();

        //   if (
        //     !settings ||
        //     !settings.roomTypes ||
        //     settings.roomTypes.length === 0
        //   ) {
        //     console.warn(
        //       '호텔 설정이 완료되지 않았습니다. 설정 버튼을 클릭하여 설정을 완료하세요.'
        //     );
        //   }

        try {
          // 호텔 설정 로드
          await loadHotelSettings(storedHotelId);
          await loadReservations();

          // 사용자 정보 불러오기
          const userInfoData = await fetchUserInfo(storedHotelId);
          setUserInfo(userInfoData);

          // setHotelAddress(userInfoData?.address || '주소 정보 없음'); // 제거
        } catch (error) {
          console.error('초기 인증 및 데이터 로딩 실패:', error);
        }
      } else {
        console.log('저장된 세션이 없습니다. 로그인 해주세요.');
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, [loadHotelSettings, loadReservations]);

  // 로그아웃 핸들러 수정
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

    // OTA 토글 초기화
    setOtaToggles(
      availableOTAs.reduce((acc, ota) => ({ ...acc, [ota]: false }), {})
    );

    // === 수정: 확장에도 “비활성화된 otaToggles” 전달
    sendOtaTogglesToExtension(
      availableOTAs.reduce((acc, ota) => ({ ...acc, [ota]: false }), {})
    );
  }, []);

  // 예약 데이터 갱신
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

    ///////////////////////////////////////////////
// 1) 새 함수: 현장예약 버튼 전용
///////////////////////////////////////////////
const openOnSiteReservationForm = () => {
  // 1) 현재 App의 selectedDate를 기준으로 checkIn/checkOut 시각 세팅
  //    여기서는 예: 체크인=선택날짜+16:00, 체크아웃=다음날+11:00
  const checkInObj = new Date(selectedDate);
  checkInObj.setHours(16, 0, 0, 0); // 16:00
  const checkOutObj = new Date(checkInObj.getTime() + 19 * 60 * 60 * 1000);
  // ↑ 19시간 후면 다음날 11:00 (16:00~다음날 11:00 = 19시간 차이)
  //  또는 아래처럼 정확히 다음날로 계산:
  // const checkOutObj = new Date(checkInObj);
  // checkOutObj.setDate(checkOutObj.getDate() + 1);
  // checkOutObj.setHours(11, 0, 0, 0);

  // 2) 문자열로 변환
  const checkInDate = format(checkInObj, 'yyyy-MM-dd');
  const checkInTime = format(checkInObj, 'HH:mm');
  const checkOutDate = format(checkOutObj, 'yyyy-MM-dd');
  const checkOutTime = format(checkOutObj, 'HH:mm');

  // 3) 예시 고객명: "현장숙박1234"
  const rand = Math.floor(1000 + Math.random() * 9000);
  const customerName = `현장숙박${rand}`;

  // 4) 게스트 폼에 사용할 state 세팅
  setGuestFormData({
    reservationNo: `${Date.now()}`,
    customerName,
    phoneNumber: '',
    checkInDate,
    checkInTime,
    checkOutDate,
    checkOutTime,
    reservationDate: format(new Date(), 'yyyy-MM-dd HH:mm'),
    roomInfo: roomTypes[0]?.type || 'Standard', // 기본값
    price: roomTypes[0]?.price?.toString() || '0', // 기본값
    paymentMethod: 'Pending',
    specialRequests: '',
    // ISO full string
    checkIn: `${checkInDate}T${checkInTime}:00`,
    checkOut: `${checkOutDate}T${checkOutTime}:00`,
  });

  // 5) 모달 열기
  setShowGuestForm(true);
};

  // 간편 입력 버튼 클릭 시 호출되는 함수
  const onQuickCreate = (type) => {
    const now = new Date();
    let checkInDate = format(now, 'yyyy-MM-dd');
    let checkInTime = '16:00';
    let checkOutDate;
    let checkOutTime = '11:00';
    let customerName;
    const rand = Math.floor(1000 + Math.random() * 9000);

    if (type === '대실') {
      checkInTime = format(now, 'HH:mm');
      const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      checkOutDate = format(fourHoursLater, 'yyyy-MM-dd');
      checkOutTime = format(fourHoursLater, 'HH:mm');
      customerName = `현장대실${rand}`;

      // 대실 가격 계산
      const basePrice = roomTypes[0].price;
      const price = Math.floor(basePrice * 0.5);

      // 여기서 날짜와 시간을 합쳐 ISO 형식 문자열 생성
      const checkIn = `${checkInDate}T${checkInTime}:00`;
      const checkOut = `${checkOutDate}T${checkOutTime}:00`;

      setGuestFormData({
        reservationNo: `${Date.now()}`,
        customerName,
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: roomTypes[0].type,
        price: price.toString(),
        paymentMethod: 'Pending',
        specialRequests: '',
        checkIn,
        checkOut,
      });
    } else {
      let nights = 1;
      if (type === '2박') nights = 2;
      else if (type === '3박') nights = 3;
      else if (type === '4박') nights = 4;

      const checkInObj = new Date(`${checkInDate}T16:00:00`);
      const checkOutObj = new Date(
        checkInObj.getTime() + nights * 24 * 60 * 60 * 1000
      );
      checkOutDate = format(checkOutObj, 'yyyy-MM-dd');
      customerName = `현장숙박${rand}`;

      const basePrice = roomTypes[0].price * nights;

      // ISO 형식 문자열 생성
      const checkIn = `${checkInDate}T${checkInTime}:00`;
      const checkOut = `${checkOutDate}T${checkOutTime}:00`;

      setGuestFormData({
        reservationNo: `${Date.now()}`,
        customerName,
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: roomTypes[0].type,
        price: basePrice.toString(),
        paymentMethod: 'Pending',
        specialRequests: '',
        checkIn,
        checkOut,
      });
    }

    setShowGuestForm(true);
  };

  const combinedSync = () => {
    today();
    handleSync();
  };

  // 매출 모달 열기 핸들러
  const openSalesModal = () => {
    setIsSalesModalOpen(true);
  };

  // 매출 모달 닫기 핸들러
  const closeSalesModal = () => {
    setIsSalesModalOpen(false);
  };

  // `dailySales` 데이터 구성
  const dailySales = activeReservations.map((reservation, index) => {
    let pricePerNight;
    // nightlyRates가 있으면 첫 번째 nights의 rate가 1박 가격
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

  // `monthlySales` 계산
  const monthlySales = monthlyTotal > 0 ? Math.floor(monthlyTotal * 0.9) : 0;

  // 렌더링
  return (
    <div
      className={`app-layout ${!isAuthenticated ? 'logged-out' : ''}`}
      style={{ display: 'flex' }}
    >
      {isLoading ? (
        <div className="loading-spinner">로딩 중...</div>
      ) : (
        <Routes>
          {/* 인증되지 않은 사용자 라우트 */}
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
              />{' '}
              {/* ResetPassword 라우트 추가 */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            // 인증된 사용자 라우트
            <>
              <Route
                path="/"
                element={
                  <>
                    <Header
                      selectedDate={selectedDate}
                      // onDateChange={handleDateChange}
                      onPrevDay={handlePrevDay}
                      onNextDay={handleNextDay}
                      onQuickCreate={onQuickCreate}
                      onLogout={handleLogout}
                      isShining={isShining}
                      otaToggles={otaToggles}
                      onToggleOTA={handleToggleOTA}
                      onDateChange={handleDateChange}
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
                      onFormToggle={toggleGuestForm}
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
                      memos={memos} // 추가
                      setMemos={setMemos} // 추가
                      onOnsiteReservationClick={openOnSiteReservationForm}
                    />

                    {/* 메인 콘텐츠 영역 */}
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
                            memos={memos} // 추가
                            setMemos={setMemos} // 추가
                            searchCriteria={searchCriteria}
                            isSearching={isSearching} // 검색 중 여부 전달
                            highlightedReservationIds={
                              highlightedReservationIds
                            }
                            headerHeight={140}
                            newlyCreatedId={newlyCreatedId}
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
                          onClose={toggleGuestForm}
                          onSave={handleFormSave}
                        />
                      )}
                    </div>
                    {/* 호텔 설정 모달 열기 */}
                    {showSettingsModal && (
                      <HotelSettings
                        onClose={closeSettingsModal}
                        onSave={handleSaveSettings}
                        existingSettings={{
                          ...userInfo,
                          ...hotelSettings,
                          otas:
                            hotelSettings?.otas ||
                            availableOTAs.map((ota) => ({
                              name: ota,
                              isActive: false,
                            })),
                        }}
                      />
                    )}
                    {/* 매출 정보 모달 추가 */}
                    <SalesModal
                      isOpen={isSalesModalOpen}
                      onRequestClose={closeSalesModal}
                      dailySales={dailySales}
                      dailyTotal={dailyTotal}
                      monthlySales={monthlySales}
                      selectedDate={selectedDate}
                      totalRooms={totalRooms}
                      remainingRooms={remainingRooms}
                      occupancyRate={occupancyRate}
                      avgMonthlyRoomPrice={avgMonthlyRoomPrice}
                      dailyAverageRoomPrice={dailyAverageRoomPrice} // 추가
                      roomTypes={hotelSettings?.roomTypes || defaultRoomTypes}
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
              {/* 인증된 사용자를 위한 기타 라우트 추가 가능 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      )}
    </div>
  );
};

export default App;
