
window.poseDetection = null;
window.poseResults = null;
window.isDetecting = false;
window.videoSource = 'camera';
window.currentExercise = 'shoulder-flex';
window.lastDetectedSide = null;
window.exerciseCount = 0;
window.repCounter = 0;
window.setCounter = 1;
window.sessionStartTime = null;

// เริ่มต้นเมื่อโหลดหน้าเว็บ
window.onload = function() {
    loadMediaPipeLibraries().then(() => {
      console.log("MediaPipe libraries loaded successfully");
      setupPoseDetection();
      initSpeechSystem();
      setupVideoUpload(); // เพิ่มฟังก์ชันสำหรับรองรับการอัปโหลดวิดีโอ
    }).catch(error => {
      console.error("Failed to load MediaPipe libraries:", error);
    });
};

// โหลดไลบรารี MediaPipe ที่จำเป็น
function loadMediaPipeLibraries() {
    return new Promise((resolve, reject) => {
        // โหลด core MediaPipe
        const mediapipeCore = document.createElement('script');
        mediapipeCore.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils@0.6/control_utils.js';
        mediapipeCore.crossOrigin = 'anonymous';
        document.head.appendChild(mediapipeCore);

        // โหลด drawing_utils
        const drawingUtils = document.createElement('script');
        drawingUtils.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js';
        drawingUtils.crossOrigin = 'anonymous';
        document.head.appendChild(drawingUtils);

        // โหลด camera_utils
        const cameraUtils = document.createElement('script');
        cameraUtils.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js';
        cameraUtils.crossOrigin = 'anonymous';
        document.head.appendChild(cameraUtils);

        // โหลด Pose
        const poseScript = document.createElement('script');
        poseScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1635988162/pose.js';
        poseScript.crossOrigin = 'anonymous';
        poseScript.onload = () => {
            console.log('MediaPipe libraries loaded successfully');
            resolve();
        };
        poseScript.onerror = (error) => {
            console.error('Failed to load MediaPipe libraries:', error);
            reject(error);
        };
        document.head.appendChild(poseScript);
    });
}

// ตัวแปรระดับสูงสุดในไฟล์ที่ใช้ในหลายฟังก์ชัน
// ตัวแปรสำหรับการตรวจจับท่าทาง
let isDetecting = false;
let currentExercise = 'shoulder-flex';
let detectedSide = 'auto'; // เปลี่ยนเป็น 'auto' เพื่อตรวจจับอัตโนมัติ
let lastDetectedSide = null; // เก็บข้างที่ตรวจจับล่าสุด
let sideConfidenceCount = { left: 0, right: 0 }; // ความมั่นใจในการตรวจจับด้าน
let detectedSideHistory = []; // ประวัติข้างที่ตรวจจับได้
const sideHistorySize = 10; // จำนวนผลลัพธ์ย้อนหลังที่จะใช้พิจารณา
let correctPostureCounter = 0;
const correctPostureThreshold = 10; // จำนวนเฟรมที่ต้องตรวจจับถูกติดต่อกัน

// ตัวแปรสำหรับความเสถียรในการตรวจจับท่าทาง
let poseDetectionBuffer = []; // บัฟเฟอร์เก็บผลการตรวจจับหลายเฟรม
const bufferSize = 5; // จำนวนเฟรมที่ใช้ในการทำให้การตรวจจับเสถียร
let lastValidLandmarks = null; // จำพวกจุดที่ถูกต้องล่าสุด

// ตัวแปรสำหรับการบันทึกสถิติและเซสชัน
let sessionStartTime = null;
let exerciseCount = 0;
let exerciseHistory = [];
let repCounter = 0;
let setCounter = 1;
let targetReps = 15;
let targetSets = 3;
let restTimer = null;
let restTimeRemaining = 0;
let isResting = false;

// ตัวแปรสำหรับการตรวจจับมุมของข้อไหล่
let poseResults = null;
let currentAngle = { left: 0, right: 0 };
let prevAngle = { left: 0, right: 0 };
let movementPhase = { left: 'rest', right: 'rest' }; // 'rest', 'up', 'down'
let minAngleThreshold = 30; // มุมต่ำสุดที่ถือว่าเริ่มยกแขน
let maxAngleThreshold = 150; // มุมสูงสุดที่ควรยกได้
let patientPosition = 'lying'; // 'lying' หรือ 'sitting'
let lastRepTime = { left: 0, right: 0 };

// ตัวแปรสำหรับท่ายกขา
let legMovementPhase = { left: null, right: null };
let legAngleHistory = { left: [], right: [] };
let legHoldStartTime = { left: undefined, right: undefined };
let prevWristPos = null;

// องค์ประกอบ DOM พื้นฐาน
let videoElement;
let canvasElement;
let canvasCtx;
let startButton;
let exerciseSelect;
let instructionText;
let feedbackText;
let successAlert;
let repCountElement;
let timeElement;
let accuracyElement;
let progressBar;
let progressText;
let videoUploadInput;
let videoContainer;
let sideIndicator;
let guideVisible = true; // สถานะการแสดงเส้นไกด์

// ตัวแปรสำหรับระบบเสียง
let speechSynthesis = window.speechSynthesis;
let speechQueue = [];
let isSpeaking = false;
let lastSpokenTime = 0;
const speechCooldown = 3000; // ระยะเวลารอระหว่างการพูด (3 วินาที)

// ตัวแปรสำหรับการตรวจจับ MediaPipe Pose
let poseDetection = null;
let camera = null;

// ตัวแปรสำหรับวิดีโอ
let isUsingCamera = true; // กำลังใช้กล้องหรือไฟล์วิดีโอ
let videoSource = 'camera'; // 'camera' หรือ 'file'
let videoProcessor = null; // ตัวประมวลผลวิดีโอ
let isVideoPlaying = false; // สถานะการเล่นวิดีโอ
let uploadedVideoFile = null; // เก็บไฟล์วิดีโอที่อัปโหลด

// ฟังก์ชันเริ่มต้นสำหรับระบบตรวจจับท่าทาง
function setupPoseDetection() {
    console.log('กำลังเริ่มตั้งค่า MediaPipe Pose...');
    
    // ค้นหาองค์ประกอบ DOM ที่จำเป็น
    videoElement = document.querySelector('.input-video');
    canvasElement = document.querySelector('.output-canvas');
    canvasCtx = canvasElement ? canvasElement.getContext('2d') : null;
    startButton = document.querySelector('.camera-controls .btn-primary');
    exerciseSelect = document.getElementById('exercise-select');
    instructionText = document.querySelector('.instruction-text');
    feedbackText = document.querySelector('.feedback-text');
    successAlert = document.querySelector('.success-alert');
    repCountElement = document.getElementById('rep-counter');
    timeElement = document.getElementById('exercise-timer');
    accuracyElement = document.getElementById('accuracy-value');
    progressBar = document.getElementById('exercise-progress');
    progressText = document.getElementById('progress-text');
    videoContainer = document.querySelector('.video-container');
    videoUploadInput = document.getElementById('upload-video');
    
    // ตรวจสอบว่าองค์ประกอบ DOM พร้อมใช้งานหรือไม่
    if (!checkDependencies()) {
        console.error('องค์ประกอบ DOM จำเป็นไม่พร้อมใช้งาน');
        return;
    }
    
    // เพิ่มตัวบ่งชี้ข้างที่กำลังตรวจจับ
    sideIndicator = document.createElement('div');
    sideIndicator.className = 'side-indicator';
    sideIndicator.innerHTML = '<span>กำลังตรวจจับข้าง: <b>อัตโนมัติ</b></span>';
    sideIndicator.style.position = 'absolute';
    sideIndicator.style.top = '10px';
    sideIndicator.style.left = '10px';
    sideIndicator.style.background = 'rgba(0, 0, 0, 0.7)';
    sideIndicator.style.color = 'white';
    sideIndicator.style.padding = '5px 10px';
    sideIndicator.style.borderRadius = '5px';
    sideIndicator.style.zIndex = '10';
    
    // เพิ่มเข้าไปใน DOM
    if (videoContainer) {
        videoContainer.appendChild(sideIndicator);
    }

    try {
        // สร้าง Pose detector
        if (typeof window.Pose === 'undefined') {
            console.error('ไม่พบ MediaPipe Pose API - ตรวจสอบการโหลดไลบรารี่');
            if (feedbackText) {
                feedbackText.textContent = 'ไม่สามารถโหลดไลบรารี่การตรวจจับท่าทางได้ กรุณาโหลดหน้าเว็บใหม่';
            }
            return;
        }
        
        // สร้างและตั้งค่า MediaPipe Pose
        window.poseDetection = new window.Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1635988162/${file}`;
            }
        });
        
        // กำหนดค่าการทำงาน - ปรับแต่งให้เสถียรขึ้น
        window.poseDetection.setOptions({
            modelComplexity: 1,  // ใช้โมเดลที่ละเอียดขึ้น
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        // กำหนดให้ทำงานเมื่อมีผลลัพธ์
        window.poseDetection.onResults(onPoseResults);
        
        // สร้างตัวจัดการกล้อง
        if (typeof window.Camera === 'undefined') {
            console.error('ไม่พบ MediaPipe Camera API - ตรวจสอบการโหลดไลบรารี่');
            if (feedbackText) {
                feedbackText.textContent = 'ไม่สามารถโหลดไลบรารี่กล้องได้ กรุณาโหลดหน้าเว็บใหม่';
            }
            return;
        }
        
        camera = new window.Camera(videoElement, {
            onFrame: async () => {
                if (window.isDetecting && window.poseDetection && window.videoSource === 'camera') {
                    await window.poseDetection.send({ image: videoElement });
                }
            },
            width: 640,
            height: 480
        });
        
        // เริ่มกล้อง
        camera.start()
            .then(() => {
                console.log('เริ่มกล้องสำเร็จ');
                if (startButton) {
                    startButton.innerHTML = '<i class="fas fa-play"></i> เริ่มการฝึก';
                    startButton.removeAttribute('disabled');
                }
                
                // เตรียมพร้อม canvas สำหรับแสดงผล
                if (canvasElement) {
                    canvasElement.width = videoElement.videoWidth || 640;
                    canvasElement.height = videoElement.videoHeight || 480;
                }
            })
            .catch(error => {
                console.error('ไม่สามารถเริ่มกล้องได้:', error);
                if (feedbackText) {
                    feedbackText.textContent = 'ไม่สามารถเริ่มกล้องได้ กรุณาอนุญาตการใช้กล้องและรีเฟรชหน้าเว็บ';
                }
            });
        
        // เพิ่มการฟังเหตุการณ์สำหรับปุ่มเริ่มการฝึก
        setupExerciseControls();
        
        console.log('ติดตั้ง MediaPipe Pose สำเร็จ');
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการตั้งค่า MediaPipe Pose:', error);
        if (feedbackText) {
            feedbackText.textContent = 'เกิดข้อผิดพลาดในการตั้งค่าการตรวจจับท่าทาง กรุณาโหลดหน้าเว็บใหม่';
        }
    }
    
    // ตั้งค่าแท็บและปุ่มเพิ่มเติม
    setupTabSwitching();

    // ซ่อนตัวเลือกการเลือกข้าง
    hideManualSideSelection();

    // เพิ่มปุ่มบังคับเลือกข้าง
    addForceSideButtons();
}

function hideManualSideSelection() {
    // ซ่อนหรือลบตัวเลือกข้างออกจาก UI
    const sideSelectContainer = document.querySelector('#side-select').parentElement;
    if (sideSelectContainer) {
        sideSelectContainer.style.display = 'none';
    }
    
    // เพิ่มข้อความแจ้งว่าระบบจะตรวจจับอัตโนมัติ
    const infoMessage = document.createElement('div');
    infoMessage.className = 'auto-detection-info';
    infoMessage.textContent = 'ระบบจะตรวจจับข้างอัตโนมัติ';
    infoMessage.style.color = '#4CAF50';
    infoMessage.style.marginTop = '5px';
    infoMessage.style.marginBottom = '10px';
    infoMessage.style.fontStyle = 'italic';
    
    // แทรกข้อความนี้หลังจากกล่องตัวเลือกที่ถูกซ่อน
    if (sideSelectContainer && sideSelectContainer.parentElement) {
        sideSelectContainer.parentElement.insertBefore(infoMessage, sideSelectContainer.nextSibling);
    }
    
    // ตั้งค่าเริ่มต้นให้เป็นโหมดอัตโนมัติ
    detectedSide = 'auto';
    updateSideIndicator('อัตโนมัติ');
}

// เรียกใช้ฟังก์ชันนี้เพื่อซ่อนตัวเลือกการเลือกข้าง
hideManualSideSelection();

// เพิ่มปุ่มบังคับเลือกข้างสำหรับกรณีที่การตรวจจับอัตโนมัติผิดพลาด
addForceSideButtons();

// ตั้งค่าการอัปโหลดวิดีโอ
function setupVideoUpload() {
  if (typeof window.setupVideoUpload === 'function') {
    window.setupVideoUpload();
  } else {
    console.error('ฟังก์ชัน setupVideoUpload ไม่พร้อมใช้งาน');
  }
}


// จัดการการอัปโหลดวิดีโอ
function handleVideoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // ตรวจสอบว่าเป็นไฟล์วิดีโอหรือไม่
    if (!file.type.match('video.*')) {
        alert('กรุณาเลือกไฟล์วิดีโอเท่านั้น');
        return;
    }
    
    // เก็บไฟล์วิดีโอ
    uploadedVideoFile = file;
    
    // สร้าง URL สำหรับไฟล์วิดีโอ
    const videoURL = URL.createObjectURL(file);
    
    // เปลี่ยนแหล่งข้อมูลของวิดีโอ
    videoElement.src = videoURL;
    videoElement.load();
    
    // เปลี่ยนโหมดเป็นการใช้วิดีโอที่อัปโหลด
    videoSource = 'file';
    isUsingCamera = false;
    
    // หยุดกล้อง
    if (camera) {
        camera.stop();
    }
    
    // แสดงชื่อไฟล์ในส่วนควบคุม
    const fileNameDisplay = document.createElement('div');
    fileNameDisplay.className = 'uploaded-file-name';
    fileNameDisplay.textContent = `วิดีโอที่เลือก: ${file.name}`;
    fileNameDisplay.style.marginTop = '5px';
    fileNameDisplay.style.fontSize = '12px';
    
    // ลบชื่อไฟล์เดิม (ถ้ามี)
    const oldFileNameDisplay = document.querySelector('.uploaded-file-name');
    if (oldFileNameDisplay) {
        oldFileNameDisplay.remove();
    }
    
    // เพิ่มชื่อไฟล์ใหม่
    const cameraControls = document.querySelector('.camera-controls');
    if (cameraControls) {
        cameraControls.appendChild(fileNameDisplay);
    }
    
    // อัปเดตปุ่มสลับแหล่งข้อมูล
    const toggleButton = document.getElementById('toggle-source-btn');
    if (toggleButton) {
        toggleButton.title = 'กลับไปใช้กล้อง';
    }
    
    // แสดงข้อความว่าใช้วิดีโอที่อัปโหลด
    if (feedbackText) {
        feedbackText.textContent = `กำลังใช้วิดีโอที่อัปโหลด: ${file.name}`;
    }
    
    // อัปเดตสถานะการเล่นวิดีโอ
    videoElement.onloadedmetadata = function() {
        // ปรับขนาด canvas ให้ตรงกับวิดีโอ
        if (canvasElement) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
        }
        
        // เริ่มเล่นวิดีโออัตโนมัติถ้ากำลังตรวจจับท่าทาง
        if (isDetecting) {
            videoElement.play();
        }
    };
}

// สลับระหว่างกล้องและวิดีโอที่อัปโหลด
function toggleVideoSource() {
    // ถ้ากำลังใช้กล้อง และมีไฟล์วิดีโอ ให้เปลี่ยนเป็นวิดีโอ
    if (videoSource === 'camera' && uploadedVideoFile) {
        videoSource = 'file';
        isUsingCamera = false;
        
        // หยุดกล้อง
        if (camera) {
            camera.stop();
        }
        
        // สร้าง URL สำหรับไฟล์วิดีโออีกครั้ง
        const videoURL = URL.createObjectURL(uploadedVideoFile);
        videoElement.src = videoURL;
        videoElement.load();
        
        // เริ่มเล่นวิดีโออัตโนมัติถ้ากำลังตรวจจับท่าทาง
        if (isDetecting) {
            videoElement.play();
        }
        
        // อัปเดตปุ่มสลับแหล่งข้อมูล
        const toggleButton = document.getElementById('toggle-source-btn');
        if (toggleButton) {
            toggleButton.title = 'กลับไปใช้กล้อง';
            toggleButton.innerHTML = '<i class="fas fa-camera"></i> ใช้กล้อง';
        }
        
        // แสดงข้อความว่าใช้วิดีโอที่อัปโหลด
        if (feedbackText) {
            feedbackText.textContent = `กำลังใช้วิดีโอที่อัปโหลด: ${uploadedVideoFile.name}`;
        }
    }
    // ถ้ากำลังใช้วิดีโอ ให้เปลี่ยนกลับไปใช้กล้อง
    else if (videoSource === 'file') {
        videoSource = 'camera';
        isUsingCamera = true;
        
        // หยุดการเล่นวิดีโอ
        videoElement.pause();
        videoElement.src = '';
        
        // เริ่มกล้อง
        if (camera) {
            camera.start().then(() => {
                console.log('เริ่มกล้องอีกครั้ง');
                
                // ปรับขนาด canvas ให้ตรงกับวิดีโอจากกล้อง
                if (canvasElement) {
                    canvasElement.width = videoElement.videoWidth || 640;
                    canvasElement.height = videoElement.videoHeight || 480;
                }
                
                // อัปเดตปุ่มสลับแหล่งข้อมูล
                const toggleButton = document.getElementById('toggle-source-btn');
                if (toggleButton) {
                    toggleButton.title = 'ใช้วิดีโอที่อัปโหลด';
                    toggleButton.innerHTML = '<i class="fas fa-file-video"></i> ใช้วิดีโอ';
                }
                
                // แสดงข้อความว่าใช้กล้อง
                if (feedbackText) {
                    feedbackText.textContent = 'กำลังใช้กล้อง';
                }
            }).catch(error => {
                console.error('ไม่สามารถเริ่มกล้องได้:', error);
                if (feedbackText) {
                    feedbackText.textContent = 'ไม่สามารถเริ่มกล้องได้ กรุณาอนุญาตการใช้กล้องและรีเฟรชหน้าเว็บ';
                }
            });
        }
    }
}

// ประมวลผลวิดีโอเฟรมต่อเฟรม
function processVideo() {
    if (!isDetecting || videoSource !== 'file' || !isVideoPlaying) return;
    
    // ส่งเฟรมปัจจุบันไปยัง MediaPipe Pose
    if (poseDetection && videoElement.readyState >= 2) {
        poseDetection.send({ image: videoElement })
            .then(() => {
                // เรียกฟังก์ชันนี้อีกครั้งในเฟรมถัดไป
                requestAnimationFrame(processVideo);
            })
            .catch(error => {
                console.error('เกิดข้อผิดพลาดในการประมวลผลวิดีโอ:', error);
            });
    } else {
        // ถ้าวิดีโอยังไม่พร้อม ลองอีกครั้งในเฟรมถัดไป
        requestAnimationFrame(processVideo);
    }
}

// ตั้งค่าการควบคุมการฝึก
function setupExerciseControls() {
    // เพิ่มการฟังเหตุการณ์สำหรับปุ่มเริ่มการฝึก
    if (startButton) {
        startButton.addEventListener('click', function() {
            if (!isDetecting) {
                // เริ่มต้นการตรวจจับ
                isDetecting = true;
                sessionStartTime = Date.now();
                repCounter = 0;
                setCounter = 1;
                exerciseCount = 0;
                
                // อ่านค่าเป้าหมาย
                targetReps = parseInt(document.getElementById('target-reps').value || 15);
                targetSets = parseInt(document.getElementById('target-sets').value || 3);
                
                // บังคับใช้การตรวจจับอัตโนมัติเสมอ
                detectedSide = 'auto';
                sideConfidenceCount = { left: 0, right: 0 };
                lastDetectedSide = null;
                detectedSideHistory = [];
                updateSideIndicator('อัตโนมัติ');
                
                // รีเซ็ตสถานะ
                movementPhase = { left: 'rest', right: 'rest' };
                legMovementPhase = { left: null, right: null };
                
                // อัปเดตการแสดงผล
                updateCounterDisplay();
                updateProgressBar();
                
                // เปลี่ยนปุ่มเป็นปุ่มหยุด
                this.innerHTML = '<i class="fas fa-stop"></i> หยุดการฝึก';
                
                // เริ่มพูดแนะนำ
                speakText(exerciseVoiceInstructions[currentExercise]['start'], true);
                
                // บันทึกเริ่มเซสชัน
                logSessionEvent('เริ่มการฝึก', `ท่า: ${currentExercise}, เป้าหมาย: ${targetReps} ครั้ง ${targetSets} เซต`);
                
                // แสดงข้อความพร้อมเริ่ม
                if (feedbackText) {
                    feedbackText.textContent = 'พร้อมเริ่มการฝึกแบบอัตโนมัติ... ทำตามคำแนะนำ';
                }
                
                // ถ้าใช้วิดีโอที่อัปโหลด ให้เริ่มเล่นและประมวลผล
                if (videoSource === 'file') {
                    videoElement.play();
                    processVideo();
                }
            } else {
                // หยุดการตรวจจับ
                isDetecting = false;
                
                // หยุดตัวนับเวลาพัก ถ้ามี
                if (restTimer) {
                    clearInterval(restTimer);
                    restTimer = null;
                }
                
                // เปลี่ยนปุ่มเป็นปุ่มเริ่ม
                this.innerHTML = '<i class="fas fa-play"></i> เริ่มการฝึก';
                
                // หยุดวิดีโอถ้าใช้ไฟล์วิดีโอ
                if (videoSource === 'file') {
                    videoElement.pause();
                }
                
                // บันทึกเหตุการณ์หยุดเซสชัน
                logSessionEvent('หยุดการฝึก', `ทำไปแล้ว ${exerciseCount} ครั้ง จากเป้าหมาย ${targetReps * targetSets} ครั้ง`);
                
                // แสดงข้อความหยุด
                if (feedbackText) {
                    feedbackText.textContent = 'หยุดการฝึก กดปุ่มเริ่มเพื่อเริ่มใหม่';
                }
}
        });
    }
    
    // อัปเดตคำแนะนำเมื่อเลือกท่ากายภาพ
    if (exerciseSelect) {
        exerciseSelect.addEventListener('change', function() {
            currentExercise = this.value;
            
            if (instructionText) {
                instructionText.textContent = exerciseInstructions[currentExercise] || 'ไม่มีคำแนะนำสำหรับท่านี้';
            }
            
            if (feedbackText) {
                feedbackText.textContent = 'เตรียมพร้อมสำหรับการฝึก... ระบบจะตรวจจับข้างอัตโนมัติ';
            }
            
            if (successAlert) {
                successAlert.style.display = 'none';
            }
            
            // รีเซ็ตตัวนับและการแสดงผล
            repCounter = 0;
            setCounter = 1;
            exerciseCount = 0;
            updateCounterDisplay();
            updateProgressBar();
            
            // รีเซ็ตค่าการตรวจจับท่าทาง
            correctPostureCounter = 0;
            movementPhase = { left: 'rest', right: 'rest' };
            
            // รีเซ็ตค่าการตรวจจับข้าง
            detectedSide = 'auto';
            lastDetectedSide = null;
            sideConfidenceCount = { left: 0, right: 0 };
            detectedSideHistory = [];
            updateSideIndicator('อัตโนมัติ');
            
            // กำหนดค่าเริ่มต้นสำหรับแต่ละท่า
            if (currentExercise === 'shoulder-flex') {
                minAngleThreshold = 30;
                maxAngleThreshold = 150;
                patientPosition = 'lying';
                
                // พูดคำแนะนำท่ายกแขน
                speakText(exerciseInstructions[currentExercise], true);
            } else if (currentExercise === 'flying') {
                // พูดคำแนะนำท่ายกขา
                speakText(exerciseInstructions[currentExercise], true);
            }
        });
    }
}

// ตั้งค่าการสลับแท็บ
function setupTabSwitching() {
    const exerciseTab = document.getElementById('exercise-tab');
    const historyTab = document.getElementById('history-tab');
    const settingsTab = document.getElementById('settings-tab');
    
    const exerciseContent = document.getElementById('exercise-content');
    const historyContent = document.getElementById('history-content');
    const settingsContent = document.getElementById('settings-content');
    
    if (exerciseTab && historyTab && settingsTab) {
        exerciseTab.addEventListener('click', () => {
            // ลบคลาส active จากทุกแท็บ
            exerciseTab.classList.add('active');
            historyTab.classList.remove('active');
            settingsTab.classList.remove('active');
            
            // เปลี่ยนเนื้อหาที่แสดง
            if (exerciseContent) exerciseContent.classList.add('active');
            if (historyContent) historyContent.classList.remove('active');
            if (settingsContent) settingsContent.classList.remove('active');
        });
        
        historyTab.addEventListener('click', () => {
            // ลบคลาส active จากทุกแท็บ
            exerciseTab.classList.remove('active');
            historyTab.classList.add('active');
            settingsTab.classList.remove('active');
            
            // เปลี่ยนเนื้อหาที่แสดง
            if (exerciseContent) exerciseContent.classList.remove('active');
            if (historyContent) historyContent.classList.add('active');
            if (settingsContent) settingsContent.classList.remove('active');
            
            // อัปเดตตารางประวัติเมื่อเข้าแท็บประวัติ
            updateHistoryTable();
        });
        
        settingsTab.addEventListener('click', () => {
            // ลบคลาส active จากทุกแท็บ
            exerciseTab.classList.remove('active');
            historyTab.classList.remove('active');
            settingsTab.classList.add('active');
            
            // เปลี่ยนเนื้อหาที่แสดง
            if (exerciseContent) exerciseContent.classList.remove('active');
            if (historyContent) historyContent.classList.remove('active');
            if (settingsContent) settingsContent.classList.add('active');
        });
    }
}

// ตรวจสอบว่า MediaPipe และองค์ประกอบ DOM พร้อมใช้งาน
function checkDependencies() {
    if (!videoElement || !canvasElement) {
        console.error('ไม่พบองค์ประกอบ video หรือ canvas กรุณาตรวจสอบ HTML');
        return false;
    }
    
    return true;
}

// คำแนะนำสำหรับแต่ละท่ากายภาพ
const exerciseInstructions = {
    'shoulder-flex': 'ผู้ป่วยนอนราบบนเตียง ผู้ช่วยจับแขนผู้ป่วยยกขึ้นในแนวระนาบข้างลำตัวช้าๆ จนถึงมุมประมาณ 90-160 องศา แล้วค่อยๆลดแขนลงกลับสู่ตำแหน่งเริ่มต้น ทำซ้ำตามจำนวนที่กำหนด',
    'flying': 'ให้ผู้ป่วยนอนราบกับเตียง จับเข่าและข้อเท้า ตั้งขาขึ้น 90 องศาให้อยู่ในท่าตัว L จากนั้นวางลงในท่าเดิม ทำซ้ำสลับกันทั้งสองข้าง ข้างละ 10 ครั้ง'
};

// คำแนะนำเสียงสำหรับแต่ละท่า
const exerciseVoiceInstructions = {
    // ตรวจสอบว่าทุกท่ามี key 'side_detected'
    'butterfly-dance': {
        'start': 'เริ่มการฝึกยกแขน จับแขนผู้ป่วยให้มั่นคง',
        'up': 'ค่อยๆยกแขนขึ้นช้าๆ',
        'top': 'ดีมาก ถึงมุมที่เหมาะสมแล้ว',
        'down': 'ค่อยๆลดแขนลงช้าๆ',
        'complete': 'ทำสำเร็จหนึ่งครั้ง',
        'rest': 'พักสักครู่ เตรียมทำครั้งต่อไป',
        'too_fast': 'ช้าลงอีกนิด ทำช้าๆ เพื่อบำบัดที่ดี',
        'too_slow': 'สามารถเพิ่มความเร็วได้อีกนิดหนึ่ง',
        'angle_too_small': 'พยายามยกให้สูงขึ้นอีกนิด ถ้าผู้ป่วยไม่รู้สึกเจ็บ',
        'angle_too_large': 'ระวังการยกสูงเกินไป อาจทำให้ผู้ป่วยเจ็บได้',
        'side_detected': 'ตรวจพบการเคลื่อนไหวข้าง'
    },
    'peacock': {
        'start': 'เริ่มการฝึกงอและเหยียดศอก จับแขนผู้ป่วยให้มั่นคง',
        'up': 'ค่อยๆงอศอกเข้าช้าๆ',
        'top': 'ดีมาก ถึงมุมที่เหมาะสมแล้ว',
        'down': 'ค่อยๆเหยียดศอกออกช้าๆ',
        'complete': 'ทำสำเร็จหนึ่งครั้ง',
        'rest': 'พักสักครู่ เตรียมทำครั้งต่อไป',
        'side_detected': 'ตรวจพบการเคลื่อนไหวข้าง'
    },
    'dragon-claw': {
        'start': 'เริ่มการฝึกกระดกข้อมือ จับแขนผู้ป่วยให้มั่นคง',
        'up': 'ค่อยๆกระดกข้อมือขึ้นช้าๆ',
        'top': 'ดีมาก ถึงมุมที่เหมาะสมแล้ว',
        'down': 'ค่อยๆลดข้อมือลงช้าๆ',
        'complete': 'ทำสำเร็จหนึ่งครั้ง',
        'rest': 'พักสักครู่ เตรียมทำครั้งต่อไป',
        'side_detected': 'ตรวจพบการเคลื่อนไหวข้าง'
    },
    'tiger-roar': {
        'start': 'เริ่มการฝึกกางเข่า จับขาผู้ป่วยให้มั่นคง',
        'up': 'ค่อยๆกางเข่าออกช้าๆ',
        'top': 'ดีมาก ถึงมุมที่เหมาะสมแล้ว',
        'down': 'ค่อยๆหุบเข่าเข้าช้าๆ',
        'complete': 'ทำสำเร็จหนึ่งครั้ง',
        'rest': 'พักสักครู่ เตรียมทำครั้งต่อไป',
        'side_detected': 'ตรวจพบการเคลื่อนไหวข้าง'
    },
    'flying': {
        'start': 'เริ่มการฝึกยกขา จับที่เข่าและข้อเท้าให้มั่นคง',
        'lifting': 'ค่อยๆยกขาขึ้นช้าๆ',
        'hold': 'คงท่าตัวแอลไว้',
        'lowering': 'ค่อยๆลดขาลงช้าๆ',
        'complete': 'ทำสำเร็จหนึ่งครั้ง',
        'rest': 'พักสักครู่ เตรียมทำครั้งต่อไป',
        'side_detected': 'ตรวจพบการเคลื่อนไหวข้าง'
    },
    // ท่าอื่นๆ ที่อาจมีในตัวเลือก
    'shoulder-flex': {
        'start': 'เริ่มการฝึกยกแขน จับแขนผู้ป่วยให้มั่นคง',
        'up': 'ค่อยๆยกแขนขึ้นช้าๆ',
        'top': 'ดีมาก ถึงมุมที่เหมาะสมแล้ว',
        'down': 'ค่อยๆลดแขนลงช้าๆ',
        'complete': 'ทำสำเร็จหนึ่งครั้ง',
        'rest': 'พักสักครู่ เตรียมทำครั้งต่อไป',
        'too_fast': 'ช้าลงอีกนิด ทำช้าๆ เพื่อบำบัดที่ดี',
        'too_slow': 'สามารถเพิ่มความเร็วได้อีกนิดหนึ่ง',
        'angle_too_small': 'พยายามยกให้สูงขึ้นอีกนิด ถ้าผู้ป่วยไม่รู้สึกเจ็บ',
        'angle_too_large': 'ระวังการยกสูงเกินไป อาจทำให้ผู้ป่วยเจ็บได้',
        'side_detected': 'ตรวจพบการเคลื่อนไหวข้าง'
    }
};


// ข้อมูลการให้ข้อเสนอแนะ
const exerciseFeedback = {
    'shoulder-flex': {
        'good': 'ท่าทางดีมาก ยกแขนได้มุมที่เหมาะสม และควบคุมจังหวะได้ดี',
        'too_slow': 'ท่าทางดี แต่ควรเพิ่มความเร็วในการยกแขนขึ้นเล็กน้อย',
        'too_fast': 'ท่าทางดี แต่ควรลดความเร็วลงและทำอย่างนุ่มนวลมากขึ้น',
        'angle_too_small': 'พยายามยกแขนให้สูงขึ้นอีกเล็กน้อย ถ้าผู้ป่วยไม่มีอาการเจ็บ',
        'angle_too_large': 'ระวังไม่ยกแขนสูงเกินไปจนทำให้ผู้ป่วยเจ็บ',
        'not_smooth': 'พยายามควบคุมการเคลื่อนไหวให้ราบรื่นและต่อเนื่องมากขึ้น'
    },
    'flying': 'ทำได้ดี ควรยกขาตั้งฉากกับลำตัวให้เป็นรูปตัว L และควบคุมขาไม่ให้แกว่งไปมาระหว่างการเคลื่อนไหว ช่วยประคองที่เข่าและข้อเท้าอย่างมั่นคง'
};

// ฟังก์ชันเริ่มต้นระบบเสียง
function initSpeechSystem() {
    if (!speechSynthesis) {
        console.error('ระบบเสียงไม่รองรับในเบราว์เซอร์นี้');
        return;
    }
    
    // เตรียมเสียงไทย
    setTimeout(() => {
        let voices = speechSynthesis.getVoices();
        console.log('พร้อมใช้งานเสียง', voices.length, 'เสียง');
        
        // ทดสอบเสียง
        speakText('ระบบแนะนำท่ากายภาพพร้อมทำงานแล้ว', true);
    }, 1000);
    
    // จัดการคิวการพูด
    setInterval(() => {
        if (speechQueue.length > 0 && !isSpeaking) {
            const now = Date.now();
            if (now - lastSpokenTime > speechCooldown) {
                const textToSpeak = speechQueue.shift();
                speakTextImmediately(textToSpeak);
            }
        }
    }, 500);
}

// ฟังก์ชันพูดข้อความเสียง
function speakText(text, immediate = false) {
    if (!speechSynthesis) return;
    
    const now = Date.now();
    if (immediate || now - lastSpokenTime > speechCooldown) {
        speakTextImmediately(text);
    } else {
        // เพิ่มเข้าคิว ถ้ายังไม่มีข้อความเดียวกันในคิว
        if (!speechQueue.includes(text)) {
            speechQueue.push(text);
        }
    }
}

// ฟังก์ชันสั่งพูดทันที
function speakTextImmediately(text) {
    if (!speechSynthesis) return;
    
    // หยุดการพูดปัจจุบัน
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // เพิ่มการตรวจสอบและแจ้งเตือนเมื่อไม่มีเสียงภาษาไทย
    const voices = speechSynthesis.getVoices();
    const thaiVoice = voices.find(voice => voice.lang.includes('th'));
    
    if (thaiVoice) {
        utterance.voice = thaiVoice;
        utterance.lang = 'th-TH';
    } else {
        console.warn('ไม่พบเสียงภาษาไทย ใช้เสียงเริ่มต้นแทน');
        // ใช้เสียงเริ่มต้นถ้าไม่มีเสียงภาษาไทย
        utterance.lang = 'en-US'; // หรืออาจใช้ภาษาอื่นที่มี
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // เพิ่มการจัดการข้อผิดพลาดที่ดีขึ้น
    utterance.onstart = () => {
        isSpeaking = true;
        console.log('เริ่มพูด: ' + text);
    };
    
    utterance.onend = () => {
        isSpeaking = false;
        lastSpokenTime = Date.now();
        console.log('พูดเสร็จสิ้น');
    };
    
    utterance.onerror = (event) => {
        console.error('เกิดข้อผิดพลาดในการพูด:', event.error, event.message);
        isSpeaking = false;
        
        // ลองใช้เสียงภาษาอื่นถ้าภาษาไทยไม่ทำงาน
        if (utterance.lang === 'th-TH') {
            console.log('ลองใช้เสียงภาษาอังกฤษแทน');
            utterance.lang = 'en-US';
            speechSynthesis.speak(utterance);
        }
    };
    
    try {
        speechSynthesis.speak(utterance);
    } catch (error) {
        console.error('ไม่สามารถเริ่มการพูดได้:', error);
        
        // ใช้การแจ้งเตือนแบบข้อความแทน
        showTextNotification(text);
    }
}

// เพิ่มฟังก์ชันแสดงข้อความแทนเสียง
function showTextNotification(text) {
    // สร้างองค์ประกอบแสดงข้อความ
    const notification = document.createElement('div');
    notification.textContent = text;
    notification.style.position = 'absolute';
    notification.style.bottom = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    notification.style.color = 'white';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '1000';
    
    // เพิ่มเข้าไปในหน้าเว็บ
    document.body.appendChild(notification);
    
    // ลบหลังจาก 3 วินาที
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
}

// ฟังก์ชันเมื่อได้รับผลลัพธ์จาก Pose Detection
function onPoseResults(results) {
    if (!window.isDetecting) return;
    
    // เก็บผลลัพธ์ลงในตัวแปร global
    window.poseResults = results;
    
    // เก็บผลลัพธ์ลงในบัฟเฟอร์
    poseDetectionBuffer.push(JSON.parse(JSON.stringify(results)));
    if (poseDetectionBuffer.length > bufferSize) {
        poseDetectionBuffer.shift();
    }
    
    // ทำให้จุดที่ตรวจจับได้มีความเสถียรมากขึ้น
    if (results.poseLandmarks) {
        const stabilizedLandmarks = stabilizeLandmarks(results.poseLandmarks);
        if (stabilizedLandmarks) {
            results.poseLandmarks = stabilizedLandmarks;
        }
    }
    
    // ตรวจจับข้างอัตโนมัติ
    if (results.poseLandmarks) {
        const rawDetectedSide = detectMovingSide(results.poseLandmarks);
        
        // เพิ่มการสมูทผลลัพธ์การตรวจจับข้าง
        const smoothedSide = smoothDetectedSide(rawDetectedSide);
        
        // เก็บผลลัพธ์
        poseResults = results;
        
        // แสดงผลการตรวจจับ
        drawPoseResults(smoothedSide);
        
        // วิเคราะห์ท่าทางของข้างที่กำลังเคลื่อนไหว
        if (smoothedSide) {
            if (window.currentExercise === 'shoulder-flex') {
                analyzeShoulderFlexion(smoothedSide);
            } else if (window.currentExercise === 'flying') {
                analyzeFlying(smoothedSide);
            }
        } else {
            // ถ้ายังไม่สามารถตรวจจับข้างได้ ให้ตรวจจับทั้งสองข้างแต่ไม่ประมวลผล
            if (feedbackText) {
                feedbackText.textContent = 'กำลังตรวจจับการเคลื่อนไหว... กรุณาเริ่มการเคลื่อนไหวอย่างช้าๆ';
            }
        }
        
        // ตรวจสอบและวิเคราะห์ท่าทางทั้งสองข้าง (เพื่อแสดงการเคลื่อนไหวทั้งสองข้าง)
        if (window.currentExercise === 'shoulder-flex') {
            // ตรวจสอบการเคลื่อนไหวของแขนซ้ายและขวาพร้อมกัน (เพื่อบันทึกมุม)
            analyzeShoulderAngleBothSides();
        } else if (window.currentExercise === 'flying') {
            // ตรวจสอบการเคลื่อนไหวของขาซ้ายและขวาพร้อมกัน
            analyzeLegAngleBothSides();
        }
    }
}

// เพิ่มฟังก์ชันใหม่สำหรับการวิเคราะห์มุมทั้งสองข้างพร้อมกัน 
// (ฟังก์ชันนี้จะเก็บค่ามุมแต่ไม่ได้นับจำนวนครั้ง)
function analyzeShoulderAngleBothSides() {
    if (!poseResults || !poseResults.poseLandmarks) return;
    
    const landmarks = poseResults.poseLandmarks;
    
    // วิเคราะห์ข้างซ้าย
    if (landmarks[11] && landmarks[13] && landmarks[15] && landmarks[23] &&
        landmarks[11].visibility > 0.5 && landmarks[13].visibility > 0.5 && 
        landmarks[15].visibility > 0.5 && landmarks[23].visibility > 0.5) {
        
        // คำนวณมุมของข้อไหล่ซ้าย
        const leftAngle = calculateAngle(
            {x: landmarks[23].x, y: landmarks[23].y},    // สะโพกซ้าย
            {x: landmarks[11].x, y: landmarks[11].y},    // ไหล่ซ้าย
            {x: landmarks[13].x, y: landmarks[13].y}     // ศอกซ้าย
        );
        
        // ปรับให้มุม 0 องศาคือแขนขนานกับลำตัว
        const adjustedLeftAngle = 180 - leftAngle;
        
        // เก็บมุมปัจจุบัน
        prevAngle.left = currentAngle.left;
        currentAngle.left = adjustedLeftAngle;
    }
    
// วิเคราะห์ข้างขวา
    if (landmarks[12] && landmarks[14] && landmarks[16] && landmarks[24] &&
        landmarks[12].visibility > 0.5 && landmarks[14].visibility > 0.5 && 
        landmarks[16].visibility > 0.5 && landmarks[24].visibility > 0.5) {
        
        // คำนวณมุมของข้อไหล่ขวา
        const rightAngle = calculateAngle(
            {x: landmarks[24].x, y: landmarks[24].y},    // สะโพกขวา
            {x: landmarks[12].x, y: landmarks[12].y},    // ไหล่ขวา
            {x: landmarks[14].x, y: landmarks[14].y}     // ศอกขวา
        );
        
        // ปรับให้มุม 0 องศาคือแขนขนานกับลำตัว
        const adjustedRightAngle = 180 - rightAngle;
        
        // เก็บมุมปัจจุบัน
        prevAngle.right = currentAngle.right;
        currentAngle.right = adjustedRightAngle;
    }
}

// เพิ่มฟังก์ชันใหม่สำหรับการวิเคราะห์มุมขาทั้งสองข้างพร้อมกัน
function analyzeLegAngleBothSides() {
    if (!poseResults || !poseResults.poseLandmarks) return;
    
    const landmarks = poseResults.poseLandmarks;
    
    // วิเคราะห์ขาซ้าย
    if (landmarks[23] && landmarks[25] && landmarks[27] &&
        landmarks[23].visibility > 0.5 && landmarks[25].visibility > 0.5 && 
        landmarks[27].visibility > 0.5) {
        
        // คำนวณมุมของข้อสะโพกซ้าย
        const hipAngle = calculateAngle(
            {x: landmarks[23].x, y: landmarks[23].y - 0.2},  // จุดอ้างอิงเหนือสะโพกซ้าย
            {x: landmarks[23].x, y: landmarks[23].y},       // สะโพกซ้าย
            {x: landmarks[25].x, y: landmarks[25].y}        // เข่าซ้าย
        );
        
        // คำนวณมุมของข้อเข่าซ้าย
        const kneeAngle = calculateAngle(
            {x: landmarks[23].x, y: landmarks[23].y},      // สะโพกซ้าย
            {x: landmarks[25].x, y: landmarks[25].y},      // เข่าซ้าย
            {x: landmarks[27].x, y: landmarks[27].y}       // ข้อเท้าซ้าย
        );
        
        // เก็บประวัติมุมข้อเข่า
        legAngleHistory.left.push(kneeAngle);
        if (legAngleHistory.left.length > 10) {
            legAngleHistory.left.shift(); // เก็บแค่ 10 ค่าล่าสุด
        }
    }
    
    // วิเคราะห์ขาขวา
    if (landmarks[24] && landmarks[26] && landmarks[28] &&
        landmarks[24].visibility > 0.5 && landmarks[26].visibility > 0.5 && 
        landmarks[28].visibility > 0.5) {
        
        // คำนวณมุมของข้อสะโพกขวา
        const hipAngle = calculateAngle(
            {x: landmarks[24].x, y: landmarks[24].y - 0.2},  // จุดอ้างอิงเหนือสะโพกขวา
            {x: landmarks[24].x, y: landmarks[24].y},       // สะโพกขวา
            {x: landmarks[26].x, y: landmarks[26].y}        // เข่าขวา
        );
        
        // คำนวณมุมของข้อเข่าขวา
        const kneeAngle = calculateAngle(
            {x: landmarks[24].x, y: landmarks[24].y},      // สะโพกขวา
            {x: landmarks[26].x, y: landmarks[26].y},      // เข่าขวา
            {x: landmarks[28].x, y: landmarks[28].y}       // ข้อเท้าขวา
        );
        
        // เก็บประวัติมุมข้อเข่า
        legAngleHistory.right.push(kneeAngle);
        if (legAngleHistory.right.length > 10) {
            legAngleHistory.right.shift(); // เก็บแค่ 10 ค่าล่าสุด
        }
    }
}

// ฟังก์ชันสำหรับการปรับความเสถียรของจุดที่ตรวจจับได้ด้วยการเฉลี่ยค่าหลายเฟรม
function stabilizeLandmarks(landmarks) {
    if (!landmarks) return null;
    
    // สร้างจุดว่างเปล่าถ้ายังไม่มีการเก็บจุดที่ผ่านมา
    if (!lastValidLandmarks) {
        lastValidLandmarks = JSON.parse(JSON.stringify(landmarks));
        return landmarks;
    }
    
    // ข้ามการปรับความเสถียรถ้าจุดมีความแตกต่างกันมาก (การเคลื่อนไหวเร็ว)
    let totalDiff = 0;
    for (let i = 0; i < landmarks.length; i++) {
        // ตรวจสอบเฉพาะจุดที่น่าเชื่อถือ
        if (isLandmarkReliable(landmarks[i]) && isLandmarkReliable(lastValidLandmarks[i])) {
            const xDiff = Math.abs(landmarks[i].x - lastValidLandmarks[i].x);
            const yDiff = Math.abs(landmarks[i].y - lastValidLandmarks[i].y);
            totalDiff += (xDiff + yDiff);
        }
    }
    
    const avgDiff = totalDiff / landmarks.length;
    // ถ้าการเคลื่อนไหวเร็วมาก ไม่ต้องปรับความเสถียร
    if (avgDiff > 0.05) {
        lastValidLandmarks = JSON.parse(JSON.stringify(landmarks));
        return landmarks;
    }
    
    // สร้างจุดใหม่ที่ผ่านการทำให้เสถียรแล้ว
    const stabilizedLandmarks = [];
    for (let i = 0; i < landmarks.length; i++) {
        if (isLandmarkReliable(landmarks[i])) {
            // คำนวณค่าเฉลี่ยถ่วงน้ำหนัก (น้ำหนักเฟรมปัจจุบันมากกว่า)
            const smoothingFactor = 0.7; // น้ำหนักของค่าปัจจุบัน (0.7 = 70% ของค่าปัจจุบัน, 30% ของค่าเก่า)
            
            stabilizedLandmarks[i] = {
                x: landmarks[i].x * smoothingFactor + lastValidLandmarks[i].x * (1 - smoothingFactor),
                y: landmarks[i].y * smoothingFactor + lastValidLandmarks[i].y * (1 - smoothingFactor),
                z: landmarks[i].z * smoothingFactor + lastValidLandmarks[i].z * (1 - smoothingFactor),
                visibility: landmarks[i].visibility
            };
        } else if (lastValidLandmarks && lastValidLandmarks[i]) {
            // ใช้ค่าล่าสุดที่เชื่อถือได้ถ้าค่าปัจจุบันเชื่อถือไม่ได้
            stabilizedLandmarks[i] = { ...lastValidLandmarks[i] };
        } else {
            // ใช้ค่าปัจจุบันถ้าไม่มีค่าที่เชื่อถือได้ก่อนหน้า
            stabilizedLandmarks[i] = { ...landmarks[i] };
        }
    }
    
    // อัปเดตค่าล่าสุดที่เชื่อถือได้
    lastValidLandmarks = JSON.parse(JSON.stringify(stabilizedLandmarks));
    
    return stabilizedLandmarks;
}

// ฟังก์ชันเพื่อตรวจสอบว่าจุด landmark มีความน่าเชื่อถือหรือไม่
// ฟังก์ชันเพื่อตรวจสอบว่าจุด landmark มีความน่าเชื่อถือหรือไม่
function isLandmarkReliable(landmark) {
    // เพิ่มการตรวจสอบที่ครอบคลุมมากขึ้น
    return landmark && 
           typeof landmark.visibility === 'number' && 
           landmark.visibility > 0.65 &&
           typeof landmark.x === 'number' && 
           typeof landmark.y === 'number' &&
           !isNaN(landmark.x) && !isNaN(landmark.y);
}

// ฟังก์ชันเพื่อตรวจหาข้างที่มีการเคลื่อนไหว (ซ้าย/ขวา) โดยอัตโนมัติ
function detectMovingSide(landmarks) {
    if (!landmarks) return null;
    
    // ตรวจสอบว่าเห็นร่างกายทั้งหมดหรือไม่
    const leftSideVisible = isLandmarkReliable(landmarks[11]) && 
                           isLandmarkReliable(landmarks[13]) && 
                           isLandmarkReliable(landmarks[15]);
    
    const rightSideVisible = isLandmarkReliable(landmarks[12]) && 
                            isLandmarkReliable(landmarks[14]) && 
                            isLandmarkReliable(landmarks[16]);
    
    // ถ้ามองเห็นแค่ข้างเดียว ให้เลือกข้างนั้นเลย
    if (leftSideVisible && !rightSideVisible) {
        if (lastDetectedSide !== 'left') {
            lastDetectedSide = 'left';
            updateSideIndicator('ซ้าย');
            
            // ตรวจสอบว่ามีคำแนะนำเสียงสำหรับท่านี้หรือไม่ก่อนพูด
            if (exerciseVoiceInstructions[currentExercise] && 
                exerciseVoiceInstructions[currentExercise]['side_detected']) {
                speakText(exerciseVoiceInstructions[currentExercise]['side_detected'] + 'ซ้าย');
            } else {
                speakText('ตรวจพบข้างซ้าย');
            }
        }
        return 'left';
    } else if (!leftSideVisible && rightSideVisible) {
        if (lastDetectedSide !== 'right') {
            lastDetectedSide = 'right';
            updateSideIndicator('ขวา');
            
            // ตรวจสอบว่ามีคำแนะนำเสียงสำหรับท่านี้หรือไม่ก่อนพูด
            if (exerciseVoiceInstructions[currentExercise] && 
                exerciseVoiceInstructions[currentExercise]['side_detected']) {
                speakText(exerciseVoiceInstructions[currentExercise]['side_detected'] + 'ขวา');
            } else {
                speakText('ตรวจพบข้างขวา');
            }
        }
        return 'right';
    }
    
    // ตรวจสอบความชัดเจนของข้างที่มองเห็น
    const leftSideConfidence = leftSideVisible ? 
        (landmarks[11].visibility + landmarks[13].visibility + landmarks[15].visibility) / 3 : 0;
    
    const rightSideConfidence = rightSideVisible ? 
        (landmarks[12].visibility + landmarks[14].visibility + landmarks[16].visibility) / 3 : 0;
    
    // ถ้าฝั่งหนึ่งมองเห็นชัดกว่าอีกฝั่งมาก ให้เลือกฝั่งนั้นเลย
    if (leftSideConfidence > rightSideConfidence * 1.5 && leftSideConfidence > 0.75) {
        if (lastDetectedSide !== 'left') {
            lastDetectedSide = 'left';
            updateSideIndicator('ซ้าย');
            
            // ตรวจสอบว่ามีคำแนะนำเสียงสำหรับท่านี้หรือไม่ก่อนพูด
            if (exerciseVoiceInstructions[currentExercise] && 
                exerciseVoiceInstructions[currentExercise]['side_detected']) {
                speakText(exerciseVoiceInstructions[currentExercise]['side_detected'] + 'ซ้าย');
            } else {
                speakText('ตรวจพบข้างซ้าย');
            }
        }
        return 'left';
    } else if (rightSideConfidence > leftSideConfidence * 1.5 && rightSideConfidence > 0.75) {
        if (lastDetectedSide !== 'right') {
            lastDetectedSide = 'right';
            updateSideIndicator('ขวา');
            
            // ตรวจสอบว่ามีคำแนะนำเสียงสำหรับท่านี้หรือไม่ก่อนพูด
            if (exerciseVoiceInstructions[currentExercise] && 
                exerciseVoiceInstructions[currentExercise]['side_detected']) {
                speakText(exerciseVoiceInstructions[currentExercise]['side_detected'] + 'ขวา');
            } else {
                speakText('ตรวจพบข้างขวา');
            }
        }
        return 'right';
    }
    
    // ถ้าทั้งสองข้างมองเห็นได้ชัดเจนพอๆ กัน ให้ตรวจสอบการเคลื่อนไหว
    if (leftSideVisible && rightSideVisible) {
        // คำนวณความเคลื่อนไหวของแต่ละข้าง
        let leftMovement = 0;
        let rightMovement = 0;
        
        // ตรวจสอบลักษณะของท่าที่แตกต่างกัน
        if (currentExercise === 'shoulder-flex') {
            // ตรวจสอบการเคลื่อนไหวของมุมข้อไหล่
            if (prevAngle.left && currentAngle.left) {
                leftMovement = Math.abs(currentAngle.left - prevAngle.left);
            }
            
            if (prevAngle.right && currentAngle.right) {
                rightMovement = Math.abs(currentAngle.right - prevAngle.right);
            }
        } else if (currentExercise === 'flying') {
            // ตรวจสอบการเคลื่อนไหวของมุมข้อเข่า
            if (legAngleHistory.left.length >= 2) {
                leftMovement = Math.abs(legAngleHistory.left[legAngleHistory.left.length - 1] - 
                                       legAngleHistory.left[legAngleHistory.left.length - 2]);
            }
            
            if (legAngleHistory.right.length >= 2) {
                rightMovement = Math.abs(legAngleHistory.right[legAngleHistory.right.length - 1] - 
                                        legAngleHistory.right[legAngleHistory.right.length - 2]);
            }
        }
        
        // เพิ่มค่าความมั่นใจให้กับข้างที่เคลื่อนไหวมากกว่า
        const movementThreshold = 3; // กำหนดค่าขั้นต่ำของการเคลื่อนไหวที่จะนำมาพิจารณา
        const confidenceThreshold = 5; // ค่าความมั่นใจที่ต้องการก่อนจะยืนยันข้าง
        
        if (leftMovement > rightMovement * 1.5 && leftMovement > movementThreshold) {
            sideConfidenceCount.left += 1;
            sideConfidenceCount.right = Math.max(0, sideConfidenceCount.right - 0.5);
        } else if (rightMovement > leftMovement * 1.5 && rightMovement > movementThreshold) {
            sideConfidenceCount.right += 1;
            sideConfidenceCount.left = Math.max(0, sideConfidenceCount.left - 0.5);
        } else {
            // ถ้าการเคลื่อนไหวใกล้เคียงกัน หรือไม่มีการเคลื่อนไหวที่ชัดเจน
            // ให้ลดค่าความมั่นใจลงทั้งสองข้าง
            sideConfidenceCount.left = Math.max(0, sideConfidenceCount.left - 0.1);
            sideConfidenceCount.right = Math.max(0, sideConfidenceCount.right - 0.1);
        }
        
        // ตัดสินใจว่าข้างไหนเคลื่อนไหว (ต้องมีความมั่นใจมากพอ)
        if (sideConfidenceCount.left >= confidenceThreshold && 
            sideConfidenceCount.left > sideConfidenceCount.right * 1.5) {
            if (lastDetectedSide !== 'left') {
                lastDetectedSide = 'left';
                updateSideIndicator('ซ้าย');
                
                // ตรวจสอบว่ามีคำแนะนำเสียงสำหรับท่านี้หรือไม่ก่อนพูด
                if (exerciseVoiceInstructions[currentExercise] && 
                    exerciseVoiceInstructions[currentExercise]['side_detected']) {
                    speakText(exerciseVoiceInstructions[currentExercise]['side_detected'] + 'ซ้าย');
                } else {
                    speakText('ตรวจพบข้างซ้าย');
                }
            }
            return 'left';
        } else if (sideConfidenceCount.right >= confidenceThreshold &&
                  sideConfidenceCount.right > sideConfidenceCount.left * 1.5) {
            if (lastDetectedSide !== 'right') {
                lastDetectedSide = 'right';
                updateSideIndicator('ขวา');
                
                // ตรวจสอบว่ามีคำแนะนำเสียงสำหรับท่านี้หรือไม่ก่อนพูด
                if (exerciseVoiceInstructions[currentExercise] && 
                    exerciseVoiceInstructions[currentExercise]['side_detected']) {
                    speakText(exerciseVoiceInstructions[currentExercise]['side_detected'] + 'ขวา');
                } else {
                    speakText('ตรวจพบข้างขวา');
                }
            }
            return 'right';
        }
    }
    
    // ถ้าไม่สามารถตัดสินใจได้ ใช้ค่าล่าสุดที่ตรวจจับได้
    return lastDetectedSide;
}
// อัปเดตการแสดงผลข้างที่กำลังตรวจจับ
function updateSideIndicator(side) {
    if (sideIndicator) {
        let sideText = 'อัตโนมัติ';
        let sideColor = 'white';
        let confidence = '';
        
        if (side === 'left') {
            sideText = 'ซ้าย';
            sideColor = '#FF9999';
            if (sideConfidenceCount.left > 0) {
                confidence = ` (${Math.min(100, Math.round(sideConfidenceCount.left * 10))}%)`;
            }
        } else if (side === 'right') {
            sideText = 'ขวา';
            sideColor = '#99CCFF';
            if (sideConfidenceCount.right > 0) {
                confidence = ` (${Math.min(100, Math.round(sideConfidenceCount.right * 10))}%)`;
            }
        }
        
        sideIndicator.innerHTML = `<span>กำลังวิเคราะห์ข้าง: <b style="color:${sideColor}">${sideText}${confidence}</b></span>`;
    }
}

// แก้ไขฟังก์ชัน drawPoseResults ให้ไฮไลท์ทั้งสองข้าง

function drawPoseResults(activeSide = null) {
    if (!canvasCtx || !poseResults) return;
    
    // เคลียร์ canvas
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // วาดภาพจากกล้อง
    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    
    // วาดเส้นบอกสถานะว่านอนหรือนั่ง (แสดงท่านอนเป็นหลัก)
    if (patientPosition === 'lying' && guideVisible) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, canvasElement.height / 2);
        canvasCtx.lineTo(canvasElement.width, canvasElement.height / 2);
        canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        canvasCtx.lineWidth = 1;
        canvasCtx.setLineDash([5, 5]);
        canvasCtx.stroke();
        canvasCtx.setLineDash([]);
        
        // เขียนคำแนะนำ
        canvasCtx.font = '16px Arial';
        canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        canvasCtx.fillText('ผู้ป่วยควรนอนราบ', 10, canvasElement.height / 2 - 10);
    }
    
    // ถ้ามีผลการตรวจจับ
    if (poseResults.poseLandmarks) {
        // วาดเส้นเชื่อมจุด
        window.drawConnectors(canvasCtx, poseResults.poseLandmarks, window.POSE_CONNECTIONS,
                         {color: '#00FF00', lineWidth: 2});
        
        // จุดที่จะไฮไลท์ทั้งสองข้าง (เปลี่ยนเป็นไฮไลท์ทุกส่วนที่สำคัญ)
        let highlightLandmarks = [];
        
        // แสดงจุดสำคัญตามประเภทของการฝึก
        if (currentExercise === 'shoulder-flex') {
            // ไฮไลท์จุดสำคัญสำหรับท่ายกแขนทั้งสองข้าง
            highlightLandmarks = [11, 12, 13, 14, 15, 16]; // ไหล่, ศอก, ข้อมือทั้งซ้ายและขวา
            
            // ถ้ามี activeSide ให้เพิ่มความเด่นชัดเฉพาะข้างที่กำลังเคลื่อนไหว
            if (activeSide === 'right') {
                // เพิ่มเส้นไฮไลท์เฉพาะข้างที่กำลังเคลื่อนไหว
                if (poseResults.poseLandmarks[12] && poseResults.poseLandmarks[14] && poseResults.poseLandmarks[16]) {
                    window.drawConnectors(canvasCtx, 
                        [poseResults.poseLandmarks[12], poseResults.poseLandmarks[14], poseResults.poseLandmarks[16]], 
                        [[0, 1], [1, 2]], 
                        {color: '#FFFF00', lineWidth: 4});
                }
            } else if (activeSide === 'left') {
                // เพิ่มเส้นไฮไลท์เฉพาะข้างที่กำลังเคลื่อนไหว
                if (poseResults.poseLandmarks[11] && poseResults.poseLandmarks[13] && poseResults.poseLandmarks[15]) {
                    window.drawConnectors(canvasCtx, 
                        [poseResults.poseLandmarks[11], poseResults.poseLandmarks[13], poseResults.poseLandmarks[15]], 
                        [[0, 1], [1, 2]], 
                        {color: '#FFFF00', lineWidth: 4});
                }
            }
        } else if (currentExercise === 'flying') {
            // ไฮไลท์จุดสำคัญสำหรับท่ายกขาทั้งสองข้าง
            highlightLandmarks = [23, 24, 25, 26, 27, 28]; // สะโพก, เข่า, ข้อเท้าทั้งซ้ายและขวา
            
            // ถ้ามี activeSide ให้เพิ่มความเด่นชัดเฉพาะข้างที่กำลังเคลื่อนไหว
            if (activeSide === 'right') {
                // เพิ่มเส้นไฮไลท์เฉพาะข้างที่กำลังเคลื่อนไหว
                if (poseResults.poseLandmarks[24] && poseResults.poseLandmarks[26] && poseResults.poseLandmarks[28]) {
                    window.drawConnectors(canvasCtx, 
                        [poseResults.poseLandmarks[24], poseResults.poseLandmarks[26], poseResults.poseLandmarks[28]], 
                        [[0, 1], [1, 2]], 
                        {color: '#FFFF00', lineWidth: 4});
                }
            } else if (activeSide === 'left') {
                // เพิ่มเส้นไฮไลท์เฉพาะข้างที่กำลังเคลื่อนไหว
                if (poseResults.poseLandmarks[23] && poseResults.poseLandmarks[25] && poseResults.poseLandmarks[27]) {
                    window.drawConnectors(canvasCtx, 
                        [poseResults.poseLandmarks[23], poseResults.poseLandmarks[25], poseResults.poseLandmarks[27]], 
                        [[0, 1], [1, 2]], 
                        {color: '#FFFF00', lineWidth: 4});
                }
            }
        }
        
        // ตัวแปรเก็บค่าไกด์
        let guideVisible = true; // เปิด/ปิดการแสดงไกด์
        let guideOpacity = 0.5; // ความโปร่งใสของเส้นไกด์
        let guideColor = 'rgba(255, 255, 0, 0.5)'; // สีของเส้นไกด์ (เหลือง)
        let correctPoseColor = 'rgba(0, 255, 0, 0.7)'; // สีเมื่อท่าถูกต้อง (เขียว)
        let incorrectPoseColor = 'rgba(255, 0, 0, 0.7)'; // สีเมื่อท่าไม่ถูกต้อง (แดง)
        let showRangeOfMotion = true; // แสดงช่วงการเคลื่อนไหวที่เหมาะสม
        let showPoseScore = true; // แสดงคะแนนท่าทาง


        // วาดเส้นชี้แนวการเคลื่อนไหวที่ถูกต้อง - แสดงเฉพาะข้างที่กำลังเคลื่อนไหว
        if (guideVisible && currentExercise === 'shoulder-flex' && activeSide) {
            if (activeSide === 'right') {
                if (poseResults.poseLandmarks[12] && poseResults.poseLandmarks[12].visibility > 0.5) {
                    // แสดงเส้นไกด์สำหรับแขนขวา
                    const shoulderX = poseResults.poseLandmarks[12].x * canvasElement.width;
                    const shoulderY = poseResults.poseLandmarks[12].y * canvasElement.height;
                    
                    canvasCtx.beginPath();
                    canvasCtx.moveTo(shoulderX, shoulderY);
                    
                    // สร้างเส้น arc เพื่อแสดงช่วงการเคลื่อนไหว
                    canvasCtx.arc(shoulderX, shoulderY, 100, -Math.PI / 2, 0, false);
                    canvasCtx.strokeStyle = guideColor;
                    canvasCtx.lineWidth = 3;
                    canvasCtx.stroke();
                    
                    // แสดงขอบเขตการเคลื่อนไหวที่เหมาะสม
                    if (showRangeOfMotion) {
                        // ขีดเส้นที่มุม min
                        const minAngleRad = (-90 + minAngleThreshold) * (Math.PI / 180);
                        const minX = shoulderX + 100 * Math.cos(minAngleRad);
                        const minY = shoulderY + 100 * Math.sin(minAngleRad);
                        
                        canvasCtx.beginPath();
                        canvasCtx.moveTo(shoulderX, shoulderY);
                        canvasCtx.lineTo(minX, minY);
                        canvasCtx.strokeStyle = 'rgba(255, 165, 0, 0.7)';
                        canvasCtx.stroke();
                        
                        // ขีดเส้นที่มุม max
                        const maxAngleRad = (-90 + maxAngleThreshold) * (Math.PI / 180);
                        const maxX = shoulderX + 100 * Math.cos(maxAngleRad);
                        const maxY = shoulderY + 100 * Math.sin(maxAngleRad);
                        
                        canvasCtx.beginPath();
                        canvasCtx.moveTo(shoulderX, shoulderY);
                        canvasCtx.lineTo(maxX, maxY);
                        canvasCtx.strokeStyle = 'rgba(50, 255, 50, 0.7)';
                        canvasCtx.stroke();
                        
                        // ใส่ข้อความกำกับมุม
                        canvasCtx.font = '12px Arial';
                        canvasCtx.fillStyle = 'white';
                        canvasCtx.fillText(`${minAngleThreshold}°`, minX + 5, minY + 5);
                        canvasCtx.fillText(`${maxAngleThreshold}°`, maxX + 5, maxY + 5);
                    }
                }
            } else if (activeSide === 'left') {
                if (poseResults.poseLandmarks[11] && poseResults.poseLandmarks[11].visibility > 0.5) {
                    // แสดงเส้นไกด์สำหรับแขนซ้าย
                    const shoulderX = poseResults.poseLandmarks[11].x * canvasElement.width;
                    const shoulderY = poseResults.poseLandmarks[11].y * canvasElement.height;
                    
                    canvasCtx.beginPath();
                    canvasCtx.moveTo(shoulderX, shoulderY);
                    
                    // สร้างเส้น arc เพื่อแสดงช่วงการเคลื่อนไหว
                    canvasCtx.arc(shoulderX, shoulderY, 100, -Math.PI, -Math.PI/2, false);
                    canvasCtx.strokeStyle = guideColor;
                    canvasCtx.lineWidth = 3;
                    canvasCtx.stroke();
                    
                    // แสดงขอบเขตการเคลื่อนไหวที่เหมาะสม
                    if (showRangeOfMotion) {
                        // ขีดเส้นที่มุม min
                        const minAngleRad = (-90 - minAngleThreshold) * (Math.PI / 180);
                        const minX = shoulderX + 100 * Math.cos(minAngleRad);
                        const minY = shoulderY + 100 * Math.sin(minAngleRad);
                        
                        canvasCtx.beginPath();
                        canvasCtx.moveTo(shoulderX, shoulderY);
                        canvasCtx.lineTo(minX, minY);
                        canvasCtx.strokeStyle = 'rgba(255, 165, 0, 0.7)';
                        canvasCtx.stroke();
                        
                        // ขีดเส้นที่มุม max
                        const maxAngleRad = (-90 - maxAngleThreshold) * (Math.PI / 180);
                        const maxX = shoulderX + 100 * Math.cos(maxAngleRad);
                        const maxY = shoulderY + 100 * Math.sin(maxAngleRad);
                        
                        canvasCtx.beginPath();
                        canvasCtx.moveTo(shoulderX, shoulderY);
                        canvasCtx.lineTo(maxX, maxY);
                        canvasCtx.strokeStyle = 'rgba(50, 255, 50, 0.7)';
                        canvasCtx.stroke();
                        
                        // ใส่ข้อความกำกับมุม
                        canvasCtx.font = '12px Arial';
                        canvasCtx.fillStyle = 'white';
                        canvasCtx.fillText(`${minAngleThreshold}°`, minX - 20, minY + 5);
                        canvasCtx.fillText(`${maxAngleThreshold}°`, maxX - 20, maxY + 5);
                    }
                }
            }
        } else if (guideVisible && currentExercise === 'flying' && activeSide) {
            // แสดงเส้นไกด์สำหรับท่ายกขา (ตัว L) เฉพาะข้างที่กำลังเคลื่อนไหว
            let hipIndex, kneeIndex;
            
            if (activeSide === 'right') {
                hipIndex = 24;
                kneeIndex = 26;
            } else {
                hipIndex = 23;
                kneeIndex = 25;
            }
            
            if (poseResults.poseLandmarks[hipIndex] && poseResults.poseLandmarks[hipIndex].visibility > 0.5) {
                const hipX = poseResults.poseLandmarks[hipIndex].x * canvasElement.width;
                const hipY = poseResults.poseLandmarks[hipIndex].y * canvasElement.height;
                
                // วาดเส้นตั้งขึ้น 90 องศา
                canvasCtx.beginPath();
                canvasCtx.moveTo(hipX, hipY);
                canvasCtx.lineTo(hipX, hipY - 120);
                canvasCtx.strokeStyle = guideColor;
                canvasCtx.lineWidth = 3;
                canvasCtx.stroke();
                
                // ใส่ข้อความกำกับมุม
                canvasCtx.font = '12px Arial';
                canvasCtx.fillStyle = 'white';
                canvasCtx.fillText('90°', hipX + 5, hipY - 60);
            }
        }
        
        // วาดจุดไฮไลท์
        const highlights = highlightLandmarks.map(index => poseResults.poseLandmarks[index])
                                         .filter(point => point && point.visibility > 0.5);
        window.drawLandmarks(canvasCtx, highlights, {color: '#FFFF00', lineWidth: 2, radius: 5});
        
        // วาดจุดทั้งหมด
        window.drawLandmarks(canvasCtx, poseResults.poseLandmarks, 
                         {color: '#FF0000', lineWidth: 1, radius: 3});
        
        // แสดงมุมที่สำคัญ - แสดงเฉพาะข้างที่กำลังเคลื่อนไหว
        if (activeSide && currentExercise === 'shoulder-flex') {
            const angle = currentAngle[activeSide];
            if (movementPhase[activeSide] !== 'rest' && angle) {
                // กำหนดตำแหน่งสำหรับแสดงมุม
                let textX = 20;
                let textY = canvasElement.height - 40;
                
                // แสดงมุมปัจจุบัน
                canvasCtx.font = '20px Arial';
                canvasCtx.fillStyle = activeSide === 'left' ? '#FF9999' : '#99CCFF';
                canvasCtx.fillText(`มุมข้อไหล่${activeSide === 'left' ? 'ซ้าย' : 'ขวา'}: ${Math.round(angle)}°`, textX, textY);
                
                // แสดงเฟสการเคลื่อนไหว
                canvasCtx.fillText(`สถานะ: ${movementPhase[activeSide] === 'up' ? 'กำลังยกขึ้น' : movementPhase[activeSide] === 'down' ? 'กำลังลดลง' : 'พัก'}`, textX, textY + 25);
            }
        } else if (activeSide && currentExercise === 'flying') {
            // ถ้าเป็นท่ายกขา
            const legPhase = legMovementPhase[activeSide];
            if (legPhase) {
                // กำหนดตำแหน่งสำหรับแสดงสถานะ
                let textX = 20;
                let textY = canvasElement.height - 40;
                
                // แสดงสถานะการเคลื่อนไหว
                canvasCtx.font = '20px Arial';
                canvasCtx.fillStyle = activeSide === 'left' ? '#FF9999' : '#99CCFF';
                canvasCtx.fillText(`ขา${activeSide === 'left' ? 'ซ้าย' : 'ขวา'}: ${legPhase === 'lifting' ? 'กำลังยกขึ้น' : legPhase === 'hold' ? 'คงท่า L' : legPhase === 'lowering' ? 'กำลังลดลง' : 'พัก'}`, textX, textY);
            }
        }
    }
}
// วิเคราะห์ท่าข้อไหล่ขึ้น-ลง
function analyzeShoulderFlexion(activeSide = null) {
    if (!poseResults || !poseResults.poseLandmarks) return;
    
    const landmarks = poseResults.poseLandmarks;
    
    // กำหนดข้างที่จะวิเคราะห์
    const side = activeSide || lastDetectedSide;
    if (!side) {
        // ถ้ายังไม่มีข้างที่ตรวจจับได้ ไม่ต้องวิเคราะห์
        if (feedbackText) {
            feedbackText.textContent = 'กำลังตรวจจับการเคลื่อนไหว... กรุณาเริ่มยกแขนช้าๆ';
        }
        return;
    }
    
    // ถ้าพบข้างที่กำลังเคลื่อนไหว ให้อัปเดตคำแนะนำ
    updateInstructionsBasedOnDetectedSide(side);
    
    // ตัวแปรเก็บตำแหน่ง landmarks ตามข้างที่เลือก
    let shoulderIndex, elbowIndex, wristIndex, hipIndex;
    
    // กำหนดดัชนีของจุดสำคัญตามข้างที่เลือก
    if (side === 'right') {
        shoulderIndex = 12; // ไหล่ขวา
        elbowIndex = 14;    // ศอกขวา
        wristIndex = 16;    // ข้อมือขวา
        hipIndex = 24;      // สะโพกขวา
    } else {
        shoulderIndex = 11; // ไหล่ซ้าย
        elbowIndex = 13;    // ศอกซ้าย
        wristIndex = 15;    // ข้อมือซ้าย
        hipIndex = 23;      // สะโพกซ้าย
    }
    
    // ตรวจสอบว่า landmarks ที่จำเป็นถูกตรวจพบครบหรือไม่
    if (!landmarks[shoulderIndex] || !landmarks[elbowIndex] || 
        !landmarks[wristIndex] || !landmarks[hipIndex] ||
        landmarks[shoulderIndex].visibility < 0.5 ||
        landmarks[elbowIndex].visibility < 0.5 ||
        landmarks[wristIndex].visibility < 0.5 ||
        landmarks[hipIndex].visibility < 0.5) {
        if (feedbackText) {
            feedbackText.textContent = `ไม่สามารถตรวจจับข้าง${side === 'left' ? 'ซ้าย' : 'ขวา'}ได้ครบถ้วน กรุณาปรับตำแหน่ง`;
        }
        correctPostureCounter = 0;
        return;
    }
    
    // คำนวณมุมของข้อไหล่
    const angle = calculateAngle(
        {x: landmarks[hipIndex].x, y: landmarks[hipIndex].y},    // สะโพก
        {x: landmarks[shoulderIndex].x, y: landmarks[shoulderIndex].y}, // ไหล่
        {x: landmarks[elbowIndex].x, y: landmarks[elbowIndex].y}  // ศอก
    );
    
    // ปรับให้มุม 0 องศาคือแขนขนานกับลำตัว
    const adjustedAngle = 180 - angle;
    
    // เก็บมุมปัจจุบัน
    prevAngle[side] = currentAngle[side];
    currentAngle[side] = adjustedAngle;
    
    // ตรวจสอบการเคลื่อนไหว
    if (currentAngle[side] > prevAngle[side] + 5 && currentAngle[side] > minAngleThreshold && movementPhase[side] === 'rest') {
        // เริ่มยกแขนขึ้น
        movementPhase[side] = 'up';
        lastRepTime[side] = Date.now();
        
        if (feedbackText) {
            feedbackText.textContent = `กำลังยกแขน${side === 'left' ? 'ซ้าย' : 'ขวา'}ขึ้น...`;
        }
        
        // พูดเสียงแนะนำ
        speakText(exerciseVoiceInstructions['shoulder-flex']['up']);
        
    } else if (currentAngle[side] < prevAngle[side] - 5 && currentAngle[side] > minAngleThreshold && movementPhase[side] === 'up' && 
              prevAngle[side] >= maxAngleThreshold * 0.8) {
        // เริ่มลดแขนลง
        movementPhase[side] = 'down';
        
        if (feedbackText) {
            feedbackText.textContent = `กำลังลดแขน${side === 'left' ? 'ซ้าย' : 'ขวา'}ลง...`;
        }
        
        // พูดเสียงแนะนำ
        speakText(exerciseVoiceInstructions['shoulder-flex']['down']);
        
    } else if (currentAngle[side] < minAngleThreshold && movementPhase[side] === 'down') {
        // จบการเคลื่อนไหว 1 ครั้ง
        movementPhase[side] = 'rest';
        
        // เพิ่มตัวนับการทำท่า
        repCounter++;
        exerciseCount++;
        updateCounterDisplay();
        updateProgressBar();
        
        // คำนวณเวลาที่ใช้ในการทำท่า
        const repDuration = (Date.now() - lastRepTime[side]) / 1000;
        
        // บันทึกการทำท่า
        logSessionEvent(`ทำท่ายกแขน${side === 'left' ? 'ซ้าย' : 'ขวา'}ถูกต้อง`, `ครั้งที่ ${repCounter} ของเซต ${setCounter} (ใช้เวลา ${repDuration.toFixed(1)} วินาที)`);
        
        // ให้ข้อเสนอแนะ
        provideFeedback(repDuration, side);
        
        // พูดเสียงแนะนำ
        speakText(exerciseVoiceInstructions['shoulder-flex']['complete']);
        
        // เช็คว่าครบจำนวนครั้งในเซตหรือไม่
        checkSetCompletion();
    } else if (movementPhase[side] === 'up' && currentAngle[side] >= maxAngleThreshold * 0.9 && currentAngle[side] > prevAngle[side]) {
        // ยกได้สูงพอแล้ว แนะนำให้เริ่มลดลงได้
        if (feedbackText) {
            feedbackText.textContent = `ยกได้สูงพอแล้ว เริ่มลดแขน${side === 'left' ? 'ซ้าย' : 'ขวา'}ลงได้`;
        }
        
        // พูดเสียงแนะนำเมื่อถึงมุมที่เหมาะสม
        speakText(exerciseVoiceInstructions['shoulder-flex']['top']);
    }
    
    // อัปเดตความแม่นยำและแสดงผล
    updateAccuracy(currentAngle[side], side);
    displayAnalysisInfo(currentAngle[side], side);
}

// วิเคราะห์ท่ายกขา (Flying)
function analyzeFlying(activeSide = null) {
    if (!poseResults || !poseResults.poseLandmarks) return;
    
    const landmarks = poseResults.poseLandmarks;
    
    // กำหนดข้างที่จะวิเคราะห์
    const side = activeSide || lastDetectedSide;
    if (!side) {
        // ถ้ายังไม่มีข้างที่ตรวจจับได้ ไม่ต้องวิเคราะห์
        if (feedbackText) {
            feedbackText.textContent = 'กำลังตรวจจับการเคลื่อนไหว... กรุณาเริ่มยกขาช้าๆ';
        }
        return;
    }
    
    // ถ้าพบข้างที่กำลังเคลื่อนไหว ให้อัปเดตคำแนะนำ
    updateInstructionsBasedOnDetectedSide(side);
    
    // ตัวแปรเก็บตำแหน่ง landmarks ตามข้างที่เลือก
    let hipIndex, kneeIndex, ankleIndex;
    
    // กำหนดดัชนีของจุดสำคัญตามข้างที่เลือก
    if (side === 'right') {
        hipIndex = 24;  // สะโพกขวา
        kneeIndex = 26; // เข่าขวา
        ankleIndex = 28; // ข้อเท้าขวา
    } else {
        hipIndex = 23;  // สะโพกซ้าย
        kneeIndex = 25; // เข่าซ้าย
        ankleIndex = 27; // ข้อเท้าซ้าย
    }
    
    // ตรวจสอบว่า landmarks ที่จำเป็นถูกตรวจพบครบหรือไม่
    if (!landmarks[hipIndex] || !landmarks[kneeIndex] || !landmarks[ankleIndex] ||
        landmarks[hipIndex].visibility < 0.5 ||
        landmarks[kneeIndex].visibility < 0.5 ||
        landmarks[ankleIndex].visibility < 0.5) {
        if (feedbackText) {
            feedbackText.textContent = `ไม่สามารถตรวจจับขา${side === 'left' ? 'ซ้าย' : 'ขวา'}ได้ครบถ้วน กรุณาปรับตำแหน่ง`;
        }
        correctPostureCounter = 0;
        return;
    }
    
    // คำนวณมุมของข้อสะโพกและเข่า
    const hipAngle = calculateAngle(
        {x: landmarks[hipIndex].x, y: landmarks[hipIndex].y - 0.2},  // จุดอ้างอิงเหนือสะโพก
        {x: landmarks[hipIndex].x, y: landmarks[hipIndex].y},       // สะโพก
        {x: landmarks[kneeIndex].x, y: landmarks[kneeIndex].y}      // เข่า
    );
    
    const kneeAngle = calculateAngle(
        {x: landmarks[hipIndex].x, y: landmarks[hipIndex].y},      // สะโพก
        {x: landmarks[kneeIndex].x, y: landmarks[kneeIndex].y},    // เข่า
        {x: landmarks[ankleIndex].x, y: landmarks[ankleIndex].y}   // ข้อเท้า
    );
    
    // เก็บประวัติมุมข้อเข่า
    legAngleHistory[side].push(kneeAngle);
    if (legAngleHistory[side].length > 10) {
        legAngleHistory[side].shift(); // เก็บแค่ 10 ค่าล่าสุด
    }
    
    // คำนวณการเปลี่ยนแปลงของมุม
    const avgKneeAngle = legAngleHistory[side].reduce((sum, angle) => sum + angle, 0) / legAngleHistory[side].length;
    const kneeAngleChange = legAngleHistory[side].length > 1 ? 
        kneeAngle - legAngleHistory[side][legAngleHistory[side].length - 2] : 0;
    
    // ตรวจสอบเฟสของการเคลื่อนไหว
    if (legMovementPhase[side] === null || legMovementPhase[side] === 'rest') {
        // เริ่มยกขาเมื่อขาอยู่ในแนวเกือบตรง และเริ่มเคลื่อนไหว
        if (avgKneeAngle > 160 && hipAngle > 160 && kneeAngleChange < -2) {
            legMovementPhase[side] = 'lifting';
            if (feedbackText) {
                feedbackText.textContent = `กำลังยกขา${side === 'left' ? 'ซ้าย' : 'ขวา'}ขึ้น...`;
            }
            speakText(exerciseVoiceInstructions['flying']['lifting']);
        }
    } else if (legMovementPhase[side] === 'lifting') {
        // ตรวจสอบว่าขายกขึ้นจนเกือบตั้งฉาก (ท่า L) หรือยัง
        if (hipAngle <= 100 && hipAngle >= 70) {
            legMovementPhase[side] = 'hold';
            legHoldStartTime[side] = Date.now();
            if (feedbackText) {
                feedbackText.textContent = `คงท่าตัว L สำหรับขา${side === 'left' ? 'ซ้าย' : 'ขวา'}...`;
            }
            speakText(exerciseVoiceInstructions['flying']['hold']);
        }
    } else if (legMovementPhase[side] === 'hold') {
        // ตรวจสอบว่าได้คงท่านานพอแล้วหรือยัง (ประมาณ 2-3 วินาที)
        const holdDuration = Date.now() - legHoldStartTime[side];
        
        // ถ้าขาออกจากตำแหน่ง L แล้ว
        if (hipAngle > 110 || kneeAngleChange > 2) {
            legMovementPhase[side] = 'lowering';
            if (feedbackText) {
                feedbackText.textContent = `กำลังลดขา${side === 'left' ? 'ซ้าย' : 'ขวา'}ลง...`;
            }
            speakText(exerciseVoiceInstructions['flying']['lowering']);
        }
        // ถ้าคงท่านานพอแล้ว (3 วินาที)
        else if (holdDuration >= 3000) {
            legMovementPhase[side] = 'lowering';
            if (feedbackText) {
                feedbackText.textContent = `คงท่านานพอแล้ว กำลังลดขา${side === 'left' ? 'ซ้าย' : 'ขวา'}ลง...`;
            }
            speakText(exerciseVoiceInstructions['flying']['lowering']);
        }
    } else if (legMovementPhase[side] === 'lowering') {
        // เมื่อขากลับมาอยู่ในตำแหน่งเริ่มต้น (เกือบตรง)
        if (avgKneeAngle > 160 && hipAngle > 160) {
            legMovementPhase[side] = 'rest';
            
            // เพิ่มตัวนับการทำท่า
            repCounter++;
            exerciseCount++;
            updateCounterDisplay();
            updateProgressBar();
            
            if (feedbackText) {
                feedbackText.textContent = `ทำท่ายกขา${side === 'left' ? 'ซ้าย' : 'ขวา'}สำเร็จหนึ่งครั้ง พักสักครู่...`;
            }
            
            // บันทึกการทำท่า
            logSessionEvent(`ทำท่ายกขา${side === 'left' ? 'ซ้าย' : 'ขวา'}ถูกต้อง`, `ครั้งที่ ${repCounter} ของเซต ${setCounter}`);
            
            // พูดเสียงแนะนำ
            speakText(exerciseVoiceInstructions['flying']['complete']);
            
            // เช็คว่าครบจำนวนครั้งในเซตหรือไม่
            checkSetCompletion();
        }
    }
}

// คำนวณมุมระหว่างสามจุด
function calculateAngle(pointA, pointB, pointC) {
    // คำนวณเวคเตอร์
    const vectorAB = {
        x: pointB.x - pointA.x,
        y: pointB.y - pointA.y
    };
    
    const vectorBC = {
        x: pointC.x - pointB.x,
        y: pointC.y - pointB.y
    };
    
    // คำนวณจุดคูณเชิงสเกลาร์ (dot product)
    const dotProduct = vectorAB.x * vectorBC.x + vectorAB.y * vectorBC.y;
    
    // คำนวณขนาดของเวคเตอร์
    const magnitudeAB = Math.sqrt(vectorAB.x ** 2 + vectorAB.y ** 2);
    const magnitudeBC = Math.sqrt(vectorBC.x ** 2 + vectorBC.y ** 2);
    
    // หลีกเลี่ยงการหารด้วยศูนย์
    if (magnitudeAB === 0 || magnitudeBC === 0) {
        return 0;
    }
    
    // คำนวณ cos ของมุม
    const cosTheta = dotProduct / (magnitudeAB * magnitudeBC);
    
    // ป้องกันข้อผิดพลาดจากการคำนวณ (cos อาจเกิน 1 หรือต่ำกว่า -1 เล็กน้อยเนื่องจากความคลาดเคลื่อนในการคำนวณ)
    const clampedCosTheta = Math.max(-1, Math.min(1, cosTheta));
    
    // แปลงเป็นองศา
    const angleInRadians = Math.acos(clampedCosTheta);
    const angleInDegrees = angleInRadians * (180 / Math.PI);
    
    return angleInDegrees;
}

// ให้ข้อเสนอแนะตามความเร็วและมุมในการทำท่า
function provideFeedback(repDuration, side) {
    if (!feedbackText) return;
    
    let feedback = '';
    
    if (currentExercise === 'shoulder-flex') {
        if (repDuration < 2) {
            feedback = exerciseFeedback['shoulder-flex']['too_fast'];
            speakText(exerciseVoiceInstructions['shoulder-flex']['too_fast']);
        } else if (repDuration > 5) {
            feedback = exerciseFeedback['shoulder-flex']['too_slow'];
            speakText(exerciseVoiceInstructions['shoulder-flex']['too_slow']);
        } else {
            feedback = exerciseFeedback['shoulder-flex']['good'];
        }
        
        feedbackText.textContent = feedback;
    } else if (currentExercise === 'flying') {
        feedback = exerciseFeedback['flying'];
        feedbackText.textContent = feedback;
    }
}

// อัปเดตความแม่นยำของท่าทาง
function updateAccuracy(angle, side) {
    if (!accuracyElement) return;
    
    let accuracy = 0;
    
    if (currentExercise === 'shoulder-flex') {
        // ประเมินความแม่นยำจากมุมและความนุ่มนวลของการเคลื่อนไหว
        if (angle >= minAngleThreshold && angle <= maxAngleThreshold) {
            // ถ้าอยู่ในช่วงมุมที่เหมาะสม
            accuracy = 90 + (10 * (1 - Math.abs(angle - ((minAngleThreshold + maxAngleThreshold) / 2)) / 
                              ((maxAngleThreshold - minAngleThreshold) / 2)));
        } else if (angle < minAngleThreshold) {
            // ถ้ามุมน้อยเกินไป
            accuracy = 90 * (angle / minAngleThreshold);
        } else {
            // ถ้ามุมมากเกินไป
            const overAngle = angle - maxAngleThreshold;
            accuracy = Math.max(70, 90 - (overAngle * 2));
        }
    } else if (currentExercise === 'flying') {
        // ประเมินความแม่นยำสำหรับท่ายกขา (ด้วยการตั้งค่าเริ่มต้น)
        accuracy = 85;
        
        if (legMovementPhase[side] === 'hold') {
            // ถ้าอยู่ในช่วงคงท่าตัว L
            accuracy = 95;
        }
    }
    
    // ปัดเศษเป็นจำนวนเต็ม
    accuracy = Math.round(accuracy);
    
    // ป้องกันไม่ให้ต่ำกว่า 0 หรือเกิน 100
    accuracy = Math.max(0, Math.min(100, accuracy));
    
    // อัปเดตการแสดงผล
    accuracyElement.textContent = `${accuracy}%`;
    
    // เปลี่ยนสีตามระดับความแม่นยำ
    if (accuracy >= 90) {
        accuracyElement.style.color = '#4CAF50'; // เขียว
    } else if (accuracy >= 70) {
        accuracyElement.style.color = '#FFC107'; // เหลือง
    } else {
        accuracyElement.style.color = '#F44336'; // แดง
    }
}

// แสดงข้อมูลการวิเคราะห์เพิ่มเติม
function displayAnalysisInfo(angle, side) {
    // ฟังก์ชันนี้สามารถเพิ่มเติมเพื่อแสดงข้อมูลการวิเคราะห์เพิ่มเติมในอนาคต
    // เช่น ข้อมูลความเร็ว, รูปแบบการเคลื่อนไหว, ฯลฯ
    
    // อัปเดตการแสดงเวลาการฝึก
    updateExerciseTimer();
}

// เช็คว่าครบจำนวนครั้งในเซตหรือไม่
function checkSetCompletion() {
    if (repCounter >= targetReps) {
        if (setCounter < targetSets) {
            // ครบจำนวนครั้งในเซต แต่ยังไม่ครบจำนวนเซต
            setCounter++;
            repCounter = 0;
            
            // แสดงข้อความพักระหว่างเซต
            if (feedbackText) {
                feedbackText.textContent = `เสร็จสิ้นเซตที่ ${setCounter - 1} พัก 30 วินาทีก่อนเริ่มเซตที่ ${setCounter}`;
            }
            
            // อัปเดตการแสดงผล
            updateCounterDisplay();
            
            // เริ่มตัวนับเวลาพัก
            if (isResting) {
                clearInterval(restTimer);
            }
            
            isResting = true;
            restTimeRemaining = 30; // พัก 30 วินาที
            
            // แสดงการนับถอยหลัง
            restTimer = setInterval(() => {
                restTimeRemaining--;
                
                if (feedbackText) {
                    feedbackText.textContent = `พักระหว่างเซต: ${restTimeRemaining} วินาที`;
                }
                
                if (restTimeRemaining <= 0) {
                    clearInterval(restTimer);
                    isResting = false;
                    
                    if (feedbackText) {
                        feedbackText.textContent = `เริ่มเซตที่ ${setCounter}`;
                    }
                    
                    // พูดเสียงแนะนำเริ่มเซตใหม่
                    speakText(exerciseVoiceInstructions[currentExercise]['start'], true);
                }
            }, 1000);
            
            // พูดแนะนำการพัก
            speakText(exerciseVoiceInstructions[currentExercise]['rest'], true);
            
        } else {
            // ครบทั้งจำนวนครั้งและจำนวนเซต (เสร็จสิ้นการฝึก)
            if (successAlert) {
                successAlert.style.display = 'block';
                successAlert.textContent = `ยินดีด้วย! คุณทำครบ ${targetReps} ครั้ง ${targetSets} เซตแล้ว`;
            }
            
            if (feedbackText) {
                feedbackText.textContent = 'เสร็จสิ้นการฝึกแล้ว';
            }
            
            // หยุดการตรวจจับ
            isDetecting = false;
            
            // เปลี่ยนปุ่มเป็นปุ่มเริ่ม
            if (startButton) {
                startButton.innerHTML = '<i class="fas fa-play"></i> เริ่มการฝึก';
            }
            
            // บันทึกเหตุการณ์สิ้นสุดเซสชัน
            logSessionEvent('เสร็จสิ้นการฝึก', `ทำครบ ${targetReps} ครั้ง ${targetSets} เซต`);
            
            // หยุดวิดีโอถ้าใช้ไฟล์วิดีโอ
            if (videoSource === 'file') {
                videoElement.pause();
            }
            
            // พูดคำแนะนำเสร็จสิ้น
            speakText("ยินดีด้วย คุณทำครบจำนวนที่กำหนดแล้ว", true);
        }
    }
}

// อัปเดตการแสดงผลตัวนับ
function updateCounterDisplay() {
    if (repCountElement) {
        let countDisplay = `${repCounter}/${targetReps} (เซต ${setCounter}/${targetSets})`;
        
        // เพิ่มการแสดงข้างที่กำลังฝึกเพื่อความชัดเจน
        if (lastDetectedSide) {
            countDisplay += ` - ข้าง${lastDetectedSide === 'left' ? 'ซ้าย' : 'ขวา'}`;
        }
        
        repCountElement.textContent = countDisplay;
    }
}
// เพิ่มฟังก์ชันใหม่เพื่ออัปเดตคำแนะนำตามข้างที่ตรวจพบ
function updateInstructionsBasedOnDetectedSide(side) {
    if (!side || !instructionText) return;
    
    // อัปเดตคำแนะนำตามข้างที่ตรวจพบ
    if (currentExercise === 'shoulder-flex') {
        const baseInstructions = exerciseInstructions['shoulder-flex'];
        instructionText.textContent = `${baseInstructions} (ข้าง${side === 'left' ? 'ซ้าย' : 'ขวา'})`;
    } else if (currentExercise === 'flying') {
        const baseInstructions = exerciseInstructions['flying'];
        instructionText.textContent = `${baseInstructions} (ข้าง${side === 'left' ? 'ซ้าย' : 'ขวา'})`;
    }
}

// อัปเดตแถบความคืบหน้า
function updateProgressBar() {
    if (!progressBar || !progressText) return;
    
    // คำนวณความคืบหน้ารวม
    const totalReps = targetReps * targetSets;
    const completedReps = ((setCounter - 1) * targetReps) + repCounter;
    const progressPercentage = Math.min(100, Math.round((completedReps / totalReps) * 100));
    
    // อัปเดตแถบความคืบหน้าและข้อความ
    progressBar.style.width = `${progressPercentage}%`;
    progressText.textContent = `${progressPercentage}%`;
    
    // เปลี่ยนสีตามระดับความคืบหน้า
    if (progressPercentage < 30) {
        progressBar.style.backgroundColor = '#F44336'; // แดง
    } else if (progressPercentage < 70) {
        progressBar.style.backgroundColor = '#FFC107'; // เหลือง
    } else {
        progressBar.style.backgroundColor = '#4CAF50'; // เขียว
    }
}

// อัปเดตการแสดงเวลาการฝึก
function updateExerciseTimer() {
    if (!timeElement || !sessionStartTime) return;
    
    const currentTime = Date.now();
    const elapsedTimeInSeconds = Math.floor((currentTime - sessionStartTime) / 1000);
    
    // แปลงเป็นรูปแบบ นาที:วินาที
    const minutes = Math.floor(elapsedTimeInSeconds / 60);
    const seconds = elapsedTimeInSeconds % 60;
    
    // แสดงผล
    timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// บันทึกเหตุการณ์เซสชัน
function logSessionEvent(eventType, details) {
    // สร้างข้อมูลเหตุการณ์
    const eventData = {
        type: eventType,
        details: details,
        timestamp: new Date().toISOString(),
        exercise: currentExercise,
        side: detectedSide === 'auto' ? lastDetectedSide : detectedSide
    };
    
    // เพิ่มลงในประวัติ
    exerciseHistory.push(eventData);
    
    // แสดงในคอนโซล (สำหรับการดีบัก)
    console.log('[บันทึกเซสชัน]', eventData);
    
    // บันทึกลงในที่เก็บข้อมูลในเบราว์เซอร์ (localStorage)
    try {
        // ดึงข้อมูลเดิม (ถ้ามี)
        let savedHistory = localStorage.getItem('exerciseHistory');
        let historyArray = savedHistory ? JSON.parse(savedHistory) : [];
        
        // เพิ่มข้อมูลใหม่
        historyArray.push(eventData);
        
        // จำกัดจำนวนรายการที่เก็บไว้ (เก็บเฉพาะ 100 รายการล่าสุด)
        if (historyArray.length > 100) {
            historyArray = historyArray.slice(-100);
        }
        
        // บันทึกกลับไป
        localStorage.setItem('exerciseHistory', JSON.stringify(historyArray));
    } catch (error) {
        console.error('ไม่สามารถบันทึกประวัติลง localStorage:', error);
    }
}

// อัปเดตตารางประวัติ
function updateHistoryTable() {
    const historyTable = document.getElementById('record-table-body');
    if (!historyTable) return;
    
    // ลบแถวเดิม
    while (historyTable.rows.length > 0) {
        historyTable.deleteRow(0);
    }
    
    try {
        // ดึงข้อมูลประวัติจาก localStorage
        let savedHistory = localStorage.getItem('exerciseHistory');
        let historyArray = savedHistory ? JSON.parse(savedHistory) : [];
        
        // กรองเฉพาะเหตุการณ์สำคัญ
        const filteredHistory = historyArray.filter(event => 
            event.type.includes('เริ่ม') || 
            event.type.includes('เสร็จสิ้น') || 
            event.type.includes('ทำท่า')
        );
        
        // เรียงลำดับตามเวลา (ล่าสุดขึ้นก่อน)
        filteredHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // เพิ่มข้อมูลลงในตาราง
        for (const event of filteredHistory) {
            const row = historyTable.insertRow();
            
            // เวลา
            const timeCell = row.insertCell();
            const eventDate = new Date(event.timestamp);
            timeCell.textContent = eventDate.toLocaleString('th-TH');
            
            // ประเภทท่า
            const exerciseCell = row.insertCell();
            let exerciseName = '';
            if (event.exercise === 'shoulder-flex') {
                exerciseName = 'ยกแขน';
            } else if (event.exercise === 'flying') {
                exerciseName = 'ยกขา';
            }
            exerciseCell.textContent = exerciseName;
            
            // ข้าง
            const sideCell = row.insertCell();
            sideCell.textContent = event.side === 'left' ? 'ซ้าย' : 
                                 event.side === 'right' ? 'ขวา' : 'อัตโนมัติ';
            
            // เหตุการณ์
            const eventCell = row.insertCell();
            eventCell.textContent = event.type;
            
            // รายละเอียด
            const detailCell = row.insertCell();
            detailCell.textContent = event.details || '-';
            
            // เพิ่มปุ่มการจัดการ (ถ้าจำเป็น)
            const actionCell = row.insertCell();
            if (event.type.includes('ทำท่า')) {
                const deleteButton = document.createElement('button');
                deleteButton.className = 'btn-icon';
                deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
                deleteButton.title = 'ลบรายการนี้';
                deleteButton.addEventListener('click', () => {
                    // ลบรายการนี้ออกจากประวัติ
                    historyArray = historyArray.filter(item => item.timestamp !== event.timestamp);
                    // บันทึกกลับลง localStorage
                    localStorage.setItem('exerciseHistory', JSON.stringify(historyArray));
                    // อัปเดตตารางใหม่
                    updateHistoryTable();
                });
                actionCell.appendChild(deleteButton);
            }
        }
        
        // ถ้าไม่มีข้อมูล
        if (filteredHistory.length === 0) {
            const row = historyTable.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 6; // ปรับให้ครอบคลุมทุก column รวมคอลัมน์การจัดการ
            cell.textContent = 'ไม่มีประวัติการฝึก';
            cell.style.textAlign = 'center';
        }
    } catch (error) {
        console.error('ไม่สามารถโหลดประวัติจาก localStorage:', error);
        
        // กรณีเกิดข้อผิดพลาด
        const row = historyTable.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6; // ปรับให้ครอบคลุมทุก column รวมคอลัมน์การจัดการ
        cell.textContent = 'เกิดข้อผิดพลาดในการโหลดประวัติ';
        cell.style.textAlign = 'center';
    }
}

// ฟังก์ชันใหม่สำหรับสมูทข้างที่ตรวจจับได้
function smoothDetectedSide(detectedSide) {
    // เพิ่มผลการตรวจจับล่าสุดลงในประวัติ
    if (detectedSide !== null) {
        detectedSideHistory.push(detectedSide);
    
        // จำกัดขนาดของประวัติ
        if (detectedSideHistory.length > sideHistorySize) {
            detectedSideHistory.shift();
        }
    }
    
    // ถ้าประวัติยังไม่มีข้อมูลพอ ให้ใช้ค่าล่าสุดไปก่อน
    if (detectedSideHistory.length < 3) {
        return detectedSide;
    }
    
    // นับจำนวนของแต่ละข้าง
    const sideCounts = { left: 0, right: 0, null: 0 };
    
    for (const side of detectedSideHistory) {
        if (side === 'left') sideCounts.left++;
        else if (side === 'right') sideCounts.right++;
        else sideCounts.null++;
    }
    
    // ถ้ามีข้างใดข้างหนึ่งเป็นส่วนใหญ่ (มากกว่า 70%)
    const threshold = detectedSideHistory.length * 0.7;
    
    if (sideCounts.left > threshold) {
        return 'left';
    } else if (sideCounts.right > threshold) {
        return 'right';
    }
    
    // ถ้าข้างล่าสุดแตกต่างจากข้างก่อนหน้า แต่ยังไม่มีความมั่นใจพอ
    // ให้ใช้ข้างเดิมไปก่อน เพื่อป้องกันการสลับไปมา
    const latestSide = detectedSideHistory[detectedSideHistory.length - 1];
    const prevSide = lastDetectedSide || detectedSideHistory[0];
    
    if (latestSide !== prevSide) {
        // ต้องมีข้างใหม่ที่ตรวจจับซ้ำอย่างน้อย 3 ครั้งติดต่อกัน
        // ก่อนจะเปลี่ยนข้างที่ตรวจจับ
        const lastThreeSides = detectedSideHistory.slice(-3);
        const allSame = lastThreeSides.every(side => side === latestSide);
        
        if (!allSame) {
            return prevSide; // ยังใช้ข้างเดิมไปก่อน
        }
    }
    
    // ใช้ข้างล่าสุด
    return latestSide;
}

// เพิ่มปุ่มบังคับเลือกข้าง
function addForceSideButtons() {
    // สร้างปุ่มเลือกข้างซ้าย
    const leftButton = document.createElement('button');
    leftButton.className = 'side-force-btn left';
    leftButton.innerHTML = 'บังคับซ้าย';
    leftButton.style.position = 'absolute';
    leftButton.style.top = '10px';
    leftButton.style.right = '180px';
    leftButton.style.background = 'rgba(255, 153, 153, 0.7)';
    leftButton.style.color = 'white';
    leftButton.style.padding = '5px 10px';
    leftButton.style.borderRadius = '5px';
    leftButton.style.border = 'none';
    leftButton.style.cursor = 'pointer';
    leftButton.style.zIndex = '10';
    leftButton.style.fontSize = '12px';
    
    // สร้างปุ่มเลือกข้างขวา
    const rightButton = document.createElement('button');
    rightButton.className = 'side-force-btn right';
    rightButton.innerHTML = 'บังคับขวา';
    rightButton.style.position = 'absolute';
    rightButton.style.top = '10px';
    rightButton.style.right = '100px';
    rightButton.style.background = 'rgba(153, 204, 255, 0.7)';
    rightButton.style.color = 'white';
    rightButton.style.padding = '5px 10px';
    rightButton.style.borderRadius = '5px';
    rightButton.style.border = 'none';
    rightButton.style.cursor = 'pointer';
    rightButton.style.zIndex = '10';
    rightButton.style.fontSize = '12px';
    
    // สร้างปุ่มเลือกอัตโนมัติ
    const autoButton = document.createElement('button');
    autoButton.className = 'side-force-btn auto';
    autoButton.innerHTML = 'อัตโนมัติ';
    autoButton.style.position = 'absolute';
    autoButton.style.top = '10px';
    autoButton.style.right = '10px';
    autoButton.style.background = 'rgba(0, 255, 0, 0.7)';
    autoButton.style.color = 'white';
    autoButton.style.padding = '5px 10px';
    autoButton.style.borderRadius = '5px';
    autoButton.style.border = 'none';
    autoButton.style.cursor = 'pointer';
    autoButton.style.zIndex = '10';
    autoButton.style.fontSize = '12px';
    
    // เพิ่มการทำงานให้กับปุ่ม
    leftButton.addEventListener('click', function() {
        detectedSide = 'left';
        lastDetectedSide = 'left';
        updateSideIndicator('ซ้าย');
        speakText('บังคับเลือกข้างซ้าย');
        
        // รีเซ็ตค่าความมั่นใจ
        sideConfidenceCount = { left: 10, right: 0 };
        detectedSideHistory = Array(10).fill('left');
    });
    
    rightButton.addEventListener('click', function() {
        detectedSide = 'right';
        lastDetectedSide = 'right';
        updateSideIndicator('ขวา');
        speakText('บังคับเลือกข้างขวา');
        
        // รีเซ็ตค่าความมั่นใจ
        sideConfidenceCount = { left: 0, right: 10 };
        detectedSideHistory = Array(10).fill('right');
    });
    
    autoButton.addEventListener('click', function() {
        detectedSide = 'auto';
        // รีเซ็ตค่าการตรวจจับ
        lastDetectedSide = null;
        sideConfidenceCount = { left: 0, right: 0 };
        detectedSideHistory = [];
        updateSideIndicator('อัตโนมัติ');
        speakText('กลับสู่การตรวจจับอัตโนมัติ');
    });
    
    // เพิ่มปุ่มเข้าไปใน DOM
    if (videoContainer) {
        videoContainer.appendChild(leftButton);
        videoContainer.appendChild(rightButton);
        videoContainer.appendChild(autoButton);
    }
}
// เพิ่มปุ่มเริ่มต้นระบบเสียง
function addSpeechInitButton() {
    const button = document.createElement('button');
    button.textContent = 'เริ่มระบบเสียง';
    button.className = 'btn-primary';
    button.style.marginBottom = '10px';
    button.onclick = function() {
        // เริ่มเสียงทดสอบเมื่อผู้ใช้คลิก
        speakText('ระบบเสียงพร้อมใช้งานแล้ว', true);
        this.disabled = true;
        this.textContent = 'เริ่มระบบเสียงแล้ว';
        setTimeout(() => {
            this.style.display = 'none';
        }, 3000);
    };
    
    // เพิ่มปุ่มเข้าไปในส่วนควบคุม
    const controlArea = document.querySelector('.camera-controls');
    if (controlArea) {
        controlArea.prepend(button);
    }
}
function checkSpeechSupport() {
    if (!window.speechSynthesis) {
        console.error('เบราว์เซอร์นี้ไม่รองรับ Speech Synthesis');
        
        // แสดงข้อความแจ้งเตือนผู้ใช้
        const warningElement = document.createElement('div');
        warningElement.className = 'speech-warning';
        warningElement.textContent = 'เบราว์เซอร์ของคุณไม่รองรับคำแนะนำด้วยเสียง โปรดใช้ Chrome หรือ Edge เพื่อประสบการณ์ที่ดีที่สุด';
        warningElement.style.backgroundColor = '#FFF3CD';
        warningElement.style.color = '#856404';
        warningElement.style.padding = '10px';
        warningElement.style.margin = '10px 0';
        warningElement.style.borderRadius = '5px';
        
        // เพิ่มเข้าไปในส่วนต้นของแอป
        const appContainer = document.querySelector('.container');
        if (appContainer) {
            appContainer.prepend(warningElement);
        }
        
        // ใช้ข้อความแทน
        useSpeechFallback = true;
        return false;
    }
    return true;
}
// เพิ่มฟังก์ชันสำหรับเรียกใช้ setupVideoUpload จาก video-upload.js
// ให้เพิ่มฟังก์ชันนี้ไว้ในไฟล์ script.js ทั้งหมด
// โดยทำให้แน่ใจว่า MediaPipe ถูกโหลดและพร้อมใช้งานแล้ว
function initVideoUploadFeature() {
    // ตรวจสอบว่าฟังก์ชัน setupVideoUpload จาก video-upload.js ถูกโหลดแล้วหรือไม่
    if (typeof window.setupVideoUpload === 'function') {
        console.log('เริ่มต้นคุณสมบัติอัปโหลดวิดีโอ');
        // เรียกใช้ฟังก์ชัน setupVideoUpload
        window.setupVideoUpload();
    } else {
        // ถ้าไม่พบฟังก์ชัน setupVideoUpload ให้ลองใหม่ในอีก 500ms
        console.log('รอฟังก์ชัน setupVideoUpload ให้พร้อมใช้งาน');
        setTimeout(initVideoUploadFeature, 500);
    }
}

// แก้ไขฟังก์ชัน window.onload เพื่อเรียกใช้ initVideoUploadFeature หลังจาก MediaPipe พร้อมใช้งาน
window.onload = function() {
    loadMediaPipeLibraries().then(() => {
      console.log("MediaPipe libraries loaded successfully");
      setupPoseDetection();
      initSpeechSystem();
      
      // เรียกใช้ initVideoUploadFeature หลังจาก MediaPipe พร้อมใช้งาน
      initVideoUploadFeature();
    }).catch(error => {
      console.error("Failed to load MediaPipe libraries:", error);
    });
};
