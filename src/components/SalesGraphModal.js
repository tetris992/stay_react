// src/components/SalesGraphModal.js

import React from 'react';
import Modal from 'react-modal';
import { Bar, Line } from 'react-chartjs-2';
import PropTypes from 'prop-types';
import { FaTimes, FaPrint } from 'react-icons/fa';
import { format } from 'date-fns';
import './SalesGraphModal.css';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Chart.js 기본 플러그인 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// 모달 루트 설정
Modal.setAppElement('#root');

function SalesGraphModal({
  isOpen,
  onRequestClose,
  dailySales, // { labels: string[], values: number[] }
  monthlySales, // (사용하지 않음, 남겨둠)
  monthlyDailyBreakdown = [],
  selectedDate,
  dailySalesByOTA = {}, // { [category]: number[] } – 날짜별(OTA/현장예약/대실) 판매 건수
  maxRooms, // 호텔의 최대 객실수 (y축 최대값)
}) {
  /**
   * 1) 날짜별 판매/남은 객실수 스택형 막대그래프
   */
  const labels = dailySales.labels || [];

  const safeDailySalesByOTA =
    dailySalesByOTA && typeof dailySalesByOTA === 'object'
      ? dailySalesByOTA
      : {};

  const otaCategories = Object.keys(safeDailySalesByOTA);

  const categoryColors = {
    Yanolja: '#FF6384',
    GoodHotel: '#36A2EB',
    GoodMotel: '#FFCE56',
    Agoda: '#4BC0C0',
    CoolStay: '#9966FF',
    Booking: '#FF9F40',
    Expedia: '#C9CBCF',
    현장예약: '#8A2BE2',
    대실: '#2E8B57',
  };

  // 각 날짜별 총 판매 건수 계산
  const totals = labels.map((_, idx) => {
    let sum = 0;
    otaCategories.forEach((category) => {
      const data = safeDailySalesByOTA[category] || [];
      sum += data[idx] || 0;
    });
    return sum;
  });

  // 각 카테고리별 판매 데이터 (절대 수치)
  const otaDatasets = otaCategories.map((category) => ({
    label: category,
    data: safeDailySalesByOTA[category] || [],
    backgroundColor: categoryColors[category] || '#AAAAAA',
  }));

  // 남은 객실수: maxRooms - 총판매건수
  const remainingDataset = {
    label: '남은 객실',
    data: totals.map((total) => Math.max(0, maxRooms - total)),
    backgroundColor: '#CCCCCC',
  };

  const combinedDatasets = [...otaDatasets, remainingDataset];

  const barData = {
    labels: labels,
    datasets: combinedDatasets,
  };

  // x축 tick 옵션: 막대그래프의 라벨은 "MM-dd" 형태라고 가정
  const barXAxisTicks = {
    // scriptable 옵션을 사용하여 각 tick의 색상을 조건부로 설정
    color: (context) => {
      const label = context.tick.label; // 예: "08-01"
      const parts = label.split('-');
      if (parts.length === 2) {
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = selectedDate.getFullYear();
        const dateObj = new Date(year, month, day);
        const dow = dateObj.getDay();
        // 일요일(0) 또는 토요일(6)면 'red', 아니면 기본 색상 (예: '#666')
        return dow === 0 || dow === 6 ? 'red' : '#666';
      }
      return '#666';
    },
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12, // 범례 색상바 크기를 작게
          usePointStyle: false,
        },
      },
      title: {
        display: true,
        text: '날짜별 판매/남은 객실수',
      },
      tooltip: {
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: ${context.parsed.y} 객실`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        title: { display: true, text: '날짜' },
        ticks: barXAxisTicks, // 추가된 x축 tick 옵션 적용
      },
      y: {
        stacked: true,
        beginAtZero: true,
        max: maxRooms,
        ticks: {
          callback: (value) => `${value} 객실`,
        },
        title: { display: true, text: '객실 수' },
      },
    },
  };

  /**
   * 2) 월간 일 매출 라인 차트 – 누적매출 및 평균 매출 점선 표시
   */
  const safeMonthlyDailyBreakdown = Array.isArray(monthlyDailyBreakdown)
    ? monthlyDailyBreakdown
    : [];

  // 누적매출 계산
  const cumulativeSales = safeMonthlyDailyBreakdown.reduce((acc, curr, idx) => {
    if (idx === 0) {
      acc.push(curr);
    } else {
      acc.push(acc[idx - 1] + curr);
    }
    return acc;
  }, []);

  // 일 평균 매출 계산
  const totalMonthlySales = safeMonthlyDailyBreakdown.reduce(
    (sum, curr) => sum + curr,
    0
  );
  const averageDailySales =
    safeMonthlyDailyBreakdown.length > 0
      ? totalMonthlySales / safeMonthlyDailyBreakdown.length
      : 0;

  // x축 라벨: "1일", "2일", ...
  const lineLabels = safeMonthlyDailyBreakdown.map((_, idx) => `${idx + 1}일`);

  // x축 tick 옵션: 라인차트의 라벨은 "1일", "2일" 등 => 숫자만 추출하여 날짜 판단
  const lineXAxisTicks = {
    color: (context) => {
      const label = context.tick.label; // 예: "1일"
      const dayStr = label.replace('일', '');
      const day = parseInt(dayStr, 10);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const dateObj = new Date(year, month, day);
      const dow = dateObj.getDay();
      return dow === 0 || dow === 6 ? 'red' : '#666';
    },
  };

  const monthlyDailyLineData = {
    labels: lineLabels,
    datasets: [
      {
        label: '일 매출',
        data: safeMonthlyDailyBreakdown,
        borderColor: '#FF6384',
        backgroundColor: '#FF6384',
        fill: false,
        yAxisID: 'y1',
      },
      {
        label: '누적 매출',
        data: cumulativeSales,
        borderColor: '#36A2EB',
        backgroundColor: '#36A2EB',
        fill: false,
        yAxisID: 'y2',
      },
      {
        label: '평균 매출',
        data: lineLabels.map(() => averageDailySales),
        borderColor: 'rgba(0,0,0,0.3)',
        borderDash: [5, 5],
        borderWidth: 1,
        fill: false,
        pointRadius: 0,
        yAxisID: 'y1',
      },
    ],
  };

  const monthlyDailyLineOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
        },
      },
      title: {
        display: true,
        text: '월간 일 매출 추세 (오른쪽: 누적 매출)',
      },
    },
    scales: {
      x: {
        ticks: lineXAxisTicks, // 라인차트 x축 tick 옵션 적용
      },
      y1: {
        beginAtZero: true,
        ticks: {
          callback: (value) => '₩' + value.toLocaleString(),
        },
        title: { display: true, text: '일 매출 (₩)' },
      },
      y2: {
        beginAtZero: true,
        position: 'right',
        grid: { drawOnChartArea: false },
        ticks: {
          callback: (value) => '₩' + value.toLocaleString(),
        },
        title: { display: true, text: '누적 매출 (₩)' },
      },
    },
  };

  // 인쇄(브라우저 print) 핸들러
  const handlePrint = () => {
    window.print();
  };

  const formattedMonthYear = format(selectedDate, 'yyyy년 MM월');

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel="매출 그래프 보기"
      className="sales-graph-modal"
      overlayClassName="sales-graph-modal-overlay"
    >
      {/* 모달 닫기 버튼 */}
      <button className="close-button" onClick={onRequestClose}>
        <FaTimes />
      </button>

      {/* 인쇄 버튼 */}
      <button className="print-button" onClick={handlePrint}>
        <FaPrint /> 인쇄하기
      </button>

      <h2>매출 그래프 - {formattedMonthYear}</h2>

      {/* (1) 날짜별 판매/남은 객실수 스택형 막대그래프 */}
      <div className="chart-container">
        <Bar data={barData} options={barOptions} />
      </div>

      {/* (2) 월간 일 매출 라인 차트 (누적매출 및 평균 매출 점선 포함) */}
      <div className="chart-container">
        <Line data={monthlyDailyLineData} options={monthlyDailyLineOptions} />
      </div>
    </Modal>
  );
}

SalesGraphModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onRequestClose: PropTypes.func.isRequired,
  dailySales: PropTypes.shape({
    labels: PropTypes.arrayOf(PropTypes.string).isRequired,
    values: PropTypes.arrayOf(PropTypes.number).isRequired,
  }).isRequired,
  monthlySales: PropTypes.shape({
    labels: PropTypes.arrayOf(PropTypes.string),
    values: PropTypes.arrayOf(PropTypes.number),
  }),
  monthlyDailyBreakdown: PropTypes.arrayOf(PropTypes.number).isRequired,
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  dailySalesByOTA: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.number)),
  maxRooms: PropTypes.number.isRequired,
};

export default SalesGraphModal;
