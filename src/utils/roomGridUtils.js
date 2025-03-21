import {
  FaCreditCard,
  FaMoneyBillWave,
  FaUniversity,
  FaHourglassHalf,
  FaGlobe,
} from 'react-icons/fa';
import availableOTAs from '../config/availableOTAs';
import { format, parseISO, addDays } from 'date-fns';
import { extractPrice } from './extractPrice';

export function isOtaReservation(reservation) {
  return availableOTAs.includes(reservation.siteName || '');
}

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

export function getBorderColor(reservation) {
  try {
    if (!reservation || !reservation.checkIn || !reservation.checkOut) {
      console.warn(
        'Reservation data or dates are missing or invalid:',
        reservation
      );
      return '';
    }

    const ci = new Date(reservation.checkIn);
    const co = new Date(reservation.checkOut);

    if (isNaN(ci.getTime()) || isNaN(co.getTime())) {
      console.warn('Invalid date objects:', { ci, co });
      return '';
    }

    const hasDaesil =
      (reservation.customerName &&
        reservation.customerName.toLowerCase().includes('대실')) ||
      (reservation.roomInfo &&
        reservation.roomInfo.toLowerCase().includes('대실'));

    if (hasDaesil) {
      return 'border-primary-soft-green';
    }

    const ciOnly = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate());
    const coOnly = new Date(co.getFullYear(), co.getMonth(), co.getDate());
    const diff = Math.floor((coOnly - ciOnly) / (1000 * 60 * 60 * 24));

    if (diff === 0) {
      return 'border-primary-soft-green';
    } else if (diff === 1) {
      return 'border-accent-coral';
    } else if (diff >= 2) {
      return 'border-primary-deep-blue';
    }
    return '';
  } catch (err) {
    console.error('getBorderColor error:', err);
    return '';
  }
}

export function getPaymentMethodIcon(pm) {
  switch (pm) {
    case 'Card':
      return {
        icon: <FaCreditCard className="payment-icon" />,
        text: '카드',
      };
    case 'Cash':
      return {
        icon: <FaMoneyBillWave className="payment-icon" />,
        text: '현금',
      };
    case 'Account Transfer':
      return {
        icon: <FaUniversity className="payment-icon" />,
        text: '계좌이체',
      };
    case 'OTA':
      return {
        icon: <FaGlobe className="payment-icon" />,
        text: 'OTA',
      };
    case 'Pending':
      return {
        icon: <FaHourglassHalf className="payment-icon" />,
        text: '미결제',
      };
    case 'Various': // 다양하게 결제한 경우
      return {
        icon: <FaMoneyBillWave className="payment-icon" />,
        text: '다양한 결제',
      };
    case 'PerNight(Card)': // 1박씩 결제(카드)
      return {
        icon: <FaCreditCard className="payment-icon" />,
        text: '1박씩(카드)',
      };
    case 'PerNight(Cash)': // 1박씩 결제(현금)
      return {
        icon: <FaMoneyBillWave className="payment-icon" />,
        text: '1박씩(현금)',
      };
    default:
      return { icon: null, text: '정보 없음' };
  }
}

export function getInitialFormData(reservation, roomTypes, isDayUse = false) {
  const now = new Date();
  if (!reservation || typeof reservation !== 'object' || reservation.isNew) {
    const ci = reservation?.checkIn ? new Date(reservation.checkIn) : now;
    if (isDayUse) {
      const basePrice = Math.floor((roomTypes[0]?.price || 0) * 0.5); // 대실 기본 가격
      return {
        customerName:
          reservation?.customerName || `대실:${format(now, 'HH:mm:ss')}`,
        phoneNumber: reservation?.phoneNumber || '',
        checkInDate: format(ci, 'yyyy-MM-dd'), // 보고 있는 날짜 반영
        checkInTime: format(ci, 'HH:mm'),
        durationHours: 4,
        reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: reservation?.roomInfo || roomTypes[0]?.roomInfo || 'Standard',
        price: String(basePrice),
        paymentMethod: '미결제',
        specialRequests: '',
        manualPriceOverride: false,
      };
    } else {
      const co = reservation?.checkOut
        ? new Date(reservation.checkOut)
        : addDays(ci, 1);
      const ciDate = format(ci, 'yyyy-MM-dd');
      const coDate = format(co, 'yyyy-MM-dd');
      const roomInfo =
        reservation?.roomInfo || roomTypes[0]?.roomInfo || 'Standard';
      const selectedRoom =
        roomTypes.find((r) => r.roomInfo === roomInfo) || roomTypes[0];
      const nights = Math.max(
        1,
        Math.ceil((new Date(co) - new Date(ci)) / (1000 * 60 * 60 * 24))
      );
      const basePrice = (selectedRoom?.price || 0) * nights;
      return {
        customerName: reservation?.customerName || '',
        phoneNumber: reservation?.phoneNumber || '',
        checkInDate: ciDate,
        checkOutDate: coDate,
        reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: roomInfo,
        price: String(basePrice),
        paymentMethod: '미결제',
        specialRequests: '',
        manualPriceOverride: false,
      };
    }
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
  const roomInfo = reservation.roomInfo || roomTypes[0]?.roomInfo || 'Standard';
  const selectedRoom =
    roomTypes.find((r) => r.roomInfo === roomInfo) || roomTypes[0];
  const nights = Math.max(
    1,
    Math.ceil((new Date(co) - new Date(ci)) / (1000 * 60 * 60 * 24))
  );
  const priceVal = reservation.price
    ? extractPrice(reservation.price).toString()
    : String((selectedRoom?.price || 0) * nights);

  return {
    customerName: reservation.customerName || '',
    phoneNumber: reservation.phoneNumber || '',
    checkInDate: ciDate,
    checkOutDate: coDate,
    reservationDate: resDate,
    roomInfo: roomInfo,
    price: priceVal,
    paymentMethod: reservation.paymentMethod || '미결제',
    specialRequests: reservation.specialRequests || '',
    manualPriceOverride: !!reservation.price,
  };
}

export const checkConflict = (
  draggedReservation,
  targetRoomNumber,
  fullReservations
) => {
  const draggedCheckIn = new Date(draggedReservation.checkIn);
  const draggedCheckOut = new Date(draggedReservation.checkOut);

  for (const reservation of fullReservations) {
    if (
      reservation.roomNumber !== targetRoomNumber ||
      reservation._id === draggedReservation._id ||
      reservation.isCancelled
    )
      continue;

    const resCheckIn = new Date(reservation.checkIn);
    const resCheckOut = new Date(reservation.checkOut);

    if (draggedCheckIn < resCheckOut && draggedCheckOut > resCheckIn) {
      if (draggedCheckIn.getTime() === resCheckOut.getTime()) continue;
      return { isConflict: true, conflictReservation: reservation };
    }
  }

  return { isConflict: false };
};
