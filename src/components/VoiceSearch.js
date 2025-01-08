// src/components/VoiceSearch.js

import React, { useState, useEffect, useRef } from 'react';
import { FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';
import './VoiceSearch.css'; // VoiceSearch 관련 CSS
import PropTypes from 'prop-types';

function VoiceSearch({ onResult, language = 'ko-KR', triggerVisualEffect }) {
  const [isListening, setIsListening] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null); // 오류 상태
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error('이 브라우저에서는 음성 인식을 지원하지 않습니다.');
      setError('이 브라우저에서는 음성 인식을 지원하지 않습니다.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = false; // 최종 결과만 받음
    recognition.maxAlternatives = 1;
    recognition.continuous = false; // 한 번의 음성 입력 후 종료

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      console.log('인식된 텍스트:', transcript);
      onResult(transcript);
      setIsListening(false);
      setMessage('');
      setError(null);
      // 특정 단어 감지 및 시각적 효과 트리거
      if (transcript.toLowerCase() === '배터리') {
        triggerVisualEffect('battery'); // 예시: 'battery' 효과 트리거
      }
    };

    recognition.onerror = (event) => {
      console.error('음성 인식 오류:', event.error);
      setError(`음성 인식 오류: ${event.error}`);
      setIsListening(false);
      setMessage('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setMessage('');
    };

    recognitionRef.current = recognition;

    // 컴포넌트 언마운트 시 recognition 객체 정리
    return () => {
      recognition.stop();
    };
  }, [language, onResult, triggerVisualEffect]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      // 마이크 권한 요청
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(() => {
          recognitionRef.current.start();
          setIsListening(true);
          setMessage('말씀하세요...');
          setError(null);
        })
        .catch((err) => {
          console.error('마이크 권한 오류:', err);
          setError('마이크 권한을 허용해주세요.');
        });
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setMessage('');
    }
  };

  return (
    <div className="voice-search-container">
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        className={`voice-search-button ${isListening ? 'active' : ''}`}
        aria-label="음성 검색"
      >
        {isListening ? <FaMicrophoneSlash /> : <FaMicrophone />}
      </button>
      {isListening && (
        <div className="voice-search-frequency">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      )}
      {message && <span className="voice-search-message">{message}</span>}
      {error && <span className="voice-search-error">{error}</span>}
      {error && (
        <button
          type="button"
          onClick={startListening}
          className="retry-button"
          aria-label="다시 시도"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

VoiceSearch.propTypes = {
  onResult: PropTypes.func.isRequired,
  language: PropTypes.string,
  triggerVisualEffect: PropTypes.func.isRequired,
};

export default VoiceSearch;
