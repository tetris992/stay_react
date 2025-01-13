/* global chrome */
/**
 * ScrapeNowButton.js
 *
 * 한 개의 컴포넌트에서 "확장 기반 스크랩" + "서버(puppeteer) 기반 스크랩"을
 * 모두 처리하도록 통합 예시.
 */

import React, { useState } from 'react';
import { FaClipboardCheck } from 'react-icons/fa';
import './ScrapeNowButton.css';

// 서버 API 호출 함수
import { enqueueScrapeTasks } from '../api/api';

// 확장 환경에서 사용할 액션 매핑
const ACTION_MAP = {
  GoodMotel: 'TRIGGER_GOODMOTEL_SCRAPE',
  GoodHotel: 'TRIGGER_GOODHOTEL_SCRAPE',
  Agoda: 'TRIGGER_AGODA_SCRAPE',
  CoolStay: 'TRIGGER_COOLSTAY_SCRAPE',
  Booking: 'TRIGGER_BOOKING_SCRAPE',
  Expedia: 'TRIGGER_EXPEDIA_SCRAPE',
  // 필요 OTAs 추가
};

// (가정) 확장으로 처리해야 할 OTA 목록
const EXTENSION_OTAS = [
  'GoodMotel',
  'GoodHotel',
  'Agoda',
  'CoolStay',
  'Booking',
  'Expedia',
  // ...
];

// (가정) 서버쪽 Puppeteer로 처리해야 할 OTA 목록 (예: Yanolja, ...)
const SERVER_OTAS = ['Yanolja'];

function ScrapeNowButton({ hotelId, activeOTAs = [] }) {
  const [isScraping, setIsScraping] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const COOLDOWN_TIME = 10 * 1000; // 10초 쿨다운

  /**
   * 확장으로 스크랩을 요청하는 함수
   * (기존 chrome.runtime.sendMessage 로직 그대로 사용)
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
            console.error(
              '[ScrapeNowButton] runtime.lastError:',
              chrome.runtime.lastError.message
            );
            return reject(new Error(chrome.runtime.lastError.message));
          }
          if (response && response.success) {
            console.log(`[ScrapeNowButton] ${otaName} success:`, response);
            resolve(response);
          } else {
            console.error(`[ScrapeNowButton] ${otaName} failed:`, response);
            reject(new Error(response?.message || 'Unknown error'));
          }
        }
      );
    });
  };

  /**
   * 전체 스크랩 흐름:
   *  1) activeOTAs 중 확장으로 처리할 것(EXTENSION_OTAS 교집합) 구분
   *  2) activeOTAs 중 서버로 처리할 것(SERVER_OTAS 교집합) 구분
   *  3) 각각 순차적으로 처리
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

    try {
      // (A) 확장OTAs 처리
      if (extensionOTAsToScrape.length > 0) {
        if (!isChromeExtensionEnv) {
          // 확장환경이 아닌데 확장 OTA가 활성화되어 있으면 에러
          alert('확장스크랩 OTAs가 있지만 확장환경이 아님');
        } else {
          // 순차 처리
          for (const otaName of extensionOTAsToScrape) {
            await scrapeOneExtensionOTA(otaName);
          }
          console.log('확장 스크랩 OTAs 처리 완료.');
        }
      }

      // (B) 서버OTAs 처리
      if (serverOTAsToScrape.length > 0) {
        // 서버 API 호출
        // (enqueueScrapeTasks는 => await enqueueScrapeTasks(hotelId, serverOTAsToScrape);
        await enqueueScrapeTasks(hotelId, serverOTAsToScrape);
        console.log('서버 스크랩 OTAs 처리 완료.');
      }

      console.log('모든 활성 OTA 스크래핑이 완료되었습니다.');
    } catch (error) {
      console.error('[ScrapeNowButton] Error scraping:', error);
      alert(`스크래핑 중 오류 발생: ${error.message}`);
    } finally {
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
