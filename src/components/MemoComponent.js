import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaPen } from 'react-icons/fa';
import './MemoComponent.css';

const MemoComponent = ({
  reservationId,
  onMemoChange,
  onMemoSave,
  onMemoCancel,
  onToggleMemoEdit,
  isEditingMemo,
  memoRefs,
}) => {
  const [memos, setMemos] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('localMemos') || '{}');
    return saved;
  });
  const [localMemoText, setLocalMemoText] = useState(memos[reservationId]?.text || '');
  const textAreaRef = useRef(null);

  useEffect(() => {
    setLocalMemoText(memos[reservationId]?.text || '');
  }, [memos, reservationId]);

  useEffect(() => {
    if (isEditingMemo && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [isEditingMemo]);

  useEffect(() => {
    localStorage.setItem('localMemos', JSON.stringify(memos));
  }, [memos]);

  const handleChange = (e) => {
    setLocalMemoText(e.target.value);
    handleMemoChange(reservationId, e.target.value);
  };

  const toggleMemoEdit = (reservationId) => {
    setMemos((prev) => {
      const cur = prev[reservationId] || { text: '', isEditing: false };
      const nextEditing = !cur.isEditing;
      const updated = {
        ...prev,
        [reservationId]: { ...cur, isEditing: nextEditing },
      };
      return updated;
    });
  };

  const handleMemoChange = (reservationId, value) => {
    setMemos((prev) => ({
      ...prev,
      [reservationId]: { ...prev[reservationId], text: value },
    }));
  };

  const handleMemoSave = (reservationId) => {
    setMemos((prev) => {
      const updated = {
        ...prev,
        [reservationId]: { ...prev[reservationId], isEditing: false },
      };
      return updated;
    });
  };

  const handleMemoCancel = (reservationId) => {
    setMemos((prev) => ({
      ...prev,
      [reservationId]: { ...prev[reservationId], isEditing: false },
    }));
  };

  const handleSave = () => {
    handleMemoSave(reservationId);
  };

  const handleCancel = () => {
    setLocalMemoText(memos[reservationId]?.text || '');
    handleMemoCancel(reservationId);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="memo-container">
      <div
        className="memo-header"
        onClick={() => !isEditingMemo && toggleMemoEdit(reservationId)}
        style={{ cursor: isEditingMemo ? 'default' : 'pointer' }}
      >
        <span>Memo</span>
        {reservationId && (
          <span
            className="memo-room-number"
            style={{ marginLeft: '10px', color: '#666' }}
          >
            #{reservationId}
          </span>
        )}
        {isEditingMemo ? (
          <button
            className="memo-cancel-button"
            onClick={(e) => {
              e.stopPropagation();
              handleCancel();
            }}
          >
            X
          </button>
        ) : (
          <button
            className="memo-edit-button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMemoEdit(reservationId);
            }}
          >
            <FaPen />
          </button>
        )}
      </div>
      <div className="memo-body">
        {isEditingMemo ? (
          <textarea
            ref={(el) => (memoRefs.current[reservationId] = el)}
            value={localMemoText}
            onChange={handleChange}
            className="memo-textarea"
            onKeyDown={handleKeyDown}
            disabled={!isEditingMemo} // 편집 모드 외에는 비활성화
          />
        ) : (
          <div className="memo-text-display">
            {localMemoText || '(클릭하여 메모 입력)'}
          </div>
        )}
      </div>
    </div>
  );
};

MemoComponent.propTypes = {
  reservationId: PropTypes.string.isRequired,
  onMemoChange: PropTypes.func.isRequired,
  onMemoSave: PropTypes.func.isRequired,
  onMemoCancel: PropTypes.func.isRequired,
  onToggleMemoEdit: PropTypes.func.isRequired,
  isEditingMemo: PropTypes.bool.isRequired,
  memoRefs: PropTypes.object.isRequired,
};

export default MemoComponent;
//룸그리드에서 삭제된 함수 이곳으로 이전해야할지 몰라서 주석처리후 보관

// useEffect(() => {  //MemoComponent.js으로 이동
//   const saved = JSON.parse(localStorage.getItem('localMemos') || '{}');
//   setMemos(saved);
// }, [setMemos]);

// const toggleMemoEditHandler = useCallback(
//   (reservationId) => {
//     setMemos((prev) => {
//       const cur = prev[reservationId] || { text: '', isEditing: false };
//       const nextEditing = !cur.isEditing;
//       const updated = {
//         ...prev,
//         [reservationId]: { ...cur, isEditing: nextEditing },
//       };
//       if (nextEditing) {
//         setTimeout(() => {
//           if (memoRefs.current[reservationId]) {
//             memoRefs.current[reservationId].focus();
//           }
//         }, 0);
//       }
//       return updated;
//     });
//   },
//   [setMemos]
// );

// const handleMemoChangeHandler = useCallback(
//   (reservationId, value) => {
//     setMemos((prev) => ({
//       ...prev,
//       [reservationId]: { ...prev[reservationId], text: value },
//     }));
//   },
//   [setMemos]
// );

// const handleMemoSaveHandler = useCallback(
//   (reservationId) => {
//     setMemos((prev) => {
//       const updated = {
//         ...prev,
//         [reservationId]: { ...prev[reservationId], isEditing: false },
//       };
//       localStorage.setItem('localMemos', JSON.stringify(updated));
//       return updated;
//     });
//     setFlippedReservationIds((prev) => {
//       const copy = new Set(prev);
//       copy.delete(reservationId);
//       return copy;
//     });
//   },
//   [setMemos]
// );

// const handleMemoCancelHandler = useCallback(
//   (reservationId) => {
//     setMemos((prev) => ({
//       ...prev,
//       [reservationId]: { ...prev[reservationId], isEditing: false },
//     }));
//   },
//   [setMemos]
// );
