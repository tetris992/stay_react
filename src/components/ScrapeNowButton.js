/* global chrome */
import React, { useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import './ScrapeNowButton.css';

const ACTION_MAP = {
  YanoljaMotel: 'TRIGGER_YANOLJA_SCRAPE',
  GoodMotel: 'TRIGGER_GOODMOTEL_SCRAPE',
  GoodHotel: 'TRIGGER_GOODHOTEL_SCRAPE',
  Agoda: 'TRIGGER_AGODA_SCRAPE',
  CoolStay: 'TRIGGER_COOLSTAY_SCRAPE',
  Booking: 'TRIGGER_BOOKING_SCRAPE',
  Expedia: 'TRIGGER_EXPEDIA_SCRAPE',
};

const EXTENSION_OTAS = [
  'YanoljaMotel',
  'GoodMotel',
  'GoodHotel',
  'Agoda',
  'CoolStay',
  'Booking',
  'Expedia',
];

function ScrapeNowButton({ hotelId, activeOTAs = [] }) {
  const [isScraping, setIsScraping] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const COOLDOWN_TIME = 10 * 1000;

  const scrapeOneExtensionOTA = (otaName) => {
    const accessToken = localStorage.getItem('accessToken');

    return new Promise((resolve, reject) => {
      const EXTENSION_ID =
        process.env.REACT_APP_EXTENSION_ID ||
        'cnoicicjafgmfcnjclhlehfpojfaelag'; // 개발자 bhfggeheelkddgmlegkppgpkmioldfkl  배포용  cnoicicjafgmfcnjclhlehfpojfaelag
      const action =
        ACTION_MAP[otaName] || `TRIGGER_${otaName.toUpperCase()}_SCRAPE`;

      if (!accessToken) {
        reject(new Error('Access token is missing or expired'));
        return;
      }

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { action, hotelId, accessToken },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              '[ScrapeNowButton] runtime.lastError:',
              chrome.runtime.lastError.message
            );
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response) {
            reject(new Error(`No response from extension for ${otaName}`));
          } else if (!response.success) {
            reject(new Error(response.message || 'Unknown error'));
          } else {
            console.log(`[ScrapeNowButton] ${otaName} success:`, response);
            resolve(response);
          }
        }
      );
    });
  };

  const scrapeExtensionOTAsSequential = async (otaList) => {
    const results = [];
    for (const otaName of otaList) {
      try {
        await scrapeOneExtensionOTA(otaName);
        results.push({ otaName, success: true });
      } catch (err) {
        console.warn(`[ScrapeNowButton] ${otaName} failed: ${err.message}`);
        results.push({ otaName, success: false, message: err.message });
      }
    }
    return results;
  };

  const handleScrapeNow = async () => {
    if (isScraping || cooldown) return;
    if (!activeOTAs || activeOTAs.length === 0) {
      alert('활성화된 OTA가 없습니다!');
      return;
    }

    const extensionOTAsToScrape = activeOTAs.filter((ota) =>
      EXTENSION_OTAS.includes(ota)
    );
    const isChromeExtensionEnv =
      typeof chrome !== 'undefined' && chrome.runtime;

    if (!isChromeExtensionEnv) {
      alert('이 기능은 Chrome 확장 환경에서만 동작합니다.');
      return;
    }

    if (extensionOTAsToScrape.length === 0) {
      alert('선택된 OTA는 확장에서 처리되지 않습니다.');
      return;
    }

    setIsScraping(true);

    try {
      const results = await scrapeExtensionOTAsSequential(
        extensionOTAsToScrape
      );
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        const failMsgs = failed
          .map((f) => `${f.otaName} 실패: ${f.message || '원인 미상'}`)
          .join('\n');
        alert(`일부 OTA 스크래핑이 실패했습니다:\n${failMsgs}`);
      } else {
        alert('모든 활성 OTA 스크래핑이 완료되었습니다!');
      }
    } catch (error) {
      console.error('[ScrapeNowButton] Fatal Error scraping:', error);
      alert(`스크래핑 도중 오류 발생: ${error.message}`);
    } finally {
      setIsScraping(false);
      setCooldown(true);
      setTimeout(() => setCooldown(false), COOLDOWN_TIME);
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
          <FaSearch style={{ color: 'red' }} />
          예약 확인중...
        </>
      ) : cooldown ? (
        <>
          <FaSearch style={{ color: 'green' }} />
          예약 가져오는중...
        </>
      ) : (
        <>
          <FaSearch style={{ marginRight: '0px' }} />
          <p className="res-text">OTA 예약 확인하기</p>
        </>
      )}
    </button>
  );
}

export default ScrapeNowButton;
