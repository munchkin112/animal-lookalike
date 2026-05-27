import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import './styles.css';

const KAKAO_APP_KEY = '975b1ff2408619d2ea5ba1e0734f720e';
const SERVICE_URL = 'https://munchking.pages.dev/';
const COMMENTS_API_URL = '/api/comments';
const COMMENT_OWNER_TOKEN_KEY = 'animalFaceCommentOwnerToken';
const MY_COMMENT_IDS_KEY = 'animalFaceMyCommentIds';
const ANIMALS = ['강아지상', '고양이상', '여우상', '토끼상', '곰상', '사슴상'];
const MAX_KAKAO_IMAGE_SIZE = 5 * 1024 * 1024;
const ANALYSIS_MESSAGES = [
  '얼굴 분위기를 살펴보는 중...',
  '동물상 후보를 비교하는 중...',
  '가장 어울리는 동물상을 찾는 중...'
];
const ANIMAL_META = {
  강아지상: {
    emoji: '🐶',
    description: '밝고 친근한 첫인상이 매력적인 타입'
  },
  고양이상: {
    emoji: '🐱',
    description: '도도하고 세련된 분위기가 돋보이는 타입'
  },
  여우상: {
    emoji: '🦊',
    description: '눈빛과 분위기가 매력적인 타입'
  },
  토끼상: {
    emoji: '🐰',
    description: '부드럽고 사랑스러운 이미지의 타입'
  },
  곰상: {
    emoji: '🐻',
    description: '편안하고 든든한 인상을 주는 타입'
  },
  사슴상: {
    emoji: '🦌',
    description: '맑고 차분한 분위기를 가진 타입'
  }
};

function createRandomResult() {
  const scores = ANIMALS.map((animal) => ({
    animal,
    score: Math.floor(Math.random() * 41) + 10
  }));
  const total = scores.reduce((sum, item) => sum + item.score, 0);
  let percentTotal = 0;

  return scores
    .map((item, index) => {
      const percent = index === scores.length - 1
        ? 100 - percentTotal
        : Math.round((item.score / total) * 100);
      percentTotal += percent;
      return { animal: item.animal, percent };
    })
    .sort((a, b) => b.percent - a.percent);
}

function getResultText(result) {
  if (!result) {
    return '아직 동물상 테스트 결과가 없어요.';
  }

  const lines = result.map((item) => `${item.animal} ${item.percent}%`);
  return `나의 동물상 테스트 결과\n${lines.join('\n')}\n\n재미용 랜덤 테스트 결과입니다.`;
}

async function copyText(text) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const temp = document.createElement('textarea');
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  temp.remove();
}

async function loadComments() {
  const response = await fetch(COMMENTS_API_URL, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('댓글을 불러오지 못했습니다.');
  }

  const data = await response.json();
  return Array.isArray(data.comments) ? data.comments : [];
}

function getCommentOwnerToken() {
  const savedToken = localStorage.getItem(COMMENT_OWNER_TOKEN_KEY);
  if (savedToken) {
    return savedToken;
  }

  const token = crypto.randomUUID();
  localStorage.setItem(COMMENT_OWNER_TOKEN_KEY, token);
  return token;
}

function getMyCommentIds() {
  try {
    const savedIds = JSON.parse(localStorage.getItem(MY_COMMENT_IDS_KEY));
    return Array.isArray(savedIds) ? savedIds : [];
  } catch (error) {
    return [];
  }
}

function saveMyCommentIds(ids) {
  localStorage.setItem(MY_COMMENT_IDS_KEY, JSON.stringify([...new Set(ids)]));
}

async function createComment(nickname, text, ownerToken) {
  const response = await fetch(COMMENTS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ nickname, text, ownerToken })
  });

  if (!response.ok) {
    throw new Error('댓글 등록에 실패했습니다.');
  }

  const data = await response.json();
  return Array.isArray(data.comments) ? data.comments : [];
}

async function deleteComment(commentId, ownerToken) {
  const response = await fetch(`${COMMENTS_API_URL}?id=${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      'x-comment-owner-token': ownerToken
    }
  });

  if (!response.ok) {
    throw new Error('댓글 삭제에 실패했습니다.');
  }

  const data = await response.json();
  return Array.isArray(data.comments) ? data.comments : [];
}

function App() {
  const fileInputRef = useRef(null);
  const resultSectionRef = useRef(null);
  const resultCardRef = useRef(null);
  const toastTimerRef = useRef(null);
  const analyzeTimerRef = useRef(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [result, setResult] = useState(null);
  const [comments, setComments] = useState([]);
  const [myCommentIds, setMyCommentIds] = useState(() => getMyCommentIds());
  const [deletingCommentId, setDeletingCommentId] = useState('');
  const [commentsStatus, setCommentsStatus] = useState('loading');
  const [nickname, setNickname] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [toast, setToast] = useState('');

  const hasResult = Boolean(result);
  const topResult = result?.[0];
  const resultText = useMemo(() => getResultText(result), [result]);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2200);
  }, []);

  const refreshComments = useCallback(async (showMessage = false) => {
    setCommentsStatus('loading');

    try {
      setComments(await loadComments());
      setCommentsStatus('ready');
      if (showMessage) {
        showToast('댓글을 새로 불러왔어요.');
      }
    } catch (error) {
      setCommentsStatus('error');
    }
  }, [showToast]);

  useEffect(() => {
    refreshComments();
  }, [refreshComments]);

  useEffect(() => () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    window.clearTimeout(toastTimerRef.current);
    window.clearTimeout(analyzeTimerRef.current);
  }, [previewUrl]);

  const handleImageFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드할 수 있어요.');
      return;
    }

    setSelectedImageFile(file);
    setPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return URL.createObjectURL(file);
    });
    setResult(null);
    setIsAnalyzing(false);
    window.clearTimeout(analyzeTimerRef.current);
    showToast('사진이 업로드됐어요.');
  }, [showToast]);

  const handleAnalyze = useCallback(() => {
    if (!previewUrl || isAnalyzing) {
      if (!previewUrl) {
        showToast('먼저 사진을 업로드해주세요.');
      }
      return;
    }

    setResult(null);
    setIsAnalyzing(true);
    setAnalysisMessage(ANALYSIS_MESSAGES[Math.floor(Math.random() * ANALYSIS_MESSAGES.length)]);

    analyzeTimerRef.current = window.setTimeout(() => {
      setResult(createRandomResult());
      setIsAnalyzing(false);
      showToast('랜덤 동물상 결과가 나왔어요.');
    }, 1200);
  }, [isAnalyzing, previewUrl, showToast]);

  useEffect(() => {
    if (result) {
      window.setTimeout(() => {
        resultSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [result]);

  const handleRetest = () => {
    if (!previewUrl) {
      showToast('먼저 사진을 업로드해주세요.');
      return;
    }
    handleAnalyze();
  };

  const handleCopy = async () => {
    await copyText(resultText);
    showToast('결과를 복사했어요.');
  };

  const handleInstagramShare = async () => {
    await handleCopy();
    window.open('https://www.instagram.com/direct/inbox/', '_blank', 'noopener,noreferrer');
    showToast('결과 복사 후 인스타그램 DM 화면을 열었어요.');
  };

  const getSelectedImageFiles = () => {
    if (fileInputRef.current?.files?.length) {
      return fileInputRef.current.files;
    }

    if (!selectedImageFile) {
      return null;
    }

    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(selectedImageFile);
      return dataTransfer.files;
    } catch (error) {
      return [selectedImageFile];
    }
  };

  const handleKakaoShare = async () => {
    const hasKakaoKey = KAKAO_APP_KEY && KAKAO_APP_KEY !== '여기에_카카오_JavaScript_키';
    const kakao = window.Kakao;

    if (hasKakaoKey && kakao) {
      try {
        if (!kakao.isInitialized()) {
          kakao.init(KAKAO_APP_KEY);
        }

        let uploadedImageUrl = '';
        if (selectedImageFile) {
          if (selectedImageFile.size > MAX_KAKAO_IMAGE_SIZE) {
            showToast('카카오 공유 이미지는 5MB 이하만 가능해요.');
          } else if (kakao.Share.uploadImage) {
            showToast('사진을 카카오 공유용으로 준비 중이에요.');
            const uploadResponse = await kakao.Share.uploadImage({
              file: getSelectedImageFiles()
            });
            uploadedImageUrl = uploadResponse.infos.original.url;
          }
        }

        if (uploadedImageUrl) {
          kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
              title: '나의 동물상 테스트 결과',
              description: resultText.replace(/\n/g, ' / '),
              imageUrl: uploadedImageUrl,
              link: {
                mobileWebUrl: SERVICE_URL,
                webUrl: SERVICE_URL
              }
            },
            buttons: [
              {
                title: '테스트 하러 가기',
                link: {
                  mobileWebUrl: SERVICE_URL,
                  webUrl: SERVICE_URL
                }
              }
            ]
          });
        } else {
          kakao.Share.sendDefault({
            objectType: 'text',
            text: `${resultText}\n\n나도 테스트하러 가기`,
            link: {
              mobileWebUrl: SERVICE_URL,
              webUrl: SERVICE_URL
            },
            buttonTitle: '테스트 하러 가기'
          });
        }
        return;
      } catch (error) {
        await handleCopy();
        showToast('사진 공유에 실패해 결과를 복사했어요.');
        return;
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: '동물상 테스트 결과',
          text: resultText,
          url: SERVICE_URL
        });
        return;
      } catch (error) {
        await handleCopy();
        return;
      }
    }

    await handleCopy();
    showToast('카카오 키가 없어 결과 복사로 대신했어요.');
  };

  const handleSaveResultImage = async () => {
    if (!result || !resultCardRef.current || isSavingImage) {
      return;
    }

    setIsSavingImage(true);

    try {
      await document.fonts?.ready;
      const canvas = await html2canvas(resultCardRef.current, {
        backgroundColor: '#111318',
        scale: 1,
        useCORS: true,
        width: 1080,
        height: 1920,
        windowWidth: 1080,
        windowHeight: 1920
      });
      const imageUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = 'animal-face-result.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('결과 이미지가 저장되었어요. 인스타 스토리나 카카오톡에 공유해보세요.');
    } catch (error) {
      showToast('이미지 저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setIsSavingImage(false);
    }
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    const trimmedNickname = nickname.trim();
    const trimmedText = commentText.trim();

    if (!trimmedNickname || !trimmedText) {
      showToast('닉네임과 댓글을 모두 입력해주세요.');
      return;
    }

    try {
      const nextComments = await createComment(trimmedNickname, trimmedText, getCommentOwnerToken());
      const createdComment = nextComments.find((comment) => (
        comment.nickname === trimmedNickname && comment.text === trimmedText
      ));
      if (createdComment?.id) {
        const nextIds = [createdComment.id, ...myCommentIds];
        setMyCommentIds(nextIds);
        saveMyCommentIds(nextIds);
      }
      setComments(nextComments);
      setCommentText('');
      setCommentsStatus('ready');
      showToast('댓글이 등록됐어요.');
    } catch (error) {
      showToast('댓글 저장소 연결을 확인해주세요.');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!commentId || deletingCommentId) {
      return;
    }

    setDeletingCommentId(commentId);

    try {
      setComments(await deleteComment(commentId, getCommentOwnerToken()));
      const nextIds = myCommentIds.filter((id) => id !== commentId);
      setMyCommentIds(nextIds);
      saveMyCommentIds(nextIds);
      showToast('댓글을 삭제했어요.');
    } catch (error) {
      showToast('내가 작성한 댓글만 삭제할 수 있어요.');
    } finally {
      setDeletingCommentId('');
    }
  };

  return (
    <main className="page">
      <div className="app-card">
        <header className="hero">
          <div className="badge">재미용 랜덤 테스트</div>
          <h1>나는 어떤 동물상일까?</h1>
          <p className="subtitle">
            사진을 올리면 강아지상, 고양이상, 여우상, 토끼상, 곰상, 사슴상 중 랜덤으로 어울리는 분위기를 보여줘요.
          </p>
        </header>

        <div className="content">
          <ImageUploadSection
            fileInputRef={fileInputRef}
            isDragOver={isDragOver}
            isAnalyzing={isAnalyzing}
            previewUrl={previewUrl}
            onAnalyze={handleAnalyze}
            onChangeImage={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragOver(false);
              handleImageFile(event.dataTransfer.files[0]);
            }}
            onFileChange={(event) => handleImageFile(event.target.files[0])}
          />

          <ResultSection
            ref={resultSectionRef}
            isAnalyzing={isAnalyzing}
            analysisMessage={analysisMessage}
            result={result}
            topResult={topResult}
            onRetest={handleRetest}
          />

          <ShareSection
            disabled={!hasResult}
            isSavingImage={isSavingImage}
            hasResult={hasResult}
            onSaveImage={handleSaveResultImage}
            onCopy={handleCopy}
            onInstagram={handleInstagramShare}
            onKakao={handleKakaoShare}
          />

          <CommentSection
            comments={comments}
            status={commentsStatus}
            myCommentIds={myCommentIds}
            deletingCommentId={deletingCommentId}
            nickname={nickname}
            commentText={commentText}
            onNicknameChange={setNickname}
            onCommentTextChange={setCommentText}
            onRefresh={() => refreshComments(true)}
            onSubmit={handleCommentSubmit}
            onDelete={handleDeleteComment}
          />
        </div>
      </div>
      <ResultImageCard ref={resultCardRef} result={result} topResult={topResult} />
      <Toast message={toast} />
    </main>
  );
}

function SectionTitle({ id, title, hint, children }) {
  return (
    <div className="section-title">
      <h2 id={id}>{title}</h2>
      {children || <span className="hint">{hint}</span>}
    </div>
  );
}

function ImageUploadSection({
  fileInputRef,
  isDragOver,
  isAnalyzing,
  previewUrl,
  onAnalyze,
  onChangeImage,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange
}) {
  return (
    <section className="section" aria-labelledby="uploadTitle">
      <SectionTitle id="uploadTitle" title="사진 업로드" hint="JPG, PNG, GIF 가능" />
      <label
        className={`upload-box${isDragOver ? ' drag-over' : ''}`}
        htmlFor="imageInput"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <span className="upload-content">
          <span className="upload-icon" aria-hidden="true">📷</span>
          <strong>사진을 선택하거나 여기로 끌어오세요</strong>
          <span className="upload-help">업로드한 사진은 이 브라우저 화면에서만 미리보기로 사용됩니다.</span>
        </span>
      </label>
      <input
        ref={fileInputRef}
        className="file-input"
        id="imageInput"
        type="file"
        accept="image/*"
        onChange={onFileChange}
      />

      {previewUrl && (
        <>
          <div className="preview-area">
            <img className="preview-img" src={previewUrl} alt="업로드한 사진 미리보기" />
            <div className="preview-copy">
              <strong>사진 준비 완료</strong>
              <p>아래 버튼을 누르면 랜덤 방식으로 동물상 퍼센트를 만들어드려요.</p>
              <div className="actions">
                <button className="btn btn-ghost" type="button" onClick={onChangeImage}>사진 바꾸기</button>
              </div>
            </div>
          </div>
          <div className="preview-cta">
            <button
              className="btn cta-analyze"
              type="button"
              disabled={isAnalyzing}
              onClick={onAnalyze}
            >
              {isAnalyzing ? '분석 중...' : '내 동물상 결과 보기'}
            </button>
            <p className="cta-helper">업로드한 사진은 브라우저 화면에서만 미리보기로 사용됩니다.</p>
          </div>
        </>
      )}
    </section>
  );
}

const ResultSection = React.forwardRef(function ResultSection(
  { isAnalyzing, analysisMessage, result, topResult, onRetest },
  ref
) {
  return (
    <section ref={ref} className="section" aria-labelledby="resultTitle">
      <SectionTitle id="resultTitle" title="분석 결과" hint="랜덤 퍼센트" />

      {!result && !isAnalyzing && <p className="result-empty">사진을 업로드한 뒤 결과 보기를 눌러주세요.</p>}
      {isAnalyzing && (
        <div className="analysis-loading" aria-live="polite">
          <div className="loading-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <strong>{analysisMessage}</strong>
          <div className="skeleton-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
      {topResult && (
        <div className="result-summary">
          <span className="result-ready-label">사진 준비 완료</span>
          <strong>{topResult.animal} {topResult.percent}%</strong>
          <p>재미로 보는 분위기 분석 결과예요.</p>
        </div>
      )}
      {result && (
        <div className="result-list">
          {result.map((item) => (
            <div className="result-row" key={item.animal}>
              <div className="result-label">
                <span>{item.animal}</span>
                <span>{item.percent}%</span>
              </div>
              <div className="bar" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${item.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {result && (
        <button className="btn btn-retest" type="button" onClick={onRetest}>
          다시 테스트하기
        </button>
      )}
    </section>
  );
});

function ShareSection({ disabled, isSavingImage, hasResult, onSaveImage, onCopy, onInstagram, onKakao }) {
  return (
    <section className="section" aria-labelledby="shareTitle">
      <SectionTitle
        id="shareTitle"
        title="공유하기"
        hint={hasResult ? '친구에게 결과를 공유해보세요' : '결과 생성 후 사용 가능'}
      />
      <button
        className="btn btn-save-image"
        type="button"
        disabled={disabled || isSavingImage}
        onClick={onSaveImage}
      >
        {isSavingImage ? '이미지 생성 중...' : '결과 이미지 저장'}
      </button>
      <div className="share-grid">
        <button className="btn btn-secondary" type="button" disabled={disabled} onClick={onCopy}>결과 복사</button>
        <button className="btn btn-pink" type="button" disabled={disabled} onClick={onInstagram}>인스타그램 DM</button>
        <button className="btn btn-blue" type="button" disabled={disabled} onClick={onKakao}>카카오톡 공유</button>
      </div>
    </section>
  );
}

const ResultImageCard = React.forwardRef(function ResultImageCard({ result, topResult }, ref) {
  const meta = topResult ? ANIMAL_META[topResult.animal] : null;
  const origin = typeof window !== 'undefined' ? window.location.origin : SERVICE_URL;

  return (
    <div className="result-card-capture-wrap" aria-hidden="true">
      <div className="result-image-card" ref={ref}>
        {topResult && meta && result && (
          <>
            <div className="capture-bg-glow capture-bg-glow-one" />
            <div className="capture-bg-glow capture-bg-glow-two" />
            <div className="capture-content">
              <div className="capture-label">재미로 보는 동물상 테스트</div>
              <div className="capture-emoji">{meta.emoji}</div>
              <h3>나는 {topResult.animal} {topResult.percent}%</h3>
              <p className="capture-description">{meta.description}</p>

              <div className="capture-result-list">
                {result.map((item) => (
                  <div className="capture-result-row" key={item.animal}>
                    <div className="capture-result-label">
                      <span>{item.animal}</span>
                      <strong>{item.percent}%</strong>
                    </div>
                    <div className="capture-bar">
                      <div className="capture-bar-fill" style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="capture-footer">
                <strong>너도 테스트해보기</strong>
                <span>{origin}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

function CommentSection({
  comments,
  status,
  myCommentIds,
  deletingCommentId,
  nickname,
  commentText,
  onNicknameChange,
  onCommentTextChange,
  onRefresh,
  onSubmit,
  onDelete
}) {
  return (
    <section className="section" aria-labelledby="commentTitle">
      <SectionTitle id="commentTitle" title="댓글">
        <button className="btn btn-ghost" type="button" onClick={onRefresh}>새로고침</button>
      </SectionTitle>

      <form className="comment-form" onSubmit={onSubmit}>
        <input
          className="field"
          type="text"
          maxLength="16"
          placeholder="닉네임"
          autoComplete="name"
          value={nickname}
          onChange={(event) => onNicknameChange(event.target.value)}
        />
        <textarea
          className="field"
          maxLength="180"
          placeholder="댓글을 입력하세요"
          value={commentText}
          onChange={(event) => onCommentTextChange(event.target.value)}
        />
        <button className="btn btn-primary" type="submit">등록</button>
      </form>

      <div className="comment-list">
        {status === 'loading' && <p className="empty-comments">댓글을 불러오는 중이에요.</p>}
        {status === 'error' && <p className="empty-comments">공용 댓글 저장소 연결을 확인해주세요.</p>}
        {status === 'ready' && comments.length === 0 && (
          <p className="empty-comments">아직 댓글이 없어요. 첫 댓글을 남겨보세요.</p>
        )}
        {status === 'ready' && comments.map((comment) => (
          <article className="comment-item" key={comment.id || `${comment.nickname}-${comment.date}`}>
            <div className="comment-meta">
              <span className="comment-name">{comment.nickname}</span>
              <span>{comment.date}</span>
            </div>
            <p className="comment-text">{comment.text}</p>
            {myCommentIds.includes(comment.id) && (
              <button
                className="comment-delete"
                type="button"
                disabled={deletingCommentId === comment.id}
                onClick={() => onDelete(comment.id)}
              >
                {deletingCommentId === comment.id ? '삭제 중...' : '삭제'}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function Toast({ message }) {
  return (
    <div className={`toast${message ? ' show' : ''}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
