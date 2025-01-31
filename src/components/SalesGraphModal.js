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

Modal.setAppElement('#root');

function SalesGraphModal({
  isOpen,
  onRequestClose,
  dailySales,
  monthlySales,
  monthlyDailyBreakdown = [],
  selectedDate,
}) {
  // 디폴트 값을 설정하여 undefined를 방지
  const safeMonthlyDailyBreakdown = Array.isArray(monthlyDailyBreakdown)
    ? monthlyDailyBreakdown
    : [];

  // 1) 일별 매출 (막대 그래프)
  const barData = {
    labels: dailySales.labels,
    datasets: [
      {
        label: '일일 매출',
        data: dailySales.values,
        backgroundColor: '#36A2EB',
      },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: '일일 매출 (막대 그래프)' },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => '₩' + value.toLocaleString(),
        },
      },
    },
  };

  // 2) 월간 일 매출 (라인 차트)
  const monthlyDailyChartData = {
    labels: safeMonthlyDailyBreakdown.map((_, idx) => `${idx + 1}일`),
    datasets: [
      {
        label: '월간 일 매출 추세',
        data: safeMonthlyDailyBreakdown,
        fill: false,
        backgroundColor: '#FF6384',
        borderColor: '#FF6384',
      },
    ],
  };

  const monthlyDailyChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: '월간 일 매출 추세 (라인 차트)' },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => '₩' + value.toLocaleString(),
        },
      },
    },
  };

  // 3) 인쇄 핸들러
  const handlePrint = () => {
    window.print();
  };

  // Props 검증 및 디버깅
  // console.log('SalesGraphModal props:', {
  //   isOpen,
  //   onRequestClose,
  //   dailySales,
  //   monthlySales,
  //   monthlyDailyBreakdown,
  // });

  // 선택된 날짜의 월과 연도를 포맷팅
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

      {/* 1) 일별 매출 막대 그래프 */}
      <div className="chart-container">
        <Bar data={barData} options={barOptions} />
      </div>

      {/* 2) 월간 일 매출 라인 차트 */}
      <div className="chart-container">
        <Line data={monthlyDailyChartData} options={monthlyDailyChartOptions} />
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
    labels: PropTypes.arrayOf(PropTypes.string).isRequired,
    values: PropTypes.arrayOf(PropTypes.number).isRequired,
  }), // 기존 monthlySales는 이제 사용하지 않으므로 선택적으로 만듭니다.
  monthlyDailyBreakdown: PropTypes.arrayOf(PropTypes.number).isRequired, // === [ADD] 한 달치 일 매출 데이터
  selectedDate: PropTypes.instanceOf(Date).isRequired,
};

export default SalesGraphModal;
