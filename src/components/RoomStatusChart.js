// src/components/RoomStatusChart.js

import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import './RoomStatusChart.css';

Chart.register(ArcElement, Tooltip, Legend);

function RoomStatusChart({ totalRooms, roomsSold, remainingRooms }) {
  const data = {
    labels: ['판매된 객실', '잔여 객실'],
    datasets: [
      {
        data: [roomsSold, remainingRooms],
        backgroundColor: ['#36A2EB', '#A9A9A9'],
        hoverBackgroundColor: ['#FF6384', '#36A2EB'],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    cutout: '70%', // 도넛의 두께 조절
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // 범례 숨기기
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const percentage = ((value / totalRooms) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="room-status-chart-container">
      <Doughnut data={data} options={options} />
      <div className="chart-center">
        <p>판매</p>
        <p>{roomsSold}</p>
        <p>잔여</p>
        <p>{remainingRooms}</p>
      </div>
    </div>
  );
}

export default RoomStatusChart;
