// src/config/iconMap.js
// This file maps icon names to their respective React components from react-icons as JSX elements.

import {
  FaWifi, // 무료 WIFI
  FaBath, // 욕조
  FaTv, // TV
  FaUmbrellaBeach, // 비치 파라솔 (해변)
  FaTshirt, // 세탁 서비스
  FaFilm, // 영화 상영
  FaChair, // 의자 (라운지 공간)
  FaSmoking, // 흡연 가능
  FaStore, // 편의점
  FaCoffee, // 커피숍
  FaSnowflake, // 에어컨
  FaFire, // 난방 및 바비큐
  FaGlassMartini, // 바 (마티니 글라스)
  FaWind, // 공기 청정기
  FaLock, // 금고
  FaCouch, // 소파 (공용 라운지)
  FaUtensils, // 주방 용품 (공용 주방)
  FaConciergeBell, // 컨시어지 서비스
  FaPaw, // 애견 동반
  FaWheelchair, // 장애인 접근 가능
  FaBan, // 금지 (예: 금연)
  FaVolumeMute, // 방음
  FaToilet, // 화장실
  FaShower, // 샤워실
  FaHotTub, // 온수 욕조 (온천탕)
  FaSpa, // 스파 및 사우나
  FaDumbbell, // 피트니스 센터
  FaSwimmingPool, // 수영장
  FaParking, // 주차장
  FaChargingStation, // 전기차 충전소
  FaBriefcase, // 비즈니스 센터
  FaUsers, // 회의실
  FaGlassCheers, // 연회장
  FaChild, // 키즈 클럽
  FaCocktail, // 칵테일 바
  FaTree, // 정원 및 테라스/피크닉 공간
  FaBuilding, // 건물 (호텔 로비 등)
  FaMicrophone, // 노래방
  FaClock, // 24시간 서비스 (프론트 데스크)
  FaSuitcase, // 수하물 보관
  FaBus, // 셔틀 서비스
  FaCar, // 렌터카 서비스 및 발렛파킹
  FaMap, // 관광 안내
  FaMoneyBillWave, // 환전 서비스 및 ATM
  FaSoap, // 욕실 용품 (객실지 충소)
  FaDesktop, // 데스크톱 (인터넷 서비스)
  FaMoneyCheck, // 체크인/체크아웃 서비스
  FaGolfBall, // 골프 연습장 및 테니스장
  FaGamepad, // 게임 콘솔 (오락실)
  FaBicycle, // 자전거 (추가)
  FaDoorOpen, // 커넥팅 룸
} from 'react-icons/fa';

// JSX 요소를 반환하도록 iconMap 정의
const iconMap = {
  FaGolfBall: <FaGolfBall />, // 골프 연습장 및 테니스장
  FaWifi: <FaWifi />, // 무료 WIFI
  FaBath: <FaBath />, // 욕조
  FaTv: <FaTv />, // TV
  FaUmbrellaBeach: <FaUmbrellaBeach />, // 비치 파라솔 (해변)
  FaTshirt: <FaTshirt />, // 세탁 서비스
  FaFilm: <FaFilm />, // 영화 상영
  FaChair: <FaChair />, // 의자 (라운지 공간)
  FaSmoking: <FaSmoking />, // 흡연 가능
  FaStore: <FaStore />, // 편의점
  FaCoffee: <FaCoffee />, // 커피숍
  FaSnowflake: <FaSnowflake />, // 에어컨
  FaFire: <FaFire />, // 난방 및 바비큐
  FaGlassMartini: <FaGlassMartini />, // 바 (마티니 글라스)
  FaWind: <FaWind />, // 공기 청정기
  FaLock: <FaLock />, // 금고
  FaCouch: <FaCouch />, // 소파 (공용 라운지)
  FaUtensils: <FaUtensils />, // 주방 용품 (공용 주방)
  FaConciergeBell: <FaConciergeBell />, // 컨시어지 서비스
  FaPaw: <FaPaw />, // 애견 동반
  FaWheelchair: <FaWheelchair />, // 장애인 접근 가능
  FaBan: <FaBan />, // 금지 (예: 금연)
  FaVolumeMute: <FaVolumeMute />, // 방음
  FaToilet: <FaToilet />, // 화장실
  FaShower: <FaShower />, // 샤워실
  FaHotTub: <FaHotTub />, // 온수 욕조 (온천탕)
  FaSpa: <FaSpa />, // 스파 및 사우나
  FaDumbbell: <FaDumbbell />, // 피트니스 센터
  FaSwimmingPool: <FaSwimmingPool />, // 수영장
  FaParking: <FaParking />, // 주차장
  FaChargingStation: <FaChargingStation />, // 전기차 충전소
  FaBriefcase: <FaBriefcase />, // 비즈니스 센터
  FaUsers: <FaUsers />, // 회의실
  FaGlassCheers: <FaGlassCheers />, // 연회장
  FaChild: <FaChild />, // 키즈 클럽
  FaCocktail: <FaCocktail />, // 칵테일 바
  FaTree: <FaTree />, // 정원 및 테라스/피크닉 공간
  FaBuilding: <FaBuilding />, // 건물 (호텔 로비 등)
  FaMicrophone: <FaMicrophone />, // 노래방
  FaClock: <FaClock />, // 24시간 서비스 (프론트 데스크)
  FaSuitcase: <FaSuitcase />, // 수하물 보관
  FaBus: <FaBus />, // 셔틀 서비스
  FaCar: <FaCar />, // 렌터카 서비스 및 발렛파킹
  FaGamepad: <FaGamepad />, // 오락실 및 게임 콘솔
  FaMap: <FaMap />, // 관광 안내
  FaMoneyBillWave: <FaMoneyBillWave />, // 환전 서비스 및 ATM
  FaSoap: <FaSoap />, // 욕실 용품 (객실지 충소)
  FaDesktop: <FaDesktop />, // 데스크톱 (인터넷 서비스)
  FaMoneyCheck: <FaMoneyCheck />, // 체크인/체크아웃 서비스
  FaBicycle: <FaBicycle />, // 자전거
  FaDoorOpen: <FaDoorOpen />, // 커넥팅 룸
};

export default iconMap;
