const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const app = express();

console.log('서버 파일이 실행되고 있음');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
};
ensureDir('./uploads');
ensureDir('./processed');

// CORS 설정
app.use(cors());

app.use(express.json());

// 정적 파일 제공 설정
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/processed', express.static(path.join(__dirname, 'processed')));

// 개발 환경에서는 /api 외의 요청 차단
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (!req.url.startsWith('/api')) {
      return res.status(404).json({ error: 'Invalid API request in development mode' });
    }
    next();
  });
}

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// makeAIBlind(이미지 보호)
async function makeAIBlind(inputPath) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join('processed', `protected_${Date.now()}.png`);
    
    console.log('Processing image:', inputPath);
    console.log('Output path:', outputPath);
    
    // Python 스크립트 실행
    const pythonProcess = spawn('./venv/bin/python3', ['fawkes.py', inputPath, outputPath]);
    
    let errorOutput = '';
    let standardOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      standardOutput += data.toString();
      console.log('Python stdout:', data.toString());
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Python stderr:', data.toString());
    });
    
    pythonProcess.on('close', (code) => {
      console.log('Python process exited with code:', code);
      console.log('Standard output:', standardOutput);
      console.log('Error output:', errorOutput);
      
      if (code !== 0) {
        reject(new Error(`Failed to protect image: ${errorOutput}`));
        return;
      }
      
      if (!fs.existsSync(outputPath)) {
        reject(new Error('Protected image not found'));
        return;
      }
      
      resolve(outputPath);
    });
  });
}

app.post('/api/convert', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    console.log('Processing file:', req.file.path);
    const processedPath = await makeAIBlind(req.file.path);
    console.log('Processed file:', processedPath);

    // 파일 이름 생성
    const timestamp = Date.now();
    const downloadFilename = `ai_protected_${timestamp}.png`;
    const aiViewFilename = `ai_view_${timestamp}.png`;

    // 파일을 uploads 디렉토리로 복사
    const finalProcessedPath = path.join('uploads', downloadFilename);
    const finalAiViewPath = path.join('uploads', aiViewFilename);

    // 파일 복사
    fs.copyFileSync(processedPath, finalProcessedPath);
    if (fs.existsSync(processedPath.replace('.', '_ai_view.'))) {
      fs.copyFileSync(processedPath.replace('.', '_ai_view.'), finalAiViewPath);
    }

    // Python 스크립트의 종료 코드로 얼굴 인식 여부 확인
    const hasPerson = processedPath === 1;

    // 파일 정리 타이밍을 늘림 (30분)
    setTimeout(() => {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log('Original file cleaned up');
        }
        if (fs.existsSync(processedPath)) {
          fs.unlinkSync(processedPath);
          console.log('Processed file cleaned up');
        }
        if (fs.existsSync(processedPath.replace('.', '_ai_view.'))) {
          fs.unlinkSync(processedPath.replace('.', '_ai_view.'));
          console.log('AI view file cleaned up');
        }
      } catch (err) {
        console.error('File cleanup error:', err);
      }
    }, 30 * 60 * 1000); // 30분 후 정리

    res.json({
      success: true,
      originalImage: `/uploads/${req.file.filename}`,
      protectedImage: `/uploads/${downloadFilename}`,
      aiViewImage: `/uploads/${aiViewFilename}`,
      aiRecognition: {
        hasPerson: hasPerson,
        message: hasPerson ? '사람이 인식됨' : '사람이 인식되지 않음'
      }
    });

  } catch (err) {
    console.error('Image conversion failed:', err);
    // 에러 발생 시 업로드된 파일 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('Error cleanup: Original file removed');
      } catch (cleanupErr) {
        console.error('Error cleaning up file:', cleanupErr);
      }
    }
    res.status(500).json({ 
      success: false,
      error: err.message || 'Image processing failed'
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Uncaught error:', err);
  res.status(500).json({ error: 'Server error', detail: err.message });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build/index.html'));
  });
}

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
