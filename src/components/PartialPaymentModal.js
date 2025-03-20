import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { payPartial } from '../api/api'; // payPartial 임포트 추가
import './PartialPaymentModal.css';

const PartialPaymentModal = ({ reservation, onClose, onUpdate }) => {
  const [checkedNights, setCheckedNights] = useState([]);
  const [customPayments, setCustomPayments] = useState([]);
  const [customAmount, setCustomAmount] = useState('');
  const [customMethod, setCustomMethod] = useState('Cash');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayedRemainingBalance, setDisplayedRemainingBalance] = useState(
    reservation.remainingBalance || reservation.price || 0
  );

  const checkInDate = new Date(reservation.checkIn);
  const checkOutDate = new Date(reservation.checkOut);
  const diffDays = Math.floor(
    (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)
  );
  const totalPrice = reservation.price || 0;
  const remainingBalance =
    reservation.remainingBalance !== undefined
      ? reservation.remainingBalance
      : totalPrice;
  const paidAmount = reservation.paymentHistory
    ? reservation.paymentHistory.reduce((sum, p) => sum + p.amount, 0)
    : 0;
  const perNightPrice =
    diffDays > 0 ? Math.round(totalPrice / diffDays) : totalPrice;

  const handleNightCheck = useCallback((night) => {
    setCheckedNights((prev) =>
      prev.includes(night) ? prev.filter((n) => n !== night) : [...prev, night]
    );
    setErrorMessage('');
  }, []);

  const addCustomPayment = useCallback(() => {
    const amount = Number(customAmount);
    if (!amount || amount <= 0) {
      setErrorMessage('유효한 금액을 입력해주세요. 금액은 0보다 커야 합니다.');
      return;
    }

    const currentTotal = customPayments.reduce((sum, p) => sum + p.amount, 0);
    const checkedAmount = perNightPrice * checkedNights.length;
    const totalAmount = currentTotal + checkedAmount + amount;
    if (totalAmount > remainingBalance) {
      setErrorMessage(
        `입력한 금액(${totalAmount.toLocaleString()}원)이 남은 잔액(${remainingBalance.toLocaleString()}원)을 초과합니다.`
      );
      return;
    }

    setCustomPayments((prev) => [
      ...prev,
      { amount, method: customMethod || 'Cash' },
    ]);
    setCustomAmount('');
    setCustomMethod('Cash');
    setErrorMessage('');
  }, [
    customAmount,
    customMethod,
    customPayments,
    checkedNights,
    perNightPrice,
    remainingBalance,
  ]);

  const updateCustomPaymentMethod = useCallback(
    (index, method) => {
      const updated = [...customPayments];
      updated[index].method = method;
      setCustomPayments(updated);
      setErrorMessage('');
    },
    [customPayments]
  );

  const removeCustomPayment = useCallback((index) => {
    setCustomPayments((prev) => prev.filter((_, i) => i !== index));
    setErrorMessage('');
  }, []);

  // 실시간 잔여 금액 업데이트
  useEffect(() => {
    const checkedAmount = perNightPrice * checkedNights.length;
    const customTotal = customPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalDeduction = checkedAmount + customTotal;
    const newRemaining = remainingBalance - totalDeduction;
    setDisplayedRemainingBalance(newRemaining >= 0 ? newRemaining : 0);
  }, [checkedNights, customPayments, perNightPrice, remainingBalance]);

  const handlePayPartial = useCallback(async () => {
    let payments = [];

    if (checkedNights.length > 0) {
      const amount = perNightPrice * checkedNights.length;
      payments.push({ amount, method: 'Cash' });
    }

    payments = [...payments, ...customPayments];

    if (payments.length === 0) {
      setErrorMessage('결제할 금액을 선택하거나 입력해주세요.');
      return;
    }

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    if (totalAmount > remainingBalance) {
      setErrorMessage(
        `결제 금액(${totalAmount.toLocaleString()}원)이 남은 잔액(${remainingBalance.toLocaleString()}원)을 초과합니다.`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      console.log('[handlePayPartial] Calling payPartial with:', {
        reservationId: reservation._id,
        hotelId: reservation.hotelId,
        payments,
      });
      const response = await payPartial(
        reservation._id,
        reservation.hotelId,
        payments
      );

      onUpdate(response.reservation);
      setCheckedNights([]);
      setCustomPayments([]);
      setCustomAmount('');
      setCustomMethod('Cash');
      alert('부분 결제가 완료되었습니다.');
      onClose();
    } catch (error) {
      console.error('결제 실패:', error);
      setErrorMessage(error.message || '결제 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    checkedNights,
    customPayments,
    perNightPrice,
    remainingBalance,
    reservation._id,
    reservation.hotelId,
    onUpdate,
    onClose,
  ]);

  const handleClose = () => {
    if (isSubmitting) return;
    setCheckedNights([]);
    setCustomPayments([]);
    setCustomAmount('');
    setCustomMethod('Cash');
    setErrorMessage('');
    onClose();
  };

  return ReactDOM.createPortal(
    <div className="partial-payment-modal">
      <div className="modal-card">
        {isSubmitting && (
          <div className="modal-overlay-spinner">처리 중...</div>
        )}
        <span className="close-button" onClick={handleClose}>
          ×
        </span>
        <h2>부분 결제</h2>

        <div className="modal-section">
          <h3>결제 정보</h3>
          <p>총 금액: {totalPrice.toLocaleString()} 원</p>
          <p>기 결제액: {paidAmount.toLocaleString()} 원</p>
          <p>남은 잔액: {displayedRemainingBalance.toLocaleString()} 원</p>
          <p>결제 상태: {reservation.paymentStatus || '미결제'}</p>
        </div>

        {reservation.paymentHistory?.length > 0 && (
          <div className="modal-section">
            <h3>결제 이력</h3>
            <table className="payment-history-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>금액</th>
                  <th>결제 방식</th>
                </tr>
              </thead>
              <tbody>
                {reservation.paymentHistory.map((payment, idx) => (
                  <tr key={idx}>
                    <td>{payment.date}</td>
                    <td>{payment.amount.toLocaleString()} 원</td>
                    <td>{payment.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-section">
          <h3>결제 추가</h3>

          {diffDays > 1 && (
            <div className="payment-option">
              <p>1박당 가격: {perNightPrice.toLocaleString()} 원</p>
              <div className="checkbox-group">
                {Array.from({ length: diffDays }, (_, i) => i + 1).map(
                  (night) => (
                    <label key={night} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={checkedNights.includes(night)}
                        onChange={() => handleNightCheck(night)}
                        disabled={isSubmitting}
                      />
                      {night}박
                    </label>
                  )
                )}
              </div>
            </div>
          )}

          <div className="payment-option">
            <h4>직접 입력</h4>
            <div className="input-group">
              <input
                type="number"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="결제 금액 입력"
                min="0"
                disabled={isSubmitting}
              />
              <select
                value={customMethod}
                onChange={(e) => {
                  setCustomMethod(e.target.value);
                  setErrorMessage('');
                }}
                disabled={isSubmitting}
              >
                <option value="Cash">현금</option>
                <option value="Card">카드</option>
                <option value="BankTransfer">계좌이체</option>
                <option value="Point">포인트</option>
              </select>
              <button
                type="button"
                onClick={addCustomPayment}
                disabled={isSubmitting}
                className="add-payment-button"
              >
                결제 추가
              </button>
            </div>
          </div>

          {customPayments.length > 0 && (
            <div className="payment-option">
              <h4>추가된 결제</h4>
              {customPayments.map((payment, index) => (
                <div key={index} className="payment-item">
                  <span>{payment.amount.toLocaleString()} 원</span>
                  <select
                    value={payment.method}
                    onChange={(e) =>
                      updateCustomPaymentMethod(index, e.target.value)
                    }
                    disabled={isSubmitting}
                  >
                    <option value="Cash">현금</option>
                    <option value="Card">카드</option>
                    <option value="BankTransfer">계좌이체</option>
                    <option value="Point">포인트</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeCustomPayment(index)}
                    disabled={isSubmitting}
                    className="remove-payment-button"
                  >
                    제거
                  </button>
                </div>
              ))}
            </div>
          )}

          {errorMessage && <div className="error-message">{errorMessage}</div>}

          <div className="modal-actions">
            <button
              type="button"
              onClick={handlePayPartial}
              disabled={isSubmitting}
              className="submit-button"
            >
              {isSubmitting ? '처리 중...' : '저장'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="cancel-button"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root')
  );
};

PartialPaymentModal.propTypes = {
  reservation: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    hotelId: PropTypes.string.isRequired,
    checkIn: PropTypes.string.isRequired,
    checkOut: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    paymentHistory: PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.string.isRequired,
        amount: PropTypes.number.isRequired,
        timestamp: PropTypes.string.isRequired,
        method: PropTypes.string.isRequired,
      })
    ),
    remainingBalance: PropTypes.number,
    paymentStatus: PropTypes.string,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
};

export default PartialPaymentModal;
