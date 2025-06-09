import cv2
import numpy as np
import os
import sys
from PIL import Image
import piexif
import traceback

def add_protection_marker(input_path, output_path):
    try:
        print(f"Reading image from: {input_path}")
        # 이미지 읽기
        image = cv2.imread(input_path)
        if image is None:
            raise Exception(f"Failed to read image from {input_path}")
        
        print(f"Image shape: {image.shape}")
        
        # 얼굴 검출기 로드
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        if face_cascade.empty():
            raise Exception("Failed to load face cascade classifier")
        
        # 얼굴 검출
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        print(f"Detected {len(faces)} faces")
        
        # 원본 이미지 그대로 저장 (보호된 이미지)
        if not cv2.imwrite(output_path, image):
            raise Exception(f"Failed to save protected image to {output_path}")
        
        # AI 뷰 이미지 생성 (검은색 마스크 적용)
        ai_view_image = image.copy()
        
        for (x, y, w, h) in faces:
            try:
                # 얼굴 영역에 패딩 추가
                padding = int(min(w, h) * 0.2)  # 20% 패딩
                x1 = max(0, x - padding)
                y1 = max(0, y - padding)
                x2 = min(image.shape[1], x + w + padding)
                y2 = min(image.shape[0], y + h + padding)
                
                # AI 뷰 이미지에 검은색 마스크 적용
                ai_view_image[y1:y2, x1:x2] = 0
            except Exception as e:
                print(f"Error processing face at ({x}, {y}, {w}, {h}): {str(e)}")
                continue
        
        # AI 뷰 이미지 저장
        ai_view_path = output_path.replace('.', '_ai_view.')
        if not cv2.imwrite(ai_view_path, ai_view_image):
            raise Exception(f"Failed to save AI view image to {ai_view_path}")
        print(f"Saved AI view image to: {ai_view_path}")
        
        # AI가 얼굴을 인식하는지 확인
        is_face_detected = check_face_detection(ai_view_path)
        print(f"Face detection in AI view: {is_face_detected}")
        
        # EXIF 데이터 추가
        try:
            exif_dict = {
                "0th": {},
                "Exif": {},
                "GPS": {},
                "1st": {},
                "thumbnail": None,
            }
            
            # 보호 마커 추가
            exif_dict["0th"][piexif.ImageIFD.Software] = "AI_Blind"
            exif_dict["Exif"][piexif.ExifIFD.UserComment] = "Protected Image"
            
            # EXIF 데이터를 JSON으로 변환
            exif_bytes = piexif.dump(exif_dict)
            
            # EXIF 데이터 추가
            piexif.insert(exif_bytes, output_path)
            print("Added EXIF data to image")
            
        except Exception as e:
            print(f"Warning: Failed to add EXIF data: {str(e)}")
            print(traceback.format_exc())
        
        return is_face_detected
        
    except Exception as e:
        print(f"Error in add_protection_marker: {str(e)}")
        print(traceback.format_exc())
        if os.path.exists(output_path):
            os.remove(output_path)
        raise

def check_face_detection(image_path):
    try:
        # 이미지 읽기
        image = cv2.imread(image_path)
        if image is None:
            print(f"Failed to read image from {image_path}")
            return False
        
        # 얼굴 검출기 로드
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        if face_cascade.empty():
            print("Failed to load face cascade classifier")
            return False
        
        # 얼굴 검출
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        # 얼굴이 검출되면 True 반환
        return len(faces) > 0
    except Exception as e:
        print(f"Error in check_face_detection: {str(e)}")
        print(traceback.format_exc())
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python fawkes.py <input_path> <output_path>")
        sys.exit(1)
        
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    try:
        is_face_detected = add_protection_marker(input_path, output_path)
        print(f"Image protection completed. Face detection result: {is_face_detected}")
        sys.exit(0 if not is_face_detected else 1)
    except Exception as e:
        print(f"Error: {str(e)}")
        print(traceback.format_exc())
        sys.exit(1)