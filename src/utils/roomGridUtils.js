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

    if (
      !(ci instanceof Date) ||
      !(co instanceof Date) ||
      isNaN(ci.getTime()) ||
      isNaN(co.getTime())
    ) {
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

export function getInitialFormData(reservation, roomTypes) {
  if (!reservation || typeof reservation !== 'object' || reservation.isNew) {
    const now = new Date();
    const ci = reservation?.checkIn ? new Date(reservation.checkIn) : now;
    const co = reservation?.checkOut
      ? new Date(reservation.checkOut)
      : addDays(ci, 1);
    const ciDate = format(ci, 'yyyy-MM-dd');
    const coDate = format(co, 'yyyy-MM-dd');
    const roomInfo = reservation?.roomInfo || roomTypes[0]?.roomInfo || 'Standard';
    const selectedRoom = roomTypes.find((r) => r.roomInfo === roomInfo) || roomTypes[0];
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
  const roomInfo = reservation.roomInfo || roomTypes[0]?.roomInfo || 'Standard';
  const selectedRoom = roomTypes.find((r) => r.roomInfo === roomInfo) || roomTypes[0];
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
    paymentMethod: reservation.paymentMethod || 'Pending',
    specialRequests: reservation.specialRequests || '',
    manualPriceOverride: !!reservation.price,
  };
}