import React from 'react';
import { toZonedTime } from 'date-fns-tz';
import PropTypes from 'prop-types';

// 날짜 유효성 검사 함수
export const validateDiscountDates = (startDate, endDate, language) => {
  if (!startDate || !endDate) {
    throw new Error(
      language === 'kor'
        ? '시작일과 종료일을 입력해주세요.'
        : 'Please enter both start and end dates'
    );
  }

  const startDateKST = toZonedTime(new Date(startDate), 'Asia/Seoul');
  const endDateKST = toZonedTime(new Date(endDate), 'Asia/Seoul');

  if (isNaN(startDateKST.getTime()) || isNaN(endDateKST.getTime())) {
    throw new Error(
      language === 'kor'
        ? '유효한 날짜를 입력해주세요.'
        : 'Please enter valid dates'
    );
  }

  if (startDateKST > endDateKST) {
    throw new Error(
      language === 'kor'
        ? '종료일은 시작일보다 이후이거나 같은 날짜여야 합니다.'
        : 'End date must be on or after start date'
    );
  }
};

// 할인 값 유효성 검사 함수
export const validateDiscountValue = (
  discountType,
  discountValue,
  isRandom,
  randomMin,
  randomMax,
  language
) => {
  const value = parseFloat(discountValue);
  if (isNaN(value)) {
    throw new Error(
      language === 'kor'
        ? '유효한 할인 값을 입력해주세요.'
        : 'Please enter a valid discount value'
    );
  }

  if (discountType === 'percentage') {
    if (value < 0 || value > 100) {
      throw new Error(
        language === 'kor'
          ? '할인율은 0에서 100 사이여야 합니다.'
          : 'Discount percentage must be between 0 and 100'
      );
    }
  } else if (discountType === 'fixed') {
    if (value <= 0) {
      throw new Error(
        language === 'kor'
          ? '할인 금액은 0보다 커야 합니다.'
          : 'Discount amount must be greater than 0'
      );
    }
  } else {
    throw new Error(
      language === 'kor'
        ? '유효한 할인 유형을 선택해주세요 (percentage 또는 fixed).'
        : 'Please select a valid discount type (percentage or fixed)'
    );
  }

  if (isRandom) {
    const min = parseFloat(randomMin);
    const max = parseFloat(randomMax);
    if (isNaN(min) || isNaN(max)) {
      throw new Error(
        language === 'kor'
          ? '랜덤 할인 값은 유효한 숫자여야 합니다.'
          : 'Random discount values must be valid numbers'
      );
    }
    if (min >= max) {
      throw new Error(
        language === 'kor'
          ? '최소 할인 값은 최대 할인 값보다 작아야 합니다.'
          : 'Minimum discount value must be less than maximum discount value'
      );
    }
    if (discountType === 'percentage') {
      if (min < 0 || max > 100) {
        throw new Error(
          language === 'kor'
            ? '랜덤 할인율은 0~100% 사이여야 합니다.'
            : 'Random discount percentage must be between 0 and 100'
        );
      }
    } else if (discountType === 'fixed') {
      if (min <= 0 || max <= 0) {
        throw new Error(
          language === 'kor'
            ? '랜덤 할인 금액은 0보다 커야 합니다.'
            : 'Random discount amount must be greater than 0'
        );
      }
    }
  }
};

// 할인 폼 필드 컴포넌트
export const DiscountFormFields = ({
  language,
  name,
  discountType,
  discountValue,
  onChange,
  roomTypes,
  applicableRoomTypes,
  onRoomTypeSelection,
  isLoading,
  onSameDayClick,
  startDate,
  endDate,
  showSameDayButton,
  autoValidity,
  validityDays,
}) => {
  return (
    <>
      <div className="hotel-settings-discount-field-row full-width">
        <label>
          {language === 'kor' ? '이름' : 'Name'}
          <input
            type="text"
            name="name"
            placeholder={
              language === 'kor' ? '이름을 입력하세요' : 'Enter name'
            }
            value={name}
            onChange={onChange}
            disabled={isLoading}
            required
          />
        </label>
      </div>
      <div className="hotel-settings-discount-field-row">
        <label>
          {language === 'kor' ? '할인 유형' : 'Discount Type'}
          <select
            name="discountType"
            value={discountType}
            onChange={onChange}
            disabled={isLoading}
          >
            <option value="percentage">
              {language === 'kor' ? '퍼센트 (%)' : 'Percentage (%)'}
            </option>
            <option value="fixed">
              {language === 'kor' ? '고정 금액 (원)' : 'Fixed Amount (₩)'}
            </option>
          </select>
        </label>
        <label>
          {language === 'kor' ? '할인 값' : 'Discount Value'}
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              name="discountValue"
              placeholder={
                language === 'kor' ? '할인 값' : 'Discount Value'
              }
              min="0"
              step="0.01"
              value={discountValue}
              onChange={onChange}
              disabled={isLoading}
              style={{ paddingRight: '30px' }}
              required
            />
            <span
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#666',
              }}
            >
              {discountType === 'percentage' ? '%' : '₩'}
            </span>
          </div>
        </label>
      </div>
      <div className="hotel-settings-discount-field-row">
        <label>
          {language === 'kor' ? '자동 유효기간 설정' : 'Auto Validity Period'}
          <input
            type="checkbox"
            name="autoValidity"
            checked={autoValidity}
            onChange={onChange}
            disabled={isLoading}
          />
        </label>
        {autoValidity && (
          <label>
            {language === 'kor' ? '유효 일수' : 'Validity Days'}
            <input
              type="number"
              name="validityDays"
              placeholder={
                language === 'kor' ? '유효 일수' : 'Validity Days'
              }
              min="1"
              value={validityDays}
              onChange={onChange}
              disabled={isLoading}
              required
            />
          </label>
        )}
      </div>
      <div className="hotel-settings-discount-field-row">
        <label>
          {language === 'kor' ? '시작일' : 'Start Date'}
          <input
            type="date"
            name="startDate"
            value={startDate}
            onChange={onChange}
            disabled={isLoading || autoValidity}
            required
          />
        </label>
        <label>
          {language === 'kor' ? '종료일' : 'End Date'}
          <input
            type="date"
            name="endDate"
            value={endDate}
            onChange={onChange}
            disabled={isLoading || autoValidity}
            required
          />
        </label>
        {showSameDayButton && (
          <button
            className="hotel-settings-discount-sameday-btn"
            onClick={onSameDayClick}
            disabled={isLoading}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '5px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              marginLeft: '10px',
            }}
          >
            {language === 'kor' ? '당일 설정' : 'Same Day'}
          </button>
        )}
      </div>
      <div className="hotel-settings-discount-field-row full-width">
        <label>
          {language === 'kor' ? '적용된 객실' : 'Applied Room Types'}
          <div className="hotel-settings-discount-room-types-checkbox">
            {roomTypes.map((roomType) => (
              <div
                key={roomType.roomInfo}
                className="hotel-settings-discount-room-type-checkbox-item"
              >
                <input
                  type="checkbox"
                  id={`room-type-${roomType.roomInfo}`}
                  checked={applicableRoomTypes.includes(roomType.roomInfo)}
                  onChange={() => onRoomTypeSelection(roomType.roomInfo)}
                  disabled={isLoading}
                />
                <label htmlFor={`room-type-${roomType.roomInfo}`}>
                  {language === 'kor' ? roomType.nameKor : roomType.nameEng}
                  <span className="room-type-stock">
                    ({language === 'kor' ? '재고' : 'Stock'} {roomType.stock}{' '}
                    {language === 'kor' ? '개' : 'rooms'})
                  </span>
                </label>
              </div>
            ))}
          </div>
        </label>
      </div>
    </>
  );
};

DiscountFormFields.propTypes = {
  language: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  discountType: PropTypes.string.isRequired,
  discountValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  roomTypes: PropTypes.array.isRequired,
  applicableRoomTypes: PropTypes.array.isRequired,
  onRoomTypeSelection: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  onSameDayClick: PropTypes.func.isRequired,
  startDate: PropTypes.string.isRequired,
  endDate: PropTypes.string.isRequired,
  showSameDayButton: PropTypes.bool,
  autoValidity: PropTypes.bool,
  validityDays: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

// 랜덤 할인 필드 컴포넌트
export const RandomDiscountFields = ({
  language,
  isRandom,
  randomMin,
  randomMax,
  discountType,
  onChange,
  isLoading,
}) => {
  return (
    <div className="hotel-settings-discount-field-row full-width">
      <label>
        <input
          type="checkbox"
          name="isRandom"
          checked={isRandom}
          onChange={onChange}
          disabled={isLoading}
        />
        {language === 'kor' ? '랜덤 할인 설정' : 'Random Discount Setting'}
      </label>
      {isRandom && (
        <>
          <label>
            {language === 'kor' ? '최소 값' : 'Min Value'}
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                name="randomMin"
                placeholder={language === 'kor' ? '최소 값' : 'Min Value'}
                min="0"
                step="0.01"
                value={randomMin}
                onChange={onChange}
                disabled={isLoading}
                style={{ paddingRight: '30px' }}
                required
              />
              <span
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#666',
                }}
              >
                {discountType === 'percentage' ? '%' : '₩'}
              </span>
            </div>
          </label>
          <label>
            {language === 'kor' ? '최대 값' : 'Max Value'}
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                name="randomMax"
                placeholder={language === 'kor' ? '최대 값' : 'Max Value'}
                min="0"
                step="0.01"
                value={randomMax}
                onChange={onChange}
                disabled={isLoading}
                style={{ paddingRight: '30px' }}
                required
              />
              <span
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#666',
                }}
              >
                {discountType === 'percentage' ? '%' : '₩'}
              </span>
            </div>
          </label>
        </>
      )}
    </div>
  );
};

RandomDiscountFields.propTypes = {
  language: PropTypes.string.isRequired,
  isRandom: PropTypes.bool.isRequired,
  randomMin: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  randomMax: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  discountType: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
};

// 조건 필드 컴포넌트
export const ConditionFields = ({
  language,
  condition,
  onChange,
  isLoading,
  showAutoDistribute,
  autoDistribute,
}) => {
  return (
    <div className="hotel-settings-discount-field-row full-width">
      <label>
        {language === 'kor' ? '조건 설정' : 'Condition Setting'}
        <select
          name="conditionType"
          value={condition.type}
          onChange={onChange}
          disabled={isLoading}
        >
          <option value="none">
            {language === 'kor' ? '없음' : 'None'}
          </option>
          <option value="visitCount">
            {language === 'kor' ? '방문 횟수' : 'Visit Count'}
          </option>
          <option value="topN">
            {language === 'kor' ? '상위 N명' : 'Top N Customers'}
          </option>
          <option value="priceRange">
            {language === 'kor' ? '가격 범위' : 'Price Range'}
          </option>
        </select>
      </label>
      {condition.type === 'visitCount' && (
        <label>
          {language === 'kor' ? '최소 방문 횟수' : 'Minimum Visits'}
          <input
            type="number"
            name="conditionValue"
            placeholder={
              language === 'kor' ? '최소 방문 횟수' : 'Minimum Visits'
            }
            min="1"
            value={condition.value || ''}
            onChange={onChange}
            disabled={isLoading}
            required
          />
        </label>
      )}
      {condition.type === 'topN' && (
        <label>
          {language === 'kor' ? '상위 N명' : 'Top N'}
          <input
            type="number"
            name="conditionValue"
            placeholder={language === 'kor' ? '상위 N명' : 'Top N'}
            min="1"
            value={condition.value || ''}
            onChange={onChange}
            disabled={isLoading}
            required
          />
        </label>
      )}
      {condition.type === 'priceRange' && (
        <>
          <label>
            {language === 'kor' ? '최소 가격' : 'Min Price'}
            <input
              type="number"
              name="minPrice"
              placeholder={language === 'kor' ? '최소 가격' : 'Min Price'}
              min="0"
              value={condition.minPrice || ''}
              onChange={onChange}
              disabled={isLoading}
            />
          </label>
          <label>
            {language === 'kor' ? '최대 가격' : 'Max Price'}
            <input
              type="number"
              name="maxPrice"
              placeholder={language === 'kor' ? '최대 가격' : 'Max Price'}
              min="0"
              value={condition.maxPrice || ''}
              onChange={onChange}
              disabled={isLoading}
            />
          </label>
        </>
      )}
      {showAutoDistribute && (
        <label>
          <input
            type="checkbox"
            name="autoDistribute"
            checked={autoDistribute}
            onChange={onChange}
            disabled={isLoading}
          />
          {language === 'kor' ? '자동 배포' : 'Auto Distribute'}
        </label>
      )}
    </div>
  );
};

ConditionFields.propTypes = {
  language: PropTypes.string.isRequired,
  condition: PropTypes.shape({
    type: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    minPrice: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    maxPrice: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  showAutoDistribute: PropTypes.bool,
  autoDistribute: PropTypes.bool,
};

// 할인 목록 아이템 컴포넌트
export const DiscountListItem = ({
  language,
  item,
  onEdit,
  onToggleStatus,
  onDelete,
  getMaxDiscount,
  roomTypes,
  isLoading,
  type,
  FaTrash,
}) => {
  const maxDiscount = getMaxDiscount(
    item.applicableRoomTypes[0],
    new Date()
  );
  return (
    <div className={`hotel-settings-${type}-item`}>
      <div className={`hotel-settings-${type}-item-header`}>
        <h3>{item.name || item.eventName}</h3>
        <div className={`hotel-settings-${type}-item-actions`}>
          <button
            className={`hotel-settings-${type}-edit-btn`}
            onClick={() => onEdit(item)}
            disabled={isLoading}
          >
            {language === 'kor' ? '수정' : 'Edit'}
          </button>
          <button
            className={`hotel-settings-${type}-status-btn ${
              item.isActive ? 'pause' : 'resume'
            }`}
            onClick={() => onToggleStatus(item.uuid)}
            disabled={isLoading}
          >
            {item.isActive
              ? language === 'kor'
                ? '일시중지'
                : 'Pause'
              : language === 'kor'
              ? '재개'
              : 'Resume'}
          </button>
          <button
            className={`hotel-settings-${type}-remove-btn`}
            onClick={() => onDelete(item.uuid)}
            disabled={isLoading}
          >
            <FaTrash />
          </button>
        </div>
      </div>
      <div style={{ marginBottom: '15px' }}>
        {type === 'coupon' && (
          <p>
            {language === 'kor' ? '쿠폰 코드' : 'Coupon Code'}:{' '}
            {item.code}
          </p>
        )}
        <p>
          {language === 'kor' ? '할인 유형' : 'Discount Type'}:{' '}
          {item.discountType === 'percentage'
            ? language === 'kor'
              ? '퍼센트 (%)'
              : 'Percentage (%)'
            : language === 'kor'
            ? '고정 금액 (원)'
            : 'Fixed Amount (₩)'}
        </p>
        <p>
          {language === 'kor' ? '할인 값' : 'Discount Value'}:{' '}
          {item.discountValue}
          {item.discountType === 'percentage' ? '%' : '원'}
          {maxDiscount.value > item.discountValue && (
            <span style={{ color: 'red', marginLeft: '8px' }}>
              ({language === 'kor' ? '최대 적용' : 'Max applied'}:{' '}
              {maxDiscount.value}
              {maxDiscount.type === 'fixed' ? '원' : '%'})
            </span>
          )}
        </p>
        {type === 'coupon' && (
          <>
            <p>
              {language === 'kor' ? '최대 사용 횟수' : 'Maximum Uses'}:{' '}
              {item.maxUses || '제한 없음'}
            </p>
            <p>
              {language === 'kor' ? '사용된 횟수' : 'Used Count'}:{' '}
              {item.usedCount || 0}
            </p>
            <p>
              {language === 'kor' ? '이벤트 중복 적용' : 'Stack with Events'}:{' '}
              {item.stackWithEvents
                ? language === 'kor'
                  ? '가능'
                  : 'Yes'
                : language === 'kor'
                ? '불가능'
                : 'No'}
            </p>
            {item.isRandom && (
              <p>
                {language === 'kor' ? '랜덤 할인 범위' : 'Random Discount Range'}:{' '}
                {item.randomMin} - {item.randomMax}
                {item.discountType === 'percentage' ? '%' : '원'}
              </p>
            )}
            {item.condition.type !== 'none' && (
              <p>
                {language === 'kor' ? '조건' : 'Condition'}:{' '}
                {item.condition.type === 'visitCount'
                  ? `${language === 'kor' ? '최소 방문 횟수' : 'Minimum Visits'}: ${item.condition.value}`
                  : item.condition.type === 'topN'
                  ? `${language === 'kor' ? '상위' : 'Top'} ${item.condition.value}${language === 'kor' ? '명' : ''}`
                  : item.condition.type === 'priceRange'
                  ? `${language === 'kor' ? '가격 범위' : 'Price Range'}: ${item.condition.minPrice || '0'}원 - ${item.condition.maxPrice || '제한 없음'}원`
                  : '없음'}
              </p>
            )}
          </>
        )}
        <p>
          {language === 'kor' ? '기간' : 'Period'}:{' '}
          {
            toZonedTime(new Date(item.startDate), 'Asia/Seoul')
              .toISOString()
              .split('T')[0]
          }{' '}
          -{' '}
          {
            toZonedTime(new Date(item.endDate), 'Asia/Seoul')
              .toISOString()
              .split('T')[0]
          }
        </p>
        <p>
          {language === 'kor' ? '상태' : 'Status'}:{' '}
          <span
            className={`hotel-settings-${type}-status ${
              item.isActive ? 'active' : 'inactive'
            }`}
          >
            {item.isActive
              ? language === 'kor'
                ? '활성화'
                : 'Active'
              : language === 'kor'
              ? '비활성화'
              : 'Inactive'}
          </span>
        </p>
      </div>
      <div style={{ marginTop: '20px', textAlign: 'left' }}>
        <h4
          style={{
            fontSize: '14px',
            fontWeight: 'normal',
            marginBottom: '10px',
            color: '#333',
          }}
        >
          {language === 'kor' ? '적용된 객실' : 'Applied Room Types'}
        </h4>
        <div>
          {item.applicableRoomTypes.map((roomTypeId) => {
            const appliedRoomType = roomTypes.find(
              (rt) => rt.roomInfo === roomTypeId
            );
            return (
              appliedRoomType && (
                <div
                  key={roomTypeId}
                  style={{
                    color: '#2B6CB0',
                    marginBottom: '8px',
                    fontSize: '14px',
                  }}
                >
                  {language === 'kor'
                    ? appliedRoomType.nameKor
                    : appliedRoomType.nameEng}
                </div>
              )
            );
          })}
        </div>
      </div>
    </div>
  );
};

DiscountListItem.propTypes = {
  language: PropTypes.string.isRequired,
  item: PropTypes.object.isRequired,
  onEdit: PropTypes.func.isRequired,
  onToggleStatus: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  getMaxDiscount: PropTypes.func.isRequired,
  roomTypes: PropTypes.array.isRequired,
  isLoading: PropTypes.bool.isRequired,
  type: PropTypes.string.isRequired,
};