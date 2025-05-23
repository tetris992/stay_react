import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import {
  format,
  addDays,
  startOfDay,
  differenceInCalendarDays,
} from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { getDetailedAvailabilityMessage } from '../utils/availability';
import './GuestFormModal.css';

// -----------------------------
// Various(다양한 결제) 기본 세팅
// -----------------------------
const GuestFormModal = ({
  onClose,
  onSave,
  initialData,
  roomTypes,
  availabilityByDate,
  hotelSettings,
  hotelId,
  selectedDate, // 이게 필요없는거 아닐껀데
  setNewlyCreatedId,
}) => {
  // -----------------------------
  // State
  // -----------------------------
  const [formData, setFormData] = useState({
    reservationNo: '',
    customerName: '',
    phoneNumber: '',
    checkInDate: '',
    checkInTime: '',
    checkOutDate: '',
    checkOutTime: '',
    reservationDate: '',
    roomInfo: '',
    price: '0',
    paymentMethod: '',
    paymentDetails: [],
    specialRequests: '',
    roomNumber: '',
    manualPriceOverride: false,
    remainingBalance: 0,
    siteName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [checkedNights, setCheckedNights] = useState([]);
  const [displayedRemainingBalance, setDisplayedRemainingBalance] = useState(0);
  const [availabilityWarning, setAvailabilityWarning] = useState('');
  const [hasEditedCustomerName, setHasEditedCustomerName] = useState(false);
  const filteredRoomTypes = useMemo(
    () => roomTypes.filter((rt) => rt.roomInfo.toLowerCase() !== 'none'),
    [roomTypes]
  );

  // 단잠 예약 여부 확인
  const isDanjam = initialData?.siteName === '단잠';

  // 고객 이름이 "판매보류" 또는 "판매중지"일 경우 가격을 0원으로 설정
  useEffect(() => {
    if (
      formData.customerName === '판매보류' ||
      formData.customerName === '판매중지'
    ) {
      setFormData((prev) => ({
        ...prev,
        price: '0',
        manualPriceOverride: true,
        remainingBalance: 0,
      }));
      setDisplayedRemainingBalance(0);
    }
  }, [formData.customerName]);

  // -----------------------------
  // createDefaultVariousPayments: 안정적인 참조 제공
  // -----------------------------
  const createDefaultVariousPayments = useCallback(
    (now) => [
      {
        method: 'Card',
        amount: 0,
        date: format(now, 'yyyy-MM-dd'),
        timestamp: format(now, "yyyy-MM-dd'T'HH:mm:ss+09:00"),
      },
      {
        method: 'Cash',
        amount: 0,
        date: format(now, 'yyyy-MM-dd'),
        timestamp: format(now, "yyyy-MM-dd'T'HH:mm:ss+09:00"),
      },
      {
        method: 'Account Transfer',
        amount: 0,
        date: format(now, 'yyyy-MM-dd'),
        timestamp: format(now, "yyyy-MM-dd'T'HH:mm:ss+09:00"),
      },
    ],
    []
  );

  // -----------------------------
  // isRoomTypeUnavailable: 재고 확인 함수 (useCallback으로 감싸고 의존성 명시)
  // -----------------------------
  const isRoomTypeUnavailable = useCallback(
    (roomInfo, excludeReservationId = null) => {
      if (
        !availabilityByDate ||
        !formData.checkInDate ||
        !formData.checkOutDate ||
        !formData.checkInTime ||
        !formData.checkOutTime
      )
        return false;
      const start = new Date(
        `${formData.checkInDate}T${formData.checkInTime}:00`
      );
      const end = new Date(
        `${formData.checkOutDate}T${formData.checkOutTime}:00`
      );
      if (isNaN(start) || isNaN(end)) return false;
      let cursor = start;
      while (cursor < end) {
        const ds = format(cursor, 'yyyy-MM-dd');
        const availForDay = availabilityByDate[ds]?.[roomInfo.toLowerCase()];
        if (!availForDay) return true;

        // 자기 예약(excludeReservationId)가 있다면, 해당 날의 남은 재고를 보정
        let adjustedRemain = availForDay.remain;
        if (excludeReservationId && availForDay.reservations) {
          const selfReservation = availForDay.reservations.find(
            (res) => res._id === excludeReservationId
          );
          if (selfReservation) {
            adjustedRemain += 1; // 자기 자신이 이미 점유한 객실을 재고에 다시 추가
          }
        }

        if (adjustedRemain <= 0) return true;
        cursor = addDays(cursor, 1);
      }
      return false;
    },
    [
      availabilityByDate,
      formData.checkInDate,
      formData.checkOutDate,
      formData.checkInTime,
      formData.checkOutTime,
    ]
  );

  // diffDays는 formData에서 파생됨
  const diffDays = differenceInCalendarDays(
    new Date(`${formData.checkOutDate}T${formData.checkOutTime}:00`),
    new Date(`${formData.checkInDate}T${formData.checkInTime}:00`)
  );

  // -----------------------------
  // 초기 데이터 세팅 (수정 모드 / 신규 모드)
  // -----------------------------
  const initEditMode = useCallback(
    (now, defaultCheckInTime, defaultCheckOutTime) => {
      const checkInDateObj = new Date(initialData.checkIn);
      const checkOutDateObj = new Date(initialData.checkOut);
      const totalPrice = initialData.price || initialData.totalPrice || 0;
      const paymentDetails = initialData.paymentHistory || [];
      const remainingBalance =
        initialData.remainingBalance !== undefined
          ? initialData.remainingBalance
          : totalPrice;
      const calculatedDiffDays = differenceInCalendarDays(
        checkOutDateObj,
        checkInDateObj
      );

      setFormData({
        reservationNo: initialData.reservationNo || '',
        customerName: initialData.customerName || '',
        phoneNumber: initialData.phoneNumber || '',
        checkInDate: format(checkInDateObj, 'yyyy-MM-dd'),
        checkInTime: format(checkInDateObj, 'HH:mm'),
        checkOutDate: format(checkOutDateObj, 'yyyy-MM-dd'),
        checkOutTime: format(checkOutDateObj, 'HH:mm'),
        reservationDate:
          initialData.reservationDate || format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo:
          initialData.roomInfo || filteredRoomTypes[0]?.roomInfo || 'Standard',
        price: String(totalPrice),
        paymentMethod: isDanjam
          ? initialData.paymentMethod || '현장결제' // 단잠 예약의 초기 paymentMethod를 '현장결제'로 설정
          : initialData.paymentMethod ||
            (initialData.type === 'dayUse' ? 'Cash' : 'Card'),
        paymentDetails:
          initialData.paymentMethod === 'Various'
            ? paymentDetails.length > 0
              ? paymentDetails
              : createDefaultVariousPayments(now)
            : paymentDetails,
        specialRequests: initialData.specialRequests || '',
        roomNumber: initialData.roomNumber || '',
        manualPriceOverride: false,
        remainingBalance,
        siteName: initialData.siteName || '현장예약',
      });
      setShowPaymentDetails(
        initialData.paymentMethod === 'Various' ||
          initialData.paymentMethod?.includes('PerNight')
      );
      setDisplayedRemainingBalance(remainingBalance);

      if (
        initialData.paymentMethod?.includes('PerNight') &&
        calculatedDiffDays > 1
      ) {
        const perNightPrice = Math.round(totalPrice / calculatedDiffDays);
        const paidNights = Math.floor(
          (totalPrice - remainingBalance) / perNightPrice
        );
        setCheckedNights(Array.from({ length: paidNights }, (_, i) => i + 1));
      } else {
        setCheckedNights([]);
      }
    },
    [initialData, filteredRoomTypes, createDefaultVariousPayments, isDanjam]
  );

  const initCreateMode = useCallback(
    (now, defaultCheckInTime, defaultCheckOutTime) => {
      const defaultCheckIn = initialData?.checkInDate
        ? new Date(`${initialData.checkInDate}T${defaultCheckInTime}:00`)
        : new Date(
            now.setHours(
              parseInt(defaultCheckInTime.split(':')[0]),
              parseInt(defaultCheckInTime.split(':')[1]),
              0,
              0
            )
          );
      const defaultCheckOut = initialData?.checkOutDate
        ? new Date(`${initialData.checkOutDate}T${defaultCheckOutTime}:00`)
        : addDays(defaultCheckIn, 1);
      defaultCheckOut.setHours(
        parseInt(defaultCheckOutTime.split(':')[0]),
        parseInt(defaultCheckOutTime.split(':')[1]),
        0,
        0
      );

      const checkInDateStr = format(defaultCheckIn, 'yyyy-MM-dd');
      const checkOutDateStr = format(defaultCheckOut, 'yyyy-MM-dd');
      const initialRoomInfo =
        initialData?.roomInfo || filteredRoomTypes[0]?.roomInfo || 'Standard';
      const selectedRoom =
        filteredRoomTypes.find((rt) => rt.roomInfo === initialRoomInfo) ||
        filteredRoomTypes[0];
      const nights = differenceInCalendarDays(defaultCheckOut, defaultCheckIn);
      const basePrice = (selectedRoom?.price || 0) * Math.max(nights, 1);

      setFormData({
        reservationNo: initialData?.reservationNo || uuidv4(),
        customerName: initialData?.customerName || '',
        phoneNumber: initialData?.phoneNumber || '',
        checkInDate: checkInDateStr,
        checkInTime: defaultCheckInTime,
        checkOutDate: checkOutDateStr,
        checkOutTime: defaultCheckOutTime,
        reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: initialRoomInfo,
        price: String(basePrice),
        paymentMethod:
          initialData?.paymentMethod ||
          (initialData?.type === 'dayUse' ? 'Cash' : 'Card'),
        paymentDetails:
          initialData?.paymentMethod === 'Various'
            ? createDefaultVariousPayments(now)
            : [],
        specialRequests: initialData?.specialRequests || '',
        roomNumber: initialData?.roomNumber || '',
        manualPriceOverride: false,
        remainingBalance: basePrice,
      });
      setDisplayedRemainingBalance(basePrice);

      if (
        (initialData?.paymentMethod?.includes('PerNight') ||
          (!initialData?.paymentMethod && nights > 1)) &&
        nights > 1
      ) {
        setCheckedNights([1]);
      }
    },
    [initialData, filteredRoomTypes, createDefaultVariousPayments]
  );

  useEffect(() => {
    if (!hotelId) {
      console.error('[GuestFormModal] hotelId is undefined, closing modal');
      onClose();
      return;
    }
    const now = new Date();
    const defaultCheckInTime = hotelSettings?.checkInTime || '16:00';
    const defaultCheckOutTime = hotelSettings?.checkOutTime || '11:00';

    // 디버깅 로그 추가
    console.log('[GuestFormModal] 호텔 설정 시간:', {
      hotelId,
      checkInTime: defaultCheckInTime,
      checkOutTime: defaultCheckOutTime,
      rawSettings: hotelSettings,
    });

    if (initialData && initialData._id) {
      initEditMode(now, defaultCheckInTime, defaultCheckOutTime);
    } else {
      initCreateMode(now, defaultCheckInTime, defaultCheckOutTime);
    }
  }, [
    initialData,
    filteredRoomTypes,
    hotelSettings,
    hotelId,
    onClose,
    initEditMode,
    initCreateMode,
  ]);

  // -----------------------------
  // availabilityWarning 설정 (재고 확인)
  // -----------------------------
  useEffect(() => {
    if (formData.checkInDate && formData.checkOutDate && formData.roomInfo) {
      const unavailable = isRoomTypeUnavailable(
        formData.roomInfo,
        initialData?._id
      );
      setAvailabilityWarning(
        unavailable ? '선택한 기간 동안 해당 객실타입의 재고가 부족합니다.' : ''
      );
    }
  }, [
    formData.checkInDate,
    formData.checkOutDate,
    formData.roomInfo,
    initialData?._id,
    isRoomTypeUnavailable,
  ]);

  // -----------------------------
  // 날짜 변경 시 가격 재계산 및 재고 확인
  // -----------------------------
  useEffect(() => {
    if (isSubmitting || formData.manualPriceOverride) return;
    if (formData.checkInDate && formData.checkOutDate && formData.roomInfo) {
      const checkInDateObj = new Date(
        `${formData.checkInDate}T${formData.checkInTime}:00`
      );
      const checkOutDateObj = new Date(
        `${formData.checkOutDate}T${formData.checkOutTime}:00`
      );
      if (
        checkInDateObj &&
        checkOutDateObj &&
        !isNaN(checkInDateObj) &&
        !isNaN(checkOutDateObj)
      ) {
        const nights = differenceInCalendarDays(
          checkOutDateObj,
          checkInDateObj
        );
        const selectedRoom = filteredRoomTypes.find(
          (room) => room.roomInfo === formData.roomInfo
        );
        const nightlyPrice = selectedRoom?.price || 0;
        const totalPrice = String(nightlyPrice * Math.max(nights, 1));
        setFormData((prev) => ({
          ...prev,
          price: totalPrice,
          remainingBalance: Number(totalPrice),
        }));
      }
    }
  }, [
    formData.checkInDate,
    formData.checkOutDate,
    formData.roomInfo,
    formData.manualPriceOverride,
    isSubmitting,
    filteredRoomTypes,
    formData.checkInTime,
    formData.checkOutTime,
  ]);

  // -----------------------------
  // 공통 input 핸들러
  // -----------------------------
  const handleInputChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      // 전화번호 입력일 때, 고객 이름이 판매보류 등인 경우는 건너뜁니다.
      if (
        name === 'phoneNumber' &&
        value.trim() === '' &&
        !(
          formData.customerName &&
          ['판매보류', '판매중지', '판매중단', '판매금지'].includes(
            formData.customerName.trim()
          )
        )
      ) {
        alert('연락처는 필수 입력 항목입니다.');
        return;
      }

      setFormData((prev) => {
        const updated = { ...prev, [name]: value };
        if (name === 'price') {
          updated.manualPriceOverride = true;
          updated.remainingBalance = Number(value);
          setDisplayedRemainingBalance(Number(value));
          setCheckedNights([]);
        }
        if (name === 'paymentMethod') {
          const now = new Date();
          if (value === 'Various') {
            updated.paymentDetails = createDefaultVariousPayments(now);
            updated.remainingBalance = Number(prev.price);
          } else {
            updated.paymentDetails = [];
            updated.remainingBalance = Number(prev.price);
          }
          setShowPaymentDetails(
            value === 'Various' || value.includes('PerNight')
          );
          if (value.includes('PerNight') && diffDays > 1) {
            setCheckedNights([1]);
          } else {
            setCheckedNights([]);
          }
        }
        return updated;
      });
    },
    [formData.customerName, diffDays, createDefaultVariousPayments]
  );

  // -----------------------------
  // 체크인/체크아웃 변경 시 가격 재계산
  // -----------------------------
  const handleCheckInDateChange = useCallback(
    (e) => {
      const selectedDate = e.target.value;
      setFormData((prev) => {
        // 새 체크인 날짜가 기존 체크아웃 날짜보다 이후라면, 체크아웃 날짜를 체크인 날짜의 다음 날로 설정
        let newCheckOutDate = prev.checkOutDate;
        const newCheckInObj = new Date(
          `${selectedDate}T${prev.checkInTime}:00`
        );
        const currentCheckOutObj = new Date(
          `${prev.checkOutDate}T${prev.checkOutTime}:00`
        );
        if (newCheckInObj > currentCheckOutObj) {
          const nextDay = addDays(new Date(selectedDate), 1); // 체크인 날짜의 다음 날
          newCheckOutDate = format(nextDay, 'yyyy-MM-dd');
        }
        const updated = {
          ...prev,
          checkInDate: selectedDate,
          checkOutDate: newCheckOutDate,
          checkIn: `${selectedDate}T${prev.checkInTime}:00+09:00`,
          checkOut: `${newCheckOutDate}T${prev.checkOutTime}:00+09:00`,
        };
        const checkInDateObj = new Date(updated.checkIn);
        const checkOutDateObj = new Date(updated.checkOut);
        if (
          checkInDateObj &&
          checkOutDateObj &&
          !isNaN(checkInDateObj) &&
          !isNaN(checkOutDateObj)
        ) {
          const nights = differenceInCalendarDays(
            checkOutDateObj,
            checkInDateObj
          );
          const perNightPrice =
            nights > 0
              ? Math.round(Number(prev.price) / nights)
              : Number(prev.price);
          const totalPrice = String(perNightPrice * Math.max(nights, 1));
          updated.price = totalPrice;
          updated.remainingBalance = Number(totalPrice);
          if (updated.paymentMethod.includes('PerNight')) {
            updated.paymentDetails = checkedNights.map(() => ({
              method:
                updated.paymentMethod === 'PerNight(Card)' ? 'Card' : 'Cash',
              amount: perNightPrice,
              date: format(new Date(), 'yyyy-MM-dd'),
              timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss+09:00"),
            }));
          }
          setDisplayedRemainingBalance(Number(totalPrice));
        }
        return updated;
      });
      setCheckedNights([]);
    },
    [checkedNights, setDisplayedRemainingBalance]
  );

  const handleCheckOutDateChange = useCallback(
    (e) => {
      const selectedDate = e.target.value;
      setFormData((prev) => {
        const updated = { ...prev, checkOutDate: selectedDate };
        const checkInDateObj = new Date(
          `${updated.checkInDate}T${updated.checkInTime}:00`
        );
        const checkOutDateObj = new Date(
          `${selectedDate}T${updated.checkOutTime}:00`
        );
        if (
          checkInDateObj &&
          checkOutDateObj &&
          !isNaN(checkInDateObj) &&
          !isNaN(checkOutDateObj)
        ) {
          const oldNights = differenceInCalendarDays(
            new Date(`${prev.checkOutDate}T${prev.checkOutTime}:00`),
            new Date(`${prev.checkInDate}T${prev.checkInTime}:00`)
          );
          const newNights = differenceInCalendarDays(
            checkOutDateObj,
            checkInDateObj
          );
          const perNightPrice =
            oldNights > 0
              ? Math.round(Number(prev.price) / oldNights)
              : Number(prev.price);
          const totalPrice = String(perNightPrice * Math.max(newNights, 1));
          updated.price = totalPrice;
          updated.remainingBalance = Number(totalPrice);
          if (updated.paymentMethod.includes('PerNight')) {
            updated.paymentDetails = checkedNights.map(() => ({
              method:
                updated.paymentMethod === 'PerNight(Card)' ? 'Card' : 'Cash',
              amount: perNightPrice,
              date: format(new Date(), 'yyyy-MM-dd'),
              timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss+09:00"),
            }));
          }
          setDisplayedRemainingBalance(Number(totalPrice));
        }
        return updated;
      });
      setCheckedNights([]);
    },
    [checkedNights]
  );

  // -----------------------------
  // PerNight 체크박스 핸들러
  // -----------------------------
  const handleNightCheck = useCallback(
    (night) => {
      setCheckedNights((prev) => {
        const newCheckedNights = prev.includes(night)
          ? prev.filter((n) => n !== night)
          : [...prev, night];
        const perNightPrice =
          diffDays > 0
            ? Math.round(Number(formData.price) / diffDays)
            : Number(formData.price);
        const checkedAmount = perNightPrice * newCheckedNights.length;
        const baseRemaining = Number(formData.price);
        const newRemaining = baseRemaining - checkedAmount;
        setFormData((prevForm) => ({
          ...prevForm,
          remainingBalance: newRemaining >= 0 ? newRemaining : 0,
          paymentDetails: newCheckedNights.map(() => ({
            method:
              formData.paymentMethod === 'PerNight(Card)' ? 'Card' : 'Cash',
            amount: perNightPrice,
            date: format(new Date(), 'yyyy-MM-dd'),
            timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss+09:00"),
          })),
        }));
        setDisplayedRemainingBalance(newRemaining >= 0 ? newRemaining : 0);
        return newCheckedNights;
      });
    },
    [diffDays, formData.price, formData.paymentMethod]
  );

  // -----------------------------
  // Various(다양한 결제) 추가/변경/제거
  // -----------------------------
  const handleAddPaymentDetail = () => {
    setFormData((prev) => {
      const newPaymentDetails = [
        ...prev.paymentDetails,
        {
          method: 'Cash',
          amount: 0,
          timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss+09:00"),
          date: format(new Date(), 'yyyy-MM-dd'),
        },
      ];
      return {
        ...prev,
        paymentDetails: newPaymentDetails,
        remainingBalance:
          Number(prev.price) -
          newPaymentDetails.reduce(
            (sum, detail) => sum + Number(detail.amount || 0),
            0
          ),
      };
    });
  };

  const handlePaymentDetailChange = useCallback((index, field, value) => {
    setFormData((prev) => {
      const updatedDetails = [...prev.paymentDetails];
      updatedDetails[index] = { ...updatedDetails[index], [field]: value };
      const totalPaid = updatedDetails.reduce(
        (sum, detail) => sum + Number(detail.amount || 0),
        0
      );
      return {
        ...prev,
        paymentDetails: updatedDetails,
        remainingBalance: Number(prev.price) - totalPaid,
      };
    });
  }, []);

  const handleRemovePaymentDetail = useCallback((index) => {
    setFormData((prev) => {
      const updatedDetails = prev.paymentDetails.filter((_, i) => i !== index);
      const totalPaid = updatedDetails.reduce(
        (sum, detail) => sum + Number(detail.amount || 0),
        0
      );
      return {
        ...prev,
        paymentDetails: updatedDetails,
        remainingBalance: Number(prev.price) - totalPaid,
      };
    });
  }, []);

  // -----------------------------
  // 객실 재고 확인
  // -----------------------------
  const checkAvailability = useCallback(
    (checkInDateTime, checkOutDateTime, excludeReservationId = null) => {
      const tKey = formData.roomInfo.toLowerCase();
      let cursor = new Date(checkInDateTime);
      let missingDates = [];
      let commonRooms = null;
      while (cursor < checkOutDateTime) {
        const ds = format(cursor, 'yyyy-MM-dd');
        const availForDay = availabilityByDate[ds]?.[tKey];
        if (!availForDay) {
          missingDates.push(ds);
          continue;
        }

        // 보정: 자기 예약이 있다면 남은 재고와 leftoverRooms에 반영
        let adjustedRemain = availForDay.remain;
        let adjustedLeftoverRooms = [...(availForDay.leftoverRooms || [])];
        if (excludeReservationId && availForDay.reservations) {
          const selfReservation = availForDay.reservations.find(
            (res) => res._id === excludeReservationId
          );
          if (selfReservation) {
            adjustedRemain += 1; // 자기 예약으로 감소한 재고를 복원
            if (
              selfReservation.roomNumber &&
              !adjustedLeftoverRooms.includes(selfReservation.roomNumber)
            ) {
              adjustedLeftoverRooms.push(selfReservation.roomNumber);
            }
          }
        }

        if (adjustedRemain <= 0) {
          missingDates.push(ds);
        } else {
          const freeRooms = adjustedLeftoverRooms;
          if (!commonRooms) commonRooms = new Set(freeRooms);
          else {
            commonRooms = new Set(
              [...commonRooms].filter((r) => freeRooms.includes(r))
            );
          }
        }
        cursor = addDays(cursor, 1);
      }
      if (!commonRooms || commonRooms.size === 0 || missingDates.length > 0) {
        return getDetailedAvailabilityMessage(
          startOfDay(checkInDateTime),
          startOfDay(checkOutDateTime),
          tKey,
          availabilityByDate
        );
      }
      return { commonRooms };
    },
    [formData.roomInfo, availabilityByDate]
  );

  // -----------------------------
  // 최종 데이터 구성
  // -----------------------------
  const buildFinalData = useCallback(
    (checkInDateTime, checkOutDateTime, commonRooms) => {
      // 수정 모드일 경우 기존 roomNumber 유지, 신규 모드일 경우 commonRooms에서 선택
      const selectedRoomNumber = initialData?._id
        ? formData.roomNumber // 수정 모드: 기존 roomNumber 유지
        : formData.roomNumber ||
          (commonRooms && commonRooms.size > 0
            ? [...commonRooms].sort((a, b) => parseInt(a) - parseInt(b))[0]
            : ''); // 신규 모드: commonRooms에서 선택, 없으면 빈 문자열
      const nights = differenceInCalendarDays(
        checkOutDateTime,
        checkInDateTime
      );
      const isPerNightPayment =
        formData.paymentMethod.includes('PerNight') && nights > 1;
      const finalData = {
        ...formData,
        price: Number(formData.price),
        checkIn: format(checkInDateTime, "yyyy-MM-dd'T'HH:mm:ss") + '+09:00',
        checkOut: format(checkOutDateTime, "yyyy-MM-dd'T'HH:mm:ss") + '+09:00',
        roomNumber: String(selectedRoomNumber),
        siteName: formData.siteName || '현장예약',
        type: 'stay',
        isPerNightPayment,
        paymentMethod: formData.paymentMethod, // 사용자의 수정 반영
        paymentHistory: formData.paymentDetails,
        remainingBalance: formData.remainingBalance,
      };
      console.log('[buildFinalData] Final data:', finalData);
      return finalData;
    },
    [formData, initialData]
  );

  // -----------------------------
  // 저장 처리
  // -----------------------------
  const doSave = useCallback(
    async (finalData) => {
      const response = initialData?._id
        ? await onSave(initialData._id, finalData)
        : await onSave(null, finalData);
      console.log('[GuestFormModal] Save response:', response);
      if (!initialData?._id) {
        if (
          response?.createdReservationIds &&
          Array.isArray(response.createdReservationIds) &&
          response.createdReservationIds.length > 0
        ) {
          const newId = response.createdReservationIds[0];
          console.log('[GuestFormModal] New reservation saved with ID:', newId);
        } else if (response?.message?.includes('successfully')) {
          const newId = `현장예약-${formData.reservationNo}`;
          console.warn(
            '[GuestFormModal] No createdReservationIds, using fallback ID:',
            newId
          );
          setNewlyCreatedId(newId);
        } else if (response === undefined) {
          console.warn(
            '[GuestFormModal] Response is undefined, assuming success and using fallback ID.'
          );
          const newId = `현장예약-${formData.reservationNo}`;
          console.warn('[GuestFormModal] Fallback ID used:', newId);
          setNewlyCreatedId(newId);
        } else {
          console.error('[GuestFormModal] Unexpected response:', response);
          throw new Error(
            '응답에서 createdReservationIds를 찾을 수 없습니다. 서버 응답: ' +
              JSON.stringify(response)
          );
        }
      }
    },
    [initialData, formData.reservationNo, onSave, setNewlyCreatedId]
  );

  // -----------------------------
  // 폼 유효성 검사
  // -----------------------------
  const validateForm = useCallback(() => {
    const numericPrice = parseFloat(formData.price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      alert('가격은 유효한 숫자여야 하며 음수가 될 수 없습니다.');
      return false;
    }
    if (!formData.checkInDate || !formData.checkOutDate) {
      alert('체크인/체크아웃 날짜를 모두 입력해주세요.');
      return false;
    }
    // 고객 이름이 판매보류 등일 경우에는 전화번호 검증 건너뜁니다.
    if (
      !formData.phoneNumber.trim() &&
      !(
        formData.customerName &&
        ['판매보류', '판매중지', '판매중단', '판매금지'].includes(
          formData.customerName.trim()
        )
      )
    ) {
      alert('연락처는 필수 입력 항목입니다.');
      return false;
    }
    const checkInDateTime = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const checkOutDateTime = new Date(
      `${formData.checkOutDate}T${formData.checkOutTime}:00`
    );
    if (isNaN(checkInDateTime) || isNaN(checkOutDateTime)) {
      alert('유효한 체크인/체크아웃 날짜를 입력해주세요.');
      return false;
    }
    if (checkInDateTime >= checkOutDateTime) {
      alert('체크인 날짜는 체크아웃보다 이전이어야 합니다.');
      return false;
    }
    if (
      !initialData?._id &&
      formData.customerName.includes('현장') &&
      checkInDateTime < startOfDay(new Date())
    ) {
      alert('현장예약은 과거 날짜로 생성할 수 없습니다.');
      return false;
    }
    if (
      formData.paymentMethod === 'Various' &&
      formData.paymentDetails.length === 0
    ) {
      alert(
        '다양한 결제는 최소 한 건의 결제 기록이 필요합니다. "결제 추가" 버튼을 사용하세요.'
      );
      return false;
    }
    if (
      formData.paymentMethod === 'Various' &&
      formData.paymentDetails.length > 0
    ) {
      const totalPaid = formData.paymentDetails.reduce(
        (sum, detail) => sum + Number(detail.amount || 0),
        0
      );
      if (totalPaid > numericPrice) {
        alert(
          `분할 결제 금액(${totalPaid}원)이 총 금액(${numericPrice}원)을 초과합니다.`
        );
        return false;
      }
      const isValid = formData.paymentDetails.every(
        (detail) =>
          detail.date &&
          detail.amount !== undefined &&
          detail.amount >= 0 &&
          detail.timestamp &&
          detail.method
      );
      if (!isValid) {
        alert(
          '결제 기록에 date, amount, timestamp, method가 모두 필요하며, amount는 0 이상이어야 합니다.'
        );
        return false;
      }
    }
    return true;
  }, [formData, initialData]);

  // -----------------------------
  // 폼 제출 핸들러
  // -----------------------------
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (isSubmitting) return;
      setIsSubmitting(true);
      if (!validateForm()) {
        setIsSubmitting(false);
        return;
      }
      const checkInDateTime = new Date(
        `${formData.checkInDate}T${formData.checkInTime}:00`
      );
      const checkOutDateTime = new Date(
        `${formData.checkOutDate}T${formData.checkOutTime}:00`
      );

      // 수정 모드일 경우, 자기 자신의 예약 ID를 제외하도록 전달합니다.
      const availabilityResult = checkAvailability(
        checkInDateTime,
        checkOutDateTime,
        initialData?._id // excludeReservationId 전달
      );

      if (availabilityResult && typeof availabilityResult === 'string') {
        alert(availabilityResult);
        setIsSubmitting(false);
        return;
      }
      const finalData = buildFinalData(
        checkInDateTime,
        checkOutDateTime,
        availabilityResult.commonRooms
      );
      console.log('[GuestFormModal] Submitting finalData:', finalData);
      try {
        await doSave(finalData);
        onClose();
      } catch (error) {
        console.error('[GuestFormModal] Save Error:', error);
        const errorMessage =
          error.status === 403
            ? 'CSRF 토큰 오류: 페이지를 새로고침 후 다시 시도해주세요.'
            : error.response?.data?.message ||
              error.message ||
              '예약 저장에 실패했습니다. 다시 시도해주세요.';
        alert(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting,
      formData,
      onClose,
      initialData?._id,
      validateForm,
      checkAvailability,
      buildFinalData,
      doSave,
    ]
  );

  // -----------------------------
  // 렌더링: 결제 방식 및 특이사항
  // -----------------------------
  const renderPaymentMethodDropdown = () => {
    const checkInDateObj = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const checkOutDateObj = new Date(
      `${formData.checkOutDate}T${formData.checkOutTime}:00`
    );
    const nights = differenceInCalendarDays(checkOutDateObj, checkInDateObj);
    return (
      <div className="modal-row">
        <label htmlFor="paymentMethod">
          결제방법/상태:
          <select
            id="paymentMethod"
            name="paymentMethod"
            value={formData.paymentMethod}
            onChange={handleInputChange}
            required
            disabled={isSubmitting}
          >
            <option value="Card">카드</option>
            <option value="Cash">현금</option>
            <option value="Account Transfer">계좌이체</option>
            <option value="Pending">미결제</option>
            <option value="현장결제">현장결제</option>
            {nights > 1 && (
              <>
                <option value="PerNight(Card)">1박씩(카드)</option>
                <option value="PerNight(Cash)">1박씩(현금)</option>
                <option value="Various">다양한 결제</option>
              </>
            )}
          </select>
        </label>
        <label htmlFor="specialRequests">
          고객요청:
          <input
            id="specialRequests"
            type="text"
            name="specialRequests"
            value={formData.specialRequests}
            onChange={handleInputChange}
            disabled={isSubmitting}
          />
        </label>
      </div>
    );
  };

  // -----------------------------
  // 렌더링: PerNight 또는 Various 결제 설정
  // -----------------------------
  const renderPaymentDetails = () => {
    if (!showPaymentDetails) return null;

    const perNightPrice =
      diffDays > 0
        ? Math.round(parseFloat(formData.price) / diffDays)
        : parseFloat(formData.price);

    if (formData.paymentMethod.includes('PerNight')) {
      const isAnyNightChecked = checkedNights.length > 0;

      return (
        <div
          className="modal-row payment-details"
          style={{
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          {/* (1) 1박 금액 + '미결제' 표시를 한 줄에 배치 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <h4 style={{ marginRight: '8px' }}>
              1박 금액: {perNightPrice.toLocaleString()}원
            </h4>
            {/* 체크박스가 하나도 안 선택됐으면 '미결제' 표시 */}
            {!isAnyNightChecked && <span style={{ color: 'red' }}>미결제</span>}
          </div>

          {/* (2) 체크박스 그룹: flex-wrap 적용으로 여러 줄에 걸쳐 정렬 */}
          <div
            className="checkbox-group horizontal"
            style={{
              display: 'flex',
              flexWrap: 'wrap', // 줄바꿈
              gap: '8px', // 체크박스 간 간격
            }}
          >
            {Array.from({ length: diffDays }, (_, i) => i + 1).map((night) => (
              <label
                key={night}
                className="checkbox-label"
                style={{
                  width: '50px', // 라벨 고정 폭
                  textAlign: 'center', // 가운데 정렬
                }}
              >
                <input
                  type="checkbox"
                  checked={checkedNights.includes(night)}
                  onChange={() => handleNightCheck(night)}
                  disabled={isSubmitting}
                />
                {night}박
              </label>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="modal-row payment-details">
        <h4>다양한 결제 설정</h4>
        {formData.paymentDetails.map((detail, index) => (
          <div key={index} className="payment-detail-row">
            <select
              value={detail.method}
              onChange={(e) =>
                handlePaymentDetailChange(index, 'method', e.target.value)
              }
              disabled={isSubmitting}
            >
              <option value="Cash">현금</option>
              <option value="Card">카드</option>
              <option value="Account Transfer">계좌이체</option>
            </select>
            <input
              type="number"
              value={detail.amount || 0}
              onChange={(e) =>
                handlePaymentDetailChange(index, 'amount', e.target.value)
              }
              placeholder="금액"
              min="0"
              disabled={isSubmitting}
            />
            <input
              type="date"
              value={detail.date || ''}
              onChange={(e) =>
                handlePaymentDetailChange(index, 'date', e.target.value)
              }
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => handleRemovePaymentDetail(index)}
              disabled={isSubmitting}
            >
              제거
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAddPaymentDetail}
          disabled={isSubmitting}
        >
          결제 추가
        </button>
        <div className="payment-detail-row">
          <span>미결제분(잔여):</span>
          <input
            type="number"
            value={formData.remainingBalance.toLocaleString()}
            readOnly
            disabled
          />
        </div>
      </div>
    );
  };

  const isSaveDisabled =
    formData.paymentMethod === 'Various' &&
    formData.paymentDetails.length === 0;

  const handleClose = () => {
    onClose();
    if (initialData?.onComplete) {
      initialData.onComplete(); // onComplete 호출
    }
  };

  // 시간 변경 핸들러 추가 (체크인/체크아웃 시간 선택 시)
  const handleTimeChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // 체크인/체크아웃 날짜와 시간을 ISO 문자열로 업데이트
      if (name === 'checkInTime') {
        updated.checkIn = `${prev.checkInDate}T${value}:00+09:00`;
      } else if (name === 'checkOutTime') {
        updated.checkOut = `${prev.checkOutDate}T${value}:00+09:00`;
      }

      return updated;
    });
  }, []);

  return ReactDOM.createPortal(
    <div className="guest-form-modal">
      <div className="modal-card">
        {isSubmitting && (
          <div className="modal-overlay-spinner">처리 중...</div>
        )}
        <span className="close-button" onClick={onClose}>
          ×
        </span>
        <h2>
          {initialData?._id
            ? `예약 수정${
                initialData.roomNumber
                  ? ` (No: ${String(initialData.roomNumber)})`
                  : ''
              }`
            : '현장 예약'}
        </h2>
        {availabilityWarning && (
          <p style={{ color: 'red' }}>{availabilityWarning}</p>
        )}
        <form onSubmit={handleSubmit}>
          {/* 첫 번째 행: 예약자, 전화번호 */}
          <div className="modal-row">
            <label htmlFor="customerName">
              예약자:
              <input
                id="customerName"
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={(e) => {
                  setHasEditedCustomerName(true); // 입력이 시작되면 true
                  handleInputChange(e);
                }}
                onFocus={() => {
                  if (
                    !hasEditedCustomerName &&
                    formData.customerName.startsWith('현장:')
                  ) {
                    setFormData((prev) => ({ ...prev, customerName: '' }));
                  }
                }}
                disabled={isSubmitting}
              />
            </label>
            <label htmlFor="phoneNumber">
              전화번호:
              <input
                id="phoneNumber"
                type="text"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                required={
                  // 고객 이름이 "판매보류", "판매중단", "판매중지", "판매금지"인 경우엔 필수가 아님
                  !(
                    formData.customerName &&
                    ['판매보류', '판매중단', '판매중지', '판매금지'].includes(
                      formData.customerName.trim()
                    )
                  )
                }
                disabled={isSubmitting}
              />
            </label>
          </div>

          {/* 두 번째 행: 체크인(날짜), 체크인시간 */}
          <div className="modal-row">
            <label htmlFor="checkInDate">
              체크인:
              <input
                id="checkInDate"
                type="date"
                name="checkInDate"
                value={formData.checkInDate}
                onChange={handleCheckInDateChange}
                required
                disabled={isSubmitting}
              />
            </label>
            {/* 고객 이름이 "판매보류" 등일 경우 체크인 시간 입력 필드 숨김 */}
            {['판매보류', '판매중지', '판매중단', '판매금지'].includes(
              formData.customerName?.trim()
            ) ? null : (
              <label htmlFor="checkInTime">
                체크인시간:
                <input
                  id="checkInTime"
                  type="time"
                  name="checkInTime"
                  value={formData.checkInTime}
                  onChange={handleTimeChange}
                  disabled={isSubmitting}
                />
              </label>
            )}
          </div>

          {/* 세 번째 행: 체크아웃(날짜), 체크아웃시간 */}
          <div className="modal-row">
            <label htmlFor="checkOutDate">
              체크아웃:
              <input
                id="checkOutDate"
                type="date"
                name="checkOutDate"
                value={formData.checkOutDate}
                onChange={handleCheckOutDateChange}
                required
                disabled={isSubmitting}
              />
            </label>
            {/* 고객 이름이 "판매보류" 등일 경우 체크아웃 시간 입력 필드 숨김 */}
            {['판매보류', '판매중지', '판매중단', '판매금지'].includes(
              formData.customerName?.trim()
            ) ? null : (
              <label htmlFor="checkOutTime">
                체크아웃시간:
                <input
                  id="checkOutTime"
                  type="time"
                  name="checkOutTime"
                  value={formData.checkOutTime}
                  onChange={handleTimeChange}
                  disabled={isSubmitting}
                />
              </label>
            )}
          </div>

          {/* 예약시간(자동생성) 등 기타 필드 */}
          <div className="modal-row">
            <label htmlFor="reservationDate">
              예약시간:
              <input
                id="reservationDate"
                type="text"
                name="reservationDate"
                value={formData.reservationDate}
                readOnly
              />
            </label>
          </div>
          <div className="modal-row">
            <label htmlFor="roomInfo">
              객실타입:
              {initialData?._id ? (
                <input
                  id="roomInfo"
                  type="text"
                  name="roomInfo"
                  value={formData.roomInfo}
                  readOnly
                  disabled
                />
              ) : (
                <select
                  id="roomInfo"
                  name="roomInfo"
                  value={formData.roomInfo}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting}
                >
                  {filteredRoomTypes.map((rt) => {
                    const unavailable = isRoomTypeUnavailable(rt.roomInfo);
                    return (
                      <option
                        key={rt.roomInfo}
                        value={rt.roomInfo}
                        style={{ color: unavailable ? 'red' : 'inherit' }}
                      >
                        {rt.roomInfo} ({rt.price}원)
                      </option>
                    );
                  })}
                </select>
              )}
            </label>
            <label htmlFor="price">
              총가격: {Number(formData.price).toLocaleString()} (잔여:{' '}
              {displayedRemainingBalance.toLocaleString()})
              <input
                id="price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                required
                disabled={isSubmitting}
              />
            </label>
          </div>
          {renderPaymentMethodDropdown()}
          {renderPaymentDetails()}
          <div className="guest-form-actions">
            <button
              type="button"
              onClick={handleClose} // 수정된 handleClose 사용
              className="guest-form-button guest-form-cancel"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="guest-form-button guest-form-save"
              disabled={isSubmitting || isSaveDisabled}
            >
              {isSubmitting ? '처리 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.getElementById('modal-root')
  );
};

GuestFormModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialData: PropTypes.shape({
    _id: PropTypes.string,
    checkIn: PropTypes.string,
    checkOut: PropTypes.string,
    reservationNo: PropTypes.string,
    customerName: PropTypes.string,
    phoneNumber: PropTypes.string,
    reservationDate: PropTypes.string,
    roomInfo: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    paymentMethod: PropTypes.string,
    paymentDetails: PropTypes.array,
    specialRequests: PropTypes.string,
    roomNumber: PropTypes.string,
    onComplete: PropTypes.func, // onComplete 추가
  }),
  roomTypes: PropTypes.arrayOf(
    PropTypes.shape({
      roomInfo: PropTypes.string.isRequired,
      price: PropTypes.number.isRequired,
    })
  ).isRequired,
  availabilityByDate: PropTypes.object.isRequired,
  hotelSettings: PropTypes.object,
  hotelId: PropTypes.string.isRequired,
  selectedDate: PropTypes.instanceOf(Date),
  setAllReservations: PropTypes.func.isRequired,
  processReservation: PropTypes.func.isRequired,
  filterReservationsByDate: PropTypes.func.isRequired,
  allReservations: PropTypes.array.isRequired,
  setNewlyCreatedId: PropTypes.func.isRequired,
};
export default GuestFormModal;
