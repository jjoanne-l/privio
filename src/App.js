import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import LoadingAnimation from './components/LoadingAnimation';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);
  const [originalPredictions, setOriginalPredictions] = useState([]);
  const [protectedPredictions, setProtectedPredictions] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [originalHeatmap, setOriginalHeatmap] = useState(null);
  const [protectedHeatmap, setProtectedHeatmap] = useState(null);
  const [aiViewImage, setAiViewImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef(null);

  // TensorFlow 모델 로드
  useEffect(() => {
    async function loadModel() {
      try {
        await tf.ready();
        const loadedModel = await mobilenet.load();
        setModel(loadedModel);
        // 모델 로드 후 2초 뒤에 로딩 화면 제거
        setTimeout(() => {
          setIsLoading(false);
        }, 2000);
      } catch (err) {
        console.error('Failed to load model:', err);
        setError('AI 모델 로드에 실패했습니다.');
        setIsLoading(false);
      }
    }
    loadModel();
  }, []);

  // 히트맵 생성 함수
  const generateHeatmap = async (imageElement, predictions) => {
    if (!model || !predictions.length) return null;
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageElement.width;
      canvas.height = imageElement.height;
      const ctx = canvas.getContext('2d');
      
      // 이미지 그리기
      ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
      
      // 이미지 데이터 가져오기
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const tensor = tf.browser.fromPixels(imageData);
      
      // 모델의 중간 레이어 활성화 가져오기
      const activation = model.infer(tensor, true);
      const activationData = await activation.data();
      
      // 활성화 맵 시각화
      const heatmapCanvas = document.createElement('canvas');
      heatmapCanvas.width = canvas.width;
      heatmapCanvas.height = canvas.height;
      const heatmapCtx = heatmapCanvas.getContext('2d');
      
      // 활성화 맵 그리기
      const imageData2 = heatmapCtx.createImageData(canvas.width, canvas.height);
      for (let i = 0; i < activationData.length; i++) {
        const intensity = Math.min(255, Math.max(0, activationData[i] * 255));
        imageData2.data[i * 4] = intensity;     // R
        imageData2.data[i * 4 + 1] = 0;         // G
        imageData2.data[i * 4 + 2] = 0;         // B
        imageData2.data[i * 4 + 3] = 128;       // A
      }
      
      heatmapCtx.putImageData(imageData2, 0, 0);
      
      // 원본 이미지와 히트맵 합성
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvas.width;
      finalCanvas.height = canvas.height;
      const finalCtx = finalCanvas.getContext('2d');
      
      finalCtx.drawImage(imageElement, 0, 0);
      finalCtx.globalCompositeOperation = 'multiply';
      finalCtx.drawImage(heatmapCanvas, 0, 0);
      
      return finalCanvas.toDataURL();
    } catch (err) {
      console.error('Heatmap generation failed:', err);
      return null;
    }
  };

  // 이미지 분석 함수
  const analyzeImage = async (imageElement) => {
    if (!model) return [];
    try {
      const predictions = await model.classify(imageElement);
      return predictions.slice(0, 3); // 상위 3개 예측 결과만 반환
    } catch (err) {
      console.error('Image analysis failed:', err);
      return [];
    }
  };

  // 🔹 드래그 앤 드롭 업로드 구현
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.size > 100 * 1024 * 1024) {
        setError('파일 크기는 100MB를 초과할 수 없습니다.');
        return;
      }
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setOriginalPredictions([]);
      setProtectedPredictions([]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg'],
      'image/png': ['.png'],
      'image/jpg': ['.jpg'],
    },
    maxSize: 100 * 1024 * 1024,
  });

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('이미지를 선택해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await fetch('http://localhost:3000/api/convert', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '이미지 변환에 실패했습니다.');
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (imagePath) => {
    try {
      const response = await fetch(`http://localhost:3000${imagePath}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `protected_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  // 파일 크기를 읽기 쉬운 형식으로 변환
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="app-container">
      {isLoading && <LoadingAnimation />}
      <header className="app-header">
        <h1>AI Blind</h1>
        <p className="subtitle">AI로부터 당신의 이미지를 보호하세요</p>
      </header>

      <main className="main-content">
        <div className="upload-section">
          <div className="upload-box" onClick={() => document.getElementById('fileInput').click()}>
            {preview ? (
              <img src={preview} alt="Preview" className="preview-image" />
            ) : (
              <div className="upload-placeholder">
                <svg className="upload-icon" viewBox="0 0 24 24" width="48" height="48">
                  <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                </svg>
                <p>이미지를 선택하거나 여기에 드래그하세요</p>
              </div>
            )}
          </div>
          <input
            type="file"
            id="fileInput"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button 
            className="upload-button"
            onClick={handleUpload}
            disabled={!selectedFile || loading}
          >
            {loading ? '처리 중...' : '이미지 보호하기'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {result && (
          <div className="result-section">
            <div className="result-header">
              <h2>처리 결과</h2>
              <div className={`recognition-status ${result.aiRecognition.hasPerson ? 'warning' : 'success'}`}>
                {result.aiRecognition.message}
              </div>
            </div>
            
            <div className="image-comparison">
              <div className="image-container">
                <h3>원본 이미지</h3>
                <img src={`http://localhost:3000${result.originalImage}`} alt="Original" />
              </div>
              <div className="image-container">
                <h3>보호된 이미지</h3>
                <img src={`http://localhost:3000${result.protectedImage}`} alt="Protected" />
                <button 
                  className="download-button"
                  onClick={() => handleDownload(result.protectedImage)}
                >
                  download
                </button>
              </div>
              <div className="image-container">
                <h3>AI가 보는 이미지</h3>
                <img src={`http://localhost:3000${result.aiViewImage}`} alt="AI View" />
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>© 2024 AI Blind. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
