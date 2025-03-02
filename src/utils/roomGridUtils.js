// utils/roomGridUtils.js

import {
  FaCreditCard,
  FaMoneyBillWave,
  FaUniversity,
  FaHourglassHalf,
} from 'react-icons/fa';
import availableOTAs from '../config/availableOTAs';
import { format, parseISO, addDays } from 'date-fns';
import { extractPrice } from './extractPrice';

// OTA 예약인지 확인
export function isOtaReservation(reservation) {
  return availableOTAs.includes(reservation.siteName || '');
}

// 컨테이너 정렬
export function sortContainers(containers) {
  return containers.sort((a, b) => {
    const aNum = parseInt(a.roomNumber || '', 10);
    const bNum = parseInt(b.roomNumber || '', 10);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return (a.roomNumber || '').localeCompare(b.roomNumber || '');
  });
}

// 테두리 색상 클래스 반환
export function getBorderColor(reservation) {
  try {
    // 데이터 유효성 검사 강화
    if (
      !reservation ||
      !reservation.parsedCheckInDate ||
      !reservation.parsedCheckOutDate
    ) {
      console.warn(
        'Reservation data or dates are missing or invalid:',
        reservation
      );
      return '';
    }

    const ci = reservation.parsedCheckInDate;
    const co = reservation.parsedCheckOutDate;

    // 날짜 객체가 유효한지 확인
    if (
      !(ci instanceof Date) ||
      !(co instanceof Date) ||
      isNaN(ci.getTime()) ||
      isNaN(co.getTime())
    ) {
      console.warn('Invalid date objects:', { ci, co });
      return '';
    }

    // 대실 여부 확인
    const hasDaesil =
      (reservation.customerName &&
        reservation.customerName.toLowerCase().includes('대실')) ||
      (reservation.roomInfo &&
        reservation.roomInfo.toLowerCase().includes('대실'));

    if (hasDaesil) {
      return 'border-primary-soft-green';
    }

    // 체크인/체크아웃 날짜만 사용 (시간 제거)
    const ciOnly = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate());
    const coOnly = new Date(co.getFullYear(), co.getMonth(), co.getDate());

    // 날짜 차이 계산 (일 단위)
    const diff = Math.floor((coOnly - ciOnly) / (1000 * 60 * 60 * 24));

    // 색상 반환 로직
    if (diff === 0) {
      return 'border-primary-soft-green'; // 대실
    } else if (diff === 1) {
      return 'border-accent-coral'; // 1박
    } else if (diff >= 2) {
      return 'border-primary-deep-blue'; // 연박 (2박 이상)
    }
    return '';
  } catch (err) {
    console.error('getBorderColor error:', err);
    return '';
  }
}
// 결제 방법에 따른 아이콘 반환
export function getPaymentMethodIcon(pm) {
  switch (pm) {
    case 'Card':
      return <FaCreditCard className="payment-icon" />;
    case 'Cash':
      return <FaMoneyBillWave className="payment-icon" />;
    case 'Account Transfer':
      return <FaUniversity className="payment-icon" />;
    case 'Pending':
      return <FaHourglassHalf className="payment-icon" />;
    default:
      return null;
  }
}

// form 초기값 설정 로직 (공통화)
export function getInitialFormData(reservation, roomTypes) {
  if (!reservation || typeof reservation !== 'object' || reservation.isNew) {
    const now = new Date();
    const ci = now;
    const co = addDays(now, 1);
    const ciDate = format(ci, 'yyyy-MM-dd');
    const coDate = format(co, 'yyyy-MM-dd');
    const selectedRoom = roomTypes[0] || { roomInfo: 'Standard', price: 0 };
    
    return {
      customerName: '',
      phoneNumber: '',
      checkInDate: ciDate,
      checkOutDate: coDate,
      reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
      roomInfo: selectedRoom.roomInfo,
      price: selectedRoom.price.toString(),
      paymentMethod: 'Pending',
      specialRequests: '',
      manualPriceOverride: false,
    };
  }

  const ci = reservation.checkIn ? new Date(reservation.checkIn) : new Date();
  const co = reservation.checkOut
    ? new Date(reservation.checkOut)
    : addDays(ci, 1);
  const ciDate = format(ci, 'yyyy-MM-dd');
  const coDate = format(co, 'yyyy-MM-dd');
  const resDate = reservation.reservationDate
    ? format(parseISO(reservation.reservationDate), 'yyyy-MM-dd HH:mm')
    : format(new Date(), 'yyyy-MM-dd HH:mm');
  const priceVal = reservation.price
    ? extractPrice(reservation.price).toString()
    : '0';
  const selectedRoom = roomTypes.find(
    (r) => r.roomInfo === reservation.roomInfo
  ) || roomTypes[0] || { roomInfo: 'Standard', price: 0 };
  const basePrice = selectedRoom.price || 0;
  const nights = Math.max(
    1,
    Math.ceil((new Date(co) - new Date(ci)) / (1000 * 60 * 60 * 24))
  );
  const calculatedPrice = priceVal || (basePrice * nights).toString();

  return {
    customerName: reservation.customerName || '',
    phoneNumber: reservation.phoneNumber || '',
    checkInDate: ciDate,
    checkOutDate: coDate,
    reservationDate: resDate,
    roomInfo: reservation.roomInfo || selectedRoom.roomInfo,
    price: calculatedPrice,
    paymentMethod: reservation.paymentMethod || 'Pending',
    specialRequests: reservation.specialRequests || '',
    manualPriceOverride: !!reservation.price,
  };
}