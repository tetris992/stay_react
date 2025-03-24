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
import {
  calculateRoomAvailability,
  isRoomAvailableForPeriod,
} from './utils/availability';

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
    labels.push(formatDate(d, 'MM-dd'));
  }
  const categories = new Set([
    ...availableOTAs,
    '현장숙박',
    '현장대실',
    '기타',
  ]);
  const dailySalesByOTA = {};
  categories.forEach((cat) => {
    dailySalesByOTA[cat] = new Array(numDays).fill(0);
  });

  reservations
    .filter((res) => !res.manuallyCheckedOut)
    .forEach((res) => {
      let category = '기타';
      if (res.siteName === '현장예약') {
        category = res.type === 'stay' ? '현장숙박' : '현장대실';
      } else if (availableOTAs.includes(res.siteName)) {
        category = res.siteName;
      }

      if (!res.parsedCheckInDate || !res.parsedCheckOutDate) {
        res.parsedCheckInDate = new Date(res.checkIn);
        res.parsedCheckOutDate = new Date(res.checkOut);
      }

      const checkInDay = startOfDay(res.parsedCheckInDate);
      const checkOutDay = startOfDay(res.parsedCheckOutDate);
      const nights =
        Math.ceil((checkOutDay - checkInDay) / (1000 * 60 * 60 * 24)) || 1;
      const dailyRate =
        res.nightlyRates?.length > 0
          ? res.nightlyRates[0].rate ||
            (res.totalPrice || res.price || 0) / nights
          : (res.totalPrice || res.price || 0) / nights;

      if (res.type === 'dayUse') {
        // 대실 예약: 체크인 날짜에만 매출 반영
        if (checkInDay >= monthStart && checkInDay <= monthEnd) {
          const dayIndex = differenceInCalendarDays(checkInDay, monthStart);
          if (dayIndex >= 0 && dayIndex < numDays) {
            dailySalesByOTA[category][dayIndex] += dailyRate;
          }
        }
      } else {
        // 숙박 예약: 체크인 날짜에만 매출 반영
        if (checkInDay >= monthStart && checkInDay <= monthEnd) {
          const dayIndex = differenceInCalendarDays(checkInDay, monthStart);
          if (dayIndex >= 0 && dayIndex < numDays) {
            dailySalesByOTA[category][dayIndex] += dailyRate * nights;
          }
        }
      }
    });

  return { labels, dailySalesByOTA };
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
  const [dailyTotal, setDailyTotal] = useState({
    total: 0,
    paymentTotals: { Cash: 0, Card: 0, OTA: 0, Pending: 0 },
    typeTotals: { 현장숙박: 0, 현장대실: 0 },
    dailyBreakdown: [],
  });
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
    roomsSold > 0 ? Math.floor(dailyTotal.total / roomsSold) : 0;

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

  const [isMinimalModeEnabled, setIsMinimalModeEnabled] = useState(false);

  const toggleMinimalMode = useCallback(() => {
    setIsMinimalModeEnabled((prev) => !prev);
  }, []);

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

  const buildMonthlyDailyBreakdown = useCallback(
    (reservations, targetDate) => {
      // finalRoomTypes와 hotelSettings가 준비되지 않은 경우 실행 중단
      if (!finalRoomTypes || !hotelSettings) {
        console.warn(
          'finalRoomTypes or hotelSettings is not ready yet. Skipping buildMonthlyDailyBreakdown.'
        );
        return {
          dailyTotals: Array(31)
            .fill(0)
            .map(() => ({
              Total: 0,
              Cash: 0,
              Card: 0,
              OTA: 0,
              Pending: 0,
              현장숙박: 0,
              현장대실: 0,
            })),
          monthlyTotal: 0,
          monthlyPaymentTotals: { Cash: 0, Card: 0, OTA: 0, Pending: 0 },
          monthlyTypeTotals: { 현장숙박: 0, 현장대실: 0 },
          integratedTable: [],
        };
      }

      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);
      const totalDays = differenceInCalendarDays(monthEnd, monthStart) + 1;

      const dailyTotals = Array(totalDays)
        .fill(0)
        .map(() => ({
          Total: 0,
          Cash: 0,
          Card: 0,
          OTA: 0,
          Pending: 0,
          현장숙박: 0,
          현장대실: 0,
        }));

      const dailyBreakdownDetails = {};

      // 선택된 날짜의 통합 테이블 데이터를 저장할 객체
      const selectedDateStr = format(targetDate, 'yyyy-MM-dd');
      const integratedTable = [];

      // 점유 상황 계산
      const availability = calculateRoomAvailability(
        reservations,
        finalRoomTypes,
        targetDate,
        addDays(targetDate, 1),
        hotelSettings?.gridSettings || {}
      );

      // 객실별 점유 상황을 테이블로 구성
      finalRoomTypes.forEach((roomType) => {
        const typeKey = roomType.roomInfo.toLowerCase();
        const allRooms = roomType.roomNumbers || [];
        const availabilityData = availability[selectedDateStr]?.[typeKey] || {
          assignedRooms: [],
          checkedOutRooms: [],
          leftoverRooms: [],
          reservations: [],
          checkedOutReservations: [],
        };

        allRooms.forEach((roomNumber) => {
          const isAssigned =
            availabilityData.assignedRooms.includes(roomNumber);
          const isCheckedOut =
            availabilityData.checkedOutRooms.includes(roomNumber);

          // 점유된 예약 처리
          if (isAssigned) {
            const reservation = availabilityData.reservations.find(
              (res) => res.roomNumber === roomNumber
            );
            if (reservation) {
              const checkInDate = new Date(reservation.checkIn);
              const checkOutDate = new Date(reservation.checkOut);
              let nights = 1;
              let dailyRate = 0;
              let totalAmount = 0;
              if (
                !isNaN(checkInDate.getTime()) &&
                !isNaN(checkOutDate.getTime())
              ) {
                nights = Math.max(
                  1,
                  Math.ceil(
                    (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)
                  )
                );
                totalAmount = Number(
                  reservation.totalPrice || reservation.price || 0
                );
                dailyRate =
                  reservation.type === 'dayUse'
                    ? totalAmount
                    : totalAmount / nights;
              } else {
                console.warn(
                  'Invalid dates for assigned reservation:',
                  reservation
                );
              }

              integratedTable.push({
                날짜: selectedDateStr,
                객실타입: roomType.roomInfo,
                객실번호: roomNumber,
                상태: '점유',
                예약ID: reservation._id || reservation.id || '-',
                고객명: reservation.customerName || '정보 없음',
                '체크인-체크아웃': `${format(
                  checkInDate,
                  'yyyy-MM-dd HH:mm'
                )} - ${format(checkOutDate, 'yyyy-MM-dd HH:mm')}`,
                '당일 1박 금액': Math.round(dailyRate),
                '전체 금액': totalAmount,
                결제방법:
                  reservation.siteName && reservation.siteName !== '현장예약'
                    ? 'OTA'
                    : reservation.paymentMethod || 'Pending',
                예약유형:
                  reservation.siteName === '현장예약'
                    ? reservation.type === 'stay'
                      ? '현장숙박'
                      : '현장대실'
                    : reservation.siteName || '기타',
                숙박타입: reservation.type === 'dayUse' ? '대실' : '숙박',
              });
            }
          }

          // 퇴실된 예약 처리
          if (isCheckedOut) {
            const reservation = availabilityData.checkedOutReservations.find(
              (res) => res.roomNumber === roomNumber
            );
            if (reservation) {
              const checkInDate = new Date(reservation.checkIn);
              const checkOutDate = new Date(reservation.checkOut);
              let nights = 1;
              let dailyRate = 0;
              let totalAmount = 0;
              if (
                !isNaN(checkInDate.getTime()) &&
                !isNaN(checkOutDate.getTime())
              ) {
                nights = Math.max(
                  1,
                  Math.ceil(
                    (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)
                  )
                );
                totalAmount = Number(
                  reservation.totalPrice || reservation.price || 0
                );
                dailyRate =
                  reservation.type === 'dayUse'
                    ? totalAmount
                    : totalAmount / nights;
              } else {
                console.warn(
                  'Invalid dates for checked out reservation:',
                  reservation
                );
              }

              integratedTable.push({
                날짜: selectedDateStr,
                객실타입: roomType.roomInfo,
                객실번호: roomNumber,
                상태: '퇴실',
                예약ID: reservation._id || reservation.id || '-',
                고객명: reservation.customerName || '정보 없음',
                '체크인-체크아웃': `${format(
                  checkInDate,
                  'yyyy-MM-dd HH:mm'
                )} - ${format(checkOutDate, 'yyyy-MM-dd HH:mm')}`,
                '당일 1박 금액': Math.round(dailyRate),
                '전체 금액': totalAmount,
                결제방법:
                  reservation.siteName && reservation.siteName !== '현장예약'
                    ? 'OTA'
                    : reservation.paymentMethod || 'Pending',
                예약유형:
                  reservation.siteName === '현장예약'
                    ? reservation.type === 'stay'
                      ? '현장숙박'
                      : '현장대실'
                    : reservation.siteName || '기타',
                숙박타입: reservation.type === 'dayUse' ? '대실' : '숙박',
              });
            }
          }

          // 점유도 퇴실도 아닌 경우 (빈방)
          if (!isAssigned && !isCheckedOut) {
            integratedTable.push({
              날짜: selectedDateStr,
              객실타입: roomType.roomInfo,
              객실번호: roomNumber,
              상태: '빈방',
              예약ID: '-',
              고객명: '-',
              '체크인-체크아웃': '-',
              '당일 1박 금액': 0,
              '전체 금액': 0,
              결제방법: '-',
              예약유형: '-',
              숙박타입: '-',
            });
          }
        });
      });
      // 미배정 예약 추가
      const unassignedData = availability[selectedDateStr]?.['unassigned'] || {
        count: 0,
        checkedOutCount: 0,
        reservations: [],
        checkedOutReservations: [],
      };
      integratedTable.push({
        날짜: selectedDateStr,
        객실타입: '미배정',
        객실번호: '-',
        상태: `미배정 (${unassignedData.count}건)`,
        예약ID: '-',
        고객명: '-',
        '체크인-체크아웃': '-',
        '당일 1박 금액': 0,
        '전체 금액': 0,
        결제방법: '-',
        예약유형: '-',
        숙박타입: '-',
      });
      integratedTable.push({
        날짜: selectedDateStr,
        객실타입: '미배정(퇴실)',
        객실번호: '-',
        상태: `미배정 퇴실 (${unassignedData.checkedOutCount}건)`,
        예약ID: '-',
        고객명: '-',
        '체크인-체크아웃': '-',
        '당일 1박 금액': 0,
        '전체 금액': 0,
        결제방법: '-',
        예약유형: '-',
        숙박타입: '-',
      });

      // 합계 계산 (미배정 및 미배정(퇴실) 행 제외)
      const dailyTotal = integratedTable
        .filter((row) => !row.객실타입.startsWith('미배정'))
        .reduce((sum, row) => sum + (row['당일 1박 금액'] || 0), 0);
      const overallTotal = integratedTable
        .filter((row) => !row.객실타입.startsWith('미배정'))
        .reduce((sum, row) => sum + (row['전체 금액'] || 0), 0);

      // 합계 행 추가
      integratedTable.push({
        날짜: selectedDateStr,
        객실타입: '합계',
        객실번호: '-',
        상태: '-',
        예약ID: '-',
        고객명: '-',
        '체크인-체크아웃': '-',
        '당일 1박 금액': dailyTotal,
        '전체 금액': overallTotal,
        결제방법: '-',
        예약유형: '-',
        숙박타입: '-',
      });

      // 통합 테이블 출력
      console.log(`[통합 점유 상황] ${selectedDateStr}의 객실별 점유 상황:`);
      console.table(integratedTable);
      // 매출 계산
      reservations.forEach((res) => {
        const checkInDate = new Date(res.checkIn);
        const checkOutDate = new Date(res.checkOut);
        if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()))
          return;

        const nights = Math.max(
          1,
          Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
        );

        const dailyRate =
          res.type === 'dayUse'
            ? res.totalPrice || res.price || 0
            : res.nightlyRates?.[0]?.rate ??
              (res.totalPrice || res.price || 0) / nights;

        const paymentMethod =
          res.siteName && res.siteName !== '현장예약'
            ? 'OTA'
            : res.paymentMethod || 'Pending';
        const siteInfo =
          res.siteName === '현장예약'
            ? res.type === 'stay'
              ? '현장숙박'
              : '현장대실'
            : res.siteName || '기타';

        const amount = res.type === 'dayUse' ? dailyRate : dailyRate * nights;

        const updateDailyTotals = (dayIndex) => {
          dailyTotals[dayIndex].Total += amount;
          dailyTotals[dayIndex][paymentMethod] += amount;
          if (siteInfo === '현장숙박' || siteInfo === '현장대실') {
            dailyTotals[dayIndex][siteInfo] += amount;
          }

          const dateStr = format(addDays(monthStart, dayIndex), 'yyyy-MM-dd');
          if (!dailyBreakdownDetails[dateStr])
            dailyBreakdownDetails[dateStr] = [];
          dailyBreakdownDetails[dateStr].push({
            reservationId: res._id,
            type: res.type,
            date: dateStr,
            amount,
            dailyRate,
            paymentMethod,
            siteInfo,
            roomNumber: res.roomNumber || '미배정',
            roomInfo: res.roomInfo || 'Standard',
            checkIn: res.checkIn,
            checkOut: res.checkOut,
            nights: res.type === 'dayUse' ? 0 : nights,
            customerName: res.customerName || '정보 없음',
          });
        };

        if (checkInDate >= monthStart && checkInDate <= monthEnd) {
          const dayIndex = differenceInCalendarDays(
            startOfDay(checkInDate),
            monthStart
          );
          if (dayIndex >= 0 && dayIndex < totalDays) {
            updateDailyTotals(dayIndex);
          }
        }
      });

      const monthlyTotal = dailyTotals.reduce((sum, d) => sum + d.Total, 0);
      const monthlyPaymentTotals = dailyTotals.reduce(
        (acc, day) => {
          acc.Cash += day.Cash;
          acc.Card += day.Card;
          acc.OTA += day.OTA;
          acc.Pending += day.Pending;
          return acc;
        },
        { Cash: 0, Card: 0, OTA: 0, Pending: 0 }
      );
      const monthlyTypeTotals = dailyTotals.reduce(
        (acc, day) => {
          acc.현장숙박 += day.현장숙박;
          acc.현장대실 += day.현장대실;
          return acc;
        },
        { 현장숙박: 0, 현장대실: 0 }
      );

      // 매출 요약 출력
      const selectedDetails = dailyBreakdownDetails[selectedDateStr] || [];
      const uniqueDetails = [];
      const seenIds = new Set();
      selectedDetails.forEach((detail) => {
        if (!seenIds.has(detail.reservationId)) {
          seenIds.add(detail.reservationId);
          uniqueDetails.push(detail);
        }
      });

      const totalAmount = uniqueDetails.reduce(
        (sum, detail) => sum + detail.amount,
        0
      );
      console.log(`[총합계] ${selectedDateStr}의 총 매출: ${totalAmount}원`);

      const summary = uniqueDetails.reduce(
        (acc, detail) => {
          if (detail.siteInfo === '현장숙박') {
            acc.현장숙박 += detail.amount;
          } else if (detail.siteInfo === '현장대실') {
            acc.현장대실 += detail.amount;
          } else if (availableOTAs.includes(detail.siteInfo)) {
            acc.OTA[detail.siteInfo] =
              (acc.OTA[detail.siteInfo] || 0) + detail.amount;
          }

          if (detail.paymentMethod === 'Cash') {
            acc.paymentTotals.Cash += detail.amount;
          } else if (detail.paymentMethod === 'Card') {
            acc.paymentTotals.Card += detail.amount;
          } else if (detail.paymentMethod === 'OTA') {
            acc.paymentTotals.OTA += detail.amount;
          } else {
            acc.paymentTotals.Pending += detail.amount;
          }

          return acc;
        },
        {
          현장숙박: 0,
          현장대실: 0,
          OTA: {},
          paymentTotals: { Cash: 0, Card: 0, OTA: 0, Pending: 0 },
        }
      );

      console.log(`[매출 요약] ${selectedDateStr}:`);
      console.table({
        현장숙박: summary.현장숙박,
        현장대실: summary.현장대실,
        ...summary.OTA,
        현금합계: summary.paymentTotals.Cash,
        카드합계: summary.paymentTotals.Card,
        OTA합계: summary.paymentTotals.OTA,
        미결제합계: summary.paymentTotals.Pending,
      });

      return {
        dailyTotals,
        monthlyTotal,
        monthlyPaymentTotals,
        monthlyTypeTotals,
        integratedTable,
      };
    },
    [finalRoomTypes, hotelSettings]
  );

  const navigate = useNavigate();

  const [isMonthlyView, setIsMonthlyView] = useState(false);

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
      // originalConsoleLog(...args);
    };
    return () => {
      console.log = originalConsoleLog;
    };
  }, [logMessage]);

  // 로그 뷰어 열기/닫기 함수
  const openLogViewer = () => setIsLogViewerOpen(true);
  const closeLogViewer = () => setIsLogViewerOpen(false);

  useEffect(() => {
    if (
      allReservations.length > 0 &&
      selectedDate &&
      finalRoomTypes &&
      hotelSettings
    ) {
      const {
        dailyTotals,
        monthlyTotal,
        monthlyPaymentTotals,
        monthlyTypeTotals,
      } = buildMonthlyDailyBreakdown(allReservations, selectedDate);

      setMonthlyDailyBreakdown(dailyTotals);

      setMonthlyTotal({
        total: monthlyTotal,
        paymentTotals: monthlyPaymentTotals,
        typeTotals: monthlyTypeTotals,
      });
      console.log('Monthly Daily Breakdown:', dailyTotals);
      console.log('Monthly Total:', monthlyTotal);
      console.log('Monthly Payment Totals:', monthlyPaymentTotals);
      console.log('Monthly Type Totals:', monthlyTypeTotals);
    } else {
      setMonthlyDailyBreakdown(
        Array(31)
          .fill(0)
          .map(() => ({
            Total: 0,
            Cash: 0,
            Card: 0,
            OTA: 0,
            Pending: 0,
            현장숙박: 0,
            현장대실: 0,
          }))
      );
      setMonthlyTotal({
        total: 0,
        paymentTotals: { Cash: 0, Card: 0, OTA: 0, Pending: 0 },
        typeTotals: { 현장숙박: 0, 현장대실: 0 },
      });
    }
  }, [
    allReservations,
    selectedDate,
    buildMonthlyDailyBreakdown,
    finalRoomTypes,
    hotelSettings,
  ]);

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

  // 일별 매출 계산을 별도의 함수로 분리
  const calculateDailyTotal = (
    filtered,
    selectedDateString,
    allReservations
  ) => {
    let dailyTotalAmount = 0;
    let dailyPaymentTotals = { Cash: 0, Card: 0, OTA: 0, Pending: 0 };
    let dailyTypeTotals = { 현장숙박: 0, 현장대실: 0 };
    const breakdown = [];

    // 퇴실 처리된 예약도 포함하도록 allReservations 사용
    const relevantReservations = allReservations.filter((reservation) => {
      if (!reservation || !reservation.checkIn || !reservation.checkOut) {
        console.warn('Invalid reservation data:', reservation);
        return false;
      }
      const checkInDate = new Date(reservation.checkIn);
      const checkOutDate = new Date(reservation.checkOut);
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        console.warn('Invalid dates for reservation:', reservation);
        return false;
      }
      const checkInDateOnly = startOfDay(checkInDate);
      const checkOutDateOnly = startOfDay(checkOutDate);
      if (reservation.type === 'dayUse') {
        // 대실 예약: 체크인 날짜가 선택된 날짜와 일치하는지 확인
        return format(checkInDateOnly, 'yyyy-MM-dd') === selectedDateString;
      } else {
        // 숙박 예약: 선택된 날짜가 체크인과 체크아웃 사이에 있는지 확인
        const isIncluded =
          selectedDateString >= format(checkInDateOnly, 'yyyy-MM-dd') &&
          selectedDateString < format(checkOutDateOnly, 'yyyy-MM-dd');
        const isSameDayStay =
          format(checkInDateOnly, 'yyyy-MM-dd') ===
            format(checkOutDateOnly, 'yyyy-MM-dd') &&
          selectedDateString === format(checkInDateOnly, 'yyyy-MM-dd');
        return isIncluded || isSameDayStay;
      }
    });

    relevantReservations.forEach((reservation) => {
      const checkInDate = new Date(reservation.checkIn);
      const checkOutDate = new Date(reservation.checkOut);
      const nights = Math.max(
        1,
        Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
      );

      const paymentMethod =
        reservation.siteName && reservation.siteName !== '현장예약'
          ? 'OTA'
          : reservation.paymentMethod || 'Pending';
      const siteInfo =
        reservation.siteName === '현장예약'
          ? reservation.type === 'stay'
            ? '현장숙박'
            : '현장대실'
          : '기타';

      if (reservation.type === 'dayUse') {
        const amount = Number(reservation.totalPrice || reservation.price || 0);
        if (isNaN(amount)) {
          console.warn(
            `Invalid amount for dayUse reservation ${reservation._id}:`,
            amount
          );
          return;
        }
        // 대실 예약은 이미 체크인 날짜 기준으로 필터링되었으므로 추가 조건 불필요
        dailyTotalAmount += amount;
        dailyPaymentTotals[paymentMethod] += amount;
        if (siteInfo === '현장숙박' || siteInfo === '현장대실') {
          dailyTypeTotals[siteInfo] += amount;
        }
        breakdown.push(amount);
      } else {
        const totalAmount = Number(
          (reservation.nightlyRates?.[0]?.rate || reservation.totalPrice || 0) *
            nights
        );
        if (isNaN(totalAmount)) {
          console.warn(
            `Invalid totalAmount for stay reservation ${reservation._id}:`,
            totalAmount
          );
          return;
        }
        const dailyRate = totalAmount / nights;
        if (isNaN(dailyRate)) {
          console.warn(
            `Invalid dailyRate for stay reservation ${reservation._id}:`,
            dailyRate
          );
          return;
        }

        let currentDate = startOfDay(checkInDate);
        const endDate = startOfDay(checkOutDate);

        while (currentDate < endDate) {
          const currentDateString = format(currentDate, 'yyyy-MM-dd');
          if (currentDateString === selectedDateString) {
            dailyTotalAmount += dailyRate;
            dailyPaymentTotals[paymentMethod] += dailyRate;
            if (siteInfo === '현장숙박' || siteInfo === '현장대실') {
              dailyTypeTotals[siteInfo] += dailyRate;
            }
            breakdown.push(dailyRate);
          }
          currentDate = addDays(currentDate, 1);
        }
      }
    });

    return {
      total: dailyTotalAmount,
      paymentTotals: dailyPaymentTotals,
      typeTotals: dailyTypeTotals,
      dailyBreakdown: breakdown,
    };
  };

  // 월별 매출 계산을 별도의 함수로 분리
  const calculateMonthlyTotal = (reservationsData, date) => {
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
    let monthlyPaymentTotals = { Cash: 0, Card: 0, OTA: 0, Pending: 0 };
    let monthlyTypeTotals = { 현장숙박: 0, 현장대실: 0 };
    let totalRoomsSold = 0;

    monthlyReservations.forEach((reservation) => {
      const checkInDate = new Date(reservation.checkIn);
      const checkOutDate = new Date(reservation.checkOut);
      const nights = Math.max(
        1,
        Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
      );

      const paymentMethod =
        reservation.siteName && reservation.siteName !== '현장예약'
          ? 'OTA'
          : reservation.paymentMethod || 'Pending';
      const siteInfo =
        reservation.siteName === '현장예약'
          ? reservation.type === 'stay'
            ? '현장숙박'
            : '현장대실'
          : '기타';

      if (reservation.type === 'dayUse') {
        const amount = Number(reservation.totalPrice || reservation.price || 0);
        if (isNaN(amount)) {
          console.warn(
            `Invalid amount for dayUse reservation ${reservation._id}:`,
            amount
          );
          return;
        }
        if (checkInDate >= firstDayOfMonth && checkInDate <= lastDayOfMonth) {
          monthlyTotalAmount += amount;
          monthlyPaymentTotals[paymentMethod] += amount;
          if (siteInfo === '현장숙박' || siteInfo === '현장대실') {
            monthlyTypeTotals[siteInfo] += amount;
          }
        }
      } else {
        const totalAmount = Number(
          (reservation.nightlyRates?.[0]?.rate || reservation.totalPrice || 0) *
            nights
        );
        if (isNaN(totalAmount)) {
          console.warn(
            `Invalid totalAmount for stay reservation ${reservation._id}:`,
            totalAmount
          );
          return;
        }
        const dailyRate = totalAmount / nights;
        if (isNaN(dailyRate)) {
          console.warn(
            `Invalid dailyRate for stay reservation ${reservation._id}:`,
            dailyRate
          );
          return;
        }

        let currentDate = startOfDay(checkInDate);
        const endDate = startOfDay(checkOutDate);

        while (currentDate < endDate) {
          if (currentDate >= firstDayOfMonth && currentDate <= lastDayOfMonth) {
            monthlyTotalAmount += dailyRate;
            monthlyPaymentTotals[paymentMethod] += dailyRate;
            if (siteInfo === '현장숙박' || siteInfo === '현장대실') {
              monthlyTypeTotals[siteInfo] += dailyRate;
            }
          }
          currentDate = addDays(currentDate, 1);
        }
      }

      if (reservation.nightlyRates) {
        totalRoomsSold += reservation.nightlyRates.filter((nightlyRate) => {
          const rateDate = new Date(nightlyRate.date);
          return rateDate >= firstDayOfMonth && rateDate <= lastDayOfMonth;
        }).length;
      } else {
        totalRoomsSold += 1;
      }
    });

    monthlyTotalAmount = Math.max(0, Math.round(monthlyTotalAmount));
    return {
      total: monthlyTotalAmount,
      paymentTotals: monthlyPaymentTotals,
      typeTotals: monthlyTypeTotals,
      totalRoomsSold,
    };
  };

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
        return (isIncluded || isSameDayStay) && !reservation.manuallyCheckedOut;
      })
      .filter((res) => res !== null);

    setActiveReservations(filtered);

    // 일별 매출 계산
    const dailyTotalObj = calculateDailyTotal(
      filtered,
      selectedDateString,
      reservationsData
    );

    console.log(
      `[filterReservationsByDate] Calculated dailyTotal for ${selectedDateString}:`,
      dailyTotalObj
    );

    setDailyTotal(dailyTotalObj);
    setDailyBreakdown(dailyTotalObj.dailyBreakdown);

    // 월별 매출 계산
    const monthlyTotalObj = calculateMonthlyTotal(reservationsData, date);

    setMonthlyTotal({
      total: monthlyTotalObj.total,
      paymentTotals: monthlyTotalObj.paymentTotals,
      typeTotals: monthlyTotalObj.typeTotals,
    });

    setMonthlySoldRooms(monthlyTotalObj.totalRoomsSold);
    const avgPrice =
      monthlyTotalObj.totalRoomsSold > 0
        ? Math.floor(monthlyTotalObj.total / monthlyTotalObj.totalRoomsSold)
        : 0;
    setAvgMonthlyRoomPrice(avgPrice);
    setRoomsSold(filtered.length);
    setLoadedReservations(filtered.map((res) => res._id));
    return filtered;
  }, []);

  const [monthlyDailyBreakdown, setMonthlyDailyBreakdown] = useState([]);

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
      let nightlyRates = [];
      const checkInDateOnly = startOfDay(checkInDate);
      const checkOutDateOnly = startOfDay(checkOutDate);
      const days = Math.floor(
        (checkOutDateOnly - checkInDateOnly) / (1000 * 60 * 60 * 24)
      );

      const isOTA = isOtaReservation(res);
      const type = res.type || 'stay';
      // duration 계산: 대실 예약의 경우 체크인과 체크아웃 시간 차이로 설정
      let duration = null;
      if (type === 'dayUse') {
        const timeDiff = (checkOutDate - checkInDate) / (1000 * 60 * 60); // 시간 단위로 계산
        duration = Math.round(timeDiff); // 소수점 반올림
        if (duration <= 0) duration = 1; // 최소 1시간
      }
      const nights = type === 'dayUse' ? 1 : days > 0 ? days : 1;

      if (!isOTA && totalPrice <= 0) {
        const roomType = matchRoomType(res.roomInfo);
        const basePrice = roomType?.price || 0;
        if (type === 'dayUse' && duration) {
          totalPrice = (basePrice / 2) * duration;
        } else {
          totalPrice = basePrice;
        }
        isDefaultPriceFlag = false;
      }

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
        type: type,
        duration: duration,
        reservationNo: res.reservationNo || res._id,
        nightlyRates: nightlyRates.length > 0 ? nightlyRates : undefined,
        isDefaultPrice: isDefaultPriceFlag,
        totalPrice: type === 'dayUse' ? totalPrice : finalTotalPrice,
        checkIn: res.checkIn,
        checkOut: res.checkOut,
        paymentMethod: res.paymentMethod || 'Pending',
        parsedCheckInDate: checkInDate,
        parsedCheckOutDate: checkOutDate,
      };
    },
    [calculatePerNightPrice]
  );

  const handleSelectUnassignedReservation = (reservation) => {
    if (!reservation.checkIn) {
      console.warn(`No checkIn date for reservation ${reservation._id}`);
      return;
    }
    const checkInDate = new Date(reservation.checkIn);
    if (isNaN(checkInDate.getTime())) {
      console.warn(
        `Invalid checkIn date for reservation ${reservation._id}:`,
        reservation.checkIn
      );
      return;
    }
    setSelectedDate(checkInDate);
    filterReservationsByDate(allReservations, checkInDate);
  };

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
          // console.log('Initial OTA Toggles:', initialOTAToggles);
          setOtaToggles(initialOTAToggles);

          return updatedSettings;
        } else {
          // console.warn(
          //   'No settings returned from fetchHotelSettings, using defaults'
          // );
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

  // App.js
  const loadReservations = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      const data = await fetchReservations(hotelId, {
        startDate: format(monthStart, 'yyyy-MM-dd'),
        endDate: format(monthEnd, 'yyyy-MM-dd'),
      });
      console.log('Raw data from fetchReservations:', data); // 백엔드 응답 로그
      const processedReservations = data
        .map(processReservation)
        .filter((r) => r);
      console.log('Processed reservations:', processedReservations); // 처리된 데이터 로그
      if (processedReservations.length === 0) {
        console.warn('No reservations found for the selected month:', {
          startDate: format(monthStart, 'yyyy-MM-dd'),
          endDate: format(monthEnd, 'yyyy-MM-dd'),
        });
      }
      setAllReservations(processedReservations);
      filterReservationsByDate(processedReservations, selectedDate);
    } catch (error) {
      console.error('Failed to load reservations:', error);
    }
    setLoading(false);
  }, [filterReservationsByDate, selectedDate, hotelId, processReservation]);

  useEffect(() => {
    if (allReservations.length > 0 && selectedDate) {
      const {
        dailyTotals,
        monthlyTotal,
        monthlyPaymentTotals,
        monthlyTypeTotals,
      } = buildMonthlyDailyBreakdown(allReservations, selectedDate);

      // monthlyDailyBreakdown에는 오직 dailyTotals(배열)만 담는다
      setMonthlyDailyBreakdown(dailyTotals);

      // 나머지 값들은 monthlyTotal 상태에 따로 보관
      setMonthlyTotal({
        total: monthlyTotal,
        paymentTotals: monthlyPaymentTotals,
        typeTotals: monthlyTypeTotals,
      });

      console.log('Monthly Daily Breakdown:', dailyTotals);
      console.log('Monthly Total:', monthlyTotal);
      console.log('Monthly Payment Totals:', monthlyPaymentTotals);
      console.log('Monthly Type Totals:', monthlyTypeTotals);
    } else {
      // 초기값(빈 배열) 세팅
      setMonthlyDailyBreakdown(
        Array(31)
          .fill(0)
          .map(() => ({
            Total: 0,
            Cash: 0,
            Card: 0,
            OTA: 0,
            Pending: 0,
            현장숙박: 0,
            현장대실: 0,
          }))
      );
      setMonthlyTotal({
        total: 0,
        paymentTotals: { Cash: 0, Card: 0, OTA: 0, Pending: 0 },
        typeTotals: { 현장숙박: 0, 현장대실: 0 },
      });
    }
  }, [allReservations, selectedDate, buildMonthlyDailyBreakdown]);

  useEffect(() => {
    if (allReservations.length > 0 && selectedDate) {
      const { labels, dailySalesByOTA } = buildDailySalesByOTA(
        allReservations,
        selectedDate
      );
      console.log('Labels for OTA:', labels);
      console.log('Daily Sales by OTA:', dailySalesByOTA);
      setLabelsForOTA(labels);
      setDailySalesByOTA(dailySalesByOTA);
    }
  }, [allReservations, selectedDate]);

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
    async (
      reservationId,
      newRoomNumber,
      newRoomInfo,
      currentPrice,
      selectedDate
    ) => {
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

        const oldRoom = currentReservation.roomNumber || '미배정';

        const isOTA = availableOTAs.includes(currentReservation.siteName);
        const checkInTime = hotelSettings?.checkInTime || '16:00';
        const checkOutTime = hotelSettings?.checkOutTime || '11:00';

        const updatedData = {
          roomNumber: newRoomNumber,
          roomInfo: newRoomInfo,
          price: currentPrice || currentReservation.totalPrice,
          checkIn: isOTA
            ? currentReservation.checkIn
            : currentReservation.type === 'dayUse'
            ? currentReservation.checkIn
            : `${format(
                new Date(currentReservation.checkIn),
                'yyyy-MM-dd'
              )}T${checkInTime}:00+09:00`,
          checkOut: isOTA
            ? currentReservation.checkOut
            : currentReservation.type === 'dayUse'
            ? currentReservation.checkOut
            : `${format(
                new Date(currentReservation.checkOut),
                'yyyy-MM-dd'
              )}T${checkOutTime}:00+09:00`,
          selectedDate: selectedDate.toISOString(),
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
      filterReservationsByDate,
      loadReservations,
      allReservations,
      hotelSettings,
    ] // selectedDate 제거
  );

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

      try {
        // 수정 시작 시 loadedReservations에 예약 ID 추가 (점선 표시)
        setLoadedReservations((prev) => [...prev, reservationId]);

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

        const newCheckIn = updatedData.checkIn || currentReservation.checkIn;
        const newCheckOut = updatedData.checkOut || currentReservation.checkOut;
        const newParsedCheckInDate = parseDate(newCheckIn);
        const newParsedCheckOutDate = parseDate(newCheckOut);

        const response = await updateReservation(
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
              '미결제',
            isCheckedIn:
              updatedData.isCheckedIn ?? currentReservation.isCheckedIn,
            isCheckedOut:
              updatedData.isCheckedOut ?? currentReservation.isCheckedOut,
            manuallyCheckedOut:
              updatedData.manuallyCheckedOut ??
              currentReservation.manuallyCheckedOut,
          },
          hotelId
        );

        console.log(
          `[handlePartialUpdate] Backend response for reservation ${reservationId}:`,
          response
        );

        setUpdatedReservationId(reservationId);
        setTimeout(() => setUpdatedReservationId(null), 10000);
        console.log(changeLog);
        logMessage(changeLog);

        // 상태 업데이트 및 수정 완료 처리
        setAllReservations((prev) => {
          const updated = prev.map((res) =>
            res._id === reservationId ? { ...res, ...updatedData } : res
          );
          filterReservationsByDate(updated, selectedDate);
          // 수정 완료 후 loadedReservations에서 제거 (실선으로 전환)
          setLoadedReservations((prev) =>
            prev.filter((id) => id !== reservationId)
          );
          return updated;
        });

        // 퇴실 처리 시 매출 반영 (대실만 해당)
        if (
          updatedData.isCheckedOut &&
          updatedData.manuallyCheckedOut &&
          currentReservation.type === 'dayUse'
        ) {
          const checkOutDate = new Date(
            updatedData.checkOut || currentReservation.checkOut
          );
          const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
          if (format(checkOutDate, 'yyyy-MM-dd') === selectedDateString) {
            const totalPrice =
              currentReservation.totalPrice || currentReservation.price || 0;
            setDailyTotal((prev) => {
              const newTotal = prev.total + totalPrice;
              return {
                ...prev,
                total: newTotal,
              };
            });
            console.log(
              `[handlePartialUpdate] Added to dailyTotal: ${totalPrice}, New dailyTotal: ${
                dailyTotal.total + totalPrice
              }`
            );
          }
        }
      } catch (error) {
        console.error(`예약 ${reservationId} 부분 업데이트 실패:`, error);
        alert('예약 수정에 실패했습니다. 다시 시도해주세요.');
        await loadReservations();
      } finally {
        setLoadedReservations((prev) =>
          prev.filter((id) => id !== reservationId)
        );
      }
    },
    [
      allReservations,
      hotelId,
      loadReservations,
      logMessage,
      filterReservationsByDate,
      selectedDate,
      dailyTotal,
    ]
  );

  const handleEdit = useCallback(
    async (reservationId, updatedData, done) => {
      const currentReservation = allReservations.find(
        (res) => res._id === reservationId
      );
      if (!currentReservation) {
        if (typeof done === 'function') {
          done();
        }
        return;
      }

      try {
        const isOTA = availableOTAs.includes(currentReservation.siteName);
        if (isOTA && !updatedData.manualAssignment) {
          updatedData.roomNumber = '';
          updatedData.price = currentReservation.price;
        }

        // 대원칙 3: 날짜 변동 시 충돌 검사 수행
        const hasDateChange =
          updatedData.checkIn !== currentReservation.checkIn ||
          updatedData.checkOut !== currentReservation.checkOut;
        const roomChange =
          updatedData.roomNumber !== currentReservation.roomNumber;

        if (hasDateChange && updatedData.roomNumber) {
          // 날짜 변경 시 충돌 검사
          const { canMove, conflictDays } = isRoomAvailableForPeriod(
            updatedData.roomNumber,
            updatedData.roomInfo.toLowerCase(),
            updatedData.checkIn,
            updatedData.checkOut,
            allReservations,
            reservationId
          );
          if (!canMove) {
            throw new Error(
              `선택한 날짜 범위에서 충돌이 발생했습니다: ${conflictDays.join(
                ', '
              )}`
            );
          }
        }

        if (roomChange) {
          await handleRoomChangeAndSync(
            reservationId,
            updatedData.roomNumber,
            updatedData.roomInfo || currentReservation.roomInfo,
            updatedData.price || currentReservation.totalPrice
          );
        }

        if (!updatedData.checkOut) {
          console.warn('checkOut is null, setting default value');
          const baseDate = updatedData.checkIn
            ? new Date(updatedData.checkIn)
            : new Date();
          updatedData.checkOut = format(
            addHours(baseDate, 3),
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

        if (currentReservation.type === 'dayUse' && updatedData.durationHours) {
          const roomType =
            matchRoomType(currentReservation.roomInfo) || finalRoomTypes[0];
          const basePricePerHour = (roomType?.price || 0) / 2;
          const priceIncreasePerHour = 10000;
          const newDurationHours = parseInt(updatedData.durationHours, 10) || 3;
          const oldDurationHours = currentReservation.durationHours || 3;

          const newBasePrice = basePricePerHour * newDurationHours;
          const oldBasePrice = basePricePerHour * oldDurationHours;
          const priceDifference =
            newBasePrice -
            oldBasePrice +
            priceIncreasePerHour * (newDurationHours - oldDurationHours);
          updatedData.price = String(
            parseInt(currentReservation.price || newBasePrice) + priceDifference
          );
          updatedData.totalPrice = updatedData.price;

          updatedData.checkOut = format(
            addHours(new Date(updatedData.checkIn), newDurationHours),
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

        setGuestFormData(updatedData);
        setShowGuestForm(true);

        if (typeof done === 'function') {
          setGuestFormData((prev) => ({
            ...prev,
            onComplete: done,
          }));
        }
      } catch (error) {
        console.error(`Failed to update reservation ${reservationId}:`, error);
        alert(
          error.status === 403
            ? 'CSRF 토큰 오류: 페이지를 새로고침 후 다시 시도해주세요.'
            : error.message || '예약 수정에 실패했습니다.'
        );
        await loadReservations();
        if (typeof done === 'function') {
          done();
        }
      }
    },
    [allReservations, loadReservations, handleRoomChangeAndSync, finalRoomTypes]
  );

  const socketRef = useRef(null);
  const [isJoinedHotel, setIsJoinedHotel] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false); // 연결 시도 상태 추가

  // 이벤트 핸들러 정의 (useCallback으로 최적화)
  const handleReservationCreated = useCallback(
    (data, callback) => {
      console.log(
        `Received reservationCreated: ${data.reservation?._id || 'unknown'}`
      );
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
          error: isJoinedHotel
            ? 'Invalid reservation data'
            : 'Not joined to hotel room',
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
            console.log(
              `Duplicate update skipped for ${updatedReservation._id}`
            );
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
          error: isJoinedHotel
            ? 'Invalid reservation data'
            : 'Not joined to hotel room',
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
      setDailyTotal({
        total: 0,
        paymentTotals: { Cash: 0, Card: 0, OTA: 0, Pending: 0 },
        typeTotals: { 현장숙박: 0, 현장대실: 0 },
        dailyBreakdown: [],
      });
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
              console.warn(
                'Failed to join hotel room:',
                ack?.error || 'No ack'
              );
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
              console.warn(
                'Failed to rejoin hotel room:',
                ack?.error || 'No ack'
              );
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
            socketRef.current.off(
              'reservationCreated',
              handleReservationCreated
            );
            socketRef.current.off(
              'reservationUpdated',
              handleReservationUpdated
            );
            socketRef.current.off(
              'reservationDeleted',
              handleReservationDeleted
            );
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
      // console.log('Moved to Next Day:', newDate);
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
    let newReservationId = null;
  
    try {
      const reservationData = {
        siteName: '현장예약',
        reservations: [
          {
            ...data,
            type: data.type || 'stay',
            duration: data.type === 'dayUse' ? data.durationHours || 3 : undefined,
            isCheckedIn: data.isCheckedIn || false,
            isCheckedOut: data.isCheckedOut || false,
            manuallyCheckedOut: data.manuallyCheckedOut || false,
          },
        ],
        hotelId,
        selectedDate: selectedDate.toISOString(),
      };
  
      // OTA 예약의 경우 기존 DB의 duration 값을 유지
      if (reservationId && data.siteName !== '현장예약') {
        const existingReservation = allReservations.find(
          (res) => res._id === reservationId
        );
        if (existingReservation && existingReservation.type === 'dayUse') {
          reservationData.reservations[0].duration = existingReservation.duration;
        }
      }
  
      if (reservationId) {
        console.log(
          '[handleFormSave] Updating reservation with data:',
          reservationData.reservations[0],
          'selectedDate:',
          reservationData.selectedDate
        );
        await updateReservation(
          reservationId,
          {
            ...reservationData.reservations[0],
            hotelId,
            selectedDate: reservationData.selectedDate,
          },
          hotelId
        );
        console.log('[handleFormSave] Update successful for reservation:', reservationId);
      } else {
        let response = await saveOnSiteReservation(reservationData);
        console.log('[handleFormSave] API Response:', response);
        if (!response) {
          console.warn(
            '[handleFormSave] No response from saveOnSiteReservation, assuming success.'
          );
          response = {
            createdReservationIds: [data.reservationNo || `${Date.now()}`],
          };
        }
        if (
          response.createdReservationIds &&
          Array.isArray(response.createdReservationIds)
        ) {
          newReservationId = response.createdReservationIds[0];
        } else if (
          response.message &&
          response.message.includes('successfully')
        ) {
          newReservationId = data.reservationNo || `${Date.now()}`;
          console.warn('[handleFormSave] Using fallback ID:', newReservationId);
        } else {
          throw new Error('응답에서 createdReservationIds를 찾을 수 없습니다.');
        }
  
        // 새 예약을 즉시 allReservations에 추가 (함수형 업데이트로 최신 상태 보장)
        const processedReservation = processReservation({
          _id: newReservationId,
          ...reservationData.reservations[0],
        });
        setAllReservations((prev) => [...prev, processedReservation]);
        setNewlyCreatedId(newReservationId);
  
        // 체크인 날짜가 있으면 selectedDate 동기화 및 필터링
        if (data.checkIn) {
          const parsedDate = parseDate(data.checkIn);
          setSelectedDate(parsedDate);
          filterReservationsByDate([...allReservations, processedReservation], parsedDate);
  
          // 카드 요소가 렌더링될 때까지 재시도하며 스크롤 이동
          const attemptHighlight = (attemptsLeft = 5, delay = 200) => {
            const card = document.querySelector(`.room-card[data-id="${newReservationId}"]`);
            if (card) {
              card.classList.add('onsite-created');
              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // 10초 후 강조 효과 제거
              const timeoutId = setTimeout(() => {
                card.classList.remove('onsite-created');
              }, 10000);
              return timeoutId;
            } else if (attemptsLeft > 0) {
              console.warn(`Card not found, retrying (${attemptsLeft} attempts left)`);
              return setTimeout(() => attemptHighlight(attemptsLeft - 1, delay), delay);
            } else {
              console.error(`Failed to find card with data-id="${newReservationId}"`);
            }
          };
          // 200ms 후 시도 시작
          setTimeout(() => attemptHighlight(), 200);
        }
  
        setTimeout(() => setNewlyCreatedId(null), 10000);
      }
  
      setShowGuestForm(false);
      if (data.onComplete && typeof data.onComplete === 'function') data.onComplete();
  
      const idToRemove = reservationId || newReservationId;
      if (idToRemove) {
        console.log(`Removing ${idToRemove} from loadedReservations after save`);
        setLoadedReservations((prev) => prev.filter((id) => id !== idToRemove));
      }
      await loadReservations();
    } catch (error) {
      console.error('[handleFormSave] Error saving reservation:', error);
      alert(
        error.response?.status === 403
          ? 'CSRF 오류: 새로고침 후 시도'
          : error.message || '저장 실패'
      );
      setShowGuestForm(false);
      if (data.onComplete && typeof data.onComplete === 'function') data.onComplete();
      if (reservationId) {
        console.log(`Removing ${reservationId} from loadedReservations due to error`);
        setLoadedReservations((prev) => prev.filter((id) => id !== reservationId));
      }
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
    setDailyTotal({
      total: 0,
      paymentTotals: { Cash: 0, Card: 0, OTA: 0, Pending: 0 },
      typeTotals: { 현장숙박: 0, 현장대실: 0 },
      dailyBreakdown: [],
    });
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
          await api.get('/api/auth/validate', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          // console.log('Initializing auth with hotelId:', storedHotelId);
          setIsAuthenticated(true);
          setHotelId(storedHotelId);
          await loadHotelSettings(storedHotelId);
          await loadReservations();
        } catch (error) {
          // console.error('토큰 유효성 검증 실패:', error);
          if (
            error.response?.status === 401 ||
            error.response?.status === 403
          ) {
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
      } else {
        console.log('저장된 세션이 없습니다. 로그인 해주세요.');
      }
      setIsLoading(false);
    };
    initializeAuth();

    // hotelId가 설정된 후에만 showGuestForm을 열 수 있도록 보장
    if (showGuestForm && !hotelId) {
      console.warn('hotelId is undefined, closing GuestFormModal');
      setShowGuestForm(false);
    }
  }, [loadHotelSettings, loadReservations, navigate, showGuestForm, hotelId]);

  const occupancyRate =
    totalRooms > 0 ? Math.round((roomsSold / totalRooms) * 100) : 0;
  console.log('Calculated occupancyRate in App.js:', occupancyRate);

  // GuestFormModal에 props 전달 확인
  const openOnSiteReservationForm = () => {
    if (!hotelId) {
      console.error('Cannot open reservation form: hotelId is undefined');
      return;
    }
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
      paymentMethod: 'Card',
      specialRequests: '',
      checkIn,
      checkOut,
      _id: null,
      type: 'stay',
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
      paymentMethod: 'Card',
      specialRequests: '',
      checkIn,
      checkOut,
      type: 'stay',
    });
    setShowGuestForm(true);
  };

  const createDayUseReservation = () => {
    const now = new Date();
    const effectiveDate = selectedDate; // selectedDate를 직접 사용

    const checkInDateStr = format(effectiveDate, 'yyyy-MM-dd');
    const customerName = `현장대실:${format(now, 'HH:mm:ss')}`;
    const basePrice = finalRoomTypes[0]?.price || 0;
    const price = Math.floor(basePrice * 0.5);

    const checkIn = `${checkInDateStr}T${format(now, 'HH:mm')}:00+09:00`;
    const checkOut = format(
      addHours(new Date(checkIn), 3), // 기본 3시간
      "yyyy-MM-dd'T'HH:mm:ss+09:00"
    );
    const duration = 3; // 기본 3시간

    setGuestFormData({
      reservationNo: `${uuidv4()}`,
      customerName,
      checkInDate: checkInDateStr, // 명확히 설정
      checkInTime: format(now, 'HH:mm'),
      checkOutDate: format(new Date(checkOut), 'yyyy-MM-dd'),
      checkOutTime: format(new Date(checkOut), 'HH:mm'),
      reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
      roomInfo: finalRoomTypes[0]?.roomInfo || 'Standard',
      price: price.toString(),
      paymentMethod: 'Cash',
      specialRequests: '',
      checkIn,
      checkOut,
      type: 'dayUse',
      durationHours: duration,
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
    const reports = activeReservations.map((reservation) => {
      let pricePerNight;
      if (reservation.nightlyRates && reservation.nightlyRates.length > 0) {
        pricePerNight = reservation.nightlyRates[0].rate;
      } else {
        pricePerNight = reservation.totalPrice || 0;
      }

      const paymentMethod =
        reservation.siteName && reservation.siteName !== '현장예약'
          ? 'OTA'
          : reservation.paymentMethod || 'Pending';
      const siteInfo =
        reservation.siteName === '현장예약'
          ? reservation.type === 'stay'
            ? '현장숙박'
            : '현장대실'
          : reservation.siteName || '기타';

      return {
        reservationId: reservation._id || reservation.reservationNo,
        roomNumber: reservation.roomNumber || '미배정',
        customerName: reservation.customerName || '정보 없음',
        roomInfo: reservation.roomInfo || '정보 없음',
        checkInCheckOut: `${format(
          reservation.parsedCheckInDate,
          'yyyy-MM-dd HH:mm'
        )} ~ ${format(reservation.parsedCheckOutDate, 'yyyy-MM-dd HH:mm')}`,
        price: pricePerNight,
        siteInfo,
        paymentMethod,
      };
    });

    return [
      ...reports,
      {
        reservationId: 'totalSummary',
        roomNumber: '',
        customerName: '합계',
        roomInfo: '',
        checkInCheckOut: '',
        price: 0,
        siteInfo: '합계',
        paymentTotals: dailyTotal.paymentTotals,
        typeTotals: dailyTotal.typeTotals,
      },
    ];
  }, [activeReservations, dailyTotal]);

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

  const onMonthlyView = useCallback(() => {
    navigate('/monthly-calendar');
    setIsMonthlyView(true); // 월간 뷰 상태로 설정
  }, [navigate]);

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
                      onViewLogs={openLogViewer}
                      isMinimalModeEnabled={isMinimalModeEnabled} // 추가
                      onToggleMinimalMode={toggleMinimalMode} // 추가
                      onMonthlyView={onMonthlyView}
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
                      dailySalesReport={dailySalesReport}
                    />
                    <div className="main-content" style={{ flex: '1' }}>
                      {/* 고정 영역으로 미배정 예약 패널 렌더링 */}
                      <UnassignedReservationsPanel
                        reservations={allReservations}
                        onSelectReservation={handleSelectUnassignedReservation}
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
                              onQuickCreateRange={onQuickCreateRange}
                              logs={logs}
                              isLogViewerOpen={isLogViewerOpen} // 로그 뷰어 상태 전달
                              onCloseLogViewer={closeLogViewer} // 로그 뷰어 닫기 함수 전달
                              setDailyTotal={setDailyTotal}
                              allReservations={allReservations}
                              showGuestForm={showGuestForm}
                              isMinimalModeEnabled={isMinimalModeEnabled}
                              toggleMinimalMode={toggleMinimalMode}
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
                            onClose={() => {
                              setShowGuestForm(false);
                              if (guestFormData.onComplete) {
                                guestFormData.onComplete();
                              }
                            }}
                            onSave={handleFormSave}
                            availabilityByDate={guestAvailability}
                            selectedDate={selectedDate} // 추가
                            hotelId={hotelId}
                            setLoadedReservations={setLoadedReservations}
                            setAllReservations={setAllReservations} // 추가
                            processReservation={processReservation} // 추가
                            filterReservationsByDate={filterReservationsByDate} // 추가
                            allReservations={allReservations} // 추가
                            setNewlyCreatedId={setNewlyCreatedId} // 추
                          />
                        ) : (
                          <DayUseFormModal
                            initialData={guestFormData}
                            roomTypes={finalRoomTypes}
                            onClose={() => {
                              setShowGuestForm(false);
                              if (guestFormData.onComplete) {
                                guestFormData.onComplete();
                              }
                            }}
                            onSave={handleFormSave}
                            availabilityByDate={guestAvailability}
                            hotelSettings={hotelSettings}
                            selectedDate={selectedDate}
                            allReservations={allReservations} // 추가: 점유 계산에 필요
                            hotelId={hotelId}
                            setLoadedReservations={setLoadedReservations}
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
                      monthlySales={monthlyTotal.total}
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
