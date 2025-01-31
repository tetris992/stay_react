// src/components/PrivacyConsentModal.js

import React, { useState } from 'react';
import './PrivacyConsentModal.css';
import { consentUser } from '../api/api';

/**
 * PrivacyConsentModal
 *
 * 이 모달은 호텔 측 사용자가 본 확장 프로그램에 대해
 * (1) 개인정보 수집 및 이용 동의와
 * (2) 서비스 제공 및 데이터 재가공 동의를
 * 두 가지 항목에 대해 명시적으로 동의하는 절차를 제공합니다.
 *
 * @prop {string} hotelId - 현재 호텔 ID
 * @prop {function} onClose - 모달 닫기 함수
 * @prop {function} onConsentComplete - 동의 완료 후 부모 컴포넌트에서 consentChecked=true로 반영하는 콜백
 */
function PrivacyConsentModal({ hotelId, onClose, onConsentComplete }) {
  // 각각의 동의 상태를 개별적으로 관리
  const [isPrivacyChecked, setIsPrivacyChecked] = useState(false);
  const [isServiceChecked, setIsServiceChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * handleConsent
   * - 두 동의 항목이 모두 체크되어 있는지 확인하고, 미체크 시 경고 메시지를 보여줍니다.
   * - 모두 체크되어 있으면 consentUser API를 호출하여 동의를 처리합니다.
   * - 성공 시 onConsentComplete 콜백을 호출합니다.
   */
  const handleConsent = async () => {
    if (!isPrivacyChecked || !isServiceChecked) {
      alert('모든 동의 항목에 체크하셔야 동의가 완료됩니다.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await consentUser(hotelId);
      // 동의 완료 후 alert를 제거하고, 단순히 onConsentComplete 호출
      if (onConsentComplete) {
        onConsentComplete();
      }
      onClose();
    } catch (err) {
      console.error('동의 처리 오류:', err);
      setError('동의 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="privacy-consent-modal">
      <div className="modal-content">
        <h2>개인정보 및 서비스 제공 동의</h2>

        <div className="policy-text">
          {/* [섹션 1] 개인정보 수집 및 이용 */}
          <h3>1. 개인정보 수집 및 이용</h3>
          <p>
            <strong>법적 근거:</strong> 개인정보 보호법 제15조제1항제4호 등 관련
            법령에 근거합니다.
          </p>
          <p>
            <strong>수집・이용 목적:</strong> 비즈니스 서비스 제공, 통합 로그인,
            고객 식별 및 본인 확인, 상담∙불만 처리, 불법∙부정 이용 방지 등.
          </p>
          <p>
            <strong>수집 항목:</strong> ID(이메일), 비밀번호, 이메일, 휴대폰
            번호, CI(연계 정보), 이름 등.
          </p>
          <p>
            <strong>보유・이용 기간:</strong> 계약 종료 시까지 또는 회원 탈퇴
            시까지, 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간까지.
          </p>

          {/* [섹션 2] 서비스 제공 및 데이터 재가공 */}
          <h3>2. 서비스 제공 및 데이터 재가공</h3>
          <p>
            본 확장 프로그램은 호텔 측이 이미 계약한 OTA 예약 정보를 재가공하여,
            호텔 경영에 도움을 주는 무료 서비스입니다.
          </p>
          <p>
            <strong>수집・이용 목적:</strong> 통합 로그인 제공, 예약 정보 스크랩
            및 분석, 객실 재고 관리 등.
          </p>
          <p>
            <strong>수집 항목:</strong> OTA 예약 정보(예약번호, 고객명, 객실정보
            등).
          </p>
          <p>
            <strong>보유・이용 기간:</strong> 계약 종료 시까지 또는 회원 탈퇴
            시까지, 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간까지.
          </p>

          {/* [섹션 3] 개인정보 제3자 제공 및 위탁 */}
          <h3>3. 개인정보 제3자 제공 및 위탁</h3>
          <p>
            호텔 측은 서비스 제공을 위해 필요한 경우, 고객의 개인정보를
            제3자에게 제공하거나 외부 업체에 위탁할 수 있습니다. 제공 및 위탁
            내역은 별도의 문서를 통해 확인하실 수 있으며, 모든 처리는 관련
            법령에 따라 엄격히 관리됩니다.
          </p>

          {/* [섹션 4] 개인정보 보유 및 파기 */}
          <h3>4. 개인정보 보유 및 파기</h3>
          <p>
            수집된 개인정보는 이용 목적 달성 또는 보유 기간 경과 시 지체 없이
            안전하게 파기됩니다. 단, 법령에 따라 개인정보를 일정 기간 보관해야
            하는 경우 해당 기간 동안 별도 보관됩니다.
          </p>

          {/* [섹션 5] 이용자의 권리 및 책임 */}
          <h3>5. 이용자의 권리 및 책임</h3>
          <p>
            이용자는 자신의 개인정보에 대해 열람, 정정, 삭제, 처리 정지 등을
            요구할 권리가 있으며, 서비스 내에서 회원정보 수정 또는 탈퇴가
            가능합니다.
          </p>

          {/* [섹션 6] 개인정보 안전성 확보 조치 */}
          <h3>6. 개인정보 안전성 확보 조치</h3>
          <p>
            본 서비스는 HTTPS 통신, 데이터 암호화, 접근 통제 등 다양한 기술적
            조치를 통해 개인정보의 안전한 처리를 보장합니다.
          </p>

          {/* [섹션 7] 쿠키 및 자동수집 장치 */}
          <h3>7. 쿠키 및 자동수집 장치</h3>
          <p>
            본 서비스는 쿠키를 비롯한 자동수집 장치를 사용하여 이용자의 접속
            정보 및 이용 패턴을 분석합니다. 쿠키 수집을 거부할 경우 일부 서비스
            이용에 제한이 있을 수 있습니다.
          </p>

          {/* [섹션 8] 개인정보 처리방침 개정 */}
          <h3>8. 개인정보 처리방침 개정</h3>
          <p>
            개인정보 처리방침은 관련 법령 및 서비스 운영 상황에 따라 개정될 수
            있으며, 개정 시 사전에 공지됩니다.
          </p>
        </div>

        <div className="consent-section">
          <div className="consent-item">
            <label>
              <input
                type="checkbox"
                checked={isPrivacyChecked}
                onChange={(e) => setIsPrivacyChecked(e.target.checked)}
              />
              <span>개인정보 수집 및 이용에 동의합니다.</span>
            </label>
          </div>
          <div className="consent-item">
            <label>
              <input
                type="checkbox"
                checked={isServiceChecked}
                onChange={(e) => setIsServiceChecked(e.target.checked)}
              />
              <span>
                서비스 제공 및 데이터 재가공에 관한 내용에 동의합니다.
              </span>
            </label>
          </div>
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="modal-buttons">
          <button onClick={handleConsent} disabled={loading}>
            {loading ? '동의 처리 중...' : '동의하기'}
          </button>
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

export default PrivacyConsentModal;
