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
      privacyConsent: {
        title: 'Privacy Policy',
        overview: '1) Overview',
        overviewContent:
          "This extension, Staysync (hereinafter referred to as the 'Extension'), provides the 'Hotel Reservation Information Scraping' feature. After directly logging into hotel reservation management sites (such as Yanolja, HereToStay, Agoda, Booking.com, etc.), it automatically reads reservation information for the logged-in account and transmits it to a designated server (the user's connected back-office server).\n\nThis extension complies with the Developer Program Policies and Privacy Handling Policies of the Chrome Web Store. It securely handles the minimal information necessary within the user's consent throughout the entire process of collecting, using, storing, and transmitting user data.",
        collectionItems:
          '2) Collection of Personal Information Items and Methods',
        collectionItemsContent:
          'Collection Items:\nReservation-related information: Customer name, customer phone number, reservation number, check-in/check-out dates, room information, reservation status (e.g., Confirmed), reservation site (OTA name)\nAuthentication information: Access Token issued and stored internally within the Extension (for back-end API integration)\nCookies, tabs, storage, etc.: Minimal technical information necessary for the Chrome Extension to operate',
        collectionMethods: 'Collection Methods:',
        collectionMethodsContent:
          'Scraping the web page structure of OTAs (such as Yanolja, HereToStay, Agoda, etc.) that the user has directly logged into to extract reservation table information.\nExtracted information is transmitted to the designated server (back-office API) via HTTPS communication.',
        purpose: '3) Purpose of Using Personal Information',
        purposeContent:
          'Reservation management and integration: Hotel (or accommodation) operators can automatically collect reservation information through this extension and integrate it with their back-office system to manage room inventory, confirm reservations, etc.\nService provision and maintenance: Used solely for automating the transmission of reservation data to streamline hotel operation tasks.',
        retention: '4) Processing and Retention Period of Personal Information',
        retentionContent:
          "This extension stores minimal information (e.g., accessToken, otaToggles) in the user's local Chrome storage, which remains until the user removes the extension or manually initializes chrome.storage.local.\nReservation information (customer name, phone number, etc.) is not permanently stored within the extension itself and is only temporarily held for 'transmission purposes' immediately after scraping, then transmitted to the server specified by the user (hotel) and discarded.\nActual reservation information is stored directly on your (or your company's) server, so it is handled and retained according to the retention policy of that server.",
        provision:
          '5) Provision and Outsourcing of Personal Information to Third Parties',
        provisionContent:
          "This extension does not sell, provide, or share customer information to third parties other than 'the user's (hotel/accommodation) own back-office server'.\nHowever, personal information may be provided in the following exceptional cases:\n(1) If the user has given prior consent.\n(2) If required by law, following the prescribed procedures and methods to law enforcement and related agencies.\n(3) If it is necessary to temporarily outsource to external experts to respond to technical failures or errors in the service.",
        securityMeasures: '6) Security Measures for Personal Information',
        securityMeasuresContent:
          "Encryption of Transmission Paths (HTTPS): Reservation data transmitted by the extension is sent and received via HTTPS protocol encryption.\nPrinciple of Least Privilege: The extension requests only the minimum necessary permissions such as 'tabs', 'activeTab', 'storage' required for scraping hotel reservation information, and does not request unnecessary permissions.\nLocal Storage Management: Information stored locally, such as accessToken, is securely stored in Chrome's storage.local and discarded when the user removes the extension or manually deletes it from chrome.storage.local.",
        userRights: '7) User Rights',
        userRightsContent:
          "Users can install and remove this extension at any time and can manually initialize Chrome's local storage (chrome.storage.local).\nIf you wish to discontinue using OTA account information, your hotel's back-office server, etc., you can stop using the extension and terminate or withdraw the use of related accounts.",
        cookiesInfo: '8) Information About Cookies',
        cookiesContent:
          "This extension itself does not issue or store separate cookies, and the cookies issued by OTA sites where users log in are stored on the user's computer.\nThe extension can access these cookies to utilize 'already logged-in sessions' of the user but uses this cookie information solely for the purpose of browsing the respective OTA sites.",
        contactInfo: '9) Contact Information',
        contactContent:
          'If you have any inquiries related to personal information, please contact the person in charge below.\nDepartment: Personal Information Processing Officer\nEmail: admin@ztoone.co.kr\nPhone: 070-8065-1554\nThis Privacy Policy is effective from 2025.01.01.',
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
      // === 한국어 privacyConsent 추가 ===
      privacyConsent: {
        title: '개인정보처리방침',
        failedToLoadInitialData: '초기 데이터를 불러오는 데 실패했습니다.',
        invalidHotelId: '유효하지 않은 hotelId입니다.',
        pleaseAgree: '개인정보 처리방침에 동의해주세요.',
        consentCompleted: '개인정보 동의가 완료되었습니다.',
        consentFailed: '개인정보 동의에 실패했습니다.',
        alreadyAgreed: '이미 동의가 완료되었습니다.',
        alreadyAgreedContent: '이미 개인정보 처리방침에 동의하셨습니다.',
        goToMainPage: '메인 페이지로 이동',
        overview: '1) 개요',
        overviewContent:
          '본 확장 프로그램인 Staysync(이하 ‘확장 프로그램’이라 함)은 “호텔 예약 정보 스크랩” 기능을 제공합니다. 사용자가 직접 로그인한 호텔 예약 관리 사이트들(야놀자, 여기어때, 아고다, 부킹닷컴 등)에 접속 후, 해당 계정에 한하여 예약 정보를 자동으로 읽어와, 지정된 서버(본인이 연동한 백오피스 서버)에 전달하는 역할을 합니다.\n본 확장 프로그램은 Chrome Web Store의 개발자 프로그램 정책 및 개인정보 취급 관련 정책을 준수하며, 사용자 데이터를 수집·이용·보관·전송하는 전 과정에서 사용자 동의 범위 내에서 최소한의 정보를 안전하게 취급합니다.',
        collectionItems: '2) 수집하는 개인정보 항목 및 방법',
        collectionItemsContent:
          '수집 항목 : \n예약 관련 정보: 고객명, 고객 전화번호, 예약번호, 체크인·체크아웃 날짜, 객실 정보, 예약 상태(Confirmed 등), 예약 사이트(OTA 이름)\n인증 정보: 확장 프로그램 내부에서 발급·보관하는 Access Token(백엔드 API 연동용)\n쿠키, 탭, 스토리지 등: Chrome 확장 프로그램이 동작하는 데 필요한 최소한의 기술 정보',
        collectionMethods: '수집 방법 : ',
        collectionMethodsContent:
          '사용자가 직접 로그인한 OTA(야놀자, 여기어때, Agoda 등)의 웹페이지 구조를 스크래핑하여, 예약 테이블 정보를 추출합니다.\n추출된 정보는 사용자가 지정한 서버(백오피스 API)로 HTTPS 통신을 통해 전송됩니다.',
        purpose: '3) 개인정보의 이용 목적',
        purposeContent:
          '예약 관리 및 연동: 호텔(또는 숙소) 운영자가 본 확장 프로그램을 통해 자동으로 예약정보를 수집하고, 본인의 백오피스 시스템과 연동하여 객실 재고 관리, 예약 확인 등을 수행할 수 있습니다.\n서비스 제공 및 유지보수: 예약 데이터를 자동 전송하여, 호텔 운영 업무를 효율화하기 위한 목적으로만 사용됩니다.',
        retention: '4) 개인정보의 처리 및 보유 기간',
        retentionContent:
          '본 확장 프로그램은 사용자 로컬 Chrome 스토리지에 최소한의 정보를 보관(예: accessToken, otaToggles)하며, 이 정보는 사용자가 확장 프로그램을 제거하거나, chrome.storage.local을 직접 초기화할 때까지 유지됩니다.\n예약 정보(고객명, 전화번호 등)는 확장 프로그램 내부에 영구 저장되지 않으며, 오직 스크랩 직후 _“전송용”_으로만 일시적으로 보관 후, 사용자(호텔)가 지정한 서버로 전송하고 폐기합니다.\n실제 예약 정보는 귀하(또는 귀사가) 직접 운영하시는 서버에 저장되므로, 해당 서버의 보관 정책에 따라 처리·보관됩니다.',
        provision: '5) 개인정보의 제3자 제공 및 위탁',
        provisionContent:
          '본 확장 프로그램은 “사용자(호텔/숙소) 본인의 백오피스 서버” 이외의 제3자에게 고객 정보를 판매·제공하거나 공유하지 않습니다.\n단, 아래와 같은 예외적인 경우에는 제한적으로 정보를 제공할 수 있습니다.\n(1) 이용자가 사전에 동의를 한 경우\n(2) 법령에 의하여 정해진 절차와 방법에 따라 수사기관 및 관련 기관의 요청이 있는 경우\n(3) 서비스의 기술적 장애·오류 등의 대응을 위해 외부 전문가에게 한시적으로 맡겨야 할 때',
        securityMeasures: '6) 개인정보의 안전성 확보 조치',
        securityMeasuresContent:
          '전송 구간 암호화(HTTPS): 확장 프로그램에서 예약 데이터를 전송할 때, HTTPS 프로토콜을 통해 암호화하여 송수신합니다.\n최소 권한 원칙: 확장 프로그램은 호텔 예약정보 스크랩에 필요한 ‘tabs’, ‘activeTab’, ‘storage’ 등 최소한의 권한만 요청하고, 불필요한 권한은 요구하지 않습니다.\n로컬 스토리지 관리: 로컬에 저장되는 accessToken 등도 Chrome의 storage.local에 안전하게 보관되며, 사용자가 확장 프로그램을 삭제하거나 수동 삭제할 경우 폐기됩니다.',
        userRights: '7) 사용자의 권리',
        userRightsContent:
          '사용자는 본 확장 프로그램을 언제든지 설치·제거할 수 있으며, 확장 프로그램 로컬 저장소(chrome.storage.local)를 수동으로 초기화할 수 있습니다.\n만약 OTA 계정 정보, 호텔 백오피스 서버 등의 중단을 원하시면, 확장 프로그램 사용을 중단하고, 관련 계정 사용을 해지·철회할 수 있습니다.',
        cookiesInfo: '8) 쿠키(Cookies)에 대한 안내',
        cookiesContent:
          '본 확장 프로그램 자체가 별도의 쿠키를 발급·저장하지 않으며, _사용자가 로그인한 OTA 사이트_에서 발급하는 쿠키는 사용자 컴퓨터에 저장됩니다.\n확장 프로그램은 “사용자가 이미 로그인되어 있는 세션”을 활용하기 위해 쿠키에 접근할 수 있으나, 이 쿠키 정보는 순전히 해당 OTA 사이트를 열람하기 위한 목적에만 사용됩니다.',
        contactInfo: '9) 문의 방법',
        contactContent:
          '개인정보 관련 문의가 있는 경우, 아래 담당자에게 문의해 주시기 바랍니다.\n담당 부서: 개인정보처리담당자\n이메일: admin@ztoone.co.kr\n전화: 070-8065-1554\n본 개인정보처리방침은 2025.01.01 부터 적용됩니다.',
      },
    },
  },
  zh: {
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
  ja: {
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
      // (필요하다면 일본어 privacyConsent 번역도 여기에 추가)
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
    debug: false, // 개발 시 true로 설정하면 콘솔에 디버그 로그 표시
    interpolation: {
      escapeValue: false, // React는 이미 XSS 보호를 제공하므로 false
    },
    detection: {
      // 언어 감지 옵션
      order: ['localStorage', 'cookie', 'navigator'], // 언어 우선 탐지 순서
      caches: ['localStorage', 'cookie'], // 감지된 언어를 저장할 위치
    },
  });

export default i18n;
