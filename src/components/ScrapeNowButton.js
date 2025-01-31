/* global chrome */
/**
 * ScrapeNowButton.js
 *
 * 한 개의 컴포넌트에서 "확장 기반 스크랩" + "서버(puppeteer) 기반 스크랩"을
 * 모두 처리하도록 통합한 예시.
 */

import React, { useState } from 'react';
import { FaClipboardCheck } from 'react-icons/fa';
import './ScrapeNowButton.css';

// 서버 API 호출 함수
import { enqueueScrapeTasks } from '../api/api';

// 확장 환경에서 사용할 액션 매핑
const ACTION_MAP = {
  Yanolja: 'TRIGGER_YANOLJA_SCRAPE',
  GoodMotel: 'TRIGGER_GOODMOTEL_SCRAPE',
  GoodHotel: 'TRIGGER_GOODHOTEL_SCRAPE',
  Agoda: 'TRIGGER_AGODA_SCRAPE',
  CoolStay: 'TRIGGER_COOLSTAY_SCRAPE',
  Booking: 'TRIGGER_BOOKING_SCRAPE',
  Expedia: 'TRIGGER_EXPEDIA_SCRAPE',
  // ... 필요한 OTAs 추가
};

// 확장으로 처리해야 할 OTA 목록
const EXTENSION_OTAS = [
  'Yanolja',
  'GoodMotel',
  'GoodHotel',
  'Agoda',
  'CoolStay',
  'Booking',
  'Expedia',
  // ...
];

// 서버쪽 Puppeteer로 처리해야 할 OTA 목록
const SERVER_OTAS = [''];

/**
 * [추가 설명]
 * Yanolja가 여기서는 EXTENSION_OTAS와 SERVER_OTAS에 겹쳐있는데,
 * 실제로 "어떤 OTA를 확장으로 처리할지, 어떤 OTA를 서버로 처리할지"는
 * 프로젝트 상황에 맞게 정렬 또는 중복 제거하시면 됩니다.
 */

function ScrapeNowButton({ hotelId, activeOTAs = [] }) {
  const [isScraping, setIsScraping] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const COOLDOWN_TIME = 10 * 1000; // 10초 쿨다운

  /**
   * (1) 확장으로 특정 OTA 스크랩 요청
   * @param {string} otaName
   * @returns {Promise<any>} 응답
   */
  const scrapeOneExtensionOTA = (otaName) => {
    return new Promise((resolve, reject) => {
      const EXTENSION_ID = 'bhfggeheelkddgmlegkppgpkmioldfkl'; // 실제 크롬 확장 ID
      const action =
        ACTION_MAP[otaName] || `TRIGGER_${otaName.toUpperCase()}_SCRAPE`;

      // 메시지 전송
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { action, hotelId },
        (response) => {
          if (chrome.runtime.lastError) {
            // 메시지 전송 자체가 실패(확장 미설치 등)
            console.error(
              '[ScrapeNowButton] runtime.lastError:',
              chrome.runtime.lastError.message
            );
            return reject(new Error(chrome.runtime.lastError.message));
          }
          // 응답 체크
          if (!response) {
            // 응답이 아예 없음
            reject(new Error(`No response from extension for ${otaName}`));
          } else if (!response.success) {
            // 응답이 왔지만 success:false
            reject(new Error(response.message || 'Unknown error'));
          } else {
            // success:true
            console.log(`[ScrapeNowButton] ${otaName} success:`, response);
            resolve(response);
          }
        }
      );
    });
  };

  /**
   * (2) 확장 기반 OTAs를 "중간에 실패해도" 계속 순차 처리
   * @param {string[]} otaList
   * @returns {Promise<Array<{otaName: string, success:boolean, message?:string}>>}
   */
  const scrapeExtensionOTAsSequential = async (otaList) => {
    const results = [];

    for (const otaName of otaList) {
      try {
        await scrapeOneExtensionOTA(otaName);
        results.push({ otaName, success: true });
      } catch (err) {
        console.warn(`[ScrapeNowButton] ${otaName} failed: ${err.message}`);
        results.push({ otaName, success: false, message: err.message });
        // 여기서 "throw"를 안 하면, 다음 OTA로 넘어갑니다.
        // 만약 "throw err"를 하면 중단되어버림.
      }
    }

    return results;
  };

  /**
   * (3) 메인 핸들러: 모든 OTAs 스크래핑
   */
  const handleScrapeNow = async () => {
    if (isScraping || cooldown) return;
    if (!activeOTAs || activeOTAs.length === 0) {
      alert('활성화된 OTA가 없습니다!');
      return;
    }

    // 1) 분리: 어떤 OTA가 확장용인지, 어떤 OTA가 서버용인지
    const extensionOTAsToScrape = activeOTAs.filter((ota) =>
      EXTENSION_OTAS.includes(ota)
    );
    const serverOTAsToScrape = activeOTAs.filter((ota) =>
      SERVER_OTAS.includes(ota)
    );

    // 확장환경 체크
    const isChromeExtensionEnv =
      typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';

    setIsScraping(true);

    // 결과 저장용
    const extensionResults = [];
    let serverResult = null;

    try {
      // (A) 확장OTAs 처리
      if (extensionOTAsToScrape.length > 0) {
        if (!isChromeExtensionEnv) {
          alert(
            '확장 기반 OTA 스크래핑이 필요하지만, 현재 환경은 Chrome 확장으로 실행 중이 아님'
          );
        } else {
          // 여러 개를 순차 처리하되, 하나 실패해도 다음으로
          const results = await scrapeExtensionOTAsSequential(
            extensionOTAsToScrape
          );
          extensionResults.push(...results);
        }
      }

      // (B) 서버OTAs 처리
      //  - 여기서는 "한번에" 서버 API를 호출.
      //  - 만약 OTA별로 따로 처리하고 싶다면 for문 돌며 enqueueScrapeTasks(ota)로직 작성 가능
      if (serverOTAsToScrape.length > 0) {
        try {
          const resp = await enqueueScrapeTasks(hotelId, serverOTAsToScrape);
          console.log('[ScrapeNowButton] serverOTAs response =>', resp);
          serverResult = { success: true, data: resp };
        } catch (err) {
          console.warn('[ScrapeNowButton] serverOTAs failed:', err);
          serverResult = { success: false, message: err.message };
        }
      }

      // (C) 최종 결과 요약
      //  - extensionResults 배열에는 {otaName, success, message?}들이 들어있음
      //  - serverResult에는 {success, message?} 형태 (복수 OTA를 서버가 처리)
      console.log('[ScrapeNowButton] Extension Results =>', extensionResults);
      console.log('[ScrapeNowButton] Server Result =>', serverResult);

      const failedExtension = extensionResults.filter((r) => !r.success);
      const failedServer =
        serverResult && !serverResult.success ? [serverResult] : [];

      // 어떤 식으로 알림(로그)을 띄울지는 자유
      if (failedExtension.length > 0 || failedServer.length > 0) {
        const failMsgs = [
          ...failedExtension.map(
            (f) => `${f.otaName} 실패: ${f.message || '원인 미상'}`
          ),
          ...failedServer.map(
            (f) => `서버 OTA 실패: ${f.message || '원인 미상'}`
          ),
        ].join('\n');
        alert(`일부 OTA 스크래핑이 실패했습니다:\n${failMsgs}`);
      } else {
        alert('모든 활성 OTA 스크래핑이 완료되었습니다!');
      }
    } catch (error) {
      console.error('[ScrapeNowButton] Fatal Error scraping:', error);
      alert(`스크래핑 도중 치명적 오류 발생: ${error.message}`);
    } finally {
      // (D) 완료 후
      setIsScraping(false);
      setCooldown(true);
      setTimeout(() => {
        setCooldown(false);
      }, COOLDOWN_TIME);
    }
  };

  return (
    <button
      className="scrape-now-button"
      onClick={handleScrapeNow}
      disabled={isScraping || cooldown}
    >
      {isScraping ? (
        <>
          <FaClipboardCheck style={{ color: 'red' }} />
          예약 확인중...
        </>
      ) : cooldown ? (
        <>
          <FaClipboardCheck style={{ color: 'green' }} />
          예약 가져오는중...
        </>
      ) : (
        <>
          <FaClipboardCheck style={{ marginRight: '4px' }} />
          새로운 예약 확인하기
        </>
      )}
    </button>
  );
}

export default ScrapeNowButton;
