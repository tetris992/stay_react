// src/components/PrivacyConsentModal.js

import React, { useState } from 'react';
import './PrivacyConsentModal.css';
import { consentUser } from '../api/api';

/**
 * PrivacyConsentModal
 *
 * @prop {string} hotelId - 현재 호텔 ID
 * @prop {function} onClose - 모달 닫기 함수
 * @prop {function} onConsentComplete - 동의 완료 후 부모 컴포넌트에서 consentChecked=true로 반영하게 하는 콜백
 */
function PrivacyConsentModal({ hotelId, onClose, onConsentComplete }) {
  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * 개인정보처리방침 동의 버튼 클릭 핸들러
   * - 체크박스 미동의 시 알림
   * - /auth/consent?hotelId=... 로 POST 요청
   * - 성공 시 부모 콜백(onConsentComplete) 호출
   */
  const handleConsent = async () => {
    if (!isChecked) {
      alert('개인정보 처리방침에 동의하시려면 체크박스를 먼저 선택하세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await consentUser(hotelId); // <-- api.js에서 만든 함수 호출
      alert('개인정보 동의가 완료되었습니다.');
      if (onConsentComplete) {
        onConsentComplete();
      }
    } catch (err) {
      console.error('개인정보 동의 오류:', err);
      setError('개인정보 동의 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="privacy-consent-modal">
      <div className="modal-content">
        <h2>개인정보처리방침</h2>

        <div className="policy-text">
          <h3>1) 개요</h3>
          <p>
            본 확장 프로그램인 Staysync(이하 ‘확장 프로그램’이라 함)은 “호텔
            예약 정보 스크랩” 기능을 제공합니다. 사용자가 직접 로그인한 호텔
            예약 관리 사이트들(야놀자, 여기어때, 아고다, 부킹닷컴 등)에 접속 후,
            해당 계정에 한하여 예약 정보를 자동으로 읽어와, 지정된 서버(본인이
            연동한 백오피스 서버)에 전달하는 역할을 합니다.
          </p>
          <p>
            본 확장 프로그램은 Chrome Web Store의 개발자 프로그램 정책 및
            개인정보 취급 관련 정책을 준수하며, 사용자 데이터를
            수집·이용·보관·전송하는 전 과정에서 사용자 동의 범위 내에서 최소한의
            정보를 안전하게 취급합니다.
          </p>

          <h3>2) 수집하는 개인정보 항목 및 방법</h3>
          <p>
            <strong>수집 항목</strong>:
          </p>
          <ul>
            <li>
              예약 관련 정보: 고객명, 고객 전화번호, 예약번호, 체크인·체크아웃
              날짜, 객실 정보, 예약 상태(Confirmed 등), 예약 사이트(OTA 이름)
            </li>
            <li>
              인증 정보: 확장 프로그램 내부에서 발급·보관하는 Access
              Token(백엔드 API 연동용)
            </li>
            <li>
              쿠키, 탭, 스토리지 등: Chrome 확장 프로그램이 동작하는 데 필요한
              최소한의 기술 정보
            </li>
          </ul>
          <p>
            <strong>수집 방법</strong>:
          </p>
          <ul>
            <li>
              사용자가 직접 로그인한 OTA(야놀자, 여기어때, Agoda 등)의 웹페이지
              구조를 스크래핑하여, 예약 테이블 정보를 추출합니다.
            </li>
            <li>
              추출된 정보는 사용자가 지정한 서버(백오피스 API)로 HTTPS 통신을
              통해 전송됩니다.
            </li>
          </ul>

          <h3>3) 개인정보의 이용 목적</h3>
          <p>
            <strong>예약 관리 및 연동</strong>: 호텔(또는 숙소) 운영자가 본 확장
            프로그램을 통해 자동으로 예약정보를 수집하고, 본인의 백오피스
            시스템과 연동하여 객실 재고 관리, 예약 확인 등을 수행할 수 있습니다.
          </p>
          <p>
            <strong>서비스 제공 및 유지보수</strong>: 예약 데이터를 자동
            전송하여, 호텔 운영 업무를 효율화하기 위한 목적으로만 사용됩니다.
          </p>

          <h3>4) 개인정보의 처리 및 보유 기간</h3>
          <p>
            본 확장 프로그램은 사용자 로컬 Chrome 스토리지에 최소한의 정보를
            보관(예: accessToken, otaToggles)하며, 이 정보는 사용자가 확장
            프로그램을 제거하거나, chrome.storage.local을 직접 초기화할 때까지
            유지됩니다.
            <br />
            예약 정보(고객명, 전화번호 등)는 확장 프로그램 내부에 영구 저장되지
            않으며, 오직 스크랩 직후
            <em>“전송용”</em>으로만 일시적으로 보관 후, 사용자(호텔)가 지정한
            서버로 전송하고 폐기합니다.
            <br />
            실제 예약 정보는 귀하(또는 귀사가) 직접 운영하시는 서버에
            저장되므로, 해당 서버의 보관 정책에 따라 처리·보관됩니다.
          </p>

          <h3>5) 개인정보의 제3자 제공 및 위탁</h3>
          <p>
            본 확장 프로그램은 “사용자(호텔/숙소) 본인의 백오피스 서버” 이외의
            제3자에게 고객 정보를 판매·제공하거나 공유하지 않습니다.
            <br />
            단, 아래와 같은 예외적인 경우에는 제한적으로 정보를 제공할 수
            있습니다.
          </p>
          <ol>
            <li>이용자가 사전에 동의를 한 경우</li>
            <li>
              법령에 의하여 정해진 절차와 방법에 따라 수사기관 및 관련 기관의
              요청이 있는 경우
            </li>
            <li>
              서비스의 기술적 장애·오류 등의 대응을 위해 외부 전문가에게
              한시적으로 맡겨야 할 때
            </li>
          </ol>

          <h3>6) 개인정보의 안전성 확보 조치</h3>
          <p>
            <strong>전송 구간 암호화(HTTPS)</strong>: 확장 프로그램에서 예약
            데이터를 전송할 때, HTTPS 프로토콜을 통해 암호화하여 송수신합니다.
          </p>
          <p>
            <strong>최소 권한 원칙</strong>: 확장 프로그램은 호텔 예약정보
            스크랩에 필요한 ‘tabs’, ‘activeTab’, ‘storage’ 등 최소한의 권한만
            요청하고, 불필요한 권한은 요구하지 않습니다.
          </p>
          <p>
            <strong>로컬 스토리지 관리</strong>: 로컬에 저장되는 accessToken
            등도 Chrome의 storage.local에 안전하게 보관되며, 사용자가 확장
            프로그램을 삭제하거나 수동 삭제할 경우 폐기됩니다.
          </p>

          <h3>7) 사용자의 권리</h3>
          <p>
            사용자는 본 확장 프로그램을 언제든지 설치·제거할 수 있으며, 확장
            프로그램 로컬 저장소(chrome.storage.local)를 수동으로 초기화할 수
            있습니다.
            <br />
            만약 OTA 계정 정보, 호텔 백오피스 서버 등의 중단을 원하시면, 확장
            프로그램 사용을 중단하고, 관련 계정 사용을 해지·철회할 수 있습니다.
          </p>

          <h3>8) 쿠키(Cookies)에 대한 안내</h3>
          <p>
            본 확장 프로그램 자체가 별도의 쿠키를 발급·저장하지 않으며,{' '}
            <em>사용자가 로그인한 OTA 사이트</em>에서 발급하는 쿠키는 사용자
            컴퓨터에 저장됩니다.
            <br />
            확장 프로그램은 “사용자가 이미 로그인되어 있는 세션”을 활용하기 위해
            쿠키에 접근할 수 있으나, 이 쿠키 정보는 순전히 해당 OTA 사이트를
            열람하기 위한 목적에만 사용됩니다.
          </p>

          <h3>9) 문의 방법</h3>
          <p>
            개인정보 관련 문의가 있는 경우, 아래 담당자에게 문의해 주시기
            바랍니다.
            <br />
            담당 부서: 개인정보처리담당자
            <br />
            이메일: admin@ztoone.co.kr
            <br />
            전화: 070-8065-1554
            <br />본 개인정보처리방침은 2025.01.01 부터 적용됩니다.
          </p>
        </div>

        <div className="consent-section">
          <p className="consent-question">
            위 개인정보 처리방침에 동의하시겠습니까 ?{' '}
          </p>
          <label>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
            />
          </label>
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="modal-buttons">
          <button onClick={handleConsent} disabled={loading}>
            {loading ? '동의 중...' : '동의하기'}
          </button>
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

export default PrivacyConsentModal;
