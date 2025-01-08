// src/i18n.js

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 번역 리소스 정의
const resources = {
  en: {
    translation: {
      invoice: {
        title: 'Hotel Invoice',
        reservationNumber: 'Reservation Number',
        hotelAddress: 'Hotel Address',
        phoneNumber: 'Phone Number',
        email: 'Email',
        customerName: 'Customer Name',
        checkIn: 'Check-In',
        checkOut: 'Check-Out',
        reservationDate: 'Reservation Date',
        roomInfo: 'Room Information',
        specialRequests: 'Special Requests',
        memo: 'Memo',
        nightlyRates: 'Nightly Rates',
        date: 'Date',
        rate: 'Rate (KRW)',
        total: 'Total',
        thankYou: 'Thank you for staying with us.',
        edit: 'Edit',
        save: 'Save',
        download: 'Download',
        print: 'Print',
        infoUnavailable: 'Information Unavailable',
        none: 'None',
        price: 'Price',
        modalTitle: 'Invoice Modal',
        preview: 'Invoice Preview',
        close: 'Close',
        downloadFailed: 'Failed to download the invoice.',
        saveSuccess: 'Save successful.',
        saveFailed: 'Failed to save the invoice.',
      },
    },
  },
  ko: {
    translation: {
      invoice: {
        title: '호텔 인보이스',
        reservationNumber: '예약 번호',
        hotelAddress: '호텔 주소',
        phoneNumber: '전화번호',
        email: '이메일',
        customerName: '예약자 이름',
        checkIn: '체크인',
        checkOut: '체크아웃',
        reservationDate: '예약일',
        roomInfo: '객실 정보',
        specialRequests: '고객 요청',
        memo: '메모',
        nightlyRates: '숙박일별 요금',
        date: '날짜',
        rate: '요금 (원)',
        total: '합계',
        thankYou: '감사합니다.',
        edit: '수정',
        save: '저장',
        download: '다운로드',
        print: '프린트',
        infoUnavailable: '정보 없음',
        none: '없음',
        price: '가격',
        modalTitle: '인보이스 모달',
        preview: '인보이스 미리보기',
        close: '닫기',
        downloadFailed: '인보이스 다운로드에 실패했습니다.',
        saveSuccess: '저장이 완료되었습니다.',
        saveFailed: '인보이스 저장에 실패했습니다.',
      },
    },
  },
  zh: { // 중국어 간체 (Simplified Chinese)
    translation: {
      invoice: {
        title: '酒店发票',
        reservationNumber: '预订编号',
        hotelAddress: '酒店地址',
        phoneNumber: '电话号码',
        email: '电子邮件',
        customerName: '客户姓名',
        checkIn: '入住',
        checkOut: '退房',
        reservationDate: '预订日期',
        roomInfo: '房间信息',
        specialRequests: '特别要求',
        memo: '备忘录',
        nightlyRates: '每日房价',
        date: '日期',
        rate: '房价 (韩元)',
        total: '总计',
        thankYou: '感谢您选择我们的酒店。',
        edit: '编辑',
        save: '保存',
        download: '下载',
        print: '打印',
        infoUnavailable: '信息不可用',
        none: '无',
        price: '价格',
        modalTitle: '发票模态',
        preview: '发票预览',
        close: '关闭',
        downloadFailed: '发票下载失败。',
        saveSuccess: '保存成功。',
        saveFailed: '发票保存失败。',
      },
    },
  },
  ja: { // 일본어 (Japanese)
    translation: {
      invoice: {
        title: 'ホテル請求書',
        reservationNumber: '予約番号',
        hotelAddress: 'ホテル住所',
        phoneNumber: '電話番号',
        email: 'メール',
        customerName: '予約者名',
        checkIn: 'チェックイン',
        checkOut: 'チェックアウト',
        reservationDate: '予約日',
        roomInfo: '部屋情報',
        specialRequests: '特別リクエスト',
        memo: 'メモ',
        nightlyRates: '宿泊料金',
        date: '日付',
        rate: '料金 (韓国ウォン)',
        total: '合計',
        thankYou: 'ご利用いただきありがとうございます。',
        edit: '編集',
        save: '保存',
        download: 'ダウンロード',
        print: '印刷',
        infoUnavailable: '情報なし',
        none: 'なし',
        price: '価格',
        modalTitle: '請求書モーダル',
        preview: '請求書プレビュー',
        close: '閉じる',
        downloadFailed: '請求書のダウンロードに失敗しました。',
        saveSuccess: '保存が完了しました。',
        saveFailed: '請求書の保存に失敗しました。',
      },
    },
  },
};

// i18n 초기화
i18n
  .use(LanguageDetector) // 언어 감지 플러그인 사용
  .use(initReactI18next) // react-i18next를 사용하도록 설정
  .init({
    resources,
    fallbackLng: 'ko', // 언어 리소스가 없을 경우 사용할 언어
    debug: false, // 개발 시 true로 설정하면 콘솔에 디버그 로그가 표시됩니다.
    interpolation: {
      escapeValue: false, // React는 이미 XSS 보호를 제공하므로 false로 설정
    },
    detection: {
      // 언어 감지 옵션
      order: ['localStorage', 'cookie', 'navigator'], // 감지 순서
      caches: ['localStorage', 'cookie'], // 언어를 저장할 위치
    },
  });

export default i18n;
