// ตัวแปรสำหรับนับเฟรมในการประมวลผลวิดีโอ
let frameCount = 0;
// ฟังก์ชันสำหรับตั้งค่าการอัปโหลดวิดีโอ
window.setupVideoUpload = function() {
    console.log("Setting up video upload functionality...");
    
    // ค้นหาองค์ประกอบสำหรับอัปโหลดวิดีโอ
    const uploadVideoBtn = document.getElementById('upload-video-btn');
    const videoFileInput = document.getElementById('upload-video');
    const videoFileName = document.getElementById('video-file-name');
    const loadingIndicator = document.getElementById('video-loading-indicator');
    const videoAnalysisContainer = document.querySelector('.video-analysis-container');
    
    // ค้นหาองค์ประกอบ video และ canvas ที่มีอยู่แล้ว
    const videoElement = document.querySelector('.input-video');
    const canvasElement = document.querySelector('.output-canvas');
    
    console.log("Video element:", videoElement);
    console.log("Canvas element:", canvasElement);
    console.log("Pose detection:", window.poseDetection);
    
    // ถ้าไม่พบองค์ประกอบจำเป็น ให้จบการทำงาน
    if (!uploadVideoBtn || !videoFileInput) {
        console.error('ไม่พบองค์ประกอบสำหรับอัปโหลดวิดีโอ');
        return;
    }

    if (!videoElement || !canvasElement) {
        console.error('ไม่พบองค์ประกอบวิดีโอหรือแคนวาส');
        return;
    }
    
    // กำหนด context ให้กับ canvas
    const canvasCtx = canvasElement.getContext('2d');
    
    // เพิ่ม event listener ให้กับปุ่มอัปโหลดวิดีโอ
    uploadVideoBtn.addEventListener('click', () => {
        console.log("Upload button clicked");
        videoFileInput.click();
    });
    
    // เพิ่ม event listener เมื่อมีการเลือกไฟล์
    videoFileInput.addEventListener('change', (e) => {
        console.log("File selected");
        const file = e.target.files[0];
        if (!file) return;
        
        // ตรวจสอบว่าเป็นไฟล์วิดีโอหรือไม่
        if (!file.type.startsWith('video/')) {
            alert('กรุณาเลือกไฟล์วิดีโอเท่านั้น');
            return;
        }
        
        // แสดงชื่อไฟล์ที่เลือก
        if (videoFileName) {
            videoFileName.textContent = file.name;
        }
        
        // สร้าง URL สำหรับไฟล์วิดีโอ
        const videoURL = URL.createObjectURL(file);
        
        // เก็บไฟล์วิดีโอไว้ใช้งาน
        window.uploadedVideoFile = file;
        
        // แสดงตัวโหลด
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
        }
        
        // เตรียมวิดีโอสำหรับการวิเคราะห์
        prepareVideoForAnalysis(videoURL, videoElement);
        
        // สร้างปุ่มวิเคราะห์วิดีโอ (ถ้ายังไม่มี)
        if (!document.getElementById('analyze-video-btn')) {
            const analyzeVideoBtn = document.createElement('button');
            analyzeVideoBtn.id = 'analyze-video-btn';
            analyzeVideoBtn.className = 'btn btn-primary';
            analyzeVideoBtn.innerHTML = '<i class="fas fa-play-circle"></i> วิเคราะห์วิดีโอ';
            analyzeVideoBtn.style.marginTop = '10px';
            
            // เพิ่มการทำงานเมื่อคลิกปุ่มวิเคราะห์
            analyzeVideoBtn.addEventListener('click', () => {
                startVideoAnalysis(videoElement);
            });
            
            // เพิ่มปุ่มลงในหน้าเว็บ
            const uploadBox = document.querySelector('.upload-box');
            if (uploadBox) {
                uploadBox.appendChild(analyzeVideoBtn);
            }
        }
    });
    
    // เพิ่มการควบคุมการเล่นวิดีโอ
    setupVideoControls(videoElement);
    
    // เพิ่ม event listener สำหรับปุ่มสร้างรายงาน
    const generateReportBtn = document.getElementById('generate-report-btn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateVideoAnalysisReport);
        console.log("Added event listener to generate report button");
    } else {
        console.warn("Generate report button not found");
    }
    
    // เพิ่ม event listener สำหรับปุ่มในรายงาน
    const closeVideoReportBtn = document.getElementById('close-video-report-btn');
    if (closeVideoReportBtn) {
        closeVideoReportBtn.addEventListener('click', () => {
            const reportModal = document.getElementById('video-report-modal');
            if (reportModal) {
                reportModal.style.display = 'none';
            }
        });
    }
    
    // เพิ่ม event listener สำหรับ span ปิดใน modal
    const closeSpans = document.querySelectorAll('.modal .close');
    closeSpans.forEach(span => {
        span.addEventListener('click', () => {
            const modal = span.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });
};

// ฟังก์ชันเตรียมวิดีโอสำหรับการวิเคราะห์
function prepareVideoForAnalysis(videoURL, videoElement) {
    // ตรวจสอบว่ามี <video> element หรือไม่
    if (!videoElement) {
        console.error('ไม่พบ video element');
        return;
    }
    
    console.log("Preparing video for analysis:", videoURL);
    
    // เปลี่ยนแหล่งวิดีโอ
    videoElement.src = videoURL;
    videoElement.crossOrigin = 'anonymous';
    
    // แสดงส่วนควบคุมวิดีโอ
    const videoControls = document.querySelector('.video-controls');
    if (videoControls) {
        videoControls.style.display = 'block';
    }
    
    // ซ่อนตัวโหลดเมื่อโหลดวิดีโอเสร็จ
    videoElement.onloadedmetadata = () => {
        // ปรับขนาด canvas ให้เท่ากับวิดีโอ
        const canvasElement = document.querySelector('.output-canvas');
        if (canvasElement) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            console.log("Canvas resized to", canvasElement.width, "x", canvasElement.height);
        }
        
        // ซ่อนตัวโหลด
        const loadingIndicator = document.getElementById('video-loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // อัปเดตเวลาวิดีโอ
        updateVideoTimeDisplay(videoElement);
        
        // แสดงข้อความ
        const feedbackText = document.querySelector('.feedback-text');
        if (feedbackText) {
            feedbackText.textContent = `โหลดวิดีโอสำเร็จแล้ว พร้อมวิเคราะห์`;
        }
    };
    
    // เพิ่มการจัดการข้อมูลเมื่อโหลดวิดีโอเสร็จสมบูรณ์
    videoElement.onloadeddata = () => {
        console.log("Video loaded completely");
    };
    
    // จัดการกรณีเกิดข้อผิดพลาด
    videoElement.onerror = (error) => {
        console.error('เกิดข้อผิดพลาดในการโหลดวิดีโอ:', error);
        
        // ซ่อนตัวโหลด
        const loadingIndicator = document.getElementById('video-loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // แสดงข้อความผิดพลาด
        const feedbackText = document.querySelector('.feedback-text');
        if (feedbackText) {
            feedbackText.textContent = 'ไม่สามารถโหลดวิดีโอได้ กรุณาลองไฟล์อื่น';
        }
        
        // รีเซ็ตชื่อไฟล์
        const videoFileName = document.getElementById('video-file-name');
        if (videoFileName) {
            videoFileName.textContent = 'ยังไม่ได้เลือกไฟล์';
        }
    };
}

// ตั้งค่าการควบคุมการเล่นวิดีโอ
function setupVideoControls(videoElement) {
    const playPauseBtn = document.getElementById('play-pause-btn');
    const stopBtn = document.getElementById('stop-processing-btn');
    const videoProgress = document.getElementById('video-progress-bar');
    const videoTimeDisplay = document.getElementById('video-time-display');
    const videoSpeedSelect = document.getElementById('video-speed');
    
    if (!playPauseBtn || !videoElement) {
        console.warn("Video controls elements not found");
        return;
    }
    
    console.log("Setting up video controls");
    
    // เพิ่ม event listener สำหรับปุ่มเล่น/หยุด
    playPauseBtn.addEventListener('click', () => toggleVideoPlayback(videoElement));
    
    // เพิ่ม event listener สำหรับปุ่มหยุด
    if (stopBtn) {
        stopBtn.addEventListener('click', () => stopVideo(videoElement));
    }
    
    // อัปเดตแถบความคืบหน้าวิดีโอ
    videoElement.addEventListener('timeupdate', () => {
        if (videoProgress && !isNaN(videoElement.duration)) {
            const progress = (videoElement.currentTime / videoElement.duration) * 100;
            videoProgress.style.width = `${progress}%`;
            updateVideoTimeDisplay(videoElement);
        }
    });
    
    // เพิ่ม event listener สำหรับการเปลี่ยนความเร็ววิดีโอ
    if (videoSpeedSelect) {
        videoSpeedSelect.addEventListener('change', () => {
            videoElement.playbackRate = parseFloat(videoSpeedSelect.value);
        });
    }
    
    // อัปเดตปุ่มเมื่อวิดีโอเล่นหรือหยุด
    videoElement.addEventListener('play', () => {
        if (playPauseBtn) {
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }
    });
    
    videoElement.addEventListener('pause', () => {
        if (playPauseBtn) {
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    });
    
    // อัปเดตปุ่มเมื่อวิดีโอเล่นจบ
    videoElement.addEventListener('ended', () => {
        if (playPauseBtn) {
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
        
        // แสดงปุ่มสร้างรายงาน
        const generateReportBtn = document.getElementById('generate-report-btn');
        if (generateReportBtn) {
            generateReportBtn.style.display = 'block';
        }
    });
}

// สลับการเล่น/หยุดวิดีโอ
function toggleVideoPlayback(videoElement) {
    if (!videoElement) {
        console.error("Video element not found");
        return;
    }
    
    console.log("Toggle video playback");
    
    if (videoElement.paused) {
        videoElement.play();
        if (!window.isDetecting) {
            // เริ่มการวิเคราะห์ท่าทาง
            startVideoAnalysis(videoElement);
        }
    } else {
        videoElement.pause();
    }
}

// หยุดวิดีโอและการวิเคราะห์
function stopVideo(videoElement) {
    if (!videoElement) {
        console.error("Video element not found");
        return;
    }
    
    console.log("Stopping video");
    
    videoElement.pause();
    videoElement.currentTime = 0;
    
    // หยุดการวิเคราะห์
    window.isDetecting = false;
    
    // อัปเดตแถบความคืบหน้า
    const videoProgress = document.getElementById('video-progress-bar');
    if (videoProgress) {
        videoProgress.style.width = '0%';
    }
    
    // อัปเดตเวลา
    updateVideoTimeDisplay(videoElement);
    
    // รีเซ็ตค่าต่างๆ
    const feedbackText = document.querySelector('.feedback-text');
    if (feedbackText) {
        feedbackText.textContent = 'หยุดการวิเคราะห์วิดีโอแล้ว';
    }
}

// อัปเดตการแสดงเวลาวิดีโอ
function updateVideoTimeDisplay(videoElement) {
    const videoTimeDisplay = document.getElementById('video-time-display');
    if (!videoTimeDisplay || !videoElement) return;
    
    // ฟังก์ชันแปลงวินาทีเป็นรูปแบบ MM:SS
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    const currentTime = formatTime(videoElement.currentTime);
    const totalTime = formatTime(isNaN(videoElement.duration) ? 0 : videoElement.duration);
    
    videoTimeDisplay.textContent = `${currentTime} / ${totalTime}`;
}

// เริ่มการวิเคราะห์วิดีโอ
function startVideoAnalysis(videoElement) {
    if (!videoElement) {
        console.error("ไม่พบ video element");
        return;
    }
    
    console.log("เริ่มการวิเคราะห์วิดีโอ");
    
    // รีเซ็ตตัวนับเฟรม
    frameCount = 0;
    
    // ตรวจสอบว่ามี MediaPipe Pose หรือไม่
    if (!window.poseDetection) {
        console.log("MediaPipe Pose ยังไม่พร้อม กำลังติดตั้ง...");
        setupMediaPipePose();
    }
    
    // เริ่มเล่นวิดีโอ
    videoElement.play();
    
    // ตั้งค่าการวิเคราะห์
    window.isDetecting = true;
    window.videoSource = 'file';
    window.isUsingCamera = false;
    
    // กำหนดท่าเริ่มต้นถ้ายังไม่ได้กำหนด
    if (!window.currentExercise || window.currentExercise === '') {
        const exerciseSelect = document.getElementById('exercise-select');
        if (exerciseSelect && exerciseSelect.value) {
            window.currentExercise = exerciseSelect.value;
        } else {
            window.currentExercise = 'butterfly-dance'; // ชื่อท่ายกแขนที่กำหนด
        }
        console.log("กำหนดท่าเป็น:", window.currentExercise);
    }
    
    // รีเซ็ตค่าต่างๆ
    window.repCounter = 0;
    window.setCounter = 1;
    window.exerciseCount = 0;
    window.sessionStartTime = Date.now();
    
    // แสดงส่วนการวิเคราะห์
    const videoAnalysisContainer = document.querySelector('.video-analysis-container');
    if (videoAnalysisContainer) {
        videoAnalysisContainer.style.display = 'block';
    }
    
    // อัปเดตข้อความ
    const feedbackText = document.querySelector('.feedback-text');
    if (feedbackText) {
        feedbackText.textContent = 'กำลังวิเคราะห์วิดีโอ...';
    }
    
    // เตรียม canvas สำหรับแสดงผล
    const canvasElement = document.querySelector('.output-canvas');
    if (canvasElement) {
        // ปรับขนาด canvas ให้ตรงกับวิดีโอ
        canvasElement.width = videoElement.videoWidth || 640;
        canvasElement.height = videoElement.videoHeight || 480;
        
        // ทำให้ canvas มองเห็นได้
        canvasElement.style.display = 'block';
    }
    
    // เริ่มประมวลผลวิดีโอ
    processVideo(videoElement);
    
    // อัปเดตส่วนแสดงผลการวิเคราะห์
    updateAnalysisDisplay();
}
// ประมวลผลวิดีโอเฟรมต่อเฟรม
// เพิ่มเติมแก้ไขฟังก์ชัน processVideo ในไฟล์ video-upload.js
// ประมวลผลวิดีโอเฟรมต่อเฟรม
function processVideo(videoElement) {
    if (!window.isDetecting || window.videoSource !== 'file') {
        console.log("Stopping video processing");
        return;
    }
    
    if (!videoElement || videoElement.readyState < 2) {
        console.log("Video not ready, waiting...");
        requestAnimationFrame(() => processVideo(videoElement));
        return;
    }
    
    // นับเฟรม
    frameCount++;
    
    // ส่งเฟรมปัจจุบันไปยัง MediaPipe Pose
    if (window.poseDetection) {
        try {
            // แสดงการตรวจจับในทุกๆ 5 เฟรม เพื่อประสิทธิภาพ
            const showPreviewFrames = true;
            const previewInterval = 5;
            
            // บันทึกเฟรมสำหรับแสดงตัวอย่างถ้าถึงช่วงเวลาที่กำหนด
            if (showPreviewFrames && frameCount % previewInterval === 0) {
                // สร้าง canvas สำหรับจับภาพตัวอย่าง
                const previewCanvas = document.createElement('canvas');
                previewCanvas.width = videoElement.videoWidth;
                previewCanvas.height = videoElement.videoHeight;
                const previewCtx = previewCanvas.getContext('2d');
                
                // วาดวิดีโอลงใน canvas
                previewCtx.drawImage(videoElement, 0, 0, previewCanvas.width, previewCanvas.height);
                
                // เก็บ URL ของภาพ
                const frameImageUrl = previewCanvas.toDataURL('image/jpeg', 0.7);
                
                // ตรวจสอบก่อนว่ามีฟังก์ชัน updatePreviewFrame หรือไม่
                if (typeof updatePreviewFrame === 'function') {
                    updatePreviewFrame(frameImageUrl);
                }
            }
            
            // ส่งเฟรมไปยัง MediaPipe Pose
            window.poseDetection.send({image: videoElement})
                .then(() => {
                    // ตรวจสอบว่ามีผลลัพธ์การตรวจจับหรือไม่
                    if (window.poseResults && window.poseResults.poseLandmarks) {
                        // สร้างให้แน่ใจว่า drawPoseResults ถูกเรียก
                        if (typeof window.drawPoseResults === 'function') {
                            const activeSide = window.lastDetectedSide;
                            window.drawPoseResults(activeSide);
                        }
                    }
                    
                    // อัปเดตการแสดงผลการวิเคราะห์
                    updateAnalysisDisplay();
                    
                    // เรียกฟังก์ชันนี้อีกครั้งในเฟรมถัดไป
                    requestAnimationFrame(() => processVideo(videoElement));
                })
                .catch(error => {
                    console.error('เกิดข้อผิดพลาดในการประมวลผลวิดีโอ:', error);
                    // ลองอีกครั้งในเฟรมถัดไป
                    requestAnimationFrame(() => processVideo(videoElement));
                });
        } catch (error) {
            console.error('เกิดข้อผิดพลาดในการส่งเฟรมวิดีโอไปยัง MediaPipe:', error);
            // ลองอีกครั้งในเฟรมถัดไป
            requestAnimationFrame(() => processVideo(videoElement));
        }
    } else {
        console.warn("MediaPipe Pose ยังไม่พร้อมใช้งาน");
        
        // ลองติดตั้ง MediaPipe Pose อีกครั้ง
        setupMediaPipePose();
        
        // ลองอีกครั้งในเฟรมถัดไป
        setTimeout(() => {
            requestAnimationFrame(() => processVideo(videoElement));
        }, 500);
    }
}

// เพิ่มฟังก์ชันสำหรับติดตั้ง MediaPipe Pose
function setupMediaPipePose() {
    if (window.poseDetection) {
        console.log("MediaPipe Pose ถูกติดตั้งแล้ว");
        return;
    }
    
    try {
        console.log("กำลังเริ่มต้น MediaPipe Pose...");
        
        // สร้าง MediaPipe Pose
        window.poseDetection = new window.Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1635988162/${file}`;
            }
        });
        
        // ตั้งค่า Pose
        window.poseDetection.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        // กำหนดฟังก์ชันที่จะทำงานเมื่อได้ผลลัพธ์
        window.poseDetection.onResults((results) => {
            if (!window.isDetecting) return;
            
            // เก็บผลลัพธ์ลงในตัวแปร global
            window.poseResults = results;
            
            // วาดผลลัพธ์บน canvas ถ้ามีฟังก์ชัน drawPoseResults
            if (typeof window.drawPoseResults === 'function') {
                const activeSide = window.lastDetectedSide;
                window.drawPoseResults(activeSide);
            }
        });
        
        console.log("ติดตั้ง MediaPipe Pose สำเร็จ");
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการติดตั้ง MediaPipe Pose:", error);
    }
}

// อัปเดตการแสดงผลการวิเคราะห์
function updateAnalysisDisplay() {
    // อัปเดตส่วนแสดงผลการวิเคราะห์
    const poseDetectionRate = document.getElementById('pose-detection-rate');
    const videoAccuracy = document.getElementById('video-accuracy');
    const detectedExercise = document.getElementById('detected-exercise');
    const videoAnalysisText = document.getElementById('video-analysis-text');
    
    if (window.poseResults && window.poseResults.poseLandmarks) {
        // คำนวณอัตราการตรวจจับท่าทาง (จำนวนจุดที่ตรวจพบ / จำนวนจุดทั้งหมด)
        const visibleLandmarks = window.poseResults.poseLandmarks.filter(landmark => landmark && landmark.visibility > 0.5).length;
        const totalLandmarks = window.poseResults.poseLandmarks.length;
        const detectionRate = Math.round((visibleLandmarks / totalLandmarks) * 100);
        
        // อัปเดตอัตราการตรวจจับท่าทาง
        if (poseDetectionRate) {
            poseDetectionRate.textContent = `${detectionRate}%`;
        }
        
        // อัปเดตความแม่นยำ (จากค่าความแม่นยำของการวิเคราะห์ท่าทาง)
        if (videoAccuracy) {
            const accuracyValue = document.getElementById('accuracy-value');
            if (accuracyValue) {
                videoAccuracy.textContent = accuracyValue.textContent;
            } else {
                videoAccuracy.textContent = '75%'; // ค่าเริ่มต้น
            }
        }
        
        // อัปเดตท่าที่ตรวจพบ
        if (detectedExercise) {
            if (window.currentExercise === 'shoulder-flex') {
                detectedExercise.textContent = 'ท่ายกแขน';
            } else if (window.currentExercise === 'flying') {
                detectedExercise.textContent = 'ท่ายกขา';
            } else {
                detectedExercise.textContent = 'กำลังวิเคราะห์...';
            }
        }
        
        // อัปเดตข้อความวิเคราะห์
        if (videoAnalysisText) {
            if (window.exerciseCount > 0) {
                videoAnalysisText.textContent = `ตรวจพบการเคลื่อนไหวที่ถูกต้อง ${window.exerciseCount} ครั้ง จากการวิเคราะห์วิดีโอ`;
            } else if (detectionRate > 50) {
                videoAnalysisText.textContent = `ตรวจพบร่างกายในวิดีโอ กำลังวิเคราะห์ท่าทาง...`;
            } else {
                videoAnalysisText.textContent = `กำลังค้นหาร่างกายในวิดีโอ... (${detectionRate}%)`;
            }
        }
        
        // แสดงปุ่มสร้างรายงานเมื่อมีการตรวจพบท่าทางเพียงพอ
        if (window.exerciseCount > 0) {
            const generateReportBtn = document.getElementById('generate-report-btn');
            if (generateReportBtn) {
                generateReportBtn.style.display = 'block';
            }
        }
    }
}

// สร้างรายงานการวิเคราะห์วิดีโอ
function generateVideoAnalysisReport() {
    console.log("Generating video analysis report");
    
    // ตรวจสอบว่ามีผลการวิเคราะห์หรือไม่
    if (!window.poseResults) {
        console.warn("No pose results available");
        alert('ยังไม่มีข้อมูลการวิเคราะห์ กรุณาวิเคราะห์วิดีโอก่อน');
        return;
    }
    
    // คำนวณจำนวนท่าที่ตรวจพบ
    const detectedCount = window.exerciseCount || 0;
    
    // สร้างข้อมูลรายงาน
    const reportData = {
        filename: window.uploadedVideoFile ? window.uploadedVideoFile.name : 'ไม่ทราบชื่อไฟล์',
        duration: document.querySelector('.input-video') ? document.querySelector('.input-video').duration.toFixed(2) : 0,
        detectedExercise: window.currentExercise === 'shoulder-flex' ? 'ยกแขน' : 
                        window.currentExercise === 'flying' ? 'ยกขา' : 'ไม่ทราบท่า',
        detectedSide: window.lastDetectedSide === 'left' ? 'ซ้าย' : 
                    window.lastDetectedSide === 'right' ? 'ขวา' : 'ไม่ทราบ',
        exerciseCount: detectedCount,
        accuracy: document.getElementById('video-accuracy') ? 
                document.getElementById('video-accuracy').textContent : '0%',
        feedback: generateFeedbackBasedOnAnalysis(detectedCount)
    };
    
    // แสดงรายงาน
    displayVideoReport(reportData);
}

// สร้างข้อเสนอแนะตามผลการวิเคราะห์
function generateFeedbackBasedOnAnalysis(exerciseCount) {
    let feedback = '';
    
    if (window.currentExercise === 'shoulder-flex') {
        // ข้อเสนอแนะสำหรับท่ายกแขน
        if (exerciseCount >= 5) {
            feedback = 'การทำท่ายกแขนมีประสิทธิภาพดี มีการยกแขนได้มุมที่เหมาะสม แต่ควรให้ความสำคัญกับการเคลื่อนไหวที่นุ่มนวลและสม่ำเสมอมากขึ้น';
        } else if (exerciseCount > 0) {
            feedback = 'มีการเคลื่อนไหวของแขนที่ตรวจพบได้ แต่ท่าทางยังไม่สมบูรณ์ ควรยกแขนให้สูงขึ้นถึงมุมที่เหมาะสม (90-160 องศา) และทำซ้ำอย่างต่อเนื่อง';
        } else {
            feedback = 'ไม่พบการเคลื่อนไหวที่ชัดเจน อาจเกิดจากการตรวจจับไม่ถูกต้องหรือการเคลื่อนไหวน้อยเกินไป ควรปรับแสงให้เพียงพอและให้กล้องมองเห็นร่างกายเต็มตัว';
        }
    } else if (window.currentExercise === 'flying') {
        // ข้อเสนอแนะสำหรับท่ายกขา
        if (exerciseCount >= 5) {
            feedback = 'การทำท่ายกขามีประสิทธิภาพดี มีการยกขาได้ใกล้เคียงตัว L และคงท่าไว้ได้เหมาะสม ควรทำต่อเนื่องเพื่อการฟื้นฟูที่ดีขึ้น';
        } else if (exerciseCount > 0) {
            feedback = 'มีการเคลื่อนไหวของขาที่ตรวจพบได้ แต่อาจยังไม่ถึงท่าตัว L ที่สมบูรณ์ ควรยกขาให้ตั้งฉากกับลำตัวมากขึ้นและคงท่าไว้ 2-3 วินาที';
        } else {
            feedback = 'ไม่พบการเคลื่อนไหวที่ชัดเจน อาจเกิดจากการตรวจจับไม่ถูกต้องหรือการเคลื่อนไหวน้อยเกินไป ควรปรับแสงให้เพียงพอและให้กล้องมองเห็นร่างกายเต็มตัว';
        }
    } else {
        feedback = 'ไม่สามารถระบุท่าที่ชัดเจนได้ กรุณาเลือกท่าที่ต้องการวิเคราะห์จากรายการท่าฝึก';
    }
    
    // เพิ่มข้อเสนอแนะด้านแสงและตำแหน่ง
    feedback += ' ข้อเสนอแนะเพิ่มเติม: ควรถ่ายวิดีโอในที่มีแสงเพียงพอ ให้กล้องมองเห็นร่างกายเต็มตัว และไม่มีสิ่งบดบังส่วนที่ต้องการวิเคราะห์';
    
    return feedback;
}

// แสดงรายงานการวิเคราะห์วิดีโอ
function displayVideoReport(reportData) {
    // ค้นหา modal และเนื้อหารายงาน
    const reportModal = document.getElementById('video-report-modal');
    const reportContent = document.getElementById('video-report-content');
    
    if (!reportModal || !reportContent) {
        console.error('ไม่พบองค์ประกอบสำหรับแสดงรายงาน');
        return;
    }
    
    console.log("Displaying video report:", reportData);
    
    // สร้าง HTML สำหรับรายงาน
    let reportHTML = `
        <div class="video-report-section">
            <h3>รายงานการวิเคราะห์วิดีโอ</h3>
            <div class="report-info">
                <p><strong>ชื่อไฟล์:</strong> ${reportData.filename}</p>
                <p><strong>ความยาว:</strong> ${reportData.duration} วินาที</p>
                <p><strong>ท่าที่ตรวจพบ:</strong> ${reportData.detectedExercise}</p>
                <p><strong>ข้างที่วิเคราะห์:</strong> ${reportData.detectedSide}</p>
                <p><strong>จำนวนครั้ง:</strong> ${reportData.exerciseCount} ครั้ง</p>
                <p><strong>ความแม่นยำ:</strong> ${reportData.accuracy}</p>
            </div>
        </div>
        
        <div class="video-report-section">
            <h3>ข้อเสนอแนะ</h3>
            <div class="video-findings">
                <p>${reportData.feedback}</p>
            </div>
        </div>
        
        <div class="video-report-section">
            <h3>สรุปผล</h3>
            <div class="video-recommendation">
                <h4>ผลการประเมิน</h4>
                <p>${
                    reportData.exerciseCount >= 8 ? 'การทำกายภาพบำบัดมีประสิทธิภาพดีเยี่ยม ควรรักษาระดับการฝึกนี้ไว้' :
                    reportData.exerciseCount >= 5 ? 'การทำกายภาพบำบัดอยู่ในเกณฑ์ดี ควรฝึกต่อเนื่องเพื่อพัฒนาให้ดีขึ้น' :
                    reportData.exerciseCount > 0 ? 'การทำกายภาพบำบัดยังต้องปรับปรุง ควรเพิ่มจำนวนครั้งและความสม่ำเสมอ' :
                    'ไม่พบการเคลื่อนไหวที่ชัดเจน ควรตรวจสอบตำแหน่งและแสงในการถ่ายวิดีโอ'
                }</p>
            </div>
        </div>
        
        <div class="report-date">
            <p>วันที่วิเคราะห์: ${new Date().toLocaleString('th-TH')}</p>
        </div>
    `;
    
    // เพิ่ม HTML ลงในเนื้อหารายงาน
    reportContent.innerHTML = reportHTML;
    
    // แสดง modal รายงาน
    reportModal.style.display = 'block';
    
    // เพิ่ม event listener สำหรับปุ่มดาวน์โหลดรายงาน
    const downloadReportBtn = document.getElementById('download-report-btn');
    if (downloadReportBtn) {
        downloadReportBtn.addEventListener('click', () => {
            // สร้างรายงานในรูปแบบข้อความเพื่อดาวน์โหลด
            const reportText = `
รายงานการวิเคราะห์วิดีโอ
------------------------
ชื่อไฟล์: ${reportData.filename}
ความยาว: ${reportData.duration} วินาที
ท่าที่ตรวจพบ: ${reportData.detectedExercise}
ข้างที่วิเคราะห์: ${reportData.detectedSide}
จำนวนครั้ง: ${reportData.exerciseCount} ครั้ง
ความแม่นยำ: ${reportData.accuracy}

ข้อเสนอแนะ:
${reportData.feedback}

สรุปผล:
${
    reportData.exerciseCount >= 8 ? 'การทำกายภาพบำบัดมีประสิทธิภาพดีเยี่ยม ควรรักษาระดับการฝึกนี้ไว้' :
    reportData.exerciseCount >= 5 ? 'การทำกายภาพบำบัดอยู่ในเกณฑ์ดี ควรฝึกต่อเนื่องเพื่อพัฒนาให้ดีขึ้น' :
    reportData.exerciseCount > 0 ? 'การทำกายภาพบำบัดยังต้องปรับปรุง ควรเพิ่มจำนวนครั้งและความสม่ำเสมอ' :
    'ไม่พบการเคลื่อนไหวที่ชัดเจน ควรตรวจสอบตำแหน่งและแสงในการถ่ายวิดีโอ'
}

วันที่วิเคราะห์: ${new Date().toLocaleString('th-TH')}
            `;
            
            // สร้าง Blob จากข้อความ
            const blob = new Blob([reportText], {type: 'text/plain;charset=utf-8'});
            
            // สร้าง URL สำหรับดาวน์โหลด
            const url = URL.createObjectURL(blob);
            
            // สร้างลิงก์ดาวน์โหลดและคลิกโดยอัตโนมัติ
            const a = document.createElement('a');
            a.href = url;
            a.download = `รายงานวิเคราะห์_${reportData.detectedExercise}_${new Date().toISOString().slice(0,10)}.txt`;
            document.body.appendChild(a);
            a.click();
            
            // ทำความสะอาด
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        });
    }
}
// เพิ่มฟังก์ชันนี้ไว้ท้ายไฟล์ video-upload.js หรือก่อนการเรียกใช้ฟังก์ชัน
// ฟังก์ชันอัปเดตเฟรมตัวอย่าง
function updatePreviewFrame(imageUrl) {
    // ตรวจสอบว่ามีพื้นที่แสดงเฟรมตัวอย่างหรือไม่
    let previewContainer = document.querySelector('.preview-frame-container');
    
    // ถ้ายังไม่มี ให้สร้างใหม่
    if (!previewContainer) {
        previewContainer = document.createElement('div');
        previewContainer.className = 'preview-frame-container';
        previewContainer.style.display = 'none'; // ซ่อนไว้เพื่อไม่ให้รบกวนการแสดงผล
        
        // เพิ่มเข้าไปในพื้นที่วิเคราะห์วิดีโอ
        const analysisContainer = document.querySelector('.video-analysis-container');
        if (analysisContainer) {
            analysisContainer.appendChild(previewContainer);
        }
    }
    
    // อัปเดตภาพตัวอย่าง (ถ้าต้องการแสดงภาพตัวอย่าง ให้ลบ display: none ด้านบน)
    if (imageUrl) {
        previewContainer.innerHTML = `<img src="${imageUrl}" style="max-width: 100%; display: none;" />`;
    }
}