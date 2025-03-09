import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FaPen, FaSave } from 'react-icons/fa';
import './MemoComponent.css';

const MemoComponent = ({
  reservationId,
  reservationName = '',
  onMemoChange,
  onMemoSave,
  onMemoCancel,
  onToggleMemoEdit,
  isEditingMemo,
  memoRefs,
}) => {
  // localStorage에서 초기 메모 불러오기 (문자열만 추출)
  const [memoText, setMemoText] = useState(() => {
    const storedMemos = JSON.parse(localStorage.getItem('localMemos') || '{}');
    return (
      (storedMemos[reservationId] && storedMemos[reservationId].text) || ''
    );
  });
  const textAreaRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isEditingMemo && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [isEditingMemo]);

  // localStorage에 메모 저장 (객체 형태로 저장)
  const saveMemoLocally = useCallback(() => {
    const storedMemos = JSON.parse(localStorage.getItem('localMemos') || '{}');
    storedMemos[reservationId] = { text: memoText, isEditing: isEditingMemo };
    localStorage.setItem('localMemos', JSON.stringify(storedMemos));
  }, [reservationId, memoText, isEditingMemo]);

  useEffect(() => {
    // isEditingMemo가 false가 되면(앞면이 보이면) 무조건 저장
    if (!isEditingMemo) {
      saveMemoLocally();
    }
  }, [isEditingMemo, saveMemoLocally]);
  

  // 플립 시 앞면으로 돌아올 때 무조건 저장하고 편집 모드 종료
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        isEditingMemo
      ) {
        saveMemoLocally();
        onMemoSave(reservationId);
        onToggleMemoEdit(reservationId); // 편집 모드 종료
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    isEditingMemo,
    reservationId,
    onMemoSave,
    onToggleMemoEdit,
    saveMemoLocally,
  ]);

  const handleChange = (e) => {
    setMemoText(e.target.value);
    onMemoChange(reservationId, e.target.value);
  };

  const handleSave = () => {
    saveMemoLocally();
    onMemoSave(reservationId);
    onToggleMemoEdit(reservationId, false);
  };

  const handleCancel = () => {
    const storedMemos = JSON.parse(localStorage.getItem('localMemos') || '{}');
    setMemoText(
      (storedMemos[reservationId] && storedMemos[reservationId].text) || ''
    );
    onMemoCancel(reservationId);
    onToggleMemoEdit(reservationId, false);
  };

  return (
    <div className="memo-container" ref={containerRef}>
      <div
        className="memo-header"
        // 헤더 클릭 시 전파만 막아서 별도의 편집 토글이 발생하지 않음
        onClick={(e) => e.stopPropagation()}
        style={{ cursor: isEditingMemo ? 'default' : 'pointer' }}
      >
        <span>Memo</span>
        {isEditingMemo ? (
          <div className="memo-button-group">
            <button
              className="memo-save-button"
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
            >
              <FaSave /> 저장
            </button>
            <button
              className="memo-cancel-button"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
            >
              X
            </button>
          </div>
        ) : (
          <button
            className="memo-edit-button"
            onClick={(e) => {
              e.stopPropagation();
              // 연필 버튼 클릭 시 편집 모드를 열도록 변경
              onToggleMemoEdit(reservationId, true);
            }}
          >
            <FaPen />
          </button>
        )}
      </div>
      <div className="memo-body">
        {isEditingMemo ? (
          <textarea
            ref={(el) => {
              textAreaRef.current = el;
              memoRefs.current[reservationId] = el;
            }}
            value={memoText}
            onChange={handleChange}
            className="memo-textarea"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
        ) : (
          <div
            className="memo-text-display"
            onClick={(e) => {
              e.stopPropagation();
              // 개별 클릭으로 편집 모드로 들어가지 않도록 함.
            }}
            style={{ overflowY: 'auto' }} // 긴 내용에 대해 스크롤바 표시
          >
            {memoText || '(클릭하여 메모 입력)'}
          </div>
        )}
      </div>
    </div>
  );
};

MemoComponent.propTypes = {
  reservationId: PropTypes.string.isRequired,
  reservationName: PropTypes.string,
  onMemoChange: PropTypes.func.isRequired,
  onMemoSave: PropTypes.func.isRequired,
  onMemoCancel: PropTypes.func.isRequired,
  // onToggleMemoEdit: 두 번째 인자로 newState(boolean)를 받음
  onToggleMemoEdit: PropTypes.func.isRequired,
  isEditingMemo: PropTypes.bool.isRequired,
  memoRefs: PropTypes.object.isRequired,
};

export default MemoComponent;
